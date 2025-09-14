import { map } from './map.js';
import { cumulativeMiles, interpolateAlong } from './utils.js';

const HOS_STEP_MS = 60*1000; // 1-minute resolution
const HOS_STEP_HR = HOS_STEP_MS / 3600000;

/** Driver now supports full profile data. Backward-compatible with old constructor. */
let _driverIdCounter = 1;
export class Driver {
  /**
   * Create driver.
   * - New signature: new Driver({ firstName, lastName, lat, lng, color, truckMake, truckModel, truckNumber, cityName })
   * - Old signature: new Driver(name, lat, lng, color)
   */
  constructor(arg1, lat, lng, color) {
    if (typeof arg1 === 'object' && arg1 !== null) {
      const d = arg1;
      this.id = _driverIdCounter++;
      this.firstName = d.firstName || '';
      this.lastName = d.lastName || '';
      this.age = d.age || 0;
      this.gender = d.gender || '';
      this.experience = Math.min(d.experience || 0, this.age);
      this.color = d.color || color || '#39c';
      this.lat = d.lat ?? lat ?? 0;
      this.lng = d.lng ?? lng ?? 0;
      this.cityName = d.cityName || '';
      this.status = 'Idle';
      this.currentLoadId = null;
      this.truckMake = d.truckMake || '';
      this.truckModel = d.truckModel || '';
      this.truckNumber = d.truckNumber || '';
      this.marker = L.circleMarker([this.lat, this.lng], { radius:7, color:this.color, weight:2, fillColor:this.color, fillOpacity:0.7 });
      this.routeLine = null;
      this.path = null; this.cumMiles = null;
      this.visible = true;
      // Simple HOS: last 7 days of on-duty hours (0-11)
      this.hos = Array.isArray(d.hos) ? d.hos.slice(0,7) : Array.from({length:7}, ()=>Math.floor(4 + Math.random()*7));
      this.hosSegments = [];
      this.hosDay = null;
      this.hosDutyStartMs = null;
      this.hosDriveSinceReset = 0;
      this.hosDriveSinceLastBreak = 0;
      this.hosOffStreak = 0;
      this._hosPausedStartMs = null;
      this._hosLastTickMs = null;
      this.hosLog = [];
      this._hosLastStatus = null;
      this.breakUntilMs = null;
      this.shortBreakHr = null;
      this.shortBreakTaken = false;
    } else {
      // Backward compatibility (old: name, lat, lng, color)
      const name = String(arg1 || '').trim() || 'Driver';
      const parts = name.split(' ');
      this.id = _driverIdCounter++;
      this.firstName = parts[0] || 'Driver';
      this.lastName = parts.slice(1).join(' ') || '';
      this.age = 0;
      this.gender = '';
      this.experience = 0;
      this.color = color || '#39c';
      this.lat = lat || 0;
      this.lng = lng || 0;
      this.cityName = '';
      this.status = 'Idle';
      this.currentLoadId = null;
      this.truckMake = '';
      this.truckModel = '';
      this.truckNumber = '';
      this.marker = L.circleMarker([this.lat, this.lng], { radius:7, color:this.color, weight:2, fillColor:this.color, fillOpacity:0.7 });
      this.routeLine = null;
      this.path = null; this.cumMiles = null;
      this.visible = true;
      this.hos = Array.from({length:7}, ()=>Math.floor(4 + Math.random()*7));
      this.hosSegments = [];
      this.hosDay = null;
      this.hosDutyStartMs = null;
      this.hosDriveSinceReset = 0;
      this.hosDriveSinceLastBreak = 0;
      this.hosOffStreak = 0;
      this._hosPausedStartMs = null;
      this._hosLastTickMs = null;
      this.hosLog = [];
      this._hosLastStatus = null;
      this.breakUntilMs = null;
      this.shortBreakHr = null;
      this.shortBreakTaken = false;
    }
  }
  get name(){ return (this.firstName + ' ' + this.lastName).trim(); }
  render(){ if(this.visible) this.marker.addTo(map); }
  setPosition(lat,lng){ this.lat=lat; this.lng=lng; this.marker.setLatLng([lat,lng]); }
  showOnMap(){ this.visible=true; try{ this.marker.addTo(map); }catch(e){} if(this.routeLine) try{ this.routeLine.addTo(map); }catch(e){} }
  hideFromMap(){ this.visible=false; try{ map.removeLayer(this.marker); }catch(e){} if(this.routeLine) try{ map.removeLayer(this.routeLine); }catch(e){} }
  startTripPolyline(path, loadId){
    this.status='On Trip';
    this.currentLoadId = loadId;
    this.path = path;
    this.cumMiles = cumulativeMiles(path);
    if (this.routeLine){ try{ map.removeLayer(this.routeLine);}catch(e){} }
    this.routeLine = L.polyline(path, { color:this.color, weight:3, opacity:0.9 });
    if(this.visible) this.routeLine.addTo(map);
  }
  /** Called every tick to move marker/advance along path */
  tick(now, load){
    if (!this.path || !this.cumMiles) return;
    const totalMiles = this.cumMiles[this.cumMiles.length - 1] || 0.00001;
    const paused = (load.pauseMs||0);
    const t = Math.max(0, Math.min(1, (now - load.startTime - paused) / load.etaMs));
    const targetMiles = totalMiles * t;
    const p = interpolateAlong(this.path, this.cumMiles, targetMiles);
    this.setPosition(p.lat, p.lng);
  }
  _hosStatus(){
    const s = this.status || 'Idle';
    if (s === 'SB' || s === 'Sleeper') return 'SB';
    if (s === 'OFF' || s === 'Off Duty') return 'OFF';
    if (s === 'On Trip' || s === 'Driving') return 'D';
    if (this.currentLoadId) return 'D';
    return 'OFF';
  }
  _appendHosSegment(status, startHour, endHour){
    const today = (new Date()).toDateString();
    if (this.hosDay !== today){ this.hosSegments = []; this.hosDay = today; }
    const start = Math.max(0, startHour), end = Math.min(24, endHour);
    if (!this.hosSegments.length){ this.hosSegments.push({start, end, status}); return; }
    const last = this.hosSegments[this.hosSegments.length-1];
    if (last.status === status && Math.abs(last.end - start) < 1e-6){ last.end = end; return; }
    this.hosSegments.push({start, end, status});
  }
  applyHosTick(nowMs){
    const stepMs = HOS_STEP_MS;
    const stepHr = HOS_STEP_HR;
    if (!this._hosLastTickMs){ this._hosLastTickMs = nowMs - stepMs; }
    for (let t=this._hosLastTickMs+stepMs; t<=nowMs; t+=stepMs){
      const st = this._hosStatus();
      const dt = new Date(t);
      const hr = dt.getHours() + dt.getMinutes()/60;
      this._appendHosSegment(st, hr-stepHr, hr);
      if (st==='OFF' || st==='SB'){
        this.hosOffStreak += stepHr;
        this.hosDriveSinceLastBreak = Math.max(0, this.hosDriveSinceLastBreak - stepHr);
        if (this.hosOffStreak >= 10){ this.hosDutyStartMs=null; this.hosDriveSinceReset=0; }
      } else {
        this.hosOffStreak = 0;
        if (!this.hosDutyStartMs) this.hosDutyStartMs = t;
        if (st==='D'){ this.hosDriveSinceReset += stepHr; this.hosDriveSinceLastBreak += stepHr; }
      }
      this._hosLastTickMs = t;
    }
  }
  isDrivingLegal(nowMs){
    const dutyStart = this.hosDutyStartMs;
    const onDutyHrs = dutyStart ? Math.max(0, (nowMs - dutyStart)/3600000) : 0;
    if (this.hosDriveSinceReset >= 11){
      return { ok:false, reason:'11-hour driving limit reached. Take a 10-hour break.' };
    }
    if (dutyStart && onDutyHrs >= 14){
      return { ok:false, reason:'14-hour duty window expired. Take a 10-hour break.' };
    }
    if (this.hosDriveSinceLastBreak >= 10){
      return { ok:false, reason:'30-minute break required after 10h driving.' };
    }
    return { ok:true };
  }

