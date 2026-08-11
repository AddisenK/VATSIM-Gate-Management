/**
 * api/gatemap.js
 * ----------------------------------------------------------------
 * Returns the gate/parking-position map for the airport nearest the
 * requested coordinates. Sydney (YSSY), Singapore Changi (WSSS), and
 * London Heathrow (EGLL) now serve curated, chart-accurate lists
 * instead of OSM/Overpass data — see lib/yssy-gates.js,
 * lib/wsss-gates.js, and lib/egll-gates.js for why. Every other
 * airport still uses the live OSM lookup via lib/vatsim-gate-puller.js.
 */

const { fetchAirportGates } = require("../lib/vatsim-gate-puller");
const { YSSY_GATES } = require("../lib/yssy-gates");
const { WSSS_GATES } = require("../lib/wsss-gates");
const { EGLL_GATES } = require("../lib/egll-gates");

const CURATED_AIRPORTS = [
  { center: { lat: -33.9461, lon: 151.1772 }, radiusDeg: 0.12, gates: YSSY_GATES },
  { center: { lat: 1.3644, lon: 103.9915 }, radiusDeg: 0.12, gates: WSSS_GATES },
  { center: { lat: 51.4700, lon: -0.4543 }, radiusDeg: 0.12, gates: EGLL_GATES },
];

function findCuratedGates(lat, lon) {
  for (const ap of CURATED_AIRPORTS) {
    if (
      Math.abs(lat - ap.center.lat) <= ap.radiusDeg &&
      Math.abs(lon - ap.center.lon) <= ap.radiusDeg
    ) {
      return ap.gates;
    }
  }
  return null;
}

module.exports = async function handler(req, res) {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);

  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    res.status(400).json({ error: "lat and lon query parameters are required and must be numeric" });
    return;
  }

  try {
    const curated = findCuratedGates(lat, lon);
    let gates;
    if (curated) {
      gates = curated
        .filter((g) => g.lat != null && g.lon != null)
        .map((g) => ({ code: g.code, lat: g.lat, lon: g.lon, source: "chart" }));
    } else {
      gates = await fetchAirportGates(lat, lon);
    }
    res.setHeader("Cache-Control", "public, max-age=1800");
    res.status(200).json({ gateCount: gates.length, gates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
