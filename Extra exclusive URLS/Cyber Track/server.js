'use strict';
const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const path    = require('path');
const CT      = require('./public/shared.js');

const app = express();
const srv = http.createServer(app);
const io  = new Server(srv, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, 'public')));

// ── CONFIG ───────────────────────────────────────────────────────────
const C = {
  MAX_PLAYERS:     30,
  LOBBY_TIMEOUT:   120_000,
  TICK_MS:         50,
  SUBSTEPS:        2,
  VOTE_INTERVAL:   30_000,
  VOTE_DURATION:   12_000,
  BOOST_DUR:       4000,
  OIL_DUR:         4000,
  EMP_RADIUS:      35,
  MISSILE_SPD:     85,
  SLIPSTREAM_DIST: 25,
};
const TAU = Math.PI * 2;
const TRACKS = CT.TRACKS;
const wrap = a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const r2 = v => Math.round(v * 100) / 100;

// ── VOTE OPTIONS ─────────────────────────────────────────────────────
const VOTE_POOL = [
  // Track geometry
  {id:'narrow',      label:'NARROW TRACK',    desc:'Road shrinks 25%'},
  {id:'widen',       label:'WIDEN TRACK',     desc:'Road expands wide'},
  {id:'warp',        label:'WARP SEGMENT',    desc:'Section reshuffles'},
  {id:'quake',       label:'TRACK QUAKE',     desc:'Track violently shifts'},
  {id:'mega_narrow', label:'MEGA NARROW',     desc:'Road shrinks 40%'},
  {id:'mega_widen',  label:'MEGA WIDEN',      desc:'Road expands 50%'},
  {id:'invert',      label:'INVERT CURVE',    desc:'Curves flip direction'},
  {id:'ripple',      label:'RIPPLE WAVE',     desc:'Track undulates'},
  {id:'compress',    label:'COMPRESS TRACK',  desc:'Track squeezes together'},
  {id:'expand_track',label:'EXPAND TRACK',    desc:'Track stretches out'},
  // Hazards
  {id:'boost',       label:'BOOST ZONE',      desc:'Speed strip on track'},
  {id:'spike',       label:'SPIKE STRIP',     desc:'Damage zone placed'},
  {id:'oil',         label:'OIL SLICK',       desc:'Slippery patch ahead'},
  {id:'debris',      label:'DEBRIS FIELD',    desc:'Obstacles on track'},
  {id:'double_spike',label:'DOUBLE SPIKES',   desc:'Two spike zones placed'},
  {id:'double_boost',label:'DOUBLE BOOST',    desc:'Two boost zones placed'},
  {id:'triple_oil',  label:'TRIPLE OIL',      desc:'Three oil slicks placed'},
  {id:'mega_spike',  label:'MEGA SPIKE',      desc:'Huge damage zone'},
  {id:'shock_zone',  label:'SHOCK ZONE',      desc:'Electric hazard strip'},
  {id:'freeze_zone', label:'FREEZE ZONE',     desc:'Icy patch slows cars'},
  // Physics events
  {id:'gravity',     label:'GRAVITY SPIKE',   desc:'All cars launch upward'},
  {id:'reverse_grav',label:'REVERSE GRAVITY', desc:'Cars float briefly'},
  {id:'storm',       label:'GLITCH STORM',    desc:'Random chaos for 4s'},
  {id:'speed_surge', label:'SPEED SURGE',     desc:'Everyone gets a burst'},
  {id:'mega_storm',  label:'MEGA STORM',      desc:'Extreme glitch chaos'},
  {id:'flash_boost', label:'FLASH BOOST',     desc:'Instant speed to all'},
  {id:'slow_field',  label:'SLOW FIELD',      desc:'Everyone slows 3s'},
  {id:'spin_out',    label:'SPIN OUT',        desc:'All cars spin briefly'},
  // Elimination votes
  {id:'elim_last',   label:'ELIMINATE LAST',    desc:'Last place car removed'},
  {id:'elim_bottom2',label:'ELIMINATE BOTTOM 2',desc:'Last two cars removed'},
  {id:'elim_random', label:'RANDOM ELIM',       desc:'Random car removed'},
  {id:'elim_bottom3',label:'ELIMINATE BOTTOM 3',desc:'Last three removed'},
  // Zone combos
  {id:'boost_spike', label:'BOOST + SPIKE',   desc:'Speed then pain'},
  {id:'oil_boost',   label:'OIL + BOOST',     desc:'Slippery then fast'},
  {id:'full_hazard', label:'FULL HAZARD',     desc:'Spike+oil+debris'},
  // Track swap — one per track
  ...TRACKS.map((t, i) => ({id:'new_track_' + i, label:t.name, desc:'Switch to ' + t.name.toLowerCase()})),
  // Powerup events
  {id:'boost_rain',  label:'BOOST RAIN',      desc:'Everyone gets boost'},
  {id:'repair_all',  label:'REPAIR ALL',      desc:'All cars repaired'},
  {id:'damage_all',  label:'DAMAGE ALL',      desc:'All cars take 30 dmg'},
  {id:'speed_all',   label:'TOP SPEED UP',    desc:'Max speed increases'},
  {id:'freeze_all',  label:'FREEZE ALL',      desc:'Everyone slows 5s'},
  {id:'random_chaos',label:'RANDOM CHAOS',    desc:'Wild random effect'},
  // Misc
  {id:'extend_road', label:'EXTEND ROAD',     desc:'Track length increases'},
  {id:'flip_dir',    label:'FLIP SECTION',    desc:'Section mirrors'},
  {id:'wave_boost',  label:'WAVE BOOST',      desc:'Rolling speed wave'},
  {id:'lightning_field',label:'LIGHTNING FIELD',desc:'Random sparks hit cars'},
  {id:'maze_walls',  label:'MAZE WALLS',      desc:'Extra walls appear'},
  {id:'no_walls',    label:'NO WALLS',        desc:'Barriers removed 5s'},
  {id:'ghost_mode',  label:'GHOST MODE',      desc:'No car collisions 5s'},
  {id:'turbo_npc',   label:'TURBO NPCS',      desc:'AI cars speed up'},
  {id:'slow_npc',    label:'SLOW NPCS',       desc:'AI cars slow down'},
  {id:'widen_narrow',    label:'WIDE THEN NARROW', desc:'Expands then shrinks'},
  {id:'moving_barriers', label:'MOVING BARRIERS',  desc:'Barriers sweep the track'},
  {id:'laser_gates',     label:'LASER GATES',      desc:'Death beams pulse across track'},
  {id:'fog_event',       label:'HEAVY FOG',        desc:'Dense fog blinds for 10s'},
  {id:'low_grav',        label:'LOW GRAVITY',      desc:'Cars float for 12 seconds'},
  {id:'reverse_controls',label:'REVERSE CONTROLS', desc:'Controls flip for all players'},
  {id:'double_speed',    label:'DOUBLE SPEED',     desc:'Everyone goes 2x fast for 8s'},
];

const FINISH_OPT = {id:'finish', label:'FINISH LINE', desc:'Place the finish line'};

function pick3(pool) {
  return [...pool].sort(() => Math.random() - 0.5).slice(0, 3);
}

// ── LOBBY ────────────────────────────────────────────────────────────
let waitingLobby = null;
const lobbies    = new Map();
let _carId       = 1;

function validType(t) { return Number.isInteger(t) && t >= 0 && t < TRACKS.length; }

function mkLobby(maxP, trackType, isPrivate, customCode) {
  const type = validType(trackType) ? trackType : Math.floor(Math.random() * TRACKS.length);
  const g = CT.genTrack(type);
  const L = {
    id: customCode || Math.random().toString(36).slice(2, 7).toUpperCase(),
    state: 'waiting',
    maxPlayers: maxP || C.MAX_PLAYERS,
    isPrivate: !!isPrivate,
    type, cp: g.cp, ramps: g.ramps, w: g.w, tr: null,
    players: new Map(),
    cars:    new Map(),
    alive:   new Set(),
    zones: [], obstacles: [], powerups: [],
    movingBarriers: [], laserGates: [],
    finishF: null,
    voteOn: false, voteOpts: [], votes: new Map(),
    voteT: null, nextVoteT: null, tickT: null, startT: null,
    created: Date.now(), lastTick: Date.now(), t: 0,
    noWalls: false, noWallsT: 0,
    ghostMode: false, ghostModeT: 0,
    lowGravT: 0, doubleSpeedT: 0,
    timers: new Set(),
  };
  L.tr = CT.buildTrack(trackState(L));
  lobbies.set(L.id, L);
  return L;
}

function trackState(L) {
  return {
    type: L.type, w: r2(L.w), ramps: L.ramps,
    cp: L.cp.map(p => ({x: r2(p.x), y: r2(p.y), z: r2(p.z)})),
  };
}

