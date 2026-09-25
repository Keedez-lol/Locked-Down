(() => {
'use strict';
const LD = window.LD;
const A = LD.Audio = {
  unlocked: false, ctx: null, limiter: null, reverb: null, reverbSend: null,
  busses: { master: null, music: null, sfx: null, ambient: null },
  stats: { voices: 0, loops: 0, beds: 0, nodes: 0 }
};

const VOICE_CAP = 24, RATE_CAP = 12, LOOK = 0.12, LOOP_BUDGET = 60;
const FADE_IN = 0.15, FADE_OUT = 0.4, BED_XFADE = 3;
let ctx = null;
const vol = { master: 0.8, music: 0.6, sfx: 0.8, ambient: 0.6 };
const buffers = {};
const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);
const rndi = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const vcurve = v => Math.pow(clamp(+v || 0, 0, 1), 1.6);
const now = () => ctx ? ctx.currentTime : 0;

/* ── buffers (one 4 s white / pink / brown buffer, shared by every source) ── */
function makeBuffers() {
  const sr = ctx.sampleRate, n = Math.floor(sr * 4);
  const white = ctx.createBuffer(1, n, sr), pink = ctx.createBuffer(1, n, sr), brown = ctx.createBuffer(1, n, sr);
  const w = white.getChannelData(0), p = pink.getChannelData(0), b = brown.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, acc = 0;
  for (let i = 0; i < n; i++) {
    const x = Math.random() * 2 - 1;
    w[i] = x;
    b0 = 0.99886 * b0 + x * 0.0555179; b1 = 0.99332 * b1 + x * 0.0750759; b2 = 0.969 * b2 + x * 0.153852;
    b3 = 0.8665 * b3 + x * 0.3104856; b4 = 0.55 * b4 + x * 0.5329522; b5 = -0.7616 * b5 - x * 0.016898;
    p[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + x * 0.5362) * 0.11; b6 = x * 0.115926;
    acc = (acc + 0.02 * x) / 1.02; b[i] = acc * 3.5;
  }
  buffers.white = white; buffers.pink = pink; buffers.brown = brown;
  // impulse response: 1.6 s decaying noise, progressively darker (one-pole lowpass whose cutoff falls along the tail)
  const irN = Math.floor(sr * 1.6), ir = ctx.createBuffer(2, irN, sr);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c); let y = 0;
    for (let i = 0; i < irN; i++) {
      const t = i / irN, a = 0.42 - 0.3 * t;
      const v = (Math.random() * 2 - 1) * Math.exp(-6.9 * t) * (i < 400 ? i / 400 : 1);
      y += a * (v - y); d[i] = y * 0.9;
    }
  }
  buffers.ir = ir;
}

/* ── graph: a bag of nodes with factories, freed together ── */
function Graph() { this.nodes = []; this.srcs = []; this.persistent = false; }
Graph.prototype = {
  add(n) { this.nodes.push(n); A.stats.nodes++; return n; },
  osc(type, f, det) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; if (det) o.detune.value = det; o.start(); this.srcs.push(o); return this.add(o); },
  noise(kind) { const s = ctx.createBufferSource(); s.buffer = buffers[kind] || buffers.white; s.loop = true; s.start(0, rnd(0, 3.5)); this.srcs.push(s); return this.add(s); },
  filter(type, f, q, g) { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; if (q !== undefined) n.Q.value = q; if (g) n.gain.value = g; return this.add(n); },
  gain(v) { const n = ctx.createGain(); n.gain.value = v === undefined ? 1 : v; return this.add(n); },
  pan(v) { if (!ctx.createStereoPanner) return this.gain(1); const n = ctx.createStereoPanner(); n.pan.value = v; return this.add(n); },
  shaper(k) { const n = ctx.createWaveShaper(); const c = new Float32Array(257); for (let i = 0; i < 257; i++) { const x = i / 128 - 1; c[i] = Math.tanh(x * k) / Math.tanh(k); } n.curve = c; return this.add(n); },
  delay(t) { const n = ctx.createDelay(Math.max(1, t)); n.delayTime.value = t; return this.add(n); },
  chain() { for (let i = 0; i < arguments.length - 1; i++) arguments[i].connect(arguments[i + 1]); return arguments[arguments.length - 1]; },
  // low-frequency modulator: osc(type,rate) → gain(depth) → param
  lfo(rate, depth, param, type) { const o = this.osc(type || 'sine', rate), g = this.gain(depth); o.connect(g); g.connect(param); return o; },
  // steady source through a filter into a gain; returns the gain
  bed(kind, ftype, f, q, v) { const s = this.noise(kind), fl = this.filter(ftype, f, q), g = this.gain(v); s.connect(fl); fl.connect(g); g.filter = fl; return g; },
  send(from, amount, bus) { const to = (A.wet && A.wet[bus || 'sfx']) || A.reverb; if (!to || !amount) return null; const g = this.gain(amount); from.connect(g); g.connect(to); return g; },
  free(at) {
    const t = Math.max(now(), at || 0);
    for (const s of this.srcs) { try { s.stop(t + 0.02); } catch (e) { /* already stopped */ } }
    reap.push({ g: this, at: t + 0.05 });
  },
  _kill() { for (const n of this.nodes) { try { n.disconnect(); } catch (e) { /* detached */ } } A.stats.nodes -= this.nodes.length; this.nodes.length = 0; this.srcs.length = 0; }
};
const reap = [];

/* ── envelopes ── */
function env(param, t, peak, a, d, floor) {
  param.cancelScheduledValues(t); param.setValueAtTime(floor || 0, t);
  param.linearRampToValueAtTime(peak, t + Math.max(0.001, a));
  param.setTargetAtTime(floor || 0, t + Math.max(0.001, a), Math.max(0.004, d / 4));
}
function pulse(param, t, peak, d) { param.setValueAtTime(peak, t); param.setTargetAtTime(0, t + 0.002, Math.max(0.003, d / 4)); }
function glide(param, t, f0, f1, d, exp) {
  param.cancelScheduledValues(t); param.setValueAtTime(Math.max(0.01, f0), t);
  if (exp) param.exponentialRampToValueAtTime(Math.max(0.01, f1), t + d); else param.linearRampToValueAtTime(f1, t + d);
}

/* ── layered primitives (g = Graph, dest = node, t = start time, p = pitch multiplier) ── */
// tonal partial with amp envelope and optional frequency glide
function tone(g, dest, t, o) {
  const osc = g.osc(o.type || 'sine', o.f, o.det || 0), gn = g.gain(0);
  osc.connect(gn); gn.connect(dest);
  if (o.f2 !== undefined) glide(osc.frequency, t, o.f, o.f2, o.gd || o.d, o.exp !== false);
  env(gn.gain, t, o.peak === undefined ? 0.3 : o.peak, o.a || 0.004, o.d || 0.2);
  return osc;
}
// filtered noise burst with optional cutoff sweep
function burst(g, dest, t, o) {
  const s = g.noise(o.kind || 'white'), f = g.filter(o.type || 'bandpass', o.f, o.q === undefined ? 1 : o.q), gn = g.gain(0);
  s.connect(f); f.connect(gn); gn.connect(dest);
  if (o.f2 !== undefined) glide(f.frequency, t, o.f, o.f2, o.gd || o.d, true);
  env(gn.gain, t, o.peak === undefined ? 0.3 : o.peak, o.a || 0.003, o.d || 0.1);
  return f;
}
// FM pair: modulator(ratio·f) → index·f → carrier frequency
function fm(g, dest, t, o) {
  const car = g.osc(o.type || 'sine', o.f), mod = g.osc(o.mtype || 'sine', o.f * (o.ratio || 1)), mg = g.gain(o.f * (o.index || 2)), gn = g.gain(0);
  mod.connect(mg); mg.connect(car.frequency); car.connect(gn); gn.connect(dest);
  if (o.f2 !== undefined) { glide(car.frequency, t, o.f, o.f2, o.gd || o.d, true); glide(mod.frequency, t, o.f * (o.ratio || 1), o.f2 * (o.ratio || 1), o.gd || o.d, true); }
  if (o.idecay) { mg.gain.setValueAtTime(o.f * (o.index || 2), t); mg.gain.setTargetAtTime(0, t, o.idecay / 3); }
  env(gn.gain, t, o.peak === undefined ? 0.3 : o.peak, o.a || 0.003, o.d || 0.3);
  return car;
}
// 2 ms transient tick
function click(g, dest, t, peak, f) {
  const s = g.noise('white'), fl = g.filter('highpass', f || 2500, 0.7), gn = g.gain(0);
  s.connect(fl); fl.connect(gn); gn.connect(dest);
  gn.gain.setValueAtTime(peak || 0.4, t); gn.gain.linearRampToValueAtTime(0, t + 0.0025);
}

