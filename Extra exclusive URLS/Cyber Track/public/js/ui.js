'use strict';
// ═══════════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════════
const settings = {voice: false, mic: false, vcmd: false};
try { Object.assign(settings, JSON.parse(localStorage.getItem('ct_settings') || '{}')); } catch (e) {}
function saveSettings() { try { localStorage.setItem('ct_settings', JSON.stringify(settings)); } catch (e) {} }

let inputDev = 'kb';
function padConnected() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of pads) if (p && p.connected) return true;
  return false;
}
function setDevice(d) {
  if (inputDev === d || SPLIT) return;
  inputDev = d;
  document.body.classList.toggle('dev-pad', d === 'pad');
  if (d !== 'pad') clearPadFocus();
  updateHints();
}

const ITEMS = [
  {k: 'boost',   ico: '⚡', name: 'BOOST',   col: '#00ffcc', kb: 'SPACE', pad: 'A'},
  {k: 'shield',  ico: '🛡', name: 'SHIELD',  col: '#3399ff', kb: 'ENTER', pad: 'B'},
  {k: 'missile', ico: '🚀', name: 'MISSILE', col: '#ff5533', kb: 'SHIFT', pad: 'X'},
  {k: 'spring',  ico: '🦘', name: 'SPRING',  col: '#ffe14a', kb: 'BKSP',  pad: 'Y'},
];

function updateHints() {
  const pad = inputDev === 'pad', plane = W.tr && W.tr.mode === 'plane';
  const hint = $('controls-hint');
  if (hint) hint.textContent = pad
    ? `L STICK ${plane ? 'TURN' : 'STEER'}  ·  ZL ${plane ? 'CLIMB' : 'DRIVE'}  ·  ZR ${plane ? 'DIVE' : 'REVERSE'}  ·  A BOOST  ·  B SHIELD  ·  X MISSILE  ·  Y SPRING  ·  − CAMERA  ·  + PAUSE`
    : `${plane ? 'W/S CLIMB / DIVE  ·  A/D TURN' : 'W/S or ↑↓ DRIVE  ·  A/D or ←→ STEER'}  ·  SPACE BOOST  ·  ENTER SHIELD  ·  SHIFT MISSILE  ·  BACKSPACE SPRING  ·  P CAMERA  ·  ESC PAUSE`;
  const creds = $('home-creds');
  if (creds) creds.textContent = pad ? '[ CONTROLLER · A SELECT · B BACK · L / R SWAP · R STICK SCROLL ]' : '[ KEYBOARD · WASD or ARROWS · 30s VOTE INTERVALS · LAST CAR WINS ]';
  const sb = $('spectate-banner');
  if (sb) sb.textContent = 'SPECTATING — YOU WERE ELIMINATED  ·  ' + (pad ? 'L NEXT PLACE DOWN  ·  R NEXT PLACE UP' : '[ NEXT PLACE DOWN  ·  ] NEXT PLACE UP');
  const ph = $('pause-hint');
  if (ph) ph.textContent = pad ? '+ RESUME  ·  A SELECT  ·  B BACK' : 'ESC RESUME';
  const sc = $('settings-controls');
  if (sc) sc.innerHTML = pad
    ? 'CONTROLLER<br>L STICK STEER · ZL DRIVE · ZR REVERSE<br>A BOOST · B SHIELD · X MISSILE · Y SPRING JUMP<br>R STICK PICK VOTE · R STICK CLICK CAST VOTE<br>− CAMERA · + PAUSE<br>MENUS: A SELECT · B BACK · L / R SWAP · ZL / ZR SWAP GARAGE · R STICK SCROLL'
    : 'KEYBOARD<br>WASD / ARROWS DRIVE AND STEER<br>SPACE BOOST · ENTER SHIELD · SHIFT MISSILE · BACKSPACE SPRING JUMP<br>1 2 3 VOTE · P CAMERA · V MIC · M SOUND · ESC PAUSE';
  _invKey = '';
}