function later(L, fn, ms) {
  const h = {ms, at: Date.now(), t: null};
  h.run = () => { L.timers.delete(h); if (lobbies.has(L.id)) fn(); };
  L.timers.add(h);
  if (!L.paused) h.t = setTimeout(h.run, ms);
  return h;
}
function cancel(L, h) { if (h) { clearTimeout(h.t); L.timers.delete(h); } }

function setPaused(L, on) {
  if (!L.isBot || L.state !== 'racing' || !!L.paused === !!on) return;
  const now = Date.now();
  if (on) {
    L.paused = true; L.pauseAt = now;
    for (const h of L.timers) { clearTimeout(h.t); h.ms = Math.max(0, h.ms - (now - h.at)); }
  } else {
    const d = now - L.pauseAt;
    L.paused = false; L.lastTick = now;
    for (const h of L.timers) { h.at = now; h.t = setTimeout(h.run, h.ms); }
    for (const b of L.movingBarriers) b.startTime += d;
    for (const g of L.laserGates) g.startTime += d;
    for (const c of L.cars.values()) if (c.abilityT) c.abilityT += d;
  }
  io.to(L.id).emit('paused', {on: !!L.paused});
}

function gridSlot(L, idx) {
  const tr = L.tr, row = Math.floor(idx / 2), side = idx % 2 ? -1 : 1;
  const f = 1 - (8 + row * 7) / tr.L;
  const p = CT.placeAt(tr, f, side * Math.min(4.5, L.w * 0.2));
  return p;
}

function seatCar(L, c, idx) {
  const p = gridSlot(L, idx);
  c.x = p.x; c.y = p.y; c.z = p.z; c.angle = p.angle; c.wi = p.i; c.pw = p.i;
  c.vy = 0; c.speed = 0; c.gy = null; c.onGround = L.tr.mode !== 'plane';
  c.laps = -1;
}

function mkCar(L, socketId, vehicleId, idx, customData, npc) {
  if (!CT.VEHICLES[vehicleId]) vehicleId = 'civic_type_r';
  const c = CT.newCar(vehicleId);
  Object.assign(c, {
    id: `c${_carId++}`, socketId, isNPC: socketId === null, name: null,
    custom: customData || null,
    hp: c.vs.hp, maxHp: c.vs.hp,
    eliminated: false, elimReason: null,
    shieldOn: false, inv: {boost: 1, shield: 0, missile: 0, spring: 0, emp: 0}, ghostT: 0, jugT: 0,
    laps: -1, progress: 0, position: 1, pw: 0,
    inp: {u: false, d: false, st: 0},
    wallHitT: 0, nearMissT: 0, stuckT: 0,
    skill: 1, personality: 0, laneF: 0, laneV: 0, vary: 1, varyT: 0,
  });
  if (npc) Object.assign(c, npc);
  seatCar(L, c, idx);
  L.cars.set(c.id, c);
  L.alive.add(c.id);
  return c;
}

const NPC_NAMES = [
  'GHOST-7','VIPER-X','NOVA-3','RAZOR-9','BLAZE-2','STORM-6','NEXUS-4','FLUX-8','KIRA-1','VOLT-5',
  'ZERO-0','APEX-11','VOID-13','NEON-7','SURGE-2','GRID-5','PRISM-8','PHASE-3','ECHO-6','RIFT-4',
  'CIPHER-9','SPARK-1','GLITCH-7','PULSE-0','AXON-5','DRIFT-3','TRACE-8','FUSE-2','CORE-6','APEX-X'
];
const NPC_STATS = {accel: 30, top: 48, hand: 2.6, hp: 100};

function npcTraits() {
  const roll = Math.random();
  return {
    skill: roll < 0.3 ? 0 : roll < 0.8 ? 1 : 2,                    // rookie / regular / elite
    personality: [0,0,0,1,1,2,3][Math.floor(Math.random() * 7)],    // normal / aggressive / defensive / erratic
    laneF: (Math.random() - 0.5) * 0.5,
    laneV: (Math.random() - 0.5) * 0.4,
  };
}

function fillNPCs(L) {
  const have = L.players.size, fill = L.maxPlayers - have;
  const vhList = ['civic_type_r','gr86','skyline_r34','mustang_gt500','porsche_gt3','lambo_huracan','ferrari_la','tacoma','f1_mclaren','f1_mercedes','f1_redbull','f1_ferrari','f1_aston'];
  for (let i = 0; i < fill; i++) {
    const idx = have + i;
    const vh = vhList[Math.floor(Math.random() * vhList.length)];
    const car = mkCar(L, null, vh, idx, null, npcTraits());
    car.name = NPC_NAMES[idx % NPC_NAMES.length];
    car.vs = {...NPC_STATS}; car.hp = car.maxHp = 100;
  }
}

// ── TRACK CHANGES ────────────────────────────────────────────────────
// Rebuilds the track after fn() mutates it, carrying every car and object along with the road.
function retrack(L, fn) {
  const old = L.tr, keep = [], o = {};
  for (const c of L.cars.values()) {
    if (c.eliminated) continue;
    CT.sample(old, c.x, c.y, c.z, c.wi, o);
    keep.push([c, (o.i + o.t) / old.N, o.lat, c.angle - o.ang, c.y - o.cy]);
  }
  fn();
  L.tr = CT.buildTrack(trackState(L));
  const tr = L.tr, lim = L.w / 2 - 2;
  for (const [c, f, lat, rel, dy] of keep) {
    const p = CT.placeAt(tr, f, clamp(lat, -lim, lim));
    c.x = p.x; c.z = p.z; c.angle = p.angle + rel; c.wi = p.i; c.pw = p.i; c.gy = null;
    if (tr.mode === 'plane') { c.y = p.cy + clamp(dy, -lim, lim); c.onGround = false; }
    else if (old.mode === 'plane') { c.y = p.y + 6; c.vy = 0; c.onGround = false; c.pit = 0; }
    else c.y = c.onGround ? p.y : Math.max(p.y, p.cy + dy);
  }
  placeObjects(L);
  io.to(L.id).emit('track', {st: trackState(L), finishF: L.finishF});
}

function objPos(L, e) {
  const p = CT.placeAt(L.tr, e.f, e.lat || 0);
  e.x = p.x; e.z = p.z;
  e.y = L.tr.mode === 'plane' ? p.cy + (e.dv || 0) : p.y;
}

function placeObjects(L) {
  const lim = L.w / 2 - 2.5;
  for (const list of [L.zones, L.obstacles, L.powerups, L.laserGates]) {
    for (const e of list) { if (e.lat) e.lat = clamp(e.lat, -lim, lim); objPos(L, e); }
  }
  L.tr.nramps = CT.zoneRamps(L.tr, L.zones);
}

function near(L, car, e, r) {
  const dx = car.x - e.x, dz = car.z - e.z, dy = car.y - e.y;
  if (L.tr.mode === 'plane') return dx*dx + dz*dz + dy*dy < r*r;
  return dx*dx + dz*dz < r*r && Math.abs(dy) < 5;
}

