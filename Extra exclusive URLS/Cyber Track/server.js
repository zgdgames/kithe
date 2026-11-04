'use strict';
const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const path    = require('path');

const app    = express();
const srv    = http.createServer(app);
const io     = new Server(srv, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, 'public')));

// ── CONFIG ───────────────────────────────────────────────────────────
const C = {
  MAX_PLAYERS:    30,
  LOBBY_TIMEOUT:  120_000,
  TICK_MS:        50,
  VOTE_INTERVAL:  30_000,
  VOTE_DURATION:  12_000,
  ROAD_WIDTH:     26,
  CAR_R:          2.4,
  MAX_SPD:        48,
  NPC_SPD:        32,
  BOOST_DUR:      4000,
  OIL_DUR:        4000,
  EMP_RADIUS:     35,
  MISSILE_SPD:    85,
  DRIFT_MIN_SPD:  20,
  DRIFT_BOOST:    1.4,
  SLIPSTREAM_DIST: 25,
  NEAR_MISS_DIST: 6,
};

// ── TRACK GENERATORS ─────────────────────────────────────────────────
function cmr(p0, p1, p2, p3, t) {
  const t2=t*t, t3=t2*t;
  return {
    x: 0.5*((2*p1.x)+(-p0.x+p2.x)*t+(2*p0.x-5*p1.x+4*p2.x-p3.x)*t2+(-p0.x+3*p1.x-3*p2.x+p3.x)*t3),
    z: 0.5*((2*p1.z)+(-p0.z+p2.z)*t+(2*p0.z-5*p1.z+4*p2.z-p3.z)*t2+(-p0.z+3*p1.z-3*p2.z+p3.z)*t3)
  };
}

function splineTrack(cpts) {
  const N=cpts.length, sps=16, out=[];
  for(let s=0;s<N;s++){
    const p0=cpts[(s-1+N)%N], p1=cpts[s], p2=cpts[(s+1)%N], p3=cpts[(s+2)%N];
    for(let j=0;j<sps;j++) out.push(cmr(p0,p1,p2,p3,j/sps));
  }
  return out;
}

// Per-track metadata
const TRACK_META = [
  {name:'FARMLAND',   roadW:28, isBoat:false, isPlane:false},
  {name:'FOREST',     roadW:18, isBoat:false, isPlane:false},
  {name:'OPEN WATER', roadW:44, isBoat:true,  isPlane:false},
  {name:'BEACH',      roadW:30, isBoat:false, isPlane:false},
  {name:'CAVE',       roadW:20, isBoat:false, isPlane:false},
  {name:'VOLCANO',    roadW:22, isBoat:false, isPlane:false},
  {name:'CYBER GRID', roadW:26, isBoat:false, isPlane:false},
  {name:'HOUSE',      roadW:16, isBoat:false, isPlane:false},
  {name:'CITY NIGHT', roadW:24, isBoat:false, isPlane:false},
  {name:'SKY',        roadW:38, isBoat:false, isPlane:true },
  {name:'DOUBLE HELIX',roadW:26,isBoat:false, isPlane:false},
  {name:'NEON CITY',  roadW:26, isBoat:false, isPlane:false},
  {name:'STADIUM',    roadW:30, isBoat:false, isPlane:false},
  {name:'CHAOS ZONE', roadW:24, isBoat:false, isPlane:false},
];

const TRACK_PRESETS = [
  // 0: Farmland — gentle oval
  ()=>{const N=10,pts=[];for(let i=0;i<N;i++){const a=(i/N)*Math.PI*2,r=190+Math.sin(a*2)*40;pts.push({x:Math.cos(a)*r+(Math.random()-0.5)*18,z:Math.sin(a)*r*(0.6+Math.random()*0.2)+(Math.random()-0.5)*12});}return splineTrack(pts);},
  // 1: Forest — winding narrow
  ()=>{const N=16,pts=[];for(let i=0;i<N;i++){const a=(i/N)*Math.PI*2,r=120+Math.sin(a*4)*55;pts.push({x:Math.cos(a)*r+(Math.random()-0.5)*30,z:Math.sin(a)*r+(Math.random()-0.5)*25});}return splineTrack(pts);},
  // 2: Water — wide gentle loops
  ()=>{const N=8,pts=[];for(let i=0;i<N;i++){const a=(i/N)*Math.PI*2;pts.push({x:Math.cos(a)*240+(Math.random()-0.5)*20,z:Math.sin(a)*160+(Math.random()-0.5)*15});}return splineTrack(pts);},
  // 3: Beach — along coastline, sweeping
  ()=>{const pts=[];for(let i=0;i<12;i++){const t=i/12,a=t*Math.PI*2;pts.push({x:Math.cos(a)*220+Math.sin(a*3)*30+(Math.random()-0.5)*20,z:Math.sin(a)*140+Math.cos(a*2)*25+(Math.random()-0.5)*15});}return splineTrack(pts);},
  // 4: Cave — tight twisty
  ()=>{const N=14,pts=[];for(let i=0;i<N;i++){const a=(i/N)*Math.PI*2,r=100+Math.sin(a*5)*40;pts.push({x:Math.cos(a)*r+(Math.random()-0.5)*25,z:Math.sin(a)*r+(Math.random()-0.5)*20});}return splineTrack(pts);},
  // 5: Volcano — dramatic irregular
  ()=>{const N=12,pts=[];for(let i=0;i<N;i++){const a=(i/N)*Math.PI*2,r=160+Math.sin(a*3)*70;pts.push({x:Math.cos(a)*r+(Math.random()-0.5)*35,z:Math.sin(a)*r+(Math.random()-0.5)*30});}return splineTrack(pts);},
  // 6: Cyber/Default — existing oval
  ()=>{const N=8,rx=220,rz=130,pts=[];for(let i=0;i<N;i++){const a=(i/N)*Math.PI*2;pts.push({x:Math.cos(a)*rx+(Math.random()-0.5)*30,z:Math.sin(a)*rz+(Math.random()-0.5)*20});}return splineTrack(pts);},
  // 7: House — very tight indoor
  ()=>splineTrack([{x:140,z:80},{x:140,z:-40},{x:60,z:-120},{x:-60,z:-120},{x:-140,z:-40},{x:-140,z:80},{x:-60,z:130},{x:60,z:130}]),
  // 8: City — angular urban circuit
  ()=>{const pts=[{x:200,z:0},{x:200,z:120},{x:50,z:150},{x:-80,z:120},{x:-200,z:80},{x:-200,z:-80},{x:-80,z:-150},{x:50,z:-150},{x:180,z:-100}];return splineTrack(pts);},
  // 9: Sky — wide sweeping high altitude
  ()=>{const N=8,pts=[];for(let i=0;i<N;i++){const a=(i/N)*Math.PI*2;pts.push({x:Math.cos(a)*250+(Math.random()-0.5)*25,z:Math.sin(a)*180+(Math.random()-0.5)*20});}return splineTrack(pts);},
  // 10: Double Helix
  ()=>{const pts=[];for(let i=0;i<16;i++){const t=(i/16)*Math.PI*2;pts.push({x:220*Math.sin(t)+(Math.random()-0.5)*20,z:130*Math.sin(t*2)/2+(Math.random()-0.5)*15});}return splineTrack(pts);},
  // 11: Neon City angular
  ()=>{const pts=[{x:200,z:0},{x:200,z:120},{x:50,z:150},{x:-80,z:120},{x:-200,z:80},{x:-200,z:-80},{x:-80,z:-150},{x:50,z:-150},{x:180,z:-100}];return splineTrack(pts);},
  // 12: Wide Stadium
  ()=>{const N=10,r=190,pts=[];for(let i=0;i<N;i++){const a=(i/N)*Math.PI*2;pts.push({x:Math.cos(a)*r*(0.9+Math.random()*.2),z:Math.sin(a)*r*(0.7+Math.random()*.3)});}return splineTrack(pts);},
  // 13: Chaos
  ()=>{const N=14,pts=[];for(let i=0;i<N;i++){const a=(i/N)*Math.PI*2;pts.push({x:Math.cos(a)*210*(0.7+Math.random()*.6)+(Math.random()-0.5)*70,z:Math.sin(a)*155*(0.7+Math.random()*.6)+(Math.random()-0.5)*50});}return splineTrack(pts);}
];

