/**
 * api/gatemap.js
 * ----------------------------------------------------------------
 * Returns the gate/parking-position map for the airport nearest the
 * requested coordinates. Sydney (YSSY), Singapore Changi (WSSS),
 * London Heathrow (EGLL), JFK (KJFK), and Paris CDG (LFPG) now serve
 * curated lists instead of OSM/Overpass data. YSSY/WSSS/EGLL/LFPG are
 * official AIP chart data; KJFK is community-derived -- see
 * lib/kjfk-gates.js and lib/lfpg-gates.js for source caveats (LFPG is
 * also only ~63% complete -- see that file's header).
 *
 * YSSY gates use TERMINAL-PREFIXED codes (T1-<bay>, T2-<bay>, T3-<bay>)
 * as their unique `code` -- Sydney reuses bare bay numbers across
 * terminals (e.g. bay "1" exists at both T1 and T3, ~1km apart), so the
 * bare number alone must never be treated as unique. See
 * lib/yssy-gates.js for details.
 *
 * Every other airport still uses the live OSM lookup via
 * lib/vatsim-gate-puller.js.
 */

const { fetchAirportGates } = require("../lib/vatsim-gate-puller");
const { YSSY_GATES } = require("../lib/yssy-gates");
const { WSSS_GATES } = require("../lib/wsss-gates");
const { EGLL_GATES } = require("../lib/egll-gates");
const { KJFK_GATES } = require("../lib/kjfk-gates");
const { LFPG_GATES } = require("../lib/lfpg-gates");

const CURATED_AIRPORTS = [
  { center: { lat: -33.9461, lon: 151.1772 }, radiusDeg: 0.12, gates: YSSY_GATES, source: "chart" },
  { center: { lat: 1.3644, lon: 103.9915 }, radiusDeg: 0.12, gates: WSSS_GATES, source: "chart" },
  { center: { lat: 51.4700, lon: -0.4543 }, radiusDeg: 0.12, gates: EGLL_GATES, source: "chart" },
  { center: { lat: 40.6413, lon: -73.7781 }, radiusDeg: 0.14, gates: KJFK_GATES, source: "community" },
  { center: { lat: 49.0097, lon: 2.5479 }, radiusDeg: 0.15, gates: LFPG_GATES, source: "chart_partial" },
];

function findCuratedAirport(lat, lon) {
  for (const ap of CURATED_AIRPORTS) {
    if (
      Math.abs(lat - ap.center.lat) <= ap.radiusDeg &&
      Math.abs(lon - ap.center.lon) <= ap.radiusDeg
    ) {
      return ap;
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
    const curated = findCuratedAirport(lat, lon);
    let gates;
    if (curated) {
      gates = curated.gates
        .filter((g) => g.lat != null && g.lon != null)
        .map((g) => ({ code: g.code, lat: g.lat, lon: g.lon, source: curated.source }));
    } else {
      gates = await fetchAirportGates(lat, lon);
    }
    res.setHeader("Cache-Control", "public, max-age=1800");
    res.status(200).json({ gateCount: gates.length, gates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
