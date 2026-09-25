(() => {
'use strict';
const LD = window.LD, E = LD.Events;
const Sim = LD.Sim = LD.Sim || {};

const FINE = 600, COARSE = 60, CSTEP = 60, PRUNE_AFTER = 3600;

/* Derived (never serialised): fine 1-s rings per (layer,item) and per-layer power. The coarse 60×60-s rings are
   plain arrays living inside G.stats.hist[L], written in place every second so a save is always current. */
let curG = null, acc = 0, sec = 0, fi = 0, fineFill = 0, ci = 0, cfill = 0, hist = null;
const layers = [];   // L → { items: Map(id → S), power: P|null, h: hist[L] }

const zeros = n => { const a = new Array(n); for (let i = 0; i < n; i++) a[i] = 0; return a; };
const fixArr = (a, n) => { if (!Array.isArray(a)) a = zeros(n); while (a.length < n) a.push(0); if (a.length > n) a.length = n; for (let i = 0; i < n; i++) if (typeof a[i] !== 'number' || !isFinite(a[i])) a[i] = 0; return a; };
const r2 = v => Math.round(v * 100) / 100;

function newSeries(h, t) {
  h.c = fixArr(h.c, COARSE); h.cm = fixArr(h.cm, COARSE);
  return { plus: new Float32Array(FINE), minus: new Float32Array(FINE), c: h.c, cm: h.cm, curP: 0, curM: 0, minP: 0, minM: 0, last: t };
}
function newPower(h) {
  h.g = fixArr(h.g, COARSE); h.u = fixArr(h.u, COARSE);
  return { gen: new Float32Array(FINE), use: new Float32Array(FINE), g: h.g, u: h.u, sumG: 0, sumU: 0, n: 0 };
}
function layerRec(L) {
  let rec = layers[L];
  if (!rec) {
    let h = hist[L];
    if (!h || typeof h !== 'object') h = hist[L] = { items: {}, power: { g: zeros(COARSE), u: zeros(COARSE) } };
    if (!h.items || typeof h.items !== 'object') h.items = {};
    if (!h.power || typeof h.power !== 'object') h.power = {};
    rec = layers[L] = { items: new Map(), power: newPower(h.power), h };
  }
  return rec;
}
function seriesOf(L, id, create) {
  if (!create && !layers[L]) return null;
  const rec = layerRec(L);
  let s = rec.items.get(id);
  if (!s && create) {
    let h = rec.h.items[id];
    if (!h || typeof h !== 'object') h = rec.h.items[id] = { c: zeros(COARSE), cm: zeros(COARSE) };
    s = newSeries(h, curG.time.t);
    rec.items.set(id, s);
  }
  return s || null;
}

function ensure() {
  const G = LD.G; if (!G) return false;
  if (G === curG) return true;
  curG = G; layers.length = 0; acc = 0; sec = 0; fi = 0; fineFill = 0;
  if (!G.stats) G.stats = { produced: {}, consumed: {}, kills: 0, builds: 0, dismantled: 0, waves: 0, hist: {} };
  if (!G.stats.produced) G.stats.produced = {};
  if (!G.stats.consumed) G.stats.consumed = {};
  hist = G.stats.hist;
  if (!hist || typeof hist !== 'object' || Array.isArray(hist)) hist = G.stats.hist = {};
  ci = Math.min(COARSE - 1, Math.max(0, hist.idx | 0)); cfill = Math.min(COARSE, Math.max(0, hist.n | 0));
  hist.idx = ci; hist.n = cfill;
  for (const k in hist) {
    const L = +k; if (!(L >= 0 && L < 5) || String(L) !== k) continue;
    const rec = layerRec(L);
    for (const id in rec.h.items) seriesOf(L, id, true);
  }
  return true;
}

function samplePower(G, L, p) {
  const P = Sim.Power; let gen = 0, use = 0;
  if (P && P.summary && G.layers[L] && G.layers[L].unlocked) { const s = P.summary(L); if (s) { gen = +s.gen || 0; use = +s.use || 0; } }
  p.gen[fi] = gen; p.use[fi] = use; p.sumG += gen; p.sumU += use; p.n++;
  p.g[ci] = Math.round(p.sumG / p.n); p.u[ci] = Math.round(p.sumU / p.n);
}
function step() {
  const G = curG, t = G.time.t;
  for (let L = 0; L < layers.length; L++) {
    const rec = layers[L]; if (!rec) continue;
    for (const s of rec.items.values()) {
      s.plus[fi] = s.curP; s.minus[fi] = s.curM;
      if (s.curP || s.curM) { s.minP += s.curP; s.minM += s.curM; s.c[ci] = r2(s.minP); s.cm[ci] = r2(s.minM); s.last = t; s.curP = s.curM = 0; }
    }
    samplePower(G, L, rec.power);
  }
  fi = (fi + 1) % FINE; if (fineFill < FINE) fineFill++;
  if (++sec >= CSTEP) { sec = 0; advanceCoarse(t); }
}
function advanceCoarse(t) {
  ci = (ci + 1) % COARSE; if (cfill < COARSE) cfill++;
  hist.idx = ci; hist.n = cfill;
  for (let L = 0; L < layers.length; L++) {
    const rec = layers[L]; if (!rec) continue;
    for (const [id, s] of rec.items) {
      if (t - s.last > PRUNE_AFTER) { rec.items.delete(id); delete rec.h.items[id]; continue; }
      s.minP = s.minM = 0; s.c[ci] = 0; s.cm[ci] = 0;
    }
    const p = rec.power; p.sumG = p.sumU = 0; p.n = 0; p.g[ci] = 0; p.u[ci] = 0;
  }
}

function fineOut(src) { const out = new Float32Array(FINE); for (let k = 0; k < FINE; k++) out[k] = src[(fi + k) % FINE]; return out; }
function coarseOut(src) { const out = new Float32Array(COARSE); for (let k = 0; k < COARSE; k++) out[k] = src[(ci + 1 + k) % COARSE]; return out; }
const EMPTY_F = () => new Float32Array(FINE), EMPTY_C = () => new Float32Array(COARSE);

const Stats = Sim.Stats = {
  FINE, COARSE,

  record(L, itemId, delta) {
    if (!delta || !isFinite(delta) || !ensure()) return;
    L = L | 0; if (L < 0 || L > 4) return;
    const s = seriesOf(L, itemId, true), st = curG.stats;
    if (delta > 0) { s.curP += delta; st.produced[itemId] = (st.produced[itemId] || 0) + delta; }
    else { s.curM -= delta; st.consumed[itemId] = (st.consumed[itemId] || 0) - delta; }
  },

  tick(dt) {
    if (!ensure()) return;
    acc += dt;
    while (acc >= 1) { acc -= 1; step(); }
  },

  series(L, itemId, span = '10m') {
    const s = ensure() ? seriesOf(L | 0, itemId, false) : null;
    if (span === '60m') return { plus: s ? coarseOut(s.c) : EMPTY_C(), minus: s ? coarseOut(s.cm) : EMPTY_C(), step: CSTEP, n: Math.min(COARSE, cfill + 1), partial: sec };
    return { plus: s ? fineOut(s.plus) : EMPTY_F(), minus: s ? fineOut(s.minus) : EMPTY_F(), step: 1, n: fineFill, partial: 0 };
  },

  power(L, span = '10m') {
    const rec = ensure() ? layers[L | 0] : null, p = rec && rec.power;
    if (span === '60m') return { gen: p ? coarseOut(p.g) : EMPTY_C(), use: p ? coarseOut(p.u) : EMPTY_C(), step: CSTEP, n: Math.min(COARSE, cfill + 1), partial: sec };
    return { gen: p ? fineOut(p.gen) : EMPTY_F(), use: p ? fineOut(p.use) : EMPTY_F(), step: 1, n: fineFill, partial: 0 };
  },

  /* items ranked by traffic (plus+minus) over the last 10 min */
  top(L, n = 8) {
    const rec = ensure() ? layers[L | 0] : null, out = [];
    if (!rec) return out;
    for (const [item, s] of rec.items) {
      let plus = s.curP, minus = s.curM;
      for (let k = 0; k < FINE; k++) { plus += s.plus[k]; minus += s.minus[k]; }
      if (plus || minus) out.push({ item, plus, minus });
    }
    out.sort((a, b) => (b.plus + b.minus) - (a.plus + a.minus));
    if (out.length > n) out.length = n;
    return out;
  },

  /* average plus/minus per second over the last `secs` seconds (≤ 600) */
  rate(L, itemId, secs = 60) {
    const s = ensure() ? seriesOf(L | 0, itemId, false) : null;
    if (!s) return { plus: 0, minus: 0 };
    const n = Math.max(1, Math.min(FINE, Math.min(secs | 0, Math.max(1, fineFill))));
    let plus = 0, minus = 0;
    for (let k = 1; k <= n; k++) { const i = (fi - k + FINE) % FINE; plus += s.plus[i]; minus += s.minus[i]; }
    return { plus: plus / n, minus: minus / n };
  },

  items(L) { const rec = ensure() ? layers[L | 0] : null; return rec ? Array.from(rec.items.keys()) : []; },
  reset() { curG = null; layers.length = 0; }
};

E.on('game:new', () => { curG = null; });
E.on('game:loaded', () => { curG = null; });
})();
