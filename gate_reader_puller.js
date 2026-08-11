/**
 * DISPATCH — VATSIM Gate Reader / Puller
 * ----------------------------------------------------
 * Pulls the live VATSIM data feed, filters pilots near a given airport,
 * and geofences them against a curated gate-coordinate dataset to infer
 * gate occupancy with a confidence rating (never treated as ground truth).
 *
 * Requirements: Node.js 18+ (built-in fetch) or any modern browser/serverless runtime.
 * No API key needed for VATSIM's public feed.
 *
 * You MUST supply real gate coordinates per airport — see GATE_DATASETS below.
 * Source them from Navigraph (best accuracy) or OpenStreetMap `aeroway=parking_position`
 * tags (free, lower accuracy) — see prior discussion for tradeoffs.
 */

const VATSIM_DATA_URL = "https://data.vatsim.net/v3/vatsim-data.json";

// ---- CONFIG ----
const CONFIG = {
  matchRadiusMeters: 70,      // tolerance for scenery/AFCAD offset between sims
  nearbyAirportRadiusKm: 6,   // only consider pilots within this range of the airport
  maxStaleMs: 30_000,         // discard any pilot whose last_updated is older than this
  minPollsForMedium: 2,       // consecutive polls needed for "Medium" confidence
  minPollsForHigh: 3,         // consecutive polls needed for "High" confidence
};

// ---- EXAMPLE GATE DATASET (placeholder coordinates — replace with real data) ----
// Structure: { icao: [ { code, lat, lon, size } ] }
// These lat/lon values are illustrative only, NOT verified real-world gate positions.
const GATE_DATASETS = {
  EDDF: [
    { code: "A12", lat: 50.0392, lon: 8.5560, size: "Code E" },
    { code: "A14", lat: 50.0388, lon: 8.5572, size: "Code E" },
    { code: "A16", lat: 50.0384, lon: 8.5584, size: "Code F" },
    { code: "B21", lat: 50.0410, lon: 8.5610, size: "Code D" },
    { code: "B23", lat: 50.0406, lon: 8.5622, size: "Code E" },
  ],
};

// ---- Poll history persists across calls (swap for Redis/DB in production/serverless) ----
const pollHistory = new Map(); // callsign -> { count, lastSeen }

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

async function fetchVatsimData() {
  const res = await fetch(VATSIM_DATA_URL);
  if (!res.ok) throw new Error(`VATSIM feed error: ${res.status}`);
  return res.json();
}

function confidenceFromPolls(count) {
  if (count >= CONFIG.minPollsForHigh) return "high";
  if (count >= CONFIG.minPollsForMedium) return "medium";
  return "low";
}

/**
 * Pull one snapshot and update rolling confidence for an airport's gates.
 * Call this on an interval (e.g. every 15-20s) to build multi-poll confidence.
 */
async function readGates(icao) {
  const gateCoords = GATE_DATASETS[icao];
  if (!gateCoords) throw new Error(`No gate dataset configured for ${icao}`);

  const data = await fetchVatsimData();
  const now = Date.now();
  const airportRef = gateCoords[0]; // rough centroid proxy for distance filtering

  const nearby = data.pilots.filter((p) => {
    if (p.groundspeed >= 5) return false;               // must be stationary
    if (!p.flight_plan) return false;                    // no plan often = ghost/observer artifact
    const ageMs = now - new Date(p.last_updated).getTime();
    if (ageMs > CONFIG.maxStaleMs) return false;          // stale feed entry -> discard as ghost
    const distKm =
      haversineMeters(p.latitude, p.longitude, airportRef.lat, airportRef.lon) / 1000;
    return distKm <= CONFIG.nearbyAirportRadiusKm;
  });

  // update rolling poll counts for candidates still present
  const seenThisPoll = new Set();
  nearby.forEach((p) => {
    seenThisPoll.add(p.callsign);
    const h = pollHistory.get(p.callsign) || { count: 0 };
    h.count += 1;
    h.lastSeen = now;
    pollHistory.set(p.callsign, h);
  });
  // decay/remove callsigns not seen this poll (they've moved or disconnected)
  for (const [callsign, h] of pollHistory.entries()) {
    if (!seenThisPoll.has(callsign)) pollHistory.delete(callsign);
  }

  const results = gateCoords.map((gate) => {
    const occupant = nearby.find(
      (p) => haversineMeters(p.latitude, p.longitude, gate.lat, gate.lon) <= CONFIG.matchRadiusMeters
    );
    if (!occupant) {
      return { gate: gate.code, size: gate.size, status: "available", confidence: null, callsign: null, aircraft: null };
    }
    const history = pollHistory.get(occupant.callsign);
    const confidence = confidenceFromPolls(history.count);
    return {
      gate: gate.code,
      size: gate.size,
      status: confidence === "low" ? "unverified" : "occupied",
      confidence,
      callsign: occupant.callsign,
      aircraft: occupant.flight_plan?.aircraft_short || occupant.flight_plan?.aircraft || null,
    };
  });

  return { icao, polledAt: new Date(now).toISOString(), gates: results };
}

/**
 * Convenience: poll repeatedly to let confidence build up over several cycles,
 * then return the final reconciled snapshot. Useful for a one-shot CLI/report run.
 */
async function readGatesWithWarmup(icao, cycles = 3, intervalMs = 15000) {
  let last;
  for (let i = 0; i < cycles; i++) {
    last = await readGates(icao);
    if (i < cycles - 1) await new Promise((r) => setTimeout(r, intervalMs));
  }
  return last;
}

// ---- CLI usage: `node gate_reader_puller.js EDDF` ----
if (typeof require !== "undefined" && require.main === module) {
  const icao = process.argv[2] || "EDDF";
  console.log(`Warming up gate reader for ${icao} (this takes ~${(3 * 15)}s to build confidence)...`);
  readGatesWithWarmup(icao, 3, 15000)
    .then((snapshot) => {
      console.log(JSON.stringify(snapshot, null, 2));
    })
    .catch((err) => {
      console.error("Gate reader failed:", err.message);
      process.exit(1);
    });
}

module.exports = { readGates, readGatesWithWarmup, GATE_DATASETS, CONFIG };