/* ── one-shots: build(g, out, t, p) returns the duration in seconds; p = pitch multiplier ── */
const SFX = {
  ui_click: { g: 0.35, b(g, o, t, p) { click(g, o, t, 0.5, 3000); tone(g, o, t, { f: 1200 * p, peak: 0.25, d: 0.03 }); return 0.08; } },
  ui_hover: { g: 0.06, b(g, o, t, p) { tone(g, o, t, { f: 1800 * p, peak: 0.3, a: 0.002, d: 0.012 }); return 0.04; } },
  ui_open: { g: 0.3, send: 0.08, b(g, o, t, p) { burst(g, o, t, { kind: 'pink', f: 600 * p, f2: 3200 * p, q: 1.2, peak: 0.5, a: 0.01, d: 0.13 }); tone(g, o, t, { f: 500 * p, f2: 900 * p, peak: 0.08, a: 0.01, d: 0.1 }); return 0.25; } },
  ui_close: { g: 0.3, send: 0.08, b(g, o, t, p) { burst(g, o, t, { kind: 'pink', f: 3200 * p, f2: 500 * p, q: 1.2, peak: 0.5, a: 0.01, d: 0.13 }); tone(g, o, t, { f: 900 * p, f2: 480 * p, peak: 0.08, a: 0.01, d: 0.1 }); return 0.25; } },
  ui_tab: { g: 0.3, b(g, o, t, p) { click(g, o, t, 0.4, 2500); tone(g, o, t, { f: 900 * p, peak: 0.2, d: 0.04 }); tone(g, o, t + 0.045, { f: 1300 * p, peak: 0.18, d: 0.05 }); return 0.14; } },
  build_place: { g: 0.55, send: 0.1, b(g, o, t, p) {
    tone(g, o, t, { f: 95 * p, f2: 42 * p, peak: 0.9, a: 0.004, d: 0.19 });
    burst(g, o, t, { kind: 'brown', type: 'lowpass', f: 900, f2: 120, q: 0.8, peak: 0.6, d: 0.14 });
    fm(g, o, t + 0.012, { f: 2100 * p, ratio: 3.7, index: 2.2, idecay: 0.05, peak: 0.16, d: 0.09 });
    click(g, o, t + 0.012, 0.35, 4000);
    return 0.45; } },
  build_done: { g: 0.4, send: 0.3, b(g, o, t, p) {
    const bell = (t0, f) => { fm(g, o, t0, { f, ratio: 2.76, index: 1.1, idecay: 0.25, peak: 0.35, a: 0.003, d: 0.6 }); tone(g, o, t0, { f: f * 2.01, peak: 0.06, d: 0.3 }); };
    bell(t, 587 * p); bell(t + 0.16, 880 * p);
    return 1.0; } },
  dismantle: { g: 0.5, send: 0.08, b(g, o, t, p) {
    for (let i = 0; i < 6; i++) burst(g, o, t + i * 0.038 + rnd(0, 0.02), { f: rnd(1200, 2800) * p, q: 3, peak: 0.35, d: 0.03 });
    tone(g, o, t + 0.26, { f: 120 * p, f2: 40 * p, peak: 0.8, a: 0.004, d: 0.17 });
    burst(g, o, t + 0.26, { kind: 'brown', type: 'lowpass', f: 600, f2: 100, peak: 0.5, d: 0.12 });
    return 0.6; } },
  repair: { g: 0.4, b(g, o, t, p) {
    for (let i = 0; i < 6; i++) { const t0 = t + i * 0.055; burst(g, o, t0, { f: (1500 + i * 180) * p, q: 6, peak: 0.4, d: 0.025 }); click(g, o, t0, 0.3, 3500); }
    fm(g, o, t + 0.34, { f: 1600 * p, ratio: 2.4, index: 0.8, idecay: 0.08, peak: 0.12, d: 0.15 });
    return 0.6; } },
  research: { g: 0.28, send: 0.25, b(g, o, t, p) { [440, 554, 659, 880].forEach((f, i) => tone(g, o, t + i * 0.09, { type: 'triangle', f: f * p, peak: 0.3, a: 0.02, d: 0.22 })); return 0.7; } },
  research_done: { g: 0.38, send: 0.45, b(g, o, t, p) {
    [523, 659, 784, 1046].forEach((f, i) => { tone(g, o, t + i * 0.03, { f: f * p, det: rnd(-6, 6), peak: 0.22, a: 0.02, d: 1.1 }); tone(g, o, t + i * 0.03, { f: f * 2.005 * p, peak: 0.05, a: 0.05, d: 0.7 }); });
    return 1.8; } },
  discover: { g: 0.3, send: 0.35, b(g, o, t, p) { fm(g, o, t, { f: 1318 * p, ratio: 3.01, index: 0.6, idecay: 0.1, peak: 0.3, d: 0.35 }); fm(g, o, t + 0.07, { f: 1975 * p, ratio: 3.01, index: 0.6, idecay: 0.1, peak: 0.22, d: 0.4 }); return 0.7; } },
  wave_warning: { g: 0.55, send: 0.3, b(g, o, t, p) {
    const lp = g.filter('lowpass', 160, 3), gn = g.gain(0); lp.connect(gn); gn.connect(o);
    for (const [f, det] of [[55, 0], [55, 9], [82.5, -5], [110, 4]]) g.osc('sawtooth', f * p, det).connect(lp);
    tone(g, o, t, { f: 41 * p, peak: 0.5, a: 0.3, d: 0.9 });
    glide(lp.frequency, t, 160, 520, 0.7); lp.frequency.setTargetAtTime(120, t + 0.7, 0.2);
    gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(0.5, t + 0.35); gn.gain.setTargetAtTime(0, t + 0.75, 0.16);
    return 1.5; } },
  wave_start: { g: 0.6, send: 0.25, b(g, o, t, p) {
    tone(g, o, t, { f: 150 * p, f2: 48 * p, peak: 1, a: 0.003, d: 0.26 });
    burst(g, o, t, { type: 'lowpass', f: 900, f2: 90, q: 0.7, peak: 0.7, d: 0.28 });
    burst(g, o, t + 0.02, { kind: 'brown', type: 'lowpass', f: 140, q: 1.2, peak: 0.9, a: 0.05, d: 1.4 });
    return 1.9; } },
  wave_end: { g: 0.3, send: 0.4, b(g, o, t, p) {
    [293.7, 392, 440].forEach(f => tone(g, o, t, { type: 'triangle', f: f * p, det: rnd(-4, 4), peak: 0.2, a: 0.05, d: 0.5 }));
    [293.7, 370, 440, 587].forEach(f => tone(g, o, t + 0.55, { type: 'triangle', f: f * p, det: rnd(-4, 4), peak: 0.2, a: 0.06, d: 1.1 }));
    return 2.0; } },
  brownout: { g: 0.35, b(g, o, t, p) {
    const lp = g.filter('lowpass', 600, 1.5), tr = g.gain(0.5), gn = g.gain(0); lp.connect(tr); tr.connect(gn); gn.connect(o);
    const a = g.osc('sawtooth', 100 * p), b = g.osc('sawtooth', 50 * p, 6); a.connect(lp); b.connect(lp);
    glide(a.frequency, t + 0.3, 100 * p, 82 * p, 0.4); glide(b.frequency, t + 0.3, 50 * p, 41 * p, 0.4);
    g.lfo(6, 0.5, tr.gain);
    gn.gain.setValueAtTime(0.0, t); gn.gain.linearRampToValueAtTime(0.5, t + 0.05); gn.gain.setTargetAtTime(0, t + 0.5, 0.15);
    return 1.0; } },
  integrity_low: { g: 0.35, send: 0.15, b(g, o, t, p) {
    const c = fm(g, o, t, { f: 180 * p, ratio: 1.41, index: 6, peak: 0.28, a: 0.06, d: 0.55 });
    glide(c.frequency, t, 180 * p, 265 * p, 0.35); c.frequency.setTargetAtTime(150 * p, t + 0.35, 0.2);
    burst(g, o, t, { f: 700 * p, f2: 1100 * p, q: 9, peak: 0.25, a: 0.05, d: 0.5 });
    return 0.9; } },
  structure_broken: { g: 0.6, send: 0.2, b(g, o, t, p) {
    burst(g, o, t, { type: 'lowpass', f: 1600, f2: 180, q: 0.8, peak: 0.8, d: 0.3 });
    tone(g, o, t, { f: 110 * p, f2: 35 * p, peak: 0.8, d: 0.25 });
    for (let i = 0; i < 6; i++) burst(g, o, t + 0.05 + i * 0.06 + rnd(0, 0.03), { f: rnd(800, 2600) * p, q: 4, peak: 0.3, d: 0.03 });
    return 0.8; } },
  excavated: { g: 0.5, send: 0.4, b(g, o, t, p) {
    burst(g, o, t, { kind: 'brown', type: 'lowpass', f: 420, q: 1, peak: 0.9, a: 0.02, d: 0.8 });
    for (let i = 0; i < 8; i++) burst(g, o, t + rnd(0, 0.5), { f: rnd(900, 2200), q: 3, peak: 0.25, d: 0.03 });
    tone(g, o, t + 0.35, { f: 330 * p, f2: 660 * p, gd: 0.5, peak: 0.18, a: 0.1, d: 0.8 });
    tone(g, o, t + 0.45, { f: 990 * p, peak: 0.08, a: 0.15, d: 0.8 });
    return 1.6; } },
  event_warning: { g: 0.45, send: 0.2, b(g, o, t, p) {
    for (let i = 0; i < 3; i++) { const t0 = t + i * 0.26; tone(g, o, t0, { type: 'triangle', f: 110 * p, peak: 0.6, a: 0.02, d: 0.18 }); tone(g, o, t0, { type: 'sine', f: 220 * p, peak: 0.15, a: 0.02, d: 0.14 }); }
    return 1.0; } },
  weather_rain: { g: 0.25, send: 0.2, b(g, o, t) { burst(g, o, t, { kind: 'pink', type: 'highpass', f: 1500, q: 0.5, peak: 0.6, a: 0.25, d: 0.6 }); return 1.1; } },
  weather_storm: { g: 0.6, send: 0.55, b(g, o, t) {
    burst(g, o, t, { type: 'bandpass', f: 3000, q: 0.5, peak: 0.5, d: 0.03 });
    burst(g, o, t + 0.02, { kind: 'brown', type: 'lowpass', f: 320, f2: 70, gd: 2.2, q: 1.2, peak: 1.2, a: 0.03, d: 2.4 });
    burst(g, o, t + 0.6, { kind: 'brown', type: 'lowpass', f: 140, q: 1, peak: 0.6, a: 0.4, d: 2.0 });
    return 3.6; } },
  shot_arrow: { g: 0.35, b(g, o, t, p) {
    tone(g, o, t, { type: 'triangle', f: 240 * p, f2: 180 * p, peak: 0.35, d: 0.07 }); tone(g, o, t, { f: 720 * p, f2: 500 * p, peak: 0.12, d: 0.05 });
    burst(g, o, t + 0.01, { f: 1400 * p, f2: 400 * p, q: 1.5, peak: 0.35, a: 0.01, d: 0.15 });
    return 0.3; } },
  shot_ballista: { g: 0.5, b(g, o, t, p) {
    tone(g, o, t, { type: 'triangle', f: 120 * p, f2: 80 * p, peak: 0.6, d: 0.12 }); tone(g, o, t, { f: 60 * p, peak: 0.4, d: 0.12 });
    burst(g, o, t, { kind: 'brown', type: 'lowpass', f: 700, f2: 150, peak: 0.5, d: 0.1 });
    burst(g, o, t + 0.03, { f: 1100 * p, f2: 350 * p, q: 1.2, peak: 0.4, a: 0.02, d: 0.28 });
    return 0.5; } },
  shot_cannon: { g: 0.7, send: 0.3, b(g, o, t, p) {
    tone(g, o, t, { f: 85 * p, f2: 28 * p, peak: 1, a: 0.003, d: 0.4 }); tone(g, o, t, { f: 42 * p, peak: 0.5, a: 0.02, d: 0.5 });
    burst(g, o, t, { type: 'lowpass', f: 1400, f2: 120, q: 0.7, peak: 0.8, d: 0.35 });
    burst(g, o, t, { f: 2200, q: 0.8, peak: 0.25, d: 0.05 });
    return 1.0; } },
  shot_gatling: { g: 0.3, b(g, o, t, p) {
    click(g, o, t, 0.6, 2000); click(g, o, t + 0.018, 0.4, 3000);
    burst(g, o, t, { f: 1900 * p, q: 1, peak: 0.35, d: 0.04 }); tone(g, o, t, { f: 140 * p, f2: 70 * p, peak: 0.3, d: 0.04 });
    return 0.12; } },
  shot_laser: { g: 0.32, b(g, o, t, p) {
    tone(g, o, t, { f: 420 * p, f2: 1700 * p, gd: 0.11, peak: 0.35, d: 0.14 }); tone(g, o, t, { f: 840 * p, f2: 3400 * p, gd: 0.11, peak: 0.1, d: 0.12 });
    burst(g, o, t, { type: 'highpass', f: 5000, q: 0.5, peak: 0.15, d: 0.06 });
    return 0.3; } },
  shot_tesla: { g: 0.35, b(g, o, t, p) {
    for (let i = 0; i < 9; i++) burst(g, o, t + i * 0.022 + rnd(0, 0.012), { f: rnd(2200, 4200), q: 2, peak: rnd(0.25, 0.5), d: 0.012 });
    const s = g.osc('sawtooth', 100 * p), lp = g.filter('lowpass', 900, 2), gn = g.gain(0); s.connect(lp); lp.connect(gn); gn.connect(o);
    env(gn.gain, t, 0.22, 0.005, 0.2);
    return 0.4; } },
  shot_plasma: { g: 0.6, send: 0.25, b(g, o, t, p) {
    tone(g, o, t, { f: 130 * p, f2: 34 * p, peak: 0.9, a: 0.004, d: 0.36 });
    fm(g, o, t, { f: 90 * p, ratio: 0.5, index: 5, idecay: 0.2, peak: 0.3, d: 0.25 });
    burst(g, o, t, { type: 'highpass', f: 4000, q: 0.5, peak: 0.35, a: 0.01, d: 0.32 });
    return 0.8; } },
  hit: { g: 0.35, b(g, o, t, p) { tone(g, o, t, { f: 180 * p, f2: 55 * p, peak: 0.7, d: 0.1 }); click(g, o, t, 0.25, 1500); burst(g, o, t, { type: 'lowpass', f: 700, peak: 0.3, d: 0.05 }); return 0.2; } },
  enemy_die: { g: 0.42, b(g, o, t, p) {
    const lp = g.filter('lowpass', 900, 1.5); lp.connect(o); glide(lp.frequency, t, 900, 200, 0.35);
    fm(g, lp, t, { f: 160 * p, f2: 48 * p, gd: 0.35, ratio: 0.5, index: 3, type: 'sawtooth', peak: 0.3, a: 0.01, d: 0.3 });
    burst(g, o, t + 0.05, { type: 'lowpass', f: 600, f2: 100, peak: 0.3, d: 0.25 });
    return 0.6; } },
  growl: { g: 0.35, b(g, o, t, p) {
    const lp = g.filter('lowpass', 700, 1), tg = g.gain(0.7); lp.connect(tg); tg.connect(o);
    const c = fm(g, lp, t, { f: 90 * p, ratio: 0.5, index: 8, peak: 0.4, a: 0.06, d: 0.5 });
    g.lfo(18, 0.3, tg.gain); g.lfo(2.7, 12, c.frequency); glide(lp.frequency, t, 700, 380, 0.5);
    burst(g, o, t, { kind: 'pink', type: 'lowpass', f: 500, peak: 0.15, a: 0.1, d: 0.4 });
    return 0.8; } },
  screech: { g: 0.32, b(g, o, t, p) {
    const s = g.osc('sawtooth', 1800 * p), bp = g.filter('bandpass', 2200 * p, 3), gn = g.gain(0); s.connect(bp); bp.connect(gn); gn.connect(o);
    s.frequency.setValueAtTime(1800 * p, t); s.frequency.linearRampToValueAtTime(2600 * p, t + 0.1); s.frequency.linearRampToValueAtTime(1400 * p, t + 0.35);
    env(gn.gain, t, 0.3, 0.02, 0.3); g.lfo(40, 300, s.frequency);
    burst(g, o, t, { f: 3000 * p, q: 2, peak: 0.15, a: 0.02, d: 0.25 });
    return 0.5; } },
  crystal_chime: { g: 0.3, send: 0.5, b(g, o, t, p) { [1, 2.4, 3.9].forEach((r, i) => tone(g, o, t + i * 0.01, { f: 1046 * r * p, peak: 0.25 / (1 + i), a: 0.005, d: 1.0 - i * 0.2 })); return 1.4; } },
  magma_roar: { g: 0.5, send: 0.4, b(g, o, t, p) {
    burst(g, o, t, { kind: 'brown', type: 'lowpass', f: 250, q: 1.5, peak: 1.1, a: 0.15, d: 1.0 });
    const s = g.osc('sawtooth', 45 * p), lp = g.filter('lowpass', 180, 2), gn = g.gain(0); s.connect(lp); lp.connect(gn); gn.connect(o);
    g.lfo(7, 15, s.frequency); env(gn.gain, t, 0.35, 0.2, 1.0);
    return 1.6; } },
  void_whisper: { g: 0.3, send: 0.5, b(g, o, t, p) {
    const s = g.noise('white'), tr = g.gain(0.5), gn = g.gain(0); tr.connect(gn); gn.connect(o);
    [[520, 300, 8], [1500, 1100, 10], [2500, 2300, 12]].forEach(([f0, f1, q]) => { const f = g.filter('bandpass', f0 * p, q); s.connect(f); f.connect(tr); glide(f.frequency, t, f0 * p, f1 * p, 1.1); });
    g.lfo(4.3, 0.5, tr.gain); env(gn.gain, t, 0.5, 0.35, 0.9);
    return 1.5; } },
  layer_switch: { g: 0.5, send: 0.3, b(g, o, t, p) {
    const s = g.noise('pink'), lp = g.filter('lowpass', 200, 1.2), gn = g.gain(0); s.connect(lp); lp.connect(gn); gn.connect(o);
    lp.frequency.setValueAtTime(200, t); lp.frequency.exponentialRampToValueAtTime(1800, t + 0.35); lp.frequency.exponentialRampToValueAtTime(150, t + 0.85);
    gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(0.7, t + 0.3); gn.gain.setTargetAtTime(0, t + 0.5, 0.15);
    tone(g, o, t + 0.05, { f: 440 * p, f2: 110 * p, gd: 0.7, peak: 0.2, a: 0.1, d: 0.6 });
    return 1.1; } },
  save: { g: 0.3, b(g, o, t, p) { click(g, o, t, 0.35, 3000); tone(g, o, t + 0.01, { f: 880 * p, peak: 0.2, a: 0.005, d: 0.16 }); tone(g, o, t + 0.01, { f: 1320 * p, peak: 0.14, a: 0.005, d: 0.14 }); return 0.3; } },
  error: { g: 0.35, b(g, o, t, p) {
    const s = g.osc('square', 140 * p), lp = g.filter('lowpass', 500, 1), gn = g.gain(0); s.connect(lp); lp.connect(gn); gn.connect(o);
    for (let i = 0; i < 2; i++) env(gn.gain, t + i * 0.12, 0.3, 0.01, 0.08);
    return 0.35; } },
  objective: { g: 0.3, send: 0.3, b(g, o, t, p) { tone(g, o, t, { type: 'triangle', f: 660 * p, peak: 0.3, a: 0.02, d: 0.16 }); tone(g, o, t + 0.13, { type: 'triangle', f: 990 * p, peak: 0.3, a: 0.02, d: 0.3 }); return 0.6; } },
  blueprint_paste: { g: 0.28, b(g, o, t, p) { burst(g, o, t, { kind: 'pink', f: 1800 * p, f2: 3200 * p, q: 1.5, peak: 0.5, a: 0.04, d: 0.2 }); click(g, o, t + 0.22, 0.2, 3000); return 0.4; } },
  gather: { g: 0.35, b(g, o, t, p) {
    if (p >= 1) { tone(g, o, t, { f: 300 * p, f2: 210 * p, peak: 0.5, d: 0.06 }); click(g, o, t, 0.4, 1800); burst(g, o, t, { type: 'lowpass', f: 900, peak: 0.3, d: 0.04 }); return 0.15; }
    for (let i = 0; i < 5; i++) burst(g, o, t + i * 0.04 + rnd(0, 0.02), { kind: 'pink', f: rnd(2400, 4200), q: 2.5, peak: 0.3, d: 0.03 });
    return 0.3; } }
};

