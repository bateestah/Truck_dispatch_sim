import test from 'node:test';
import assert from 'node:assert/strict';

const dummy = {
  addTo(){ return this; },
  setView(){ return this; },
  setLatLng(){ return this; },
  setStyle(){ return this; }
};
const boundsDummy = { pad(){ return boundsDummy; } };

globalThis.document = { getElementById: () => ({}) };
globalThis.L = {
  map: () => dummy,
  latLngBounds: () => boundsDummy,
  control: { zoom: () => dummy },
  tileLayer: () => dummy,
  circleMarker: () => ({ ...dummy }),
  polyline: () => ({ ...dummy })
};

const { Driver } = await import('../src/driver.js');

test('30 minute break resets driving clock', () => {
  const d = new Driver('Test',0,0,'#fff');
  d.hosDriveSinceLastBreak = 8;
  d.status = 'OFF';
  const now = Date.now();
  d._hosLastTickMs = now - 30*60*1000;
  d.applyHosTick(now);
  assert.equal(d.hosDriveSinceLastBreak, 0);
});

test('7 consecutive days triggers 34h break requirement', () => {
  const d = new Driver('Test',0,0,'#fff');
  d.hosDaysSinceReset = 7;
  const res = d.isDrivingLegal(Date.now());
  assert.equal(res.ok, false);
  assert.equal(res.type, '34hr');
});
