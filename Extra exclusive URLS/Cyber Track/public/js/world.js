'use strict';
// ═══════════════════════════════════════════════════════════════════════
// RENDERER + RACE WORLD
// ═══════════════════════════════════════════════════════════════════════
let renderer, raceScene, raceCam;
const W = {
  tr: null, st: null, th: null, group: null, ents: null,
  zones: [], obstacles: [], powerups: [], barriers: [], lasers: [], finishF: null,
  anim: [], terrainH: null, distTrack: null, t: 0, fogBase: [100, 800], fogT: 0,
};

const THEMES = [
  {top:0x3a8fe0, hor:0xbfe3f5, fog:[150,900],  wall:0xf2f2f2, edge:0xd4a820, hemi:[0xcfe8ff,0x4a7a22,1.0], sun:[0xfff0c0,2.2,[120,200,80]],  road:0x9a9a9a, night:0},
  {top:0x0a2a1c, hor:0x35604a, fog:[40,380],   wall:0x3b2a18, edge:0x00cc55, hemi:[0x88bb99,0x0c2010,0.8], sun:[0xbfe8c0,1.2,[60,150,80]],   road:0x777777, night:0.4},
  {top:0x1b6fd0, hor:0x9fd8f5, fog:[120,900],  wall:0x00ccff, edge:0x00eeff, hemi:[0xbfe0ff,0x0a3a6a,1.0], sun:[0xffffff,2.2,[100,200,80]],  road:0x888888, night:0},
  {top:0x2f8fe6, hor:0xffe2b8, fog:[150,950],  wall:0xffffff, edge:0x00ccff, hemi:[0xcfeaff,0xa09070,1.0], sun:[0xffe8b0,2.4,[-150,120,60]], road:0xa09a90, night:0},
  {top:0x020108, hor:0x0a0618, fog:[20,240],   wall:0x241a3a, edge:0x9900ff, hemi:[0x6655aa,0x140a22,0.9], sun:[0x6600cc,0.3,[40,80,40]],    road:0x555566, night:1},
  {top:0x150402, hor:0x5a1a08, fog:[40,480],   wall:0x2a1410, edge:0xff4400, hemi:[0x884422,0x1a0500,0.8], sun:[0xff7733,1.3,[80,100,60]],   road:0x555050, night:0.8},
  {top:0x000208, hor:0x06123a, fog:[60,600],   wall:0x0a1a3a, edge:0x00aaff, hemi:[0x335588,0x000511,0.8], sun:[0x99aadd,0.9,[80,150,60]],   road:0x39405a, night:1},
  {top:0xe8dcc8, hor:0xd8c8ac, fog:[200,1400], wall:0xffffff, edge:0xff3355, hemi:[0xfff0dd,0x886644,1.0], sun:[0xffe8cc,1.6,[100,260,60]],  road:0xff7a2a, night:0},
  {top:0x03050c, hor:0x1a1430, fog:[70,650],   wall:0x1a1a22, edge:0xff8800, hemi:[0x444466,0x111118,0.8], sun:[0xffcc99,0.8,[80,150,60]],   road:0x4a4a52, night:1},
  {top:0x1a6ae0, hor:0xc8e8ff, fog:[250,1500], wall:0xffffff, edge:0xffffff, hemi:[0xddeeff,0x88aadd,1.1], sun:[0xffffff,2.2,[120,250,100]], road:0xffffff, night:0},
  {top:0x05000c, hor:0x250a40, fog:[60,600],   wall:0x1a0a2a, edge:0xcc00ff, hemi:[0x7744aa,0x110022,0.8], sun:[0xcc99ff,0.9,[60,120,80]],   road:0x3a2a4a, night:1},
  {top:0x04020e, hor:0x2a0a3a, fog:[70,650],   wall:0x14101e, edge:0xff00aa, hemi:[0x554466,0x110a18,0.8], sun:[0xff99cc,0.8,[80,150,60]],   road:0x3a3a48, night:1},
  {top:0x06081a, hor:0x1c2440, fog:[150,900],  wall:0xdddddd, edge:0xffffff, hemi:[0xaabbdd,0x334433,1.0], sun:[0xffffff,1.8,[0,300,0]],     road:0x666670, night:0.5},
  {top:0x02020a, hor:0x10203a, fog:[50,520],   wall:0x101828, edge:0x44ccff, hemi:[0x446688,0x040412,0.8], sun:[0x88bbff,0.9,[60,200,100]],  road:0x444455, night:1},
  {top:0x3d8fd8, hor:0xf3d9a8, fog:[160,1000], wall:0xd9b98a, edge:0xff7a2a, hemi:[0xffeccc,0xa07a46,1.0], sun:[0xffe2a0,2.4,[150,180,60]],  road:0x7a7468, night:0},
  {top:0x5aa0e0, hor:0xe4f0fa, fog:[110,800],  wall:0xe8f4ff, edge:0x66ccff, hemi:[0xe6f2ff,0x8aa0bb,1.1], sun:[0xffffff,2.0,[-100,160,80]],  road:0x6a6e78, night:0},
  {top:0x000004, hor:0x0a0a14, fog:[300,2200], wall:0xbdbdc8, edge:0x66ffcc, hemi:[0x9999aa,0x222230,0.9], sun:[0xffffff,3.0,[200,120,-80]],  road:0x555560, night:0.6},
  {top:0xff9ad5, hor:0xffe0f2, fog:[150,950],  wall:0xffffff, edge:0xff3399, hemi:[0xfff0fa,0xd070b0,1.1], sun:[0xffffff,1.8,[100,200,60]],   road:0x9a5a7a, night:0},
  {top:0x0f5fa8, hor:0xcfe8f5, fog:[120,850],  wall:0xcfefff, edge:0x66eeff, hemi:[0xdff0ff,0x1a4a7a,1.0], sun:[0xffffff,1.8,[-120,90,-100]], road:0x888888, night:0},
  {top:0x2f7fd0, hor:0xf0cfa0, fog:[200,1400], wall:0xd9a070, edge:0xffcc33, hemi:[0xffe8c8,0x8a5a36,1.0], sun:[0xffe0a0,2.4,[120,200,80]],  road:0x888888, night:0},
];

const rand = (a, b) => a + Math.random() * (b - a);
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion(), _pl = {};

function initRenderer() {
  renderer = new THREE.WebGLRenderer({canvas: document.getElementById('gl'), antialias: true, powerPreference: 'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  makeEnvMap();
}

function makeEnvMap() {
  const s = new THREE.Scene();
  s.background = new THREE.Color(0x060a14);
  const add = (w, h, d, x, y, z, col) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({color: col})); m.position.set(x, y, z); s.add(m); };
  add(30, 0.5, 8, 0, 12, 0, 0xffffff);
  add(8, 0.5, 30, 0, 12, 0, 0xcfe8ff);
  add(0.5, 6, 30, -16, 3, 0, 0x00ffcc);
  add(0.5, 6, 30, 16, 3, 0, 0xff00ff);
  add(30, 4, 0.5, 0, 2, 16, 0x3355aa);
  add(30, 4, 0.5, 0, 2, -16, 0x223366);
  add(40, 0.5, 40, 0, -6, 0, 0x101622);
  const pm = new THREE.PMREMGenerator(renderer);
  ENV_MAP = pm.fromScene(s, 0.03).texture;
  pm.dispose();
}

// ── Scene scaffolding ────────────────────────────────────────────────
function initRaceScene() {
  raceScene = new THREE.Scene();
  raceScene.fog = new THREE.Fog(0x000814, 60, 600);
  raceCam = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.5, 3000);
  W.hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 1);
  W.sun = new THREE.DirectionalLight(0xffffff, 1);
  W.head = new THREE.SpotLight(0xffffff, 0, 130, 0.5, 0.5, 1.2);
  raceScene.add(W.hemi, W.sun, W.head, W.head.target);

  W.skyMat = new THREE.ShaderMaterial({
    uniforms: {top: {value: new THREE.Color()}, hor: {value: new THREE.Color()}},
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 hor; varying vec3 vP; void main(){ float h = normalize(vP).y; vec3 c = h > 0.0 ? mix(hor, top, pow(h, 0.55)) : mix(hor, hor * 0.55, min(1.0, -h * 2.5)); gl_FragColor = vec4(c, 1.0);\n#include <colorspace_fragment>\n}',
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  W.sky = new THREE.Mesh(new THREE.SphereGeometry(2500, 24, 12), W.skyMat);
  W.sky.renderOrder = -10; W.sky.frustumCulled = false;
  raceScene.add(W.sky);

  const sp = new Float32Array(1500 * 3);
  for (let i = 0; i < 1500; i++) {
    const a = Math.random() * 6.283, e = Math.acos(Math.random()) , r = 2300;
    sp[i*3] = Math.cos(a) * Math.sin(e) * r; sp[i*3+1] = Math.cos(e) * r + 20; sp[i*3+2] = Math.sin(a) * Math.sin(e) * r;
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  W.stars = new THREE.Points(sg, new THREE.PointsMaterial({color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, depthWrite: false}));
  W.stars.frustumCulled = false; W.stars.renderOrder = -9;
  raceScene.add(W.stars);

  initParticles();
  initTextures();
}

// ── Canvas textures ──────────────────────────────────────────────────
const TEX = {};
function canvasTex(w, h, draw, repeat) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function initTextures() {
  const lines = (g, w, h, bg) => {
    if (bg) {
      g.fillStyle = '#b8b8b8'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 5000; i++) { const v = 150 + Math.random() * 70 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    } else { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); }
    g.fillStyle = '#fff';
    g.fillRect(w * 0.025, 0, w * 0.02, h); g.fillRect(w * 0.955, 0, w * 0.02, h);
    g.fillRect(w * 0.49, h * 0.2, w * 0.02, h * 0.6);
  };
  TEX.road = canvasTex(256, 256, (g, w, h) => lines(g, w, h, true), true);
  TEX.roadEm = canvasTex(256, 256, (g, w, h) => lines(g, w, h, false), true);
  TEX.chev = canvasTex(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.strokeStyle = '#fff'; g.lineWidth = 16; g.lineJoin = 'miter';
    for (let k = 0; k < 2; k++) { const y = k * 64; g.beginPath(); g.moveTo(10, y + 8); g.lineTo(64, y + 52); g.lineTo(118, y + 8); g.stroke(); }
  }, true);
  TEX.checker = canvasTex(64, 64, (g) => { for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? '#0a0a0a' : '#fff'; g.fillRect(x * 16, y * 16, 16, 16); } }, true);
  TEX.blob = canvasTex(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 2, 32, 32, 32); r.addColorStop(0, 'rgba(0,0,0,0.6)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
  TEX.windows = canvasTex(64, 128, (g, w, h) => {
    g.fillStyle = '#05060a'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 6; x++) if (Math.random() < 0.55) {
      g.fillStyle = ['#ffcc66', '#ffe9a8', '#66ccff', '#ff66cc'][Math.random() * 4 | 0]; g.fillRect(4 + x * 10, 3 + y * 8, 6, 4);
    }
  }, true);
  TEX.planks = canvasTex(256, 256, (g, w, h) => {
    for (let i = 0; i < 8; i++) { const v = 120 + Math.random() * 40 | 0; g.fillStyle = `rgb(${v + 40},${v},${v * 0.6 | 0})`; g.fillRect(i * 32, 0, 31, h); g.fillStyle = 'rgba(60,35,10,0.5)'; g.fillRect(i * 32 + 31, 0, 1, h); g.fillRect(i * 32, (i * 77) % 256, 32, 2); }
  }, true);
}

// ── Strip geometry builder ───────────────────────────────────────────
function Strips() { this.pos = []; this.uv = []; this.idx = []; }
Strips.prototype.add = function (n, fa, fb, fv) {
  const base = this.pos.length / 3;
  for (let i = 0; i <= n; i++) {
    const a = fa(i), b = fb(i), v = fv ? fv(i) : i;
    this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    this.uv.push(0, v, 1, v);
  }
  for (let i = 0; i < n; i++) { const p = base + i * 2; this.idx.push(p, p + 1, p + 2, p + 1, p + 3, p + 2); }
};
Strips.prototype.quad = function (a, b, c, d) {
  const p = this.pos.length / 3;
  this.pos.push(...a, ...b, ...c, ...d); this.uv.push(0, 0, 1, 0, 0, 1, 1, 1);
  this.idx.push(p, p + 1, p + 2, p + 1, p + 3, p + 2);
};
Strips.prototype.build = function () {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
  g.setIndex(this.idx);
  g.computeVertexNormals();
  return g;
};

function trackPt(tr, i, lat, dy) {
  i = ((i % tr.N) + tr.N) % tr.N;
  return [tr.px[i] + tr.tz[i] * lat, tr.py[i] + lat * tr.bk[i] + dy, tr.pz[i] - tr.tx[i] * lat];
}

function frameAt(f, lat, obj, lift) {
  const tr = W.tr, p = CT.placeAt(tr, f, lat, _pl);
  const sl = tr.mode === 'plane' ? p.sl : p.sl;
  _v1.set(p.tx, sl, p.tz).normalize();
  _v2.set(p.tz, p.bk, -p.tx).normalize();
  _v3.crossVectors(_v1, _v2).normalize();
  _v2.crossVectors(_v3, _v1);
  obj.quaternion.setFromRotationMatrix(_m4.makeBasis(_v2, _v3, _v1));
  obj.position.set(p.x + _v3.x * (lift || 0), p.y + _v3.y * (lift || 0), p.z + _v3.z * (lift || 0));
  return p;
}

function inst(geo, mat, items) {
  const m = new THREE.InstancedMesh(geo, mat, items.length), e = new THREE.Euler();
  const col = new THREE.Color();
  items.forEach((it, i) => {
    _q.setFromEuler(e.set(it.rx || 0, it.ry || 0, it.rz || 0));
    _v1.set(it.sx || it.s || 1, it.sy || it.s || 1, it.sz || it.s || 1);
    _m4.compose(_v2.set(it.x, it.y, it.z), _q, _v1);
    m.setMatrixAt(i, _m4);
    if (it.c !== undefined) m.setColorAt(i, col.setHex(it.c));
  });
  m.instanceMatrix.needsUpdate = true;
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
  m.frustumCulled = false;
  return m;
}

function disposeTree(g) {
  g.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of ms) if (!m.userData.shared) m.dispose();
  });
}

// ═══════════════════════════════════════════════════════════════════════
// WORLD BUILD
// ═══════════════════════════════════════════════════════════════════════
function setTrack(st) {
  const typeChanged = !W.st || W.st.type !== st.type;
  W.st = st;
  W.tr = CT.buildTrack(st);
  const tr = W.tr, th = THEMES[st.type] || THEMES[6];
  W.th = th;
  if (W.group) { raceScene.remove(W.group); disposeTree(W.group); }
  W.group = new THREE.Group();
  W.anim = [];
  W.crowdT = null;
  W.ambient = W.wallMat = W.wallMesh = W.railMesh = W.roadMat = W.finishMesh = null;
  W.caveR = 0;
  raceScene.add(W.group);

  // Atmosphere
  W.skyMat.uniforms.top.value.setHex(th.top);
  W.skyMat.uniforms.hor.value.setHex(th.hor);
  raceScene.fog.color.setHex(th.hor);
  W.fogBase = th.fog.slice();
  if (W.fogT <= 0) { raceScene.fog.near = th.fog[0]; raceScene.fog.far = th.fog[1]; }
  W.hemi.color.setHex(th.hemi[0]); W.hemi.groundColor.setHex(th.hemi[1]); W.hemi.intensity = th.hemi[2] * 2.2;
  W.sun.color.setHex(th.sun[0]); W.sun.intensity = th.sun[1]; W.sun.position.set(...th.sun[2]);
  W.head.intensity = th.night * 900;
  W.stars.visible = th.night >= 0.5 && tr.style !== 'cave' && tr.style !== 'house';

  buildTrackMeshes(tr, th);
  ({farm: dressFarm, forest: dressForest, water: dressWater, beach: dressBeach, cave: dressCave, volcano: dressVolcano,
    cyber: dressCyber, house: dressHouse, city: dressCity, sky: dressSky, helix: dressHelix, neon: dressCity,
    stadium: dressStadium, chaos: dressChaos, desert: dressDesert, snow: dressSnow, moon: dressMoon, candy: dressCandy, arctic: dressWater, canyon: dressCanyon})[tr.style](tr, th);
  W.tr.nramps = CT.zoneRamps(W.tr, W.zones);
  rebuildEntities();
  return typeChanged;
}