/* ── machine loops: one patch per key, shared by every visible machine of that key ── */
// patch helpers: P.every(interval, jitter, fn(t)) rhythmic jobs; P.hit(fn(g, t) → dur) transient sub-graphs; P.I current intensity
function crackler(g, P, o) {
  const src = g.noise(o.kind || 'white'), f = g.filter(o.type || 'bandpass', o.f, o.q === undefined ? 1.5 : o.q), gn = g.gain(0);
  src.connect(f); f.connect(gn); gn.connect(o.dest || P.out);
  P.rand(o.min, o.max, t => { pulse(gn.gain, t, (o.v || 0.3) * rnd(0.5, 1), o.d || 0.02); if (o.sweep) glide(f.frequency, t, o.f * rnd(0.8, 1.25), o.f * 0.5, o.d || 0.02, true); });
  return gn;
}
function bubbler(g, P, o) {
  const osc = g.osc(o.type || 'sine', o.f0), gn = g.gain(0); osc.connect(gn); gn.connect(o.dest || P.out);
  P.rand(o.min, o.max, t => { const f = rnd(o.f0, o.f1); glide(osc.frequency, t, f, f * (o.rise || 1.6), o.d || 0.06, true); pulse(gn.gain, t, (o.v || 0.2) * rnd(0.4, 1), o.d || 0.06); });
  return gn;
}
function hum(g, P, f, v, parts) {
  const gn = g.gain(v); gn.connect(P.out);
  (parts || [1, 0.5, 0.25]).forEach((a, i) => { const o = g.osc(i ? 'triangle' : 'sine', f * (i + 1)), h = g.gain(a); o.connect(h); h.connect(gn); });
  return gn;
}
function chuffer(g, P, rate, v, knock) {
  const s = g.noise('white'), lp = g.filter('lowpass', 300, 1.2), gn = g.gain(0); s.connect(lp); lp.connect(gn); gn.connect(P.out);
  P.every(1 / rate, 0.04, t => {
    lp.frequency.setValueAtTime(300, t); lp.frequency.exponentialRampToValueAtTime(2400, t + 0.04); lp.frequency.setTargetAtTime(280, t + 0.05, 0.06);
    pulse(gn.gain, t, v * rnd(0.85, 1), 0.16);
    if (knock) P.hit((h, t0) => { tone(h, P.out, t0, { f: 140, f2: 70, peak: knock, d: 0.05 }); return 0.1; }, t);
  });
}
function creak(h, dest, t, f, v, d) { burst(h, dest, t, { f: f || 420, f2: (f || 420) * 1.4, q: 12, peak: v || 0.4, a: 0.03, d: d || 0.22 }); tone(h, dest, t, { f: (f || 420) * 0.5, f2: (f || 420) * 0.7, gd: d || 0.22, type: 'triangle', peak: (v || 0.4) * 0.35, a: 0.03, d: d || 0.22 }); return (d || 0.22) + 0.3; }
function hammerHit(h, dest, t, f, v) {
  fm(h, dest, t, { f, ratio: 3.53, index: 1.6, idecay: 0.06, peak: v * 0.6, d: 0.14 });
  tone(h, dest, t, { f: 110, f2: 50, peak: v, d: 0.09 }); click(h, dest, t, v * 0.6, 3000);
  burst(h, dest, t, { type: 'lowpass', f: 1200, f2: 200, peak: v * 0.5, d: 0.06 });
  return 0.4;
}