function generateTrack(type) {
  const max = TRACK_PRESETS.length;
  const idx = (type !== undefined && type >= 0 && type < max) ? type : Math.floor(Math.random()*max);
  return TRACK_PRESETS[idx]();
}

function wpAngle(wps, i) {
  const N=wps.length, c=wps[i], n=wps[(i+1)%N];
  return Math.atan2(n.x-c.x, n.z-c.z);
}

// ── VOTE OPTIONS (60+) ───────────────────────────────────────────────
const VOTE_POOL = [
  // Track geometry
  {id:'narrow',      label:'NARROW TRACK',    desc:'Road shrinks 25%'},
  {id:'widen',       label:'WIDEN TRACK',      desc:'Road expands wide'},
  {id:'warp',        label:'WARP SEGMENT',     desc:'Section reshuffles'},
  {id:'quake',       label:'TRACK QUAKE',      desc:'Track violently shifts'},
  {id:'mega_narrow', label:'MEGA NARROW',      desc:'Road shrinks 40%'},
  {id:'mega_widen',  label:'MEGA WIDEN',       desc:'Road expands 50%'},
  {id:'invert',      label:'INVERT CURVE',     desc:'Curves flip direction'},
  {id:'ripple',      label:'RIPPLE WAVE',      desc:'Track undulates'},
  {id:'compress',    label:'COMPRESS TRACK',   desc:'Track squeezes together'},
  {id:'expand_track',label:'EXPAND TRACK',     desc:'Track stretches out'},
  // Hazards
  {id:'boost',       label:'BOOST ZONE',       desc:'Speed strip on track'},
  {id:'spike',       label:'SPIKE STRIP',      desc:'Damage zone placed'},
  {id:'oil',         label:'OIL SLICK',        desc:'Slippery patch ahead'},
  {id:'debris',      label:'DEBRIS FIELD',     desc:'Obstacles on track'},
  {id:'double_spike',label:'DOUBLE SPIKES',    desc:'Two spike zones placed'},
  {id:'double_boost',label:'DOUBLE BOOST',     desc:'Two boost zones placed'},
  {id:'triple_oil',  label:'TRIPLE OIL',       desc:'Three oil slicks placed'},
  {id:'mega_spike',  label:'MEGA SPIKE',       desc:'Huge damage zone'},
  {id:'shock_zone',  label:'SHOCK ZONE',       desc:'Electric hazard strip'},
  {id:'freeze_zone', label:'FREEZE ZONE',      desc:'Icy patch slows cars'},
  // Physics events
  {id:'gravity',     label:'GRAVITY SPIKE',    desc:'All cars launch upward'},
  {id:'reverse_grav',label:'REVERSE GRAVITY',  desc:'Cars float briefly'},
  {id:'storm',       label:'GLITCH STORM',     desc:'Random chaos for 4s'},
  {id:'speed_surge', label:'SPEED SURGE',      desc:'Everyone gets a burst'},
  {id:'mega_storm',  label:'MEGA STORM',       desc:'Extreme glitch chaos'},
  {id:'flash_boost', label:'FLASH BOOST',      desc:'Instant speed to all'},
  {id:'slow_field',  label:'SLOW FIELD',       desc:'Everyone slows 3s'},
  {id:'spin_out',    label:'SPIN OUT',         desc:'All cars spin briefly'},
  // Elimination votes
  {id:'elim_last',   label:'ELIMINATE LAST',   desc:'Last place car removed'},
  {id:'elim_bottom2',label:'ELIMINATE BOTTOM 2',desc:'Last two cars removed'},
  {id:'elim_random', label:'RANDOM ELIM',      desc:'Random car removed'},
  {id:'elim_bottom3',label:'ELIMINATE BOTTOM 3',desc:'Last three removed'},
  // Zone combos
  {id:'boost_spike', label:'BOOST + SPIKE',    desc:'Speed then pain'},
  {id:'oil_boost',   label:'OIL + BOOST',      desc:'Slippery then fast'},
  {id:'full_hazard', label:'FULL HAZARD',      desc:'Spike+oil+debris'},
  // Track swap
  {id:'new_track_0', label:'CIRCUIT ALPHA',    desc:'Switch to oval circuit'},
  {id:'new_track_1', label:'DOUBLE HELIX',     desc:'Switch to figure-8'},
  {id:'new_track_2', label:'NEON CITY',        desc:'Switch to city circuit'},
  {id:'new_track_3', label:'STADIUM LOOP',     desc:'Switch to stadium'},
  {id:'new_track_4', label:'MOUNTAIN PASS',    desc:'Switch to mountains'},
  {id:'new_track_5', label:'SPIRAL STORM',     desc:'Switch to spiral'},
  {id:'new_track_6', label:'DRAGON SPINE',     desc:'Switch to dragon'},
  {id:'new_track_7', label:'CROSS GRID',       desc:'Switch to cross track'},
  {id:'new_track_8', label:'CYBER HIGHWAY',    desc:'Switch to highway'},
  {id:'new_track_9', label:'CHAOS ZONE',       desc:'Switch to chaos'},
  // Powerup events
  {id:'boost_rain',  label:'BOOST RAIN',       desc:'Everyone gets boost'},
  {id:'repair_all',  label:'REPAIR ALL',       desc:'All cars repaired'},
  {id:'damage_all',  label:'DAMAGE ALL',       desc:'All cars take 30 dmg'},
  {id:'speed_all',   label:'TOP SPEED UP',     desc:'Max speed increases'},
  {id:'freeze_all',  label:'FREEZE ALL',       desc:'Everyone slows 5s'},
  {id:'random_chaos',label:'RANDOM CHAOS',     desc:'Wild random effect'},
  // Misc
  {id:'extend_road', label:'EXTEND ROAD',      desc:'Track length increases'},
  {id:'flip_dir',    label:'FLIP SECTION',     desc:'Section mirrors'},
  {id:'wave_boost',  label:'WAVE BOOST',       desc:'Rolling speed wave'},
  {id:'lightning_field',label:'LIGHTNING FIELD',desc:'Random sparks hit cars'},
  {id:'maze_walls',  label:'MAZE WALLS',       desc:'Extra walls appear'},
  {id:'no_walls',    label:'NO WALLS',         desc:'Barriers removed 5s'},
  {id:'ghost_mode',  label:'GHOST MODE',       desc:'No car collisions 5s'},
  {id:'turbo_npc',   label:'TURBO NPCS',       desc:'AI cars speed up'},
  {id:'slow_npc',    label:'SLOW NPCS',        desc:'AI cars slow down'},
  {id:'widen_narrow',   label:'WIDE THEN NARROW',   desc:'Expands then shrinks'},
  {id:'moving_barriers',label:'MOVING BARRIERS',    desc:'Barriers sweep the track'},
  {id:'laser_gates',    label:'LASER GATES',         desc:'Death beams pulse across track'},
  {id:'fog_event',      label:'HEAVY FOG',           desc:'Dense fog blinds for 10s'},
  {id:'low_grav',       label:'LOW GRAVITY',         desc:'Cars float for 12 seconds'},
  {id:'reverse_controls',label:'REVERSE CONTROLS',  desc:'Controls flip for all players'},
  {id:'double_speed',   label:'DOUBLE SPEED',        desc:'Everyone goes 2x fast for 8s'},
];

const FINISH_OPT = {id:'finish', label:'FINISH LINE', desc:'Place the finish line'};

function pick3(pool) {
  return [...pool].sort(()=>Math.random()-0.5).slice(0,3);
}

// ── LOBBY ────────────────────────────────────────────────────────────
let waitingLobby = null;
const lobbies    = new Map();
let _carId       = 1;

