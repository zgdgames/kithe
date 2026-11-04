'use strict';
// ═══════════════════════════════════════════════════════════════════════
// VEHICLES + CUSTOMIZATION DATA
// ═══════════════════════════════════════════════════════════════════════
const VEHICLES = {
  civic_type_r:  {name:'CIVIC TYPE R',  make:'Honda',        col:0xff3344,em:0x660011,accel:28,top:44,hand:2.4,hp:90, wins:0,  desc:'Hot hatch icon. All-round champ.',      stats:[3,4,2]},
  gr86:          {name:'GR86',          make:'Toyota',       col:0xcccccc,em:0x444444,accel:30,top:46,hand:2.8,hp:85, wins:3,  desc:'Rear-wheel drive. Pure driving joy.',   stats:[3,5,2]},
  skyline_r34:   {name:'SKYLINE GT-R',  make:'Nissan',       col:0x4488ff,em:0x001144,accel:34,top:52,hand:2.6,hp:95, wins:8,  desc:'R34 legend. All-wheel drive hero.',     stats:[4,4,3]},
  mustang_gt500: {name:'MUSTANG GT500', make:'Ford',         col:0x2255cc,em:0x001133,accel:38,top:56,hand:1.8,hp:120,wins:15, desc:'V8 American muscle. Brute force.',      stats:[5,2,4]},
  porsche_gt3:   {name:'PORSCHE 911 GT3',make:'Porsche',     col:0xffffff,em:0x333333,accel:36,top:58,hand:3.2,hp:80, wins:25, desc:'Track-tuned. Surgical precision.',      stats:[4,5,2]},
  lambo_huracan: {name:'HURACÁN EVO',   make:'Lamborghini',  col:0xffcc00,em:0x443300,accel:42,top:64,hand:2.4,hp:90, wins:40, desc:'V10 mid-engine thunder. 640 hp.',       stats:[5,4,2]},
  ferrari_la:    {name:'LaFERRARI',     make:'Ferrari',      col:0xff0000,em:0x440000,accel:46,top:70,hand:2.6,hp:85, wins:60, desc:'963 hp hybrid hypercar. The limit.',    stats:[5,4,2]},
  bugatti_chiron:{name:'CHIRON',        make:'Bugatti',      col:0x1144cc,em:0x001144,accel:50,top:80,hand:2.0,hp:100,wins:100,desc:'1500 hp W16. Nothing comes close.',      stats:[5,3,3]},
  f1_concept:    {name:'F1 CONCEPT',    make:'Formula 1',    col:0xff0011,em:0x440000,accel:70,top:110,hand:3.4,hp:50, wins:150,desc:'Open wheel. 1000 hp. Pure track weapon.',stats:[5,5,1], type:'f1'},
};

const PAINTS = [
  // Row 1 — neon spectrum
  0x00ffcc, 0x00ffaa, 0x00ddff, 0x0088ff, 0x4488ff, 0x8844ff, 0xaa00ff,
  0xff00ff, 0xff0088, 0xff0044, 0xff4400, 0xff8800, 0xffaa00,
  // Row 2 — vivid solids
  0xffff00, 0xddff00, 0x88ff00, 0x44ff00, 0x00ff44, 0x00ff88, 0x00ffee,
  0x00eeff, 0x0066ff, 0x6600ff, 0xff0066, 0xff6600, 0xff9900,
  // Row 3 — neutrals + deep
  0xffffff, 0xdddddd, 0x999999, 0x555566, 0x222233, 0x001122, 0x220011,
  0x441100, 0x664400, 0x336622, 0x003366, 0x330066, 0x660033,
];

const WHEEL_STYLES = [
  {id:'sport',  name:'SPORT',   spokes:5, radius:0.50, width:0.36, thick:false},
  {id:'mesh',   name:'MESH',    spokes:12,radius:0.54, width:0.40, thick:false},
  {id:'rally',  name:'RALLY',   spokes:3, radius:0.58, width:0.50, thick:true},
  {id:'star',   name:'STAR',    spokes:6, radius:0.52, width:0.32, thick:false},
  {id:'drag',   name:'DRAG',    spokes:0, radius:0.46, width:0.60, thick:true},
  {id:'blade',  name:'BLADE',   spokes:4, radius:0.55, width:0.38, thick:false},
  {id:'classic',name:'CLASSIC', spokes:8, radius:0.48, width:0.34, thick:false},
];

const EXHAUSTS = [
  {id:'none',      name:'NONE',      col:0x000000},
  {id:'flame',     name:'FLAME',     col:0xff5500},
  {id:'electric',  name:'ELECTRIC',  col:0x00ddff},
  {id:'plasma',    name:'PLASMA',    col:0xff00ff},
  {id:'smoke',     name:'SMOKE',     col:0x888888},
  {id:'rainbow',   name:'PRISM',     col:0xffffff}, // rainbow handled specially
  {id:'lightning', name:'LIGHTNING', col:0xffff66},
  {id:'embers',    name:'EMBERS',    col:0xff8800},
  {id:'void',      name:'VOID',      col:0x6600ff},
  {id:'frost',     name:'FROST',     col:0xaaffff},
  {id:'gold',      name:'GOLD',      col:0xffcc00},
];

const PAINT_TARGETS = ['body','bumpers','trim','wheels','lights'];

const STICKERS = [
  {id:'none',    name:'NONE'},
  {id:'stripes', name:'STRIPES'},
  {id:'flame',   name:'FLAMES'},
  {id:'circuit', name:'CIRCUIT'},
  {id:'checker', name:'CHECKER'},
];

function _emissive(col) {
  return (Math.round(((col>>16)&0xff)*0.18)<<16)|(Math.round(((col>>8)&0xff)*0.18)<<8)|Math.round((col&0xff)*0.18);
}

// ═══════════════════════════════════════════════════════════════════════
// PERSISTENT STATE (localStorage)
// ═══════════════════════════════════════════════════════════════════════
let wins = parseInt(localStorage.getItem('ct_wins') || '0');

let custom;
try { custom = JSON.parse(localStorage.getItem('ct_custom') || 'null') || {}; }
catch(e) { custom = {}; }

function ensureCustomDefaults() {
  // Migrate old fictional vehicle IDs to real car IDs
  const oldToNew = {neon_runner:'civic_type_r', glitch_rider:'gr86', phase_runner:'skyline_r34', shadow_beast:'mustang_gt500'};
  if (oldToNew[custom.vehicle]) custom.vehicle = oldToNew[custom.vehicle];
  if (!custom.vehicle || !VEHICLES[custom.vehicle]) custom.vehicle = 'civic_type_r';
  const vh = VEHICLES[custom.vehicle];
  // Migrate old single-paint
  if (custom.paint !== undefined && custom.bodyPaint === undefined) custom.bodyPaint = custom.paint;
  delete custom.paint;
  if (custom.bodyPaint    === undefined) custom.bodyPaint    = vh.col;
  if (custom.bumpersPaint === undefined) custom.bumpersPaint = 0x222233;
  if (custom.trimPaint    === undefined) custom.trimPaint    = vh.col;
  if (custom.wheelsPaint  === undefined) custom.wheelsPaint  = 0x999988;
  if (custom.lightsPaint  === undefined) custom.lightsPaint  = 0xffffff;
  if (custom.wheels       === undefined) custom.wheels  = 'sport';
  if (custom.exhaust      === undefined) custom.exhaust = 'flame';
  if (custom.sticker      === undefined) custom.sticker = 'none';
}
ensureCustomDefaults();

function saveCustom() { localStorage.setItem('ct_custom', JSON.stringify(custom)); }

let activePaintTarget = 'body';
let powerupMeshes = {};  // id → mesh
let isEliminated = false;

function paintForTarget(c, target, vh) {
  const key = target + 'Paint';
  if (c && c[key] !== undefined) return c[key];
  if (c && c.paint !== undefined && (target==='body' || target==='trim')) return c.paint;
  const defs = {body:vh.col, bumpers:0x222233, trim:vh.col, wheels:0x999988, lights:0xffffff};
  return defs[target] !== undefined ? defs[target] : vh.col;
}

// ═══════════════════════════════════════════════════════════════════════
// GLOBAL STATE
// ═══════════════════════════════════════════════════════════════════════
let myCarId    = null;
let gamePhase  = 'home';
let wps        = [];
let roadW      = 24;
let zones      = [];
let obstacles  = [];
let finishWI   = null;
let aliveN     = 0;
let myPos      = 1;
let totalRacers= 10;
let raceIsBoat = false;
let raceIsPlane= false;
let specTarget = null;

const serverCars = {};
let localCar = null;

const K = {u:false, d:false, l:false, r:false, boost:false}; // MODIFIED: added boost
let inputDirty = false;
let lastInputMs = 0;

// ADDED: boost ability state
let boostAbilityCooldown = 0;   // ms remaining until can boost again
const BOOST_ABILITY_DUR  = 2800; // ms active
const BOOST_ABILITY_CD   = 8000; // ms cooldown after expiry

// ADDED: gamepad camera offset (right stick)
let gpCamYaw = 0, gpCamPitch = 0;

// Three.js
let scene, cam, renderer;
let garageScene, garageCam, garageRenderer;
let trackMesh, leftWall, rightWall;
const carMeshes = {};
const zoneMeshes = [];
const obsMeshes  = [];
let finishMeshes = [];
const particles  = [];
let edgeLines = [], centerLine = null;

let gravSpike  = false;
let glitchStorm = false;
let glitchT    = 0;
let dmgFlashT  = 0;
let boostGlowT = 0;

let movingBarrierMeshes = {};
let laserGateMeshes = {};
let lowGravMode = false;
let lowGravEndT = 0;

// Track materialization animation
let materializing = null;  // {start, dur, partialMeshes}

// Materials
let roadMat, wallMat, groundMat;
const ZONE_MAT = { boost:null, spike:null, oil:null };

// Camera
const _camOffset     = new THREE.Vector3(0, 4, -10);
const _camLook       = new THREE.Vector3(0, 1.2, 8);
const _camOffsetPlane= new THREE.Vector3(0, 7, -18);
const _camLookPlane  = new THREE.Vector3(0, -1, 12);
const _tpos      = new THREE.Vector3();
const _tlook     = new THREE.Vector3();

// Cutscene
let cutscene = null;  // {start, dur, callback}

// Socket (lazy connect)
let socket = null;
function ensureSocket() {
  if (!socket) {
    socket = io();
    setupSocket();
  }
  return socket;
}

// Minimap
let mmCanvas, mmCtx;

// ═══════════════════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  initGarage();
  initRaceRenderer();
  initMaterials();
  setupInput();
  initMatrixCanvas();
  buildHomeUI();
  buildGarageUI();
  refreshGarageCar();
  showScreen('home');
  animGarage(0);
  animRace(0);
});

// ═══════════════════════════════════════════════════════════════════════
// NAVIGATION (called via inline onclick — guaranteed to work)
// ═══════════════════════════════════════════════════════════════════════
window.goToHome = function() {
  gamePhase = 'home';
  showScreen('home');
  buildHomeUI();
};

window.goToGarage = function() {
  gamePhase = 'garage';
  showScreen('garage');
  buildGarageUI();
  refreshGarageCar();
};

window.goToCutscene = function() {
  gamePhase = 'cutscene';
  ensureSocket();
  startCutscene(() => {
    const tt = selectedTrackType >= 0 ? selectedTrackType : undefined;
    const doEmit = () => socket.emit('find_match', { name:'PLAYER_'+(Math.random()*9999|0), vh:custom.vehicle, customData:custom, trackType:tt });
    if (socket.connected) doEmit(); else socket.once('connect', doEmit);
    showScreen('lobby');
    gamePhase = 'lobby';
  });
};

window.startBotRace = function() {
  gamePhase = 'cutscene';
  ensureSocket();
  startCutscene(() => {
    const tt = selectedTrackType >= 0 ? selectedTrackType : undefined;
    const doEmit = () => socket.emit('bot_race', { vh:custom.vehicle, customData:custom, trackType:tt });
    if (socket.connected) doEmit(); else socket.once('connect', doEmit);
    showScreen('lobby');
    document.getElementById('lobby-title').textContent = 'LOADING BOT RACE';
    gamePhase = 'lobby';
  });
};

let _trackSelectMode = 'race';

window.openTrackSelect = function(mode) {
  _trackSelectMode = mode;
  const list = document.getElementById('track-select-list');
  if (!list) return;
  list.innerHTML = '';

  // Random option
  const rnd = document.createElement('div');
  rnd.className = 'track-btn' + (selectedTrackType === -1 ? ' selected' : '');
  rnd.innerHTML = '<span class="track-icon">🎲</span><span class="track-info"><span class="track-name">RANDOM</span><span class="track-desc">Server picks a random track</span></span>';
  rnd.onclick = () => { selectedTrackType = -1; list.querySelectorAll('.track-btn').forEach(b => b.classList.remove('selected')); rnd.classList.add('selected'); };
  list.appendChild(rnd);

  for (let i = 0; i < TRACK_NAMES.length; i++) {
    const t = TRACK_NAMES[i];
    const btn = document.createElement('div');
    btn.className = 'track-btn' + (selectedTrackType === i ? ' selected' : '');
    btn.innerHTML = `<span class="track-icon">${t.icon}</span><span class="track-info"><span class="track-name">${t.name}</span><span class="track-desc">${t.desc}</span></span>`;
    const idx = i;
    btn.onclick = () => { selectedTrackType = idx; list.querySelectorAll('.track-btn').forEach(b => b.classList.remove('selected')); btn.classList.add('selected'); };
    list.appendChild(btn);
  }

  document.getElementById('track-select-overlay').classList.remove('hidden');
};

window.closeTrackSelect = function() {
  document.getElementById('track-select-overlay').classList.add('hidden');
};

window.confirmTrackSelect = function() {
  document.getElementById('track-select-overlay').classList.add('hidden');
  if (_trackSelectMode === 'bot') startBotRace();
  else goToCutscene();
};

window.returnToGarage = function() {
  if (socket) { socket.disconnect(); socket = null; }
  gamePhase = 'garage';
  raceIsBoat = false; raceIsPlane = false;
  // Clean up vote-spawned objects
  for (const g of Object.values(movingBarrierMeshes)) if (scene) scene.remove(g);
  for (const lg of Object.values(laserGateMeshes)) if (scene) scene.remove(lg.mesh);
  movingBarrierMeshes = {};
  laserGateMeshes = {};
  lowGravMode = false;
  showScreen('garage');
  isEliminated = false;
  buildGarageUI();
  refreshGarageCar();
};

window.openFriendsPopup = function() {
  document.getElementById('friends-popup').classList.remove('hidden');
};
window.closeFriendsPopup = function() {
  document.getElementById('friends-popup').classList.add('hidden');
  _fp_showPanel('fp-main');
};

let fpSelectedMode = '10';
let fpNumpadMode = null;
let fpNumpadDigits = '';
let selectedTrackType = -1;
let garageMode = 'car';      // 'car' | 'boat' | 'plane'
let activeGarageTab = 'vehicle';

window.goToBoatGarage = function() {
  garageMode = 'boat'; selectedTrackType = 2; activeGarageTab = 'hull';
  if (garageScene) { garageScene.background.set(0x041830); garageScene.fog.color.set(0x041830); }
  buildGarageUI(); refreshGarageCar();
};
window.goToPlaneGarage = function() {
  garageMode = 'plane'; selectedTrackType = 9; activeGarageTab = 'fuselage';
  if (garageScene) { garageScene.background.set(0x1a3050); garageScene.fog.color.set(0x1a3050); }
  buildGarageUI(); refreshGarageCar();
};
window.goToCarGarage = function() {
  garageMode = 'car'; activeGarageTab = 'vehicle';
  if (garageScene) { garageScene.background.set(0x000814); garageScene.fog.color.set(0x000814); }
  buildGarageUI(); refreshGarageCar();
};

function _fp_showPanel(id) {
  ['fp-main','fp-mode-panel','fp-numpad-panel','fp-create-panel','fp-connecting-panel','fp-enter-panel']
    .forEach(p => { const el = document.getElementById(p); if (el) el.classList.toggle('hidden', p !== id); });
}

// ── CREATE CODE flow: main → mode select → numpad → waiting room ──
window.fp_create = function() {
  const modes = ['1v1','team','10','20','30'];
  const modeLabels = {'1v1':'1v1','team':'TEAM 6','10':'10P','20':'20P','30':'30P'};
  const modesEl = document.getElementById('fp-mode-btns');
  if (modesEl) {
    modesEl.innerHTML = '';
    modes.forEach(m => {
      const b = document.createElement('button');
      b.className = 'fp-mode-btn' + (m === fpSelectedMode ? ' selected' : '');
      b.textContent = modeLabels[m];
      b.onclick = () => { fpSelectedMode = m; modesEl.querySelectorAll('.fp-mode-btn').forEach(x => x.classList.toggle('selected', x===b)); };
      modesEl.appendChild(b);
    });
  }
  _fp_showPanel('fp-mode-panel');
};

window.fp_modeNext = function() {
  fp_showNumpad('create');
};

window.fp_modeCancel = function() {
  _fp_showPanel('fp-main');
};

// ── ENTER CODE flow: main → numpad → connecting ──
window.fp_enterCode = function() {
  fp_showNumpad('enter');
};

function fp_showNumpad(mode) {
  fpNumpadMode = mode;
  fpNumpadDigits = '';
  fp_updateNumpadDisplay();
  const label = document.getElementById('fp-numpad-label');
  if (label) label.textContent = mode === 'create' ? 'PICK YOUR CODE (5 DIGITS)' : "ENTER FRIEND'S CODE";
  _fp_showPanel('fp-numpad-panel');
}

function fp_updateNumpadDisplay() {
  const el = document.getElementById('fp-numpad-digits');
  if (!el) return;
  const chars = fpNumpadDigits.split('');
  while (chars.length < 5) chars.push('_');
  el.textContent = chars.join(' ');
}

window.fp_numpadKey = function(d) {
  if (fpNumpadDigits.length >= 5) return;
  fpNumpadDigits += d;
  fp_updateNumpadDisplay();
  if (fpNumpadDigits.length === 5) fp_numpadDone();
};

window.fp_numpadBack = function() {
  fpNumpadDigits = fpNumpadDigits.slice(0, -1);
  fp_updateNumpadDisplay();
};

window.fp_numpadDone = function() {
  if (fpNumpadDigits.length < 5) return;
  const code = fpNumpadDigits;

  if (fpNumpadMode === 'create') {
    // Step 3: waiting room
    document.getElementById('fp-code').textContent = code;
    const modeChosen = document.getElementById('fp-mode-chosen');
    if (modeChosen) {
      const modeLabels = {'1v1':'1v1','team':'TEAM 6','10':'10 PLAYERS','20':'20 PLAYERS','30':'30 PLAYERS'};
      modeChosen.textContent = 'MODE: ' + (modeLabels[fpSelectedMode] || fpSelectedMode);
    }
    ensureSocket();
    const tt = selectedTrackType >= 0 ? selectedTrackType : undefined;
    socket.emit('create_private', { name:'PLAYER_'+(Math.random()*9999|0), vh:custom.vehicle, customData:custom, mode:fpSelectedMode, code, trackType:tt });
    _fp_showPanel('fp-create-panel');
  } else {
    // Step 2: connecting panel
    const el = document.getElementById('fp-connecting-code');
    if (el) el.textContent = code.split('').join(' ');
    ensureSocket();
    socket.emit('join_private', { code, name:'PLAYER_'+(Math.random()*9999|0), vh:custom.vehicle, customData:custom });
    _fp_showPanel('fp-connecting-panel');
  }
};

window.fp_numpadCancel = function() {
  if (fpNumpadMode === 'create') _fp_showPanel('fp-mode-panel');
  else _fp_showPanel('fp-main');
};

window.fp_cancelCreate = function() {
  if (socket) { socket.disconnect(); socket = null; }
  _fp_showPanel('fp-main');
};

window.fp_cancelConnect = function() {
  if (socket) { socket.disconnect(); socket = null; }
  _fp_showPanel('fp-main');
};

window.fp_startPrivate = function() {
  if (socket) socket.emit('private_start');
  closeFriendsPopup();
  showScreen('lobby');
  gamePhase = 'lobby';
};

