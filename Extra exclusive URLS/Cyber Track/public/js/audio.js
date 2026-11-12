'use strict';
const Snd = (() => {
  let ac = null, master, sfxBus, engBus, musBus, noiseBuf, muted = false, eng = null, riv = null, musT = null, step = 0;
  try { muted = localStorage.getItem('ct_mute') === '1'; } catch (e) {}

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ac.destination);
    const comp = ac.createDynamicsCompressor(); comp.connect(master);
    sfxBus = ac.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(comp);
    engBus = ac.createGain(); engBus.gain.value = 0.5; engBus.connect(comp);
    musBus = ac.createGain(); musBus.gain.value = 0.16; musBus.connect(comp);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    startMusic();
  }

  const now = () => ac.currentTime;
  function env(g, t, a, peak, dur) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }

  function tone(f0, f1, dur, type, vol, delay, bus) {
    if (!ac) return;
    const t = now() + (delay || 0), o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    env(g, t, 0.01, vol || 0.3, dur);
    o.connect(g); g.connect(bus || sfxBus); o.start(t); o.stop(t + dur + 0.05);
  }

  function noise(dur, f0, f1, vol, delay, q, type, bus) {
    if (!ac) return;
    const t = now() + (delay || 0), s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; s.loop = true;
    f.type = type || 'lowpass'; f.Q.value = q || 0.7; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    env(g, t, 0.01, vol || 0.3, dur);
    s.connect(f); f.connect(g); g.connect(bus || sfxBus); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  const SFX = {
    click:   () => tone(900, 600, 0.06, 'square', 0.12),
    select:  () => { tone(500, 800, 0.08, 'triangle', 0.2); tone(800, 1200, 0.1, 'triangle', 0.18, 0.07); },
    pickup:  () => [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.14, 'square', 0.14, i * 0.05)),
    boost:   () => { noise(0.7, 400, 5000, 0.35, 0, 1.2, 'bandpass'); tone(160, 700, 0.5, 'sawtooth', 0.12); },
    repair:  () => { tone(440, 880, 0.3, 'sine', 0.25); tone(660, 1320, 0.3, 'sine', 0.2, 0.1); },
    shield:  () => { tone(300, 900, 0.4, 'triangle', 0.25); noise(0.4, 3000, 8000, 0.1, 0, 1, 'highpass'); },
    bump:    () => { tone(140, 50, 0.18, 'sine', 0.5); noise(0.14, 1500, 200, 0.3); },
    wall:    () => noise(0.18, 3500, 700, 0.18, 0, 2, 'bandpass'),
    land:    () => { tone(110, 40, 0.25, 'sine', 0.6); noise(0.2, 900, 120, 0.25); },
    hit:     () => { tone(220, 60, 0.3, 'sawtooth', 0.35); noise(0.3, 2500, 150, 0.4); },
    explode: () => { noise(1.1, 2500, 60, 0.7); tone(90, 28, 0.9, 'sine', 0.7); tone(200, 50, 0.5, 'sawtooth', 0.2); },
    missile: () => { noise(0.9, 800, 6000, 0.35, 0, 1, 'bandpass'); tone(300, 120, 0.7, 'sawtooth', 0.12); },
    emp:     () => { tone(1200, 90, 0.8, 'sawtooth', 0.3); noise(0.6, 6000, 300, 0.25, 0, 1, 'bandpass'); },
    lightning: () => { noise(0.5, 9000, 800, 0.6, 0, 0.5, 'highpass'); tone(80, 40, 0.6, 'sine', 0.6, 0.05); },
    warp:    () => { tone(200, 2400, 0.35, 'sine', 0.3); tone(2400, 150, 0.4, 'sine', 0.25, 0.35); },
    spring:  () => { tone(180, 700, 0.12, 'sine', 0.4); tone(700, 300, 0.25, 'sine', 0.3, 0.1); },
    cryo:    () => { [2200, 2800, 3300, 3900].forEach((f, i) => tone(f, f * 0.8, 0.5, 'sine', 0.1, i * 0.04)); noise(0.5, 9000, 4000, 0.12, 0, 1, 'highpass'); },
    leech:   () => { tone(520, 140, 0.45, 'sawtooth', 0.2); tone(260, 520, 0.3, 'sine', 0.2, 0.3); },
    scramble:() => { for (let i = 0; i < 6; i++) tone(300 + Math.random() * 1500, 300 + Math.random() * 1500, 0.06, 'square', 0.12, i * 0.06); },
    ghost:   () => { tone(900, 300, 0.6, 'sine', 0.2); tone(905, 303, 0.6, 'sine', 0.2); },
    jugger:  () => { tone(90, 60, 0.6, 'sawtooth', 0.4); tone(180, 120, 0.6, 'square', 0.15); },
    swap:    () => { tone(400, 800, 0.15, 'square', 0.18); tone(800, 400, 0.15, 'square', 0.18, 0.15); },
    nearmiss:() => { tone(900, 1700, 0.12, 'triangle', 0.22); tone(1300, 2200, 0.15, 'triangle', 0.18, 0.08); },
    vote:    () => { tone(660, 660, 0.18, 'triangle', 0.25); tone(990, 990, 0.3, 'triangle', 0.25, 0.14); },
    votedone:() => { tone(440, 440, 0.12, 'square', 0.15); tone(660, 660, 0.12, 'square', 0.15, 0.1); tone(880, 880, 0.25, 'square', 0.15, 0.2); },
    alarm:   () => { tone(880, 880, 0.12, 'square', 0.15); tone(660, 660, 0.12, 'square', 0.15, 0.16); },
    swell:   () => { noise(1.2, 200, 3000, 0.35, 0, 1, 'bandpass'); },
    win:     () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, f, 0.22, 'square', 0.16, i * 0.12)),
    lose:    () => [440, 392, 349, 262].forEach((f, i) => tone(f, f * 0.98, 0.32, 'sawtooth', 0.15, i * 0.2)),
    trackswap:() => { noise(0.8, 300, 5000, 0.3, 0, 1, 'bandpass'); tone(300, 1200, 0.6, 'triangle', 0.2); },
    zone:    () => tone(300, 150, 0.35, 'triangle', 0.25),
    drift:   () => noise(0.25, 2800, 1800, 0.08, 0, 3, 'bandpass'),
    crash:   () => { noise(0.5, 3500, 150, 0.6); tone(120, 40, 0.4, 'sine', 0.6); [1800, 2700, 3900, 5200].forEach((f, i) => tone(f, f * 0.7, 0.35, 'square', 0.07, 0.02 + i * 0.03)); noise(0.35, 9000, 3000, 0.25, 0.08, 1, 'highpass'); },
    crashbig:() => { noise(0.9, 4000, 90, 0.8); tone(90, 28, 0.7, 'sine', 0.8); [1500, 2300, 3100, 4400, 6000].forEach((f, i) => tone(f, f * 0.6, 0.5, 'square', 0.08, 0.03 + i * 0.04)); noise(0.6, 9000, 2000, 0.3, 0.1, 1, 'highpass'); },
    pass:    () => noise(0.4, 600, 2600, 0.18, 0, 1.4, 'bandpass'),
    pop:     () => { noise(0.07, 2500, 400, 0.3); tone(200, 90, 0.08, 'square', 0.18); noise(0.05, 2200, 500, 0.22, 0.09); },
    launch:  () => { noise(0.35, 500, 2400, 0.2, 0, 1, 'bandpass'); tone(80, 160, 0.25, 'sine', 0.3); },
    splash:  () => { noise(0.5, 3000, 500, 0.35, 0, 0.8, 'bandpass'); tone(200, 70, 0.3, 'sine', 0.3); },
    shift:   () => { noise(0.08, 3000, 800, 0.14); tone(300, 180, 0.07, 'square', 0.1); },
  };
  const last = {};
  function sfx(name, vol) {
    if (!ac || muted) return;
    const t = performance.now();
    if (last[name] && t - last[name] < 60) return;
    last[name] = t;
    if (SFX[name]) SFX[name](vol);
  }

  // ── engine ──
  function mkEngine() {
    const g = ac.createGain(); g.gain.value = 0; g.connect(engBus);
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600; f.connect(g);
    const o1 = ac.createOscillator(), o2 = ac.createOscillator(), og1 = ac.createGain(), og2 = ac.createGain();
    o1.type = 'sawtooth'; o2.type = 'square'; og1.gain.value = 0.5; og2.gain.value = 0.3;
    o1.connect(og1); og1.connect(f); o2.connect(og2); og2.connect(f);
    const ns = ac.createBufferSource(); ns.buffer = noiseBuf; ns.loop = true;
    const nf = ac.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 800; nf.Q.value = 0.8;
    const ng = ac.createGain(); ng.gain.value = 0; ns.connect(nf); nf.connect(ng); ng.connect(g);
    const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 9; lg.gain.value = 0; lfo.connect(lg); lg.connect(o1.frequency);
    o1.start(); o2.start(); ns.start(); lfo.start();
    return {g, f, o1, o2, ng, nf, lg};
  }

  function engine(p) {
    if (!ac) return;
    if (!eng) eng = mkEngine();
    if (!p || muted) { eng.g.gain.setTargetAtTime(0, now(), 0.1); return; }
    const k = Math.min(1.3, Math.abs(p.speed) / Math.max(20, p.top));
    let base, span, cut, noiseV = 0.04, lfo = 0, w1 = 'sawtooth';
    switch (p.kind) {
      case 'f1':    base = 110; span = 520; cut = 3000; w1 = 'sawtooth'; break;
      case 'truck': base = 34; span = 110; cut = 520; lfo = 4; break;
      case 'boat':  base = 38; span = 100; cut = 700; noiseV = 0.16; lfo = 6; break;
      case 'plane': base = 150; span = 650; cut = 2600; noiseV = 0.22; break;
      default:      base = 48; span = 210; cut = 1200;
    }
    const f = base + span * k * (p.boost ? 1.15 : 1), t = now();
    eng.o1.type = w1;
    eng.o1.frequency.setTargetAtTime(f, t, 0.06);
    eng.o2.frequency.setTargetAtTime(f * 0.5, t, 0.06);
    eng.f.frequency.setTargetAtTime(cut * (0.4 + k * 0.9) + (p.throttle ? 400 : 0), t, 0.08);
    eng.lg.gain.setTargetAtTime(lfo * (1 + k * 3), t, 0.1);
    eng.ng.gain.setTargetAtTime(noiseV * (0.4 + k) + (p.boost ? 0.12 : 0), t, 0.1);
    eng.nf.frequency.setTargetAtTime(600 + k * 3500, t, 0.1);
    eng.g.gain.setTargetAtTime(p.air ? 0.07 : 0.1 + 0.12 * (p.throttle ? 1 : 0.5) * Math.min(1, k * 1.5 + 0.2), t, 0.08);
  }

  function rival(dist, speed, top) {
    if (!ac) return;
    if (!riv) {
      riv = {o: ac.createOscillator(), g: ac.createGain(), f: ac.createBiquadFilter()};
      riv.o.type = 'sawtooth'; riv.f.type = 'lowpass'; riv.f.frequency.value = 500; riv.g.gain.value = 0;
      riv.o.connect(riv.f); riv.f.connect(riv.g); riv.g.connect(engBus); riv.o.start();
    }
    if (muted || dist == null) { riv.g.gain.setTargetAtTime(0, now(), 0.1); return; }
    const k = Math.min(1.3, Math.abs(speed) / Math.max(20, top));
    riv.o.frequency.setTargetAtTime(44 + 200 * k, now(), 0.1);
    riv.g.gain.setTargetAtTime(0.1 / (1 + dist / 18) ** 1.6, now(), 0.1);
  }

  // ── drive loops: wind, road, tyres ──
  let drv = null;
  function loopNoise(type, freq, q) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 0.7;
    const g = ac.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(engBus); s.start();
    return {g, f};
  }
  function drive(p) {
    if (!ac) return;
    if (!drv) drv = {wind: loopNoise('highpass', 700, 0.5), road: loopNoise('lowpass', 220, 0.8), skid: loopNoise('bandpass', 2600, 5), wash: loopNoise('bandpass', 900, 0.9)};
    const t = now();
    if (!p || muted) { for (const k in drv) drv[k].g.gain.setTargetAtTime(0, t, 0.1); return; }
    const k = Math.min(1.4, Math.abs(p.speed) / Math.max(20, p.top));
    drv.wind.g.gain.setTargetAtTime(0.02 + 0.2 * k * k * (p.kind === 'plane' ? 1.4 : 1), t, 0.1);
    drv.wind.f.frequency.setTargetAtTime(500 + k * 1800, t, 0.1);
    const onRoad = p.ground && (p.kind === 'car' || p.kind === 'f1' || p.kind === 'truck');
    drv.road.g.gain.setTargetAtTime(onRoad ? 0.08 + 0.3 * k : 0, t, 0.08);
    drv.road.f.frequency.setTargetAtTime(120 + k * 260 + (p.rough ? 200 : 0), t, 0.1);
    drv.skid.g.gain.setTargetAtTime(onRoad ? Math.min(1, p.slip) * 0.22 : 0, t, 0.04);
    drv.skid.f.frequency.setTargetAtTime(2200 + k * 900, t, 0.1);
    drv.wash.g.gain.setTargetAtTime(p.kind === 'boat' && p.ground ? 0.05 + 0.28 * k : 0, t, 0.1);
    drv.wash.f.frequency.setTargetAtTime(500 + k * 1500, t, 0.1);
  }

  // ── per-track music ──
  const NT = {M: [0, 4, 7, 12], m: [0, 3, 7, 12], M7: [0, 4, 7, 11], m7: [0, 3, 7, 10], dom7: [0, 4, 7, 10], '5': [0, 7, 12, 19], sus: [0, 5, 7, 12]};
  const ST = (bpm, ch, o) => Object.assign({bpm, ch}, o);
  const MUSIC = {
    menu:    ST(118, [[57, 'm'], [53, 'M'], [48, 'M'], [55, 'M']], {bass: ['sawtooth', 'x.x.x.x.x.x.x.x.', 0.2, 900], lead: ['square', '0121012101210121', 12, 0.14, 0.12], kick: 'x...x...x...x...', snare: '....x.......x...', hat: '.x.x.x.x.x.x.x.x'}),
    farm:    ST(104, [[55, 'M'], [48, 'M'], [50, 'M'], [48, 'M']], {bass: ['triangle', 'x...x...x...x...', 0.3, 700], lead: ['triangle', '0.2.1.2.0.2.1.2.', 12, 0.18, 0.16], kick: 'x.......x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', soft: 1}),
    forest:  ST(78, [[57, 'm'], [53, 'M'], [55, 'M'], [52, 'm']], {bass: ['sine', 'x.......x.......', 0.8, 400], lead: ['sine', '..0...2...1...0.', 12, 0.6, 0.13], pad: ['triangle', 0.09]}),
    water:   ST(92, [[60, 'M7'], [65, 'M7'], [67, 'M'], [64, 'm7']], {bass: ['sine', 'x.......x...x...', 0.5, 500], lead: ['sine', '0.1.2.3.2.1.0.1.', 12, 0.4, 0.11], pad: ['sine', 0.1], kick: 'x.......x.......', soft: 1}),
    beach:   ST(106, [[60, 'M'], [65, 'M'], [67, 'M'], [65, 'M']], {bass: ['triangle', 'x..x..x.x..x..x.', 0.2, 700], lead: ['triangle', '2.1.0.1.2.2.1.0.', 12, 0.12, 0.17], kick: 'x...x...x...x...', snare: '....x.......x...', hat: '.x.x.x.x.x.x.x.x'}),
    cave:    ST(66, [[45, 'm'], [45, 'sus'], [43, 'M'], [41, 'M']], {bass: ['sine', 'x...............', 1.6, 300], lead: ['sine', '....0...........', 24, 1.4, 0.1], pad: ['sine', 0.13]}),
    volcano: ST(132, [[52, 'm'], [50, 'M'], [48, 'M'], [47, 'm']], {bass: ['sawtooth', 'xx.xx.xxxx.xx.xx', 0.13, 650], lead: ['sawtooth', '0.....1.0.....2.', 12, 0.2, 0.1], kick: 'x..x..x.x..x..x.', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx', hv: 0.5}),
    cyber:   ST(132, [[57, 'm'], [53, 'M'], [55, 'M'], [52, 'm']], {bass: ['square', 'x.x.x.x.x.x.x.x.', 0.12, 800], lead: ['square', '0120210201202102', 12, 0.1, 0.1], kick: 'x...x...x...x...', snare: '....x.......x...', hat: '.x.x.x.x.x.x.x.x'}),
    house:   ST(120, [[60, 'M'], [55, 'M'], [57, 'm'], [53, 'M']], {bass: ['triangle', 'x.x.......x.x...', 0.2, 600], lead: ['triangle', '0.1.2.1.0.2.1.2.', 24, 0.25, 0.12], hat: '.x.x.x.x.x.x.x.x', soft: 1}),
    city:    ST(98, [[50, 'm7'], [55, 'dom7'], [48, 'M7'], [53, 'M7']], {bass: ['triangle', 'x.x.x.x.x.x.x.x.', 0.3, 600], lead: ['triangle', '..0...2...1...3.', 12, 0.4, 0.15], pad: ['triangle', 0.07], kick: 'x.......x.......', snare: '....x.......x...', hat: '..x...x...x...x.', soft: 1}),
    sky:     ST(112, [[60, 'M'], [67, 'M'], [57, 'm'], [65, 'M']], {bass: ['sawtooth', 'x...x...x...x...', 0.25, 800], lead: ['sawtooth', '0.1.2.1.0.1.2.1.', 12, 0.2, 0.09], pad: ['triangle', 0.08], kick: 'x...x...x...x...', hat: '.x.x.x.x.x.x.x.x'}),
    helix:   ST(128, [[57, 'm'], [57, 'm'], [53, 'M'], [55, 'M']], {bass: ['sawtooth', 'xxxxxxxxxxxxxxxx', 0.09, 520], lead: ['square', '0.1.2.1.0.1.2.1.', 12, 0.1, 0.09], kick: 'x...x...x...x...', hat: '.x.x.x.x.x.x.x.x'}),
    neon:    ST(118, [[52, 'm'], [48, 'M'], [55, 'M'], [50, 'M']], {bass: ['sawtooth', 'x.xxx.xxx.xxx.xx', 0.13, 700], lead: ['sawtooth', '0.....1...2.1...', 12, 0.5, 0.12], pad: ['sawtooth', 0.05], kick: 'x...x...x...x...', snare: '....x.......x...', hat: '.x.x.x.x.x.x.x.x'}),
    stadium: ST(116, [[52, '5'], [55, '5'], [50, '5'], [57, '5']], {bass: ['sawtooth', 'x.x.x.x.x.x.x.x.', 0.16, 1100], lead: ['sawtooth', '0...1...0...2...', 12, 0.5, 0.09], kick: 'x...x.x.x...x.x.', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', hv: 0.5}),
    chaos:   ST(148, [[57, 'm'], [53, 'M'], [55, 'M'], [52, 'm']], {bass: ['square', 'x.x.xx.x.xx.x.xx', 0.08, 900], rnd: ['square', 0.1], kick: 'x..x..x.x..x.x..', snare: '....x..x....x...', hat: 'xxxxxxxxxxxxxxxx', hv: 0.5}),
    desert:  ST(92, [[52, 'M'], [53, 'M'], [52, 'M'], [50, 'm']], {bass: ['sine', 'x..x..x.x..x..x.', 0.3, 500], lead: ['sawtooth', '0.1.2.1.2.1.0.0.', 12, 0.3, 0.09], kick: 'x...x.x.x...x...', hat: '.x.xx.x..x.xx.x.', soft: 1}),
    snow:    ST(80, [[60, 'M'], [55, 'M'], [57, 'm'], [53, 'M']], {bass: ['sine', 'x.......x.......', 0.9, 400], lead: ['triangle', '0.1.2.1...2.1.0.', 24, 0.8, 0.12], pad: ['sine', 0.09], hat: 'x.x.x.x.x.x.x.x.', hv: 0.3}),
    moon:    ST(84, [[57, 'm7'], [53, 'M7'], [55, 'dom7'], [52, 'm7']], {bass: ['sine', 'x.......x.......', 1, 350], lead: ['sine', '0.1.2.3.2.1.0.3.', 24, 0.6, 0.09, 1], pad: ['sine', 0.12]}),
    candy:   ST(124, [[60, 'M'], [65, 'M'], [67, 'M'], [60, 'M']], {bass: ['square', 'x.x.x.x.x.x.x.x.', 0.08, 900], lead: ['square', '0.2.1.2.0.2.1.2.', 12, 0.08, 0.1], kick: 'x...x...x...x...', snare: '....x.......x...', hat: '.x.x.x.x.x.x.x.x'}),
    arctic:  ST(70, [[62, 'm'], [58, 'M'], [60, 'M'], [57, 'm']], {bass: ['sine', 'x.......x.......', 1, 350], lead: ['sine', '....0...2...1...', 24, 1.0, 0.1], pad: ['sine', 0.14]}),
    canyon:  ST(100, [[57, 'm'], [55, 'M'], [53, 'M'], [52, 'M']], {bass: ['triangle', 'x..x..x.x..x..x.', 0.25, 600], lead: ['triangle', '0.1.2.1.2.1.0.1.', 12, 0.22, 0.15], pad: ['triangle', 0.06], kick: 'x...x...x...x...'}),
  };
  const AMB = {
    farm: {wind: 0.02, one: 'bird'}, forest: {wind: 0.025, one: 'cricket'}, water: {wave: 0.1}, beach: {wave: 0.1, one: 'gull'}, cave: {one: 'drip', wind: 0.012},
    volcano: {rumble: 0.14}, cyber: {hum: 0.03}, house: {one: 'tick'}, city: {traffic: 0.05}, sky: {wind: 0.06}, helix: {hum: 0.03}, neon: {traffic: 0.035},
    stadium: {crowd: 0.1}, desert: {wind: 0.05}, snow: {wind: 0.08}, candy: {one: 'chime'}, arctic: {wind: 0.07, wave: 0.05}, canyon: {wind: 0.07, one: 'eagle'},
  };
  const trackStyleMap = {menu: 'menu'};
  let cur = null, tickMs = 0, amb = null, ambT = null;
  const rate = pat => pat ? [...pat].map(c => c === 'x') : [];

  function playStep(m, s) {
    const t = now() + 0.04, st = s & 15, bar = (s >> 4) & 3, [root, type] = m.ch[bar], notes = NT[type].map(n => root + n);
    const v = m.soft ? 0.6 : 1;
    if (m.bass && m._bass[st]) {
      const [w, , dec, cut] = m.bass, o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
      o.type = w; o.frequency.value = mtof(root - 12); f.type = 'lowpass'; f.frequency.setValueAtTime(cut, t); f.frequency.exponentialRampToValueAtTime(Math.max(120, cut * 0.2), t + dec);
      env(g, t, 0.01, 0.45 * v, dec + 0.04); o.connect(f); f.connect(g); g.connect(musBus); o.start(t); o.stop(t + dec + 0.1);
    }
    if (m.lead) {
      const ch = m.lead[1][st];
      if (ch && ch !== '.') {
        const [w, , up, dec, vol, echo] = m.lead, n = notes[Math.min(notes.length - 1, +ch)] + up;
        for (let r = 0; r <= (echo ? 2 : 0); r++) {
          const o = ac.createOscillator(), g = ac.createGain();
          o.type = w; o.frequency.value = mtof(n); env(g, t + r * 0.3, 0.008, vol * (1 - r * 0.4) * v, dec); o.connect(g); g.connect(musBus); o.start(t + r * 0.3); o.stop(t + r * 0.3 + dec + 0.05);
        }
      }
    }
    if (m.rnd && Math.random() < 0.7) {
      const sc = [0, 3, 5, 7, 10, 12, 15, 19], n = root + 12 + sc[Math.random() * sc.length | 0], o = ac.createOscillator(), g = ac.createGain();
      o.type = m.rnd[0]; o.frequency.value = mtof(n); env(g, t, 0.005, m.rnd[1], 0.1); o.connect(g); g.connect(musBus); o.start(t); o.stop(t + 0.15);
    }
    if (m.pad && st === 0) {
      for (const n of notes.slice(0, 3)) {
        const o = ac.createOscillator(), g = ac.createGain(), dur = 60 / m.bpm * 4;
        o.type = m.pad[0]; o.frequency.value = mtof(n); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(m.pad[1] * 0.5, t + dur * 0.4); g.gain.linearRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(musBus); o.start(t); o.stop(t + dur + 0.1);
      }
    }
    if (m._kick[st]) { const k = ac.createOscillator(), kg = ac.createGain(); k.frequency.setValueAtTime(150, t); k.frequency.exponentialRampToValueAtTime(40, t + 0.15); env(kg, t, 0.005, 0.7 * v, 0.18); k.connect(kg); kg.connect(musBus); k.start(t); k.stop(t + 0.22); }
    if (m._snare[st]) noise(0.14, 4000, 1500, 0.2 * v, 0.04, 1, 'bandpass', musBus);
    if (m._hat[st]) noise(0.05, 9000, 7000, 0.1 * (m.hv || 1) * v, 0.04, 1, 'highpass', musBus);
  }

  function ambient() {
    if (!ac || !cur) return;
    const a = AMB[cur] || {};
    if (!amb) {
      const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      const f = ac.createBiquadFilter(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
      f.type = 'bandpass'; g.gain.value = 0; lfo.frequency.value = 0.2; lg.gain.value = 0; lfo.connect(lg); lg.connect(g.gain);
      s.connect(f); f.connect(g); g.connect(engBus); s.start(); lfo.start(); amb = {f, g, lfo, lg};
    }
    const t = now(), lvl = (a.wind || a.wave || a.rumble || a.crowd || a.traffic || a.hum || 0);
    amb.f.frequency.setTargetAtTime(a.rumble ? 90 : a.wave ? 500 : a.crowd ? 700 : a.traffic ? 260 : a.hum ? 120 : 900, t, 0.5);
    amb.f.Q.value = a.hum ? 6 : 0.6;
    amb.g.gain.setTargetAtTime(muted ? 0 : lvl, t, 0.6);
    amb.lg.gain.setTargetAtTime(a.wave ? lvl * 0.8 : a.crowd ? lvl * 0.5 : a.rumble ? lvl * 0.4 : 0, t, 0.6);
    amb.lfo.frequency.setTargetAtTime(a.wave ? 0.12 : a.crowd ? 0.5 : 0.3, t, 0.5);
  }
  const ONE = {
    bird:    () => { const f = 2400 + Math.random() * 1500; tone(f, f * 1.4, 0.08, 'sine', 0.05); tone(f * 1.2, f * 0.9, 0.1, 'sine', 0.05, 0.1); },
    cricket: () => { for (let i = 0; i < 4; i++) tone(4300, 4300, 0.03, 'square', 0.015, i * 0.05); },
    gull:    () => { tone(1500, 900, 0.35, 'sawtooth', 0.04); tone(1300, 800, 0.3, 'sawtooth', 0.035, 0.38); },
    drip:    () => tone(1800 + Math.random() * 600, 700, 0.2, 'sine', 0.07),
    tick:    () => tone(1200, 1200, 0.02, 'square', 0.05),
    chime:   () => { const f = 1000 + Math.random() * 1400; tone(f, f, 0.8, 'sine', 0.05); tone(f * 1.5, f * 1.5, 0.7, 'sine', 0.03, 0.05); },
    eagle:   () => { tone(2400, 1800, 0.5, 'sawtooth', 0.035); },
  };
  function scheduleAmb() {
    clearTimeout(ambT);
    const a = AMB[cur];
    if (a && a.one && ac && !muted && ac.state === 'running' && ONE[a.one]) ONE[a.one]();
    ambT = setTimeout(scheduleAmb, a && a.one === 'cricket' ? 400 + Math.random() * 900 : a && a.one === 'tick' ? 1000 : 1800 + Math.random() * 4500);
  }

  function setTrack(style) {
    const key = MUSIC[style] ? style : 'menu';
    if (cur === key) return;
    cur = key;
    const m = MUSIC[key];
    if (!m._kick) { m._bass = rate(m.bass && m.bass[1]); m._kick = rate(m.kick); m._snare = rate(m.snare); m._hat = rate(m.hat); if (m.lead) m.lead[1] = m.lead[1]; }
    step = 0;
    if (!ac) return;
    musBus.gain.cancelScheduledValues(now()); musBus.gain.setValueAtTime(0.0001, now()); musBus.gain.linearRampToValueAtTime(0.16, now() + 1.2);
    clearInterval(musT); musT = setInterval(() => { if (ac && !muted && ac.state === 'running' && cur) playStep(MUSIC[cur], step++); }, 60000 / m.bpm / 4);
    ambient(); scheduleAmb();
  }
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  function startMusic() { const c = cur; cur = null; setTrack(c || 'menu'); }

  function setMuted(m) {
    muted = m;
    try { localStorage.setItem('ct_mute', m ? '1' : '0'); } catch (e) {}
    if (ac) master.gain.setTargetAtTime(m ? 0 : 0.8, now(), 0.05);
  }

  return {init, sfx, engine, rival, drive, setTrack, setMuted, toggle() { setMuted(!muted); return muted; }, get muted() { return muted; }};
})();
