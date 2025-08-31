import { Colors } from './colors.js';
import { Driver } from './driver.js';
import { Router } from './router.js';
import { fmtETA } from './utils.js';
import { cityByName, CityGroups } from './data/cities.js';
import { DriverProfiles } from './data/driver_profiles.js';
import { drawnItems, drawControl, clearNonOverrideDrawings, currentDrawnPolylineLatLngs, showCompletedRoutes, completedRoutesGroup, showOverridePolyline, refreshCompletedRoutes, setShowCompletedRoutes } from './drawing.js';
import { OverrideStore } from './store.js';
import { initLoadBoard, openLoadBoard } from './load_board.js';
import { map } from './map.js';

// Catalog data for market
const TruckCatalog = [
  { make: 'Freightliner', model: 'Cascadia', configs: ['Sleeper', 'Day Cab'] },
  { make: 'Peterbilt', model: '579', configs: ['Sleeper', 'Day Cab'] },
  { make: 'Peterbilt', model: '589', configs: ['Sleeper'] },
  { make: 'Kenworth', model: 'T680', configs: ['Sleeper', 'Day Cab'] },
  { make: 'Kenworth', model: 'W900', configs: ['Sleeper'] },
  { make: 'Western Star', model: '57X', configs: ['Sleeper'] },
  { make: 'Volvo', model: 'VNL 860', configs: ['Sleeper'] },
  { make: 'Volvo', model: 'VNL 660', configs: ['Sleeper'] },
  { make: 'Volvo', model: 'VNL 300', configs: ['Day Cab'] },
  { make: 'Mack', model: 'Anthem', configs: ['Sleeper', 'Day Cab'] },
  { make: 'International', model: 'LT', configs: ['Sleeper', 'Day Cab'] },
  { make: 'International', model: 'LoneStar', configs: ['Sleeper'] }
];

const TrailerCatalog = [
  { make: 'Hyundai', types: ['Dry Van', 'Reefer'] },
  { make: 'Wabash', types: ['Dry Van', 'Reefer', 'Tanker'] },
  { make: 'Great Dane', types: ['Dry Van', 'Reefer', 'Flatbed'] },
  { make: 'Fontaine', types: ['Flatbed'] }
];

const TrailerPriceRanges = {
  'Dry Van': { new: [30000, 60000], used: [11000, 17000] },
  'Reefer':  { new: [40000, 80000], used: [17000, 30000] },
  'Flatbed': { new: [15000, 50000], used: [12000, 18000] },
  'Tanker':  { new: [20000, 60000], used: [10000, 20000] }
};

