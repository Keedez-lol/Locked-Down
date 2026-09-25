(() => {
'use strict';
const LD = window.LD, U = LD.U;
const TILE = 48, VARIANTS = 6, CHUNK = 16, CACHE_MAX = 400, CACHE_BYTES = 200 * 1024 * 1024;
const H = U.hash2, clamp = U.clamp, lerp = U.lerp, PI = Math.PI, TAU = PI * 2;

/* ── colour helpers ── */
const rgb = hex => U.hexToRgb(hex);
const css = (c, a) => a === undefined ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const scalec = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const WHITE = [255, 255, 255], BLACK = [0, 0, 0];
const smooth = t => { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
const ramp = stops => { const s = stops.map(p => [p[0], rgb(p[1])]); return t => { if (t <= s[0][0]) return s[0][1]; for (let i = 1; i < s.length; i++) if (t <= s[i][0]) return mixc(s[i - 1][1], s[i][1], (t - s[i - 1][0]) / (s[i][0] - s[i - 1][0])); return s[s.length - 1][1]; }; };
const hexMix = (hex, hex2, t) => U.mixHex(hex, hex2, t);

/* ── periodic noise (tiles must wrap so any variant abuts any other without a seam) ── */
const pnoise = (x, y, px, py, seed) => {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const x0 = ((xi % px) + px) % px, y0 = ((yi % py) + py) % py, x1 = (x0 + 1) % px, y1 = (y0 + 1) % py;
  return lerp(lerp(H(x0, y0, seed), H(x1, y0, seed), u), lerp(H(x0, y1, seed), H(x1, y1, seed), u), v);
};
// W = window count of the base being painted: u,v run over W tiles, frequencies stay per tile, the wrap period grows to W·P
let W = 1;
const pn = (u, v, P, seed) => pnoise(u * P, v * P, P * W, P * W, seed);
const pfbm = (u, v, P, seed, oct = 5, gain = 0.5) => { let s = 0, a = 1, n = 0, f = P; for (let i = 0; i < oct; i++) { s += a * pnoise(u * f, v * f, f * W, f * W, seed + i * 101); n += a; a *= gain; f *= 2; } return s / n; };
const pridge = (u, v, P, seed, oct = 3) => { let s = 0, a = 1, n = 0, f = P; for (let i = 0; i < oct; i++) { s += a * (1 - Math.abs(2 * pnoise(u * f, v * f, f * W, f * W, seed + i * 77) - 1)); n += a; a *= 0.5; f *= 2; } return s / n; };
const pani = (u, v, Px, Py, seed) => pnoise(u * Px, v * Py, Px * W, Py * W, seed);
const grain = (u, v, S, P = 24) => pn(u, v, P, S + 900) - 0.5;
const CELL = { f1: 0, f2: 0, id: 0, fx: 0, fy: 0 };
const pcell = (u, v, P, seed, manhattan) => {
  const x = u * P, y = v * P, xi = Math.floor(x), yi = Math.floor(y), PW = P * W;
  let f1 = 9, f2 = 9, id = 0, fx = 0, fy = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = xi + i, cy = yi + j, wx = ((cx % PW) + PW) % PW, wy = ((cy % PW) + PW) % PW;
    const dx = cx + H(wx, wy, seed) - x, dy = cy + H(wx, wy, seed + 31) - y;
    const d = manhattan ? Math.abs(dx) + Math.abs(dy) : Math.sqrt(dx * dx + dy * dy);
    if (d < f1) { f2 = f1; f1 = d; id = wy * PW + wx; fx = dx; fy = dy; } else if (d < f2) f2 = d;
  }
  CELL.f1 = f1; CELL.f2 = f2; CELL.id = id; CELL.fx = fx; CELL.fy = fy; return CELL;
};
// 1-D periodic noise whose lattice value at t=0 is fixed (0.5) so edge masks of different variants meet at corners
const pn1 = (t, P, seed) => { const i = Math.floor(t * P), f = t * P - i, u = f * f * (3 - 2 * f); const h = k => { k = ((k % P) + P) % P; return k === 0 ? 0.5 : H(k, 0, seed); }; return lerp(h(i), h(i + 1), u); };

/* ── vector decal helpers (all sizes in px, k = size/48; decals stay inside the tile so borders remain shared) ── */
const rpos = (R, s, m) => [m + R() * (s - 2 * m), m + R() * (s - 2 * m)];
const poly = (ctx, pts) => { ctx.beginPath(); for (let i = 0; i < pts.length; i++) i ? ctx.lineTo(pts[i][0], pts[i][1]) : ctx.moveTo(pts[i][0], pts[i][1]); ctx.closePath(); };
const blobPath = (ctx, x, y, r, R, irr = 0.35, n = 8) => { ctx.beginPath(); const a0 = R() * TAU; for (let i = 0; i < n; i++) { const a = a0 + i / n * TAU, rr = r * (1 - irr / 2 + R() * irr); i ? ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); };
const pebble = (ctx, x, y, r, R, col, k) => {
  blobPath(ctx, x, y, r, R, 0.5, 7); ctx.fillStyle = col; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = Math.max(0.5, Math.min(1.1 * k, r * 0.4)); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, TAU); ctx.fill();
};
const pebbles = (ctx, s, R, k, n, cols, rmul = 1) => { for (let i = 0; i < n; i++) { const r = (1 + R() * 1.8) * k * rmul; const [x, y] = rpos(R, s, r + 2.5 * k); pebble(ctx, x, y, r, R, R.pick(cols), k); } };
const tufts = (ctx, s, R, k, n, cols) => {
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const [x, y] = rpos(R, s, 6 * k), nb = R.int(3, 5);
    ctx.strokeStyle = R.pick(cols); ctx.lineWidth = 0.9 * k;
    for (let b = 0; b < nb; b++) {
      const a = -PI / 2 + (b / (nb - 1) - 0.5) * 1.4 + (R() - 0.5) * 0.3, len = (2.5 + R() * 2.5) * k;
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + (R() - 0.5) * k, y + Math.sin(a) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
      ctx.stroke();
    }
  }
};
const patch = (ctx, s, R, k, col, alpha, rmax) => {
  const r = (rmax * 0.5 + R() * rmax * 0.5) * k, [x, y] = rpos(R, s, r), c = rgb(col);
  const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, css(c, alpha)); g.addColorStop(1, css(c, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, r, r * (0.6 + R() * 0.4), R() * PI, 0, TAU); ctx.fill();
};
const crack = (ctx, s, R, k, col, w, len, alpha = 1) => {
  const m = 3 * k; let [x, y] = rpos(R, s, m); const a = R() * TAU, n = R.int(3, 6);
  ctx.strokeStyle = col; ctx.globalAlpha = alpha; ctx.lineWidth = w * k; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x, y);
  for (let i = 0; i < n; i++) { const aa = a + (R() - 0.5) * 1.3; x = clamp(x + Math.cos(aa) * len * k / n, m, s - m); y = clamp(y + Math.sin(aa) * len * k / n, m, s - m); ctx.lineTo(x, y); }
  ctx.stroke(); ctx.globalAlpha = 1;
};
const rockChunk = (ctx, x, y, r, R, k, top, side) => {
  blobPath(ctx, x, y, r, R, 0.6, 6); ctx.fillStyle = side; ctx.fill();
  ctx.save(); ctx.clip(); blobPath(ctx, x - r * 0.28, y - r * 0.32, r * 0.95, R, 0.5, 6); ctx.fillStyle = top; ctx.fill(); ctx.restore();
  blobPath(ctx, x, y, r, R, 0.6, 6); ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 0.8 * k; ctx.stroke();
};
const crystal = (ctx, x, y, len, w, ang, col, R, k, glow) => {
  const c = rgb(col), dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
  const p = [[-len * 0.5, 0], [-len * 0.3, -w], [len * 0.3, -w], [len * 0.5, 0], [len * 0.3, w], [-len * 0.3, w]].map(q => [x + dx * q[0] + nx * q[1], y + dy * q[0] + ny * q[1]]);
  poly(ctx, p); ctx.fillStyle = css(mixc(c, WHITE, 0.12)); ctx.fill();
  poly(ctx, [p[0], p[3], p[4], p[5]]); ctx.fillStyle = css(scalec(c, 0.68)); ctx.fill();
  if (glow) { const g = ctx.createRadialGradient(x, y, 0, x, y, len * 0.5); g.addColorStop(0, css(mixc(c, WHITE, 0.65), 0.7)); g.addColorStop(1, css(c, 0)); poly(ctx, p); ctx.fillStyle = g; ctx.fill(); }
  ctx.lineWidth = 0.7 * k; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(p[1][0], p[1][1]); ctx.lineTo(p[4][0], p[4][1]); ctx.moveTo(p[2][0], p[2][1]); ctx.lineTo(p[5][0], p[5][1]); ctx.strokeStyle = css(mixc(c, WHITE, 0.55), 0.55); ctx.stroke();
  poly(ctx, p); ctx.strokeStyle = css(scalec(c, 0.45)); ctx.stroke();
};
const glint = (ctx, x, y, r, col, a) => { ctx.fillStyle = css(rgb(col), a); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };
const ember = (ctx, s, R, k, n, col) => { for (let i = 0; i < n; i++) { const [x, y] = rpos(R, s, 3 * k), r = (0.6 + R() * 0.9) * k; const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3); const c = rgb(col); g.addColorStop(0, css(c, 0.9)); g.addColorStop(0.35, css(c, 0.35)); g.addColorStop(1, css(c, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3, 0, TAU); ctx.fill(); } };
const ripple = (ctx, s, R, k, col, a) => { const [x, y] = rpos(R, s, 9 * k); ctx.strokeStyle = col; ctx.globalAlpha = a; ctx.lineWidth = 0.8 * k; for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.ellipse(x, y, (3 + i * 2.6) * k, (1.8 + i * 1.6) * k, 0, R() * PI, R() * PI + PI * 1.3); ctx.stroke(); } ctx.globalAlpha = 1; };

/* ── terrain definitions: base painter (per pixel, periodic) + variant decals (vector) ── */
const T = [], TD = {};
const def = (id, layer, name, o) => { const d = Object.assign({ id, layer, name, prio: 5, shore: null, wall: /_wall$/.test(id) }, o); T.push(d); TD[id] = d; return d; };
const mottle = (u, v, S, rp, amp = 1.6, gr = 0.25) => rp(clamp(0.5 + (pfbm(u, v, 3, S, 5) - 0.5) * amp + grain(u, v, S) * gr));
const crackLine = (u, v, S, P, w, manhattan, warp = 0.06) => { const wu = u + (pfbm(u, v, 2, S + 50, 2) - 0.5) * warp, wv = v + (pfbm(u, v, 2, S + 60, 2) - 0.5) * warp; const c = pcell(wu, wv, P, S, manhattan); return clamp(1 - (c.f2 - c.f1) / w); };
const waterBase = (u, v, S, rp, sheen, k = 1) => {
  let c = rp(clamp(0.5 + (pfbm(u, v, 2, S, 4) - 0.5) * 1.4 + grain(u, v, S) * 0.08));
  const st = pani(u, v, 3, 12, S + 21);
  const r1 = 1 - Math.abs(2 * pn(u, v, 6, S + 33) - 1), r2 = 1 - Math.abs(2 * pn(u, v, 12, S + 44) - 1);
  const caust = clamp((r1 * 0.6 + r2 * 0.4 - 0.72) * 3) * (0.3 + st);
  c = mixc(c, sheen, caust * 0.2 * k);
  if (st > 0.66) c = mixc(c, sheen, (st - 0.66) * 0.8 * k);
  return c;
};
const magmaBase = (u, v, S, crustR, hotR, P, w, glowW) => {
  const c = pcell(u, v, P, S, false), d = c.f2 - c.f1, heat = pfbm(u, v, 2, S + 3, 3);
  const crust = crustR(clamp(0.5 + (pfbm(u, v, 4, S + 11, 4) - 0.5) * 1.6 + grain(u, v, S) * 0.2));
  const line = clamp(1 - d / w), glow = clamp(1 - d / glowW);
  let col = mixc(crust, hotR(0), glow * glow * 0.5 * (0.4 + heat));
  return mixc(col, hotR(clamp(line * (0.45 + heat * 0.8))), smooth(line) * (0.55 + heat * 0.5));
};
const OCHRE = rgb('#7c7448'), MOSS = rgb('#4a6640'), LITTER = rgb('#5e5238'), LICHEN = rgb('#7c8664');
const R_GRASS = ramp([[0, '#4c5937'], [0.45, '#5c6a42'], [0.8, '#6a784a'], [1, '#77834f']]);
const R_FOREST = ramp([[0, '#38452f'], [0.5, '#465238'], [1, '#535f3d']]);
const R_DIRT = ramp([[0, '#615340'], [0.5, '#74654b'], [1, '#85765b']]);
const R_SAND = ramp([[0, '#a89b74'], [0.5, '#b8ac84'], [1, '#c5ba92']]);
const R_WATER = ramp([[0, '#2f4752'], [0.5, '#3c5762'], [1, '#48656f']]);
const R_ROCK = ramp([[0, '#5b5953'], [0.5, '#6d6b64'], [1, '#807e76']]);
const R_CLAY = ramp([[0, '#7c6350'], [0.5, '#8e7460'], [1, '#9c826b']]);
const R_BOG = ramp([[0, '#3a4030'], [0.5, '#4a5139'], [1, '#585f40']]);
const R_SALT = ramp([[0, '#b9b19e'], [0.5, '#cbc4b1'], [1, '#d8d2c0']]);
const R_GRAVEL = ramp([[0, '#6b675f'], [0.5, '#86827a'], [1, '#9c988f']]);
def('grass', 0, 'Pradera', { prio: 8, avg: '#5f6c43', base: (u, v, S) => {
  const m = pfbm(u, v, 3, S, 5), blades = pani(u, v, 24, 48, S + 5) - 0.5;
  let c = R_GRASS(clamp(0.5 + (m - 0.5) * 1.6 + blades * 0.35 + grain(u, v, S) * 0.2));
  const o = pfbm(u, v, 2, S + 7, 3); if (o > 0.58) c = mixc(c, OCHRE, (o - 0.58) * 2.2);
  const mo = pfbm(u, v, 4, S + 9, 3); if (mo > 0.62) c = mixc(c, MOSS, (mo - 0.62) * 1.6);
  return c;
}, decals: (ctx, s, R, k) => { tufts(ctx, s, R, k, R.int(6, 10), ['#3f4a2e', '#55633b', '#6e6f45', '#8a8250']); pebbles(ctx, s, R, k, R.int(0, 2), ['#8a8478', '#75705f'], 1.1); if (R.chance(0.5)) patch(ctx, s, R, k, '#43593a', 0.2, 9); } });
def('forest', 0, 'Bosque', { prio: 9, avg: '#465238', base: (u, v, S) => {
  let c = mottle(u, v, S, R_FOREST, 1.5, 0.3);
  const l = pn(u, v, 12, S + 4); if (l > 0.68) c = mixc(c, LITTER, (l - 0.68) * 1.8);
  const mo = pfbm(u, v, 3, S + 9, 3); if (mo > 0.6) c = mixc(c, MOSS, (mo - 0.6) * 1.4);
  return c;
}, decals: (ctx, s, R, k) => { for (let i = 0; i < R.int(4, 8); i++) { const [x, y] = rpos(R, s, 3 * k); ctx.fillStyle = R.pick(['#645638', '#4f4630', '#75643f']); ctx.beginPath(); ctx.ellipse(x, y, 1.6 * k, 0.9 * k, R() * PI, 0, TAU); ctx.fill(); } tufts(ctx, s, R, k, R.int(1, 3), ['#3a4a2f', '#4e6038']); if (R.chance(0.6)) crack(ctx, s, R, k, '#3a3024', 1.1, 12, 0.6); patch(ctx, s, R, k, '#3d5236', 0.22, 9); } });
def('dirt', 0, 'Tierra', { prio: 5, avg: '#74654b', base: (u, v, S) => { let c = mottle(u, v, S, R_DIRT, 1.5, 0.35); const d = pfbm(u, v, 2, S + 6, 3); if (d < 0.42) c = scalec(c, 1 - (0.42 - d) * 0.6); return c; },
  decals: (ctx, s, R, k) => { pebbles(ctx, s, R, k, R.int(4, 8), ['#8c8068', '#7a6e58', '#9a8f78'], 1); if (R.chance(0.7)) crack(ctx, s, R, k, '#4e4232', 0.9, 14, 0.45); if (R.chance(0.5)) patch(ctx, s, R, k, '#8f8266', 0.16, 8); } });