// ── NPC DRIVER ───────────────────────────────────────────────────────
function npcInput(car, L, dt) {
  const tr = L.tr, N = tr.N, skill = car.skill, pers = car.personality, now = Date.now();
  const inp = car.inp, wi = car.wi < 0 ? 0 : car.wi;
  const look = 3 + skill + Math.floor(Math.abs(car.speed) / 16);
  const ti = (wi + look) % N;
  const lane = car.laneF * L.w;
  const tgx = tr.px[ti] + tr.tz[ti] * lane, tgz = tr.pz[ti] - tr.tx[ti] * lane;
  let steer = Math.atan2(tgx - car.x, tgz - car.z);

  // Powerup seeking
  if (!car._puCheck || now - car._puCheck > 300 - skill * 80) {
    car._puCheck = now; car._targetPU = null;
    let bestD = 30 + skill * 20;
    for (const pu of L.powerups) {
      if (!pu.active) continue;
      if (pu.type !== 'boost' && pu.type !== 'repair' && pu.type !== 'shield') continue;
      const pd = Math.hypot(pu.x - car.x, pu.z - car.z);
      if (pd < bestD && Math.abs(pu.y - car.y) < 10) { bestD = pd; car._targetPU = pu; }
    }
  }
  const pu = car._targetPU;
  if (pu && pu.active) {
    const pdx = pu.x - car.x, pdz = pu.z - car.z;
    if (Math.hypot(pdx, pdz) < 35) {
      const puDa = wrap(Math.atan2(pdx, pdz) - steer);
      steer += puDa * (skill === 2 ? 0.55 : skill === 1 ? 0.25 : 0.08);
      if (skill === 0 && Math.random() < 0.35) steer -= puDa * 0.5;
    } else car._targetPU = null;
  }

  // Hazard zone avoidance
  for (const z of L.zones) {
    if (z.t !== 'spike' && z.t !== 'shock' && z.t !== 'oil') continue;
    const zd = Math.hypot(car.x - z.x, car.z - z.z);
    if (z.t === 'spike' && tr.mode === 'plane') { if (skill >= 1 && zd < 80) { car.laneV *= 0.96; car.laneF *= 0.96; } continue; }
    if (z.t === 'spike' && tr.mode === 'car' && skill >= 1 && zd < 60 && zd > z.r * 0.6 && Math.abs(car.y - z.y) < 8) {
      steer += wrap(Math.atan2(z.x - car.x, z.z - car.z) - steer) * (skill === 2 ? 0.8 : 0.5);
      continue;
    }
    if (zd < z.r + (skill === 2 ? 14 : skill === 1 ? 7 : 2) && Math.abs(car.y - z.y) < 8) {
      const avoidDa = wrap(Math.atan2(car.x - z.x, car.z - z.z) - steer);
      const str = skill === 2 ? 0.7 : skill === 1 ? 0.35 : 0.12;
      steer += avoidDa * str;
      if (skill === 0 && Math.random() < 0.45) steer -= avoidDa * str * 0.9;
    }
  }

  // Obstacle + barrier avoidance
  const avoidR = 18 + skill * 4;
  for (const list of [L.obstacles, L.movingBarriers]) {
    for (const ob of list) {
      const od = Math.hypot(car.x - ob.x, car.z - ob.z);
      if (od < avoidR && Math.abs(car.y - ob.y) < 8) {
        const obDa = wrap(Math.atan2(car.x - ob.x, car.z - ob.z) - steer);
        steer += obDa * (avoidR - od) / avoidR * (skill === 2 ? 0.9 : skill === 1 ? 0.5 : 0.2);
      }
    }
  }

  // Don't rear-end the car ahead
  for (const other of L.cars.values()) {
    if (other.id === car.id || other.eliminated) continue;
    const cdx = other.x - car.x, cdz = other.z - car.z, cd = Math.hypot(cdx, cdz);
    if (cd < 8 && cd > 0 && Math.abs(other.y - car.y) < 3 && Math.sin(car.angle) * cdx + Math.cos(car.angle) * cdz > 0)
      steer += (car.laneF > 0 ? 1 : -1) * 0.25;
  }

  const da = wrap(steer - car.angle);
  let st = clamp(da * 2.4, -1, 1);
  if (pers === 3) st = clamp(st + (Math.random() - 0.5) * 0.8, -1, 1);
  if ((skill === 0 || pers === 3) && Math.random() < 0.08 * dt) car.angle += (Math.random() - 0.5) * 1.2;
  if (pers === 3 && Math.random() < 0.04 * dt) car.speed *= Math.random() < 0.5 ? 0.3 : 1.4;
  if (pers === 1 && car.boostT <= 0 && Math.random() < 0.02 * dt) car.boostT = C.BOOST_DUR;

  if (now > car.varyT) { car.vary = 0.94 + Math.random() * (skill === 0 ? 0.14 : 0.08); car.varyT = now + 2000; }
  const sharp = Math.abs(wrap(tr.ang[(wi + look + 4) % N] - tr.ang[wi]));
  const base = [0.72, 0.82, 0.9][skill] + (pers === 1 ? 0.05 : pers === 2 ? -0.05 : 0);
  const corner = sharp > 0.5 ? (pers === 1 ? 0.85 : pers === 2 ? 0.62 : 0.74) : 1;
  car.k = base * corner * car.vary;

  inp.st = st;
  if (tr.mode === 'plane') {
    const dy = tr.py[ti] + car.laneV * L.w - car.y;
    inp.u = dy > 2; inp.d = dy < -2;
  } else {
    inp.u = true;
    inp.d = car.speed > car.vs.top * car.k * (car.boostT > 0 ? 1.5 : 1) + 6;
    // Unstick
    if (Math.abs(car.speed) < 4) car.stuckT += dt; else car.stuckT = 0;
    if (car.stuckT > 2.5) { recenter(L, car, 0); car.stuckT = 0; }
  }
}

function respawn(L, car) {
  const tr = L.tr;
  let f = car.safeF;
  if (tr.mode === 'plane') { const o = CT.sample(tr, car.x, car.y, car.z, -1, {}); f = Math.max(8, Math.floor(o.i / 8) * 8) / tr.N; }
  else if (f === undefined) { const o = CT.sample(tr, car.x, car.y, car.z, -1, {}); f = (o.i + o.t) / tr.N; }
  const p = CT.placeAt(tr, f, 0);
  car.x = p.x; car.z = p.z; car.y = p.y + (tr.mode === 'car' ? 0.5 : 0); car.angle = p.angle;
  car.vy = 0; car.speed = 0; car.pit = 0; car.gy = null; car.fell = false; car.off = false; car.wi = p.i; car.lat = 0;
  car.respT = 1000;
  if (L.alive.size > 1) car.hp -= 10;
  io.to(L.id).emit('respawn', {id: car.id, x: r2(car.x), y: r2(car.y), z: r2(car.z), a: r2(car.angle)});
}

function recenter(L, car, dmg) {
  const tr = L.tr, o = CT.sample(tr, car.x, car.y, car.z, car.wi, {});
  const p = CT.placeAt(tr, (o.i + o.t) / tr.N, 0);
  car.x = p.x; car.z = p.z; car.y = p.y + (tr.mode === 'car' ? 0.5 : 0); car.angle = p.angle;
  car.vy = 0; car.speed = 0; car.gy = null; car.fell = false; car.wi = p.i;
  if (dmg && L.alive.size > 1) car.hp -= dmg;
}

// ── WORLD CHECKS ─────────────────────────────────────────────────────
function checkWalls(L, car) {
  const now = Date.now();
  if (car.wallHit) {
    if (L.alive.size > 1 && now - car.wallHitT > 500) { car.hp -= 1; car.wallHitT = now; }
    return;
  }
  if (L.noWalls || L.tr.mode === 'plane') return;
  const lim = L.w / 2 - 1.3, a = Math.abs(car.lat);
  if (a > lim - 2 && a < lim - 0.05 && car.speed > 25 && now - car.nearMissT > 2000 && now - car.wallHitT > 1200) {
    car.boostT = Math.max(car.boostT, 1000);
    car.nearMissT = now;
    io.to(L.id).emit('near_miss', {id: car.id});
  }
}

function checkZones(L, car, dt) {
  for (const z of L.zones) {
    if (L.tr.mode === 'plane' && z.t === 'spike') {
      if (z._tr !== L.tr) { const p = CT.placeAt(L.tr, z.f, 0), l = Math.hypot(p.tx, p.sl, p.tz) || 1; z.T = [p.tx / l, p.sl / l, p.tz / l]; z._tr = L.tr; }
      const dx = car.x - z.x, dy = car.y - z.y, dz = car.z - z.z, along = dx * z.T[0] + dy * z.T[1] + dz * z.T[2];
      if (Math.abs(along) > 3.5) continue;
      const rad = Math.sqrt(Math.max(0, dx * dx + dy * dy + dz * dz - along * along)), R = L.w / 2, hole = R * (z.mega ? 0.42 : 0.5);
      const now = Date.now();
      if (rad > hole - 2.5 && rad < R + 6 && now - (car.ringT || 0) > 1200) {
        car.ringT = now;
        if (car.shieldOn) { car.shieldOn = false; io.to(L.id).emit('car_hit', {id: car.id, type: 'shield_block'}); }
        else { if (L.alive.size > 1) car.hp -= z.mega ? 45 : 28; car.speed *= 0.7; io.to(L.id).emit('car_hit', {id: car.id, type: 'spikehit'}); }
      }
      continue;
    }
    if (!near(L, car, z, z.r)) continue;
    if (L.tr.mode !== 'plane' && !car.onGround && z.t !== 'boost') continue;
    if (z.t === 'boost') car.boostT = C.BOOST_DUR;
    if ((z.t === 'spike' || z.t === 'shock') && L.alive.size > 1) car.hp -= (z.mega ? 55 : 30) * dt;
    if (z.t === 'oil') car.oilT = C.OIL_DUR;
    if (z.t === 'freeze') car.slowT = Math.max(car.slowT, C.OIL_DUR + 2000);
  }
}

function checkObstacles(L, car, dt) {
  const lastAlive = L.alive.size <= 1 || car.jugT > 0;
  if (car.ghostT > 0) return;
  for (const ob of L.obstacles) {
    const d = Math.hypot(car.x - ob.x, car.z - ob.z);
    if (d < CT.CAR_R + 1.5 && Math.abs(car.y - ob.y) < 3) {
      if (!lastAlive) car.hp -= 15 * dt;
      const nx = (car.x - ob.x) / (d || 1), nz = (car.z - ob.z) / (d || 1);
      car.x += nx * 2; car.z += nz * 2;
      car.speed *= 0.4;
    }
  }
  for (const b of L.movingBarriers) {
    const d = Math.hypot(car.x - b.x, car.z - b.z);
    if (d < CT.CAR_R + b.r && Math.abs(car.y - b.y) < 5) {
      if (!lastAlive) car.hp -= 20 * dt;
      const nx = (car.x - b.x) / (d || 1), nz = (car.z - b.z) / (d || 1);
      car.x += nx * 3; car.z += nz * 3;
      car.speed *= 0.35;
    }
  }
}