  _currentHosStatus(){
    const s = this.status || 'Idle';
    if (s === 'SB' || s === 'Sleeper') return 'SB';
    if (s === 'On Trip' || s === 'Driving') return 'D';
    if (s === 'On Duty') return 'ON';
    if (s === 'OFF' || s === 'Off Duty') return 'OFF';
    if (this.currentLoadId) return 'D';
    return 'OFF';
  }

  syncHosLog(nowMs){
    const s = this._currentHosStatus();
    const last = this.hosLog.length ? this.hosLog[this.hosLog.length-1].status : null;
    if (!this.hosLog.length){
      this.hosLog.push({ tMs: Math.max(0, nowMs - HOS_STEP_MS), status: s });
      this._hosLastStatus = s;
      return;
    }
    if (s !== last){
      this.hosLog.push({ tMs: nowMs, status: s });
      this._hosLastStatus = s;
    }
  }

  getHosSegmentsRange(startMs, endMs){
    const evs = [];
    if (!this.hosLog.length){
      const hrs = Math.max(0, (endMs - startMs)/3600000);
      return [{ start: Math.max(0, hrs - HOS_STEP_HR), end: hrs, status: 'OFF' }];
    }
    let statusAtStart = this.hosLog[0].status;
    for (const ev of this.hosLog){ if (ev.tMs <= startMs) statusAtStart = ev.status; else break; }
    evs.push({ tMs: startMs, status: statusAtStart });
    for (const ev of this.hosLog){ if (ev.tMs > startMs && ev.tMs < endMs) evs.push({ tMs: ev.tMs, status: ev.status }); }
    evs.push({ tMs: endMs, status: evs.length ? evs[evs.length-1].status : statusAtStart });
    const segs = [];
    for (let i=0;i<evs.length-1;i++){
      const a = evs[i], b = evs[i+1];
      const startH = (a.tMs - startMs)/3600000;
      const endH   = (b.tMs - startMs)/3600000;
      if (endH > startH) segs.push({ start: startH, end: endH, status: a.status });
    }
    return segs;
  }

  getHosSegments24(nowMs){
    const DAY_MS = 24*3600*1000;
    const startMs = Math.max(0, nowMs - DAY_MS);
    return this.getHosSegmentsRange(startMs, nowMs);
  }

  finishTrip(end){
    this.setPosition(end.lat,end.lng); this.status='Idle'; this.currentLoadId=null;
    this.path = null; this.cumMiles = null;
    this.shortBreakHr = null;
    this.shortBreakTaken = false;
    // Simulate HOS accumulation for "today"
    const todayIdx = 6; // last element is today in our 7-day window
    const add = 2 + Math.floor(Math.random()*3);
    this.hos[todayIdx] = Math.min(11, (this.hos[todayIdx]||0) + add);
    if (this.routeLine){
      const oldLine = this.routeLine;
      this.routeLine = null;
      try { oldLine.setStyle({ opacity:0.3, dashArray:'4 6' }); } catch(e){}
      setTimeout(()=>{ try{ map.removeLayer(oldLine); }catch(e){} }, 4000);
    }
  }
}
