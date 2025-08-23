export function haversineMiles(a, b){
  const R=3958.7613, toRad=d=>d*Math.PI/180;
  const dLat=toRad(b.lat-a.lat), dLng=toRad(b.lng-a.lng);
  const lat1=toRad(a.lat), lat2=toRad(b.lat);
  const h=Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}
export const lerp = (a,b,t) => a+(b-a)*t;
export const lerpPoint = (p1,p2,t) => ({lat:lerp(p1.lat,p2.lat,t), lng:lerp(p1.lng,p2.lng,t)});
export function cumulativeMiles(latlngs){
  const cum=[0];
  for(let i=1;i<latlngs.length;i++){ cum[i]=cum[i-1]+haversineMiles(latlngs[i-1],latlngs[i]); }
  return cum;
}
export function interpolateAlong(latlngs,cumMiles,targetMiles){
  let i=1; while(i<cumMiles.length && cumMiles[i]<targetMiles) i++;
  if(i>=latlngs.length) return latlngs[latlngs.length-1];
  const m0=cumMiles[i-1], m1=cumMiles[i]; const t=m1===m0?0:(targetMiles-m0)/(m1-m0);
  return lerpPoint(latlngs[i-1], latlngs[i], Math.max(0,Math.min(1,t)));
}
export function fmtETA(ms){
  const s=Math.max(0, Math.round(ms/1000));
  const h=Math.floor(s/3600), m=Math.floor((s%3600)/60);
  return `${h}h ${m}m`;
}