window.switchTab = function(tabId) {
  document.querySelectorAll('.ctab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('active', p.id === 'pane-' + tabId));
};

// ═══════════════════════════════════════════════════════════════════════
// HOME UI
// ═══════════════════════════════════════════════════════════════════════
function buildHomeUI() {
  document.getElementById('home-wins').textContent = wins;
}

// ═══════════════════════════════════════════════════════════════════════
// GARAGE 3D SCENE
// ═══════════════════════════════════════════════════════════════════════
let garageRimL = null, garageRimR = null, garageSpot = null;
let garageCarMesh = null, garageAngle = 0;
let garageDoorGroup = null;

function initGarage() {
  const cvs = document.getElementById('garage-canvas');
  garageScene = new THREE.Scene();
  garageScene.background = new THREE.Color(0x000814);
  garageScene.fog = new THREE.Fog(0x000814, 22, 80);

  garageCam = new THREE.PerspectiveCamera(45, 1, 0.1, 200);

  garageRenderer = new THREE.WebGLRenderer({canvas:cvs, antialias:true, powerPreference:'high-performance'});
  garageRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  garageRenderer.shadowMap.enabled = true;
  garageRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
  garageRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  garageRenderer.toneMappingExposure = 1.1;
  garageRenderer.outputColorSpace = THREE.SRGBColorSpace;

  resizeGarage();
  window.addEventListener('resize', () => { resizeGarage(); resizeRace(); resizeMatrix(); });

  garageScene.add(new THREE.HemisphereLight(0x8899cc, 0x111122, 0.7));
  const gFill = new THREE.DirectionalLight(0xaabbdd, 0.45);
  gFill.position.set(-6, 8, 10);
  garageScene.add(gFill);

  garageSpot = new THREE.SpotLight(0xfff8f0, 180, 40, 0.48, 0.5, 1.5);
  garageSpot.position.set(0, 16, 2);
  garageSpot.target.position.set(0, 0, 0);
  garageSpot.castShadow = true;
  garageSpot.shadow.mapSize.set(1024, 1024);
  garageSpot.shadow.camera.near = 2;
  garageSpot.shadow.camera.far = 32;
  garageSpot.shadow.bias = -0.003;
  garageScene.add(garageSpot); garageScene.add(garageSpot.target);

  garageRimR = new THREE.PointLight(0x00ffcc, 70, 28, 1.2);
  garageRimR.position.set(8, 4, -3);
  garageScene.add(garageRimR);

  garageRimL = new THREE.PointLight(0xff00ff, 60, 28, 1.2);
  garageRimL.position.set(-8, 4, -3);
  garageScene.add(garageRimL);

  // ── Garage room — silver/light gray industrial ───────────────────────
  const gWallMat  = new THREE.MeshLambertMaterial({color:0xb0b8c0, emissive:0x182028});
  const gFloorMat = new THREE.MeshLambertMaterial({color:0x888e96});
  // Floor (concrete)
  const gFloor = new THREE.Mesh(new THREE.BoxGeometry(40, 0.1, 36), gFloorMat);
  gFloor.position.set(0, -0.06, 2); garageScene.add(gFloor);
  // Floor grid lines
  const floorGrid = new THREE.GridHelper(36, 18, 0x7a8088, 0x6a7078);
  floorGrid.position.set(0, 0, 2); garageScene.add(floorGrid);
  // Back wall (slightly darker)
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(40, 20, 0.4), new THREE.MeshLambertMaterial({color:0x9aa2aa,emissive:0x101820}));
  backWall.position.set(0, 9, -16); garageScene.add(backWall);
  // Left wall
  const leftWallG = new THREE.Mesh(new THREE.BoxGeometry(0.4, 20, 36), gWallMat);
  leftWallG.position.set(-20, 9, 2); garageScene.add(leftWallG);
  // Right wall
  const rightWallG = new THREE.Mesh(new THREE.BoxGeometry(0.4, 20, 36), gWallMat);
  rightWallG.position.set(20, 9, 2); garageScene.add(rightWallG);
  // Ceiling (white)
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(40, 0.4, 36), new THREE.MeshLambertMaterial({color:0xdde0e4,emissive:0x404850}));
  ceil.position.set(0, 20, 2); garageScene.add(ceil);

  // ── Side pedestrian door (left wall, back area) ───────────────────────
  const doorFrameMat = new THREE.MeshLambertMaterial({color:0x7a8a9a, emissive:0x101820});
  const doorMat      = new THREE.MeshLambertMaterial({color:0xccddee, emissive:0x203040});
  // Door frame inset in left wall
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6.5, 3.2), doorFrameMat);
  doorFrame.position.set(-19.85, 3.25, -10); garageScene.add(doorFrame);
  // Door panel
  const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5.8, 2.6), doorMat);
  doorPanel.position.set(-19.78, 2.9, -10); garageScene.add(doorPanel);
  // Door window
  const doorWin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.0, 1.2),
    new THREE.MeshPhongMaterial({color:0x88aacc,transparent:true,opacity:0.6,shininess:200}));
  doorWin.position.set(-19.75, 4.6, -10); garageScene.add(doorWin);
  // Door handle
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.5),
    new THREE.MeshLambertMaterial({color:0xccaa88}));
  handle.position.set(-19.7, 3.0, -9.0); garageScene.add(handle);

  // ── Fluorescent overhead lights (white) ──────────────────────────────
  const fluoMat = new THREE.MeshBasicMaterial({color:0xffffff});
  for (let i = -1; i <= 1; i++) {
    const tube = new THREE.Mesh(new THREE.BoxGeometry(12, 0.12, 0.3), fluoMat);
    tube.position.set(i * 8, 19.8, -2); garageScene.add(tube);
    // Bright white PointLight
    const fl = new THREE.PointLight(0xffffff, 35, 28, 1.4);
    fl.position.set(i * 8, 18, -2); garageScene.add(fl);
    // Light fixture housing
    const housing = new THREE.Mesh(new THREE.BoxGeometry(12.4, 0.3, 0.8),
      new THREE.MeshLambertMaterial({color:0xcccccc}));
    housing.position.set(i*8, 19.7, -2); garageScene.add(housing);
  }

  // ── Tire stacks (left corner) ─────────────────────────────────────────
  const tireMat = new THREE.MeshLambertMaterial({color:0x1a1a1a, emissive:0x050505});
  const tireGeo = new THREE.TorusGeometry(0.85, 0.32, 8, 18);
  for (let col = 0; col < 3; col++) {
    for (let row = 0; row < 4; row++) {
      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.rotation.x = Math.PI/2;
      tire.position.set(-15.5 + col * 2.0, 0.35 + row * 0.7, -13);
      garageScene.add(tire);
    }
  }

  // ── Metal shelving unit (right wall area) ────────────────────────────
  const shelfMat = new THREE.MeshLambertMaterial({color:0x889aaa, emissive:0x182028});
  const shelfItemMats = [
    new THREE.MeshLambertMaterial({color:0xcc4400}), // red toolbox
    new THREE.MeshLambertMaterial({color:0x888888}), // grey parts
    new THREE.MeshLambertMaterial({color:0xffaa00}), // yellow can
    new THREE.MeshLambertMaterial({color:0x336699}), // blue container
    new THREE.MeshLambertMaterial({color:0x444444}), // dark metal part
    new THREE.MeshLambertMaterial({color:0xddcc88}), // cardboard box
  ];
  // Shelf uprights
  for (const x of [12, 18.5]) {
    const upright = new THREE.Mesh(new THREE.BoxGeometry(0.2, 10, 0.2), shelfMat);
    upright.position.set(x, 5, -14); garageScene.add(upright);
  }
  // Shelf boards (3 levels)
  for (let level = 0; level < 4; level++) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(6.7, 0.14, 1.8), shelfMat);
    board.position.set(15.25, 1.5 + level * 2.8, -14); garageScene.add(board);
  }
  // Items on shelves
  const shelfItemData = [
    {x:13.2,y:2.1,z:-14,w:1.0,h:0.6,d:0.6,m:0},{x:14.5,y:2.0,z:-14,w:0.4,h:0.5,d:0.4,m:2},
    {x:16.0,y:2.0,z:-14,w:1.5,h:0.45,d:1.0,m:5},{x:17.5,y:2.1,z:-14,w:0.5,h:0.6,d:0.5,m:3},
    {x:13.5,y:4.9,z:-14,w:0.8,h:0.8,d:0.8,m:1},{x:15.0,y:4.8,z:-14,w:1.8,h:0.5,d:0.9,m:4},
    {x:17.0,y:5.0,z:-14,w:0.6,h:1.0,d:0.6,m:2},{x:13.2,y:7.7,z:-14,w:0.7,h:0.7,d:0.7,m:0},
    {x:15.5,y:7.6,z:-14,w:1.2,h:0.6,d:0.8,m:5},{x:17.2,y:7.8,z:-14,w:0.5,h:0.9,d:0.5,m:3},
  ];
  for(const d of shelfItemData){
    const item=new THREE.Mesh(new THREE.BoxGeometry(d.w,d.h,d.d),shelfItemMats[d.m]);
    item.position.set(d.x,d.y,d.z); garageScene.add(item);
  }

  // ── Workbench (back-left area) ────────────────────────────────────────
  const benchMat = new THREE.MeshLambertMaterial({color:0x6a5a40, emissive:0x0a0800});
  const metalMat = new THREE.MeshLambertMaterial({color:0x99aabb, emissive:0x111a22});
  const benchTop = new THREE.Mesh(new THREE.BoxGeometry(10, 0.24, 2.4), benchMat);
  benchTop.position.set(-13, 4.12, -13.5); garageScene.add(benchTop);
  // Bench legs
  for (const lx of [-17.5, -8.5]) {
    for (const lz of [-12.5, -14.5]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.12, 0.3), metalMat);
      leg.position.set(lx, 2.06, lz); garageScene.add(leg);
    }
    // Lower shelf on bench
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 2.4), benchMat);
    shelf.position.set(lx, 1.8, -13.5); garageScene.add(shelf);
  }
  // Cross-bar under bench
  const crossbar = new THREE.Mesh(new THREE.BoxGeometry(9, 0.12, 0.12), metalMat);
  crossbar.position.set(-13, 1.8, -13.5); garageScene.add(crossbar);
  // Tools on bench
  const wrench = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 2.1), metalMat);
  wrench.position.set(-15.5, 4.3, -13.5); wrench.rotation.z=0.15; garageScene.add(wrench);
  const wrench2 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 1.6), metalMat);
  wrench2.position.set(-14.5, 4.3, -13.8); wrench2.rotation.z=-0.1; garageScene.add(wrench2);
  const redBox = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 0.8),
    new THREE.MeshLambertMaterial({color:0xcc2200}));
  redBox.position.set(-12, 4.56, -13.4); garageScene.add(redBox);
  const oilCan = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.7, 10),
    new THREE.MeshLambertMaterial({color:0xffaa00,emissive:0x331100}));
  oilCan.position.set(-10.5, 4.47, -13.6); garageScene.add(oilCan);
  // Bench lamp
  const lampArm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.4),metalMat);
  lampArm.position.set(-9, 5.2, -13.2); lampArm.rotation.z=0.4; garageScene.add(lampArm);
  const lampHead = new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.25,0.25,8),
    new THREE.MeshLambertMaterial({color:0xdddddd}));
  lampHead.position.set(-8.5, 5.6, -13.2); garageScene.add(lampHead);
  const lampLight = new THREE.PointLight(0xfff5cc, 12, 8, 2);
  lampLight.position.set(-8.5, 5.4, -13.2); garageScene.add(lampLight);

  // ── Oil drums (back-right corner) ────────────────────────────────────
  const drumCols = [0x223366, 0xcc2200, 0x226622];
  for(let d=0;d<3;d++){
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.7,0.7,1.8,12),
      new THREE.MeshLambertMaterial({color:drumCols[d],emissive:drumCols[d]>>3}));
    drum.position.set(14+d*1.6, 0.9, -14.5); garageScene.add(drum);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.7,0.7,0.1,12),
      new THREE.MeshLambertMaterial({color:0x888888}));
    lid.position.set(14+d*1.6, 1.85, -14.5); garageScene.add(lid);
  }

  // ── Floor jack + wheel stands ─────────────────────────────────────────
  const jackMat = new THREE.MeshLambertMaterial({color:0x334455,emissive:0x0a1020});
  const jackBase = new THREE.Mesh(new THREE.BoxGeometry(1.8,0.25,0.8),jackMat);
  jackBase.position.set(-7, 0.12, 8); garageScene.add(jackBase);
  const jackArm = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.8,0.2),jackMat);
  jackArm.position.set(-7,0.65,8); garageScene.add(jackArm);
  const jackPad = new THREE.Mesh(new THREE.BoxGeometry(0.6,0.1,0.6),jackMat);
  jackPad.position.set(-7,1.1,8); garageScene.add(jackPad);

  // ── Tool pegboard (back wall) ─────────────────────────────────────────
  const pegMat = new THREE.MeshLambertMaterial({color:0xccddee, emissive:0x101820});
  const peg = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 0.15), pegMat);
  peg.position.set(0, 10, -15.7); garageScene.add(peg);
  // Shadow lines on pegboard
  for(let row=0;row<5;row++){
    for(let col=0;col<8;col++){
      if(Math.random()<0.55){
        const toolShape = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.8+Math.random()*0.6, 0.18),
          new THREE.MeshLambertMaterial({color:[0x888888,0xaaaaaa,0xcc5500,0x446688][Math.floor(Math.random()*4)]})
        );
        toolShape.position.set(-5.5+col*1.5, 7.5+row*1.0, -15.5);
        garageScene.add(toolShape);
      }
    }
  }

  // ── Car lift pillars (far back, away from car on pedestal) ─────────
  const liftMat = new THREE.MeshLambertMaterial({color:0x8899aa, emissive:0x182030});
  for (const x of [-8, 8]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.55, 6, 0.55), liftMat);
    post.position.set(x, 3, -12); garageScene.add(post);
    // Arm extends along the wall, NOT crossing the car area
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 3.5), liftMat);
    arm.position.set(x, 1.0, -10.3); garageScene.add(arm);
    // Safety stripe on post
    for(let s=0;s<3;s++){
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.58,0.14,0.58),
        new THREE.MeshBasicMaterial({color:s%2===0?0xffcc00:0x111111}));
      stripe.position.set(x, 0.5+s*0.35, -12); garageScene.add(stripe);
    }
  }

  // ── Pedestal ─────────────────────────────────────────────────────────
  const plat = new THREE.Mesh(
    new THREE.CylinderGeometry(4.4, 4.8, 0.45, 48),
    new THREE.MeshPhongMaterial({color:0x111e2c, emissive:0x05101c, shininess:80, specular:0x334455})
  );
  plat.position.y = -0.22;
  plat.receiveShadow = true;
  garageScene.add(plat);

  // Glow rings
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(4.3 + i * 0.15, 0.05, 6, 64),
      new THREE.MeshBasicMaterial({color:0x00ffcc, transparent:true, opacity:0.7 - i*0.2})
    );
    ring.rotation.x = Math.PI/2;
    ring.position.y = 0.02 + i * 0.01;
    garageScene.add(ring);
  }

  // Floor disc
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(4.2, 48),
    new THREE.MeshBasicMaterial({color:0x002a36, transparent:true, opacity:0.55})
  );
  disc.rotation.x = -Math.PI/2;
  disc.position.y = 0.005;
  garageScene.add(disc);

  // Cyber grid floor
  const gridH = new THREE.GridHelper(180, 90, 0x002240, 0x000c1a);
  gridH.position.y = -0.23;
  garageScene.add(gridH);

  // ── Garage door (front, sectional, slides up during cutscene) ────────
  garageDoorGroup = new THREE.Group();
  const doorPanelMat = new THREE.MeshLambertMaterial({color:0x1a2a3a, emissive:0x0a1520});
  for (let panel = 0; panel < 5; panel++) {
    const dp = new THREE.Mesh(new THREE.BoxGeometry(40, 4.0, 0.35), doorPanelMat);
    dp.position.y = panel * 4.0 + 2.0;
    garageDoorGroup.add(dp);
    // Accent stripe per panel
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(40, 0.14, 0.38),
      new THREE.MeshBasicMaterial({color: panel % 2 === 0 ? 0x00aaff : 0x00ffcc})
    );
    stripe.position.y = panel * 4.0 + 3.95;
    garageDoorGroup.add(stripe);
  }
  garageDoorGroup.position.set(0, 0, 18);
  garageScene.add(garageDoorGroup);
}

function refreshGarageCar() {
  if (garageCarMesh) {
    detachTrail(garageCarMesh);
    garageScene.remove(garageCarMesh);
    disposeMeshGroup(garageCarMesh);
  }
  if (garageMode === 'boat') {
    garageCarMesh = makeBoatMesh(custom.vehicle, custom);
    garageCarMesh.position.set(0, 0, 0);
  } else if (garageMode === 'plane') {
    garageCarMesh = makePlaneMesh(custom.vehicle, custom);
    garageCarMesh.position.set(0, -1.8, 0);
  } else {
    garageCarMesh = makeCarMesh(custom.vehicle, custom);
    garageCarMesh.position.set(0, 0.06, 0);
    attachTrail(garageCarMesh, garageScene, custom.exhaust);
  }
  garageCarMesh.scale.set(1.2, 1.2, 1.2);
  garageScene.add(garageCarMesh);
}

function disposeMeshGroup(g) {
  g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) {
    if (Array.isArray(o.material)) o.material.forEach(m=>m.dispose());
    else o.material.dispose();
  }});
}

function resizeGarage() {
  garageRenderer.setSize(window.innerWidth, window.innerHeight);
  garageCam.aspect = window.innerWidth / window.innerHeight;
  garageCam.updateProjectionMatrix();
}

let _lastGarage = 0;
function animGarage(ts) {
  requestAnimationFrame(animGarage);
  const dt = Math.min((ts - _lastGarage)/1000, 0.05);
  _lastGarage = ts;

  // Render garage scene during home, garage, cutscene phases
  if (gamePhase !== 'home' && gamePhase !== 'garage' && gamePhase !== 'cutscene') return;

  if (cutscene) updateCutscene(ts);
  else if (gamePhase !== 'cutscene') {
    garageAngle += dt * 0.4;
    const r = 8.5, h = 2.5;
    garageCam.position.set(Math.sin(garageAngle)*r, h + Math.sin(garageAngle*0.5)*0.3, Math.cos(garageAngle)*r);
    garageCam.lookAt(0, 0.85, 0);
  }

  if (garageRimL) garageRimL.intensity = 50 + Math.sin(ts*0.002)*15;
  if (garageRimR) garageRimR.intensity = 60 + Math.sin(ts*0.002+1)*15;

  // Spin wheels of garage car (always for life)
  if (garageCarMesh) {
    garageCarMesh.updateMatrixWorld(true);
    garageCarMesh.children.filter(c => c.userData.wheel).forEach(w => { w.rotation.x += dt * 0.6; });
    // Particle trail (small in garage, full in cutscene)
    updateTrail(garageCarMesh, dt, cutscene ? 1.0 : 0.35);
  }

  garageRenderer.render(garageScene, garageCam);
}

// ═══════════════════════════════════════════════════════════════════════
// GARAGE CUSTOMIZATION UI
// ═══════════════════════════════════════════════════════════════════════
function _makeTabs(tabsEl, tabs) {
  tabsEl.innerHTML = '';
  for (const t of tabs) {
    const btn = document.createElement('button');
    btn.className = 'ctab' + (t.id === activeGarageTab ? ' active' : '');
    btn.textContent = t.label;
    btn.onclick = () => { activeGarageTab = t.id; buildGarageUI(); };
    tabsEl.appendChild(btn);
  }
}

function _makePane(panesEl, id) {
  const pane = document.createElement('div');
  pane.className = 'tab-pane' + (id === activeGarageTab ? ' active' : '');
  pane.id = 'pane-' + id;
  panesEl.appendChild(pane);
  return pane;
}

