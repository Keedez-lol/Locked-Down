(() => {
'use strict';
const LD = window.LD;
const TAU = Math.PI * 2;
const BPM = 400 / 3, BEAT = 60 / BPM, STEP = BEAT / 4, BAR = BEAT * 4;   // 133.33 BPM = the KDZ animation's 0.45 s beat
const LOOK = 0.4, XFADE = 3, MENU_LEVEL = 1, BED_LEVEL = 0.26 /* beds ≈ −22 dBFS peaks at the music bus, measured */, PRE = 0.5, TRIM = 0.8 /* menu peaks ≈ −12 dBFS at the music bus, clipper knee only on act III hits */, DUCK = 0.355 /* −9 dB */;
const SEED = 0x4b445a;
const smooth = t => { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };

let env = null, live = [], current = null, pending = null, pollTimer = 0, pumpTimer = 0, tickerArmed = false, duckUntil = 0;
const warned = {};
const warnOnce = (k, err) => { if (warned[k]) return; warned[k] = true; console.warn('[LD.Music] ' + k + ':', err); };
const isNode = (n, ctx) => !!n && typeof n.connect === 'function' && (!ctx || n.context === ctx);
const asNode = (c, ctx) => isNode(c, ctx) ? c : c && isNode(c.input, ctx) ? c.input : c && isNode(c.node, ctx) ? c.node : null;

/* ── shared graph: sum → soft clip → trim → duck → LD.Audio.busses.music ── */
function pickBus(A, ctx) {
  const b = A.busses || {};
  for (const c of [b.music, b.master, A.musicBus, A.master]) { const n = asNode(c, ctx); if (n) return n; }
  return ctx.destination;
}
function clipCurve() {   // WaveShaper curves span input [−1, 1]: linear to 0.6, soft knee above, ceiling 0.9
  const n = 2049, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1, a = Math.abs(x); c[i] = a <= 0.6 ? x : Math.sign(x) * (0.6 + 0.4 * Math.tanh((a - 0.6) / 0.4)); }
  return c;
}
function driveCurve(k) {
  const n = 1025, c = new Float32Array(n), norm = Math.tanh(k);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(k * x) / norm; }
  return c;
}
function makeIR(ctx) {
  const sr = ctx.sampleRate, len = Math.floor(sr * 1.8), pre = Math.floor(sr * 0.012), buf = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch); let lp = 0;
    for (let i = pre; i < len; i++) { lp += 0.3 * ((Math.random() * 2 - 1) - lp); d[i] = lp * Math.exp(-3.4 * (i - pre) / len); }
  }
  return buf;
}
function noiseBuf(e) {
  if (!e.noise) { const sr = e.ctx.sampleRate, b = e.ctx.createBuffer(1, Math.floor(sr * 2), sr), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; e.noise = b; }
  return e.noise;
}
function resolveEnv() {
  const A = LD.Audio; if (!A) return null;
  const ctx = A.ctx || A.context || A.ac || A.actx;
  if (!ctx || typeof ctx.createGain !== 'function') return null;
  if (env && env.ctx === ctx) {
    const bus = pickBus(A, ctx);
    if (bus !== env.bus) { try { env.duck.disconnect(); env.duck.connect(bus); env.bus = bus; } catch (err) { warnOnce('bus', err); } }
    return env;
  }
  if (env) teardownEnv();
  const e = { ctx, bus: pickBus(A, ctx), sum: ctx.createGain(), clip: ctx.createWaveShaper(), trim: ctx.createGain(), duck: ctx.createGain(), reverbIn: ctx.createGain(), sink: ctx.createGain(), noise: null, silence: null, localReverb: null };
  e.sum.gain.value = PRE; e.clip.curve = clipCurve(); e.trim.gain.value = TRIM;
  e.sum.connect(e.clip); e.clip.connect(e.trim); e.trim.connect(e.duck); e.duck.connect(e.bus);
  e.sink.gain.value = 0; e.sink.connect(ctx.destination);
  const send = asNode(A.reverbSend, ctx);
  if (send) e.reverbIn.connect(send);
  else { const cv = ctx.createConvolver(), ret = ctx.createGain(); cv.buffer = makeIR(ctx); ret.gain.value = 0.5; e.reverbIn.connect(cv); cv.connect(ret); ret.connect(e.sum); e.localReverb = [cv, ret]; }
  e.silence = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * 0.1)), ctx.sampleRate);
  env = e;
  return e;
}
function teardownEnv() {
  const e = env; env = null; stopPump();
  for (const tr of live) dispose(tr);
  live = []; current = null;
  if (!e) return;
  for (const n of [e.sum, e.clip, e.trim, e.duck, e.reverbIn, e.sink].concat(e.localReverb || [])) { try { n.disconnect(); } catch (_) { /* already gone */ } }
}

