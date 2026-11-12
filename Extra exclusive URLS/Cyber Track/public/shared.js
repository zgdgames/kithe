(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CT = factory();
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';

const GRAV = 30;
const CAR_R = 2.4;
const DS = 5;
const DRIFT_MIN_SPD = 22;
const TAU = Math.PI * 2;

// ── VEHICLES ─────────────────────────────────────────────────────────
const VEHICLES = {
  civic_type_r:  {name:'CIVIC TYPE R',   make:'Honda',       col:0xff3344, accel:28, top:44,  hand:2.4, hp:90,  wins:0,   desc:'Hot hatch icon. All-round champ.',        stats:[3,4,2]},
  gr86:          {name:'GR86',           make:'Toyota',      col:0xcccccc, accel:30, top:46,  hand:2.8, hp:85,  wins:3,   desc:'Rear-wheel drive. Pure driving joy.',     stats:[3,5,2]},
  skyline_r34:   {name:'SKYLINE GT-R',   make:'Nissan',      col:0x4488ff, accel:34, top:52,  hand:2.6, hp:95,  wins:8,   desc:'R34 legend. All-wheel drive hero.',       stats:[4,4,3]},
  mustang_gt500: {name:'MUSTANG GT500',  make:'Ford',        col:0x2255cc, accel:38, top:56,  hand:1.8, hp:120, wins:15,  desc:'V8 American muscle. Brute force.',        stats:[5,2,4]},
  porsche_gt3:   {name:'PORSCHE 911 GT3',make:'Porsche',     col:0xffffff, accel:36, top:58,  hand:3.2, hp:80,  wins:25,  desc:'Track-tuned. Surgical precision.',        stats:[4,5,2]},
  lambo_huracan: {name:'HURACÁN EVO',    make:'Lamborghini', col:0xffcc00, accel:42, top:64,  hand:2.4, hp:90,  wins:40,  desc:'V10 mid-engine thunder. 640 hp.',         stats:[5,4,2]},
  ferrari_la:    {name:'LaFERRARI',      make:'Ferrari',     col:0xff0000, accel:46, top:70,  hand:2.6, hp:85,  wins:60,  desc:'963 hp hybrid hypercar. The limit.',      stats:[5,4,2]},
  bugatti_chiron:{name:'CHIRON',         make:'Bugatti',     col:0x1144cc, accel:50, top:80,  hand:2.0, hp:100, wins:100, desc:'1500 hp W16. Nothing comes close.',       stats:[5,3,3]},
  tacoma:        {name:'TACOMA TRD PRO',make:'Toyota',     col:0x5b6b45, liv:{trim:0x15171a, bumpers:0x15171a, wheels:0x2a2a30}, accel:32, top:50,  hand:2.2, hp:140, wins:12,  desc:'Lifted off-road pickup. Takes a beating.',  stats:[3,3,5], type:'truck'},
  f1_mclaren:    {name:'MCL38',          make:'McLaren F1',  col:0xff8000, liv:{trim:0x2bb3ff, bumpers:0x101014, wheels:0x2a2a32}, accel:62, top:104, hand:3.2, hp:55,  wins:70,  desc:'Papaya orange. Won at Miami.',            stats:[5,5,1], type:'f1'},
  f1_mercedes:   {name:'W15',            make:'Mercedes F1', col:0xc4c9ce, liv:{trim:0x00d2be, bumpers:0x0a0a0a, wheels:0x2a2a32}, accel:63, top:105, hand:3.2, hp:55,  wins:90,  desc:'Silver arrow, petronas green.',           stats:[5,5,1], type:'f1'},
  f1_redbull:    {name:'RB20',           make:'Red Bull F1', col:0x1b2a78, liv:{trim:0xdc0a1e, bumpers:0x0a0a1a, wheels:0x2a2a32}, accel:66, top:107, hand:3.3, hp:55,  wins:110, desc:'Ground-effect champion.',                 stats:[5,5,1], type:'f1'},
  f1_ferrari:    {name:'SF-24',          make:'Ferrari F1',  col:0xdc0000, liv:{trim:0xf5f5f5, bumpers:0x111111, wheels:0x2a2a32}, accel:67, top:108, hand:3.3, hp:55,  wins:130, desc:'Rosso corsa. Tifosi favourite.',          stats:[5,5,1], type:'f1'},
  f1_aston:      {name:'AMR24',          make:'Aston Martin F1', col:0x00665c, liv:{trim:0xcddc00, bumpers:0x0a0a0a, wheels:0x2a2a32}, accel:64, top:106, hand:3.2, hp:55, wins:140, desc:'British racing green.',               stats:[5,5,1], type:'f1'},
  f1_concept:    {name:'F1 CONCEPT',     make:'Formula 1',   col:0xff0011, accel:70, top:110, hand:3.4, hp:50,  wins:150, desc:'Open wheel. 1000 hp. Pure track weapon.', stats:[5,5,1], type:'f1'},
};

function vstats(id) {
  const v = VEHICLES[id] || VEHICLES.civic_type_r;
  return { accel: 20 + v.accel * 0.35, top: 30 + v.top * 0.45, hand: v.hand, hp: v.hp };
}

// ── TRACKS ───────────────────────────────────────────────────────────
// mode: car | boat | plane      style: how the client dresses the world
const TRACKS = [
  {name:'FARMLAND',    icon:'🌾', desc:'Rolling hills, sweeping bends',        roadW:28, mode:'car',   style:'farm',    bank:0.5},
  {name:'FOREST',      icon:'🌲', desc:'Tight winding mountain forest roads',  roadW:18, mode:'car',   style:'forest',  bank:0.4},
  {name:'OPEN WATER',  icon:'🌊', desc:'Boat race — ride the ocean swell',     roadW:44, mode:'boat',  style:'water',   bank:0},
  {name:'BEACH',       icon:'🏖', desc:'Coastal causeway, sweeping bends',     roadW:30, mode:'car',   style:'beach',   bank:0.4},
  {name:'CAVE',        icon:'🕳', desc:'Underground — twisting crystal tunnels',roadW:20, mode:'car',   style:'cave',    bank:0.4},
  {name:'VOLCANO',     icon:'🌋', desc:'Climb the crater, jump the lava',      roadW:22, mode:'car',   style:'volcano', bank:0.6},
  {name:'CYBER GRID',  icon:'⚡', desc:'Floating neon circuit with jumps',     roadW:26, mode:'car',   style:'cyber',   bank:1.0},
  {name:'HOUSE',       icon:'🏠', desc:'Indoor — toy track over the furniture',roadW:16, mode:'car',   style:'house',   bank:0.2},
  {name:'CITY NIGHT',  icon:'🌃', desc:'Elevated highway through skyscrapers', roadW:24, mode:'car',   style:'city',    bank:0.7},
  {name:'SKY',         icon:'✈', desc:'Plane race — climb and dive the rings', roadW:38, mode:'plane', style:'sky',     bank:0},
  {name:'DOUBLE HELIX',icon:'🧬', desc:'Figure-8 with a real bridge crossing', roadW:26, mode:'car',   style:'helix',   bank:1.0},
  {name:'NEON CITY',   icon:'🌆', desc:'Banked neon skyway with big air',      roadW:26, mode:'car',   style:'neon',    bank:1.2},
  {name:'STADIUM',     icon:'🏟', desc:'High-banked speedway oval',            roadW:30, mode:'car',   style:'stadium', bank:1.8},
  {name:'CHAOS ZONE',  icon:'🌀', desc:'Unpredictable hills, banks and ramps', roadW:24, mode:'car',   style:'chaos',   bank:1.2},
  {name:'DESERT CANYON',icon:'🏜', desc:'Dunes, mesas and sandstone arches',    roadW:26, mode:'car',   style:'desert',  bank:0.6},
  {name:'SNOW PEAKS',  icon:'🏔', desc:'Frozen alpine pass with icy bends',    roadW:20, mode:'car',   style:'snow',    bank:0.5},
  {name:'MOON BASE',   icon:'🌕', desc:'Low gravity craters and domes',        roadW:28, mode:'car',   style:'moon',    bank:0.8, g:0.5},
  {name:'CANDY LAND',  icon:'🍭', desc:'Lollipop forest and gumdrop hills',    roadW:26, mode:'car',   style:'candy',   bank:0.8},
  {name:'ARCTIC SEA',  icon:'🧊', desc:'Boat race between drifting icebergs',  roadW:44, mode:'boat',  style:'arctic',  bank:0},
  {name:'CANYON FLIGHT',icon:'🛩', desc:'Plane race through towering rock spires',roadW:38, mode:'plane', style:'canyon',  bank:0},
];

const rnd = a => (Math.random() - 0.5) * a;

function ringPts(N, f) {
  const o = [];
  for (let i = 0; i < N; i++) o.push(f((i / N) * TAU, i));
  return o;
}
const CITY_PTS = [[200,0],[200,120],[50,150],[-80,120],[-200,80],[-200,-80],[-80,-150],[50,-150],[180,-100]];
const HOUSE_PTS = [[140,80,1],[140,-40,1],[60,-120,7],[-60,-120,14],[-140,-40,14],[-140,80,7],[-60,130,1],[60,130,1]];

function genTrack(type) {
  const p = Math.random() * TAU, q = Math.random() * TAU, r3 = Math.random() * TAU;
  const R = (f, len, h) => ({f, len: len || 16, h: h || 3.2});
  let cp, ramps = [];
  switch (type) {
    case 0: cp = ringPts(10, a => { const r = 190 + Math.sin(a*2)*40; return {x:Math.cos(a)*r+rnd(18), z:Math.sin(a)*r*0.7+rnd(12), y:8+5*Math.sin(a*2+p)+3*Math.sin(a*3+q)}; }); break;
    case 1: cp = ringPts(16, a => { const r = 135 + Math.sin(a*4)*48; return {x:Math.cos(a)*r+rnd(22), z:Math.sin(a)*r+rnd(18), y:16+9*Math.sin(a*2+p)+4*Math.sin(a*5+q)}; }); break;
    case 2: cp = ringPts(8, a => ({x:Math.cos(a)*250+rnd(20), z:Math.sin(a)*170+rnd(15), y:0})); ramps = [R(0.28, 20, 3.6), R(0.72, 20, 3.6)]; break;
    case 3: cp = ringPts(12, a => ({x:Math.cos(a)*230+Math.sin(a*3)*30+rnd(18), z:Math.sin(a)*150+Math.cos(a*2)*25+rnd(14), y:4+2*Math.sin(a*2+p)+1.2*Math.sin(a*3+q)})); break;
    case 4: cp = ringPts(14, a => { const r = 128 + Math.sin(a*5)*36; return {x:Math.cos(a)*r+rnd(20), z:Math.sin(a)*r+rnd(16), y:24+13*Math.sin(a+p)+5*Math.sin(a*3+q)}; }); break;
    case 5: cp = ringPts(12, a => { const r = 175 + Math.sin(a*3)*60; return {x:Math.cos(a)*r+rnd(28), z:Math.sin(a)*r+rnd(24), y:36+20*Math.sin(a+p)+7*Math.sin(a*2+q)}; }); ramps = [R(0.37), R(0.8)]; break;
    case 6: cp = ringPts(8, a => ({x:Math.cos(a)*230+rnd(30), z:Math.sin(a)*140+rnd(20), y:24+8*Math.sin(a*2+p)+4*Math.sin(a*3+q)})); ramps = [R(0.2), R(0.62)]; break;
    case 7: cp = HOUSE_PTS.map(v => ({x:v[0], z:v[1], y:v[2]})); break;
    case 8: cp = CITY_PTS.map((v, i) => { const a = i/9*TAU; return {x:v[0], z:v[1], y:16+7*Math.sin(a*2+p)+3*Math.sin(a*4+q)}; }); break;
    case 9: cp = ringPts(8, a => ({x:Math.cos(a)*250+rnd(25), z:Math.sin(a)*180+rnd(20), y:120+28*Math.sin(a*2+p)+16*Math.sin(a*3+q)})); break;
    case 10: cp = ringPts(16, t => ({x:240*Math.sin(t)+rnd(10), z:150*Math.sin(t*2)+rnd(8), y:15+11*Math.cos(t)})); break;
    case 11: cp = CITY_PTS.map((v, i) => { const a = i/9*TAU; return {x:v[0]*1.1, z:v[1]*1.1, y:22+10*Math.sin(a*3+p)}; }); ramps = [R(0.14), R(0.5, 18, 3.8), R(0.82)]; break;
    case 12: cp = ringPts(10, a => ({x:Math.cos(a)*230*(0.95+Math.random()*0.1), z:Math.sin(a)*145*(0.95+Math.random()*0.1), y:5})); break;
    case 14: cp = ringPts(12, a => { const r = 205 + Math.sin(a*3)*55; return {x:Math.cos(a)*r+rnd(22), z:Math.sin(a)*r*0.75+rnd(16), y:7+6*Math.sin(a*2+p)+3*Math.sin(a*3+q)}; }); ramps = [R(0.3), R(0.74)]; break;
    case 15: cp = ringPts(14, a => { const r = 145 + Math.sin(a*3)*48; return {x:Math.cos(a)*r+rnd(20), z:Math.sin(a)*r+rnd(16), y:22+13*Math.sin(a+p)+5*Math.sin(a*3+q)}; }); break;
    case 16: cp = ringPts(10, a => ({x:Math.cos(a)*225+Math.sin(a*2)*40+rnd(22), z:Math.sin(a)*150+rnd(16), y:5+4*Math.sin(a*2+p)+2*Math.sin(a*3+q)})); ramps = [R(0.22, 18, 3.8), R(0.68, 18, 3.8)]; break;
    case 17: cp = ringPts(12, a => { const r = 175 + Math.sin(a*4)*42; return {x:Math.cos(a)*r+rnd(20), z:Math.sin(a)*r*0.8+rnd(16), y:10+7*Math.sin(a*2+p)+3*Math.sin(a*3+q)}; }); break;
    case 18: cp = ringPts(9, a => ({x:Math.cos(a)*245+Math.sin(a*3)*30+rnd(20), z:Math.sin(a)*175+rnd(15), y:0})); ramps = [R(0.3, 20, 3.6), R(0.75, 20, 3.6)]; break;
    case 19: cp = ringPts(10, a => ({x:Math.cos(a)*265+rnd(25), z:Math.sin(a)*190+rnd(20), y:95+30*Math.sin(a*2+p)+18*Math.sin(a*3+q)})); break;
    default: {
      const a1 = 6+Math.random()*8, a2 = 4+Math.random()*5, a3 = 2+Math.random()*4;
      cp = ringPts(14, a => ({x:Math.cos(a)*215*(0.75+Math.random()*0.5)+rnd(50), z:Math.sin(a)*160*(0.75+Math.random()*0.5)+rnd(36), y:28+a1*Math.sin(a+p)+a2*Math.sin(a*2+q)+a3*Math.sin(a*3+r3)}));
      ramps = [R(0.12+Math.random()*0.15), R(0.4+Math.random()*0.15, 18, 4), R(0.7+Math.random()*0.15)];
    }
  }
  return {type, cp, ramps, w: TRACKS[type].roadW};
}

function cm(a, b, c, d, t) {
  const t2 = t*t, t3 = t2*t;
  return 0.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t2+(-a+3*b-3*c+d)*t3);
}