function checkCarCollisions(L) {
  if (L.ghostMode) return;
  const alive = [...L.alive].map(id => L.cars.get(id)).filter(c => c && !c.eliminated);
  for (let i = 0; i < alive.length; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i], b = alive[j];
      if (Math.abs(a.y - b.y) > 2.2) continue;
      if (a.ghostT > 0 || b.ghostT > 0) continue;
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      if (d < CT.CAR_R * 2 && d > 0) {
        const nx = dx / d, nz = dz / d, ov = CT.CAR_R * 2 - d;
        a.x -= nx * ov * 0.5; a.z -= nz * ov * 0.5;
        b.x += nx * ov * 0.5; b.z += nz * ov * 0.5;
        const relSpd = (a.speed - b.speed) * 0.4;
        if (a.jugT > 0 !== b.jugT > 0) {
          const [j, v] = a.jugT > 0 ? [a, b] : [b, a];
          if (L.alive.size > 1 && !v.shieldOn) v.hp -= 6;
          v.spinT = Math.max(v.spinT, 600);
          j.speed *= 0.97;
        }
        a.speed -= relSpd; b.speed += relSpd;
        a.angle += (Math.random() - 0.5) * 0.18;
        b.angle += (Math.random() - 0.5) * 0.18;
        if (Math.abs(relSpd) > 3) io.to(L.id).emit('bump', {x: r2((a.x + b.x) / 2), y: r2(a.y + 0.8), z: r2((a.z + b.z) / 2)});
      }
    }
  }
}

function aheadCar(L, car, n) {
  let best = null;
  for (const o of L.cars.values()) {
    if (o.id === car.id || o.eliminated) continue;
    if (o.position === car.position - n) best = o;
  }
  return best;
}

function hitCar(L, o, type, fn) {
  if (o.shieldOn) { o.shieldOn = false; io.to(L.id).emit('car_hit', {id: o.id, type: 'shield_block'}); return false; }
  fn(o);
  io.to(L.id).emit('car_hit', {id: o.id, type});
  return true;
}

function warpCar(L, car, f, lat) {
  const p = CT.placeAt(L.tr, f, lat);
  car.x = p.x; car.z = p.z; car.y = p.y; car.wi = p.i; car.pw = p.i; car.gy = null; car.vy = 0; car.angle = p.angle; car.onGround = L.tr.mode !== 'plane';
  if (L.tr.mode === 'plane') car.y = p.cy;
  io.to(L.id).emit('warp', {id: car.id, x: r2(car.x), y: r2(car.y), z: r2(car.z), a: r2(car.angle)});
}

function trackF(L, car) {
  const o = CT.sample(L.tr, car.x, car.y, car.z, car.wi, {});
  return {f: (o.i + o.t) / L.tr.N, lat: o.lat};
}

function usePowerup(L, car, type) {
  const others = () => [...L.cars.values()].filter(o => o.id !== car.id && !o.eliminated);
  switch (type) {
    case 'ghost':    car.ghostT = 5000; break;
    case 'spring':   car.vy = 24; car.onGround = false; car.gy = null; io.to(L.id).emit('car_hit', {id: car.id, type: 'spring'}); break;
    case 'juggernaut': car.jugT = 6000; car.shieldOn = false; break;
    case 'warp': {
      const q = trackF(L, car);
      warpCar(L, car, q.f + 70 / L.tr.L, clamp(q.lat, -L.w / 2 + 3, L.w / 2 - 3));
      car.boostT = Math.max(car.boostT, 1200);
      break;
    }
    case 'swap': {
      const o = aheadCar(L, car, 1);
      if (!o) { car.boostT = Math.max(car.boostT, 2500); break; }
      if (o.shieldOn) { o.shieldOn = false; io.to(L.id).emit('car_hit', {id: o.id, type: 'shield_block'}); break; }
      const a = trackF(L, car), b = trackF(L, o), sa = car.speed, sb = o.speed;
      const lim = L.w / 2 - 3;
      warpCar(L, car, b.f, clamp(b.lat, -lim, lim)); warpCar(L, o, a.f, clamp(a.lat, -lim, lim));
      car.speed = sb; o.speed = sa;
      io.to(L.id).emit('car_hit', {id: o.id, type: 'swap'});
      break;
    }
    case 'cryo': {
      const o = aheadCar(L, car, 1) || aheadCar(L, car, 2);
      if (o) hitCar(L, o, 'cryo', t => { t.slowT = 3500; t.speed *= 0.25; });
      break;
    }
    case 'lightning': {
      const lead = [...L.cars.values()].filter(o => !o.eliminated && o.id !== car.id).sort((a, b) => a.position - b.position)[0];
      if (lead) hitCar(L, lead, 'lightning', t => { if (L.alive.size > 1) t.hp -= 22; t.spinT = 1400; t.speed *= 0.5; });
      break;
    }
    case 'leech': {
      let got = 0;
      for (const o of others()) {
        if (Math.hypot(o.x - car.x, o.z - car.z) > 45 || Math.abs(o.y - car.y) > 12) continue;
        hitCar(L, o, 'leech', t => { const d = Math.min(12, t.hp - 1); if (d > 0 && L.alive.size > 1) { t.hp -= d; got += d; } });
      }
      car.hp = Math.min(car.maxHp, car.hp + got + 10);
      io.to(L.id).emit('car_hit', {id: car.id, type: 'leech_gain'});
      break;
    }
    case 'scrambler': {
      let best = null, bd = 90;
      for (const o of others()) { const d = Math.hypot(o.x - car.x, o.z - car.z); if (d < bd) { bd = d; best = o; } }
      if (best) hitCar(L, best, 'scramble', t => { t.reverseT = 3500; });
      break;
    }
  }
}

function addItem(car, k) { car.inv[k] = Math.min(5, car.inv[k] + 1); }

function useItem(L, car, k) {
  if (!car.inv || !(car.inv[k] > 0)) return;
  if (k === 'shield' && car.shieldOn) return;
  car.inv[k]--;
  if (k === 'boost') car.boostT = Math.max(car.boostT, C.BOOST_DUR * 1.5);
  else if (k === 'shield') { car.shieldOn = true; io.to(L.id).emit('car_hit', {id: car.id, type: 'shield_on'}); }
  else if (k === 'missile') fireMissile(L, car);
  else if (k === 'spring') usePowerup(L, car, 'spring');
  else if (k === 'emp') fireEMP(L, car);
}

function checkPowerups(L, car) {
  for (const pu of L.powerups) {
    if (!pu.active || !near(L, car, pu, 5)) continue;
    pu.active = false;
    io.to(L.id).emit('powerup_taken', {id: pu.id, carId: car.id, type: pu.type});
    switch (pu.type) {
      case 'boost':   if (car.isNPC) car.boostT = C.BOOST_DUR * 1.5; else addItem(car, 'boost'); break;
      case 'repair':  car.hp = Math.min(car.maxHp, car.hp + 35); break;
      case 'shield':  if (car.isNPC) car.shieldOn = true; else addItem(car, 'shield'); break;
      case 'emp': case 'missile': {
        addItem(car, pu.type);
        if (car.isNPC) { const k = pu.type; later(L, () => { if (!car.eliminated) useItem(L, car, k); }, 900 + Math.random() * 2500); }
        break;
      }
      case 'spring':  if (car.isNPC) usePowerup(L, car, 'spring'); else addItem(car, 'spring'); break;
      case 'slow':    car.slowT = 3000; car.speed *= 0.3; break;
      case 'spin':    car.spinT = 2000; break;
      case 'reverse': car.reverseT = 3500; break;
      case 'spike_p': if (L.alive.size > 1) car.hp -= 25; break;
      case 'oil_p':   car.oilT = C.OIL_DUR * 1.5; break;
      default: usePowerup(L, car, pu.type);
    }
    const gen = L.puGen;
    later(L, () => { if (L.puGen !== gen) return; pu.active = true; io.to(L.id).emit('powerup_respawn', {id: pu.id}); }, 9000);
  }
}

function spawnPowerups(L) {
  const count = 14;
  const bag = ['boost','boost','repair','repair','shield','missile','emp','spike_p','oil_p',
    'ghost','spring','juggernaut','warp','swap','cryo','lightning','leech','scrambler'];
  const types = bag.slice().sort(() => Math.random() - 0.5).slice(0, count);
  while (types.length < count) types.push(bag[Math.floor(Math.random() * bag.length)]);
  L.powerups = [];
  L.puGen = (L.puGen || 0) + 1;
  for (let i = 0; i < count; i++) {
    const pu = {id: i, f: (i + 0.5) / count, lat: (Math.random() > 0.5 ? 1 : -1) * L.w * 0.28, dv: (Math.random() - 0.5) * L.w * 0.4, type: types[i], active: true};
    objPos(L, pu);
    L.powerups.push(pu);
  }
  io.to(L.id).emit('powerups_init', {powerups: L.powerups.map(p => ({id: p.id, f: p.f, lat: r2(p.lat), dv: r2(p.dv), type: p.type, active: p.active}))});
}