function buildTrackMeshes(tr, th) {
  const N = tr.N, half = tr.w / 2, G = W.group;
  const edgeMat = new THREE.MeshBasicMaterial({color: th.edge, fog: false});
  W.edgeMat = edgeMat;

  if (tr.mode === 'car') {
    const WH = 1.3, WT = 0.8;
    const dd = i => 1.2 + half * Math.abs(tr.bk[((i % N) + N) % N]) * 2;
    const P = (lat, dy) => i => trackPt(tr, i, lat, typeof dy === 'function' ? dy(i) : dy);
    const vS = i => (i === N ? tr.L : tr.S[i]) / 20;

    const road = new Strips();
    road.add(N, P(half, 0), P(-half, 0), vS);
    W.roadMat = new THREE.MeshStandardMaterial({map: TEX.road, emissiveMap: TEX.roadEm, emissive: th.edge, emissiveIntensity: th.night ? 1.2 : 0, color: th.road, roughness: 0.75, metalness: 0.1, envMap: ENV_MAP, envMapIntensity: 0.25});
    G.add(new THREE.Mesh(road.build(), W.roadMat));

    const wall = new Strips(), deck = new Strips(), rail = new Strips();
    wall.add(N, P(half + WT, WH), P(half, WH));
    wall.add(N, P(half, WH), P(half, 0));
    wall.add(N, P(-half, 0), P(-half, WH));
    wall.add(N, P(-half, WH), P(-half - WT, WH));
    const nd = i => -dd(i);
    deck.add(N, P(half + WT, nd), P(half + WT, WH));
    deck.add(N, P(-half - WT, WH), P(-half - WT, nd));
    deck.add(N, P(-half - WT, nd), P(half + WT, nd));
    rail.add(N, P(half + 0.3, WH + 0.03), P(half + 0.02, WH + 0.03));
    rail.add(N, P(-half - 0.02, WH + 0.03), P(-half - 0.3, WH + 0.03));
    rail.add(N, P(half + WT + 0.02, WH * 0.6), P(half + WT + 0.02, WH * 0.85));
    rail.add(N, P(-half - WT - 0.02, WH * 0.85), P(-half - WT - 0.02, WH * 0.6));
    W.wallMat = new THREE.MeshStandardMaterial({color: th.wall, roughness: 0.6, metalness: 0.3, transparent: true, opacity: 1});
    W.wallMesh = new THREE.Mesh(wall.build(), W.wallMat);
    W.railMesh = new THREE.Mesh(rail.build(), edgeMat);
    G.add(W.wallMesh, W.railMesh);
    G.add(new THREE.Mesh(deck.build(), new THREE.MeshStandardMaterial({color: 0x14161e, roughness: 0.8, metalness: 0.3})));

  }

  // Ramps (road and water)
  if (tr.mode !== 'plane' && tr.ramps.length) {
    const boat = tr.mode === 'boat', rs = new Strips(), n = 4, hw = half - 0.25;
    for (const r of tr.ramps) {
      const pt = (k, lat, top) => {
        const p = CT.placeAt(tr, (r.s0 + r.len * 0.999 * k / n) / tr.L, lat, {}), hk = r.h * k / n * 0.999;
        if (boat) return [p.x, top ? hk + 0.04 : -0.6, p.z];
        return [p.x, top ? p.y + 0.04 : p.y - hk + 0.02, p.z];
      };
      rs.add(n, k => pt(k, hw, true), k => pt(k, -hw, true), k => k / n * 2);
      rs.add(n, k => pt(k, hw, false), k => pt(k, hw, true));
      rs.add(n, k => pt(k, -hw, true), k => pt(k, -hw, false));
      rs.quad(pt(n, hw, true), pt(n, hw, false), pt(n, -hw, true), pt(n, -hw, false));
    }
    const rm = new THREE.MeshStandardMaterial({color: boat ? 0x24303c : 0x222630, map: null, emissive: 0xffaa00, emissiveMap: TEX.chev, emissiveIntensity: 1.6, roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide});
    G.add(new THREE.Mesh(rs.build(), rm));
    W.anim.push(() => { TEX.chev.offset.y = -W.t * 1.5; });
  }

  // Start gantry
  const gate = new THREE.Group(), gw = tr.w + 3, gh = tr.mode === 'plane' ? 0 : 8;
  if (tr.mode === 'plane') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(tr.w / 2 + 1, 0.8, 8, 40), new THREE.MeshBasicMaterial({color: 0xffffff, map: TEX.checker}));
    ring.material.map.repeat.set(24, 1);
    gate.add(ring);
  } else {
    const pm = new THREE.MeshStandardMaterial({color: 0x30343f, metalness: 0.7, roughness: 0.35, envMap: ENV_MAP});
    for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.9, gh, 0.9), pm); p.position.set(sx * gw / 2, gh / 2, 0); gate.add(p); }
    const ct = TEX.checker.clone(); ct.needsUpdate = true; ct.repeat.set(gw / 4, 0.5);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(gw + 0.9, 1.6, 0.7), new THREE.MeshBasicMaterial({map: ct}));
    beam.position.y = gh; gate.add(beam);
    const glow = new THREE.Mesh(new THREE.BoxGeometry(gw, 0.2, 0.8), edgeMat); glow.position.y = gh - 1; gate.add(glow);
  }
  frameAt(0, 0, gate);
  if (tr.mode === 'boat') gate.position.y = 0;
  G.add(gate);
}

// ── Terrain ──────────────────────────────────────────────────────────
function makeTrackField(tr) {
  const cell = 80, grid = new Map(), N = tr.N;
  const key = (cx, cz) => cx * 4096 + cz;
  for (let i = 0; i < N; i++) {
    const k = key(Math.floor(tr.px[i] / cell), Math.floor(tr.pz[i] / cell));
    let a = grid.get(k); if (!a) grid.set(k, a = []);
    a.push(i);
  }
  const half = tr.w / 2;
  // returns [distance to centreline, lowest nearby deck height]
  const out = [0, 0];
  return function (x, z) {
    const cx = Math.floor(x / cell), cz = Math.floor(z / cell);
    let bd = 1e12;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const l = grid.get(key(cx + a, cz + b)); if (!l) continue;
      for (let k = 0; k < l.length; k++) { const i = l[k], dx = tr.px[i] - x, dz = tr.pz[i] - z, d = dx * dx + dz * dz; if (d < bd) bd = d; }
    }
    if (bd === 1e12) { out[0] = 1e6; out[1] = 0; return out; }
    const lim = (Math.sqrt(bd) + 12) ** 2;
    let by = 1e9;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const l = grid.get(key(cx + a, cz + b)); if (!l) continue;
      for (let k = 0; k < l.length; k++) {
        const i = l[k], dx = tr.px[i] - x, dz = tr.pz[i] - z;
        if (dx * dx + dz * dz < lim) { const y = tr.py[i] - 0.5 - half * Math.abs(tr.bk[i]); if (y < by) by = y; }
      }
    }
    out[0] = Math.sqrt(bd); out[1] = by;
    return out;
  };
}

function smooth(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
function noise2(x, z) {
  return Math.sin(x * 0.011 + 1.3) * Math.cos(z * 0.013 - 0.7) + 0.5 * Math.sin(x * 0.027 + z * 0.019 + 2.1) + 0.25 * Math.sin(x * 0.061 - z * 0.053);
}

// base(x,z) → natural height; colour(h, x, z, k) → hex, k = 0 on the road shoulder … 1 in the wild
function buildTerrain(tr, base, colour, blend, size, seg) {
  const field = makeTrackField(tr), half = tr.w / 2 + 2.5;
  W.distTrack = (x, z) => field(x, z)[0];
  W.terrainH = (x, z) => {
    const f = field(x, z), hb = base(x, z);
    if (f[0] > 5e5) return hb;
    return f[1] + (hb - f[1]) * smooth((f[0] - half) / blend);
  };
  size = size || 1500; seg = seg || 100;
  const g = new THREE.PlaneGeometry(size, size, seg, seg);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), f = field(x, z), hb = base(x, z);
    const k = f[0] > 5e5 ? 1 : smooth((f[0] - half) / blend);
    const h = f[0] > 5e5 ? hb : f[1] + (hb - f[1]) * k;
    p.setY(i, h);
    c.setHex(colour(h, x, z, k));
    const j = 0.92 + Math.random() * 0.16;
    col[i*3] = c.r * j; col[i*3+1] = c.g * j; col[i*3+2] = c.b * j;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({vertexColors: true, flatShading: true}));
  W.group.add(m);
  return m;
}

// Scatter helper: positions beside the road
function roadside(tr, step, offMin, offMax, fn) {
  const half = tr.w / 2;
  for (let i = 0; i < tr.N; i += step) {
    for (const sg of [-1, 1]) {
      const lat = sg * (half + rand(offMin, offMax));
      const x = tr.px[i] + tr.tz[i] * lat, z = tr.pz[i] - tr.tx[i] * lat;
      if (W.distTrack && W.distTrack(x, z) < half + offMin - 0.5) continue;
      fn(x, z, i, sg);
    }
  }
}
function scatter(n, range, minDist, fn) {
  for (let k = 0, tries = 0; k < n && tries < n * 6; tries++) {
    const x = rand(-range, range), z = rand(-range, range);
    if (W.distTrack && W.distTrack(x, z) < minDist) continue;
    fn(x, z); k++;
  }
}
const lam = (c, o) => new THREE.MeshLambertMaterial(Object.assign({color: c}, o));

function addTrees(pts, trunkC, leafC, leafGeo) {
  if (!pts.length) return;
  const tg = new THREE.CylinderGeometry(0.5, 0.8, 5, 6); tg.translate(0, 2.5, 0);
  const lg = leafGeo || (() => { const c = new THREE.ConeGeometry(3.3, 11, 7); c.translate(0, 9.5, 0); return c; })();
  W.group.add(inst(tg, lam(trunkC), pts));
  W.group.add(inst(lg, lam(0xffffff, {flatShading: true}), pts.map(p => Object.assign({}, p, {c: leafC[Math.random() * leafC.length | 0]}))));
}

function addPillars(tr, groundY, step, col) {
  const items = [], half = tr.w / 2;
  for (let i = 0; i < tr.N; i += step) {
    const top = tr.py[i] - 1.2 - half * Math.abs(tr.bk[i]);
    let blocked = false;
    for (let j = 0; j < tr.N; j += 2) {
      const dj = Math.min(Math.abs(i - j), tr.N - Math.abs(i - j));
      if (dj > 12 && tr.py[j] < top && Math.hypot(tr.px[j] - tr.px[i], tr.pz[j] - tr.pz[i]) < half + 5) { blocked = true; break; }
    }
    if (blocked || top - groundY < 1) continue;
    items.push({x: tr.px[i], y: (top + groundY) / 2, z: tr.pz[i], sx: 2.4, sy: top - groundY, sz: 2.4, ry: tr.ang[i]});
    items.push({x: tr.px[i], y: top - 0.3, z: tr.pz[i], sx: tr.w * 0.8, sy: 0.6, sz: 2.4, ry: tr.ang[i]});
  }
  if (items.length) W.group.add(inst(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({color: col, roughness: 0.8, metalness: 0.2}), items));
}

function addThrusters(tr, col) {
  const items = [];
  for (let i = 0; i < tr.N; i += 9) items.push({x: tr.px[i], y: tr.py[i] - 2.6 - tr.w * Math.abs(tr.bk[i]), z: tr.pz[i]});
  const cg = new THREE.ConeGeometry(1.6, 4, 8, 1, true); cg.rotateX(Math.PI);
  const m = inst(cg, new THREE.MeshBasicMaterial({color: col, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide}), items);
  W.group.add(m);
  W.anim.push(() => { m.material.opacity = 0.4 + 0.2 * Math.sin(W.t * 9); });
}

function addGridFloor(y, c1, c2) {
  const gh = new THREE.GridHelper(3000, 150, c1, c2);
  gh.position.y = y; gh.material.transparent = true; gh.material.opacity = 0.55;
  W.group.add(gh);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshBasicMaterial({color: 0x010208}));
  fl.rotation.x = -Math.PI / 2; fl.position.y = y - 0.5; W.group.add(fl);
}

// ── Themes ───────────────────────────────────────────────────────────
function dressFarm(tr) {
  buildTerrain(tr, (x, z) => 5 + noise2(x, z) * 8, (h, x, z, k) => k < 0.12 ? 0x8a7a4a : (Math.sin(x * 0.02) * Math.sin(z * 0.025) > 0.35 ? 0xb8a030 : h > 9 ? 0x3f7a26 : 0x4f9030), 55);
  const posts = [], trees = [], bales = [];
  roadside(tr, 3, 3, 3.2, (x, z, i) => posts.push({x, y: W.terrainH(x, z) + 0.9, z, ry: tr.ang[i]}));
  W.group.add(inst(new THREE.BoxGeometry(0.3, 1.8, 0.3), lam(0x8b6914), posts));
  W.group.add(inst(new THREE.BoxGeometry(0.12, 0.2, tr.ds * 3.1), lam(0x9b7924), posts.map(p => Object.assign({}, p, {y: p.y + 0.4}))));
  scatter(70, 650, tr.w / 2 + 14, (x, z) => trees.push({x, y: W.terrainH(x, z), z, s: rand(0.9, 1.6)}));
  const lg = new THREE.IcosahedronGeometry(4.5, 0); lg.translate(0, 8, 0);
  addTrees(trees, 0x5a3a1a, [0x3a8a2a, 0x4a9a30, 0x2f7a22], lg);
  scatter(40, 500, tr.w / 2 + 8, (x, z) => bales.push({x, y: W.terrainH(x, z) + 1.4, z, ry: rand(0, 3), rz: Math.PI / 2}));
  W.group.add(inst(new THREE.CylinderGeometry(1.5, 1.5, 2.4, 10), lam(0xd8b840), bales));
  // Barns + windmill
  for (let k = 0; k < 4; k++) scatter(1, 420, tr.w / 2 + 30, (x, z) => {
    const y = W.terrainH(x, z), b = new THREE.Group();
    const walls = new THREE.Mesh(new THREE.BoxGeometry(16, 9, 22), lam(0xaa2a22)); walls.position.y = 4.5;
    const roofG = new THREE.CylinderGeometry(0.1, 9.5, 5, 4, 1); roofG.rotateY(Math.PI / 4); roofG.scale(1, 1, 1.7);
    const roof = new THREE.Mesh(roofG, lam(0x55504a, {flatShading: true})); roof.position.y = 11.5;
    b.add(walls, roof);
    if (k === 0) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(1, 2.2, 26, 8), lam(0xdddddd)); tower.position.set(22, 13, 0);
      const blades = new THREE.Group();
      for (let j = 0; j < 4; j++) { const bl = new THREE.Mesh(new THREE.BoxGeometry(1.4, 12, 0.2), lam(0xffffff)); bl.position.y = 6; const h = new THREE.Group(); h.add(bl); h.rotation.z = j * Math.PI / 2; blades.add(h); }
      blades.position.set(22, 25, 1.6); b.add(tower, blades);
      W.anim.push(dt => { blades.rotation.z += dt * 0.9; });
    }
    b.position.set(x, y - 0.5, z); b.rotation.y = rand(0, 6); W.group.add(b);
  });
}