function _buildVehiclePane(el) {
  el.innerHTML = '';
  const selV = VEHICLES[custom.vehicle];
  const nameEl = document.createElement('div'); nameEl.className = 'vh-pane-name'; nameEl.textContent = selV.name; el.appendChild(nameEl);
  const descEl = document.createElement('div'); descEl.className = 'vh-desc'; descEl.textContent = selV.desc; el.appendChild(descEl);
  const slotsRow = document.createElement('div'); slotsRow.className = 'vh-slots-row';
  for (const [id, v] of Object.entries(VEHICLES)) {
    const locked = wins < v.wins;
    const slot = document.createElement('div');
    slot.className = 'vh-slot' + (locked?' locked':'') + (id===custom.vehicle?' selected':'');
    const hex = '#'+v.col.toString(16).padStart(6,'0');
    if (locked) {
      slot.innerHTML = `<div class="vh-lock">🔒</div><div style="font-size:7px;color:#446677;letter-spacing:1px">${v.make||''}</div><div class="vh-name">${v.name}</div><div class="vh-req" style="color:#ff6644;font-size:9px;font-weight:700;letter-spacing:1px">🏆 ${v.wins} WINS TO UNLOCK</div>`;
    } else {
      const bars = ['SPD','HND','ARM'].map((lbl,i)=>`<span style="color:#446677;font-size:7px">${lbl} </span><span style="display:inline-block;width:${v.stats[i]*10}px;height:3px;background:${hex};border-radius:1px;vertical-align:middle;"></span>`).join(' ');
      slot.innerHTML = `<div class="vh-bar" style="background:${hex};box-shadow:0 0 8px ${hex};"></div><div style="font-size:7px;color:#446677;letter-spacing:1px">${v.make||''}</div><div class="vh-name">${v.name}</div><div style="display:flex;flex-direction:column;gap:2px;align-items:center">${bars}</div>`;
      slot.onclick = () => { custom.vehicle = id; ensureCustomDefaults(); saveCustom(); buildGarageUI(); refreshGarageCar(); };
    }
    slotsRow.appendChild(slot);
  }
  el.appendChild(slotsRow);
}

function _buildPaintPane(el) {
  el.innerHTML = ''; el.style.flexDirection = 'column';
  const selV = VEHICLES[custom.vehicle];
  const targetRow = document.createElement('div'); targetRow.className = 'paint-target-row';
  for (const tgt of PAINT_TARGETS) {
    const btn = document.createElement('button');
    btn.className = 'paint-target-btn' + (tgt === activePaintTarget ? ' active' : '');
    btn.textContent = tgt.toUpperCase();
    btn.onclick = () => { activePaintTarget = tgt; buildGarageUI(); };
    targetRow.appendChild(btn);
  }
  el.appendChild(targetRow);
  const chipWrap = document.createElement('div'); chipWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;justify-content:center;';
  const currentColor = (custom[activePaintTarget + 'Paint'] !== undefined) ? custom[activePaintTarget + 'Paint'] : paintForTarget(custom, activePaintTarget, selV);
  for (const col of PAINTS) {
    const hex = '#'+col.toString(16).padStart(6,'0');
    const chip = document.createElement('div');
    chip.className = 'paint-chip' + (col === currentColor ? ' selected' : '');
    chip.style.background = hex; chip.style.boxShadow = `inset 0 -3px 0 rgba(0,0,0,0.4),0 3px 0 #001a22`;
    chip.onclick = () => { custom[activePaintTarget + 'Paint'] = col; saveCustom(); buildGarageUI(); refreshGarageCar(); };
    chipWrap.appendChild(chip);
  }
  el.appendChild(chipWrap);
}

function _buildWheelsPane(el) {
  el.innerHTML = '';
  for (const w of WHEEL_STYLES) {
    const b = document.createElement('div'); b.className = 'opt-btn' + (w.id===custom.wheels?' selected':'');
    const wc = '#'+(custom.wheelsPaint||0x999988).toString(16).padStart(6,'0');
    b.innerHTML = `<span style="display:inline-block;width:${Math.round(w.radius*28)}px;height:${Math.round(w.width*28)}px;border-radius:50%;border:${w.thick?'5px':'3px'} solid ${wc};margin-right:8px;vertical-align:middle;"></span>${w.name}`;
    b.onclick = () => { custom.wheels = w.id; saveCustom(); buildGarageUI(); refreshGarageCar(); };
    el.appendChild(b);
  }
}

function _buildExhaustPane(el) {
  el.innerHTML = '';
  for (const e of EXHAUSTS) {
    const b = document.createElement('div'); b.className = 'opt-btn' + (e.id===custom.exhaust?' selected':'');
    const hex = '#'+e.col.toString(16).padStart(6,'0');
    b.innerHTML = e.id === 'none' ? e.name : `<span class="opt-swatch" style="background:${hex};box-shadow:0 0 6px ${hex};"></span>${e.name}`;
    b.onclick = () => { custom.exhaust = e.id; saveCustom(); buildGarageUI(); refreshGarageCar(); };
    el.appendChild(b);
  }
}

function _buildStickerPane(el) {
  el.innerHTML = '';
  for (const s of STICKERS) {
    const b = document.createElement('div'); b.className = 'opt-btn' + (s.id===custom.sticker?' selected':'');
    b.textContent = s.name;
    b.onclick = () => { custom.sticker = s.id; saveCustom(); buildGarageUI(); refreshGarageCar(); };
    el.appendChild(b);
  }
}

function _buildTrackPane(el) {
  el.innerHTML = ''; el.style.flexDirection = 'column'; el.style.gap = '6px';
  const randBtn = document.createElement('div');
  randBtn.className = 'track-btn' + (selectedTrackType === -1 ? ' selected' : '');
  randBtn.innerHTML = '<span class="track-icon">🎲</span><span class="track-info"><span class="track-name">RANDOM</span><span class="track-desc">Server picks a random track</span></span>';
  randBtn.onclick = () => { selectedTrackType = -1; buildGarageUI(); };
  el.appendChild(randBtn);
  for (let i = 0; i < TRACK_NAMES.length; i++) {
    const t = TRACK_NAMES[i];
    const btn = document.createElement('div');
    btn.className = 'track-btn' + (selectedTrackType === i ? ' selected' : '');
    btn.innerHTML = `<span class="track-icon">${t.icon}</span><span class="track-info"><span class="track-name">${t.name}</span><span class="track-desc">${t.desc}</span></span>`;
    const idx = i; btn.onclick = () => { selectedTrackType = idx; buildGarageUI(); };
    el.appendChild(btn);
  }
}

function buildGarageUI() {
  // ── Header ──
  const titleEl = document.getElementById('garage-title-text');
  const leftEl  = document.getElementById('garage-header-left');
  const rightEl = document.getElementById('garage-header-right');

  const winsHtml = `<div class="wins-pill">WINS: <span id="garage-wins">${wins}</span></div>`;

  if (garageMode === 'boat') {
    if (titleEl) titleEl.textContent = 'BOAT GARAGE';
    if (leftEl)  leftEl.innerHTML  = `<button class="btn-icon" onclick="goToCarGarage()">◀  CAR GARAGE</button>`;
    if (rightEl) rightEl.innerHTML = winsHtml;
  } else if (garageMode === 'plane') {
    if (titleEl) titleEl.textContent = 'PLANE GARAGE';
    if (leftEl)  leftEl.innerHTML  = `<button class="btn-icon" onclick="goToCarGarage()">◀  CAR GARAGE</button>`;
    if (rightEl) rightEl.innerHTML = winsHtml;
  } else {
    if (titleEl) titleEl.textContent = 'GARAGE';
    if (leftEl)  leftEl.innerHTML  = `<button class="btn-icon" onclick="goToHome()">◀  BACK</button><button class="btn-icon" style="color:#00ccff;border-color:#00ccff44;font-size:9px;" onclick="goToBoatGarage()">🌊 BOAT GARAGE</button>`;
    if (rightEl) rightEl.innerHTML = `${winsHtml}<button class="btn-icon" style="color:#88aaff;border-color:#88aaff44;font-size:9px;" onclick="goToPlaneGarage()">✈ PLANE GARAGE</button>`;
  }

  // ── Tabs & panes ──
  const tabsEl  = document.getElementById('garage-tabs');
  const panesEl = document.getElementById('garage-panes');
  if (!tabsEl || !panesEl) return;

  if (garageMode === 'boat') {
    const tabs = [{id:'hull',label:'HULL'},{id:'accents',label:'ACCENTS'},{id:'decal',label:'DECAL'},{id:'track',label:'TRACK'}];
    if (!tabs.find(t=>t.id===activeGarageTab)) activeGarageTab = 'hull';
    _makeTabs(tabsEl, tabs); panesEl.innerHTML = '';
    if (activeGarageTab === 'hull') {
      const p = _makePane(panesEl,'hull');
      _buildColorPane(p,'boatHull','HULL COLOR','boatHullPaint');
    } else if (activeGarageTab === 'accents') {
      const p = _makePane(panesEl,'accents'); p.style.flexDirection='column';
      const la = document.createElement('div'); la.style.cssText='font-size:9px;letter-spacing:.1em;color:#446677;margin-bottom:4px;width:100%;'; la.textContent='ACCENT / STRIPE'; p.appendChild(la);
      _buildColorPane(p,'boatAccent','ACCENT','boatAccentPaint');
    } else if (activeGarageTab === 'decal') {
      _buildStickerPane(_makePane(panesEl,'decal'));
    } else {
      _buildTrackPane(_makePane(panesEl,'track'));
    }
  } else if (garageMode === 'plane') {
    const tabs = [{id:'fuselage',label:'FUSELAGE'},{id:'wings',label:'WINGS'},{id:'decal',label:'DECAL'},{id:'track',label:'TRACK'}];
    if (!tabs.find(t=>t.id===activeGarageTab)) activeGarageTab = 'fuselage';
    _makeTabs(tabsEl, tabs); panesEl.innerHTML = '';
    if (activeGarageTab === 'fuselage') {
      const p = _makePane(panesEl,'fuselage');
      _buildColorPane(p,'planeLivery','FUSELAGE COLOR','planeLiveryPaint');
    } else if (activeGarageTab === 'wings') {
      const p = _makePane(panesEl,'wings'); p.style.flexDirection='column';
      const la = document.createElement('div'); la.style.cssText='font-size:9px;letter-spacing:.1em;color:#446677;margin-bottom:4px;width:100%;'; la.textContent='WING / ENGINE COLOR'; p.appendChild(la);
      _buildColorPane(p,'planeAccent','WINGS','planeAccentPaint');
    } else if (activeGarageTab === 'decal') {
      _buildStickerPane(_makePane(panesEl,'decal'));
    } else {
      _buildTrackPane(_makePane(panesEl,'track'));
    }
  } else {
    const tabs = [{id:'vehicle',label:'VEHICLE'},{id:'paint',label:'PAINT'},{id:'wheels',label:'WHEELS'},{id:'exhaust',label:'EXHAUST'},{id:'decal',label:'DECAL'},{id:'track',label:'TRACK'}];
    if (!tabs.find(t=>t.id===activeGarageTab)) activeGarageTab = 'vehicle';
    _makeTabs(tabsEl, tabs); panesEl.innerHTML = '';
    if (activeGarageTab === 'vehicle') _buildVehiclePane(_makePane(panesEl,'vehicle'));
    else if (activeGarageTab === 'paint')   _buildPaintPane(_makePane(panesEl,'paint'));
    else if (activeGarageTab === 'wheels')  _buildWheelsPane(_makePane(panesEl,'wheels'));
    else if (activeGarageTab === 'exhaust') _buildExhaustPane(_makePane(panesEl,'exhaust'));
    else if (activeGarageTab === 'decal')   _buildStickerPane(_makePane(panesEl,'decal'));
    else if (activeGarageTab === 'track')   _buildTrackPane(_makePane(panesEl,'track'));
  }

  // ── Bottom buttons ──
  const btnRow = document.getElementById('garage-btn-row');
  if (btnRow) {
    if (garageMode === 'boat') {
      btnRow.innerHTML = `<button class="btn-big btn-bot" onclick="selectedTrackType=2;openTrackSelect('bot')">BOT WATER RACE ▶</button><button class="btn-big" onclick="selectedTrackType=2;openTrackSelect('race')">RACE ON WATER ▶</button>`;
    } else if (garageMode === 'plane') {
      btnRow.innerHTML = `<button class="btn-big btn-bot" onclick="selectedTrackType=9;openTrackSelect('bot')">BOT SKY RACE ▶</button><button class="btn-big" onclick="selectedTrackType=9;openTrackSelect('race')">FLY THE SKY ▶</button>`;
    } else {
      btnRow.innerHTML = `<button class="btn-big btn-bot" onclick="openTrackSelect('bot')">BOT RACE ▶</button><button class="btn-big" onclick="openTrackSelect('race')">START RACE ▶</button><button class="btn-big btn-friends" onclick="openFriendsPopup()">RACE WITH FRIENDS</button>`;
    }
  }
}

function _buildColorPane(container, id, label, propKey) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;justify-content:center;';
  const cur = custom[propKey];
  for (const col of PAINTS) {
    const hex = '#'+col.toString(16).padStart(6,'0');
    const chip = document.createElement('div');
    chip.className = 'paint-chip' + (col === cur ? ' selected' : '');
    chip.style.background = hex;
    chip.style.boxShadow = `inset 0 -3px 0 rgba(0,0,0,0.4),0 3px 0 #001a22`;
    chip.onclick = () => { custom[propKey] = col; saveCustom(); buildGarageUI(); refreshGarageCar(); };
    wrap.appendChild(chip);
  }
  container.appendChild(wrap);
}

// ═══════════════════════════════════════════════════════════════════════
// ENVIRONMENT THEMES (one per track type 0–9)
// ═══════════════════════════════════════════════════════════════════════
const ENV_THEMES = [
  // 0 FARMLAND — sunny day, green fields
  {sky:0x5bc8f5,fog:[0xa8d8c0,80,600],ground:0x2d5a1b,wall:0x8b6914,wallEm:0x3a2a08,edge:0xd4a820,hemi:[0x99cc66,0x4a7a22],sun:[0xffeeaa,120,200,80]},
  // 1 FOREST — dark green, dense
  {sky:0x041008,fog:[0x061810,18,200],ground:0x041008,wall:0x00cc44,wallEm:0x005522,edge:0x00aa33,hemi:[0x224422,0x061008],sun:[0x88cc88,60,150,80]},
  // 2 OPEN WATER — ocean blue
  {sky:0x2288cc,fog:[0x1166aa,60,500],ground:0x0a3a6a,wall:0x00ccff,wallEm:0x005588,edge:0x00eeff,hemi:[0x224488,0x0a2244],sun:[0xaaddff,100,200,80]},
  // 3 BEACH — warm sandy, light blue sky
  {sky:0x87ceeb,fog:[0xaadde8,100,620],ground:0xc8aa60,wall:0x00aaff,wallEm:0x004488,edge:0x00ccff,hemi:[0x88bbcc,0xa09070],sun:[0xffeebb,120,200,80]},
  // 4 CAVE — pure black, glowing purple
  {sky:0x010104,fog:[0x010104,12,160],ground:0x010104,wall:0x9900ff,wallEm:0x5500cc,edge:0x8800ff,hemi:[0x110022,0x000000],sun:[0x6600cc,40,80,40]},
  // 5 VOLCANO — red/orange, lava glow
  {sky:0x0a0200,fog:[0x1a0500,20,250],ground:0x0a0200,wall:0xff4400,wallEm:0xcc1100,edge:0xff4400,hemi:[0x551100,0x0a0200],sun:[0xff6600,80,100,60]},
  // 6 CYBER GRID — dark cyber default
  {sky:0x000511,fog:[0x000814,30,400],ground:0x000511,wall:0x0077ff,wallEm:0x0044aa,edge:0x00aaff,hemi:[0x223355,0x000511],sun:[0x99aacc,80,150,60]},
  // 7 HOUSE — warm indoor, beige
  {sky:0x2a1e12,fog:[0x2a1e12,15,120],ground:0x3a2a18,wall:0xcc9966,wallEm:0x442200,edge:0xcc9966,hemi:[0x664433,0x221100],sun:[0xffddaa,40,80,30]},
  // 8 CITY NIGHT — urban, orange windows
  {sky:0x050a14,fog:[0x050a14,40,380],ground:0x060608,wall:0xff8800,wallEm:0x883300,edge:0xff8800,hemi:[0x222222,0x111100],sun:[0xffcc88,80,150,60]},
  // 9 SKY — bright blue, cloud white
  {sky:0x4aa8ff,fog:[0x88ccff,120,700],ground:0x88ccff,wall:0xffffff,wallEm:0xaaaaaa,edge:0xffffff,hemi:[0x88bbff,0x4488ff],sun:[0xffffff,120,250,100]},
  // 10 DOUBLE HELIX — neon purple
  {sky:0x080010,fog:[0x080010,30,340],ground:0x050008,wall:0xcc00ff,wallEm:0x660099,edge:0xcc00ff,hemi:[0x441166,0x110022],sun:[0xcc88ff,60,120,80]},
  // 11 NEON CITY — city night alt
  {sky:0x050a14,fog:[0x050a14,40,380],ground:0x060608,wall:0xff8800,wallEm:0x883300,edge:0xff8800,hemi:[0x222222,0x111100],sun:[0xffcc88,80,150,60]},
  // 12 STADIUM
  {sky:0x111122,fog:[0x111122,80,550],ground:0x080812,wall:0xffffff,wallEm:0x999999,edge:0xffffff,hemi:[0x8899aa,0x444455],sun:[0xffffff,120,200,80]},
  // 13 CHAOS ZONE
  {sky:0x060614,fog:[0x060614,24,300],ground:0x040410,wall:0x44ccff,wallEm:0x1166aa,edge:0x44ccff,hemi:[0x224466,0x040412],sun:[0x88bbff,60,200,100]},
];

let currentTrackType = 0;

// Track names matching server TRACK_META indices 0-13
const TRACK_NAMES = [
  {name:'FARMLAND',   icon:'🌾', desc:'Open fields, sweeping oval'},
  {name:'FOREST',     icon:'🌲', desc:'Tight winding forest roads'},
  {name:'OPEN WATER', icon:'🌊', desc:'Boat race — wide ocean circuit'},
  {name:'BEACH',      icon:'🏖', desc:'Coastal cruise, sweeping bends'},
  {name:'CAVE',       icon:'🕳', desc:'Underground — tight twisty tunnels'},
  {name:'VOLCANO',    icon:'🌋', desc:'Lava fields — dramatic and wide'},
  {name:'CYBER GRID', icon:'⚡', desc:'Default neon city grid'},
  {name:'HOUSE',      icon:'🏠', desc:'Indoor — extremely tight circuit'},
  {name:'CITY NIGHT', icon:'🌃', desc:'Urban night — angular streets'},
  {name:'SKY',        icon:'✈', desc:'Plane race — high altitude'},
  {name:'DOUBLE HELIX',icon:'🧬',desc:'Figure-8 style'},
  {name:'NEON CITY',  icon:'🌆', desc:'Neon urban circuit'},
  {name:'STADIUM',    icon:'🏟', desc:'Wide stadium oval'},
  {name:'CHAOS ZONE', icon:'🌀', desc:'Unpredictable chaos track'},
];

function applyEnvTheme(type) {
  currentTrackType = (type !== undefined && type !== null) ? type : 0;
  const th = ENV_THEMES[currentTrackType] || ENV_THEMES[0];
  scene.background = new THREE.Color(th.sky);
  scene.fog = new THREE.Fog(th.fog[0], th.fog[1], th.fog[2]);
  if (groundMat) groundMat.color.setHex(th.ground);
  if (wallMat) { wallMat.color.setHex(th.wall); wallMat.emissive.setHex(th.wallEm); }

  // Boat/plane: hide road, walls, grid, ground (ocean surface / sky props replace them)
  const isSpecial = (currentTrackType === 2 || currentTrackType === 9);
  if (roadMat) {
    roadMat.transparent = isSpecial; roadMat.opacity = isSpecial ? 0.0 : 1.0;
    roadMat.needsUpdate = true;
  }
  if (wallMat) {
    wallMat.transparent = isSpecial; wallMat.opacity = isSpecial ? 0.0 : 1.0;
    wallMat.needsUpdate = true;
  }
  if (groundMat) {
    groundMat.color.setHex(th.ground);
    groundMat.transparent = isSpecial; groundMat.opacity = isSpecial ? 0.0 : 1.0;
    groundMat.needsUpdate = true;
  }
  // Grid visible only on cyber/default track
  const gridMesh = scene.getObjectByName('raceGrid');
  if (gridMesh) gridMesh.visible = !isSpecial;
  // Edge railings always visible (fog:false already set), but hide for boat/sky
  edgeLines.forEach(l => {
    if (l.material) {
      l.material.color.setHex(th.edge);
      l.visible = !isSpecial;
    }
  });

  scene.children.forEach(c => {
    if (c.isHemisphereLight) { c.color.setHex(th.hemi[0]); c.groundColor.setHex(th.hemi[1]); }
    if (c.isDirectionalLight) { c.color.setHex(th.sun[0]); c.position.set(th.sun[1], th.sun[2], th.sun[3]); }
  });
  _spawnEnvProps(currentTrackType);
}

