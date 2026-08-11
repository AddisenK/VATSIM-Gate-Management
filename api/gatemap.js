/**
 * api/gatemap.js
 * ----------------------------------------------------------------
 * Returns the gate/parking-position map for the airport nearest the
 * requested coordinates. For Sydney (YSSY), this now serves a curated,
 * chart-accurate list instead of OSM/Overpass data — see lib/yssy-gates.js
 * for why. Every other airport still uses the live OSM lookup via
 * lib/vatsim-gate-puller.js.
 */

const { fetchAirportGates } = require("../lib/vatsim-gate-puller");
const { YSSY_GATES } = require("../lib/yssy-gates");

const YSSY_CENTER = { lat: -33.9461, lon: 151.1772 };
const YSSY_MATCH_RADIUS_DEG = 0.12; // ~13km, comfortably covers the whole YSSY precinct

function isNearYssy(lat, lon) {
  return (
    Math.abs(lat - YSSY_CENTER.lat) <= YSSY_MATCH_RADIUS_DEG &&
    Math.abs(lon - YSSY_CENTER.lon) <= YSSY_MATCH_RADIUS_DEG
  );
}

module.exports = async function handler(req, res) {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);

  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    res.status(400).json({ error: "lat and lon query parameters are required and must be numeric" });
    return;
  }

  try {
    let gates;
    if (isNearYssy(lat, lon)) {
      gates = YSSY_GATES.map((g) => ({ code: g.code, lat: g.lat, lon: g.lon, source: "chart" }));
    } else {
      gates = await fetchAirportGates(lat, lon);
    }
    res.setHeader("Cache-Control", "public, max-age=1800");
    res.status(200).json({ gateCount: gates.length, gates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