function dressForest(tr) {
  buildTerrain(tr, (x, z) => 12 + noise2(x * 1.3, z * 1.3) * 15, (h, x, z, k) => k < 0.12 ? 0x4a3a22 : h > 22 ? 0x23401f : 0x1c3a1a, 45);
  const trees = [], rocks = [];
  roadside(tr, 2, 9, 22, (x, z) => trees.push({x, y: W.terrainH(x, z) - 0.3, z, s: rand(0.8, 1.4), ry: rand(0, 6)}));
  scatter(420, 600, tr.w / 2 + 12, (x, z) => trees.push({x, y: W.terrainH(x, z) - 0.3, z, s: rand(1, 2.4), ry: rand(0, 6)}));
  addTrees(trees, 0x3a2614, [0x0f5a2a, 0x146a30, 0x0c4a22, 0x1a7a3a]);
  scatter(60, 500, tr.w / 2 + 4, (x, z) => rocks.push({x, y: W.terrainH(x, z), z, s: rand(1, 3.5), ry: rand(0, 6)}));
  W.group.add(inst(new THREE.DodecahedronGeometry(1.2, 0), lam(0x556060, {flatShading: true}), rocks));
  // Fireflies
  addGlowPoints(160, 0xaaff66, 2.6, () => { const x = rand(-420, 420), z = rand(-420, 420); return [x, W.terrainH(x, z) + rand(1, 8), z]; });
}

function addGlowPoints(n, col, size, fn) {
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const p = fn(i); a[i*3] = p[0]; a[i*3+1] = p[1]; a[i*3+2] = p[2]; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3));
  const m = new THREE.Points(g, new THREE.PointsMaterial({color: col, size, sizeAttenuation: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false}));
  m.frustumCulled = false;
  W.group.add(m);
  return m;
}

function oceanMesh(size, seg, col, opacity) {
  const g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({color: col, roughness: 0.25, metalness: 0.5, envMap: ENV_MAP, envMapIntensity: 0.15, flatShading: true, transparent: opacity < 1, opacity}));
  W.group.add(m);
  return m;
}

function dressWater(tr) {
  W.terrainH = null; W.distTrack = null;
  const arctic = tr.style === 'arctic';
  const cell = 9, seg = 96, sea = oceanMesh(cell * seg, seg, arctic ? 0x0b4f80 : 0x0a5a9a, 1), p = sea.geometry.attributes.position;
  W.anim.push(() => {
    const cx = Math.round(raceCam.position.x / cell) * cell, cz = Math.round(raceCam.position.z / cell) * cell;
    sea.position.set(cx, 0, cz);
    for (let i = 0; i < p.count; i++) p.setY(i, CT.waveH(p.getX(i) + cx, p.getZ(i) + cz, W.t));
    p.needsUpdate = true;
  });
  const far = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshBasicMaterial({color: arctic ? 0x093f66 : 0x0a4f8a}));
  far.rotation.x = -Math.PI / 2; far.position.y = -1.6; W.group.add(far);
  // Buoys + lane ropes
  const buoys = [], half = tr.w / 2;
  for (let i = 0; i < tr.N; i += 3) for (const sg of [-1, 1]) buoys.push({x: tr.px[i] + tr.tz[i] * sg * half, y: 0.4, z: tr.pz[i] - tr.tx[i] * sg * half, c: (i / 3) % 2 ? 0xff3300 : 0xffffff});
  const bg = new THREE.ConeGeometry(0.7, 1.8, 8); bg.translate(0, 0.8, 0);
  const bm = inst(bg, lam(0xffffff), buoys);
  W.group.add(bm);
  W.buoys = bm;
  const rope = new Strips();
  for (const sg of [-1, 1]) rope.add(tr.N, i => trackPt(tr, i, sg * half + 0.15, 0.35), i => trackPt(tr, i, sg * half - 0.15, 0.35));
  W.railMesh = new THREE.Mesh(rope.build(), new THREE.MeshBasicMaterial({color: 0x00eeff, side: THREE.DoubleSide}));
  W.group.add(W.railMesh);
  if (arctic) { dressIcebergs(tr); return; }
  // Islands
  for (let k = 0; k < 9; k++) {
    const a = k / 9 * 6.283 + rand(-0.2, 0.2), r = k % 3 === 0 ? rand(20, 60) : rand(420, 700), s = rand(30, 70);
    const x = Math.cos(a) * r, z = Math.sin(a) * r * 0.75;
    if (W.distTrackSimple(tr, x, z) < half + s) continue;
    const isl = new THREE.Mesh(new THREE.ConeGeometry(s, s * 0.45, 9), lam(0xd9c27a, {flatShading: true})); isl.position.set(x, s * 0.1, z);
    const top = new THREE.Mesh(new THREE.ConeGeometry(s * 0.55, s * 0.5, 7), lam(0x2f8a3a, {flatShading: true})); top.position.set(x, s * 0.42, z);
    W.group.add(isl, top);
  }
}
W.distTrackSimple = (tr, x, z) => { let b = 1e9; for (let i = 0; i < tr.N; i += 2) { const d = Math.hypot(tr.px[i] - x, tr.pz[i] - z); if (d < b) b = d; } return b; };

function dressBeach(tr) {
  buildTerrain(tr, (x, z) => Math.max(-7, Math.min(16, (z + 40) * 0.045)) + noise2(x, z) * 2.2, (h, x, z, k) => k < 0.1 ? 0xb8a070 : h < 1.2 ? 0xe8d8a0 : h < 6 ? 0xdcc88a : 0x5a9a3a, 40);
  const sea = oceanMesh(3000, 60, 0x1a9ad0, 0.82), p = sea.geometry.attributes.position;
  sea.position.y = 0.2;
  W.anim.push(() => { sea.position.y = 0.2 + Math.sin(W.t * 0.8) * 0.25; });
  for (let i = 0; i < p.count; i++) p.setY(i, Math.sin(p.getX(i) * 0.05) * 0.3 + Math.cos(p.getZ(i) * 0.07) * 0.3);
  const palms = [], rocks = [];
  const add = (x, z) => { const y = W.terrainH(x, z); if (y > 0.8) palms.push({x, y: y - 0.2, z, s: rand(0.9, 1.5), ry: rand(0, 6), rz: rand(-0.12, 0.12)}); };
  roadside(tr, 4, 5, 12, add);
  scatter(90, 600, tr.w / 2 + 6, add);
  const tg = new THREE.CylinderGeometry(0.3, 0.5, 9, 6); tg.translate(0, 4.5, 0);
  const leaves = [];
  for (let k = 0; k < 7; k++) { const l = new THREE.ConeGeometry(0.9, 6, 4); l.rotateX(Math.PI / 2 + 0.45); l.translate(0, 0, 2.6); l.scale(1, 0.35, 1); l.rotateY(k / 7 * 6.283); l.translate(0, 9, 0); leaves.push(l); }
  W.group.add(inst(tg, lam(0x8a6a3a), palms));
  W.group.add(inst(mergeGeos(leaves), lam(0x2a9a3a, {flatShading: true}), palms));
  scatter(40, 600, tr.w / 2 + 5, (x, z) => rocks.push({x, y: W.terrainH(x, z), z, s: rand(0.8, 3), ry: rand(0, 6)}));
  W.group.add(inst(new THREE.DodecahedronGeometry(1.2, 0), lam(0x8a8478, {flatShading: true}), rocks));
}

function dressCave(tr, th) {
  buildTerrain(tr, (x, z) => 2 + noise2(x * 1.6, z * 1.6) * 6, (h, x, z, k) => k < 0.15 ? 0x2a2438 : 0x1a1626, 30, 1100, 80);
  // Tunnel shell following the road
  const N = tr.N, R = tr.w / 2 + 3.5, SEG = 8, shell = new Strips();
  const ring = (i, k) => {
    const a = Math.PI * k / SEG, lat = Math.cos(a) * R, up = Math.sin(a) * R * 0.95 + 0.5;
    const j = Math.sin(i * 12.9898 + k * 78.233) * 0.5 + 0.5, bump = k > 0 && k < SEG ? j * 2.2 : 0;
    const ii = ((i % N) + N) % N;
    return [tr.px[ii] + tr.tz[ii] * lat * (1 + bump * 0.05), tr.py[ii] + up + bump, tr.pz[ii] - tr.tx[ii] * lat * (1 + bump * 0.05)];
  };
  for (let k = 0; k < SEG; k++) shell.add(N, i => ring(i, k + 1), i => ring(i, k));
  W.group.add(new THREE.Mesh(shell.build(), new THREE.MeshLambertMaterial({color: 0x5a4f7a, flatShading: true})));
  // Crystals + stalactites
  const cry = [], stal = [], cols = [0x9900ff, 0x00ccff, 0xff00aa, 0x66ffcc];
  for (let i = 0; i < N; i += 2) {
    const sg = i % 4 ? 1 : -1, lat = sg * (tr.w / 2 + 1.6);
    cry.push({x: tr.px[i] + tr.tz[i] * lat, y: tr.py[i] + rand(0.6, 5), z: tr.pz[i] - tr.tx[i] * lat, sx: rand(0.3, 0.7), sy: rand(1, 2.6), sz: rand(0.3, 0.7), rx: rand(-0.6, 0.6), rz: rand(-0.6, 0.6), c: cols[(i / 8 | 0) % 4]});
    if (i % 3 === 0) { const l2 = rand(-R * 0.6, R * 0.6); stal.push({x: tr.px[i] + tr.tz[i] * l2, y: tr.py[i] + Math.sqrt(R * R - l2 * l2) * 0.95 + 0.3, z: tr.pz[i] - tr.tx[i] * l2, sx: rand(0.5, 1.2), sy: rand(1.5, 4.5), sz: rand(0.5, 1.2)}); }
  }
  W.group.add(inst(new THREE.OctahedronGeometry(1, 0), new THREE.MeshBasicMaterial({color: 0xffffff, fog: false}), cry));
  const sg2 = new THREE.ConeGeometry(0.8, 1, 5); sg2.rotateX(Math.PI); sg2.translate(0, -0.5, 0);
  W.group.add(inst(sg2, lam(0x3a3350, {flatShading: true}), stal));
  W.caveR = R;
}

function dressVolcano(tr) {
  buildTerrain(tr, (x, z) => { const d = Math.hypot(x, z); return Math.max(0, 95 - d * 0.42) * (d < 40 ? d / 40 * 0.8 + 0.2 : 1) + noise2(x * 1.4, z * 1.4) * 7 + 3; },
    (h, x, z, k) => k < 0.12 ? 0x3a2a26 : h < 5.5 ? 0x5a1a08 : h > 60 ? 0x4a3a36 : 0x241a18, 40);
  const lava = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshBasicMaterial({color: 0xff5a10, fog: true}));
  lava.rotation.x = -Math.PI / 2; lava.position.y = 4.2; W.group.add(lava);
  const crater = new THREE.Mesh(new THREE.CircleGeometry(34, 20), new THREE.MeshBasicMaterial({color: 0xffaa22, fog: false}));
  crater.rotation.x = -Math.PI / 2; crater.position.y = 30; W.group.add(crater);
  W.anim.push(() => { const k = 0.85 + 0.15 * Math.sin(W.t * 1.7); lava.material.color.setRGB(1 * k, 0.32 * k, 0.05); });
  const rocks = [], glow = [];
  scatter(120, 600, tr.w / 2 + 4, (x, z) => { const y = W.terrainH(x, z); if (y > 4.5) rocks.push({x, y, z, s: rand(1, 5), ry: rand(0, 6), rx: rand(0, 3)}); });
  W.group.add(inst(new THREE.DodecahedronGeometry(1.2, 0), lam(0x2a2220, {flatShading: true}), rocks));
  roadside(tr, 7, 2.5, 5, (x, z) => glow.push({x, y: W.terrainH(x, z) + 0.6, z, s: rand(0.5, 1.1), ry: rand(0, 6)}));
  W.group.add(inst(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshBasicMaterial({color: 0xff6a1a}), glow));
  W.ambient = {col: [1, 0.35, 0.05], rate: 50, vy: [3, 9], dy: [-12, 6], sx: 2, size: 1.2, life: 2.5, grav: -1};
}

function dressCyber(tr, th) {
  W.terrainH = null; W.distTrack = null;
  addGridFloor(-30, 0x00aaff, 0x0a2a55);
  addThrusters(tr, 0x00ccff);
  const mono = [], edges = [];
  for (let k = 0; k < 70; k++) {
    const x = rand(-700, 700), z = rand(-600, 600);
    if (W.distTrackSimple(tr, x, z) < tr.w / 2 + 25) continue;
    const h = rand(30, 160), w = rand(8, 26);
    mono.push({x, y: -30 + h / 2, z, sx: w, sy: h, sz: w, c: 0x06102a});
    edges.push({x, y: -30 + h, z, sx: w * 1.02, sy: 0.6, sz: w * 1.02, c: [0x00aaff, 0xff00ff, 0x00ffcc][k % 3]});
  }
  W.group.add(inst(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({color: 0xffffff, metalness: 0.8, roughness: 0.3, envMap: ENV_MAP}), mono));
  W.group.add(inst(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({color: 0xffffff}), edges));
  // Holo rings over the road
  const rings = [];
  for (let i = 0; i < tr.N; i += 26) { const r = new THREE.Mesh(new THREE.TorusGeometry(tr.w / 2 + 4, 0.35, 6, 40), W.edgeMat); frameAt(i / tr.N, 0, r, 3); W.group.add(r); rings.push(r); }
}

function dressHouse(tr) {
  W.terrainH = () => 0; W.distTrack = (x, z) => W.distTrackSimple(tr, x, z);
  const G = W.group;
  const ft = TEX.planks.clone(); ft.needsUpdate = true; ft.repeat.set(10, 10);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1000), new THREE.MeshStandardMaterial({map: ft, roughness: 0.55, metalness: 0.05, envMap: ENV_MAP, envMapIntensity: 0.3}));
  floor.rotation.x = -Math.PI / 2; G.add(floor);
  const wallM = lam(0xe8dcc0), base = lam(0xffffff);
  for (const [x, z, ry, len] of [[0, -500, 0, 1200], [0, 500, Math.PI, 1200], [-600, 0, Math.PI / 2, 1000], [600, 0, -Math.PI / 2, 1000]]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(len, 420), wallM); w.position.set(x, 210, z); w.rotation.y = ry; G.add(w);
    const b = new THREE.Mesh(new THREE.BoxGeometry(len, 14, 3), base); b.position.set(x, 7, z); b.rotation.y = ry; G.add(b);
  }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1000), lam(0xf4f0e8)); ceil.rotation.x = Math.PI / 2; ceil.position.y = 420; G.add(ceil);
  // Rug
  const rug = new THREE.Mesh(new THREE.CircleGeometry(190, 40), lam(0x8a2a3a)); rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.15, 0); G.add(rug);
  const rug2 = new THREE.Mesh(new THREE.RingGeometry(150, 165, 40), lam(0xe8c070)); rug2.rotation.x = -Math.PI / 2; rug2.position.set(0, 0.25, 0); G.add(rug2);
  // Giant table over the middle
  const wood = new THREE.MeshStandardMaterial({color: 0x6a4424, roughness: 0.5, metalness: 0.1, envMap: ENV_MAP, envMapIntensity: 0.3});
  const top = new THREE.Mesh(new THREE.BoxGeometry(200, 8, 130), wood); top.position.set(0, 96, 0); G.add(top);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(5, 4, 92, 10), wood); l.position.set(sx * 88, 46, sz * 54); G.add(l); }
  // Sofa
  const sofa = lam(0x3a5a8a);
  for (const [w, h, d, x, y, z] of [[260, 40, 90, -360, 20, -380], [260, 70, 24, -360, 75, -420], [24, 60, 90, -490, 50, -380], [24, 60, 90, -230, 50, -380]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), sofa); m.position.set(x, y, z); G.add(m);
  }
  // Toy blocks + book supports under the raised section
  const blocks = [], cols = [0xff3344, 0x33aaff, 0xffcc00, 0x44cc66, 0xff7722, 0xaa55ee];
  scatter(46, 430, tr.w / 2 + 6, (x, z) => { const s = rand(6, 13); blocks.push({x, y: s / 2, z, s, ry: rand(0, 3), c: cols[Math.random() * 6 | 0]}); });
  G.add(inst(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({color: 0xffffff, roughness: 0.4, envMap: ENV_MAP, envMapIntensity: 0.4}), blocks));
  const books = [];
  for (let i = 0; i < tr.N; i += 5) {
    const top = tr.py[i] - 1.2, n = Math.floor(top / 2.2);
    for (let k = 0; k < n; k++) books.push({x: tr.px[i], y: 1.1 + k * 2.2, z: tr.pz[i], sx: tr.w + rand(2, 6), sy: 2.1, sz: rand(11, 15), ry: tr.ang[i] + rand(-0.2, 0.2), c: cols[(i + k) % 6]});
  }
  if (books.length) G.add(inst(new THREE.BoxGeometry(1, 1, 1), lam(0xffffff), books));
  // Lamp
  const lamp = new THREE.Mesh(new THREE.ConeGeometry(60, 50, 16, 1, true), new THREE.MeshBasicMaterial({color: 0xfff0c0, side: THREE.DoubleSide})); lamp.position.set(0, 380, 0); G.add(lamp);
}

