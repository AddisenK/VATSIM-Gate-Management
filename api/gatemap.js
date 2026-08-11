/**
 * api/gatemap.js
 * ----------------------------------------------------------------
 * Returns ONLY the airport's gate positions (expensive Overpass queries:
 * gates + runway geometry + apron/taxiway geometry). This should be called
 * once per location/zoom-settle, not on every refresh — the physical layout
 * of an airport barely ever changes.
 *
 * Usage: GET /api/gatemap?lat=50.0333&lon=8.5706
 * Response: { gates: [{ code, lat, lon }, ...] }
 *
 * Sends a long CDN cache header (30 min) since repeated requests for the
 * same rounded coordinates can be served from cache instead of hitting
 * Overpass again.
 */

const { fetchAirportGates } = require("../lib/vatsim-gate-puller");

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
    res.status(500).json({ error: err.message });
  }
};