function mkLobby(maxP, trackType, isPrivate, customCode) {
  const L = {
    id: customCode || Math.random().toString(36).slice(2,7).toUpperCase(),
    state: 'waiting',
    maxPlayers: maxP || C.MAX_PLAYERS,
    isPrivate: !!isPrivate,
    trackType: trackType !== undefined ? trackType : Math.floor(Math.random()*10),
    players: new Map(),
    cars:    new Map(),
    alive:   new Set(),
    wps:     null,
    roadW:   (TRACK_META[trackType !== undefined ? trackType : 0] || TRACK_META[6]).roadW,
    isBoat:  (TRACK_META[trackType !== undefined ? trackType : 0] || TRACK_META[6]).isBoat,
    isPlane: (TRACK_META[trackType !== undefined ? trackType : 0] || TRACK_META[6]).isPlane,
    zones:   [],
    obstacles:[],
    powerups: [],
    finishIdx: null,
    voteOn: false, voteOpts:[], votes:new Map(),
    voteT:null, nextVoteT:null, tickT:null, startT:null,
    lastTick: Date.now(),
    noWalls: false, noWallsT: 0,
    ghostMode: false, ghostModeT: 0,
    movingBarriers: [], laserGates: [],
    lowGravT: 0, doubleSpeedT: 0,
  };
  L.wps = generateTrack(L.trackType);
  lobbies.set(L.id, L);
  return L;
}

function startPos(L, idx) {
  const offset = (idx % 2 === 0 ? -4 : 4);
  const wi = (idx * 3 + 1) % L.wps.length;
  const wp = L.wps[wi];
  return { x: wp.x + offset, z: wp.z, angle: wpAngle(L.wps, wi) };
}

function mkCar(L, socketId, vehicleId, idx, customData) {
  const id = `c${_carId++}`;
  const p  = startPos(L, idx);
  const c  = {
    id, socketId, vehicleId: vehicleId||'civic_type_r',
    isNPC: socketId===null, name: null,
    custom: customData || null,
    x:p.x, z:p.z, y:0,
    angle:p.angle, speed:0, hp:100,
    eliminated:false, elimReason:null,
    npcWp: (idx*3+1)%L.wps.length,
    nearestWp: (idx*3+1)%L.wps.length,
    posWp: (idx*3+1)%L.wps.length,
    boostT:0, oilT:0, slowT:0, spinT:0, reverseT:0,
    driftT:0, driftSide:0, shieldOn:false, hasMissile:false, hasEMP:false,
    slipstreamT:0,
    laps:0, progress:0, position:1,
    up:false, dn:false, lt:false, rt:false,
  };
  L.cars.set(id, c);
  L.alive.add(id);
  return c;
}

const NPC_NAMES = [
  'GHOST-7','VIPER-X','NOVA-3','RAZOR-9','BLAZE-2','STORM-6','NEXUS-4','FLUX-8','KIRA-1','VOLT-5',
  'ZERO-0','APEX-11','VOID-13','NEON-7','SURGE-2','GRID-5','PRISM-8','PHASE-3','ECHO-6','RIFT-4',
  'CIPHER-9','SPARK-1','GLITCH-7','PULSE-0','AXON-5','DRIFT-3','TRACE-8','FUSE-2','CORE-6','APEX-X'
];

function fillNPCs(L) {
  const have = L.players.size;
  const fill = L.maxPlayers - have;
  const vhList = ['civic_type_r','gr86','skyline_r34','mustang_gt500','porsche_gt3','lambo_huracan','ferrari_la'];
  for (let i = 0; i < fill; i++) {
    const idx = have + i;
    const p   = startPos(L, idx);
    const vh  = vhList[Math.floor(Math.random()*vhList.length)];
    // Distribute skill: 30% rookie, 50% regular, 20% elite
    const roll = Math.random();
    const skill = roll < 0.3 ? 0 : roll < 0.8 ? 1 : 2;
    // Personality: 0=normal, 1=aggressive, 2=defensive, 3=erratic
    const personality = [0,0,0,1,1,2,3][Math.floor(Math.random()*7)];
    const car = {
      id:`c${_carId++}`, socketId:null, vehicleId:vh, isNPC:true,
      name: NPC_NAMES[idx % NPC_NAMES.length],
      custom:null,
      x:p.x, z:p.z, y:0,
      angle:p.angle, speed:0, hp:100,
      eliminated:false, elimReason:null,
      npcWp:(idx*3+1)%L.wps.length,
      nearestWp:(idx*3+1)%L.wps.length,
      posWp:(idx*3+1)%L.wps.length,
      boostT:0, oilT:0, slowT:0, spinT:0, reverseT:0,
      driftT:0, driftSide:0, shieldOn:false, hasMissile:false, hasEMP:false,
      slipstreamT:0,
      laps:0, progress:0, position:1,
      up:false,dn:false,lt:false,rt:false,
      skill, personality, wallHitT:0,
      laneOffset: (Math.random()-0.5) * 8, // Non-straight racing line
    };
    L.cars.set(car.id, car);
    L.alive.add(car.id);
  }
}

// ── PHYSICS ───────────────────────────────────────────────────────────
function updateNPC(car, dt, L) {
  const wps=L.wps, N=wps.length;
  const skill = car.skill || 1;       // 0=rookie 1=regular 2=elite
  const pers  = car.personality || 0; // 0=normal 1=aggressive 2=defensive 3=erratic

  // ── Waypoint following ──────────────────────────────────────────────
  const lookAhead = 1 + skill;
  const tgtIdx = (car.npcWp + lookAhead) % N;
  const tgt = wps[tgtIdx];
  const dx=tgt.x-car.x, dz=tgt.z-car.z, d=Math.hypot(dx,dz);
  const catchDist = 10 + skill*4;
  if(d < catchDist) car.npcWp = (car.npcWp+1)%N;

  let steerAngle = Math.atan2(dx,dz);

  // ── Powerup seeking ─────────────────────────────────────────────────
  // Check occasionally (not every tick) to save perf
  if(!car._puCheck || Date.now()-car._puCheck > 300-skill*80) {
    car._puCheck = Date.now();
    car._targetPU = null;
    const seekR = 30 + skill*20;
    let bestD = seekR;
    for(const pu of L.powerups) {
      if(!pu.active) continue;
      const good = pu.type==='boost' || pu.type==='repair' || pu.type==='shield';
      if(!good) continue;
      const pd = Math.hypot(pu.x-car.x, pu.z-car.z);
      if(pd < bestD) { bestD=pd; car._targetPU=pu; }
    }
  }
  if(car._targetPU && car._targetPU.active) {
    const pu = car._targetPU;
    const pdx=pu.x-car.x, pdz=pu.z-car.z, pd=Math.hypot(pdx,pdz);
    if(pd < 35) {
      const puAngle = Math.atan2(pdx,pdz);
      let puDa = puAngle - steerAngle;
      while(puDa> Math.PI) puDa-=Math.PI*2;
      while(puDa<-Math.PI) puDa+=Math.PI*2;
      // Blend toward powerup — elite strong, rookie weak and misses
      const blend = skill===2?0.55:skill===1?0.25:0.08;
      steerAngle += puDa * blend;
      // Rookie sometimes misses anyway
      if(skill===0 && Math.random()<0.35) steerAngle -= puDa*0.5;
    } else {
      car._targetPU = null;
    }
  }

  // ── Hazard zone avoidance ────────────────────────────────────────────
  for(const z of L.zones) {
    if(z.t!=='spike'&&z.t!=='shock'&&z.t!=='oil') continue;
    const wp=wps[z.wi%N];
    const zd=Math.hypot(car.x-wp.x, car.z-wp.z);
    const avoidR = z.r + (skill===2?14:skill===1?7:2);
    if(zd < avoidR) {
      const awayAngle = Math.atan2(car.x-wp.x, car.z-wp.z);
      let avoidDa = awayAngle - steerAngle;
      while(avoidDa> Math.PI) avoidDa-=Math.PI*2;
      while(avoidDa<-Math.PI) avoidDa+=Math.PI*2;
      const str = skill===2?0.7:skill===1?0.35:0.12;
      steerAngle += avoidDa * str;
      // Rookie might still drive in
      if(skill===0 && Math.random()<0.45) steerAngle -= avoidDa * str * 0.9;
    }
  }

  // ── Obstacle avoidance ───────────────────────────────────────────────
  for(const ob of L.obstacles) {
    const od=Math.hypot(car.x-ob.x, car.z-ob.z);
    if(od < 18+skill*4) {
      const awayAngle = Math.atan2(car.x-ob.x, car.z-ob.z);
      let obDa = awayAngle - steerAngle;
      while(obDa> Math.PI) obDa-=Math.PI*2;
      while(obDa<-Math.PI) obDa+=Math.PI*2;
      const str = (18+skill*4-od)/(18+skill*4) * (skill===2?0.9:skill===1?0.5:0.2);
      steerAngle += obDa * str;
    }
  }

  // ── Car avoidance (don't rear-end the car ahead) ─────────────────────
  for(const [,other] of L.cars) {
    if(other.id===car.id || other.eliminated) continue;
    const cdx=other.x-car.x, cdz=other.z-car.z, cd=Math.hypot(cdx,cdz);
    if(cd < 8 && cd>0) {
      const heading = Math.sin(car.angle)*cdx + Math.cos(car.angle)*cdz;
      if(heading > 0) {
        // Steer aside — do NOT multiplicatively brake (causes stops)
        steerAngle += (Math.random()<0.5?1:-1) * 0.25;
      }
    }
  }

  // ── Apply steering ───────────────────────────────────────────────────
  let da = steerAngle - car.angle;
  while(da> Math.PI) da-=Math.PI*2;
  while(da<-Math.PI) da+=Math.PI*2;

  const turnRate = 2.8 + skill*0.8;
  const wobble = pers===3?(Math.random()-0.5)*2.5*dt:0;
  car.angle += da*turnRate*dt + wobble;

  // Mistakes: random wobble for rookie/erratic
  if((skill===0||pers===3) && Math.random()<0.004)
    car.angle += (Math.random()-0.5)*1.4;

  // Erratic: occasionally slam brakes or gas
  if(pers===3 && Math.random()<0.002) car.speed *= Math.random()<0.5?0.3:1.6;

  // ── Speed ────────────────────────────────────────────────────────────
  const bm = car.boostT>0?1.5:1;
  const om = (car.oilT>0||car.slowT>0)?0.45:1;
  const baseSpd = C.NPC_SPD - (1-skill)*8 + (pers===1?5:pers===2?-4:0);
  const variance = (skill===0?8:4)*(Math.random()*2-1);
  const cornerFactor = Math.abs(da)>0.5?(pers===1?0.85:pers===2?0.6:0.72):1;
  const targetSpd = (baseSpd+variance)*bm*om;
  car.speed = Math.min(car.speed+22*dt, targetSpd*cornerFactor);
  if(car.speed<0) car.speed=0;

  // Aggressive uses boost occasionally
  if(pers===1 && car.boostT<=0 && Math.random()<0.001) car.boostT=C.BOOST_DUR;

  // ── Move ─────────────────────────────────────────────────────────────
  car.x += Math.sin(car.angle)*car.speed*dt;
  car.z += Math.cos(car.angle)*car.speed*dt;
}