function calcPositions(L) {
  const N = L.tr.N;
  for (const c of L.cars.values()) {
    if (c.eliminated) continue;
    const w = c.wi < 0 ? 0 : c.wi;
    if (c.pw > N * 0.75 && w < N * 0.25) c.laps++;
    else if (c.pw < N * 0.25 && w > N * 0.75) c.laps--;
    c.pw = w;
    c.progress = c.laps * N + w;

    c.slip = false;
    for (const other of L.cars.values()) {
      if (other.id === c.id || other.eliminated) continue;
      const dx = other.x - c.x, dz = other.z - c.z, d = Math.hypot(dx, dz);
      if (d < C.SLIPSTREAM_DIST && d > 5 && Math.abs(other.y - c.y) < 4) {
        if ((Math.sin(c.angle) * dx + Math.cos(c.angle) * dz) / d > 0.95) { c.slip = true; break; }
      }
    }
  }
  const alive = [...L.cars.values()].filter(c => !c.eliminated).sort((a, b) => b.progress - a.progress);
  alive.forEach((c, i) => c.position = i + 1);
}

function elimCar(L, carId, reason) {
  const car = L.cars.get(carId);
  if (!car || car.eliminated) return;
  car.eliminated = true;
  car.elimReason = reason;
  L.alive.delete(carId);
  io.to(L.id).emit('eliminated', {id: carId, reason});
}

function barrierPos(L, b, now) {
  const p = CT.placeAt(L.tr, b.f, Math.sin((now - b.startTime) / 1000 * b.freq + b.initPhase) * b.ampF * L.w);
  b.x = p.x; b.z = p.z; b.y = L.tr.mode === 'plane' ? p.cy : p.y;
}

function tickLobby(L) {
  const now = Date.now(), dtAll = Math.min((now - L.lastTick) / 1000, 0.1);
  L.lastTick = now;
  if (L.state !== 'racing' || L.paused) return;
  const tr = L.tr;

  if (L.noWalls) { L.noWallsT -= dtAll * 1000; if (L.noWallsT <= 0) L.noWalls = false; }
  if (L.ghostMode) { L.ghostModeT -= dtAll * 1000; if (L.ghostModeT <= 0) L.ghostMode = false; }
  if (L.lowGravT > 0) L.lowGravT -= dtAll * 1000;
  if (L.doubleSpeedT > 0) L.doubleSpeedT -= dtAll * 1000;

  for (const b of L.movingBarriers) barrierPos(L, b, now);

  // Laser gates
  for (const g of L.laserGates) {
    if (Math.floor((now - g.startTime) / g.cycleDur) % 2 !== 0 || L.alive.size <= 1) continue;
    const p = CT.placeAt(tr, g.f, 0);
    for (const car of L.cars.values()) {
      if (car.eliminated || car.shieldOn) continue;
      const cx = car.x - p.x, cz = car.z - p.z;
      const along = cx * p.tx + cz * p.tz, perp = Math.abs(cx * p.tz - cz * p.tx);
      const dy = car.y - (tr.mode === 'plane' ? p.cy : p.y);
      const inY = tr.mode === 'plane' ? Math.abs(dy) < L.w * 0.45 : dy > -2 && dy < 6;
      if (Math.abs(along) < 4 && perp < L.w * 0.48 && inY) car.hp -= 110 * dtAll;
    }
  }

  const dt = dtAll / C.SUBSTEPS;
  for (let sub = 0; sub < C.SUBSTEPS; sub++) {
    L.t += dt;
    const env = {noWalls: L.noWalls, lowG: L.lowGravT > 0, dbl: L.doubleSpeedT > 0, t: L.t};
    for (const car of L.cars.values()) {
      if (car.eliminated) continue;
      if (car.ghostT > 0) car.ghostT -= dt * 1000;
      if (car.jugT > 0) car.jugT -= dt * 1000;
      if (!car.isNPC && car.inv.boost === 0) { car.rc = (car.rc || 0) + dt * 1000; if (car.rc >= 10000) { car.rc = 0; car.inv.boost = 1; } } else car.rc = 0;
      if (car.isNPC) npcInput(car, L, dt); else car.k = 1;
      if (car.jugT > 0) car.k *= 1.12;
      if (car.respT > 0) { car.respT -= dt * 1000; continue; }
      car.noBreak = car.isNPC;
      CT.stepCar(car, car.inp, dt, tr, env);
      if (car.broke) {
        const k = car.broke - 1; car.broke = 0;
        if (L.alive.size > 1 && !car.shieldOn) car.hp -= 12;
        io.to(L.id).emit('rail', {i: k >> 1, sg: k & 1 ? 1 : -1, id: car.id});
      }
      if (tr.mode !== 'plane' && car.onGround && !car.off && Math.abs(car.lat) < L.w / 2 - 2) car.safeF = (car.wi + 0.5) / tr.N;
      if (car.fell) { respawn(L, car); continue; }
      checkWalls(L, car);
      checkZones(L, car, dt);
      checkObstacles(L, car, dt);
      checkPowerups(L, car);
    }
    checkCarCollisions(L);
  }

  for (const car of L.cars.values()) {
    if (car.eliminated) continue;
    if (car.hp <= 0) { car.hp = 0; elimCar(L, car.id, 'wrecked'); continue; }
    if (L.finishF !== null) {
      const fp = CT.placeAt(tr, L.finishF, 0);
      if (Math.hypot(car.x - fp.x, car.z - fp.z) < L.w * 0.6 && Math.abs(car.y - (tr.mode === 'plane' ? fp.cy : fp.y)) < Math.max(8, L.w * 0.5)) { endRace(L, car); return; }
    }
  }
  calcPositions(L);

  if (L.alive.size === 1 && L.finishF === null && !L.voteOn) startFinishVote(L);
  if (L.alive.size === 0) { endRace(L, null); return; }

  io.to(L.id).emit('tick', {
    t: r2(L.t), alive: L.alive.size,
    nw: L.noWalls, lg: L.lowGravT > 0, ds: L.doubleSpeedT > 0, gh: L.ghostMode,
    cars: [...L.cars.values()].filter(c => !c.eliminated).map(c => ({
      id: c.id, x: r2(c.x), y: r2(c.y), z: r2(c.z), vy: r2(c.vy), a: r2(c.angle), s: r2(c.speed), pit: r2(c.pit),
      hp: Math.round(c.hp * 10) / 10, g: c.onGround ? 1 : 0, p: c.position, st: r2(c.inp.st),
      bT: Math.round(c.boostT), oT: Math.round(c.oilT), sT: Math.round(c.slowT), spT: Math.round(c.spinT), rT: Math.round(c.reverseT),
      dT: Math.round(c.driftT), dS: c.driftSide, gT: c.ghostT > 0 ? 1 : 0, jT: c.jugT > 0 ? 1 : 0, sh: c.shieldOn ? 1 : 0, mi: c.inv.missile ? 1 : 0, em: c.inv.emp ? 1 : 0, sl: c.slip ? 1 : 0,
      iv: c.isNPC ? undefined : [c.inv.boost, c.inv.shield, c.inv.missile, c.inv.spring, c.inv.emp, Math.round((c.rc || 0) / 100)],
    })),
  });
}

function fireMissile(L, car) {
  let target = null, minDist = Infinity;
  for (const other of L.cars.values()) {
    if (other.id === car.id || other.eliminated) continue;
    const dx = other.x - car.x, dz = other.z - car.z, d = Math.hypot(dx, dz) || 1;
    const dot = (Math.sin(car.angle) * dx + Math.cos(car.angle) * dz) / d;
    if (dot > 0.5 && d < 150 && d < minDist) { minDist = d; target = other; }
  }
  const eta = target ? minDist / C.MISSILE_SPD * 1000 : 1200;
  io.to(L.id).emit('missile_fired', {fromId: car.id, targetId: target ? target.id : null, eta});
  if (target) {
    later(L, () => {
      if (target.eliminated) return;
      if (target.shieldOn) {
        target.shieldOn = false;
        io.to(L.id).emit('car_hit', {id: target.id, type: 'shield_block'});
      } else {
        if (L.alive.size > 1) target.hp -= 25;
        target.speed *= 0.3;
        target.spinT = 1500;
        io.to(L.id).emit('car_hit', {id: target.id, type: 'missile'});
      }
    }, eta);
  }
}

function fireEMP(L, car) {
  io.to(L.id).emit('emp_fired', {id: car.id});
  for (const other of L.cars.values()) {
    if (other.id === car.id || other.eliminated) continue;
    const d = Math.hypot(other.x - car.x, other.y - car.y, other.z - car.z);
    if (d < C.EMP_RADIUS) {
      if (!other.shieldOn) {
        other.speed *= 0.1;
        other.slowT = 3000;
        other.boostT = 0;
        io.to(L.id).emit('car_hit', {id: other.id, type: 'emp'});
      } else {
        other.shieldOn = false;
        io.to(L.id).emit('car_hit', {id: other.id, type: 'shield_block'});
      }
    }
  }
}