/* ---------- UI ---------- */
export const UI = {
  _hosDayOffset: 0,
  _hirePage: 0,
  _ensurePlus15Button(){ const hud=document.querySelector('#timeHud .clock')||document.getElementById('timeHud'); if(!hud) return; if(document.getElementById('btnPlus15')) return; const btn=document.createElement('button'); btn.id='btnPlus15'; btn.className='btn'; btn.title='Advance 15 sim minutes'; btn.textContent='+15m'; btn.onclick=()=>{ Game.jump(15*60*1000); UI.updateTimeHUD(); }; const b4=hud.querySelector('button[onclick*="Game.resume(4)"]'); if(b4&&b4.parentNode) b4.parentNode.insertBefore(btn, b4.nextSibling); else hud.appendChild(btn); },
  show(sel){ document.querySelectorAll('.panel').forEach(p=>p.style.display='none'); const el=document.querySelector(sel); if (el) el.style.display='block'; if(sel==='#panelCompany'){ try{ const s=document.getElementById('txtDriverSearch'); if(s) s.value=''; UI._companyNeedsListRefresh=true; UI.refreshCompany(); }catch(e){} } if(sel==='#panelBank'){ try{ UI.refreshBank(); }catch(e){} } if(sel==='#panelMarket'){ try{ UI.renderMarket(); }catch(e){} } if(sel==='#panelEquipment'){ try{ UI.refreshEquipment(); }catch(e){} } if(sel==='#panelProperties'){ try{ UI.refreshProperties(); }catch(e){} } },
overlay(sel) {
  ['#panelEquipment', '#panelProperties'].forEach(p => {
    const panel = document.querySelector(p);
    if (panel) panel.style.display = (p === sel) ? 'block' : 'none';
  });
  if (sel === '#panelEquipment') { try { UI.refreshEquipment(); } catch (e) {} }
  if (sel === '#panelProperties') { try { UI.refreshProperties(); } catch (e) {} }
},
  init(){
    document.querySelectorAll('.close-x').forEach(x=>x.addEventListener('click', e=>{ const t=e.currentTarget.getAttribute('data-close'); if (t) document.querySelector(t).style.display='none'; }));
    ['panelCompany','panelMarket','panelBank','panelEquipment','panelProperties'].forEach(id=>makeDraggable(document.getElementById(id)));
    // Override city selects
    fillCitySelectGrouped(document.getElementById('ovrOrigin'));
    fillCitySelectGrouped(document.getElementById('ovrDest'));
    document.getElementById('ovrOrigin').value='Chicago, IL'; document.getElementById('ovrDest').value='New York, NY';

    // Load Board
    initLoadBoard();
    window.UI.openLoadBoard = openLoadBoard;

    this.refreshAll();
  },
  initOverridesUI(){
    const selO=document.getElementById('ovrOrigin'), selD=document.getElementById('ovrDest');
    const btnToggle=document.getElementById('btnToggleCompleted');
    const refreshGhost=()=>{ const key=`${selO.value}|${selD.value}`; showOverridePolyline(OverrideStore.get(key)); };
    const updateToggle=()=>{
      const has=Object.keys(OverrideStore.getAll()).length>0;
      btnToggle.style.display=has?'inline-block':'none';
      if(!has){
        setShowCompletedRoutes(false);
        btnToggle.textContent='Show Completed';
        refreshCompletedRoutes();
      } else {
        btnToggle.textContent=showCompletedRoutes?'Hide Completed':'Show Completed';
      }
    };
    btnToggle.addEventListener('click', ()=>{
      setShowCompletedRoutes(!showCompletedRoutes);
      btnToggle.textContent=showCompletedRoutes?'Hide Completed':'Show Completed';
      refreshCompletedRoutes();
    });
    selO.addEventListener('change', refreshGhost);
    selD.addEventListener('change', refreshGhost);
    document.getElementById('btnStartDraw').addEventListener('click', ()=>{
      clearNonOverrideDrawings();
      new L.Draw.Polyline(map, drawControl.options.draw.polyline).enable();
    });
    document.getElementById('btnSaveOverride').addEventListener('click', ()=>{
      const latlngs=currentDrawnPolylineLatLngs();
      if(!latlngs || latlngs.length<2){ alert('Draw a polyline first.'); return; }
      const coords = latlngs.map(ll => [ll.lat, ll.lng]);
      const key=`${selO.value}|${selD.value}`;
      const revKey=`${selD.value}|${selO.value}`;
      OverrideStore.set(key, coords);
      showOverridePolyline(coords);
      clearNonOverrideDrawings();
      alert('Override saved for ' + key + ' and ' + revKey);
      updateToggle();
      refreshCompletedRoutes();
    });
    document.getElementById('btnClearOverride').addEventListener('click', ()=>{
      const key=`${selO.value}|${selD.value}`;
      const revKey=`${selD.value}|${selO.value}`;
      OverrideStore.del(key);
      showOverridePolyline(null);
      alert('Override cleared for ' + key + ' and ' + revKey);
      updateToggle();
      refreshCompletedRoutes();
    });
    document.getElementById('btnExportOverrides').addEventListener('click', ()=>{
      const data = OverrideStore.export();
      const blob = new Blob([data], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href=url; a.download='manual_overrides.json'; a.click();
      URL.revokeObjectURL(url);
    });
    document.getElementById('fileImport').addEventListener('change', (e)=>{
      const file = e.target.files[0]; if(!file) return;
      const reader = new FileReader(); reader.onload = () => {
        try {
          OverrideStore.import(reader.result);
          alert('Overrides imported.');
          refreshGhost();
          setShowCompletedRoutes(true);
          updateToggle();
          refreshCompletedRoutes();
        }
        catch(err){ alert('Import failed: ' + err.message); }
      }; reader.readAsText(file); e.target.value='';
    });
    refreshGhost();
    updateToggle();
  },
  refreshAll(){ this.refreshCompany(); this.refreshDispatch(); this.updateLegend(); this.refreshBank(); this.refreshEquipment(); this.refreshProperties(); },

  renderMarket(){
    const panel = document.getElementById('panelMarket'); if(!panel) return;
    const content = panel.querySelector('.content'); if(!content) return;
    const rand = (min,max) => Math.round(Math.random()*(max-min)+min);

    let html = '<h3>Buy Trucks</h3><div class="grid cols-3">';
    TruckCatalog.forEach(t => {
      t.configs.forEach(cfg => {
        ['New','Used'].forEach(cond => {
          let price = rand(cond==='New'?165000:40000, cond==='New'?200000:60000);
          if (cfg.toLowerCase().includes('day')) price -= rand(5000,10000);
          html += `<div class="stat"><div class="small">${t.make} ${t.model} ${cfg} (${cond})</div><div class="row"><div class="pill">$${price.toLocaleString()}</div><button class="btn" onclick="Game.buyEquipment('truck','${t.make} ${t.model} ${cfg} (${cond})',${price})">Buy</button></div></div>`;
        });
      });
    });
    html += '</div>';

    html += '<h3 style="margin-top:14px;">Buy Trailers</h3><div class="grid cols-3">';
    TrailerCatalog.forEach(tr => {
      tr.types.forEach(type => {
        ['New','Used'].forEach(cond => {
          const rng = TrailerPriceRanges[type][cond.toLowerCase()];
          let price = rand(rng[0], rng[1]);
          html += `<div class="stat"><div class="small">${tr.make} ${type} (${cond})</div><div class="row"><div class="pill">$${price.toLocaleString()}</div><button class="btn" onclick="Game.buyEquipment('trailer','${tr.make} ${type} (${cond})',${price})">Buy</button></div></div>`;
        });
      });
    });
    html += '</div>';

    html += `
      <h3 style="margin-top:14px;">Buy Property</h3>
      <div class="grid cols-3">
        <div class="stat"><div class="small">Small Yard – Dallas</div><div class="row"><div class="pill">$350,000</div><button class="btn" onclick="Game.buyProperty('Dallas Yard','Dallas, TX',350000)">Buy</button></div></div>
        <div class="stat"><div class="small">Warehouse – Chicago</div><div class="row"><div class="pill">$1,200,000</div><button class="btn" onclick="Game.buyProperty('Chicago Warehouse','Chicago, IL',1200000)">Buy</button></div></div>
      </div>
      <div class="hint">Overhead increases per owned truck ($50/day) and per property ($200/day).</div>
    `;

    content.innerHTML = html;
  },

  refreshCompany(){
    const panel = document.getElementById('panelCompany');
    if (!panel) return;
    const content = panel.querySelector('.content');
    if (!content) return;

    if (!UI._companyWired){
      const trucks = Game.equipment.filter(e=>e.type==='truck').length;
      const props = Game.properties.length;
      const overhead = trucks*Game.overheadPerTruck + props*Game.overheadPerProperty;

      content.innerHTML = `
        <div class="grid cols-2 company-grid">
          <div>
            <div class="stat">
              <div class="small">Bank</div>
              <div id="statBank" class="clickable">$${Game.bank.toLocaleString()}</div>
            </div>
            <div class="stat">
              <div class="small">Daily Overhead</div>
              <div id="statOverhead">$${overhead.toLocaleString()} / day</div>
            </div>

            <div class="row" style="margin-top:8px; gap:8px;">
              <button id="btnHireDriver" class="btn">Hire Driver</button>
              <input id="txtDriverSearch" type="text" placeholder="Search drivers..." />
            </div>
            <div class="row" style="margin-top:8px; gap:8px;">
              <button id="btnShowEquipment" class="btn">Equipment</button>
              <button id="btnShowProperties" class="btn">Properties</button>
            </div>

            <div id="driversList" class="drivers-list"></div>
            
          </div>
          <div>
            <div id="driverProfile" class="driver-profile">
              <div class="hint">Select a driver to view their profile.</div>
            </div>
          </div>
        </div>

          <dialog id="dlgHireDriver" class="modal" style="padding:16px; position:relative;">
            <div id="btnCloseHire" class="close-x" style="position:absolute; top:8px; right:8px;">✕</div>
            <h3>Hire Driver</h3>
            <div id="hireList" class="drivers-list"></div>
            <div class="row" id="hirePager" style="margin-top:8px; gap:8px; justify-content:space-between;">
              <button id="hirePrev" class="btn">Prev</button>
              <button id="hireNext" class="btn">Next</button>
            </div>
          </dialog>
      `;
      const bankStat = content.querySelector('#statBank');
      if (bankStat) bankStat.addEventListener('click', ()=>UI.show('#panelBank'));

      const hireDlg = content.querySelector('#dlgHireDriver');
      const btnHire = content.querySelector('#btnHireDriver');
      if (btnHire && hireDlg){
        btnHire.addEventListener('click', ()=>{ UI._hirePage=0; UI._renderHireDriverList(); hireDlg.showModal(); });
        const closeBtn = hireDlg.querySelector('#btnCloseHire');
        if(closeBtn) closeBtn.addEventListener('click', ()=>hireDlg.close());
        const listEl = hireDlg.querySelector('#hireList');
        if(listEl){
          listEl.addEventListener('click', (e)=>{
            const btn = e.target.closest('button[data-id]');
            if(!btn) return;
            const id = btn.getAttribute('data-id');
            Game.hireDriver(id);
            UI._renderHireDriverList();
          });
        }
        const btnPrev = hireDlg.querySelector('#hirePrev');
        const btnNext = hireDlg.querySelector('#hireNext');
        if(btnPrev) btnPrev.addEventListener('click', ()=>{ if(UI._hirePage>0){ UI._hirePage--; UI._renderHireDriverList(); } });
        if(btnNext) btnNext.addEventListener('click', ()=>{
          const maxPage = Math.ceil(Game.hireableDrivers.length/10)-1;
          if(UI._hirePage<maxPage){ UI._hirePage++; UI._renderHireDriverList(); }
        });
      }

      const btnEquip = content.querySelector('#btnShowEquipment');
      if(btnEquip) btnEquip.addEventListener('click', ()=>UI.overlay('#panelEquipment'));
      const btnProps = content.querySelector('#btnShowProperties');
      if(btnProps) btnProps.addEventListener('click', ()=>UI.overlay('#panelProperties'));

      const listEl = content.querySelector('#driversList');
      if (listEl){
        listEl.addEventListener('click', (e)=>{
          const item = e.target.closest('.driver-item');
          if(!item) return;
          const id = item.getAttribute('data-id');
          const d = Game.drivers.find(x => String(x.id)===String(id));
          if (d){
            UI._showDriverProfile(d);
            listEl.querySelectorAll('.driver-item').forEach(x=>x.classList.remove('active'));
            item.classList.add('active');
            UI._companySelectedId = d.id;
          }
        });
      }

      const search = content.querySelector('#txtDriverSearch');
      if (search){
        search.addEventListener('input', (e)=>{
          const q = (e.target.value||'').toLowerCase();
          for (const el of listEl.querySelectorAll('.driver-item')) {
            const name = el.querySelector('.driver-name')?.textContent.toLowerCase() || '';
            el.style.display = name.includes(q) ? '' : 'none';
          }
        });
      }

      UI._companyNeedsListRefresh = true;
      UI._companyWired = true; try{ UI._companyNeedsListRefresh=true; UI._companyRenderDriverList(); }catch(e){}
    }

    const trucks=Game.equipment.filter(e=>e.type==='truck').length, props=Game.properties.length;
    const overhead=trucks*Game.overheadPerTruck + props*Game.overheadPerProperty;
    const bankEl = document.getElementById('statBank'); if (bankEl) bankEl.textContent = '$' + Game.bank.toLocaleString();
    const ohEl = document.getElementById('statOverhead'); if (ohEl) ohEl.textContent = '$' + overhead.toLocaleString() + ' / day';

    if (UI._companyNeedsListRefresh){ UI._companyRenderDriverList(); UI._companyNeedsListRefresh=false; } else { UI._companyRenderDriverList(); }
},


  updateCompanyLive(){
    const el=document.getElementById('statBank'); if (el) el.textContent='$'+Game.bank.toLocaleString();
    try{
      const list=document.getElementById('driversList');
      if(list){
        for(const item of list.querySelectorAll('.driver-item')){
          const id=item.getAttribute('data-id');
          const d=Game.drivers.find(x=>String(x.id)===String(id));
          if(d){
            const sub=item.querySelector('.driver-sub');
            if(sub){ sub.textContent = d.status + ' • ' + (d.cityName || (d.lat.toFixed(2)+', '+d.lng.toFixed(2))); }
          }
        }
      }
    }catch(e){}
    try{
      const sid=UI._companySelectedId;
      if(sid){
        const d=Game.drivers.find(x=>String(x.id)===String(sid));
        if(d && document.getElementById('hosChart')) UI._drawHosChart(d);
      }
    }catch(e){}
  },

  // Provide HOS segments for charting; prefer live driver data, fallback to a tiny stub.
  _getHosSegments(d){
    if (d && Array.isArray(d.hosSegments) && d.hosSegments.length) return d.hosSegments;
    try{
      const now = Game.getSimNow();
      const hr = now.getHours() + now.getMinutes()/60;
      const base = (d && d.currentLoadId) ? 'D' : ((d && d.status==='SB') ? 'SB' : 'OFF');
      const start = Math.max(0, hr-1);
      return [{start:0, end:start, status:'SB'}, {start, end:hr, status:base}];
    }catch(e){ return []; }
  },

    _renderHireDriverList(){
      const list = document.getElementById('hireList');
      if(!list) return;
      const pageSize = 10;
      const maxPage = Math.max(0, Math.ceil(Game.hireableDrivers.length / pageSize) - 1);
      if(UI._hirePage > maxPage) UI._hirePage = maxPage;
      const start = UI._hirePage * pageSize;
      const page = Game.hireableDrivers.slice(start, start + pageSize);
      const html = page.map(h => `
        <div class="driver-item">
          <div class="driver-name">${h.firstName} ${h.lastName}</div>
          <div class="driver-sub">Age: ${h.age} • ${h.gender} • Exp: ${h.experience} yrs</div>
          <button class="btn" data-id="${h.id}">Hire</button>
        </div>
      `).join('');
      list.innerHTML = html || '<div class="hint">No drivers available.</div>';
      const btnPrev = document.getElementById('hirePrev');
      const btnNext = document.getElementById('hireNext');
      if(btnPrev) btnPrev.disabled = UI._hirePage <= 0;
      if(btnNext) btnNext.disabled = UI._hirePage >= maxPage;
    },

  _companyRenderDriverList(){
    const listEl = document.getElementById('driversList');
    if (!listEl) return;
    const activeId = UI._companySelectedId;
    const search = document.getElementById('txtDriverSearch');
    const query = (search && search.value || '').toLowerCase();
    const html = Game.drivers.map(d => `
      <div class="driver-item${activeId && String(activeId)===String(d.id)?' active':''}" data-id="${d.id}">
        <div class="driver-name"><span class="dot" style="background:${d.color};"></span>${d.firstName} ${d.lastName}</div>
        <div class="driver-sub">${d.status} • ${d.cityName || (d.lat.toFixed(2)+', '+d.lng.toFixed(2))}</div>
      </div>
    `).join('');
    listEl.innerHTML = html || '<div class="hint">No drivers yet.</div>';
    // Auto-select first driver if none selected
    if (!UI._companySelectedId && Game.drivers.length){
      const firstVisible = listEl.querySelector('.driver-item');
      if (firstVisible){
        const id = firstVisible.getAttribute('data-id');
        const d = Game.drivers.find(x=>String(x.id)===String(id));
        if (d){ UI._companySelectedId = d.id; UI._showDriverProfile(d); firstVisible.classList.add('active'); }
      }
    }

    if (query){
      for (const el of listEl.querySelectorAll('.driver-item')) {
        const name = el.querySelector('.driver-name')?.textContent.toLowerCase() || '';
        el.style.display = name.includes(query) ? '' : 'none';
      }
    }
  },

  _showDriverProfile(d){
    const wrap = document.querySelector('#panelCompany #driverProfile');
    if (!wrap) return;
    if (!d){ wrap.innerHTML='<div class="hint">Select a driver.</div>'; return; }
    wrap.innerHTML = `
      <div class="profile-card">
        <div class="profile-header">
          <span class="dot" style="background:${d.color};"></span>
          <div>
            <div class="profile-name">${d.firstName} ${d.lastName}</div>
            <div class="profile-sub">${d.status} • ${d.cityName || (d.lat.toFixed(2)+', '+d.lng.toFixed(2))}</div>
          </div>
        </div>
        <div class="grid cols-2" style="margin-top:8px;">
          <div class="stat">
            <div class="small">Equipment</div>
            <div>${d.truckMake||'—'} ${d.truckModel||''} <span class="pill">${d.truckNumber||''}</span></div>
          </div>
          <div class="stat">
            <div class="small">Location</div>
            <div>${d.cityName || (d.lat.toFixed(2)+', '+d.lng.toFixed(2))}</div>
          </div>
        </div>
        <div class="stat" style="margin-top:8px;">
          <div style="display:flex; align-items:center; gap:4px; margin-bottom:4px;">
            <button id="hosPrev" class="btn" style="padding:2px 6px;">&lt;</button>
            <div class="small" id="hosDayLabel" style="flex:1; text-align:center;">today</div>
            <button id="hosNext" class="btn" style="padding:2px 6px;">&gt;</button>
          </div>
          <canvas id="hosChart" width="340" height="160"></canvas>
        </div>
      </div>
    `;
    UI._hosDayOffset = 0;
    const prev=document.getElementById('hosPrev');
    const next=document.getElementById('hosNext');
    const label=document.getElementById('hosDayLabel');
    const updateNav=()=>{
      label.textContent = UI._hosDayOffset ? `${UI._hosDayOffset}d ago` : 'today';
      prev.disabled = UI._hosDayOffset >= 7;
      next.disabled = UI._hosDayOffset <= 0;
      try { UI._drawHosChart(d); } catch (e) {}
    };
    prev.addEventListener('click',()=>{ if(UI._hosDayOffset < 7){ UI._hosDayOffset++; updateNav(); } });
    next.addEventListener('click',()=>{ if(UI._hosDayOffset > 0){ UI._hosDayOffset--; updateNav(); } });
    updateNav();
  },

  
  
  _drawHosChart(d){
    const canvas = document.getElementById('hosChart');
    if (!canvas) return;
    // Ensure the canvas has dimensions
    if (!canvas.width || !canvas.height){ canvas.width = canvas.clientWidth || 520; canvas.height = 140; }
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.clearRect(0,0,canvas.width,canvas.height);

    // Layout
    const padding = { l: 40, r: 10, t: 10, b: 24 };
    const W = canvas.width - padding.l - padding.r;
    const H = canvas.height - padding.t - padding.b;

    // Rows and mapping
    const rows = ['OFF','SB','D','ON']; // Off Duty, Sleeper Berth, Driving, On Duty
    const rowH = H / rows.length;

    // Axes / grid
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '10px sans-serif';
    for (let hr=0; hr<=24; hr+=1){
  const x = padding.l + (hr/24)*W;
  // grid line
  ctx.beginPath();
  ctx.moveTo(x, padding.t);
  ctx.lineTo(x, padding.t + H);
  ctx.stroke();
  // labels
  const isMidnight = (hr === 0 || hr === 24);
  const isNoon = (hr === 12);
  const oldFont = ctx.font;
  if (isMidnight || isNoon) {
    ctx.font = 'bold 10px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(isNoon ? 'noon' : 'midnight', x, padding.t + H + 6);
    ctx.font = oldFont;
  } else {
    ctx.fillStyle = '#444';
    ctx.fillText(String(hr).padStart(2,'0'), x, padding.t + H + 6);
  }
}
    // Row labels + baselines
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#666';
    rows.forEach((name, i)=>{
      const y = padding.t + i*rowH + rowH/2;
      ctx.fillText(name, padding.l - 8, y);
      ctx.beginPath();
      ctx.moveTo(padding.l, y);
      ctx.lineTo(padding.l + W, y);
      ctx.stroke();
    });

    // Data
    const offsetMs = (UI._hosDayOffset || 0) * 24 * 3600 * 1000;
    let segs = (d.getHosSegments24 ? d.getHosSegments24(Game.getSimNow().getTime() - offsetMs) : []);
    if (!segs.length) segs = UI._getHosSegments(d);
    if (!segs.length){
      ctx.fillStyle = '#888';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('No HOS yet', padding.l, padding.t);
      ctx.restore();
      return;
    }

    // Draw segments as thick horizontal bars
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#2a7';
    segs.forEach(seg=>{
      const idx = rows.indexOf(seg.status || seg.s || 'OFF');
      if (idx < 0) return;
      const y = padding.t + idx*rowH + rowH/2;
      const x1 = padding.l + (Math.max(0, Math.min(24, seg.start))/24)*W;
      const x2 = padding.l + (Math.max(0, Math.min(24, seg.end))/24)*W;
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x2, y);
      ctx.stroke();
    });

    ctx.restore();
  },

  refreshBank(){
    const panel=document.getElementById('panelBank'); if(!panel) return;
    const content=panel.querySelector('.content'); if(!content) return;

    const cf = Game.cashFlow.slice().reverse().slice(0,20);
    const cfRows = cf.map(t=>{
      const d=new Date(t.time);
      const amt=(t.amount>=0?'+':'-')+'$'+Math.abs(t.amount).toLocaleString();
      return `<div class="cf-item"><span>${d.toLocaleDateString()}</span><span>${t.desc}</span><span>${amt}</span></div>`;
    }).join('');

    const loansHtml = Game.loans.map(l=>{
      const pay=Math.min(l.payment, l.balance);
      return `<div class="loan"><div><strong>$${l.amount.toLocaleString()}</strong> balance $${l.balance.toLocaleString()}</div>
      <div class="row" style="margin-top:4px;">
        <button class="btn" onclick="Game.makeLoanPayment('${l.id}')">Pay $${pay.toLocaleString()}</button>
        <button class="btn" onclick="Game.repayLoan('${l.id}')">Repay All</button>
      </div>
      <details style="margin-top:4px;"><summary>Repayment Schedule</summary>${UI._loanScheduleHtml(l)}</details>
      </div>`;
    }).join('') || '<div class="hint">No active loans.</div>';

    const loanBtns = Game.loans.length>=3 ? '<div class="hint">Maximum 3 loans active.</div>' : `<div class="row" style="gap:8px; margin-top:8px;">
      <button class="btn" onclick="Game.takeLoan(10000)">Take $10k</button>
      <button class="btn" onclick="Game.takeLoan(25000)">Take $25k</button>
      <button class="btn" onclick="Game.takeLoan(100000)">Take $100k</button>
    </div>`;

    content.innerHTML=`
      <div class="stat"><div class="small">Balance</div><div id="bankBalance">$${Game.bank.toLocaleString()}</div></div>
      <h3>Cash Flow</h3>
      <div class="cash-flow">${cfRows || '<div class="hint">No transactions yet.</div>'}</div>
      <h3>Loans</h3>
      <div class="loans-list">${loansHtml}</div>
      ${loanBtns}
    `;
  },

  refreshEquipment(){
    const panel=document.getElementById('panelEquipment'); if(!panel) return;
    const content=panel.querySelector('.content'); if(!content) return;
    const html = Game.equipment.map(e=>`<div class="stat"><div class="small">${e.type}</div><div>${e.model}</div></div>`).join('');
    content.innerHTML = html || '<div class="hint">No equipment owned.</div>';
  },

  refreshProperties(){
    const panel=document.getElementById('panelProperties'); if(!panel) return;
    const content=panel.querySelector('.content'); if(!content) return;
    const html = Game.properties.map(p=>`<div class="stat"><div class="small">${p.name}</div><div>${p.city}</div></div>`).join('');
    content.innerHTML = html || '<div class="hint">No properties owned.</div>';
  },

  _loanScheduleHtml(loan){
    let remaining=loan.total;
    let rows='';
    for(let i=1;i<=12;i++){
      const due=new Date(loan.takenAt); due.setMonth(due.getMonth()+i);
      const pay=Math.min(loan.payment, remaining);
      remaining-=pay;
      rows+=`<tr><td>${due.toLocaleDateString()}</td><td>$${pay.toLocaleString()}</td><td>$${Math.max(0,remaining).toLocaleString()}</td></tr>`;
    }
    return `<table><tr><th>Due Date</th><th>Payment</th><th>Balance</th></tr>${rows}</table>`;
  },

  refreshDispatch(){
    const tbody=document.querySelector('#tblLoads tbody'); if(!tbody) return;
    tbody.innerHTML='';
    for (const l of Game.loads.slice().reverse()){
      const etaLeft=Math.max(0, l.etaMs - (Game.getSimNow().getTime()-l.startTime));
      const tr=document.createElement('tr');
      tr.innerHTML=`<td><span class="dot" style="background:${l.color}; width:10px; height:10px; border-radius:50%; display:inline-block; margin-right:6px;"></span>${l.driverName}</td>
                    <td>${l.originName} → ${l.destName}</td>
                    <td>${l.status==='En Route' ? fmtETA(etaLeft) : '—'}</td>
                    <td>${l.miles}</td>
                    <td>${l.status}${l.status==='Delivered' ? ` (+$${l.profit.toLocaleString()})` : ''}</td>`;
      tbody.appendChild(tr);
    }
    document.getElementById('statBank').textContent='$'+Game.bank.toLocaleString();
  },
  refreshTablesLive(){ try{ UI.updateCompanyLive && UI.updateCompanyLive(); }catch(e){} try{ this.refreshDispatch(); }catch(e){} },
  updateLegend(){
    const el=document.getElementById('legend'); el.innerHTML='<div class="note">Drivers</div>';
    for (const d of Game.drivers){ const span=document.createElement('span'); span.innerHTML=`<span class="dot" style="background:${d.color}"></span>${d.name}`; el.appendChild(span); }
  }
};