/* ── tracks (menu sequencer or a layer bed): own gain + wet send, node/source bookkeeping, sparse events, ramp-LFOs ── */
function makeTrack(e, level) {
  const ctx = e.ctx;
  const tr = { e, level, gain: ctx.createGain(), wet: ctx.createGain(), nodes: [], sources: new Set(), autos: [], events: [], tick: null, fading: false, quiet: false, killAt: 0 };
  tr.gain.gain.value = 0; tr.wet.gain.value = 0;
  tr.gain.connect(e.sum); tr.wet.connect(e.reverbIn);
  tr.nodes.push(tr.gain, tr.wet);
  return tr;
}
const node = (tr, n) => { tr.nodes.push(n); return n; };
function src(tr, s, stopAt) { tr.sources.add(s); s.onended = () => tr.sources.delete(s); if (stopAt !== undefined) s.stop(stopAt); return s; }
function gainNode(tr, v, dest) { const g = node(tr, tr.e.ctx.createGain()); g.gain.value = v; if (dest) g.connect(dest); return g; }
function filt(tr, type, f, q, dest) { const b = node(tr, tr.e.ctx.createBiquadFilter()); b.type = type; b.frequency.value = f; b.Q.value = q; if (dest) b.connect(dest); return b; }
function panner(tr, pan, dest) {
  const ctx = tr.e.ctx;
  const p = node(tr, ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain());
  if (p.pan) p.pan.value = pan;
  if (dest) p.connect(dest);
  return p;
}
function tone(tr, type, f, detune, level, dest) {
  const o = node(tr, tr.e.ctx.createOscillator()), g = gainNode(tr, level, dest);
  o.type = type; o.frequency.value = f; if (detune) o.detune.value = detune;
  o.connect(g); o.start(); src(tr, o);
  return { o, g };
}
function rampTrack(tr, from, to, t, dur) {
  for (const p of [tr.gain.gain, tr.wet.gain]) { p.cancelScheduledValues(t); p.setValueAtTime(from === null ? p.value : from, t); p.linearRampToValueAtTime(to, t + dur); }
}
function autom(tr, param, fn, seg) { tr.autos.push({ param, fn, seg, t: -1 }); }
function every(tr, first, fn) { tr.events.push({ t: first, fn }); }
function runTrack(tr, now, horizon) {
  for (const a of tr.autos) {
    if (a.t < now - 0.5) { a.t = now + 0.01; a.param.cancelScheduledValues(a.t); a.param.setValueAtTime(a.fn(a.t), a.t); }
    while (a.t < horizon) { const n = a.t + a.seg; a.param.linearRampToValueAtTime(a.fn(n), n); a.t = n; }
  }
  for (const ev of tr.events) {
    if (ev.t < now - 1) ev.t = now + 0.2;
    while (ev.t < horizon) ev.t += Math.max(0.05, ev.fn(ev.t) || 1);
  }
  if (tr.tick) tr.tick(now, horizon);
}
function dispose(tr) {
  for (const s of tr.sources) { try { s.onended = null; s.stop(); } catch (_) { /* not started or already stopped */ } }
  tr.sources.clear();
  for (const n of tr.nodes) { try { n.disconnect(); } catch (_) { /* already gone */ } }
  tr.nodes.length = 0; tr.autos.length = 0; tr.events.length = 0; tr.tick = null;
}
function fadeOut(tr, fade) {
  rampTrack(tr, null, 0, tr.e.ctx.currentTime, Math.max(0.01, fade));
  tr.fading = true; tr.quiet = true; tr.killAt = tr.e.ctx.currentTime + fade + 0.05;
}

/* FM pluck / bell: sine carrier, sine modulator at `ratio`, index decays fast; `send` = reverb amount */
function pluck(tr, t, f, vel, ratio, index, decay, send) {
  const ctx = tr.e.ctx, car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
  car.type = 'sine'; mod.type = 'sine'; car.frequency.value = f; mod.frequency.value = f * ratio;
  mg.gain.setValueAtTime(f * index, t); mg.gain.exponentialRampToValueAtTime(f * 0.02, t + Math.min(0.3, decay * 0.35));
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  mod.connect(mg); mg.connect(car.frequency); car.connect(g); g.connect(tr.gain);
  if (send > 0) { const s = ctx.createGain(); s.gain.value = send; g.connect(s); s.connect(tr.wet); }
  mod.start(t); car.start(t); src(tr, mod, t + decay + 0.05); src(tr, car, t + decay + 0.05);
}
const walk = (i, n, r) => { const d = r < 0.5 ? -1 - Math.floor(r * 4) : 1 + Math.floor((r - 0.5) * 4); let j = i + d; if (j < 0) j = -j; if (j >= n) j = 2 * n - 2 - j; return j === i ? (i + 1) % n : j; };

/* ── menu: groove phase-locked to the KDZ sheet ──
   The sheet is a 20 s cycle whose explicit beats (act III) are 0.45 s apart, so the 16th grid is anchored there:
   beat b ↔ u = act3 + 0.45·b for b ∈ [−21, 22]; the cycle's remaining 0.2 s is absorbed by the impact at `lead`.
   Cues off the grid (slab, zoom, panels, wipe) get one-shot accents at their exact time. Eight cycles form the macro
   loop (chord, bass root, density and patterns change per cycle), so the piece only repeats every 160 s. */
