'use strict';
// ═══════════════════════════════════════════════════════════════════════
// PERSISTENT STATE
// ═══════════════════════════════════════════════════════════════════════
let wins = parseInt(localStorage.getItem('ct_wins') || '0') || 0;
let custom;
try { custom = JSON.parse(localStorage.getItem('ct_custom') || 'null') || {}; }
catch (e) { custom = {}; }

function ensureCustomDefaults() {
  const oldToNew = {neon_runner:'civic_type_r', glitch_rider:'gr86', phase_runner:'skyline_r34', shadow_beast:'mustang_gt500'};
  if (oldToNew[custom.vehicle]) custom.vehicle = oldToNew[custom.vehicle];
  if (!custom.vehicle || !VEHICLES[custom.vehicle]) custom.vehicle = 'civic_type_r';
  const vh = VEHICLES[custom.vehicle];
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
  if (!custom.trims || typeof custom.trims !== 'object') custom.trims = {};
  if (!PLANE_MODELS.find(m => m.id === custom.planeModel)) custom.planeModel = 'stunt';
}
ensureCustomDefaults();
function saveCustom() { localStorage.setItem('ct_custom', JSON.stringify(custom)); }

// ═══════════════════════════════════════════════════════════════════════
// GLOBAL STATE
// ═══════════════════════════════════════════════════════════════════════
let gamePhase = 'home';
let socket = null;
let myCarId = null;
let me = null;                 // predicted physics state of the local car
const cars = {};               // id → render record
let aliveN = 0, myPos = 1;
let specTarget = null;
let raceT = 0;
const env = {noWalls: false, lowG: false, dbl: false, t: 0, ghost: false};

const K = {u: false, d: false, l: false, r: false};
let padSteer = 0, padBoostHeld = false;
let inputDirty = false, lastInputMs = 0;
let boostAbilityCooldown = 0;
const BOOST_ABILITY_DUR = 2800, BOOST_ABILITY_CD = 8000;
let gpCamYaw = 0, gpCamPitch = 0;

let dmgFlashT = 0, boostGlowT = 0, shakeT = 0, glitchT = 0;
let camYaw = 0, camInit = false;
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();

let activePaintTarget = 'body';
let selectedTrackType = -1;
let garageMode = 'car';
let activeGarageTab = 'vehicle';
let fpSelectedMode = '10', fpNumpadMode = null, fpNumpadDigits = '';
let _trackSelectMode = 'race';

const $ = id => document.getElementById(id);
const lerp = (a, b, t) => a + (b - a) * t;
const wrapA = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const clampN = (v, a, b) => v < a ? a : v > b ? b : v;

let effectTimer = null;
function flash(text, color, ms) {
  const ef = $('hud-effect');
  ef.textContent = text; ef.style.color = color || '#00ffcc';
  clearTimeout(effectTimer);
  effectTimer = setTimeout(() => { ef.textContent = ''; }, ms || 2500);
}

// ═══════════════════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  initRenderer();
  initRaceScene();
  initGarage();
  setupInput();
  initMatrixCanvas();
  buildHomeUI();
  buildGarageUI();
  refreshGarageCar();
  showScreen('home');
  window.addEventListener('resize', onResize);
  requestAnimationFrame(frame);
});

function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  raceCam.aspect = garageCam.aspect = w / h;
  raceCam.updateProjectionMatrix(); garageCam.updateProjectionMatrix();
  resizeMatrix();
}

function ensureSocket() {
  if (!socket) { socket = io(); setupSocket(socket); }
  return socket;
}
function dropSocket() {
  if (socket) { socket.disconnect(); socket = null; }
}
function emitWhenReady(ev, data) {
  const s = ensureSocket();
  if (s.connected) s.emit(ev, data); else s.once('connect', () => s.emit(ev, data));
}
const playerName = () => 'PLAYER_' + (Math.random() * 9999 | 0);

// ═══════════════════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════════════════
window.goToHome = function () {
  dropSocket(); clearRace();
  gamePhase = 'home';
  showScreen('home');
  buildHomeUI();
};

window.goToGarage = function () {
  dropSocket(); clearRace();
  gamePhase = 'garage';
  showScreen('garage');
  buildGarageUI();
  refreshGarageCar();
};

window.returnToGarage = window.goToGarage;
window.leaveLobby = window.goToHome;

window.goToCutscene = function () {
  gamePhase = 'cutscene';
  ensureSocket();
  startCutscene(() => {
    emitWhenReady('find_match', {name: playerName(), vh: custom.vehicle, customData: custom, trackType: selectedTrackType >= 0 ? selectedTrackType : undefined});
    $('lobby-title').textContent = 'FINDING MATCH';
    showScreen('lobby');
    gamePhase = 'lobby';
  });
};

window.startBotRace = function () {
  gamePhase = 'cutscene';
  ensureSocket();
  startCutscene(() => {
    emitWhenReady('bot_race', {vh: custom.vehicle, customData: custom, trackType: selectedTrackType >= 0 ? selectedTrackType : undefined});
    showScreen('lobby');
    $('lobby-title').textContent = 'LOADING BOT RACE';
    gamePhase = 'lobby';
  });
};

function trackButton(i, onPick) {
  const btn = document.createElement('div');
  btn.className = 'track-btn' + (selectedTrackType === i ? ' selected' : '');
  const t = i < 0 ? {icon: '🎲', name: 'RANDOM', desc: 'Server picks a random track'} : CT.TRACKS[i];
  btn.innerHTML = `<span class="track-icon">${t.icon}</span><span class="track-info"><span class="track-name">${t.name}</span><span class="track-desc">${t.desc}</span></span>`;
  btn.onclick = () => { selectedTrackType = i; onPick(btn); };
  return btn;
}

window.openTrackSelect = function (mode) {
  _trackSelectMode = mode;
  const list = $('track-select-list');
  list.innerHTML = '';
  const pick = btn => { list.querySelectorAll('.track-btn').forEach(b => b.classList.remove('selected')); btn.classList.add('selected'); };
  for (let i = -1; i < CT.TRACKS.length; i++) list.appendChild(trackButton(i, pick));
  $('track-select-overlay').classList.remove('hidden');
};
window.closeTrackSelect = function () { $('track-select-overlay').classList.add('hidden'); };
window.confirmTrackSelect = function () {
  $('track-select-overlay').classList.add('hidden');
  if (_trackSelectMode === 'bot') startBotRace(); else goToCutscene();
};

window.openFriendsPopup = function () { $('friends-popup').classList.remove('hidden'); };
window.closeFriendsPopup = function () { $('friends-popup').classList.add('hidden'); _fp_showPanel('fp-main'); };

const GARAGE_BG = {car: 0x000814, boat: 0x041830, plane: 0x1a3050};
function setGarageMode(mode, tab, track) {
  garageMode = mode; activeGarageTab = tab;
  if (track !== undefined) selectedTrackType = track;
  garageScene.background.setHex(GARAGE_BG[mode]); garageScene.fog.color.setHex(GARAGE_BG[mode]);
  buildGarageUI(); refreshGarageCar();
}
window.goToBoatGarage  = () => setGarageMode('boat', 'hull', 2);
window.goToPlaneGarage = () => setGarageMode('plane', 'model', 9);
window.goToCarGarage   = () => setGarageMode('car', 'vehicle');

function _fp_showPanel(id) {
  ['fp-main', 'fp-mode-panel', 'fp-numpad-panel', 'fp-create-panel', 'fp-connecting-panel']
    .forEach(p => $(p).classList.toggle('hidden', p !== id));
}

const FP_MODE_LABELS = {'1v1': '1v1', 'team': 'TEAM 6', '10': '10P', '20': '20P', '30': '30P'};
window.fp_create = function () {
  const modesEl = $('fp-mode-btns');
  modesEl.innerHTML = '';
  Object.keys(FP_MODE_LABELS).forEach(m => {
    const b = document.createElement('button');
    b.className = 'fp-mode-btn' + (m === fpSelectedMode ? ' selected' : '');
    b.textContent = FP_MODE_LABELS[m];
    b.onclick = () => { fpSelectedMode = m; modesEl.querySelectorAll('.fp-mode-btn').forEach(x => x.classList.toggle('selected', x === b)); };
    modesEl.appendChild(b);
  });
  _fp_showPanel('fp-mode-panel');
};
window.fp_modeNext = () => fp_showNumpad('create');
window.fp_modeCancel = () => _fp_showPanel('fp-main');
window.fp_enterCode = () => fp_showNumpad('enter');

function fp_showNumpad(mode) {
  fpNumpadMode = mode; fpNumpadDigits = '';
  fp_updateNumpadDisplay();
  $('fp-numpad-label').textContent = mode === 'create' ? 'PICK YOUR CODE (5 DIGITS)' : "ENTER FRIEND'S CODE";
  _fp_showPanel('fp-numpad-panel');
}
function fp_updateNumpadDisplay() {
  const chars = fpNumpadDigits.split('');
  while (chars.length < 5) chars.push('_');
  $('fp-numpad-digits').textContent = chars.join(' ');
}
window.fp_numpadKey = function (d) {
  if (fpNumpadDigits.length >= 5) return;
  fpNumpadDigits += d;
  fp_updateNumpadDisplay();
  if (fpNumpadDigits.length === 5) fp_numpadDone();
};
window.fp_numpadBack = function () { fpNumpadDigits = fpNumpadDigits.slice(0, -1); fp_updateNumpadDisplay(); };
window.fp_numpadDone = function () {
  if (fpNumpadDigits.length < 5) return;
  const code = fpNumpadDigits;
  dropSocket();
  if (fpNumpadMode === 'create') {
    $('fp-code').textContent = code;
    const labels = {'1v1': '1v1', 'team': 'TEAM 6', '10': '10 PLAYERS', '20': '20 PLAYERS', '30': '30 PLAYERS'};
    $('fp-mode-chosen').textContent = 'MODE: ' + labels[fpSelectedMode];
    $('fp-players-list').innerHTML = '';
    emitWhenReady('create_private', {name: playerName(), vh: custom.vehicle, customData: custom, mode: fpSelectedMode, code, trackType: selectedTrackType >= 0 ? selectedTrackType : undefined});
    _fp_showPanel('fp-create-panel');
  } else {
    $('fp-connecting-code').textContent = code.split('').join(' ');
    emitWhenReady('join_private', {code, name: playerName(), vh: custom.vehicle, customData: custom});
    _fp_showPanel('fp-connecting-panel');
  }
};
window.fp_numpadCancel = () => _fp_showPanel(fpNumpadMode === 'create' ? 'fp-mode-panel' : 'fp-main');
window.fp_cancelCreate = function () { dropSocket(); _fp_showPanel('fp-main'); };
window.fp_cancelConnect = function () { dropSocket(); _fp_showPanel('fp-main'); };
window.fp_startPrivate = function () {
  if (socket) socket.emit('private_start');
  closeFriendsPopup();
  showScreen('lobby');
  gamePhase = 'lobby';
};

