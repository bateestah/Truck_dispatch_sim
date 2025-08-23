import { haversineMiles } from './utils.js';

const NODES = [
  ['NYC','New York, NY',40.7128,-74.0060],['BOS','Boston, MA',42.3601,-71.0589],
  ['PHL','Philadelphia, PA',39.9526,-75.1652],['PIT','Pittsburgh, PA',40.4406,-79.9959],
  ['CLE','Cleveland, OH',41.4993,-81.6944],['CHI','Chicago, IL',41.8781,-87.6298],
  ['IND','Indianapolis, IN',39.7684,-86.1581],['STL','St. Louis, MO',38.6270,-90.1994],
  ['KC','Kansas City, MO',39.0997,-94.5786],['OMA','Omaha, NE',41.2565,-95.9345],
  ['DEN','Denver, CO',39.7392,-104.9903],['SLC','Salt Lake City, UT',40.7608,-111.8910],
  ['PHX','Phoenix, AZ',33.4484,-112.0740],['LA','Los Angeles, CA',34.0522,-118.2437],
  ['SEA','Seattle, WA',47.6062,-122.3321],['POR','Portland, OR',45.5152,-122.6784],
  ['ATL','Atlanta, GA',33.7490,-84.3880],['CHA','Chattanooga, TN',35.0456,-85.3097],
  ['JAX','Jacksonville, FL',30.3322,-81.6557],['MIA','Miami, FL',25.7617,-80.1918],
  ['DAL','Dallas, TX',32.7767,-96.7970],['HOU','Houston, TX',29.7604,-95.3698]
];
const EDGES = [
  ['NYC','PHL','I-95'],['PHL','PIT','I-76'],['PIT','CLE','I-80'],['CLE','CHI','I-90'],
  ['CHI','IND','I-65'],['IND','STL','I-70'],['STL','KC','I-70'],['KC','OMA','I-29'],['OMA','DEN','I-80'],
  ['DEN','SLC','I-80'],['SLC','PHX','I-15/I-17'],['PHX','LA','I-10'],
  ['SEA','POR','I-5'],['POR','SLC','I-84'],
  ['ATL','CHA','I-75'],['CHA','IND','I-24/I-65'],['ATL','JAX','I-75/I-10'],['JAX','MIA','I-95'],
  ['DAL','HOU','I-45'],['DAL','KC','I-35'],['DAL','PHX','I-10/I-20/I-10']
];

const nodeById = new Map(NODES.map(n => [n[0], {id:n[0], name:n[1], lat:n[2], lng:n[3]}]));
const neighbors = new Map();
for (const [a,b,ref] of EDGES) {
  const A=nodeById.get(a), B=nodeById.get(b);
  const d=haversineMiles(A,B);
  if(!neighbors.has(a)) neighbors.set(a,[]);
  if(!neighbors.has(b)) neighbors.set(b,[]);
  neighbors.get(a).push({to:b,dist:d,ref});
  neighbors.get(b).push({to:a,dist:d,ref});
}
function nearestNode(lat,lng){ let best=null,b=Infinity; for(const n of nodeById.values()){ const d=haversineMiles({lat,lng},{lat:n.lat,lng:n.lng}); if(d<b){b=d; best=n;} } return best; }
function aStar(sid,gid){
  const open=new Set([sid]), came=new Map(), g=new Map([[sid,0]]), f=new Map([[sid,haversineMiles(nodeById.get(sid),nodeById.get(gid))]]);
  function lowest(){ let id=null,b=Infinity; for(const x of open){ const v=f.get(x)??Infinity; if(v<b){b=v; id=x;} } return id; }
  while(open.size){
    const cur=lowest(); if(cur===gid) break; open.delete(cur);
    for(const e of (neighbors.get(cur)||[])){
      const t=(g.get(cur)??Infinity)+e.dist;
      if(t < (g.get(e.to)??Infinity)){ came.set(e.to,{prev:cur,edge:e}); g.set(e.to,t); f.set(e.to,t+haversineMiles(nodeById.get(e.to),nodeById.get(gid))); open.add(e.to); }
    }
  }
  if(!came.has(gid) && sid!==gid) return null;
  const nodes=[gid]; let c=gid; while(c!==sid){ const s=came.get(c); if(!s) break; c=s.prev; nodes.push(c); } nodes.reverse();
  const core=[]; core.push({lat:nodeById.get(nodes[0]).lat,lng:nodeById.get(nodes[0]).lng});
  for(let i=1;i<nodes.length;i++){ const n=nodeById.get(nodes[i]); core.push({lat:n.lat,lng:n.lng}); }
  let dist=0; for(let i=1;i<core.length;i++) dist+=haversineMiles(core[i-1],core[i]);
  return {core, dist};
}
export function graphRoute(from,to){
  const s=nearestNode(from.lat,from.lng), g=nearestNode(to.lat,to.lng);
  const r=aStar(s.id,g.id);
  if(!r) return { path:[from,to], distanceMiles:haversineMiles(from,to) };
  const poly=[from, ...r.core, to]; let dist=0; for(let i=1;i<poly.length;i++) dist+=haversineMiles(poly[i-1],poly[i]);
  return { path:poly, distanceMiles:dist };
}
