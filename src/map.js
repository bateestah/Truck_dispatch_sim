export const usBounds = L.latLngBounds([24.396308, -124.848974],[49.384358, -66.885444]);
export const map = L.map('map', { minZoom: 3, maxZoom: 14, maxBounds: usBounds.pad(0.05), maxBoundsViscosity: 0.9, zoomControl: false })
  .setView([39.5, -98.35], 4);
L.control.zoom({ position: 'bottomright' }).addTo(map);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' }).addTo(map);
