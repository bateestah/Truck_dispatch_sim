import { OverrideStore } from './store.js';
import { graphRoute } from './graph.js';
import { haversineMiles } from './utils.js';
import { routeHighways } from './osrmRouter.js';

export const Router = {
  async route(orig, dest) {
    const key = `${orig.name}|${dest.name}`;
    const ovr = OverrideStore.get(key);
    if (ovr && Array.isArray(ovr) && ovr.length >= 2) {
      const path = ovr.map(([lat,lng]) => ({lat, lng}));
      let dist=0; for(let i=1;i<path.length;i++) dist += haversineMiles(path[i-1], path[i]);
      return { path, distanceMiles: dist, durationMs: 0 };
    }
    try {
      return await routeHighways({lat:orig.lat,lng:orig.lng},{lat:dest.lat,lng:dest.lng});
    } catch (err) {
      const r = graphRoute({lat:orig.lat,lng:orig.lng},{lat:dest.lat,lng:dest.lng});
      return { path: r.path, distanceMiles: r.distanceMiles, durationMs: 0 };
    }
  }
};