const CYC = 20;
const SHEET = { construct1: 1.25, spec1: 1.9, act2: 3.2, detailIn: 4.35, detailOut: 5.5, dBand: 5.85, zDraw: 7.0, triptych: 8.2, panelStagger: 0.07, triptychOut: 9.38, act3: 9.8, act4: 15.2, titleBlock: 15.9, values: 16.0, notes: 16.1, breathe: 16.65, breathPeriod: 2.4, exit: 19.1, lead: 19.7 };
const NAMED = { push1: 2, giantD: 3, pull1: 4, tiny: 5, push2: 6, giantK: 7, pull2: 8, hit: 9, converge: 11 };
const ROOTS = [73.42, 73.42, 58.27, 87.31, 65.41, 58.27, 98, 55];   // bass root per cycle: D · D · B♭ · F · C · B♭ · G · A
const CHORDS = [[174.61, 220, 329.63], [174.61, 220, 261.63], [174.61, 233.08, 293.66], [174.61, 261.63, 329.63], [164.81, 196, 261.63], [174.61, 233.08, 349.23], [174.61, 220, 293.66], [164.81, 196, 293.66]];   // Dm9 · Dm7 · B♭maj7 · Fmaj7 · Cadd9 · B♭maj7 · Gm9 · A7sus
const SCALE = [293.66, 349.23, 392, 440, 523.25, 587.33, 698.46, 783.99, 880];   // D minor pentatonic D4–A5
const BASS_PAT = [[1, 0, 0, 2, 0, 0, 1, 0, 1, 0, 0, 2, 0, 3, 0, 0], [1, 0, 1, 0, 2, 0, 1, 0, 1, 0, 1, 0, 3, 0, 2, 0], [1, 0, 0, 1, 0, 2, 0, 1, 0, 0, 1, 0, 2, 0, 3, 2], [1, 1, 0, 2, 1, 0, 0, 1, 1, 1, 0, 2, 1, 0, 3, 0]];
const BASS_DRIVE = [1, 1, 2, 1, 1, 1, 2, 1, 1, 2, 1, 1, 3, 3, 2, 2], BASS_INTRO = [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0];
const HAT_VEL = [1, 0.35, 0.65, 0.35], ARP_DENS = [0.22, 0.3, 0.38, 0.45, 0.25, 0.42, 0.5, 0.55];
const subOf = c => ROOTS[c] / 2 < 32 ? ROOTS[c] : ROOTS[c] / 2;
function makeMenu(e) {
  const ctx = e.ctx, tr = makeTrack(e, MENU_LEVEL), H = (a, b) => LD.U.hash2(a, b, SEED), N = noiseBuf(e);
  const K = LD.Main && LD.Main.kdz, S = Object.assign({}, SHEET, K && K.cues), NB = Object.assign({}, NAMED, K && K.beats);
  const beat = K && K.beat > 0 ? K.beat : BEAT, step = beat / 4;

  /* graph: groove → sweepable low-pass → track; bass, sub and pad are ducked by every kick */
  const busLP = filt(tr, 'lowpass', 5500, 0.6, tr.gain), bus = gainNode(tr, 1, busLP), pumpG = gainNode(tr, 1, bus);
  const kickOut = gainNode(tr, 1, null), kDrive = node(tr, ctx.createWaveShaper()); kDrive.curve = driveCurve(1.7); kickOut.connect(kDrive); kDrive.connect(bus);
  const hatOut = filt(tr, 'highpass', 5200, 0.7, bus);
  const HAT_IN = [[-0.16, 7400], [0.22, 8600], [-0.3, 6800], [0.12, 7900]].map(([pan, f]) => { const bp = filt(tr, 'bandpass', f, 1.1, null); bp.connect(panner(tr, pan, hatOut)); return bp; });
  const clapOut = filt(tr, 'highpass', 700, 0.7, bus), arpOut = gainNode(tr, 1, bus);
  const subG = gainNode(tr, 0, pumpG), sub = tone(tr, 'sine', subOf(0), 0, 0.42, subG);
  subG.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.5);
  const padLP = filt(tr, 'lowpass', 1100, 0.8, pumpG), padEnv = gainNode(tr, 0, padLP);
  const pad = [tone(tr, 'sawtooth', CHORDS[0][0], -7, 0.12, padEnv), tone(tr, 'sawtooth', CHORDS[0][1], 5, 0.1, padEnv), tone(tr, 'triangle', CHORDS[0][2], 0, 0.15, padEnv)];
  const setChord = (t, c) => CHORDS[c].forEach((f, i) => pad[i].o.frequency.setTargetAtTime(f, t, 0.03));
  const hold = (p, t, v) => { if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t); else { p.cancelScheduledValues(t); p.setValueAtTime(v, t); } };

  /* voices */
  const burst = (t, dest, o) => {
    const s = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain(), a = o.a || 0.002;
    s.buffer = N; bp.type = o.type || 'bandpass'; bp.Q.value = o.q || 1; bp.frequency.setValueAtTime(o.f, t); if (o.f2) bp.frequency.exponentialRampToValueAtTime(o.f2, t + a + o.d);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(o.peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + o.d);
    s.connect(bp); bp.connect(g); g.connect(dest);
    s.start(t, Math.random() * 1.2, a + o.d + 0.05); src(tr, s, t + a + o.d + 0.06);
  };
  const duck = t => { const g = pumpG.gain; g.cancelScheduledValues(t); g.setValueAtTime(1, t); g.linearRampToValueAtTime(0.3, t + 0.012); g.linearRampToValueAtTime(1, t + 0.24); };
  const kick = (t, v) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.045);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.9 * v, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g); g.connect(kickOut); o.start(t); src(tr, o, t + 0.22);
    burst(t, kickOut, { type: 'highpass', f: 1800, q: 0.7, peak: 0.22 * v, d: 0.012 });
    duck(t);
  };
  const hat = (t, v, open, chain) => {
    const s = ctx.createBufferSource(), g = ctx.createGain();
    s.buffer = N; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.42 * v, t + 0.0015); g.gain.exponentialRampToValueAtTime(0.0001, t + (open ? 0.1 : 0.028));
    s.connect(g); g.connect(HAT_IN[chain & 3]); s.start(t, Math.random() * 1.2, open ? 0.12 : 0.04); src(tr, s, t + 0.13);
  };
  const clap = (t, v) => { for (let i = 0; i < 3; i++) burst(t + i * 0.011, clapOut, { f: 1500, q: 1.1, peak: 0.45 * v * (i === 2 ? 1 : 0.6), d: i === 2 ? 0.15 : 0.02 }); burst(t + 0.02, tr.wet, { f: 1700, q: 0.8, peak: 0.28 * v, d: 0.22 }); };
  const rim = (t, v, f) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.02);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.32 * v, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    o.connect(g); g.connect(bus); o.start(t); src(tr, o, t + 0.05);
    burst(t, bus, { f: 3400, q: 2, peak: 0.16 * v, d: 0.01 });
  };
  const bassNote = (t, f, v, len) => {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g2 = ctx.createGain(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o2.type = 'square'; o.frequency.value = f; o2.frequency.value = f; o2.detune.value = -1200; g2.gain.value = 0.45;
    lp.type = 'lowpass'; lp.Q.value = 5; lp.frequency.setValueAtTime(140 + 1100 * v, t); lp.frequency.exponentialRampToValueAtTime(120, t + len);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.38 * v, t + 0.004); g.gain.setValueAtTime(0.38 * v, t + len - 0.03); g.gain.linearRampToValueAtTime(0.0001, t + len);
    o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(pumpG);
    o.start(t); o2.start(t); src(tr, o, t + len + 0.02); src(tr, o2, t + len + 0.02);
  };
  const plk = (t, f, v, pan) => {
    const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain(), p = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain(), s = ctx.createGain();
    car.type = 'sine'; mod.type = 'sine'; car.frequency.value = f; mod.frequency.value = f * 2;
    mg.gain.setValueAtTime(f * 1.5, t); mg.gain.exponentialRampToValueAtTime(f * 0.04, t + 0.14);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.2 * v, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    if (p.pan) p.pan.value = pan;
    mod.connect(mg); mg.connect(car.frequency); car.connect(g); g.connect(p); p.connect(arpOut); s.gain.value = 0.4; g.connect(s); s.connect(tr.wet);
    mod.start(t); car.start(t); src(tr, mod, t + 0.45); src(tr, car, t + 0.45);
  };
  const stab = (t, ch, v, dur) => {
    const lp = ctx.createBiquadFilter(), g = ctx.createGain(), s = ctx.createGain();
    lp.type = 'lowpass'; lp.Q.value = 2; lp.frequency.setValueAtTime(3800, t); lp.frequency.exponentialRampToValueAtTime(320, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.15 * v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    for (const f of ch) for (const det of [-9, 8]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f * 2; o.detune.value = det; o.connect(lp); o.start(t); src(tr, o, t + dur + 0.05); }
    lp.connect(g); g.connect(bus); s.gain.value = 0.35; g.connect(s); s.connect(tr.wet);
  };
  const boom = (t, v) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(34, t + 0.35);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.9 * v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(g); g.connect(kickOut); o.start(t); src(tr, o, t + 0.95); duck(t);
  };
  const crash = (t, v) => { burst(t, bus, { type: 'lowpass', f: 9000, f2: 500, q: 0.5, peak: 0.5 * v, a: 0.004, d: 0.7 }); burst(t, tr.wet, { f: 3000, q: 0.6, peak: 0.35 * v, a: 0.004, d: 0.5 }); };
  const push = (t, v) => {
    burst(t, bus, { f: 1900, q: 0.9, peak: 0.5 * v, d: 0.12 });
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(120, t + 0.05);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.35 * v, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(g); g.connect(bus); o.start(t); src(tr, o, t + 0.12);
  };
  const pull = (t, d) => burst(t, bus, { f: 900, f2: 4200, q: 1.2, peak: 0.4, a: d * 0.92, d: 0.03 });
  const riser = (t, d, v) => { burst(t, bus, { f: 600, f2: 7000, q: 0.9, peak: 0.45 * v, a: d * 0.95, d: 0.03 }); burst(t, tr.wet, { f: 800, f2: 5000, q: 0.9, peak: 0.25 * v, a: d * 0.95, d: 0.03 }); };
  const whoosh = (t, f0, f1, d, v) => burst(t, bus, { f: f0, f2: f1, q: 1.4, peak: 0.28 * v, a: d * 0.45, d: d * 0.55 });
  const pop = (t, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = [740, 880, 1046][i] || 800;
    o.type = 'square'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.5, t + 0.05);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.1, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.connect(g); g.connect(bus); o.start(t); src(tr, o, t + 0.07);
    burst(t, bus, { type: 'highpass', f: 2500, q: 0.7, peak: 0.2, d: 0.015 });
  };
  const pencil = (t, i) => rim(t, 0.45, [2600, 3100, 2200][i] || 2600);

  /* per-cycle arpeggio phrases (act II and act IV), deterministic per macro index */
  const ARP = [];
  for (let c = 0; c < 8; c++) {
    const dens = ARP_DENS[c], mk = (salt, oct) => { let ni = 2 + c % 3; const out = []; for (let i = 0; i < 16; i++) { ni = walk(ni, SCALE.length, H(c, salt + i)); const on = H(c, salt + 16 + i) < dens * ((i & 1) ? 0.55 : 1); out.push(on ? { f: SCALE[ni] * (oct && H(c, salt + 32 + i) < 0.3 ? 2 : 1), v: 0.35 + 0.65 * H(c, salt + 48 + i), pan: (H(c, salt + 64 + i) - 0.5) * 0.9 } : null); } return out; };
    ARP.push([mk(0, false), mk(100, true)]);
  }

  /* sheet events */
  const impact = (t, c) => {
    boom(t, 1); crash(t, 0.8);
    subG.gain.cancelScheduledValues(t); subG.gain.setValueAtTime(0.45, t); subG.gain.linearRampToValueAtTime(1, t + S.act2 + CYC - S.lead);
    busLP.frequency.cancelScheduledValues(t); busLP.frequency.setValueAtTime(650, t); busLP.frequency.exponentialRampToValueAtTime(5500, t + S.act2 + CYC - S.lead);
    setChord(t, c); sub.o.frequency.setTargetAtTime(subOf(c), t, 0.06);
    hold(padEnv.gain, t, 0); padEnv.gain.setValueAtTime(0, t); padEnv.gain.linearRampToValueAtTime(0.35, t + 1.5);
    padLP.frequency.cancelScheduledValues(t); padLP.frequency.setValueAtTime(900, t);
  };
  const slab = t => { subG.gain.cancelScheduledValues(t); subG.gain.setValueAtTime(1, t); boom(t, 0.75); burst(t, bus, { type: 'lowpass', f: 1200, f2: 150, q: 0.8, peak: 0.45, a: 0.003, d: 0.25 }); busLP.frequency.cancelScheduledValues(t); busLP.frequency.setValueAtTime(5500, t); };
  const act4 = (t, c) => {
    boom(t, 0.55); stab(t, CHORDS[c], 0.9, 1.4);
    hold(padEnv.gain, t, 0.35); padEnv.gain.linearRampToValueAtTime(1, t + 1.2);
    padLP.frequency.setValueAtTime(900, t); padLP.frequency.exponentialRampToValueAtTime(2200, t + 1.2);
  };
  const breathe = t => { const P = S.breathPeriod, g = padEnv.gain; hold(g, t, 1); for (let i = 0; i < 2; i++) { g.setValueAtTime(1, t + i * P); g.linearRampToValueAtTime(0.5, t + i * P + P / 2); g.linearRampToValueAtTime(1, t + (i + 1) * P); } };
  const wipe = t => {
    const d = S.lead - S.exit; riser(t, d, 0.7);
    busLP.frequency.cancelScheduledValues(t); busLP.frequency.setValueAtTime(5500, t); busLP.frequency.exponentialRampToValueAtTime(700, t + d);
    hold(padEnv.gain, t, 0.8); padEnv.gain.linearRampToValueAtTime(0, t + d * 0.9);
  };
  const named = (t, b, c) => {
    if (b === NB.push1 || b === NB.push2) push(t, 0.8);
    else if (b === NB.giantD || b === NB.giantK) { boom(t, 0.7); stab(t, CHORDS[c], 0.7, 0.35); }
    else if (b === NB.pull1 || b === NB.pull2) pull(t, beat);
    else if (b === NB.tiny) { rim(t, 0.8, 3200); plk(t, SCALE[8], 0.7, 0.3); }
    else if (b === NB.hit) { clap(t, 1); crash(t, 0.6); stab(t, CHORDS[c], 0.8, 0.5); }
    else if (b === NB.converge) riser(t, beat, 0.5);
  };
  const stepEvent = (t, k, c) => {
    if (k === 88) return impact(t, (c + 1) & 7);   // `lead`: the next cycle starts here
    const b = Math.floor(k / 4), subd = k - 4 * b, q = ((b % 4) + 4) % 4, u = S.act3 + k * step, idx = q * 4 + subd;
    const act = u < S.act2 ? 1 : u < S.act3 ? 2 : u < S.act4 ? 3 : u < S.exit ? 4 : 5;
    const brk = c === 4 && act < 3, rise = act === 1 ? Math.max(0, (u - 0.35) / (S.act2 - 0.35)) : 1;
    if (subd === 0 && act !== 5 && !brk && (act !== 1 || b >= -20)) kick(t, act === 1 ? 0.55 + 0.45 * rise : act === 3 ? 1 : 0.9);
    if (act !== 5 && !(brk && (subd & 1))) hat(t, HAT_VEL[subd] * (act === 1 ? 0.45 + 0.55 * rise : 1) * (brk ? 0.6 : 1), act > 1 && c >= 2 && subd === 2, k);
    if (c >= 2 && b === -1 && act === 2) hat(t + step / 2, 0.5 * HAT_VEL[subd], false, k + 2);
    if (subd === 0 && q === 2 && (act === 2 || act === 4) && c >= 1 && !brk) clap(t, 0.8);
    if (c >= 5 && subd === 3 && (q & 1) && (act === 2 || act === 4)) rim(t, 0.5, 1700);
    const pat = act === 1 ? BASS_INTRO : act === 3 ? BASS_DRIVE : BASS_PAT[c & 3], bn = act === 5 ? 0 : pat[idx];
    if (bn) bassNote(t, ROOTS[c] * (bn === 2 ? 2 : bn === 3 ? 1.5 : 1), (subd === 0 ? 1 : 0.7) * (act === 1 ? 0.5 + 0.5 * rise : 1), bn === 1 && subd === 0 ? step * 1.6 : step * 0.9);
    if ((act === 2 || act === 4) && !brk) {
      const n = ARP[c][act === 4 ? 1 : 0][idx]; if (n) plk(t, n.f, n.v, n.pan);
      if ((c === 3 || c === 7) && (subd & 1) === 0) { const m = ARP[c][1][(idx + 5) & 15]; if (m) plk(t + step / 2, m.f * 0.5, m.v * 0.6, -m.pan); }
    }
    if (act === 3 && subd === 0) named(t, b, c);
    if (k === 48) act4(t, c);
  };
  const fire = (ev, t, ecyc) => {
    const c = ecyc & 7;
    if (M._trace && M._trace.length < 2000) M._trace.push({ u: +ev.u.toFixed(4), k: ev.k, kind: ev.kind, c, at: +t.toFixed(4) });
    switch (ev.kind) {
      case 'step': return stepEvent(t, ev.k, c);
      case 'slab': return slab(t);
      case 'zoomIn': return whoosh(t, 350, 3800, 0.7, 1);
      case 'zoomOut': return whoosh(t, 3800, 350, 0.6, 0.8);
      case 'band': boom(t, 0.4); return rim(t, 0.6, 2400);
      case 'pencil': return pencil(t, ev.arg);
      case 'pop': return pop(t, ev.arg);
      case 'riser': return (c & 1) ? riser(t, ev.arg, 0.7) : pull(t, ev.arg);
      case 'breathe': return breathe(t);
      case 'wipe': return wipe(t);
    }
  };
  const EV = [];
  for (let k = -84; k <= 88; k++) EV.push({ u: S.act3 + k * step, k, kind: 'step' });
  const cue = (u, kind, arg) => { if (u >= 0 && u < CYC) EV.push({ u, k: null, kind, arg }); };
  cue(S.construct1, 'pencil', 0); cue(S.spec1, 'pencil', 1); cue(S.act2, 'slab'); cue(S.detailIn, 'zoomIn'); cue(S.detailOut, 'zoomOut'); cue(S.dBand, 'band'); cue(S.zDraw, 'pencil', 2);
  for (let i = 0; i < 3; i++) cue(S.triptych + i * S.panelStagger, 'pop', i);
  cue(S.triptychOut, 'riser', S.act3 - S.triptychOut); cue(S.titleBlock, 'pencil', 0); cue(S.values, 'pencil', 1); cue(S.notes, 'pencil', 2); cue(S.breathe, 'breathe'); cue(S.exit, 'wipe');
  EV.sort((a, b) => a.u - b.u || (a.k === null) - (b.k === null));

  /* clock: follow the sheet while it runs; an internal clock takes over from the last known position when it stalls (hidden tab, reduced motion, no WebGL) */
  const seq = { m: null, cyc: 0, lastPos: null, lastU: null, uInt: 0, stall: 0, aLast: 0, ei: 0, ecyc: 0, ring: [], rate: 1 };
  const sheetTime = now => {
    let u = null;
    if (K && typeof K.rawTime === 'function') { try { if (K.running()) { u = +K.rawTime(); if (!(u >= 0 && u < CYC)) u = null; } } catch (_) { u = null; } }
    const dt = seq.aLast ? Math.min(2, now - seq.aLast) : 0; seq.aLast = now;
    if (u !== null && u !== seq.lastU) { seq.lastU = u; seq.uInt = u; seq.stall = 0; return u; }
    seq.stall += dt;
    if (u !== null && seq.stall < 0.4) return u;
    seq.uInt = (seq.uInt + dt) % CYC;
    return seq.uInt;
  };
  tr.tick = (now, horizon) => {
    if (tr.quiet) return;
    const u = sheetTime(now);
    if (seq.lastPos !== null && u < seq.lastPos - CYC / 2) seq.cyc++;
    seq.lastPos = u;
    const mNow = seq.cyc * CYC + u, mEnd = mNow + (horizon - now);
    const R = seq.ring; R.push([now, mNow]); while (R.length > 2 && now - R[0][0] > 1) R.shift();
    if (seq.stall >= 0.4 || now - R[0][0] < 0.3) seq.rate = 1;
    else { const r = (mNow - R[0][1]) / (now - R[0][0]); seq.rate = r > 0.25 && r < 2 ? r : 1; }
    if (seq.m === null || seq.m < mNow - 0.3 || seq.m > mNow + 1) {
      seq.m = mNow; seq.ecyc = seq.cyc; seq.ei = 0;
      while (seq.ei < EV.length && EV[seq.ei].u < u) seq.ei++;
      if (seq.ei >= EV.length) { seq.ei = 0; seq.ecyc++; }
      setChord(now, seq.ecyc & 7); sub.o.frequency.setTargetAtTime(subOf(seq.ecyc & 7), now, 0.05);
    }
    for (;;) {
      const ev = EV[seq.ei], me = seq.ecyc * CYC + ev.u;
      if (me >= mEnd) break;
      if (me >= seq.m && me >= mNow - 0.15) fire(ev, Math.max(now + 0.004, now + (me - mNow) / seq.rate), seq.ecyc);
      if (++seq.ei >= EV.length) { seq.ei = 0; seq.ecyc++; }
    }
    seq.m = mEnd;
  };
  M._seq = () => ({ m: seq.m, cyc: seq.cyc, u: seq.lastPos, stall: seq.stall, rate: +seq.rate.toFixed(3), source: seq.stall >= 0.4 ? 'internal' : 'kdz' });
  return tr;
}

