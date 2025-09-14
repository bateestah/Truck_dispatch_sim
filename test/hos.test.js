import test from 'node:test';
import assert from 'node:assert/strict';
import { findNearestStop, enforceHosBreak } from '../src/hos.js';

test('findNearestStop picks closest location', () => {
  const rest = [{ latitude: 1, longitude: 1 }];
  const stops = [{ coordinates: [0.2, 0.2] }];
  const res = findNearestStop(0, 0, rest, stops);
  assert.deepEqual(res, { lat: 0.2, lng: 0.2 });
});

test('enforceHosBreak switches driver to sleeper and records break end', () => {
  const driver = { lat:0, lng:0, status:'On Trip', hosDriveSinceReset:10.75, setPosition(lat,lng){ this.lat=lat; this.lng=lng; } };
  const load = {};
  const now = 0;
  const rest = [{ latitude: 1, longitude: 1 }];
  const stops = [{ coordinates: [0.1, 0.1] }];
  const triggered = enforceHosBreak(driver, now, rest, stops, load);
  assert.equal(triggered, true);
  assert.equal(driver.status, 'SB');
  assert.equal(driver.lat, 0.1);
  assert.equal(driver.breakEndMs, 10 * 3600 * 1000);
  assert.equal(load.pauseStart, now);
});
