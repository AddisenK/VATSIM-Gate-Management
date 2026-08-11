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
 *      (via the Overpass API) — no manual coordinate curation required.
 *   3. Overlay live positions onto the gate map (nearest-match geofencing)
 *      and return which gate each aircraft is most likely parked at,
 *      with a confidence rating (never treated as ground truth).
 *
 * Data sources:
 *   - VATSIM data feed:  https://data.vatsim.net/v3/vatsim-data.json  (no key)
 *   - OSM Overpass API:  https://overpass-api.de/api/interpreter     (no key)
 *
 * Requirements: Node.js 18+ (built-in fetch) or any runtime with fetch().
 *
 * IMPORTANT — serverless note:
 *   The in-memory `pollHistory` Map only persists within a single warm
 *   function instance. On Vercel, serverless functions can cold-start on
 *   any request, so multi-poll confidence will NOT reliably build up across
 *   separate HTTP requests unless you swap pollHistory for an external store
 *   (Vercel KV, Upstash Redis, etc). Single isolated calls will often report
 *   "low" confidence by default until you wire up persistence — this is
 *   called out explicitly rather than faked.
 *
 * Known limitation (read before using):
 *   VATSIM has no "gate" field. OSM gate coverage varies by airport and can
 *   be incomplete or slightly offset. This module infers occupancy — it does
 *   not receive it. Always surface the returned `confidence` field to users
 *   instead of presenting results as fact.
 */

const VATSIM_DATA_URL = "https://data.vatsim.net/v3/vatsim-data.json";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

const CONFIG = {
  matchRadiusMeters: 70,     // tolerance for scenery/AFCAD offset between sims
  nearbyRadiusKm: 6,         // only consider pilots within this range of the airport
  maxStaleMs: 30_000,        // discard any pilot whose last_updated is older than this
  minPollsForMedium: 2,
  minPollsForHigh: 3,
  overpassBufferDeg: 0.03,   // ~3km bounding box padding around airport reference point
};

const pollHistory = new Map(); // callsign -> { count, lastSeen } — see serverless note above

// ---- geometry helpers ----
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

// ---- Step 1: live aircraft positions (VATSIM) ----
async function fetchVatsimPilots() {
  const res = await fetch(VATSIM_DATA_URL);
  if (!res.ok) throw new Error(`VATSIM feed error: ${res.status}`);
  const data = await res.json();
  return data.pilots || [];
}

// ---- Step 2: real gate/parking-position map (OpenStreetMap Overpass API) ----
// airportLat/airportLon: the airport's reference point (from any airport DB, e.g. OurAirports).
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
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: query,
  });
  if (!res.ok) throw new Error(`Overpass API error: ${res.status}`);
  const data = await res.json();

  return data.elements
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
}

// ---- Step 3: overlay live positions onto the gate map ----
function confidenceFromPolls(count) {
  if (count >= CONFIG.minPollsForHigh) return "high";
  if (count >= CONFIG.minPollsForMedium) return "medium";
  return "low";
}

/**
 * Runs one polling cycle: fetches live pilots + (optionally cached) gate map,
 * and returns gate-by-gate occupancy with confidence.
 *
 * @param {number} airportLat - airport reference latitude
 * @param {number} airportLon - airport reference longitude
 * @param {Array}  [gateOverride] - optional pre-fetched gate list to skip Overpass call
 */
async function pullAndOverlay(airportLat, airportLon, gateOverride = null) {
  const [pilots, gates] = await Promise.all([
    fetchVatsimPilots(),
    gateOverride ? Promise.resolve(gateOverride) : fetchAirportGates(airportLat, airportLon),
  ]);

  const now = Date.now();

  const candidates = pilots.filter((p) => {
    if (p.groundspeed >= 5) return false;
    if (!p.flight_plan) return false; // no filed plan is often a ghost/observer artifact
    const ageMs = now - new Date(p.last_updated).getTime();
    if (ageMs > CONFIG.maxStaleMs) return false;
    const distKm = haversineMeters(p.latitude, p.longitude, airportLat, airportLon) / 1000;
    return distKm <= CONFIG.nearbyRadiusKm;
  });

  // update rolling multi-poll confidence per callsign
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
      status: confidence === "low" ? "unverified" : "occupied",
      confidence,
      callsign: occupant.callsign,
      aircraft: occupant.flight_plan?.aircraft_short || occupant.flight_plan?.aircraft || null,
    };
  });

  return { polledAt: new Date(now).toISOString(), gateCount: gates.length, gates: results };
}

/**
 * Convenience: poll repeatedly so multi-poll confidence has time to build,
 * then return one final reconciled snapshot. Best for long-running processes
 * (a Node server, CLI, or worker) — not ideal for a single serverless request.
 */
async function pullWithWarmup(airportLat, airportLon, cycles = 3, intervalMs = 15000) {
  const gates = await fetchAirportGates(airportLat, airportLon); // fetch gate map once, reuse across polls
  let last;
  for (let i = 0; i < cycles; i++) {
    last = await pullAndOverlay(airportLat, airportLon, gates);
    if (i < cycles - 1) await new Promise((r) => setTimeout(r, intervalMs));
  }
  return last;
}

// ---- CLI usage: `node vatsim-gate-puller.js <lat> <lon>` ----
// Example (Frankfurt EDDF reference point): node vatsim-gate-puller.js 50.0333 8.5706
if (typeof require !== "undefined" && require.main === module) {
  const lat = parseFloat(process.argv[2]);
  const lon = parseFloat(process.argv[3]);
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    console.error("Usage: node vatsim-gate-puller.js <airportLat> <airportLon>");
    process.exit(1);
  }
  console.log(`Pulling gate map + VATSIM traffic near (${lat}, ${lon}) — warming up confidence over ~45s...`);
  pullWithWarmup(lat, lon, 3, 15000)
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