/* ── layer beds (decision 7): generative, no drums, −8 dB under the menu ── */
const BEDS = [
  function surface(e, tr, t0, H) {   // soft add9 pads + wind swells
    const ctx = e.ctx, CH = [[130.81, 196, 293.66, 329.63], [174.61, 261.63, 392, 440], [196, 293.66, 440, 493.88], [174.61, 220, 261.63, 392]];
    const lp = filt(tr, 'lowpass', 700, 0.7, tr.gain), padEnv = gainNode(tr, 0, lp);
    const voices = CH[0].map((f, i) => tone(tr, 'triangle', f, [-5, 4, -3, 6][i], [0.3, 0.24, 0.2, 0.16][i], padEnv));
    autom(tr, lp.frequency, t => 700 + 200 * Math.sin(TAU * 0.02 * (t - t0)), 1);
    const attack = (t, idx) => { CH[idx].forEach((f, i) => voices[i].o.frequency.setValueAtTime(f, t)); padEnv.gain.setValueAtTime(0, t); padEnv.gain.linearRampToValueAtTime(1, t + 4); };
    attack(t0, 0);
    let ci = 0, k = 0;
    every(tr, t0 + 17, t => { padEnv.gain.setValueAtTime(1, t); padEnv.gain.linearRampToValueAtTime(0, t + 5); ci = (ci + 1) % CH.length; attack(t + 5, ci); return 23 + 8 * H(k++, 1); });
    every(tr, t0 + 5 + 8 * H(7, 2), t => {
      const d = 7 + 4 * H(k, 3), s = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = noiseBuf(e); s.loop = true; bp.type = 'bandpass'; bp.Q.value = 0.8;
      bp.frequency.setValueAtTime(350, t); bp.frequency.exponentialRampToValueAtTime(950, t + d * 0.45); bp.frequency.exponentialRampToValueAtTime(420, t + d);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + d * 0.45); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      s.connect(bp); bp.connect(g); g.connect(panner(tr, (H(k, 5) - 0.5) * 0.6, tr.gain));
      s.start(t); src(tr, s, t + d + 0.02);
      return d + 12 + 18 * H(k++, 4);
    });
  },
  function caves(e, tr, t0, H) {   // A1 drone, muted pulses every 6–10 s, faint music box
    const ctx = e.ctx, lp = filt(tr, 'lowpass', 220, 0.8, tr.gain), env = gainNode(tr, 0, lp);
    tone(tr, 'sine', 55, 0, 0.5, env); tone(tr, 'triangle', 110, 4, 0.12, env);
    env.gain.setValueAtTime(0, t0); env.gain.linearRampToValueAtTime(1, t0 + 3);
    autom(tr, lp.frequency, t => 220 + 70 * Math.sin(TAU * 0.02 * (t - t0)), 1);
    const thumpLP = filt(tr, 'lowpass', 110, 0.9, tr.gain), BOX = [880, 1046.5, 1174.66, 1318.51, 1567.98, 1760];
    const thump = (t, lvl) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(64, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.25);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(lvl, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
      o.connect(g); g.connect(thumpLP); o.start(t); src(tr, o, t + 0.85);
    };
    let k = 0, bi = 2;
    every(tr, t0 + 4 + 4 * H(1, 5), t => { if (!tr.quiet) { thump(t, 0.4); if (H(k, 6) < 0.3) thump(t + 0.36, 0.22); } return 6 + 4 * H(k++, 7); });
    every(tr, t0 + 9 + 8 * H(2, 8), t => {
      if (!tr.quiet) { bi = walk(bi, BOX.length, H(k, 9)); pluck(tr, t, BOX[bi], 0.045, 3, 0.6, 1.1, 0.8); if (H(k, 10) < 0.35) pluck(tr, t + 0.42, BOX[walk(bi, BOX.length, H(k, 12))], 0.035, 3, 0.6, 1.1, 0.8); }
      return 12 + 13 * H(k++, 11);
    });
  },
  function deep(e, tr, t0, H) {   // glassy sines in fifths, slow beating, sparse high plucks
    const env = gainNode(tr, 0, tr.gain), cl = gainNode(tr, 1, env), HI = [1174.66, 1396.91, 1567.98, 1760, 2093];
    tone(tr, 'sine', 293.66, 0, 0.26, cl); tone(tr, 'sine', 293.94, 0, 0.26, cl); tone(tr, 'sine', 440, 0, 0.19, cl); tone(tr, 'sine', 439.55, 0, 0.19, cl);
    env.gain.setValueAtTime(0, t0); env.gain.linearRampToValueAtTime(1, t0 + 3);
    autom(tr, cl.gain, t => 0.72 + 0.28 * Math.sin(TAU * 0.045 * (t - t0)), 0.5);
    let k = 0, idx = 2;
    every(tr, t0 + 4 + 5 * H(3, 12), t => { if (!tr.quiet) { idx = walk(idx, HI.length, H(k, 13)); pluck(tr, t, HI[idx], 0.06, 4, 0.5, 1.4, 0.85); } return 5 + 7 * H(k++, 14); });
  },
  function abyss(e, tr, t0, H) {   // sub pulses at 0.25 Hz + distorted heat drone with pitch drift
    const ctx = e.ctx, pulse = gainNode(tr, 0, tr.gain);
    tone(tr, 'sine', 36.71, 0, 0.7, pulse);
    every(tr, t0 + 0.5, t => { const g = pulse.gain; g.setValueAtTime(0, t); g.linearRampToValueAtTime(1, t + 1.2); g.setValueAtTime(1, t + 1.6); g.linearRampToValueAtTime(0, t + 3.4); return 4; });
    const heatG = gainNode(tr, 0, tr.gain), heatLP = filt(tr, 'lowpass', 190, 1.6, heatG), sh = node(tr, ctx.createWaveShaper()), drive = gainNode(tr, 0.9, sh);
    sh.curve = driveCurve(2.5); sh.connect(heatLP);
    heatG.gain.setValueAtTime(0, t0); heatG.gain.linearRampToValueAtTime(0.18, t0 + 4);
    const h = [tone(tr, 'sawtooth', 55, 0, 0.5, drive), tone(tr, 'sawtooth', 55.7, 0, 0.5, drive)];
    autom(tr, heatLP.frequency, t => 190 + 40 * Math.sin(TAU * 0.04 * (t - t0)), 1);
    let f = 1, k = 0;
    every(tr, t0 + 6, t => {
      const d = 8 + 6 * H(k, 15), nf = 0.965 + 0.07 * H(k++, 16);
      h.forEach((v, i) => { const base = i ? 55.7 : 55; v.o.frequency.setValueAtTime(base * f, t); v.o.frequency.exponentialRampToValueAtTime(base * nf, t + d); });
      f = nf; return d;
    });
  },
  function core(e, tr, t0, H) {   // inharmonic void drone, breathing at 0.08 Hz, rare descending glides
    const breath = gainNode(tr, 0, tr.gain), base = 41.2, R = [1, 2.13, 3.71, 5.02], A = [0.5, 0.22, 0.12, 0.07];
    const parts = R.map((r, i) => tone(tr, 'sine', base * r, 0, A[i], breath));
    autom(tr, breath.gain, t => 0.3 + 0.35 * (1 + Math.sin(TAU * 0.08 * (t - t0) - Math.PI / 2)), 0.25);
    let k = 0;
    every(tr, t0 + 18 + 30 * H(4, 17), t => {
      parts.forEach((v, i) => { const f0 = base * R[i], p = v.o.frequency; p.setValueAtTime(f0, t); p.exponentialRampToValueAtTime(f0 * 0.82, t + 5); p.setValueAtTime(f0 * 0.82, t + 9); p.exponentialRampToValueAtTime(f0, t + 21); });
      return 46 + 40 * H(k++, 18);
    });
  }
];
function makeBed(e, L) {
  const tr = makeTrack(e, BED_LEVEL), t0 = e.ctx.currentTime + 0.05, salt = (SEED ^ Math.floor(Math.random() * 0x7fffffff)) | 0;
  BEDS[L](e, tr, t0, (a, b) => LD.U.hash2(a, b, salt));
  return tr;
}