function dressCity(tr, th) {
  W.terrainH = () => 0; W.distTrack = (x, z) => W.distTrackSimple(tr, x, z);
  const neon = tr.style === 'neon', G = W.group;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshStandardMaterial({color: 0x08080c, roughness: 0.35, metalness: 0.6, envMap: ENV_MAP, envMapIntensity: 0.5}));
  ground.rotation.x = -Math.PI / 2; G.add(ground);
  const gh = new THREE.GridHelper(3000, 50, neon ? 0xff00aa : 0xff8800, neon ? 0x331133 : 0x332211); gh.position.y = 0.1; gh.material.transparent = true; gh.material.opacity = 0.5; G.add(gh);
  addPillars(tr, 0, 7, 0x2a2c36);
  const b = [], caps = [], cols = neon ? [0xff00aa, 0x00ffee, 0xaa44ff, 0xffee00] : [0xff8800, 0xffcc66, 0x66aaff];
  for (let gx = -11; gx <= 11; gx++) for (let gz = -9; gz <= 9; gz++) {
    const x = gx * 60 + rand(-8, 8), z = gz * 60 + rand(-8, 8);
    if (W.distTrack(x, z) < tr.w / 2 + 28) continue;
    const w = rand(22, 40), d = rand(22, 40), h = rand(40, 190) * (Math.random() < 0.15 ? 1.6 : 1);
    b.push({x, y: h / 2, z, sx: w, sy: h, sz: d});
    caps.push({x, y: h + 0.6, z, sx: w * 1.02, sy: 1.2, sz: d * 1.02, c: cols[Math.random() * cols.length | 0]});
  }
  const wt = TEX.windows.clone(); wt.needsUpdate = true; wt.repeat.set(2, 4);
  G.add(inst(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({color: 0x222230, emissive: 0xffffff, emissiveMap: wt, emissiveIntensity: neon ? 1.3 : 0.9, roughness: 0.4, metalness: 0.5}), b));
  G.add(inst(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({color: 0xffffff}), caps));
  if (neon) addThrusters(tr, 0xff00aa);
}

function addFlightRings(tr) {
  const G = W.group, N = tr.N, R = tr.w / 2;
  const ringG = new THREE.TorusGeometry(R, 0.5, 6, 36);
  for (let i = 8; i < N; i += 8) { const r = new THREE.Mesh(ringG, W.edgeMat); frameAt(i / N, 0, r); G.add(r); }
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + Math.PI / 4, pts = [];
    for (let i = 0; i <= N; i++) { const j = i % N; pts.push(new THREE.Vector3(tr.px[j] + tr.tz[j] * Math.cos(a) * R, tr.py[j] + Math.sin(a) * R, tr.pz[j] - tr.tx[j] * Math.cos(a) * R)); }
    G.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({color: 0xffffff, transparent: true, opacity: 0.35})));
  }
}

function dressSky(tr) {
  W.terrainH = null; W.distTrack = null;
  const G = W.group, R = tr.w / 2;
  addFlightRings(tr);
  // Clouds
  const puffs = [];
  const cloud = (x, y, z, s) => { for (let k = 0; k < 6; k++) puffs.push({x: x + rand(-s, s) * 1.6, y: y + rand(-s, s) * 0.3, z: z + rand(-s, s) * 1.2, sx: rand(0.6, 1.3) * s, sy: rand(0.35, 0.6) * s, sz: rand(0.6, 1.2) * s}); };
  for (let k = 0; k < 90; k++) cloud(rand(-900, 900), rand(20, 60), rand(-800, 800), rand(22, 50));
  for (let k = 0; k < 40; k++) cloud(rand(-700, 700), rand(90, 170), rand(-600, 600), rand(8, 18));
  for (let k = 0; k < 30; k++) cloud(rand(-900, 900), rand(230, 320), rand(-800, 800), rand(20, 40));
  G.add(inst(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({color: 0xffffff, flatShading: true, emissive: 0x8899aa, emissiveIntensity: 0.35}), puffs));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshBasicMaterial({color: 0xdfeeff})); floor.rotation.x = -Math.PI / 2; floor.position.y = 8; G.add(floor);
  // Floating islands
  for (let k = 0; k < 10; k++) {
    const x = rand(-600, 600), z = rand(-500, 500), y = rand(70, 170), s = rand(18, 40);
    if (W.distTrackSimple(tr, x, z) < R + s + 10) continue;
    const rock = new THREE.Mesh(new THREE.ConeGeometry(s, s * 1.3, 7), lam(0x7a6a5a, {flatShading: true})); rock.rotation.x = Math.PI; rock.position.set(x, y - s * 0.65, z);
    const grass = new THREE.Mesh(new THREE.CylinderGeometry(s, s, 2, 7), lam(0x4aa040, {flatShading: true})); grass.position.set(x, y + 1, z);
    G.add(rock, grass);
  }
}