// Decorative environment props per theme (cleared + rebuilt on theme change)
const _envProps = [];
function _clearEnvProps() { _envProps.forEach(m => scene.remove(m)); _envProps.length = 0; }

function _spawnEnvProps(type) {
  _clearEnvProps();
  const N = wps.length;
  if (!N) return;
  const add = (m) => { scene.add(m); _envProps.push(m); };

  if (type === 0) {
    // Farmland: fence posts along track edges
    const fenceM = new THREE.MeshLambertMaterial({color:0x8b6914});
    const step = Math.max(1, Math.floor(N/40));
    for (let i = 0; i < N; i += step) {
      const wp = wps[i], nxt = wps[(i+1)%N];
      const dx = nxt.x-wp.x, dz = nxt.z-wp.z, len = Math.hypot(dx,dz)||1;
      const rx = -dz/len*(roadW*0.6), rz = dx/len*(roadW*0.6);
      for (const side of [-1,1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.3,2.2,0.3), fenceM);
        post.position.set(wp.x+rx*side, 1.1, wp.z+rz*side);
        add(post);
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12,0.12, step*4), fenceM);
        rail.position.set(wp.x+rx*side, 1.8, wp.z+rz*side);
        rail.rotation.y = Math.atan2(dx,dz);
        add(rail);
      }
    }
  } else if (type === 1) {
    // Forest: tree trunks + canopy
    const trunkM = new THREE.MeshLambertMaterial({color:0x3a1a05});
    const leafM  = new THREE.MeshLambertMaterial({color:0x1a4a0a});
    for (let i = 0; i < 60; i++) {
      const wp = wps[Math.floor(Math.random()*N)];
      const side = Math.random() < 0.5 ? -1 : 1;
      const off  = roadW*0.65 + Math.random()*12;
      const nxt  = wps[(wps.indexOf(wp)+1)%N] || wps[0];
      const dx = nxt.x-wp.x, dz = nxt.z-wp.z, len=Math.hypot(dx,dz)||1;
      const tx = wp.x + (-dz/len)*off*side, tz = wp.z + (dx/len)*off*side;
      const h = 5 + Math.random()*6;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.38,h,6), trunkM);
      trunk.position.set(tx, h/2, tz); add(trunk);
      const top = new THREE.Mesh(new THREE.ConeGeometry(2.2+Math.random(),4+Math.random()*3,7), leafM);
      top.position.set(tx, h+1.5, tz); add(top);
    }
  } else if (type === 5) {
    // Volcano: lava glow rocks
    const rockM = new THREE.MeshLambertMaterial({color:0x2a0800});
    const lavaM = new THREE.MeshBasicMaterial({color:0xff4400});
    for (let i = 0; i < 35; i++) {
      const wp = wps[Math.floor(Math.random()*N)];
      const side = Math.random()<0.5?-1:1;
      const off = roadW*0.65 + Math.random()*10;
      const nxt = wps[(wps.indexOf(wp)+1)%N] || wps[0];
      const dx=nxt.x-wp.x,dz=nxt.z-wp.z,len=Math.hypot(dx,dz)||1;
      const tx=wp.x+(-dz/len)*off*side, tz=wp.z+(dx/len)*off*side;
      const sz = 1.5+Math.random()*3;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(sz,0), rockM);
      rock.position.set(tx, sz*0.5, tz); rock.rotation.set(Math.random(),Math.random(),Math.random());
      add(rock);
      // Lava crack glow
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(sz*0.6, sz*0.3), lavaM);
      glow.rotation.x = -Math.PI/2; glow.position.set(tx, 0.06, tz);
      add(glow);
    }
  } else if (type === 4) {
    // Cave: stalactites from above
    const stalaM = new THREE.MeshLambertMaterial({color:0x1a1020});
    const glowM  = new THREE.MeshBasicMaterial({color:0x8800ff});
    for (let i = 0; i < 50; i++) {
      const wp = wps[Math.floor(Math.random()*N)];
      const h = 10 + Math.random()*6;
      const cx = wp.x + (Math.random()-0.5)*roadW*0.5;
      const cz = wp.z + (Math.random()-0.5)*10;
      const len2 = 3+Math.random()*5;
      const stal = new THREE.Mesh(new THREE.ConeGeometry(0.4,len2,5), stalaM);
      stal.rotation.z = Math.PI; stal.position.set(cx, h, cz);
      add(stal);
      if (Math.random()<0.3) {
        const gl = new THREE.Mesh(new THREE.SphereGeometry(0.18,5,5), glowM);
        gl.position.set(cx, h-len2*0.5, cz); add(gl);
      }
    }
  } else if (type === 8) {
    // City: building blocks off the sides
    const bldMat = new THREE.MeshLambertMaterial({color:0x111118, emissive:0x050508});
    const winMat = new THREE.MeshBasicMaterial({color:0xffaa33});
    const step2 = Math.max(1, Math.floor(N/20));
    for (let i = 0; i < N; i += step2) {
      const wp = wps[i], nxt = wps[(i+1)%N];
      const dx = nxt.x-wp.x, dz = nxt.z-wp.z, len = Math.hypot(dx,dz)||1;
      for (const side of [-1,1]) {
        const off = roadW*0.72 + Math.random()*8;
        const bw = 8+Math.random()*12, bd = 6+Math.random()*10, bh = 18+Math.random()*30;
        const bld = new THREE.Mesh(new THREE.BoxGeometry(bw,bh,bd), bldMat);
        bld.position.set(wp.x+(-dz/len)*off*side, bh/2, wp.z+(dx/len)*off*side);
        add(bld);
        // Window grid
        for (let wr = 1; wr < Math.floor(bh/3); wr++) {
          for (let wc = -1; wc <= 1; wc++) {
            if (Math.random()<0.55) {
              const win = new THREE.Mesh(new THREE.PlaneGeometry(1.2,1.0), winMat);
              win.position.set(bld.position.x+wc*2.5, wr*3, bld.position.z+bd/2*side*0.01+side*bd*0.501);
              win.rotation.y = side > 0 ? 0 : Math.PI;
              add(win);
            }
          }
        }
      }
    }
  } else if (type === 3) {
    // Beach: palm trees + sandy shore
    const trunkM2 = new THREE.MeshLambertMaterial({color:0x8b6914});
    const leafM2  = new THREE.MeshLambertMaterial({color:0x228833});
    const waterM = new THREE.MeshLambertMaterial({color:0x0077cc, transparent:true, opacity:0.75});
    const water = new THREE.Mesh(new THREE.PlaneGeometry(4000,4000), waterM);
    water.rotation.x = -Math.PI/2; water.position.y = -0.6; add(water);
    for (let i = 0; i < 35; i++) {
      const wi = Math.floor(Math.random()*N);
      const wp = wps[wi], nxt = wps[(wi+1)%N];
      const dx=nxt.x-wp.x,dz=nxt.z-wp.z,len=Math.hypot(dx,dz)||1;
      const side = Math.random()<0.5?-1:1, off = roadW*0.72+Math.random()*10;
      const tx=wp.x+(-dz/len)*off*side, tz=wp.z+(dx/len)*off*side;
      const h2=6+Math.random()*5;
      const trunk2=new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.3,h2,5), trunkM2);
      trunk2.position.set(tx,h2/2,tz); trunk2.rotation.z=(Math.random()-0.5)*0.4; add(trunk2);
      for (let leaf=0;leaf<5;leaf++){
        const la=(leaf/5)*Math.PI*2, lr=3.5+Math.random();
        const lf=new THREE.Mesh(new THREE.BoxGeometry(lr,0.08,0.5), leafM2);
        lf.position.set(tx+Math.cos(la)*lr*0.5,h2+0.4,tz+Math.sin(la)*lr*0.5);
        lf.rotation.y=la; lf.rotation.z=-0.4; add(lf);
      }
    }

  } else if (type === 2) {
    // OPEN WATER (boat race): full ocean surface — no road visible
    // Deep water base
    const deepWaterM = new THREE.MeshLambertMaterial({color:0x003a6e});
    const ocean = new THREE.Mesh(new THREE.PlaneGeometry(8000,8000), deepWaterM);
    ocean.rotation.x = -Math.PI/2; ocean.position.y = -0.2; add(ocean);

    // Shimmering surface layer
    const surfaceM = new THREE.MeshPhongMaterial({
      color:0x0066bb, specular:0x88ccff, shininess:80,
      transparent:true, opacity:0.82
    });
    const surface = new THREE.Mesh(new THREE.PlaneGeometry(8000,8000), surfaceM);
    surface.rotation.x = -Math.PI/2; surface.position.y = 0.05; add(surface);

    // Wave patches: lighter foam strips scattered across the ocean
    const foamM = new THREE.MeshBasicMaterial({color:0xaaddff, transparent:true, opacity:0.35});
    for (let i = 0; i < 120; i++) {
      const wx = (Math.random()-0.5)*1600, wz = (Math.random()-0.5)*1600;
      const wl = 12+Math.random()*40, ww = 1.5+Math.random()*4;
      const wave = new THREE.Mesh(new THREE.PlaneGeometry(wl,ww), foamM);
      wave.rotation.x = -Math.PI/2;
      wave.rotation.z = Math.random()*Math.PI;
      wave.position.set(wx, 0.08, wz); add(wave);
    }

    // Buoys along track boundary
    const buoyBodyM = new THREE.MeshLambertMaterial({color:0xff4400});
    const buoyTopM  = new THREE.MeshBasicMaterial({color:0xffee00});
    const step3 = Math.max(1, Math.floor(N/24));
    for (let i = 0; i < N; i += step3) {
      const wp = wps[i], nxt = wps[(i+1)%N];
      const dx=nxt.x-wp.x,dz=nxt.z-wp.z,len=Math.hypot(dx,dz)||1;
      for (const side of [-1,1]) {
        const ox=wp.x+(-dz/len)*(roadW*0.56)*side, oz=wp.z+(dx/len)*(roadW*0.56)*side;
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.5,1.4,8), buoyBodyM);
        body.position.set(ox, 0.5, oz); add(body);
        const top = new THREE.Mesh(new THREE.ConeGeometry(0.35,0.6,8), buoyTopM);
        top.position.set(ox, 1.45, oz); add(top);
      }
    }

    // Distant horizon: low-poly islands
    const islandM = new THREE.MeshLambertMaterial({color:0x44aa44});
    const sandIM  = new THREE.MeshLambertMaterial({color:0xddcc88});
    for (let i = 0; i < 8; i++) {
      const angle = (i/8)*Math.PI*2, dist = 550+Math.random()*200;
      const ix = Math.cos(angle)*dist, iz = Math.sin(angle)*dist;
      const iw = 40+Math.random()*60, ih = 4+Math.random()*12;
      const isle = new THREE.Mesh(new THREE.CylinderGeometry(iw*0.6,iw,ih,7), sandIM);
      isle.position.set(ix, ih*0.3, iz); add(isle);
      const veg = new THREE.Mesh(new THREE.ConeGeometry(iw*0.35,ih*1.2,7), islandM);
      veg.position.set(ix, ih+ih*0.4, iz); add(veg);
    }

  } else if (type === 9) {
    // SKY (plane race): clouds above and below, no ground
    const cloudMat = new THREE.MeshLambertMaterial({color:0xffffff, transparent:true, opacity:0.88});
    const cloudShadowM = new THREE.MeshLambertMaterial({color:0xccddee, transparent:true, opacity:0.55});

    // Cloud layer below (plane is flying above them)
    for (let i = 0; i < 60; i++) {
      const cx = (Math.random()-0.5)*2400, cz = (Math.random()-0.5)*2400;
      const cy = -8 - Math.random()*12;
      const cw = 30+Math.random()*80, cd = 20+Math.random()*50, ch = 4+Math.random()*8;
      const cloud = new THREE.Mesh(new THREE.BoxGeometry(cw,ch,cd), cloudMat);
      cloud.position.set(cx, cy, cz); add(cloud);
      // Secondary puff
      const p2 = new THREE.Mesh(new THREE.BoxGeometry(cw*0.7,ch*0.8,cd*0.6), cloudShadowM);
      p2.position.set(cx+cw*0.25, cy-1, cz+cd*0.2); add(p2);
    }

    // Cloud layer at track level (fly through them)
    for (let i = 0; i < 30; i++) {
      const cx = (Math.random()-0.5)*1800, cz = (Math.random()-0.5)*1800;
      const cy = 2+Math.random()*8;
      const cw = 25+Math.random()*55;
      const cloud = new THREE.Mesh(new THREE.BoxGeometry(cw, 5+Math.random()*6, cw*0.65), cloudMat);
      cloud.position.set(cx, cy, cz); cloud.rotation.y = Math.random()*Math.PI; add(cloud);
    }

    // Clouds above (high altitude wisps)
    for (let i = 0; i < 25; i++) {
      const cx = (Math.random()-0.5)*2000, cz = (Math.random()-0.5)*2000;
      const cy = 20+Math.random()*25;
      const wispM = new THREE.MeshBasicMaterial({color:0xeef5ff, transparent:true, opacity:0.4});
      const wisp = new THREE.Mesh(new THREE.BoxGeometry(40+Math.random()*80, 2, 8+Math.random()*20), wispM);
      wisp.position.set(cx, cy, cz); wisp.rotation.y = Math.random()*Math.PI; add(wisp);
    }

    // Distant mountains peeking above cloud floor
    const mtMat = new THREE.MeshLambertMaterial({color:0x8899aa});
    for (let i = 0; i < 10; i++) {
      const angle = (i/10)*Math.PI*2, dist = 600+Math.random()*200;
      const mx = Math.cos(angle)*dist, mz = Math.sin(angle)*dist;
      const mh = 40+Math.random()*60;
      const mt = new THREE.Mesh(new THREE.ConeGeometry(30+Math.random()*40, mh, 6), mtMat);
      mt.position.set(mx, -5+mh*0.1, mz); add(mt);
    }

    // Flight path glow lines (instead of road, show glowing waypoints)
    const pathM = new THREE.MeshBasicMaterial({color:0xaaccff, transparent:true, opacity:0.5});
    const step4 = Math.max(1, Math.floor(N/40));
    for (let i = 0; i < N; i += step4) {
      const wp = wps[i];
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.2, 6, 6), pathM);
      beacon.position.set(wp.x, 1.5, wp.z); add(beacon);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// RACE RENDERER