// state: {type, cp:[{x,y,z}], ramps:[{f,len,h}], w}
function buildTrack(st) {
  const meta = TRACKS[st.type] || TRACKS[6];
  const cp = st.cp, M = cp.length, SUB = 24;
  const dx = [], dy = [], dz = [];
  for (let s = 0; s < M; s++) {
    const a = cp[(s-1+M)%M], b = cp[s], c = cp[(s+1)%M], d = cp[(s+2)%M];
    for (let j = 0; j < SUB; j++) {
      const t = j / SUB;
      dx.push(cm(a.x,b.x,c.x,d.x,t)); dy.push(cm(a.y,b.y,c.y,d.y,t)); dz.push(cm(a.z,b.z,c.z,d.z,t));
    }
  }
  const D = dx.length, cum = [0];
  for (let i = 0; i < D; i++) {
    const j = (i+1) % D;
    cum.push(cum[i] + Math.hypot(dx[j]-dx[i], dz[j]-dz[i]));
  }
  const L = cum[D], N = Math.max(40, Math.round(L / DS)), ds = L / N;
  const px = new Array(N), py = new Array(N), pz = new Array(N);
  let k = 0;
  for (let i = 0; i < N; i++) {
    const target = i * ds;
    while (k < D - 1 && cum[k+1] < target) k++;
    const j = (k+1) % D, sl = cum[k+1] - cum[k] || 1, t = (target - cum[k]) / sl;
    px[i] = dx[k] + (dx[j]-dx[k])*t; py[i] = dy[k] + (dy[j]-dy[k])*t; pz[i] = dz[k] + (dz[j]-dz[k])*t;
  }
  const tx = new Array(N), tz = new Array(N), sl = new Array(N), ang = new Array(N), segL = new Array(N), S = new Array(N);
  let acc = 0;
  for (let i = 0; i < N; i++) {
    const a = (i-1+N)%N, b = (i+1)%N;
    const ex = px[b]-px[a], ez = pz[b]-pz[a], h = Math.hypot(ex, ez) || 1;
    tx[i] = ex/h; tz[i] = ez/h; sl[i] = (py[b]-py[a])/h; ang[i] = Math.atan2(tx[i], tz[i]);
    S[i] = acc; segL[i] = Math.hypot(px[b]-px[i], pz[b]-pz[i]) || 0.001; acc += segL[i];
  }
  // curvature → banking
  let curv = new Array(N);
  for (let i = 0; i < N; i++) {
    let da = ang[(i+1)%N] - ang[(i-1+N)%N];
    while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
    curv[i] = da / (2*ds);
  }
  for (let pass = 0; pass < 4; pass++) {
    const c2 = new Array(N);
    for (let i = 0; i < N; i++) c2[i] = (curv[(i-2+N)%N]+curv[(i-1+N)%N]+curv[i]+curv[(i+1)%N]+curv[(i+2)%N]) / 5;
    curv = c2;
  }
  const maxB = meta.bank > 1.5 ? 0.5 : 0.32, bk = new Array(N);
  for (let i = 0; i < N; i++) bk[i] = -Math.max(-maxB, Math.min(maxB, curv[i] * 22 * meta.bank));
  const ramps = (st.ramps || []).map(r => ({s0: r.f * acc, len: r.len, h: r.h}));
  return {type: st.type, meta, mode: meta.mode, style: meta.style, w: st.w, N, L: acc, ds,
          px, py, pz, tx, tz, sl, bk, ang, segL, S, curv, ramps, nramps: []};
}