// ── VOTING ────────────────────────────────────────────────────────────
function startVote(L) {
  if (L.state !== 'racing' || L.voteOn) return;
  L.voteOn = true;
  L.voteOpts = pick3(VOTE_POOL);
  L.votes.clear();
  io.to(L.id).emit('vote_start', {opts: L.voteOpts, dur: C.VOTE_DURATION, final: false});
  L.voteT = later(L, () => resolveVote(L), C.VOTE_DURATION);
}

function startFinishVote(L) {
  if (L.voteOn) return;
  L.voteOn = true;
  L.voteOpts = [{...FINISH_OPT}, {...FINISH_OPT}, {...FINISH_OPT}];
  L.votes.clear();
  io.to(L.id).emit('vote_start', {opts: L.voteOpts, dur: C.VOTE_DURATION, final: true});
  L.voteT = later(L, () => resolveVote(L), C.VOTE_DURATION);
}

function resolveVote(L) {
  if (L.state !== 'racing') return;
  L.voteOn = false;
  calcPositions(L);

  const counts = {}, posList = {};
  for (const o of L.voteOpts) { counts[o.id] = 0; posList[o.id] = []; }

  const sidToPos = {};
  for (const car of L.cars.values())
    if (!car.eliminated && car.socketId) sidToPos[car.socketId] = car.position || 999;

  // NPC votes: each AI weighs the options by what they would do to itself
  const alive = [...L.cars.values()].filter(c => !c.eliminated);
  const nAlive = alive.length;
  for (const car of L.cars.values()) {
    if (!car.isNPC || car.eliminated) continue;
    const opts = L.voteOpts;
    if (!opts.length) continue;
    const pos = car.position || nAlive, hp = car.hp !== undefined ? car.hp : 100;
    const last = pos >= nAlive, bottom = pos > nAlive - 2, bottom3 = pos > nAlive - 3;
    const lead = pos === 1, weak = hp <= 30, hurt = hp <= 60;
    const dmgAll = o => o.id === 'damage_all' || o.id === 'mega_storm' || o.id === 'laser_gates' || o.id === 'lightning_field';
    const hazard = o => ['spike','double_spike','mega_spike','shock_zone','full_hazard','boost_spike','storm','mega_storm','laser_gates','lightning_field','random_chaos','gravity','spin_out','maze_walls','moving_barriers','debris','fog_event','reverse_controls'].includes(o.id);
    const score = o => {
      let w = 1 + Math.random() * 0.6;
      const id = o.id;
      if (id === 'elim_last' && last) w -= 9;
      if (id === 'elim_bottom2' && bottom) w -= 9;
      if (id === 'elim_bottom3' && bottom3) w -= 9;
      if (id === 'elim_random') w -= weak ? 4 : (last ? 2 : 0) - (lead ? 0 : 0);
      if (id.startsWith('elim') && !(id === 'elim_last' && last) && !(id === 'elim_bottom2' && bottom) && !(id === 'elim_bottom3' && bottom3) && id !== 'elim_random') w += lead ? 2.5 : (pos <= nAlive / 2 ? 1.5 : 0.3);
      if (id === 'elim_random' && lead) w += 0.5;
      if (dmgAll(o)) w += weak ? -9 : hurt ? -3 : lead ? 0.6 : 0;
      if (id === 'damage_all' && (weak || hp < 45)) w -= 6;
      if (hazard(o) && weak) w -= 4;
      if (hazard(o) && hurt) w -= 1.5;
      if (id === 'repair_all' || id === 'boost_rain') w += weak ? 6 : hurt ? 3 : last ? 1.5 : 0;
      if (id === 'repair_all' && hp > 90) w -= 0.5;
      if (['boost','double_boost','flash_boost','speed_surge','wave_boost','double_speed','oil_boost','speed_all'].includes(id)) w += last ? 2 : lead ? -0.3 : 0.6;
      if (['slow_field','freeze_all','freeze_zone','slow_npc'].includes(id)) w += lead ? 1.5 : last ? -1.5 : 0;
      if (id === 'turbo_npc' && !lead) w += 0.8;
      if (['oil','triple_oil'].includes(id)) w += lead ? 1 : last ? -1 : 0;
      if (['widen','mega_widen','expand_track'].includes(id)) w += weak || hurt ? 1.2 : 0;
      if (['narrow','mega_narrow','compress'].includes(id)) w += weak ? -2 : 0;
      if (id === 'ghost_mode') w += weak ? 2 : 0;
      if (id === 'no_walls') w += weak ? -1.5 : 0;
      if (car.personality === 1) w += (id.startsWith('elim') || hazard(o)) && !weak ? 1.2 : 0;
      else if (car.personality === 2) w += (id === 'repair_all' || id === 'boost' || id === 'widen') ? 1.5 : 0;
      else if (car.personality === 3) w += Math.random() * 1.5;
      return w;
    };
    let pick = opts[0], best = -Infinity;
    for (const o of opts) { const sc = score(o); if (sc > best) { best = sc; pick = o; } }
    if (pick && counts[pick.id] !== undefined) counts[pick.id]++;
  }

  for (const [sid, v] of L.votes) {
    if (counts[v] !== undefined) {
      counts[v]++;
      if (sidToPos[sid] !== undefined) posList[v].push(sidToPos[sid]);
    }
  }

  let winner = L.voteOpts[0].id, mxCount = -1, mnAvg = Infinity;
  for (const opt of L.voteOpts) {
    const c = counts[opt.id], arr = posList[opt.id];
    const avg = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 999;
    if (c > mxCount || (c === mxCount && avg < mnAvg)) { winner = opt.id; mxCount = c; mnAvg = avg; }
  }

  io.to(L.id).emit('vote_result', {winner, counts});
  applyEffect(L, winner);
  if (L.state === 'racing') L.nextVoteT = later(L, () => startVote(L), C.VOTE_INTERVAL);
}

function setWidth(L, w) { retrack(L, () => { L.w = w; }); }
function fx(L, type, extra) { io.to(L.id).emit('storm', Object.assign({type}, extra)); }
function eachAlive(L, fn) { for (const c of L.cars.values()) if (!c.eliminated) fn(c); }
function sortedAlive(L) {
  calcPositions(L);
  return [...L.alive].map(id => L.cars.get(id)).filter(c => c && !c.eliminated).sort((a, b) => a.position - b.position);
}
function elimBottom(L, n) {
  const s = sortedAlive(L);
  for (let i = 0; i < Math.min(n, s.length - 1); i++) elimCar(L, s[s.length - 1 - i].id, 'vote');
}

