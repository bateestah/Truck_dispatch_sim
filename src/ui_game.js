import { Colors } from './colors.js';
import { Driver } from './driver.js';
import { Router } from './router.js';
import { fmtETA, haversineMiles } from './utils.js';
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
  legend:{ showHQ:true, showSmallYards:true, showLargeYards:true, showWarehouses:true, showTruckStops:true, showRestAreas:true },
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
  showStartup(){
    const modal=document.getElementById('startupModal');
    if(!modal) return;
    modal.style.display='flex';
    const sel=document.getElementById('startupCity');
    if(sel) fillCitySelectGrouped(sel);
    const btn=document.getElementById('startupBegin');
    if(btn){
      btn.onclick=()=>{
        const name=(document.getElementById('startupName').value||'').trim();
        const cityName=sel?sel.value:'';
        if(!name){ alert('Enter company name'); return; }
        Game.setCompanyInfo(name, cityName);
        modal.style.display='none';
      };
    }
  },
  toggleDevTools(){
    const bar = document.querySelector('.drawbar');
    const ctrl = drawControl && drawControl._container;
    const hidden = bar ? (bar.style.display==='none' || getComputedStyle(bar).display==='none')
                       : (ctrl ? (ctrl.style.display==='none' || getComputedStyle(ctrl).display==='none') : true);
    if(bar) bar.style.display = hidden ? 'flex' : 'none';
    if(ctrl) ctrl.style.display = hidden ? 'block' : 'none';
    const btn = document.getElementById('btnDevTools');
    if(btn) btn.textContent = hidden ? 'Hide Dev Tools' : 'Show Dev Tools';
  },
  _prePauseSpeed: 1,
  togglePauseMenu(){
    const menu = document.getElementById('pauseMenu');
    if(!menu) return;
    const show = menu.style.display !== 'flex';
    if(show){
      this._prePauseSpeed = Game.speed;
      Game.pause();
      menu.style.display='flex';
    } else {
      menu.style.display='none';
      Game.resume(this._prePauseSpeed || 1);
      UI.updateTimeHUD();
      const mapSpeed={1:'btn1x',2:'btn2x',4:'btn4x'};
      document.querySelectorAll('.time-controls button').forEach(b=>b.classList.remove('active'));
      const id=mapSpeed[this._prePauseSpeed]||'btn1x';
      const btn=document.getElementById(id); if(btn) btn.classList.add('active');
    }
  },
  initPauseMenu(){
    const resume=document.getElementById('btnResume');
    const save=document.getElementById('btnSaveGame');
    const load=document.getElementById('btnLoadGame');
    const fresh=document.getElementById('btnNewGame');
    const file=document.getElementById('fileLoadGame');
    if(resume) resume.addEventListener('click', ()=>this.togglePauseMenu());
    if(save) save.addEventListener('click', ()=>{ Game.export(); });
    if(load) load.addEventListener('click', ()=>{ if(file) file.click(); });
    if(fresh) fresh.addEventListener('click', ()=>{ if(confirm('Start a new game? Current progress will be lost.')) Game.newGame(); });
    if(file) file.addEventListener('change', e=>{
      const f=e.target.files[0]; if(!f) return;
      const reader=new FileReader();
      reader.onload=()=>{
        try{ Game.import(reader.result); alert('Game loaded.'); this.togglePauseMenu(); }
        catch(err){ alert('Load failed: '+err.message); }
      };
      reader.readAsText(f);
      e.target.value='';
    });
    document.addEventListener('keydown', e=>{
      if(e.code==='Space' && !['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)){
        e.preventDefault();
        this.togglePauseMenu();
      }
    });
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

    this.initPauseMenu();
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
        <div class="stat">
          <div class="small">Buy Small Yard</div>
          <div class="field"><select id="selSmallYardCity"></select></div>
          <div class="row"><div class="pill">$75,000</div><button class="btn" onclick="Game.buyProperty('Small Yard', document.getElementById('selSmallYardCity').value, 75000)">Buy</button></div>
        </div>
        <div class="stat">
          <div class="small">Buy Large Yard</div>
          <div class="field"><select id="selLargeYardCity"></select></div>
          <div class="row"><div class="pill">$500,000</div><button class="btn" onclick="Game.buyProperty('Large Yard', document.getElementById('selLargeYardCity').value, 500000)">Buy</button></div>
        </div>
        <div class="stat">
          <div class="small">Buy Warehouse</div>
          <div class="field"><select id="selWarehouseCity"></select></div>
          <div class="row"><div class="pill">$100,000</div><button class="btn" onclick="Game.buyProperty('Warehouse', document.getElementById('selWarehouseCity').value, 100000)">Buy</button></div>
        </div>
      </div>
      <div class="hint">Overhead increases per owned truck ($50/day) and per property ($200/day).</div>
    `;

    content.innerHTML = html;

    // populate city selects for property purchases
    fillCitySelectGrouped(document.getElementById('selSmallYardCity'));
    fillCitySelectGrouped(document.getElementById('selLargeYardCity'));
    fillCitySelectGrouped(document.getElementById('selWarehouseCity'));
  },

  refreshCompany(){
    const panel = document.getElementById('panelCompany');
    if (!panel) return;
    const content = panel.querySelector('.content');
    if (!content) return;

    const trucks = Game.equipment.filter(e=>e.type==='truck').length;
    const props = Game.properties.length;
    const overhead = trucks*Game.overheadPerTruck + props*Game.overheadPerProperty;

    if (!UI._companyWired){
      content.innerHTML = `
        <div id="companyHQDisplay" class="small" style="margin-bottom:8px; display:none;"></div>
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
            const item = btn.closest('.driver-item');
            const sel = item && item.querySelector('select');
            const cityName = sel ? sel.value : undefined;
            Game.hireDriver(id, cityName);
            UI._renderHireDriverList();
          });
        }
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

    const titleEl = document.getElementById('companyPanelTitle');
    if(titleEl) titleEl.textContent = Game.companyName || 'Company';
    const hqEl = content.querySelector('#companyHQDisplay');
    if(hqEl){
      if(Game.hqCity){
        hqEl.textContent = 'HQ: ' + Game.hqCity.name;
        hqEl.style.display = 'block';
      } else {
        hqEl.style.display = 'none';
      }
    }
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
    const perPage = 10;
    const total = Game.hireableDrivers.length;
    const pages = Math.ceil(total/perPage);
    if(UI._hirePage >= pages) UI._hirePage = Math.max(0, pages-1);
    const start = UI._hirePage*perPage;
    const slice = Game.hireableDrivers.slice(start, start+perPage);
    const locations = [];
    if(Game.hqCity) locations.push(Game.hqCity.name);
    for(const p of Game.properties){ locations.push(p.city); }
    const showLocation = locations.length > 1;
    const html = slice.map(h => `

      <div class="driver-item">
        <div class="driver-name">${h.firstName} ${h.lastName}</div>
        <div class="driver-sub">Age: ${h.age} • ${h.gender} • Exp: ${h.experience} yrs</div>
        ${showLocation ? `<select class="hire-location">${locations.map(c=>`<option value="${c}">${c}</option>`).join('')}</select>` : ''}
        <button class="btn" data-id="${h.id}">Hire</button>
      </div>
    `).join('');
    const pager = pages>1 ? `
      <div class="row" style="margin-top:8px; justify-content:space-between;">
        <button id="hirePrev" class="btn">Prev</button>
        <span>Page ${UI._hirePage+1} / ${pages}</span>
        <button id="hireNext" class="btn">Next</button>
      </div>` : '';
    list.innerHTML = (html || '<div class="hint">No drivers available.</div>') + pager;
    const btnPrev = document.getElementById('hirePrev');
    const btnNext = document.getElementById('hireNext');
    if(btnPrev){
      btnPrev.disabled = UI._hirePage === 0;
      btnPrev.addEventListener('click', ()=>{ UI._hirePage = Math.max(0, UI._hirePage-1); UI._renderHireDriverList(); });
    }
    if(btnNext){
      btnNext.disabled = UI._hirePage >= pages-1;
      btnNext.addEventListener('click', ()=>{ UI._hirePage = Math.min(pages-1, UI._hirePage+1); UI._renderHireDriverList(); });
    }

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
    const padding = { l: 40, r: 60, t: 10, b: 24 };
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
      // Ensure totals area is cleared
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      rows.forEach((_, i)=>{
        const y = padding.t + i*rowH + rowH/2;
        ctx.clearRect(padding.l + W + 2, y - rowH/2, padding.r - 4, rowH);
        ctx.fillText('00:00', padding.l + W + 4, y);
      });
      ctx.restore();
      return;
    }

    // Totals per status
    const totals = {OFF:0, SB:0, D:0, ON:0};
    for (const seg of segs){
      const st = seg.status || seg.s || 'OFF';
      if (totals[st] !== undefined){
        totals[st] += Math.max(0, (seg.end - seg.start));
      }
    }

    // Draw segments as a continuous step graph, connecting status changes vertically
    const xCoord = hr => padding.l + (Math.max(0, Math.min(24, hr))/24) * W;
    const yCoord = st => {
      const idx = rows.indexOf(st);
      return idx < 0 ? null : padding.t + idx*rowH + rowH/2;
    };

    ctx.lineWidth = 6;
    ctx.strokeStyle = '#2a7';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'butt';

    const first = segs[0];
    let y = yCoord(first.status || first.s || 'OFF');
    if (y !== null){
      ctx.beginPath();
      let x = xCoord(first.start);
      ctx.moveTo(x, y);
      x = xCoord(first.end);
      ctx.lineTo(x, y);
      for(let i=1;i<segs.length;i++){
        const seg = segs[i];
        const nx = xCoord(seg.start);
        const ny = yCoord(seg.status || seg.s || 'OFF');
        ctx.lineTo(nx, y);   // horizontal to boundary
        if(ny !== null){
          ctx.lineTo(nx, ny);  // vertical status change
          ctx.lineTo(xCoord(seg.end), ny); // horizontal for segment
          y = ny;
        }
      }
      ctx.stroke();
    }

    // Totals text
    const fmt = h => {
      const m = Math.round(h * 60);
      const hh = String(Math.floor(m / 60)).padStart(2,'0');
      const mm = String(m % 60).padStart(2,'0');
      return `${hh}:${mm}`;
    };
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    rows.forEach((name, i)=>{
      const y = padding.t + i*rowH + rowH/2;
      ctx.fillText(fmt(totals[name]||0), padding.l + W + 4, y);
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
    const html = Game.properties.map(p=>`<div class="stat"><div class="small">${p.type}</div><div>${p.city}</div></div>`).join('');
    content.innerHTML = html || '<div class="hint">No properties owned.</div>';
    Game.renderPropertyMarkers();
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
    const el=document.getElementById('legend');
    if(!el) return;
    el.innerHTML='';
    const layers=document.createElement('div');
    layers.className='legend-section';
    layers.innerHTML=`<div class="legend-title">Layers</div>
      <label><input type="checkbox" id="lg-hq" ${UI.legend.showHQ?'checked':''}><span class="hq-marker"></span>HQ</label>
      <label><input type="checkbox" id="lg-prop-small" ${UI.legend.showSmallYards?'checked':''}><span class="prop-marker-small"></span>Small Yards</label>
      <label><input type="checkbox" id="lg-prop-large" ${UI.legend.showLargeYards?'checked':''}><span class="prop-marker-large"></span>Large Yards</label>
      <label><input type="checkbox" id="lg-prop-warehouse" ${UI.legend.showWarehouses?'checked':''}><span class="prop-marker-warehouse"></span>Warehouses</label>
      <label><input type="checkbox" id="lg-truck-stops" ${UI.legend.showTruckStops?'checked':''}><span class="truck-stop-marker"></span>Truck Stops</label>
      <label><input type="checkbox" id="lg-rest-areas" ${UI.legend.showRestAreas?'checked':''}><span class="rest-area-marker"></span>Rest Areas</label>`;
    el.appendChild(layers);
    const dsec=document.createElement('div');
    dsec.className='legend-section';
    dsec.innerHTML='<div class="legend-title">Drivers</div><div id="legendDrivers" class="legend-drivers-list"></div>';
    el.appendChild(dsec);
    const list=dsec.querySelector('#legendDrivers');
    for(const d of Game.drivers){
      const item=document.createElement('label');
      item.innerHTML=`<input type="checkbox" data-driver-id="${d.id}" ${d.visible!==false?'checked':''}><span class="dot" style="background:${d.color}"></span>${d.name}`;
      list.appendChild(item);
    }
    const hqCb=el.querySelector('#lg-hq');
    if(hqCb) hqCb.addEventListener('change',e=>{ UI.legend.showHQ=e.target.checked; if(Game.hqMarker){ e.target.checked?Game.hqMarker.addTo(map):map.removeLayer(Game.hqMarker); } });
    const smallCb=el.querySelector('#lg-prop-small');
    if(smallCb) smallCb.addEventListener('change',e=>{ UI.legend.showSmallYards=e.target.checked; for(const m of Game.propertyMarkers.small){ e.target.checked?m.addTo(map):map.removeLayer(m); } });
    const largeCb=el.querySelector('#lg-prop-large');
    if(largeCb) largeCb.addEventListener('change',e=>{ UI.legend.showLargeYards=e.target.checked; for(const m of Game.propertyMarkers.large){ e.target.checked?m.addTo(map):map.removeLayer(m); } });
    const whCb=el.querySelector('#lg-prop-warehouse');
    if(whCb) whCb.addEventListener('change',e=>{ UI.legend.showWarehouses=e.target.checked; for(const m of Game.propertyMarkers.warehouse){ e.target.checked?m.addTo(map):map.removeLayer(m); } });
    const tsCb=el.querySelector('#lg-truck-stops');
    if(tsCb) tsCb.addEventListener('change',e=>{ UI.legend.showTruckStops=e.target.checked; for(const m of Game.truckStopMarkers){ e.target.checked?m.addTo(map):map.removeLayer(m); } });
    const raCb=el.querySelector('#lg-rest-areas');
    if(raCb) raCb.addEventListener('change',e=>{ UI.legend.showRestAreas=e.target.checked; for(const m of Game.restAreaMarkers){ e.target.checked?m.addTo(map):map.removeLayer(m); } });
    list.querySelectorAll('input[data-driver-id]').forEach(cb=>cb.addEventListener('change',e=>{ const id=e.target.getAttribute('data-driver-id'); const d=Game.drivers.find(x=>String(x.id)===String(id)); if(d){ e.target.checked?d.showOnMap():d.hideFromMap(); } }));
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
  companyName: '',
  hqCity: null,
  hqMarker: null,
  bank: 250000,
  overheadPerTruck: 50,
  overheadPerProperty: 200,
  drivers: [],
  hireableDrivers: [],
  equipment: [],
  properties: [],
  propertyMarkers: { small:[], large:[], warehouse:[] },
  truckStops: [],
  truckStopMarkers: [],
  restAreas: [],
  restAreaMarkers: [],
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

  loadCompanyInfo(){
    try { return JSON.parse(localStorage.getItem('companyInfo')); } catch(_){ return null; }
  },
  setCompanyInfo(name, cityName){
    this.companyName = name;
    this.hqCity = cityByName(cityName);
    try{ localStorage.setItem('companyInfo', JSON.stringify({name, cityName})); }catch(_){ }
    this.renderHQ();
    UI.refreshCompany();
  },
  renderHQ(){
    if(this.hqMarker){ try{ map.removeLayer(this.hqMarker); }catch(e){} }
    if(!this.hqCity) return;

    const lat=this.hqCity.lat, lng=this.hqCity.lng;
    const px=12;
    this.hqMarker=L.marker([lat,lng],{
      interactive:false,
      icon:L.divIcon({className:'hq-marker', iconSize:[px,px], iconAnchor:[px/2,px/2]})
    });
    if(UI.legend.showHQ) this.hqMarker.addTo(map);
  },

  renderPropertyMarkers(){
    for(const m of [...this.propertyMarkers.small, ...this.propertyMarkers.large, ...this.propertyMarkers.warehouse]){
      try{ map.removeLayer(m); }catch(e){}
    }
    this.propertyMarkers={ small:[], large:[], warehouse:[] };
    const px=12;
    for(const p of this.properties){
      if(p.lat==null || p.lng==null){
        const c=cityByName(p.city);
        if(c){
          p.lat=c.lat + (Math.random()-0.5)*0.2;
          p.lng=c.lng + (Math.random()-0.5)*0.2;
        }
      }
      let cls='', arr, show;
      if(p.type==='Small Yard'){ cls='prop-marker-small'; arr=this.propertyMarkers.small; show=UI.legend.showSmallYards; }
      else if(p.type==='Large Yard'){ cls='prop-marker-large'; arr=this.propertyMarkers.large; show=UI.legend.showLargeYards; }
      else { cls='prop-marker-warehouse'; arr=this.propertyMarkers.warehouse; show=UI.legend.showWarehouses; }
      const marker=L.marker([p.lat,p.lng],{
        interactive:false,
        icon:L.divIcon({className:cls,iconSize:[px,px],iconAnchor:[px/2,px/2]})
      });
      if(show) marker.addTo(map);
      arr.push(marker);
    }
  },

  renderTruckStopMarkers(){
    for(const m of this.truckStopMarkers){
      try{ map.removeLayer(m); }catch(e){}
    }
    this.truckStopMarkers=[];
    if(!Array.isArray(this.truckStops)) return;
    const px=8;
    for(const ts of this.truckStops){
      const [lat,lng]=ts.coordinates||[];
      if(lat==null||lng==null) continue;
      const marker=L.marker([lat,lng],{
        interactive:false,
        icon:L.divIcon({className:'truck-stop-marker',iconSize:[px,px],iconAnchor:[px/2,px/2]})
      });
      if(UI.legend.showTruckStops) marker.addTo(map);
      this.truckStopMarkers.push(marker);
    }
  },

  renderRestAreaMarkers(){
    for(const m of this.restAreaMarkers){
      try{ map.removeLayer(m); }catch(e){}
    }
    this.restAreaMarkers=[];
    if(!Array.isArray(this.restAreas)) return;
    const px=8;
    for(const ra of this.restAreas){
      const lat = ra.latitude ?? ra.lat;
      const lng = ra.longitude ?? ra.lng;
      if(lat==null||lng==null) continue;
      const marker=L.marker([lat,lng],{
        interactive:false,
        icon:L.divIcon({className:'rest-area-marker',iconSize:[px,px],iconAnchor:[px/2,px/2]})
      });
      if(UI.legend.showRestAreas) marker.addTo(map);
      this.restAreaMarkers.push(marker);
    }
  },

  findNearestStop(lat,lng){
    const stops=[];
    if(Array.isArray(this.truckStops)){
      for(const ts of this.truckStops){
        const [sLat,sLng]=ts.coordinates||[];
        if(sLat==null||sLng==null) continue;
        stops.push({name:ts.name, lat:sLat, lng:sLng});
      }
    }
    if(Array.isArray(this.restAreas)){
      for(const ra of this.restAreas){
        const sLat=ra.latitude ?? ra.lat;
        const sLng=ra.longitude ?? ra.lng;
        if(sLat==null||sLng==null) continue;
        stops.push({name:ra.name, lat:sLat, lng:sLng});
      }
    }
    let best=null, bestDist=Infinity;
    for(const s of stops){
      const d=haversineMiles({lat,lng},{lat:s.lat,lng:s.lng});
      if(d<bestDist){ best=s; bestDist=d; }
    }
    return best;
  },

  _serializeDriver(d){
    return {
      firstName:d.firstName,lastName:d.lastName,age:d.age,gender:d.gender,experience:d.experience,
      color:d.color,lat:d.lat,lng:d.lng,cityName:d.cityName,status:d.status,currentLoadId:d.currentLoadId,
      truckMake:d.truckMake,truckModel:d.truckModel,truckNumber:d.truckNumber,
      path:d.path,cumMiles:d.cumMiles,hos:d.hos,hosSegments:d.hosSegments,hosDay:d.hosDay,
      hosDutyStartMs:d.hosDutyStartMs,hosDriveSinceReset:d.hosDriveSinceReset,
      hosDriveSinceLastBreak:d.hosDriveSinceLastBreak,hosOffStreak:d.hosOffStreak,hosLog:d.hosLog,
      hosOnDutyToday:d.hosOnDutyToday,_hosLastDayStr:d._hosLastDayStr,currentBreak:d.currentBreak,
      _pendingMainLeg:d._pendingMainLeg
    };
  },
  serialize(){
    return {
      companyName:this.companyName,
      hqCityName:this.hqCity?this.hqCity.name:null,
      bank:this.bank,
      drivers:this.drivers.map(d=>this._serializeDriver(d)),
      equipment:this.equipment,
      properties:this.properties,
      loads:this.loads,
      cashFlow:this.cashFlow,
      loans:this.loans,
      hireableDrivers:this.hireableDrivers,
      simElapsedMs:this._simElapsedMs,
      speed:this.speed
    };
  },
  save(){
    const data=this.serialize();
    try{ localStorage.setItem('savedGameV1', JSON.stringify(data)); }catch(_){ }
    return data;
  },
  export(){
    const data=this.save();
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download='game_save.json'; a.click();
    URL.revokeObjectURL(url);
  },
  import(json){
    const obj=JSON.parse(json);
    this.load(obj);
  },
  load(obj){
    try{ localStorage.setItem('savedGameV1', JSON.stringify(obj)); }catch(_){ }
    // stop loops
    if (this.loop) clearInterval(this.loop);
    if (this.overheadLoop) clearInterval(this.overheadLoop);
    if (this._hudLoop) clearInterval(this._hudLoop);
    // remove existing drivers
    for(const d of this.drivers){
      try{ map.removeLayer(d.marker); }catch(e){}
      if(d.routeLine){ try{ map.removeLayer(d.routeLine); }catch(e){} }
    }
    this.drivers=[];
    this.companyName=obj.companyName||'';
    this.hqCity=obj.hqCityName?cityByName(obj.hqCityName):null;
    this.bank=obj.bank||0;
    this.equipment=obj.equipment||[];
    this.properties=obj.properties||[];
    this.renderPropertyMarkers();
    this.loads=obj.loads||[];
    this.cashFlow=obj.cashFlow||[];
    this.loans=obj.loans||[];
    this.hireableDrivers=obj.hireableDrivers||[];
    this._simElapsedMs=obj.simElapsedMs||0;
    this.speed=obj.speed||1;
    if(Array.isArray(obj.drivers)){
      for(const dd of obj.drivers){
        const drv=new Driver(dd);
        drv.render();
        drv.status=dd.status||'Idle';
        drv.currentLoadId=dd.currentLoadId||null;
        drv.hos=dd.hos||drv.hos;
        drv.hosSegments=dd.hosSegments||[];
        drv.hosDay=dd.hosDay||null;
        drv.hosDutyStartMs=dd.hosDutyStartMs||null;
        drv.hosDriveSinceReset=dd.hosDriveSinceReset||0;
        drv.hosDriveSinceLastBreak=dd.hosDriveSinceLastBreak||0;
        drv.hosOffStreak=dd.hosOffStreak||0;
        drv.hosLog=dd.hosLog||[];
        drv._pendingMainLeg=dd._pendingMainLeg||null;
        if(drv.status==='On Trip' && Array.isArray(dd.path)){
          drv.startTripPolyline(dd.path, dd.currentLoadId);
          drv.cumMiles=dd.cumMiles;
        }
        this.drivers.push(drv);
      }
    }
    this.renderHQ();
    UI.refreshAll();
    document.dispatchEvent(new CustomEvent('driversUpdated'));
    // restart loops
    this.loop = setInterval(()=>this.update(), this.tickMs);
    this.overheadLoop = setInterval(()=>this.applyOverhead(), 60000);
    UI._wireTimeButtons();
    UI.updateTimeHUD();
    this._hudLoop = setInterval(()=>UI.updateTimeHUD(), 500);
  },
  newGame(){
    try{ localStorage.removeItem('savedGameV1'); }catch(_){ }
    try{ localStorage.removeItem('companyInfo'); }catch(_){ }
    location.reload();
  },

  tickMs: 1000,
  init() {
    const info=this.loadCompanyInfo();
    if(info&&info.name&&info.cityName){
      this.companyName=info.name;
      this.hqCity=cityByName(info.cityName);
      this.renderHQ();
    } else {
      UI.showStartup();
    }
    this.generateHireDrivers();
    this.addDriver('Alice', cityByName('Chicago, IL'));
    this.addDriver('Ben',   cityByName('Dallas, TX'));
    this.addDriver('Cara',  cityByName('Atlanta, GA'));
    fetch('./truck_stops.json')
      .then(r=>r.json())
      .then(data=>{ this.truckStops=data; this.renderTruckStopMarkers(); })
      .catch(()=>{});
    fetch('./rest_areas.json')
      .then(r=>r.json())
      .then(data=>{ this.restAreas=data; this.renderRestAreaMarkers(); })
      .catch(()=>{});
    UI.refreshAll();
    if (this.loop) clearInterval(this.loop); this.loop = setInterval(()=>this.update(), this.tickMs);
    if (this.overheadLoop) clearInterval(this.overheadLoop); this.overheadLoop = setInterval(()=>this.applyOverhead(), 60000);
    UI.initOverridesUI();
    UI._wireTimeButtons();
    UI.updateTimeHUD();
    if (this._hudLoop) clearInterval(this._hudLoop); this._hudLoop = setInterval(()=>UI.updateTimeHUD(), 500);
  },

  generateHireDrivers(){
    this.hireableDrivers = DriverProfiles.map(p=>({ ...p, id: crypto.randomUUID() }));


  },
  addDriver(name, city) {
    const color = Colors[this.drivers.length % Colors.length];
    const driver = new Driver(name, city.lat, city.lng, color);
    this.drivers.push(driver);
    driver.render();
    UI.updateLegend();
    document.dispatchEvent(new CustomEvent('driversUpdated'));
  },
  hireDriver(id, cityName){
    const cand = this.hireableDrivers.find(c=>String(c.id)===String(id));
    if(!cand) return;
    // Determine starting city: chosen city or HQ
    let city = this.hqCity;
    if(cityName){
      const chosen = cityByName(cityName);
      if(chosen) city = chosen;
    }
    // Fallback to Chicago if no HQ is set (shouldn't happen)
    if(!city) city = cityByName('Chicago, IL');
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
  buyProperty(type, cityName, cost) {
    if (this.bank < cost) { alert('Insufficient funds.'); return; }
    if (!cityName) { alert('Select a city'); return; }
    if (this.properties.some(p => p.city === cityName && p.type === type)) {
      alert('Already owned in this city');
      return;
    }
    const city = cityByName(cityName);
    if (!city) { alert('City not found'); return; }
    const lat = city.lat + (Math.random() - 0.5) * 0.2;
    const lng = city.lng + (Math.random() - 0.5) * 0.2;
    this.properties.push({ type, city: cityName, lat, lng });
    this.addCash(-cost, `Bought ${type} in ${cityName}`);
    this.renderPropertyMarkers();
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
      try{ d.syncHosLog(now); d.applyHosTick(now); }catch(e){}
      const ld = this.loads.find(l => l.id === d.currentLoadId);
      if (d.currentBreak) {
        if (ld) ld.pauseMs = (d.currentBreak.pauseBase||0) + Math.min(now, d.currentBreak.endMs) - d.currentBreak.startMs;
        if (now >= d.currentBreak.endMs) {
          if (ld) ld.pauseMs = (d.currentBreak.pauseBase||0) + (d.currentBreak.endMs - d.currentBreak.startMs);
          d.endBreak();
        }
        continue;
      }
      if (d.status === 'On Trip') {
        if (!ld) continue;
        const legal = d.isDrivingLegal(now);
        if (!legal.ok) {
          const stop = this.findNearestStop(d.lat, d.lng);
          if (stop) {
            ld.pauseMs = ld.pauseMs || 0;
            d.startBreak(legal.type, legal.durationMs, now, stop, ld.pauseMs);
          }
          continue;
        }
        const t = (now - ld.startTime - (ld.pauseMs||0)) / ld.etaMs;
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