def('sand', 0, 'Arena', { prio: 3, avg: '#b8ac84', base: (u, v, S) => {
  let c = mottle(u, v, S, R_SAND, 1.2, 0.3);
  const rip = 1 - Math.abs(2 * pnoise(u * 3 + v * 2, v * 14, 3 * W, 14 * W, S + 8) - 1); c = scalec(c, 1 - clamp(rip - 0.7) * 0.22);
  if (grain(u, v, S + 5, 48) > 0.42) c = scalec(c, 0.82);
  return c;
}, decals: (ctx, s, R, k) => { pebbles(ctx, s, R, k, R.int(0, 2), ['#9c907a', '#a89d86'], 0.8); for (let i = 0; i < R.int(2, 4); i++) { const [x, y] = rpos(R, s, 8 * k); ctx.strokeStyle = 'rgba(80,70,50,.14)'; ctx.lineWidth = 1.2 * k; ctx.beginPath(); ctx.moveTo(x - 6 * k, y); ctx.quadraticCurveTo(x, y - 3 * k * (R() - 0.5), x + 6 * k, y + 1.5 * k); ctx.stroke(); } patch(ctx, s, R, k, '#cfc4a0', 0.22, 10); } });
def('water', 0, 'Agua', { prio: 0, shore: 'foam', avg: '#3c5762', base: (u, v, S) => waterBase(u, v, S, R_WATER, rgb('#7a9aa2')), decals: (ctx, s, R, k) => { if (R.chance(0.6)) ripple(ctx, s, R, k, '#8aa7ae', 0.14); } });
def('rock', 0, 'Roca', { prio: 7, avg: '#6d6b64', base: (u, v, S) => {
  let c = mottle(u, v, S, R_ROCK, 1.5, 0.3);
  const cl = crackLine(u, v, S + 2, 3, 0.08, false, 0.1); c = mixc(c, rgb('#4a4842'), smooth(cl) * 0.5 * (0.5 + pfbm(u, v, 2, S + 30, 2)));
  const li = pfbm(u, v, 3, S + 12, 3); if (li > 0.64) c = mixc(c, LICHEN, (li - 0.64) * 1.6);
  return c;
}, decals: (ctx, s, R, k) => { crack(ctx, s, R, k, '#3f3d38', 1, 16, 0.55); if (R.chance(0.6)) crack(ctx, s, R, k, '#3f3d38', 0.8, 10, 0.4); pebbles(ctx, s, R, k, R.int(1, 3), ['#8a8880', '#7a786f'], 1); if (R.chance(0.5)) patch(ctx, s, R, k, '#8b9470', 0.18, 7); } });
def('clay', 0, 'Arcilla', { prio: 4, avg: '#8e7460', base: (u, v, S) => {
  let c = mottle(u, v, S, R_CLAY, 1.2, 0.12);
  const cl = crackLine(u, v, S + 3, 4, 0.07, false, 0.08); c = mixc(c, rgb('#5f4a3b'), smooth(cl) * 0.6);
  const cc = pcell(u, v, 4, S + 3, false); c = scalec(c, 1 + (0.15 - cc.f1) * 0.25);
  return c;
}, decals: (ctx, s, R, k) => { pebbles(ctx, s, R, k, R.int(0, 2), ['#a08a76', '#7f6a58'], 0.9); patch(ctx, s, R, k, '#6d5546', 0.25, 9); } });
def('bog', 0, 'Turbera', { prio: 1, avg: '#4a5139', base: (u, v, S) => {
  let c = mottle(u, v, S, R_BOG, 1.5, 0.3);
  const w = pfbm(u, v, 2, S + 4, 3); if (w > 0.56) { const t = clamp((w - 0.56) * 4); c = mixc(c, rgb('#303c3a'), t * 0.8); const sh = pani(u, v, 3, 12, S + 22); if (sh > 0.66) c = mixc(c, rgb('#6f8483'), (sh - 0.66) * 1.6 * t); }
  return c;
}, decals: (ctx, s, R, k) => { tufts(ctx, s, R, k, R.int(2, 4), ['#5a6238', '#6b7040', '#3f4a2c']); for (let i = 0; i < R.int(2, 5); i++) { const [x, y] = rpos(R, s, 7 * k); ctx.strokeStyle = R.pick(['#5f6640', '#6b7047', '#4f5a38']); ctx.lineWidth = 0.8 * k; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y + 5 * k); ctx.quadraticCurveTo(x + (R() - 0.5) * 3 * k, y, x + (R() - 0.5) * 2 * k, y - 6 * k); ctx.stroke(); } patch(ctx, s, R, k, '#2e3a38', 0.3, 10); } });
def('saltflat', 0, 'Salar', { prio: 2, avg: '#cbc4b1', base: (u, v, S) => {
  let c = mottle(u, v, S, R_SALT, 1.0, 0.18);
  const cl = crackLine(u, v, S + 3, 3, 0.06); c = mixc(c, rgb('#a09886'), smooth(cl) * 0.8);
  const cc = pcell(u, v, 3, S + 3, false); c = scalec(c, 1 + (0.2 - cc.f1) * 0.18);
  return c;
}, decals: (ctx, s, R, k) => { for (let i = 0; i < R.int(3, 7); i++) { const [x, y] = rpos(R, s, 3 * k); glint(ctx, x, y, (0.6 + R() * 0.6) * k, '#f2eee2', 0.8); } if (R.chance(0.4)) patch(ctx, s, R, k, '#b5ad98', 0.25, 9); } });
def('gravel', 0, 'Grava', { prio: 6, avg: '#86827a', base: (u, v, S) => {
  const c = pcell(u + (pfbm(u, v, 2, S + 50, 2) - 0.5) * 0.12, v + (pfbm(u, v, 2, S + 60, 2) - 0.5) * 0.12, 8, S, false), tone = H(c.id, 3, S + 4);
  let col = R_GRAVEL(clamp(0.2 + tone * 0.7 + grain(u, v, S) * 0.2));
  const edge = clamp(1 - (c.f2 - c.f1) / 0.28); col = scalec(col, 1 - edge * edge * 0.3);
  return scalec(col, clamp(1 + (c.fx + c.fy) * 0.22, 0.78, 1.18));
}, decals: (ctx, s, R, k) => { pebbles(ctx, s, R, k, R.int(3, 6), ['#a19c92', '#6e6a62', '#8c887f', '#b3aea3'], 1.3); } });

const R_CAVE = ramp([[0, '#3f4044'], [0.5, '#525358'], [1, '#626368']]);
const R_CWALL = ramp([[0, '#28292c'], [0.5, '#35363a'], [1, '#434448']]);
const R_CWATER = ramp([[0, '#26343b'], [0.5, '#314249'], [1, '#3c5058']]);
const R_COAL = ramp([[0, '#1a1a1d'], [0.5, '#25252a'], [1, '#313136']]);
def('cave_floor', 1, 'Suelo de cueva', { prio: 1, avg: '#525358', base: (u, v, S) => { let c = mottle(u, v, S, R_CAVE, 1.4, 0.4); const d = pfbm(u, v, 2, S + 6, 3); if (d < 0.44) c = mixc(c, rgb('#3a3f44'), (0.44 - d) * 2); return c; },
  decals: (ctx, s, R, k) => { pebbles(ctx, s, R, k, R.int(3, 6), ['#6a6b70', '#5b5c61', '#77787d'], 0.9); if (R.chance(0.6)) crack(ctx, s, R, k, '#303135', 0.9, 14, 0.5); if (R.chance(0.4)) patch(ctx, s, R, k, '#2f3438', 0.3, 9); } });
def('cave_wall', 1, 'Roca de cueva', { prio: 10, avg: '#35363a', base: (u, v, S) => {
  const c = pcell(u, v, 5, S + 2, false), tone = H(c.id, 5, S + 7);
  let col = R_CWALL(clamp(0.3 + tone * 0.45 + (pfbm(u, v, 4, S, 4) - 0.5) * 0.9 + grain(u, v, S) * 0.3));
  col = mixc(col, rgb('#1d1e20'), smooth(clamp(1 - (c.f2 - c.f1) / 0.1)) * 0.85);
  return scalec(col, clamp(1 + (c.fx + c.fy) * 0.12, 0.85, 1.12));
}, decals: (ctx, s, R, k) => { crack(ctx, s, R, k, '#1f2022', 1.1, 16, 0.7); pebbles(ctx, s, R, k, R.int(1, 3), ['#4b4c51', '#3f4045'], 1.2); for (let i = 0; i < R.int(0, 3); i++) { const [x, y] = rpos(R, s, 3 * k); glint(ctx, x, y, 0.6 * k, '#b9c0c8', 0.55); } } });
def('cave_water', 1, 'Agua subterránea', { prio: 0, shore: 'foam_dim', avg: '#314249', base: (u, v, S) => waterBase(u, v, S, R_CWATER, rgb('#6b8790'), 0.8), decals: (ctx, s, R, k) => { if (R.chance(0.5)) ripple(ctx, s, R, k, '#7f9aa1', 0.12); } });
def('rubble', 1, 'Escombros', { prio: 2, avg: '#4d4e53', tints: { 1: ['#5b5c61', '#3b3c41', '#6b6c71'], 2: ['#59606f', '#3a3f4c', '#6b7282'] }, base: (u, v, S, L) => {
  const rp = L === 2 ? ramp([[0, '#3d4350'], [0.5, '#4b5160'], [1, '#575d6c']]) : ramp([[0, '#3b3c40'], [0.5, '#4a4b50'], [1, '#585a5f']]);
  const c = pcell(u, v, 6, S + 1, false), tone = H(c.id, 2, S + 3);
  let col = rp(clamp(0.25 + tone * 0.6 + (pfbm(u, v, 3, S, 4) - 0.5) * 0.8 + grain(u, v, S) * 0.3));
  col = scalec(col, 1 - smooth(clamp(1 - (c.f2 - c.f1) / 0.2)) * 0.3);
  return scalec(col, clamp(1 + (c.fx + c.fy) * 0.25, 0.75, 1.2));
}, decals: (ctx, s, R, k, L) => { const t = TD.rubble.tints[L] || TD.rubble.tints[1]; for (let i = 0; i < R.int(4, 7); i++) { const r = (2 + R() * 2.5) * k, [x, y] = rpos(R, s, r + 2 * k); rockChunk(ctx, x, y, r, R, k, t[0], t[1]); } pebbles(ctx, s, R, k, R.int(2, 4), [t[2], t[0]], 0.8); } });
def('coal_seam', 1, 'Veta de carbón', { prio: 3, avg: '#25252a', base: (u, v, S) => {
  const c = pcell(u, v, 6, S + 2, false), tone = H(c.id, 5, S + 7), d = c.f2 - c.f1;
  let col = R_COAL(clamp(0.2 + tone * 0.6 + grain(u, v, S) * 0.25));
  if (d < 0.08) col = mixc(col, rgb('#45464d'), clamp(1 - d / 0.08) * 0.7);
  const sh = pani(u, v, 6, 18, S + 15); if (sh > 0.72 && tone > 0.5) col = mixc(col, rgb('#5c5d66'), (sh - 0.72) * 2.4);
  return col;
}, decals: (ctx, s, R, k) => { for (let i = 0; i < R.int(3, 5); i++) { const r = (1.8 + R() * 2.2) * k, [x, y] = rpos(R, s, r + 2 * k); rockChunk(ctx, x, y, r, R, k, '#33343a', '#1c1c1f'); ctx.strokeStyle = 'rgba(150,152,165,.45)'; ctx.lineWidth = 0.7 * k; ctx.beginPath(); ctx.moveTo(x - r * 0.5, y - r * 0.4); ctx.lineTo(x + r * 0.1, y - r * 0.55); ctx.stroke(); } patch(ctx, s, R, k, '#0f0f11', 0.4, 9); } });