function applyEffect(L, id) {
  const cp = L.cp, M = cp.length;
  const car = L.tr.mode === 'car';
  const yAmp = L.tr.mode === 'boat' ? 0 : 1;
  const minY = car ? 2 : -1e9;
  const fixY = () => { for (const p of cp) if (p.y < minY) p.y = minY; };

  // Track width
  if (id === 'narrow')            setWidth(L, Math.max(10, L.w * 0.76));
  else if (id === 'widen')        setWidth(L, Math.min(44, L.w * 1.28));
  else if (id === 'mega_narrow')  setWidth(L, Math.max(8, L.w * 0.60));
  else if (id === 'mega_widen')   setWidth(L, Math.min(50, L.w * 1.50));
  else if (id === 'widen_narrow') {
    setWidth(L, Math.min(44, L.w * 1.4));
    later(L, () => { if (L.state === 'racing') setWidth(L, Math.max(12, L.w * 0.65)); }, 4000);
  }

  // Zones
  else if (id === 'boost')        addZone(L, 'boost', 22);
  else if (id === 'spike')        addZone(L, 'spike', 18);
  else if (id === 'oil')          addZone(L, 'oil', 16);
  else if (id === 'shock_zone')   addZone(L, 'shock', 20);
  else if (id === 'freeze_zone')  addZone(L, 'freeze', 18);
  else if (id === 'mega_spike')   addZone(L, 'spike', 28, true);
  else if (id === 'double_spike') { addZone(L, 'spike', 18); addZone(L, 'spike', 18); }
  else if (id === 'double_boost') { addZone(L, 'boost', 22); addZone(L, 'boost', 22); }
  else if (id === 'triple_oil')   { addZone(L, 'oil', 16); addZone(L, 'oil', 16); addZone(L, 'oil', 16); }
  else if (id === 'boost_spike')  { addZone(L, 'boost', 22); addZone(L, 'spike', 18); }
  else if (id === 'oil_boost')    { addZone(L, 'oil', 16); addZone(L, 'boost', 22); }
  else if (id === 'full_hazard')  { addZone(L, 'spike', 18); addZone(L, 'oil', 16); addDebris(L, 4); }

  // Debris
  else if (id === 'debris')     addDebris(L, 6);
  else if (id === 'maze_walls') addDebris(L, 12);

  // Track deformation — reshapes the road in all three dimensions
  else if (id === 'warp') retrack(L, () => {
    const s = Math.floor(Math.random() * M), cnt = Math.max(2, Math.round(M * 0.25));
    for (let i = 0; i < cnt; i++) { const p = cp[(s + i) % M]; p.x += (Math.random() - 0.5) * 90; p.z += (Math.random() - 0.5) * 70; p.y += (Math.random() - 0.5) * 16 * yAmp; }
    fixY();
  });
  else if (id === 'quake') retrack(L, () => {
    for (const p of cp) { p.x += (Math.random() - 0.5) * 50; p.z += (Math.random() - 0.5) * 38; p.y += (Math.random() - 0.5) * 12 * yAmp; }
    fixY();
  });
  else if (id === 'ripple') retrack(L, () => {
    const ph = Math.random() * TAU, k = Math.max(2, Math.round(M / 4));
    for (let i = 0; i < M; i++) { const wv = Math.sin(i / M * TAU * k + ph); cp[i].y += wv * 9 * yAmp; cp[i].x += wv * 10; cp[i].z += wv * 5; }
    fixY();
  });
  else if (id === 'compress') retrack(L, () => { for (const p of cp) { p.x *= 0.82; p.z *= 0.82; } });
  else if (id === 'expand_track' || id === 'extend_road') retrack(L, () => { for (const p of cp) { p.x *= 1.18; p.z *= 1.18; } });
  else if (id === 'invert') retrack(L, () => { for (const p of cp) p.x = -p.x; });
  else if (id === 'flip_dir') retrack(L, () => {
    const s = Math.floor(Math.random() * M), cnt = Math.max(3, Math.round(M * 0.35));
    const a = cp[s], b = cp[(s + cnt) % M];
    const ex = b.x - a.x, ez = b.z - a.z, l2 = ex * ex + ez * ez || 1;
    for (let i = 1; i < cnt; i++) {
      const p = cp[(s + i) % M], t = ((p.x - a.x) * ex + (p.z - a.z) * ez) / l2;
      const qx = a.x + ex * t, qz = a.z + ez * t;
      p.x = qx - (p.x - qx) * 0.6; p.z = qz - (p.z - qz) * 0.6;
    }
  });

  // Track swap
  else if (id.startsWith('new_track_')) {
    const tIdx = parseInt(id.slice(10));
    retrack(L, () => {
      const g = CT.genTrack(tIdx);
      L.type = tIdx; L.cp = g.cp; L.ramps = g.ramps; L.w = g.w;
      for (const c of L.cars.values()) { c.pit = 0; }
    });
    spawnPowerups(L);
  }

  // Physics
  else if (id === 'gravity') {
    eachAlive(L, c => { c.vy = 16 + Math.random() * 9; c.y += 0.6; c.onGround = false; c.gy = null; });
    io.to(L.id).emit('gravity', {});
  }
  else if (id === 'reverse_grav') {
    L.lowGravT = Math.max(L.lowGravT, 4500);
    eachAlive(L, c => { c.vy = 9 + Math.random() * 4; c.y += 0.6; c.onGround = false; c.gy = null; });
    io.to(L.id).emit('gravity', {reverse: true});
  }
  else if (id === 'storm')      { fx(L); eachAlive(L, c => { c.speed += (Math.random() - 0.5) * 65; }); }
  else if (id === 'mega_storm') { fx(L, undefined, {mega: true}); eachAlive(L, c => { c.speed += (Math.random() - 0.5) * 90; c.angle += (Math.random() - 0.5) * Math.PI; }); }
  else if (id === 'speed_surge' || id === 'flash_boost') { eachAlive(L, c => { c.boostT = C.BOOST_DUR; }); fx(L, 'boost'); }
  else if (id === 'slow_field') { eachAlive(L, c => { c.slowT = 3000; }); fx(L, 'slow'); }
  else if (id === 'freeze_all') { eachAlive(L, c => { c.slowT = 5000; c.speed *= 0.2; }); fx(L, 'freeze'); }
  else if (id === 'spin_out')   { eachAlive(L, c => { c.spinT = 2000; }); fx(L, 'spin'); }
  else if (id === 'boost_rain') { eachAlive(L, c => { c.boostT = C.BOOST_DUR * 2; }); fx(L, 'boost'); }
  else if (id === 'repair_all') { eachAlive(L, c => { c.hp = Math.min(c.maxHp, c.hp + 40); }); fx(L, 'repair'); }
  else if (id === 'damage_all') { eachAlive(L, c => { c.hp = Math.max(0, c.hp - 30); }); fx(L, 'damage'); }
  else if (id === 'speed_all')  { eachAlive(L, c => { c.boostT = C.BOOST_DUR; }); fx(L, 'boost'); }
  else if (id === 'turbo_npc')  { eachAlive(L, c => { if (c.isNPC) c.boostT = C.BOOST_DUR * 2; }); fx(L, 'turbonpc'); }
  else if (id === 'slow_npc')   { eachAlive(L, c => { if (c.isNPC) c.slowT = 5000; }); fx(L, 'slownpc'); }
  else if (id === 'no_walls')   { L.noWalls = true; L.noWallsT = 5000; fx(L, 'nowalls'); }
  else if (id === 'ghost_mode') { L.ghostMode = true; L.ghostModeT = 5000; fx(L, 'ghost'); }
  else if (id === 'wave_boost') { eachAlive(L, c => { if (Math.random() < 0.5) c.boostT = C.BOOST_DUR; }); fx(L, 'wave'); }
  else if (id === 'lightning_field') {
    const hit = [];
    eachAlive(L, c => {
      if (Math.random() < 0.5) c.boostT = C.BOOST_DUR;
      else { hit.push(c.id); if (!c.shieldOn && L.alive.size > 1) c.hp -= 8; }
    });
    fx(L, 'lightning', {hit});
  }
  else if (id === 'random_chaos') {
    const pool = ['quake','storm','spike','boost','oil','gravity','elim_last'];
    applyEffect(L, pool[Math.floor(Math.random() * pool.length)]);
    return;
  }
  else if (id === 'moving_barriers') addMovingBarriers(L);
  else if (id === 'laser_gates')     addLaserGates(L);
  else if (id === 'fog_event')       io.to(L.id).emit('fog_event', {dur: 10000});
  else if (id === 'low_grav')        { L.lowGravT = 12000; io.to(L.id).emit('low_grav', {dur: 12000}); }
  else if (id === 'reverse_controls') {
    eachAlive(L, c => { if (!c.isNPC) c.reverseT = Math.max(c.reverseT, 5000); });
    fx(L, 'reverse');
  }
  else if (id === 'double_speed') {
    L.doubleSpeedT = 8000;
    eachAlive(L, c => { c.boostT = Math.max(c.boostT, 8000); });
    fx(L, 'doublespeed');
  }

  // Elimination
  else if (id === 'elim_last')    elimBottom(L, 1);
  else if (id === 'elim_bottom2') elimBottom(L, 2);
  else if (id === 'elim_bottom3') elimBottom(L, 3);
  else if (id === 'elim_random') {
    const alive = [...L.alive].filter(cid => { const c = L.cars.get(cid); return c && !c.eliminated; });
    if (alive.length > 1) elimCar(L, alive[Math.floor(Math.random() * alive.length)], 'vote');
  }

  // Finish
  else if (id === 'finish') {
    const first = L.cars.get([...L.alive][0]);
    const f = first ? (first.wi < 0 ? 0 : first.wi) / L.tr.N : 0;
    L.finishF = (f + 0.38) % 1;
    io.to(L.id).emit('finish_placed', {f: L.finishF});
  }
}

function addZone(L, type, r, mega) {
  const z = {t: type, f: 0.08 + Math.random() * 0.88, r, mega: !!mega};
  objPos(L, z);
  L.zones.push(z);
  L.tr.nramps = CT.zoneRamps(L.tr, L.zones);
  io.to(L.id).emit('zone', {t: z.t, f: z.f, r: z.r, mega: z.mega});
}

function addDebris(L, count) {
  const obs = [];
  for (let i = 0; i < count; i++) {
    const ob = {f: 0.06 + Math.random() * 0.9, lat: (Math.random() - 0.5) * L.w * 0.5, dv: (Math.random() - 0.5) * L.w * 0.4, k: Math.floor(Math.random() * 3)};
    objPos(L, ob);
    L.obstacles.push(ob);
    obs.push({f: ob.f, lat: r2(ob.lat), dv: r2(ob.dv), k: ob.k});
  }
  io.to(L.id).emit('obstacles', {obs});
}