function buildHomeUI() { $('home-wins').textContent = wins; }

// ═══════════════════════════════════════════════════════════════════════
// GARAGE SCENE
// ═══════════════════════════════════════════════════════════════════════
let garageScene, garageCam, garageCarMesh = null, garageAngle = 0.6, garageDoor = null, garageTable = null;
let garageRimL, garageRimR;
let cutscene = null;

function initGarage() {
  garageScene = new THREE.Scene();
  garageScene.background = new THREE.Color(0x000814);
  garageScene.fog = new THREE.Fog(0x000814, 22, 70);
  garageCam = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 400);
  const S = garageScene;
  S.add(new THREE.HemisphereLight(0x8899cc, 0x101020, 1.4));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(5, 12, 6); S.add(key);
  garageRimL = new THREE.PointLight(0x00ffcc, 60, 40); garageRimL.position.set(-9, 4, -3); S.add(garageRimL);
  garageRimR = new THREE.PointLight(0xff00ff, 60, 40); garageRimR.position.set(9, 4, -3); S.add(garageRimR);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(60, 48), new THREE.MeshStandardMaterial({color: 0x0a0e18, metalness: 0.6, roughness: 0.35, envMap: ENV_MAP, envMapIntensity: 0.18}));
  floor.rotation.x = -Math.PI / 2; S.add(floor);
  const grid = new THREE.GridHelper(120, 60, 0x00ffcc, 0x0a2a3a); grid.position.y = 0.01; grid.material.transparent = true; grid.material.opacity = 0.25; S.add(grid);

  // Turntable
  garageTable = new THREE.Group();
  const tt = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.5, 0.3, 48), new THREE.MeshStandardMaterial({color: 0x1a2030, metalness: 0.9, roughness: 0.25, envMap: ENV_MAP}));
  tt.position.y = 0.15; garageTable.add(tt);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(5.3, 0.07, 8, 64), new THREE.MeshBasicMaterial({color: 0x00ffcc})); ring.rotation.x = Math.PI / 2; ring.position.y = 0.32; garageTable.add(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.03, 8, 64), new THREE.MeshBasicMaterial({color: 0xff00ff})); ring2.rotation.x = Math.PI / 2; ring2.position.y = 0.32; garageTable.add(ring2);
  S.add(garageTable);

  // Room: walls, ribs, neon tubes
  const wallM = new THREE.MeshStandardMaterial({color: 0x0c1220, metalness: 0.6, roughness: 0.5, envMap: ENV_MAP, envMapIntensity: 0.4});
  const mk = (w, h, d, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m || wallM); b.position.set(x, y, z); S.add(b); return b; };
  mk(44, 16, 1, 0, 8, -16); mk(1, 16, 34, -22, 8, 0); mk(1, 16, 34, 22, 8, 0); mk(44, 1, 34, 0, 16, 0);
  mk(15, 16, 1, -14.5, 8, 16); mk(15, 16, 1, 14.5, 8, 16); mk(14, 6, 1, 0, 13, 16);
  const neonC = new THREE.MeshBasicMaterial({color: 0x00ffcc}), neonM = new THREE.MeshBasicMaterial({color: 0xff00ff}), neonW = new THREE.MeshBasicMaterial({color: 0xcfe8ff});
  for (let k = -2; k <= 2; k++) { mk(0.25, 0.25, 30, k * 8, 15.3, 0, neonW); mk(0.8, 16, 0.8, k * 8 + 4, 8, -15.4); }
  mk(0.2, 0.2, 34, -21.3, 5, 0, neonC); mk(0.2, 0.2, 34, 21.3, 5, 0, neonM);
  mk(44, 0.2, 0.2, 0, 10, -15.3, neonC); mk(44, 0.2, 0.2, 0, 3, -15.3, neonM);
  mk(0.3, 10, 0.3, -7.2, 5, 15.4, neonC); mk(0.3, 10, 0.3, 7.2, 5, 15.4, neonC); mk(14.6, 0.3, 0.3, 0, 10.1, 15.4, neonC);
  // Tool racks + crates
  for (const sx of [-1, 1]) { mk(1.2, 5, 8, sx * 20.6, 2.5, -8); mk(3, 2, 3, sx * 17, 1, 10); mk(2, 1.4, 2, sx * 16.6, 2.7, 10.2, new THREE.MeshStandardMaterial({color: sx > 0 ? 0xff00ff : 0x00ffcc, emissive: sx > 0 ? 0x550055 : 0x005544, roughness: 0.5})); }

  // Door (slides up in the launch cutscene) + bright tunnel beyond
  garageDoor = new THREE.Group();
  const doorM = new THREE.MeshStandardMaterial({color: 0x1a2436, metalness: 0.8, roughness: 0.35, envMap: ENV_MAP});
  for (let k = 0; k < 5; k++) { const sl = new THREE.Mesh(new THREE.BoxGeometry(14, 1.96, 0.5), doorM); sl.position.set(0, 1 + k * 2, 16); garageDoor.add(sl); const st = new THREE.Mesh(new THREE.BoxGeometry(14, 0.06, 0.52), neonC); st.position.set(0, 2 + k * 2, 16); garageDoor.add(st); }
  S.add(garageDoor);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(14, 260), new THREE.MeshStandardMaterial({color: 0x10141e, metalness: 0.7, roughness: 0.4, envMap: ENV_MAP})); road.rotation.x = -Math.PI / 2; road.position.set(0, 0.02, 146); S.add(road);
  for (let k = 0; k < 14; k++) { const a = new THREE.Mesh(new THREE.TorusGeometry(9, 0.12, 6, 4, Math.PI), k % 2 ? neonM : neonC); a.position.set(0, 0, 24 + k * 18); a.rotation.z = 0; S.add(a); }
}

function refreshGarageCar() {
  if (garageCarMesh) { garageScene.remove(garageCarMesh); disposeGroup(garageCarMesh); }
  garageCarMesh = makeVehicleMesh(garageMode, custom.vehicle, custom);
  garageCarMesh.position.set(0, garageMode === 'plane' ? 2.2 : garageMode === 'boat' ? 0.55 : 0.3, 0);
  garageCarMesh.scale.setScalar((garageMode === 'car' ? 1.25 : 1) * (garageCarMesh.userData.gs || 1));
  garageScene.add(garageCarMesh);
}

function startCutscene(onDone) {
  showScreen('garage');
  document.querySelector('.garage-ui').style.display = 'none';
  garageCarMesh.rotation.y = 0;
  cutscene = {start: performance.now(), dur: 2600, callback: onDone};
}

const _csA = new THREE.Vector3(3.5, 1.7, -9), _csB = new THREE.Vector3(0, 2.3, -8), _csC = new THREE.Vector3(0, 3.2, -7);
function updateCutscene(ts) {
  const t = Math.min((ts - cutscene.start) / cutscene.dur, 1);
  const baseY = garageMode === 'plane' ? 2.2 : garageMode === 'boat' ? 0.55 : 0.3;
  const doorT = t < 0.25 ? 0 : t < 0.6 ? (t - 0.25) / 0.35 : 1;
  garageDoor.position.y = (1 - Math.pow(1 - doorT, 3)) * 11;
  const car = garageCarMesh;
  if (t < 0.35) {
    car.position.set(0, baseY + Math.abs(Math.sin(ts * 0.04)) * 0.035, 0);
    garageCam.position.lerpVectors(_csA, _csB, t / 0.35);
  } else {
    const t2 = (t - 0.35) / 0.65;
    car.position.set(0, baseY + (garageMode === 'plane' ? t2 * t2 * 6 : 0), t2 * t2 * 150);
    if (garageMode === 'plane') car.rotation.x = -t2 * 0.25;
    for (const w of car.userData.wheels) w.rotation.x += 0.35 + t2 * 0.6;
    garageCam.position.lerpVectors(_csB, _csC, t2);
    garageCam.position.z = _csB.z + car.position.z * 0.86;
  }
  garageCam.lookAt(0, 1.0 + (car.position.y - baseY) * 0.8, car.position.z);
  const fade = $('cutscene-fade');
  fade.style.opacity = t > 0.72 ? (t - 0.72) / 0.28 : 0;
  if (t >= 1) {
    const cb = cutscene.callback;
    cutscene = null;
    document.querySelector('.garage-ui').style.display = '';
    car.position.set(0, baseY, 0); car.rotation.x = 0;
    garageDoor.position.y = 0;
    setTimeout(() => { fade.style.opacity = 0; if (cb) cb(); }, 200);
  }
}

function updateGarage(dt, ts) {
  if (PS.pts.parent !== garageScene) attachParticles(garageScene);
  if (cutscene) updateCutscene(ts);
  else {
    garageAngle += dt * 0.28;
    const home = gamePhase !== 'garage';
    const r = home ? 13 : 10.5, h = home ? 3.6 : 3.0;
    garageCam.position.set(Math.sin(garageAngle) * r, h + Math.sin(garageAngle * 0.5) * 0.4, Math.cos(garageAngle) * r * 0.9 - 1);
    garageCam.lookAt(0, home ? 1.6 : -1.3, 0);
    garageCarMesh.rotation.y -= dt * 0.35;
    garageTable.rotation.y = garageCarMesh.rotation.y;
    if (garageMode !== 'car') garageCarMesh.position.y = (garageMode === 'plane' ? 2.2 : 0.55) + Math.sin(ts * 0.002) * 0.12;
    for (const w of garageCarMesh.userData.wheels) w.rotation.x += dt * 0.8;
  }
  garageRimL.intensity = 60 + Math.sin(ts * 0.002) * 18;
  garageRimR.intensity = 70 + Math.sin(ts * 0.002 + 1) * 18;
  emitExhaust(garageCarMesh, custom.exhaust || 'flame', cutscene ? 1 : 0.3, dt, garageMode, false);
  updateParticles(dt);
  renderer.render(garageScene, garageCam);
}