const R_DEEP = ramp([[0, '#424856'], [0.5, '#505766'], [1, '#5e6574']]);
const R_DWALL = ramp([[0, '#262b36'], [0.5, '#333947'], [1, '#404654']]);
const R_DWATER = ramp([[0, '#22303c'], [0.5, '#2d3e4c'], [1, '#384c5a']]);
def('deep_floor', 2, 'Suelo profundo', { prio: 1, avg: '#505766', base: (u, v, S) => { let c = mottle(u, v, S, R_DEEP, 1.4, 0.35); const q = pn(u, v, 16, S + 8); if (q > 0.8) c = mixc(c, rgb('#9aa3b3'), (q - 0.8) * 2.5); return c; },
  decals: (ctx, s, R, k) => { pebbles(ctx, s, R, k, R.int(2, 5), ['#6c7383', '#5a6170', '#7d8494'], 0.9); if (R.chance(0.6)) crack(ctx, s, R, k, '#2e3440', 0.9, 14, 0.5); if (R.chance(0.3)) { const [x, y] = rpos(R, s, 4 * k); glint(ctx, x, y, 0.8 * k, '#d6dde8', 0.6); } } });
def('deep_wall', 2, 'Roca profunda', { prio: 10, avg: '#333947', base: (u, v, S) => {
  const c = pcell(u, v, 5, S + 2, false), tone = H(c.id, 5, S + 7);
  let col = R_DWALL(clamp(0.3 + tone * 0.45 + (pfbm(u, v, 4, S, 4) - 0.5) * 0.9 + grain(u, v, S) * 0.3));
  col = mixc(col, rgb('#1a1e27'), smooth(clamp(1 - (c.f2 - c.f1) / 0.1)) * 0.85);
  const vein = pridge(u, v, 2, S + 20, 2); if (vein > 0.9) col = mixc(col, rgb('#5d6a85'), (vein - 0.9) * 1.5);
  return scalec(col, clamp(1 + (c.fx + c.fy) * 0.12, 0.85, 1.12));
}, decals: (ctx, s, R, k) => { crack(ctx, s, R, k, '#1b1f27', 1.1, 16, 0.7); pebbles(ctx, s, R, k, R.int(1, 3), ['#4a5060', '#3c4250'], 1.2); for (let i = 0; i < R.int(1, 3); i++) { const [x, y] = rpos(R, s, 3 * k); glint(ctx, x, y, 0.7 * k, R.pick(['#c3b8e6', '#d9dee8']), 0.6); } } });
def('crystal_floor', 2, 'Suelo cristalino', { prio: 3, avg: '#5a5a74', emissive: '#a08fd0', base: (u, v, S) => { let c = mottle(u, v, S + 1, R_DEEP, 1.3, 0.3); const vio = pfbm(u, v, 2, S + 5, 3); if (vio > 0.5) c = mixc(c, rgb('#605878'), (vio - 0.5) * 1.2); return c; },
  decals: (ctx, s, R, k) => {
    const [cx, cy] = rpos(R, s, 15 * k), g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 15 * k); g.addColorStop(0, 'rgba(170,150,220,.28)'); g.addColorStop(1, 'rgba(170,150,220,0)'); ctx.fillStyle = g; ctx.fillRect(cx - 15 * k, cy - 15 * k, 30 * k, 30 * k);
    for (let i = 0; i < R.int(2, 4); i++) { const a = R() * TAU, len = (7 + R() * 6) * k; crystal(ctx, cx + (R() - 0.5) * 8 * k, cy + (R() - 0.5) * 8 * k, len, (2 + R() * 1.4) * k, a, R.chance(0.65) ? '#8f7fb8' : '#c9d3e0', R, k, true); }
    pebbles(ctx, s, R, k, R.int(1, 3), ['#6c7383', '#5a6170'], 0.8);
  } });
def('deep_water', 2, 'Agua profunda', { prio: 0, shore: 'foam_dim', avg: '#2d3e4c', base: (u, v, S) => waterBase(u, v, S, R_DWATER, rgb('#647f92'), 0.8), decals: (ctx, s, R, k) => { if (R.chance(0.5)) ripple(ctx, s, R, k, '#7a95a6', 0.12); } });

const R_ABYSS = ramp([[0, '#282423'], [0.5, '#332e2b'], [1, '#3e3834']]);
const R_AWALL = ramp([[0, '#191716'], [0.5, '#23201f'], [1, '#2e2a28']]);
const R_OBS = ramp([[0, '#151518'], [0.5, '#1e1e23'], [1, '#2a2a31']]);
const R_CRUST = ramp([[0, '#261a17'], [0.5, '#332521'], [1, '#41302a']]);
const R_HOT = ramp([[0, '#6e2a16'], [0.45, '#c4522a'], [0.8, '#e88a3c'], [1, '#f6c46a']]);
def('abyss_floor', 3, 'Suelo abisal', { prio: 1, avg: '#332e2b', base: (u, v, S) => {
  let c = mottle(u, v, S, R_ABYSS, 1.4, 0.35);
  const cl = crackLine(u, v, S + 2, 4, 0.07); c = mixc(c, rgb('#1c1917'), smooth(cl) * 0.7);
  const heat = pfbm(u, v, 2, S + 9, 3); if (heat > 0.6) c = mixc(c, rgb('#7a3a22'), smooth(cl) * (heat - 0.6) * 2.2);
  return c;
}, decals: (ctx, s, R, k) => { pebbles(ctx, s, R, k, R.int(1, 3), ['#4a423d', '#3b3430'], 1); if (R.chance(0.5)) crack(ctx, s, R, k, '#c8552a', 0.8, 12, 0.35); if (R.chance(0.5)) ember(ctx, s, R, k, R.int(1, 2), '#e0703a'); } });
def('abyss_wall', 3, 'Roca abisal', { prio: 10, avg: '#23201f', base: (u, v, S) => {
  const c = pcell(u, v, 5, S + 2, false), tone = H(c.id, 5, S + 7);
  let col = R_AWALL(clamp(0.3 + tone * 0.45 + (pfbm(u, v, 4, S, 4) - 0.5) * 0.9 + grain(u, v, S) * 0.3));
  col = mixc(col, rgb('#0f0d0c'), smooth(clamp(1 - (c.f2 - c.f1) / 0.1)) * 0.85);
  return scalec(col, clamp(1 + (c.fx + c.fy) * 0.12, 0.85, 1.12));
}, decals: (ctx, s, R, k) => { crack(ctx, s, R, k, '#0f0d0c', 1.1, 16, 0.8); ember(ctx, s, R, k, R.int(1, 3), '#d8652f'); pebbles(ctx, s, R, k, R.int(0, 2), ['#332e2c', '#2b2624'], 1.1); } });
def('obsidian_floor', 3, 'Obsidiana', { prio: 2, avg: '#1e1e23', base: (u, v, S) => {
  const c = pcell(u, v, 5, S, false), d = c.f2 - c.f1, shard = H(c.id, 1, S + 9);
  let col = R_OBS(clamp(0.3 + shard * 0.45 + grain(u, v, S) * 0.15));
  const refl = pani(u, v, 5, 20, S + 12); if (refl > 0.74 && shard > 0.55) col = mixc(col, rgb('#5a5a68'), (refl - 0.74) * 2.2);
  if (d < 0.06) col = mixc(col, rgb('#3f3f4a'), clamp(1 - d / 0.06) * 0.7);
  return col;
}, decals: (ctx, s, R, k) => {
  for (let i = 0; i < R.int(2, 4); i++) { const [x, y] = rpos(R, s, 6 * k), a = R() * TAU, l = (3 + R() * 4) * k; poly(ctx, [[x + Math.cos(a) * l, y + Math.sin(a) * l], [x + Math.cos(a + 2.2) * l * 0.7, y + Math.sin(a + 2.2) * l * 0.7], [x + Math.cos(a + 4.1) * l * 0.8, y + Math.sin(a + 4.1) * l * 0.8]]); ctx.fillStyle = R.pick(['#101014', '#26262e']); ctx.fill(); ctx.strokeStyle = 'rgba(200,200,220,.28)'; ctx.lineWidth = 0.6 * k; ctx.stroke(); }
  for (let i = 0; i < R.int(1, 3); i++) { const [x, y] = rpos(R, s, 6 * k); ctx.strokeStyle = 'rgba(210,210,230,.22)'; ctx.lineWidth = 0.7 * k; ctx.beginPath(); ctx.arc(x, y, (3 + R() * 3) * k, R() * PI, R() * PI + 1.2); ctx.stroke(); }
} });
def('magma', 3, 'Magma', { prio: 0, shore: 'glow', avg: '#8a3c22', emissive: '#e8823a', base: (u, v, S) => magmaBase(u, v, S, R_CRUST, R_HOT, 4, 0.11, 0.3),
  decals: (ctx, s, R, k) => { for (let i = 0; i < R.int(1, 3); i++) { const [x, y] = rpos(R, s, 5 * k), r = (2.5 + R() * 2.5) * k, g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(250,200,110,.9)'); g.addColorStop(0.5, 'rgba(226,110,50,.6)'); g.addColorStop(1, 'rgba(150,50,25,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); } pebbles(ctx, s, R, k, R.int(0, 2), ['#2e2220', '#3a2a26'], 1.2); } });
def('vent', 3, 'Fumarola', { prio: 3, avg: '#3d3630', emissive: '#c07a3a', base: (u, v, S) => { let c = mottle(u, v, S, R_ABYSS, 1.3, 0.35); const cl = crackLine(u, v, S + 2, 4, 0.07); c = mixc(c, rgb('#1c1917'), smooth(cl) * 0.6); const sul = pfbm(u, v, 2, S + 14, 3); if (sul > 0.5) c = mixc(c, rgb('#8a7a48'), (sul - 0.5) * 0.9); return c; },
  decals: (ctx, s, R, k) => {
    const cx = s / 2 + (R() - 0.5) * 6 * k, cy = s / 2 + (R() - 0.5) * 6 * k, r = (6 + R() * 2) * k;
    let g = ctx.createRadialGradient(cx, cy, r, cx, cy, r * 2.4); g.addColorStop(0, 'rgba(176,144,72,.35)'); g.addColorStop(1, 'rgba(176,144,72,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = '#17120f'; ctx.lineWidth = 1.2 * k; ctx.lineCap = 'round';
    for (let i = 0; i < R.int(3, 5); i++) { const a = R() * TAU, l = r + (4 + R() * 6) * k; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * 0.7, cy + Math.sin(a) * r * 0.7); ctx.lineTo(cx + Math.cos(a + 0.25) * l * 0.7, cy + Math.sin(a + 0.25) * l * 0.7); ctx.lineTo(cx + Math.cos(a) * Math.min(l, s / 2 - 2 * k), cy + Math.sin(a) * Math.min(l, s / 2 - 2 * k)); ctx.stroke(); }
    g = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.6); g.addColorStop(0, 'rgba(214,110,50,.5)'); g.addColorStop(1, 'rgba(214,110,50,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.8, R() * PI, 0, TAU); ctx.fillStyle = '#100d0c'; ctx.fill(); ctx.strokeStyle = 'rgba(232,140,60,.5)'; ctx.lineWidth = 0.8 * k; ctx.stroke();
    g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, 'rgba(200,90,40,.55)'); g.addColorStop(1, 'rgba(200,90,40,0)'); ctx.fillStyle = g; ctx.fill();
  } });

const R_CORE = ramp([[0, '#1a1624'], [0.5, '#241f30'], [1, '#2e283a']]);
const R_CORE2 = ramp([[0, '#1f1a2c'], [0.5, '#282238'], [1, '#322b44']]);
const R_KWALL = ramp([[0, '#100d17'], [0.5, '#191420'], [1, '#221c2c']]);
const R_VCRUST = ramp([[0, '#1f151f'], [0.5, '#2a1c27'], [1, '#36262f']]);
const R_VHOT = ramp([[0, '#7a2a1a'], [0.45, '#d0582a'], [0.8, '#f09040'], [1, '#fbd070']]);
const CYAN = rgb('#4fc3d6'), CYAN_DIM = rgb('#2f6a78'), CYAN_HI = rgb('#a8f0f8'), VIOLET = rgb('#7a5fd0');
def('core_floor', 4, 'Suelo del núcleo', { prio: 2, avg: '#241f30', base: (u, v, S) => { let c = mottle(u, v, S, R_CORE, 1.4, 0.35); const vio = pfbm(u, v, 2, S + 5, 3); if (vio > 0.55) c = mixc(c, rgb('#3b2f52'), (vio - 0.55) * 1.4); return c; },
  decals: (ctx, s, R, k) => { if (R.chance(0.7)) crack(ctx, s, R, k, '#100c18', 0.9, 14, 0.7); pebbles(ctx, s, R, k, R.int(1, 3), ['#3a3348', '#2c2638'], 0.9); for (let i = 0; i < R.int(0, 2); i++) { const [x, y] = rpos(R, s, 3 * k); glint(ctx, x, y, 0.6 * k, '#8fe6f0', 0.55); } } });
def('core_wall', 4, 'Roca del núcleo', { prio: 10, avg: '#191420', base: (u, v, S) => {
  const c = pcell(u, v, 5, S + 2, false), tone = H(c.id, 5, S + 7);
  let col = R_KWALL(clamp(0.3 + tone * 0.45 + (pfbm(u, v, 4, S, 4) - 0.5) * 0.9 + grain(u, v, S) * 0.3));
  col = mixc(col, rgb('#08060c'), smooth(clamp(1 - (c.f2 - c.f1) / 0.1)) * 0.85);
  const vein = pridge(u, v, 2, S + 20, 2); if (vein > 0.92) col = mixc(col, rgb('#3d3158'), (vein - 0.92) * 2);
  return scalec(col, clamp(1 + (c.fx + c.fy) * 0.12, 0.85, 1.12));
}, decals: (ctx, s, R, k) => { crack(ctx, s, R, k, '#08060c', 1.1, 16, 0.8); if (R.chance(0.5)) crack(ctx, s, R, k, '#7a5fd0', 0.8, 10, 0.35); for (let i = 0; i < R.int(1, 3); i++) { const [x, y] = rpos(R, s, 3 * k); glint(ctx, x, y, 0.7 * k, R.pick(['#8fe6f0', '#b39cf0']), 0.6); } pebbles(ctx, s, R, k, R.int(0, 2), ['#231d2e', '#1c1725'], 1.1); } });
def('magma_sea', 4, 'Mar de magma', { prio: 0, shore: 'glow', avg: '#9a4020', emissive: '#f09040', base: (u, v, S) => magmaBase(u, v, S, R_VCRUST, R_VHOT, 3, 0.17, 0.42),
  decals: (ctx, s, R, k) => { for (let i = 0; i < R.int(1, 3); i++) { const [x, y] = rpos(R, s, 4 * k), r = (1.2 + R() * 1.6) * k; ctx.strokeStyle = 'rgba(255,210,120,.7)'; ctx.lineWidth = 0.8 * k; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); } for (let i = 0; i < R.int(1, 2); i++) { const [x, y] = rpos(R, s, 5 * k), r = (3 + R() * 3) * k, g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,220,130,.85)'); g.addColorStop(0.6, 'rgba(230,120,50,.45)'); g.addColorStop(1, 'rgba(150,50,25,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); } } });
