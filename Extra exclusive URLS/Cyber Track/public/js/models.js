'use strict';
// ═══════════════════════════════════════════════════════════════════════
// CUSTOMIZATION DATA
// ═══════════════════════════════════════════════════════════════════════
const VEHICLES = CT.VEHICLES;

const PAINTS = [
  0x00ffcc, 0x00ffaa, 0x00ddff, 0x0088ff, 0x4488ff, 0x8844ff, 0xaa00ff,
  0xff00ff, 0xff0088, 0xff0044, 0xff4400, 0xff8800, 0xffaa00,
  0xffff00, 0xddff00, 0x88ff00, 0x44ff00, 0x00ff44, 0x00ff88, 0x00ffee,
  0x00eeff, 0x0066ff, 0x6600ff, 0xff0066, 0xff6600, 0xff9900,
  0xffffff, 0xdddddd, 0x999999, 0x555566, 0x222233, 0x001122, 0x220011,
  0x441100, 0x664400, 0x336622, 0x003366, 0x330066, 0x660033,
];

const WHEEL_STYLES = [
  {id:'sport',  name:'SPORT',   spokes:5,  radius:0.50, width:0.36, thick:false},
  {id:'mesh',   name:'MESH',    spokes:12, radius:0.54, width:0.40, thick:false},
  {id:'rally',  name:'RALLY',   spokes:3,  radius:0.58, width:0.50, thick:true},
  {id:'star',   name:'STAR',    spokes:6,  radius:0.52, width:0.32, thick:false},
  {id:'drag',   name:'DRAG',    spokes:0,  radius:0.46, width:0.60, thick:true},
  {id:'blade',  name:'BLADE',   spokes:4,  radius:0.55, width:0.38, thick:false},
  {id:'classic',name:'CLASSIC', spokes:8,  radius:0.48, width:0.34, thick:false},
];

const EXHAUSTS = [
  {id:'none',      name:'NONE',      col:0x000000},
  {id:'flame',     name:'FLAME',     col:0xff5500},
  {id:'electric',  name:'ELECTRIC',  col:0x00ddff},
  {id:'plasma',    name:'PLASMA',    col:0xff00ff},
  {id:'smoke',     name:'SMOKE',     col:0x888888},
  {id:'rainbow',   name:'PRISM',     col:0xffffff},
  {id:'lightning', name:'LIGHTNING', col:0xffff66},
  {id:'embers',    name:'EMBERS',    col:0xff8800},
  {id:'void',      name:'VOID',      col:0x6600ff},
  {id:'frost',     name:'FROST',     col:0xaaffff},
  {id:'gold',      name:'GOLD',      col:0xffcc00},
];

const TRIM_FINISHES = [
  {id:'gloss',  name:'GLOSS'},
  {id:'matte',  name:'MATTE'},
  {id:'carbon', name:'CARBON'},
  {id:'chrome', name:'CHROME'},
];

const PAINT_TARGETS = ['body','bumpers','trim','wheels','lights'];

const STICKERS = [
  {id:'none',    name:'NONE'},
  {id:'stripes', name:'STRIPES'},
  {id:'flame',   name:'FLAMES'},
  {id:'circuit', name:'CIRCUIT'},
  {id:'checker', name:'CHECKER'},
];

const SPOILERS = [
  {id:'stock',    name:'STOCK'},
  {id:'none',     name:'NONE'},
  {id:'lip',      name:'LIP'},
  {id:'ducktail', name:'DUCKTAIL'},
  {id:'wing',     name:'WING'},
  {id:'gt',       name:'GT WING'},
  {id:'bigwing',  name:'BIG WING'},
  {id:'roofwing', name:'ROOF WING'},
];

const TRIM_TOGGLES = [
  {id:'mirrors',  name:'MIRRORS',       def:true},
  {id:'splitter', name:'FRONT SPLITTER'},
  {id:'skirts',   name:'SIDE SKIRTS'},
  {id:'diffuser', name:'REAR DIFFUSER'},
  {id:'scoop',    name:'HOOD SCOOP',    stock:'scoop'},
  {id:'vents',    name:'HOOD VENTS'},
  {id:'flares',   name:'FENDER FLARES'},
  {id:'lightbar', name:'LIGHT BAR'},
  {id:'rack',     name:'ROOF RACK'},
  {id:'carbonroof', name:'ROOF PANEL'},
];

const F1_TRIM_TOGGLES = [
  {id:'frontwing', name:'FRONT WING', def:true},
  {id:'rearwing',  name:'REAR WING',  def:true},
  {id:'halo',      name:'HALO',       def:true},
  {id:'sidepods',  name:'SIDEPODS',   def:true},
  {id:'beamwing',  name:'BEAM WING',  def:true},
  {id:'fin',       name:'SHARK FIN',  def:true},
];

const PLANE_MODELS = [
  {id:'stunt',   name:'STUNT PLANE', livery:null,     accent:null},
  {id:'fighter', name:'FIGHTER JET', livery:0x8d96a0, accent:0x4d5560},
];

function hexCss(c) { return '#' + (c >>> 0).toString(16).padStart(6, '0').slice(-6); }

function paintForTarget(c, target, vh) {
  const key = target + 'Paint';
  if (c && c[key] !== undefined) return c[key];
  const L = vh.liv || {};
  const defs = {body: vh.col, bumpers: L.bumpers !== undefined ? L.bumpers : 0x222233, trim: L.trim !== undefined ? L.trim : vh.col, wheels: L.wheels !== undefined ? L.wheels : 0x999988, lights: 0xffffff};
  return defs[target];
}

// ═══════════════════════════════════════════════════════════════════════
// GEOMETRY HELPERS
// ═══════════════════════════════════════════════════════════════════════
let ENV_MAP = null;

function mergeGeos(list) {
  const parts = list.map(g => g.index ? g.toNonIndexed() : g);
  let n = 0;
  for (const g of parts) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array, o * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  for (const g of list) g.dispose();
  return out;
}

function place(g, x, y, z, rx, ry, rz) {
  if (rx) g.rotateX(rx);
  if (ry) g.rotateY(ry);
  if (rz) g.rotateZ(rz);
  g.translate(x || 0, y || 0, z || 0);
  return g;
}
const gBox = (w, h, d, x, y, z, rx, ry, rz) => place(new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz);
const gCylX = (r, len, x, y, z, seg) => place(new THREE.CylinderGeometry(r, r, len, seg || 14), x, y, z, 0, 0, Math.PI / 2);
const gCylZ = (r1, r2, len, x, y, z, seg) => place(new THREE.CylinderGeometry(r1, r2, len, seg || 14), x, y, z, Math.PI / 2);

// Extrude a side-view silhouette (points are [z, y]) across the car's width.
function extrudeSide(pts, width, bevel) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  const depth = Math.max(0.01, width - 2 * bevel);
  const g = new THREE.ExtrudeGeometry(s, {depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 2, steps: 1, curveSegments: 1});
  g.rotateY(-Math.PI / 2);
  g.translate(depth / 2, 0, 0);
  return g;
}

// Extrude a top-view outline (points are [x, z]) downward by depth.
function extrudeTop(pts, depth, bevel) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {depth, bevelEnabled: !!bevel, bevelThickness: bevel || 0, bevelSize: bevel || 0, bevelSegments: 1, steps: 1, curveSegments: 1});
  g.rotateX(Math.PI / 2);
  return g;
}