// ═══════════════════════════════════════════════════════════════════════
// GARAGE UI
// ═══════════════════════════════════════════════════════════════════════
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }

function _makeTabs(tabsEl, tabs) {
  tabsEl.innerHTML = '';
  for (const t of tabs) {
    const btn = el('button', 'ctab' + (t.id === activeGarageTab ? ' active' : ''), t.label);
    btn.onclick = () => { activeGarageTab = t.id; buildGarageUI(); };
    tabsEl.appendChild(btn);
  }
}
function _makePane(panesEl) { const pane = el('div', 'tab-pane active'); panesEl.appendChild(pane); return pane; }
function applyCustom() { saveCustom(); buildGarageUI(); refreshGarageCar(); }

function _buildVehiclePane(pane) {
  const selV = VEHICLES[custom.vehicle];
  pane.appendChild(el('div', 'vh-pane-name', selV.name));
  pane.appendChild(el('div', 'vh-desc', selV.desc));
  const row = el('div', 'vh-slots-row');
  for (const [id, v] of Object.entries(VEHICLES)) {
    const locked = wins < v.wins, hex = hexCss(v.col);
    const slot = el('div', 'vh-slot' + (locked ? ' locked' : '') + (id === custom.vehicle ? ' selected' : ''));
    if (locked) slot.innerHTML = `<div>🔒</div><div class="vh-make">${v.make}</div><div class="vh-name">${v.name}</div><div class="vh-req">🏆 ${v.wins} WINS TO UNLOCK</div>`;
    else {
      const bars = ['SPD', 'HND', 'ARM'].map((lbl, i) => `<span class="vh-stat">${lbl} <i style="width:${v.stats[i] * 10}px;background:${hex}"></i></span>`).join('');
      slot.innerHTML = `<div class="vh-bar" style="background:${hex};box-shadow:0 0 8px ${hex}"></div><div class="vh-make">${v.make}</div><div class="vh-name">${v.name}</div><div class="vh-stats">${bars}</div>`;
      slot.onclick = () => {
        custom.vehicle = id;
        if (v.liv) { custom.bodyPaint = v.col; custom.trimPaint = v.liv.trim; custom.bumpersPaint = v.liv.bumpers; custom.wheelsPaint = v.liv.wheels; }
        custom.trims = {};
        applyCustom();
      };
    }
    row.appendChild(slot);
  }
  pane.appendChild(row);
}

function _chips(pane, current, onPick) {
  const wrap = el('div', 'chip-wrap');
  for (const col of PAINTS) {
    const chip = el('div', 'paint-chip' + (col === current ? ' selected' : ''));
    chip.style.background = hexCss(col);
    chip.onclick = () => onPick(col);
    wrap.appendChild(chip);
  }
  pane.appendChild(wrap);
}

function _buildPaintPane(pane) {
  const row = el('div', 'paint-target-row');
  for (const tgt of PAINT_TARGETS) {
    const btn = el('button', 'paint-target-btn' + (tgt === activePaintTarget ? ' active' : ''), tgt.toUpperCase());
    btn.onclick = () => { activePaintTarget = tgt; buildGarageUI(); };
    row.appendChild(btn);
  }
  pane.appendChild(row);
  _chips(pane, paintForTarget(custom, activePaintTarget, VEHICLES[custom.vehicle]), col => { custom[activePaintTarget + 'Paint'] = col; applyCustom(); });
}

function _buildColorPane(pane, label, propKey) {
  pane.appendChild(el('div', 'pane-label', label));
  _chips(pane, custom[propKey], col => { custom[propKey] = col; applyCustom(); });
}

function _buildOptPane(pane, list, key, deco) {
  for (const o of list) {
    const b = el('div', 'opt-btn' + (o.id === custom[key] ? ' selected' : ''), (deco ? deco(o) : '') + o.name);
    b.onclick = () => { custom[key] = o.id; applyCustom(); };
    pane.appendChild(b);
  }
}

function _buildTrimsPane(pane) {
  const vh = VEHICLES[custom.vehicle], t = custom.trims;
  const toggle = (o, on) => {
    const b = el('div', 'opt-btn' + (on ? ' selected' : ''), o.name);
    b.onclick = () => { t[o.id] = !on; applyCustom(); };
    pane.appendChild(b);
  };
  if (vh.type === 'f1') {
    pane.appendChild(el('div', 'pane-label', 'AERO PARTS'));
    for (const o of F1_TRIM_TOGGLES) toggle(o, t[o.id] === undefined ? !!o.def : !!t[o.id]);
    return;
  }
  pane.appendChild(el('div', 'pane-label', 'SPOILER'));
  const list = vh.type === 'truck' ? SPOILERS.filter(o => ['stock', 'none', 'lip'].includes(o.id)) : SPOILERS;
  const cur = t.spoiler || 'stock';
  for (const o of list) {
    const b = el('div', 'opt-btn' + (o.id === cur ? ' selected' : ''), o.name);
    b.onclick = () => { t.spoiler = o.id; applyCustom(); };
    pane.appendChild(b);
  }
  pane.appendChild(el('div', 'pane-label', 'EXTRAS'));
  const spec = CAR_SPECS[custom.vehicle] || {};
  for (const o of TRIM_TOGGLES) toggle(o, t[o.id] === undefined ? !!(o.def || (o.stock && spec[o.stock])) : !!t[o.id]);
}

function _buildPlaneModelPane(pane) {
  for (const m of PLANE_MODELS) {
    const b = el('div', 'opt-btn' + (m.id === custom.planeModel ? ' selected' : ''), m.name);
    b.onclick = () => {
      custom.planeModel = m.id;
      if (m.livery === null) { delete custom.planeLiveryPaint; delete custom.planeAccentPaint; }
      else { custom.planeLiveryPaint = m.livery; custom.planeAccentPaint = m.accent; }
      applyCustom();
    };
    pane.appendChild(b);
  }
}

function _buildTrackPane(pane) {
  for (let i = -1; i < CT.TRACKS.length; i++) pane.appendChild(trackButton(i, () => buildGarageUI()));
}

function buildGarageUI() {
  const titleEl = $('garage-title-text'), leftEl = $('garage-header-left'), rightEl = $('garage-header-right');
  const winsHtml = `<div class="wins-pill">WINS: <span id="garage-wins">${wins}</span></div>`;
  if (garageMode === 'car') {
    titleEl.textContent = 'GARAGE';
    leftEl.innerHTML = `<button class="btn-icon" onclick="goToHome()">◀  BACK</button><button class="btn-icon alt-blue" onclick="goToBoatGarage()">🌊 BOAT GARAGE</button>`;
    rightEl.innerHTML = `${winsHtml}<button class="btn-icon alt-sky" onclick="goToPlaneGarage()">✈ PLANE GARAGE</button>`;
  } else {
    titleEl.textContent = garageMode === 'boat' ? 'BOAT GARAGE' : 'PLANE GARAGE';
    leftEl.innerHTML = `<button class="btn-icon" onclick="goToCarGarage()">◀  CAR GARAGE</button>`;
    rightEl.innerHTML = winsHtml;
  }

  const tabsEl = $('garage-tabs'), panesEl = $('garage-panes');
  const tabs = garageMode === 'boat' ? [{id:'hull',label:'HULL'},{id:'accents',label:'ACCENTS'},{id:'decal',label:'DECAL'},{id:'track',label:'TRACK'}]
    : garageMode === 'plane' ? [{id:'model',label:'MODEL'},{id:'fuselage',label:'FUSELAGE'},{id:'wings',label:'WINGS'},{id:'decal',label:'DECAL'},{id:'track',label:'TRACK'}]
    : [{id:'vehicle',label:'VEHICLE'},{id:'paint',label:'PAINT'},{id:'wheels',label:'WHEELS'},{id:'trims',label:'TRIMS'},{id:'exhaust',label:'EXHAUST'},{id:'decal',label:'DECAL'},{id:'track',label:'TRACK'}];
  if (!tabs.find(t => t.id === activeGarageTab)) activeGarageTab = tabs[0].id;
  _makeTabs(tabsEl, tabs);
  panesEl.innerHTML = '';
  const pane = _makePane(panesEl);
  switch (activeGarageTab) {
    case 'vehicle':  _buildVehiclePane(pane); break;
    case 'paint':    _buildPaintPane(pane); break;
    case 'wheels':   _buildOptPane(pane, WHEEL_STYLES, 'wheels', w => { const s = Math.round(w.radius * 34); return `<span class="wheel-ico" style="width:${s}px;height:${s}px;border:${w.thick ? 5 : 3}px solid ${hexCss(custom.wheelsPaint)}"></span>`; }); break;
    case 'trims':    _buildTrimsPane(pane); break;
    case 'model':    _buildPlaneModelPane(pane); break;
    case 'exhaust':  _buildOptPane(pane, EXHAUSTS, 'exhaust', e => e.id === 'none' ? '' : `<span class="opt-swatch" style="background:${hexCss(e.col)};box-shadow:0 0 6px ${hexCss(e.col)}"></span>`); break;
    case 'decal':    _buildOptPane(pane, STICKERS, 'sticker'); break;
    case 'track':    _buildTrackPane(pane); break;
    case 'hull':     _buildColorPane(pane, 'HULL COLOR', 'boatHullPaint'); break;
    case 'accents':  _buildColorPane(pane, 'ACCENT / STRIPE', 'boatAccentPaint'); break;
    case 'fuselage': _buildColorPane(pane, 'FUSELAGE COLOR', 'planeLiveryPaint'); break;
    case 'wings':    _buildColorPane(pane, 'WING / ENGINE COLOR', 'planeAccentPaint'); break;
  }

  const btnRow = $('garage-btn-row');
  if (garageMode === 'boat') btnRow.innerHTML = `<button class="btn-big btn-bot" onclick="selectedTrackType=2;openTrackSelect('bot')">BOT WATER RACE ▶</button><button class="btn-big" onclick="selectedTrackType=2;openTrackSelect('race')">RACE ON WATER ▶</button>`;
  else if (garageMode === 'plane') btnRow.innerHTML = `<button class="btn-big btn-bot" onclick="selectedTrackType=9;openTrackSelect('bot')">BOT SKY RACE ▶</button><button class="btn-big" onclick="selectedTrackType=9;openTrackSelect('race')">FLY THE SKY ▶</button>`;
  else btnRow.innerHTML = `<button class="btn-big btn-bot" onclick="openTrackSelect('bot')">BOT RACE ▶</button><button class="btn-big" onclick="openTrackSelect('race')">START RACE ▶</button><button class="btn-big btn-friends" onclick="openFriendsPopup()">RACE WITH FRIENDS</button>`;
}

