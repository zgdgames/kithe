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

  // ── music: simple synthwave loop ──
  const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  function startMusic() {
    if (musT) return;
    musT = setInterval(() => {
      if (!ac || muted || ac.state !== 'running') return;
      const s = step++, ch = CHORDS[(s >> 4) & 3], t = now() + 0.05;
      const bass = ch[0] - 12;
      if (s % 2 === 0) {
        const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
        o.type = 'sawtooth'; o.frequency.value = mtof(bass); f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(180, t + 0.22);
        env(g, t, 0.01, 0.5, 0.24); o.connect(f); f.connect(g); g.connect(musBus); o.start(t); o.stop(t + 0.3);
      }
      const n = ch[[0, 1, 2, 1][s & 3]] + 12 * ((s >> 3) & 1);
      const o2 = ac.createOscillator(), g2 = ac.createGain();
      o2.type = 'square'; o2.frequency.value = mtof(n); env(g2, t, 0.005, 0.12, 0.14); o2.connect(g2); g2.connect(musBus); o2.start(t); o2.stop(t + 0.18);
      if (s % 4 === 0) { const k = ac.createOscillator(), kg = ac.createGain(); k.frequency.setValueAtTime(150, t); k.frequency.exponentialRampToValueAtTime(40, t + 0.15); env(kg, t, 0.005, 0.7, 0.18); k.connect(kg); kg.connect(musBus); k.start(t); k.stop(t + 0.22); }
      if (s % 2 === 1) noise(0.05, 9000, 7000, 0.12, 0.05, 1, 'highpass', musBus);
      if (s % 8 === 4) noise(0.14, 4000, 1500, 0.2, 0.05, 1, 'bandpass', musBus);
    }, 135);
  }

  function setMuted(m) {
    muted = m;
    try { localStorage.setItem('ct_mute', m ? '1' : '0'); } catch (e) {}
    if (ac) master.gain.setTargetAtTime(m ? 0 : 0.8, now(), 0.05);
  }

  return {init, sfx, engine, rival, setMuted, toggle() { setMuted(!muted); return muted; }, get muted() { return muted; }};
})();