def('plasma_floor', 4, 'Suelo de plasma', { prio: 3, avg: '#2a3c48', emissive: '#4fc3d6', base: (u, v, S) => {
  let col = R_CORE2(clamp(0.5 + (pfbm(u, v, 3, S, 4) - 0.5) * 1.3 + grain(u, v, S) * 0.15));
  const c = pcell(u, v, 3, S + 5, true), d = c.f2 - c.f1, glow = clamp(1 - d / 0.2), live = pfbm(u, v, 2, S + 8, 2);
  col = mixc(col, CYAN_DIM, glow * glow * 0.25);
  col = mixc(col, CYAN, smooth(clamp(1 - d / 0.045)) * (0.22 + live * 0.38));
  if (c.f1 < 0.09) col = mixc(col, CYAN_HI, clamp(1 - c.f1 / 0.09) * 0.65);
  return col;
}, decals: (ctx, s, R, k) => {
  for (let i = 0; i < R.int(1, 3); i++) { const [x, y] = rpos(R, s, 4 * k), r = (1.2 + R() * 0.8) * k, g = ctx.createRadialGradient(x, y, 0, x, y, r * 3); g.addColorStop(0, 'rgba(168,240,248,.9)'); g.addColorStop(0.3, 'rgba(79,195,214,.5)'); g.addColorStop(1, 'rgba(79,195,214,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3, 0, TAU); ctx.fill(); ctx.fillStyle = '#cdf6fa'; ctx.fillRect(x - r * 0.6, y - r * 0.6, r * 1.2, r * 1.2); }
  if (R.chance(0.6)) { const [x, y] = rpos(R, s, 7 * k); ctx.strokeStyle = 'rgba(79,195,214,.45)'; ctx.lineWidth = 0.8 * k; ctx.strokeRect(x - 4 * k, y - 3 * k, 8 * k, 6 * k); }
} });
def('void_crack', 4, 'Grieta del vacío', { prio: 1, avg: '#100d16', emissive: '#7a5fd0', base: (u, v, S) => { let c = ramp([[0, '#0b0910'], [0.5, '#110e18'], [1, '#181322']])(clamp(0.5 + (pfbm(u, v, 3, S, 4) - 0.5) * 1.4 + grain(u, v, S) * 0.2)); const vio = pfbm(u, v, 2, S + 5, 3); if (vio > 0.55) c = mixc(c, rgb('#231a33'), (vio - 0.55) * 1.6); return c; },
  decals: (ctx, s, R, k) => {
    const cx = s / 2 + (R() - 0.5) * 8 * k, cy = s / 2 + (R() - 0.5) * 8 * k, a = R() * PI, L = (14 + R() * 6) * k, w = (2.5 + R() * 2) * k, n = 7;
    const up = [], dn = [];
    for (let i = 0; i <= n; i++) { const t = i / n - 0.5, x = t * L * 2, ww = w * Math.sin((i / n) * PI) + 0.3 * k, j = (R() - 0.5) * 2.2 * k; up.push([x, -ww + j]); dn.unshift([x, ww + j]); }
    const pts = up.concat(dn).map(p => [cx + Math.cos(a) * p[0] - Math.sin(a) * p[1], cy + Math.sin(a) * p[0] + Math.cos(a) * p[1]]);
    let g = ctx.createRadialGradient(cx, cy, 0, cx, cy, L); g.addColorStop(0, 'rgba(122,95,208,.35)'); g.addColorStop(1, 'rgba(122,95,208,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    poly(ctx, pts); ctx.fillStyle = '#05040a'; ctx.fill();
    ctx.save(); ctx.clip(); g = ctx.createRadialGradient(cx, cy, 0, cx, cy, L * 0.9); g.addColorStop(0, 'rgba(120,220,236,.85)'); g.addColorStop(0.4, 'rgba(122,95,208,.45)'); g.addColorStop(1, 'rgba(60,40,110,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, s, s); ctx.restore();
    poly(ctx, pts); ctx.strokeStyle = 'rgba(160,140,230,.5)'; ctx.lineWidth = 0.7 * k; ctx.stroke();
    for (let i = 0; i < R.int(2, 4); i++) { const [x, y] = rpos(R, s, 3 * k); glint(ctx, x, y, 0.5 * k, '#9fe8f2', 0.7); }
  } });
const WALL_OF = ['rock', 'cave_wall', 'deep_wall', 'abyss_wall', 'core_wall'], FLOOR_OF = ['dirt', 'cave_floor', 'deep_floor', 'abyss_floor', 'core_floor'];
const TERRAIN_IDS = T.map(d => d.id);
const layerName = L => ['SUPERFICIE', 'CUEVAS', 'PROFUNDIDADES', 'ABISMO', 'NÚCLEO'][L] || ('CAPA ' + L);
const terrainName = d => { const r = LD.Registry && LD.Registry.terrain && LD.Registry.terrain(d.id); return (r && r.name) || d.name; };

/* ── tile generation: one periodic base per terrain spanning win×win tiles (walls 3×3, rest 2×2); a tile at world (x,y)
   shows window (x mod win, y mod win) so same-terrain tiles form one seamless texture; variants add interior decals ── */
const tileSets = new Map(), baseCache = new Map();
const seedOf = id => U.hashStr(id) % 100003;
const defOf = (id, L) => TD[id] || TD[FLOOR_OF[L] || 'dirt'] || TD.dirt;
const winOf = d => d.win || (d.wall ? 3 : 2);
const setKey = (id, size, L) => id + (id === 'rubble' && L === 2 ? '#2' : '') + '@' + size;
const baseCanvas = (d, size, L) => {
  const key = setKey(d.id, size, L), hit = baseCache.get(key); if (hit) return hit;
  const win = winOf(d), N = size * win, c = U.canvas(N, N), ctx = c.getContext('2d'), img = ctx.createImageData(N, N), px = img.data, S = seedOf(d.id), inv = 1 / size, LL = d.id === 'rubble' && L === 2 ? 2 : 1;
  W = win;
  for (let y = 0, i = 0; y < N; y++) for (let x = 0; x < N; x++, i += 4) {
    const col = d.base((x + 0.5) * inv, (y + 0.5) * inv, S, LL);
    px[i] = col[0] < 0 ? 0 : col[0] > 255 ? 255 : col[0]; px[i + 1] = col[1] < 0 ? 0 : col[1] > 255 ? 255 : col[1]; px[i + 2] = col[2] < 0 ? 0 : col[2] > 255 ? 255 : col[2]; px[i + 3] = 255;
  }
  W = 1;
  ctx.putImageData(img, 0, 0); baseCache.set(key, c); return c;
};
const buildSet = (id, size, L) => {
  const d = defOf(id, L), base = baseCanvas(d, size, L), win = winOf(d), tiles = [], LL = d.id === 'rubble' && L === 2 ? 2 : 1;
  for (let wy = 0; wy < win; wy++) for (let wx = 0; wx < win; wx++) for (let v = 0; v < VARIANTS; v++) {
    const c = U.canvas(size, size), ctx = c.getContext('2d', { alpha: false });
    ctx.drawImage(base, -wx * size, -wy * size);
    if (d.decals) { ctx.save(); d.decals(ctx, size, U.rng(seedOf(d.id) * 7 + v * 1013 + (wy * win + wx) * 4099 + LL * 77 + size), size / TILE, LL); ctx.restore(); }
    tiles.push(c);
  }
  return { tiles, win };
};
const tileSet = (id, size, L) => { const key = setKey(id, size, L); let s = tileSets.get(key); if (!s) { s = buildSet(id, size, L); tileSets.set(key, s); } return s; };
const tileAt = (set, x, y, v) => { const w = set.win; return set.tiles[((((y % w) + w) % w) * w + (((x % w) + w) % w)) * VARIANTS + v]; };

/* ── edge masks, decals, shore lines, wall shading ── */
const SIDES = [[0, -1], [1, 0], [0, 1], [-1, 0]], CORNERS = [[1, -1], [1, 1], [-1, 1], [-1, -1]];
const maskCache = new Map(), decalCache = new Map(), foamCache = new Map(), shadeCache = new Map();
const edgeDepth = (t, mv, style, size) => { const D = size * (style === 'hard' ? 0.17 : 0.2), nn = pn1(t, 3, 4000 + mv * 17) * 0.6 + pn1(t, 6, 4100 + mv * 17) * 0.4; return D * clamp(0.9 + (nn - 0.5) * 1.9, 0.3, 1.6); };
const edgeCoords = (side, x, y, size) => side === 0 ? [(x + 0.5) / size, y + 0.5] : side === 1 ? [(y + 0.5) / size, size - x - 0.5] : side === 2 ? [(x + 0.5) / size, size - y - 0.5] : [(y + 0.5) / size, x + 0.5];
const maskOf = (side, mv, style, size) => {
  const key = side + '|' + mv + '|' + style + '|' + size, hit = maskCache.get(key); if (hit) return hit;
  const c = U.canvas(size, size), ctx = c.getContext('2d'), img = ctx.createImageData(size, size), px = img.data, k = size / TILE;
  const w = style === 'hard' ? 1.1 * k : 4.5 * k, G = (style === 'hard' ? 3 : 2.4) * k, seed = 5000 + mv * 17 + (style === 'hard' ? 5 : 0), P = Math.max(4, Math.round(size / (3 * k)));
  const corner = side >= 4, cxp = corner ? (CORNERS[side - 4][0] > 0 ? size : 0) : 0, cyp = corner ? (CORNERS[side - 4][1] > 0 ? size : 0) : 0;
  for (let y = 0, i = 3; y < size; y++) for (let x = 0; x < size; x++, i += 4) {
    let t, q;
    if (corner) { const dx = x + 0.5 - cxp, dy = y + 0.5 - cyp; q = Math.sqrt(dx * dx + dy * dy); t = (Math.atan2(Math.abs(dy), Math.abs(dx)) / (PI / 2)) * 0.5; }
    else { const e = edgeCoords(side, x, y, size); t = e[0]; q = e[1]; }
    const depth = edgeDepth(t, mv, style, size) * (corner ? 0.85 : 1) + (pnoise(x / (3 * k), y / (3 * k), P, P, seed + 9) - 0.5) * 2 * G;
    let a = smooth((depth - q) / w + 0.5);
    if (style !== 'hard' && a > 0 && a < 1) a = clamp(a + (pnoise(x / k, y / k, size, size, seed + 13) - 0.5) * 0.7);
    px[i] = a * 255;
  }
  ctx.putImageData(img, 0, 0); maskCache.set(key, c); return c;
};
const edgeDecal = (id, side, mv, size, L) => {
  const d = defOf(id, L), key = setKey(id, size, L) + '|' + side + '|' + mv, hit = decalCache.get(key); if (hit) return hit;
  const c = U.canvas(size, size), ctx = c.getContext('2d');
  ctx.drawImage(tileSet(id, size, L).tiles[mv % VARIANTS], 0, 0);
  ctx.globalCompositeOperation = 'destination-in'; ctx.drawImage(maskOf(side, mv, d.wall ? 'hard' : 'soft', size), 0, 0);
  decalCache.set(key, c); return c;
};
const FOAM = { foam: { col: rgb('#ece7dc'), a: 0.6, w: 2.2, off: 1.6, dim: 0 }, foam_dim: { col: rgb('#c9d2d6'), a: 0.35, w: 2, off: 1.4, dim: 0 }, glow: { col: rgb('#f4a44c'), a: 0.4, w: 5, off: 0, dim: 1 } };
const foamDecal = (kind, side, mv, size) => {
  const key = kind + '|' + side + '|' + mv + '|' + size, hit = foamCache.get(key); if (hit) return hit;
  const c = U.canvas(size, size), ctx = c.getContext('2d'), img = ctx.createImageData(size, size), px = img.data, k = size / TILE, f = FOAM[kind] || FOAM.foam, P = Math.max(4, Math.round(size / (2 * k)));
  for (let y = 0, i = 0; y < size; y++) for (let x = 0; x < size; x++, i += 4) {
    const e = edgeCoords(side, x, y, size), q = e[1] - edgeDepth(e[0], mv, 'soft', size) - f.off * k;
    let a;
    if (f.dim) { a = q < -3 * k ? 0 : Math.exp(-(q * q) / (2 * (f.w * k) * (f.w * k))) * f.a; a += Math.exp(-((q - 0.8 * k) * (q - 0.8 * k)) / (2 * k * k)) * 0.22; }
    else { const br = clamp((pnoise(x / (2 * k), y / (2 * k), P, P, 7000 + mv) - 0.28) * 1.7); a = Math.exp(-(q * q) / (2 * (f.w * k) * (f.w * k))) * f.a * br; }
    px[i] = f.col[0]; px[i + 1] = f.col[1]; px[i + 2] = f.col[2]; px[i + 3] = clamp(a) * 255;
  }
  ctx.putImageData(img, 0, 0); foamCache.set(key, c); return c;
};
const shadeDecal = (side, size) => {
  const key = side + '|' + size, hit = shadeCache.get(key); if (hit) return hit;
  const c = U.canvas(size, size), ctx = c.getContext('2d'), D = size * 0.34;
  let g;
  if (side < 4) { const s = SIDES[side]; g = ctx.createLinearGradient(s[0] > 0 ? size : 0, s[1] > 0 ? size : 0, s[0] > 0 ? size - D : s[0] < 0 ? D : 0, s[1] > 0 ? size - D : s[1] < 0 ? D : 0); }
  else { const cc = CORNERS[side - 4], cx = cc[0] > 0 ? size : 0, cy = cc[1] > 0 ? size : 0; g = ctx.createRadialGradient(cx, cy, 0, cx, cy, D); }
  g.addColorStop(0, 'rgba(0,0,0,.42)'); g.addColorStop(0.5, 'rgba(0,0,0,.16)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size); shadeCache.set(key, c); return c;
};

/* ── macro variation: world-aligned low-frequency mottling drawn over a chunk so the 48 px grid never reads ── */
const macroCache = new Map();
const macroCanvas = L => {
  const hit = macroCache.get(L); if (hit) return hit;
  const N = 128, c = U.canvas(N, N), ctx = c.getContext('2d'), img = ctx.createImageData(N, N), px = img.data, S = 800 + L * 37;
  for (let y = 0, i = 0; y < N; y++) for (let x = 0; x < N; x++, i += 4) {
    const u = (x + 0.5) / N, v = (y + 0.5) / N;
    const m = pfbm(u, v, 2, S, 4, 0.55) * 0.7 + pfbm(u, v, 5, S + 9, 3) * 0.3;
    const g = 128 + (m - 0.5) * 150;
    px[i] = g; px[i + 1] = g; px[i + 2] = g; px[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); macroCache.set(L, c); return c;
};

/* ── deposit overlays (ore nuggets, crystals, seams, stained ground) tinted by the item colour ── */
const depCache = new Map(), markerCache = new Map();
const DEP_FALLBACK = { coal: '#2a2a2e', iron_ore: '#8a6a52', copper_ore: '#b07a4a', tin_ore: '#b0b0a6', zinc_ore: '#9aa3a8', lead_ore: '#6a6f7a', silver_ore: '#c9cdd2', gold_ore: '#d2b054', nickel_ore: '#a09a80', quartz: '#d8dce0', amethyst: '#9a7fc0', bauxite: '#b3705a', chromite: '#5f6a66', manganese_ore: '#7a6a7a', limestone: '#c4bda8', sulfur: '#d3c04a', saltpeter: '#d6d2c4', salt: '#e6e2d8', peat: '#4a3d2c', crude_oil: '#1a1612', natural_gas: '#9fb3b8', rutile: '#7a4a3a', wolframite: '#3a3a44', platinum_ore: '#c9cbd4', cobalt_ore: '#4a5ea6', spodumene: '#b8a8c8', molybdenite: '#6f7482', vanadinite: '#c25a2a', monazite: '#8a6a3a', uraninite: '#3a4a3a', thorite: '#4a3a2a', diamond_raw: '#e2eef2', ruby_raw: '#c03a4a', sapphire_raw: '#3a5ac0', obsidian: '#1c1c22', basalt: '#3a3634', iridium_ore: '#b9c2c8', osmium_ore: '#6a7a88', corestone: '#7a3a2a', plasma_crystal: '#4fc3d6', neutronium_ore: '#3a2a5a', magma: '#e0742e', deuterium_brine: '#5a8aa0', helium3: '#bfe8f0' };
const depStyle = (res, item) => {
  const cat = item && item.cat;
  if (res === 'coal') return 'coal';
  if (cat === 'crystal' || /quartz|amethyst|diamond|ruby|sapphire|crystal/.test(res)) return 'crystal';
  if (res === 'magma') return 'magma';
  if (res === 'helium3') return 'vent';
  if (cat === 'gas' || /gas$/.test(res)) return 'gas';
  if (cat === 'fluid' || /oil|brine/.test(res)) return 'fluid';
  if (/obsidian|basalt|corestone|neutronium|wolframite/.test(res)) return 'dark';
  if (/sulfur|salt|saltpeter|limestone|peat|clay|sand|gravel|stone/.test(res)) return 'lump';
  return 'ore';
};
const depositOverlay = (res, size = TILE, variant = 0, rich = 1) => {
  const key = res + '|' + size + '|' + variant + '|' + rich, hit = depCache.get(key); if (hit) return hit;
  const item = LD.Registry && LD.Registry.item ? LD.Registry.item(res) : null;
  const col = rgb((item && item.color) || DEP_FALLBACK[res] || '#8f8b82'), col2 = rgb((item && item.color2) || U.shade((item && item.color) || DEP_FALLBACK[res] || '#8f8b82', 0.6));
  const style = depStyle(res, item), c = U.canvas(size, size), ctx = c.getContext('2d'), k = size / TILE, s = size, R = U.rng(U.hashStr(res) + variant * 7919 + rich * 13);
  const rock = mixc(col, rgb('#6e6a64'), 0.35);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (style === 'ore' || style === 'lump') {
    const n = rich ? R.int(5, 7) : R.int(2, 3);
    for (let i = 0; i < R.int(1, 2) + (rich ? 1 : 0); i++) { const [x, y] = rpos(R, s, 8 * k), a = R() * TAU, L = (9 + R() * 8) * k; ctx.strokeStyle = css(col, 0.55); ctx.lineWidth = 1.3 * k; ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * L / 2, y - Math.sin(a) * L / 2); ctx.quadraticCurveTo(x + (R() - 0.5) * 6 * k, y + (R() - 0.5) * 6 * k, x + Math.cos(a) * L / 2, y + Math.sin(a) * L / 2); ctx.stroke(); }
    for (let i = 0; i < n; i++) {
      const r = (2.2 + R() * 2) * k, [x, y] = rpos(R, s, r + 2 * k);
      if (style === 'lump') { blobPath(ctx, x, y, r, R, 0.3, 8); ctx.fillStyle = css(mixc(col, rgb('#7a7468'), 0.15)); ctx.fill(); ctx.strokeStyle = css(col2, 0.7); ctx.lineWidth = 0.8 * k; ctx.stroke(); }
      else {
        blobPath(ctx, x, y, r, R, 0.55, 7); ctx.fillStyle = css(rock); ctx.fill();
        ctx.save(); ctx.clip(); ctx.strokeStyle = css(col, 0.9); ctx.lineWidth = 1.1 * k; for (let j = 0; j < 2; j++) { const a = R() * TAU; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); ctx.quadraticCurveTo(x + (R() - 0.5) * r, y + (R() - 0.5) * r, x - Math.cos(a + 0.6) * r, y - Math.sin(a + 0.6) * r); ctx.stroke(); } ctx.restore();
        blobPath(ctx, x, y, r, R, 0.55, 7); ctx.strokeStyle = css(scalec(col2, 0.8), 0.9); ctx.lineWidth = 0.9 * k; ctx.stroke();
      }
      glint(ctx, x - r * 0.35, y - r * 0.35, r * 0.28, '#ffffff', 0.22);
    }
  } else if (style === 'coal') {
    patch(ctx, s, R, k, '#0a0a0c', 0.45, 12);
    for (let i = 0; i < (rich ? R.int(4, 6) : R.int(2, 3)); i++) { const r = (2 + R() * 2.4) * k, [x, y] = rpos(R, s, r + 2 * k); rockChunk(ctx, x, y, r, R, k, '#34353b', '#19191c'); ctx.strokeStyle = 'rgba(160,165,180,.5)'; ctx.lineWidth = 0.7 * k; ctx.beginPath(); ctx.moveTo(x - r * 0.5, y - r * 0.35); ctx.lineTo(x + r * 0.15, y - r * 0.55); ctx.stroke(); }
  } else if (style === 'dark') {
    const glowc = /neutronium/.test(res) ? '#7a5fd0' : /corestone/.test(res) ? '#e0742e' : null;
    if (glowc) patch(ctx, s, R, k, glowc, 0.3, 12);
    for (let i = 0; i < (rich ? R.int(4, 6) : R.int(2, 3)); i++) { const [x, y] = rpos(R, s, 6 * k), a = R() * TAU, l = (3 + R() * 3.5) * k; poly(ctx, [[x + Math.cos(a) * l, y + Math.sin(a) * l], [x + Math.cos(a + 1.9) * l * 0.8, y + Math.sin(a + 1.9) * l * 0.8], [x + Math.cos(a + 3.6) * l * 0.7, y + Math.sin(a + 3.6) * l * 0.7], [x + Math.cos(a + 5) * l * 0.6, y + Math.sin(a + 5) * l * 0.6]]); ctx.fillStyle = css(col); ctx.fill(); ctx.strokeStyle = css(mixc(col, WHITE, 0.4), 0.7); ctx.lineWidth = 0.7 * k; ctx.stroke(); glint(ctx, x, y, 0.7 * k, glowc || '#ffffff', 0.5); }
  } else if (style === 'crystal') {
    const [cx, cy] = rpos(R, s, 14 * k), g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 15 * k); g.addColorStop(0, css(col, 0.3)); g.addColorStop(1, css(col, 0)); ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < (rich ? R.int(3, 5) : 2); i++) crystal(ctx, cx + (R() - 0.5) * 9 * k, cy + (R() - 0.5) * 9 * k, (8 + R() * 6) * k, (2.2 + R() * 1.4) * k, R() * TAU, css(col), R, k, true);
  } else if (style === 'fluid' || style === 'gas') {
    const gas = style === 'gas', st = gas ? mixc(col, WHITE, 0.25) : mixc(col, BLACK, 0.55);
    const [x, y] = rpos(R, s, 13 * k); blobPath(ctx, x, y, (11 + R() * 3) * k, R, 0.4, 9); ctx.fillStyle = css(st, gas ? 0.22 : 0.55); ctx.fill();
    if (!gas) { ctx.strokeStyle = css(mixc(col, WHITE, 0.3), 0.25); ctx.lineWidth = 1.2 * k; ctx.beginPath(); ctx.moveTo(x - 5 * k, y - 2 * k); ctx.quadraticCurveTo(x, y - 4 * k, x + 4 * k, y - 1.5 * k); ctx.stroke(); }
    for (let i = 0; i < (rich ? R.int(4, 7) : R.int(2, 3)); i++) { const r = (0.9 + R() * 1.6) * k, bx = x + (R() - 0.5) * 16 * k, by = y + (R() - 0.5) * 16 * k; ctx.strokeStyle = css(mixc(col, WHITE, 0.3), 0.8); ctx.lineWidth = 0.8 * k; ctx.beginPath(); ctx.arc(bx, by, r, 0, TAU); ctx.stroke(); glint(ctx, bx - r * 0.3, by - r * 0.3, r * 0.3, '#ffffff', 0.5); }
    if (gas) for (let i = 0; i < 3; i++) { const wx = x + (R() - 0.5) * 12 * k, wy = y + (R() - 0.5) * 12 * k; ctx.strokeStyle = css(mixc(col, WHITE, 0.4), 0.4); ctx.lineWidth = 0.8 * k; ctx.beginPath(); ctx.moveTo(wx - 4 * k, wy); ctx.bezierCurveTo(wx - 1 * k, wy - 4 * k, wx + 1 * k, wy + 4 * k, wx + 4 * k, wy); ctx.stroke(); }
  } else if (style === 'magma') {
    for (let i = 0; i < (rich ? 3 : 2); i++) { const [x, y] = rpos(R, s, 8 * k), r = (4 + R() * 3) * k; blobPath(ctx, x, y, r + 1.5 * k, R, 0.5, 8); ctx.fillStyle = '#1e1412'; ctx.fill(); const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, '#f6c46a'); g.addColorStop(0.45, '#e0742e'); g.addColorStop(1, 'rgba(120,40,20,0)'); blobPath(ctx, x, y, r, R, 0.5, 8); ctx.fillStyle = g; ctx.fill(); }
  } else if (style === 'vent') {
    const cx = s / 2 + (R() - 0.5) * 8 * k, cy = s / 2 + (R() - 0.5) * 8 * k, r = (5 + R() * 2) * k;
    let g = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 2.6); g.addColorStop(0, css(col, 0.4)); g.addColorStop(1, css(col, 0)); ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = '#0d0b0b'; ctx.lineWidth = 1.1 * k; for (let i = 0; i < 6; i++) { const a = R() * TAU, l = r + (4 + R() * 5) * k; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8); ctx.lineTo(cx + Math.cos(a + 0.2) * Math.min(l, s / 2 - 2 * k), cy + Math.sin(a + 0.2) * Math.min(l, s / 2 - 2 * k)); ctx.stroke(); }
    ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.8, R() * PI, 0, TAU); ctx.fillStyle = '#0b0a0c'; ctx.fill(); ctx.strokeStyle = css(col, 0.55); ctx.lineWidth = 0.8 * k; ctx.stroke();
    g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, css(mixc(col, WHITE, 0.4), 0.6)); g.addColorStop(1, css(col, 0)); ctx.fillStyle = g; ctx.fill();
  }
  depCache.set(key, c); return c;
};
const infMarker = size => {
  const hit = markerCache.get(size); if (hit) return hit;
  const c = U.canvas(size, size), ctx = c.getContext('2d'), r = size * 0.4, cx = size / 2, cy = size / 2;
  ctx.strokeStyle = 'rgba(236,231,220,.24)'; ctx.lineWidth = Math.max(1, size / 48);
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(cx, cy, r, i * PI / 2 + 0.18, (i + 1) * PI / 2 - 0.18); ctx.stroke(); }
  for (let i = 0; i < 4; i++) { const a = i * PI / 2; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (r - size * 0.05), cy + Math.sin(a) * (r - size * 0.05)); ctx.lineTo(cx + Math.cos(a) * (r + size * 0.05), cy + Math.sin(a) * (r + size * 0.05)); ctx.stroke(); }
  markerCache.set(size, c); return c;
};