// ═══════════════════════════════════════════════════════════════════════
// INPUT
// ═══════════════════════════════════════════════════════════════════════
function setupInput() {
  const set = (e, v) => {
    let hit = true;
    if (e.code === 'ArrowUp' || e.code === 'KeyW') K.u = v;
    else if (e.code === 'ArrowDown' || e.code === 'KeyS') K.d = v;
    else if (e.code === 'ArrowLeft' || e.code === 'KeyA') K.l = v;
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') K.r = v;
    else hit = false;
    if (hit) inputDirty = true;
    return hit;
  };
  document.addEventListener('keydown', e => {
    const racing = gamePhase === 'race' || gamePhase === 'spectate';
    if (set(e, true) && racing) e.preventDefault();
    if (e.code === 'Space' && gamePhase === 'race') { if (!e.repeat) triggerBoostAbility(); e.preventDefault(); }
    if ((e.code === 'BracketLeft' || e.code === 'BracketRight' || e.code === 'Tab') && gamePhase === 'spectate') {
      e.preventDefault();
      cycleSpecTarget(e.code === 'BracketLeft' ? -1 : 1);
    }
  });
  document.addEventListener('keyup', e => set(e, false));
  window.addEventListener('blur', () => { K.u = K.d = K.l = K.r = false; inputDirty = true; });
}

window.triggerBoostAbility = function () {
  if (gamePhase !== 'race' || !me) return;
  if (me.hasMissile) {
    socket.emit('fire_missile'); me.hasMissile = false;
    flash('🚀 MISSILE FIRED!', '#ff3300', 2000);
  } else if (me.hasEMP) {
    socket.emit('fire_emp'); me.hasEMP = false;
    flash('📡 EMP FIRED!', '#4488ff', 2000);
  } else if (boostAbilityCooldown <= 0) {
    boostAbilityCooldown = BOOST_ABILITY_DUR + BOOST_ABILITY_CD;
    socket.emit('boost_ability');
    me.boostT = Math.max(me.boostT, BOOST_ABILITY_DUR);
    boostGlowT = 1.5;
  }
};

function pollGamepad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let pad = null;
  for (const p of pads) if (p && p.connected) { pad = p; break; }
  if (!pad) { padSteer = 0; return; }
  const dead = 0.18, ax = i => Math.abs(pad.axes[i] || 0) > dead ? pad.axes[i] : 0;
  const lx = ax(0), ly = ax(1);
  const bt = i => pad.buttons[i] && pad.buttons[i].pressed;
  const u = ly < -dead || bt(7) || bt(0), d = ly > dead || bt(6);
  if (pad._ct !== undefined || lx || ly || u || d) {
    if (K.pu !== u || K.pd !== d || Math.abs(padSteer + lx) > 0.02) inputDirty = true;
    K.pu = u; K.pd = d; padSteer = -lx;
  }
  gpCamYaw = lerp(gpCamYaw, ax(2) * 1.2, 0.15);
  gpCamPitch = lerp(gpCamPitch, ax(3) * 2.5, 0.15);
  const b = !!bt(1);
  if (b && !padBoostHeld) triggerBoostAbility();
  padBoostHeld = b;
  if (gamePhase === 'spectate') {
    if (bt(5) && !pad._r) cycleSpecTarget(1);
    if (bt(4) && !pad._l) cycleSpecTarget(-1);
  }
  pad._r = bt(5); pad._l = bt(4);
}

function currentInput() {
  const st = clampN((K.l ? 1 : 0) - (K.r ? 1 : 0) + padSteer, -1, 1);
  return {u: K.u || !!K.pu, d: K.d || !!K.pd, st};
}

function sendInput(inp) {
  const now = performance.now();
  if ((inputDirty || now - lastInputMs > 100) && gamePhase === 'race' && socket) {
    socket.emit('input', {u: inp.u, d: inp.d, st: Math.round(inp.st * 100) / 100});
    inputDirty = false; lastInputMs = now;
  }
}

function cycleSpecTarget(dir) {
  const alive = Object.keys(cars).filter(id => !cars[id].dead);
  if (!alive.length) return;
  const cur = alive.indexOf(specTarget);
  specTarget = alive[((cur + dir) + alive.length) % alive.length];
}

// ═══════════════════════════════════════════════════════════════════════
// RACE CARS
// ═══════════════════════════════════════════════════════════════════════
const _so = {}, _rp = {h: 0, sl: 0};
const _F = new THREE.Vector3(), _L = new THREE.Vector3(), _U = new THREE.Vector3(), _M = new THREE.Matrix4();
let shadowGeo = null, shadowMat = null, shieldGeo = null, shieldMat = null;

function addCar(c) {
  const mine = c.id === myCarId, cu = mine ? custom : (c.custom || {});
  const rec = {
    id: c.id, vh: c.vh, custom: cu, name: c.name, isNPC: c.isNPC, mine,
    x: c.x, y: c.y, z: c.z, angle: c.angle, speed: 0, vy: 0, st: 0, pit: 0, onGround: true, wi: -1,
    hp: c.hp, maxHp: c.maxHp || c.hp, sv: null, dead: false,
    vsl: 0, vrl: 0, gyv: c.y, boostT: 0, driftT: 0, driftSide: 0, shield: false,
    exhaust: cu.exhaust || 'flame', mesh: null, shadow: null, bubble: null,
  };
  cars[c.id] = rec;
  buildCarMesh(rec);
  return rec;
}

function buildCarMesh(rec) {
  if (rec.mesh) { raceScene.remove(rec.mesh); disposeGroup(rec.mesh); }
  rec.mesh = makeVehicleMesh(W.tr.mode, rec.vh, rec.custom);
  rec.mesh.visible = !rec.dead;
  raceScene.add(rec.mesh);
  if (!shadowGeo) {
    shadowGeo = new THREE.PlaneGeometry(4.6, 7); shadowGeo.rotateX(-Math.PI / 2); shadowGeo.userData = {shared: true};
    shadowMat = new THREE.MeshBasicMaterial({map: TEX.blob, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2});
    shieldGeo = new THREE.SphereGeometry(3.3, 18, 12);
    shieldMat = new THREE.MeshBasicMaterial({color: 0x2299ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false});
  }
  if (!rec.shadow) { rec.shadow = new THREE.Mesh(shadowGeo, shadowMat); rec.shadow.renderOrder = 1; raceScene.add(rec.shadow); }
  if (!rec.bubble) { rec.bubble = new THREE.Mesh(shieldGeo, shieldMat); rec.bubble.visible = false; raceScene.add(rec.bubble); }
}

function removeCar(rec) {
  raceScene.remove(rec.mesh); disposeGroup(rec.mesh);
  if (rec.shadow) raceScene.remove(rec.shadow);
  if (rec.bubble) raceScene.remove(rec.bubble);
}

function clearRace() {
  for (const id of Object.keys(cars)) { removeCar(cars[id]); delete cars[id]; }
  me = null; myCarId = null; specTarget = null;
  resetObjects();
  hideVote();
  clearTimeout(lobbyTimerTimeout);
  $('spectate-banner').classList.add('hidden');
  dmgFlashT = boostGlowT = glitchT = 0;
  $('dmg-flash').style.opacity = 0; $('boost-glow').style.opacity = 0;
}

// Ground height + tilt under a car, for remote cars and shadows
const _nrp = {h: 0, sl: 0};
function surface(c) {
  const tr = W.tr;
  if (tr.mode === 'boat') {
    const fx = Math.sin(c.angle), fz = Math.cos(c.angle);
    c.gyv = CT.waveH(c.x, c.z, raceT);
    c.tsl = (CT.waveH(c.x + fx * 2, c.z + fz * 2, raceT) - CT.waveH(c.x - fx * 2, c.z - fz * 2, raceT)) / 4;
    c.trl = (CT.waveH(c.x + fz * 1.2, c.z - fx * 1.2, raceT) - CT.waveH(c.x - fz * 1.2, c.z + fx * 1.2, raceT)) / 2.4;
    c.offRoad = false;
  } else if (tr.mode === 'car') {
    const o = CT.sample(tr, c.x, c.y, c.z, c.wi, _so);
    c.wi = o.i;
    CT.rampAt(tr, o.s, _rp);
    CT.nrampAt(tr, o.s, o.lat, _nrp);
    const rel = c.angle - o.ang, ca = Math.cos(rel), sa = Math.sin(rel), rs = o.sl + _rp.sl + _nrp.sl;
    c.gyv = o.cy + o.lat * o.bk + _rp.h + _nrp.h;
    c.tsl = ca * rs + sa * o.bk;
    c.trl = -sa * rs + ca * o.bk;
    c.offRoad = Math.abs(o.lat) > tr.w / 2 + 0.6;
  } else { c.gyv = -1e6; c.tsl = Math.tan(c.pit); c.trl = 0; c.offRoad = true; }
}

function poseCar(c, dt) {
  const tr = W.tr, m = c.mesh, k = 1 - Math.exp(-12 * dt);
  surface(c);
  const air = tr.mode !== 'plane' && c.y - c.gyv > 0.6;
  let tsl = c.tsl, trl = c.trl;
  if (air) { tsl = clampN(c.vy / Math.max(Math.abs(c.speed), 14), -0.7, 0.7); trl = c.vrl * 0.9; }
  c.vsl += (tsl - c.vsl) * k; c.vrl += (trl - c.vrl) * k;
  _F.set(Math.sin(c.angle), c.vsl, Math.cos(c.angle)).normalize();
  _L.set(Math.cos(c.angle), c.vrl, -Math.sin(c.angle)).normalize();
  _U.crossVectors(_F, _L).normalize();
  _L.crossVectors(_U, _F);
  m.quaternion.setFromRotationMatrix(_M.makeBasis(_L, _U, _F));
  m.position.set(c.x, c.y, c.z);
  const sf = Math.min(1, Math.abs(c.speed) / 30);
  if (tr.mode === 'plane') m.rotateZ(-c.st * 0.7);
  else if (tr.mode === 'boat') { m.rotateZ(-c.st * 0.28 * sf); m.rotateX(-0.06 * sf); }
  else {
    if (c.driftT > 250 && !air) m.rotateY(c.driftSide * 0.32);
    m.rotateZ(c.st * 0.05 * sf);
    for (const w of m.userData.front) w.rotation.y = c.st * 0.42;
  }
  for (const w of m.userData.wheels) w.rotation.x += c.speed * dt * 2.6;

  // Shadow
  const sh = c.shadow;
  if (tr.mode === 'plane' || c.offRoad || c.dead) sh.visible = false;
  else {
    sh.visible = true;
    const hgt = Math.max(0, c.y - c.gyv), s = 1 / (1 + hgt * 0.12);
    sh.position.set(c.x, c.gyv + 0.08, c.z);
    sh.quaternion.copy(m.quaternion);
    sh.scale.set(s, 1, s);
  }
  m.scale.setScalar(c.jug ? 1.3 : 1);
  m.visible = !c.dead && !(c.ghost && Math.floor(performance.now() / 110) % 2);
  c.bubble.visible = c.shield && !c.dead;
  if (c.bubble.visible) { c.bubble.position.set(c.x, c.y + 1, c.z); c.bubble.scale.setScalar(1 + Math.sin(performance.now() * 0.01) * 0.04); }
}

