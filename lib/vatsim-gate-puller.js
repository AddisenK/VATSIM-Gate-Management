/**
 * lib/vatsim-gate-puller.js
 * ----------------------------------------------------------------
 * MIT License — free to use, modify, and redistribute.
 *
 * fetchAirportGates(): single combined Overpass query (gates + runways +
 * aprons/taxiways), filtered to labeled, non-runway-adjacent, apron/taxiway-
 * ADJACENT stands, deduplicated by gate code.
 *
 * IMPORTANT — apronProximityMeters tightened from 120m to 40m (v8):
 *   At YSSY specifically, several OSM parking_position nodes sit in car
 *   parks (P1/P2/P3 Domestic Car Park) and open fields near the Qantas
 *   Freight Terminal — genuinely mistagged community data, not real
 *   aircraft stands. These were within 120m of some tagged apron/taxiway
 *   edge and slipping through the filter. 40m is tight enough that only
 *   points genuinely adjacent to a taxiway/apron boundary (where real
 *   stands always sit) pass, while still allowing for scenery/tagging
 *   imprecision. This may still not catch every OSM data-quality issue —
 *   Sydney's community-tagged data has proven less reliable than
 *   Frankfurt's through repeated testing, and a fully chart-verified
 *   override would be the only way to guarantee 100% accuracy.
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
  overpassMaxRetries: 1,
  overpassRetryDelayMs: 0,
  overpassTimeoutMs: 15000,
  runwayExclusionMeters: 90,
  apronProximityMeters: 40,
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

function wayCenterFromGeometry(el) {
  if (!Array.isArray(el.geometry) || el.geometry.length === 0) return null;
  const lat = el.geometry.reduce((s, pt) => s + pt.lat, 0) / el.geometry.length;
  const lon = el.geometry.reduce((s, pt) => s + pt.lon, 0) / el.geometry.length;
  return { lat, lon };
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
          if (CONFIG.overpassRetryDelayMs > 0) await sleep(CONFIG.overpassRetryDelayMs * attempt);
          continue;
        }
        throw new Error(`Overpass API error: ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;
      if (attempt < CONFIG.overpassMaxRetries) {
        if (CONFIG.overpassRetryDelayMs > 0) await sleep(CONFIG.overpassRetryDelayMs * attempt);
        continue;
      }
    }
  }
  throw lastError || new Error("Overpass API request failed after retries");
}

async function fetchAirportGates(airportLat, airportLon) {
  const d = CONFIG.overpassBufferDeg;
  const bbox = `${airportLat - d},${airportLon - d},${airportLat + d},${airportLon + d}`;

  const combinedQuery = `
    [out:json][timeout:20];
    (
      node["aeroway"="parking_position"](${bbox});
      way["aeroway"="parking_position"](${bbox});
      way["aeroway"="runway"](${bbox});
      way["aeroway"="apron"](${bbox});
      way["aeroway"="taxiway"](${bbox});
    );
    out geom;
  `;

  let data;
  try {
    data = await overpassQuery(combinedQuery);
  } catch (err) {
    throw new Error(`Overpass API request failed: ${err.message}`);
  }

  const elements = data.elements || [];

  const gateElements = elements.filter((el) => el.tags?.aeroway === "parking_position");
  const runwayElements = elements.filter((el) => el.tags?.aeroway === "runway");
  const aptxElements = elements.filter(
    (el) => el.tags?.aeroway === "apron" || el.tags?.aeroway === "taxiway"
  );

  const toLines = (els) =>
    els
      .filter((el) => el.type === "way" && Array.isArray(el.geometry))
      .map((el) => el.geometry.map((pt) => ({ lat: pt.lat, lon: pt.lon })));

  const runwayLines = toLines(runwayElements);
  const aptxLines = toLines(aptxElements);

  const rawGates = gateElements
    .map((el) => {
      const ref = el.tags?.ref || el.tags?.name;
      if (!ref) return null;
      if (isAmbiguousRef(ref)) return null;
      if (DELETED_BAYS.has(ref.trim())) return null;

      let lat, lon;
      if (el.type === "node") {
        lat = el.lat;
        lon = el.lon;
      } else {
        const center = wayCenterFromGeometry(el);
        if (!center) return null;
        lat = center.lat;
        lon = center.lon;
      }
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