// ═══════════════════════════════════════════════════════════════════════
// PLAYER NAME
// ═══════════════════════════════════════════════════════════════════════
function cleanName(v) { return String(v || '').replace(/[<>&"']/g, '').trim().slice(0, 16).toUpperCase(); }
function nameError(msg) {
  const inp = $('name-input');
  $('name-error').textContent = msg || '';
  inp.classList.toggle('bad', !!msg);
}
window.startGame = function () {
  const inp = $('name-input'), n = cleanName(inp.value);
  if (!n) { nameError('ENTER A PLAYER NAME TO START'); if (inputDev !== 'pad') inp.focus(); Snd.sfx('alarm'); return; }
  try { localStorage.setItem('ct_name', n); } catch (e) {}
  inp.value = n; nameError('');
  goToGarage();
};

// ═══════════════════════════════════════════════════════════════════════
// SETTINGS POPUP + PAUSE
// ═══════════════════════════════════════════════════════════════════════
function buildSettings() {
  const list = $('settings-list');
  list.innerHTML = '';
  const row = (name, desc, on, fn, text) => {
    const b = el('button', 'set-row', `<span><div class="set-name">${name}</div><div class="set-desc">${desc}</div></span><span class="set-val${on ? ' on' : ''}">${text || (on ? 'ON' : 'OFF')}</span>`);
    b.onclick = () => { fn(); buildSettings(); };
    list.appendChild(b);
  };
  row('VOICE CHAT', 'Hear nearby players in online races  ·  louder when closer', settings.voice, () => { settings.voice = !settings.voice; if (!settings.voice) settings.mic = false; saveSettings(); voiceRestart(); });
  row('MICROPHONE', 'Let other players hear you  ·  V in race', settings.mic, () => { settings.mic = !settings.mic; if (settings.mic) settings.voice = true; saveSettings(); voiceRestart(); });
  row('VOICE COMMANDS', 'Say BOOST, MISSILE, SHIELD or JUMP', settings.vcmd, () => { settings.vcmd = !settings.vcmd; saveSettings(); vcmdSync(); }, settings.vcmd ? (vcmd.state || 'ON') : 'OFF');
  row('SOUND', 'Music and sound effects', !Snd.muted, () => Snd.toggle());
  row('CAMERA', 'First person or third person', true, () => { fpvOn = !fpvOn; camInit = false; }, fpvOn ? 'FIRST PERSON' : 'THIRD PERSON');
  row('PLAYER NAME', 'Shown to other racers', true, () => { closeSettings(); if (gamePhase === 'home') $('name-input').focus(); else flash('CHANGE YOUR NAME ON THE HOME SCREEN', '#ffaa00', 2500); }, playerName() || 'NOT SET');
  updateHints();
}
window.openSettings = function () { buildSettings(); $('settings-popup').classList.remove('hidden'); };
window.closeSettings = function () { $('settings-popup').classList.add('hidden'); };

function setSimPaused(on) {
  if (simPaused === !!on) return;
  simPaused = !!on;
  if (on) setSimPaused.at = performance.now();
  else {
    const d = performance.now() - (setSimPaused.at || performance.now());
    for (const b of W.barriers || []) b.startTime += d;
    for (const g of W.lasers || []) g.startTime += d;
  }
}
window.togglePause = function () {
  if (gamePhase !== 'race' && gamePhase !== 'spectate') return;
  pauseOpen = !pauseOpen;
  closeSettings();
  $('pause-menu').classList.toggle('hidden', !pauseOpen);
  $('pause-title').textContent = isBotRace ? 'PAUSED' : 'MENU — RACE STILL RUNNING';
  inputDirty = true;
  if (isBotRace && socket) socket.emit('pause', {on: pauseOpen});
  updateHints();
};
window.exitRace = function () { goToGarage(); };


function escapeKey() {
  if (!$('settings-popup').classList.contains('hidden')) return closeSettings();
  if (gamePhase === 'race' || gamePhase === 'spectate') return togglePause();
  if (!$('track-select-overlay').classList.contains('hidden')) return closeTrackSelect();
  if (!$('friends-popup').classList.contains('hidden')) return closeFriendsPopup();
}

// ═══════════════════════════════════════════════════════════════════════
// ITEMS
// ═══════════════════════════════════════════════════════════════════════
function useItem(k) {
  if (gamePhase !== 'race' || !me || !socket || pauseOpen || simPaused) return;
  const idx = {boost: 0, shield: 1, missile: 2, spring: 3, emp: 4};
  if (k === 'missile' && !myInv[2] && myInv[4]) k = 'emp';
  const c = cars[myCarId];
  if (!(myInv[idx[k]] > 0)) { flash('NO ' + (k === 'spring' ? 'SPRING JUMP' : k.toUpperCase()), '#ff5577', 900); return; }
  if (k === 'shield' && c && c.shield) { flash('🛡 SHIELD ALREADY UP', '#3399ff', 900); return; }
  myInv[idx[k]]--;
  socket.emit('use_item', {t: k});
  if (k === 'boost') { boostAbilityCooldown = BOOST_ABILITY_CD + 700; me.boostT = Math.max(me.boostT, 700); boostGlowT = 1.2; Snd.sfx('boost'); flash('⚡ BOOST!', '#00ffcc', 1200); }
  else if (k === 'shield') flash('🛡 SHIELD UP', '#3399ff', 1500);
  else if (k === 'missile') { Snd.sfx('missile'); flash('🚀 MISSILE FIRED!', '#ff3300', 1500); }
  else if (k === 'emp') { Snd.sfx('emp'); flash('📡 EMP FIRED!', '#4488ff', 1500); }
  else if (k === 'spring') flash('🦘 SPRING JUMP!', '#ffe14a', 1200);
}
window.useItem = useItem;

let _invKey = '';
function updateInvHUD() {
  const box = $('hud-inv');
  if (gamePhase !== 'race' || !me) { if (_invKey !== 'x') { box.innerHTML = ''; _invKey = 'x'; } return; }
  const c = cars[myCarId], sh = c && c.shield ? 1 : 0, rc = myInv[0] ? 0 : (myInv[5] || 0);
  const key = myInv.slice(0, 5).join() + '|' + sh + '|' + rc + '|' + inputDev;
  if (key === _invKey) return;
  _invKey = key;
  let h = '';
  ITEMS.forEach((it, i) => {
    let n = myInv[i], label = it.name, ico = it.ico;
    if (it.k === 'missile' && !n && myInv[4]) { n = myInv[4]; label = 'EMP'; ico = '📡'; }
    const on = it.k === 'shield' && sh;
    h += `<div class="inv-slot${n ? ' has' : ''}${on ? ' on' : ''}" data-k="${it.k}" style="--ic:${it.col}"><div class="inv-n">${n}</div><div class="inv-ico">${ico}</div><div class="inv-name">${on ? 'ACTIVE' : label}</div><div class="inv-key">${inputDev === 'pad' ? it.pad : it.kb}</div>${it.k === 'boost' && rc ? `<div class="inv-rc" style="width:${rc}%"></div>` : ''}</div>`;
  });
  box.innerHTML = h;
}

// ═══════════════════════════════════════════════════════════════════════
// VOTE PICKING
// ═══════════════════════════════════════════════════════════════════════
let voteSel = 1;
function voteOpen() { return gamePhase === 'race' && !$('vote-panel').classList.contains('hidden') && !myVote; }
function voteHighlight() {
  const btns = document.querySelectorAll('.vote-btn');
  btns.forEach((b, i) => b.classList.toggle('pad-focus', inputDev === 'pad' && voteOpen() && i === voteSel));
}
function voteSlot(i) {
  if (!voteOpen()) return;
  const b = document.querySelectorAll('.vote-btn')[i];
  if (b) { b.click(); voteHighlight(); }
}

// ═══════════════════════════════════════════════════════════════════════
// CONTROLLER
//   B=0  A=1  Y=2  X=3  L=4  R=5  ZL=6  ZR=7  −=8  +=9  LS=10  RS=11  D-pad 12..15
// ═══════════════════════════════════════════════════════════════════════
const PB = {B: 0, A: 1, Y: 2, X: 3, L: 4, R: 5, ZL: 6, ZR: 7, MINUS: 8, PLUS: 9, LS: 10, RS: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15};
let padPrev = [], padNavT = 0, padVoteT = 0, padFocusEl = null, padFocusPos = null;

function clearPadFocus() {
  document.querySelectorAll('.pad-focus').forEach(e => e.classList.remove('pad-focus'));
  padFocusEl = null;
}
function menuRoot() {
  for (const id of ['settings-popup', 'pause-menu', 'track-select-overlay', 'friends-popup']) if (!$(id).classList.contains('hidden')) return $(id);
  return document.querySelector('.screen.active');
}
function focusables(root) {
  if (!root) return [];
  return [...root.querySelectorAll('button, .opt-btn, .track-btn, .vh-slot, .paint-chip, input')].filter(e => e.offsetParent !== null && !e.disabled);
}
function shownRect(e) {
  const r = e.getBoundingClientRect();
  let l = r.left, t = r.top, rt = r.right, b = r.bottom;
  for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
    if (getComputedStyle(p).overflow === 'visible') continue;
    const c = p.getBoundingClientRect();
    l = Math.max(l, c.left); t = Math.max(t, c.top); rt = Math.min(rt, c.right); b = Math.min(b, c.bottom);
  }
  return {left: l, top: t, right: rt, bottom: b};
}
function centre(e) { const r = e.getBoundingClientRect(); return {x: r.left + r.width / 2, y: r.top + r.height / 2}; }
function setPadFocus(e) {
  document.querySelectorAll('.pad-focus').forEach(x => x.classList.remove('pad-focus'));
  padFocusEl = e;
  if (!e) return;
  e.classList.add('pad-focus');
  if (e.scrollIntoView) e.scrollIntoView({block: 'nearest', inline: 'nearest'});
  padFocusPos = centre(e);
}
function resolvePadFocus(root) {
  if (root !== resolvePadFocus.root) { resolvePadFocus.root = root; padFocusPos = null; padFocusEl = null; }
  const list = focusables(root);
  if (!list.length) { setPadFocus(null); return list; }
  if (padFocusEl && list.includes(padFocusEl)) { if (!padFocusEl.classList.contains('pad-focus')) padFocusEl.classList.add('pad-focus'); return list; }
  let best = null, bd = Infinity;
  if (padFocusPos) for (const e of list) { const c = centre(e), d = Math.hypot(c.x - padFocusPos.x, c.y - padFocusPos.y); if (d < bd) { bd = d; best = e; } }
  if (!best || bd > 260) best = list.find(e => e.classList.contains('selected') || e.id === 'btn-start') || list.find(e => e.classList.contains('btn-big')) || list[0];
  setPadFocus(best);
  return list;
}
function movePadFocus(list, dx, dy) {
  if (!padFocusEl) return;
  const a = centre(padFocusEl), ra = shownRect(padFocusEl);
  let best = null, bs = Infinity, lined = null, ls = Infinity;
  for (const e of list) {
    if (e === padFocusEl) continue;
    const c = centre(e), r = shownRect(e), ox = c.x - a.x, oy = c.y - a.y;
    const along = ox * dx + oy * dy, across = Math.abs(ox * dy) + Math.abs(oy * dx);
    if (along < 6) continue;
    const overlap = dx ? Math.min(r.bottom, ra.bottom) - Math.max(r.top, ra.top) : Math.min(r.right, ra.right) - Math.max(r.left, ra.left);
    if (overlap > 4 && r.right > r.left && r.bottom > r.top) { if (along < ls) { ls = along; lined = e; } continue; }
    if (across > along * 1.6) continue;
    const sc = along + across * 2.4;
    if (sc < bs) { bs = sc; best = e; }
  }
  best = lined || best;
  if (!best && dx) { const n = list[list.indexOf(padFocusEl) + dx]; if (n && n.parentElement === padFocusEl.parentElement) best = n; }
  if (best) { setPadFocus(best); Snd.sfx('click', 0.4); }
}
function scrollTarget(root) {
  let e = padFocusEl;
  while (e && e !== document.body) { if (e.scrollHeight > e.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(e).overflowY)) return e; e = e.parentElement; }
  if (!root) return null;
  for (const x of root.querySelectorAll('*')) if (x.scrollHeight > x.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(x).overflowY)) return x;
  return null;
}
function padBack(root) {
  if (root && root.id === 'settings-popup') return closeSettings();
  if (root && root.id === 'pause-menu') return togglePause();
  if (root && root.id === 'track-select-overlay') return closeTrackSelect();
  if (root && root.id === 'friends-popup') { const c = [...root.querySelectorAll('button')].find(b => b.offsetParent !== null && /CANCEL|CLOSE/.test(b.textContent)); return c ? c.click() : closeFriendsPopup(); }
  if (gamePhase === 'garage') return garageMode === 'car' ? goToHome() : goToCarGarage();
  if (gamePhase === 'lobby') return leaveLobby();
  if (gamePhase === 'over') return goToGarage();
}
function swapGarage(dir) {
  const order = ['car', 'boat', 'plane'], i = (order.indexOf(garageMode) + dir + 3) % 3;
  [goToCarGarage, goToBoatGarage, goToPlaneGarage][i]();
  Snd.sfx('click');
}
function swapTab(root, dir) {
  const tabs = root ? [...root.querySelectorAll('.ctab')] : [];
  if (tabs.length) {
    const i = tabs.findIndex(t => t.classList.contains('active'));
    tabs[(i + dir + tabs.length) % tabs.length].click();
    padFocusPos = null;
    return;
  }
  const list = focusables(root);
  if (!list.length) return;
  const i = list.indexOf(padFocusEl);
  setPadFocus(list[(i + dir + list.length) % list.length]);
  Snd.sfx('click', 0.4);
}

