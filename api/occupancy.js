/**
 * api/occupancy.js
 * ----------------------------------------------------------------
 * Fast endpoint — takes an already-known gate list (from /api/gatemap) and
 * re-checks live VATSIM occupancy against it. Never touches Overpass, so
 * this is safe and cheap to call on every 15s auto-refresh tick.
 *
 * Usage: POST /api/occupancy
 * Body:  { "lat": 50.0333, "lon": 8.5706, "gates": [{ "code": "A1", "lat": .., "lon": .. }, ...] }
 * Response: { polledAt, gateCount, gates: [{ gate, lat, lon, status, confidence, callsign, aircraft }] }
 */

const { matchOccupancy } = require("../lib/vatsim-gate-puller");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST with a JSON body: { lat, lon, gates }" });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      res.status(400).json({ error: "Invalid JSON body." });
      return;
    }
  }

  const { lat, lon, gates } = body || {};
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lon);

  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    res.status(400).json({ error: "Body must include numeric lat and lon." });
    return;
  }
  if (!Array.isArray(gates) || gates.length === 0) {
    res.status(400).json({ error: "Body must include a non-empty gates array (from /api/gatemap)." });
    return;
  }

  try {
    const snapshot = await matchOccupancy(latitude, longitude, gates);
    res.status(200).json(snapshot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
