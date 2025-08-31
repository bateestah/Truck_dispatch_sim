import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOSRMRoute } from '../src/osrmRouter.js';

// Sample OSRM-like response for a route from New York City to Chicago
const sample = {
  routes: [
    {
      distance: 1275000, // meters (~792 miles)
      duration: 45000,   // seconds
      geometry: {
        type: 'LineString',
        coordinates: [
          [-74.0060, 40.7128],
          [-75.0, 41.0],
          [-81.0, 41.0],
          [-87.6298, 41.8781]
        ]
      }
    }
  ]
};

test('parseOSRMRoute converts OSRM output into internal route representation', () => {
  const result = parseOSRMRoute(sample);
  assert.equal(result.path.length, 4);
  assert.ok(Math.abs(result.distanceMiles - (1275000 / 1609.34)) < 0.001);
  assert.equal(result.durationMs, 45000 * 1000);
  assert.deepEqual(result.path[0], { lat: 40.7128, lng: -74.0060 });
});