/* ── trees: top-down canopy clusters, 3 growth stages ── */
const treeCache = new Map();
const treeSprite = (size, v, stage) => {
  const key = size + '|' + v + '|' + stage, hit = treeCache.get(key); if (hit) return hit;
  const c = U.canvas(size, size), ctx = c.getContext('2d'), k = size / TILE, R = U.rng(1234 + v * 77 + stage * 5), sc = stage === 0 ? 0.4 : stage === 1 ? 0.68 : 1;
  const cx = size / 2 + (R() - 0.5) * 5 * k, cy = size / 2 + (R() - 0.5) * 5 * k;
  ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(cx + 2.5 * k, cy + 3.5 * k, 12 * k * sc, 9 * k * sc, 0.2, 0, TAU); ctx.fill();
  if (stage === 0) { ctx.strokeStyle = '#4a3a2b'; ctx.lineWidth = 1.2 * k; ctx.beginPath(); ctx.moveTo(cx, cy + 4 * k); ctx.lineTo(cx, cy - 2 * k); ctx.stroke(); }
  ctx.fillStyle = '#3b2f24'; ctx.beginPath(); ctx.ellipse(cx, cy + 2 * k, 2.4 * k * sc + 0.6 * k, 1.8 * k * sc + 0.5 * k, 0, 0, TAU); ctx.fill();
  const nb = stage === 0 ? 1 : stage === 1 ? 2 : 3, cols = ['#3d5535', '#46603b', '#506a40'];
  const blobs = [];
  for (let b = 0; b < nb; b++) blobs.push([cx + (R() - 0.5) * 11 * k * sc, cy + (R() - 0.5) * 11 * k * sc, (7 + R() * 3) * k * sc, R.pick(cols)]);
  for (const [bx, by, r] of blobs) { blobPath(ctx, bx, by, r + 1.1 * k, R, 0.35, 9); ctx.fillStyle = '#2b3b27'; ctx.fill(); }
  for (const [bx, by, r, col] of blobs) {
    blobPath(ctx, bx, by, r, R, 0.35, 9); ctx.fillStyle = col; ctx.fill();
    ctx.save(); ctx.clip(); blobPath(ctx, bx - r * 0.3, by - r * 0.32, r * 0.72, R, 0.4, 8); ctx.fillStyle = 'rgba(112,142,82,.75)'; ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.18)'; blobPath(ctx, bx + r * 0.45, by + r * 0.45, r * 0.7, R, 0.4, 8); ctx.fill(); ctx.restore();
    for (let i = 0; i < 4; i++) { const a = R() * TAU, d = R() * r * 0.8; glint(ctx, bx + Math.cos(a) * d, by + Math.sin(a) * d, (0.8 + R() * 0.6) * k * sc + 0.3 * k, R.chance(0.6) ? '#7c9a58' : '#2f4229', 0.55); }
  }
  treeCache.set(key, c); return c;
};

