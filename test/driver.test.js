import test from 'node:test';
import assert from 'node:assert/strict';

// Stub Leaflet and map for Node environment
global.L = {
  latLngBounds: () => ({ pad(){ return this; } }),
  map: () => ({ setView(){ return this; }, removeLayer(){}, addLayer(){} }),
  control: { zoom: () => ({ addTo(){} }) },
  tileLayer: () => ({ addTo(){} }),
  circleMarker: () => ({ addTo(){}, setLatLng(){} }),
  polyline: () => ({ addTo(){}, setStyle(){} })
};

const { Driver } = await import('../src/driver.js');

const MS = 3600 * 1000;

test('70-hour limit requires 34-hour break', () => {
  const d = new Driver('Test',0,0,'#000');
  d.hosCycleDrive = 70;
  d.hosDriveSinceReset = 0;
  d.hosDutyStartMs = null;
  d.hosDriveSinceLastBreak = 0;
  const res = d.isDrivingLegal(Date.now());
  assert.equal(res.ok, false);
  assert.ok(res.reason.includes('70-hour'));
});

test('34h off resets weekly drive', () => {
  const d = new Driver('Test',0,0,'#000');
  d.hosCycleDrive = 70;
  d.status = 'OFF';
  d._hosLastTickMs = -60 * 1000;
  d.applyHosTick(34 * MS);
  assert.equal(d.hosCycleDrive, 0);
});
