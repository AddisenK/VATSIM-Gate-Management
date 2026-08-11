/**
 * lib/vatsim-gate-puller.js
 * ----------------------------------------------------------------
 * MIT License — free to use, modify, and redistribute.
 *
 * Open-source "puller" module for real-world gate occupancy inference.
 *
 * Pipeline:
 *   1. Pull live aircraft positions from the VATSIM public data feed.
 *   2. Pull the airport's real gate/parking-position map from OpenStreetMap
 *      (via the Overpass API) — deduplicated by gate code so each gate
 *      appears exactly once, even if OSM has multiple nodes sharing a ref
 *      (e.g. a stand node + a separate lead-in-line node both tagged "B22").
 *   3. Overlay live positions onto the gate map (nearest-match geofencing)
 *      and return which gate each aircraft is most likely parked at.
 *
 * Data sources:
 *   - VATSIM data feed:  https://data.vatsim.net/v3/vatsim-data.json  (no key)
 *   - OSM Overpass API:  https://overpass-api.de/api/interpreter     (no key)
 *
 * Requirements: Node.js 18+ (built-in fetch) or any runtime with fetch().
 *
 * IMPORTANT — occupancy classification:
 *   A gate is marked "occupied" as soon as a live VATSIM pilot's position is
 *   found within CONFIG.matchRadiusMeters of it (groundspeed <5kt, recent
 *   last_updated). This is a single-snapshot match — VATSIM has no gate
 *   field, so this is always an inference, never a guarantee.
 *
 * IMPORTANT — dedup note:
 *   OSM often tags the same physical gate with multiple nodes sharing the
 *   same "ref" (e.g. the stopping point + a taxi-lead-in node). Without
 *   deduplication this causes the SAME gate code to appear twice on a map —
 *   one dot occupied, one dot available — which looks like a bug even though
 *   both nodes genuinely exist in OSM. fetchAirportGates() merges all nodes
 *   sharing a code into a single representative point (their centroid).
 *
 * IMPORTANT — serverless note:
 *   The in-memory `pollHistory` Map only persists within a single warm
 *   function instance and only across requests that happen to land on that
 *   same instance. Treat `confidence` as a soft signal, not a strict filter.
 *
 * IMPORTANT — Overpass reliability note:
 *   overpass-api.de is a free, shared, public server. It occasionally returns
 *   504/502/503 under load. fetchAirportGates() below retries automatically
 *   (with backoff) before giving up.
 */

const VATSIM_DATA_URL = "https://data.vatsim.net/v3/vatsim-data.json";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

const CONFIG = {
  matchRadiusMeters: 70,
  nearbyRadiusKm: 6,
  maxStaleMs: 30_000,
  minPollsForMedium: 2,
  minPollsForHigh: 3,
  overpassBufferDeg: 0.03,
  overpassMaxRetries: 3,
  overpassRetryDelayMs: 1500,
  overpassTimeoutMs: 20000,
};

const pollHistory = new Map();

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchVatsimPilots() {
  const res = await fetch(VATSIM_DATA_URL);
  if (!res.ok) throw new Error(`VATSIM feed error: ${res.status}`);
  const data = await res.json();
  return data.pilots || [];
}

// Merge OSM nodes/ways that share the same gate code into one representative point.
function dedupeGatesByCode(rawGates) {
  const groups = new Map(); // code -> array of points
  rawGates.forEach((g) => {
    const key = g.code;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(g);
  });

  const merged = [];
  for (const [code, points] of groups.entries()) {
    if (points.length === 1) {
      merged.push(points[0]);
      continue;
    }
    // multiple OSM elements share this code -> collapse to their centroid
    const avgLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
    const avgLon = points.reduce((sum, p) => sum + p.lon, 0) / points.length;
    merged.push({ code, lat: avgLat, lon: avgLon, source: "osm", mergedFrom: points.length });
  }
  return merged;
}