// ═══════════════════════════════════════════════════════════════════════
function initRaceRenderer() {
  const cvs = document.getElementById('race-canvas');
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000814);
  scene.fog = new THREE.FogExp2(0x000814, 0.0028);

  cam = new THREE.PerspectiveCamera(72, window.innerWidth/window.innerHeight, 0.3, 1800);

  renderer = new THREE.WebGLRenderer({canvas:cvs, antialias:true, powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  resizeRace();

  scene.add(new THREE.HemisphereLight(0x334466, 0x000511, 1.2));
  const sun = new THREE.DirectionalLight(0xb0c8ff, 1.1);
  sun.position.set(80, 200, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 1000;
  sun.shadow.camera.left = -400;
  sun.shadow.camera.right = 400;
  sun.shadow.camera.top = 400;
  sun.shadow.camera.bottom = -400;
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  const fillLight = new THREE.DirectionalLight(0x334477, 0.35);
  fillLight.position.set(-60, 80, -40);
  scene.add(fillLight);

  // Ground
  const groundGeo = new THREE.PlaneGeometry(3000, 3000);
  groundMat = new THREE.MeshPhongMaterial({color:0x000511, shininess:5, specular:0x001122});
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI/2; ground.position.y = -0.05;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(3000, 200, 0x001020, 0x000a18);
  grid.position.y = 0;
  grid.name = 'raceGrid';
  scene.add(grid);

  // Minimap
  const mm = document.createElement('div');
  mm.id = 'minimap';
  mmCanvas = document.createElement('canvas');
  mmCanvas.id = 'minimap-canvas';
  mmCanvas.width = 130; mmCanvas.height = 130;
  mm.appendChild(mmCanvas);
  document.body.appendChild(mm);
  mmCtx = mmCanvas.getContext('2d');
  mm.style.display = 'none';
}

function initMaterials() {
  roadMat = new THREE.MeshPhongMaterial({color:0x080c18, shininess:25, specular:0x112244, side:THREE.DoubleSide});
  wallMat = new THREE.MeshPhongMaterial({color:0x0077ff, emissive:0x0044aa, emissiveIntensity:0.8, shininess:80, specular:0x4488ff});
  ZONE_MAT.boost = new THREE.MeshPhongMaterial({color:0x00ffcc, emissive:0x00ffcc, emissiveIntensity:0.7, transparent:true, opacity:0.55, shininess:60});
  ZONE_MAT.spike = new THREE.MeshPhongMaterial({color:0xff0044, emissive:0xff0044, emissiveIntensity:0.7, transparent:true, opacity:0.55, shininess:60});
  ZONE_MAT.oil   = new THREE.MeshPhongMaterial({color:0x553300, emissive:0x221100, emissiveIntensity:0.5, transparent:true, opacity:0.60, shininess:30});
}

function resizeRace() {
  if (!renderer) return;
  renderer.setSize(window.innerWidth, window.innerHeight);
  cam.aspect = window.innerWidth / window.innerHeight;
  cam.updateProjectionMatrix();
}

// ═══════════════════════════════════════════════════════════════════════
// TRACK GEOMETRY
// ═══════════════════════════════════════════════════════════════════════
function buildRoadGeo(pts, w) {
  const N=pts.length, verts=[], idx=[], uvs=[];
  for(let i=0;i<N;i++){
    const c=pts[i], n=pts[(i+1)%N];
    const dx=n.x-c.x, dz=n.z-c.z, len=Math.hypot(dx,dz)||1;
    const rx=-dz/len*w*.5, rz=dx/len*w*.5;
    verts.push(c.x-rx,0.04,c.z-rz, c.x+rx,0.04,c.z+rz);
    uvs.push(0,i/N, 1,i/N);
    const bi=i*2, ni=((i+1)%N)*2;
    idx.push(bi,bi+1,ni, bi+1,ni+1,ni);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts,3));
  geo.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs,2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function buildWallGeo(pts, w, side) {
  const N=pts.length, verts=[], idx=[], uvs=[];
  const hw=w*.5+0.3;
  for(let i=0;i<N;i++){
    const c=pts[i], n=pts[(i+1)%N];
    const dx=n.x-c.x, dz=n.z-c.z, len=Math.hypot(dx,dz)||1;
    const rx=-dz/len*hw*side, rz=dx/len*hw*side;
    verts.push(c.x+rx,0,c.z+rz, c.x+rx,1.6,c.z+rz);
    uvs.push(0,i/N, 1,i/N);
    const bi=i*2, ni=((i+1)%N)*2;
    idx.push(bi,ni,bi+1, ni,ni+1,bi+1);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
  geo.setAttribute('uv',      new THREE.Float32BufferAttribute(uvs,2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function rebuildTrack(animate) {
  [trackMesh, leftWall, rightWall].forEach(m => { if(m){ scene.remove(m); m.geometry.dispose(); }});
  edgeLines.forEach(l => scene.remove(l));
  edgeLines = [];
  if (centerLine) { scene.remove(centerLine); centerLine = null; }

  trackMesh = new THREE.Mesh(buildRoadGeo(wps, roadW), roadMat);
  leftWall  = new THREE.Mesh(buildWallGeo(wps, roadW, -1), wallMat);
  rightWall = new THREE.Mesh(buildWallGeo(wps, roadW, 1),  wallMat);
  scene.add(trackMesh, leftWall, rightWall);

  buildEdgeLines();
  buildCenterLine();

  if (animate) startMaterializeAnimation();
}

function buildEdgeLines() {
  edgeLines.forEach(l => scene.remove(l));
  edgeLines = [];
  const hw = roadW * 0.5;
  for (const side of [-1, 1]) {
    const pts3 = [];
    for (let i = 0; i < wps.length; i++) {
      const wp = wps[i], n = wps[(i+1)%wps.length];
      const dx = n.x - wp.x, dz = n.z - wp.z, len = Math.hypot(dx, dz) || 1;
      const rx = -dz/len*hw*side, rz = dx/len*hw*side;
      pts3.push(new THREE.Vector3(wp.x + rx, 1.62, wp.z + rz));
    }
    pts3.push(pts3[0].clone());
    const geo = new THREE.BufferGeometry().setFromPoints(pts3);
    const mat = new THREE.LineBasicMaterial({color:0x00aaff, fog:false, depthTest:false, linewidth:2});
    const line = new THREE.Line(geo, mat);
    line.renderOrder = 2;
    scene.add(line); edgeLines.push(line);
  }
}

function buildCenterLine() {
  const pts = wps.map(w => new THREE.Vector3(w.x, 0.06, w.z));
  pts.push(pts[0].clone());
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineDashedMaterial({color:0x003344, dashSize:4, gapSize:6});
  centerLine = new THREE.Line(geo, mat);
  centerLine.computeLineDistances();
  scene.add(centerLine);
}

// ═══════════════════════════════════════════════════════════════════════
// MATERIALIZATION ANIMATION (track changes)
// ═══════════════════════════════════════════════════════════════════════
function startMaterializeAnimation() {
  // Drop track from below + sweep cyan glow over it
  if (trackMesh) trackMesh.position.y = -10;
  if (leftWall)  leftWall.position.y  = -10;
  if (rightWall) rightWall.position.y = -10;
  edgeLines.forEach(l => l.position.y = -10);
  if (centerLine) centerLine.position.y = -10;

  materializing = { start: performance.now(), dur: 800 };
  showMatrixRain(900);

  // Spawn cyan particle stream along new track
  const sampleEvery = Math.max(1, Math.floor(wps.length / 30));
  for (let i = 0; i < wps.length; i += sampleEvery) {
    setTimeout(() => {
      if (wps[i]) spawnExplosion(wps[i].x, wps[i].z, 0x00ffaa, 8, 5);
    }, i * 12);
  }
}

function updateMaterialize(ts) {
  if (!materializing) return;
  const elapsed = ts - materializing.start;
  const t = Math.min(elapsed / materializing.dur, 1);
  const eased = 1 - Math.pow(1 - t, 3);
  const y = (eased - 1) * 10;
  if (trackMesh) trackMesh.position.y = y;
  if (leftWall)  leftWall.position.y  = y;
  if (rightWall) rightWall.position.y = y;
  edgeLines.forEach(l => l.position.y = y);
  if (centerLine) centerLine.position.y = y;
  if (t >= 1) materializing = null;
}

// ═══════════════════════════════════════════════════════════════════════
// MATRIX RAIN (overlay during track changes)
// ═══════════════════════════════════════════════════════════════════════
let matrixCanvas, matrixCtx, matrixDrops, matrixTimer = null, matrixActive = false;

function initMatrixCanvas() {
  matrixCanvas = document.getElementById('matrix-canvas');
  matrixCtx = matrixCanvas.getContext('2d');
  resizeMatrix();
}

function resizeMatrix() {
  if (!matrixCanvas) return;
  matrixCanvas.width = window.innerWidth;
  matrixCanvas.height = window.innerHeight;
  matrixDrops = Array(Math.floor(window.innerWidth/14)).fill(0).map(()=>Math.random()*window.innerHeight/14);
}

function showMatrixRain(durationMs) {
  if (!matrixCanvas) return;
  matrixCanvas.classList.remove('hidden');
  matrixActive = true;
  const startTs = performance.now();
  if (matrixTimer) cancelAnimationFrame(matrixTimer);

  function frame() {
    if (!matrixActive) return;
    const elapsed = performance.now() - startTs;
    const t = elapsed / durationMs;
    const fade = t < 0.3 ? t/0.3 : t > 0.7 ? (1-t)/0.3 : 1;

    matrixCtx.fillStyle = 'rgba(0,8,20,0.18)';
    matrixCtx.fillRect(0, 0, matrixCanvas.width, matrixCanvas.height);
    matrixCtx.font = '14px Courier New';

    const chars = '01アイウエオカキクケコ▓░<>{}[]/\\#@*';
    for (let i = 0; i < matrixDrops.length; i++) {
      const ch = chars[Math.floor(Math.random()*chars.length)];
      const y = matrixDrops[i] * 14;
      // bright leading char
      matrixCtx.fillStyle = `rgba(180,255,220,${fade})`;
      matrixCtx.fillText(ch, i*14, y);
      // trailing
      matrixCtx.fillStyle = `rgba(0,255,170,${fade*0.6})`;
      matrixCtx.fillText(chars[Math.floor(Math.random()*chars.length)], i*14, y - 14);

      if (y > matrixCanvas.height && Math.random() > 0.97) matrixDrops[i] = 0;
      matrixDrops[i] += 1;
    }

    if (elapsed < durationMs) matrixTimer = requestAnimationFrame(frame);
    else { matrixActive = false; matrixCanvas.classList.add('hidden');
           matrixCtx.clearRect(0,0,matrixCanvas.width,matrixCanvas.height); }
  }
  frame();
}

// ═══════════════════════════════════════════════════════════════════════
// FINISH LINE
// ═══════════════════════════════════════════════════════════════════════
function placeFinishLine(wi) {
  finishWI = wi;
  finishMeshes.forEach(m => scene.remove(m));
  finishMeshes = [];
  const wp = wps[wi], nxt = wps[(wi+1)%wps.length];
  const dx = nxt.x - wp.x, dz = nxt.z - wp.z, len = Math.hypot(dx, dz) || 1;
  const rx = -dz/len, rz = dx/len;

  // Checkered band
  const tiles = 8;
  for (let i = 0; i < tiles; i++) {
    const t = i/tiles - 0.5 + 0.5/tiles;
    const cx = wp.x + rx*roadW*t, cz = wp.z + rz*roadW*t;
    const col = (i%2===0) ? 0xffffff : 0x111111;
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(roadW/tiles, 0.12, 1.8),
      new THREE.MeshLambertMaterial({color:col, emissive:col, emissiveIntensity:0.3})
    );
    m.position.set(cx, 0.06, cz);
    m.rotation.y = -Math.atan2(dx, dz);
    scene.add(m); finishMeshes.push(m);
  }

  // Pillars
  for (const side of [-1, 1]) {
    const px = wp.x + rx*roadW*0.5*side, pz = wp.z + rz*roadW*0.5*side;
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 7, 10),
      new THREE.MeshLambertMaterial({color:0xff00ff, emissive:0xff00ff, emissiveIntensity:1.3})
    );
    m.position.set(px, 3.5, pz);
    scene.add(m); finishMeshes.push(m);
  }

  // Top arch beam
  const archMid = new THREE.Vector3(wp.x, 7.2, wp.z);
  const arch = new THREE.Mesh(
    new THREE.BoxGeometry(roadW + 2, 0.4, 0.6),
    new THREE.MeshLambertMaterial({color:0xff00ff, emissive:0xff00ff, emissiveIntensity:1.2})
  );
  arch.position.copy(archMid);
  arch.rotation.y = -Math.atan2(dx, dz);
  scene.add(arch); finishMeshes.push(arch);

  // Materialize finish line too
  finishMeshes.forEach(m => m.position.y -= 8);
  const start = performance.now();
  function lift() {
    const t = Math.min((performance.now() - start) / 700, 1);
    const eased = 1 - Math.pow(1-t, 3);
    finishMeshes.forEach((m, i) => {
      const target = i < tiles ? 0.06 : (i === tiles+2 ? 7.2 : 3.5);
      m.position.y = target - (1-eased) * 8;
    });
    if (t < 1) requestAnimationFrame(lift);
  }
  lift();
  showMatrixRain(900);
  spawnExplosion(wp.x, wp.z, 0xff00ff, 30, 8);
}

// ═══════════════════════════════════════════════════════════════════════
// ZONES + OBSTACLES
// ═══════════════════════════════════════════════════════════════════════
function addZoneMesh(z) {
  const wp = wps[z.wi % wps.length];
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(z.r, z.r, 0.22, 18),
    ZONE_MAT[z.t] || ZONE_MAT.boost
  );
  m.position.set(wp.x, 0.11, wp.z);
  m.userData.matStart = performance.now();
  scene.add(m); zoneMeshes.push(m);
  // Materialize from below
  m.position.y = -3;
  const start = performance.now();
  function lift() {
    const t = Math.min((performance.now()-start)/500, 1);
    m.position.y = 0.11 - (1-t)*3;
    if (t < 1) requestAnimationFrame(lift);
  }
  lift();
  spawnExplosion(wp.x, wp.z, ({boost:0x00ffcc, spike:0xff0044, oil:0x553300}[z.t]||0x00ffcc), 15, 5);
  showMatrixRain(700);
}

function addObstacleMeshes(obs) {
  for (const ob of obs) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 2.4, 2.2),
      new THREE.MeshLambertMaterial({color:0x774400, emissive:0x331a00, emissiveIntensity:0.5})
    );
    m.position.set(ob.x, 1.2 - 5, ob.z);
    m.rotation.y = Math.random() * Math.PI;
    scene.add(m); obsMeshes.push(m);
    const start = performance.now();
    (function lift(target){
      const f = () => {
        const t = Math.min((performance.now()-start)/600, 1);
        target.position.y = 1.2 - (1-t)*5;
        if (t < 1) requestAnimationFrame(f);
      }; f();
    })(m);
    spawnExplosion(ob.x, ob.z, 0xff8800, 12, 6);
  }
  showMatrixRain(700);
}

// ═══════════════════════════════════════════════════════════════════════
// CAR MESH (with full customization)
// ═══════════════════════════════════════════════════════════════════════
function makeCarMesh(vhId, customOpts) {
  if (raceIsBoat)  return makeBoatMesh(vhId, customOpts);
  if (raceIsPlane) return makePlaneMesh(vhId, customOpts);
  const vh = VEHICLES[vhId] || VEHICLES.civic_type_r;
  const c = customOpts || {};
  const bodyCol   = paintForTarget(c, 'body', vh);
  const bumperCol = paintForTarget(c, 'bumpers', vh);
  const trimCol   = paintForTarget(c, 'trim', vh);
  const wheelCol  = paintForTarget(c, 'wheels', vh);
  const lightCol  = paintForTarget(c, 'lights', vh);
  const wheelStyle = c.wheels  || 'sport';
  const exhaustId  = c.exhaust || 'none';
  const stickerId  = c.sticker || 'none';

  const bodyEm   = _emissive(bodyCol);
  const bumperEm = _emissive(bumperCol);
  const lightEm  = lightCol;

  const g = new THREE.Group();
  const bodyMat   = new THREE.MeshPhongMaterial({color:bodyCol, emissive:bodyEm, emissiveIntensity:0.28, shininess:180, specular:0x888888});
  const bumperMat = new THREE.MeshPhongMaterial({color:bumperCol, emissive:bumperEm, emissiveIntensity:0.15, shininess:100, specular:0x556677});

  // ── Chassis / hood / cabin / trunk / spoiler ──
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.45, 4.4), bodyMat);
  chassis.position.y = 0.42; g.add(chassis);
  chassis.castShadow = true; chassis.receiveShadow = true;
  chassis.userData.origEm = bodyEm;

  const hood = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.32, 1.5), bodyMat);
  hood.position.set(0, 0.78, 1.35); g.add(hood);
  hood.castShadow = true;
  hood.userData.origEm = bodyEm;

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 2.1), bodyMat);
  cabin.position.set(0, 1.0, -0.05); g.add(cabin);
  cabin.castShadow = true;
  cabin.userData.origEm = bodyEm;

  const trunk = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.28, 1.3), bodyMat);
  trunk.position.set(0, 0.78, -1.55); g.add(trunk);
  trunk.castShadow = true;
  trunk.userData.origEm = bodyEm;

  const spo = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.55), bodyMat);
  spo.position.set(0, 1.05, -2.10); g.add(spo);
  spo.castShadow = true;
  spo.userData.origEm = bodyEm;

  for (const x of [-0.95, 0.95]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.32, 0.35), bodyMat);
    wing.position.set(x, 0.88, -2.0); g.add(wing);
    wing.userData.origEm = bodyEm;
  }

  // ── Front + Rear bumpers (separately paintable) ──
  const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.4, 0.45), bumperMat);
  frontBumper.position.set(0, 0.42, 2.42); g.add(frontBumper);
  frontBumper.userData.origEm = bumperEm;

  // Front lip
  const frontLip = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.2), bumperMat);
  frontLip.position.set(0, 0.18, 2.55); g.add(frontLip);
  frontLip.userData.origEm = bumperEm;

  const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.4, 0.45), bumperMat);
  rearBumper.position.set(0, 0.42, -2.42); g.add(rearBumper);
  rearBumper.userData.origEm = bumperEm;

  // Rear diffuser
  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.18, 0.3), bumperMat);
  diffuser.position.set(0, 0.18, -2.55); g.add(diffuser);
  diffuser.userData.origEm = bumperEm;

  // ── Glass ──
  const glassMat = new THREE.MeshPhongMaterial({
    color:0x000814, emissive:0x001833, emissiveIntensity:0.3,
    transparent:true, opacity:0.75, shininess:220, specular:0xaaccff
  });
  const winF = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.55, 0.08), glassMat);
  winF.position.set(0, 1.2, 0.95); winF.rotation.x = -0.42; g.add(winF);
  const winR = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.5, 0.08), glassMat);
  winR.position.set(0, 1.2, -1.05); winR.rotation.x = 0.45; g.add(winR);
  for (const x of [-1.01, 1.01]) {
    const sw = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 1.6), glassMat);
    sw.position.set(x, 1.18, -0.05); g.add(sw);
  }

  // ── Trim strips (paintable) ──
  for (const x of [-1.21, 1.21]) {
    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.06, 3.2),
      new THREE.MeshBasicMaterial({color: trimCol})
    );
    trim.position.set(x, 0.52, 0); g.add(trim);
  }

  // ── Wheels (paintable rims) ──
  const wPos = [[-1.22,0.5,1.45],[1.22,0.5,1.45],[-1.22,0.5,-1.45],[1.22,0.5,-1.45]];
  for (const [x,y,z] of wPos) g.add(makeWheel(x,y,z, wheelStyle, wheelCol));

  // ── Headlights (paintable) ──
  for (const x of [-0.78, 0.78]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.12),
      new THREE.MeshBasicMaterial({color: lightCol}));
    hl.position.set(x, 0.7, 2.66); g.add(hl);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8),
      new THREE.MeshBasicMaterial({color: lightCol, transparent:true, opacity:0.45}));
    halo.position.set(x, 0.7, 2.74); g.add(halo);
  }

  // ── Tail lights ──
  for (const x of [-0.78, 0.78]) {
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.08),
      new THREE.MeshBasicMaterial({color:0xff0033}));
    tl.position.set(x, 0.72, -2.66); g.add(tl);
  }

  // ── Underglow (uses trim color) ──
  const glow = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.05, 4.0),
    new THREE.MeshBasicMaterial({color: trimCol, transparent:true, opacity:0.7}));
  glow.position.y = 0.06; g.add(glow);

  // ── Stickers ──
  applyStickersTo(g, stickerId, trimCol);

  // ── Exhaust nozzles (visible glow tips) ──
  if (exhaustId !== 'none') {
    const ex = EXHAUSTS.find(e => e.id === exhaustId);
    const nozCol = ex.id === 'rainbow' ? 0xffffff : ex.col;
    for (const x of [-0.55, 0.55]) {
      const noz = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.18, 0.22, 10),
        new THREE.MeshBasicMaterial({color: nozCol})
      );
      noz.rotation.x = Math.PI/2;
      noz.position.set(x, 0.55, -2.66); g.add(noz);
    }
  }
  g.userData.exhaustId = exhaustId;

  // ── Damage dent ──
  const dent = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.45, 4.4),
    new THREE.MeshLambertMaterial({color:0x2a1500, emissive:0x110000, transparent:true, opacity:0})
  );
  dent.position.y = 0.42; dent.userData.isDent = true; g.add(dent);

  g.userData.vhId  = vhId;
  g.userData.paint = bodyCol;
  return g;
}

function makeBoatMesh(vhId, customOpts) {
  const c = customOpts || {};
  const hullCol   = c.boatHullPaint   !== undefined ? c.boatHullPaint   : (c.bodyPaint   || 0xcc3322);
  const accentCol = c.boatAccentPaint !== undefined ? c.boatAccentPaint : (c.trimPaint   || 0xffffff);
  const g = new THREE.Group();
  const hullMat   = new THREE.MeshPhongMaterial({color:hullCol,   shininess:100, specular:0x555555});
  const accentMat = new THREE.MeshPhongMaterial({color:accentCol, shininess:70});
  const darkMat   = new THREE.MeshPhongMaterial({color:0x111111,  shininess:20});
  const glassMat  = new THREE.MeshPhongMaterial({color:0x88ccff, transparent:true, opacity:0.7, shininess:180});
  const wakeMat   = new THREE.MeshBasicMaterial({color:0xffffff,  transparent:true, opacity:0.3});

  // Main hull — wide, low
  const hull = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.65, 5.2), hullMat);
  hull.position.y = 0.32; g.add(hull);
  // Keel
  const keel = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.28, 4.8), darkMat);
  keel.position.y = -0.04; g.add(keel);
  // Angled bow
  const bow = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.55, 1.0), hullMat);
  bow.position.set(0, 0.38, 3.1); bow.rotation.x = 0.38; g.add(bow);
  // Cabin
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.85, 2.0), hullMat);
  cabin.position.set(0, 1.09, -0.4); g.add(cabin);
  // Windshield
  const wind = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.42, 0.07), glassMat);
  wind.position.set(0, 1.22, 0.61); wind.rotation.x = -0.22; g.add(wind);
  // Rear cabin window
  const rwin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.35, 0.07), glassMat);
  rwin.position.set(0, 1.2, -1.38); g.add(rwin);
  // Hull stripe
  for (const x of [-1.52, 1.52]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 5.0), accentMat);
    stripe.position.set(x, 0.56, 0); g.add(stripe);
  }
  // Propeller shaft
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.7, 8), darkMat);
  shaft.rotation.x = Math.PI/2; shaft.position.set(0, 0.08, -3.1); g.add(shaft);
  // Propeller blades
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.55, 0.16), accentMat);
    blade.rotation.z = (i/3)*Math.PI*2; blade.position.set(0, 0.08, -3.38); g.add(blade);
  }
  // Wake spray behind hull
  const wake = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 3.0), wakeMat);
  wake.rotation.x = -Math.PI/2; wake.position.set(0, 0.1, -4.2); g.add(wake);
  const wake2 = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.5), wakeMat);
  wake2.rotation.x = -Math.PI/2; wake2.position.set(0, 0.12, -5.2); g.add(wake2);

  g.userData.vhId  = vhId; g.userData.paint = hullCol; g.userData.isBoat = true;
  g.userData.exhaustId = c.exhaust || 'none';
  return g;
}