function dressIcebergs(tr) {
  const half = tr.w / 2, bergs = [], tops = [], floes = [];
  for (let k = 0; k < 46; k++) {
    const a = rand(0, 6.283), r = rand(40, 760), x = Math.cos(a) * r * 1.1, z = Math.sin(a) * r * 0.85, s = rand(14, 52);
    if (W.distTrackSimple(tr, x, z) < half + s * 0.9 + 6) continue;
    const sy = s * rand(0.5, 1.2);
    bergs.push({x, y: sy * 0.25, z, sx: s, sy, sz: s * rand(0.7, 1.3), ry: rand(0, 6), rx: rand(-0.12, 0.12), rz: rand(-0.12, 0.12)});
    tops.push({x, y: sy * 0.25 + sy * 0.85, z, sx: s * 0.45, sy: sy * 0.8, sz: s * 0.4, ry: rand(0, 6)});
  }
  const ig = new THREE.IcosahedronGeometry(1, 1);
  W.group.add(inst(ig, new THREE.MeshStandardMaterial({color: 0xcdeeff, roughness: 0.25, metalness: 0.15, envMap: ENV_MAP, envMapIntensity: 0.6, flatShading: true, transparent: true, opacity: 0.94}), bergs));
  W.group.add(inst(new THREE.OctahedronGeometry(1, 0), lam(0xffffff, {flatShading: true}), tops));
  for (let i = 0; i < tr.N; i += 2) for (const sg of [-1, 1]) if (Math.random() < 0.55) {
    const lat = sg * (half + rand(4, 26));
    floes.push({x: tr.px[i] + tr.tz[i] * lat, y: 0.2, z: tr.pz[i] - tr.tx[i] * lat, sx: rand(2, 6), sy: 0.6, sz: rand(2, 6), ry: rand(0, 6)});
  }
  W.group.add(inst(new THREE.CylinderGeometry(1, 1, 1, 7), lam(0xeaf6ff, {flatShading: true}), floes));
  // aurora curtains
  const at = canvasTex(256, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, h, 0, 0);
    gr.addColorStop(0, 'rgba(60,255,160,0)'); gr.addColorStop(0.25, 'rgba(60,255,160,0.85)'); gr.addColorStop(0.7, 'rgba(120,90,255,0.45)'); gr.addColorStop(1, 'rgba(120,90,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'destination-out';
    for (let x = 0; x < w; x += 4) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.5})`; g.fillRect(x, 0, 3, h); }
  });
  const am = new THREE.MeshBasicMaterial({map: at, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false});
  for (let k = 0; k < 4; k++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(900, 260, 1, 1), am);
    const a = k * 1.7 + 0.4; m.position.set(Math.cos(a) * 1100, 230, Math.sin(a) * 1100); m.lookAt(0, 150, 0); W.group.add(m);
    W.anim.push(() => { m.scale.y = 1 + 0.18 * Math.sin(W.t * 0.7 + k); });
  }
  W.stars.visible = true;
}

function dressDesert(tr) {
  buildTerrain(tr, (x, z) => 6 + noise2(x * 1.1, z * 1.1) * 9 + Math.sin(x * 0.03 + Math.sin(z * 0.02) * 2) * 3, (h, x, z, k) => k < 0.12 ? 0x9a7a4c : (Math.sin(x * 0.045 + z * 0.02) > 0.3 ? 0xd9a65a : h > 12 ? 0xe3b66f : 0xc98f48), 50);
  const mesa = [], band = [], cactus = [], rocks = [];
  scatter(16, 650, tr.w / 2 + 40, (x, z) => { const h = rand(28, 70), r = rand(10, 22); mesa.push({x, y: W.terrainH(x, z) + h / 2 - 2, z, sx: r, sy: h, sz: r * rand(0.8, 1.3), ry: rand(0, 6), c: 0xb5602f}); band.push({x, y: W.terrainH(x, z) + h * 0.35, z, sx: r * 1.03, sy: h * 0.18, sz: r * 1.03, ry: 0, c: 0xe0a070}); });
  const mg = new THREE.CylinderGeometry(0.8, 1, 1, 8);
  W.group.add(inst(mg, lam(0xffffff, {flatShading: true}), mesa));
  W.group.add(inst(mg, lam(0xffffff, {flatShading: true}), band));
  const cg = mergeGeos([gBox(0.6, 4, 0.6, 0, 2, 0), gBox(0.5, 0.5, 1.4, 0.7, 2, 0), gBox(0.5, 1.6, 0.5, 1.3, 2.8, 0), gBox(0.5, 0.5, 1.4, -0.7, 1.4, 0), gBox(0.5, 1.4, 0.5, -1.3, 2.1, 0)]);
  roadside(tr, 3, 4, 26, (x, z) => cactus.push({x, y: W.terrainH(x, z), z, s: rand(0.7, 1.5), ry: rand(0, 6)}));
  scatter(60, 600, tr.w / 2 + 8, (x, z) => cactus.push({x, y: W.terrainH(x, z), z, s: rand(0.8, 1.7), ry: rand(0, 6)}));
  W.group.add(inst(cg, lam(0x3f7a3a, {flatShading: true}), cactus));
  scatter(120, 650, tr.w / 2 + 3, (x, z) => rocks.push({x, y: W.terrainH(x, z) + 0.3, z, s: rand(0.8, 3.5), ry: rand(0, 6), rx: rand(0, 3), c: Math.random() < 0.5 ? 0xa86a3a : 0x8a5a38}));
  W.group.add(inst(new THREE.DodecahedronGeometry(1.2, 0), lam(0xffffff, {flatShading: true}), rocks));
  for (let k = 0; k < 4; k++) scatter(1, 550, tr.w / 2 + 50, (x, z) => {
    const y = W.terrainH(x, z), t = new THREE.Mesh(new THREE.TorusGeometry(15, 5, 6, 12, Math.PI), lam(0xc0703a, {flatShading: true}));
    t.position.set(x, y - 1, z); t.rotation.y = rand(0, 3); W.group.add(t);
    for (const sx of [-1, 1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(5, 6.5, 8, 7), lam(0xb0622f, {flatShading: true})); l.position.set(sx * 15, 3, 0); t.add(l); }
  });
  W.ambient = {col: [0.9, 0.72, 0.45], rate: 18, vy: [0.2, 1.2], dy: [-8, 4], sx: 7, size: 2.2, life: 1.8, grav: 0};
}

function dressSnow(tr) {
  buildTerrain(tr, (x, z) => 14 + noise2(x * 1.3, z * 1.3) * 17 + Math.abs(Math.sin(x * 0.008) * Math.cos(z * 0.01)) * 16, (h, x, z, k) => k < 0.1 ? 0x98a4b4 : h > 34 ? 0xffffff : h > 20 ? 0xeaf2fb : 0xd2e2f4, 45);
  const trees = [], rocks = [], caps = [], men = [];
  roadside(tr, 2, 5, 18, (x, z) => trees.push({x, y: W.terrainH(x, z) - 0.2, z, s: rand(0.8, 1.4), ry: rand(0, 6)}));
  scatter(360, 620, tr.w / 2 + 10, (x, z) => trees.push({x, y: W.terrainH(x, z) - 0.2, z, s: rand(1, 2.3), ry: rand(0, 6)}));
  addTrees(trees, 0x3a2614, [0x1c4a3a, 0x24584a, 0x16403a]);
  const cg = new THREE.ConeGeometry(2.1, 5, 7); cg.translate(0, 12.2, 0);
  W.group.add(inst(cg, lam(0xffffff, {flatShading: true}), trees));
  scatter(70, 560, tr.w / 2 + 4, (x, z) => rocks.push({x, y: W.terrainH(x, z), z, s: rand(1, 4), ry: rand(0, 6), rx: rand(0, 3)}));
  W.group.add(inst(new THREE.DodecahedronGeometry(1.2, 0), lam(0x6a7078, {flatShading: true}), rocks));
  const sm = mergeGeos([place(new THREE.SphereGeometry(1, 10, 8), 0, 1, 0), place(new THREE.SphereGeometry(0.75, 10, 8), 0, 2.3, 0), place(new THREE.SphereGeometry(0.5, 10, 8), 0, 3.3, 0)]);
  roadside(tr, 18, 3.5, 9, (x, z) => men.push({x, y: W.terrainH(x, z) - 0.2, z, s: rand(0.8, 1.2), ry: rand(0, 6)}));
  W.group.add(inst(sm, lam(0xffffff), men));
  W.group.add(inst(place(new THREE.ConeGeometry(0.1, 0.8, 5), 0, 3.3, 0.6, Math.PI / 2), lam(0xff7a1a), men));
  W.group.add(inst(place(new THREE.BoxGeometry(0.6, 0.5, 0.6), 0, 3.95, 0), lam(0x222222), men));
  W.ambient = {col: [1, 1, 1], rate: 160, vy: [-4.5, -2.5], dy: [4, 22], sx: 0.8, size: 0.9, life: 4, grav: 0};
}

function moonCraters() {
  const cr = [];
  for (let k = 0; k < 34; k++) cr.push({x: rand(-650, 650), z: rand(-600, 600), r: rand(14, 70)});
  return cr;
}

function dressMoon(tr) {
  const cr = moonCraters();
  const base = (x, z) => {
    let h = 6 + noise2(x * 1.4, z * 1.4) * 2.6;
    for (const c of cr) { const d = Math.hypot(x - c.x, z - c.z) / c.r; if (d < 1.35) h -= (d < 1 ? (1 - d * d) * 6 : 0) - (d > 0.9 ? Math.max(0, 1 - Math.abs(d - 1) * 5) * 2.5 : 0); }
    return h;
  };
  buildTerrain(tr, base, (h, x, z, k) => k < 0.12 ? 0x5c5c64 : (noise2(x * 3, z * 3) > 0.4 ? 0xa4a4ac : h < 4 ? 0x6a6a72 : 0x8a8a92), 40);
  const ec = canvasTex(256, 256, (g, w) => {
    g.fillStyle = '#1b5fb0'; g.fillRect(0, 0, w, w);
    g.fillStyle = '#3a9a4a';
    for (let i = 0; i < 26; i++) { g.beginPath(); g.ellipse(Math.random() * w, Math.random() * w, 14 + Math.random() * 38, 8 + Math.random() * 22, Math.random() * 3, 0, 6.3); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 20; i++) { g.beginPath(); g.ellipse(Math.random() * w, Math.random() * w, 20 + Math.random() * 40, 4 + Math.random() * 8, Math.random() * 3, 0, 6.3); g.fill(); }
  });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(130, 32, 20), new THREE.MeshBasicMaterial({map: ec, fog: false}));
  earth.position.set(700, 460, -1300); W.group.add(earth);
  W.anim.push(dt => { earth.rotation.y += dt * 0.03; });
  const halo = new THREE.Mesh(new THREE.SphereGeometry(138, 24, 16), new THREE.MeshBasicMaterial({color: 0x66aaff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.BackSide}));
  halo.position.copy(earth.position); W.group.add(halo);
  // habitat domes
  const glass = new THREE.MeshStandardMaterial({color: 0x88ccff, transparent: true, opacity: 0.22, metalness: 0.9, roughness: 0.05, envMap: ENV_MAP, side: THREE.DoubleSide, depthWrite: false});
  for (let k = 0; k < 6; k++) scatter(1, 520, tr.w / 2 + 50, (x, z) => {
    const y = W.terrainH(x, z), r = rand(16, 30), d = new THREE.Group();
    d.add(new THREE.Mesh(new THREE.SphereGeometry(r, 18, 10, 0, 6.283, 0, Math.PI / 2), glass));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.9, 6, 24), lam(0xe0e0e8)); ring.rotation.x = Math.PI / 2; d.add(ring);
    for (let j = 0; j < 4; j++) { const b = new THREE.Mesh(new THREE.BoxGeometry(rand(3, 6), rand(3, 8), rand(3, 6)), lam(0xcfd2da)); b.position.set(rand(-r * 0.5, r * 0.5), 2, rand(-r * 0.5, r * 0.5)); d.add(b); }
    d.position.set(x, y, z); W.group.add(d);
  });
  // radio masts + landing beacons
  const mast = [], beacon = [];
  scatter(14, 520, tr.w / 2 + 14, (x, z) => { const y = W.terrainH(x, z); mast.push({x, y: y + 12, z, sx: 0.5, sy: 24, sz: 0.5}); beacon.push({x, y: y + 24.5, z, s: 1.1}); });
  W.group.add(inst(new THREE.BoxGeometry(1, 1, 1), lam(0xcccccc), mast));
  W.group.add(inst(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicMaterial({color: 0xff2233}), beacon));
  const rocks = [];
  scatter(150, 650, tr.w / 2 + 3, (x, z) => rocks.push({x, y: W.terrainH(x, z) + 0.3, z, s: rand(0.7, 3.6), ry: rand(0, 6), rx: rand(0, 3)}));
  W.group.add(inst(new THREE.DodecahedronGeometry(1.2, 0), lam(0x77777f, {flatShading: true}), rocks));
  roadside(tr, 9, 3, 4, (x, z) => { const y = W.terrainH(x, z); const m = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.4, 6), new THREE.MeshBasicMaterial({color: 0x66ffcc})); m.position.set(x, y + 0.7, z); W.group.add(m); });
}

function dressCandy(tr) {
  buildTerrain(tr, (x, z) => 4 + Math.abs(noise2(x * 1.2, z * 1.2)) * 9, (h, x, z, k) => k < 0.1 ? 0xc486a6 : (Math.floor(x / 40) + Math.floor(z / 40)) % 3 === 0 ? 0xff9ad0 : (Math.floor(x / 40) + Math.floor(z / 40)) % 3 === 1 ? 0x9af0d0 : 0xffe08a, 40);
  const swirl = canvasTex(128, 128, (g, w) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, w);
    g.translate(w / 2, w / 2);
    for (let k = 0; k < 8; k++) { g.fillStyle = '#ff3d88'; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, w, k * 0.785, k * 0.785 + 0.39); g.closePath(); g.fill(); }
  });
  const pops = [], sticks = [], drops = [], canes = [];
  const lcols = [0xffffff, 0xffe066, 0x66ddff, 0xb388ff, 0xff9966];
  const add = (x, z) => { const y = W.terrainH(x, z), h = rand(9, 22), r = rand(3, 7); sticks.push({x, y: y + h / 2, z, sx: 0.5, sy: h, sz: 0.5}); pops.push({x, y: y + h, z, s: r, ry: rand(0, 6), rx: rand(-0.4, 0.4), c: lcols[Math.random() * 5 | 0]}); };
  roadside(tr, 3, 6, 24, add); scatter(70, 620, tr.w / 2 + 10, add);
  const disc = new THREE.CylinderGeometry(1, 1, 0.25, 20); disc.rotateX(Math.PI / 2);
  W.group.add(inst(disc, new THREE.MeshLambertMaterial({map: swirl}), pops));
  W.group.add(inst(new THREE.BoxGeometry(1, 1, 1), lam(0xffffff), sticks));
  const gcols = [0xff4d6d, 0x4dd2ff, 0xffd23f, 0x7bed9f, 0xc77dff];
  scatter(110, 650, tr.w / 2 + 6, (x, z) => { const r = rand(2.5, 8); drops.push({x, y: W.terrainH(x, z) - r * 0.2, z, sx: r, sy: r * 0.8, sz: r, c: gcols[Math.random() * 5 | 0]}); });
  const hs = new THREE.SphereGeometry(1, 12, 8, 0, 6.283, 0, Math.PI / 2);
  W.group.add(inst(hs, new THREE.MeshLambertMaterial({color: 0xffffff}), drops));
  const stripe = canvasTex(32, 64, (g, w, h) => { for (let y = 0; y < 8; y++) { g.fillStyle = y % 2 ? '#ff2d55' : '#ffffff'; g.fillRect(0, y * 8, w, 8); } }, true);
  const cane = mergeGeos([place(new THREE.CylinderGeometry(0.45, 0.45, 4, 10), 0, 2, 0), (() => { const t = new THREE.TorusGeometry(1, 0.45, 8, 14, Math.PI); t.translate(1, 4, 0); return t; })()]);
  roadside(tr, 5, 3.2, 5, (x, z) => canes.push({x, y: W.terrainH(x, z), z, s: rand(0.9, 1.5), ry: rand(0, 6)}));
  W.group.add(inst(cane, new THREE.MeshLambertMaterial({map: stripe}), canes));
  const puffs = [];
  for (let k = 0; k < 30; k++) { const x = rand(-800, 800), z = rand(-800, 800), y = rand(70, 150), s = rand(20, 45); for (let j = 0; j < 5; j++) puffs.push({x: x + rand(-s, s), y: y + rand(-4, 4), z: z + rand(-s, s), s: rand(0.5, 1) * s * 0.7, c: Math.random() < 0.5 ? 0xffc8e6 : 0xc8e8ff}); }
  W.group.add(inst(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({emissive: 0x442244, emissiveIntensity: 0.3}), puffs));
  W.ambient = {col: [1, 0.7, 0.9], rate: 30, vy: [-2, 0.5], dy: [2, 14], sx: 1.2, size: 1, life: 3, grav: 0};
}

function dressCanyon(tr) {
  W.terrainH = null; W.distTrack = null;
  const G = W.group;
  addFlightRings(tr);
  const g = new THREE.PlaneGeometry(3400, 3400, 130, 130); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), h = noise2(x * 1.3, z * 1.3) * 7 + Math.abs(Math.sin(x * 0.012) * Math.sin(z * 0.009)) * 26;
    p.setY(i, h);
    c.setHex(Math.sin(x * 0.03 + z * 0.01) > 0.4 ? 0xc67a40 : h > 18 ? 0xb5602f : 0xd9a05a);
    const j = 0.9 + Math.random() * 0.2; col[i * 3] = c.r * j; col[i * 3 + 1] = c.g * j; col[i * 3 + 2] = c.b * j;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  G.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({vertexColors: true, flatShading: true})));
  const spires = [], caps = [];
  const R = tr.w / 2;
  for (let k = 0; k < 130; k++) {
    const x = rand(-1000, 1000), z = rand(-900, 900);
    if (W.distTrackSimple(tr, x, z) < R + 26) continue;
    const h = rand(60, 230), r = rand(8, 26);
    spires.push({x, y: h / 2 - 4, z, sx: r, sy: h, sz: r * rand(0.8, 1.3), ry: rand(0, 6), c: k % 3 ? 0xb5602f : 0xa04e28});
    caps.push({x, y: h - 4, z, sx: r * 0.86, sy: 4, sz: r * 0.9, ry: 0, c: 0xe0a56c});
  }
  const sg = new THREE.CylinderGeometry(0.7, 1, 1, 8);
  G.add(inst(sg, lam(0xffffff, {flatShading: true}), spires));
  G.add(inst(new THREE.CylinderGeometry(1, 1, 1, 8), lam(0xffffff, {flatShading: true}), caps));
  const arches = [];
  for (let k = 0; k < 5; k++) {
    const x = rand(-700, 700), z = rand(-600, 600);
    if (W.distTrackSimple(tr, x, z) < R + 80) continue;
    const t = new THREE.Mesh(new THREE.TorusGeometry(46, 14, 6, 14, Math.PI), lam(0xc0703a, {flatShading: true}));
    t.position.set(x, 0, z); t.rotation.y = rand(0, 3); G.add(t);
  }
  const puffs = [];
  for (let k = 0; k < 40; k++) { const x = rand(-900, 900), z = rand(-800, 800), y = rand(260, 360), s = rand(18, 36); for (let j = 0; j < 5; j++) puffs.push({x: x + rand(-s, s) * 1.5, y: y + rand(-3, 3), z: z + rand(-s, s), sx: rand(0.6, 1.2) * s, sy: rand(0.3, 0.5) * s, sz: rand(0.6, 1.1) * s}); }
  G.add(inst(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({color: 0xffffff, flatShading: true, emissive: 0x998877, emissiveIntensity: 0.3}), puffs));
}

function dressHelix(tr) {
  W.terrainH = null; W.distTrack = null;
  addGridFloor(-40, 0xcc00ff, 0x2a0a44);
  addThrusters(tr, 0xcc00ff);
  // DNA strands twisting around the crossing and at the lobes
  const beads = [], rungs = [];
  for (const [cx, cz] of [[0, 0], [330, 0], [-330, 0], [0, 260], [0, -260]]) {
    for (let k = 0; k < 60; k++) {
      const a = k * 0.32, y = -40 + k * 3.2, r = 16;
      beads.push({x: cx + Math.cos(a) * r, y, z: cz + Math.sin(a) * r, s: 2, c: 0xff00ff});
      beads.push({x: cx - Math.cos(a) * r, y, z: cz - Math.sin(a) * r, s: 2, c: 0x00ffee});
      if (k % 2 === 0) rungs.push({x: cx, y, z: cz, sx: r * 2, sy: 0.5, sz: 0.5, ry: -a});
    }
  }
  W.group.add(inst(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({color: 0xffffff}), beads));
  W.group.add(inst(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({color: 0x8844cc}), rungs));
}

// ── 3D spectators ────────────────────────────────────────────────────
let _humanGeo = null;
function humanGeos() {
  if (_humanGeo) return _humanGeo;
  const box = (w, h, d, x, y, z, rx, ry, rz) => gBox(w, h, d, x, y, z, rx, ry, rz);
  const make = up => {
    const shirt = [box(0.42, 0.55, 0.24, 0, 0.78, 0)], skin = [], hair = [];
    const legs = [];
    for (const sx of [-1, 1]) {
      legs.push(box(0.16, 0.15, 0.46, sx * 0.11, 0.5, 0.2), box(0.15, 0.5, 0.15, sx * 0.11, 0.25, 0.43));
      if (up) {
        shirt.push(box(0.11, 0.5, 0.12, sx * 0.3, 1.25, 0.02, 0, 0, -sx * 0.3));
        skin.push(place(new THREE.TetrahedronGeometry(0.09, 0), sx * 0.4, 1.52, 0.02));
      } else {
        shirt.push(box(0.11, 0.5, 0.12, sx * 0.27, 0.78, 0.02));
        skin.push(place(new THREE.TetrahedronGeometry(0.08, 0), sx * 0.27, 0.5, 0.05));
      }
    }
    skin.push(place(new THREE.IcosahedronGeometry(0.13, 0), 0, 1.17, 0.02));
    hair.push(box(0.27, 0.09, 0.27, 0, 1.28, 0.0));
    return {shirt: mergeGeos(shirt), pants: mergeGeos(legs), skin: mergeGeos(skin), hair: mergeGeos(hair)};
  };
  return (_humanGeo = [make(false), make(true)]);
}

function crowdMat() {
  const m = new THREE.MeshLambertMaterial({color: 0xffffff});
  W.crowdT = W.crowdT || {value: 0};
  m.onBeforeCompile = sh => {
    sh.uniforms.uT = W.crowdT;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uT;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      float h = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
      float wave = max(0.0, sin(uT * 3.2 - (instanceMatrix[3].x + instanceMatrix[3].z) * 0.045));
      transformed.y += (h > 0.5 ? 0.2 : 0.0) * wave + (h > 0.82 ? 0.07 : 0.0) * max(0.0, sin(uT * 8.0 + h * 40.0));`);
  };
  return m;
}

