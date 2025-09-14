// src/load_board.js — 'My Loads' clears on reload + only shows active dispatches
// - Uses a per-page SESSION ID so entries don't survive page reloads
// - Shows only loads that are actively 'En Route' in Game.loads
// - Auto-clears completed loads from storage
// - Retains panel with close-x, draggable header, live driver removal

import * as CitiesMod from './data/cities.js';
import * as Utils from './utils.js';
import { announce } from './announcer.js';

// Normalize exports
const CITIES = (CitiesMod.Cities) || (CitiesMod.CityGroups ? CitiesMod.CityGroups.flatMap(g => g.items) : []);
const haversineFn = (Utils.haversine) || (Utils.haversineMiles);
if (!Array.isArray(CITIES) || CITIES.length === 0) console.warn('cities export not recognized');
if (!haversineFn) throw new Error('utils.js must export haversine or haversineMiles');

const TRAILER_TYPES = ['Dry Van', 'Reefer', 'Flatbed', 'Step Deck', 'Tanker'];

// Storage keys
const LS_LEGACY = 'bookedLoadsV1';              // old persistent key (purged)
const SS_BOOKED = 'bookedLoadsSessionV2';       // session entries (carry SID)
const SS_SID    = 'lbSessionIdV1';              // per-page session id

// Create a fresh session id on page load so old entries won't match after reload
const SESSION_ID = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
try { sessionStorage.setItem(SS_SID, SESSION_ID); } catch {}
try { localStorage.removeItem(LS_LEGACY); } catch {}

const PANEL_ID = 'panelLoadBoard';