function pollGamepad(dt) {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let pad = null, want = SPLIT ? (SPLIT.dev === 'kb' ? -1 : +SPLIT.dev.slice(3)) : 0, seen = 0;
  for (const p of pads) if (p && p.connected) { if (seen++ === want) { pad = p; break; } }
  if (!pad) {
    if (padSteer || K.pu || K.pd) { padSteer = 0; K.pu = K.pd = false; inputDirty = true; }
    if (inputDev === 'pad') setDevice('kb');
    padPrev = [];
    return;
  }
  const dead = 0.2, ax = i => Math.abs(pad.axes[i] || 0) > dead ? pad.axes[i] : 0;
  const lx = ax(0), ly = ax(1), rx = ax(2), ry = ax(3);
  const now = [];
  let any = !!(lx || ly || rx || ry);
  for (let i = 0; i < pad.buttons.length; i++) { now[i] = !!(pad.buttons[i] && (pad.buttons[i].pressed || pad.buttons[i].value > 0.4)); if (now[i]) any = true; }
  const hit = i => now[i] && !padPrev[i];
  if (any) { Snd.init(); setDevice('pad'); }

  const racing = (gamePhase === 'race' || gamePhase === 'spectate') && !pauseOpen;
  if (hit(PB.PLUS) && (gamePhase === 'race' || gamePhase === 'spectate')) { if (!$('settings-popup').classList.contains('hidden')) closeSettings(); else togglePause(); }

  if (racing) {
    if (padFocusEl) clearPadFocus();
    const u = now[PB.ZL], d = now[PB.ZR];
    if (K.pu !== u || K.pd !== d || Math.abs(padSteer + lx) > 0.02) inputDirty = true;
    K.pu = u; K.pd = d; padSteer = -lx;
    if (gamePhase === 'race') {
      if (hit(PB.A)) useItem('boost');
      if (hit(PB.B)) useItem('shield');
      if (hit(PB.X)) useItem('missile');
      if (hit(PB.Y)) useItem('spring');
    } else {
      if (hit(PB.L)) cycleSpecTarget(1);
      if (hit(PB.R)) cycleSpecTarget(-1);
    }
    if (hit(PB.MINUS)) toggleFpv();
    if (voteOpen()) {
      padVoteT -= dt;
      const dir = rx > 0.5 ? 1 : rx < -0.5 ? -1 : 0;
      if (!dir) padVoteT = 0;
      else if (padVoteT <= 0) { voteSel = clampN(voteSel + dir, 0, 2); padVoteT = 0.28; Snd.sfx('click', 0.4); }
      voteHighlight();
      if (hit(PB.RS)) voteSlot(voteSel);
      gpCamYaw = lerp(gpCamYaw, 0, 0.15); gpCamPitch = lerp(gpCamPitch, 0, 0.15);
    } else {
      voteSel = 1;
      gpCamYaw = lerp(gpCamYaw, rx * 1.2, 0.15);
      gpCamPitch = lerp(gpCamPitch, ry * 2.5, 0.15);
    }
  } else {
    if (K.pu || K.pd || padSteer) { K.pu = K.pd = false; padSteer = 0; inputDirty = true; }
    if (inputDev === 'pad' && gamePhase !== 'cutscene') {
      const root = menuRoot(), list = resolvePadFocus(root);
      let dx = now[PB.RIGHT] ? 1 : now[PB.LEFT] ? -1 : lx > 0.55 ? 1 : lx < -0.55 ? -1 : 0;
      let dy = now[PB.DOWN] ? 1 : now[PB.UP] ? -1 : ly > 0.55 ? 1 : ly < -0.55 ? -1 : 0;
      if (dx && dy) { if (Math.abs(lx) > Math.abs(ly)) dy = 0; else dx = 0; }
      padNavT -= dt;
      if (!dx && !dy) padNavT = 0;
      else if (padNavT <= 0) { movePadFocus(list, dx, dy); padNavT = 0.2; }
      if (ry) { const sc = scrollTarget(root); if (sc) sc.scrollTop += ry * 900 * dt; }
      if (rx) { const sc = scrollTarget(root); if (sc) sc.scrollLeft += rx * 900 * dt; }
      if (hit(PB.A) && padFocusEl) { if (padFocusEl.tagName === 'INPUT') padFocusEl.focus(); else padFocusEl.click(); }
      if (hit(PB.B)) padBack(root);
      if (hit(PB.R)) swapTab(root, 1);
      if (hit(PB.L)) swapTab(root, -1);
      const plainGarage = gamePhase === 'garage' && root && root.id === 'scr-garage';
      if (plainGarage && hit(PB.ZR)) swapGarage(1);
      if (plainGarage && hit(PB.ZL)) swapGarage(-1);
    }
  }
  padPrev = now;
}