// ═══════════════════════════════════════════════════════════════════════
// MATERIALS
// ═══════════════════════════════════════════════════════════════════════
const SHARED = {};
function sharedMats() {
  if (SHARED.glass) return SHARED;
  const mk = (o) => { const m = new THREE.MeshStandardMaterial(o); m.userData.shared = true; return m; };
  SHARED.glass = mk({color: 0x0b1826, metalness: 0.95, roughness: 0.06, envMap: ENV_MAP, envMapIntensity: 1.4});
  SHARED.tire  = mk({color: 0x0c0c10, metalness: 0.1, roughness: 0.85});
  SHARED.dark  = mk({color: 0x10121a, metalness: 0.5, roughness: 0.5, envMap: ENV_MAP});
  SHARED.tail  = mk({color: 0x550000, emissive: 0xff1122, emissiveIntensity: 1.6});
  SHARED.glow  = mk({color: 0x003344, emissive: 0x00ddff, emissiveIntensity: 2});
  return SHARED;
}

function paintMat(col, o) {
  return new THREE.MeshStandardMaterial(Object.assign({color: col, metalness: 0.62, roughness: 0.28, envMap: ENV_MAP, envMapIntensity: 1.1}, o));
}

let _carbonTex = null;
function carbonTexture() {
  if (_carbonTex) return _carbonTex;
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  g.fillStyle = '#16171b'; g.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#2a2c33' : '#0d0e11'; g.fillRect(x * 8, y * 8, 8, 8); g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(x * 8, y * 8 + ((x + y) % 2 ? 0 : 4), 8, 2); }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); t.colorSpace = THREE.SRGBColorSpace; t.userData = {shared: true};
  return (_carbonTex = t);
}

function trimMat(col, finish) {
  if (finish === 'matte') return paintMat(col, {metalness: 0.1, roughness: 0.85});
  if (finish === 'carbon') return paintMat(0xffffff, {map: carbonTexture(), metalness: 0.55, roughness: 0.25, envMapIntensity: 1.3});
  if (finish === 'chrome') return paintMat(0xe8ecf4, {metalness: 1, roughness: 0.04, envMapIntensity: 1.8});
  return paintMat(col, {metalness: 0.5, roughness: 0.35});
}

function vehicleMats(vhId, c) {
  const vh = VEHICLES[vhId] || VEHICLES.civic_type_r;
  const lights = paintForTarget(c, 'lights', vh);
  return {
    body:   paintMat(paintForTarget(c, 'body', vh)),
    bumper: paintMat(paintForTarget(c, 'bumpers', vh), {metalness: 0.4, roughness: 0.45}),
    trim:   trimMat(paintForTarget(c, 'trim', vh), c && c.trimFinish),
    rim:    paintMat(paintForTarget(c, 'wheels', vh), {metalness: 0.9, roughness: 0.22}),
    light:  new THREE.MeshStandardMaterial({color: lights, emissive: lights, emissiveIntensity: 1.5}),
  };
}

// ═══════════════════════════════════════════════════════════════════════
// STICKER TEXTURES
// ═══════════════════════════════════════════════════════════════════════
const _stickerTex = {};
function stickerTexture(id) {
  if (_stickerTex[id]) return _stickerTex[id];
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  if (id === 'stripes') {
    g.fillStyle = 'rgba(255,255,255,0.95)';
    g.fillRect(78, 0, 40, 256); g.fillRect(138, 0, 40, 256);
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.fillRect(74, 0, 4, 256); g.fillRect(178, 0, 4, 256);
  } else if (id === 'flame') {
    for (let layer = 0; layer < 3; layer++) {
      g.fillStyle = ['#ff3300', '#ff9900', '#ffee44'][layer];
      const h = [235, 170, 105][layer];
      g.beginPath(); g.moveTo(0, 256);
      for (let i = 0; i <= 8; i++) {
        const x = i * 32, tip = h * (0.55 + 0.45 * Math.abs(Math.sin(i * 2.3 + layer)));
        g.quadraticCurveTo(x - 24, 256 - tip * 0.3, x - 12 + layer * 3, 256 - tip);
        g.quadraticCurveTo(x - 4, 256 - tip * 0.4, x, 256 - 20 + layer * 6);
      }
      g.lineTo(256, 256); g.closePath(); g.fill();
    }
  } else if (id === 'circuit') {
    g.strokeStyle = '#00ffee'; g.lineWidth = 5; g.lineCap = 'square'; g.fillStyle = '#00ffee';
    let seed = 7; const rr = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < 14; i++) {
      let x = 16 + Math.floor(rr() * 8) * 32, y = 16 + Math.floor(rr() * 8) * 32;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 3; k++) { if (rr() < 0.5) x += (rr() < 0.5 ? -1 : 1) * 32 * (1 + Math.floor(rr() * 2)); else y += (rr() < 0.5 ? -1 : 1) * 32 * (1 + Math.floor(rr() * 2)); g.lineTo(x, y); }
      g.stroke();
      g.beginPath(); g.arc(x, y, 8, 0, 6.3); g.fill();
    }
  } else if (id === 'checker') {
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      g.fillStyle = (x + y) % 2 ? 'rgba(10,10,14,0.92)' : 'rgba(250,250,250,0.92)';
      g.fillRect(x * 32, y * 32, 32, 32);
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  t.userData = {shared: true};
  return (_stickerTex[id] = t);
}

const _stickerMat = {};
function stickerMat(id) {
  if (_stickerMat[id]) return _stickerMat[id];
  const m = new THREE.MeshStandardMaterial({map: stickerTexture(id), transparent: true, metalness: 0.3, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false});
  m.userData.shared = true;
  return (_stickerMat[id] = m);
}

function addSticker(group, id, w, len, x, y, z, pitch, yaw) {
  if (!id || id === 'none') return;
  const g = new THREE.PlaneGeometry(w, len, 12, 12);
  let m;
  if (yaw) { m = new THREE.Mesh(g, stickerMat(id)); m.rotation.y = yaw; }
  else { g.rotateX(-Math.PI / 2); m = new THREE.Mesh(g, stickerMat(id)); m.rotation.x = pitch || 0; }
  m.position.set(x, y, z);
  m.renderOrder = 2;
  m.userData.sticker = true;
  group.add(m);
}