function dressStadium(tr) {
  buildTerrain(tr, () => 3.2, (h, x, z, k) => k < 0.1 ? 0x555560 : (Math.floor((x + 2000) / 24) + Math.floor((z + 2000) / 24)) % 2 ? 0x2f8a34 : 0x379a3c, 12, 1300, 70);
  const N = tr.N, half = tr.w / 2;
  const out = (tr.tz[0] * tr.px[0] - tr.tx[0] * tr.pz[0]) > 0 ? 1 : -1;
  const ROWS = 12, O0 = 12, DO = 2.8, H0 = 4, DH = 2.1;
  const at = (i, off, h) => { const j = ((i % N) + N) % N, lat = out * (half + off); return [tr.px[j] + tr.tz[j] * lat, 3.2 + h, tr.pz[j] - tr.tx[j] * lat]; };

  // concrete tiers
  const tread = new Strips(), riser = new Strips();
  const add = (st, a, b) => { if (out > 0) st.add(N, a, b); else st.add(N, b, a); };
  for (let r = 0; r < ROWS; r++) {
    add(tread, i => at(i, O0 + r * DO, H0 + r * DH), i => at(i, O0 + (r + 1) * DO, H0 + r * DH));
    add(riser, i => at(i, O0 + (r + 1) * DO, H0 + r * DH), i => at(i, O0 + (r + 1) * DO, H0 + (r + 1) * DH));
  }
  const conc = new THREE.MeshLambertMaterial({color: 0x8a8d96, side: THREE.DoubleSide});
  W.group.add(new THREE.Mesh(tread.build(), conc), new THREE.Mesh(riser.build(), new THREE.MeshLambertMaterial({color: 0x6e717a, side: THREE.DoubleSide})));
  const back = new Strips();
  add(back, i => at(i, O0 + ROWS * DO, H0 + ROWS * DH), i => at(i, O0 + ROWS * DO + 1, 0));
  W.group.add(new THREE.Mesh(back.build(), new THREE.MeshLambertMaterial({color: 0x30323c, side: THREE.DoubleSide})));
  const front = new Strips();
  add(front, i => at(i, O0, H0 + 1.2), i => at(i, O0, 0));
  W.group.add(new THREE.Mesh(front.build(), new THREE.MeshLambertMaterial({color: 0xcc2233, side: THREE.DoubleSide})));

  // spectators
  const shirts = [0xe53935, 0x1e88e5, 0xfdd835, 0x43a047, 0xfb8c00, 0x8e24aa, 0xffffff, 0x212121, 0x00acc1, 0xd81b60, 0xff7043, 0x3949ab];
  const pantsC = [0x1c2233, 0x2b3a55, 0x111111, 0x6b5b3a, 0x3a3a3a, 0x4a5a6a];
  const skinC = [0xf1c8a2, 0xe0ac86, 0xc68642, 0x8d5524, 0x5c3a21, 0xffdbb0];
  const hairC = [0x1a1008, 0x3b2314, 0x7a4b25, 0xc9a24b, 0x888888, 0xaa2200, 0x0a0a0a];
  const pick = a => a[Math.random() * a.length | 0];
  const groups = [{shirt: [], pants: [], skin: [], hair: []}, {shirt: [], pants: [], skin: [], hair: []}];
  const STEP = 3;
  for (let r = 0; r < ROWS; r++) {
    const off = O0 + (r + 0.5) * DO, h = H0 + r * DH + 0.02;
    for (let i = 0; i < N; i++) for (let t = 0; t < STEP; t++) {
      if (Math.random() < 0.3) continue;
      const u = i + (t + Math.random() * 0.5) / STEP, i0 = ((Math.floor(u) % N) + N) % N, i1 = (i0 + 1) % N, f = u - Math.floor(u);
      const lat = out * (half + off + rand(-0.15, 0.15));
      const x = tr.px[i0] + (tr.px[i1] - tr.px[i0]) * f + tr.tz[i0] * lat, z = tr.pz[i0] + (tr.pz[i1] - tr.pz[i0]) * f - tr.tx[i0] * lat;
      const ry = Math.atan2(-out * tr.tz[i0], out * tr.tx[i0]) + rand(-0.25, 0.25), s = rand(0.92, 1.12);
      const gp = groups[Math.random() < 0.4 ? 1 : 0], y = 3.2 + h;
      const it = (c) => ({x, y, z, ry, s, c});
      gp.shirt.push(it(pick(shirts))); gp.pants.push(it(pick(pantsC))); gp.skin.push(it(pick(skinC))); gp.hair.push(it(pick(hairC)));
    }
  }
  const geos = humanGeos(), mats = {shirt: crowdMat(), pants: crowdMat(), skin: crowdMat(), hair: crowdMat()};
  groups.forEach((gp, v) => { for (const part of ['shirt', 'pants', 'skin', 'hair']) if (gp[part].length) W.group.add(inst(geos[v][part], mats[part], gp[part])); });

  // Floodlights
  const pm = lam(0x888a92), lm = new THREE.MeshBasicMaterial({color: 0xffffff, fog: false});
  for (let k = 0; k < 8; k++) {
    const i = Math.floor(k / 8 * N), p = at(i, O0 + ROWS * DO + 8, 0);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 70, 6), pm); pole.position.set(p[0], 38, p[2]);
    const lampM = new THREE.Mesh(new THREE.BoxGeometry(14, 6, 1.5), lm); lampM.position.set(p[0], 74, p[2]); lampM.lookAt(0, 20, 0);
    W.group.add(pole, lampM);
  }
}

function dressChaos(tr) {
  W.terrainH = null; W.distTrack = null;
  addGridFloor(-35, 0x44ccff, 0x102a44);
  addThrusters(tr, 0x44ccff);
  const geos = [new THREE.TetrahedronGeometry(1, 0), new THREE.OctahedronGeometry(1, 0), new THREE.BoxGeometry(1.4, 1.4, 1.4), new THREE.TorusGeometry(1, 0.3, 6, 12)];
  const cols = [0xff0066, 0x00ffcc, 0xffee00, 0x8844ff, 0xff6600, 0x44ccff];
  geos.forEach((geo, gi) => {
    const items = [];
    for (let k = 0; k < 28; k++) {
      const x = rand(-650, 650), z = rand(-550, 550), y = rand(-20, 110), s = rand(4, 20);
      if (W.distTrackSimple(tr, x, z) < tr.w / 2 + s + 8) continue;
      items.push({x, y, z, s, rx: rand(0, 6), ry: rand(0, 6), c: cols[(k + gi) % 6]});
    }
    const m = inst(geo, new THREE.MeshStandardMaterial({color: 0xffffff, metalness: 0.7, roughness: 0.25, envMap: ENV_MAP, flatShading: true}), items);
    W.group.add(m);
  });
}

// ═══════════════════════════════════════════════════════════════════════
// TRACK OBJECTS (zones, obstacles, powerups, barriers, lasers, finish)
// ═══════════════════════════════════════════════════════════════════════
function clearEnts() {
  if (W.ents) { raceScene.remove(W.ents); disposeTree(W.ents); }
  W.ents = new THREE.Group();
  raceScene.add(W.ents);
}

function resetObjects() {
  W.zones = []; W.obstacles = []; W.powerups = []; W.barriers = []; W.lasers = []; W.finishF = null;
  W.fogT = 0;
  clearEnts();
}

function rebuildEntities() {
  clearEnts();
  for (const z of W.zones) buildZone(z);
  for (const o of W.obstacles) buildObstacle(o);
  for (const p of W.powerups) buildPowerup(p);
  for (const b of W.barriers) buildBarrier(b);
  for (const l of W.lasers) buildLaser(l);
  if (W.finishF !== null) buildFinish(W.finishF);
}

const ZCOL = {boost: 0x00ffcc, spike: 0xff0033, oil: 0x111118, shock: 0x44aaff, freeze: 0xaaeeff};

function buildZone(z) {
  const tr = W.tr, g = new THREE.Group(), col = ZCOL[z.t] || 0xffffff;
  z.mesh = g; z.anim = null;
  if (tr.mode === 'plane' && z.t === 'spike') {
    const R = tr.w / 2, hole = R * (z.mega ? 0.42 : 0.5), outer = R - 0.6, spikes = [];
    for (let r = hole + 0.8; r <= outer; r += 1.5) {
      const cnt = Math.max(6, Math.round(6.283 * r / 1.1));
      for (let k = 0; k < cnt; k++) { const a = (k + Math.random() * 0.5) / cnt * 6.283; spikes.push({x: Math.cos(a) * r, y: Math.sin(a) * r, z: 0.2, sx: 1, sy: 1, sz: rand(0.8, 1.5) * (z.mega ? 1.5 : 1), c: Math.random() < 0.25 ? 0x8a5a3a : 0xa9adb8}); }
    }
    const sg = new THREE.ConeGeometry(0.3, 2, 5); sg.rotateX(-Math.PI / 2); sg.translate(0, 0, -1);
    g.add(inst(sg, new THREE.MeshStandardMaterial({color: 0xffffff, metalness: 0.85, roughness: 0.3, envMap: ENV_MAP}), spikes));
    const disc = new THREE.Mesh(new THREE.RingGeometry(hole, outer + 0.6, 40, 1), new THREE.MeshStandardMaterial({color: 0x23262d, metalness: 0.8, roughness: 0.4, side: THREE.DoubleSide}));
    g.add(disc);
    g.add(new THREE.Mesh(new THREE.TorusGeometry(outer + 0.6, 0.45, 6, 48), new THREE.MeshStandardMaterial({color: 0x555a66, metalness: 0.8, roughness: 0.35})));
    g.add(new THREE.Mesh(new THREE.TorusGeometry(hole, 0.4, 6, 40), new THREE.MeshBasicMaterial({color: 0x44ff88})));
    frameAt(z.f, 0, g);
    z.anim = null;
  } else if (tr.mode === 'plane') {
    const p = CT.placeAt(tr, z.f, 0, {});
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(Math.min(z.r, tr.w / 2), 2), new THREE.MeshBasicMaterial({color: z.t === 'oil' ? 0x332244 : col, transparent: true, opacity: 0.28, depthWrite: false, wireframe: false}));
    const w = new THREE.Mesh(new THREE.IcosahedronGeometry(Math.min(z.r, tr.w / 2) * 1.01, 1), new THREE.MeshBasicMaterial({color: z.t === 'oil' ? 0x8844aa : col, wireframe: true, transparent: true, opacity: 0.6}));
    g.add(s, w); g.position.set(p.x, p.cy, p.z);
    z.anim = () => { w.rotation.y = W.t * 0.6; w.rotation.x = W.t * 0.4; };
  } else {
    const n = Math.max(4, Math.round(z.r * 2 / 3)), hw = tr.w / 2 - 0.6, pts = [];
    const fk = k => z.f + (k / n - 0.5) * 2 * z.r * 0.92 / tr.L;
    const strip = new Strips();
    strip.add(n, k => { const p = CT.placeAt(tr, fk(k), hw, {}); pts.push(p); return [p.x, p.y + 0.07, p.z]; }, k => { const p = CT.placeAt(tr, fk(k), -hw, {}); return [p.x, p.y + 0.07, p.z]; }, k => k / n * (z.r / 4));
    let mat;
    if (z.t === 'boost') mat = new THREE.MeshBasicMaterial({color: col, map: TEX.chev, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false});
    else if (z.t === 'oil') mat = new THREE.MeshStandardMaterial({color: 0x050508, metalness: 1, roughness: 0.04, envMap: ENV_MAP, envMapIntensity: 2, transparent: true, opacity: 0.93});
    else if (z.t === 'freeze') mat = new THREE.MeshStandardMaterial({color: 0xcfefff, metalness: 0.6, roughness: 0.08, envMap: ENV_MAP, envMapIntensity: 1.6, transparent: true, opacity: 0.85});
    else if (z.t === 'spike') mat = new THREE.MeshBasicMaterial({color: 0x060607, transparent: true, opacity: 0.45, depthWrite: false});
    else mat = new THREE.MeshBasicMaterial({color: col, transparent: true, opacity: z.t === 'shock' ? 0.45 : 0.35, depthWrite: false});
    mat.polygonOffset = true; mat.polygonOffsetFactor = -3; mat.polygonOffsetUnits = -3;
    const pad = new THREE.Mesh(strip.build(), mat); pad.renderOrder = 1; g.add(pad);
    // Props standing on the pad
    if (z.t === 'spike') buildSpikeTrap(z, g, tr, hw, fk, n);
    else if (z.t === 'freeze' || z.t === 'shock') {
      const items = [], cross = Math.max(3, Math.round(tr.w / 3.2));
      const rows = z.t === 'shock' ? 2 : n * 2;
      for (let a = 0; a <= rows; a++) for (let b = 0; b < (z.t === 'shock' ? 2 : cross); b++) {
        const f = z.t === 'shock' ? fk(a ? n : 0) : fk(a / 2 + rand(-0.2, 0.2));
        const lat = z.t === 'shock' ? (b ? hw : -hw) : (b / (cross - 1) - 0.5) * 2 * (hw - 0.6) + rand(-0.4, 0.4);
        const p = CT.placeAt(tr, f, lat, {});
        if (z.t === 'freeze') { if (Math.random() < 0.3) items.push({x: p.x, y: p.y, z: p.z, sx: rand(0.3, 0.6), sy: rand(0.6, 1.6), sz: rand(0.3, 0.6), rx: rand(-0.4, 0.4), rz: rand(-0.4, 0.4)}); }
        else items.push({x: p.x, y: p.y, z: p.z, sx: 0.5, sy: 5, sz: 0.5});
      }
      const cg = z.t === 'shock' ? new THREE.CylinderGeometry(0.5, 0.7, 1, 8) : new THREE.ConeGeometry(1, 1, 5);
      cg.translate(0, 0.5, 0);
      const pm = z.t === 'freeze' ? new THREE.MeshStandardMaterial({color: 0xdff6ff, metalness: 0.3, roughness: 0.1, envMap: ENV_MAP, transparent: true, opacity: 0.8})
        : new THREE.MeshBasicMaterial({color: 0x88ccff});
      if (items.length) g.add(inst(cg, pm, items));
    }
    if (z.t === 'boost') z.anim = () => {};
    else if (z.t === 'shock') {
      const lg = new THREE.BufferGeometry(), lp = new Float32Array(4 * 9 * 3);
      lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
      const arcs = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({color: 0xaaddff}));
      arcs.frustumCulled = false; g.add(arcs);
      const a0 = CT.placeAt(tr, fk(0), hw, {}), a1 = CT.placeAt(tr, fk(0), -hw, {}), b0 = CT.placeAt(tr, fk(n), hw, {}), b1 = CT.placeAt(tr, fk(n), -hw, {});
      const pairs = [[a0, a1], [b0, b1], [a0, b1], [a1, b0]];
      let last = 0;
      z.anim = () => {
        pad.material.opacity = 0.3 + Math.random() * 0.3;
        if (W.t - last < 0.06) return; last = W.t;
        let o = 0;
        for (const [a, b] of pairs) {
          let px = a.x, py = a.y + 4.5, pz = a.z;
          for (let k = 1; k <= 9; k++) {
            const t = k / 9, nx = a.x + (b.x - a.x) * t + (k < 9 ? rand(-1.2, 1.2) : 0), ny = a.y + (b.y - a.y) * t + 4.5 - Math.sin(t * Math.PI) * 3 + (k < 9 ? rand(-0.8, 0.8) : 0), nz = a.z + (b.z - a.z) * t + (k < 9 ? rand(-1.2, 1.2) : 0);
            if (k % 2) { lp[o++] = px; lp[o++] = py; lp[o++] = pz; lp[o++] = nx; lp[o++] = ny; lp[o++] = nz; }
            px = nx; py = ny; pz = nz;
          }
        }
        lg.attributes.position.needsUpdate = true;
      };
    }
  }
  W.ents.add(g);
}


let _warnTex = null;
function warnTexture() {
  if (_warnTex) return _warnTex;
  _warnTex = canvasTex(128, 128, (g, w) => {
    g.clearRect(0, 0, w, w);
    g.fillStyle = '#111'; g.beginPath(); g.moveTo(64, 6); g.lineTo(122, 112); g.lineTo(6, 112); g.closePath(); g.fill();
    g.fillStyle = '#ffcc00'; g.beginPath(); g.moveTo(64, 22); g.lineTo(106, 102); g.lineTo(22, 102); g.closePath(); g.fill();
    g.fillStyle = '#111'; g.fillRect(58, 50, 12, 28); g.beginPath(); g.arc(64, 90, 6, 0, 6.3); g.fill();
  });
  return _warnTex;
}