/* ── clock: audio-thread ticker (immune to background timer throttling) + setInterval backstop ── */
function pump() {
  const e = env; if (!e) return;
  const now = e.ctx.currentTime, horizon = now + LOOK;
  for (let i = live.length - 1; i >= 0; i--) {
    const tr = live[i];
    if (tr.fading && now >= tr.killAt) { dispose(tr); live.splice(i, 1); continue; }
    try { runTrack(tr, now, horizon); } catch (err) { warnOnce('tick', err); }
  }
  if (!live.length) stopPump();
}
function safePump() { try { pump(); } catch (err) { warnOnce('pump', err); } }
function armTicker(e) {
  if (tickerArmed) return;
  const s = e.ctx.createBufferSource();
  s.buffer = e.silence; s.connect(e.sink);
  s.onended = () => { tickerArmed = false; if (env === e && live.length) { safePump(); armTicker(e); } };
  try { s.start(); tickerArmed = true; } catch (_) { tickerArmed = false; }
}
function startPump(e) { if (!pumpTimer) pumpTimer = setInterval(safePump, 120); armTicker(e); safePump(); }
function stopPump() { if (pumpTimer) { clearInterval(pumpTimer); pumpTimer = 0; } }

/* ── start / pending (waits for LD.Audio.unlocked) ── */
function startTrack(kind, L) {
  const e = env, now = e.ctx.currentTime;
  if (current && !current.fading) fadeOut(current, XFADE);
  const tr = kind === 'menu' ? makeMenu(e) : makeBed(e, L);
  rampTrack(tr, 0, tr.level, now, kind === 'menu' ? 1.5 : XFADE);
  live.push(tr); current = tr;
  M.mode = kind; M.layerIdx = L; M.playing = true;
  startPump(e);
}
function tryStart() {
  const A = LD.Audio;
  if (!A || !A.unlocked || !resolveEnv()) return false;
  const p = pending; pending = null; stopPoll();
  if (p) startTrack(p.kind, p.L);
  return true;
}
function request(kind, L) { pending = { kind, L }; if (!tryStart()) ensurePoll(); }
function ensurePoll() { if (!pollTimer) pollTimer = setInterval(() => { if (!pending) stopPoll(); else { try { tryStart(); } catch (err) { warnOnce('start', err); } } }, 250); }
function stopPoll() { if (pollTimer) { clearInterval(pollTimer); pollTimer = 0; } }