function rampAt(tr, s, o) {
  o.h = 0; o.sl = 0;
  for (let i = 0; i < tr.ramps.length; i++) {
    const r = tr.ramps[i];
    let d = s - r.s0; if (d < 0) d += tr.L;
    if (d <= r.len) { o.h = r.h * d / r.len; o.sl = r.h / r.len; return o; }
  }
  return o;
}

// Narrow centre-lane ramps (the dodge ramp in front of a spike strip).
const _nr = {h:0, sl:0};
function nrampAt(tr, s, lat, o) {
  o.h = 0; o.sl = 0;
  const rs = tr.nramps;
  for (let i = 0; i < rs.length; i++) {
    const r = rs[i];
    let d = s - r.s0; if (d < 0) d += tr.L;
    const e = (r.hw + 0.8 - Math.abs(lat)) / 0.8;
    if (d <= r.len && e > 0) { const k = e > 1 ? 1 : e; o.h = r.h * d / r.len * k; o.sl = r.h / r.len * k; return o; }
  }
  return o;
}

function sAtF(tr, f) {
  f = ((f % 1) + 1) % 1;
  const u = f * tr.N, i = Math.min(tr.N - 1, Math.floor(u));
  return tr.S[i] + (u - i) * tr.segL[i];
}

function zoneRamps(tr, zones) {
  const out = [];
  if (tr.mode === 'plane') return out;
  for (const z of zones) {
    if (z.t !== 'spike') continue;
    const len = 10;
    let s0 = sAtF(tr, z.f) - z.r - len; if (s0 < 0) s0 += tr.L;
    out.push({s0, len, h: 4.6, hw: 2});
  }
  return out;
}

