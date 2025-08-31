import { map } from './map.js';
import { OverrideStore } from './store.js';

export const drawnItems = new L.FeatureGroup().addTo(map);
export const drawControl = new L.Control.Draw({
  edit: { featureGroup: drawnItems, edit: true, remove: true },
  draw: { polyline: { shapeOptions: { color: '#00e5ff', weight: 4 } }, polygon:false, rectangle:false, circle:false, marker:false, circlemarker:false }
});
map.addControl(drawControl);
if (drawControl && drawControl._container) {
  drawControl._container.style.display = 'none';
}

export function clearNonOverrideDrawings(){ drawnItems.eachLayer(l => drawnItems.removeLayer(l)); }
export function currentDrawnPolylineLatLngs(){ let latlngs=null; drawnItems.eachLayer(l => { if (l instanceof L.Polyline) latlngs = l.getLatLngs(); }); return latlngs; }

let overrideLayer=null;
export const completedRoutesGroup = L.layerGroup();
export let showCompletedRoutes=false;
export function setShowCompletedRoutes(val){
  showCompletedRoutes = !!val;
  refreshCompletedRoutes();
}

export function showOverridePolyline(coords){
  if (overrideLayer) { map.removeLayer(overrideLayer); overrideLayer=null; }
  if (!coords || !coords.length) return;
  overrideLayer = L.polyline(coords, {color:'#05D9FF', weight:4, opacity:0.8, dashArray:'6,6'}).addTo(map);
  try { map.fitBounds(overrideLayer.getBounds().pad(0.15)); } catch(_){}
}

export function refreshCompletedRoutes(){
  completedRoutesGroup.clearLayers();
  if(!showCompletedRoutes){
    if(map.hasLayer(completedRoutesGroup)) map.removeLayer(completedRoutesGroup);
    return;
  }
  const all=OverrideStore.getAll();
  const seen=new Set();
  for(const [key,coords] of Object.entries(all)){
    const [a,b]=key.split('|');
    const canonical=[a,b].sort().join('|');
    if(seen.has(canonical)) continue;
    seen.add(canonical);
    L.polyline(coords,{color:'#ffaa00',weight:2,opacity:0.5}).addTo(completedRoutesGroup);
  }
  completedRoutesGroup.addTo(map);
}

map.on(L.Draw.Event.CREATED, e => { clearNonOverrideDrawings(); drawnItems.addLayer(e.layer); });