// ── Exhaust / trail particles ────────────────────────────────────────
const _ev = new THREE.Vector3(), _hsl = new THREE.Color();
function emitExhaust(mesh, exId, intensity, dt, mode, boosting) {
  const ud = mesh.userData;
  if (!ud.exhaust) return;
  mesh.updateMatrixWorld(true);
  const n = intensity * 90 * dt, count = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0);
  const back = _F.set(0, 0, -1).transformDirection(mesh.matrixWorld);
  for (let i = 0; i < count; i++) {
    ud.exSide = !ud.exSide;
    const p = _ev.copy(ud.exhaust[ud.exSide ? 1 : 0]).applyMatrix4(mesh.matrixWorld);
    let r = 1, g = 0.4, b = 0.05, size = 1.3, life = 0.35, grav = 0, sp = 5;
    if (boosting) { r = 0.3; g = 0.8; b = 1; size = 2; life = 0.4; sp = 9; }
    else if (mode === 'boat') { r = g = b = 0.5; size = 1.1; life = 0.5; grav = 9; sp = 4; }
    else switch (exId) {
      case 'none': if (mode !== 'plane') continue; r = g = b = 0.5; size = 1.6; life = 0.8; break;
      case 'flame': g = 0.3 + Math.random() * 0.4; break;
      case 'electric': r = 0; g = 0.85; b = 1; size = 1; life = 0.25; break;
      case 'plasma': r = 1; g = 0; b = 1; size = 1.6; break;
      case 'smoke': r = g = b = 0.28; size = 2.4; life = 0.8; grav = -2; break;
      case 'rainbow': _hsl.setHSL((performance.now() * 0.0006 + Math.random() * 0.15) % 1, 1, 0.5); r = _hsl.r; g = _hsl.g; b = _hsl.b; break;
      case 'lightning': if (Math.random() < 0.5) continue; r = 1; g = 1; b = 0.4; size = 0.9; life = 0.18; sp = 12; break;
      case 'embers': r = 1; g = 0.5; b = 0; size = 0.8; life = 0.9; grav = -3; break;
      case 'void': r = 0.4; g = 0; b = 1; size = 1.9; life = 0.5; break;
      case 'frost': r = 0.65; g = 1; b = 1; size = 1.2; life = 0.5; grav = 2; break;
      case 'gold': r = 1; g = 0.8; b = 0; size = 1; life = 0.45; grav = 6; break;
    }
    if (mode === 'boat') p.y = Math.max(p.y, 0.2);
    spark(p.x, p.y, p.z, back.x * sp + (Math.random() - 0.5) * 2, back.y * sp + (Math.random() - 0.5) * 2 + (mode === 'boat' ? 4 : 0.5), back.z * sp + (Math.random() - 0.5) * 2, r, g, b, size, life * (0.7 + Math.random() * 0.6), grav);
  }
}