const LOOPS = {
  furnace(g, P) {
    g.bed('brown', 'lowpass', 180, 1.4, 0.7).connect(P.out);
    crackler(g, P, { f: 2600, q: 2, v: 0.28, min: 0.12, max: 0.33, d: 0.018, sweep: true });
    hum(g, P, 60, 0.05, [1, 0.3]);
  },
  kiln(g, P) {
    g.bed('brown', 'lowpass', 260, 1, 0.45).connect(P.out);
    const w = g.bed('pink', 'bandpass', 420, 4, 0.12); w.connect(P.out); g.lfo(0.3, 90, w.filter.frequency); g.lfo(0.23, 0.05, w.gain);
    const o = g.osc('sine', 190), og = g.gain(0.06); o.connect(og); og.connect(P.out); g.lfo(0.31, 4, o.frequency);
    crackler(g, P, { f: 2200, q: 2, v: 0.12, min: 0.25, max: 0.7, d: 0.015 });
  },
  forge(g, P) {
    g.bed('brown', 'lowpass', 200, 1.2, 0.4).connect(P.out);
    crackler(g, P, { f: 3000, q: 2, v: 0.2, min: 0.1, max: 0.3, d: 0.015, sweep: true });
    P.every(1 / 1.5, 0.05, t => P.hit((h, t0) => hammerHit(h, P.out, t0, rnd(1700, 1900), 0.55), t));
  },
  hammer(g, P) {
    g.bed('brown', 'lowpass', 150, 1, 0.3).connect(P.out);
    hum(g, P, 45, 0.05, [1, 0.4]);
    P.every(1 / 0.8, 0.04, t => { P.hit((h, t0) => creak(h, P.out, t0, 380, 0.22, 0.2), t); P.hit((h, t0) => hammerHit(h, P.out, t0, rnd(1100, 1300), 0.85), t + 0.32); });
  },
  saw(g, P) {
    const b = g.bed('white', 'bandpass', 1800, 2, 0.35); b.connect(P.out); g.lfo(2, 320, b.filter.frequency); g.lfo(2, 0.08, b.gain);
    const s = g.osc('sawtooth', 400), lp = g.filter('lowpass', 1200, 1), sg = g.gain(0.06); s.connect(lp); lp.connect(sg); sg.connect(P.out); g.lfo(2, 9, s.frequency);
    hum(g, P, 90, 0.06, [1, 0.5]);
  },
  mill(g, P) {
    g.bed('brown', 'lowpass', 150, 1.1, 0.6).connect(P.out);
    const r = g.bed('pink', 'bandpass', 500, 1, 0.25); r.connect(P.out); g.lfo(0.7, 0.1, r.gain); g.lfo(0.35, 120, r.filter.frequency);
    P.every(2.6, 0.3, t => P.hit((h, t0) => { tone(h, P.out, t0, { type: 'triangle', f: 1400, f2: 1750, gd: 0.2, peak: 0.07, a: 0.05, d: 0.22 }); return 0.5; }, t));
  },
  steam(g, P) {
    g.bed('pink', 'highpass', 2500, 0.7, 0.08).connect(P.out);
    chuffer(g, P, 2.4, 0.6, 0.35);
  },
  boiler(g, P) {
    g.bed('pink', 'highpass', 3000, 0.7, 0.16).connect(P.out);
    g.bed('brown', 'lowpass', 120, 1, 0.35).connect(P.out);
    bubbler(g, P, { f0: 200, f1: 520, min: 0.07, max: 0.18, v: 0.16, d: 0.06 });
  },
  crusher(g, P) {
    const m = g.osc('sawtooth', 55), lp = g.filter('lowpass', 200, 1.5), mg = g.gain(0.18); m.connect(lp); lp.connect(mg); mg.connect(P.out); g.lfo(0.4, 2, m.frequency);
    const n = g.noise('brown'), cf = g.filter('lowpass', 500, 1), cg = g.gain(0); n.connect(cf); cf.connect(cg); cg.connect(P.out);
    P.every(0.45, 0.6, t => { glide(cf.frequency, t, 1300, 250, 0.2, true); pulse(cg.gain, t, rnd(0.5, 1), 0.2); P.hit((h, t0) => { for (let i = 0; i < 3; i++) burst(h, P.out, t0 + i * 0.03 + rnd(0, 0.04), { f: rnd(900, 2400), q: 3, peak: 0.2, d: 0.02 }); return 0.3; }, t); });
  },
  press(g, P) {
    const w = g.osc('sawtooth', 280), bp = g.filter('bandpass', 900, 4), wg = g.gain(0.1); w.connect(bp); bp.connect(wg); wg.connect(P.out);
    hum(g, P, 50, 0.06, [1, 0.3]);
    P.every(2, 0.05, t => {
      w.frequency.setValueAtTime(280, t); w.frequency.linearRampToValueAtTime(520, t + 1.2); w.frequency.setTargetAtTime(280, t + 1.3, 0.1);
      wg.gain.setValueAtTime(0.06, t); wg.gain.linearRampToValueAtTime(0.16, t + 1.2); wg.gain.setTargetAtTime(0.06, t + 1.3, 0.1);
      P.hit((h, t0) => { tone(h, P.out, t0, { f: 130, f2: 55, peak: 0.7, d: 0.14 }); click(h, P.out, t0, 0.5, 2500); burst(h, P.out, t0 + 0.05, { kind: 'pink', type: 'highpass', f: 2500, peak: 0.25, a: 0.01, d: 0.25 }); return 0.5; }, t + 1.25);
    });
  },
  lathe(g, P) {
    const m = g.osc('sawtooth', 120), lp = g.filter('lowpass', 400, 1), mg = g.gain(0.16); m.connect(lp); lp.connect(mg); mg.connect(P.out);
    const w = g.osc('sine', 3200), wg = g.gain(0.03); w.connect(wg); wg.connect(P.out); g.lfo(5, 80, w.frequency); g.lfo(0.5, 0.02, wg.gain);
    g.bed('white', 'bandpass', 4000, 3, 0.05).connect(P.out);
  },
  wiremill(g, P) {
    const w = g.bed('pink', 'bandpass', 1200, 3, 0.25); w.connect(P.out); g.lfo(12, 0.05, w.gain); g.lfo(0.6, 100, w.filter.frequency);
    hum(g, P, 80, 0.08, [1, 0.4]);
    crackler(g, P, { f: 4000, type: 'highpass', q: 0.7, v: 0.2, min: 0.9, max: 0.9, d: 0.01 });
    const rg = crackler(g, P, { f: 3500, q: 1, v: 0.0, min: 99, max: 99 });
    P.every(0.9, 0.08, t => { for (let i = 0; i < 4; i++) pulse(rg.gain, t + i * 0.035, 0.22, 0.012); });
  },
  assembler(g, P) {
    const b = g.osc('square', 900), bl = g.filter('lowpass', 2000, 1), bg = g.gain(0); b.connect(bl); bl.connect(bg); bg.connect(P.out);
    P.rand(0.4, 1.2, t => { const f = rnd(600, 1400); b.frequency.setValueAtTime(f, t); b.frequency.setValueAtTime(f * rnd(0.7, 1.4), t + 0.05); bg.gain.setValueAtTime(0.05, t); bg.gain.setValueAtTime(0, t + rnd(0.06, 0.12)); });
    const cg = crackler(g, P, { f: 4500, type: 'highpass', q: 0.7, v: 0, min: 99, max: 99 });
    P.every(1.5, 0.3, t => { for (let i = 0; i < 3; i++) pulse(cg.gain, t + i * 0.07, 0.3, 0.008); });
    P.every(2.1, 0.4, t => P.hit((h, t0) => { burst(h, P.out, t0, { kind: 'pink', type: 'lowpass', f: 800, peak: 0.35, a: 0.004, d: 0.06 }); return 0.2; }, t));
    hum(g, P, 100, 0.03, [1, 0.5]);
  },
  electric_hum(g, P) { const h = hum(g, P, 50, 0.14, [1, 0.45, 0.2, 0.08]); g.lfo(0.2, 0.02, h.gain); },
  chemical(g, P) {
    bubbler(g, P, { f0: 120, f1: 350, min: 0.09, max: 0.25, v: 0.18, d: 0.07 });
    g.bed('pink', 'highpass', 3000, 0.7, 0.05).connect(P.out);
    const v = g.bed('pink', 'highpass', 2500, 0.7, 0); v.connect(P.out);
    P.every(2, 0.5, t => env(v.gain, t, 0.25, 0.04, 0.4));
    const th = g.osc('sine', 55), tg = g.gain(0.12); th.connect(tg); tg.connect(P.out); g.lfo(1.8, 0.1, tg.gain);
  },
  refinery(g, P) {
    const s = g.osc('sawtooth', 42), lp = g.filter('lowpass', 120, 2), sg = g.gain(0.35); s.connect(lp); lp.connect(sg); sg.connect(P.out); g.lfo(1.3, 0.15, sg.gain);
    const r = g.bed('brown', 'bandpass', 350, 0.7, 0.4); r.connect(P.out); g.lfo(0.25, 0.15, r.gain);
    g.bed('pink', 'highpass', 3000, 0.7, 0.05).connect(P.out);
  },
  electrolyzer(g, P) {
    const f = g.bed('white', 'highpass', 5000, 0.7, 0.12); f.connect(P.out); g.lfo(13, 0.06, f.gain, 'square');
    crackler(g, P, { f: 6000, type: 'highpass', q: 0.7, v: 0.2, min: 0.05, max: 0.2, d: 0.008 });
    hum(g, P, 100, 0.08, [1, 0.5]);
  },
  centrifuge(g, P) {
    const a = g.osc('sawtooth', 120), b = g.osc('sawtooth', 241, 8), lp = g.filter('lowpass', 800, 1), sg = g.gain(0.1); a.connect(lp); b.connect(lp); lp.connect(sg); sg.connect(P.out);
    const t = now(); a.frequency.setValueAtTime(120, t); a.frequency.exponentialRampToValueAtTime(420, t + 3); b.frequency.setValueAtTime(241, t); b.frequency.exponentialRampToValueAtTime(843, t + 3);
    g.lfo(0.6, 6, a.frequency); g.lfo(0.6, 12, b.frequency);
    const air = g.bed('white', 'bandpass', 900, 2, 0.12); air.connect(P.out); g.lfo(0.6, 0.04, air.gain);
  },
  compressor(g, P) {
    hum(g, P, 60, 0.08, [1, 0.3]);
    const n = g.noise('brown'), lp = g.filter('lowpass', 250, 1), ng = g.gain(0); n.connect(lp); lp.connect(ng); ng.connect(P.out);
    let k = 0;
    P.every(1 / 3, 0.02, t => { pulse(ng.gain, t, 0.6, 0.08); P.hit((h, t0) => { tone(h, P.out, t0, { f: 90, f2: 45, peak: 0.55, d: 0.07 }); return 0.15; }, t); if (++k % 4 === 0) P.hit((h, t0) => { burst(h, P.out, t0, { kind: 'pink', type: 'highpass', f: 2000, peak: 0.3, a: 0.01, d: 0.2 }); return 0.4; }, t + 0.1); });
  },
  arc(g, P) {
    const c = g.bed('white', 'bandpass', 2800, 1.5, 0.3); c.connect(P.out); P.flicker = c.gain;
    const s = g.osc('sawtooth', 100), q = g.osc('square', 50), lp = g.filter('lowpass', 900, 1.5), sg = g.gain(0.22); s.connect(lp); q.connect(lp); lp.connect(sg); sg.connect(P.out);
    P.every(1, 0.8, t => P.hit((h, t0) => { burst(h, P.out, t0, { f: rnd(1500, 3500), q: 0.8, peak: 0.6, d: 0.04 }); tone(h, P.out, t0, { f: 200, f2: 60, peak: 0.3, d: 0.05 }); return 0.15; }, t));
    P.every(0.03, 0.6, t => P.flicker.setValueAtTime(rnd(0.05, 0.4), t));
  },
  vacuum(g, P) {
    const s = g.osc('sine', 38), sg = g.gain(0.3); s.connect(sg); sg.connect(P.out); g.lfo(2.2, 0.12, sg.gain);
    crackler(g, P, { f: 5000, type: 'highpass', q: 0.7, v: 0.12, min: 0.5, max: 1.2, d: 0.006 });
  },
  enrichment(g, P) {
    const lp = g.filter('lowpass', 1500, 0.8), sg = g.gain(0.05); lp.connect(sg); sg.connect(P.out);
    [380, 391, 402, 417].forEach((f, i) => { const o = g.osc('sawtooth', f, rnd(-5, 5)); o.connect(lp); g.lfo(0.13 + i * 0.07, 3, o.frequency); });
    g.bed('white', 'bandpass', 1400, 1.5, 0.1).connect(P.out);
  },
  cryo(g, P) {
    g.bed('pink', 'highpass', 2500, 0.7, 0.14).connect(P.out);
    const s = g.osc('sine', 48), sg = g.gain(0.2); s.connect(sg); sg.connect(P.out); g.lfo(1.1, 0.06, sg.gain);
    P.every(2, 0.6, t => P.hit((h, t0) => { fm(h, P.out, t0, { f: rnd(200, 280), f2: rnd(140, 200), gd: 0.3, ratio: 1.7, index: 3, peak: 0.15, a: 0.02, d: 0.3 }); return 0.6; }, t));
  },
  fabricator(g, P) {
    const cg = crackler(g, P, { f: 3500, type: 'highpass', q: 0.7, v: 0, min: 99, max: 99 });
    P.every(0.5, 0.7, t => { const n = rndi(2, 5); for (let i = 0; i < n; i++) pulse(cg.gain, t + i * 0.04, 0.3, 0.008); });
    const l = g.osc('sine', 4200), lg = g.gain(0); l.connect(lg); lg.connect(P.out);
    P.every(0.3, 0.8, t => pulse(lg.gain, t, 0.08, 0.02));
    const sv = g.osc('square', 900), sl = g.filter('lowpass', 1800, 1), sg = g.gain(0); sv.connect(sl); sl.connect(sg); sg.connect(P.out);
    P.every(1.1, 0.6, t => { glide(sv.frequency, t, rnd(600, 900), rnd(900, 1400), 0.08); env(sg.gain, t, 0.04, 0.01, 0.08); });
    hum(g, P, 120, 0.03, [1, 0.5]);
  },
  nano(g, P) {
    [2100, 3150, 4410].forEach((f, i) => { const o = g.osc('sine', f, rnd(-8, 8)), og = g.gain(0.03); o.connect(og); og.connect(P.out); g.lfo(0.07 + i * 0.05, 0.02, og.gain); });
    const t = g.osc('sine', 6000), tg = g.gain(0); t.connect(tg); tg.connect(P.out);
    P.every(0.09, 0.5, t0 => { t.frequency.setValueAtTime(rnd(5000, 7500), t0); pulse(tg.gain, t0, 0.07, 0.008); });
    P.send(0.3);
  },
  quantum(g, P) {
    const s = g.osc('sine', 32), sg = g.gain(0.35); s.connect(sg); sg.connect(P.out); g.lfo(0.25, 0.3, sg.gain);
    [1760, 2640, 3520].forEach((f, i) => { const o = g.osc('sine', f, rnd(-6, 6)), og = g.gain(0.02); o.connect(og); og.connect(P.out); g.lfo(0.11 + i * 0.09, 0.015, og.gain); g.lfo(0.4 + i * 0.3, 4, o.frequency); });
    P.send(0.35);
  },
  drill_hand(g, P) {
    P.every(1 / 1.5, 0.15, t => P.hit((h, t0) => { click(h, P.out, t0, 0.6, 2500); fm(h, P.out, t0, { f: 1400, ratio: 2.9, index: 1.4, idecay: 0.05, peak: 0.3, d: 0.09 }); burst(h, P.out, t0 + 0.01, { f: 2500, q: 2, peak: 0.3, d: 0.04 }); tone(h, P.out, t0, { f: 160, f2: 80, peak: 0.3, d: 0.04 }); return 0.3; }, t));
  },
  drill_steam(g, P) {
    chuffer(g, P, 1.8, 0.45, 0.25);
    const gr = g.bed('brown', 'lowpass', 300, 1, 0.45); gr.connect(P.out); g.lfo(3, 0.15, gr.gain);
  },
  drill_electric(g, P) {
    const m = g.osc('sawtooth', 95), lp = g.filter('lowpass', 500, 1.2), mg = g.gain(0.18); m.connect(lp); lp.connect(mg); mg.connect(P.out); g.lfo(0.5, 3, m.frequency);
    const gr = g.bed('brown', 'lowpass', 400, 1, 0.4); gr.connect(P.out); g.lfo(11, 0.12, gr.gain);
    const w = g.osc('sine', 2400), wg = g.gain(0.02); w.connect(wg); wg.connect(P.out); g.lfo(0.7, 60, w.frequency);
  },
  drill_laser(g, P) {
    const a = g.osc('sine', 220), b = g.osc('sine', 440, 6), hg = g.gain(0.16); a.connect(hg); b.connect(hg); hg.connect(P.out); g.lfo(0.3, 0.04, hg.gain);
    const h = g.bed('pink', 'bandpass', 3000, 1, 0.22); h.connect(P.out); g.lfo(0.5, 0.08, h.gain);
    crackler(g, P, { f: 3200, q: 3, v: 0.2, min: 0.2, max: 0.9, d: 0.02 });
  },
  drill_plasma(g, P) {
    const r = g.bed('brown', 'lowpass', 220, 2, 0.7); r.connect(P.out); g.lfo(7, 0.2, r.gain);
    const s = g.osc('sawtooth', 55), lp = g.filter('lowpass', 180, 1.5), sg = g.gain(0.3); s.connect(lp); lp.connect(sg); sg.connect(P.out);
    const c = g.bed('white', 'bandpass', 3500, 1.5, 0.15); c.connect(P.out); P.every(0.04, 0.6, t => c.gain.setValueAtTime(rnd(0.02, 0.25), t));
  },
  pump(g, P) {
    const w = g.bed('pink', 'lowpass', 600, 1, 0.3); w.connect(P.out); g.lfo(1.4, 0.22, w.gain); g.lfo(1.4, 250, w.filter.frequency);
    hum(g, P, 70, 0.1, [1, 0.4]);
    bubbler(g, P, { f0: 300, f1: 700, min: 0.4, max: 1.4, v: 0.08, d: 0.05 });
  },
  wheel(g, P) {
    const w = g.bed('pink', 'lowpass', 1200, 0.7, 0.4); w.connect(P.out); g.lfo(0.3, 0.1, w.gain);
    g.bed('white', 'bandpass', 2500, 0.8, 0.08).connect(P.out);
    P.every(2, 0.05, t => P.hit((h, t0) => creak(h, P.out, t0, 360, 0.3, 0.3), t));
    P.every(2, 0.05, t => P.hit((h, t0) => { tone(h, P.out, t0, { f: 110, f2: 70, peak: 0.25, d: 0.08 }); return 0.2; }, t + 0.9));
  },
  windmill(g, P) {
    const w = g.bed('pink', 'bandpass', 600, 0.8, 0.5); w.connect(P.out); g.lfo(0.15, 200, w.filter.frequency); g.lfo(1 / 2.4, 0.25, w.gain);
    P.every(2.4, 0.03, t => P.hit((h, t0) => creak(h, P.out, t0, 480, 0.18, 0.25), t));
  },
  generator_diesel(g, P) {
    const p = g.osc('square', 25), pl = g.filter('lowpass', 220, 1.2), pg = g.gain(0.35); p.connect(pl); pl.connect(pg); pg.connect(P.out);
    const k = g.osc('sawtooth', 50), kl = g.filter('lowpass', 900, 2), kg = g.gain(0.1); k.connect(kl); kl.connect(kg); kg.connect(P.out);
    g.lfo(0.9, 0.6, p.frequency); g.lfo(0.9, 1.2, k.frequency);
    const ex = g.bed('brown', 'lowpass', 300, 1, 0.5); ex.connect(P.out); g.lfo(25, 0.35, ex.gain, 'square');
    g.bed('white', 'bandpass', 1500, 1.5, 0.05).connect(P.out);
  },
  turbine(g, P) {
    const a = g.osc('sawtooth', 200), b = g.osc('sawtooth', 300, 5), lp = g.filter('lowpass', 2000, 0.8), sg = g.gain(0.09); a.connect(lp); b.connect(lp); lp.connect(sg); sg.connect(P.out);
    const t = now(); a.frequency.setValueAtTime(200, t); a.frequency.exponentialRampToValueAtTime(860, t + 4); b.frequency.setValueAtTime(300, t); b.frequency.exponentialRampToValueAtTime(1290, t + 4);
    const w = g.bed('white', 'bandpass', 1200, 0.5, 0.3); w.connect(P.out); g.lfo(0.2, 0.1, w.gain);
  },
  reactor(g, P) {
    hum(g, P, 40, 0.3, [1, 0.5, 0.25]);
    crackler(g, P, { f: 4000, type: 'highpass', q: 0.7, v: 0.25, min: 0.1, max: 0.25, d: 0.005 });
    const c = g.bed('pink', 'lowpass', 900, 0.8, 0.25); c.connect(P.out); g.lfo(0.1, 0.08, c.gain);
  },
  fusion(g, P) {
    const s = g.osc('sine', 28), sg = g.gain(0.5); s.connect(sg); sg.connect(P.out); g.lfo(0.4, 0.4, sg.gain);
    const m = g.osc('sawtooth', 55), ml = g.filter('lowpass', 200, 1.5), mg = g.gain(0.12); m.connect(ml); ml.connect(mg); mg.connect(P.out); g.lfo(0.4, 0.1, mg.gain);
    [1975, 2960].forEach((f, i) => { const o = g.osc('sine', f, rnd(-5, 5)), og = g.gain(0.025); o.connect(og); og.connect(P.out); g.lfo(0.17 + i * 0.1, 3, o.frequency); });
    P.send(0.3);
  },
  lab(g, P) {
    const b = g.osc('sine', 1200), bg = g.gain(0); b.connect(bg); bg.connect(P.out);
    P.every(1.5, 0.6, t => { b.frequency.setValueAtTime(rnd(800, 1800), t); pulse(bg.gain, t, 0.08, 0.05); });
    const pr = g.bed('pink', 'bandpass', 3000, 1.5, 0); pr.connect(P.out);
    P.every(3, 0.6, t => env(pr.gain, t, 0.12, 0.08, 0.3));
  },
  turret_charge(g, P) {
    const w = g.osc('sawtooth', 900), bp = g.filter('bandpass', 1800, 5), wg = g.gain(0.05); w.connect(bp); bp.connect(wg); wg.connect(P.out); g.lfo(3, 40, w.frequency);
    hum(g, P, 100, 0.04, [1, 0.4]);
  },
  farm(g, P) {
    const r = g.bed('pink', 'bandpass', 2500, 1, 0.14); r.connect(P.out); g.lfo(0.4, 0.06, r.gain);
    const i = g.osc('sine', 4200), im = g.gain(0.5), ig = g.gain(0); i.connect(im); im.connect(ig); ig.connect(P.out); g.lfo(22, 0.5, im.gain, 'square');
    P.every(1, 0.6, t => { ig.gain.setValueAtTime(Math.random() < 0.5 ? 0.03 : 0, t); i.frequency.setValueAtTime(rnd(3800, 4600), t); });
  },
  bonsai(g, P) {
    const r = g.bed('pink', 'bandpass', 3000, 1, 0.05); r.connect(P.out); g.lfo(0.5, 0.03, r.gain);
    P.every(3, 0.5, t => P.hit((h, t0) => { tone(h, P.out, t0, { f: 1200, f2: 800, gd: 0.08, peak: 0.12, d: 0.09 }); return 0.3; }, t));
    P.send(0.3);
  }
};
LOOPS.waterwheel = LOOPS.wheel;