/* ── chunk canvases (LRU by count and bytes) ── */
const chunkCache = new Map(); let cacheBytes = 0, quality = 'high';
const cachePut = (key, c) => {
  chunkCache.set(key, c); cacheBytes += c.width * c.height * 4;
  for (const [k, old] of chunkCache) { if (chunkCache.size <= CACHE_MAX && cacheBytes <= CACHE_BYTES) break; if (k === key) continue; chunkCache.delete(k); cacheBytes -= old.width * old.height * 4; }
};
const cacheDrop = prefix => { for (const [k, old] of chunkCache) if (k.startsWith(prefix)) { chunkCache.delete(k); cacheBytes -= old.width * old.height * 4; } };
const prioOf = id => { const d = TD[id]; return d ? d.prio : 5; };
const isWall = id => !!id && /_wall$/.test(id);
const shoreOf = id => { const d = TD[id]; return d ? d.shore : null; };
const mvOf = (x, y, side) => (H(x, y, 300 + side * 7) * 3) | 0;
const hatch = (ctx, w, spacing, color) => { ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.beginPath(); for (let d = -w; d < w; d += spacing) { ctx.moveTo(d, 0); ctx.lineTo(d + w, w); } ctx.stroke(); };
const drawRockFill = (ctx, L, x0, y0, size, n, nv) => {
  const wall = WALL_OF[L] || 'rock', set = tileSet(wall, size, L);
  for (let ty = 0; ty < n; ty++) for (let tx = 0; tx < n; tx++) ctx.drawImage(tileAt(set, x0 + tx, y0 + ty, (H(x0 + tx, y0 + ty, 977 + L * 13) * nv) | 0), tx * size, ty * size);
  ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(0, 0, n * size, n * size);
  hatch(ctx, n * size, Math.max(4, size / 4), 'rgba(236,231,220,.08)');
};
const drawMacro = (ctx, L, x0, y0, size, n) => {
  const M = macroCanvas(L), b = size / TILE, ms = 256 * b, W = n * size;
  const ox = (((x0 * TILE) % 256) + 256) % 256 * b, oy = (((y0 * TILE) % 256) + 256) % 256 * b;
  ctx.globalCompositeOperation = 'soft-light'; if (ctx.globalCompositeOperation !== 'soft-light') ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.6;
  for (let my = -oy; my < W; my += ms) for (let mx = -ox; mx < W; mx += ms) ctx.drawImage(M, mx, my, ms, ms);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
};
const chunkCanvas = (L, cx, cy, bucket = 1) => {
  const key = L + ':' + cx + ':' + cy + ':' + bucket, hit = chunkCache.get(key);
  if (hit) { chunkCache.delete(key); chunkCache.set(key, hit); return hit; }
  const World = LD.World, size = Math.max(4, Math.round(TILE * bucket)), WL = World && World.layers && World.layers[L];
  const n = (WL && WL.chunk) || CHUNK, c = U.canvas(n * size, n * size), ctx = c.getContext('2d', { alpha: false });
  const x0 = cx * n, y0 = cy * n, nv = quality === 'low' ? 3 : VARIANTS, low = quality === 'low';
  if (!WL || !World || typeof World.terrainAt !== 'function') { ctx.fillStyle = (TD[FLOOR_OF[L]] || TD.dirt).avg; ctx.fillRect(0, 0, n * size, n * size); return c; }
  if (L >= 1 && typeof World.isExcavated === 'function' && World.isExcavated(L, cx, cy) === false) { drawRockFill(ctx, L, x0, y0, size, n, nv); cachePut(key, c); return c; }
  const N = n + 2, ids = new Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) ids[j * N + i] = World.terrainAt(L, x0 + i - 1, y0 + j - 1) || null;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (ids[j * N + i] === null) { const ii = clamp(i, 1, n), jj = clamp(j, 1, n); ids[j * N + i] = L >= 1 ? WALL_OF[L] : (ids[jj * N + ii] || FLOOR_OF[L]); }
  for (let ty = 0; ty < n; ty++) for (let tx = 0; tx < n; tx++) {
    const id = ids[(ty + 1) * N + tx + 1];
    ctx.drawImage(tileAt(tileSet(TD[id] ? id : FLOOR_OF[L], size, L), x0 + tx, y0 + ty, (H(x0 + tx, y0 + ty, 977 + L * 13) * nv) | 0), tx * size, ty * size);
  }
  if (!low) for (let ty = 0; ty < n; ty++) for (let tx = 0; tx < n; tx++) {
    const a = ids[(ty + 1) * N + tx + 1], pa = prioOf(a), x = x0 + tx, y = y0 + ty, px = tx * size, py = ty * size, aw = isWall(a), sh = shoreOf(a);
    const nb = [ids[ty * N + tx + 1], ids[(ty + 1) * N + tx + 2], ids[(ty + 2) * N + tx + 1], ids[(ty + 1) * N + tx]];
    if (!aw) for (let s = 0; s < 4; s++) if (isWall(nb[s])) ctx.drawImage(shadeDecal(s, size), px, py);
    if (!aw) for (let ci = 0; ci < 4; ci++) { const d = ids[(ty + 1 + CORNERS[ci][1]) * N + tx + 1 + CORNERS[ci][0]]; if (isWall(d) && !isWall(nb[ci]) && !isWall(nb[(ci + 1) % 4])) ctx.drawImage(shadeDecal(4 + ci, size), px, py); }
    for (let s = 0; s < 4; s++) { const b = nb[s]; if (b && b !== a && prioOf(b) > pa) ctx.drawImage(edgeDecal(b, s, mvOf(x, y, s), size, L), px, py); }
    for (let ci = 0; ci < 4; ci++) { const d = ids[(ty + 1 + CORNERS[ci][1]) * N + tx + 1 + CORNERS[ci][0]]; if (d && d !== a && prioOf(d) > pa && nb[ci] !== d && nb[(ci + 1) % 4] !== d && !(prioOf(nb[ci]) > pa) && !(prioOf(nb[(ci + 1) % 4]) > pa)) ctx.drawImage(edgeDecal(d, 4 + ci, mvOf(x, y, 4 + ci), size, L), px, py); }
    if (sh) for (let s = 0; s < 4; s++) { const b = nb[s]; if (b && b !== a && !shoreOf(b)) ctx.drawImage(foamDecal(sh, s, mvOf(x, y, s), size), px, py); }
  }
  drawMacro(ctx, L, x0, y0, size, n);
  if (typeof World.depositAt === 'function') for (let ty = 0; ty < n; ty++) for (let tx = 0; tx < n; tx++) {
    const d = World.depositAt(L, x0 + tx, y0 + ty); if (!d || !d.res) continue;
    const inf = d.amt < 0 || d.amt === Infinity, rich = inf || !(d.max > 0) || d.amt / d.max >= 0.3 ? 1 : 0;
    ctx.drawImage(depositOverlay(d.res, size, (H(x0 + tx, y0 + ty, 41) * 3) | 0, rich), tx * size, ty * size);
    if (inf) ctx.drawImage(infMarker(size), tx * size, ty * size);
  }
  const hasTree = typeof World.treeAt === 'function';
  for (let ty = 0; ty < n; ty++) for (let tx = 0; tx < n; tx++) {
    let g = hasTree ? World.treeAt(L, x0 + tx, y0 + ty) : null;
    if ((g === null || g === undefined || g === false) && ids[(ty + 1) * N + tx + 1] === 'forest') g = 1;
    if (g === null || g === undefined || g === false) continue;
    ctx.drawImage(treeSprite(size, (H(x0 + tx, y0 + ty, 59) * 4) | 0, g < 0.3 ? 0 : g < 0.7 ? 1 : 2), tx * size, ty * size);
  }
  cachePut(key, c); return c;
};
const invalidate = (L, x, y) => {
  const World = LD.World, WL = World && World.layers && World.layers[L], n = (WL && WL.chunk) || CHUNK;
  const cx = Math.floor(x / n), cy = Math.floor(y / n), lx = x - cx * n, ly = y - cy * n;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if ((dx < 0 && lx > 0) || (dx > 0 && lx < n - 1) || (dy < 0 && ly > 0) || (dy > 0 && ly < n - 1)) continue;
    cacheDrop(L + ':' + (cx + dx) + ':' + (cy + dy) + ':');
  }
};
const invalidateLayer = L => cacheDrop(L + ':');