// ═══════════════════════════════════════════════════════════════════════
// VOICE CHAT (WebRTC mesh, signalled over the game socket)
// ═══════════════════════════════════════════════════════════════════════
const voice = {pcs: {}, stream: null, joined: false, names: {}};
const RTC_CFG = {iceServers: [{urls: 'stun:stun.l.google.com:19302'}]};

function voiceInd() {
  const e = $('voice-ind');
  if (!e) return;
  const show = (voice.joined || vcmd.on) && (gamePhase === 'race' || gamePhase === 'spectate');
  e.classList.toggle('hidden', !show);
  if (!show) return;
  const lines = [];
  if (voice.joined) {
    lines.push((voice.stream && settings.mic ? '🎙 MIC ON' : '🔇 MIC OFF') + (inputDev === 'pad' ? '' : '  ·  V'));
    const n = Object.keys(voice.pcs).length;
    lines.push('🔊 ' + n + ' IN VOICE' + (n && (gamePhase === 'race' || gamePhase === 'spectate') ? '  ·  ' + (voice.near || 0) + ' IN RANGE' : ''));
  }
  if (vcmd.on) lines.push('🗣 ' + (vcmd.state || 'VOICE COMMANDS'));
  e.textContent = lines.join('\n');
}

// Voices fade with distance: full volume within 25 m, silent past 220 m. Lobbies are full volume.
const VOICE_NEAR = 25, VOICE_FAR = 220;
function voiceProximity() {
  const racing = gamePhase === 'race' || gamePhase === 'spectate';
  const ear = racing ? cars[gamePhase === 'race' ? myCarId : specTarget] : null;
  let near = 0;
  for (const id of Object.keys(voice.pcs)) {
    const rec = voice.pcs[id];
    let v = 1;
    if (ear) {
      const c = Object.values(cars).find(o => o.sid === id);
      if (c) {
        const d = Math.hypot(c.x - ear.x, c.y - ear.y, c.z - ear.z);
        const k = clampN((VOICE_FAR - d) / (VOICE_FAR - VOICE_NEAR), 0, 1);
        v = k * k;
      }
    }
    rec.vol = v;
    if (v > 0.02) near++;
    if (rec.audio) rec.audio.volume += (v - rec.audio.volume) * 0.35;
  }
  voice.near = near;
}