async function fetchAirportGates(airportLat, airportLon) {
  const d = CONFIG.overpassBufferDeg;
  const bbox = `${airportLat - d},${airportLon - d},${airportLat + d},${airportLon + d}`;
  const query = `
    [out:json][timeout:25];
    (
      node["aeroway"="parking_position"](${bbox});
      way["aeroway"="parking_position"](${bbox});
    );
    out center;
  `;

  let lastError;
  for (let attempt = 1; attempt <= CONFIG.overpassMaxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.overpassTimeoutMs);

    try {
      const res = await fetch(OVERPASS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
          "User-Agent": "vatsim-gate-puller/1.0 (open-source; contact via GitHub repo)",
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const retryable = [429, 502, 503, 504].includes(res.status);
        if (retryable && attempt < CONFIG.overpassMaxRetries) {
          lastError = new Error(`Overpass API error: ${res.status}`);
          await sleep(CONFIG.overpassRetryDelayMs * attempt);
          continue;
        }
        throw new Error(`Overpass API error: ${res.status}`);
      }

      const data = await res.json();
      const rawGates = data.elements
        .map((el) => {
          const lat = el.lat ?? el.center?.lat;
          const lon = el.lon ?? el.center?.lon;
          if (lat == null || lon == null) return null;
          return {
            code: el.tags?.ref || el.tags?.name || `OSM-${el.id}`,
            lat,
            lon,
            source: "osm",
          };
        })
        .filter(Boolean);

      return dedupeGatesByCode(rawGates);
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;
      if (attempt < CONFIG.overpassMaxRetries) {
        await sleep(CONFIG.overpassRetryDelayMs * attempt);
        continue;
      }
    }
  }
  throw lastError || new Error("Overpass API request failed after retries");
}

function confidenceFromPolls(count) {
  if (count >= CONFIG.minPollsForHigh) return "high";
  if (count >= CONFIG.minPollsForMedium) return "medium";
  return "low";
}

async function pullAndOverlay(airportLat, airportLon, gateOverride = null) {
  const [pilots, gates] = await Promise.all([
    fetchVatsimPilots(),
    gateOverride ? Promise.resolve(gateOverride) : fetchAirportGates(airportLat, airportLon),
  ]);

  const now = Date.now();

  const candidates = pilots.filter((p) => {
    if (p.groundspeed >= 5) return false;
    if (!p.flight_plan) return false;
    const ageMs = now - new Date(p.last_updated).getTime();
    if (ageMs > CONFIG.maxStaleMs) return false;
    const distKm = haversineMeters(p.latitude, p.longitude, airportLat, airportLon) / 1000;
    return distKm <= CONFIG.nearbyRadiusKm;
  });

  const seenThisPoll = new Set();
  candidates.forEach((p) => {
    seenThisPoll.add(p.callsign);
    const h = pollHistory.get(p.callsign) || { count: 0 };
    h.count += 1;
    h.lastSeen = now;
    pollHistory.set(p.callsign, h);
  });
  for (const [callsign] of pollHistory.entries()) {
    if (!seenThisPoll.has(callsign)) pollHistory.delete(callsign);
  }

  const results = gates.map((gate) => {
    const occupant = candidates.find(
      (p) => haversineMeters(p.latitude, p.longitude, gate.lat, gate.lon) <= CONFIG.matchRadiusMeters
    );
    if (!occupant) {
      return { gate: gate.code, lat: gate.lat, lon: gate.lon, status: "available", confidence: null, callsign: null, aircraft: null };
    }
    const history = pollHistory.get(occupant.callsign);
    const confidence = confidenceFromPolls(history.count);
    return {
      gate: gate.code,
      lat: gate.lat,
      lon: gate.lon,
      status: "occupied",
      confidence,
      callsign: occupant.callsign,
      aircraft: occupant.flight_plan?.aircraft_short || occupant.flight_plan?.aircraft || null,
    };
  });

  return { polledAt: new Date(now).toISOString(), gateCount: gates.length, gates: results };
}

async function pullWithWarmup(airportLat, airportLon, cycles = 3, intervalMs = 15000) {
  const gates = await fetchAirportGates(airportLat, airportLon);
  let last;
  for (let i = 0; i < cycles; i++) {
    last = await pullAndOverlay(airportLat, airportLon, gates);
    if (i < cycles - 1) await new Promise((r) => setTimeout(r, intervalMs));
  }
  return last;
}

if (typeof require !== "undefined" && require.main === module) {
  const lat = parseFloat(process.argv[2]);
  const lon = parseFloat(process.argv[3]);
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    console.error("Usage: node vatsim-gate-puller.js <airportLat> <airportLon>");
    process.exit(1);
  }
  pullAndOverlay(lat, lon)
    .then((snapshot) => console.log(JSON.stringify(snapshot, null, 2)))
    .catch((err) => {
      console.error("Puller failed:", err.message);
      process.exit(1);
    });
}

module.exports = {
  fetchVatsimPilots,
  fetchAirportGates,
  pullAndOverlay,
  pullWithWarmup,
  CONFIG,
};