function updatePlayer(car, dt, L) {
  const bm=car.boostT>0?1.55:1;
  const om=(car.oilT>0||car.slowT>0)?0.35:1;
  const rev=car.reverseT>0?-1:1;
  if(car.up)  car.speed += 30*dt*bm*rev;
  if(car.dn)  car.speed -= 36*dt*rev;
  if(!car.up&&!car.dn) car.speed *= Math.pow(0.08, dt);
  const speedCap = (L && L.doubleSpeedT>0) ? C.MAX_SPD*1.8 : C.MAX_SPD;
  car.speed = Math.max(-15, Math.min(car.speed, speedCap*bm));
  const sf = Math.min(1, Math.abs(car.speed)/10)*om;

  // Drifting Logic
  const isSteering = car.lt || car.rt;
  if (isSteering && car.speed > C.DRIFT_MIN_SPD) {
    car.driftT += dt * 1000;
    car.driftSide = car.lt ? -1 : 1;
  } else {
    if (car.driftT > 800) {
      car.boostT = Math.max(car.boostT, Math.min(3000, car.driftT * 1.5));
    }
    car.driftT = 0;
  }

  if(car.spinT>0) { car.angle += (Math.random()-0.5)*12*dt; }
  else {
    const turnDir = car.reverseT > 0 ? -1 : 1;
    if(car.lt) car.angle += 2.2*dt*sf*turnDir;
    if(car.rt) car.angle -= 2.2*dt*sf*turnDir;
  }

  const driftAngle = car.driftT > 200 ? car.driftSide * 0.4 : 0;
  car.x += Math.sin(car.angle + driftAngle)*car.speed*dt;
  car.z += Math.cos(car.angle + driftAngle)*car.speed*dt;
}

function bounceWall(car, L) {
  if(L.noWalls) return;
  const wps=L.wps, W=wps.length;
  let nIdx=car.nearestWp||0, md=Infinity;
  for(let off=-14;off<=14;off++){
    const i=((car.nearestWp||0)+off+W)%W;
    const d=Math.hypot(wps[i].x-car.x, wps[i].z-car.z);
    if(d<md){md=d;nIdx=i;}
  }
  car.nearestWp=nIdx;
  const limit = L.roadW/2;
  
  // Near Miss Logic
  if (md > limit - 2 && md < limit) {
    if (!car.nearMissT || Date.now() - car.nearMissT > 2000) {
      car.boostT = Math.max(car.boostT, 1000);
      car.nearMissT = Date.now();
      io.to(L.id).emit('near_miss', {id: car.id});
    }
  }

  if(md > limit) {
    const wp=wps[nIdx];
    const nx=(wp.x-car.x)/(md||1), nz=(wp.z-car.z)/(md||1);
    // Push back inside — firm but not violent
    car.x += nx*(md-limit+0.4);
    car.z += nz*(md-limit+0.4);
    // Only reduce speed if moving into wall — NO angle change (prevents camera flip)
    const dotProd = Math.sin(car.angle)*nx + Math.cos(car.angle)*nz;
    if(dotProd < 0) car.speed *= 0.88; // lose 12% speed, keep heading
    // 1 HP damage per 500ms — only when not the last survivor
    const now=Date.now();
    if(L.alive.size > 1 && (!car.wallHitT || now-car.wallHitT > 500)) {
      car.hp -= 1;
      car.wallHitT = now;
    }
  }
}

function checkZones(L, car, dt) {
  for(const z of L.zones){
    const wp=L.wps[z.wi%L.wps.length];
    const d=Math.hypot(car.x-wp.x, car.z-wp.z);
    if(d < z.r){
      if(z.t==='boost') car.boostT=C.BOOST_DUR;
      if((z.t==='spike'||z.t==='shock') && L.alive.size > 1){ car.hp -= (z.mega?55:30)*dt; }
      if(z.t==='oil'||z.t==='freeze') car.oilT=C.OIL_DUR+(z.freeze?2000:0);
    }
  }
}

function checkObstacles(L, car, dt) {
  const lastAlive = L.alive.size <= 1;
  for(const ob of L.obstacles){
    const d=Math.hypot(car.x-ob.x, car.z-ob.z);
    if(d < C.CAR_R+1.5){
      if(!lastAlive) car.hp -= 15*dt;
      const nx=(car.x-ob.x)/(d||1), nz=(car.z-ob.z)/(d||1);
      car.x+=nx*2; car.z+=nz*2;
      car.speed*=0.4;
    }
  }
  for(const b of L.movingBarriers){
    const d=Math.hypot(car.x-b.x, car.z-b.z);
    if(d < C.CAR_R+b.r){
      if(!lastAlive) car.hp -= 20*dt;
      const nx=(car.x-b.x)/(d||1), nz=(car.z-b.z)/(d||1);
      car.x+=nx*3; car.z+=nz*3;
      car.speed*=0.35;
    }
  }
}

function checkCarCollisions(L) {
  if(L.ghostMode) return;
  const alive=[...L.alive].map(id=>L.cars.get(id)).filter(c=>c&&!c.eliminated);
  for(let i=0;i<alive.length;i++){
    for(let j=i+1;j<alive.length;j++){
      const a=alive[i], b=alive[j];
      const dx=b.x-a.x, dz=b.z-a.z, d=Math.hypot(dx,dz);
      if(d < C.CAR_R*2 && d>0){
        const nx=dx/d, nz=dz/d, ov=C.CAR_R*2-d;
        a.x-=nx*ov*0.5; a.z-=nz*ov*0.5;
        b.x+=nx*ov*0.5; b.z+=nz*ov*0.5;
        // Speed exchange — cars bounce off each other, no HP damage
        const relSpd=(a.speed-b.speed)*0.4;
        a.speed-=relSpd; b.speed+=relSpd;
        // Slight angle deflection on impact
        a.angle+=(Math.random()-0.5)*0.18;
        b.angle+=(Math.random()-0.5)*0.18;
      }
    }
  }
}

