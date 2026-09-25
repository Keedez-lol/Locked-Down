(() => {
'use strict';
const LD = window.LD;
const TAU = Math.PI * 2;
const BPM = 400 / 3, BEAT = 60 / BPM, STEP = BEAT / 4, BAR = BEAT * 4;   // 133.33 BPM = the KDZ animation's 0.45 s beat
const LOOK = 0.4, XFADE = 3, MENU_LEVEL = 1, BED_LEVEL = 0.56 /* −8 dB vs menu peaks, measured */, PRE = 0.5, TRIM = 0.32 /* menu peaks ≈ −14 dBFS */, DUCK = 0.355 /* −9 dB */;
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

/* ── menu: 16th-note sequencer at 133.33 BPM ── */
const PAD_CHORDS = [[174.61, 220, 329.63], [174.61, 233.08, 293.66], [174.61, 261.63, 329.63], [164.81, 196, 261.63]]; // Dm9 · Bbmaj7 · Fmaj7 · Cadd9 over the D pedal
const BELL_SCALE = [293.66, 349.23, 392, 440, 523.25, 587.33, 698.46, 783.99, 880]; // D minor pentatonic D4–A5
const TICK_VEL = [1, 0.3, 0.6, 0.3];
function makeMenu(e) {
  const ctx = e.ctx, tr = makeTrack(e, MENU_LEVEL), t0 = ctx.currentTime + 0.12;
  const H = (a, b) => LD.U.hash2(a, b, SEED);
  const subLP = filt(tr, 'lowpass', 150, 1.1, tr.gain), subEnv = gainNode(tr, 0, subLP);
  tone(tr, 'sine', 36.71, 0, 0.5, subEnv); tone(tr, 'triangle', 73.42, 3, 0.16, subEnv);
  subEnv.gain.setValueAtTime(0, t0); subEnv.gain.linearRampToValueAtTime(1, t0 + 1.5);
  const opening = t => { const b = (t - t0) / BAR, m = b - 32 * Math.floor(b / 32); return m >= 30 ? smooth((m - 30) / 2) : b >= 32 && m < 1 ? 1 - smooth(m) : 0; };   // 0→1 over bars 30–31, back over bar 32
  autom(tr, subLP.frequency, t => 130 + 80 * Math.sin(TAU * 0.05 * (t - t0)) + 220 * opening(t), BAR / 4);

  const padLP = filt(tr, 'lowpass', 1000, 0.9, tr.gain), padEnv = gainNode(tr, 0, padLP);
  const pad = [tone(tr, 'triangle', PAD_CHORDS[0][0], -6, 0.34, padEnv), tone(tr, 'sawtooth', PAD_CHORDS[0][1], 4, 0.2, padEnv), tone(tr, 'sawtooth', PAD_CHORDS[0][2], 9, 0.17, padEnv)];
  autom(tr, padLP.frequency, t => 1000 + 400 * Math.sin(TAU * 0.03 * (t - t0)) + 1600 * opening(t), BAR / 4);

  const kickLP = filt(tr, 'lowpass', 260, 0.7, tr.gain);
  const tickIn = [[-0.12, 3000], [0.22, 3250], [-0.24, 2850], [0.14, 3100]].map(([pan, f]) => { const bp = filt(tr, 'bandpass', f, 6, null); bp.connect(panner(tr, pan, tr.gain)); return bp; });
  const bellSend = gainNode(tr, 0.6, tr.wet);

  const kick = (t, acc) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.035);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.3 * acc, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    o.connect(g); g.connect(kickLP); o.start(t); src(tr, o, t + 0.12);
  };
  const tick = (t, v, chain) => {
    const s = ctx.createBufferSource(), g = ctx.createGain();
    s.buffer = noiseBuf(e);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.28 * v, t + 0.0015); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    s.connect(g); g.connect(tickIn[chain]);
    s.start(t, Math.random() * 1.5, 0.04); src(tr, s, t + 0.05);
  };
  const bell = (t, f, vel) => {
    const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
    car.type = 'sine'; mod.type = 'sine'; car.frequency.value = f; mod.frequency.value = f * 3.53;
    mg.gain.setValueAtTime(f * 1.2, t); mg.gain.exponentialRampToValueAtTime(f * 0.03, t + 0.25);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    mod.connect(mg); mg.connect(car.frequency); car.connect(g); g.connect(tr.gain); g.connect(bellSend);
    mod.start(t); car.start(t); src(tr, mod, t + 0.85); src(tr, car, t + 0.85);
  };

  const seq = { step: 0, next: t0, nextPhrase: 3, bellIdx: 3, phrase: null };
  const doubleTime = bar => bar % 32 >= 30;
  const muted = bar => bar >= 4 && !doubleTime(bar) && H(bar >> 1, 11) < 0.15;   // breathing: 2 silent bars now and then
  const onBar = (bar, t) => {
    if (bar % 8 === 0) { const ch = PAD_CHORDS[(bar >> 3) & 3]; pad.forEach((v, i) => v.o.frequency.setValueAtTime(ch[i], t)); padEnv.gain.setValueAtTime(0, t); padEnv.gain.linearRampToValueAtTime(1, t + 2); }
    if (bar % 8 === 6) { const rel = bar % 32 === 30 ? 1 : 3, r = t + 2 * BAR - rel; padEnv.gain.setValueAtTime(1, r); padEnv.gain.linearRampToValueAtTime(0, r + rel); }   // pad holds through the 32-bar transition
    if (bar === seq.nextPhrase) {
      const n = 1 + Math.floor(H(bar, 5) * 3), offs = [2, 6, 10, 14], notes = [];
      let p = Math.floor(H(bar, 6) * 4);
      for (let i = 0; i < n; i++) { seq.bellIdx = walk(seq.bellIdx, BELL_SCALE.length, H(bar, 20 + i)); notes.push({ pos: offs[p % 4] + (H(bar, 30 + i) < 0.25 ? 1 : 0), f: BELL_SCALE[seq.bellIdx], vel: 0.11 * (0.55 + 0.45 * H(bar, 40 + i)) }); p += 1 + (H(bar, 50 + i) < 0.4 ? 1 : 0); }
      seq.phrase = { bar, notes };
      seq.nextPhrase = bar + 2 + Math.floor(H(bar, 9) * 3);
    }
  };
  const schedStep = (s, t) => {
    const pos = s & 15, bar = s >> 4, beat = pos >> 2, sub = pos & 3;
    if (pos === 0) onBar(bar, t);
    if (sub === 0 && !tr.quiet) kick(t, beat === 0 ? 1 : 0.8);
    if (!muted(bar)) { tick(t, TICK_VEL[sub], sub); if (doubleTime(bar)) tick(t + STEP / 2, TICK_VEL[sub] * 0.45, (sub + 2) & 3); }
    if (!tr.quiet && seq.phrase && seq.phrase.bar === bar) for (const nt of seq.phrase.notes) if (nt.pos === pos) bell(t, nt.f, nt.vel);
  };
  tr.tick = (now, horizon) => {
    if (seq.next < now - 0.25) { const k = Math.ceil((now + 0.05 - seq.next) / STEP); seq.step += k; seq.next += k * STEP; }
    while (seq.next < horizon) { schedStep(seq.step, seq.next); seq.step++; seq.next += STEP; }
  };
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
  _pump: safePump
};

if (LD.Events && typeof LD.Events.on === 'function') {
  const onWave = p => { const G = LD.G; if (M.mode === 'layer' && (!p || p.layer === undefined || !G || p.layer === G.view.layer)) M.duck(5); };
  LD.Events.on('wave:incoming', onWave);
  LD.Events.on('wave:started', onWave);
}
})();