/* ── ambience beds (ambient bus; one bed + optional rain/storm overlay) ── */
function rainLayer(g, P) {
  const s = g.noise('white'), hp = g.filter('highpass', 900, 0.7), lp = g.filter('lowpass', 6000, 0.7), rg = g.gain(0.22); s.connect(hp); hp.connect(lp); lp.connect(rg); rg.connect(P.out); g.lfo(0.09, 0.04, rg.gain);
  g.bed('pink', 'bandpass', 1400, 0.7, 0.12).connect(P.out);
  const d = g.osc('sine', 1800), dg = g.gain(0); d.connect(dg); dg.connect(P.out);
  P.rand(0.07, 0.13, t => { const f = rnd(1400, 2400); glide(d.frequency, t, f, f * 0.8, 0.03, true); pulse(dg.gain, t, rnd(0.02, 0.06), 0.025); });
}
const BEDS = {
  surface_day(g, P) {
    const w = g.bed('pink', 'lowpass', 700, 0.8, 0.35); w.connect(P.out); g.lfo(0.07, 300, w.filter.frequency); g.lfo(0.11, 0.12, w.gain);
    g.bed('white', 'bandpass', 2000, 0.5, 0.04).connect(P.out);
    P.rand(4, 12, t => P.hit((h, t0) => {
      const n = rndi(3, 5), base = rnd(2000, 3200); let tt = t0;
      for (let i = 0; i < n; i++) { fm(h, P.out, tt, { f: base * rnd(0.9, 1.1), f2: base * rnd(1.2, 1.7), gd: rnd(0.05, 0.1), ratio: 1, index: 0.3, peak: 0.1, a: 0.01, d: rnd(0.06, 0.12) }); tt += rnd(0.09, 0.16); }
      return tt - t0 + 0.3;
    }, t));
    P.send(0.25);
  },
  surface_night(g, P) {
    [[4300, 30], [4700, 34]].forEach(([f, r]) => {
      const o = g.osc('sine', f), m = g.gain(0.5), e = g.gain(0); o.connect(m); m.connect(e); e.connect(P.out); g.lfo(r, 0.5, m.gain, 'square');
      P.rand(0.6, 1.6, t => { const d = rnd(0.35, 0.9); e.gain.setValueAtTime(0.028, t); e.gain.setValueAtTime(0, t + d); });
    });
    const w = g.bed('brown', 'lowpass', 250, 0.8, 0.3); w.connect(P.out); g.lfo(0.05, 0.1, w.gain);
    g.bed('pink', 'bandpass', 1200, 0.6, 0.03).connect(P.out);
  },
  rain(g, P) { rainLayer(g, P); },
  storm(g, P) {
    rainLayer(g, P);
    const gu = g.bed('pink', 'bandpass', 500, 0.8, 0.12); gu.connect(P.out); g.lfo(0.13, 120, gu.filter.frequency);
    P.rand(3, 8, t => { gu.gain.cancelScheduledValues(t); gu.gain.setValueAtTime(0.12, t); gu.gain.linearRampToValueAtTime(rnd(0.4, 0.6), t + 1.5); gu.gain.linearRampToValueAtTime(0.12, t + 4.5); });
    P.rand(15, 40, t => P.hit((h, t0) => { burst(h, P.out, t0, { kind: 'brown', type: 'lowpass', f: 200, f2: 60, gd: 2.5, q: 1.2, peak: rnd(0.6, 1.1), a: 0.15, d: 2.6 }); burst(h, P.out, t0 + 0.9, { kind: 'brown', type: 'lowpass', f: 120, q: 1, peak: 0.4, a: 0.5, d: 2.0 }); return 4; }, t));
    P.send(0.5);
  },
  caves(g, P) {
    P.rand(0.4, 2.5, t => P.hit((h, t0) => { const f = rnd(900, 2200); tone(h, P.out, t0, { f, f2: f * 0.85, gd: 0.12, peak: rnd(0.08, 0.2), a: 0.002, d: 0.15 }); click(h, P.out, t0, 0.1, 3000); return 0.4; }, t));
    const r = g.bed('brown', 'lowpass', 90, 1, 0.35); r.connect(P.out); g.lfo(0.05, 0.12, r.gain);
    g.bed('pink', 'lowpass', 500, 0.7, 0.06).connect(P.out);
    P.send(0.6);
  },
  deep(g, P) {
    [[220, 0.05], [220.4, 0.05], [330.6, 0.04], [880.5, 0.015], [1320, 0.012]].forEach(([f, v], i) => { const o = g.osc('sine', f), og = g.gain(v); o.connect(og); og.connect(P.out); g.lfo(0.04 + i * 0.03, v * 0.5, og.gain); });
    P.rand(8, 20, t => P.hit((h, t0) => { const f = rnd(900, 1400); [1, 2.4, 3.9].forEach((r, i) => tone(h, P.out, t0 + i * 0.01, { f: f * r, peak: 0.12 / (1 + i), a: 0.005, d: 1.0 - i * 0.2 })); return 1.4; }, t));
    P.send(0.5);
  },
  abyss(g, P) {
    const r = g.bed('brown', 'lowpass', 60, 1, 0.5); r.connect(P.out); g.lfo(0.04, 0.15, r.gain);
    const s = g.osc('sawtooth', 36), sl = g.filter('lowpass', 80, 1.2), sg = g.gain(0.25); s.connect(sl); sl.connect(sg); sg.connect(P.out); g.lfo(0.07, 0.08, sg.gain);
    const v = g.bed('pink', 'highpass', 2500, 0.7, 0); v.connect(P.out);
    P.rand(4, 10, t => env(v.gain, t, rnd(0.1, 0.22), 0.5, 1.5));
    const sh = g.bed('white', 'bandpass', 1800, 1, 0.03); sh.connect(P.out); g.lfo(6, 0.02, sh.gain);
    P.send(0.2);
  },
  core(g, P) {
    [[30, 0.35, 'sine'], [45, 0.15, 'sine'], [30 * 2.37, 0.06, 'sine'], [30 * 3.71, 0.04, 'triangle'], [30 * 5.13, 0.025, 'sine']].forEach(([f, v, type], i) => { const o = g.osc(type, f), og = g.gain(v); o.connect(og); og.connect(P.out); g.lfo(0.03 + i * 0.02, v * 0.4, og.gain); if (i > 1) g.lfo(0.1 + i * 0.05, 1.5, o.frequency); });
    const b = g.bed('pink', 'lowpass', 300, 0.8, 0.15); b.connect(P.out); g.lfo(0.08, 0.12, b.gain);
    P.send(0.4);
  }
};