function addMovingBarriers(L) {
  const barriers = [], now = Date.now();
  for (let i = 0; i < 3; i++) {
    const b = {
      id: `b${now}_${i}`, f: 0.06 + Math.random() * 0.9, startTime: now,
      initPhase: Math.random() * TAU, freq: 0.55 + Math.random() * 0.35, ampF: 0.32, r: 3.5,
    };
    barrierPos(L, b, now);
    L.movingBarriers.push(b);
    barriers.push({id: b.id, f: b.f, age: 0, initPhase: b.initPhase, freq: b.freq, ampF: b.ampF, r: b.r});
  }
  io.to(L.id).emit('moving_barriers', {barriers});
}

function addLaserGates(L) {
  const gates = [], now = Date.now();
  for (let i = 0; i < 3; i++) {
    const g = {id: `g${now}_${i}`, f: ((i / 3) + 0.08 + Math.random() / 6) % 1, startTime: now, cycleDur: 1000 + Math.floor(Math.random() * 600)};
    objPos(L, g);
    L.laserGates.push(g);
    gates.push({id: g.id, f: g.f, age: 0, cycleDur: g.cycleDur});
  }
  io.to(L.id).emit('laser_gates', {gates});
}

function stopLobby(L) {
  clearInterval(L.tickT); clearTimeout(L.startT);
  for (const h of L.timers) clearTimeout(h.t);
  L.timers.clear();
}

function endRace(L, winner) {
  L.state = 'finished';
  stopLobby(L);
  io.to(L.id).emit('race_over', {winner: winner ? {id: winner.id, isNPC: winner.isNPC, vh: winner.vehicleId, name: winner.name} : null});
  setTimeout(() => lobbies.delete(L.id), 30000);
}

function lobbyInfo(L) {
  return {count: L.players.size, max: L.maxPlayers, players: [...L.players.values()].map(p => p.name)};
}

// ── SOCKETS ───────────────────────────────────────────────────────────
io.on('connection', socket => {
  let L = null, myCarId = null;
  console.log('[+]', socket.id);

  function join(lobby, name, vh, customData) {
    L = lobby;
    socket.join(L.id);
    const car = mkCar(L, socket.id, vh || 'civic_type_r', L.players.size, customData);
    car.name = String(name || '').replace(/[<>&"']/g, '').trim().slice(0, 16) || 'PLAYER';
    myCarId = car.id;
    L.players.set(socket.id, {name: car.name, vh, carId: car.id, customData});
    return car;
  }
  const joinedMsg = car => ({carId: car.id, st: trackState(L), lobbyId: L.id, trackName: TRACKS[L.type].name, remain: Math.max(0, C.LOBBY_TIMEOUT - (Date.now() - L.created))});

  socket.on('find_match', ({name, vh, customData, trackType} = {}) => {
    if (L) return;
    if (!waitingLobby) waitingLobby = mkLobby(undefined, trackType);
    const car = join(waitingLobby, name, vh, customData);
    socket.emit('joined', joinedMsg(car));
    io.to(L.id).emit('lobby_update', lobbyInfo(L));
    if (L.players.size === 1) { const lob = L; L.startT = setTimeout(() => beginRace(lob), C.LOBBY_TIMEOUT); }
    if (L.players.size >= L.maxPlayers) { clearTimeout(L.startT); waitingLobby = null; beginRace(L); }
  });

  socket.on('bot_race', ({name, vh, customData, trackType} = {}) => {
    if (L) return;
    const lob = mkLobby(10, trackType, false);
    lob.isBot = true;
    const car = join(lob, name, vh, customData);
    socket.emit('joined', joinedMsg(car));
    beginRace(L);
  });

  socket.on('create_private', ({name, vh, customData, mode, code, trackType} = {}) => {
    if (L) return;
    const maxP = mode === '1v1' ? 2 : mode === 'team' ? 6 : mode === '10' ? 10 : mode === '20' ? 20 : 30;
    const customCode = code ? String(code).toUpperCase().slice(0, 5) : null;
    if (customCode && lobbies.has(customCode)) {
      socket.emit('join_error', {msg: 'Code already in use. Choose another.'});
      return;
    }
    const car = join(mkLobby(maxP, trackType, true, customCode), name, vh, customData);
    socket.emit('private_created', {code: L.id, carId: car.id, st: trackState(L), trackName: TRACKS[L.type].name});
    io.to(L.id).emit('lobby_update', lobbyInfo(L));
  });

  socket.on('join_private', ({code, name, vh, customData} = {}) => {
    if (L) return;
    const privL = lobbies.get(String(code || '').toUpperCase());
    if (!privL || privL.state !== 'waiting' || !privL.isPrivate) { socket.emit('join_error', {msg: 'Lobby not found or already started'}); return; }
    const car = join(privL, name, vh, customData);
    socket.emit('joined', joinedMsg(car));
    io.to(L.id).emit('lobby_update', lobbyInfo(L));
    if (L.players.size >= L.maxPlayers) beginRace(L);
  });

  socket.on('private_start', () => {
    if (L && L.isPrivate && L.state === 'waiting') beginRace(L);
  });

  socket.on('lobby_timer', () => {
    if (L && L.state === 'waiting') socket.emit('lobby_tick', {remain: Math.max(0, C.LOBBY_TIMEOUT - (Date.now() - L.created))});
  });

  const myCar = () => {
    if (!L || !myCarId || L.state !== 'racing') return null;
    const car = L.cars.get(myCarId);
    return car && !car.eliminated ? car : null;
  };

  socket.on('input', inp => {
    const car = myCar();
    if (!car || !inp) return;
    car.inp.u = !!inp.u; car.inp.d = !!inp.d;
    car.inp.st = clamp(Number(inp.st) || 0, -1, 1);
  });

  socket.on('use_item', ({t} = {}) => {
    const car = myCar();
    if (car && !L.paused && ['boost', 'shield', 'missile', 'spring', 'emp'].includes(t)) useItem(L, car, t);
  });

  socket.on('pause', ({on} = {}) => { if (L) setPaused(L, !!on); });

  socket.on('voice_join', () => {
    if (!L) return;
    if (!L.voice) L.voice = new Set();
    socket.emit('voice_peers', {peers: [...L.voice].filter(id => id !== socket.id)});
    L.voice.add(socket.id);
  });
  socket.on('voice_leave', () => {
    if (L && L.voice && L.voice.delete(socket.id)) io.to(L.id).emit('voice_gone', {id: socket.id});
  });
  socket.on('voice_signal', ({to, data} = {}) => {
    if (L && L.voice && L.voice.has(socket.id) && L.voice.has(to)) io.to(to).emit('voice_signal', {from: socket.id, name: (L.players.get(socket.id) || {}).name, data});
  });

  socket.on('vote', ({optId} = {}) => {
    if (!L || !L.voteOn || L.votes.has(socket.id)) return;
    const car = L.cars.get(myCarId);
    if (car && car.eliminated) return;
    L.votes.set(socket.id, optId);
    const counts = {};
    for (const o of L.voteOpts) counts[o.id] = 0;
    for (const v of L.votes.values()) if (counts[v] !== undefined) counts[v]++;
    io.to(L.id).emit('vote_update', {counts, total: L.votes.size});
  });

  socket.on('disconnect', () => {
    console.log('[-]', socket.id);
    if (!L) return;
    if (L.voice && L.voice.delete(socket.id)) io.to(L.id).emit('voice_gone', {id: socket.id});
    L.players.delete(socket.id);
    const car = L.cars.get(myCarId);
    if (L.state === 'waiting') {
      if (car) { L.cars.delete(car.id); L.alive.delete(car.id); }
      let i = 0;
      for (const p of L.players.values()) { const c = L.cars.get(p.carId); if (c) seatCar(L, c, i); i++; }
      io.to(L.id).emit('lobby_update', lobbyInfo(L));
    } else if (car) {
      Object.assign(car, npcTraits(), {socketId: null, isNPC: true});
      car.inp = {u: false, d: false, st: 0};
    }
    io.to(L.id).emit('player_left', {carId: myCarId});
    if (L.players.size === 0) {
      if (L === waitingLobby) waitingLobby = null;
      stopLobby(L);
      lobbies.delete(L.id);
    }
  });
});

function beginRace(L) {
  if (L.state !== 'waiting') return;
  L.state = 'racing';
  if (L === waitingLobby) waitingLobby = null;
  clearTimeout(L.startT);
  fillNPCs(L);
  L.lastTick = Date.now();
  io.to(L.id).emit('race_start', {
    cars: [...L.cars.values()].map(c => ({
      id: c.id, x: r2(c.x), y: r2(c.y), z: r2(c.z), angle: r2(c.angle),
      vh: c.vehicleId, isNPC: c.isNPC, name: c.name, hp: c.hp, maxHp: c.maxHp,
      socketId: c.socketId, custom: c.custom,
    })),
    st: trackState(L),
    trackName: TRACKS[L.type].name,
  });
  spawnPowerups(L);
  L.tickT = setInterval(() => tickLobby(L), C.TICK_MS);
  L.nextVoteT = later(L, () => startVote(L), C.VOTE_INTERVAL);
}

const PORT = process.env.PORT || 8080;
srv.listen(PORT, () => console.log(`CyberTrack ▶  http://localhost:${PORT}`));