const _stRay = new THREE.Raycaster(), _stV = new THREE.Vector3(), _stN = new THREE.Vector3(), _stD = new THREE.Vector3();
function conformStickers(g, mats) {
  const stickers = [], hosts = [];
  g.traverse(o => {
    if (!o.isMesh) return;
    if (o.userData.sticker) stickers.push(o);
    else if (o.material === mats.body || o.material === mats.trim || o.material === mats.bumper) hosts.push(o);
  });
  if (!stickers.length) return;
  g.updateMatrixWorld(true);
  for (const m of stickers) {
    const geo = m.geometry, pos = geo.attributes.position, nor = geo.attributes.normal;
    m.updateMatrix();
    _stN.fromBufferAttribute(nor, 0).transformDirection(m.matrix).normalize();
    const ok = new Array(pos.count).fill(false);
    for (let i = 0; i < pos.count; i++) {
      _stV.fromBufferAttribute(pos, i).applyMatrix4(m.matrix);
      _stRay.set(_stD.copy(_stV).addScaledVector(_stN, 2.5), _stN.clone().negate());
      _stRay.far = 5;
      const hits = _stRay.intersectObjects(hosts, false);
      let best = null;
      for (const h of hits) if (!best || Math.abs(h.distance - 2.5) < Math.abs(best.distance - 2.5)) best = h;
      if (best && Math.abs(best.distance - 2.5) < 0.45) {
        const fn = best.face.normal.clone().transformDirection(best.object.matrixWorld);
        _stV.copy(best.point).addScaledVector(fn, 0.012);
        ok[i] = true;
      }
      pos.setXYZ(i, _stV.x, _stV.y, _stV.z);
    }
    const idx = geo.index.array, keep = [];
    for (let t = 0; t < idx.length; t += 3) if (ok[idx[t]] && ok[idx[t + 1]] && ok[idx[t + 2]]) keep.push(idx[t], idx[t + 1], idx[t + 2]);
    geo.setIndex(keep);
    geo.computeVertexNormals();
    m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.updateMatrix();
    if (!keep.length) m.visible = false;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// WHEELS
// ═══════════════════════════════════════════════════════════════════════
const _wheelGeo = {};
function wheelGeos(styleId, scale) {
  const key = styleId + '_' + scale;
  if (_wheelGeo[key]) return _wheelGeo[key];
  const st = WHEEL_STYLES.find(w => w.id === styleId) || WHEEL_STYLES[0];
  const r = st.radius * scale, w = st.width * scale * 0.9;
  const tire = new THREE.CylinderGeometry(r, r, w, 20); tire.rotateZ(Math.PI / 2);
  const rr = r * (st.thick ? 0.58 : 0.7);
  const parts = [gCylX(rr, w * 1.02, 0, 0, 0, 20)];
  parts.push(gCylX(rr * 0.28, w * 1.14, 0, 0, 0, 10));
  for (let i = 0; i < st.spokes; i++) {
    const a = (i / st.spokes) * Math.PI * 2;
    const sp = new THREE.BoxGeometry(w * 1.1, rr * 0.95, st.spokes > 8 ? 0.03 : 0.07);
    sp.translate(0, rr * 0.48, 0); sp.rotateX(a);
    parts.push(sp);
  }
  const rim = mergeGeos(parts);
  tire.userData = {shared: true}; rim.userData = {shared: true};
  return (_wheelGeo[key] = {tire, rim, r, w});
}

function makeWheel(styleId, scale, mats) {
  const wg = wheelGeos(styleId, scale);
  const steer = new THREE.Group(), spin = new THREE.Group();
  spin.add(new THREE.Mesh(wg.tire, sharedMats().tire));
  spin.add(new THREE.Mesh(wg.rim, mats.rim));
  steer.add(spin);
  steer.userData.spin = spin;
  steer.userData.r = wg.r; steer.userData.w = wg.w;
  return steer;
}

// ═══════════════════════════════════════════════════════════════════════
// CARS
// ═══════════════════════════════════════════════════════════════════════
const CAR_SPECS = {
  civic_type_r:  {L:4.4, W:2.0,  belt:0.98, hood:0.86, deck:0.96, cabR:-1.85, rr:0.3,  cabF:0.7,  wr:0.95, roof:1.5,  sp:'roofwing', wb:1.3},
  gr86:          {L:4.3, W:2.0,  belt:0.9,  hood:0.78, deck:0.9,  cabR:-1.2,  rr:0.85, cabF:0.6,  wr:0.8,  roof:1.32, sp:'lip',      wb:1.27},
  skyline_r34:   {L:4.7, W:2.05, belt:0.96, hood:0.88, deck:0.93, cabR:-1.15, rr:0.6,  cabF:0.65, wr:0.8,  roof:1.42, sp:'wing',     wb:1.42},
  mustang_gt500: {L:4.9, W:2.12, belt:1.0,  hood:0.96, deck:0.95, cabR:-1.55, rr:1.0,  cabF:0.35, wr:0.8,  roof:1.4,  sp:'lip',      wb:1.5, scoop:true},
  porsche_gt3:   {L:4.5, W:2.05, belt:0.86, hood:0.68, deck:0.8,  cabR:-1.9,  rr:1.45, cabF:0.7,  wr:1.0,  roof:1.3,  sp:'bigwing',  wb:1.3},
  lambo_huracan: {L:4.6, W:2.16, belt:0.74, hood:0.5,  deck:0.8,  cabR:-1.25, rr:1.0,  cabF:1.0,  wr:1.2,  roof:1.14, sp:'lip',      wb:1.42},
  ferrari_la:    {L:4.8, W:2.2,  belt:0.72, hood:0.48, deck:0.76, cabR:-1.1,  rr:0.9,  cabF:1.1,  wr:1.25, roof:1.1,  sp:'wing',     wb:1.48},
  bugatti_chiron:{L:4.7, W:2.2,  belt:0.82, hood:0.6,  deck:0.86, cabR:-1.3,  rr:1.0,  cabF:0.8,  wr:1.0,  roof:1.2,  sp:'none',     wb:1.45, bar:true},
};

function finishVehicle(g, kind, vhId, c, mats, extra) {
  conformStickers(g, mats);
  g.userData = Object.assign({kind, vhId, paint: mats.body.color.getHex(), wheels: [], front: []}, extra);
  g.traverse(o => { if (o.userData && o.userData.spin) { g.userData.wheels.push(o.userData.spin); if (o.userData.front) g.userData.front.push(o); } });
  return g;
}


function carTrims(c, S, G) {
  const tr = c.trims || {}, on = (id, d) => tr[id] === undefined ? !!d : !!tr[id];
  const trim = [], dark = [], light = [];
  const {hl, Wb, W, wr, ww, fr, wx, roofZ0, roofZ1, Wc} = G;
  const mid = (roofZ0 + roofZ1) / 2, sill = S.sillY || 0.28;

  if (on('mirrors', true)) for (const sx of [-1, 1]) {
    const mx = sx * (Wb / 2 + 0.2), mz = S.cabF - 0.16, my = S.belt + 0.1;
    trim.push(gBox(0.22, 0.13, 0.18, mx, my, mz));
    dark.push(gBox(0.2, 0.1, 0.02, mx, my, mz - 0.1), gBox(0.14, 0.04, 0.06, sx * (Wb / 2 + 0.06), my - 0.06, mz + 0.03));
  }

  const foil = (w, ch, th, x, y, z, tilt) => place(extrudeSide([[-ch / 2, 0], [-ch * 0.3, th], [ch * 0.25, th * 0.75], [ch / 2, th * 0.1], [ch * 0.2, -th * 0.15]], w, 0.01), x, y, z, tilt);
  const plate = (h, ch, x, y, z) => place(extrudeSide([[-ch * 0.55, 0], [ch * 0.55, 0], [ch * 0.4, h], [-ch * 0.5, h * 0.82]], 0.035, 0.004), x, y, z);
  const sp = tr.spoiler && tr.spoiler !== 'stock' ? tr.spoiler : S.sp, rz = -hl + 0.28, top = S.deck;
  if (sp === 'lip') trim.push(foil(Wb * 0.96, 0.3, 0.06, 0, top + 0.05, rz + 0.02, -0.2), plate(0.1, 0.28, Wb * 0.48, top + 0.03, rz + 0.02), plate(0.1, 0.28, -Wb * 0.48, top + 0.03, rz + 0.02));
  else if (sp === 'ducktail') trim.push(foil(Wb * 0.94, 0.46, 0.1, 0, top + 0.08, rz + 0.06, -0.36), foil(Wb * 0.94, 0.1, 0.07, 0, top + 0.22, rz - 0.14, -0.1));
  else if (sp === 'wing' || sp === 'bigwing' || sp === 'gt') {
    const big = sp === 'bigwing', gt = sp === 'gt';
    const wh = big ? 0.62 : gt ? 0.46 : 0.36, w2 = Wb * (big ? 1.08 : gt ? 1.04 : 0.98), ch = big ? 0.56 : gt ? 0.5 : 0.4;
    trim.push(foil(w2, ch, 0.07, 0, top + wh, rz, -0.14));
    if (big || gt) trim.push(foil(w2 * 0.97, ch * 0.5, 0.045, 0, top + wh + 0.12, rz - ch * 0.4, -0.55));
    if (gt) trim.push(foil(w2 * 0.9, 0.12, 0.05, 0, top + wh + 0.2, rz - ch * 0.55, -0.1));
    for (const sx of [-1, 1]) {
      trim.push(plate(big ? 0.4 : 0.3, ch * 1.2, sx * w2 / 2, top + wh - 0.1, rz), plate(0.04, ch * 1.2, sx * w2 / 2, top + wh - 0.1, rz));
      const px = sx * Wb * (gt ? 0.34 : 0.27);
      trim.push(gBox(0.06, wh * 1.04, 0.14, px, top + wh / 2, rz + 0.12, 0.3), gBox(0.1, 0.05, 0.3, px, top + 0.03, rz + 0.2));
    }
  } else if (sp === 'roofwing') {
    trim.push(foil(Wc * 0.98, 0.4, 0.06, 0, S.roof + 0.1, roofZ0 - 0.1, -0.12));
    for (const sx of [-1, 1]) trim.push(plate(0.2, 0.42, sx * Wc * 0.49, S.roof + 0.0, roofZ0 - 0.1));
  }

  if (on('splitter')) {
    const sy = S.splitY || 0.2;
    const sg = extrudeTop([[-W / 2 + 0.08, 0], [W / 2 - 0.08, 0], [W / 2 - 0.3, 0.62], [-W / 2 + 0.3, 0.62]], 0.045, 0.01); sg.translate(0, sy, hl - 0.05);
    trim.push(sg);
    for (const sx of [-1, 1]) {
      trim.push(gBox(0.03, 0.2, 0.34, sx * (W / 2 - 0.3), sy + 0.12, hl + 0.1, 0, sx * 0.3), gBox(0.03, 0.14, 0.3, sx * (W / 2 - 0.46), sy + 0.1, hl + 0.14, 0, sx * 0.3));
      trim.push(plate(0.14, 0.6, sx * (W / 2 - 0.1), sy, hl + 0.2));
      dark.push(gBox(0.03, 0.12, 0.03, sx * 0.5, sy + 0.06, hl + 0.2));
    }
  }
  if (on('skirts')) for (const sx of [-1, 1]) {
    const len = S.wb * 2 - wr * 2 + 0.7;
    const sk = extrudeSide([[-len / 2, 0], [len / 2, 0], [len / 2 - 0.3, 0.2], [-len / 2 + 0.3, 0.2]], 0.1, 0.02); sk.translate(sx * (W / 2 - 0.02), sill - 0.08, 0);
    trim.push(sk, gBox(0.16, 0.03, len - 0.5, sx * (W / 2 + 0.04), sill - 0.08, 0));
    for (let k = -2; k <= 2; k++) dark.push(gBox(0.02, 0.1, 0.05, sx * (W / 2 + 0.07), sill + 0.05, k * len * 0.16));
  }
  if (on('diffuser')) {
    trim.push(gBox(Wb - 0.5, 0.04, 0.62, 0, 0.2, -hl + 0.1, 0.2));
    for (let k = -2; k <= 2; k++) dark.push(gBox(0.04, 0.2, 0.5, k * 0.3, 0.28, -hl + 0.05, 0.15));
  }
  if (on('scoop', S.scoop)) {
    trim.push(gBox(0.74, 0.14, 0.9, 0, S.hood + 0.07, hl - 1.4, 0.06), gBox(0.62, 0.05, 0.5, 0, S.hood + 0.15, hl - 1.5, 0.12));
    dark.push(gBox(0.6, 0.1, 0.04, 0, S.hood + 0.09, hl - 0.96));
  }
  if (on('vents')) for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) dark.push(gBox(0.5, 0.03, 0.07, sx * 0.62, S.hood + 0.03, hl - 1.7 - k * 0.14, 0.1));
  if (on('flares')) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const f = new THREE.CylinderGeometry(fr + 0.1, fr + 0.1, ww + 0.34, 14, 1, true, 0, Math.PI);
    f.rotateZ(Math.PI / 2); f.translate(sx * (wx + 0.08), wr, sz * S.wb);
    trim.push(f, gBox(ww + 0.34, 0.07, (fr + 0.1) * 2, sx * (wx + 0.08), wr - 0.02, sz * S.wb));
    for (let k = 0; k < 5; k++) { const a = k / 4 * Math.PI; dark.push(gCylX(0.03, 0.06, sx * (wx + 0.08 + (ww + 0.34) / 2), wr + Math.sin(a) * (fr + 0.1), sz * S.wb + Math.cos(a) * (fr + 0.1), 6)); }
  }
  if (on('lightbar')) {
    trim.push(gBox(Wc * 0.78, 0.05, 0.2, 0, S.roof + 0.1, mid + 0.12));
    for (let k = 0; k < 6; k++) light.push(gBox(Wc * 0.78 / 6 - 0.03, 0.08, 0.06, -Wc * 0.39 + (k + 0.5) * Wc * 0.78 / 6, S.roof + 0.15, mid + 0.22));
  }
  if (on('carbonroof')) trim.push(gBox(Wc * 0.9, 0.035, Math.max(0.4, roofZ1 - roofZ0 - 0.06), 0, S.roof + 0.06, mid));
  if (on('rack')) {
    const len = Math.max(0.5, roofZ1 - roofZ0 - 0.1);
    for (const sx of [-1, 1]) { trim.push(gBox(0.04, 0.04, len, sx * Wc * 0.42, S.roof + 0.1, mid)); for (const z of [mid - len * 0.4, mid + len * 0.4]) trim.push(gBox(0.04, 0.08, 0.04, sx * Wc * 0.42, S.roof + 0.06, z)); }
    for (const z of [-0.35, 0, 0.35]) trim.push(gBox(Wc * 0.86, 0.035, 0.05, 0, S.roof + 0.11, mid + z * len * 0.9));
  }
  return {trim, dark, light};
}

