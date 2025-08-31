/**
 * Parse a response from the OSRM routing service into the
 * internal representation used by the simulator.
 * @param {object} data The JSON response from OSRM.
 * @returns {{path: Array<{lat:number,lng:number}>, distanceMiles:number, durationMs:number}}
 */
export function parseOSRMRoute(data) {
  if (!data || !Array.isArray(data.routes) || data.routes.length === 0) {
    throw new Error('No routes found in OSRM response');
  }
  const route = data.routes[0];
  if (!route.geometry || !Array.isArray(route.geometry.coordinates)) {
    throw new Error('Missing geometry in OSRM response');
  }
  const path = route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
  const distanceMiles = route.distance / 1609.34; // meters -> miles
  const durationMs = route.duration * 1000; // seconds -> ms
  return { path, distanceMiles, durationMs };
}

/**
 * Fetch a driving route that follows major highways between two points
 * using the public OSRM service. This function requires network access.
 *
 * @param {{lat:number,lng:number}} orig Origin point
 * @param {{lat:number,lng:number}} dest Destination point
 * @returns {Promise<{path:Array<{lat:number,lng:number}>, distanceMiles:number, durationMs:number}>}
 */
export async function routeHighways(orig, dest) {
  const url = `https://router.project-osrm.org/route/v1/driving/${orig.lng},${orig.lat};${dest.lng},${dest.lat}?overview=full&geometries=geojson`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`OSRM request failed: ${resp.status}`);
  }
  const data = await resp.json();
  return parseOSRMRoute(data);
}