const M = LD.Music = {
  playing: false, mode: null, layerIdx: -1,
  menu() {
    try { if (M.mode === 'menu' && current && !current.fading) return; request('menu', -1); } catch (err) { warnOnce('menu', err); }
  },
  layer(L) {
    try {
      L = Math.max(0, Math.min(BEDS.length - 1, L | 0));
      if (M.mode === 'layer' && M.layerIdx === L && current && !current.fading) return;
      request('layer', L);
    } catch (err) { warnOnce('layer', err); }
  },
  stop(fade) {
    try {
      pending = null; stopPoll();
      fade = typeof fade === 'number' && isFinite(fade) && fade >= 0 ? fade : 1.5;
      for (const tr of live) if (!tr.fading) fadeOut(tr, fade);
      current = null; M.mode = null; M.layerIdx = -1; M.playing = false;
    } catch (err) { warnOnce('stop', err); }
  },
  duck(seconds) {
    try {
      const e = env; if (!e) return;
      seconds = Math.max(0.1, Math.min(120, +seconds || 3));
      const p = e.duck.gain, now = e.ctx.currentTime, until = now + seconds;
      if (duckUntil > now && until <= duckUntil) return;
      duckUntil = until;
      p.cancelScheduledValues(now); p.setValueAtTime(p.value, now);
      p.linearRampToValueAtTime(DUCK, now + 0.12); p.setValueAtTime(DUCK, until); p.linearRampToValueAtTime(1, until + 2);
    } catch (err) { warnOnce('duck', err); }
  },
  _pump: safePump, _trace: null, _seq: null, _env: () => env,
  // diagnostics (tools/*.mjs): duck gain and live tracks
  _state() { return { duck: env ? +env.duck.gain.value.toFixed(3) : null, tracks: live.map(tr => ({ level: tr.level, gain: +tr.gain.gain.value.toFixed(3), fading: tr.fading, nodes: tr.nodes.length, sources: tr.sources.size })) }; }
};

if (LD.Events && typeof LD.Events.on === 'function') {
  const onWave = p => { const G = LD.G; if (M.mode === 'layer' && (!p || p.layer === undefined || !G || p.layer === G.view.layer)) M.duck(5); };
  LD.Events.on('wave:incoming', onWave);
  LD.Events.on('wave:started', onWave);
}
})();