const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min,max) => Math.floor(Math.random()*(max-min+1))+min;
const rnd = (min,max) => Math.random()*(max-min)+min;
const fmtMoney = n => n.toLocaleString(undefined, { style:'currency', currency:'USD', maximumFractionDigits:0 });
const fmtRPM = n => `${n.toFixed(2)}/mi`;
const fmtDT = d => d.toLocaleString(undefined, { month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit' });

function getDrivers(){
  const g=window.Game; if(!g) return [];
  return (g.drivers||[]).map((d,i)=>({ id:d.id??i, name:d.name??`Driver ${i+1}`, status:d.status||'Idle', ref:d }));
}
const getIdleDrivers = () => getDrivers().filter(d => (d.status||'Idle') === 'Idle');

// ---- storage helpers
function readBookedRaw(){
  try { return JSON.parse(sessionStorage.getItem(SS_BOOKED) || '[]'); } catch { return []; }
}
function writeBookedRaw(arr){
  try { sessionStorage.setItem(SS_BOOKED, JSON.stringify(arr)); } catch {}
}
function readBookedActive(){
  // Filter to current SESSION_ID and also to loads that are still active in Game (status === 'En Route')
  const sid = sessionStorage.getItem(SS_SID);
  const all = Array.isArray(readBookedRaw()) ? readBookedRaw() : [];
  const g = window.Game;
  if (!g || !Array.isArray(g.loads)) {
    // No game/loads after reload => nothing is active
    return [];
  }
  const active = new Set((g.loads||[]).filter(L => L.status === 'En Route').map(L => String(L.driverId)));
  return all.filter(x => x.sid === sid && active.has(String(x.driverId)));
}
function addBooked(entry){
  const arr = readBookedRaw();
  arr.push(entry);
  writeBookedRaw(arr);
}
function pruneCompleted(){
  // Remove entries whose driverId is no longer 'En Route'
  const g = window.Game;
  const arr = readBookedRaw();
  if (!g || !Array.isArray(g.loads)) {
    writeBookedRaw([]);
    return;
    }
  const active = new Set((g.loads||[]).filter(L => L.status === 'En Route').map(L => String(L.driverId)));
  writeBookedRaw(arr.filter(x => x.sid === SESSION_ID && active.has(String(x.driverId))));
}

// ---- generator
function genLoads(count=36){
  const res=[]; const now=new Date();
  for(let i=0;i<count;i++){
    let a=pick(CITIES), b=pick(CITIES); let guard=0;
    while (a && b && a.name===b.name && guard++<10) b=pick(CITIES);
    if(!a || !b) continue;
    const miles = Math.max(1, Math.round(haversineFn({lat:a.lat,lng:a.lng},{lat:b.lat,lng:b.lng})));
    const rpm = rnd(2.00, 4.50);
    const payout = Math.round(miles * rpm);
    const pickOffsetHrs = randInt(6, 48);
    const pickup = new Date(now.getTime() + pickOffsetHrs*3600*1000);
    const transitHrs = (miles / 48) + randInt(2, 10);
    const due = new Date(pickup.getTime() + transitHrs*3600*1000);
    const trailer = TRAILER_TYPES[Math.floor(Math.random()*TRAILER_TYPES.length)];
    const [cityA,stateA]=a.name.split(', '), [cityB,stateB]=b.name.split(', ');
    res.push({
      id:`L${now.getTime()}-${i}-${Math.random().toString(36).slice(2,7)}`,
      origin:{ city:cityA, state:stateA, lat:a.lat, lng:a.lng },
      dest:{ city:cityB, state:stateB, lat:b.lat, lng:b.lng },
      miles, rpm:Number(rpm.toFixed(2)), payout,
      pickupISO: pickup.toISOString(), dueISO: due.toISOString(),
      trailer
    });
  }
  return res.sort((x,y)=> new Date(x.pickupISO)-new Date(y.pickupISO));
}

// --- DOM helpers
function ensurePanel(){
  let panel=document.getElementById(PANEL_ID);
  if(panel) return panel;
  panel=document.createElement('div');
  panel.className='panel'; panel.id=PANEL_ID; panel.style.display='none';
  panel.innerHTML=`
    <header>
      <div>Load Board</div>
      <div class="close-x" data-close="#${PANEL_ID}">✕</div>
    </header>
    <div class="content">
      <div class="row" style="justify-content:space-between; align-items:center; margin-bottom:8px;">
        <div class="lb-title" style="font-weight:700;">Available Loads</div>
        <div class="lb-actions">
          <button class="lb-btn" data-action="refresh">Refresh</button>
          <button class="lb-btn" data-action="myloads">My Loads</button>
          <button class="lb-btn" data-action="back" style="display:none;">Back</button>
        </div>
      </div>
      <div class="lb-body" id="lb-list"></div>
    </div>
  `;
  document.body.appendChild(panel);

  // draggable via header, but ignore clicks on the ✕
  const header = panel.querySelector('header');
  makeDraggable(panel, header);

  // close-x like other panels
  header.querySelector('.close-x').addEventListener('click', (e)=>{
    const targetSel = e.currentTarget.getAttribute('data-close');
    const tgt = document.querySelector(targetSel);
    if (tgt) tgt.style.display='none';
  });

  // actions
  panel.addEventListener('click', (e)=>{
    const btn=e.target.closest('button.lb-btn'); if(!btn) return;
    const action=btn.getAttribute('data-action');
    if(action==='refresh'){ pruneCompleted(); showAvailable(); }
    else if(action==='myloads'){ pruneCompleted(); showMyLoads(); }
    else if(action==='back'){ showAvailable(); }
  });

  return panel;
}

function makeDraggable(panel, handle){
  let startX=0,startY=0,origX=0,origY=0,drag=false;
  function down(e){
    if(e.target && e.target.closest('.close-x')) return; // don't start drag on X
    drag=true; const evt=e.touches?e.touches[0]:e;
    startX=evt.clientX; startY=evt.clientY;
    const r=panel.getBoundingClientRect(); origX=r.left; origY=r.top;
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    document.addEventListener('touchmove', move, {passive:false});
    document.addEventListener('touchend', up);
  }
  function move(e){
    if(!drag) return; const evt=e.touches?e.touches[0]:e;
    panel.style.left=(origX+(evt.clientX-startX))+'px';
    panel.style.top=(origY+(evt.clientY-startY))+'px';
    panel.style.right='auto';
    e.preventDefault?.();
  }
  function up(){
    drag=false;
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', up);
    document.removeEventListener('touchmove', move);
    document.removeEventListener('touchend', up);
  }
  handle.addEventListener('mousedown', down);
  handle.addEventListener('touchstart', down, {passive:true});
}

function renderLoads(listEl, loads, mode='available'){
  listEl.innerHTML='';
  if(!loads.length){ listEl.innerHTML='<div class="lb-empty">No loads.</div>'; return; }

  const drivers = (mode==='available') ? getIdleDrivers() : getDrivers();
  const hasDrivers = drivers.length>0;

  for(const L of loads){
    const card=document.createElement('div'); card.className='lb-card';
    const rpmSmall = `<div class="lb-rpm">${fmtRPM(L.rpm)}</div>`;
    const payoutLine = `<div class="lb-payout">${fmtMoney(L.payout)}${rpmSmall}</div>`;
    const pick=new Date(L.pickupISO), due=new Date(L.dueISO);

    let assignBlock='', actionsBlock='';
    if(mode==='available'){
      assignBlock = hasDrivers
        ? `<select class="lb-driver">${drivers.map(d=>`<option value="${String(d.id)}">${d.name}</option>`).join('')}</select>`
        : `<div class="lb-nodrivers">No idle drivers</div>`;
      actionsBlock = `<button class="lb-btn lb-book">Book</button>`;
    } else {
      const dname = (L.driverId && drivers.find(d=>String(d.id)===String(L.driverId))?.name) || (L.driverName||'—');
      assignBlock = `<div class="small">Driver: <span class="lb-value">${dname}</span></div>`;
    }

    card.innerHTML = `
      <div class="lb-row top">
        <div class="lb-lane">
          <span class="lb-city">${L.origin.city}, ${L.origin.state}</span>
          <span class="lb-arrow">→</span>
          <span class="lb-city">${L.dest.city}, ${L.dest.state}</span>
        </div>
        ${payoutLine}
      </div>
      <div class="lb-row mid">
        <div class="lb-times">
          <div><span class="lb-label">Pickup:</span> ${fmtDT(pick)}</div>
          <div><span class="lb-label">Due:</span> ${fmtDT(due)}</div>
        </div>
        <div class="lb-meta">
          <div class="lb-label">Miles</div><div class="lb-value">${L.miles}</div>
          <div class="lb-label">Trailer</div><div class="lb-value">${L.trailer}</div>
        </div>
      </div>
      <div class="lb-row bot">
        <div class="lb-assign">${assignBlock}</div>
        <div class="lb-actions">${actionsBlock||''}</div>
      </div>
    `;

    if(mode==='available'){
      card.querySelector('.lb-book').addEventListener('click', ()=>{
        const sel=card.querySelector('.lb-driver');
        if(!sel || sel.options.length===0){ alert('No drivers available to assign.'); return; }
        const driverId=sel.value;
        if(!driverId){ alert('Select a driver'); return; }
        bookLoad(L, driverId);
        // Optimistically remove this driver from ALL dropdowns
        removeDriverFromDropdowns(driverId);
        card.classList.add('lb-card--booked'); setTimeout(()=>card.remove(), 180);
      });
    }

    listEl.appendChild(card);
  }
}

function removeDriverFromDropdowns(driverId){
  document.querySelectorAll(`#${PANEL_ID} .lb-driver`).forEach(sel => {
    const opt = sel.querySelector(`option[value="${String(driverId)}"]`);
    if(opt) opt.remove();
    if(sel.options.length===0){
      const wrap = sel.closest('.lb-assign');
      if(wrap) wrap.innerHTML = '<div class="lb-nodrivers">No idle drivers</div>';
    }
  });
}

function bookLoad(load, driverId){
  const g=window.Game;
  if(!g){ alert('Game not ready.'); return; }
  const d=(g.drivers||[]).find(dd => String(dd.id ?? (g.drivers||[]).indexOf(dd))===String(driverId));
  if(!d){ alert('Driver not found.'); return; }
  if((d.status||'Idle')!=='Idle' || d.currentLoadId){ alert('This driver is already on a load.'); return; }
  const active=(g.loads||[]).some(L => L.driverId && String(L.driverId)===String(driverId) && L.status==='En Route');
  if(active){ alert('This driver already has an active load.'); return; }

  // Store with this page's SESSION_ID so it auto-expires on reload
  addBooked({ ...load, driverId, sid: SESSION_ID, bookedAt: new Date().toISOString() });

  if(typeof g.assignLoad==='function'){ try{ g.assignLoad(driverId, load); }catch(e){ console.warn('assignLoad error', e); } }
  const driverName = d.name || `Driver ${driverId}`;
  announce(`Booked under ${driverName}: ${load.origin.city}, ${load.origin.state} → ${load.dest.city}, ${load.dest.state}`);
}
let _panel, _listEl, _mode='available';
function setMode(mode){
  _mode=mode;
  const actions = _panel.querySelector('.lb-actions');
  const btnBack = actions.querySelector('[data-action="back"]');
  const btnMy = actions.querySelector('[data-action="myloads"]');
  if(mode==='booked'){ btnBack.style.display='inline-block'; btnMy.style.display='none'; }
  else { btnBack.style.display='none'; btnMy.style.display='inline-block'; }
}

function refreshDriverDropdowns(){
  if(_mode!=='available') return;
  const drivers=getIdleDrivers();
  document.querySelectorAll(`#${PANEL_ID} .lb-card`).forEach(card=>{
    const assign=card.querySelector('.lb-assign'); if(!assign) return;
    const sel=assign.querySelector('select.lb-driver');
    if(drivers.length){
      const opts=drivers.map(d=>`<option value="${String(d.id)}">${d.name}</option>`).join('');
      if(sel){
        const val=sel.value; sel.innerHTML=opts;
        if(val && sel.querySelector(`option[value="${val}"]`)) sel.value=val;
      } else {
        assign.innerHTML=`<select class="lb-driver">${opts}</select>`;
      }
    } else if(sel){
      assign.innerHTML='<div class="lb-nodrivers">No idle drivers</div>';
    }
  });
}

export function openLoadBoard(){
  if(!_panel) initLoadBoard();
  _panel.style.display='block';
  if(!_panel.style.top){ _panel.style.left='auto'; _panel.style.top='24px'; _panel.style.right='24px'; }
}
export function closeLoadBoard(){
  if(_panel) _panel.style.display='none';
}
export function showAvailable(){
  setMode('available');
  renderLoads(_listEl, genLoads(36), 'available');
}
export function showMyLoads(){
  setMode('booked');
  renderLoads(_listEl, readBookedActive(), 'booked');
}
export function initLoadBoard(){
  // On init, prune anything completed and ensure a fresh session id is used to scope entries
  pruneCompleted();
  _panel = ensurePanel();
  _listEl = _panel.querySelector('#lb-list');
  showAvailable();
  return _panel;
}

window.LoadBoard = { initLoadBoard, openLoadBoard, closeLoadBoard, showAvailable, showMyLoads };

document.addEventListener('driversUpdated', refreshDriverDropdowns);