/* ── item icons: monoline, shaped by category, tinted by item colour ── */
const iconCache = new Map(), iconUrlCache = new Map();
const ICON_FALLBACK = { cat: 'raw', color: '#8f8b82', color2: '#5a5751' };
const ICONS = {
  raw(ctx, s, id) { const R = U.rng(U.hashStr(id)); ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU - 0.4, r = 6.5 + R() * 2.4; i ? ctx.lineTo(12 + Math.cos(a) * r, 12.5 + Math.sin(a) * r * 0.85) : ctx.moveTo(12 + Math.cos(a) * r, 12.5 + Math.sin(a) * r * 0.85); } ctx.closePath(); s.fill(); s.stroke(); s.hi(9, 9.5); },
  ore(ctx, s, id) { const R = U.rng(U.hashStr(id) + 3); ctx.beginPath(); for (let i = 0; i < 7; i++) { const a = i / 7 * TAU - 0.6, r = 7 + R() * 2.2; i ? ctx.lineTo(12 + Math.cos(a) * r, 12.5 + Math.sin(a) * r * 0.9) : ctx.moveTo(12 + Math.cos(a) * r, 12.5 + Math.sin(a) * r * 0.9); } ctx.closePath(); ctx.fillStyle = css(mixc(s.c1, rgb('#6f6b66'), 0.55)); ctx.fill(); ctx.save(); ctx.clip(); ctx.strokeStyle = css(s.c1); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(5, 9); ctx.quadraticCurveTo(12, 13, 15, 8); ctx.moveTo(8, 17); ctx.quadraticCurveTo(13, 14, 19, 16); ctx.stroke(); ctx.restore(); s.stroke(); s.hi(9, 9); },
  crushed(ctx, s) { const sh = [[5, 10, 9, 8, 8, 14], [11, 6, 16, 8, 13, 12], [10, 15, 17, 14, 14, 20]]; for (const p of sh) { ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[2], p[3]); ctx.lineTo(p[4], p[5]); ctx.closePath(); s.fill(); s.stroke(); } s.hi(12.5, 7.5, 1.2); },
  ingot(ctx, s) { ctx.beginPath(); ctx.moveTo(4, 17); ctx.lineTo(7.5, 10); ctx.lineTo(17, 10); ctx.lineTo(20.5, 17); ctx.closePath(); s.fill(); ctx.beginPath(); ctx.moveTo(7.5, 10); ctx.lineTo(10, 7); ctx.lineTo(19, 7); ctx.lineTo(17, 10); ctx.closePath(); ctx.fillStyle = css(mixc(s.c1, WHITE, 0.3)); ctx.fill(); ctx.beginPath(); ctx.moveTo(4, 17); ctx.lineTo(7.5, 10); ctx.lineTo(10, 7); ctx.lineTo(19, 7); ctx.lineTo(17, 10); ctx.lineTo(20.5, 17); ctx.closePath(); ctx.moveTo(7.5, 10); ctx.lineTo(17, 10); s.stroke(); },
  plate(ctx, s) { ctx.beginPath(); ctx.roundRect(4.5, 4.5, 15, 15, 2); s.fill(); s.stroke(); ctx.fillStyle = css(s.c2); ctx.beginPath(); ctx.arc(8, 8, 1.2, 0, TAU); ctx.arc(16, 16, 1.2, 0, TAU); ctx.fill(); s.hi(15, 7.5, 1.4); },
  rod(ctx, s) { ctx.save(); ctx.translate(12, 12); ctx.rotate(-PI / 4); ctx.beginPath(); ctx.roundRect(-8.5, -2.3, 17, 4.6, 2.3); s.fill(); s.stroke(); ctx.strokeStyle = css(mixc(s.c1, WHITE, 0.45), 0.8); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-6, -0.9); ctx.lineTo(5, -0.9); ctx.stroke(); ctx.restore(); },
  gear(ctx, s) { ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, a1 = a - 0.16, a2 = a + 0.16, b1 = a + 0.26, b2 = a + TAU / 8 - 0.26; ctx.lineTo(12 + Math.cos(a1) * 9.5, 12 + Math.sin(a1) * 9.5); ctx.lineTo(12 + Math.cos(a2) * 9.5, 12 + Math.sin(a2) * 9.5); ctx.lineTo(12 + Math.cos(b1) * 7, 12 + Math.sin(b1) * 7); ctx.lineTo(12 + Math.cos(b2) * 7, 12 + Math.sin(b2) * 7); } ctx.closePath(); ctx.moveTo(15, 12); ctx.arc(12, 12, 3, 0, TAU, true); s.fill('evenodd'); s.stroke(); },
  wire(ctx, s) { const sp = () => { ctx.beginPath(); for (let i = 0; i <= 60; i++) { const t = i / 60, a = t * TAU * 2.4 - PI / 2, r = 2 + t * 7.5; i ? ctx.lineTo(12 + Math.cos(a) * r, 12 + Math.sin(a) * r) : ctx.moveTo(12 + Math.cos(a) * r, 12 + Math.sin(a) * r); } ctx.lineTo(21, 4.5); }; ctx.strokeStyle = css(s.c2); ctx.lineWidth = 3.2; sp(); ctx.stroke(); ctx.strokeStyle = css(s.c1); ctx.lineWidth = 1.7; sp(); ctx.stroke(); },
  part(ctx, s) { ctx.strokeStyle = css(s.c1); ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(6, 4.5); ctx.lineTo(6, 19); ctx.lineTo(19.5, 19); ctx.stroke(); ctx.strokeStyle = css(s.c2); ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(4.7, 4.5); ctx.lineTo(4.7, 20.3); ctx.lineTo(19.5, 20.3); ctx.stroke(); ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; ctx.lineTo(14 + Math.cos(a) * 3.4, 9.5 + Math.sin(a) * 3.4); } ctx.closePath(); s.fill(); s.stroke(); ctx.fillStyle = css(s.c2); ctx.beginPath(); ctx.arc(14, 9.5, 1.1, 0, TAU); ctx.fill(); },
  component(ctx, s) { ctx.beginPath(); ctx.roundRect(5.5, 7, 13, 9, 1.5); s.fill(); s.stroke(); ctx.strokeStyle = css(s.c2); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(9, 16); ctx.lineTo(9, 20); ctx.moveTo(15, 16); ctx.lineTo(15, 20); ctx.moveTo(9, 7); ctx.lineTo(9, 4); ctx.moveTo(15, 7); ctx.lineTo(15, 4); ctx.stroke(); ctx.fillStyle = css(s.c2); ctx.beginPath(); ctx.arc(9, 11.5, 1.1, 0, TAU); ctx.arc(15, 11.5, 1.1, 0, TAU); ctx.fill(); },
  circuit(ctx, s) { ctx.beginPath(); ctx.rect(4, 5.5, 16, 13); s.fill(); s.stroke(); ctx.strokeStyle = css(s.c2); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(7.5, 9); ctx.lineTo(11.5, 9); ctx.lineTo(11.5, 15); ctx.lineTo(16.5, 15); ctx.moveTo(7.5, 15); ctx.lineTo(9, 15); ctx.moveTo(14.5, 9); ctx.lineTo(16.5, 9); ctx.stroke(); ctx.fillStyle = css(mixc(s.c1, WHITE, 0.55)); ctx.beginPath(); ctx.arc(7.5, 9, 1.3, 0, TAU); ctx.arc(16.5, 15, 1.3, 0, TAU); ctx.fill(); },
  fluid(ctx, s) { ctx.beginPath(); ctx.moveTo(12, 3.5); ctx.bezierCurveTo(12, 3.5, 5, 11.5, 5, 15); ctx.arc(12, 15, 7, PI, 0, true); ctx.bezierCurveTo(19, 11.5, 12, 3.5, 12, 3.5); ctx.closePath(); s.fill(); s.stroke(); s.hi(9, 14, 1.6); },
  gas(ctx, s) { const b = [[8, 14.5, 4.2], [15, 12, 5], [11, 7.5, 3]]; for (const [x, y, r] of b) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = css(s.c1, 0.6); ctx.fill(); s.stroke(); } s.hi(13.5, 9.5, 1.4); },
  chemical(ctx, s) { const f = () => { ctx.beginPath(); ctx.moveTo(10, 3.5); ctx.lineTo(14, 3.5); ctx.lineTo(14, 9.5); ctx.lineTo(19.5, 19); ctx.lineTo(4.5, 19); ctx.lineTo(10, 9.5); ctx.closePath(); }; f(); ctx.save(); ctx.clip(); ctx.fillStyle = css(s.c1); ctx.fillRect(0, 13, 24, 11); ctx.restore(); f(); s.stroke(); ctx.strokeStyle = css(s.c2); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(9, 3.5); ctx.lineTo(15, 3.5); ctx.stroke(); },
  fuel(ctx, s) { ctx.beginPath(); ctx.moveTo(12, 3); ctx.bezierCurveTo(15, 8, 18.5, 9.5, 18.5, 14.5); ctx.arc(12, 14.5, 6.5, 0, PI, false); ctx.bezierCurveTo(5.5, 9.5, 9, 8, 12, 3); ctx.closePath(); s.fill(); s.stroke(); ctx.fillStyle = css(mixc(s.c1, WHITE, 0.5), 0.8); ctx.beginPath(); ctx.moveTo(12, 10); ctx.bezierCurveTo(14.5, 13, 15, 14, 15, 16); ctx.arc(12, 16, 3, 0, PI); ctx.bezierCurveTo(9, 14, 9.5, 13, 12, 10); ctx.closePath(); ctx.fill(); },
  nuclear(ctx, s) { for (let i = 0; i < 3; i++) { const a = i * TAU / 3 - PI / 2; ctx.beginPath(); ctx.arc(12, 12, 9.5, a - 0.5, a + 0.5); ctx.arc(12, 12, 4, a + 0.5, a - 0.5, true); ctx.closePath(); s.fill(); s.stroke(); } ctx.beginPath(); ctx.arc(12, 12, 1.9, 0, TAU); s.fill(); s.stroke(); },
  crystal(ctx, s) { const p = [[12, 2.5], [18, 8], [17, 17], [12, 21.5], [7, 17], [6, 8]]; poly(ctx, p); s.fill(); s.stroke(); ctx.strokeStyle = css(mixc(s.c1, WHITE, 0.55), 0.85); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(12, 2.5); ctx.lineTo(7, 17); ctx.moveTo(12, 2.5); ctx.lineTo(17, 17); ctx.moveTo(6, 8); ctx.lineTo(18, 8); ctx.stroke(); ctx.strokeStyle = css(s.c2, 0.6); ctx.beginPath(); ctx.moveTo(7, 17); ctx.lineTo(17, 17); ctx.stroke(); },
  organic(ctx, s) { ctx.beginPath(); ctx.moveTo(4.5, 19.5); ctx.bezierCurveTo(4.5, 8, 12, 4.5, 20, 4.5); ctx.bezierCurveTo(20, 12.5, 16, 19.5, 4.5, 19.5); ctx.closePath(); s.fill(); s.stroke(); ctx.strokeStyle = css(s.c2); ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(5.5, 18.5); ctx.lineTo(17.5, 7); ctx.moveTo(9, 15); ctx.lineTo(9.5, 11); ctx.moveTo(12, 12); ctx.lineTo(13.5, 8.5); ctx.stroke(); },
  building(ctx, s) { ctx.beginPath(); ctx.rect(4, 6, 16, 12); s.fill(); s.stroke(); ctx.strokeStyle = css(s.c2); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(4, 12); ctx.lineTo(20, 12); ctx.moveTo(12, 6); ctx.lineTo(12, 12); ctx.moveTo(8, 12); ctx.lineTo(8, 18); ctx.moveTo(16, 12); ctx.lineTo(16, 18); ctx.stroke(); s.hi(7, 8.5, 1.2); },
  ammo(ctx, s) { ctx.beginPath(); ctx.moveTo(8, 20); ctx.lineTo(8, 10); ctx.arc(12, 10, 4, PI, 0); ctx.lineTo(16, 20); ctx.closePath(); s.fill(); s.stroke(); ctx.strokeStyle = css(s.c2); ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(8, 15); ctx.lineTo(16, 15); ctx.stroke(); s.hi(10.5, 9, 1.2); },
  science(ctx, s) { const f = () => { ctx.beginPath(); ctx.moveTo(10, 3); ctx.lineTo(14, 3); ctx.lineTo(14, 9.2); ctx.arc(12, 15, 6.3, -1.25, PI + 1.25, false); ctx.lineTo(10, 9.2); ctx.closePath(); }; f(); ctx.fillStyle = css(s.c1, 0.85); ctx.fill(); ctx.save(); ctx.clip(); ctx.strokeStyle = css(s.c2, 0.5); ctx.lineWidth = 0.6; ctx.beginPath(); for (let g = 3; g < 24; g += 3) { ctx.moveTo(g, 0); ctx.lineTo(g, 24); ctx.moveTo(0, g); ctx.lineTo(24, g); } ctx.stroke(); ctx.restore(); f(); s.stroke(); ctx.strokeStyle = css(s.c2); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(9, 3); ctx.lineTo(15, 3); ctx.stroke(); },
  exotic(ctx, s) { ctx.strokeStyle = css(s.c1, 0.55); ctx.lineWidth = 0.9; ctx.setLineDash([1.6, 1.6]); ctx.beginPath(); ctx.arc(12, 12, 9.8, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(12, 3); ctx.lineTo(14.2, 9.8); ctx.lineTo(21, 12); ctx.lineTo(14.2, 14.2); ctx.lineTo(12, 21); ctx.lineTo(9.8, 14.2); ctx.lineTo(3, 12); ctx.lineTo(9.8, 9.8); ctx.closePath(); s.fill(); s.stroke(); ctx.fillStyle = css(mixc(s.c1, WHITE, 0.7)); ctx.beginPath(); ctx.arc(12, 12, 1.6, 0, TAU); ctx.fill(); }
};
const icon = (itemId, size = 24) => {
  const key = itemId + ':' + size, hit = iconCache.get(key); if (hit) return hit;
  const item = (LD.Registry && LD.Registry.item && LD.Registry.item(itemId)) || ICON_FALLBACK;
  const c = U.canvas(size, size), ctx = c.getContext('2d'), k = size / 24;
  const c1 = rgb(item.color || ICON_FALLBACK.color), c2 = scalec(rgb(item.color2 || U.shade(item.color || ICON_FALLBACK.color, 0.6)), 0.78);
  const s = { c1, c2, fill(rule) { ctx.fillStyle = css(c1); ctx.fill(rule || 'nonzero'); }, stroke() { ctx.strokeStyle = css(c2); ctx.lineWidth = 1.5; ctx.stroke(); }, hi(x, y, r = 1.8) { ctx.strokeStyle = css(mixc(c1, WHITE, 0.6), 0.65); ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(x, y, r, PI * 1.05, PI * 1.55); ctx.stroke(); } };
  ctx.scale(k, k); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  (ICONS[item.cat] || ICONS.raw)(ctx, s, itemId);
  iconCache.set(key, c); return c;
};
const iconDataUrl = (itemId, size = 24) => { const key = itemId + ':' + size; let u = iconUrlCache.get(key); if (!u) { u = icon(itemId, size).toDataURL(); iconUrlCache.set(key, u); } return u; };

