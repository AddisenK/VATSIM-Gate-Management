/**
 * api/gatemap.js
 * ----------------------------------------------------------------
 * Returns ONLY the airport's gate positions. Now issues a SINGLE combined
 * Overpass query (see lib/vatsim-gate-puller.js) instead of 3 separate
 * requests, to stay well within serverless function execution limits.
 *
 * Usage: GET /api/gatemap?lat=50.0333&lon=8.5706
 * Response: { gates: [{ code, lat, lon }, ...] }
 */

const { fetchAirportGates } = require("../lib/vatsim-gate-puller");

module.exports.config = { maxDuration: 30 };

module.exports = async (req, res) => {
  const { lat, lon } = req.query;
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lon);

  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    res.status(400).json({ error: "Provide numeric ?lat= and ?lon= query params (airport reference point)." });
    return;
  }

  try {
    const gates = await fetchAirportGates(latitude, longitude);
    res.setHeader("Cache-Control", "public, max-age=1800, s-maxage=1800, stale-while-revalidate=3600");
    res.status(200).json({ gateCount: gates.length, gates });
  } catch (err) {
    res.status(502).json({ error: `Gate map lookup failed: ${err.message}` });
  }
};