const TRUCK = {L:5.4, W:2.0, belt:1.56, hood:1.5, deck:1.5, cabF:1.0, cabR:-0.58, roof:2.4, wb:1.85, sp:'none', sillY:0.62, splitY:0.46};

function makeTruckMesh(vhId, c) {
  const S = TRUCK, sm = sharedMats(), mats = vehicleMats(vhId, c), g = new THREE.Group();
  const L = S.L, W = S.W, hl = L / 2, Wb = W - 0.2, Wc = Wb * 0.92;
  const WS = 1.15, ws = WHEEL_STYLES.find(w => w.id === c.wheels) || WHEEL_STYLES[0];
  const wr = ws.radius * WS, ww = ws.width * WS * 0.9, wx = W / 2 - 0.02 - ww / 2, fr = wr + 0.1;
  const roofZ0 = -0.52, roofZ1 = 0.42;

  const body = [
    extrudeSide([[-hl, 0.7], [-hl, 1.12], [-0.58, 1.12], [-0.58, 1.56], [1.0, 1.56], [hl - 0.3, 1.5], [hl - 0.02, 1.36], [hl, 1.2], [hl - 0.04, 0.78], [hl - 0.2, 0.64], [-hl + 0.4, 0.62]], Wb, 0.08),
    extrudeSide([[roofZ0, 2.3], [roofZ1, 2.3], [roofZ1 + 0.03, 2.41], [roofZ0, 2.41]], Wc * 0.99, 0.04),
    gBox(Wc + 0.02, 0.72, 0.1, 0, 1.94, -0.04),
    gBox(0.1, 0.4, 2.12, Wb / 2 - 0.05, 1.33, -1.64), gBox(0.1, 0.4, 2.12, -(Wb / 2 - 0.05), 1.33, -1.64),
    gBox(Wb, 0.44, 0.1, 0, 1.34, -0.63), gBox(Wb - 0.1, 0.42, 0.08, 0, 1.33, -hl + 0.04),
    gBox(0.3, 0.22, 0.78, Wb / 2 - 0.25, 1.23, -1.85), gBox(0.3, 0.22, 0.78, -(Wb / 2 - 0.25), 1.23, -1.85),
  ];
  g.add(new THREE.Mesh(mergeGeos(body), mats.body));
  g.add(new THREE.Mesh(extrudeSide([[-0.56, 1.56], [0.98, 1.56], [roofZ1, 2.31], [roofZ0 + 0.02, 2.31]], Wc, 0.05), sm.glass));

  const bump = [
    gBox(W - 0.05, 0.3, 0.42, 0, 0.74, hl), gBox(W - 0.2, 0.2, 0.3, 0, 0.76, -hl + 0.08),
    gBox(0.5, 0.08, 0.4, 0, 0.9, -hl - 0.12), gBox(0.04, 0.5, 0.6, Wb / 2 + 0.02, 0.9, hl - 0.4), gBox(0.04, 0.5, 0.6, -Wb / 2 - 0.02, 0.9, hl - 0.4),
  ];
  g.add(new THREE.Mesh(mergeGeos(bump), mats.bumper));

  const T = carTrims(c, S, {hl, Wb, W, wr, ww, fr, wx, roofZ0, roofZ1, Wc});
  const grille = [gBox(Wb * 0.62, 0.05, 0.05, 0, 1.2, hl + 0.06), gBox(Wb * 0.62, 0.05, 0.05, 0, 1.08, hl + 0.06), gBox(Wb * 0.62, 0.05, 0.05, 0, 0.96, hl + 0.06), gBox(0.06, 0.34, 0.05, 0, 1.08, hl + 0.06)];
  g.add(new THREE.Mesh(mergeGeos(T.trim.concat(grille)), mats.trim));

  const heads = T.light;
  for (const sx of [-1, 1]) { heads.push(gBox(0.52, 0.14, 0.1, sx * (Wb / 2 - 0.3), 1.3, hl - 0.04)); heads.push(gBox(0.2, 0.1, 0.08, sx * (Wb / 2 - 0.35), 0.8, hl + 0.2)); }
  g.add(new THREE.Mesh(mergeGeos(heads), mats.light));
  const tails = [];
  for (const sx of [-1, 1]) tails.push(gBox(0.1, 0.38, 0.06, sx * (Wb / 2 - 0.08), 1.34, -hl + 0.01));
  g.add(new THREE.Mesh(mergeGeos(tails), sm.tail));

  const dark = T.dark.concat([
    gBox(Wb - 0.3, 0.3, L - 0.8, 0, 0.5, 0), gBox(Wb * 0.62, 0.42, 0.08, 0, 1.08, hl - 0.02),
    gBox(Wb - 0.2, 0.05, 2.0, 0, 1.13, -1.64), gBox(1.1, 0.06, 0.7, 0, 0.52, hl - 0.25),
    gBox(0.04, 0.05, 0.22, Wb / 2 + 0.01, 1.68, 0.4), gBox(0.04, 0.05, 0.22, -Wb / 2 - 0.01, 1.68, 0.4),
    gBox(0.04, 0.05, 0.22, Wb / 2 + 0.01, 1.68, -0.32), gBox(0.04, 0.05, 0.22, -Wb / 2 - 0.01, 1.68, -0.32),
    gCylZ(0.07, 0.07, 0.34, 0.62, 0.46, -hl - 0.08, 8),
  ]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const f = new THREE.CylinderGeometry(fr, fr, ww + 0.14, 14, 1, true, 0, Math.PI);
    f.rotateZ(Math.PI / 2); f.translate(sx * wx, wr, sz * S.wb);
    dark.push(f, gBox(0.05, wr * 1.9, fr * 2, sx * (Wb / 2 + 0.01), wr + 0.12, sz * S.wb));
  }
  g.add(new THREE.Mesh(mergeGeos(dark), sm.dark));

  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const w = makeWheel(ws.id, WS, mats);
    w.position.set(sx * wx, wr, sz * S.wb);
    w.userData.front = sz > 0;
    g.add(w);
  }

  const st = c.sticker;
  if (st && st !== 'none') {
    addSticker(g, st, Wb * 0.7, 1.4, 0, 1.51, hl - 1.2);
    addSticker(g, st, Wc * 0.8, roofZ1 - roofZ0 - 0.1, 0, 2.415, (roofZ0 + roofZ1) / 2);
    if (st !== 'stripes') for (const sx of [-1, 1]) addSticker(g, st, 2.2, 0.4, sx * (W / 2 - 0.095), 1.2, 0.5, 0, sx * Math.PI / 2);
  }

  return finishVehicle(g, 'car', vhId, c, mats, {len: L, gs: 0.88, exhaust: [new THREE.Vector3(0.62, 0.46, -hl - 0.22), new THREE.Vector3(0.62, 0.46, -hl - 0.22)]});
}