// Road spike strip: steel plates of needle spikes laid across the lanes, with a narrow ramp up the middle to jump over them.
function buildSpikeTrap(z, g, tr, hw, fk, nk) {
  const rampHW = 2, gap = rampHW + 0.9, mega = !!z.mega;
  const rows = Math.max(6, Math.round(z.r * 2 * 0.92 / 1.5)), spikes = [], plates = [];
  for (let r = 0; r <= rows; r++) {
    const f = fk(r / rows * nk);
    for (const side of [-1, 1]) {
      const l0 = gap, l1 = hw - 0.3, cnt = Math.max(2, Math.round((l1 - l0) / 0.5));
      const p0 = CT.placeAt(tr, f, side * (l0 + l1) / 2, {});
      plates.push({x: p0.x, y: p0.y + 0.04, z: p0.z, sx: l1 - l0, sy: 0.08, sz: 0.34, ry: p0.angle + Math.PI / 2 + rand(-0.02, 0.02), c: 0x25282e});
      for (let k = 0; k < cnt; k++) {
        const lat = side * (l0 + (k + rand(0.1, 0.9)) / cnt * (l1 - l0)), df = f + rand(-0.3, 0.3) / tr.L;
        const p = CT.placeAt(tr, df, lat, {});
        const h = (mega ? rand(1.1, 1.9) : rand(0.5, 0.95)) * (Math.random() < 0.08 ? 0.45 : 1), lean = Math.random() < 0.12 ? 0.55 : 0.2;
        const tone = Math.random() < 0.25 ? 0x8a5a3a : Math.random() < 0.5 ? 0xa9adb8 : 0x7d818c;
        spikes.push({x: p.x, y: p.y + 0.06, z: p.z, sx: mega ? 0.12 : 0.085, sy: h, sz: mega ? 0.12 : 0.085, rx: rand(-lean, lean), rz: rand(-lean, lean), c: tone});
      }
    }
  }
  const sg = new THREE.ConeGeometry(1, 1, 5); sg.translate(0, 0.5, 0);
  g.add(inst(sg, new THREE.MeshStandardMaterial({color: 0xffffff, metalness: 0.85, roughness: 0.3, envMap: ENV_MAP, envMapIntensity: 1.2}), spikes));
  g.add(inst(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({color: 0xffffff, metalness: 0.7, roughness: 0.5, envMap: ENV_MAP}), plates));

  // Warning signs before the strip
  const sgn = [], pole = [];
  const f0 = z.f - (z.r + 14) / tr.L;
  for (const side of [-1, 1]) {
    const p = CT.placeAt(tr, f0, side * (hw - 0.6), {});
    pole.push({x: p.x, y: p.y + 1.1, z: p.z, sx: 0.08, sy: 2.2, sz: 0.08});
    sgn.push({x: p.x, y: p.y + 2.4, z: p.z, ry: p.angle + Math.PI});
  }
  g.add(inst(new THREE.BoxGeometry(1, 1, 1), lam(0x444850), pole));
  const planeG = new THREE.PlaneGeometry(1.3, 1.3);
  g.add(inst(planeG, new THREE.MeshBasicMaterial({map: warnTexture(), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide}), sgn));

  // Narrow dodge ramp up the middle lane
  const len = 10, h = 4.6, n = 6, ob = rampHW + 0.8;
  let s0 = CT.sAtF(tr, z.f) - z.r - len; if (s0 < 0) s0 += tr.L;
  const lats = [-ob, -rampHW, rampHW, ob], ramp = new Strips();
  const rp = (k, lat, top) => {
    const p = CT.placeAt(tr, (s0 + len * k / n) / tr.L, lat, {});
    const e = Math.min(1, Math.max(0, (rampHW + 0.8 - Math.abs(lat)) / 0.8));
    return [p.x, p.y + 0.03 + (top ? h * k / n * e : 0), p.z];
  };
  for (let i = 0; i < 3; i++) ramp.add(n, k => rp(k, lats[i], true), k => rp(k, lats[i + 1], true), k => k / n * 2);
  ramp.add(3, i => rp(n, lats[i], true), i => rp(n, lats[i], false), i => i);
  const rm = new THREE.MeshStandardMaterial({color: 0x2a2e36, emissive: 0xffaa00, emissiveMap: TEX.chev, emissiveIntensity: 1.4, roughness: 0.5, metalness: 0.5, side: THREE.DoubleSide});
  g.add(new THREE.Mesh(ramp.build(), rm));
}

function objWorldPos(e, out) {
  const tr = W.tr, p = CT.placeAt(tr, e.f, e.lat || 0, _pl);
  out.set(p.x, tr.mode === 'plane' ? p.cy + (e.dv || 0) : p.y, p.z);
  return p;
}

function buildObstacle(o) {
  const tr = W.tr;
  let m;
  if (tr.mode !== 'car') {
    m = new THREE.Group();
    m.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 1), new THREE.MeshStandardMaterial({color: 0x1a1c22, metalness: 0.8, roughness: 0.3, envMap: ENV_MAP, flatShading: true})));
    const sp = [];
    for (let k = 0; k < 10; k++) { const c = new THREE.ConeGeometry(0.25, 1, 5); c.translate(0, 1.8, 0); c.rotateX(rand(0, 6.3)); c.rotateZ(rand(0, 6.3)); sp.push(c); }
    m.add(new THREE.Mesh(mergeGeos(sp), new THREE.MeshBasicMaterial({color: 0xff2233})));
    objWorldPos(o, m.position);
    if (tr.mode === 'boat') m.position.y = 0.6;
  } else {
    const frame = new THREE.Group();
    frameAt(o.f, o.lat, frame);
    if (o.k === 0) {
      m = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.6, 2.6), new THREE.MeshStandardMaterial({color: 0x8a5a2a, roughness: 0.8, emissive: 0x331800, emissiveIntensity: 0.6}));
      m.position.y = 1.3; m.rotation.y = o.f * 40;
      const band = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.3, 2.7), new THREE.MeshBasicMaterial({color: 0xffaa00})); band.position.y = 1.3; band.rotation.y = o.f * 40; frame.add(band);
    } else if (o.k === 1) {
      const sh = new THREE.Shape(); sh.moveTo(-1.1, 0); sh.lineTo(1.1, 0); sh.lineTo(0.4, 1.9); sh.lineTo(-0.4, 1.9); sh.closePath();
      const eg = new THREE.ExtrudeGeometry(sh, {depth: 3, bevelEnabled: false}); eg.translate(0, 0, -1.5);
      m = new THREE.Mesh(eg, new THREE.MeshStandardMaterial({color: 0xbbbbc4, roughness: 0.9, emissive: 0xff2200, emissiveIntensity: 0.25}));
    } else {
      m = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 2.6, 12), new THREE.MeshStandardMaterial({color: 0xcc2222, metalness: 0.6, roughness: 0.4, envMap: ENV_MAP, emissive: 0x550000, emissiveIntensity: 0.8}));
      m.position.y = 1.3;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(1.34, 1.34, 0.4, 12), new THREE.MeshBasicMaterial({color: 0xffee00})); band.position.y = 1.3; frame.add(band);
    }
    frame.add(m); m = frame;
  }
  o.mesh = m;
  W.ents.add(m);
}

const PU_COLORS = {boost: 0x00ffcc, repair: 0x44ff44, emp: 0x4488ff, missile: 0xff3300, shield: 0x0088ff, spike_p: 0xff0044, oil_p: 0x7733aa, slow: 0xffcc00, spin: 0xff88ff, reverse: 0xff0066,
  ghost: 0xaaccff, spring: 0xffee44, juggernaut: 0xff7a1a, warp: 0xaa66ff, swap: 0xffaa00, cryo: 0x88ddff, lightning: 0xffff55, leech: 0xcc1133, scrambler: 0xff44aa};

function buildPowerup(pu) {
  const col = PU_COLORS[pu.type] || 0xffffff, g = new THREE.Group(), icon = new THREE.Group();
  const em = new THREE.MeshStandardMaterial({color: col, emissive: col, emissiveIntensity: 1.2, metalness: 0.5, roughness: 0.3, envMap: ENV_MAP});
  const add = geo => icon.add(new THREE.Mesh(geo, em));
  switch (pu.type) {
    case 'boost': { const s = new THREE.Shape(); [[0.2, 1.1], [-0.6, -0.1], [-0.05, -0.1], [-0.25, -1.1], [0.6, 0.15], [0.05, 0.15]].forEach((v, i) => i ? s.lineTo(v[0], v[1]) : s.moveTo(v[0], v[1])); const e = new THREE.ExtrudeGeometry(s, {depth: 0.3, bevelEnabled: false}); e.translate(0, 0, -0.15); add(e); break; }
    case 'repair': add(mergeGeos([gBox(1.6, 0.5, 0.5, 0, 0, 0), gBox(0.5, 1.6, 0.5, 0, 0, 0)])); break;
    case 'emp': add(new THREE.SphereGeometry(0.55, 12, 8)); add(new THREE.TorusGeometry(0.95, 0.08, 6, 24)); add(place(new THREE.TorusGeometry(0.95, 0.08, 6, 24), 0, 0, 0, Math.PI / 2)); break;
    case 'missile': add(mergeGeos([place(new THREE.CylinderGeometry(0.28, 0.28, 1.3, 10), 0, 0, 0), place(new THREE.ConeGeometry(0.28, 0.6, 10), 0, 0.95, 0), gBox(1, 0.4, 0.06, 0, -0.5, 0), gBox(0.06, 0.4, 1, 0, -0.5, 0)])); icon.rotation.z = -0.6; break;
    case 'shield': add(new THREE.IcosahedronGeometry(0.9, 1)); em.wireframe = true; icon.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), new THREE.MeshBasicMaterial({color: col}))); break;
    case 'spike_p': { const sp = []; for (let k = 0; k < 8; k++) { const c = new THREE.ConeGeometry(0.3, 1.2, 5); c.translate(0, 0.6, 0); c.rotateX(k < 4 ? 0.95 : 2.2); c.rotateY(k * Math.PI / 2 + (k < 4 ? 0 : 0.78)); sp.push(c); } add(mergeGeos(sp)); break; }
    case 'oil_p': { const d = new THREE.SphereGeometry(0.7, 12, 10); const p = d.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) { const k = 1 - p.getY(i) / 0.7 * 0.8; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); p.setY(i, p.getY(i) * 1.7); } d.computeVertexNormals(); add(d); em.color.setHex(0x110818); em.metalness = 1; em.roughness = 0.05; break; }
    case 'ghost': {
      const parts = [place(new THREE.SphereGeometry(0.6, 12, 8), 0, 0.3, 0), place(new THREE.CylinderGeometry(0.6, 0.6, 0.8, 12, 1, true), 0, -0.1, 0)];
      for (let k = 0; k < 4; k++) parts.push(place(new THREE.SphereGeometry(0.2, 8, 6), Math.cos(k * 1.571) * 0.4, -0.5, Math.sin(k * 1.571) * 0.4));
      add(mergeGeos(parts)); em.transparent = true; em.opacity = 0.85;
      const eyes = mergeGeos([place(new THREE.SphereGeometry(0.1, 6, 6), -0.2, 0.35, 0.52), place(new THREE.SphereGeometry(0.1, 6, 6), 0.2, 0.35, 0.52)]);
      icon.add(new THREE.Mesh(eyes, new THREE.MeshBasicMaterial({color: 0x000010})));
      break;
    }
    case 'spring': {
      const parts = [gBox(1.1, 0.12, 1.1, 0, -0.75, 0), gBox(1.1, 0.12, 1.1, 0, 0.75, 0)];
      for (let k = 0; k < 5; k++) { const t = new THREE.TorusGeometry(0.42, 0.07, 6, 16); t.rotateX(Math.PI / 2 + (k % 2 ? 0.25 : -0.25)); t.translate(0, -0.55 + k * 0.28, 0); parts.push(t); }
      add(mergeGeos(parts)); break;
    }
    case 'juggernaut': add(mergeGeos([place(new THREE.CylinderGeometry(0.85, 0.85, 0.5, 6), 0, 0, 0), place(new THREE.CylinderGeometry(0.55, 0.85, 0.4, 6), 0, 0.45, 0), place(new THREE.OctahedronGeometry(0.45, 0), 0, 0.95, 0), gBox(1.9, 0.14, 0.14, 0, 0, 0), gBox(0.14, 0.14, 1.9, 0, 0, 0)])); break;
    case 'warp': add(new THREE.TorusKnotGeometry(0.55, 0.14, 56, 8, 2, 3)); break;
    case 'swap': {
      const arrow = dir => { const sh = new THREE.Shape(); sh.moveTo(-0.9, 0.18); sh.lineTo(0.3, 0.18); sh.lineTo(0.3, 0.45); sh.lineTo(0.95, 0); sh.lineTo(0.3, -0.45); sh.lineTo(0.3, -0.18); sh.lineTo(-0.9, -0.18); sh.closePath(); const e = new THREE.ExtrudeGeometry(sh, {depth: 0.2, bevelEnabled: false}); e.translate(0, 0, -0.1); e.scale(dir, 1, 1); e.translate(0, dir * 0.38, 0); return e; };
      add(mergeGeos([arrow(1), arrow(-1)])); break;
    }
    case 'cryo': { const arms = []; for (let k = 0; k < 3; k++) { const b = new THREE.BoxGeometry(1.9, 0.12, 0.12); b.rotateZ(k * Math.PI / 3); arms.push(b); const b2 = new THREE.BoxGeometry(0.4, 0.1, 0.1); b2.rotateZ(k * Math.PI / 3 + 0.9); b2.translate(Math.cos(k * Math.PI / 3) * 0.7, Math.sin(k * Math.PI / 3) * 0.7, 0); arms.push(b2); } arms.push(new THREE.OctahedronGeometry(0.28, 0)); add(mergeGeos(arms)); break; }
    case 'lightning': { const sh = new THREE.Shape(); [[0.35, 1.2], [-0.5, 0.1], [-0.05, 0.1], [-0.4, -1.2], [0.55, 0.2], [0.05, 0.2], [0.55, 1.2]].forEach((v, i) => i ? sh.lineTo(v[0], v[1]) : sh.moveTo(v[0], v[1])); sh.closePath(); const e = new THREE.ExtrudeGeometry(sh, {depth: 0.34, bevelEnabled: false}); e.translate(0, 0, -0.17); add(e); break; }
    case 'leech': add(mergeGeos([place(new THREE.SphereGeometry(0.62, 12, 8), 0, 0.2, 0), place(new THREE.ConeGeometry(0.16, 0.7, 6), -0.28, -0.55, 0.3, Math.PI), place(new THREE.ConeGeometry(0.16, 0.7, 6), 0.28, -0.55, 0.3, Math.PI)])); break;
    case 'scrambler': { const parts = [place(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 6), 0, 0, 0), place(new THREE.SphereGeometry(0.16, 8, 6), 0, 0.85, 0)]; for (let k = 1; k <= 3; k++) { const t = new THREE.TorusGeometry(0.3 + k * 0.28, 0.04, 5, 20, Math.PI * 1.3); t.rotateX(Math.PI / 2); t.translate(0, 0.85, 0); parts.push(t); } add(mergeGeos(parts)); break; }
    default: add(new THREE.BoxGeometry(1, 1, 1));
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.07, 6, 28), new THREE.MeshBasicMaterial({color: col}));
  const halo = new THREE.Mesh(new THREE.SphereGeometry(1.9, 12, 8), new THREE.MeshBasicMaterial({color: col, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false}));
  g.add(icon, ring, halo);
  objWorldPos(pu, g.position);
  if (W.tr.mode !== 'plane') g.position.y += 1.9;
  g.userData = {icon, ring, baseY: g.position.y, ph: pu.id * 1.7};
  g.visible = pu.active !== false;
  pu.mesh = g;
  W.ents.add(g);
}