// Nearest point on the track centreline. hint = last segment index (or -1 for a global search).
function sample(tr, x, y, z, hint, o) {
  const N = tr.N, px = tr.px, py = tr.py, pz = tr.pz;
  let lo = 0, hi = N - 1;
  const local = hint >= 0;
  if (local) { lo = hint - 8; hi = hint + 12; }
  let bi = 0, bt = 0, bd = Infinity;
  for (let k = lo; k <= hi; k++) {
    const i = ((k % N) + N) % N, j = (i+1) % N;
    const ax = px[i], az = pz[i], ex = px[j]-ax, ez = pz[j]-az;
    let t = ((x-ax)*ex + (z-az)*ez) / (ex*ex + ez*ez || 1);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = ax + ex*t, qz = az + ez*t;
    let d = (x-qx)*(x-qx) + (z-qz)*(z-qz);
    if (!local && tr.mode !== 'plane') { const qy = py[i] + (py[j]-py[i])*t, ddy = y - qy; if (Math.abs(ddy) > 7) d += ddy*ddy*2; }
    if (d < bd) { bd = d; bi = i; bt = t; }
  }
  const i = bi, j = (i+1) % N, t = bt;
  let ttx = tr.tx[i] + (tr.tx[j]-tr.tx[i])*t, ttz = tr.tz[i] + (tr.tz[j]-tr.tz[i])*t;
  const tl = Math.hypot(ttx, ttz) || 1; ttx /= tl; ttz /= tl;
  const qx = px[i] + (px[j]-px[i])*t, qz = pz[i] + (pz[j]-pz[i])*t;
  o.i = i; o.t = t;
  o.tx = ttx; o.tz = ttz; o.lx = ttz; o.lz = -ttx;
  o.lat = (x-qx)*o.lx + (z-qz)*o.lz;
  o.cy = py[i] + (py[j]-py[i])*t;
  o.bk = tr.bk[i] + (tr.bk[j]-tr.bk[i])*t;
  o.sl = tr.sl[i] + (tr.sl[j]-tr.sl[i])*t;
  o.s = tr.S[i] + t * tr.segL[i];
  o.ang = Math.atan2(ttx, ttz);
  return o;
}