function makeCarMesh(vhId, c) {
  c = c || {};
  if (!VEHICLES[vhId]) vhId = 'civic_type_r';
  if (VEHICLES[vhId].type === 'f1') return makeF1Mesh(vhId, c);
  if (VEHICLES[vhId].type === 'truck') return makeTruckMesh(vhId, c);
  const S = CAR_SPECS[vhId], sm = sharedMats(), mats = vehicleMats(vhId, c);
  const g = new THREE.Group();
  const L = S.L, W = S.W, hl = L / 2, Wb = W - 0.4;
  const WS = 0.74, ws = WHEEL_STYLES.find(w => w.id === c.wheels) || WHEEL_STYLES[0];
  const wr = ws.radius * WS, ww = ws.width * WS * 0.9;

  // Body shell
  const body = [extrudeSide([
    [-hl + 0.22, 0.3], [hl - 0.22, 0.3], [hl, 0.5], [hl - 0.05, S.hood - 0.18], [hl - 0.6, S.hood],
    [S.cabF + 0.05, S.belt], [S.cabR - 0.05, S.belt], [-hl + 0.2, S.deck], [-hl, S.deck - 0.22], [-hl + 0.04, 0.5],
  ], Wb, 0.1)];
  const roofZ0 = S.cabR + S.rr, roofZ1 = S.cabF - S.wr, Wc = Wb * 0.88;
  body.push(extrudeSide([[roofZ0 - 0.02, S.roof - 0.04], [roofZ1 + 0.02, S.roof - 0.04], [roofZ1 - 0.06, S.roof + 0.035], [roofZ0 + 0.06, S.roof + 0.035]], Wc * 0.97, 0.03));
  // Fender flares + door panels
  const wx = W / 2 - 0.02 - ww / 2, fr = wr + 0.09;
  const dh = Math.min(wr + 0.3, S.belt - 0.36), fh = Math.min(wr + 0.08, S.hood - 0.42), rh = Math.min(wr + 0.12, S.deck - 0.42);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const f = new THREE.CylinderGeometry(fr, fr, ww + 0.1, 12, 1, true, 0, Math.PI);
      f.rotateZ(Math.PI / 2); f.translate(sx * wx, wr, sz * S.wb);
      body.push(f);
      body.push(gBox(ww + 0.1, 0.06, fr * 2, sx * wx, wr - 0.03 + 0.001, sz * S.wb));
    }
    const dz0 = -S.wb + fr * 0.8, dz1 = S.wb - fr * 0.8;
    body.push(gBox(0.24, dh, dz1 - dz0, sx * (W / 2 - 0.13), 0.32 + dh / 2, (dz0 + dz1) / 2));
    body.push(gBox(0.24, fh, hl - S.wb - fr * 0.8 - 0.12, sx * (W / 2 - 0.13), 0.36 + fh / 2, (S.wb + fr * 0.8 + hl - 0.12) / 2));
    body.push(gBox(0.24, rh, hl - S.wb - fr * 0.8 - 0.1, sx * (W / 2 - 0.13), 0.36 + rh / 2, -(S.wb + fr * 0.8 + hl - 0.1) / 2));
  }
  g.add(new THREE.Mesh(mergeGeos(body), mats.body));

  // Glass
  g.add(new THREE.Mesh(extrudeSide([[S.cabR, S.belt - 0.03], [S.cabF, S.belt - 0.03], [roofZ1, S.roof], [roofZ0, S.roof]], Wc, 0.08), sm.glass));

  // Bumpers, splitter, skirts
  const bump = [
    gBox(W - 0.1, 0.1, 0.5, 0, 0.27, hl - 0.2),
    gBox(W - 0.2, 0.22, 0.14, 0, 0.42, hl + 0.02),
    gBox(W - 0.2, 0.2, 0.3, 0, 0.3, -hl + 0.1),
    gBox(W - 0.3, 0.2, 0.12, 0, 0.5, -hl - 0.02),
  ];
  for (const sx of [-1, 1]) bump.push(gBox(0.12, 0.12, S.wb * 2 - wr * 2, sx * (W / 2 - 0.04), 0.3, 0));
  g.add(new THREE.Mesh(mergeGeos(bump), mats.bumper));

  // Trims (optional, chosen in the garage)
  const T = carTrims(c, S, {hl, Wb, W, wr, ww, fr, wx, roofZ0, roofZ1, Wc});
  if (T.trim.length) g.add(new THREE.Mesh(mergeGeos(T.trim), mats.trim));

  // Lights
  const hy = Math.min(S.hood - 0.16, 0.74), heads = T.light;
  for (const sx of [-1, 1]) heads.push(gBox(0.46, 0.13, 0.12, sx * (Wb / 2 - 0.3), hy, hl - 0.03));
  g.add(new THREE.Mesh(mergeGeos(heads), mats.light));
  const tails = [];
  if (S.bar) tails.push(gBox(Wb - 0.1, 0.07, 0.1, 0, S.deck - 0.2, -hl + 0.01));
  else for (const sx of [-1, 1]) tails.push(gBox(0.5, 0.12, 0.1, sx * (Wb / 2 - 0.3), S.deck - 0.2, -hl + 0.01));
  g.add(new THREE.Mesh(mergeGeos(tails), sm.tail));

  // Dark: chassis, grille, exhaust tips
  const dark = T.dark.concat([gBox(Wb - 0.1, 0.2, L - 0.6, 0, 0.3, 0), gBox(Wb * 0.6, 0.16, 0.08, 0, 0.5, hl + 0.06)]);
  for (const sx of [-1, 1]) dark.push(gCylZ(0.09, 0.09, 0.3, sx * 0.45, 0.34, -hl - 0.05, 8));
  g.add(new THREE.Mesh(mergeGeos(dark), sm.dark));

  // Wheels
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const w = makeWheel(ws.id, WS, mats);
    w.position.set(sx * wx, wr, sz * S.wb);
    w.userData.front = sz > 0;
    g.add(w);
  }

  // Stickers
  const st = c.sticker;
  if (st && st !== 'none') {
    const z1 = S.cabF + 0.12, z2 = hl - 0.65, y1 = S.belt + 0.115, y2 = S.hood + 0.115;
    addSticker(g, st, Wb * 0.78, Math.hypot(z2 - z1, y1 - y2), 0, (y1 + y2) / 2, (z1 + z2) / 2, Math.atan2(y1 - y2, z2 - z1));
    addSticker(g, st, Wc * 0.82, Math.max(0.1, roofZ1 - roofZ0 - 0.08), 0, S.roof + 0.045, (roofZ0 + roofZ1) / 2);
    const dl = S.wb * 2 - fr * 1.8;
    if (st !== 'stripes') for (const sx of [-1, 1]) addSticker(g, st, dl, dh - 0.08, sx * (W / 2 - 0.005), 0.32 + dh / 2, 0, 0, sx * Math.PI / 2);
  }

  return finishVehicle(g, 'car', vhId, c, mats, {
    len: L, exhaust: [new THREE.Vector3(-0.45, 0.34, -hl - 0.2), new THREE.Vector3(0.45, 0.34, -hl - 0.2)],
  });
}