function carFx(c, dt) {
  const d2 = raceCam.position.distanceToSquared(c.mesh.position);
  if (d2 > 170 * 170) return;
  const mode = W.tr.mode, sp = Math.abs(c.speed);
  emitExhaust(c.mesh, c.exhaust, Math.min(1, sp / 30) * (d2 > 80 * 80 ? 0.4 : 1), dt, mode, c.boostT > 0);
  const air = c.y - c.gyv > 0.6;
  if (mode === 'car' && c.driftT > 250 && !air && Math.random() < 30 * dt) {
    const bx = c.x - Math.sin(c.angle) * 1.6, bz = c.z - Math.cos(c.angle) * 1.6;
    spark(bx + (Math.random() - 0.5) * 2, c.y + 0.3, bz + (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 1.5, (Math.random() - 0.5) * 2, 0.3, 0.3, 0.33, 3, 0.7, -1);
  }
  if (mode === 'boat' && sp > 8 && !air && Math.random() < 50 * dt) {
    const side = Math.random() < 0.5 ? 1 : -1;
    spark(c.x + Math.cos(c.angle) * side * 1.2, c.gyv + 0.2, c.z - Math.sin(c.angle) * side * 1.2, Math.cos(c.angle) * side * 4, 3 + Math.random() * 3, -Math.sin(c.angle) * side * 4, 0.7, 0.85, 0.95, 1.6, 0.6, 12);
  }
  const hpk = c.hp / c.maxHp;
  if (hpk < 0.45 && Math.random() < (hpk < 0.2 ? 40 : 14) * dt) {
    const fire = hpk < 0.2;
    spark(c.x + Math.sin(c.angle) * 1.4, c.y + 1, c.z + Math.cos(c.angle) * 1.4, (Math.random() - 0.5) * 1.5, 3 + Math.random() * 2, (Math.random() - 0.5) * 1.5, fire ? 1 : 0.22, fire ? 0.35 + Math.random() * 0.3 : 0.22, fire ? 0 : 0.24, fire ? 2 : 3, 0.8, -2);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// RACE LOOP
// ═══════════════════════════════════════════════════════════════════════
function stepMe(inp, dt) {
  if (!me || gamePhase !== 'race') return;
  const wasGround = me.onGround, n = Math.max(1, Math.ceil(dt / 0.026));
  for (let i = 0; i < n; i++) {
    env.t = raceT;
    CT.stepCar(me, inp, dt / n, W.tr, env);
    if (me.landed > 9 && !wasGround) {
      shakeT = Math.min(0.5, me.landed / 60);
      for (let k = 0; k < 14; k++) spark(me.x + (Math.random() - 0.5) * 3, me.y + 0.2, me.z + (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 8, 1 + Math.random() * 3, (Math.random() - 0.5) * 8, 0.5, 0.5, 0.55, 2.4, 0.5, 4);
    }
    if (me.wallHit && Math.abs(me.speed) > 8) {
      shakeT = Math.max(shakeT, 0.12);
      const sg = me.lat > 0 ? 1 : -1, lx = Math.cos(me.ta) * sg, lz = -Math.sin(me.ta) * sg;
      if (Math.random() < 0.6) spark(me.x + lx * 1.2, me.y + 0.6, me.z + lz * 1.2, -lx * 5 + (Math.random() - 0.5) * 6, 2 + Math.random() * 5, -lz * 5 + (Math.random() - 0.5) * 6, 1, 0.75, 0.3, 0.9, 0.4, 20);
    }
  }
  me.fell = false;
  if (boostAbilityCooldown > 0) boostAbilityCooldown -= dt * 1000;
  const rec = cars[myCarId];
  if (rec) {
    rec.x = me.x; rec.y = me.y; rec.z = me.z; rec.angle = me.angle; rec.speed = me.speed; rec.vy = me.vy; rec.pit = me.pit;
    rec.st = lerp(rec.st, inp.st * (me.reverseT > 0 ? -1 : 1), 1 - Math.exp(-10 * dt));
    rec.wi = me.wi; rec.boostT = me.boostT; rec.driftT = me.driftT; rec.driftSide = me.driftSide;
  }
}

function reconcile(sv) {
  if (!me) return;
  const dx = sv.x - me.x, dy = sv.y - me.y, dz = sv.z - me.z, d = Math.hypot(dx, dz);
  if (d > 7 || Math.abs(dy) > 9) {
    me.x = sv.x; me.y = sv.y; me.z = sv.z; me.angle = sv.a; me.vy = sv.vy; me.speed = sv.s; me.pit = sv.pit;
    me.onGround = !!sv.g; me.gy = null; me.wi = -1;
  } else {
    if (d > 0.4) { me.x += dx * 0.2; me.z += dz * 0.2; }
    if (W.tr.mode === 'plane' || !(sv.g && me.onGround)) { if (Math.abs(dy) > 0.5) me.y += dy * 0.15; }
    const da = wrapA(sv.a - me.angle);
    if (Math.abs(da) > 0.06) me.angle += da * 0.12;
    me.speed = me.speed * 0.7 + sv.s * 0.3;
  }
  me.boostT = Math.max(sv.bT, boostAbilityCooldown > BOOST_ABILITY_CD ? boostAbilityCooldown - BOOST_ABILITY_CD : 0);
  me.oilT = sv.oT; me.slowT = sv.sT; me.spinT = sv.spT; me.reverseT = sv.rT; me.slip = !!sv.sl;
  me.hasMissile = !!sv.mi; me.hasEMP = !!sv.em;
}

function updateRemote(c, dt) {
  const sv = c.sv;
  if (!sv) return;
  sv.x += Math.sin(sv.a) * sv.s * dt; sv.z += Math.cos(sv.a) * sv.s * dt;
  if (!sv.g && W.tr.mode !== 'plane') { sv.vy -= CT.GRAV * (env.lowG ? 0.28 : 1) * dt; sv.y += sv.vy * dt; }
  const k = 1 - Math.exp(-11 * dt);
  c.x += (sv.x - c.x) * k; c.z += (sv.z - c.z) * k; c.y += (sv.y - c.y) * k;
  c.angle += wrapA(sv.a - c.angle) * k;
  c.speed = sv.s; c.vy = sv.vy; c.pit += (sv.pit - c.pit) * k;
  c.st += (sv.st - c.st) * k;
}

function updateCamera(dt) {
  const id = gamePhase === 'race' ? myCarId : specTarget, c = cars[id];
  if (!c) return;
  const tr = W.tr, plane = tr.mode === 'plane', cave = tr.style === 'cave';
  const spinning = c.mine && me && me.spinT > 0;
  if (!camInit) { camYaw = c.angle; }
  else if (!spinning) camYaw += wrapA(c.angle - camYaw) * (1 - Math.exp(-6.5 * dt));
  const yaw = camYaw + gpCamYaw;
  const dist = (plane ? 17 : 10.5) + Math.min(4, Math.abs(c.speed) * 0.05), height = (plane ? 5 : cave ? 3.1 : 4.2) + gpCamPitch;
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  const slope = clampN(c.vsl, -0.45, 0.45);
  _F.set(c.x - fx * dist, c.y + height - slope * dist * 0.75, c.z - fz * dist);
  if (tr.mode === 'car') {
    const o = CT.sample(tr, _F.x, c.y, _F.z, c.wi, _so);
    if (Math.abs(o.lat) < tr.w / 2 + 3 && c.y - c.gyv < 12) _F.y = Math.max(_F.y, o.cy + o.lat * o.bk + 1.6);
    if (cave) _F.y = Math.min(_F.y, o.cy + W.caveR * 0.7);
  } else if (tr.mode === 'boat') _F.y = Math.max(_F.y, 2.2);
  _L.set(c.x + fx * 9, c.y + 1.4 + slope * 7, c.z + fz * 9);
  if (!camInit) { camPos.copy(_F); camLook.copy(_L); camInit = true; }
  else { camPos.x = _F.x; camPos.z = _F.z; camPos.y += (_F.y - camPos.y) * (1 - Math.exp(-9 * dt)); camLook.x = _L.x; camLook.z = _L.z; camLook.y += (_L.y - camLook.y) * (1 - Math.exp(-14 * dt)); }
  raceCam.position.copy(camPos);
  if (shakeT > 0) {
    shakeT -= dt;
    const a = shakeT * 1.6;
    raceCam.position.x += (Math.random() - 0.5) * a; raceCam.position.y += (Math.random() - 0.5) * a; raceCam.position.z += (Math.random() - 0.5) * a;
  }
  raceCam.lookAt(camLook);
  const top = c.mine && me ? me.vs.top : 50;
  const fov = 66 + Math.min(1.6, Math.abs(c.speed) / top) * 13 + (c.boostT > 0 ? 6 : 0);
  if (Math.abs(raceCam.fov - fov) > 0.05) { raceCam.fov += (fov - raceCam.fov) * Math.min(1, dt * 4); raceCam.updateProjectionMatrix(); }
  // Headlight
  W.head.position.set(c.x, c.y + 2.2, c.z);
  W.head.target.position.set(c.x + Math.sin(c.angle) * 30, c.y + c.vsl * 30, c.z + Math.cos(c.angle) * 30);
}

function updateRace(dt, ts) {
  if (PS.pts.parent !== raceScene) attachParticles(raceScene);
  if (!W.tr) return;
  raceT += dt; W.t = raceT;
  pollGamepad();
  const inp = currentInput();
  sendInput(inp);
  stepMe(inp, dt);

  for (const c of Object.values(cars)) {
    if (c.dead) continue;
    if (!(c.mine && gamePhase === 'race')) updateRemote(c, dt);
    poseCar(c, dt);
    if (glitchT > 0) { c.mesh.position.x += (Math.random() - 0.5) * 0.5 * glitchT; c.mesh.position.z += (Math.random() - 0.5) * 0.5 * glitchT; c.mesh.rotateY((Math.random() - 0.5) * 0.08 * glitchT); }
    if (env.ghost) c.mesh.visible = Math.floor(ts / 60) % 2 === 0 || c.mine; else c.mesh.visible = true;
    carFx(c, dt);
  }
  if (glitchT > 0) glitchT -= dt;

  updateCamera(dt);
  updateWorld(dt, performance.now(), env);

  const df = $('dmg-flash'), bg = $('boost-glow');
  if (dmgFlashT > 0) { dmgFlashT -= dt; df.style.opacity = Math.min(1, dmgFlashT * 4); } else df.style.opacity = 0;
  const boosting = gamePhase === 'race' && me && me.boostT > 0;
  if (boostGlowT > 0 || boosting) { boostGlowT -= dt; bg.style.opacity = boosting ? 0.8 : Math.min(1, boostGlowT * 2); } else bg.style.opacity = 0;

  drawMinimap();
  updateHUD();
  renderer.render(raceScene, raceCam);
}

let _last = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  const dt = Math.min((ts - _last) / 1000, 0.1);
  _last = ts;
  if (dt <= 0) return;
  if (gamePhase === 'race' || gamePhase === 'spectate' || gamePhase === 'over') updateRace(dt, ts);
  else updateGarage(dt, ts);
}

// ═══════════════════════════════════════════════════════════════════════
// MINIMAP + HUD
// ═══════════════════════════════════════════════════════════════════════
let mmB = null;
function minimapBounds() {
  const tr = W.tr; let mnx = 1e9, mxx = -1e9, mnz = 1e9, mxz = -1e9;
  for (let i = 0; i < tr.N; i++) { mnx = Math.min(mnx, tr.px[i]); mxx = Math.max(mxx, tr.px[i]); mnz = Math.min(mnz, tr.pz[i]); mxz = Math.max(mxz, tr.pz[i]); }
  const sz = 150, pad = 10, s = (sz - pad * 2) / Math.max(mxx - mnx, mxz - mnz, 1);
  mmB = {ox: sz / 2 + (mnx + mxx) / 2 * s, oz: sz / 2 - (mnz + mxz) / 2 * s, s};
}
function drawMinimap() {
  const tr = W.tr, g = $('minimap-canvas').getContext('2d');
  if (!mmB) minimapBounds();
  const X = x => mmB.ox - x * mmB.s, Z = z => mmB.oz + z * mmB.s;
  g.clearRect(0, 0, 150, 150);
  g.fillStyle = 'rgba(0,8,20,0.82)'; g.fillRect(0, 0, 150, 150);
  g.lineCap = g.lineJoin = 'round';
  const path = () => { g.beginPath(); g.moveTo(X(tr.px[0]), Z(tr.pz[0])); for (let i = 2; i < tr.N; i += 2) g.lineTo(X(tr.px[i]), Z(tr.pz[i])); g.closePath(); g.stroke(); };
  g.strokeStyle = '#003366'; g.lineWidth = Math.max(3, tr.w * mmB.s); path();
  g.strokeStyle = env.noWalls ? '#aa6600' : '#0077cc'; g.lineWidth = 1.2; path();
  g.fillStyle = '#ffffff'; g.fillRect(X(tr.px[0]) - 2, Z(tr.pz[0]) - 2, 4, 4);
  if (W.finishF !== null) { const p = CT.placeAt(tr, W.finishF, 0, _so); g.fillStyle = '#ff00ff'; g.fillRect(X(p.x) - 4, Z(p.z) - 4, 8, 8); }
  for (const c of Object.values(cars)) {
    if (c.dead || c.mine) continue;
    g.beginPath(); g.arc(X(c.x), Z(c.z), 2.5, 0, 6.3); g.fillStyle = hexCss(c.mesh.userData.paint); g.fill();
  }
  const m = cars[gamePhase === 'race' ? myCarId : specTarget];
  if (m && !m.dead) { g.beginPath(); g.arc(X(m.x), Z(m.z), 4.2, 0, 6.3); g.fillStyle = '#00ffcc'; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1; g.stroke(); }
}

let hudBoostWas = false;
function updateHUD() {
  const c = cars[gamePhase === 'race' ? myCarId : specTarget];
  if (!c) return;
  const hp = Math.max(0, c.hp), pct = hp / c.maxHp * 100, fill = $('hp-fill');
  fill.style.width = pct + '%'; fill.style.background = pct > 60 ? '#00ffcc' : pct > 30 ? '#ffaa00' : '#ff0044';
  $('hp-num').textContent = Math.ceil(hp);
  $('hud-speed').innerHTML = Math.abs(Math.round(c.speed * 2.5)) + ' <span>km/h</span>';
  const al = $('hud-alive'); al.textContent = aliveN + ' ALIVE'; al.style.color = aliveN <= 3 ? '#ff0044' : aliveN <= 5 ? '#ffaa00' : '#ff6600';
  $('hud-position').textContent = `P ${c.pos || myPos} / ${aliveN}`;
  if (gamePhase !== 'race' || !me) return;
  const ef = $('hud-effect'), idle = ef.textContent === '' || ef.dataset.auto === '1';
  if (!idle) { ef.dataset.auto = ''; return; }
  const ready = boostAbilityCooldown <= 0;
  if (me.hasMissile) { ef.textContent = '🚀 MISSILE READY — SPACE'; ef.style.color = '#ff5533'; ef.dataset.auto = '1'; }
  else if (me.hasEMP) { ef.textContent = '📡 EMP READY — SPACE'; ef.style.color = '#66aaff'; ef.dataset.auto = '1'; }
  else if (me.boostT > 0) { ef.textContent = '⚡ BOOST'; ef.style.color = '#00ffcc'; ef.dataset.auto = '1'; }
  else if (!ready) { ef.textContent = `BOOST ${Math.ceil(boostAbilityCooldown / 1000)}s`; ef.style.color = '#ff8800'; ef.dataset.auto = '1'; }
  else if (!hudBoostWas) { ef.dataset.auto = ''; flash('[ SPACE ] BOOST READY', '#448877', 1800); }
  else if (ef.dataset.auto === '1') { ef.textContent = ''; ef.dataset.auto = ''; }
  hudBoostWas = ready;
}

// ═══════════════════════════════════════════════════════════════════════
// MATRIX RAIN OVERLAY
// ═══════════════════════════════════════════════════════════════════════
let matrixCanvas, matrixCtx, matrixDrops = [], matrixTimer = null;
function initMatrixCanvas() { matrixCanvas = $('matrix-canvas'); matrixCtx = matrixCanvas.getContext('2d'); resizeMatrix(); }
function resizeMatrix() {
  if (!matrixCanvas) return;
  matrixCanvas.width = window.innerWidth / 2; matrixCanvas.height = window.innerHeight / 2;
  matrixDrops = new Array(Math.ceil(matrixCanvas.width / 10)).fill(0).map(() => Math.random() * -30);
}
function showMatrixRain(ms) {
  matrixCanvas.classList.remove('hidden');
  matrixCtx.clearRect(0, 0, matrixCanvas.width, matrixCanvas.height);
  const end = performance.now() + ms;
  clearInterval(matrixTimer);
  matrixTimer = setInterval(() => {
    const g = matrixCtx, w = matrixCanvas.width, h = matrixCanvas.height;
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#00ffcc'; g.font = '10px monospace';
    for (let i = 0; i < matrixDrops.length; i++) {
      g.fillText(String.fromCharCode(0x30a0 + Math.random() * 96), i * 10, matrixDrops[i] * 10);
      matrixDrops[i] = matrixDrops[i] * 10 > h && Math.random() > 0.9 ? 0 : matrixDrops[i] + 1.4;
    }
    if (performance.now() > end) { clearInterval(matrixTimer); matrixCanvas.classList.add('hidden'); }
  }, 33);
}

// ═══════════════════════════════════════════════════════════════════════
// VOTE UI
// ═══════════════════════════════════════════════════════════════════════
let voteIntervalId = null, myVote = null;
function showVote(opts, dur, isFinal) {
  myVote = null;
  const panel = $('vote-panel'), grid = $('vote-grid');
  $('vote-title').textContent = isFinal ? '▶ ONE SURVIVOR — VOTE TO PLACE THE FINISH LINE' : 'VOTE FOR TRACK CHANGE';
  panel.style.borderColor = isFinal ? '#ff00ff' : '#00ffcc44';
  $('vote-counts').textContent = '';
  grid.innerHTML = '';
  opts.forEach((opt, idx) => {
    const btn = el('button', 'vote-btn', `<div class="vb-label">${opt.label}</div><div class="vb-desc">${opt.desc}</div><div class="vb-bar-wrap"><div class="vb-bar" style="width:0%"></div></div>`);
    btn.dataset.id = opt.id + '_' + idx; btn.dataset.realId = opt.id;
    btn.onclick = () => castVote(opt.id, btn.dataset.id);
    grid.appendChild(btn);
  });
  panel.classList.remove('hidden');
  let t = Math.ceil(dur / 1000);
  $('vote-timer').textContent = t;
  clearInterval(voteIntervalId);
  voteIntervalId = setInterval(() => { t--; $('vote-timer').textContent = Math.max(0, t); if (t <= -3) hideVote(); }, 1000);
}
function castVote(realId, slotId) {
  if (myVote || gamePhase !== 'race') return;
  myVote = slotId;
  if (socket) socket.emit('vote', {optId: realId});
  document.querySelectorAll('.vote-btn').forEach(b => b.classList.toggle('voted', b.dataset.id === slotId));
}
function voteBars(counts, total) {
  document.querySelectorAll('.vote-btn').forEach(btn => {
    const c = counts[btn.dataset.realId] || 0;
    btn.querySelector('.vb-bar').style.width = (total ? Math.round(c / total * 100) : 0) + '%';
  });
}
function updateVoteCounts(counts, total) { voteBars(counts, total); $('vote-counts').textContent = `${total} vote${total !== 1 ? 's' : ''}`; }
function showVoteResult(winner, counts) {
  voteBars(counts, Object.values(counts).reduce((a, b) => a + b, 0));
  let marked = false;
  document.querySelectorAll('.vote-btn').forEach(btn => { if (btn.dataset.realId === winner && !marked) { btn.classList.add('winner'); marked = true; } });
  clearInterval(voteIntervalId);
  voteIntervalId = setTimeout(hideVote, 2200);
}
function hideVote() { $('vote-panel').classList.add('hidden'); clearInterval(voteIntervalId); clearTimeout(voteIntervalId); }

// ═══════════════════════════════════════════════════════════════════════
// LOBBY + SCREENS
// ═══════════════════════════════════════════════════════════════════════
let lobbyTimerTimeout = null;
function startLobbyTimer(remMs) {
  const totalMs = 120000, circ = 326.7, t0 = performance.now() - (totalMs - remMs);
  clearTimeout(lobbyTimerTimeout);
  (function tick() {
    const remain = Math.max(0, totalMs - (performance.now() - t0)), secs = Math.ceil(remain / 1000);
    $('lobby-secs').textContent = Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0');
    $('ring-fill').style.strokeDashoffset = circ * (1 - remain / totalMs);
    if (remain > 0 && gamePhase === 'lobby') lobbyTimerTimeout = setTimeout(tick, 200);
  })();
}

function updateLobbyPlayers(names, count, max) {
  $('lobby-count').textContent = `${count} / ${max} players`;
  for (const id of ['lobby-list', 'fp-players-list']) {
    const list = $(id); list.innerHTML = '';
    names.forEach(n => list.appendChild(el('div', 'lobby-player', '▶ ' + n)));
  }
}

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const map = {home: 'scr-home', garage: 'scr-garage', lobby: 'scr-lobby', over: 'scr-gameover'};
  if (map[name]) $(map[name]).classList.add('active');
  $('hud').classList.toggle('hidden', name !== 'race' && name !== 'over');
  if (name !== 'race') hideVote();
}

// ═══════════════════════════════════════════════════════════════════════
// SOCKET
// ═══════════════════════════════════════════════════════════════════════
function carAt(id) { const c = cars[id]; return c && !c.dead ? c : null; }

function applyTrack(st, first) {
  const oldMode = W.tr ? W.tr.mode : null;
  setTrack(st);
  mmB = null;
  if (first || oldMode !== W.tr.mode) for (const c of Object.values(cars)) { buildCarMesh(c); c.vsl = c.vrl = 0; }
  for (const c of Object.values(cars)) c.wi = -1;
  if (me) { me.wi = -1; me.gy = null; }
  const hint = $('controls-hint');
  hint.textContent = W.tr.mode === 'plane' ? 'W/S or ↑↓ CLIMB / DIVE  ·  A/D or ←→ TURN  ·  SPACE BOOST' : 'W/S or ↑↓ DRIVE  ·  A/D or ←→ STEER  ·  SPACE BOOST';
}

function setupSocket(s) {
  s.on('lobby_tick', ({remain}) => { if (gamePhase === 'lobby') startLobbyTimer(remain); });
  s.on('lobby_update', ({count, max, players}) => updateLobbyPlayers(players, count, max));

  s.on('private_created', ({code, carId, trackName}) => {
    myCarId = carId;
    $('fp-code').textContent = code;
    $('lobby-title').textContent = 'PRIVATE LOBBY — CODE: ' + code;
  });

  s.on('join_error', ({msg}) => { alert(msg); _fp_showPanel('fp-main'); dropSocket(); });

  s.on('joined', ({carId, trackName, remain}) => {
    myCarId = carId;
    if (gamePhase !== 'lobby') { closeFriendsPopup(); showScreen('lobby'); gamePhase = 'lobby'; }
    const pinger = setInterval(() => { if (gamePhase === 'lobby' && socket === s) s.emit('lobby_timer'); else clearInterval(pinger); }, 800);
    startLobbyTimer(remain !== undefined ? remain : 120000);
    if (trackName) $('lobby-title').textContent = 'TRACK: ' + trackName;
  });

  s.on('race_start', ({cars: list, st, trackName}) => {
    const mine = myCarId;
    clearRace();
    myCarId = mine;
    closeFriendsPopup();
    gamePhase = 'race';
    raceT = 0; env.noWalls = env.lowG = env.dbl = env.ghost = false;
    W.st = null;
    applyTrack(st, false);
    for (const c of list) {
      const rec = addCar(c);
      if (c.id === myCarId) {
        me = CT.newCar(c.vh);
        Object.assign(me, {x: c.x, y: c.y, z: c.z, angle: c.angle, onGround: W.tr.mode !== 'plane', hasMissile: false, hasEMP: false});
        rec.maxHp = c.maxHp;
      }
    }
    aliveN = list.length; myPos = 1; specTarget = null; camInit = false; boostAbilityCooldown = 0; hudBoostWas = true;
    showScreen('race');
    if (trackName) flash('▶ ' + trackName, '#00ffcc', 3000);
  });

  s.on('tick', ({t, alive, nw, lg, ds, gh, cars: list}) => {
    if (gamePhase !== 'race' && gamePhase !== 'spectate' && gamePhase !== 'over') return;
    aliveN = alive;
    env.noWalls = nw; env.lowG = lg; env.dbl = ds; env.ghost = gh;
    if (Math.abs(t - raceT) > 0.4) raceT = t; else raceT += (t - raceT) * 0.1;
    for (const sv of list) {
      const c = cars[sv.id];
      if (!c || c.dead) continue;
      if (c.mine && sv.hp < c.hp - 0.5) { dmgFlashT = Math.max(dmgFlashT, 0.25); shakeT = Math.max(shakeT, 0.15); }
      c.hp = sv.hp; c.pos = sv.p; c.shield = !!sv.sh; c.ghost = !!sv.gT; c.jug = !!sv.jT;
      if (c.mine) myPos = sv.p;
      if (c.mine && gamePhase === 'race') reconcile(sv);
      else { c.sv = sv; c.boostT = sv.bT; c.driftT = sv.dT; c.driftSide = sv.dS; c.onGround = !!sv.g; }
    }
  });

  s.on('eliminated', ({id}) => {
    const c = cars[id];
    if (c && !c.dead) {
      c.dead = true;
      explode(c.x, c.y, c.z, c.mesh.userData.paint, 70, 22);
      explode(c.x, c.y, c.z, 0xff3300, 45, 15);
      explode(c.x, c.y, c.z, 0xffaa00, 30, 10);
      c.mesh.visible = false; c.shadow.visible = false; c.bubble.visible = false;
      if (raceCam.position.distanceTo(c.mesh.position) < 60) shakeT = Math.max(shakeT, 0.3);
    }
    if (id === myCarId && gamePhase === 'race') {
      dmgFlashT = 0.8;
      gamePhase = 'spectate';
      $('spectate-banner').classList.remove('hidden');
      hideVote();
      cycleSpecTarget(1);
    } else if (id === specTarget) cycleSpecTarget(1);
  });

  s.on('powerups_init', ({powerups}) => { W.powerups = powerups; rebuildEntities(); });
  s.on('powerup_taken', ({id, carId, type}) => {
    const pu = W.powerups.find(p => p.id === id);
    if (pu) { pu.active = false; if (pu.mesh) { pu.mesh.visible = false; explode(pu.mesh.position.x, pu.mesh.position.y - 0.5, pu.mesh.position.z, PU_COLORS[type] || 0xffffff, 16, 7); } }
    if (carId === myCarId) {
      const labels = {boost: '⚡ BOOST!', repair: '❤ REPAIRED', slow: '⚠ SLOWED', spin: '↺ SPINNING', reverse: '⇄ REVERSED', spike_p: '💥 SPIKED', oil_p: '⚠ OIL', shield: '🛡 SHIELD', emp: '📡 EMP READY', missile: '🚀 MISSILE READY', ghost: '👻 PHASE SHIFT', spring: '⤴ SPRING JUMP', juggernaut: '🛡 JUGGERNAUT', warp: '🌀 WARP DASH', swap: '🔀 POSITION SWAP', cryo: '❄ CRYO BLAST', lightning: '⚡ THUNDER STRIKE', leech: '🧛 LIFE LEECH', scrambler: '📻 SCRAMBLER'};
      flash(labels[type] || type, type === 'boost' ? '#00ffcc' : type === 'repair' ? '#44ff44' : '#ff8800', 2000);
      if (type === 'boost') boostGlowT = 0.8;
      if (type === 'spike_p') dmgFlashT = 0.4;
    }
  });
  s.on('powerup_respawn', ({id}) => { const pu = W.powerups.find(p => p.id === id); if (pu) { pu.active = true; if (pu.mesh) pu.mesh.visible = true; } });

  s.on('vote_start', ({opts, dur, final: isFinal}) => { if (gamePhase === 'race') showVote(opts, dur, isFinal); });
  s.on('vote_update', ({counts, total}) => updateVoteCounts(counts, total));
  s.on('vote_result', ({winner, counts}) => showVoteResult(winner, counts));

  s.on('track', ({st, finishF}) => {
    if (!W.tr) return;
    const swapped = st.type !== W.st.type;
    W.finishF = finishF;
    applyTrack(st, false);
    camInit = swapped ? false : camInit;
    showMatrixRain(600);
    if (W.roadMat) { const base = W.roadMat.emissiveIntensity; let k = 1; FX.push(dt => { k -= dt * 1.6; if (!W.roadMat) return true; W.roadMat.emissiveIntensity = base + Math.max(0, k) * 3; return k <= 0; }); }
    if (swapped) flash('▶ ' + CT.TRACKS[st.type].name, '#00ffcc', 3000);
  });
  s.on('zone', z => { W.zones.push(z); W.tr.nramps = CT.zoneRamps(W.tr, W.zones); buildZone(z); });
  s.on('obstacles', ({obs}) => { for (const o of obs) { W.obstacles.push(o); buildObstacle(o); } });
  s.on('finish_placed', ({f}) => { W.finishF = f; rebuildEntities(); flash('🏁 FINISH LINE PLACED', '#ff00ff', 3000); });

  s.on('gravity', ({reverse} = {}) => {
    if (me && gamePhase === 'race') { me.vy = reverse ? 11 : 20; me.y += 0.6; me.onGround = false; me.gy = null; }
    flash(reverse ? '🪐 REVERSE GRAVITY' : '⬆ GRAVITY SPIKE', '#88ffaa', 2500);
    showMatrixRain(800);
  });

  s.on('storm', ({type, mega, hit} = {}) => {
    if (type === 'slow' || type === 'freeze') flash('🧊 SLOW FIELD', '#88ccff');
    else if (type === 'boost') { boostGlowT = 1.2; flash('⚡ SPEED SURGE', '#00ffcc', 2000); }
    else if (type === 'reverse') { flash('⇄ CONTROLS REVERSED', '#ff0066', 5000); dmgFlashT = 0.4; }
    else if (type === 'doublespeed') { boostGlowT = 2.5; flash('⚡⚡ DOUBLE SPEED', '#ffff00', 4000); }
    else if (type === 'spin') flash('💫 SPIN OUT', '#ff88ff', 2000);
    else if (type === 'nowalls') flash('🚫 NO WALLS — 5s', '#ffcc00', 3500);
    else if (type === 'ghost') flash('👻 GHOST MODE — 5s', '#88ffff', 3500);
    else if (type === 'wave') { boostGlowT = 0.8; flash('🌊 WAVE BOOST', '#00ffcc', 2000); }
    else if (type === 'repair') flash('❤ REPAIR ALL', '#44ff44', 2000);
    else if (type === 'damage') { flash('💥 DAMAGE ALL', '#ff3344', 2000); dmgFlashT = 0.5; for (const c of Object.values(cars)) if (!c.dead) explode(c.x, c.y, c.z, 0xff3322, 10, 6); }
    else if (type === 'turbonpc') flash('🤖 TURBO NPCS', '#ffaa00', 2000);
    else if (type === 'slownpc') flash('🤖 SLOW NPCS', '#88ccff', 2000);
    else if (type === 'lightning') {
      flash('⚡ LIGHTNING FIELD', '#ffff66', 2500);
      (hit || []).forEach((id, i) => setTimeout(() => { const c = carAt(id); if (c) { lightningBolt(c.x, c.y, c.z); if (c.mine) { dmgFlashT = 0.4; shakeT = 0.3; } } }, i * 90));
    }
    else { glitchT = mega ? 4 : 2; dmgFlashT = 0.5; shakeT = 0.4; flash(mega ? '⚠ MEGA STORM' : '⚠ GLITCH STORM', '#ff00ff', 2500); showMatrixRain(mega ? 1200 : 800); }
  });

  s.on('moving_barriers', ({barriers}) => {
    for (const b of barriers) { b.startTime = performance.now() - (b.age || 0); W.barriers.push(b); buildBarrier(b); }
    flash('⚠ MOVING BARRIERS', '#ff4400');
  });
  s.on('laser_gates', ({gates}) => {
    for (const g of gates) { g.startTime = performance.now() - (g.age || 0); W.lasers.push(g); buildLaser(g); }
    flash('⚡ LASER GATES', '#ff0044');
  });
  s.on('fog_event', ({dur}) => { W.fogT = dur; flash('🌫 HEAVY FOG', '#aaddff', 3000); });
  s.on('low_grav', () => flash('🪐 LOW GRAVITY', '#88ffaa', 3000));

  s.on('missile_fired', ({fromId, targetId, eta}) => {
    const from = carAt(fromId);
    if (!from) return;
    explode(from.x, from.y + 0.5, from.z, 0xff3300, 10, 5);
    launchMissile(from.mesh, () => { const t = carAt(targetId); return t ? t.mesh : null; }, eta);
    if (targetId === myCarId) flash('⚠ MISSILE INCOMING', '#ff3300', 1500);
  });
  s.on('emp_fired', ({id}) => { const c = carAt(id); if (c) { explode(c.x, c.y, c.z, 0x4488ff, 40, 15); shockRing(c.x, c.y + 1, c.z, 0x4488ff, 26, true); } });
  s.on('near_miss', ({id}) => { if (id === myCarId) { flash('✨ NEAR MISS +BOOST', '#ffff00', 1500); boostGlowT = 0.5; } });
  s.on('bump', ({x, y, z}) => { if (raceCam.position.distanceToSquared(_F.set(x, y, z)) < 120 * 120) for (let k = 0; k < 8; k++) spark(x, y, z, (Math.random() - 0.5) * 12, Math.random() * 7, (Math.random() - 0.5) * 12, 1, 0.8, 0.4, 0.9, 0.35, 20); });
  s.on('car_hit', ({id, type}) => {
    const c = carAt(id);
    if (!c) return;
    if (type === 'missile') explode(c.x, c.y, c.z, 0xff5500, 55, 18);
    if (type === 'emp') explode(c.x, c.y, c.z, 0x44ccff, 30, 10);
    if (type === 'spring') { explode(c.x, c.y, c.z, 0xffee44, 26, 12); shockRing(c.x, c.y + 0.3, c.z, 0xffee44, 7, true); if (id === myCarId && me) { me.vy = 24; me.onGround = false; me.gy = null; } }
    if (type === 'cryo') { explode(c.x, c.y + 0.5, c.z, 0x88ddff, 50, 14); shockRing(c.x, c.y + 0.5, c.z, 0x88ddff, 10, true); }
    if (type === 'lightning') { lightningBolt(c.x, c.y, c.z); explode(c.x, c.y, c.z, 0xffff88, 50, 16); }
    if (type === 'leech') explode(c.x, c.y + 0.6, c.z, 0xcc1133, 22, 8);
    if (type === 'leech_gain') { explode(c.x, c.y + 0.6, c.z, 0x44ff66, 26, 8); shockRing(c.x, c.y + 0.5, c.z, 0x44ff66, 8, true); }
    if (type === 'scramble') explode(c.x, c.y + 0.8, c.z, 0xff44aa, 30, 10);
    if (type === 'swap') explode(c.x, c.y + 0.6, c.z, 0xffaa00, 28, 10);
    if (type === 'shield_block') { explode(c.x, c.y, c.z, 0x0088ff, 30, 10); shockRing(c.x, c.y + 1, c.z, 0x0088ff, 6, true); }
    if (id === myCarId && type !== 'spring' && type !== 'leech_gain') { dmgFlashT = 0.5; shakeT = 0.4; }
  });
  s.on('warp', ({id, x, y, z, a}) => {
    const c = carAt(id);
    if (!c) return;
    explode(c.x, c.y + 0.5, c.z, 0xaa66ff, 28, 12);
    c.x = x; c.y = y; c.z = z; c.angle = a;
    if (c.sv) { c.sv.x = x; c.sv.y = y; c.sv.z = z; c.sv.a = a; }
    if (id === myCarId && me) { Object.assign(me, {x, y, z, angle: a, vy: 0, gy: null, wi: -1, onGround: W.tr.mode !== 'plane'}); camInit = false; }
    explode(x, y + 0.5, z, 0xaa66ff, 28, 12);
    shockRing(x, y + 1, z, 0xaa66ff, 9, true);
  });
  s.on('player_left', () => {});

  s.on('race_over', ({winner}) => {
    hideVote();
    const title = $('go-title'), sub = $('go-sub');
    if (!winner) { title.textContent = 'NO SURVIVORS'; sub.textContent = 'Everyone eliminated.'; }
    else if (winner.id === myCarId) {
      title.textContent = 'YOU WIN'; sub.textContent = 'You are the last car standing.';
      wins++; localStorage.setItem('ct_wins', '' + wins);
      specTarget = myCarId;
    } else {
      title.textContent = 'RACE OVER';
      sub.textContent = `${winner.isNPC ? (winner.name || 'NPC') : 'ANOTHER PLAYER'} wins.`;
      if (cars[winner.id]) specTarget = winner.id;
    }
    gamePhase = 'over';
    $('spectate-banner').classList.add('hidden');
    setTimeout(() => { if (gamePhase === 'over') showScreen('over'); }, 1200);
  });
}
