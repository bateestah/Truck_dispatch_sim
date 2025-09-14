import test from 'node:test';
import assert from 'node:assert/strict';
import { haversineMiles, fmtETA, findNearestStop } from '../src/utils.js';

test('haversineMiles computes distance at equator for 1 degree', () => {
  const dist = haversineMiles({lat:0, lng:0}, {lat:0, lng:1});
  assert.ok(Math.abs(dist - 69.09) < 0.5);
});

test('fmtETA formats hours and minutes', () => {
  const result = fmtETA(3720000);
  assert.equal(result, '1h 2m');
});

test('findNearestStop selects closest facility', () => {
  const truckStops = [{ name: 'StopA', coordinates: [0, 0] }];
  const restAreas = [{ name: 'RestB', latitude: 0.5, longitude: 0.5 }];
  const res = findNearestStop(0.1, 0.1, truckStops, restAreas);
  assert.equal(res.name, 'StopA');
  assert.equal(res.type, 'Truck Stop');
});