function makeF1Mesh(vhId, c) {
  const sm = sharedMats(), mats = vehicleMats(vhId, c), g = new THREE.Group();
  const tg = c.trims || {}, on = id => tg[id] === undefined ? true : !!tg[id];
  const WS = 0.72, ws = WHEEL_STYLES.find(w => w.id === c.wheels) || WHEEL_STYLES[0];
  const wr = ws.radius * WS, FZ = 1.85, RZ = -1.75;

  // Chassis: monocoque, engine cover, airbox, sidepods
  const body = [
    extrudeSide([[2.35, 0.24], [2.35, 0.36], [1.5, 0.5], [0.55, 0.68], [0.05, 0.74], [-0.45, 0.82], [-0.55, 0.3], [1.3, 0.22]], 0.62, 0.1),
    extrudeSide([[-0.3, 0.8], [-0.7, 1.0], [-1.3, 0.92], [-2.2, 0.62], [-2.4, 0.46], [-2.35, 0.32], [-0.3, 0.3]], 0.36, 0.08),
    gBox(0.3, 0.3, 0.42, 0, 1.04, -0.6),
  ];
  if (on('fin')) body.push(extrudeSide([[-0.95, 0.98], [-2.1, 0.96], [-2.3, 0.62], [-0.95, 0.62]], 0.03, 0.005));
  if (on('sidepods')) for (const sx of [-1, 1]) {
    const pts = [[0.2, 0.75], [0.36, 0.62], [0.64, 0.5], [0.66, -0.5], [0.42, -1.7], [0.18, -2.0]].map(v => [sx * v[0], v[1]]);
    const sp = extrudeTop(pts, 0.4, 0.04); sp.translate(0, 0.62, 0);
    body.push(sp);
  }
  g.add(new THREE.Mesh(mergeGeos(body), mats.body));

  // Driver
  g.add(new THREE.Mesh(place(new THREE.SphereGeometry(0.15, 10, 8), 0, 0.88, 0.02), mats.light));
  g.add(new THREE.Mesh(place(new THREE.SphereGeometry(0.1, 8, 6), 0, 0.88, 0.14).scale(1.2, 0.5, 0.6).translate(0, 0.36, 0.0), sm.glass));

  // Wings and aero
  const trim = [];
  if (on('frontwing')) trim.push(gBox(2.05, 0.04, 0.5, 0, 0.14, 2.7), gBox(1.95, 0.03, 0.28, 0, 0.23, 2.74, -0.28), gBox(1.85, 0.03, 0.22, 0, 0.31, 2.76, -0.4));
  if (on('rearwing')) trim.push(gBox(1.0, 0.05, 0.5, 0, 1.14, -2.45, -0.16), gBox(1.0, 0.04, 0.3, 0, 1.32, -2.56, -0.55));
  if (on('beamwing')) trim.push(gBox(0.9, 0.03, 0.22, 0, 0.5, -2.62, -0.12));
  if (trim.length) g.add(new THREE.Mesh(mergeGeos(trim), mats.trim));
  const bump = [gBox(1.55, 0.04, 3.5, 0, 0.2, -0.2)];
  for (const sx of [-1, 1]) {
    if (on('frontwing')) bump.push(gBox(0.04, 0.32, 0.72, sx * 1.02, 0.24, 2.66));
    if (on('rearwing')) bump.push(gBox(0.04, 0.58, 0.82, sx * 0.52, 1.06, -2.5));
    bump.push(gBox(0.03, 0.12, 3.1, sx * 0.76, 0.24, -0.1));
  }
  g.add(new THREE.Mesh(mergeGeos(bump), mats.bumper));

  const dark = [];
  if (on('rearwing')) dark.push(gBox(0.08, 0.58, 0.28, 0, 0.86, -2.32));
  if (on('frontwing')) for (const sx of [-1, 1]) dark.push(gBox(0.05, 0.16, 0.5, sx * 0.12, 0.2, 2.42));
  if (on('halo')) {
    const halo = new THREE.TorusGeometry(0.3, 0.032, 6, 14, Math.PI); halo.rotateX(-Math.PI / 2); halo.rotateY(Math.PI); halo.translate(0, 0.98, 0.1);
    dark.push(halo, gBox(0.05, 0.3, 0.05, 0, 0.84, 0.44));
  }
  dark.push(gBox(0.22, 0.2, 0.03, 0, 1.04, -0.38));
  for (const sx of [-1, 1]) {
    dark.push(gBox(0.44, 0.28, 0.04, sx * 0.53, 0.5, 0.78));
    for (const sz of [-1, 1]) {
      const z0 = sz > 0 ? FZ : RZ, wx0 = sz > 0 ? 0.82 : 0.88;
      dark.push(gBox(wx0 - 0.3, 0.03, 0.04, sx * (0.3 + (wx0 - 0.3) / 2), 0.42, z0 + 0.22, 0, 0, sx * 0.12), gBox(wx0 - 0.3, 0.03, 0.04, sx * (0.3 + (wx0 - 0.3) / 2), 0.36, z0 - 0.22, 0, 0, -sx * 0.1));
    }
  }
  for (let k = -2; k <= 2; k++) dark.push(gBox(0.03, 0.18, 0.7, k * 0.26, 0.3, -2.1, 0.32));
  dark.push(gBox(1.0, 0.04, 0.7, 0, 0.26, -2.15, 0.32));
  g.add(new THREE.Mesh(mergeGeos(dark), sm.dark));

  g.add(new THREE.Mesh(mergeGeos([gBox(0.16, 0.12, 0.04, 0, 0.58, -2.4), gBox(0.1, 0.07, 0.04, 0, 0.5, -2.62)]), sm.tail));
  g.add(new THREE.Mesh(mergeGeos([gBox(0.12, 0.05, 0.05, -0.3, 0.37, 2.1), gBox(0.12, 0.05, 0.05, 0.3, 0.37, 2.1)]), mats.light));

  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const w = makeWheel(ws.id, WS, mats), want = sz > 0 ? 0.4 : 0.5;
    w.scale.x = want / w.userData.w;
    w.position.set(sx * (sz > 0 ? 0.82 : 0.88), wr, sz > 0 ? FZ : RZ);
    w.userData.front = sz > 0;
    g.add(w);
  }
  if (c.sticker && c.sticker !== 'none') addSticker(g, c.sticker, 0.5, 1.5, 0, 0.7, 1.15, Math.atan2(0.2, 1.5));
  return finishVehicle(g, 'car', vhId, c, mats, {len: 5.6, gs: 0.92, exhaust: [new THREE.Vector3(-0.08, 0.52, -2.5), new THREE.Vector3(0.08, 0.52, -2.5)]});
}