function voiceSignal(to, data) { if (socket) socket.emit('voice_signal', {to, data}); }
function voicePc(id) {
  if (voice.pcs[id]) return voice.pcs[id];
  const pc = new RTCPeerConnection(RTC_CFG);
  const rec = voice.pcs[id] = {pc, audio: null};
  if (voice.stream) for (const t of voice.stream.getTracks()) pc.addTrack(t, voice.stream);
  pc.onicecandidate = e => { if (e.candidate) voiceSignal(id, {ice: e.candidate}); };
  pc.ontrack = e => {
    if (!rec.audio) { rec.audio = new Audio(); rec.audio.autoplay = true; }
    rec.audio.srcObject = e.streams[0] || new MediaStream([e.track]);
    rec.audio.play().catch(() => {});
  };
  pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed' || pc.connectionState === 'closed') voiceDrop(id); };
  voiceInd();
  return rec;
}
function voiceDrop(id) {
  const rec = voice.pcs[id];
  if (!rec) return;
  try { rec.pc.close(); } catch (e) {}
  if (rec.audio) { rec.audio.srcObject = null; }
  delete voice.pcs[id];
  voiceInd();
}
async function voiceStart() {
  if (SPLIT || !settings.voice || voice.joined || !socket || isBotRace || typeof RTCPeerConnection === 'undefined') { voiceInd(); return; }
  voice.joined = true;
  const s = socket;
  if (settings.mic && !voice.stream) {
    try { voice.stream = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: true, noiseSuppression: true, autoGainControl: true}}); }
    catch (e) { settings.mic = false; saveSettings(); flash('🎙 MICROPHONE BLOCKED', '#ff5577', 2500); }
  }
  if (socket !== s || !voice.joined) { voiceCleanup(); return; }
  socket.emit('voice_join');
  voiceInd();
}
function voiceCleanup() {
  if (voice.joined && socket) socket.emit('voice_leave');
  for (const id of Object.keys(voice.pcs)) voiceDrop(id);
  if (voice.stream) { for (const t of voice.stream.getTracks()) t.stop(); voice.stream = null; }
  voice.joined = false;
  voiceInd();
}
function voiceRestart() {
  voiceCleanup();
  if (socket && (gamePhase === 'race' || gamePhase === 'spectate' || gamePhase === 'lobby')) voiceStart();
}
function toggleMic() {
  if (gamePhase !== 'race' && gamePhase !== 'spectate' && gamePhase !== 'lobby') return;
  if (isBotRace) { flash('VOICE CHAT IS FOR ONLINE RACES', '#ffaa00', 1500); return; }
  settings.mic = !settings.mic;
  if (settings.mic) settings.voice = true;
  saveSettings();
  if (voice.stream && voice.joined) { for (const t of voice.stream.getTracks()) t.enabled = settings.mic; voiceInd(); }
  else voiceRestart();
  flash(settings.mic ? '🎙 MIC ON' : '🔇 MIC OFF', '#00ffcc', 1200);
}
function setupVoiceSocket(s) {
  s.on('voice_peers', async ({peers}) => {
    for (const id of peers) {
      const rec = voicePc(id);
      try {
        if (!voice.stream) rec.pc.addTransceiver('audio', {direction: 'recvonly'});
        const offer = await rec.pc.createOffer();
        await rec.pc.setLocalDescription(offer);
        voiceSignal(id, {sdp: rec.pc.localDescription});
      } catch (e) {}
    }
  });
  s.on('voice_signal', async ({from, data}) => {
    if (!voice.joined || !data) return;
    const rec = voicePc(from);
    try {
      if (data.sdp) {
        await rec.pc.setRemoteDescription(data.sdp);
        if (data.sdp.type === 'offer') {
          const ans = await rec.pc.createAnswer();
          await rec.pc.setLocalDescription(ans);
          voiceSignal(from, {sdp: rec.pc.localDescription});
        }
      } else if (data.ice) await rec.pc.addIceCandidate(data.ice);
    } catch (e) {}
  });
  s.on('voice_gone', ({id}) => voiceDrop(id));
  s.on('joined', () => voiceStart());
  s.on('private_created', () => voiceStart());
}