/* ── patch runtime (shared by machine loops and beds) ── */
function makePatch(builder, dest, wet) {
  const g = new Graph(); g.persistent = true;
  const P = {
    g, out: g.gain(0), jobs: [], I: 1, count: 1,
    every(interval, jitter, fn) { P.jobs.push({ fn, next: now() + rnd(0, interval), int: () => Math.max(0.01, interval * (1 + rnd(-jitter, jitter))) }); },
    rand(min, max, fn) { P.jobs.push({ fn, next: now() + rnd(0, max), int: () => rnd(min, max) }); },
    hit(fn, t) { const h = new Graph(); let d = 0.5; try { d = fn(h, t) || 0.5; } catch (e) { d = 0.1; } h.free(t + d); },
    send(a) { g.send(P.out, a, wet); },
    tick(t) { for (const j of P.jobs) { if (j.next < t - 1) j.next = t; let n = 0; while (j.next < t + LOOK && n++ < 64) { j.fn(j.next); j.next += j.int(); } } },
    free(at) { g.free(at); }
  };
  P.out.connect(dest);
  builder(g, P);
  return P;
}

/* ── loop aggregation: one patch per key; loudness = min(1, 0.35 + 0.22·log2(1+count))·intensity ── */
const LOOP_TRIM = { generator_diesel: 0.75, drill_plasma: 0.8, fusion: 0.85, refinery: 0.85, furnace: 0.9 };
const loops = new Map(), pending = new Map();
let frameNo = 0, resumeAcc = 0;
function loudness(count, I) { return Math.min(1, 0.35 + 0.22 * Math.log2(1 + count)) * I; }
function updateLoops(t, dt) {
  for (const [key, c] of pending) {
    if (c.count <= 0) continue;
    let s = loops.get(key);
    if (!s) { s = { key, P: null, fade: 0, loud: 0, seen: 0, missed: 0, on: false, count: 0, I: 0 }; loops.set(key, s); }
    s.seen = frameNo; s.missed = 0; s.on = true; s.loud = loudness(c.count, c.I); s.count = c.count; s.I = c.I;
    c.count = 0; c.I = 0; c.uids.clear();
  }
  for (const s of loops.values()) {
    if (s.seen !== frameNo && ++s.missed >= 2) s.on = false;
    if (s.on) {
      if (!s.P) { if (s.fade === 0 && activeNodes() >= LOOP_BUDGET) continue; s.P = makePatch(LOOPS[s.key], A.busses.sfx, 'sfx'); }
      s.fade = Math.min(1, s.fade + dt / FADE_IN);
    } else s.fade = Math.max(0, s.fade - dt / FADE_OUT);
    if (s.P) {
      s.P.I = s.I; s.P.count = s.count;
      s.P.out.gain.setTargetAtTime(s.fade * s.loud * (LOOP_TRIM[s.key] || 1), t, 0.04);
      s.P.tick(t);
      if (!s.on && s.fade === 0) { s.P.free(t + 0.1); s.P = null; }
    }
    if (!s.on && s.fade === 0) loops.delete(s.key);
  }
  A.stats.loops = loops.size;
}
function activeNodes() { let n = 0; for (const s of loops.values()) if (s.P) n += s.P.g.nodes.length; return n; }