// ═══════════════════════════════════════════════════════════════════════
// BOAT
// ═══════════════════════════════════════════════════════════════════════
function makeBoatMesh(vhId, c) {
  c = c || {};
  const vh = VEHICLES[vhId] || VEHICLES.civic_type_r, sm = sharedMats();
  const hullCol = c.boatHullPaint !== undefined ? c.boatHullPaint : paintForTarget(c, 'body', vh);
  const accCol = c.boatAccentPaint !== undefined ? c.boatAccentPaint : paintForTarget(c, 'trim', vh);
  const mats = {body: paintMat(hullCol), trim: paintMat(accCol, {emissive: accCol, emissiveIntensity: 0.25})};
  const g = new THREE.Group();
  const outline = [[-1.15, -2.7], [1.15, -2.7], [1.25, -0.5], [1.0, 1.4], [0.5, 2.7], [0, 3.3], [-0.5, 2.7], [-1.0, 1.4], [-1.25, -0.5]];
  const hull = extrudeTop(outline, 1.0, 0.06);
  const p = hull.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), z = p.getZ(i);
    if (y < -0.4) { p.setX(i, p.getX(i) * 0.35); p.setY(i, y + Math.max(0, z - 0.8) * 0.3); }
  }
  hull.translate(0, 0.75, 0); hull.computeVertexNormals();
  g.add(new THREE.Mesh(hull, mats.body));
  const trim = [];
  const deck = extrudeTop(outline.map(v => [v[0] * 0.82, v[1] * 0.9 + 0.1]), 0.06); deck.translate(0, 0.84, 0);
  trim.push(deck);
  for (const sx of [-1, 1]) trim.push(gBox(0.06, 0.14, 3.6, sx * 1.24, 0.6, -0.8));
  trim.push(gBox(1.9, 0.06, 0.5, 0, 1.55, -2.3, -0.15), gBox(0.08, 0.7, 0.3, -0.85, 1.2, -2.3), gBox(0.08, 0.7, 0.3, 0.85, 1.2, -2.3));
  g.add(new THREE.Mesh(mergeGeos(trim), mats.trim));
  g.add(new THREE.Mesh(gBox(1.5, 0.5, 0.08, 0, 1.12, 0.55, -0.6), sm.glass));
  const dark = [gBox(1.5, 0.3, 1.5, 0, 0.92, -0.5), gBox(0.7, 0.7, 0.8, 0, 0.95, -2.75), gCylZ(0.2, 0.26, 0.5, 0, 0.3, -3.1, 10)];
  g.add(new THREE.Mesh(mergeGeos(dark), sm.dark));
  g.add(new THREE.Mesh(gBox(1.6, 0.08, 0.05, 0, 0.6, -2.72), sm.tail));
  if (c.sticker && c.sticker !== 'none') addSticker(g, c.sticker, 1.3, 1.7, 0, 0.915, 1.75);
  return finishVehicle(g, 'boat', vhId, c, mats, {len: 6, exhaust: [new THREE.Vector3(-0.3, 0.15, -3.3), new THREE.Vector3(0.3, 0.15, -3.3)]});
}