function makePlaneMesh(vhId, customOpts) {
  const c = customOpts || {};
  const livCol    = c.planeLiveryPaint !== undefined ? c.planeLiveryPaint : (c.bodyPaint  || 0xffffff);
  const accentCol = c.planeAccentPaint !== undefined ? c.planeAccentPaint : (c.trimPaint  || 0x2244cc);
  const g = new THREE.Group();
  // Plane rides higher so it looks like it's flying
  g.position.y = 2.5;

  const livMat    = new THREE.MeshPhongMaterial({color:livCol,    shininess:130, specular:0x888888});
  const accentMat = new THREE.MeshPhongMaterial({color:accentCol, shininess:90});
  const engMat    = new THREE.MeshPhongMaterial({color:0x222222,  shininess:60});
  const glassMat  = new THREE.MeshPhongMaterial({color:0x001122, transparent:true, opacity:0.75, shininess:220});

  // Fuselage (horizontal cylinder along Z)
  const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 5.6, 12), livMat);
  fuse.rotation.x = Math.PI/2; fuse.position.set(0, 0, 0); g.add(fuse);
  // Nose cone
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.5, 12), livMat);
  nose.rotation.x = Math.PI/2; nose.position.set(0, 0, 3.55); g.add(nose);
  // Tail cone
  const tailC = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.2, 8), livMat);
  tailC.rotation.x = -Math.PI/2; tailC.position.set(0, 0, -3.2); g.add(tailC);

  // Cockpit canopy (glass bubble on top of fuselage)
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.38, 1.1), glassMat);
  canopy.position.set(0, 0.48, 1.4); g.add(canopy);

  // Main wings — flat and wide, centered on fuselage
  const wingY = 0.0; // exactly on fuselage center
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.12, 1.5), livMat);
    wing.position.set(side * 2.5, wingY, 0.2); g.add(wing);
    // Wing root connects fuselage to wing
    const root = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 1.6), livMat);
    root.position.set(side * 0.6, wingY, 0.2); g.add(root);
    // Wing tip
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.22, 0.8), accentMat);
    tip.position.set(side * 4.45, wingY + 0.05, 0.2); g.add(tip);

    // Engine pod — hung directly under wing, no gap
    // Wing bottom: wingY - 0.06 = -0.06
    // Pod radius 0.24 → pod center y = -0.06 - 0.24 = -0.30
    const podY = wingY - 0.06 - 0.24; // = -0.30
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.4), engMat);
    pylon.position.set(side * 1.9, wingY - 0.14, 0.35); g.add(pylon);
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 1.6, 10), engMat);
    pod.rotation.x = Math.PI/2; pod.position.set(side * 1.9, podY, 0.35); g.add(pod);
    // Intake ring
    const intake = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.16, 0.22, 10),
      new THREE.MeshBasicMaterial({color:0x050505}));
    intake.rotation.x = Math.PI/2; intake.position.set(side * 1.9, podY, 1.26); g.add(intake);
    // Exhaust glow
    const exGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.14, 0.18, 8),
      new THREE.MeshBasicMaterial({color:0xff6600, transparent:true, opacity:0.85}));
    exGlow.rotation.x = Math.PI/2; exGlow.position.set(side * 1.9, podY, -0.55); g.add(exGlow);
  }

  // Vertical tail fin
  const vfin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 0.95), livMat);
  vfin.position.set(0, 0.58, -2.85); g.add(vfin);
  // Fin accent
  const finAcc = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.5, 0.55), accentMat);
  finAcc.position.set(0, 0.82, -2.72); g.add(finAcc);
  // Horizontal stabilizers
  for (const side of [-1, 1]) {
    const hfin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.09, 0.65), livMat);
    hfin.position.set(side * 1.05, 0, -2.85); g.add(hfin);
  }
  // Livery stripe along fuselage
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 5.4), accentMat);
  stripe.position.set(0.44, 0.28, 0); g.add(stripe);

  g.userData.vhId  = vhId; g.userData.paint = livCol; g.userData.isPlane = true;
  g.userData.exhaustId = c.exhaust || 'flame';
  return g;
}

function makeWheel(x, y, z, style, wheelCol) {
  const wg = new THREE.Group();
  wg.position.set(x, y, z);
  wg.userData.wheel = true;

  const styleData = WHEEL_STYLES.find(w => w.id === style) || WHEEL_STYLES[0];
  const R = styleData.radius;
  const W = styleData.width;
  const rimEm = _emissive(wheelCol);
  const tireMat = new THREE.MeshPhongMaterial({color:0x0a0a0a, shininess:5});
  const rimMat  = new THREE.MeshPhongMaterial({color:wheelCol, emissive:rimEm, emissiveIntensity:0.25, shininess:150, specular:0xffffff});

  // Tire
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(R, R, W, 22), tireMat);
  tire.rotation.z = Math.PI/2; wg.add(tire);

  if (style === 'drag') {
    // Wide flat disc, no spokes
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(R*0.92, R*0.92, W+0.05, 28), rimMat);
    disc.rotation.z = Math.PI/2; wg.add(disc);
    // Outer ring detail
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R*0.85, 0.03, 8, 28), rimMat);
    ring.rotation.y = Math.PI/2; wg.add(ring);
  } else if (style === 'mesh') {
    // Dense inner mesh
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(R*0.65, R*0.65, W+0.02, 16), rimMat);
    inner.rotation.z = Math.PI/2; wg.add(inner);
    for (let i = 0; i < 12; i++) {
      const ang = (i/12)*Math.PI*2;
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.035, R*0.58, 0.05), rimMat);
      sp.rotation.x = ang; wg.add(sp);
    }
  } else if (style === 'rally') {
    // 3 wide spokes + deep offset rim
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(R*0.55, R*0.55, W+0.06, 10), rimMat);
    inner.rotation.z = Math.PI/2; wg.add(inner);
    for (let i = 0; i < 3; i++) {
      const ang = (i/3)*Math.PI*2;
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.14, R*0.55, W*0.9), rimMat);
      sp.rotation.x = ang; wg.add(sp);
    }
  } else if (style === 'star') {
    // 6 pointed star spokes
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(R*0.28, R*0.28, W+0.02, 8), rimMat);
    inner.rotation.z = Math.PI/2; wg.add(inner);
    for (let i = 0; i < 6; i++) {
      const ang = (i/6)*Math.PI*2;
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.07, R*0.6, 0.08), rimMat);
      sp.rotation.x = ang; wg.add(sp);
      // Star tip pyramid
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.14, 4), rimMat);
      tip.rotation.x = ang; tip.position.set(0, Math.cos(ang)*R*0.62, Math.sin(ang)*R*0.62);
      wg.add(tip);
    }
  } else if (style === 'blade') {
    // 4 curved blades
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(R*0.32, R*0.32, W+0.02, 8), rimMat);
    inner.rotation.z = Math.PI/2; wg.add(inner);
    for (let i = 0; i < 4; i++) {
      const ang = (i/4)*Math.PI*2;
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.06, R*0.58, 0.12), rimMat);
      sp.rotation.x = ang + 0.3; wg.add(sp);
    }
  } else if (style === 'classic') {
    // 8 thin spokes + visible hub ring
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R*0.72, 0.04, 8, 24), rimMat);
    ring.rotation.y = Math.PI/2; wg.add(ring);
    for (let i = 0; i < 8; i++) {
      const ang = (i/8)*Math.PI*2;
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.04, R*0.68, 0.06), rimMat);
      sp.rotation.x = ang; wg.add(sp);
    }
  } else {
    // sport (default) — 5 spokes
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(R*0.62, R*0.62, W+0.02, 12), rimMat);
    rim.rotation.z = Math.PI/2; wg.add(rim);
    for (let i = 0; i < 5; i++) {
      const ang = (i/5)*Math.PI*2;
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.055, R*0.56, 0.08), rimMat);
      sp.rotation.x = ang; wg.add(sp);
    }
  }

  // Center cap
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.10, 0.10, W+0.04, 8),
    new THREE.MeshBasicMaterial({color: wheelCol})
  );
  cap.rotation.z = Math.PI/2; wg.add(cap);

  return wg;
}