// ═══════════════════════════════════════════════════════════════════════
// VOICE COMMANDS
// ═══════════════════════════════════════════════════════════════════════
const VCMD_WORDS = {boost: 'boost', turbo: 'boost', nitro: 'boost', missile: 'missile', missiles: 'missile', fire: 'missile', shoot: 'missile', rocket: 'missile', shield: 'shield', jump: 'spring', spring: 'spring'};
const VOSK_JS = 'https://cdn.jsdelivr.net/npm/vosk-browser@0.0.8/dist/vosk.js';
const VOSK_MODEL = 'https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-en-us-0.15.tar.gz';
const vcmd = {on: false, state: '', stream: null, ctx: null, node: null, rec: null, sr: null, model: null, seen: 0, lastT: {}};

function vcmdState(t) { vcmd.state = t; voiceInd(); if (!$('settings-popup').classList.contains('hidden')) { const v = [...document.querySelectorAll('#settings-list .set-row')][2]; if (v) v.querySelector('.set-val').textContent = settings.vcmd ? t : 'OFF'; } }
function vcmdHeard(text, fromIdx) {
  const words = String(text || '').toLowerCase().split(/\s+/).filter(Boolean);
  for (let i = fromIdx || 0; i < words.length; i++) {
    const k = VCMD_WORDS[words[i]];
    if (!k) continue;
    const t = performance.now();
    if (t - (vcmd.lastT[k] || 0) < 900) continue;
    vcmd.lastT[k] = t;
    useItem(k);
  }
  return words.length;
}
function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
}
async function vcmdStartVosk() {
  if (typeof Vosk === 'undefined') await loadScript(VOSK_JS);
  vcmdState('LOADING…');
  if (!vcmd.model) vcmd.model = await Vosk.createModel(VOSK_MODEL);
  vcmd.stream = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: true, noiseSuppression: true, channelCount: 1}});
  vcmd.ctx = new (window.AudioContext || window.webkitAudioContext)();
  const rec = vcmd.rec = new vcmd.model.KaldiRecognizer(vcmd.ctx.sampleRate, JSON.stringify(Object.keys(VCMD_WORDS).concat('[unk]')));
  rec.on('partialresult', m => { vcmd.seen = vcmdHeard(m.result.partial, vcmd.seen); });
  rec.on('result', m => { vcmdHeard(m.result.text, vcmd.seen); vcmd.seen = 0; });
  const src = vcmd.ctx.createMediaStreamSource(vcmd.stream);
  vcmd.node = vcmd.ctx.createScriptProcessor(4096, 1, 1);
  vcmd.node.onaudioprocess = e => { try { rec.acceptWaveform(e.inputBuffer); } catch (err) {} };
  const mute = vcmd.ctx.createGain(); mute.gain.value = 0;
  src.connect(vcmd.node); vcmd.node.connect(mute); mute.connect(vcmd.ctx.destination);
}
function vcmdStartSR() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) throw new Error('no speech recognition');
  const sr = vcmd.sr = new SR();
  sr.continuous = true; sr.interimResults = true; sr.lang = 'en-US';
  let seenIdx = -1, seenN = 0;
  sr.onresult = e => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (i !== seenIdx) { seenIdx = i; seenN = 0; }
      seenN = vcmdHeard(e.results[i][0].transcript, seenN);
    }
  };
  sr.onend = () => { if (vcmd.on && vcmd.sr === sr) { try { sr.start(); } catch (e) {} } };
  sr.onerror = e => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'network') { vcmd.sr = null; vcmdState('UNAVAILABLE'); } };
  sr.start();
}
function vcmdStop() {
  vcmd.on = false;
  if (vcmd.sr) { const sr = vcmd.sr; vcmd.sr = null; try { sr.stop(); } catch (e) {} }
  if (vcmd.node) { try { vcmd.node.disconnect(); } catch (e) {} vcmd.node = null; }
  if (vcmd.rec) { try { vcmd.rec.remove(); } catch (e) {} vcmd.rec = null; }
  if (vcmd.ctx) { try { vcmd.ctx.close(); } catch (e) {} vcmd.ctx = null; }
  if (vcmd.stream) { for (const t of vcmd.stream.getTracks()) t.stop(); vcmd.stream = null; }
  vcmdState('');
}
async function vcmdSync() {
  if (SPLIT) return;
  if (!settings.vcmd) { if (vcmd.on) vcmdStop(); return; }
  if (vcmd.on) return;
  vcmd.on = true; vcmd.seen = 0;
  try { await vcmdStartVosk(); if (!vcmd.on) return vcmdStop(); vcmdState('LISTENING'); }
  catch (e) {
    if (!vcmd.on) return;
    if (vcmd.node || vcmd.ctx || vcmd.stream) { const keep = vcmd.on; vcmdStop(); vcmd.on = keep; }
    try { vcmdStartSR(); vcmdState('LISTENING'); }
    catch (e2) { vcmd.on = false; vcmdState('UNAVAILABLE'); }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  const inp = $('name-input');
  inp.value = playerName();
  inp.addEventListener('input', () => {
    const n = cleanName(inp.value);
    nameError('');
    try { localStorage.setItem('ct_name', n); } catch (e) {}
  });
  window.addEventListener('gamepadconnected', () => setDevice('pad'));
  window.addEventListener('gamepaddisconnected', () => { if (!padConnected()) setDevice('kb'); });
  if (padConnected()) setDevice('pad');
  updateHints();
  setInterval(voiceInd, 500);
  setInterval(voiceProximity, 100);
  const firstGesture = () => { document.removeEventListener('pointerdown', firstGesture); document.removeEventListener('keydown', firstGesture); vcmdSync(); };
  document.addEventListener('pointerdown', firstGesture);
  document.addEventListener('keydown', firstGesture);
});

