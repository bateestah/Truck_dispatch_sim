import test from 'node:test';
import assert from 'node:assert/strict';
import { haversineMiles, fmtETA, loadProgress } from '../src/utils.js';

test('haversineMiles computes distance at equator for 1 degree', () => {
  const dist = haversineMiles({lat:0, lng:0}, {lat:0, lng:1});
  assert.ok(Math.abs(dist - 69.09) < 0.5);
});

test('fmtETA formats hours and minutes', () => {
  const result = fmtETA(3720000);
  assert.equal(result, '1h 2m');
});

test('loadProgress subtracts pause duration', () => {
  const load = { startTime: 0, etaMs: 1000, pauseMs: 200 };
  const t = loadProgress(load, 1000);
  assert.equal(t, 0.8);
});