/* ── generic grain and letterbox backdrops ── */
const noiseCanvas = (w, h, seed = 0, opts = {}) => {
  const { scale = 2, alpha = 1, color = '#000000', tile = false, oct = 2, contrast = 1 } = opts;
  const c = U.canvas(w, h), ctx = c.getContext('2d'), img = ctx.createImageData(c.width, c.height), px = img.data, col = rgb(color);
  const P = Math.max(2, Math.round(c.width / scale)), Q = Math.max(2, Math.round(c.height / scale));
  for (let y = 0, i = 0; y < c.height; y++) for (let x = 0; x < c.width; x++, i += 4) {
    let n = 0, a = 1, f = 1, nn = 0;
    for (let o = 0; o < oct; o++) { n += a * (tile ? pnoise(x / scale * f, y / scale * f, P * f, Q * f, seed + o * 101) : U.noise2(x / scale * f, y / scale * f, seed + o * 101)); nn += a; a *= 0.5; f *= 2; }
    px[i] = col[0]; px[i + 1] = col[1]; px[i + 2] = col[2]; px[i + 3] = clamp(0.5 + (n / nn - 0.5) * contrast) * alpha * 255;
  }
  ctx.putImageData(img, 0, 0); return c;
};
const backdropCache = {}, backdropCanvas = {};
const backdropTile = kind => {
  if (backdropCanvas[kind]) return backdropCanvas[kind];
  const N = 256, c = U.canvas(N, N), ctx = c.getContext('2d'), img = ctx.createImageData(N, N), px = img.data, S = kind === 'paper' ? 71 : 72;
  const base = rgb(kind === 'paper' ? '#ddd8cc' : '#0a0a0b');
  for (let y = 0, i = 0; y < N; y++) for (let x = 0; x < N; x++, i += 4) {
    const u = (x + 0.5) / N, v = (y + 0.5) / N;
    let col;
    if (kind === 'paper') {
      const f1 = pani(u, v, 128, 8, S + 1) - 0.5, f2 = pani(u, v, 8, 128, S + 2) - 0.5, mo = pfbm(u, v, 2, S + 3, 3) - 0.5, gr = pnoise(u * 128, v * 128, 128, 128, S + 4) - 0.5;
      let m = 1 + f1 * 0.045 + f2 * 0.04 + mo * 0.06 + gr * 0.07;
      if (H(x, y, S + 5) < 0.004) m -= 0.14;
      col = scalec(base, m);
    } else {
      const gr = pnoise(u * 128, v * 128, 128, 128, S + 4) - 0.5, mo = pfbm(u, v, 2, S + 3, 3) - 0.5;
      col = [base[0] + gr * 7 + mo * 4, base[1] + gr * 7 + mo * 4, base[2] + gr * 8 + mo * 5];
    }
    px[i] = clamp(col[0], 0, 255); px[i + 1] = clamp(col[1], 0, 255); px[i + 2] = clamp(col[2], 0, 255); px[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return backdropCanvas[kind] = c;
};
// PNG encoding is the expensive part (first encode can take >100 ms), so it happens lazily, once per kind
const backdrop = kind => { kind = kind === 'paper' ? 'paper' : 'ink'; return backdropCache[kind] || (backdropCache[kind] = backdropTile(kind).toDataURL()); };

/* ── public API ── */
const yieldFrame = () => new Promise(r => setTimeout(r, 0));
let initPromise = null;
const buildDecals = size => { for (let side = 0; side < 8; side++) for (let mv = 0; mv < 3; mv++) { maskOf(side, mv, 'soft', size); maskOf(side, mv, 'hard', size); for (const d of T) { edgeDecal(d.id, side, mv, size, d.layer); if (d.id === 'rubble') edgeDecal('rubble', side, mv, size, 2); } } for (const kind in FOAM) for (let side = 0; side < 4; side++) for (let mv = 0; mv < 3; mv++) foamDecal(kind, side, mv, size); for (let side = 0; side < 8; side++) shadeDecal(side, size); };
// other tile sizes are prepared in idle time after boot; at 96 px edge decals stay lazy (≈0.1 ms each) to save memory
const warm = async size => { for (const d of T) { tileSet(d.id, size, d.layer); if (d.id === 'rubble') tileSet('rubble', size, 2); await yieldFrame(); } if (size <= TILE) buildDecals(size); else for (let side = 0; side < 8; side++) for (let mv = 0; mv < 3; mv++) { maskOf(side, mv, 'soft', size); maskOf(side, mv, 'hard', size); } await yieldFrame(); for (let v = 0; v < 4; v++) for (let st = 0; st < 3; st++) treeSprite(size, v, st); };
const Tex = LD.Tex = {
  TILE, VARIANTS, ready: false, initMs: 0, terrains: TERRAIN_IDS,
  init(progressCb) {
    if (initPromise) return initPromise;
    return initPromise = (async () => {
      const t0 = performance.now(), cb = typeof progressCb === 'function' ? progressCb : () => {}, total = T.length + 3, prof = Tex.initProfile = {};
      let lastLayer = -1, tp = t0;
      const lap = name => { const now = performance.now(); prof[name] = (prof[name] || 0) + now - tp; tp = now; };
      for (let i = 0; i < T.length; i++) {
        const d = T[i];
        cb(i / total, 'GENERANDO TERRENO: ' + terrainName(d).toUpperCase());
        tileSet(d.id, TILE, d.layer); if (d.id === 'rubble') tileSet('rubble', TILE, 2);
        lap('tiles');
        if (d.layer !== lastLayer || i % 3 === 2) { lastLayer = d.layer; await yieldFrame(); tp = performance.now(); }
      }
      cb((T.length) / total, 'GENERANDO TRANSICIONES');
      buildDecals(TILE); lap('decals');
      await yieldFrame(); tp = performance.now();
      cb((T.length + 1) / total, 'GENERANDO RELIEVE');
      for (let L = 0; L < 5; L++) macroCanvas(L);
      for (let v = 0; v < 4; v++) for (let st = 0; st < 3; st++) treeSprite(TILE, v, st);
      lap('macro');
      await yieldFrame(); tp = performance.now();
      cb((T.length + 2) / total, 'GENERANDO FONDOS');
      backdropTile('paper'); backdropTile('ink'); lap('backdrop');
      const RL = LD.Registry && LD.Registry.layers || [];
      for (const Ld of RL) for (const dep of (Ld.deposits || [])) for (let v = 0; v < 3; v++) { depositOverlay(dep.res, TILE, v, 1); depositOverlay(dep.res, TILE, v, 0); }
      infMarker(TILE); lap('deposits');
      Tex.ready = true; Tex.initMs = performance.now() - t0;
      cb(1, 'TEXTURAS LISTAS');
      const idle = window.requestIdleCallback || (fn => setTimeout(fn, 400));
      idle(() => { warm(24).then(() => warm(96)).catch(() => {}); });
      return Tex;
    })();
  },
  tile(terrainId, variant = 0, size = TILE, layer, x = 0, y = 0) {
    const d = TD[terrainId], L = layer !== undefined ? layer : d ? d.layer : 0;
    const set = tileSet(d ? terrainId : FLOOR_OF[clamp(L | 0, 0, 4)], Math.max(4, size | 0), L);
    return tileAt(set, x | 0, y | 0, ((variant | 0) % VARIANTS + VARIANTS) % VARIANTS);
  },
  chunkCanvas, invalidate, invalidateLayer, icon, iconDataUrl, depositOverlay, noiseCanvas, backdrop, treeSprite, infMarker,
  terrainDef: id => TD[id] || null,
  terrainColor: id => (TD[id] || {}).avg || '#777770',
  terrainName: id => TD[id] ? terrainName(TD[id]) : id,
  cacheStats: () => ({ chunks: chunkCache.size, bytes: cacheBytes, tiles: tileSets.size, decals: decalCache.size, icons: iconCache.size }),
  clearCache() { chunkCache.clear(); cacheBytes = 0; }
};
Object.defineProperty(Tex, 'quality', { get: () => quality, set(v) { v = v === 'low' ? 'low' : 'high'; if (v !== quality) { quality = v; Tex.clearCache(); } }, enumerable: true });

/* ── visual self-test: ?textest renders every terrain, chunk type and icon category ── */
if (typeof location !== 'undefined' && /textest/.test(location.search)) {
  const run = async () => {
    const DIMS = [[256, 192], [128, 96], [128, 96], [112, 80], [96, 64]];
    if (!LD.World) {
      const pick = (L, x, y) => {
        const n = U.fbm(x / 9, y / 9, 11 + L, 4), n2 = U.fbm(x / 6, y / 6, 23 + L, 3), n3 = U.fbm(x / 5, y / 5, 37 + L, 3), n4 = U.noise2(x / 4, y / 4, 41 + L);
        if (L === 0) return n < 0.34 ? 'water' : n < 0.4 ? 'sand' : n2 > 0.62 ? 'forest' : n3 > 0.64 ? 'dirt' : n4 > 0.72 ? 'rock' : n3 < 0.34 ? (n4 > 0.5 ? 'clay' : 'bog') : n2 < 0.36 ? (n4 > 0.5 ? 'saltflat' : 'gravel') : 'grass';
        const wall = WALL_OF[L], floor = FLOOR_OF[L];
        const spec = [[], ['cave_water', 'rubble', 'coal_seam'], ['deep_water', 'rubble', 'crystal_floor'], ['magma', 'obsidian_floor', 'vent'], ['magma_sea', 'plasma_floor', 'void_crack']][L];
        return n > 0.62 ? wall : n < 0.3 ? spec[0] : n2 > 0.64 ? spec[1] : n3 > 0.66 ? spec[2] : floor;
      };
      const DEPS = ['iron_ore', 'copper_ore', 'coal', 'quartz', 'amethyst', 'crude_oil', 'natural_gas', 'sulfur', 'obsidian', 'neutronium_ore', 'magma', 'helium3', 'gold_ore', 'uraninite'];
      LD.World = { layers: DIMS.map(([w, h]) => ({ w, h, chunk: 16, cw: w / 16, ch: h / 16 })),
        terrainAt(L, x, y) { const WL = this.layers[L]; if (x < 0 || y < 0 || x >= WL.w || y >= WL.h) return null; if (!this.isExcavated(L, Math.floor(x / 16), Math.floor(y / 16))) return WALL_OF[L]; return pick(L, x, y); },
        isExcavated(L, cx, cy) { return L === 0 || cx === 0 || (cx === 1 && cy === 1); },
        depositAt(L, x, y) { const t = this.terrainAt(L, x, y); if (!t || /_wall$|water|magma|vent|void/.test(t)) return null; const h = H(x, y, 7 + L); if (h > 0.12) return null; const res = DEPS[(H(x, y, 99) * DEPS.length) | 0]; return { res, amt: H(x, y, 5) < 0.2 ? -1 : 100, max: 100, hardness: 1, fluid: false }; },
        treeAt(L, x, y) { if (L !== 0 || this.terrainAt(L, x, y) !== 'forest') return null; return H(x, y, 3); } };
    } else if (typeof LD.World.gen === 'function' && !(LD.World.layers && LD.World.layers[0]) && LD.State && typeof LD.State.blank === 'function') {
      // integrated build: generate a real world (no events) so chunk previews show the actual terrain, deposits and rock
      try {
        const G = LD.G || (LD.G = LD.State.blank({ name: 'textest', difficulty: 'normal', seed: 7 }));
        LD.World.gen(G);
        for (let L = 1; L < 5; L++) { if (G.layers && G.layers[L]) G.layers[L].unlocked = true; if (typeof LD.World.excavateStart === 'function') LD.World.excavateStart(L, true); }
      } catch (e) { console.error('[textest] world gen failed', e); }
    }
    if (LD.Registry && LD.Registry.items && !LD.Registry.items.size) {
      const cats = 'raw ore crushed ingot plate rod gear wire part component circuit fluid gas chemical fuel nuclear crystal organic building ammo science exotic'.split(' '), cols = ['#8f8b82', '#b07a4a', '#a8a49c', '#c9a227', '#7f8ea3', '#8fb87a', '#c9603b', '#b28cff', '#d9a441', '#7aa6c9', '#6fa8dc', '#4f8fa8', '#9fb3b8', '#8fb87a', '#e8823a', '#8fcf5a', '#9a7fc0', '#6a9a4a', '#a0785a', '#8f8b82', '#7aa6c9', '#a8f0f8'];
      cats.forEach((cat, i) => LD.Registry.items.set('test_' + cat, { id: 'test_' + cat, cat, color: cols[i], color2: U.shade(cols[i], 0.55), name: cat }));
    }
    await Tex.init();
    const root = U.el('div', { style: { position: 'absolute', left: '0', top: '0', width: '100%', minHeight: '100%', background: '#141416', color: '#ece7dc', font: '12px monospace', padding: '16px', zIndex: '1000' } });
    document.body.appendChild(root);
    const add = (label, node) => { root.appendChild(U.el('div', { style: { margin: '14px 0 4px', letterSpacing: '.14em', textTransform: 'uppercase', color: '#8f8b82' } }, label)); if (node) root.appendChild(node); };
    add('INIT ' + Tex.initMs.toFixed(0) + ' ms · ' + T.length + ' terrenos');
    for (let L = 0; L < 5; L++) {
      const row = U.el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-start' } });
      for (const d of T.filter(t => t.layer === L)) {
        const box = U.el('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' } });
        const strip = U.el('div', { style: { display: 'flex' } });
        for (let v = 0; v < VARIANTS; v++) strip.appendChild(Tex.tile(d.id, v, 48, L));
        box.appendChild(strip);
        const mosaic = U.canvas(144, 96), mctx = mosaic.getContext('2d');
        for (let y = 0; y < 2; y++) for (let x = 0; x < 3; x++) mctx.drawImage(Tex.tile(d.id, (H(x, y, 3) * 6) | 0, 48, L, x, y), x * 48, y * 48);
        box.appendChild(mosaic); box.appendChild(Tex.tile(d.id, 0, 96, L));
        box.appendChild(U.el('div', {}, d.id));
        row.appendChild(box);
      }
      add(layerName(L), row);
      const WL = LD.World.layers[L], ccx = WL && WL.ccx !== undefined ? WL.ccx : (L === 0 ? 3 : 0), ccy = WL && WL.ccy !== undefined ? WL.ccy : (L === 0 ? 2 : 0), cw = WL ? WL.cw : 8, chn = WL ? WL.ch : 6;
      const t0 = performance.now(), ch = chunkCanvas(L, ccx, ccy, 1), t1 = performance.now();
      const times = []; for (let i = 0; i < 4; i++) { const ta = performance.now(); chunkCanvas(L, Math.min(cw - 1, ccx + 1), Math.max(0, Math.min(chn - 1, ccy - 1 + i)), 1); times.push(performance.now() - ta); }
      const t2 = performance.now(), ch2 = chunkCanvas(L, ccx, ccy, 0.5), t3 = performance.now(), ch3 = chunkCanvas(L, 0, 0, 1), t4 = performance.now();
      const cr = U.el('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } }, [ch, ch2, L ? ch3 : null]);
      add('CHUNK L' + L + ' · bucket 1 frío: ' + (t1 - t0).toFixed(1) + ' ms · caliente: ' + times.map(t => t.toFixed(1)).join('/') + ' ms · bucket 0.5: ' + (t3 - t2).toFixed(1) + ' ms' + (L ? ' · sin excavar: ' + (t4 - t3).toFixed(1) + ' ms' : ''), cr);
      // seam check: the junction of four chunks at 100 % pixels for every bucket (chunk borders cross at the centre)
      const sr = U.el('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } });
      for (const b of [0.5, 1, 2]) {
        const n = (WL && WL.chunk) || CHUNK, px = n * Math.max(4, Math.round(TILE * b)), view = Math.min(512, px * 2), cv = U.canvas(view, view), cc = cv.getContext('2d');
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) cc.drawImage(chunkCanvas(L, ccx + dx, ccy + dy, b), view / 2 + (dx - 1) * px, view / 2 + (dy - 1) * px);
        cc.strokeStyle = 'rgba(232,64,28,.35)'; cc.setLineDash([2, 4]); cc.strokeRect(0.5, 0.5, view - 1, view - 1);
        cv.title = 'bucket ' + b; sr.appendChild(cv);
      }
      add('JUNTAS L' + L + ' · 4 chunks (' + ccx + ',' + ccy + ')-(' + (ccx + 1) + ',' + (ccy + 1) + ') · bucket 0.5 / 1 / 2', sr);
    }
    const ir = U.el('div', { style: { display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' } });
    for (const it of LD.Registry.items.values()) { const b = U.el('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' } }); b.appendChild(icon(it.id, 24)); b.appendChild(icon(it.id, 48)); b.appendChild(U.el('div', {}, it.cat)); ir.appendChild(b); if (ir.children.length > 40) break; }
    add('ICONOS', ir);
    const dr = U.el('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } });
    for (const res of Object.keys(DEP_FALLBACK)) { const cv = U.canvas(48, 48), cc = cv.getContext('2d'); cc.drawImage(Tex.tile('cave_floor', 0, 48, 1), 0, 0); cc.drawImage(depositOverlay(res, 48, 0, 1), 0, 0); dr.appendChild(cv); }
    add('DEPÓSITOS', dr);
    const br = U.el('div', { style: { display: 'flex', gap: '10px' } });
    for (const k of ['paper', 'ink']) br.appendChild(U.el('div', { style: { width: '256px', height: '256px', backgroundImage: 'url(' + backdrop(k) + ')' } }));
    add('FONDOS', br);
    window.__textest = { done: true };
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', () => run().catch(e => console.error(e))); else run().catch(e => console.error(e));
}
})();