// ═══════════════════════════════════════════════════════════════════════
// ITEM SLOT CLICKS
// ═══════════════════════════════════════════════════════════════════════
document.addEventListener('pointerdown', e => {
  const slot = e.target.closest && e.target.closest('.inv-slot');
  if (slot && slot.dataset.k) { e.preventDefault(); useItem(slot.dataset.k); }
});

// ═══════════════════════════════════════════════════════════════════════
// 2 PLAYERS — two game views side by side, each with its own controls
// ═══════════════════════════════════════════════════════════════════════
let splitActive = false;
const SPLIT_DEVS = [{id: 'kb', label: 'KEYBOARD'}, {id: 'pad0', label: 'CONTROLLER 1'}, {id: 'pad1', label: 'CONTROLLER 2'}];
const splitPick = ['kb', 'pad0'];
let splitFrames = [];

function buildSplitSetup() {
  const list = $('split-list');
  list.innerHTML = '';
  [0, 1].forEach(p => {
    const d = SPLIT_DEVS.find(x => x.id === splitPick[p]);
    const b = el('button', 'set-row', `<span><div class="set-name">PLAYER ${p + 1}</div><div class="set-desc">${p ? 'Right side of the screen' : 'Left side of the screen'}</div></span><span class="set-val on">${d.label}</span>`);
    b.onclick = () => {
      let i = SPLIT_DEVS.indexOf(d);
      do { i = (i + 1) % SPLIT_DEVS.length; } while (SPLIT_DEVS[i].id === splitPick[1 - p]);
      splitPick[p] = SPLIT_DEVS[i].id;
      buildSplitSetup();
    };
    list.appendChild(b);
  });
  let n = 0;
  for (const g of (navigator.getGamepads ? navigator.getGamepads() : [])) if (g && g.connected) n++;
  $('split-note').textContent = `${n} CONTROLLER${n === 1 ? '' : 'S'} DETECTED  ·  PRESS A BUTTON ON A CONTROLLER TO WAKE IT`;
}
window.openSplitSetup = function () { buildSplitSetup(); $('split-popup').classList.remove('hidden'); };
window.closeSplitSetup = function () { $('split-popup').classList.add('hidden'); };
window.startSplit = function () {
  closeSplitSetup();
  const room = 'L' + Math.random().toString(36).slice(2, 5).toUpperCase();
  const view = $('split-view');
  splitFrames = [0, 1].map(p => {
    const f = document.createElement('iframe');
    f.allow = 'gamepad; microphone; autoplay';
    if (splitPick[p] !== 'kb') f.style.pointerEvents = 'none';
    f.src = `${window.CT_FRAME || '/?'}sp=${p + 1}&dev=${splitPick[p]}&room=${room}`;
    view.appendChild(f);
    return f;
  });
  view.classList.remove('hidden');
  splitActive = true;
  Snd.hush(true);
};
window.closeSplit = function () {
  for (const f of splitFrames) f.remove();
  splitFrames = [];
  $('split-view').classList.add('hidden');
  splitActive = false;
  Snd.hush(false);
};
// Keys typed anywhere go to whichever player is on the keyboard.
window.splitKey = function (type, code, repeat) {
  const i = splitPick.indexOf('kb');
  if (i < 0 || !splitFrames[i]) return;
  const doc = splitFrames[i].contentDocument;
  if (doc) doc.dispatchEvent(new KeyboardEvent(type, {code, key: code, repeat, bubbles: true}));
};
for (const type of ['keydown', 'keyup']) {
  document.addEventListener(type, e => {
    if (!e.isTrusted) return;
    if (splitActive) { e.stopImmediatePropagation(); e.preventDefault(); splitKey(type, e.code, e.repeat); }
    else if (SPLIT) { e.stopImmediatePropagation(); e.preventDefault(); if (parent !== window && parent.splitKey) parent.splitKey(type, e.code, e.repeat); }
  }, true);
}