function makeDraggable(panel){
  if(!panel) return;
  const header=panel.querySelector('header');
  let isDown=false, startX=0, startY=0;
  const onMove=e=>{
    if(!isDown) return;
    panel.style.left=(e.clientX-startX)+"px";
    panel.style.top=(e.clientY-startY)+"px";
  };
  const onUp=()=>{
    isDown=false;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  };
  header.addEventListener('mousedown', e=>{
    isDown=true;
    startX=e.clientX-panel.offsetLeft;
    startY=e.clientY-panel.offsetTop;
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

export const Game = {
  bank: 250000,
  overheadPerTruck: 50,
  overheadPerProperty: 200,
  drivers: [],
  hireableDrivers: [],
  equipment: [],
  properties: [],
  loads: [],
  cashFlow: [],
  loans: [],
  // --- Simulation Time (starts Jan 1, 2020) ---
  simEpoch: new Date(2020, 0, 1, 0, 0, 0), // Jan 1, 2020
  _simElapsedMs: 0,
  _realLast: performance.now(),
  speed: 2,          // default: 2×
  paused: false,
  _realWhenPaused: null,
  getSimNow(){ return new Date(this.simEpoch.getTime() + this._simElapsedMs); },
  pause(){ this.paused = true; },
  resume(mult=1){
    if(this.paused){
      const pausedDur = performance.now() - (this._realWhenPaused||performance.now());
      this.realStart += pausedDur;
      this.paused = false;
    }
    this.speed = mult;
  },

  addCash(amount, desc){
    this.bank += amount;
    this.cashFlow.push({time:this.getSimNow().getTime(), amount, desc});
    UI.refreshCompany();
    UI.refreshBank();
  },

  tickMs: 1000,
  init() {
    this.generateHireDrivers();
    this.addDriver('Alice', cityByName('Chicago, IL'));
    this.addDriver('Ben',   cityByName('Dallas, TX'));
    this.addDriver('Cara',  cityByName('Atlanta, GA'));
    UI.refreshAll();
    if (this.loop) clearInterval(this.loop); this.loop = setInterval(()=>this.update(), this.tickMs);
    if (this.overheadLoop) clearInterval(this.overheadLoop); this.overheadLoop = setInterval(()=>this.applyOverhead(), 60000);
    UI.initOverridesUI();
    UI._wireTimeButtons();
    UI.updateTimeHUD();
    if (this._hudLoop) clearInterval(this._hudLoop); this._hudLoop = setInterval(()=>UI.updateTimeHUD(), 500);
  },
  generateHireDrivers(){
    this.hireableDrivers = DriverProfiles.map(p => ({ ...p, id: crypto.randomUUID() }));
  },
  addDriver(name, city) {
    const color = Colors[this.drivers.length % Colors.length];
    const driver = new Driver(name, city.lat, city.lng, color);
    this.drivers.push(driver);
    driver.render();
    UI.updateLegend();
    document.dispatchEvent(new CustomEvent('driversUpdated'));
  },
  hireDriver(id){
    const cand = this.hireableDrivers.find(c=>String(c.id)===String(id));
    if(!cand) return;
    const city = cityByName('Chicago, IL');
    const color = Colors[this.drivers.length % Colors.length];
    const driver = new Driver({
      firstName: cand.firstName,
      lastName: cand.lastName,
      age: cand.age,
      gender: cand.gender,
      experience: cand.experience,
      lat: city.lat,
      lng: city.lng,
      color,
      cityName: city.name
    });
    this.drivers.push(driver);
    driver.render();
    this.hireableDrivers = this.hireableDrivers.filter(c=>String(c.id)!==String(id));
    UI.updateLegend();
    document.dispatchEvent(new CustomEvent('driversUpdated'));
    UI.refreshCompany();
  },
  buyEquipment(type, model, cost) {
    if (this.bank < cost) { alert('Insufficient funds.'); return; }
    this.equipment.push({type, model, owner:'You'});
    this.addCash(-cost, `Bought ${model}`);
    UI.refreshEquipment();
  },
  buyProperty(name, city, cost) {
    if (this.bank < cost) { alert('Insufficient funds.'); return; }
    this.properties.push({name, city});
    this.addCash(-cost, `Bought ${name}`);
    UI.refreshProperties();
  },

  takeLoan(amount){
    if(this.loans.length>=3){ alert('Loan limit reached.'); return; }
    const total=Math.round(amount*1.1);
    const payment=Math.round(total/12);
    const loan={ id:crypto.randomUUID(), amount, total, balance:total, payment, takenAt:this.getSimNow().getTime() };
    this.loans.push(loan);
    this.addCash(amount, `Loan taken $${amount.toLocaleString()}`);
  },
  makeLoanPayment(id){
    const loan=this.loans.find(l=>l.id===id); if(!loan){ alert('Loan not found'); return; }
    const pay=Math.min(loan.payment, loan.balance);
    if(this.bank < pay){ alert('Insufficient funds.'); return; }
    this.addCash(-pay, 'Loan payment');
    loan.balance-=pay;
    if(loan.balance<=0) this.loans=this.loans.filter(l=>l.id!==id);
    UI.refreshBank();
  },
  repayLoan(id){
    const loan=this.loans.find(l=>l.id===id); if(!loan){ alert('Loan not found'); return; }
    const amt=loan.balance;
    if(this.bank < amt){ alert('Insufficient funds.'); return; }
    this.addCash(-amt, 'Loan repaid');
    this.loans=this.loans.filter(l=>l.id!==id);
    UI.refreshBank();
  },

  // ----- Load Board integration: assign + deadhead -> main leg
  async assignLoad(driverId, load) {
    const d = this.drivers.find(x => String(x.id) === String(driverId));
    if (!d) { alert('Driver not found.'); return; }
    if (d.status !== 'Idle') { alert('Driver is busy.'); return; }

    const originName = `${load.origin.city}, ${load.origin.state}`;
    const destName   = `${load.dest.city}, ${load.dest.state}`;
    const origin = { name: originName, lat: load.origin.lat, lng: load.origin.lng };
    const dest   = { name: destName,   lat: load.dest.lat,   lng: load.dest.lng };

    const mph = 58, fuelPerMile = 0.75, wagePerMile = 0.60;

    const fromPos = { name: 'Driver', lat: d.lat, lng: d.lng };
    const toPickup = origin;
    const deadheadRoute = await Router.route(fromPos, toPickup);
    const deadheadMiles = Math.round(deadheadRoute.distanceMiles);
    const needsDeadhead = deadheadMiles > 5;

    const mainRoute = await Router.route(origin, dest);
    const mainMiles = Math.round(mainRoute.distanceMiles);
    const etaMainMs = (mainMiles / Math.max(20, Math.min(80, mph))) * 3600 * 1000;
    const payout = load.payout ?? (mainMiles * (load.rpm || 2.5));
    const cost = mainMiles * (fuelPerMile + wagePerMile);
    const profit = Math.round(payout - cost);

    const makeLoadRow = (overrides) => ({
      id: crypto.randomUUID(),
      driverId: d.id, driverName: d.name, color: d.color,
      ...overrides
    });

    const _legal = d.isDrivingLegal(Game.getSimNow().getTime()); if (!_legal.ok){ alert(_legal.reason); return; }
    if (needsDeadhead) {
      const etaDHMs = (deadheadMiles / Math.max(20, Math.min(80, mph))) * 3600 * 1000;
      const deadheadLoad = makeLoadRow({
        kind: 'Deadhead',
        originName: 'Current Position', destName: originName,
        start: deadheadRoute.path[0], end: deadheadRoute.path[deadheadRoute.path.length-1],
        miles: deadheadMiles, startTime: Game.getSimNow().getTime(),
        etaMs: etaDHMs, status: 'En Route', profit: 0
      });
      this.loads.push(deadheadLoad);
      d._pendingMainLeg = { route: mainRoute, mainMiles, etaMainMs, profit, originName, destName };
      d.startTripPolyline(deadheadRoute.path, deadheadLoad.id);
    } else {
      const mainLoad = makeLoadRow({
        kind: 'Main',
        originName, destName,
        start: mainRoute.path[0], end: mainRoute.path[mainRoute.path.length-1],
        miles: mainMiles, startTime: Game.getSimNow().getTime(),
        etaMs: etaMainMs, status: 'En Route', profit
      });
      this.loads.push(mainLoad);
      d.startTripPolyline(mainRoute.path, mainLoad.id);
    }

    // toast/UI refresh handled by board; we still refresh tables
    UI.refreshDispatch();
  },

  completeLoad(load) {
    this.addCash(load.profit, `Delivered load ${load.originName} → ${load.destName}`);
    load.status = 'Delivered';
    UI.refreshDispatch();
  },

  update(){ const realNow=performance.now(); if(!this.paused) this._simElapsedMs += (realNow - this._realLast)*this.speed; this._realLast = realNow; const now=this.getSimNow().getTime();
    for (const d of this.drivers) {
      try{ d.syncHosLog(now); }catch(e){}
      if (d.status === 'On Trip') {
        const ld = this.loads.find(l => l.id === d.currentLoadId);
        if (!ld) continue;
        const t = (now - ld.startTime) / ld.etaMs;
        if (t >= 1) {
          d.finishTrip(ld.end);
            if (ld.kind === 'Deadhead' && d._pendingMainLeg) {
              // Mark the deadhead leg as complete so the driver can take new loads
              ld.status = 'Delivered';
              const { route, mainMiles, etaMainMs, profit, originName, destName } = d._pendingMainLeg;
              const mainLoad = {
                id: crypto.randomUUID(),
                driverId: d.id, driverName: d.name, color: d.color,
                kind: 'Main',
                originName, destName,
              start: route.path[0], end: route.path[route.path.length-1],
              miles: mainMiles, startTime: Game.getSimNow().getTime(),
              etaMs: etaMainMs, status: 'En Route', profit
            };
            this.loads.push(mainLoad);
            d._pendingMainLeg = null;
            d.startTripPolyline(route.path, mainLoad.id);
            UI.refreshDispatch();
          } else {
            this.completeLoad(ld);
          }
        } else {
          d.tick(now, ld);
        }
      }
    }
    UI.refreshTablesLive();
  },

  applyOverhead() {
    const trucks = this.equipment.filter(e => e.type === 'truck').length;
    const props = this.properties.length;
    const burn = trucks * this.overheadPerTruck + props * this.overheadPerProperty;
    if (burn > 0) this.addCash(-burn, 'Daily overhead');
  }
  ,jump(ms){
    this._simElapsedMs += Math.max(0, ms|0);
    const now = this.getSimNow().getTime();
    try { for (const d of this.drivers) { d.syncHosLog(now); d.applyHosTick(now); } } catch(e){}
    try {
      UI.refreshTablesLive();
      const sid = UI._companySelectedId;
      if (sid) { const d = this.drivers.find(x=>String(x.id)===String(sid)); if (d) UI._drawHosChart(d); }
    } catch(e){}
  }

};

export function fillCitySelectGrouped(sel){
  sel.innerHTML='';
  for(const g of CityGroups){
    const og=document.createElement('optgroup'); og.label=g.state;
    for(const c of g.items){
      const o=document.createElement('option'); o.value=c.name; o.textContent=c.name;
      og.appendChild(o);
    }
    sel.appendChild(og);
  }
}


// ---- Time HUD helpers ----
UI._wireTimeButtons = function(){
  const byId=id=>document.getElementById(id);
  const setActive=(id)=>{
    document.querySelectorAll('.time-controls button').forEach(b=>b.classList.remove('active'));
    const el=byId(id); if(el) el.classList.add('active');
  };
  const btnPause = byId('btnPause'), btn1=byId('btn1x'), btn2=byId('btn2x'), btn4=byId('btn4x');
  if(btnPause){ btnPause.onclick=()=>{ Game.pause(); setActive('btnPause'); UI.updateTimeHUD(); }; }
  if(btn1){ btn1.onclick=()=>{ Game.resume(1); setActive('btn1x'); UI.updateTimeHUD(); }; }
  if(btn2){ btn2.onclick=()=>{ Game.resume(2); setActive('btn2x'); UI.updateTimeHUD(); }; }
  if(btn4){ btn4.onclick=()=>{ Game.resume(4); setActive('btn4x'); UI.updateTimeHUD(); }; }
  setActive('btn2x'); // default
};
UI.updateTimeHUD = function(){
  try{ UI._ensurePlus15Button(); }catch(e){}
  const hud = document.getElementById('timeHud');
  if(!hud) return;
  const now = Game.getSimNow();
  const clk = document.getElementById('clock24');
  if (clk){
    const hh = String(now.getHours()).padStart(2,'0');
    const mm = String(now.getMinutes()).padStart(2,'0');
    const ss = String(now.getSeconds()).padStart(2,'0');
    clk.textContent = `${hh}:${mm}:${ss}`;
  }
  const cal = document.getElementById('miniCal');
  if (cal){
    const key = `${now.getFullYear()}-${now.getMonth()}`;
    if (UI._calKey !== key){
      UI._calKey = key;
      UI._renderMiniCalendar(now);
    } else {
      const prev = cal.querySelector('.mc-cell .mc-dot');
      if (prev) prev.remove();
      const dayCell = cal.querySelector(`.mc-cell[data-day="${now.getDate()}"]`);
      if (dayCell){
        const dot = document.createElement('span');
        dot.className='mc-dot';
        dayCell.appendChild(dot);
      }
    }
  }
};
UI._renderMiniCalendar = function(now){
  const cal = document.getElementById('miniCal'); if(!cal) return;
  const y = now.getFullYear(), m = now.getMonth();
  const first = new Date(y, m, 1);
  const last = new Date(y, m+1, 0);
  const startDow = first.getDay(); const days = last.getDate();
  const monthName = first.toLocaleString(undefined, { month:'long' });
  const head = `<div class="mc-head">${monthName} ${y}</div>`;
  const dows = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  const gridHeader = `<div class="mc-grid">` + dows.map(d=>`<div class="mc-dow">${d}</div>`).join('') + `</div>`;
  const cells = []; for(let i=0;i<startDow;i++) cells.push('<div class="mc-cell empty"></div>');
  for(let d=1; d<=days; d++){ cells.push(`<div class="mc-cell" data-day="${d}"><span class="mc-num">${d}</span></div>`); }
  while((cells.length % 7)!==0) cells.push('<div class="mc-cell empty"></div>');
  const gridDays = `<div class="mc-grid">${cells.join('')}</div>`;
  cal.innerHTML = head + gridHeader + gridDays;
  const cur = cal.querySelector(`.mc-cell[data-day="${now.getDate()}"]`);
  if (cur){ const dot=document.createElement('span'); dot.className='mc-dot'; cur.appendChild(dot); }
};
