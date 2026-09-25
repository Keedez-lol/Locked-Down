(() => {
'use strict';
const LD = window.LD, U = LD.U;
LD.UI = LD.UI || {};
const el = U.el;

const SPANS = [{ id: '10m', name: '10 min', secs: 600 }, { id: '60m', name: '60 min', secs: 3600 }];
const TOP_N = 12;
const state = { open: false, tab: 'prod', layer: 0, span: '10m', sel: null, root: null, handle: null, timer: 0, refs: {}, hover: null, offs: [], tok: null, rows: new Map(), sparks: new Map() };
const sfx = n => { const A = LD.Audio; if (A && A.play) { try { A.play(n); } catch (e) { /* optional */ } } };
const Rg = () => LD.Registry;
const ST = () => LD.Sim && LD.Sim.Stats;

/* ── tokens from CSS (never hardcoded in the module) ── */
function tokens() {
  if (state.tok) return state.tok;
  const cs = getComputedStyle(document.documentElement);
  const t = k => cs.getPropertyValue('--' + k).trim();
  return state.tok = { ink: t('ink'), ink2: t('ink2'), ink3: t('ink3'), ink5: t('ink5'), bone: t('bone'), bone2: t('bone2'), bone3: t('bone3'), bone4: t('bone4'), verm: t('verm'), warn: t('warn'), ok: t('ok'), info: t('info'), line: t('line'), line2: t('line2'), mono: t('mono') || 'ui-monospace, monospace' };
}

/* ── data adapters (tolerant of the Stats module shape) ── */
const toArr = a => (a instanceof Float32Array || Array.isArray(a)) ? a : (a && a.length !== undefined ? Array.from(a) : []);
function series(L, item, span) {
  const S = ST(); let s = null;
  try { s = S && S.series ? S.series(L, item, span) : null; } catch (e) { s = null; }
  const step = (s && s.step) || (span === '60m' ? 60 : 1);
  const perSec = !s || s.perSecond || s.rate ? 1 : step; // bucket totals → per second
  const plus = toArr(s && s.plus), minus = toArr(s && s.minus);
  const n = Math.max(plus.length, minus.length);
  const filled = s && s.n !== undefined ? U.clamp(s.n | 0, 0, n) : n;   // samples actually recorded (tail of the ring)
  const partial = s && s.partial > 0 ? s.partial : 0;                    // seconds elapsed in the last coarse bucket
  const p = new Float32Array(n), m = new Float32Array(n);
  for (let i = 0; i < n; i++) { const div = (partial && step > 1 && i === n - 1) ? Math.max(1, partial) : perSec; p[i] = (plus[i] || 0) / div; m[i] = (minus[i] || 0) / div; }
  return { plus: p, minus: m, step, start: n - filled, ok: !!s };
}
function power(L, span) {
  const S = ST(); let s = null;
  try { s = S && S.power ? S.power(L, span) : null; } catch (e) { s = null; }
  const gen = toArr(s && s.gen), use = toArr(s && s.use), n = Math.max(gen.length, use.length);
  const filled = s && s.n !== undefined ? U.clamp(s.n | 0, 0, n) : n;
  return { gen, use, step: (s && s.step) || (span === '60m' ? 60 : 1), start: n - filled, ok: !!s };
}
function top(L) {
  const S = ST(); let t = [];
  try { t = S && S.top ? (S.top(L, TOP_N) || []) : []; } catch (e) { t = []; }
  if (!t.length) {
    const Ec = LD.Sim && LD.Sim.Economy; const rates = Ec && Ec.rates && Ec.rates[L];
    if (rates) t = Object.keys(rates).map(item => ({ item, plus: rates[item].plus || 0, minus: rates[item].minus || 0 })).sort((a, b) => (b.plus + b.minus) - (a.plus + a.minus)).slice(0, TOP_N);
  }
  return t.filter(x => x && x.item && Rg().items.has(x.item));
}
function liveRate(L, item) {
  const S = ST();
  if (S && S.rate) { try { const r = S.rate(L, item, 60); if (r) return { plus: r.plus || 0, minus: r.minus || 0 }; } catch (e) { /* fallthrough */ } }
  const Ec = LD.Sim && LD.Sim.Economy; const r = Ec && Ec.rates && Ec.rates[L] && Ec.rates[L][item];
  return r ? { plus: r.plus || 0, minus: r.minus || 0 } : null;
}
const spanSecs = () => (SPANS.find(s => s.id === state.span) || SPANS[0]).secs;
const layerName = L => { const d = Rg().layers[L]; return d ? d.name : 'Capa ' + L; };
const layerOpen = L => { const G = LD.G; return !!(G && G.layers[L] && G.layers[L].unlocked); };
const fmtRate = n => (n >= 0 ? '' : '-') + U.fmt(Math.abs(n), 2) + '/s';

/* ── canvas helpers: draw in logical px (1 rem = 16), crisp on any stage scale ── */
function fit(c) {
  const S = LD.Stage || { scale: 1, dpr: 1 };
  const u = S.scale || 1, dpr = S.dpr || Math.min(2, devicePixelRatio || 1);
  const r = c.getBoundingClientRect();
  const lw = Math.max(1, r.width / u), lh = Math.max(1, r.height / u);
  const bw = Math.round(lw * u * dpr), bh = Math.round(lh * u * dpr);
  if (c.width !== bw || c.height !== bh) { c.width = bw; c.height = bh; }
  const ctx = c.getContext('2d');
  ctx.setTransform(u * dpr, 0, 0, u * dpr, 0, 0);
  return { ctx, w: lw, h: lh };
}
function niceStep(range, n) {
  const raw = range / Math.max(1, n); if (!(raw > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(raw))); const f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}
function maxOf(arrs) { let m = 0; for (const a of arrs) for (let i = 0; i < a.length; i++) if (a[i] > m) m = a[i]; return m; }
const fmtTick = (v, unit) => unit === 'W' ? U.fmtW(v) : U.fmt(v, v < 10 && v !== Math.floor(v) ? 1 : 0);
function fmtAgo(s) { if (s <= 0) return 'ahora'; return s >= 60 ? '−' + Math.round(s / 60) + ' min' : '−' + Math.round(s) + ' s'; }

/* line chart with axes, ticks, endpoint labels and crosshair */
function drawChart(c, spec) {
  const { ctx, w, h } = fit(c); const T = tokens();
  const L = 60, Rr = 76, Tp = 22, B = 26;
  ctx.clearRect(0, 0, w, h);
  const ser = spec.series.filter(s => s.data && s.data.length);
  const n = Math.max(2, ...ser.map(s => s.data.length));
  const step = spec.step || 1, total = (n - 1) * step;
  const maxV = maxOf(ser.map(s => s.data));
  const ystep = niceStep(maxV > 0 ? maxV : 1, 4);
  const yMax = Math.max(ystep, Math.ceil((maxV > 0 ? maxV : 1) / ystep) * ystep);
  const pw = w - L - Rr, ph = h - Tp - B;
  const X = i => L + (i / (n - 1)) * pw, Y = v => Tp + ph - (v / yMax) * ph;
  ctx.font = '500 10px ' + T.mono; ctx.textBaseline = 'middle';
  // y grid + labels
  ctx.lineWidth = 1;
  for (let v = 0; v <= yMax + 1e-9; v += ystep) {
    const y = Math.round(Y(v)) + 0.5;
    ctx.strokeStyle = v === 0 ? T.line2 : T.line; ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(w - Rr, y); ctx.stroke();
    ctx.fillStyle = T.bone3; ctx.textAlign = 'right'; ctx.fillText(fmtTick(v, spec.unit), L - 8, y);
  }
  ctx.fillStyle = T.bone4; ctx.textAlign = 'left'; ctx.fillText(spec.unit === 'W' ? 'W' : 'objetos/s', L, Tp - 12);
  // unrecorded head of the window (ring not yet filled)
  const start = Math.max(0, ...ser.map(s => s.start | 0));
  if (start > 0 && start < n) { ctx.fillStyle = T.line; ctx.fillRect(L, Tp, X(start) - L, ph); ctx.fillStyle = T.bone4; ctx.textAlign = 'center'; ctx.fillText('sin datos', (L + X(start)) / 2, Tp + ph / 2); }
  // x ticks
  const xt = total > 900 ? 600 : total > 300 ? 120 : 60;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (let s = 0; s <= total + 1e-9; s += xt) {
    const i = (total - s) / step; const x = Math.round(X(i)) + 0.5;
    ctx.strokeStyle = T.line; ctx.beginPath(); ctx.moveTo(x, Tp + ph); ctx.lineTo(x, Tp + ph + 4); ctx.stroke();
    ctx.fillStyle = T.bone3; ctx.fillText(fmtAgo(s), x, Tp + ph + 8);
  }
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  // series
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const ends = [];
  for (const s of ser) {
    const s0 = Math.min(s.data.length - 1, Math.max(0, s.start | 0));
    ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.beginPath();
    for (let i = s0; i < s.data.length; i++) { const x = X(i), y = Y(s.data[i]); if (i === s0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke();
    const last = s.data[s.data.length - 1] || 0;
    ends.push({ x: X(s.data.length - 1), y: Y(last), v: last, color: s.color, label: s.label });
  }
  // endpoint markers (2px surface ring) + values to the right, nudged apart with leader lines if they collide
  ends.sort((a, b) => a.y - b.y);
  let lastY = -1e9;
  for (const e of ends) {
    ctx.beginPath(); ctx.arc(e.x, e.y, 5.5, 0, Math.PI * 2); ctx.fillStyle = spec.surface || T.ink2; ctx.fill();
    ctx.beginPath(); ctx.arc(e.x, e.y, 4, 0, Math.PI * 2); ctx.fillStyle = e.color; ctx.fill();
    let ly = U.clamp(e.y, Tp + 6, Tp + ph - 6); if (ly - lastY < 14) ly = lastY + 14; lastY = ly;
    ctx.fillStyle = T.bone; ctx.font = '500 11px ' + T.mono; ctx.textAlign = 'left';
    ctx.fillText(spec.unit === 'W' ? U.fmtW(e.v) : fmtRate(e.v), e.x + 12, ly);
    if (Math.abs(ly - e.y) > 1) { ctx.strokeStyle = T.line2; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(e.x + 6, e.y); ctx.lineTo(e.x + 10, ly); ctx.stroke(); }
  }
  // crosshair
  if (state.hover && state.hover.canvas === c && state.hover.x !== null) {
    const i = U.clamp(Math.round(((state.hover.x - L) / pw) * (n - 1)), 0, n - 1);
    const x = Math.round(X(i)) + 0.5;
    ctx.strokeStyle = T.bone2; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, Tp); ctx.lineTo(x, Tp + ph); ctx.stroke();
    const lines = [fmtAgo((n - 1 - i) * step)];
    for (const s of ser) { if (i < (s.start | 0)) { lines.push(s.label + ' sin datos'); continue; } ctx.beginPath(); ctx.arc(X(i), Y(s.data[i] || 0), 3.5, 0, Math.PI * 2); ctx.fillStyle = s.color; ctx.fill(); lines.push(s.label + ' ' + (spec.unit === 'W' ? U.fmtW(s.data[i] || 0) : fmtRate(s.data[i] || 0))); }
    ctx.font = '500 10px ' + T.mono;
    const tw = Math.max(...lines.map(l => ctx.measureText(l).width)) + 16, th = lines.length * 14 + 8;
    let bx = x + 10; if (bx + tw > w - Rr) bx = x - 10 - tw; const by = Tp + 4;
    ctx.fillStyle = T.ink; ctx.fillRect(bx, by, tw, th); ctx.strokeStyle = T.line2; ctx.strokeRect(bx + 0.5, by + 0.5, tw - 1, th - 1);
    lines.forEach((l, k) => { ctx.fillStyle = k === 0 ? T.bone3 : T.bone; ctx.fillText(l, bx + 8, by + 11 + k * 14); });
  }
}
function drawSpark(c, plus, minus, start = 0) {
  const { ctx, w, h } = fit(c); const T = tokens();
  ctx.clearRect(0, 0, w, h);
  const n = Math.max(2, plus.length, minus.length);
  const maxV = Math.max(maxOf([plus, minus]), 1e-6);
  const Pr = 44, Pt = 4, Pb = 4;
  const X = i => (i / (n - 1)) * (w - Pr), Y = v => Pt + (h - Pt - Pb) - (v / maxV) * (h - Pt - Pb);
  ctx.lineWidth = 1; ctx.strokeStyle = T.line;
  for (let k = 0; k <= 2; k++) { const y = Math.round(Pt + (h - Pt - Pb) * k / 2) + 0.5; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w - Pr, y); ctx.stroke(); }
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = 1.5;
  const s0 = Math.min(n - 1, Math.max(0, start | 0));
  const line = (arr, color) => { if (!arr.length) return; ctx.strokeStyle = color; ctx.beginPath(); for (let i = s0; i < arr.length; i++) { const x = X(i), y = Y(arr[i]); if (i === s0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke(); };
  line(minus, T.verm); line(plus, T.bone);
  const lp = plus[plus.length - 1] || 0, lm = minus[minus.length - 1] || 0;
  const dot = (x, y, color) => { ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fillStyle = T.ink2; ctx.fill(); ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); };
  if (minus.length) dot(X(minus.length - 1), Y(lm), T.verm);
  if (plus.length) dot(X(plus.length - 1), Y(lp), T.bone);
  ctx.font = '500 10px ' + T.mono; ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
  ctx.fillStyle = T.bone; ctx.fillText('+' + U.fmt(lp, 1), w - 2, U.clamp(Y(lp), 7, h - 7));
}

/* ── DOM ── */
function mount() {
  const host = document.getElementById('overlay-root') || document.body;
  const scrim = el('div.stats-scrim', { on: { click: e => { if (e.target === scrim) { sfx('ui_close'); close(); } } } });
  const panel = el('div.stats', { role: 'dialog', 'aria-label': 'Estadísticas', tabindex: -1 });
  const head = el('div.stats-head', [
    el('div.stats-eyebrow#stats-eyebrow'),
    el('div.stats-tabs', ['prod', 'power'].map(t => el('button' + (t === state.tab ? '.active' : ''), { type: 'button', data: { tab: t }, on: { click: () => { if (state.tab !== t) { state.tab = t; sfx('ui_tab'); renderBody(); } } } }, t === 'prod' ? 'Producción' : 'Energía'))),
    el('div.spacer'),
    el('div.stats-tools', [
      el('div.stats-layers#stats-layers'),
      el('div.stats-span', SPANS.map(s => el('button' + (s.id === state.span ? '.active' : ''), { type: 'button', data: { span: s.id }, on: { click: () => { if (state.span !== s.id) { state.span = s.id; sfx('ui_tab'); markSpan(); refresh(true); } } } }, s.name)))
    ]),
    el('button.stats-close', { type: 'button', on: { click: () => { sfx('ui_close'); close(); } } }, ['Cerrar', el('kbd', 'Esc')])
  ]);
  const body = el('div.stats-body#stats-body');
  panel.append(head, body);
  scrim.appendChild(panel);
  host.appendChild(scrim);
  state.root = scrim;
  renderLayers(); renderBody();
  if (LD.UI.sfxHooks) { try { LD.UI.sfxHooks(panel); } catch (e) { /* optional */ } }
  panel.focus({ preventScroll: true });
}
function markSpan() { for (const b of state.root.querySelectorAll('.stats-span button')) b.classList.toggle('active', b.dataset.span === state.span); }
function renderLayers() {
  const box = state.root.querySelector('#stats-layers'); U.clear(box);
  for (let L = 0; L < 5; L++) {
    const openL = layerOpen(L);
    box.appendChild(el('button' + (L === state.layer ? '.active' : ''), { type: 'button', disabled: !openL, title: openL ? layerName(L) : 'Capa bloqueada', on: { click: () => { if (state.layer !== L) { state.layer = L; state.sel = null; sfx('ui_tab'); renderLayers(); renderBody(); } } } }, ['L' + L, el('span', openL ? layerName(L) : '???')]));
  }
  const eb = state.root.querySelector('#stats-eyebrow');
  U.clear(eb).append('Estadísticas / ', el('b', 'Capa ' + state.layer + ' · ' + layerName(state.layer)));
  for (const b of state.root.querySelectorAll('.stats-tabs button')) b.classList.toggle('active', b.dataset.tab === state.tab);
}
function renderBody() {
  const body = state.root.querySelector('#stats-body'); U.clear(body);
  state.refs = {}; state.rows.clear(); state.sparks.clear(); state.hover = null;
  renderLayers();
  if (state.tab === 'prod') {
    const list = el('div.stats-list'); const chart = el('div.stats-chart');
    body.append(list, chart);
    state.refs.list = list; state.refs.chart = chart;
    state.refs.big = el('canvas.stats-canvas'); state.refs.chartHead = el('div.stats-chart-head'); state.refs.chartFoot = el('div.stats-chart-foot');
    chart.append(state.refs.chartHead, state.refs.big, state.refs.chartFoot);
    hookHover(state.refs.big);
  } else {
    const chart = el('div.stats-chart.full'); const side = el('div.stats-side');
    body.append(chart, side);
    state.refs.chart = chart; state.refs.side = side;
    state.refs.big = el('canvas.stats-canvas'); state.refs.chartHead = el('div.stats-chart-head'); state.refs.chartFoot = el('div.stats-chart-foot');
    chart.append(state.refs.chartHead, state.refs.big, state.refs.chartFoot);
    hookHover(state.refs.big);
  }
  refresh(true);
}
function hookHover(c) {
  const u = () => (LD.Stage && LD.Stage.scale) || 1;
  c.addEventListener('mousemove', e => { const r = c.getBoundingClientRect(); state.hover = { canvas: c, x: (e.clientX - r.left) / u() }; redrawBig(); });
  c.addEventListener('mouseleave', () => { state.hover = null; redrawBig(); });
}
let lastBig = null;
function redrawBig() { if (lastBig && state.refs.big) drawChart(state.refs.big, lastBig); }

function refresh(full) {
  if (!state.open || !state.root) return;
  const T = tokens(); const L = state.layer; const span = state.span;
  if (state.tab === 'prod') {
    const items = top(L);
    const ids = items.map(x => x.item);
    if (!state.sel || (!ids.includes(state.sel) && ids.length)) state.sel = ids[0] || null;
    const list = state.refs.list;
    if (full || ids.join() !== Array.from(state.rows.keys()).join()) {
      U.clear(list); state.rows.clear(); state.sparks.clear();
      list.appendChild(el('div.stats-list-h', [el('span', 'Objeto'), el('span.k', [el('i.plus'), 'producción']), el('span.k', [el('i.minus'), 'consumo'])]));
      if (!items.length) list.appendChild(el('div.stats-empty', 'Sin actividad registrada en esta capa todavía.'));
      for (const it of items) {
        const spark = el('canvas.stats-spark');
        const row = el('button.stats-row' + (it.item === state.sel ? '.active' : ''), { type: 'button', data: { item: it.item }, on: { click: () => { state.sel = it.item; sfx('ui_click'); for (const r of state.rows.values()) r.classList.toggle('active', r.dataset.item === state.sel); refresh(false); } } }, [
          el('span.ico', icon(it.item, 20)), el('span.nm', Rg().itemName(it.item)), el('span.rate.plus'), el('span.rate.minus'), spark
        ]);
        list.appendChild(row); state.rows.set(it.item, row); state.sparks.set(it.item, spark);
      }
    }
    for (const it of items) {
      const row = state.rows.get(it.item); if (!row) continue;
      const s = series(L, it.item, span);
      const lr = liveRate(L, it.item) || { plus: s.plus[s.plus.length - 1] || 0, minus: s.minus[s.minus.length - 1] || 0 };
      row.querySelector('.rate.plus').textContent = '+' + U.fmt(lr.plus, 2) + '/s';
      row.querySelector('.rate.minus').textContent = '−' + U.fmt(lr.minus, 2) + '/s';
      drawSpark(state.sparks.get(it.item), s.plus, s.minus, s.start);
    }
    const head = state.refs.chartHead; U.clear(head);
    if (state.sel) {
      const s = series(L, state.sel, span);
      let sumP = 0, sumM = 0; for (let i = s.start; i < s.plus.length; i++) { sumP += s.plus[i] * s.step; sumM += s.minus[i] * s.step; }
      head.append(el('div.t', [icon(state.sel, 24), el('h3', Rg().itemName(state.sel))]), el('div.spacer'),
        el('div.stats-legend', [el('span.k', [el('i.plus'), 'producción']), el('span.k', [el('i.minus'), 'consumo'])]));
      lastBig = { series: [{ data: s.plus, color: T.bone, label: 'producción', start: s.start }, { data: s.minus, color: T.verm, label: 'consumo', start: s.start }], step: s.step, unit: '/s', surface: T.ink2 };
      drawChart(state.refs.big, lastBig);
      U.clear(state.refs.chartFoot).append(
        tile('Producido', U.fmtInt(sumP), 'últimos ' + spanLabel()), tile('Consumido', U.fmtInt(sumM), 'últimos ' + spanLabel()),
        tile('Balance', (sumP - sumM >= 0 ? '+' : '−') + U.fmtInt(Math.abs(sumP - sumM)), sumP - sumM >= 0 ? 'excedente' : 'déficit', sumP - sumM >= 0 ? 'ok' : 'bad'),
        tile('Existencias', U.fmtInt((LD.G && LD.G.inv[L] && LD.G.inv[L][state.sel]) || 0), 'tope ' + U.fmtInt(cap(L, state.sel)))
      );
    } else { lastBig = null; fit(state.refs.big).ctx.clearRect(0, 0, 4000, 4000); U.clear(state.refs.chartFoot); head.append(el('div.t', el('h3', 'Sin datos'))); }
  } else {
    const p = power(L, span);
    const P = LD.Sim && LD.Sim.Power; let sum = null; try { sum = P && P.summary ? P.summary(L) : null; } catch (e) { sum = null; }
    const gen = sum ? sum.gen : (p.gen[p.gen.length - 1] || 0), use = sum ? sum.use : (p.use[p.use.length - 1] || 0);
    const ratio = sum && sum.ratio !== undefined ? sum.ratio : (use > 0 ? Math.min(1, gen / use) : 1);
    const head = state.refs.chartHead; U.clear(head);
    head.append(el('div.t', el('h3', 'Generación y consumo · ' + layerName(L))), el('div.spacer'), el('div.stats-legend', [el('span.k', [el('i.plus'), 'generación']), el('span.k', [el('i.minus'), 'consumo'])]));
    lastBig = { series: [{ data: p.gen, color: T.bone, label: 'generación', start: p.start }, { data: p.use, color: T.verm, label: 'consumo', start: p.start }], step: p.step, unit: 'W', surface: T.ink2 };
    drawChart(state.refs.big, lastBig);
    let eh = 0; try { eh = P && P.energyHandled ? P.energyHandled(L) : 0; } catch (e) { eh = 0; }
    U.clear(state.refs.chartFoot).append(
      tile('Generación', U.fmtW(gen), sum ? sum.grids + (sum.grids === 1 ? ' red' : ' redes') : 'ahora'),
      tile('Consumo', U.fmtW(use), 'demanda actual'),
      tile('Ratio', U.fmtPct(ratio), ratio >= 1 ? 'suministro completo' : 'las máquinas van al ' + U.fmtPct(ratio), ratio >= 1 ? 'ok' : ratio >= 0.7 ? 'warn' : 'bad'),
      tile('Acumulado', sum ? U.fmtJ(sum.stored || 0) : '–', sum && sum.cap ? 'de ' + U.fmtJ(sum.cap) : 'sin baterías'),
      tile('Energía manejada', U.fmtW(eh), 'impulsa la amenaza')
    );
    const side = state.refs.side; U.clear(side);
    const table = (title, rows, key) => el('div.stats-tbl', [el('div.stats-eyebrow', title), rows && rows.length ? el('table', [el('tbody', rows.slice().sort((a, b) => (b[key] || 0) - (a[key] || 0)).map(r => el('tr', [el('td', Rg().structureName(r.id)), el('td.mono', '×' + (r.count || 0)), el('td.mono.r', U.fmtW(r[key] || 0))])))]) : el('div.stats-empty', 'Nada en esta capa.')]);
    side.append(table('Productores', sum && sum.producers, 'gen'), table('Consumidores', sum && sum.consumers, 'use'));
  }
}
function spanLabel() { return (SPANS.find(s => s.id === state.span) || SPANS[0]).name; }
function cap(L, item) { const Ec = LD.Sim && LD.Sim.Economy; if (Ec && Ec.cap) { try { return Ec.cap(L, item); } catch (e) { /* fallthrough */ } } return LD.G ? (LD.G.caps.base || 0) : 0; }
function tile(label, value, sub, cls) { return el('div.stats-tile' + (cls ? '.' + cls : ''), [el('div.l', label), el('div.v', value), sub ? el('div.s', sub) : null]); }
function icon(id, px) {
  let src = null; try { if (LD.Tex && LD.Tex.icon) src = LD.Tex.icon(id, Math.min(64, px * 2)); } catch (e) { src = null; }
  let c;
  if (src && src.width) { c = U.canvas(src.width, src.height); c.getContext('2d').drawImage(src, 0, 0); }
  else { const it = Rg().item(id); c = U.canvas(16, 16); const ctx = c.getContext('2d'); ctx.fillStyle = (it && it.color) || '#8f8b82'; ctx.fillRect(3, 3, 10, 10); }
  c.style.width = c.style.height = (px / 16) + 'rem'; c.style.display = 'block';
  return c;
}

/* ── public API ── */
function open(opts = {}) {
  if (!LD.G) return false;
  if (opts.layer !== undefined) state.layer = opts.layer | 0;
  else if (!state.open) state.layer = LD.G.view.layer || 0;
  if (!layerOpen(state.layer)) state.layer = 0;
  if (opts.tab) state.tab = opts.tab;
  if (state.open) { renderBody(); return true; }
  state.open = true; state.tok = null;
  mount();
  state.handle = { close: () => { state.handle = null; close(); } };
  if (LD.Main && LD.Main.pushOverlay) LD.Main.pushOverlay(state.handle);
  state.timer = setInterval(() => refresh(false), 1000);
  const E = LD.Events;
  if (E) state.offs = [E.on('stage:resize', () => { state.tok = null; refresh(false); }), E.on('layer:unlocked', () => renderLayers()), E.on('screen:changed', s => { if (s !== 'game') close(); })];
  sfx('ui_open');
  return true;
}
function close() {
  if (!state.open) return;
  state.open = false;
  if (state.timer) clearInterval(state.timer); state.timer = 0;
  for (const off of state.offs) { try { off(); } catch (e) { /* ignore */ } } state.offs = [];
  if (state.handle && LD.Main && LD.Main.removeOverlay) LD.Main.removeOverlay(state.handle);
  state.handle = null;
  if (state.root && state.root.parentNode) state.root.parentNode.removeChild(state.root);
  state.root = null; state.refs = {}; state.rows.clear(); state.sparks.clear(); lastBig = null;
}
function toggle() { if (state.open) { sfx('ui_close'); close(); return false; } return open(); }

LD.UI.Stats = { open, close, toggle, refresh: () => refresh(true), get isOpen() { return state.open; }, drawChart, drawSpark };
})();