// ── inside one of the two views ──
function splitRoom() { return (SPLIT.room.slice(0, 4) + (SPLIT.n % 10)).toUpperCase(); }
function splitName() { const n = playerName() || 'PLAYER'; return SPLIT.p === 1 ? n : (n.slice(0, 14) + ' 2'); }
function splitGarageUI() {
  $('garage-title-text').textContent = 'PLAYER ' + SPLIT.p;
  $('garage-header-left').innerHTML = `<button class="btn-icon" onclick="parent.closeSplit()">✕ EXIT 2 PLAYERS</button>`;
  $('garage-header-right').innerHTML = `<div class="wins-pill">${SPLIT.dev === 'kb' ? 'KEYBOARD' : 'CONTROLLER ' + (+SPLIT.dev.slice(3) + 1)}</div>`;
  $('garage-btn-row').innerHTML = `<button class="btn-big" onclick="splitReady()">READY ▶</button>`;
}
window.splitReady = function () {
  gamePhase = 'lobby'; isBotRace = false;
  showScreen('lobby');
  $('lobby-title').textContent = 'WAITING FOR PLAYER ' + (3 - SPLIT.p);
  const base = {name: splitName(), vh: custom.vehicle, customData: custom};
  if (SPLIT.p === 1) emitWhenReady('create_private', Object.assign(base, {mode: '10', code: splitRoom()}));
  else emitWhenReady('join_private', Object.assign(base, {code: splitRoom()}));
  if (SPLIT.p === 1) {
    const s = socket;
    let asked = false;
    s.on('lobby_update', ({count}) => {
      if (count < 2 || gamePhase !== 'lobby' || asked) return;
      asked = true;
      openTrackSelect('split', () => { s.emit('track_vote', {trackType: selectedTrackType >= 0 ? selectedTrackType : undefined}); s.emit('private_start'); });
    });
  }
};
function splitJoinRetry() {
  dropSocket();
  setTimeout(() => { if (gamePhase === 'lobby') splitReady(); }, 700);
}
if (SPLIT) {
  window.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('split');
    inputDev = SPLIT.dev === 'kb' ? 'kb' : 'pad';
    document.body.classList.toggle('dev-pad', inputDev === 'pad');
    if (SPLIT.p === 2) Snd.hush(true);
    Snd.init();
    const home = goToHome, garage = goToGarage;
    window.goToGarage = window.returnToGarage = window.exitRace = function () { if (gamePhase === 'race' || gamePhase === 'spectate' || gamePhase === 'over') SPLIT.n++; garage(); };
    window.goToHome = window.leaveLobby = window.goToGarage;
    garage();
    updateHints();
  });
}
