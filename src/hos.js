import { haversineMiles } from './utils.js';

export function findNearestStop(lat, lng, restAreas = [], truckStops = []) {
  const candidates = [];
  for (const ts of truckStops || []) {
    const [tLat, tLng] = ts.coordinates || [];
    if (tLat != null && tLng != null) candidates.push({ lat: tLat, lng: tLng });
  }
  for (const ra of restAreas || []) {
    const rLat = ra.latitude ?? ra.lat;
    const rLng = ra.longitude ?? ra.lng;
    if (rLat != null && rLng != null) candidates.push({ lat: rLat, lng: rLng });
  }
  let best = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    const d = haversineMiles({ lat, lng }, c);
    if (d < bestDist) { bestDist = d; best = c; }
  }
  return best;
}

export function enforceHosBreak(driver, nowMs, restAreas = [], truckStops = [], load) {
  if (!driver || driver.status !== 'On Trip') return false;
  if (driver.hosDriveSinceReset == null || driver.hosDriveSinceReset < 10.75) return false;
  const stop = findNearestStop(driver.lat, driver.lng, restAreas, truckStops);
  if (stop && typeof driver.setPosition === 'function') {
    driver.setPosition(stop.lat, stop.lng);
  }
  driver.status = 'SB';
  driver.breakEndMs = nowMs + 10 * 3600 * 1000;
  if (load) load.pauseStart = nowMs;
  return true;
}