function buildBarrier(b) {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.BoxGeometry(b.r * 1.5, 5, b.r * 1.5), new THREE.MeshStandardMaterial({color: 0xff4400, emissive: 0xcc1100, emissiveIntensity: 0.9, metalness: 0.5, roughness: 0.4}));
  core.position.y = 2.6;
  const spin = new THREE.Group(); spin.position.y = 2.6;
  for (const y of [-1.4, 1.4]) { const r = new THREE.Mesh(new THREE.TorusGeometry(b.r + 0.3, 0.25, 6, 24), new THREE.MeshBasicMaterial({color: 0xffaa00})); r.rotation.x = Math.PI / 2; r.position.y = y; spin.add(r); }
  for (let k = 0; k < 4; k++) { const bl = new THREE.Mesh(new THREE.BoxGeometry(b.r * 2 + 0.6, 0.5, 0.4), new THREE.MeshBasicMaterial({color: 0xff6600})); bl.rotation.y = k * Math.PI / 4; spin.add(bl); }
  g.add(core, spin);
  g.userData.spin = spin;
  b.mesh = g;
  W.ents.add(g);
}

function buildLaser(l) {
  const tr = W.tr, g = new THREE.Group();
  const bm = new THREE.MeshBasicMaterial({color: 0xff0022, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false});
  let beams;
  if (tr.mode === 'plane') {
    beams = new THREE.Mesh(new THREE.CircleGeometry(tr.w / 2, 32), bm);
    g.add(new THREE.Mesh(new THREE.TorusGeometry(tr.w / 2, 0.6, 6, 36), new THREE.MeshStandardMaterial({color: 0x30343f, emissive: 0x550008, metalness: 0.7, roughness: 0.4})));
  } else {
    const hw = tr.w / 2, pm = new THREE.MeshStandardMaterial({color: 0x30343f, metalness: 0.8, roughness: 0.3, envMap: ENV_MAP, emissive: 0x550008});
    for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.9, 6.4, 0.9), pm); p.position.set(sx * hw, 3.2, 0); g.add(p); }
    const parts = [];
    for (const y of [0.8, 2.2, 3.6, 5]) parts.push(gCylX(0.13, hw * 2, 0, y, 0, 6));
    const sheet = new THREE.PlaneGeometry(hw * 2, 5.2); sheet.translate(0, 2.9, 0);
    beams = new THREE.Group();
    beams.add(new THREE.Mesh(mergeGeos(parts), new THREE.MeshBasicMaterial({color: 0xff4455, fog: false})));
    const sm2 = bm.clone(); sm2.opacity = 0.22;
    beams.add(new THREE.Mesh(sheet, sm2));
  }
  g.add(beams);
  const p = frameAt(l.f, 0, g);
  if (tr.mode === 'plane') g.position.y = p.cy;
  g.userData.beams = beams;
  l.mesh = g;
  W.ents.add(g);
}

function buildFinish(f) {
  const tr = W.tr, g = new THREE.Group(), gw = tr.w;
  const ct = TEX.checker.clone(); ct.needsUpdate = true;
  if (tr.mode === 'plane') {
    ct.repeat.set(6, 6);
    g.add(new THREE.Mesh(new THREE.CircleGeometry(gw / 2, 32), new THREE.MeshBasicMaterial({map: ct, transparent: true, opacity: 0.75, side: THREE.DoubleSide, fog: false})));
    g.add(new THREE.Mesh(new THREE.TorusGeometry(gw / 2, 1, 8, 40), new THREE.MeshBasicMaterial({color: 0xff00ff, fog: false})));
  } else {
    ct.repeat.set(gw / 3, 1.5);
    const line = new THREE.Mesh(new THREE.PlaneGeometry(gw, 5), new THREE.MeshBasicMaterial({map: ct, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4}));
    line.rotation.x = -Math.PI / 2; line.position.y = 0.12; g.add(line);
    const pm = new THREE.MeshBasicMaterial({color: 0xff00ff, fog: false});
    for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(1, 11, 1), pm); p.position.set(sx * (gw / 2 + 1), 5.5, 0); g.add(p); }
    const ct2 = TEX.checker.clone(); ct2.needsUpdate = true; ct2.repeat.set(gw / 4, 0.75);
    const banner = new THREE.Mesh(new THREE.BoxGeometry(gw + 3, 2.6, 0.5), new THREE.MeshBasicMaterial({map: ct2, fog: false})); banner.position.y = 10.4; g.add(banner);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 400, 8, 1, true), new THREE.MeshBasicMaterial({color: 0xff00ff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, fog: false}));
    for (const sx of [-1, 1]) { const b = beam.clone(); b.position.set(sx * (gw / 2 + 1), 200, 0); g.add(b); }
  }
  const p = frameAt(f, 0, g);
  if (tr.mode === 'boat') g.position.y = 0.3;
  W.finishMesh = g;
  W.ents.add(g);
}

// ═══════════════════════════════════════════════════════════════════════
// PARTICLES + EFFECTS
// ═══════════════════════════════════════════════════════════════════════
const PMAX = 3600;
const PS = {i: 0, pos: null, col: null, size: null, alpha: null, vel: new Float32Array(PMAX * 3), life: new Float32Array(PMAX), max: new Float32Array(PMAX), grav: new Float32Array(PMAX), cool: new Float32Array(PMAX), s0: new Float32Array(PMAX), pts: null};
const FX = [];

function initParticles() {
  const g = new THREE.BufferGeometry();
  PS.pos = new Float32Array(PMAX * 3); PS.col = new Float32Array(PMAX * 3); PS.size = new Float32Array(PMAX); PS.alpha = new Float32Array(PMAX);
  g.setAttribute('position', new THREE.BufferAttribute(PS.pos, 3));
  g.setAttribute('pcol', new THREE.BufferAttribute(PS.col, 3));
  g.setAttribute('psize', new THREE.BufferAttribute(PS.size, 1));
  g.setAttribute('palpha', new THREE.BufferAttribute(PS.alpha, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: {scale: {value: 400}},
    vertexShader: 'attribute vec3 pcol; attribute float psize; attribute float palpha; uniform float scale; varying vec3 vC; varying float vA; void main(){ vC = pcol; vA = palpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = psize * scale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5 || vA <= 0.0) discard; float a = smoothstep(0.5, 0.05, d) * vA; gl_FragColor = vec4(vC * a, a); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  PS.pts = new THREE.Points(g, mat);
  PS.pts.frustumCulled = false; PS.pts.renderOrder = 5;
  PS.mat = mat;
}

function attachParticles(scene) { scene.add(PS.pts); }

function spark(x, y, z, vx, vy, vz, r, g, b, size, life, grav, cool) {
  const i = PS.i; PS.i = (i + 1) % PMAX;
  PS.pos[i*3] = x; PS.pos[i*3+1] = y; PS.pos[i*3+2] = z;
  PS.vel[i*3] = vx; PS.vel[i*3+1] = vy; PS.vel[i*3+2] = vz;
  PS.col[i*3] = r; PS.col[i*3+1] = g; PS.col[i*3+2] = b;
  PS.s0[i] = size; PS.life[i] = PS.max[i] = life; PS.grav[i] = grav || 0; PS.cool[i] = cool || 0;
}

function updateParticles(dt) {
  for (let i = 0; i < PMAX; i++) {
    if (PS.life[i] <= 0) { if (PS.alpha[i] !== 0) { PS.alpha[i] = 0; PS.size[i] = 0; } continue; }
    PS.life[i] -= dt;
    const k = Math.max(0, PS.life[i] / PS.max[i]);
    PS.vel[i*3+1] -= PS.grav[i] * dt;
    PS.pos[i*3] += PS.vel[i*3] * dt; PS.pos[i*3+1] += PS.vel[i*3+1] * dt; PS.pos[i*3+2] += PS.vel[i*3+2] * dt;
    if (PS.cool[i] > 0) { const c = PS.cool[i] * dt; PS.col[i*3+1] *= 1 - c * 0.9; PS.col[i*3+2] *= 1 - c * 2.4; PS.col[i*3] *= 1 - c * 0.15; PS.vel[i*3] *= 1 - 2 * dt; PS.vel[i*3+2] *= 1 - 2 * dt; }
    PS.alpha[i] = k; PS.size[i] = PS.s0[i] * (0.4 + 0.6 * k);
  }
  const a = PS.pts.geometry.attributes;
  a.position.needsUpdate = a.pcol.needsUpdate = a.psize.needsUpdate = a.palpha.needsUpdate = true;
  PS.mat.uniforms.scale.value = renderer.domElement.height * 0.5;
}

const _c = new THREE.Color();
function explode(x, y, z, hex, count, speed) {
  _c.setHex(hex);
  count = count || 40; speed = speed || 14;
  for (let i = 0; i < count; i++) {
    const a = Math.random() * 6.283, e = Math.random() * Math.PI - Math.PI / 2, s = speed * (0.3 + Math.random());
    spark(x, y + 0.5, z, Math.cos(a) * Math.cos(e) * s, Math.abs(Math.sin(e)) * s + 3, Math.sin(a) * Math.cos(e) * s, _c.r, _c.g, _c.b, 1.4 + Math.random() * 1.6, 0.6 + Math.random() * 0.7, 18);
  }
  shockRing(x, y + 0.4, z, hex, speed * 1.2);
}

function shockRing(x, y, z, hex, grow, sphere) {
  const m = new THREE.Mesh(sphere ? new THREE.SphereGeometry(1, 20, 12) : new THREE.RingGeometry(0.8, 1, 32),
    new THREE.MeshBasicMaterial({color: hex, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, wireframe: !!sphere}));
  if (!sphere) m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  raceScene.add(m);
  let life = 0.6;
  FX.push(dt => {
    life -= dt;
    const s = 1 + (0.6 - life) * grow * 2.2;
    m.scale.setScalar(s); m.material.opacity = Math.max(0, life / 0.6) * 0.8;
    if (life <= 0) { raceScene.remove(m); m.geometry.dispose(); m.material.dispose(); return true; }
  });
}

function lightningBolt(x, y, z) {
  const pts = [];
  let px = x + rand(-8, 8), pz = z + rand(-8, 8);
  for (let k = 0; k <= 10; k++) { const t = k / 10; pts.push(new THREE.Vector3(px + (x - px) * t + (k < 10 ? rand(-3, 3) : 0), y + 90 * (1 - t), pz + (z - pz) * t + (k < 10 ? rand(-3, 3) : 0))); }
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({color: 0xffffaa, fog: false}));
  raceScene.add(l);
  explode(x, y, z, 0xffff88, 18, 9);
  let life = 0.28;
  FX.push(dt => { life -= dt; l.visible = Math.random() < 0.8; if (life <= 0) { raceScene.remove(l); l.geometry.dispose(); l.material.dispose(); return true; } });
}

// Missile that flies from one object to another (or straight ahead) over eta ms
function launchMissile(from, getTarget, eta) {
  const m = new THREE.Group();
  const body = new THREE.Mesh(mergeGeos([place(new THREE.CylinderGeometry(0.22, 0.22, 1.6, 8), 0, 0, 0, Math.PI / 2), place(new THREE.ConeGeometry(0.22, 0.6, 8), 0, 0, 1.1, Math.PI / 2)]), new THREE.MeshStandardMaterial({color: 0xdddddd, emissive: 0xff3300, emissiveIntensity: 0.8, metalness: 0.6, roughness: 0.3}));
  m.add(body);
  const start = from.position.clone(); start.y += 1.2;
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(from.quaternion);
  const blind = start.clone().addScaledVector(fwd, 110);
  raceScene.add(m);
  let t = 0; const dur = Math.max(0.15, eta / 1000);
  FX.push(dt => {
    t += dt;
    const k = Math.min(1, t / dur), tg = getTarget();
    const end = tg ? _v1.copy(tg.position).setY(tg.position.y + 0.8) : blind;
    const prev = _v2.copy(m.position);
    m.position.lerpVectors(start, end, k);
    m.position.y += Math.sin(k * Math.PI) * 4;
    if (t > dt) m.lookAt(_v3.copy(m.position).multiplyScalar(2).sub(prev));
    for (let i = 0; i < 3; i++) spark(m.position.x, m.position.y, m.position.z, rand(-1, 1), rand(-1, 1), rand(-1, 1), 1, 0.45 + Math.random() * 0.3, 0.1, 1.6, 0.35, 0);
    if (k >= 1) { raceScene.remove(m); body.geometry.dispose(); body.material.dispose(); if (!tg) explode(m.position.x, m.position.y, m.position.z, 0xff5500, 20, 8); return true; }
  });
}

// ═══════════════════════════════════════════════════════════════════════
// PER-FRAME WORLD UPDATE
// ═══════════════════════════════════════════════════════════════════════
function updateWorld(dt, now, env) {
  const tr = W.tr;
  if (!tr) return;
  W.sky.position.copy(raceCam.position);
  W.stars.position.copy(raceCam.position);
  for (const f of W.anim) f(dt);
  for (let i = FX.length - 1; i >= 0; i--) if (FX[i](dt)) FX.splice(i, 1);

  // Walls fade out while they are switched off
  if (W.wallMat) {
    const target = env.noWalls ? 0.12 : 1;
    W.wallMat.opacity += (target - W.wallMat.opacity) * Math.min(1, dt * 8);
    W.wallMesh.visible = W.wallMat.opacity > 0.02;
  }
  if (W.railMesh) W.railMesh.visible = !env.noWalls || Math.floor(now / 120) % 2 === 0;

  if (W.fogT > 0) {
    W.fogT -= dt * 1000;
    const k = W.fogT > 0 ? 1 : 0;
    raceScene.fog.near += ((k ? 4 : W.fogBase[0]) - raceScene.fog.near) * Math.min(1, dt * 3);
    raceScene.fog.far += ((k ? 38 : W.fogBase[1]) - raceScene.fog.far) * Math.min(1, dt * 3);
  } else {
    raceScene.fog.near += (W.fogBase[0] - raceScene.fog.near) * Math.min(1, dt * 2);
    raceScene.fog.far += (W.fogBase[1] - raceScene.fog.far) * Math.min(1, dt * 2);
  }

  for (const z of W.zones) if (z.anim) z.anim();
  if (W.zones.some(z => z.t === 'boost' || z.t === 'spike')) TEX.chev.offset.y = -W.t * 1.5;
  for (const pu of W.powerups) {
    const m = pu.mesh; if (!m || !m.visible) continue;
    m.userData.icon.rotation.y += dt * 2.2;
    m.userData.ring.rotation.x = W.t * 1.3 + m.userData.ph; m.userData.ring.rotation.y = W.t * 0.9;
    m.position.y = m.userData.baseY + Math.sin(W.t * 2.4 + m.userData.ph) * 0.35;
  }
  for (const b of W.barriers) {
    if (!b.mesh) continue;
    const lat = Math.sin((now - b.startTime) / 1000 * b.freq + b.initPhase) * b.ampF * tr.w;
    const p = frameAt(b.f, lat, b.mesh);
    if (tr.mode === 'plane') b.mesh.position.y = p.cy - 2.6;
    b.mesh.userData.spin.rotation.y += dt * 3;
  }
  for (const l of W.lasers) {
    if (!l.mesh) continue;
    const on = Math.floor((now - l.startTime) / l.cycleDur) % 2 === 0;
    l.mesh.userData.beams.visible = on;
  }
  if (W.finishMesh && W.finishMesh.parent) { const k = 1 + 0.06 * Math.sin(now * 0.006); W.finishMesh.scale.set(1, k, 1); }

  // Ambient embers
  if (W.ambient) {
    const a = W.ambient, c = a.col, e = a.rate * dt, n = Math.floor(e) + (Math.random() < e % 1 ? 1 : 0);
    for (let i = 0; i < n; i++) spark(raceCam.position.x + rand(-70, 70), raceCam.position.y + rand(a.dy[0], a.dy[1]), raceCam.position.z + rand(-70, 70), rand(-a.sx, a.sx), rand(a.vy[0], a.vy[1]), rand(-a.sx, a.sx), c[0], c[1], c[2], a.size, a.life, a.grav);
  }
  if (W.crowdT) W.crowdT.value = W.t;
  updateParticles(dt);
}