function applyStickersTo(group, stickerId, paint) {
  if (stickerId === 'none') return;
  const accentMat = new THREE.MeshBasicMaterial({color: 0xffffff});
  const altMat    = new THREE.MeshBasicMaterial({color: 0x000000});
  const fireMat   = new THREE.MeshBasicMaterial({color: 0xff5500});
  const cMat      = new THREE.MeshBasicMaterial({color: 0x00ff88});

  if (stickerId === 'stripes') {
    for (const x of [-0.3, 0.3]) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.02, 4.4), accentMat);
      s.position.set(x, 0.95, 0); group.add(s);
    }
  } else if (stickerId === 'flame') {
    for (const x of [-1.22, 1.22]) {
      for (let i = 0; i < 5; i++) {
        const flame = new THREE.Mesh(
          new THREE.ConeGeometry(0.15 - i*0.02, 0.5, 6),
          fireMat
        );
        flame.position.set(x, 0.6, 1.0 - i*0.4);
        flame.rotation.z = x > 0 ? Math.PI/2 : -Math.PI/2;
        flame.rotation.y = x > 0 ? -Math.PI/2 : Math.PI/2;
        group.add(flame);
      }
    }
  } else if (stickerId === 'circuit') {
    for (let i = 0; i < 12; i++) {
      const len = 0.2 + Math.random() * 0.4;
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, len), cMat);
      line.position.set((Math.random()-0.5)*1.6, 0.78, (Math.random()-0.5)*3);
      line.rotation.y = Math.random() < 0.5 ? 0 : Math.PI/2;
      group.add(line);
    }
  } else if (stickerId === 'checker') {
    for (const sx of [-1.21, 1.21]) {
      for (let i = 0; i < 8; i++) {
        const c = new THREE.Mesh(
          new THREE.BoxGeometry(0.04, 0.18, 0.18),
          i%2 ? accentMat : altMat
        );
        c.position.set(sx, 0.5, -1.6 + i*0.25);
        group.add(c);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// POWER-UP MESHES
// ═══════════════════════════════════════════════════════════════════════
const PU_COLORS = {
  boost:0x00ffcc, repair:0x44ff44, slow:0xffaa00, spin:0xff8800,
  reverse:0xff0066, spike_p:0xff0044, oil_p:0x553300, shield:0x0088ff,
  emp:0x4488ff, missile:0xff3300
};

function makePowerupMesh(type) {
  const col = PU_COLORS[type] || 0xffffff;
  const g = new THREE.Group();
  const geo = type === 'boost' ? new THREE.OctahedronGeometry(1.2, 0)
            : type === 'repair' ? new THREE.BoxGeometry(1.0, 1.0, 1.0)
            : type === 'emp' ? new THREE.SphereGeometry(1.1, 8, 8)
            : type === 'missile' ? new THREE.CylinderGeometry(0, 0.6, 1.8, 4)
            : type === 'spin' || type === 'reverse' ? new THREE.TetrahedronGeometry(1.1, 0)
            : new THREE.IcosahedronGeometry(0.9, 0);
  const mat = new THREE.MeshPhongMaterial({
    color:col, emissive:col, emissiveIntensity:0.7,
    transparent:true, opacity:0.85, wireframe: (type==='reverse' || type==='emp')
  });
  const mesh = new THREE.Mesh(geo, mat);
  if (type === 'missile') mesh.rotation.x = Math.PI/2;
  g.add(mesh);
  // Glow ring
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.6, 0.06, 8, 28),
    new THREE.MeshBasicMaterial({color:col, transparent:true, opacity:0.5})
  );
  ring.rotation.x = Math.PI/2;
  g.add(ring);
  g.userData.puType = type;
  g.userData.col = col;
  return g;
}

function spawnPowerupMesh(pu) {
  const m = makePowerupMesh(pu.type);
  m.position.set(pu.x, 1.5, pu.z);
  scene.add(m);
  powerupMeshes[pu.id] = m;
}

function clearPowerupMeshes() {
  for (const m of Object.values(powerupMeshes)) {
    scene.remove(m);
    m.traverse(o => { if(o.geometry) o.geometry.dispose(); if(o.material) o.material.dispose(); });
  }
  powerupMeshes = {};
}

function updatePowerupMeshes(dt, ts) {
  for (const m of Object.values(powerupMeshes)) {
    if (!m.visible) continue;
    m.rotation.y += dt * 1.8;
    m.position.y = 1.5 + Math.sin(ts * 0.002 + m.position.x) * 0.25;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// EXHAUST PARTICLE TRAILS
// ═══════════════════════════════════════════════════════════════════════
const _localExhaustL = new THREE.Vector3(-0.55, 0.55, -2.7);
const _localExhaustR = new THREE.Vector3( 0.55, 0.55, -2.7);
const _tmpV = new THREE.Vector3();

function attachTrail(carMesh, parentScene, exhaustId) {
  if (!exhaustId || exhaustId === 'none') return;
  const N = 50;
  const positions = new Float32Array(N * 3);
  const colors    = new Float32Array(N * 3);
  const lives     = new Float32Array(N);
  const sizes     = new Float32Array(N);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.85, vertexColors: true,
    transparent: true, opacity: 0.92,
    depthWrite: false, blending: THREE.AdditiveBlending
  });

  const pts = new THREE.Points(geo, mat);
  parentScene.add(pts);

  carMesh.userData.trail = {
    pts, geo, positions, colors, lives, sizes,
    exhaustId, nextIdx: 0, accum: 0, parentScene
  };
}

function detachTrail(carMesh) {
  const tr = carMesh.userData.trail;
  if (!tr) return;
  tr.parentScene.remove(tr.pts);
  tr.geo.dispose();
  tr.pts.material.dispose();
  delete carMesh.userData.trail;
}

function updateTrail(carMesh, dt, intensity) {
  const tr = carMesh.userData.trail;
  if (!tr) return;
  const ex = EXHAUSTS.find(e => e.id === tr.exhaustId);
  if (!ex) return;
  const N = tr.lives.length;

  // Spawn count this frame
  tr.accum += dt;
  const rate = 90 * Math.max(0.05, intensity);
  let spawns = Math.floor(tr.accum * rate);
  if (spawns > 6) spawns = 6;
  tr.accum -= spawns / rate;

  // Spawn from BOTH tailpipes each spawn
  for (let s = 0; s < spawns; s++) {
    for (const pipe of [_localExhaustL, _localExhaustR]) {
      const i = tr.nextIdx;
      tr.nextIdx = (tr.nextIdx + 1) % N;
      _tmpV.copy(pipe).applyMatrix4(carMesh.matrixWorld);
      tr.positions[i*3]   = _tmpV.x + (Math.random()-0.5)*0.18;
      tr.positions[i*3+1] = _tmpV.y + (Math.random()-0.5)*0.18;
      tr.positions[i*3+2] = _tmpV.z + (Math.random()-0.5)*0.18;
      tr.lives[i] = 1.0;
    }
  }

  // Update existing
  for (let i = 0; i < N; i++) {
    if (tr.lives[i] <= 0) {
      tr.colors[i*3] = 0; tr.colors[i*3+1] = 0; tr.colors[i*3+2] = 0;
      continue;
    }
    const decay = (tr.exhaustId === 'smoke' ? 0.7 : tr.exhaustId === 'frost' ? 0.9 : 1.7);
    tr.lives[i] -= dt * decay;
    const life = Math.max(0, tr.lives[i]);

    // Per-type drift
    switch (tr.exhaustId) {
      case 'smoke':
        tr.positions[i*3+1] += dt * 1.6;
        tr.positions[i*3]   += (Math.random()-0.5) * dt * 0.8;
        break;
      case 'embers':
        tr.positions[i*3+1] += dt * (1.0 + life*1.2);
        break;
      case 'frost':
        tr.positions[i*3+1] -= dt * 0.4;
        break;
      case 'lightning':
        tr.positions[i*3]   += (Math.random()-0.5) * 0.6;
        tr.positions[i*3+1] += (Math.random()-0.5) * 0.4;
        tr.positions[i*3+2] += (Math.random()-0.5) * 0.6;
        break;
      case 'void':
        const a = (1 - life) * 8;
        tr.positions[i*3]   += Math.cos(a) * dt * 0.5;
        tr.positions[i*3+1] += Math.sin(a) * dt * 0.3;
        tr.positions[i*3+2] += dt * 0.4;
        break;
      case 'plasma':
        tr.positions[i*3+1] += (Math.random()-0.5) * dt * 0.6;
        break;
    }

    // Color
    let r, g, b;
    if (tr.exhaustId === 'rainbow') {
      const h = ((performance.now()*0.001 + i*0.04) % 1);
      const c = new THREE.Color().setHSL(h, 1, 0.55);
      r = c.r; g = c.g; b = c.b;
    } else if (tr.exhaustId === 'flame' || tr.exhaustId === 'embers') {
      const t = 1 - life;
      if (t < 0.3) { r = 1; g = 1 - t*1.6; b = 0; }
      else if (t < 0.7) { r = 1; g = 0.4*(1-(t-0.3)/0.4); b = 0; }
      else { r = (1-(t-0.7)/0.3); g = 0; b = 0; }
    } else if (tr.exhaustId === 'electric') {
      const f = 0.7 + Math.random()*0.3;
      r = 0; g = 0.85*f; b = f;
    } else if (tr.exhaustId === 'lightning') {
      const f = 0.85 + Math.random()*0.15;
      r = f; g = f; b = f*0.6;
    } else if (tr.exhaustId === 'plasma') {
      r = 1; g = 0.2 + Math.random()*0.2; b = 1;
    } else if (tr.exhaustId === 'void') {
      r = 0.4; g = 0; b = 1;
    } else if (tr.exhaustId === 'frost') {
      r = 0.7; g = 0.95; b = 1;
    } else if (tr.exhaustId === 'gold') {
      r = 1; g = 0.82; b = 0.18;
    } else if (tr.exhaustId === 'smoke') {
      r = 0.5; g = 0.5; b = 0.5;
    } else {
      const c = new THREE.Color(ex.col);
      r = c.r; g = c.g; b = c.b;
    }
    tr.colors[i*3]   = r * life;
    tr.colors[i*3+1] = g * life;
    tr.colors[i*3+2] = b * life;
  }

  tr.geo.attributes.position.needsUpdate = true;
  tr.geo.attributes.color.needsUpdate = true;
}

// ═══════════════════════════════════════════════════════════════════════
// CUTSCENE
// ═══════════════════════════════════════════════════════════════════════
function startCutscene(onDone) {
  // Show garage canvas, hide HOME UI
  showScreen('garage');
  document.querySelector('.garage-ui').style.display = 'none';
  cutscene = { start: performance.now(), dur: 2400, callback: onDone };
}

function updateCutscene(ts) {
  if (!cutscene) return;
  const elapsed = ts - cutscene.start;
  const t = Math.min(elapsed / cutscene.dur, 1);

  // ── Garage door: stays closed 0-30%, slides up 30-65% ──
  if (garageDoorGroup) {
    let doorT = 0;
    if (t < 0.30) doorT = 0;
    else if (t < 0.65) doorT = (t - 0.30) / 0.35;
    else doorT = 1;
    // Ease out cubic
    const easedDoor = 1 - Math.pow(1 - doorT, 3);
    garageDoorGroup.position.y = easedDoor * 22;
  }

  if (garageCarMesh) {
    // Stage 1 (0-35%): rev — slight bounce, engine rumble
    // Stage 2 (35-100%): accelerate forward through open door
    if (t < 0.35) {
      garageCarMesh.position.y = 0.06 + Math.abs(Math.sin(ts*0.04))*0.04;
      garageCarMesh.position.z = 0;
    } else {
      const t2 = (t - 0.35) / 0.65;
      const dist = t2 * t2 * 120;
      garageCarMesh.position.z = dist;
      garageCarMesh.position.y = 0.06;
      garageCarMesh.children.filter(c => c.userData.wheel).forEach(w => w.rotation.x += 0.35 + t2*0.6);
    }
  }

  // Camera: low + behind, dolly in then chase
  const camStart = new THREE.Vector3(2, 1.6, -8);
  const camMid   = new THREE.Vector3(0, 2.2, -7);
  const camEnd   = new THREE.Vector3(0, 3.0, -6);
  if (t < 0.35) {
    const t2 = t/0.35;
    garageCam.position.lerpVectors(camStart, camMid, t2);
  } else {
    const t2 = (t - 0.35)/0.65;
    garageCam.position.lerpVectors(camMid, camEnd, t2);
    if (garageCarMesh) garageCam.position.z = camMid.z + garageCarMesh.position.z * 0.85;
  }
  if (garageCarMesh) garageCam.lookAt(0, 1.0, garageCarMesh.position.z);

  // Fade to black at end
  const fade = document.getElementById('cutscene-fade');
  if (t > 0.7) {
    fade.style.opacity = (t - 0.7) / 0.3;
    fade.classList.add('show');
  }

  if (t >= 1) {
    fade.style.opacity = 1;
    const cb = cutscene.callback;
    cutscene = null;
    document.querySelector('.garage-ui').style.display = '';
    // Reset car and door for next time
    if (garageCarMesh) { garageCarMesh.position.set(0, 0.06, 0); }
    if (garageDoorGroup) { garageDoorGroup.position.y = 0; }
    setTimeout(() => {
      fade.classList.remove('show');
      fade.style.opacity = 0;
      if (cb) cb();
    }, 200);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// INPUT
// ═══════════════════════════════════════════════════════════════════════
function setupInput() {
  document.addEventListener('keydown', e => {
    if (e.code === 'ArrowUp'    || e.code === 'KeyW') { K.u = true; inputDirty = true; }
    if (e.code === 'ArrowDown'  || e.code === 'KeyS') { K.d = true; inputDirty = true; }
    if (e.code === 'ArrowLeft'  || e.code === 'KeyA') { K.l = true; inputDirty = true; }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') { K.r = true; inputDirty = true; }
    // ADDED: PC boost (Space)
    if (e.code === 'Space' && gamePhase === 'race') { triggerBoostAbility(); e.preventDefault(); }
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
    // Spectate cycle
    if ((e.code === 'BracketLeft' || e.code === 'BracketRight' || e.code === 'Tab') && gamePhase === 'spectate') {
      e.preventDefault();
      cycleSpecTarget(e.code === 'BracketLeft' ? -1 : 1);
    }
  });
  document.addEventListener('keyup', e => {
    if (e.code === 'ArrowUp'    || e.code === 'KeyW') { K.u = false; inputDirty = true; }
    if (e.code === 'ArrowDown'  || e.code === 'KeyS') { K.d = false; inputDirty = true; }
    if (e.code === 'ArrowLeft'  || e.code === 'KeyA') { K.l = false; inputDirty = true; }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') { K.r = false; inputDirty = true; }
  });
}

// ADDED: boost ability trigger (shared by keyboard, gamepad, mobile)
window.triggerBoostAbility = function() {
  if (gamePhase !== 'race' || boostAbilityCooldown > 0) return;
  
  if (localCar && localCar.hasMissile) {
    if (socket) socket.emit('fire_missile');
    localCar.hasMissile = false;
    const ef = document.getElementById('hud-effect');
    if(ef){ ef.textContent='🚀 MISSILE FIRED!'; ef.style.color='#ff3300'; setTimeout(()=>{ef.textContent='';},2000); }
  } else if (localCar && localCar.hasEMP) {
    if (socket) socket.emit('fire_emp');
    localCar.hasEMP = false;
    const ef = document.getElementById('hud-effect');
    if(ef){ ef.textContent='📡 EMP FIRED!'; ef.style.color='#4488ff'; setTimeout(()=>{ef.textContent='';},2000); }
  } else {
    boostAbilityCooldown = BOOST_ABILITY_DUR + BOOST_ABILITY_CD;
    if (socket) socket.emit('boost_ability');
    boostGlowT = 1.5;
  }
  inputDirty = true;
};

// ADDED: gamepad polling (call each frame from animRace)
let _lastGpPoll = 0;
function pollGamepad(dt) {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let pad = null;
  for (const p of pads) { if (p && p.connected) { pad = p; break; } }
  if (!pad) return;

  const dead = 0.18;
  // Left stick → steering + throttle
  const lx = Math.abs(pad.axes[0]) > dead ? pad.axes[0] : 0;
  const ly = Math.abs(pad.axes[1]) > dead ? pad.axes[1] : 0;
  K.l = lx < -dead;
  K.r = lx >  dead;
  K.u = ly < -dead;
  K.d = ly >  dead;

  // Right stick → camera yaw/pitch offset  // ADDED
  const rx = Math.abs(pad.axes[2]) > dead ? pad.axes[2] : 0;
  const ry = Math.abs(pad.axes[3]) > dead ? pad.axes[3] : 0;
  gpCamYaw   = lerp(gpCamYaw,   rx * 6,  0.15);
  gpCamPitch = lerp(gpCamPitch, ry * 2.5, 0.15);

  // Button 1: Xbox-B / Nintendo-A → boost  // ADDED
  if (pad.buttons[1] && pad.buttons[1].pressed) triggerBoostAbility();

  if (lx !== 0 || ly !== 0) inputDirty = true;
}

function cycleSpecTarget(dir) {
  const alive = Object.keys(carMeshes).filter(id => id !== myCarId && carMeshes[id] && carMeshes[id].visible);
  if (!alive.length) return;
  const cur = alive.indexOf(specTarget);
  const next = ((cur + dir) + alive.length) % alive.length;
  specTarget = alive[next];
}

function sendInput() {
  const now = performance.now();
  if ((inputDirty || now - lastInputMs > 100) && gamePhase === 'race' && socket) {
    socket.emit('input', {u:K.u, d:K.d, l:K.l, r:K.r}); // MODIFIED: boost handled separately via boost_ability event
    inputDirty = false; lastInputMs = now;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// LOCAL CAR PREDICTION
// ═══════════════════════════════════════════════════════════════════════
function initLocal(svData) {
  const vh = VEHICLES[svData.vh || 'civic_type_r'];
  localCar = {
    x: svData.x, z: svData.z, angle: svData.angle,
    speed: 0, hp: svData.hp || vh.hp,
    boostT: 0, oilT: 0,
    vh: svData.vh || 'civic_type_r'
  };
}

function stepLocal(dt) {
  if (!localCar || gamePhase !== 'race') return;
  const vh = VEHICLES[localCar.vh] || VEHICLES.civic_type_r;
  const bm = localCar.boostT > 0 ? 1.5 : 1, om = localCar.oilT > 0 ? 0.3 : 1;
  if (K.u) localCar.speed += vh.accel * dt * bm;
  if (K.d) localCar.speed -= 35 * dt;
  if (!K.u && !K.d) localCar.speed *= Math.pow(0.05, dt);
  localCar.speed = Math.max(-14, Math.min(localCar.speed, vh.top * bm));
  const sf = Math.min(1, Math.abs(localCar.speed)/10) * om;
  
  // Local Drift Logic
  const isSteering = K.l || K.r;
  if (isSteering && localCar.speed > 20) {
    localCar.driftT = (localCar.driftT || 0) + dt * 1000;
    localCar.driftSide = K.l ? -1 : 1;
  } else {
    localCar.driftT = 0;
  }

  if (K.l) localCar.angle += vh.hand * dt * sf * 0.77;
  if (K.r) localCar.angle -= vh.hand * dt * sf * 0.77;

  const driftAngle = (localCar.driftT > 200) ? localCar.driftSide * 0.4 : 0;
  localCar.x += Math.sin(localCar.angle + driftAngle) * localCar.speed * dt;
  localCar.z += Math.cos(localCar.angle + driftAngle) * localCar.speed * dt;

  if (localCar.boostT > 0) localCar.boostT -= dt * 1000;
  if (localCar.oilT > 0)   localCar.oilT   -= dt * 1000;
  if (boostAbilityCooldown > 0) boostAbilityCooldown -= dt * 1000;
}

function reconcileLocal(sv) {
  if (!localCar) return;
  const dx = sv.x - localCar.x, dz = sv.z - localCar.z, d = Math.hypot(dx, dz);
  if (d > 4) { localCar.x = sv.x; localCar.z = sv.z; localCar.angle = sv.angle; }
  else if (d > 0.5) { localCar.x += dx*0.25; localCar.z += dz*0.25; }
  localCar.hp = sv.hp;
  localCar.speed = localCar.speed*0.7 + sv.speed*0.3;
  localCar.boostT = sv.boostT;
  localCar.driftT = sv.driftT;
  localCar.driftSide = sv.driftSide;
  localCar.shieldOn = sv.shieldOn;
  localCar.hasMissile = sv.hasMissile;
  localCar.hasEMP = sv.hasEMP;
}

// ═══════════════════════════════════════════════════════════════════════
// PARTICLES
// ═══════════════════════════════════════════════════════════════════════
function spawnExplosion(x, z, color, count, speed) {
  count = count || 40; speed = speed || 14;
  const geo = new THREE.BufferGeometry();
  const verts = new Float32Array(count*3), vels = [];
  for (let i = 0; i < count; i++) {
    verts[i*3] = x; verts[i*3+1] = 0.5; verts[i*3+2] = z;
    vels.push({
      x: (Math.random()-0.5)*speed*1.5,
      y: Math.random()*speed + 4,
      z: (Math.random()-0.5)*speed*1.5,
      life: 1
    });
  }
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  const mat = new THREE.PointsMaterial({color, size:0.9, transparent:true, depthWrite:false});
  const pts = new THREE.Points(geo, mat);
  scene.add(pts);
  particles.push({pts, verts, vels, mat});
}

function updateParticles(dt) {
  for (let i = particles.length-1; i >= 0; i--) {
    const p = particles[i];
    let alive = false;
    for (let j = 0; j < p.vels.length; j++) {
      const v = p.vels[j];
      p.verts[j*3]   += v.x*dt;
      p.verts[j*3+1] += v.y*dt;
      p.verts[j*3+2] += v.z*dt;
      v.y -= 20*dt;
      v.life -= dt*1.5;
      if (v.life > 0) alive = true;
    }
    p.pts.geometry.attributes.position.needsUpdate = true;
    p.mat.opacity = Math.max(0, p.vels.reduce((a,v)=>a+v.life,0)/p.vels.length);
    if (!alive) { scene.remove(p.pts); p.pts.geometry.dispose(); particles.splice(i,1); }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// CAMERA
// ═══════════════════════════════════════════════════════════════════════
const _camOffsetAdj = new THREE.Vector3(); // ADDED: adjusted offset for right-stick
function updateCamera() {
  let tMesh = null;
  if (gamePhase === 'race' && myCarId && carMeshes[myCarId]) tMesh = carMeshes[myCarId];
  if (gamePhase === 'spectate' && specTarget && carMeshes[specTarget]) tMesh = carMeshes[specTarget];
  if (!tMesh) return;
  // ADDED: apply right-stick camera offset
  const activeOffset = raceIsPlane ? _camOffsetPlane : _camOffset;
  const activeLook   = raceIsPlane ? _camLookPlane   : _camLook;
  _camOffsetAdj.copy(activeOffset);
  _camOffsetAdj.x += gpCamYaw;
  _camOffsetAdj.y += gpCamPitch;
  _tpos.copy(_camOffsetAdj).applyQuaternion(tMesh.quaternion).add(tMesh.position);
  cam.position.lerp(_tpos, 0.20);
  const _lookAdj = activeLook.clone();
  _lookAdj.x -= gpCamYaw * 0.6;
  _tlook.copy(_lookAdj).applyQuaternion(tMesh.quaternion).add(tMesh.position);
  cam.lookAt(_tlook);
}

// ═══════════════════════════════════════════════════════════════════════
// CAR DAMAGE VISUAL
// ═══════════════════════════════════════════════════════════════════════
function updateCarDamage(mesh, hp) {
  const maxHp = VEHICLES[mesh.userData.vhId || 'civic_type_r'].hp;
  const t = 1 - hp/maxHp;
  mesh.children.forEach(c => {
    if (c.userData.isDent && c.material) {
      c.material.opacity = t * 0.6;
      c.scale.set(1 + t*0.08, 1 - t*0.15, 1 + t*0.05);
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════
// RACE LOOP
// ═══════════════════════════════════════════════════════════════════════
let _lastRace = 0;
let _npcThrottle = 0; // ADDED: skip-frame counter for distant NPC updates
function animRace(ts) {
  requestAnimationFrame(animRace);
  if (gamePhase !== 'race' && gamePhase !== 'spectate') return;
  const dt = Math.min((ts - _lastRace)/1000, 0.05);
  _lastRace = ts;

  pollGamepad(dt); // ADDED: gamepad polling each frame
  sendInput();
  stepLocal(dt);

  if (myCarId && carMeshes[myCarId] && localCar) {
    const m = carMeshes[myCarId];
    m.position.x = localCar.x; m.position.z = localCar.z;
    const driftRot = (localCar.driftT > 200) ? localCar.driftSide * 0.4 : 0;
    m.rotation.y = localCar.angle + driftRot;
    updateCarDamage(m, localCar.hp);
    m.children.filter(c => c.userData.wheel).forEach(w => { w.rotation.x += localCar.speed*dt*0.55; });
    
    // Shield Visual
    if (localCar.shieldOn) {
      m.traverse(o => { if(o.isMesh && o.material && o.material.emissive) o.material.emissive.setHex(0x0088ff); });
    } else {
      m.traverse(o => { if(o.isMesh && o.material && o.material.emissive && !o.userData.isDent) o.material.emissive.setHex(o.userData.origEm || 0x000000); });
    }

    m.updateMatrixWorld(true);
    updateTrail(m, dt, Math.min(1, Math.abs(localCar.speed)/30));
  }

  // ADDED: distance-based NPC optimization — alternate full/light updates
  _npcThrottle = (_npcThrottle + 1) % 2;
  const camX = cam.position.x, camZ = cam.position.z;

  for (const [id, sv] of Object.entries(serverCars)) {
    if (id === myCarId) continue;
    const m = carMeshes[id]; if (!m) continue;

    // ADDED: distance check — skip heavy work for far cars every other frame
    const distSq = (sv.x - camX)**2 + (sv.z - camZ)**2;
    const isFar = distSq > 120*120;
    if (isFar && _npcThrottle === 1) {
      // Still snap position but skip wheels/trail/damage this frame
      m.position.x = lerp(m.position.x, sv.x, 0.18);
      m.position.z = lerp(m.position.z, sv.z, 0.18);
      const dRot = (sv.driftT > 200) ? sv.driftSide * 0.4 : 0;
      m.rotation.y = lerpAngle(m.rotation.y, sv.angle + dRot, 0.18);
      continue;
    }

    m.position.x = lerp(m.position.x, sv.x, 0.28);
    m.position.z = lerp(m.position.z, sv.z, 0.28);
    const driftRot = (sv.driftT > 200) ? sv.driftSide * 0.4 : 0;
    m.rotation.y = lerpAngle(m.rotation.y, sv.angle + driftRot, 0.28);
    m.children.filter(c => c.userData.wheel).forEach(w => { w.rotation.x += sv.speed*dt*0.55; });
    
    // Shield Visual for others
    if (sv.shieldOn) {
      m.traverse(o => { if(o.isMesh && o.material && o.material.emissive) o.material.emissive.setHex(0x0088ff); });
    } else {
      m.traverse(o => { if(o.isMesh && o.material && o.material.emissive && !o.userData.isDent) o.material.emissive.setHex(o.userData.origEm || 0x000000); });
    }

    m.updateMatrixWorld(true);
    if (!isFar) updateTrail(m, dt, Math.min(1, Math.abs(sv.speed)/30)); // ADDED: skip trail for far cars
    updateCarDamage(m, sv.hp);
  }

  updateCamera();
  updateParticles(dt);
  updateMaterialize(ts);
  updateEffects(ts, dt);
  updatePowerupMeshes(dt, ts);
  drawMinimap();
  updateHUD();

  renderer.render(scene, cam);
}

function lerp(a, b, t) { return a + (b-a)*t; }
function lerpAngle(a, b, t) {
  let d = b - a; while (d > Math.PI) d -= Math.PI*2; while (d < -Math.PI) d += Math.PI*2;
  return a + d*t;
}

// ═══════════════════════════════════════════════════════════════════════
// EFFECTS
// ═══════════════════════════════════════════════════════════════════════
function updateEffects(ts, dt) {
  if (gravSpike) {
    for (const m of Object.values(carMeshes)) {
      if (m.userData.vy === undefined) continue;
      m.userData.vy -= 28*dt;
      m.position.y = Math.max(0, m.position.y + m.userData.vy*dt);
      if (m.position.y <= 0) { delete m.userData.vy; m.position.y = 0; }
    }
  }
  if (glitchStorm) {
    glitchT -= dt;
    if (glitchT <= 0) glitchStorm = false;
    else {
      const jit = glitchT * 2;
      for (const m of Object.values(carMeshes)) {
        m.position.x += (Math.random()-0.5)*0.3*jit;
        m.position.z += (Math.random()-0.5)*0.3*jit;
      }
    }
  }
  const df = document.getElementById('dmg-flash');
  if (dmgFlashT > 0) { dmgFlashT -= dt; df.style.opacity = Math.min(1, dmgFlashT*4); }
  else df.style.opacity = 0;
  const bg = document.getElementById('boost-glow');
  if (boostGlowT > 0) { boostGlowT -= dt; bg.style.opacity = Math.min(1, boostGlowT*2); }
  else bg.style.opacity = 0;
  zoneMeshes.forEach((m, i) => { m.scale.y = 1 + 0.15*Math.sin(ts*0.003 + i); });
  finishMeshes.forEach(m => {
    if (m.material && m.material.emissiveIntensity !== undefined)
      m.material.emissiveIntensity = 0.5 + 0.5*Math.sin(ts*0.005);
  });

  // Moving barriers animation
  for (const [, g] of Object.entries(movingBarrierMeshes)) {
    const {wi, startTime, initPhase, freq, amp} = g.userData;
    const wp = wps[wi % wps.length];
    const nxt = wps[(wi + 1) % wps.length];
    const dx = nxt.x - wp.x, dz = nxt.z - wp.z, len = Math.hypot(dx, dz) || 1;
    const phase = (Date.now() - startTime) / 1000 * freq + initPhase;
    const off = Math.sin(phase) * amp;
    g.position.set(wp.x + (-dz / len) * off, 2, wp.z + (dx / len) * off);
    g.rotation.y += dt * 1.5;
  }

  // Laser gates animation
  for (const [, lg] of Object.entries(laserGateMeshes)) {
    const isActive = Math.floor((Date.now() - lg.startTime) / lg.cycleDur) % 2 === 0;
    lg.mesh.visible = isActive;
    if (isActive) {
      const pulse = 0.5 + 0.5 * Math.sin(ts * 0.012);
      lg.mesh.material.opacity = 0.6 + pulse * 0.4;
    }
  }

  // Low gravity: bounce all car meshes
  if (lowGravMode && Date.now() < lowGravEndT) {
    const t = ts * 0.0025;
    let i = 0;
    for (const [id, m] of Object.entries(carMeshes)) {
      const bounce = Math.abs(Math.sin(t + i * 0.8)) * 5 + 1;
      m.position.y = bounce;
      i++;
    }
  } else if (lowGravMode) {
    lowGravMode = false;
    for (const m of Object.values(carMeshes)) m.position.y = 0;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// MINIMAP
// ═══════════════════════════════════════════════════════════════════════
function drawMinimap() {
  if (!mmCtx || !wps.length) return;
  const sz = 130, pad = 8;
  mmCtx.clearRect(0, 0, sz, sz);
  mmCtx.fillStyle = 'rgba(0,8,20,0.85)';
  mmCtx.fillRect(0, 0, sz, sz);

  let mnx=Infinity, mxx=-Infinity, mnz=Infinity, mxz=-Infinity;
  for (const w of wps) { mnx=Math.min(mnx,w.x); mxx=Math.max(mxx,w.x); mnz=Math.min(mnz,w.z); mxz=Math.max(mxz,w.z); }
  const rx=(mxx-mnx)||1, rz=(mxz-mnz)||1, s=(sz-pad*2)/Math.max(rx,rz);
  const tx = w => pad + (w.x-mnx)*s, tz = w => pad + (w.z-mnz)*s;

  mmCtx.strokeStyle = '#003366'; mmCtx.lineWidth = 4; mmCtx.lineCap = 'round';
  mmCtx.beginPath(); mmCtx.moveTo(tx(wps[0]), tz(wps[0]));
  for (const w of wps) mmCtx.lineTo(tx(w), tz(w));
  mmCtx.closePath(); mmCtx.stroke();

  mmCtx.strokeStyle = '#0055aa'; mmCtx.lineWidth = 1.5;
  mmCtx.beginPath(); mmCtx.moveTo(tx(wps[0]), tz(wps[0]));
  for (const w of wps) mmCtx.lineTo(tx(w), tz(w));
  mmCtx.closePath(); mmCtx.stroke();

  if (finishWI !== null && wps[finishWI]) {
    const fp = wps[finishWI];
    mmCtx.fillStyle = '#ff00ff';
    mmCtx.fillRect(tx(fp)-3, tz(fp)-3, 6, 6);
  }

  for (const [id, sv] of Object.entries(serverCars)) {
    if (sv.eliminated) continue;
    const vh = VEHICLES[sv.vehicleId || sv.vh || 'civic_type_r'];
    const col = id === myCarId ? '#00ffcc' : ('#'+vh.col.toString(16).padStart(6,'0'));
    const cx = pad + (sv.x-mnx)*s, cz = pad + (sv.z-mnz)*s;
    mmCtx.beginPath(); mmCtx.arc(cx, cz, id === myCarId ? 4 : 2.5, 0, Math.PI*2);
    mmCtx.fillStyle = col; mmCtx.fill();
  }
}

// ═══════════════════════════════════════════════════════════════════════
// HUD
// ═══════════════════════════════════════════════════════════════════════
function updateHUD() {
  if (!localCar) return;
  const hp = Math.max(0, localCar.hp);
  const maxHp = VEHICLES[localCar.vh || 'civic_type_r'].hp;
  const pct = hp/maxHp*100;
  const fill = document.getElementById('hp-fill');
  if (fill) { fill.style.width = pct+'%'; fill.style.background = pct>60?'#00ffcc':pct>30?'#ffaa00':'#ff0044'; }
  const hnum = document.getElementById('hp-num'); if (hnum) hnum.textContent = Math.ceil(hp);
  const sp = document.getElementById('hud-speed'); if (sp) sp.innerHTML = Math.abs(Math.round(localCar.speed*2.5))+' <span>km/h</span>';
  const al = document.getElementById('hud-alive'); if (al) { al.textContent = aliveN+' ALIVE'; al.style.color = aliveN<=3?'#ff0044':aliveN<=5?'#ffaa00':'#ff6600'; }
  const ps = document.getElementById('hud-position'); if (ps) ps.textContent = `P ${myPos} / ${aliveN}`;
  // MODIFIED: show boost state and cooldown in effect bar
  const ef = document.getElementById('hud-effect');
  if (ef) {
    const boostReady = boostAbilityCooldown <= 0;
    const boostActive = localCar.boostT > 0;
    if (boostActive) { ef.textContent = '⚡ BOOST'; ef.style.color = '#00ffcc'; }
    else if (!boostReady) {
      const cdSec = Math.ceil(boostAbilityCooldown / 1000);
      ef.textContent = `BOOST ${cdSec}s`; ef.style.color = '#ff8800';
    } else if (ef.textContent.startsWith('BOOST') || ef.textContent === '⚡ BOOST') {
      ef.textContent = '[ SPACE ] BOOST READY'; ef.style.color = '#446655';
      setTimeout(() => { if (ef.textContent.includes('READY')) ef.textContent = ''; }, 2000);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// VOTE UI
// ═══════════════════════════════════════════════════════════════════════
let voteIntervalId = null, myVote = null;

function showVote(opts, dur, isFinal) {
  myVote = null;
  const panel = document.getElementById('vote-panel');
  const grid  = document.getElementById('vote-grid');
  const title = document.getElementById('vote-title');
  const timer = document.getElementById('vote-timer');
  const counts = document.getElementById('vote-counts');

  title.textContent = isFinal ? '▶ ONE SURVIVOR — VOTE TO PLACE THE FINISH LINE' : 'VOTE FOR TRACK CHANGE';
  panel.style.borderColor = isFinal ? '#ff00ff' : '#00ffcc44';
  counts.textContent = '';
  grid.innerHTML = '';

  opts.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className = 'vote-btn';
    btn.dataset.id = opt.id + '_' + idx;
    btn.dataset.realId = opt.id;
    btn.innerHTML = `<div class="vb-label">${opt.label}</div><div class="vb-desc">${opt.desc}</div><div class="vb-bar-wrap"><div class="vb-bar" style="width:0%"></div></div>`;
    btn.onclick = () => castVote(opt.id, btn.dataset.id);
    grid.appendChild(btn);
  });
  panel.classList.remove('hidden');
  let t = Math.ceil(dur/1000);
  timer.textContent = t;
  clearInterval(voteIntervalId);
  voteIntervalId = setInterval(() => {
    t--; timer.textContent = Math.max(0, t);
    if (t <= 0) { clearInterval(voteIntervalId); hideVote(); }
  }, 1000);
}

function castVote(realId, slotId) {
  if (myVote) return;
  myVote = slotId;
  if (socket) socket.emit('vote', {optId: realId});
  document.querySelectorAll('.vote-btn').forEach(b => b.classList.toggle('voted', b.dataset.id === slotId));
}

function updateVoteCounts(counts, total) {
  document.querySelectorAll('.vote-btn').forEach(btn => {
    const id = btn.dataset.realId, c = counts[id]||0, pct = total ? Math.round(c/total*100) : 0;
    const bar = btn.querySelector('.vb-bar');
    if (bar) bar.style.width = pct+'%';
  });
  document.getElementById('vote-counts').textContent = `${total} vote${total!==1?'s':''}`;
}

function showVoteResult(winner, counts) {
  const total = Object.values(counts).reduce((a,b)=>a+b, 0);
  document.querySelectorAll('.vote-btn').forEach(btn => {
    const id = btn.dataset.realId, c = counts[id]||0, pct = total ? Math.round(c/total*100) : 0;
    const bar = btn.querySelector('.vb-bar'); if (bar) bar.style.width = pct+'%';
    if (id === winner) btn.style.borderColor = '#ff00ff';
  });
  setTimeout(hideVote, 2200);
}

function hideVote() { document.getElementById('vote-panel').classList.add('hidden'); clearInterval(voteIntervalId); }

// ═══════════════════════════════════════════════════════════════════════
// LOBBY
// ═══════════════════════════════════════════════════════════════════════
let lobbyTs = 0, lobbyTimerTimeout = null;
function startLobbyTimer(remMs) {
  const totalMs = 120000, circ = 326.7;
  lobbyTs = performance.now() - (totalMs - remMs);
  function tick() {
    const elapsed = performance.now() - lobbyTs;
    const remain = Math.max(0, totalMs - elapsed);
    const secs = Math.ceil(remain/1000);
    const m = Math.floor(secs/60), s = secs%60;
    const el = document.getElementById('lobby-secs'); if (el) el.textContent = m+':'+(s<10?'0':'')+s;
    const ring = document.getElementById('ring-fill'); if (ring) ring.style.strokeDashoffset = circ*(1 - remain/totalMs);
    if (remain > 0) lobbyTimerTimeout = setTimeout(tick, 200);
  }
  clearTimeout(lobbyTimerTimeout); tick();
}

function updateLobbyPlayers(names, count, max) {
  document.getElementById('lobby-count').textContent = `${count} / ${max} players`;
  const list = document.getElementById('lobby-list'); list.innerHTML = '';
  names.forEach(n => {
    const d = document.createElement('div'); d.className = 'lobby-player human'; d.textContent = '▶ '+n;
    list.appendChild(d);
  });
}

// ═══════════════════════════════════════════════════════════════════════
// SCREENS
// ═══════════════════════════════════════════════════════════════════════
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const map = {home:'scr-home', garage:'scr-garage', lobby:'scr-lobby', over:'scr-gameover'};
  if (map[name]) document.getElementById(map[name]).classList.add('active');

  const canvas = document.getElementById('race-canvas');
  const hud = document.getElementById('hud');
  const mm = document.getElementById('minimap');
  if (name === 'race' || name === 'spectate') {
    canvas.style.display = 'block'; hud.classList.remove('hidden');
    if (mm) mm.style.display = 'block';
  } else {
    canvas.style.display = 'none'; hud.classList.add('hidden');
    if (mm) mm.style.display = 'none';
  }
  hideVote();
}

// ═══════════════════════════════════════════════════════════════════════
// SOCKET
// ═══════════════════════════════════════════════════════════════════════
function setupSocket() {
  socket.on('lobby_tick', ({remain}) => startLobbyTimer(remain));
  socket.on('lobby_update', ({count, max, players}) => updateLobbyPlayers(players, count, max));

  socket.on('race_start', ({cars, wps:w, w:rw, trackName, trackType, isBoat, isPlane}) => {
    gamePhase = 'race';
    wps = w; roadW = rw; zones = []; obstacles = []; finishWI = null;
    totalRacers = cars.length;
    raceIsBoat  = !!isBoat;
    raceIsPlane = !!isPlane;
    isEliminated = false;
    showScreen('race');
    clearTimeout(lobbyTimerTimeout);
    rebuildTrack(false);
    applyEnvTheme(trackType !== undefined ? trackType : 0);
    clearPowerupMeshes();
    for (const id of Object.keys(carMeshes)) {
      detachTrail(carMeshes[id]); scene.remove(carMeshes[id]); delete carMeshes[id];
    }
    for (const k in serverCars) delete serverCars[k];
    for (const c of cars) {
      serverCars[c.id] = {...c, vehicleId: c.vh};
      const ownCustom = c.id === myCarId ? custom : (c.custom || {});
      const m = makeCarMesh(c.vh || 'civic_type_r', ownCustom);
      m.position.set(c.x, 0, c.z); m.rotation.y = c.angle;
      scene.add(m); carMeshes[c.id] = m;
      attachTrail(m, scene, ownCustom.exhaust || 'flame');
      if (c.id === myCarId) initLocal(c);
    }
    aliveN = cars.length;
    specTarget = null;
    document.getElementById('spectate-banner').classList.add('hidden');
    if (trackName) { const ef = document.getElementById('hud-effect'); if(ef){ef.textContent='▶ '+trackName;ef.style.color='#00ffcc';setTimeout(()=>{ef.textContent='';},3000);} }
  });

  socket.on('tick', ({cars, alive, pos}) => {
    aliveN = alive;
    if (pos !== undefined) myPos = pos;
    for (const sv of cars) {
      serverCars[sv.id] = {...sv};
      if (sv.id === myCarId) reconcileLocal(sv);
      if (sv.eliminated && carMeshes[sv.id]) {
        carMeshes[sv.id].visible = false;
        delete serverCars[sv.id];
      }
    }
  });

  socket.on('eliminated', ({id, reason}) => {
    if (carMeshes[id]) {
      const m = carMeshes[id];
      const pColor = m.userData.paint || 0xff6600;
      spawnExplosion(m.position.x, m.position.z, pColor, 60, 20);
      spawnExplosion(m.position.x, m.position.z, 0xff3300, 40, 14);
      spawnExplosion(m.position.x, m.position.z, 0xffaa00, 25, 10);
      detachTrail(m);
      m.visible = false;
      if (id === myCarId) dmgFlashT = 0.8;
    }
    if (id === myCarId) {
      isEliminated = true;
      gamePhase = 'spectate';
      document.getElementById('spectate-banner').classList.remove('hidden');
      // Find first visible alive car to spectate
      for (const sid of Object.keys(serverCars)) {
        if (sid !== myCarId && carMeshes[sid] && carMeshes[sid].visible) { specTarget = sid; break; }
      }
    }
  });

  socket.on('powerups_init', ({powerups}) => {
    clearPowerupMeshes();
    for (const pu of powerups) spawnPowerupMesh(pu);
  });

  socket.on('powerup_taken', ({id, carId, type}) => {
    const m = powerupMeshes[id];
    if (m) m.visible = false;
    if (carId === myCarId) {
      const ef = document.getElementById('hud-effect');
      const labels = {boost:'⚡ BOOST!', repair:'❤ REPAIRED', slow:'⚠ SLOWED', spin:'↺ SPINNING',
                      reverse:'⇄ REVERSED', spike_p:'💥 SPIKED', oil_p:'⚠ OIL', shield:'🛡 SHIELD',
                      emp:'📡 EMP FIRED!', missile:'🚀 MISSILE READY'};
      if(ef){ ef.textContent=labels[type]||type; ef.style.color=type==='boost'?'#00ffcc':type==='repair'?'#44ff44':'#ff8800'; setTimeout(()=>{ef.textContent='';},2500); }
      if(type==='boost') boostGlowT = 0.8;
    }
  });

  socket.on('powerup_respawn', ({id}) => {
    const m = powerupMeshes[id];
    if (m) m.visible = true;
  });

  socket.on('private_created', ({code, carId, wps:w, w:rw}) => {
    myCarId = carId; wps = w; roadW = rw;
    document.getElementById('fp-code').textContent = code;
    showScreen('lobby');
    gamePhase = 'lobby';
    document.getElementById('lobby-title').textContent = 'PRIVATE LOBBY — CODE: ' + code;
    startLobbyTimer(120000);
  });

  socket.on('join_error', ({msg}) => { alert(msg); });

  socket.on('joined', ({carId, wps:w, w:rw, lobbyId, trackName}) => {
    myCarId = carId; wps = w; roadW = rw;
    // If we were in the connecting panel (enter code flow), navigate to lobby now
    if (gamePhase !== 'lobby') {
      closeFriendsPopup();
      showScreen('lobby');
      gamePhase = 'lobby';
    }
    const pinger = setInterval(() => {
      if (gamePhase === 'lobby') socket.emit('lobby_timer'); else clearInterval(pinger);
    }, 800);
    startLobbyTimer(120000);
    if (trackName) document.getElementById('lobby-title').textContent = 'TRACK: ' + trackName;
  });

  socket.on('vote_start', ({opts, dur, final:isFinal}) => {
    if (gamePhase === 'race') showVote(opts, dur, isFinal);
  });
  socket.on('vote_update', ({counts, total}) => updateVoteCounts(counts, total));
  socket.on('vote_result', ({winner, counts}) => showVoteResult(winner, counts));

  socket.on('track_w', ({w}) => { roadW = w; rebuildTrack(true); });
  socket.on('track_update', ({wps:w, w:rw, trackType}) => {
    wps = w; roadW = rw; rebuildTrack(true);
    applyEnvTheme(trackType !== undefined ? trackType : currentTrackType);
  });
  socket.on('zone', z => { zones.push(z); addZoneMesh(z); });
  socket.on('obstacles', ({obs}) => { obstacles.push(...obs); addObstacleMeshes(obs); });
  socket.on('finish_placed', ({wi}) => placeFinishLine(wi));

  socket.on('gravity', () => {
    gravSpike = true;
    for (const m of Object.values(carMeshes)) m.userData.vy = 14 + Math.random()*8;
    setTimeout(() => gravSpike = false, 4000);
    showMatrixRain(800);
  });

  socket.on('storm', ({type, mega}) => {
    const ef = document.getElementById('hud-effect');
    if (type === 'slow' || type === 'freeze') {
      if(ef){ef.textContent='🧊 SLOW FIELD';ef.style.color='#88ccff';setTimeout(()=>{ef.textContent='';},2500);}
    }
    else if (type === 'boost') { boostGlowT = 1.2; }
    else if (type === 'reverse') {
      if(ef){ef.textContent='⇄ CONTROLS REVERSED';ef.style.color='#ff0066';setTimeout(()=>{ef.textContent='';},5000);}
      dmgFlashT = 0.4;
    }
    else if (type === 'doublespeed') {
      boostGlowT = 2.5;
      if(ef){ef.textContent='⚡⚡ DOUBLE SPEED';ef.style.color='#ffff00';setTimeout(()=>{ef.textContent='';},4000);}
    }
    else if (type === 'spin') {
      if(ef){ef.textContent='💫 SPIN OUT';ef.style.color='#ff88ff';setTimeout(()=>{ef.textContent='';},2000);}
    }
    else if (type === 'nowalls') {
      if(ef){ef.textContent='🚫 NO WALLS — 5s';ef.style.color='#ffcc00';setTimeout(()=>{ef.textContent='';},3500);}
    }
    else if (type === 'ghost') {
      if(ef){ef.textContent='👻 GHOST MODE — 5s';ef.style.color='#88ffff';setTimeout(()=>{ef.textContent='';},3500);}
    }
    else if (type === 'wave') {
      boostGlowT = 0.8;
      if(ef){ef.textContent='🌊 WAVE BOOST';ef.style.color='#00ffcc';setTimeout(()=>{ef.textContent='';},2000);}
    }
    else {
      // Actual chaos/glitch (storm, mega_storm) — visual jitter
      glitchStorm = true; glitchT = mega ? 4 : 2; dmgFlashT = 0.5;
      showMatrixRain(mega ? 1200 : 800);
    }
  });
  socket.on('moving_barriers', ({barriers}) => {
    for (const b of barriers) {
      const g = new THREE.Group();
      const geo = new THREE.BoxGeometry(b.r * 2, 5, b.r * 2);
      const mat = new THREE.MeshPhongMaterial({color:0xff4400, emissive:0xcc1100, emissiveIntensity:0.7});
      const mesh = new THREE.Mesh(geo, mat);
      g.add(mesh);
      // Glowing ring around the barrier
      const ringGeo = new THREE.TorusGeometry(b.r + 0.5, 0.3, 8, 24);
      const ringMat = new THREE.MeshBasicMaterial({color:0xff6600});
      g.add(new THREE.Mesh(ringGeo, ringMat));
      g.userData = {wi: b.wi, startTime: b.startTime, initPhase: b.initPhase, freq: b.freq, amp: b.amp};
      if (scene) scene.add(g);
      movingBarrierMeshes[b.id] = g;
    }
    const ef = document.getElementById('hud-effect');
    if(ef){ef.textContent='⚠ MOVING BARRIERS';ef.style.color='#ff4400';setTimeout(()=>{ef.textContent='';},2500);}
  });

  socket.on('laser_gates', ({gates}) => {
    for (const g of gates) {
      const wp = wps[g.wi % wps.length];
      const nxt = wps[(g.wi + 1) % wps.length];
      const dx = nxt.x - wp.x, dz = nxt.z - wp.z, len = Math.hypot(dx, dz) || 1;
      const perpX = -dz / len, perpZ = dx / len;
      const hw = roadW * 0.48;
      const pts = [
        new THREE.Vector3(wp.x + perpX * hw, 0.5, wp.z + perpZ * hw),
        new THREE.Vector3(wp.x + perpX * hw, 5.5, wp.z + perpZ * hw),
        new THREE.Vector3(wp.x - perpX * hw, 5.5, wp.z - perpZ * hw),
        new THREE.Vector3(wp.x - perpX * hw, 0.5, wp.z - perpZ * hw),
        new THREE.Vector3(wp.x + perpX * hw, 0.5, wp.z + perpZ * hw),
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({color:0xff0022, fog:false, transparent:true, opacity:0.9});
      const line = new THREE.Line(geo, mat);
      if (scene) scene.add(line);
      laserGateMeshes[g.id] = {mesh: line, startTime: g.startTime, cycleDur: g.cycleDur};
    }
    const ef = document.getElementById('hud-effect');
    if(ef){ef.textContent='⚡ LASER GATES';ef.style.color='#ff0044';setTimeout(()=>{ef.textContent='';},2500);}
  });

  socket.on('fog_event', ({dur}) => {
    if (!scene || !scene.fog) return;
    const origNear = scene.fog.near, origFar = scene.fog.far;
    scene.fog.near = 6; scene.fog.far = 40;
    const ef = document.getElementById('hud-effect');
    if(ef){ef.textContent='🌫 HEAVY FOG';ef.style.color='#aaddff';setTimeout(()=>{ef.textContent='';},3000);}
    setTimeout(() => {
      if (scene && scene.fog) { scene.fog.near = origNear; scene.fog.far = origFar; }
    }, dur);
  });

  socket.on('low_grav', ({dur}) => {
    lowGravMode = true;
    lowGravEndT = Date.now() + dur;
    const ef = document.getElementById('hud-effect');
    if(ef){ef.textContent='🪐 LOW GRAVITY';ef.style.color='#88ffaa';setTimeout(()=>{ef.textContent='';},3000);}
  });

  socket.on('player_left', () => {});

  socket.on('missile_fired', ({fromId, targetId}) => {
    if (carMeshes[fromId]) spawnExplosion(carMeshes[fromId].position.x, carMeshes[fromId].position.z, 0xff3300, 15, 5);
    if (fromId === myCarId) {
      const ef = document.getElementById('hud-effect');
      if(ef){ ef.textContent='🚀 MISSILE FIRED!'; ef.style.color='#ff3300'; setTimeout(()=>{ef.textContent='';},2000); }
    }
  });

  socket.on('emp_fired', ({id}) => {
    if (carMeshes[id]) spawnExplosion(carMeshes[id].position.x, carMeshes[id].position.z, 0x4488ff, 40, 15);
  });

  socket.on('near_miss', ({id}) => {
    if (id === myCarId) {
      const ef = document.getElementById('hud-effect');
      if(ef){ ef.textContent='✨ NEAR MISS +BOOST'; ef.style.color='#ffff00'; setTimeout(()=>{ef.textContent='';},1500); }
      boostGlowT = 0.5;
    }
  });

  socket.on('car_hit', ({id, type}) => {
    if (carMeshes[id]) {
      const m = carMeshes[id];
      if (type === 'missile') spawnExplosion(m.position.x, m.position.z, 0xff5500, 50, 18);
      if (type === 'emp') spawnExplosion(m.position.x, m.position.z, 0x44ccff, 40, 12);
      if (type === 'shield_block') spawnExplosion(m.position.x, m.position.z, 0x0088ff, 30, 10);
      if (id === myCarId) dmgFlashT = 0.5;
    }
  });

  socket.on('race_over', ({winner}) => {
    gamePhase = 'over'; hideVote();
    const title = document.getElementById('go-title');
    const sub   = document.getElementById('go-sub');
    if (!winner) { title.textContent = 'NO SURVIVORS'; sub.textContent = 'Everyone eliminated.'; }
    else if (winner.id === myCarId) {
      title.textContent = 'YOU WIN'; sub.textContent = 'You are the last car standing.';
      wins++; localStorage.setItem('ct_wins', ''+wins);
    } else {
      const name = winner.isNPC ? (winner.name||'NPC') : 'ANOTHER PLAYER';
      title.textContent = 'RACE OVER';
      sub.textContent = `${name} wins.`;
    }
    setTimeout(() => showScreen('over'), 1200);
  });
}