/* ── beds: slot 'bed' (one at a time) + slot 'overlay' (rain/storm); equal-power crossfade 3 s ── */
const slots = { bed: { want: null, list: [] }, overlay: { want: null, list: [] } };
function updateBeds(t, dt) {
  let n = 0;
  for (const k in slots) {
    const sl = slots[k];
    if (sl.want && !sl.list.some(b => b.name === sl.want)) sl.list.push({ name: sl.want, P: makePatch(BEDS[sl.want], A.busses.ambient, 'ambient'), level: 0 });
    for (let i = sl.list.length - 1; i >= 0; i--) {
      const b = sl.list[i], up = b.name === sl.want;
      b.level = up ? Math.min(1, b.level + dt / BED_XFADE) : Math.max(0, b.level - dt / BED_XFADE);
      b.P.out.gain.setTargetAtTime(Math.sin(b.level * Math.PI / 2), t, 0.05);
      b.P.tick(t);
      if (!up && b.level === 0) { b.P.free(t + 0.2); sl.list.splice(i, 1); }
    }
    n += sl.list.length;
  }
  A.stats.beds = n;
}

/* ── one-shot voices ── */
const voices = [], rate = {};
function spatial(o) {
  try {
    if (o.layer !== undefined && o.layer !== null && LD.G && o.layer !== LD.G.view.layer) return null;
    const R = LD.Render; if (!R || !R.tileToScreen) return { g: 1, pan: 0 };
    const s = R.tileToScreen(o.x, o.y); if (!s) return { g: 1, pan: 0 };
    const nx = s.x / 1920 - 0.5, ny = s.y / 1080 - 0.5;
    const off = Math.hypot(Math.max(0, Math.abs(nx) - 0.5), Math.max(0, Math.abs(ny) - 0.5));
    return { g: off <= 0 ? 1 : Math.max(0.12, 1 - off * 2.5), pan: clamp(nx * 1.4, -0.7, 0.7) };
  } catch (e) { return { g: 1, pan: 0 }; }
}
function cullVoices(t) {
  for (let i = voices.length - 1; i >= 0; i--) if (voices[i].end <= t) voices.splice(i, 1);
  while (voices.length >= VOICE_CAP) {
    let k = 0;
    for (let i = 1; i < voices.length; i++) if (voices[i].v < voices[k].v || (voices[i].v === voices[k].v && voices[i].t0 < voices[k].t0)) k = i;
    const v = voices[k]; v.out.gain.cancelScheduledValues(t); v.out.gain.setTargetAtTime(0, t, 0.008); v.g.free(t + 0.05); voices.splice(k, 1);
  }
  A.stats.voices = voices.length;
}
function playNow(name, opts) {
  const def = SFX[name]; if (!def) return;
  const t = now(), r = rate[name] || (rate[name] = { n: 0, t });
  if (t - r.t >= 1) { r.t = t; r.n = 0; }
  if (++r.n > RATE_CAP) return;
  let mul = opts.gain === undefined ? 1 : +opts.gain || 0, pan = 0;
  if (opts.x !== undefined && opts.y !== undefined) { const sp = spatial(opts); if (!sp) return; mul *= sp.g; pan = sp.pan; }
  if (mul <= 0.002) return;
  cullVoices(t);
  const g = new Graph(), out = g.gain(def.g * mul);
  let last = out; if (pan) { const pn = g.pan(pan); out.connect(pn); last = pn; }
  last.connect(A.busses.sfx); if (def.send) g.send(out, def.send, 'sfx');
  const p = (opts.pitch === undefined ? 1 : +opts.pitch || 1) * (1 + rnd(-0.04, 0.04));
  const dur = def.b(g, out, t, p, opts) || 0.5;
  g.free(t + dur + 0.15);
  voices.push({ g, out, name, v: def.g * mul, t0: t, end: t + dur });
}