// ═══════════════════════════════════════════════════════════════════════
// PLANE
// ═══════════════════════════════════════════════════════════════════════
function makePlaneMesh(vhId, c) {
  c = c || {};
  if (c.planeModel === 'fighter') return makeFighterMesh(vhId, c);
  const vh = VEHICLES[vhId] || VEHICLES.civic_type_r, sm = sharedMats();
  const livery = c.planeLiveryPaint !== undefined ? c.planeLiveryPaint : paintForTarget(c, 'body', vh);
  const accent = c.planeAccentPaint !== undefined ? c.planeAccentPaint : paintForTarget(c, 'trim', vh);
  const mats = {body: paintMat(livery), trim: paintMat(accent)};
  const g = new THREE.Group();
  const prof = [[0, -3.3], [0.3, -3.2], [0.52, -1.8], [0.62, 0.2], [0.55, 1.6], [0.32, 2.7], [0.1, 3.3], [0, 3.45]];
  const fus = new THREE.LatheGeometry(prof.map(v => new THREE.Vector2(v[0], v[1])), 14);
  fus.rotateX(Math.PI / 2); fus.scale(1, 0.9, 1);
  const fin = extrudeSide([[-3.2, 0.3], [-2.0, 0.4], [-2.9, 1.6], [-3.4, 1.6]], 0.1, 0.02);
  g.add(new THREE.Mesh(mergeGeos([fus, fin]), mats.body));
  const wing = (pts, y) => { const w = extrudeTop(pts, 0.1, 0.02); w.translate(0, y, 0); return w; };
  const mw = [[0.3, 1.0], [4.4, -1.0], [4.4, -1.7], [0.3, -1.1]], tw = [[0.2, -2.3], [1.7, -3.0], [1.7, -3.4], [0.2, -3.2]];
  const mir = pts => pts.map(v => [-v[0], v[1]]).reverse();
  const wings = [wing(mw, 0.02), wing(mir(mw), 0.02), wing(tw, 0.3), wing(mir(tw), 0.3)];
  for (const sx of [-1, 1]) wings.push(gBox(0.06, 0.5, 0.8, sx * 4.4, 0.2, -1.35));
  g.add(new THREE.Mesh(mergeGeos(wings), mats.trim));
  const can = new THREE.SphereGeometry(0.45, 12, 8); can.scale(0.85, 0.75, 2.1); can.translate(0, 0.42, 1.0);
  g.add(new THREE.Mesh(can, sm.glass));
  const dark = [];
  for (const sx of [-1, 1]) dark.push(gCylZ(0.3, 0.36, 2.0, sx * 1.5, -0.2, -0.6, 10));
  g.add(new THREE.Mesh(mergeGeos(dark), sm.dark));
  const glow = [];
  for (const sx of [-1, 1]) glow.push(gCylZ(0.26, 0.26, 0.06, sx * 1.5, -0.2, -1.62, 10));
  g.add(new THREE.Mesh(mergeGeos(glow), sm.glow));
  if (c.sticker && c.sticker !== 'none') for (const sx of [-1, 1]) addSticker(g, c.sticker, 1.6, 1.2, sx * 2.2, 0.035, -0.5);
  return finishVehicle(g, 'plane', vhId, c, mats, {len: 6.8, exhaust: [new THREE.Vector3(-1.5, -0.2, -1.8), new THREE.Vector3(1.5, -0.2, -1.8)]});
}

function makeFighterMesh(vhId, c) {
  const sm = sharedMats(), g = new THREE.Group();
  const model = PLANE_MODELS[1];
  const livery = c.planeLiveryPaint !== undefined ? c.planeLiveryPaint : model.livery;
  const accent = c.planeAccentPaint !== undefined ? c.planeAccentPaint : model.accent;
  const mats = {body: paintMat(livery, {metalness: 0.5, roughness: 0.4}), trim: paintMat(accent, {metalness: 0.5, roughness: 0.4})};
  const missile = new THREE.MeshStandardMaterial({color: 0xe8eaee, metalness: 0.3, roughness: 0.4}); missile.userData.shared = false;

  const prof = [[0, 4.2], [0.08, 3.9], [0.24, 3.2], [0.4, 2.3], [0.54, 1.2], [0.62, 0], [0.62, -1.4], [0.54, -2.5], [0.46, -3.2], [0, -3.3]];
  const fus = new THREE.LatheGeometry(prof.map(v => new THREE.Vector2(v[0], v[1])), 16);
  fus.rotateX(Math.PI / 2); fus.scale(1.25, 0.74, 1);
  const fins = [];
  for (const sx of [-1, 1]) {
    const f = extrudeSide([[-2.2, 0.35], [-3.4, 0.4], [-3.7, 1.75], [-3.0, 1.75]], 0.06, 0.012);
    f.rotateZ(sx * -0.32); f.translate(sx * 0.62, 0.1, 0);
    fins.push(f);
  }
  g.add(new THREE.Mesh(mergeGeos([fus].concat(fins)), mats.body));

  const wing = (pts, y) => { const w = extrudeTop(pts, 0.07, 0.015); w.translate(0, y, 0); return w; };
  const mir = pts => pts.map(v => [-v[0], v[1]]).reverse();
  const mw = [[0.5, 1.5], [3.2, -1.9], [3.2, -2.5], [0.5, -2.5]], tp = [[0.5, -2.3], [2.0, -3.15], [2.0, -3.55], [0.5, -3.3]], cn = [[0.5, 2.5], [1.5, 1.7], [1.5, 1.45], [0.5, 1.7]];
  const wings = [wing(mw, 0.02), wing(mir(mw), 0.02), wing(tp, 0.0), wing(mir(tp), 0.0), wing(cn, 0.12), wing(mir(cn), 0.12)];
  g.add(new THREE.Mesh(mergeGeos(wings), mats.trim));

  const can = new THREE.SphereGeometry(0.42, 14, 10); can.scale(0.75, 0.7, 2.4); can.translate(0, 0.38, 1.7);
  g.add(new THREE.Mesh(can, sm.glass));

  const dark = [];
  for (const sx of [-1, 1]) {
    dark.push(gBox(0.5, 0.42, 1.3, sx * 0.68, -0.12, 1.05), gCylZ(0.3, 0.38, 1.0, sx * 0.4, 0, -3.1, 12), gBox(0.06, 0.1, 0.5, sx * 3.2, 0.03, -2.2));
  }
  dark.push(gBox(0.5, 0.1, 1.0, 0, -0.44, 0.4));
  g.add(new THREE.Mesh(mergeGeos(dark), sm.dark));

  const glow = [];
  for (const sx of [-1, 1]) glow.push(gCylZ(0.27, 0.27, 0.08, sx * 0.4, 0, -3.62, 12));
  g.add(new THREE.Mesh(mergeGeos(glow), sm.glow));

  const ms = [];
  for (const sx of [-1, 1]) {
    ms.push(gCylZ(0.075, 0.075, 1.9, sx * 3.35, 0, -1.6, 8));
    const nose = new THREE.ConeGeometry(0.075, 0.3, 8); nose.rotateX(Math.PI / 2); nose.translate(sx * 3.35, 0, -0.5); ms.push(nose);
    ms.push(gBox(0.16, 0.16, 0.04, sx * 3.35, 0, -2.45, 0, 0, Math.PI / 4), gBox(0.16, 0.04, 0.16, sx * 3.35, 0, -2.45, 0, 0, Math.PI / 4));
    ms.push(gCylZ(0.07, 0.07, 1.2, sx * 1.6, -0.2, -0.6, 8));
    const n2 = new THREE.ConeGeometry(0.07, 0.25, 8); n2.rotateX(Math.PI / 2); n2.translate(sx * 1.6, -0.2, 0.1); ms.push(n2);
  }
  g.add(new THREE.Mesh(mergeGeos(ms), missile));

  if (c.sticker && c.sticker !== 'none') for (const sx of [-1, 1]) addSticker(g, c.sticker, 1.4, 1.4, sx * 1.9, 0.045, -1.1);
  return finishVehicle(g, 'plane', vhId, c, mats, {len: 8, gs: 0.85, exhaust: [new THREE.Vector3(-0.4, 0, -3.7), new THREE.Vector3(0.4, 0, -3.7)]});
}

function makeVehicleMesh(mode, vhId, c) {
  if (mode === 'boat') return makeBoatMesh(vhId, c);
  if (mode === 'plane') return makePlaneMesh(vhId, c);
  return makeCarMesh(vhId, c);
}

function disposeGroup(g) {
  g.traverse(o => {
    if (o.geometry && !(o.geometry.userData && o.geometry.userData.shared)) o.geometry.dispose();
    const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of ms) if (!m.userData.shared) m.dispose();
  });
}
