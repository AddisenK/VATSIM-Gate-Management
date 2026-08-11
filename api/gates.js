/**
 * api/gates.js
 * ----------------------------------------------------------------
 * Vercel Serverless Function — HTTP wrapper around lib/vatsim-gate-puller.js
 *
 * Usage once deployed:
 *   GET /api/gates?lat=50.0333&lon=8.5706
 *
 * Response: JSON snapshot of gate occupancy near that airport reference point.
 *
 * NOTE: single-request calls will show confidence "low" for most gates
 * because serverless functions don't reliably persist state between
 * invocations. For real multi-poll confidence in production, swap the
 * in-memory pollHistory in lib/vatsim-gate-puller.js for an external store
 * (Vercel KV, Upstash Redis, etc.) keyed by callsign, and set up a Vercel
 * Cron job to call this endpoint every 15-20s so history builds over time.
 */

const { pullAndOverlay } = require("../lib/vatsim-gate-puller");

module.exports = async (req, res) => {
  const { lat, lon } = req.query;
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lon);

  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    res.status(400).json({ error: "Provide numeric ?lat= and ?lon= query params (airport reference point)." });
    return;
  }

  try {
    const snapshot = await pullAndOverlay(latitude, longitude);
    res.status(200).json(snapshot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