// Position on the track at arc fraction f (0..1) and lateral offset lat (+ = left).
function placeAt(tr, f, lat, o) {
  o = o || {};
  f = ((f % 1) + 1) % 1;
  const u = f * tr.N, i = Math.min(tr.N - 1, Math.floor(u)), t = u - i, j = (i+1) % tr.N;
  let ttx = tr.tx[i] + (tr.tx[j]-tr.tx[i])*t, ttz = tr.tz[i] + (tr.tz[j]-tr.tz[i])*t;
  const tl = Math.hypot(ttx, ttz) || 1; ttx /= tl; ttz /= tl;
  const bk = tr.bk[i] + (tr.bk[j]-tr.bk[i])*t;
  const s = tr.S[i] + t * tr.segL[i];
  rampAt(tr, s, _rp);
  o.x = tr.px[i] + (tr.px[j]-tr.px[i])*t + ttz*lat;
  o.z = tr.pz[i] + (tr.pz[j]-tr.pz[i])*t - ttx*lat;
  o.cy = tr.py[i] + (tr.py[j]-tr.py[i])*t;
  o.y = tr.mode === 'boat' ? 0 : o.cy + (tr.mode === 'plane' ? 0 : lat*bk + _rp.h);
  o.angle = Math.atan2(ttx, ttz);
  o.tx = ttx; o.tz = ttz; o.bk = tr.mode === 'car' ? bk : 0;
  o.sl = tr.mode === 'boat' ? 0 : (tr.sl[i] + (tr.sl[j]-tr.sl[i])*t) + (tr.mode === 'car' ? _rp.sl : 0);
  o.i = i;
  return o;
}

