export const OverrideStore = {
  key: 'manualOverridesV1',
  getAll(){ try{ return JSON.parse(localStorage.getItem(this.key) || '{}'); }catch(_){ return {}; } },
  saveAll(obj){ localStorage.setItem(this.key, JSON.stringify(obj)); },
  get(key){ const all=this.getAll(); return all[key] || null; },
  set(key, coords){
    const all=this.getAll();
    all[key]=coords;
    const [a,b]=key.split('|');
    const revKey=`${b}|${a}`;
    all[revKey]=coords.map(c=>[c[0],c[1]]).reverse();
    this.saveAll(all);
  },
  del(key){
    const all=this.getAll();
    if(key in all) delete all[key];
    const [a,b]=key.split('|');
    const revKey=`${b}|${a}`;
    if(revKey in all) delete all[revKey];
    this.saveAll(all);
  },
  export(){ return JSON.stringify(this.getAll(), null, 2); },
  import(json){ const obj=JSON.parse(json); if (typeof obj !== 'object' || Array.isArray(obj)) throw new Error('Invalid JSON'); this.saveAll(obj); }
};