function checkPowerups(L, car) {
  for(const pu of L.powerups){
    if(!pu.active) continue;
    const d=Math.hypot(car.x-pu.x, car.z-pu.z);
    if(d < 5){
      pu.active=false;
      io.to(L.id).emit('powerup_taken',{id:pu.id, carId:car.id, type:pu.type});
      switch(pu.type){
        case 'boost':   car.boostT=C.BOOST_DUR*1.5; break;
        case 'repair':  car.hp=Math.min(100, car.hp+35); break;
        case 'shield':  car.shieldOn=true; break;
        case 'emp':     car.hasEMP=true; break;
        case 'missile': car.hasMissile=true; break;
        case 'slow':    car.slowT=3000; car.speed*=0.3; break;
        case 'spin':    car.spinT=2000; break;
        case 'reverse': car.reverseT=3500; break;
        case 'spike_p': car.hp-=25; break;
        case 'oil_p':   car.oilT=C.OIL_DUR*1.5; break;
      }
      // Respawn
      setTimeout(()=>{ pu.active=true; io.to(L.id).emit('powerup_respawn',{id:pu.id}); }, 9000);
    }
  }
}

function spawnPowerups(L) {
  const N=L.wps.length, count=10;
  const types=['boost','repair','emp','missile','shield','boost','spike_p','oil_p','repair','missile'];
  L.powerups=[];
  for(let i=0;i<count;i++){
    const wi=Math.floor((i/count)*N);
    const wp=L.wps[wi], nxt=L.wps[(wi+1)%N];
    const dx=nxt.x-wp.x, dz=nxt.z-wp.z, len=Math.hypot(dx,dz)||1;
    const side=(Math.random()>.5?1:-1)*(L.roadW*0.28);
    L.powerups.push({id:i,wi,x:wp.x+(-dz/len)*side,z:wp.z+(dx/len)*side,type:types[i],active:true});
  }
  io.to(L.id).emit('powerups_init',{powerups:L.powerups.map(p=>({id:p.id,x:p.x,z:p.z,type:p.type,active:p.active}))});
}

function calcPositions(L) {
  const cars=[...L.cars.values()];
  const W=L.wps.length;
  for(const c of cars){
    if(c.eliminated) continue;
    // Use posWp as anchor — only allow search 3 back, 28 forward
    // This prevents the position from ever jumping backwards past where the car has been
    const anchor = c.posWp !== undefined ? c.posWp : 0;
    let best=anchor, bestD=Infinity;
    for(let off=-3;off<=28;off++){
      const i=(anchor+off+W)%W;
      const d=Math.hypot(L.wps[i].x-c.x, L.wps[i].z-c.z);
      if(d<bestD){bestD=d;best=i;}
    }
    // Lap detection: posWp crosses finish line (end→start)
    if(anchor > W*0.9 && best < W*0.1) c.laps=(c.laps||0)+1;
    c.posWp=best;
    c.progress=(c.laps||0)*W+best;

    // Slipstream
    c.slipstreamT=0;
    for(const other of L.cars.values()){
      if(other.id===c.id||other.eliminated) continue;
      const dx=other.x-c.x, dz=other.z-c.z, d=Math.hypot(dx,dz);
      if(d<C.SLIPSTREAM_DIST&&d>5){
        const dot=(Math.sin(c.angle)*dx+Math.cos(c.angle)*dz)/d;
        if(dot>0.95){c.slipstreamT=500;break;}
      }
    }
  }
  const alive=cars.filter(c=>!c.eliminated).sort((a,b)=>(b.progress||0)-(a.progress||0));
  alive.forEach((c,i)=>c.position=i+1);
}

function elimCar(L, carId, reason) {
  const car=L.cars.get(carId);
  if(!car||car.eliminated) return;
  car.eliminated=true;
  car.elimReason=reason;
  L.alive.delete(carId);
  io.to(L.id).emit('eliminated',{id:carId, reason});
}

function tickLobby(L) {
  const now=Date.now(), dt=Math.min((now-L.lastTick)/1000, 0.1);
  L.lastTick=now;
  if(L.state!=='racing') return;

  // Tick timers
  if(L.noWalls){ L.noWallsT-=dt*1000; if(L.noWallsT<=0) L.noWalls=false; }
  if(L.ghostMode){ L.ghostModeT-=dt*1000; if(L.ghostModeT<=0) L.ghostMode=false; }
  if(L.lowGravT>0) L.lowGravT-=dt*1000;
  if(L.doubleSpeedT>0) L.doubleSpeedT-=dt*1000;

  // Update moving barriers (deterministic: server and client use wall-clock time)
  const W=L.wps.length;
  for(const b of L.movingBarriers){
    const wp=L.wps[b.wi%W], nxt=L.wps[(b.wi+1)%W];
    const dx=nxt.x-wp.x, dz=nxt.z-wp.z, len=Math.hypot(dx,dz)||1;
    const phase=(Date.now()-b.startTime)/1000*b.freq+b.initPhase;
    b.x=wp.x+(-dz/len)*Math.sin(phase)*b.amp;
    b.z=wp.z+(dx/len)*Math.sin(phase)*b.amp;
  }

  // Check laser gate damage
  for(const g of L.laserGates){
    const isActive=Math.floor((Date.now()-g.startTime)/g.cycleDur)%2===0;
    if(!isActive) continue;
    const wp=L.wps[g.wi%W], nxt=L.wps[(g.wi+1)%W];
    const dx=nxt.x-wp.x, dz=nxt.z-wp.z, len=Math.hypot(dx,dz)||1;
    for(const [,car] of L.cars){
      if(car.eliminated||car.shieldOn) continue;
      const cx=car.x-wp.x, cz=car.z-wp.z;
      const along=cx*(dx/len)+cz*(dz/len);
      const perp=Math.abs(cx*(-dz/len)+cz*(dx/len));
      if(Math.abs(along)<9 && perp<L.roadW*0.45 && L.alive.size>1) car.hp-=55*dt;
    }
  }

  for(const [id,car] of L.cars){
    if(car.eliminated) continue;
    if(car.isNPC) updateNPC(car,dt,L);
    else          updatePlayer(car,dt,L);
    if(car.boostT>0)   car.boostT  -=dt*1000;
    if(car.oilT>0)     car.oilT    -=dt*1000;
    if(car.slowT>0)    car.slowT   -=dt*1000;
    if(car.spinT>0)    car.spinT   -=dt*1000;
    if(car.reverseT>0) car.reverseT-=dt*1000;

    bounceWall(car, L);
    checkZones(L,car,dt);
    checkObstacles(L,car,dt);
    checkPowerups(L,car);

    // HP death: car is eliminated when HP hits 0
    if(car.hp <= 0 && !car.eliminated){ car.hp=0; elimCar(L, car.id, 'wrecked'); continue; }

    if(L.finishIdx!==null && !car.eliminated){
      const fp=L.wps[L.finishIdx];
      if(Math.hypot(car.x-fp.x, car.z-fp.z)<22) { endRace(L,car); return; }
    }
  }
  checkCarCollisions(L);
  calcPositions(L);

  if(L.alive.size===1 && L.finishIdx===null && !L.voteOn) startFinishVote(L);
  if(L.alive.size===0){ endRace(L,null); return; }

  for(const [sid,p] of L.players){
    const me=L.cars.get(p.carId);
    io.to(sid).emit('tick',{
      cars:[...L.cars.values()].map(c=>({
        id:c.id, x:c.x, z:c.z, angle:c.angle, speed:c.speed,
        hp:c.hp, eliminated:c.eliminated, boostT:c.boostT,
        driftT:c.driftT, driftSide:c.driftSide, shieldOn:c.shieldOn,
        hasMissile:c.hasMissile, hasEMP:c.hasEMP
      })),
      alive: L.alive.size,
      pos:   me ? me.position||1 : 1
    });
  }
}