/* ── public API ── */
const warned = {};
function guard(fnName, fn) { return function () { if (!ctx || !A.unlocked) return; try { return fn.apply(null, arguments); } catch (e) { if (!warned[fnName]) { warned[fnName] = true; console.warn('[Audio] ' + fnName + ' failed:', e); } } }; }
A.init = () => {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return A.unlocked; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
  try {
    ctx = A.ctx = new AC({ latencyHint: 'interactive' });
    makeBuffers();
    const master = ctx.createGain(); master.gain.value = vcurve(vol.master);
    const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -8; lim.ratio.value = 12; lim.attack.value = 0.003; lim.release.value = 0.12; lim.knee.value = 4;
    master.connect(lim); lim.connect(ctx.destination);
    A.busses.master = master; A.limiter = lim;
    for (const b of ['music', 'sfx', 'ambient']) { const gn = ctx.createGain(); gn.gain.value = vcurve(vol[b]); gn.connect(master); A.busses[b] = gn; }
    const conv = ctx.createConvolver(); conv.buffer = buffers.ir;
    const rl = ctx.createBiquadFilter(); rl.type = 'lowpass'; rl.frequency.value = 4200;
    const rg = ctx.createGain(); rg.gain.value = 0.55; conv.connect(rl); rl.connect(rg); rg.connect(master);
    A.reverb = conv; A.reverbSend = rg; A.wet = {};
    for (const b of ['sfx', 'ambient', 'music']) { const w = ctx.createGain(); w.gain.value = vcurve(vol[b]); w.connect(conv); A.wet[b] = w; }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    document.addEventListener('visibilitychange', () => { if (!document.hidden && ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); });
    A.unlocked = true;
  } catch (e) { console.warn('[Audio] init failed:', e); ctx = A.ctx = null; A.unlocked = false; }
  return A.unlocked;
};
A.setVolumes = v => {
  if (!v) return;
  for (const k of ['master', 'music', 'sfx', 'ambient']) if (v[k] !== undefined && v[k] !== null && !isNaN(+v[k])) vol[k] = clamp(+v[k], 0, 1);
  if (!ctx) return;
  try {
    const t = now();
    for (const k of ['master', 'music', 'sfx', 'ambient']) { const b = A.busses[k]; if (b) b.gain.setTargetAtTime(vcurve(vol[k]), t, 0.05); const w = A.wet && A.wet[k]; if (w) w.gain.setTargetAtTime(vcurve(vol[k]), t, 0.05); }
  } catch (e) { /* context closed */ }
};
A.play = guard('play', (name, opts) => playNow(name, opts || {}));
A.loop = guard('loop', (key, uid, intensity) => {
  if (!LOOPS[key]) return;
  let c = pending.get(key); if (!c) { c = { count: 0, I: 0, uids: new Set() }; pending.set(key, c); }
  if (uid !== undefined && uid !== null) { if (c.uids.has(uid)) return; c.uids.add(uid); }
  c.count++; const I = intensity === undefined || intensity === null ? 1 : clamp(+intensity || 0, 0, 1.5); if (I > c.I) c.I = I;
});
A.stopLoop = guard('stopLoop', uid => { for (const c of pending.values()) if (c.uids.delete(uid)) c.count = Math.max(0, c.count - 1); });
A.ambient = (L, night, weather) => {
  L = clamp(L | 0, 0, 4);
  slots.bed.want = L === 0 ? (night ? 'surface_night' : 'surface_day') : ['caves', 'deep', 'abyss', 'core'][L - 1];
  slots.overlay.want = L === 0 ? (weather === 'storm' ? 'storm' : weather === 'rain' ? 'rain' : null) : null;
};
A.update = guard('update', dt => {
  dt = clamp(+dt || 0, 0, 0.25); frameNo++;
  if (ctx.state === 'suspended') { resumeAcc += dt; if (resumeAcc >= 1) { resumeAcc = 0; ctx.resume().catch(() => {}); } }
  const t = ctx.currentTime;
  updateLoops(t, dt); updateBeds(t, dt);
  for (let i = voices.length - 1; i >= 0; i--) if (voices[i].end <= t) voices.splice(i, 1);
  for (let i = reap.length - 1; i >= 0; i--) if (reap[i].at <= t) { reap[i].g._kill(); reap.splice(i, 1); }
  A.stats.voices = voices.length;
});
A.stopAll = guard('stopAll', () => {
  const t = now();
  for (const s of loops.values()) if (s.P) { s.P.out.gain.setTargetAtTime(0, t, 0.03); s.P.free(t + 0.15); }
  loops.clear(); pending.clear();
  for (const k in slots) { for (const b of slots[k].list) { b.P.out.gain.setTargetAtTime(0, t, 0.03); b.P.free(t + 0.15); } slots[k].list.length = 0; slots[k].want = null; }
  for (const c of pending.values()) { c.count = 0; c.I = 0; c.uids.clear(); }
  for (const v of voices) { v.out.gain.setTargetAtTime(0, t, 0.01); v.g.free(t + 0.05); }
  voices.length = 0;
});
A.has = name => !!(SFX[name] || LOOPS[name] || BEDS[name]);
A.keys = { sfx: Object.keys(SFX), loops: Object.keys(LOOPS), beds: Object.keys(BEDS) };
A.noiseBuffer = kind => buffers[kind] || null;
A.now = now;
})();
