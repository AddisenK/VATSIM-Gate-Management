/**
 * lib/vatsim-gate-puller.js
 * ----------------------------------------------------------------
 * MIT License — free to use, modify, and redistribute.
 *
 * Split into two concerns for performance:
 *   - fetchAirportGates(): the expensive part (3 parallel Overpass queries:
 *     gate positions, runway geometry, apron/taxiway geometry). This should
 *     be called rarely — the physical layout of an airport doesn't change
 *     minute to minute. Cache the result client-side or via CDN headers.
 *   - matchOccupancy(): the cheap part (one VATSIM fetch + geometric match
 *     against an already-known gate list). This is what should run on every
 *     15s auto-refresh — it never touches Overpass.
 *
 * Data sources:
 *   - VATSIM data feed:  https://data.vatsim.net/v3/vatsim-data.json  (no key)
 *   - OSM Overpass API:  https://overpass-api.de/api/interpreter     (no key)
 */

const VATSIM_DATA_URL = "https://data.vatsim.net/v3/vatsim-data.json";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

const CONFIG = {
  matchRadiusMeters: 30,
  nearbyRadiusKm: 6,
  maxStaleMs: 30_000,
  minPollsForMedium: 2,
  minPollsForHigh: 3,
  overpassBufferDeg: 0.03,
  overpassMaxRetries: 3,
  overpassRetryDelayMs: 1500,
  overpassTimeoutMs: 20000,
  runwayExclusionMeters: 90,
  apronProximityMeters: 120,
};

const DELETED_BAYS = new Set(["104", "107"]);

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

function metersPerDegree(lat) {
  const latRad = (lat * Math.PI) / 180;
  return { lat: 111320, lon: 111320 * Math.cos(latRad) };
}

function pointToSegmentMeters(p, a, b) {
  const mpd = metersPerDegree(p.lat);
  const toXY = (pt) => ({ x: pt.lon * mpd.lon, y: pt.lat * mpd.lat });
  const P = toXY(p), A = toXY(a), B = toXY(b);
  const ABx = B.x - A.x, ABy = B.y - A.y;
  const APx = P.x - A.x, APy = P.y - A.y;
  const abLenSq = ABx * ABx + ABy * ABy;
  let t = abLenSq === 0 ? 0 : (APx * ABx + APy * ABy) / abLenSq;
  t = Math.max(0, Math.min(1, t));
  const closest = { x: A.x + t * ABx, y: A.y + t * ABy };
  const dx = P.x - closest.x, dy = P.y - closest.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function distanceToNearestLine(point, lines) {
  let min = Infinity;
  for (const line of lines) {
    for (let i = 0; i < line.length - 1; i++) {
      const d = pointToSegmentMeters(point, line[i], line[i + 1]);
      if (d < min) min = d;
    }
  }
  return min;
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

function isAmbiguousRef(ref) {
  if (/[;,]/.test(ref)) return true;
  if (/\s/.test(ref.trim())) return true;
  return false;
}

function dedupeGatesByCode(rawGates) {
  const groups = new Map();
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
    const avgLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
    const avgLon = points.reduce((sum, p) => sum + p.lon, 0) / points.length;
    merged.push({ code, lat: avgLat, lon: avgLon, source: "osm", mergedFrom: points.length });
  }
  return merged;
}

async function overpassQuery(query) {
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
      return await res.json();
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

// EXPENSIVE — 3 parallel Overpass queries. Call this rarely (once per
// location/airport), never on every refresh tick. Cache the result.
async function fetchAirportGates(airportLat, airportLon) {
  const d = CONFIG.overpassBufferDeg;
  const bbox = `${airportLat - d},${airportLon - d},${airportLat + d},${airportLon + d}`;

  const gateQuery = `
    [out:json][timeout:25];
    (
      node["aeroway"="parking_position"](${bbox});
      way["aeroway"="parking_position"](${bbox});
    );
    out center;
  `;
  const runwayQuery = `
    [out:json][timeout:25];
    (way["aeroway"="runway"](${bbox}););
    out geom;
  `;
  const apronTaxiwayQuery = `
    [out:json][timeout:25];
    (
      way["aeroway"="apron"](${bbox});
      way["aeroway"="taxiway"](${bbox});
    );
    out geom;
  `;

  const [gateData, runwayData, aptxData] = await Promise.all([
    overpassQuery(gateQuery),
    overpassQuery(runwayQuery).catch(() => ({ elements: [] })),
    overpassQuery(apronTaxiwayQuery).catch(() => ({ elements: [] })),
  ]);

  const toLines = (elements) =>
    (elements || [])
      .filter((el) => el.type === "way" && Array.isArray(el.geometry))
      .map((el) => el.geometry.map((pt) => ({ lat: pt.lat, lon: pt.lon })));

  const runwayLines = toLines(runwayData.elements);
  const aptxLines = toLines(aptxData.elements);

  const rawGates = gateData.elements
    .map((el) => {
      const ref = el.tags?.ref || el.tags?.name;
      if (!ref) return null;
      if (isAmbiguousRef(ref)) return null;
      if (DELETED_BAYS.has(ref.trim())) return null;
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      if (lat == null || lon == null) return null;
      return { code: ref.trim(), lat, lon, source: "osm" };
    })
    .filter(Boolean);

  let deduped = dedupeGatesByCode(rawGates);

  if (runwayLines.length > 0) {
    deduped = deduped.filter(
      (gate) => distanceToNearestLine(gate, runwayLines) >= CONFIG.runwayExclusionMeters
    );
  }
  if (aptxLines.length > 0) {
    deduped = deduped.filter(
      (gate) => distanceToNearestLine(gate, aptxLines) <= CONFIG.apronProximityMeters
    );
  }

  return deduped;
}

function confidenceFromPolls(count) {
  if (count >= CONFIG.minPollsForHigh) return "high";
  if (count >= CONFIG.minPollsForMedium) return "medium";
  return "low";
}

// CHEAP — one VATSIM fetch + geometric match against an already-known gate
// list. Safe to call on every 15s refresh; never touches Overpass.
async function matchOccupancy(airportLat, airportLon, gates) {
  const pilots = await fetchVatsimPilots();
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

  const gateByCode = new Map();
  candidates.forEach((p) => {
    let nearest = null;
    let nearestDist = Infinity;
    gates.forEach((gate) => {
      const dist = haversineMeters(p.latitude, p.longitude, gate.lat, gate.lon);
      if (dist <= CONFIG.matchRadiusMeters && dist < nearestDist) {
        nearest = gate;
        nearestDist = dist;
      }
    });
    if (nearest) gateByCode.set(nearest.code, { pilot: p });
  });

  const results = gates.map((gate) => {
    const match = gateByCode.get(gate.code);
    if (!match) {
      return { gate: gate.code, lat: gate.lat, lon: gate.lon, status: "available", confidence: null, callsign: null, aircraft: null };
    }
    const occupant = match.pilot;
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

// Legacy convenience — fetches gates AND matches occupancy in one call.
async function pullAndOverlay(airportLat, airportLon, gateOverride = null) {
  const gates = gateOverride || (await fetchAirportGates(airportLat, airportLon));
  return matchOccupancy(airportLat, airportLon, gates);
}

async function pullWithWarmup(airportLat, airportLon, cycles = 3, intervalMs = 15000) {
  const gates = await fetchAirportGates(airportLat, airportLon);
  let last;
  for (let i = 0; i < cycles; i++) {
    last = await matchOccupancy(airportLat, airportLon, gates);
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
  matchOccupancy,
  pullAndOverlay,
  pullWithWarmup,
  CONFIG,
};