function waveH(x, z, t) {
  return 0.7*Math.sin(x*0.045 + t*1.3) + 0.5*Math.sin(z*0.06 - t*1.1) + 0.3*Math.sin((x+z)*0.11 + t*2.1);
}

function newCar(vehicleId) {
  return {
    vehicleId, vs: vstats(vehicleId),
    x:0, y:0, z:0, vy:0, angle:0, speed:0, pit:0,
    onGround:true, gy:null, wi:-1, lat:0, sl:0, rl:0, ta:0, k:1, slip:false,
    boostT:0, oilT:0, slowT:0, spinT:0, reverseT:0, driftT:0, driftSide:0,
    wallHit:false, landed:0, fell:false,
  };
}

const _s = {}, _rp = {h:0, sl:0};

// inp: {u, d, st}  (st: +1 = left)     env: {noWalls, lowG, dbl, t}
function stepCar(c, inp, dt, tr, env) {
  const vs = c.vs, ms = dt * 1000;
  c.wallHit = false; c.landed = 0;
  const bm = c.boostT > 0 ? 1.5 : 1;
  const rev = c.reverseT > 0 ? -1 : 1;
  const thr = ((inp.u ? 1 : 0) - (inp.d ? 1 : 0)) * rev;
  const st = (inp.st || 0) * rev;
  let top = vs.top * bm * (env.dbl ? 1.6 : 1) * (c.k || 1);
  if (c.slowT > 0) top *= 0.45;
  if (c.oilT > 0) top *= 0.8;
  if (c.slip) top *= 1.08;

  if (tr.mode === 'plane') {
    if (c.speed < top) c.speed = Math.min(top, c.speed + vs.accel * bm * dt);
    else c.speed = Math.max(top, c.speed - 60 * dt);
    if (c.spinT > 0) c.angle += 9 * dt;
    else c.angle += st * vs.hand * 0.6 * dt;
    c.pit += (thr * 0.45 - c.pit) * Math.min(1, 4 * dt);
    c.vy *= Math.pow(0.15, dt);
    const cp = Math.cos(c.pit);
    c.x += Math.sin(c.angle) * c.speed * cp * dt;
    c.z += Math.cos(c.angle) * c.speed * cp * dt;
    c.y += (c.speed * Math.sin(c.pit) + c.vy) * dt;
    const o = sample(tr, c.x, c.y, c.z, c.wi, _s);
    const ddy = c.y - o.cy, r = Math.hypot(o.lat, ddy), Rr = tr.w / 2 - 1.5;
    if (r > Rr) {
      if (!env.noWalls) {
        const kk = Rr / r, nl = o.lat * kk;
        c.x -= o.lx * (o.lat - nl); c.z -= o.lz * (o.lat - nl); c.y = o.cy + ddy * kk;
        c.speed *= Math.pow(0.5, dt); c.wallHit = true; o.lat = nl;
      } else if (r > Rr + 70) c.fell = true;
    }
    c.onGround = false; c.gy = null; c.sl = Math.tan(c.pit); c.rl = 0;
    c.wi = o.i; c.lat = o.lat; c.ta = o.ang;
  } else {
    const air = !c.onGround;
    if (!air) {
      if (thr > 0) c.speed += vs.accel * bm * dt * (c.speed < 0 ? 2.5 : 1);
      else if (thr < 0) c.speed -= (c.speed > 0 ? 60 : 24) * dt;
      else c.speed *= Math.pow(0.45, dt);
      if (tr.mode === 'car') c.speed -= GRAV * 0.45 * c.sl * dt;
    }
    if (c.speed > top) c.speed = Math.max(top, c.speed - 70 * dt);
    if (c.speed < -18) c.speed = -18;

    const steering = Math.abs(st) > 0.5 && c.speed > DRIFT_MIN_SPD && !air;
    if (c.spinT > 0) c.angle += 9 * dt;
    else if (st) {
      let rate = vs.hand * 0.95 / (1 + Math.abs(c.speed) / 200);
      if (c.oilT > 0) rate *= 0.35;
      if (air) rate *= 0.3;
      if (tr.mode === 'boat') rate *= 0.85;
      if (c.driftT > 250) rate *= 1.2;
      const sf = Math.min(1, Math.abs(c.speed) / 12) * (c.speed < 0 ? -1 : 1);
      c.angle += st * rate * sf * dt;
    }
    if (steering) { c.driftT += ms; c.driftSide = st > 0 ? 1 : -1; }
    else {
      if (c.driftT > 900) c.boostT = Math.max(c.boostT, Math.min(2200, c.driftT * 0.9));
      c.driftT = 0;
    }

    const cs = air ? 1 : 1 / Math.sqrt(1 + c.sl * c.sl);
    c.x += Math.sin(c.angle) * c.speed * cs * dt;
    c.z += Math.cos(c.angle) * c.speed * cs * dt;

    const o = sample(tr, c.x, c.y, c.z, c.wi, _s);
    const half = tr.w / 2;
    let lat = o.lat;
    const rel = c.angle - o.ang, ca = Math.cos(rel), sa = Math.sin(rel);
    if (!env.noWalls) {
      const lim = half - 1.3;
      if (Math.abs(lat) > lim) {
        const sg = lat > 0 ? 1 : -1, ov = lat - sg * lim;
        c.x -= o.lx * ov; c.z -= o.lz * ov; lat = sg * lim;
        c.wallHit = true;
        if (c.speed * sa * sg > 0) {
          c.speed *= Math.pow(0.12, dt * (0.15 + Math.abs(sa)));
          if (ca > 0 && c.spinT <= 0) {
            let r = rel; while (r > Math.PI) r -= TAU; while (r < -Math.PI) r += TAU;
            c.angle -= Math.sign(r) * Math.min(Math.abs(r), 1.6 * dt);
          }
        }
      }
    }
    let roadY;
    if (tr.mode === 'boat') {
      roadY = waveH(c.x, c.z, env.t);
      const fx = Math.sin(c.angle), fz = Math.cos(c.angle);
      rampAt(tr, o.s, _rp);
      nrampAt(tr, o.s, lat, _nr);
      roadY += _rp.h + _nr.h;
      c.sl = (waveH(c.x + fx*2, c.z + fz*2, env.t) - waveH(c.x - fx*2, c.z - fz*2, env.t)) / 4 + ca * (_rp.sl + _nr.sl);
      c.rl = (waveH(c.x + fz*1.2, c.z - fx*1.2, env.t) - waveH(c.x - fz*1.2, c.z + fx*1.2, env.t)) / 2.4 - sa * (_rp.sl + _nr.sl);
    } else {
      rampAt(tr, o.s, _rp);
      nrampAt(tr, o.s, lat, _nr);
      roadY = o.cy + lat * o.bk + _rp.h + _nr.h;
      if (env.noWalls && Math.abs(lat) > half + 0.6) roadY = -1e9;
      c.sl = ca * (o.sl + _rp.sl + _nr.sl) + sa * o.bk;
      c.rl = -sa * (o.sl + _rp.sl + _nr.sl) + ca * o.bk;
    }
    const G = GRAV * (env.lowG ? 0.28 : 1) * (tr.meta.g || 1);
    c.vy -= G * dt;
    c.y += c.vy * dt;
    if (c.y <= roadY + 0.02) {
      if (!c.onGround) { c.landed = -c.vy; c.vy = 0; }
      else if (c.gy !== null && Math.abs(roadY - c.gy) < 3) c.vy = Math.max(-45, Math.min(45, (roadY - c.gy) / dt));
      else c.vy = 0;
      c.y = roadY; c.onGround = true; c.gy = roadY;
    } else {
      c.gy = null;
      if (c.y - roadY > 0.5) c.onGround = false;
    }
    if (c.y < o.cy - 30) c.fell = true;
    c.wi = o.i; c.lat = lat; c.ta = o.ang;
  }

  if (c.boostT > 0) c.boostT -= ms;
  if (c.oilT > 0) c.oilT -= ms;
  if (c.slowT > 0) c.slowT -= ms;
  if (c.spinT > 0) c.spinT -= ms;
  if (c.reverseT > 0) c.reverseT -= ms;
}

return {GRAV, CAR_R, DS, DRIFT_MIN_SPD, VEHICLES, vstats, TRACKS, genTrack, buildTrack, rampAt, nrampAt, zoneRamps, sAtF, sample, placeAt, waveH, newCar, stepCar};
});