function fireMissile(L, car) {
  car.hasMissile = false;
  let target = null, minDist = Infinity;
  for (const other of L.cars.values()) {
    if (other.id === car.id || other.eliminated) continue;
    const dx=other.x-car.x, dz=other.z-car.z, d=Math.hypot(dx,dz);
    const dot = (Math.sin(car.angle)*dx + Math.cos(car.angle)*dz)/d;
    if (dot > 0.5 && d < 150 && d < minDist) { minDist = d; target = other; }
  }
  io.to(L.id).emit('missile_fired', {fromId: car.id, targetId: target ? target.id : null});
  if (target) {
    setTimeout(() => {
      if (!target.eliminated && !target.shieldOn) {
        target.hp -= 25;
        target.speed *= 0.3;
        target.spinT = 1500;
        io.to(L.id).emit('car_hit', {id: target.id, type: 'missile'});
      } else if (target.shieldOn) {
        target.shieldOn = false;
        io.to(L.id).emit('car_hit', {id: target.id, type: 'shield_block'});
      }
    }, minDist / C.MISSILE_SPD * 1000);
  }
}

function fireEMP(L, car) {
  io.to(L.id).emit('emp_fired', {id: car.id});
  for (const other of L.cars.values()) {
    if (other.id === car.id || other.eliminated) continue;
    const d = Math.hypot(other.x - car.x, other.z - car.z);
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
  if(L.state!=='racing'||L.voteOn) return;
  L.voteOn=true;
  L.voteOpts=pick3(VOTE_POOL);
  L.votes.clear();
  io.to(L.id).emit('vote_start',{opts:L.voteOpts, dur:C.VOTE_DURATION, final:false});
  L.voteT=setTimeout(()=>resolveVote(L), C.VOTE_DURATION);
}

function startFinishVote(L) {
  if(L.voteOn) return;
  L.voteOn=true;
  L.voteOpts=[{...FINISH_OPT},{...FINISH_OPT},{...FINISH_OPT}];
  L.votes.clear();
  io.to(L.id).emit('vote_start',{opts:L.voteOpts, dur:C.VOTE_DURATION, final:true});
  L.voteT=setTimeout(()=>resolveVote(L), C.VOTE_DURATION);
}

function resolveVote(L) {
  L.voteOn=false;
  calcPositions(L);

  const counts={}, posList={};
  for(const o of L.voteOpts){ counts[o.id]=0; posList[o.id]=[]; }

  const sidToPos={};
  for(const car of L.cars.values())
    if(!car.eliminated && car.socketId) sidToPos[car.socketId]=car.position||999;

  // Simulate NPC votes weighted by their personality
  for(const car of L.cars.values()) {
    if(!car.isNPC || car.eliminated) continue;
    const opts = L.voteOpts;
    if(!opts.length) continue;
    // Aggressive NPCs prefer elimination/chaos, defensive prefer hazard zones/repair
    let pick;
    if(car.personality===1) pick = opts.find(o=>o.id.startsWith('elim')||o.id==='storm'||o.id==='gravity'||o.id==='damage_all') || opts[Math.floor(Math.random()*opts.length)];
    else if(car.personality===2) pick = opts.find(o=>o.id==='repair_all'||o.id==='boost'||o.id==='widen'||o.id==='shield_all') || opts[Math.floor(Math.random()*opts.length)];
    else if(car.personality===3) pick = opts[Math.floor(Math.random()*opts.length)]; // Erratic random
    else pick = opts.find(o=>!o.id.startsWith('elim')) || opts[0];
    if(pick && counts[pick.id]!==undefined) counts[pick.id]++;
  }

  for(const [sid,v] of L.votes){
    if(counts[v]!==undefined){
      counts[v]++;
      if(sidToPos[sid]!==undefined) posList[v].push(sidToPos[sid]);
    }
  }

  let winner=L.voteOpts[0].id, mxCount=-1, mnAvg=Infinity;
  for(const opt of L.voteOpts){
    const c=counts[opt.id];
    const arr=posList[opt.id];
    const avg=arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 999;
    if(c>mxCount||(c===mxCount&&avg<mnAvg)){ winner=opt.id; mxCount=c; mnAvg=avg; }
  }

  io.to(L.id).emit('vote_result',{winner,counts});
  applyEffect(L, winner);
  if(L.state==='racing') L.nextVoteT=setTimeout(()=>startVote(L), C.VOTE_INTERVAL);
}

function applyEffect(L, id) {
  const wps=L.wps, N=wps.length;

  // Track width
  if(id==='narrow')       { L.roadW=Math.max(10,L.roadW*0.76); io.to(L.id).emit('track_w',{w:L.roadW}); }
  else if(id==='widen')   { L.roadW=Math.min(44,L.roadW*1.28); io.to(L.id).emit('track_w',{w:L.roadW}); }
  else if(id==='mega_narrow'){ L.roadW=Math.max(8,L.roadW*0.60); io.to(L.id).emit('track_w',{w:L.roadW}); }
  else if(id==='mega_widen') { L.roadW=Math.min(50,L.roadW*1.50); io.to(L.id).emit('track_w',{w:L.roadW}); }

  // Zones
  else if(id==='boost')   addZone(L,'boost',22);
  else if(id==='spike')   addZone(L,'spike',18);
  else if(id==='oil')     addZone(L,'oil',16);
  else if(id==='shock_zone') addZone(L,'shock',20);
  else if(id==='freeze_zone') addZone(L,'freeze',18);
  else if(id==='mega_spike') addZone(L,'spike',28,true);
  else if(id==='double_spike'){ addZone(L,'spike',18); addZone(L,'spike',18); }
  else if(id==='double_boost'){ addZone(L,'boost',22); addZone(L,'boost',22); }
  else if(id==='triple_oil') { addZone(L,'oil',16); addZone(L,'oil',16); addZone(L,'oil',16); }
  else if(id==='boost_spike') { addZone(L,'boost',22); addZone(L,'spike',18); }
  else if(id==='oil_boost')   { addZone(L,'oil',16); addZone(L,'boost',22); }
  else if(id==='full_hazard') { addZone(L,'spike',18); addZone(L,'oil',16); addDebris(L,4); }

  // Debris
  else if(id==='debris') addDebris(L,6);
  else if(id==='maze_walls') addDebris(L,12);

  // Track deform
  else if(id==='warp'){
    const s=Math.floor(Math.random()*N), cnt=Math.floor(N*0.14);
    for(let i=0;i<cnt;i++){const idx=(s+i)%N;wps[idx].x+=(Math.random()-0.5)*110;wps[idx].z+=(Math.random()-0.5)*80;}
    io.to(L.id).emit('track_update',{wps,w:L.roadW,trackType:L.trackType});
  }
  else if(id==='quake'){
    for(const p of wps){p.x+=(Math.random()-0.5)*50;p.z+=(Math.random()-0.5)*38;}
    io.to(L.id).emit('track_update',{wps,w:L.roadW,trackType:L.trackType});
  }
  else if(id==='ripple'){
    for(let i=0;i<N;i++){const wave=Math.sin(i/N*Math.PI*6)*30;wps[i].x+=wave;wps[i].z+=wave*0.5;}
    io.to(L.id).emit('track_update',{wps,w:L.roadW,trackType:L.trackType});
  }
  else if(id==='compress'){
    for(const p of wps){p.x*=0.82;p.z*=0.82;}
    io.to(L.id).emit('track_update',{wps,w:L.roadW,trackType:L.trackType});
  }
  else if(id==='expand_track'||id==='extend_road'){
    for(const p of wps){p.x*=1.18;p.z*=1.18;}
    io.to(L.id).emit('track_update',{wps,w:L.roadW,trackType:L.trackType});
  }
  else if(id==='invert'){
    for(const p of wps){p.x=-p.x;p.z=-p.z;}
    io.to(L.id).emit('track_update',{wps,w:L.roadW,trackType:L.trackType});
  }
  else if(id==='flip_dir'){
    for(let i=0;i<Math.floor(N*0.5);i++){const a=Math.floor(Math.random()*N);wps[a].x=-wps[a].x;}
    io.to(L.id).emit('track_update',{wps,w:L.roadW,trackType:L.trackType});
  }
  else if(id==='widen_narrow'){
    L.roadW=Math.min(44,L.roadW*1.4); io.to(L.id).emit('track_w',{w:L.roadW});
    setTimeout(()=>{ L.roadW=Math.max(12,L.roadW*0.65); io.to(L.id).emit('track_w',{w:L.roadW}); }, 4000);
  }

  // Track swap
  else if(id.startsWith('new_track_')){
    const tIdx=parseInt(id.slice(10));
    L.wps=generateTrack(tIdx);
    L.trackType=tIdx;
    io.to(L.id).emit('track_update',{wps:L.wps,w:L.roadW});
    respawnPowerups(L);
  }

  // Physics
  else if(id==='gravity')   io.to(L.id).emit('gravity',{});
  else if(id==='reverse_grav'){ io.to(L.id).emit('gravity',{reverse:true}); }
  else if(id==='storm')     { io.to(L.id).emit('storm',{}); for(const c of L.cars.values()) if(!c.eliminated) c.speed+=(Math.random()-0.5)*65; }
  else if(id==='mega_storm'){ io.to(L.id).emit('storm',{mega:true}); for(const c of L.cars.values()) if(!c.eliminated){c.speed+=(Math.random()-0.5)*90;c.angle+=(Math.random()-0.5)*Math.PI;} }
  else if(id==='speed_surge'||id==='flash_boost'){ for(const c of L.cars.values()) if(!c.eliminated) c.boostT=C.BOOST_DUR; io.to(L.id).emit('storm',{type:'boost'}); }
  else if(id==='slow_field'){ for(const c of L.cars.values()) if(!c.eliminated) c.slowT=3000; io.to(L.id).emit('storm',{type:'slow'}); }
  else if(id==='freeze_all'){ for(const c of L.cars.values()) if(!c.eliminated){c.oilT=5000;c.speed*=0.2;} io.to(L.id).emit('storm',{type:'freeze'}); }
  else if(id==='spin_out'){ for(const c of L.cars.values()) if(!c.eliminated) c.spinT=2000; io.to(L.id).emit('storm',{type:'spin'}); }
  else if(id==='boost_rain'){ for(const c of L.cars.values()) if(!c.eliminated) c.boostT=C.BOOST_DUR*2; io.to(L.id).emit('storm',{type:'boost'}); }
  else if(id==='repair_all'){ for(const c of L.cars.values()) if(!c.eliminated) c.hp=Math.min(100,c.hp+40); }
  else if(id==='damage_all'){ for(const c of L.cars.values()) if(!c.eliminated) c.hp=Math.max(0,c.hp-30); }
  else if(id==='speed_all'){ for(const c of L.cars.values()) if(!c.eliminated) c.boostT=C.BOOST_DUR; }
  else if(id==='turbo_npc'){ for(const c of L.cars.values()) if(c.isNPC&&!c.eliminated) c.boostT=C.BOOST_DUR*2; }
  else if(id==='slow_npc'){ for(const c of L.cars.values()) if(c.isNPC&&!c.eliminated) c.oilT=5000; }
  else if(id==='no_walls'){ L.noWalls=true; L.noWallsT=5000; io.to(L.id).emit('storm',{type:'nowalls'}); }
  else if(id==='ghost_mode'){ L.ghostMode=true; L.ghostModeT=5000; io.to(L.id).emit('storm',{type:'ghost'}); }
  else if(id==='wave_boost'||id==='lightning_field'){ io.to(L.id).emit('storm',{type:'wave'}); for(const c of L.cars.values()) if(!c.eliminated&&Math.random()<0.5) c.boostT=C.BOOST_DUR; }
  else if(id==='random_chaos'){ const pool=['quake','storm','spike','boost','oil','gravity','elim_last']; applyEffect(L, pool[Math.floor(Math.random()*pool.length)]); return; }
  else if(id==='moving_barriers') addMovingBarriers(L);
  else if(id==='laser_gates') addLaserGates(L);
  else if(id==='fog_event'){ io.to(L.id).emit('fog_event',{dur:10000}); }
  else if(id==='low_grav'){ L.lowGravT=12000; io.to(L.id).emit('low_grav',{dur:12000}); }
  else if(id==='reverse_controls'){
    for(const c of L.cars.values()) if(!c.isNPC&&!c.eliminated) c.reverseT=Math.max(c.reverseT,5000);
    io.to(L.id).emit('storm',{type:'reverse'});
  }
  else if(id==='double_speed'){
    L.doubleSpeedT=8000;
    for(const c of L.cars.values()) if(!c.eliminated) c.boostT=Math.max(c.boostT,8000);
    io.to(L.id).emit('storm',{type:'doublespeed'});
  }

  // Elimination
  else if(id==='elim_last'){
    calcPositions(L);
    const sorted=[...L.alive].map(id=>L.cars.get(id)).filter(c=>c&&!c.eliminated).sort((a,b)=>(b.position||0)-(a.position||0));
    if(sorted.length>1) elimCar(L, sorted[sorted.length-1].id, 'vote');
  }
  else if(id==='elim_bottom2'){
    calcPositions(L);
    const sorted=[...L.alive].map(id=>L.cars.get(id)).filter(c=>c&&!c.eliminated).sort((a,b)=>(b.position||0)-(a.position||0));
    for(let i=0;i<Math.min(2,sorted.length-1);i++) elimCar(L, sorted[sorted.length-1-i].id, 'vote');
  }
  else if(id==='elim_bottom3'){
    calcPositions(L);
    const sorted=[...L.alive].map(id=>L.cars.get(id)).filter(c=>c&&!c.eliminated).sort((a,b)=>(b.position||0)-(a.position||0));
    for(let i=0;i<Math.min(3,sorted.length-1);i++) elimCar(L, sorted[sorted.length-1-i].id, 'vote');
  }
  else if(id==='elim_random'){
    const alive=[...L.alive].filter(id=>{ const c=L.cars.get(id); return c&&!c.eliminated; });
    if(alive.length>1){ const rid=alive[Math.floor(Math.random()*alive.length)]; elimCar(L, rid, 'vote'); }
  }

  // Finish
  else if(id==='finish'){
    let nearIdx=0, md=Infinity;
    const first=[...L.alive][0];
    if(first){
      const car=L.cars.get(first);
      for(let i=0;i<N;i++){const d=Math.hypot(wps[i].x-car.x,wps[i].z-car.z);if(d<md){md=d;nearIdx=i;}}
    }
    L.finishIdx=(nearIdx+Math.floor(N*0.38))%N;
    io.to(L.id).emit('finish_placed',{wi:L.finishIdx});
  }
}

function addZone(L, type, r, mega) {
  const wi=Math.floor(Math.random()*L.wps.length);
  const z={t:type,wi,r,mega:!!mega};
  L.zones.push(z);
  io.to(L.id).emit('zone',z);
}

function addDebris(L, count) {
  const N=L.wps.length, obs=[];
  for(let i=0;i<count;i++){
    const wi=Math.floor(Math.random()*N), wp=L.wps[wi];
    const nx=L.wps[(wi+1)%N], dx=nx.x-wp.x, dz=nx.z-wp.z, len=Math.hypot(dx,dz)||1;
    const off=(Math.random()-0.5)*L.roadW*0.5;
    obs.push({x:wp.x+(-dz/len)*off, z:wp.z+(dx/len)*off});
    L.obstacles.push(obs[obs.length-1]);
  }
  io.to(L.id).emit('obstacles',{obs});
}

function addMovingBarriers(L) {
  const N=L.wps.length;
  const barriers=[];
  for(let i=0;i<3;i++){
    const wi=Math.floor(Math.random()*N);
    const b={
      id:`b${Date.now()}_${i}`,
      wi, startTime:Date.now(),
      initPhase:Math.random()*Math.PI*2,
      freq:0.55+Math.random()*0.35,
      amp:L.roadW*0.32,
      r:3.5,
      x:L.wps[wi].x, z:L.wps[wi].z,
    };
    L.movingBarriers.push(b);
    barriers.push({id:b.id,wi:b.wi,startTime:b.startTime,initPhase:b.initPhase,freq:b.freq,amp:b.amp,r:b.r});
  }
  io.to(L.id).emit('moving_barriers',{barriers});
}

function addLaserGates(L) {
  const N=L.wps.length;
  const gates=[];
  for(let i=0;i<3;i++){
    const wi=Math.floor((i*N/3)+(Math.random()*(N/6)))%N;
    const g={
      id:`g${Date.now()}_${i}`,
      wi, startTime:Date.now(),
      cycleDur:1000+Math.floor(Math.random()*600),
    };
    L.laserGates.push(g);
    gates.push({id:g.id,wi:g.wi,startTime:g.startTime,cycleDur:g.cycleDur});
  }
  io.to(L.id).emit('laser_gates',{gates});
}

function respawnPowerups(L) {
  spawnPowerups(L);
}

function endRace(L, winner) {
  L.state='finished';
  clearInterval(L.tickT); clearTimeout(L.voteT); clearTimeout(L.nextVoteT);
  io.to(L.id).emit('race_over',{ winner: winner ? {id:winner.id,isNPC:winner.isNPC,vh:winner.vehicleId,name:winner.name} : null });
  setTimeout(()=>lobbies.delete(L.id), 30000);
}

// ── SOCKETS ───────────────────────────────────────────────────────────
io.on('connection', socket => {
  let L=null, myCarId=null;
  console.log('[+]', socket.id);

  socket.on('find_match', ({name,vh,customData,trackType}) => {
    if(!waitingLobby) waitingLobby=mkLobby(undefined, trackType !== undefined ? trackType : undefined);
    L=waitingLobby;
    socket.join(L.id);
    const idx=L.players.size;
    const car=mkCar(L, socket.id, vh||'civic_type_r', idx, customData);
    car.name=name||'PLAYER';
    myCarId=car.id;
    L.players.set(socket.id,{name:car.name, vh, carId:car.id, customData});
    socket.emit('joined',{carId:car.id, wps:L.wps, w:L.roadW, lobbyId:L.id, trackName:(TRACK_META[L.trackType] || TRACK_META[6]).name});
    io.to(L.id).emit('lobby_update',{count:L.players.size, max:L.maxPlayers,
      players:[...L.players.values()].map(p=>p.name)});
    if(L.players.size===1) L.startT=setTimeout(()=>beginRace(L), C.LOBBY_TIMEOUT);
    if(L.players.size>=L.maxPlayers){ clearTimeout(L.startT); waitingLobby=null; beginRace(L); }
  });

  socket.on('bot_race', ({vh, customData, trackType}) => {
    const botL = mkLobby(10, trackType !== undefined ? trackType : Math.floor(Math.random()*TRACK_META.length), false);
    socket.join(botL.id);
    const car = mkCar(botL, socket.id, vh||'civic_type_r', 0, customData);
    car.name = 'PLAYER';
    myCarId = car.id;
    L = botL;
    botL.players.set(socket.id,{name:'PLAYER', vh, carId:car.id, customData});
    socket.emit('joined',{carId:car.id, wps:botL.wps, w:botL.roadW, lobbyId:botL.id, trackName:(TRACK_META[botL.trackType] || TRACK_META[6]).name});
    beginRace(botL);
  });

  socket.on('create_private', ({name,vh,customData,mode,code,trackType}) => {
    const maxP = mode==='1v1'?2 : mode==='team'?6 : mode==='10'?10 : mode==='20'?20 : 30;
    const customCode = code ? code.toUpperCase().slice(0,5) : null;
    if (customCode && lobbies.has(customCode)) {
      socket.emit('join_error', {msg:'Code already in use. Choose another.'});
      return;
    }
    const tt = (trackType !== undefined && trackType >= 0) ? trackType : undefined;
    const privL = mkLobby(maxP, tt, true, customCode);
    socket.join(privL.id);
    const idx=0;
    const car=mkCar(privL, socket.id, vh||'civic_type_r', idx, customData);
    car.name=name||'PLAYER';
    myCarId=car.id;
    L=privL;
    privL.players.set(socket.id,{name:car.name, vh, carId:car.id, customData});
    socket.emit('private_created',{code:privL.id, carId:car.id, wps:privL.wps, w:privL.roadW});
    io.to(privL.id).emit('lobby_update',{count:privL.players.size, max:maxP,
      players:[...privL.players.values()].map(p=>p.name)});
  });

  socket.on('join_private', ({code, name, vh, customData}) => {
    const privL = lobbies.get(code.toUpperCase());
    if(!privL || privL.state!=='waiting'){ socket.emit('join_error',{msg:'Lobby not found or already started'}); return; }
    socket.join(privL.id);
    const idx=privL.players.size;
    const car=mkCar(privL, socket.id, vh||'civic_type_r', idx, customData);
    car.name=name||'PLAYER';
    myCarId=car.id;
    L=privL;
    privL.players.set(socket.id,{name:car.name, vh, carId:car.id, customData});
    socket.emit('joined',{carId:car.id, wps:privL.wps, w:privL.roadW, lobbyId:privL.id, trackName:(TRACK_META[privL.trackType] || TRACK_META[6]).name});
    io.to(privL.id).emit('lobby_update',{count:privL.players.size, max:privL.maxPlayers,
      players:[...privL.players.values()].map(p=>p.name)});
    if(privL.players.size>=privL.maxPlayers){ beginRace(privL); }
  });

  socket.on('private_start', () => {
    if(L && L.isPrivate && L.state==='waiting') beginRace(L);
  });

  socket.on('lobby_timer', ()=>{
    if(L && L.state==='waiting') socket.emit('lobby_tick',{remain:Math.max(0, C.LOBBY_TIMEOUT-(Date.now()-L.lastTick))});
  });

  socket.on('input', inp => {
    if(!L||!myCarId) return;
    const car=L.cars.get(myCarId);
    if(!car||car.eliminated) return;
    car.up=!!inp.u; car.dn=!!inp.d; car.lt=!!inp.l; car.rt=!!inp.r;
  });

  // ADDED: boost ability — client-managed cooldown, server applies the boostT
  socket.on('boost_ability', () => {
    if(!L||!myCarId) return;
    const car=L.cars.get(myCarId);
    if(!car||car.eliminated) return;
    car.boostT = Math.max(car.boostT, 2800); // 2.8s burst
  });

  socket.on('fire_missile', () => {
    if(!L||!myCarId) return;
    const car=L.cars.get(myCarId);
    if(!car||car.eliminated||!car.hasMissile) return;
    fireMissile(L, car);
  });

  socket.on('fire_emp', () => {
    if(!L||!myCarId) return;
    const car=L.cars.get(myCarId);
    if(!car||car.eliminated||!car.hasEMP) return;
    car.hasEMP = false;
    fireEMP(L, car);
  });

  socket.on('vote', ({optId}) => {
    if(!L||!L.voteOn||L.votes.has(socket.id)) return;
    // Dead players cannot vote
    const car=L.cars.get(myCarId);
    if(car && car.eliminated) return;
    L.votes.set(socket.id, optId);
    const counts={};
    for(const o of L.voteOpts) counts[o.id]=0;
    for(const [,v] of L.votes) if(counts[v]!==undefined) counts[v]++;
    io.to(L.id).emit('vote_update',{counts, total:L.votes.size});
  });

  socket.on('disconnect', () => {
    if(!L) return;
    L.players.delete(socket.id);
    const car=L.cars.get(myCarId);
    if(car){ car.socketId=null; car.isNPC=true; car.npcWp=car.npcWp||0; }
    io.to(L.id).emit('player_left',{carId:myCarId});
    if(L===waitingLobby && L.players.size===0){ waitingLobby=null; lobbies.delete(L.id); }
  });
});

function beginRace(L) {
  if(L.state!=='waiting') return;
  L.state='racing'; waitingLobby=null;
  fillNPCs(L);
  L.lastTick=Date.now();
  const meta = TRACK_META[L.trackType] || TRACK_META[6];
  io.to(L.id).emit('race_start',{
    cars:[...L.cars.values()].map(c=>({
      id:c.id, x:c.x, z:c.z, angle:c.angle,
      vh:c.vehicleId, isNPC:c.isNPC, name:c.name, hp:c.hp,
      socketId:c.socketId, custom:c.custom
    })),
    wps:L.wps, w:L.roadW,
    trackName: meta.name,
    trackType: L.trackType,
    isBoat: meta.isBoat,
    isPlane: meta.isPlane,
  });
  spawnPowerups(L);
  L.tickT=setInterval(()=>tickLobby(L), C.TICK_MS);
  L.nextVoteT=setTimeout(()=>startVote(L), C.VOTE_INTERVAL);
}

srv.listen(8080, ()=>console.log('CyberTrack ▶  http://localhost:8080'));
