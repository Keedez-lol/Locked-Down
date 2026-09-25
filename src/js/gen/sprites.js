(() => {
'use strict';
const LD = window.LD, U = LD.U;
const TAU = Math.PI * 2, PI = Math.PI;
const S = LD.Sprites = {};
S.TIER_COLORS = ['#8f8b82', '#b08d57', '#7f8ea3', '#c9a227', '#6fa8dc', '#8fb87a', '#c9603b', '#b28cff'];
const INK = '#0c0c0d', INK3 = '#1c1c1f', INK5 = '#333338', BONE = '#ece7dc', BONE2 = '#c9c4b8', BONE3 = '#8f8b82', BONE4 = '#5a5751';
const VERM = '#e8401c', AMBER = '#d9a441', OKC = '#8fb87a', CYAN = '#7ad9e6', VIOLET = '#b28cff', SKY = '#6fa8dc', FIRE = '#e07a3a';
const TILE = 48, BUCKETS = [0.5, 0.75, 1, 1.5, 2, 3, 4, 6], CACHE_MAX = 6000, CACHE_BYTES = 192 * 1024 * 1024;
const rgba = (hex, a) => U.rgba(hex, a);

/* ── matte material palette: f fill, d dark (front faces), l light (top edges), e edge line ── */
const MAT = {
  wood: { f: '#8a7052', d: '#5c4a35', l: '#a58a66', e: '#3b3022' },
  wood2: { f: '#6c5842', d: '#493a2b', l: '#87715a', e: '#2e251b' },
  rope: { f: '#b3a585', d: '#7d735a', l: '#cfc3a4', e: '#4a4335' },
  leather: { f: '#7d5f45', d: '#553f2d', l: '#987a5d', e: '#33251a' },
  stone: { f: '#8f8b83', d: '#615e58', l: '#aaa69e', e: '#3a3834' },
  brick: { f: '#8f5d4b', d: '#63413a', l: '#a9756a', e: '#3b2824' },
  bronze: { f: '#a07c4b', d: '#6d5333', l: '#c29c66', e: '#3f301d' },
  copper: { f: '#b0764d', d: '#7a5034', l: '#cf9569', e: '#3f2a1c' },
  iron: { f: '#5d6168', d: '#3d4045', l: '#7b8089', e: '#1e2023' },
  steel: { f: '#8d939a', d: '#5f646a', l: '#adb3ba', e: '#2b2e32' },
  paint: { f: '#6d786c', d: '#49524a', l: '#8c9889', e: '#252a26' },
  titan: { f: '#9ca6ae', d: '#6a737a', l: '#bfc9d1', e: '#33393e' },
  concrete: { f: '#a9a59c', d: '#7b786f', l: '#c4c0b7', e: '#45433e' },
  quantum: { f: '#4b4859', d: '#2e2c39', l: '#6d6982', e: '#17161d' },
  glass: { f: '#6f8e99', d: '#4b6570', l: '#a9c6cf', e: '#2b3d44' },
  dark: { f: '#2a2b2e', d: '#161718', l: '#3d3f43', e: '#0c0c0d' },
  soil: { f: '#6b5a44', d: '#4a3d2d', l: '#85735a', e: '#2e261b' },
  sand: { f: '#b7a37a', d: '#8b7a58', l: '#d0bf98', e: '#5b5039' },
  water: { f: '#4f6f7f', d: '#37505d', l: '#6d8f9f', e: '#1f2e36' },
  grass: { f: '#6b7a4a', d: '#4a5633', l: '#87985f', e: '#2c3320' },
  leaf: { f: '#5f7a4b', d: '#3f5432', l: '#7f9a68', e: '#25301c' },
  bone: { f: '#d9d3c5', d: '#a8a293', l: '#ece7dc', e: '#5a5751' }
};
const TIER_MAT = [MAT.wood, MAT.brick, MAT.iron, MAT.steel, MAT.paint, MAT.titan, MAT.concrete, MAT.quantum];
const TIER_TRIM = [MAT.wood2, MAT.bronze, MAT.iron, MAT.steel, MAT.iron, MAT.titan, MAT.steel, MAT.quantum];
const tierMat = t => TIER_MAT[U.clamp(t | 0, 0, 7)];
const tierTrim = t => TIER_TRIM[U.clamp(t | 0, 0, 7)];

/* ── LRU canvas cache ── */
const cache = new Map();
let cacheBytes = 0;
function cacheGet(key) { const v = cache.get(key); if (v) { cache.delete(key); cache.set(key, v); } return v; }
function cacheSet(key, v) {
  const old = cache.get(key); if (old) { cacheBytes -= old.width * old.height * 4; cache.delete(key); }
  cache.set(key, v); cacheBytes += v.width * v.height * 4;
  while (cache.size > CACHE_MAX || cacheBytes > CACHE_BYTES) { const k = cache.keys().next().value, e = cache.get(k); cacheBytes -= e.width * e.height * 4; cache.delete(k); }
  return v;
}
const bucketFor = zoom => { for (let i = 0; i < BUCKETS.length; i++) if (BUCKETS[i] >= zoom - 1e-6) return BUCKETS[i]; return BUCKETS[BUCKETS.length - 1]; };

let noisePat = null;
function noisePattern(ctx) {
  if (noisePat) return noisePat;
  const n = 64, cv = U.canvas(n, n), g = cv.getContext('2d'), img = g.createImageData(n, n), d = img.data;
  for (let i = 0; i < n * n; i++) { const v = U.hash2(i % n, (i / n) | 0, 977) < 0.5 ? 0 : 255; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  return noisePat = ctx.createPattern(cv, 'repeat');
}

/* ── painter state: c = current context (scaled to sprite units), P = sprite params ── */
let c = null, P = null;
function begin(ctx, p) { const prev = [c, P]; c = ctx; P = p; return prev; }
function end(prev) { c = prev[0]; P = prev[1]; }
const hair = () => P.hair;

/* ── primitives (unit space, 48 units per tile) ── */
function fillR(x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }
function strokeR(x, y, w, h, col, lw) { c.strokeStyle = col; c.lineWidth = lw || P.hair; c.strokeRect(x, y, w, h); }
function line(x0, y0, x1, y1, col, lw) { c.strokeStyle = col; c.lineWidth = lw || P.hair; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
function path(pts, col, lw, close) { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); if (close) c.closePath(); c.strokeStyle = col; c.lineWidth = lw || P.hair; c.stroke(); }
function poly(pts, fill, edge, lw) { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } if (edge) { c.strokeStyle = edge; c.lineWidth = lw || P.hair; c.stroke(); } }
function circle(cx, cy, r, fill, edge, lw) { if (r <= 0) return; c.beginPath(); c.arc(cx, cy, r, 0, TAU); if (fill) { c.fillStyle = fill; c.fill(); } if (edge) { c.strokeStyle = edge; c.lineWidth = lw || P.hair; c.stroke(); } }
function ring(cx, cy, r, w, col) { if (r <= 0) return; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.strokeStyle = col; c.lineWidth = w; c.stroke(); }
function arcSeg(cx, cy, r, a0, a1, col, lw) { c.beginPath(); c.arc(cx, cy, r, a0, a1); c.strokeStyle = col; c.lineWidth = lw || P.hair; c.stroke(); }
function dot(x, y, r, col) { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
function ellipse(cx, cy, rx, ry, rot, fill, edge, lw) { c.beginPath(); c.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, TAU); if (fill) { c.fillStyle = fill; c.fill(); } if (edge) { c.strokeStyle = edge; c.lineWidth = lw || P.hair; c.stroke(); } }
const depthOf = h => Math.max(3, Math.round(h * 0.12));

/* 3/4 box: top face plus a darker front face of height d along the bottom */
function box(x, y, w, h, d, m) {
  if (d === undefined || d === null) d = depthOf(h);
  fillR(x, y + h - d, w, d, m.d);
  fillR(x, y, w, h - d, m.f);
  line(x + 0.6, y + 0.6, x + w - 0.6, y + 0.6, m.l, P.hair);
  line(x, y + h - d, x + w, y + h - d, m.e, P.hair);
  strokeR(x, y, w, h, m.e);
}
function plate(x, y, w, h, m) { fillR(x, y, w, h, m.f); line(x + 0.6, y + 0.6, x + w - 0.6, y + 0.6, m.l); strokeR(x, y, w, h, m.e); }
function rivets(x, y, w, h, inset, step, m) {
  const r = Math.max(0.55, P.hair * 0.55);
  const put = (px, py) => { dot(px + 0.25, py + 0.25, r, m.e); dot(px - 0.2, py - 0.2, r * 0.7, m.l); };
  const nx = Math.max(1, Math.round((w - 2 * inset) / step)), ny = Math.max(1, Math.round((h - 2 * inset) / step));
  for (let i = 0; i <= nx; i++) { const px = x + inset + (w - 2 * inset) * i / nx; put(px, y + inset); put(px, y + h - inset); }
  for (let j = 1; j < ny; j++) { const py = y + inset + (h - 2 * inset) * j / ny; put(x + inset, py); put(x + w - inset, py); }
}
function seamH(x, y, w, m) { line(x, y, x + w, y, m.e); line(x, y + P.hair, x + w, y + P.hair, rgba(m.l, 0.55)); }
function seamV(x, y, h, m) { line(x, y, x, y + h, m.e); line(x + P.hair, y, x + P.hair, y + h, rgba(m.l, 0.55)); }
function hatch(x, y, w, h, sw, c1, c2) {
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  fillR(x, y, w, h, c1 || AMBER); c.fillStyle = c2 || INK3;
  for (let i = -h; i < w + h; i += sw * 2) { c.beginPath(); c.moveTo(x + i, y + h); c.lineTo(x + i + h, y); c.lineTo(x + i + h + sw, y); c.lineTo(x + i + sw, y + h); c.closePath(); c.fill(); }
  c.restore(); strokeR(x, y, w, h, INK3);
}
function stripe(x, y, w, h, col) { fillR(x, y, w, h, col || P.A); }
function pipe(x0, y0, x1, y1, r, m, fl) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  c.lineCap = 'butt';
  line(x0, y0, x1, y1, m.e, r * 2 + P.hair * 2);
  line(x0, y0, x1, y1, m.f, r * 2);
  line(x0 + nx * r * 0.45, y0 + ny * r * 0.45, x1 + nx * r * 0.45, y1 + ny * r * 0.45, m.l, Math.max(P.hair, r * 0.3));
  line(x0 - nx * r * 0.55, y0 - ny * r * 0.55, x1 - nx * r * 0.55, y1 - ny * r * 0.55, rgba(m.d, 0.8), Math.max(P.hair, r * 0.3));
  if (fl) { const ux = dx / L, uy = dy / L; flange(x0 + ux * r * 0.8, y0 + uy * r * 0.8, nx, ny, r, m); flange(x1 - ux * r * 0.8, y1 - uy * r * 0.8, nx, ny, r, m); }
}
function flange(x, y, nx, ny, r, m) { const e = r * 1.5, w = Math.max(1.2, r * 0.8); line(x - nx * e, y - ny * e, x + nx * e, y + ny * e, m.e, w + P.hair * 2); line(x - nx * e, y - ny * e, x + nx * e, y + ny * e, m.l, w); }
function gear(cx, cy, r, n, ang, m, hub) {
  const ri = r * 0.8, q = TAU / n;
  c.beginPath();
  for (let i = 0; i < n; i++) {
    const a = ang + i * q;
    c.lineTo(cx + Math.cos(a) * ri, cy + Math.sin(a) * ri); c.lineTo(cx + Math.cos(a + q * 0.12) * r, cy + Math.sin(a + q * 0.12) * r);
    c.lineTo(cx + Math.cos(a + q * 0.42) * r, cy + Math.sin(a + q * 0.42) * r); c.lineTo(cx + Math.cos(a + q * 0.54) * ri, cy + Math.sin(a + q * 0.54) * ri);
  }
  c.closePath(); c.fillStyle = m.f; c.fill(); c.strokeStyle = m.e; c.lineWidth = P.hair; c.stroke();
  if (r > 5) { ring(cx, cy, r * 0.5, Math.max(P.hair, r * 0.1), m.d); for (let i = 0; i < 4; i++) { const a = ang + i * PI / 2 + PI / 4; line(cx + Math.cos(a) * r * 0.2, cy + Math.sin(a) * r * 0.2, cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55, m.d, Math.max(P.hair, r * 0.12)); } }
  circle(cx, cy, Math.max(1, r * (hub || 0.16)), m.d, m.e);
}
function wheel(cx, cy, r, n, ang, m, rw) {
  rw = rw || Math.max(1.5, r * 0.18);
  ring(cx, cy, r - rw / 2, rw + P.hair * 2, m.e); ring(cx, cy, r - rw / 2, rw, m.f);
  for (let i = 0; i < n; i++) { const a = ang + i * TAU / n; line(cx, cy, cx + Math.cos(a) * (r - rw), cy + Math.sin(a) * (r - rw), m.d, Math.max(P.hair, r * 0.1)); }
  circle(cx, cy, Math.max(1.2, r * 0.22), m.f, m.e);
}
function chimney(cx, cy, r, m) { circle(cx, cy, r, m.f, m.e); circle(cx, cy, r * 0.62, INK, m.e); arcSeg(cx, cy, r * 0.84, PI * 1.05, PI * 1.6, rgba(m.l, 0.7), Math.max(P.hair, r * 0.16)); }
function dome(cx, cy, r, col, m) { circle(cx, cy, r, col, (m || MAT.glass).e); circle(cx - r * 0.32, cy - r * 0.32, r * 0.3, 'rgba(236,231,220,0.26)'); arcSeg(cx, cy, r * 0.72, PI * 0.15, PI * 0.5, 'rgba(12,12,13,0.18)', Math.max(P.hair, r * 0.14)); }
function cylinder(cx, cy, r, m) {
  circle(cx, cy, r, m.f, m.e);
  ring(cx, cy, r * 0.84, P.hair, rgba(m.e, 0.7)); ring(cx, cy, r * 0.84 + P.hair, P.hair, rgba(m.l, 0.5));
  arcSeg(cx, cy, r * 0.93, PI * 1.05, PI * 1.55, rgba(m.l, 0.8), Math.max(P.hair, r * 0.1));
  circle(cx, cy, r * 0.22, m.d, m.e);
  if (r > 7) for (let i = 0; i < 6; i++) { const a = i * PI / 3; dot(cx + Math.cos(a) * r * 0.15, cy + Math.sin(a) * r * 0.15, Math.max(0.5, r * 0.035), m.l); }
}
function coil(x, y, w, h, n, vert, m) {
  fillR(x, y, w, h, m.d); strokeR(x, y, w, h, m.e);
  for (let i = 0; i < n; i++) {
    if (vert) { const px = x + (i + 0.5) * w / n; line(px, y + 0.5, px, y + h - 0.5, m.f, w / n * 0.6); line(px - w / n * 0.15, y + 0.5, px - w / n * 0.15, y + h - 0.5, m.l, Math.max(0.4, w / n * 0.15)); }
    else { const py = y + (i + 0.5) * h / n; line(x + 0.5, py, x + w - 0.5, py, m.f, h / n * 0.6); line(x + 0.5, py - h / n * 0.15, x + w - 0.5, py - h / n * 0.15, m.l, Math.max(0.4, h / n * 0.15)); }
  }
}
function fins(x, y, w, h, n, vert, m) {
  fillR(x, y, w, h, m.d); strokeR(x, y, w, h, m.e);
  for (let i = 0; i <= n; i++) {
    if (vert) { const px = x + i * w / n; line(px, y, px, y + h, m.l, Math.max(P.hair, w / n * 0.35)); line(px + Math.max(P.hair, w / n * 0.35), y, px + Math.max(P.hair, w / n * 0.35), y + h, rgba(m.e, 0.6)); }
    else { const py = y + i * h / n; line(x, py, x + w, py, m.l, Math.max(P.hair, h / n * 0.35)); line(x, py + Math.max(P.hair, h / n * 0.35), x + w, py + Math.max(P.hair, h / n * 0.35), rgba(m.e, 0.6)); }
  }
}
function planks(x, y, w, h, n, horiz, m) {
  fillR(x, y, w, h, m.f);
  for (let i = 0; i < n; i++) {
    if (horiz) { const py = y + i * h / n, ph = h / n; line(x, py, x + w, py, m.e); line(x, py + P.hair, x + w, py + P.hair, rgba(m.l, 0.5)); line(x + w * 0.1 + (i % 2) * w * 0.3, py + ph * 0.55, x + w * 0.55 + (i % 2) * w * 0.3, py + ph * 0.6, rgba(m.d, 0.55)); }
    else { const px = x + i * w / n, pw = w / n; line(px, y, px, y + h, m.e); line(px + P.hair, y, px + P.hair, y + h, rgba(m.l, 0.5)); line(px + pw * 0.55, y + h * 0.1 + (i % 2) * h * 0.3, px + pw * 0.6, y + h * 0.55 + (i % 2) * h * 0.3, rgba(m.d, 0.55)); }
  }
  strokeR(x, y, w, h, m.e);
}
function bricks(x, y, w, h, bw, bh, m) {
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  fillR(x, y, w, h, m.d); c.fillStyle = m.f;
  const g = Math.max(0.5, P.hair * 0.8);
  for (let j = 0, py = y; py < y + h; py += bh, j++) for (let px = x - (j % 2) * bw / 2; px < x + w; px += bw) c.fillRect(px + g / 2, py + g / 2, bw - g, bh - g);
  c.restore(); strokeR(x, y, w, h, m.e);
}
function cobbles(x, y, w, h, n, m, rnd) {
  fillR(x, y, w, h, m.e);
  const cw = w / n, ch = h / Math.max(1, Math.round(h / cw));
  for (let py = y; py < y + h - 0.5; py += ch) for (let px = x; px < x + w - 0.5; px += cw) {
    const dx = (rnd() - 0.5) * cw * 0.3, dy = (rnd() - 0.5) * ch * 0.3, sw = cw * (0.62 + rnd() * 0.3), sh = ch * (0.62 + rnd() * 0.3);
    ellipse(px + cw / 2 + dx, py + ch / 2 + dy, sw / 2, sh / 2, 0, rnd() < 0.5 ? m.f : U.mixHex(m.f, m.d, 0.35), m.e);
  }
  strokeR(x, y, w, h, m.e);
}
function lamp(cx, cy, r, col, on) { if (on) circle(cx, cy, r * 2.1, rgba(col, 0.16)); circle(cx, cy, r, on ? col : INK3, INK, P.hair); if (on) dot(cx - r * 0.3, cy - r * 0.3, r * 0.3, 'rgba(236,231,220,0.5)'); }
function glow(cx, cy, r, col, a) { circle(cx, cy, r, rgba(col, a * 0.35)); circle(cx, cy, r * 0.66, rgba(col, a * 0.4)); circle(cx, cy, r * 0.36, rgba(col, a * 0.5)); }
function crate(x, y, s, m) { box(x, y, s, s, Math.max(2, s * 0.2), m); line(x + 1, y + 1, x + s - 1, y + s * 0.8 - 1, rgba(m.e, 0.7)); line(x + s - 1, y + 1, x + 1, y + s * 0.8 - 1, rgba(m.e, 0.7)); }
function log(x, y, len, r, horiz, m) {
  if (horiz) { fillR(x, y - r, len, r * 2, m.f); line(x, y - r * 0.4, x + len, y - r * 0.4, rgba(m.l, 0.6)); line(x, y + r * 0.5, x + len, y + r * 0.5, rgba(m.d, 0.7)); strokeR(x, y - r, len, r * 2, m.e); circle(x + len, y, r, MAT.wood.l, m.e); ring(x + len, y, r * 0.5, P.hair, m.d); }
  else { fillR(x - r, y, r * 2, len, m.f); line(x - r * 0.4, y, x - r * 0.4, y + len, rgba(m.l, 0.6)); line(x + r * 0.5, y, x + r * 0.5, y + len, rgba(m.d, 0.7)); strokeR(x - r, y, r * 2, len, m.e); circle(x, y + len, r, MAT.wood.l, m.e); ring(x, y + len, r * 0.5, P.hair, m.d); }
}
function post(cx, cy, r, m) { circle(cx, cy, r, m.f, m.e); ring(cx, cy, r * 0.5, P.hair, m.d); dot(cx - r * 0.3, cy - r * 0.3, r * 0.25, rgba(m.l, 0.7)); }
function trefoil(cx, cy, r, col) { c.fillStyle = col; for (let i = 0; i < 3; i++) { const a = -PI / 2 + i * TAU / 3; c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, r, a - PI / 6, a + PI / 6); c.closePath(); c.fill(); } circle(cx, cy, r * 0.42, INK3, null); circle(cx, cy, r * 0.16, col, null); }
function strap(x, y, w, h, m) { const t = Math.max(2, Math.round(w * 0.06)); fillR(x + 3, y, t, h, m.f); fillR(x + w - 3 - t, y, t, h, m.f); strokeR(x + 3, y, t, h, m.e); strokeR(x + w - 3 - t, y, t, h, m.e); rivets(x + 3, y, t, h, t / 2, Math.max(4, h / 4), m); }
function label(cx, cy, w, h, col) { fillR(cx - w / 2, cy - h / 2, w, h, col); strokeR(cx - w / 2, cy - h / 2, w, h, INK3); }
function dashRect(x, y, w, h, col, seg) { c.save(); c.setLineDash([seg, seg]); strokeR(x, y, w, h, col); c.restore(); }
function ladder(x0, y0, x1, y1, w, m) { const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L * w / 2, ny = dx / L * w / 2; line(x0 + nx, y0 + ny, x1 + nx, y1 + ny, m.f, Math.max(P.hair, 1.2)); line(x0 - nx, y0 - ny, x1 - nx, y1 - ny, m.f, Math.max(P.hair, 1.2)); const n = Math.max(2, Math.round(L / 5)); for (let i = 1; i < n; i++) { const t = i / n; line(x0 + dx * t + nx, y0 + dy * t + ny, x0 + dx * t - nx, y0 + dy * t - ny, m.d, Math.max(P.hair, 1)); } }

/* tiered machine body: 3/4 box dressed in the tier material language */
function machineBody(x, y, w, h, d, tier) {
  tier = tier === undefined ? P.tier : tier;
  const m = tierMat(tier), acc = S.TIER_COLORS[tier];
  if (d === undefined) d = depthOf(h);
  box(x, y, w, h, d, m);
  const th = h - d;
  switch (tier) {
    case 0: planks(x + 1, y + 1, w - 2, th - 2, Math.max(3, Math.round(th / 7)), true, m); [[x + 1.5, y + 1.5], [x + w - 5.5, y + 1.5], [x + 1.5, y + th - 5.5], [x + w - 5.5, y + th - 5.5]].forEach(p => { fillR(p[0], p[1], 4, 4, MAT.wood2.f); strokeR(p[0], p[1], 4, 4, m.e); }); break;
    case 1: bricks(x + 1, y + 1, w - 2, th - 2, Math.max(6, w / 6), Math.max(3, w / 12), MAT.brick); strap(x, y, w, th, MAT.bronze); break;
    case 2: rivets(x, y, w, th, 2.5, Math.max(6, w / 6), m); seamH(x + 2, y + th * 0.5, w - 4, m); break;
    case 3: rivets(x, y, w, th, 2.2, Math.max(5, w / 8), m); seamV(x + w * 0.5, y + 2, th - 4, m); seamH(x + 2, y + th * 0.5, w - 4, m); break;
    case 4: seamH(x + 2, y + th * 0.42, w - 4, m); seamV(x + w * 0.62, y + 2, th - 4, m); hatch(x + 2, y + th - Math.max(3, th * 0.11) - 1, w * 0.45, Math.max(3, th * 0.11), Math.max(2, w * 0.05)); rivets(x, y, w, th, 2.2, Math.max(8, w / 4), m); break;
    case 5: seamH(x + 2, y + th * 0.35, w - 4, m); seamH(x + 2, y + th * 0.7, w - 4, m); fillR(x + 2, y + 2, w - 4, Math.max(1.5, th * 0.06), rgba(acc, 0.85)); break;
    case 6: for (let i = 1; i < 4; i++) seamH(x + 1, y + th * i / 4, w - 2, m); fillR(x + w - Math.max(3, w * 0.12) - 2, y + 2, Math.max(3, w * 0.12), th - 4, rgba(acc, 0.8)); strokeR(x + w - Math.max(3, w * 0.12) - 2, y + 2, Math.max(3, w * 0.12), th - 4, m.e); break;
    case 7: line(x + 3, y + th * 0.5, x + w - 3, y + th * 0.5, rgba(CYAN, 0.18), Math.max(2, w * 0.05)); line(x + 3, y + th * 0.5, x + w - 3, y + th * 0.5, rgba(CYAN, 0.7), P.hair); line(x + w * 0.5, y + 3, x + w * 0.5, y + th - 3, rgba(VIOLET, 0.18), Math.max(2, w * 0.05)); line(x + w * 0.5, y + 3, x + w * 0.5, y + th - 3, rgba(VIOLET, 0.7), P.hair); break;
    default: break;
  }
  if (tier !== 6) { fillR(x + 3, y + th - Math.max(2, th * 0.07) - 1.5, Math.min(w * 0.3, 14), Math.max(2, th * 0.07), acc); }
}

/* ── animation helpers (called every frame in sprite units) ── */
const SP = {};
const def = (keys, base, anim, opts) => { for (const k of keys.split(' ')) SP[k] = Object.assign({ base, anim }, opts || null); };
const LIVE = 'torch lamp watchtower ballista cannon_turret gatling_turret tesla_coil laser_turret plasma_turret tank study_table bonsai bonsai_hydro';
const FAULT = { no_power: 1, no_input: 1, output_full: 1, no_fuel: 1, no_link: 1, no_fluid: 1, broken: 1 };
function statusLamp(x, y, r, A) {
  const st = A.state; let col = BONE3, on = true;
  if (st === 'working') col = P.A;
  else if (st === 'paused') on = false;
  else if (FAULT[st]) { col = VERM; on = (A.t * 1.6) % 1 < 0.55; }
  circle(x, y, r, on ? col : INK3, INK, P.hair);
  if (on && A.lod > 1) circle(x, y, r * 2.1, rgba(col, 0.16));
}
function shimmer(cx, cy, r, A) {
  if (A.lod < 2 || !A.working) return;
  for (let i = 0; i < 3; i++) { const p = (A.t * 0.7 + i / 3) % 1, y = cy - r * 0.6 - p * r * 2.4; arcSeg(cx + Math.sin(p * 9 + i * 2) * r * 0.35, y, r * (0.5 + p * 0.7), PI * 1.1, PI * 1.9, rgba(BONE, (1 - p) * 0.2), Math.max(P.hair, r * 0.12)); }
}
function flame(cx, cy, r, A, seed) {
  const f = 0.85 + 0.15 * Math.sin(A.t * 17 + seed) + 0.1 * Math.sin(A.t * 29 + seed * 2);
  if (A.lod > 1) circle(cx, cy - r * 0.2, r * 2.1 * f, rgba(AMBER, 0.14));
  circle(cx, cy, r * f, FIRE); circle(cx - r * 0.1, cy - r * 0.15, r * 0.55 * f, AMBER);
}
function aimAngle(A) {
  const inst = A.inst, ph = A.ph; let target = null;
  if (inst) {
    if (typeof inst.aim === 'number') target = inst.aim;
    else { const D = LD.Sim && LD.Sim.Defense; if (D && typeof D.turretTarget === 'function') { const e = D.turretTarget(inst.uid); if (e && typeof e.x === 'number') target = Math.atan2(e.y - (inst.y + P.size / 2), e.x - (inst.x + P.size / 2)); } }
    if (target !== null) target -= ((inst.rot | 0) & 3) * PI / 2;
  }
  if (target === null) target = -PI / 2 + Math.sin(A.t * 0.45 + ph.p0 * 7) * 0.75;
  if (ph.aim === null) ph.aim = target;
  let d = target - ph.aim; d = Math.atan2(Math.sin(d), Math.cos(d));
  ph.aim += U.clamp(d, -A.dt * 4, A.dt * 4);
  return ph.aim;
}
const jag = (x0, y0, x1, y1, n, amp, seed, col, lw) => { c.beginPath(); c.moveTo(x0, y0); for (let i = 1; i < n; i++) { const t = i / n; c.lineTo(x0 + (x1 - x0) * t + Math.sin(seed * 13.1 + i * 7.3) * amp, y0 + (y1 - y0) * t + Math.cos(seed * 9.7 + i * 5.1) * amp); } c.lineTo(x1, y1); c.strokeStyle = col; c.lineWidth = lw; c.stroke(); };

/* ── generic tiered machine (unknown keys) ── */
def('generic', () => {
  const W = P.W, tr = tierTrim(P.tier);
  machineBody(3, 3, W - 6, W - 6);
  if (P.tier <= 3) chimney(W * 0.72, W * 0.3, W * 0.1, tr); else dome(W * 0.72, W * 0.3, W * 0.11, rgba(MAT.glass.f, 0.9));
  fins(W * 0.14, W * 0.52, W * 0.32, W * 0.2, 4, false, tr);
}, A => { const W = P.W; statusLamp(W * 0.2, W * 0.2, Math.max(1.6, W * 0.035), A); if (P.tier <= 3) shimmer(W * 0.72, W * 0.3, W * 0.1, A); });

/* ── core / logistics ── */
def('hub', () => {
  const r = P.rnd;
  cobbles(2, 2, 140, 140, 9, MAT.stone, r);
  box(8, 8, 76, 70, 10, MAT.wood);
  planks(9, 9, 74, 29, 4, true, MAT.wood); planks(9, 39, 74, 28, 4, true, MAT.wood);
  line(9, 38.5, 83, 38.5, MAT.wood2.e, 1.6);
  fillR(30, 68, 30, 10, MAT.dark.f); strokeR(30, 68, 30, 10, MAT.wood.e);
  chimney(70, 20, 4.5, MAT.stone);
  fillR(92, 12, 44, 44, rgba(BONE, 0.07)); dashRect(92, 12, 44, 44, rgba(BONE, 0.5), 3);
  path([100, 20, 100, 48, 128, 48, 128, 20], rgba(BONE, 0.55), 1.4); line(100, 34, 128, 34, rgba(BONE, 0.55), 1.4);
  crate(96, 64, 14, MAT.wood); crate(112, 66, 12, MAT.wood2); crate(100, 82, 12, MAT.wood);
  log(10, 100, 40, 4.5, true, MAT.wood); log(10, 110, 34, 4.5, true, MAT.wood); log(12, 120, 38, 4.5, true, MAT.wood);
  cylinder(128, 92, 9, MAT.wood2);
  planks(60, 96, 50, 40, 5, false, MAT.wood2);
  post(118, 118, 4, MAT.wood2);
}, A => {
  const f = Math.sin(A.t * 6) * 2, g = Math.sin(A.t * 6 + 1.3) * 1.5;
  line(118, 100, 118, 118, MAT.wood2.e, 1.4); poly([118, 104, 138 + f, 108 + g, 118, 112], VERM, INK);
});

def('elevator', () => {
  const W = P.W, t = P.tier, m = tierMat(t), tr = tierTrim(t), o = W * 0.26, ow = W - 2 * o;
  plate(3, 3, W - 6, W - 6, m);
  if (t === 2) rivets(3, 3, W - 6, W - 6, 3, 12, m); else { seamH(5, W * 0.5, W - 10, m); seamV(W * 0.5, 5, W - 10, m); }
  [[8, 8, o, o], [W - 8, 8, o + ow, o], [8, W - 8, o, o + ow], [W - 8, W - 8, o + ow, o + ow]].forEach(b => { line(b[0], b[1], b[2], b[3], tr.e, 5.5); line(b[0], b[1], b[2], b[3], tr.f, 3.6); });
  fillR(o, o, ow, ow, INK); strokeR(o - 2, o - 2, ow + 4, ow + 4, tr.l, 2); strokeR(o, o, ow, ow, m.e);
  line(o + ow * 0.18, o, o + ow * 0.18, o + ow, rgba(m.l, 0.35)); line(o + ow * 0.82, o, o + ow * 0.82, o + ow, rgba(m.l, 0.35));
  machineBody(6, 6, W * 0.36, W * 0.2, undefined, t);
  if (t === 2) chimney(W * 0.1, W * 0.13, W * 0.05, MAT.iron);
  else if (t === 3) fins(W * 0.09, W * 0.09, W * 0.14, W * 0.08, 4, false, MAT.iron);
  else if (t === 5) dome(W * 0.12, W * 0.14, W * 0.045, rgba(SKY, 0.8));
  else ring(W * 0.12, W * 0.14, W * 0.04, 2, rgba(VIOLET, 0.7));
  if (t >= 4) hatch(o - 2, W - 12, ow + 4, 5, 3);
}, A => {
  const W = P.W, o = W * 0.26, ow = W - 2 * o, ph = A.ph, tr = tierTrim(P.tier);
  const cyc = A.working ? Math.sin(ph.a * 0.9) * 0.5 + 0.5 : 0, k = 1 - cyc * 0.45, cw = ow * 0.62 * k, x0 = W / 2 - cw / 2;
  const col = U.mixHex(tr.f, INK, cyc * 0.65);
  for (const p of [[o, o], [o + ow, o], [o, o + ow], [o + ow, o + ow]]) line(p[0], p[1], W / 2 + (p[0] - W / 2) * 0.62 * k, W / 2 + (p[1] - W / 2) * 0.62 * k, rgba(BONE3, 0.6), P.hair);
  fillR(x0, x0, cw, cw, col); strokeR(x0, x0, cw, cw, rgba(BONE, 0.35 * (1 - cyc) + 0.1));
  line(x0, x0, x0 + cw, x0 + cw, rgba(INK, 0.5)); line(x0 + cw, x0, x0, x0 + cw, rgba(INK, 0.5));
  wheel(W * 0.44, W * 0.16, W * 0.055, 6, ph.a * 2, MAT.iron);
  statusLamp(W - 11, 11, Math.max(1.8, W * 0.028), A);
});

def('shaft', () => {
  const W = P.W, t = P.tier, tr = tierTrim(t), r = P.rnd, cx = W / 2, cy = W * 0.54;
  cobbles(2, 2, W - 4, W - 4, 8, MAT.stone, r);
  circle(cx, cy, W * 0.24, MAT.stone.d, MAT.stone.e); circle(cx, cy, W * 0.2, INK, MAT.stone.e);
  for (let i = 0; i < 10; i++) { const a = i * TAU / 10; line(cx + Math.cos(a) * W * 0.2, cy + Math.sin(a) * W * 0.2, cx + Math.cos(a) * W * 0.24, cy + Math.sin(a) * W * 0.24, rgba(MAT.stone.e, 0.7)); }
  line(10, W - 10, cx, W * 0.34, tr.e, 6); line(10, W - 10, cx, W * 0.34, tr.f, 4); line(W - 10, W - 10, cx, W * 0.34, tr.e, 6); line(W - 10, W - 10, cx, W * 0.34, tr.f, 4);
  line(W * 0.3, W * 0.78, W * 0.7, W * 0.78, tr.f, 3);
  machineBody(6, 6, W * 0.4, W * 0.24, undefined, t);
  if (t === 2) { chimney(W * 0.1, W * 0.13, W * 0.05, MAT.iron); cylinder(W * 0.3, W * 0.15, W * 0.06, MAT.iron); }
  else if (t === 3) fins(W * 0.1, W * 0.1, W * 0.2, W * 0.1, 5, false, MAT.iron);
  else if (t === 5) dome(W * 0.18, W * 0.16, W * 0.05, rgba(CYAN, 0.75));
  else ring(W * 0.18, W * 0.16, W * 0.045, 2.2, rgba(VIOLET, 0.75));
  for (let i = 0; i < 9; i++) dot(W * 0.7 + r() * W * 0.22, W * 0.1 + r() * W * 0.22, W * 0.02 + r() * W * 0.01, i % 3 ? MAT.stone.l : MAT.stone.f);
}, A => {
  const W = P.W, cx = W / 2, ph = A.ph, cyc = Math.sin(ph.a * 1.1) * 0.5 + 0.5;
  wheel(cx, W * 0.34, W * 0.065, 6, ph.a * 2.5, MAT.iron);
  const y = W * 0.4 + cyc * W * 0.2; line(cx, W * 0.34, cx, y, MAT.rope.f, Math.max(P.hair, 1.2)); fillR(cx - W * 0.05, y, W * 0.1, W * 0.07, MAT.iron.f); strokeR(cx - W * 0.05, y, W * 0.1, W * 0.07, MAT.iron.e);
  statusLamp(W - 11, W - 11, Math.max(1.8, W * 0.028), A);
});

def('tank', () => {
  const W = P.W, t = P.tier, m = tierMat(t), tr = tierTrim(t), cx = W / 2, cy = W / 2, R = W / 2 - 4, pr = Math.max(2, W * 0.045);
  if (t === 0) { fillR(2, 2, W - 4, W - 4, MAT.soil.f); strokeR(2, 2, W - 4, W - 4, MAT.soil.e); }
  else { plate(2, 2, W - 4, W - 4, m); if (t === 2) rivets(2, 2, W - 4, W - 4, 3, 10, m); else if (t >= 5) { seamH(4, cy, W - 8, m); } }
  for (const d of [[cx, 3, cx, cy - R * 0.85], [cx, W - 3, cx, cy + R * 0.85], [3, cy, cx - R * 0.85, cy], [W - 3, cy, cx + R * 0.85, cy]]) pipe(d[0], d[1], d[2], d[3], pr, t === 0 ? MAT.wood2 : tr, true);
  if (t === 0) {
    circle(cx, cy, R, MAT.wood.f, MAT.wood.e);
    for (let i = 0; i < 14; i++) { const a = i * TAU / 14; line(cx + Math.cos(a) * R * 0.28, cy + Math.sin(a) * R * 0.28, cx + Math.cos(a) * R, cy + Math.sin(a) * R, rgba(MAT.wood.e, 0.55)); }
    ring(cx, cy, R * 0.88, Math.max(1.5, R * 0.09), MAT.iron.f); ring(cx, cy, R * 0.55, Math.max(1.2, R * 0.07), MAT.iron.f);
    circle(cx, cy, R * 0.18, MAT.wood2.f, MAT.wood.e);
  } else {
    cylinder(cx, cy, R, m);
    if (t === 2) for (let i = 0; i < 18; i++) { const a = i * TAU / 18; dot(cx + Math.cos(a) * R * 0.84, cy + Math.sin(a) * R * 0.84, Math.max(0.6, R * 0.03), m.e); }
    if (t === 6) { for (let i = 0; i < 24; i++) { const a = i * TAU / 24; line(cx + Math.cos(a) * R * 0.86, cy + Math.sin(a) * R * 0.86, cx + Math.cos(a) * R * 0.98, cy + Math.sin(a) * R * 0.98, rgba(SKY, 0.8), Math.max(P.hair, R * 0.03)); } circle(cx, cy, R * 0.34, rgba(SKY, 0.14)); }
    if (t === 7) { ring(cx, cy, R * 0.72, Math.max(3, R * 0.12), rgba(VIOLET, 0.14)); ring(cx, cy, R * 0.72, Math.max(1.2, R * 0.04), rgba(VIOLET, 0.7)); }
  }
  const gw = Math.max(3, W * 0.07), gx = W - 4 - gw, gy = cy - R * 0.55, gh = R * 1.1;
  fillR(gx, gy, gw, gh, INK); strokeR(gx, gy, gw, gh, t === 0 ? MAT.wood.e : m.l);
}, A => {
  const W = P.W, t = P.tier, R = W / 2 - 4, gw = Math.max(3, W * 0.07), gx = W - 4 - gw, gy = W / 2 - R * 0.55, gh = R * 1.1;
  let lvl = 0, col = MAT.water.f; const inst = A.inst;
  if (inst) { if (inst.tank && inst.tank.fluid) { const cap = (P.def.tank && P.def.tank.cap) || 1; lvl = U.clamp((inst.tank.amt || 0) / cap); const it = LD.Registry && LD.Registry.item && LD.Registry.item(inst.tank.fluid); if (it && it.color) col = it.color; } }
  else lvl = 0.6;
  if (lvl > 0) { fillR(gx + P.hair, gy + gh * (1 - lvl), gw - 2 * P.hair, gh * lvl, col); fillR(gx + P.hair, gy + gh * (1 - lvl), gw - 2 * P.hair, Math.max(P.hair, gh * 0.03), rgba(BONE, 0.5)); }
  if (A.lod > 1) for (let i = 1; i < 4; i++) line(gx, gy + gh * i / 4, gx + gw * 0.4, gy + gh * i / 4, rgba(BONE, 0.4));
  if (t >= 6) statusLamp(10, 10, Math.max(1.8, W * 0.028), A);
});

def('warehouse', () => {
  const W = P.W, t = P.tier, m = tierMat(t);
  if (t === 7) {
    plate(3, 3, W - 6, W - 6, m); line(W / 2, 5, W / 2, W - 5, rgba(VIOLET, 0.5)); line(5, W / 2, W - 5, W / 2, rgba(VIOLET, 0.5));
    const r = W * 0.19; [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]].forEach(p => { pipe(W * p[0], W * p[1], W / 2, W / 2, W * 0.025, MAT.titan, false); });
    [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]].forEach(p => { cylinder(W * p[0], W * p[1], r, MAT.quantum); ring(W * p[0], W * p[1], r * 0.6, Math.max(1.5, r * 0.12), rgba(VIOLET, 0.55)); });
    circle(W / 2, W / 2, W * 0.07, MAT.quantum.d, MAT.quantum.l); ring(W / 2, W / 2, W * 0.04, 1.5, rgba(CYAN, 0.7));
    return;
  }
  const d = depthOf(W - 6), th = W - 6 - d;
  box(3, 3, W - 6, W - 6, d, m);
  if (t === 0) { planks(4, 4, W - 8, th / 2 - 1, 5, true, MAT.wood); planks(4, 4 + th / 2, W - 8, th / 2 - 1, 5, true, MAT.wood); line(4, 3.5 + th / 2, W - 4, 3.5 + th / 2, MAT.wood2.e, 1.8); [[6, 6], [W - 12, 6], [6, th - 6], [W - 12, th - 6]].forEach(p => post(p[0] + 3, p[1] + 3, 3.5, MAT.wood2)); }
  else if (t === 1) { bricks(4, 4, W - 8, th - 2, 9, 4, MAT.stone); line(4, 3.5 + th / 2, W - 4, 3.5 + th / 2, MAT.stone.e, 2); strap(3, 3, W - 6, th, MAT.bronze); }
  else if (t === 3) { fins(4, 4, W - 8, th / 2 - 1, 7, false, MAT.steel); fins(4, 4 + th / 2, W - 8, th / 2 - 1, 7, false, MAT.steel); line(4, 3.5 + th / 2, W - 4, 3.5 + th / 2, MAT.steel.e, 2.2); rivets(3, 3, W - 6, th, 3, 12, MAT.steel); }
  else { seamH(5, th * 0.35, W - 10, m); seamH(5, th * 0.7, W - 10, m); seamV(W * 0.5, 5, th - 4, m); fillR(5, 5, W - 10, 2, rgba(SKY, 0.85)); for (let i = 0; i < 3; i++) fins(W * 0.12 + i * W * 0.3, th * 0.45, W * 0.16, W * 0.1, 4, false, MAT.steel); hatch(5, th - 6, W * 0.3, 4, 3); }
  fillR(W * 0.36, W - 3 - d, W * 0.28, d, MAT.dark.f); strokeR(W * 0.36, W - 3 - d, W * 0.28, d, m.e);
  line(W * 0.5, W - 3 - d, W * 0.5, W - 3, rgba(m.l, 0.35));
}, A => { if (P.tier >= 5) statusLamp(P.W - 11, 11, Math.max(1.8, P.W * 0.028), A); });

def('wall', () => {
  const t = P.tier, r = P.rnd;
  if (t === 0) { fillR(2, 2, 44, 44, MAT.soil.f); strokeR(2, 2, 44, 44, MAT.soil.e); for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) post(9 + i * 15 + (r() - 0.5) * 2, 9 + j * 15 + (r() - 0.5) * 2, 6.6, MAT.wood); line(3, 24, 45, 24, rgba(MAT.rope.f, 0.9), 2); line(24, 3, 24, 45, rgba(MAT.rope.f, 0.9), 2); }
  else if (t === 1) { box(2, 2, 44, 44, 6, MAT.stone); cobbles(3, 3, 42, 36, 4, MAT.stone, r); }
  else if (t === 3) { box(2, 2, 44, 44, 6, MAT.steel); rivets(2, 2, 44, 38, 3, 8, MAT.steel); seamH(4, 21, 40, MAT.steel); seamV(24, 4, 34, MAT.steel); }
  else if (t === 5) { box(2, 2, 44, 44, 6, MAT.titan); seamH(4, 14, 40, MAT.titan); seamH(4, 27, 40, MAT.titan); fillR(4, 4, 40, 2, rgba(SKY, 0.85)); rivets(2, 2, 44, 38, 3, 12, MAT.titan); }
  else { box(2, 2, 44, 44, 6, MAT.quantum); line(4, 4, 44, 38, rgba(CYAN, 0.14), 4); line(4, 4, 44, 38, rgba(CYAN, 0.6), P.hair); seamH(4, 21, 40, MAT.quantum); ring(24, 21, 7, 1.5, rgba(VIOLET, 0.6)); }
});

/* ── special ── */
def('torch', () => { fillR(6, 6, 36, 36, rgba(MAT.soil.f, 0.6)); circle(24, 30, 9, MAT.stone.f, MAT.stone.e); post(24, 26, 4.5, MAT.wood2); },
  A => { flame(24, 20, 5, A, 0); });
def('lamp', () => { plate(14, 14, 20, 20, MAT.iron); rivets(14, 14, 20, 20, 3, 14, MAT.iron); post(24, 24, 5.5, MAT.iron); dome(24, 24, 8, rgba(MAT.glass.f, 0.95)); },
  A => { const on = A.state !== 'no_power' && A.state !== 'broken' && A.state !== 'paused'; if (!on) { circle(24, 24, 4.5, rgba(INK, 0.5)); return; } const p = A.lod > 1 ? 0.8 + 0.2 * Math.sin(A.t * 2.1) : 1; glow(24, 24, 14, AMBER, 0.6 * p); circle(24, 24, 4.5, rgba('#f2d9a0', 0.95)); });
def('maintenance_bay', () => {
  plate(3, 3, 90, 90, MAT.dark);
  box(3, 3, 12, 90, 4, MAT.paint); box(3, 3, 90, 12, 4, MAT.paint); box(81, 3, 12, 90, 4, MAT.paint);
  rivets(3, 3, 90, 12, 3, 12, MAT.paint); rivets(3, 15, 12, 74, 3, 12, MAT.paint); rivets(81, 15, 12, 74, 3, 12, MAT.paint);
  hatch(15, 86, 66, 6, 3);
  for (let i = 0; i < 4; i++) { fillR(17, 22 + i * 12, 9, 4, MAT.steel.f); strokeR(17, 22 + i * 12, 9, 4, MAT.steel.e); }
  crate(66, 20, 12, MAT.iron); crate(66, 36, 12, MAT.iron);
  line(15, 30, 81, 30, MAT.steel.d, 3); line(15, 66, 81, 66, MAT.steel.d, 3);
  fillR(30, 72, 36, 10, MAT.dark.d); strokeR(30, 72, 36, 10, MAT.steel.e); stripe(32, 74, 10, 2);
}, A => {
  const x = 32 + (Math.sin(A.ph.a * 0.5 + 1) * 0.5 + 0.5) * 34, y = 48 + Math.sin(A.ph.a * 0.9) * 12;
  line(x, 28, x, 68, MAT.steel.e, 6); line(x, 28, x, 68, MAT.steel.f, 4);
  fillR(x - 5, y - 4, 10, 8, MAT.iron.f); strokeR(x - 5, y - 4, 10, 8, MAT.iron.e); line(x, y + 4, x, y + 9, MAT.iron.e, 1.2); dot(x, y + 10, 1.8, AMBER);
  statusLamp(88, 10, 2.6, A);
});

/* ── nature ── */
def('gather_hut', () => {
  const r = P.rnd;
  fillR(2, 2, 92, 92, MAT.grass.d); strokeR(2, 2, 92, 92, MAT.grass.e);
  box(8, 10, 46, 44, 8, MAT.wood2);
  c.save(); c.beginPath(); c.rect(9, 11, 44, 35); c.clip(); fillR(9, 11, 44, 35, '#9a8a5e'); for (let y = 11; y < 46; y += 3) line(9, y, 53, y + 1.2, rgba('#5c4f33', 0.7)); c.restore();
  line(31, 11, 31, 46, MAT.wood2.e, 1.6); fillR(24, 46, 14, 8, MAT.dark.f);
  circle(70, 28, 11, MAT.rope.f, MAT.rope.e); ring(70, 28, 7, 1.2, MAT.rope.d); ring(70, 28, 3.5, 1, MAT.rope.d); for (let i = 0; i < 8; i++) { const a = i * PI / 4; line(70 + Math.cos(a) * 3.5, 28 + Math.sin(a) * 3.5, 70 + Math.cos(a) * 11, 28 + Math.sin(a) * 11, rgba(MAT.rope.d, 0.6)); }
  for (let i = 0; i < 6; i++) { const a = -0.3 + r() * 0.6, x0 = 58 + r() * 8, y0 = 58 + i * 4.5; line(x0, y0, x0 + 24 * Math.cos(a), y0 + 24 * Math.sin(a), MAT.wood.d, 2); }
  for (let i = 0; i < 5; i++) ellipse(14 + r() * 30, 66 + r() * 20, 3 + r() * 2, 2.5 + r() * 1.5, r() * 3, MAT.stone.f, MAT.stone.e);
  for (let i = 0; i < 4; i++) line(80 + i * 3, 74, 82 + i * 3, 88, MAT.grass.l, 1.6);
});
def('woodcutter', () => {
  const r = P.rnd;
  fillR(2, 2, 92, 92, MAT.soil.f); strokeR(2, 2, 92, 92, MAT.soil.e);
  box(6, 6, 40, 36, 7, MAT.wood); planks(7, 7, 38, 14, 3, true, MAT.wood); planks(7, 21, 38, 14, 3, true, MAT.wood); line(7, 21, 45, 21, MAT.wood2.e, 1.6); chimney(38, 12, 3.5, MAT.stone);
  for (let i = 0; i < 4; i++) log(52, 12 + i * 9, 34 - (i % 2) * 6, 4, true, MAT.wood);
  circle(24, 68, 9, MAT.wood.l, MAT.wood.e); ring(24, 68, 5.5, P.hair, MAT.wood.d); ring(24, 68, 2.5, P.hair, MAT.wood.d);
  line(52, 66, 84, 66, MAT.wood2.f, 3); line(54, 60, 54, 72, MAT.wood2.f, 2.5); line(82, 60, 82, 72, MAT.wood2.f, 2.5); log(56, 66, 24, 3.5, true, MAT.wood);
  for (let i = 0; i < 8; i++) dot(8 + r() * 34, 54 + r() * 36, 1, MAT.wood.l);
}, A => {
  const a = -0.9 + Math.max(0, Math.sin(A.ph.a * 2.2)) * 1.1, ex = 24 + Math.cos(a) * 14, ey = 68 + Math.sin(a) * 14;
  line(24, 68, ex, ey, MAT.wood2.f, 2.2); poly([ex - 3, ey - 4, ex + 4, ey - 2, ex + 4, ey + 3, ex - 3, ey + 4], MAT.iron.f, MAT.iron.e);
});
def('hunting_lodge', () => {
  fillR(2, 2, 92, 92, MAT.grass.d); strokeR(2, 2, 92, 92, MAT.grass.e);
  box(6, 6, 44, 40, 7, MAT.wood2); planks(7, 7, 42, 32, 6, false, MAT.wood2);
  path([20, 14, 24, 22, 28, 14], BONE2, 1.4); path([16, 18, 20, 14], BONE2, 1.2); path([32, 18, 28, 14], BONE2, 1.2);
  post(62, 14, 3.5, MAT.wood2); post(88, 14, 3.5, MAT.wood2); line(62, 14, 88, 14, MAT.wood.f, 3);
  poly([66, 18, 84, 18, 82, 44, 68, 44], MAT.leather.f, MAT.leather.e); for (let i = 0; i < 4; i++) line(66 + i * 6, 18, 65 + i * 6.5, 14, MAT.rope.f, 1);
  circle(24, 72, 8, MAT.stone.d, MAT.stone.e); for (let i = 0; i < 7; i++) { const a = i * TAU / 7; dot(24 + Math.cos(a) * 8, 72 + Math.sin(a) * 8, 2.4, MAT.stone.f); } circle(24, 72, 3.5, '#3a3530');
  for (let i = 0; i < 3; i++) { line(60 + i * 8, 76, 70 + i * 8, 84, BONE2, 2); dot(60 + i * 8, 76, 1.6, BONE2); dot(70 + i * 8, 84, 1.6, BONE2); }
});
def('well', () => {
  circle(24, 26, 17, MAT.stone.f, MAT.stone.e); for (let i = 0; i < 10; i++) { const a = i * TAU / 10; line(24 + Math.cos(a) * 11, 26 + Math.sin(a) * 11, 24 + Math.cos(a) * 17, 26 + Math.sin(a) * 17, rgba(MAT.stone.e, 0.6)); }
  circle(24, 26, 10.5, MAT.water.d, MAT.stone.e); circle(24, 26, 8.5, rgba(MAT.water.f, 0.9));
  post(6, 26, 3.5, MAT.wood2); post(42, 26, 3.5, MAT.wood2); line(6, 26, 42, 26, MAT.wood.f, 3.5); line(6, 25, 42, 25, rgba(MAT.wood.l, 0.6), 1);
}, A => {
  const a = A.ph.a * 2; circle(24, 26, 4.5, MAT.wood.f, MAT.wood.e); line(24 + Math.cos(a) * 4.5, 26 + Math.sin(a) * 4.5, 24 - Math.cos(a) * 4.5, 26 - Math.sin(a) * 4.5, MAT.wood.e, 1.2);
  line(24, 26, 30, 35, MAT.rope.f, 1); circle(30, 35, 2.5, MAT.wood2.f, MAT.wood.e);
});
def('pump_hand', () => { bricks(4, 4, 40, 40, 8, 4, MAT.brick); pipe(24, 28, 42, 28, 3, MAT.bronze, true); cylinder(22, 26, 8, MAT.bronze); },
  A => { const a = -PI / 2 - 0.5 + Math.sin(A.ph.a * 2.5) * 0.45, ex = 22 + Math.cos(a) * 16, ey = 26 + Math.sin(a) * 16; line(22, 26, ex, ey, MAT.iron.e, 3.5); line(22, 26, ex, ey, MAT.iron.f, 2.2); dot(ex, ey, 2, MAT.wood.f); });
def('pump_electric', () => { plate(3, 3, 42, 42, MAT.steel); rivets(3, 3, 42, 42, 3, 10, MAT.steel); fins(6, 6, 20, 14, 5, true, MAT.iron); cylinder(30, 30, 10, MAT.steel); pipe(30, 30, 45, 30, 3, MAT.steel, true); pipe(30, 30, 30, 45, 3, MAT.steel, true); },
  A => { circle(30, 30, 5, INK3, MAT.steel.e); const a = A.ph.a * 4; for (let i = 0; i < 3; i++) line(30, 30, 30 + Math.cos(a + i * 2.09) * 4.2, 30 + Math.sin(a + i * 2.09) * 4.2, MAT.steel.l, 1.2); statusLamp(38, 10, 2, A); });
const shrink = (pts, k) => pts.map(v => (v - P.W / 2) * k + P.W / 2);
def('quarry', () => {
  const r = P.rnd;
  fillR(2, 2, 92, 92, MAT.soil.f); strokeR(2, 2, 92, 92, MAT.soil.e);
  const pit = [10, 30, 40, 12, 80, 20, 86, 60, 60, 84, 20, 78];
  poly(pit, MAT.stone.d, MAT.stone.e); poly(shrink(pit, 0.72), MAT.stone.f, MAT.stone.e); poly(shrink(pit, 0.44), MAT.dark.f, MAT.stone.e);
  for (let i = 0; i < 6; i++) { fillR(64 + (i % 3) * 8, 4 + Math.floor(i / 3) * 6.5, 7, 5.5, MAT.stone.l); strokeR(64 + (i % 3) * 8, 4 + Math.floor(i / 3) * 6.5, 7, 5.5, MAT.stone.e); }
  ladder(16, 40, 34, 52, 5, MAT.wood);
  for (let i = 0; i < 5; i++) dot(40 + r() * 20, 44 + r() * 16, 1.6, MAT.stone.l);
  post(78, 72, 4, MAT.wood2);
}, A => { const a = -2.2 + Math.sin(A.ph.a * 0.6) * 0.5, ex = 78 + Math.cos(a) * 30, ey = 72 + Math.sin(a) * 30; line(78, 72, ex, ey, MAT.wood.f, 3); line(ex, ey, ex, ey + 7, MAT.rope.f, 1); dot(ex, ey + 8, 2.6, MAT.stone.l); });
def('clay_pit', () => {
  const r = P.rnd;
  fillR(2, 2, 92, 92, MAT.soil.f); strokeR(2, 2, 92, 92, MAT.soil.e);
  const pit = [12, 20, 70, 10, 88, 50, 70, 86, 16, 80, 8, 50];
  poly(pit, '#7a6448', MAT.soil.e); poly(shrink(pit, 0.7), '#8c7454', MAT.soil.e);
  ellipse(46, 50, 16, 9, 0.3, MAT.water.f, MAT.water.e);
  planks(20, 62, 44, 7, 1, true, MAT.wood);
  line(70, 60, 84, 76, MAT.wood2.f, 2); poly([84, 76, 90, 74, 88, 82], MAT.iron.f, MAT.iron.e);
  for (let i = 0; i < 5; i++) ellipse(20 + r() * 40, 24 + r() * 20, 3, 2.2, r() * 3, '#8c7454', MAT.soil.e);
  cylinder(80, 20, 6.5, MAT.wood2);
});
def('sand_pit', () => {
  fillR(2, 2, 92, 92, MAT.sand.d); strokeR(2, 2, 92, 92, MAT.sand.e);
  const pit = [8, 40, 40, 30, 50, 60, 44, 88, 10, 84];
  poly(pit, MAT.sand.f, MAT.sand.e); poly(shrink(pit, 0.6), MAT.sand.l, MAT.sand.e);
  const sx = 56, sy = 10, sw = 32, sh = 26; fillR(sx, sy, sw, sh, rgba(INK, 0.25));
  for (let i = 1; i < 6; i++) { line(sx + i * sw / 6, sy, sx + i * sw / 6, sy + sh, MAT.bronze.d, 0.8); line(sx, sy + i * sh / 6, sx + sw, sy + i * sh / 6, MAT.bronze.d, 0.8); }
  strokeR(sx, sy, sw, sh, MAT.wood.e, 2.5);
  cylinder(20, 18, 7, MAT.bronze); planks(60, 50, 14, 34, 2, false, MAT.wood);
  circle(74, 78, 9, MAT.sand.l, MAT.sand.e);
});
def('peat_cutter', () => {
  fillR(2, 2, 92, 92, '#4e4a3a'); strokeR(2, 2, 92, 92, MAT.soil.e);
  poly([10, 14, 50, 12, 52, 70, 12, 72], '#2e2a22', MAT.soil.e); ellipse(30, 40, 12, 20, 0, rgba(MAT.water.f, 0.35));
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { fillR(58 + i * 9, 14 + j * 9, 8, 7, j % 2 ? '#3b3328' : '#463c2e'); strokeR(58 + i * 9, 14 + j * 9, 8, 7, INK); }
  line(64, 66, 78, 84, MAT.wood2.f, 2); poly([78, 84, 86, 82, 84, 90], MAT.iron.f, MAT.iron.e);
  planks(8, 78, 40, 10, 1, true, MAT.wood);
});
def('salt_works', () => {
  plate(2, 2, 92, 92, MAT.sand);
  [[6, 6], [50, 6], [6, 50], [50, 50]].forEach(p => { fillR(p[0], p[1], 40, 40, '#dfe0d6'); fillR(p[0] + 3, p[1] + 3, 34, 34, '#bfc7c4'); strokeR(p[0], p[1], 40, 40, MAT.bronze.e); });
  line(48, 4, 48, 92, MAT.bronze.f, 4); line(4, 48, 92, 48, MAT.bronze.f, 4); line(48, 4, 48, 92, rgba(MAT.bronze.l, 0.6), 1); line(4, 48, 92, 48, rgba(MAT.bronze.l, 0.6), 1);
  circle(26, 26, 8, '#eeeee6', MAT.stone.e); circle(70, 70, 6, '#eeeee6', MAT.stone.e);
  line(56, 30, 84, 20, MAT.wood2.f, 1.8); line(82, 14, 88, 26, MAT.wood2.f, 2);
}, A => { if (A.lod > 1 && A.working) for (let i = 0; i < 2; i++) { const p = (A.t * 0.5 + i * 0.5) % 1; ring(70 + i * 2, 26 - p * 10, 4 + p * 6, 1, rgba(BONE, 0.25 * (1 - p))); } });
def('planter', () => {
  fillR(2, 2, 92, 92, MAT.soil.f); strokeR(2, 2, 92, 92, MAT.soil.e);
  for (let j = 0; j < 5; j++) { const y = 12 + j * 16; fillR(8, y, 60, 8, MAT.soil.d); for (let i = 0; i < 6; i++) circle(13 + i * 10, y + 4, 2.6, MAT.leaf.f, MAT.leaf.e); }
  line(74, 6, 74, 90, MAT.water.f, 4); line(74, 6, 74, 90, rgba(MAT.water.l, 0.5), 1); for (let j = 0; j < 5; j++) line(74, 16 + j * 16, 68, 16 + j * 16, MAT.water.f, 2);
  box(78, 8, 14, 20, 4, MAT.wood); crate(78, 40, 12, MAT.wood); crate(78, 56, 12, MAT.wood); circle(84, 78, 6, MAT.leaf.f, MAT.leaf.e);
});
const tree = (x, y, r) => { circle(x + r * 0.1, y + r * 0.1, r, rgba(INK, 0.18)); circle(x, y, r, MAT.leaf.d, MAT.leaf.e); circle(x - r * 0.25, y - r * 0.25, r * 0.55, MAT.leaf.f); circle(x - r * 0.4, y - r * 0.4, r * 0.25, MAT.leaf.l); };
def('tree_farm', () => {
  const r = P.rnd;
  fillR(2, 2, 140, 140, MAT.grass.f); strokeR(2, 2, 140, 140, MAT.grass.e);
  line(72, 8, 72, 136, rgba(MAT.soil.f, 0.7), 6);
  strokeR(6, 6, 132, 132, MAT.iron.f, 2); for (let i = 0; i <= 6; i++) { dot(6 + i * 22, 6, 1.8, MAT.iron.d); dot(6 + i * 22, 138, 1.8, MAT.iron.d); dot(6, 6 + i * 22, 1.8, MAT.iron.d); dot(138, 6 + i * 22, 1.8, MAT.iron.d); }
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) { if (i === 2 && j === 2) continue; tree(28 + i * 44, 28 + j * 44, 15 + r() * 3); }
  box(102, 102, 34, 14, 4, MAT.wood); fillR(104, 104, 30, 7, MAT.water.f);
  for (let i = 0; i < 3; i++) { line(110 + i * 10, 132, 110 + i * 10, 124, MAT.wood2.f, 1.4); circle(110 + i * 10, 122, 4, MAT.leaf.f, MAT.leaf.e); }
});
def('fiber_farm', () => {
  fillR(2, 2, 140, 140, MAT.soil.f); strokeR(2, 2, 140, 140, MAT.soil.e);
  for (let j = 0; j < 8; j++) { const y = 10 + j * 16; fillR(10, y, 108, 10, MAT.soil.d); for (let i = 0; i < 14; i++) { const x = 14 + i * 7.8; line(x, y + 9, x - 1.5, y + 1, MAT.leaf.f, 1.4); line(x, y + 9, x + 1.5, y + 2, MAT.leaf.l, 1.2); } }
  pipe(130, 8, 130, 136, 3, MAT.bronze, true); for (let j = 0; j < 8; j++) line(130, 15 + j * 16, 120, 15 + j * 16, MAT.bronze.f, 1.6);
  box(120, 118, 18, 18, 4, MAT.wood);
});
const bonsaiTree = (sw, k) => {
  path([24, 33, 23 + sw * 0.3, 26, 26 + sw * 0.6, 20, 24 + sw, 15], MAT.wood2.f, 2.2);
  circle(20 + sw * 0.8, 18, 5 * k, MAT.leaf.d, MAT.leaf.e); circle(28 + sw, 15, 4.5 * k, MAT.leaf.f, MAT.leaf.e); circle(24 + sw * 1.2, 11, 4 * k, MAT.leaf.l, MAT.leaf.e);
};
def('bonsai', () => { plate(3, 3, 42, 42, MAT.steel); rivets(3, 3, 42, 42, 3, 12, MAT.steel); box(14, 26, 20, 14, 4, MAT.dark); fillR(15, 27, 18, 9, MAT.soil.d); line(8, 8, 20, 16, MAT.iron.f, 2); },
  A => { const sw = A.lod > 1 ? Math.sin(A.t * 1.3) * 0.9 : 0; bonsaiTree(sw, 1); const on = !FAULT[A.state] && A.state !== 'paused'; lamp(20, 16, 2.2, AMBER, on); statusLamp(40, 8, 1.6, A); });
def('bonsai_hydro', () => { plate(3, 3, 42, 42, MAT.titan); fillR(5, 5, 38, 2, rgba(SKY, 0.8)); pipe(6, 40, 20, 40, 2.2, MAT.titan, true); circle(24, 24, 15.5, rgba(MAT.dark.f, 0.95), MAT.titan.e); fillR(16, 30, 16, 6, MAT.soil.d); },
  A => { const sw = A.lod > 1 ? Math.sin(A.t * 1.6) * 0.8 : 0, p = 0.5 + 0.5 * Math.sin(A.t * 2); bonsaiTree(sw, 1.15); circle(24, 24, 15, rgba(MAT.glass.l, 0.16)); circle(19, 19, 4, 'rgba(236,231,220,0.22)'); ring(24, 24, 15.5, 1.2, rgba(SKY, A.working ? 0.5 + 0.3 * p : 0.25)); statusLamp(40, 8, 1.6, A); });
def('algae_farm', () => {
  plate(2, 2, 140, 140, MAT.paint); hatch(6, 130, 40, 6, 3); stripe(50, 131, 14, 3);
  const race = (x, y, w, h) => { fillR(x, y, w, h, MAT.paint.d); fillR(x + 3, y + 3, w - 6, h - 6, '#4f6a45'); strokeR(x + 3, y + 3, w - 6, h - 6, MAT.paint.e); fillR(x + w * 0.3, y + h / 2 - 2, w * 0.5, 4, MAT.paint.f); strokeR(x + w * 0.3, y + h / 2 - 2, w * 0.5, 4, MAT.paint.e); };
  race(8, 8, 128, 54); race(8, 68, 128, 54);
  pipe(72, 62, 72, 68, 3, MAT.steel, false); pipe(120, 128, 136, 128, 3, MAT.steel, true);
}, A => { for (const y of [35, 95]) { wheel(36, y, 9, 6, A.ph.a * 1.5, MAT.steel, 2.5); if (A.lod > 1 && A.working) for (let i = 0; i < 2; i++) { const p = (A.t * 0.8 + i * 0.5) % 1; ring(36, y, 10 + p * 8, 1, rgba(BONE, 0.2 * (1 - p))); } } statusLamp(132, 132, 3, A); });
def('greenhouse', () => {
  plate(2, 2, 140, 140, MAT.paint);
  fillR(8, 8, 128, 116, MAT.soil.d); for (let j = 0; j < 5; j++) { fillR(14, 14 + j * 22, 116, 12, MAT.leaf.d); for (let i = 0; i < 10; i++) circle(20 + i * 12, 20 + j * 22, 4, MAT.leaf.f, MAT.leaf.e); }
  c.save(); c.globalAlpha = 0.42; fillR(8, 8, 128, 116, MAT.glass.f); c.restore();
  for (let i = 1; i < 8; i++) line(8 + i * 16, 8, 8 + i * 16, 124, MAT.paint.l, 1.4); for (let j = 1; j < 4; j++) line(8, 8 + j * 29, 136, 8 + j * 29, MAT.paint.l, 1.4);
  for (let i = 0; i < 4; i++) fillR(10 + i * 32, 10, 12, 8, rgba(BONE, 0.12));
  line(72, 8, 72, 124, MAT.paint.e, 2.5); strokeR(8, 8, 128, 116, MAT.paint.e, 2);
  fillR(62, 124, 20, 14, MAT.dark.f); strokeR(62, 124, 20, 14, MAT.paint.e); hatch(90, 128, 40, 6, 3); stripe(12, 129, 14, 3);
  circle(20, 20, 7, MAT.paint.d, MAT.paint.e); circle(124, 20, 7, MAT.paint.d, MAT.paint.e);
}, A => { for (const x of [20, 124]) for (let i = 0; i < 3; i++) { const a = A.ph.a * 5 + i * 2.09; line(x, 20, x + Math.cos(a) * 5.5, 20 + Math.sin(a) * 5.5, MAT.paint.l, 1.6); } statusLamp(134, 134, 3, A); });

/* ── excavation & deposits ── */
def('borer', () => {
  const W = P.W, t = P.tier, tr = tierTrim(t), tb = W * 0.13;
  fillR(W * 0.66, 3, W * 0.34 - 3, W - 6, rgba(INK, 0.3));
  fins(3, 3, W * 0.62, tb, Math.round(W / 8), true, MAT.dark); fins(3, W - 3 - tb, W * 0.62, tb, Math.round(W / 8), true, MAT.dark);
  machineBody(6, 3 + tb + 1, W * 0.58, W - 2 * tb - 8, undefined, t);
  if (t === 2) { cylinder(W * 0.18, W * 0.5, W * 0.1, MAT.iron); chimney(W * 0.34, W * 0.34, W * 0.045, MAT.iron); }
  else if (t === 3) fins(W * 0.1, W * 0.42, W * 0.22, W * 0.16, 5, false, MAT.iron);
  else if (t === 5) { dome(W * 0.2, W * 0.5, W * 0.08, rgba(CYAN, 0.7)); fins(W * 0.34, W * 0.42, W * 0.14, W * 0.16, 4, false, MAT.steel); }
  else { ring(W * 0.22, W * 0.5, W * 0.08, 2.5, rgba(VIOLET, 0.7)); ring(W * 0.22, W * 0.5, W * 0.04, 1.5, rgba(CYAN, 0.7)); }
  fillR(W * 0.6, W * 0.4, W * 0.14, W * 0.2, tr.d); strokeR(W * 0.6, W * 0.4, W * 0.14, W * 0.2, tr.e);
}, A => {
  const W = P.W, t = P.tier, cx = W * 0.79, cy = W / 2, r = W * 0.19, a = A.ph.a * 2.2, m = t <= 3 ? MAT.iron : t === 5 ? MAT.titan : MAT.quantum;
  gear(cx, cy, r, 14, a, m, 0.2);
  for (let i = 0; i < 3; i++) arcSeg(cx, cy, r * (0.35 + i * 0.18), a + i * 2.1, a + i * 2.1 + 1.4, rgba(m.l, 0.8), Math.max(P.hair, r * 0.08));
  for (let i = 0; i < 8; i++) dot(cx + Math.cos(a + i * PI / 4) * r * 0.62, cy + Math.sin(a + i * PI / 4) * r * 0.62, Math.max(0.7, r * 0.06), m.e);
  if (t === 5) glow(cx, cy, r * 0.5, CYAN, 0.35 + 0.15 * Math.sin(A.t * 6)); else if (t === 7) glow(cx, cy, r * 0.5, VIOLET, 0.4 + 0.2 * Math.sin(A.t * 5));
  if (A.lod > 1 && A.working) { const tb = W * 0.13, off = (A.ph.a * 6) % 8; for (let x = 3 + off; x < W * 0.62; x += 8) { line(x, 4, x, 2 + tb, rgba(BONE, 0.2), Math.max(P.hair, 1)); line(x, W - 2 - tb, x, W - 4, rgba(BONE, 0.2), Math.max(P.hair, 1)); } }
  statusLamp(W * 0.55, W * 0.28, Math.max(1.8, W * 0.026), A);
});
def('drill', () => {
  const W = P.W, t = P.tier, r = P.rnd;
  if (t === 0) {
    fillR(2, 2, W - 4, W - 4, MAT.soil.f); strokeR(2, 2, W - 4, W - 4, MAT.soil.e);
    const pit = [12, 18, 56, 8, 88, 30, 84, 70, 50, 88, 10, 66];
    poly(pit, MAT.stone.d, MAT.stone.e); poly(shrink(pit, 0.62), MAT.dark.f, MAT.stone.e);
    ladder(20, 30, 40, 48, 5, MAT.wood);
    post(48, 14, 3.5, MAT.wood2); post(48, 82, 3.5, MAT.wood2); line(48, 14, 48, 82, MAT.wood.f, 3);
    for (let i = 0; i < 10; i++) dot(70 + r() * 18, 10 + r() * 16, 1.8 + r(), i % 2 ? MAT.stone.l : MAT.copper.f);
    line(74, 74, 88, 62, MAT.wood2.f, 2); arcSeg(88, 62, 6, PI * 0.9, PI * 1.9, MAT.iron.f, 2.5);
  } else if (t === 1) {
    cobbles(2, 2, W - 4, W - 4, 8, MAT.stone, r);
    fillR(10, 10, 44, 44, MAT.dark.f); strokeR(10, 10, 44, 44, INK);
    for (let i = 0; i < 4; i++) line(10 + i * 14.6, 10, 10 + i * 14.6, 54, MAT.wood.f, 3); line(10, 12, 54, 12, MAT.wood.f, 4);
    line(24, 62, 90, 62, MAT.iron.d, 1.4); line(24, 70, 90, 70, MAT.iron.d, 1.4); for (let x = 26; x < 90; x += 8) line(x, 60, x, 72, MAT.wood2.f, 2);
    post(70, 20, 3, MAT.wood2);
  } else if (t === 4) {
    fillR(2, 2, W - 4, W - 4, MAT.soil.f); strokeR(2, 2, W - 4, W - 4, MAT.soil.e);
    fins(10, 20, 16, 100, 12, false, MAT.dark); fins(118, 20, 16, 100, 12, false, MAT.dark);
    machineBody(26, 30, 92, 80, undefined, 4);
    for (let i = 0; i < 12; i++) dot(30 + r() * 84, 116 + r() * 22, 2 + r() * 1.5, i % 3 ? MAT.stone.l : MAT.copper.f);
  } else {
    const m = tierMat(t), tr = tierTrim(t);
    plate(2, 2, W - 4, W - 4, m); if (t <= 3) rivets(2, 2, W - 4, W - 4, 3, 12, m); else seamH(4, W / 2, W - 8, m);
    const f0 = W * 0.22, f1 = W * 0.78;
    strokeR(f0, f0, f1 - f0, f1 - f0, tr.e, 4.5); strokeR(f0, f0, f1 - f0, f1 - f0, tr.f, 2.6); line(f0, f0, f1, f1, tr.f, 2.2); line(f1, f0, f0, f1, tr.f, 2.2); strokeR(W * 0.35, W * 0.35, W * 0.3, W * 0.3, tr.f, 2.2);
    circle(W / 2, W / 2, W * 0.1, INK, tr.e);
    if (t === 2) { cylinder(W * 0.13, W * 0.15, W * 0.08, MAT.iron); chimney(W * 0.3, W * 0.11, W * 0.045, MAT.iron); }
    else if (t === 3) fins(W * 0.06, W * 0.06, W * 0.2, W * 0.13, 5, false, MAT.iron);
    else if (t === 5) dome(W * 0.13, W * 0.13, W * 0.07, rgba(CYAN, 0.7));
    else if (t === 6) { cylinder(W * 0.13, W * 0.14, W * 0.08, MAT.steel); for (let i = 0; i < 12; i++) { const a = i * PI / 6; line(W * 0.13 + Math.cos(a) * W * 0.085, W * 0.14 + Math.sin(a) * W * 0.085, W * 0.13 + Math.cos(a) * W * 0.105, W * 0.14 + Math.sin(a) * W * 0.105, rgba(SKY, 0.8)); } }
    else { ring(W * 0.13, W * 0.13, W * 0.06, 2.5, rgba(VIOLET, 0.7)); ring(W * 0.13, W * 0.13, W * 0.03, 1.5, rgba(CYAN, 0.7)); }
    for (let i = 0; i < 8; i++) dot(W * 0.8 + r() * W * 0.14, W * 0.8 + r() * W * 0.14, W * 0.02, i % 3 ? MAT.stone.l : MAT.copper.f);
  }
}, A => {
  const W = P.W, t = P.tier;
  if (t === 0) { const cyc = Math.sin(A.ph.a * 1.2) * 0.5 + 0.5, y = 26 + cyc * 44; line(48, 14, 48, 82, MAT.rope.f, 1); circle(48, y, 3.5, MAT.wood2.f, MAT.wood.e); }
  else if (t === 1) { const x = 30 + (Math.sin(A.ph.a) * 0.5 + 0.5) * 52; fillR(x - 7, 61, 14, 10, MAT.iron.f); strokeR(x - 7, 61, 14, 10, MAT.iron.e); dot(x - 4, 72, 1.6, INK); dot(x + 4, 72, 1.6, INK); lamp(70, 20, 2, AMBER, true); }
  else if (t === 4) {
    const a = Math.sin(A.ph.a * 0.4) * 0.5 - 0.3;
    c.save(); c.translate(72, 70); c.rotate(a);
    box(-22, -18, 44, 36, 5, MAT.paint); hatch(-20, 10, 18, 4, 2.5); fins(2, -14, 16, 10, 4, false, MAT.iron);
    line(20, 0, 62, -10, MAT.paint.e, 7); line(20, 0, 62, -10, MAT.paint.f, 5); line(62, -10, 70, 8, MAT.paint.e, 5); line(62, -10, 70, 8, MAT.paint.f, 3.4);
    poly([66, 6, 78, 4, 80, 14, 70, 16], MAT.iron.f, MAT.iron.e); for (let i = 0; i < 3; i++) dot(72 + i * 3.5, 15.5, 1, MAT.iron.e);
    c.restore(); statusLamp(W - 12, 12, 3.4, A);
  } else {
    const cx = W / 2, cy = W / 2, r = W * 0.09, a = A.ph.a * 4;
    circle(cx, cy, r, MAT.steel.f, MAT.steel.e); for (let i = 0; i < 3; i++) arcSeg(cx, cy, r * 0.6, a + i * 2.1, a + i * 2.1 + 1.2, MAT.steel.e, Math.max(P.hair, r * 0.25)); dot(cx, cy, r * 0.2, MAT.steel.e);
    const p = 0.3 + 0.15 * Math.sin(A.t * 6);
    if (t === 5) glow(cx, cy, r * 2, CYAN, p); else if (t === 6) glow(cx, cy, r * 2, SKY, p); else if (t === 7) glow(cx, cy, r * 2, VIOLET, p);
    statusLamp(W * 0.9, W * 0.1, Math.max(1.8, W * 0.026), A);
  }
});
def('pumpjack', () => {
  plate(2, 2, 92, 92, MAT.steel); rivets(2, 2, 92, 92, 3, 14, MAT.steel);
  circle(18, 48, 8, MAT.iron.f, MAT.iron.e); ring(18, 48, 4, 1.5, MAT.iron.d);
  fins(64, 62, 26, 16, 6, true, MAT.iron); fillR(46, 40, 8, 16, MAT.steel.d); strokeR(46, 40, 8, 16, MAT.steel.e);
  box(56, 22, 20, 18, 4, MAT.steel);
}, A => {
  const a = Math.sin(A.ph.a * 1.5) * 0.14;
  c.save(); c.translate(50, 48); c.rotate(a); line(-34, 0, 34, 0, MAT.steel.e, 7); line(-34, 0, 34, 0, MAT.steel.f, 5); poly([-34, -7, -26, -7, -24, 7, -36, 7], MAT.steel.d, MAT.steel.e); c.restore();
  wheel(66, 31, 7, 4, A.ph.a * 1.5, MAT.iron); line(66 + Math.cos(A.ph.a * 1.5) * 5, 31 + Math.sin(A.ph.a * 1.5) * 5, 82, 48 - a * 30, MAT.iron.d, 1.6);
  statusLamp(88, 8, 2.5, A);
});
def('gas_well', () => {
  plate(2, 2, 92, 92, MAT.paint); seamH(4, 48, 88, MAT.paint); hatch(6, 84, 40, 6, 3);
  pipe(30, 30, 30, 70, 4, MAT.steel, true); pipe(30, 70, 70, 70, 4, MAT.steel, true); pipe(70, 70, 74, 54, 3, MAT.steel, false);
  circle(30, 30, 9, MAT.steel.f, MAT.steel.e); ring(30, 30, 6, 1.6, MAT.iron.f); line(24, 30, 36, 30, MAT.iron.f, 1.2); line(30, 24, 30, 36, MAT.iron.f, 1.2);
  circle(30, 50, 7, MAT.steel.f, MAT.steel.e); ring(30, 50, 4.5, 1.4, MAT.iron.f);
  cylinder(74, 40, 14, MAT.paint); chimney(84, 12, 5, MAT.steel);
}, A => { if (A.working) flame(84, 12, 3.5, A, 2); else dot(84, 12, 1.2, rgba(AMBER, 0.7)); statusLamp(10, 10, 2.5, A); });
def('brine_pump', () => {
  plate(2, 2, 92, 92, MAT.concrete); for (let i = 0; i < 3; i++) seamH(4, 24 + i * 24, 88, MAT.concrete);
  fillR(8, 40, 50, 46, MAT.concrete.d); fillR(11, 43, 44, 40, '#4f7d7a'); strokeR(11, 43, 44, 40, MAT.concrete.e);
  machineBody(60, 8, 30, 40, undefined, 6); fins(64, 12, 22, 12, 5, true, MAT.steel);
  pipe(70, 48, 70, 62, 4, MAT.steel, true); pipe(70, 62, 34, 62, 4, MAT.steel, false);
  circle(24, 20, 9, MAT.steel.f, MAT.steel.e); ring(24, 20, 5.5, 1.6, MAT.iron.f); stripe(10, 30, 14, 3);
}, A => { if (A.lod > 1 && A.working) { const p = (A.t * 1.2) % 1; ring(34, 62, 4 + p * 10, 1, rgba(BONE, 0.3 * (1 - p))); } statusLamp(86, 12, 2.5, A); });
def('he3_collector', () => {
  plate(2, 2, 92, 92, MAT.quantum); line(48, 4, 48, 92, rgba(VIOLET, 0.45)); line(4, 48, 92, 48, rgba(VIOLET, 0.45));
  [[8, 8], [88, 8], [8, 88], [88, 88]].forEach(p => pipe(p[0], p[1], 48 + (p[0] - 48) * 0.62, 48 + (p[1] - 48) * 0.62, 3, MAT.titan, true));
  cylinder(48, 48, 30, MAT.quantum);
  for (let i = 0; i < 20; i++) { const a = i * TAU / 20; line(48 + Math.cos(a) * 31, 48 + Math.sin(a) * 31, 48 + Math.cos(a) * 35, 48 + Math.sin(a) * 35, rgba(SKY, 0.8), 1.2); }
  ring(48, 48, 22, 1.5, rgba(CYAN, 0.5)); ring(48, 48, 12, 1.5, rgba(CYAN, 0.5));
}, A => { const a = A.ph.a * 0.8; for (let i = 0; i < 3; i++) arcSeg(48, 48, 17, a + i * TAU / 3, a + i * TAU / 3 + 1.2, rgba(CYAN, 0.8), 2.5); glow(48, 48, 10, VIOLET, 0.4 + 0.2 * Math.sin(A.t * 3)); circle(48, 48, 4, rgba(CYAN, 0.9)); statusLamp(86, 10, 2.5, A); });

/* ── process ── */
def('workbench', () => {
  box(4, 8, 40, 36, 5, MAT.wood); planks(5, 9, 38, 30, 4, true, MAT.wood);
  fillR(34, 6, 8, 8, MAT.iron.f); strokeR(34, 6, 8, 8, MAT.iron.e); ring(38, 10, 2.5, 1.2, MAT.iron.d);
  poly([10, 14, 26, 10, 26, 13, 12, 17], MAT.steel.f, MAT.steel.e); dot(8, 36, 1, MAT.wood2.e); dot(40, 36, 1, MAT.wood2.e);
}, A => { const y = A.working ? Math.max(0, Math.sin(A.ph.a * 4)) * 3 : 0; line(12, 32 - y * 0.3, 24, 20 - y, MAT.wood2.f, 2); fillR(22, 16 - y, 7, 5, MAT.iron.f); strokeR(22, 16 - y, 7, 5, MAT.iron.e); });
def('charcoal_pit', () => {
  fillR(2, 2, 92, 92, MAT.soil.f); strokeR(2, 2, 92, 92, MAT.soil.e);
  circle(44, 48, 32, MAT.soil.d, MAT.soil.e); circle(44, 48, 24, '#5a4b39'); circle(44, 48, 14, '#3f3429');
  for (let i = 0; i < 6; i++) dot(44 + Math.cos(i) * 20, 48 + Math.sin(i) * 20, 2, INK);
  log(80, 8, 24, 3.5, false, MAT.wood); log(88, 12, 22, 3.2, false, MAT.wood); log(6, 84, 26, 3.2, true, MAT.wood); log(40, 86, 20, 3, true, MAT.wood);
}, A => { for (let i = 0; i < 6; i++) { const x = 44 + Math.cos(i) * 20, y = 48 + Math.sin(i) * 20; if (A.working) glow(x, y, 4, FIRE, 0.5 + 0.4 * Math.sin(i * 3 + A.t * 5)); } shimmer(44, 40, 10, A); });
def('stone_furnace', () => { box(4, 4, 40, 40, 8, MAT.stone); cobbles(5, 5, 38, 30, 4, MAT.stone, P.rnd); fillR(16, 36, 16, 8, INK); chimney(24, 18, 7, MAT.stone); },
  A => { if (A.working) { const p = 0.5 + 0.3 * Math.sin(A.t * 13); fillR(17, 37, 14, 6, rgba(FIRE, p)); dot(24, 40, 2 + Math.sin(A.t * 9), AMBER); circle(24, 18, 4, rgba(FIRE, 0.25 + 0.2 * Math.sin(A.t * 7))); } shimmer(24, 18, 7, A); });
def('kiln', () => {
  fillR(3, 3, 42, 42, MAT.soil.f); strokeR(3, 3, 42, 42, MAT.soil.e);
  circle(24, 24, 18, MAT.brick.f, MAT.brick.e); ring(24, 24, 13, P.hair, rgba(MAT.brick.e, 0.6)); ring(24, 24, 8, P.hair, rgba(MAT.brick.e, 0.6));
  for (let i = 0; i < 10; i++) { const a = i * TAU / 10; line(24 + Math.cos(a) * 8, 24 + Math.sin(a) * 8, 24 + Math.cos(a) * 18, 24 + Math.sin(a) * 18, rgba(MAT.brick.e, 0.5)); }
  circle(24, 24, 4.5, INK, MAT.brick.e); fillR(19, 36, 10, 7, INK);
}, A => { if (A.working) { glow(24, 24, 5, FIRE, 0.5 + 0.3 * Math.sin(A.t * 8)); fillR(20, 37, 8, 5, rgba(FIRE, 0.5 + 0.3 * Math.sin(A.t * 11))); } shimmer(24, 22, 6, A); });
def('tannery', () => {
  fillR(2, 2, 92, 92, MAT.soil.f); strokeR(2, 2, 92, 92, MAT.soil.e);
  for (let i = 0; i < 3; i++) { circle(20 + i * 28, 70, 11, MAT.wood.f, MAT.wood.e); ring(20 + i * 28, 70, 10, 1.4, MAT.iron.f); circle(20 + i * 28, 70, 8.5, i === 1 ? '#5a4a30' : '#6b4a32'); }
  const frame = (x, y) => { strokeR(x, y, 30, 34, MAT.wood2.f, 2.5); poly([x + 5, y + 5, x + 25, y + 4, x + 26, y + 28, x + 4, y + 30], MAT.leather.f, MAT.leather.e); line(x + 5, y + 5, x, y, MAT.rope.f, 1); line(x + 25, y + 4, x + 30, y, MAT.rope.f, 1); line(x + 26, y + 28, x + 30, y + 34, MAT.rope.f, 1); line(x + 4, y + 30, x, y + 34, MAT.rope.f, 1); };
  frame(8, 8); frame(54, 8);
});
def('bronze_forge', () => {
  fillR(2, 2, 92, 92, MAT.stone.d); strokeR(2, 2, 92, 92, MAT.stone.e);
  box(8, 8, 46, 40, 8, MAT.brick); bricks(9, 9, 44, 30, 8, 4, MAT.brick); circle(31, 24, 10, INK, MAT.brick.e); chimney(46, 14, 5, MAT.stone);
  circle(72, 30, 8, MAT.wood.l, MAT.wood.e); poly([64, 28, 82, 28, 80, 32, 66, 32], MAT.iron.f, MAT.iron.e);
  for (let i = 0; i < 4; i++) { fillR(60 + (i % 2) * 12, 60 + Math.floor(i / 2) * 7, 10, 5, MAT.bronze.f); strokeR(60 + (i % 2) * 12, 60 + Math.floor(i / 2) * 7, 10, 5, MAT.bronze.e); }
  cylinder(20, 72, 9, MAT.wood2); circle(20, 72, 6.5, MAT.water.f);
}, A => {
  if (A.working) { glow(31, 24, 8, FIRE, 0.6 + 0.3 * Math.sin(A.t * 11)); circle(31, 24, 3 + Math.sin(A.t * 9), rgba(AMBER, 0.8)); }
  const b = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(A.ph.a * 2.5)); poly([56, 18, 56 + 22 * b, 14, 56 + 22 * b, 30, 56, 26], MAT.leather.f, MAT.leather.e); line(56 + 22 * b, 14, 56 + 22 * b, 30, MAT.wood2.f, 2);
  shimmer(46, 14, 5, A);
});
def('trip_hammer', () => {
  fillR(2, 2, 92, 92, MAT.stone.d); strokeR(2, 2, 92, 92, MAT.stone.e);
  line(14, 20, 82, 20, MAT.wood.f, 5); line(14, 76, 82, 76, MAT.wood.f, 5); [[14, 20], [82, 20], [14, 76], [82, 76]].forEach(p => post(p[0], p[1], 4, MAT.wood2));
  box(64, 40, 18, 16, 4, MAT.iron); line(24, 20, 24, 76, MAT.wood2.f, 3);
}, A => {
  const a = A.ph.a * 2, lift = Math.max(0, Math.sin(a * 2 + 1));
  gear(24, 48, 13, 8, a, MAT.bronze);
  c.save(); c.translate(40, 48); c.rotate(-lift * 0.25); line(0, 0, 34, 0, MAT.wood.e, 6); line(0, 0, 34, 0, MAT.wood.f, 4); fillR(28, -6, 10, 12, MAT.iron.f); strokeR(28, -6, 10, 12, MAT.iron.e); c.restore();
  post(40, 48, 3.5, MAT.wood2);
});
def('sawmill', () => {
  planks(2, 2, 92, 92, 8, true, MAT.wood2);
  line(10, 40, 86, 40, MAT.iron.d, 1.4); line(10, 54, 86, 54, MAT.iron.d, 1.4);
  for (let i = 0; i < 4; i++) { fillR(12, 64 + i * 5, 40, 4, MAT.wood.l); strokeR(12, 64 + i * 5, 40, 4, MAT.wood.e); }
  box(66, 62, 24, 22, 4, MAT.bronze);
}, A => {
  const a = A.ph.a * 3, x = 20 + (0.5 + 0.5 * Math.sin(A.ph.a * 0.8)) * 30;
  log(x, 47, 30, 5, true, MAT.wood); gear(48, 34, 12, 24, a, MAT.steel, 0.14); gear(78, 73, 6, 8, -a * 0.5, MAT.bronze);
});
def('millstone', () => {
  fillR(2, 2, 92, 92, MAT.stone.d); strokeR(2, 2, 92, 92, MAT.stone.e); box(8, 8, 60, 60, 6, MAT.wood);
  poly([72, 10, 90, 10, 86, 30, 76, 30], MAT.wood.f, MAT.wood.e); poly([76, 14, 86, 14, 84, 26, 78, 26], MAT.dark.f);
  ellipse(80, 70, 9, 12, 0, MAT.rope.f, MAT.rope.e); line(74, 60, 86, 60, MAT.rope.d, 1.2);
}, A => { const a = A.ph.a * 1.2; circle(38, 35, 24, MAT.stone.f, MAT.stone.e); for (let i = 0; i < 8; i++) { const t0 = a + i * PI / 4; line(38 + Math.cos(t0) * 6, 35 + Math.sin(t0) * 6, 38 + Math.cos(t0) * 22, 35 + Math.sin(t0) * 22, rgba(MAT.stone.e, 0.7), 1.2); } circle(38, 35, 5, MAT.dark.f, MAT.stone.e); gear(38, 35, 4, 6, -a * 2, MAT.bronze); });
def('steam_hammer', () => {
  plate(2, 2, 92, 92, MAT.iron); rivets(2, 2, 92, 92, 3, 14, MAT.iron);
  box(12, 8, 14, 60, 5, MAT.iron); box(52, 8, 14, 60, 5, MAT.iron); rivets(12, 8, 14, 55, 3, 10, MAT.iron); rivets(52, 8, 14, 55, 3, 10, MAT.iron); line(12, 12, 66, 12, MAT.iron.d, 6);
  box(28, 46, 22, 16, 5, MAT.steel);
  cylinder(80, 30, 12, MAT.iron); chimney(80, 62, 6, MAT.iron); pipe(80, 42, 80, 56, 3, MAT.iron, true); pipe(68, 30, 60, 22, 3, MAT.iron, false);
  circle(66, 78, 3.5, BONE2, INK); line(66, 78, 68, 75.5, VERM, 1);
}, A => {
  const cyc = A.working ? Math.pow(Math.max(0, Math.sin(A.ph.a * 3)), 4) : 0, y = 18 + cyc * 22;
  line(39, 14, 39, y, MAT.steel.f, 5); fillR(31, y, 16, 12, MAT.steel.d); strokeR(31, y, 16, 12, MAT.steel.e);
  if (cyc > 0.92 && A.lod > 1) for (let i = 0; i < 3; i++) line(39, 50, 39 + (i - 1) * 8, 44 - i * 2, AMBER, 1);
  shimmer(80, 62, 6, A); statusLamp(10, 86, 2.5, A);
});
def('blast_furnace', () => {
  fillR(2, 2, 140, 140, MAT.stone.d); strokeR(2, 2, 140, 140, MAT.stone.e);
  pipe(104, 30, 84, 44, 4, MAT.iron, true); pipe(104, 70, 88, 76, 4, MAT.iron, true);
  cylinder(64, 64, 40, MAT.brick); for (let i = 0; i < 3; i++) ring(64, 64, 38 - i * 11, 3, MAT.iron.f); circle(64, 64, 14, INK, MAT.iron.e);
  cylinder(118, 30, 16, MAT.iron); cylinder(118, 70, 16, MAT.iron); chimney(118, 112, 10, MAT.brick);
  fillR(20, 108, 60, 10, MAT.dark.f); strokeR(20, 108, 60, 10, MAT.iron.e); fillR(22, 110, 56, 6, MAT.stone.d);
  stripe(6, 130, 14, 3);
}, A => {
  if (A.working) { glow(64, 64, 16, FIRE, 0.55 + 0.25 * Math.sin(A.t * 4)); circle(64, 64, 7, rgba(AMBER, 0.7 + 0.2 * Math.sin(A.t * 6))); fillR(24, 111, 52, 4, rgba(FIRE, 0.5 + 0.2 * Math.sin(A.t * 3))); }
  shimmer(118, 112, 10, A); shimmer(64, 48, 10, A); statusLamp(10, 120, 3.5, A);
});
def('coke_oven', () => {
  box(4, 4, 88, 88, 14, MAT.brick); bricks(5, 5, 86, 72, 8, 4, MAT.brick); line(4, 50, 92, 50, MAT.iron.f, 3);
  for (let i = 0; i < 4; i++) { circle(18 + i * 20, 30, 5.5, MAT.iron.f, MAT.iron.e); circle(18 + i * 20, 30, 3, INK); fillR(12 + i * 20, 79, 12, 10, MAT.iron.d); strokeR(12 + i * 20, 79, 12, 10, MAT.iron.e); fillR(14 + i * 20, 81, 8, 6, INK); }
  chimney(80, 62, 7, MAT.iron);
}, A => { if (A.working) for (let i = 0; i < 4; i++) fillR(14 + i * 20, 81, 8, 6, rgba(FIRE, 0.45 + 0.35 * Math.sin(A.t * 7 + i))); shimmer(80, 62, 7, A); statusLamp(10, 10, 2.5, A); });
def('crusher', () => {
  machineBody(3, 3, 90, 90, undefined, 2);
  poly([8, 8, 44, 8, 38, 40, 14, 40], MAT.iron.d, MAT.iron.e); poly([14, 14, 38, 14, 34, 34, 18, 34], INK);
  fins(56, 60, 30, 18, 6, true, MAT.iron); fillR(50, 20, 40, 14, MAT.dark.f); strokeR(50, 20, 40, 14, MAT.iron.e);
}, A => { const a = A.ph.a * 2.5; gear(28, 60, 12, 16, a, MAT.steel, 0.2); gear(54, 60, 12, 16, -a + 0.2, MAT.steel, 0.2); if (A.lod > 1 && A.working) for (let i = 0; i < 4; i++) dot(52 + ((A.t * 20 + i * 9) % 36), 27 + (i % 2) * 3, 1.5, MAT.stone.l); statusLamp(86, 10, 2.5, A); });
def('press', () => {
  machineBody(3, 3, 90, 90, undefined, 3);
  box(10, 10, 14, 66, 4, MAT.steel); box(72, 10, 14, 66, 4, MAT.steel); fillR(24, 12, 48, 10, MAT.steel.d); strokeR(24, 12, 48, 10, MAT.steel.e);
  fillR(30, 50, 36, 22, MAT.dark.f); strokeR(30, 50, 36, 22, MAT.steel.e);
  fins(28, 78, 24, 10, 5, true, MAT.iron); pipe(52, 83, 70, 83, 2.5, MAT.steel, true); pipe(70, 83, 79, 76, 2.5, MAT.steel, false); hatch(56, 76, 30, 5, 3);
}, A => { const cyc = A.working ? Math.pow(0.5 + 0.5 * Math.sin(A.ph.a * 2), 3) : 0, y = 24 + cyc * 20; line(48, 22, 48, y, MAT.steel.d, 6); line(48, 22, 48, y, MAT.steel.l, 2); fillR(36, y, 24, 12, MAT.steel.f); strokeR(36, y, 24, 12, MAT.steel.e); statusLamp(86, 10, 2.5, A); });
def('lathe', () => { plate(3, 3, 42, 42, MAT.steel); rivets(3, 3, 42, 42, 3, 10, MAT.steel); box(6, 18, 36, 14, 3, MAT.iron); box(6, 12, 12, 20, 3, MAT.steel); fillR(34, 20, 8, 8, MAT.steel.d); strokeR(34, 20, 8, 8, MAT.steel.e); fillR(22, 30, 6, 6, MAT.iron.f); strokeR(22, 30, 6, 6, MAT.iron.e); },
  A => { const a = A.ph.a * 5; line(23, 24, 34, 24, MAT.bronze.f, 3); circle(18, 24, 5, MAT.steel.d, MAT.steel.e); for (let i = 0; i < 3; i++) line(18, 24, 18 + Math.cos(a + i * 2.09) * 5, 24 + Math.sin(a + i * 2.09) * 5, MAT.steel.l, 1.4); statusLamp(40, 8, 1.8, A); });
def('wiremill', () => { plate(3, 3, 42, 42, MAT.steel); rivets(3, 3, 42, 42, 3, 10, MAT.steel); box(6, 16, 12, 16, 3, MAT.iron); fillR(8, 18, 8, 4, MAT.dark.f); line(18, 24, 30, 24, MAT.copper.f, 1.4); },
  A => { const a = A.ph.a * 3; circle(34, 24, 8, MAT.copper.d, MAT.copper.e); for (let i = 0; i < 5; i++) ring(34, 24, 2 + i * 1.3, 0.8, i % 2 ? MAT.copper.f : MAT.copper.l); line(34, 24, 34 + Math.cos(a) * 8, 24 + Math.sin(a) * 8, MAT.iron.e, 1.2); statusLamp(40, 8, 1.8, A); });
def('assembler', () => {
  machineBody(3, 3, 90, 90, undefined, 3);
  fillR(10, 46, 50, 34, MAT.dark.f); strokeR(10, 46, 50, 34, MAT.steel.e); for (let i = 0; i < 3; i++) { fillR(14 + i * 15, 60, 10, 8, MAT.bronze.f); strokeR(14 + i * 15, 60, 10, 8, MAT.bronze.e); }
  circle(72, 32, 10, MAT.steel.d, MAT.steel.e); fins(66, 62, 22, 18, 5, false, MAT.iron);
}, A => {
  const a = -2.2 + Math.sin(A.ph.a * 1.4) * 0.8, x1 = 72 + Math.cos(a) * 22, y1 = 32 + Math.sin(a) * 22, b = a + 1.1 + Math.sin(A.ph.a * 1.4 + 1) * 0.5, x2 = x1 + Math.cos(b) * 14, y2 = y1 + Math.sin(b) * 14;
  line(72, 32, x1, y1, MAT.steel.e, 7); line(72, 32, x1, y1, MAT.steel.f, 5); line(x1, y1, x2, y2, MAT.steel.e, 5); line(x1, y1, x2, y2, MAT.steel.f, 3.4);
  circle(x1, y1, 3, MAT.iron.f, MAT.iron.e); circle(x2, y2, 2.4, MAT.iron.d, MAT.iron.e); circle(72, 32, 4, MAT.iron.f, MAT.iron.e);
  statusLamp(86, 10, 2.5, A);
});
def('electric_furnace', () => { machineBody(3, 3, 42, 42, undefined, 3); fins(30, 10, 10, 20, 5, false, MAT.iron); fillR(8, 10, 20, 20, MAT.dark.f); strokeR(8, 10, 20, 20, MAT.steel.e); },
  A => { const g = A.working ? 0.55 + 0.35 * Math.sin(A.t * 3) : 0, col = g ? U.mixHex(MAT.copper.f, FIRE, g) : MAT.copper.d; for (let i = 0; i < 3; i++) strokeR(10 + i * 3, 12 + i * 3, 16 - i * 6, 16 - i * 6, col, 1.5); if (g) glow(18, 20, 10, FIRE, g * 0.6); statusLamp(40, 40, 1.8, A); });
def('mixer', () => { machineBody(3, 3, 90, 90, undefined, 3); cylinder(44, 48, 32, MAT.steel); circle(44, 48, 24, MAT.dark.f, MAT.steel.e); fins(70, 70, 20, 16, 5, true, MAT.iron); pipe(6, 20, 20, 30, 3, MAT.steel, true); pipe(82, 20, 68, 30, 3, MAT.steel, true); },
  A => { const a = A.ph.a * 2; for (let i = 0; i < 3; i++) { const t0 = a + i * TAU / 3; poly([44, 48, 44 + Math.cos(t0 - 0.3) * 22, 48 + Math.sin(t0 - 0.3) * 22, 44 + Math.cos(t0 + 0.2) * 22, 48 + Math.sin(t0 + 0.2) * 22], MAT.steel.f, MAT.steel.e); } circle(44, 48, 5, MAT.steel.d, MAT.steel.e); statusLamp(86, 10, 2.5, A); });
def('distillery', () => {
  machineBody(3, 3, 90, 90, undefined, 3);
  pipe(28, 56, 28, 66, 3, MAT.steel, true); pipe(50, 34, 56, 20, 3, MAT.steel, true); pipe(72, 44, 72, 70, 3, MAT.steel, true);
  cylinder(28, 34, 22, MAT.steel); cylinder(28, 76, 10, MAT.iron); coil(56, 14, 32, 30, 6, false, MAT.copper); circle(72, 76, 6, MAT.dark.f, MAT.steel.e);
}, A => { if (A.working && A.lod > 1) { const p = (A.t * 0.8) % 1; dot(72, 48 + p * 20, 1.6, rgba(SKY, 1 - p)); glow(28, 76, 6, FIRE, 0.3 + 0.15 * Math.sin(A.t * 5)); } statusLamp(86, 86, 2.5, A); });
def('chemical_plant', () => {
  machineBody(3, 3, 138, 138, undefined, 4);
  pipe(88, 56, 96, 42, 4, MAT.steel, true); pipe(88, 64, 96, 88, 4, MAT.steel, true); pipe(112, 54, 112, 76, 4, MAT.steel, true); pipe(52, 92, 52, 118, 4, MAT.steel, true);
  cylinder(52, 56, 36, MAT.paint); fins(40, 8, 24, 14, 5, true, MAT.iron); cylinder(112, 34, 20, MAT.steel); cylinder(112, 96, 20, MAT.steel);
  chimney(24, 118, 9, MAT.steel); hatch(48, 126, 60, 6, 3);
}, A => { const a = A.ph.a * 2.5; for (let i = 0; i < 4; i++) line(52, 56, 52 + Math.cos(a + i * PI / 2) * 10, 56 + Math.sin(a + i * PI / 2) * 10, MAT.steel.l, 2); circle(52, 56, 3, MAT.steel.d, MAT.steel.e); shimmer(24, 118, 9, A); statusLamp(134, 10, 3.5, A); });
def('refinery', () => {
  machineBody(3, 3, 138, 138, undefined, 4);
  for (let i = 0; i < 3; i++) pipe(10, 80 + i * 8, 134, 80 + i * 8, 2.6, MAT.steel, false);
  pipe(30, 62, 30, 78, 3, MAT.steel, true); pipe(72, 54, 72, 78, 3, MAT.steel, true); pipe(106, 54, 106, 78, 3, MAT.steel, true);
  cylinder(30, 40, 22, MAT.steel); cylinder(72, 36, 18, MAT.steel); cylinder(106, 40, 14, MAT.steel);
  box(14, 106, 40, 26, 6, MAT.iron); fins(18, 110, 32, 14, 6, true, MAT.iron); chimney(124, 118, 8, MAT.steel); hatch(66, 120, 44, 6, 3);
}, A => { if (A.working) flame(124, 118, 5, A, 1); else dot(124, 118, 1.5, rgba(AMBER, 0.7)); statusLamp(134, 10, 3.5, A); });
def('electrolyzer', () => { machineBody(3, 3, 90, 90, undefined, 4); fillR(14, 24, 60, 40, MAT.dark.f); strokeR(14, 24, 60, 40, MAT.steel.e); fins(18, 28, 52, 32, 10, true, MAT.steel); line(10, 20, 78, 20, MAT.copper.f, 3); line(10, 68, 78, 68, MAT.copper.f, 3); pipe(20, 8, 20, 20, 3, MAT.steel, true); pipe(68, 8, 68, 20, 3, MAT.steel, true); },
  A => { if (A.working && A.lod > 1) for (let i = 0; i < 4; i++) { const p = (A.t * 0.7 + i * 0.25) % 1; dot(22 + i * 14, 60 - p * 28, 1.4, rgba(BONE, 0.5 * (1 - p))); } statusLamp(86, 86, 2.5, A); });
def('centrifuge', () => { machineBody(3, 3, 90, 90, undefined, 4); cylinder(44, 48, 30, MAT.paint); circle(44, 48, 22, MAT.dark.f, MAT.steel.e); fins(70, 72, 18, 14, 4, true, MAT.iron); },
  A => { const a = A.ph.a * 6; for (let i = 0; i < 6; i++) line(44, 48, 44 + Math.cos(a + i * PI / 3) * 20, 48 + Math.sin(a + i * PI / 3) * 20, rgba(MAT.steel.l, 0.85), 1.6); ring(44, 48, 12, 1.2, MAT.steel.d); circle(44, 48, 4, MAT.steel.f, MAT.steel.e); statusLamp(86, 10, 2.5, A); });
def('compressor', () => { machineBody(3, 3, 42, 42, undefined, 4); fins(6, 8, 18, 14, 5, true, MAT.iron); pipe(24, 15, 40, 15, 2.5, MAT.steel, true); },
  A => { const a = A.ph.a * 3; wheel(32, 32, 8, 6, a, MAT.iron); line(32 + Math.cos(a) * 5, 32 + Math.sin(a) * 5, 15, 22, MAT.steel.f, 2); statusLamp(40, 8, 1.8, A); });
def('arc_furnace', () => {
  machineBody(3, 3, 138, 138, undefined, 5);
  cylinder(72, 72, 46, MAT.titan); circle(72, 72, 34, MAT.dark.f, MAT.titan.e);
  for (let i = 0; i < 3; i++) { const a = -PI / 2 + i * TAU / 3; circle(72 + Math.cos(a) * 16, 72 + Math.sin(a) * 16, 7, MAT.dark.d, MAT.steel.l); }
  poly([116, 66, 134, 60, 134, 84, 116, 78], MAT.titan.d, MAT.titan.e); fins(10, 110, 30, 22, 5, false, MAT.steel);
}, A => { if (A.working) { for (let i = 0; i < 3; i++) { const a = -PI / 2 + i * TAU / 3; jag(72 + Math.cos(a) * 16, 72 + Math.sin(a) * 16, 72, 72, 4, 3, A.t * 30 + i, rgba('#dff3ff', 0.9), 1.4); } glow(72, 72, 20, SKY, 0.5 + 0.3 * Math.sin(A.t * 23)); circle(72, 72, 8, rgba('#fff2d0', 0.7)); } statusLamp(134, 10, 3.5, A); });
def('vacuum_furnace', () => { machineBody(3, 3, 90, 90, undefined, 5); cylinder(40, 44, 28, MAT.titan); fins(70, 66, 20, 20, 5, false, MAT.steel); pipe(66, 44, 70, 60, 3, MAT.titan, true); circle(40, 44, 10, MAT.dark.f, MAT.titan.e); },
  A => { const g = A.working ? 0.5 + 0.3 * Math.sin(A.t * 2) : 0.08; dome(40, 44, 8, rgba(U.mixHex('#3b2f3f', '#e8a060', g), 0.95)); if (g > 0.2) glow(40, 44, 14, FIRE, g * 0.5); statusLamp(86, 10, 2.5, A); });
def('fabricator', () => { machineBody(3, 3, 90, 90, undefined, 5); fillR(12, 14, 60, 56, MAT.dark.f); strokeR(12, 14, 60, 56, MAT.titan.e); c.save(); c.globalAlpha = 0.3; fillR(12, 14, 60, 56, MAT.glass.f); c.restore(); line(14, 16, 70, 16, MAT.titan.l, 2); line(14, 68, 70, 68, MAT.titan.l, 2); fins(76, 20, 12, 44, 8, false, MAT.steel); },
  A => { const x = 22 + (0.5 + 0.5 * Math.sin(A.ph.a * 1.3)) * 40, y = 24 + (0.5 + 0.5 * Math.sin(A.ph.a * 0.9 + 1)) * 36; line(x, 16, x, 68, MAT.titan.f, 3); fillR(x - 4, y - 4, 8, 8, MAT.titan.l); strokeR(x - 4, y - 4, 8, 8, MAT.titan.e); if (A.working) dot(x, y + 5, 1.5, CYAN); statusLamp(86, 86, 2.5, A); });
def('enrichment_centrifuge', () => {
  machineBody(3, 3, 138, 138, undefined, 6);
  for (let j = 0; j < 4; j++) pipe(14, 22 + j * 28, 122, 22 + j * 28, 2, MAT.steel, false);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) cylinder(22 + i * 28, 22 + j * 28, 11, MAT.steel);
  trefoil(126, 126, 7, OKC);
}, A => { const a = A.ph.a * 8; for (const k of [0, 5, 10, 15]) { const x = 22 + (k % 4) * 28, y = 22 + Math.floor(k / 4) * 28; line(x, y, x + Math.cos(a + k) * 6, y + Math.sin(a + k) * 6, rgba(BONE, 0.5), 1.4); } statusLamp(134, 10, 3.5, A); });
def('fuel_fabricator', () => { machineBody(3, 3, 90, 90, undefined, 6); fillR(10, 12, 56, 30, MAT.dark.f); strokeR(10, 12, 56, 30, MAT.steel.e); for (let i = 0; i < 3; i++) fillR(18 + i * 14, 20, 8, 12, MAT.steel.l); c.save(); c.globalAlpha = 0.3; fillR(10, 12, 56, 30, MAT.glass.f); c.restore(); circle(24, 60, 7, MAT.dark.f, MAT.steel.l); circle(52, 60, 7, MAT.dark.f, MAT.steel.l); trefoil(78, 20, 7, OKC); },
  A => { if (A.working) for (let i = 0; i < 3; i++) fillR(18 + i * 14, 20, 8, 12, rgba(OKC, 0.2 + 0.15 * Math.sin(A.t * 2 + i))); statusLamp(86, 86, 2.5, A); });
def('cryo_plant', () => { const r = P.rnd; machineBody(3, 3, 90, 90, undefined, 6); box(10, 10, 40, 56, 6, MAT.steel); for (let i = 0; i < 24; i++) dot(12 + r() * 36, 12 + r() * 46, 0.8 + r(), rgba(SKY, 0.55)); fins(56, 14, 30, 18, 6, true, MAT.steel); pipe(50, 40, 70, 48, 3, MAT.steel, true); cylinder(70, 62, 14, MAT.titan); },
  A => { const p = 0.5 + 0.5 * Math.sin(A.t * 1.5); if (A.working) glow(30, 36, 18, SKY, 0.25 + 0.2 * p); ring(70, 62, 9, 1.2, rgba(SKY, 0.4 + 0.3 * p)); statusLamp(86, 86, 2.5, A); });
def('nano_forge', () => {
  machineBody(3, 3, 138, 138, undefined, 7);
  const hex = [], hex2 = []; for (let i = 0; i < 6; i++) { hex.push(72 + Math.cos(i * PI / 3) * 40, 72 + Math.sin(i * PI / 3) * 40); hex2.push(72 + Math.cos(i * PI / 3) * 28, 72 + Math.sin(i * PI / 3) * 28); }
  [[18, 18], [126, 18], [18, 126], [126, 126]].forEach(p => { line(p[0], p[1], 72, 72, rgba(CYAN, 0.15), 4); line(p[0], p[1], 72, 72, rgba(CYAN, 0.45), 1.2); });
  poly(hex, MAT.quantum.d, MAT.quantum.l); poly(hex2, INK, rgba(CYAN, 0.5));
  [[18, 18], [126, 18], [18, 126], [126, 126]].forEach(p => dome(p[0], p[1], 8, rgba(VIOLET, 0.6), MAT.quantum));
}, A => { const a = A.ph.a * 0.6, p = 0.5 + 0.5 * Math.sin(A.t * 2.5); for (let i = 0; i < 6; i++) arcSeg(72, 72, 34, a + i * PI / 3, a + i * PI / 3 + 0.6, rgba(CYAN, 0.85), 2.5); glow(72, 72, 16, CYAN, 0.35 + 0.3 * p * (A.working ? 1 : 0.3)); circle(72, 72, 5, rgba('#e6fbff', 0.8)); statusLamp(134, 10, 3.5, A); });
def('matter_assembler', () => {
  machineBody(3, 3, 138, 138, undefined, 7);
  for (let i = 0; i < 3; i++) { const a = -PI / 2 + i * TAU / 3, x = 72 + Math.cos(a) * 52, y = 72 + Math.sin(a) * 52; line(x, y, 72, 72, rgba(CYAN, 0.3), 3); line(x, y, 72, 72, rgba(CYAN, 0.7), P.hair); }
  circle(72, 72, 30, MAT.quantum.d, MAT.quantum.l); ring(72, 72, 24, 1.5, rgba(VIOLET, 0.6));
  for (let i = 0; i < 3; i++) { const a = -PI / 2 + i * TAU / 3; cylinder(72 + Math.cos(a) * 52, 72 + Math.sin(a) * 52, 13, MAT.quantum); }
}, A => { const a = A.ph.a * 0.5, p = 0.5 + 0.5 * Math.sin(A.t * 2); for (let i = 0; i < 3; i++) { const t0 = a + i * TAU / 3; dot(72 + Math.cos(t0) * 18, 72 + Math.sin(t0) * 18, 3, rgba(VIOLET, 0.9)); } glow(72, 72, 12, VIOLET, 0.35 + 0.3 * p); circle(72, 72, 4, '#f0e8ff'); statusLamp(134, 10, 3.5, A); });

/* ── power ── */
def('water_wheel', () => {
  fillR(2, 2, 92, 92, MAT.stone.d); strokeR(2, 2, 92, 92, MAT.stone.e);
  fillR(4, 58, 88, 32, MAT.water.d); fillR(4, 60, 88, 28, MAT.water.f); line(4, 62, 92, 62, rgba(MAT.water.l, 0.5), 1);
  box(8, 8, 60, 44, 8, MAT.wood); planks(9, 9, 58, 17, 3, true, MAT.wood); planks(9, 27, 58, 16, 3, true, MAT.wood); line(9, 27, 67, 27, MAT.wood2.e, 1.6);
  line(38, 50, 38, 66, MAT.wood2.f, 5); gear(76, 30, 9, 8, 0.3, MAT.bronze);
}, A => {
  const off = (A.ph.a * 8) % 8;
  fillR(8, 60, 60, 28, MAT.wood2.f); strokeR(8, 60, 60, 28, MAT.wood.e);
  for (let x = 8 + off; x < 68; x += 8) { line(x, 61, x, 87, MAT.wood.e, 2); line(x + 1.5, 61, x + 1.5, 87, rgba(MAT.wood.l, 0.6), 1); }
  line(8, 64, 68, 64, MAT.wood.e, 1.2); line(8, 84, 68, 84, MAT.wood.e, 1.2); circle(38, 74, 4, MAT.iron.f, MAT.iron.e);
  if (A.lod > 1) for (let i = 0; i < 3; i++) { const p = ((A.t * 0.5 + i * 0.33) % 1); line(70 + p * 18, 66 + i * 7, 74 + p * 18, 66 + i * 7, rgba(BONE, 0.3 * (1 - p)), 1); }
}, { idle: 0.3, live: true });
def('windmill', () => {
  fillR(2, 2, 92, 92, MAT.grass.f); strokeR(2, 2, 92, 92, MAT.grass.e);
  circle(48, 52, 22, MAT.stone.f, MAT.stone.e); for (let i = 0; i < 12; i++) { const a = i * TAU / 12; line(48 + Math.cos(a) * 16, 52 + Math.sin(a) * 16, 48 + Math.cos(a) * 22, 52 + Math.sin(a) * 22, rgba(MAT.stone.e, 0.6)); }
  circle(48, 52, 16, MAT.stone.l, MAT.stone.e); ring(48, 52, 10, P.hair, rgba(MAT.stone.e, 0.5)); fillR(44, 70, 8, 6, MAT.dark.f);
}, A => {
  const a = A.ph.a * 0.9;
  for (let i = 0; i < 4; i++) { c.save(); c.translate(48, 52); c.rotate(a + i * PI / 2); fillR(6, -4, 40, 8, MAT.wood.f); strokeR(6, -4, 40, 8, MAT.wood.e); for (let k = 0; k < 5; k++) line(10 + k * 8, -4, 10 + k * 8, 4, rgba(MAT.wood.e, 0.7)); line(6, 0, 46, 0, MAT.wood2.f, 1.4); c.restore(); }
  circle(48, 52, 5, MAT.iron.f, MAT.iron.e);
}, { idle: 0.3, live: true });
def('steam_engine', () => {
  machineBody(3, 3, 90, 90, undefined, 2);
  fillR(10, 14, 50, 22, MAT.iron.f); strokeR(10, 14, 50, 22, MAT.iron.e); for (let i = 0; i < 4; i++) line(20 + i * 12, 14, 20 + i * 12, 36, MAT.iron.d, 2); line(10, 18, 60, 18, rgba(MAT.iron.l, 0.6), 2); circle(10, 25, 11, MAT.iron.d, MAT.iron.e);
  chimney(56, 24, 7, MAT.iron); box(14, 44, 30, 14, 4, MAT.steel); line(44, 50, 60, 50, MAT.steel.d, 3);
  circle(30, 70, 5, BONE2, INK); line(30, 70, 33, 67, VERM, 1);
}, A => { const a = A.ph.a * 2.5; wheel(72, 62, 18, 6, a, MAT.iron); const cx = 72 + Math.cos(a) * 10, cy = 62 + Math.sin(a) * 10; line(cx, cy, 44 + 0.4 * (cx - 62), 51, MAT.steel.f, 3); dot(cx, cy, 2.2, MAT.steel.d); shimmer(56, 24, 7, A); statusLamp(86, 10, 2.5, A); });
def('coal_plant', () => {
  const r = P.rnd; machineBody(3, 3, 138, 138, undefined, 3);
  box(10, 10, 60, 60, 10, MAT.iron); rivets(10, 10, 60, 50, 3, 12, MAT.iron); chimney(40, 40, 14, MAT.iron);
  box(80, 10, 54, 40, 8, MAT.steel); fillR(84, 16, 46, 16, MAT.steel.d); strokeR(84, 16, 46, 16, MAT.steel.e); for (let i = 0; i < 5; i++) line(90 + i * 9, 16, 90 + i * 9, 32, MAT.steel.l, 1.5);
  fillR(10, 80, 50, 50, MAT.dark.f); strokeR(10, 80, 50, 50, MAT.iron.e); for (let i = 0; i < 30; i++) dot(13 + r() * 44, 83 + r() * 44, 2, i % 3 ? '#2a2a2c' : '#3a3a3d');
  pipe(70, 40, 80, 30, 4, MAT.steel, true); pipe(110, 50, 110, 80, 4, MAT.steel, true); cylinder(110, 100, 22, MAT.steel);
  fillR(60, 100, 40, 12, MAT.dark.f); strokeR(60, 100, 40, 12, MAT.iron.e);
}, A => { shimmer(40, 40, 14, A); if (A.working) { const a = A.ph.a * 6; for (let i = 0; i < 3; i++) line(110, 100, 110 + Math.cos(a + i * 2.09) * 14, 100 + Math.sin(a + i * 2.09) * 14, rgba(MAT.steel.l, 0.5), 1.4); } statusLamp(134, 134, 3.5, A); });
def('diesel_generator', () => {
  machineBody(3, 3, 90, 90, undefined, 4);
  fins(10, 12, 44, 30, 6, true, MAT.iron); cylinder(72, 26, 14, MAT.steel); circle(72, 26, 9, MAT.dark.f, MAT.steel.e);
  pipe(20, 42, 20, 62, 3, MAT.iron, true); fillR(14, 62, 40, 10, MAT.iron.f); strokeR(14, 62, 40, 10, MAT.iron.e); box(64, 56, 24, 22, 4, MAT.paint); hatch(10, 80, 30, 5, 3);
}, A => { const a = A.ph.a * 7; for (let i = 0; i < 3; i++) line(72, 26, 72 + Math.cos(a + i * 2.09) * 8, 26 + Math.sin(a + i * 2.09) * 8, rgba(MAT.steel.l, 0.8), 1.8); const f = A.working ? Math.abs(Math.sin(A.t * 20)) * 3 : 0; line(54, 67, 60 + f, 63 - f, MAT.iron.f, 3); shimmer(56, 62, 5, A); statusLamp(86, 86, 2.5, A); });
def('gas_turbine', () => {
  machineBody(3, 3, 138, 138, undefined, 4);
  fillR(30, 40, 90, 44, MAT.steel.f); strokeR(30, 40, 90, 44, MAT.steel.e); for (let i = 0; i < 8; i++) line(40 + i * 10, 40, 40 + i * 10, 84, MAT.steel.d, 2); line(30, 44, 120, 44, rgba(MAT.steel.l, 0.6), 2);
  circle(30, 62, 24, MAT.dark.f, MAT.steel.e); ring(30, 62, 24, 3, MAT.steel.f); chimney(128, 62, 10, MAT.steel);
  pipe(60, 20, 60, 40, 3, MAT.steel, true); pipe(60, 20, 110, 20, 3, MAT.steel, true); hatch(40, 118, 60, 6, 3); box(20, 96, 40, 20, 5, MAT.paint);
}, A => { const a = A.ph.a * 8; for (let i = 0; i < 8; i++) line(30, 62, 30 + Math.cos(a + i * PI / 4) * 20, 62 + Math.sin(a + i * PI / 4) * 20, rgba(MAT.steel.l, 0.85), 2); circle(30, 62, 6, MAT.steel.f, MAT.steel.e); shimmer(128, 62, 10, A); statusLamp(134, 10, 3.5, A); });
def('solar_panel', () => { box(3, 3, 42, 42, 8, MAT.paint); fillR(5, 5, 38, 30, '#2f3b4c'); strokeR(5, 5, 38, 30, MAT.paint.e); for (let i = 1; i < 4; i++) line(5 + i * 9.5, 5, 5 + i * 9.5, 35, '#4a5b73', 1); for (let j = 1; j < 3; j++) line(5, 5 + j * 10, 43, 5 + j * 10, '#4a5b73', 1); fillR(6, 6, 10, 3, rgba(BONE, 0.12)); fillR(36, 36, 6, 6, MAT.dark.f); strokeR(36, 36, 6, 6, MAT.paint.e); });
def('geothermal_plant', () => {
  machineBody(3, 3, 138, 138, undefined, 4);
  pipe(52, 40, 74, 40, 6, MAT.bone, true); pipe(96, 62, 96, 78, 5, MAT.bone, true);
  circle(36, 40, 16, MAT.steel.f, MAT.steel.e); circle(36, 40, 8, INK, MAT.steel.e); ring(36, 40, 12, 2, MAT.iron.f);
  cylinder(96, 40, 22, MAT.steel); box(70, 78, 60, 40, 8, MAT.paint); fillR(76, 84, 48, 16, MAT.steel.d); strokeR(76, 84, 48, 16, MAT.steel.e);
  chimney(30, 100, 12, MAT.steel); hatch(10, 128, 50, 6, 3);
}, A => { shimmer(30, 100, 12, A); shimmer(36, 40, 8, A); statusLamp(134, 10, 3.5, A); });
def('battery', () => { machineBody(3, 3, 42, 42, undefined, 3); line(8, 14, 40, 14, MAT.copper.f, 1.6); line(8, 28, 40, 28, MAT.copper.f, 1.6); for (let j = 0; j < 2; j++) for (let i = 0; i < 3; i++) { circle(12 + i * 12, 14 + j * 14, 5, MAT.dark.f, MAT.steel.e); dot(12 + i * 12, 14 + j * 14, 1.5, MAT.copper.f); } },
  A => { statusLamp(40, 40, 1.8, A); });
def('capacitor_bank', () => { machineBody(3, 3, 90, 90, undefined, 5); for (let j = 0; j < 3; j++) line(10, 20 + j * 24, 78, 20 + j * 24, rgba(MAT.copper.f, 0.9), 2); for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) { cylinder(20 + i * 24, 20 + j * 24, 9, MAT.titan); ring(20 + i * 24, 20 + j * 24, 5, 1.2, rgba(SKY, 0.6)); } },
  A => { const p = 0.5 + 0.5 * Math.sin(A.t * 3); if (A.working) for (let j = 0; j < 3; j++) line(10, 20 + j * 24, 78, 20 + j * 24, rgba(SKY, 0.25 * p), 3); statusLamp(86, 86, 2.5, A); });
def('fission_reactor', () => {
  machineBody(3, 3, 138, 138, undefined, 6);
  pipe(10, 72, 34, 72, 5, MAT.steel, true); pipe(110, 72, 134, 72, 5, MAT.steel, true);
  circle(72, 72, 62, MAT.concrete.l, MAT.concrete.e); for (let i = 0; i < 3; i++) ring(72, 72, 62 - i * 10, P.hair, rgba(MAT.concrete.e, 0.6));
  circle(72, 72, 26, MAT.steel.f, MAT.steel.e); for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) if (i !== 1 || j !== 1) dot(60 + i * 12, 60 + j * 12, 2.2, MAT.dark.f);
  circle(72, 72, 8, INK, MAT.steel.e); trefoil(120, 120, 9, OKC); fillR(10, 8, 40, 16, MAT.steel.d); strokeR(10, 8, 40, 16, MAT.steel.e);
}, A => { const p = 0.5 + 0.5 * Math.sin(A.t * 1.8); if (A.working) { glow(72, 72, 16, OKC, 0.4 + 0.3 * p); circle(72, 72, 5, rgba('#dfffc0', 0.6 + 0.3 * p)); } statusLamp(134, 10, 3.5, A); });
def('cooling_tower', () => {
  plate(2, 2, 92, 92, MAT.concrete); seamH(4, 48, 88, MAT.concrete);
  circle(48, 48, 43, MAT.concrete.f, MAT.concrete.e); ring(48, 48, 38, 7, MAT.concrete.l); ring(48, 48, 34, P.hair, MAT.concrete.e);
  circle(48, 48, 32, MAT.dark.f, MAT.concrete.e); circle(48, 48, 26, '#25282a'); circle(48, 48, 14, MAT.water.d);
  for (let i = 0; i < 8; i++) { const a = i * PI / 4; line(48 + Math.cos(a) * 35, 48 + Math.sin(a) * 35, 48 + Math.cos(a) * 42, 48 + Math.sin(a) * 42, rgba(MAT.concrete.e, 0.6)); }
}, A => { if (A.working && A.lod > 1) for (let i = 0; i < 3; i++) { const p = (A.t * 0.5 + i / 3) % 1; ring(48 + Math.sin(p * 7 + i) * 4, 48 - p * 10, 14 + p * 22, 3, rgba(BONE, 0.22 * (1 - p))); } statusLamp(86, 86, 2.5, A); });
def('fusion_reactor', () => {
  machineBody(3, 3, 138, 138, undefined, 7);
  ring(72, 72, 50, 21, MAT.quantum.e); ring(72, 72, 50, 17, MAT.titan.f); ring(72, 72, 41.5, P.hair, rgba(MAT.titan.l, 0.6)); ring(72, 72, 58, P.hair, rgba(MAT.titan.l, 0.4));
  for (let i = 0; i < 12; i++) { const a = i * PI / 6; line(72 + Math.cos(a) * 38, 72 + Math.sin(a) * 38, 72 + Math.cos(a) * 62, 72 + Math.sin(a) * 62, MAT.quantum.e, 7); line(72 + Math.cos(a) * 38, 72 + Math.sin(a) * 38, 72 + Math.cos(a) * 62, 72 + Math.sin(a) * 62, MAT.quantum.f, 5); }
  circle(72, 72, 24, MAT.quantum.d, MAT.quantum.l); ring(72, 72, 18, 1.5, rgba(VIOLET, 0.5));
  cylinder(18, 126, 12, MAT.titan); pipe(28, 118, 40, 106, 3, MAT.titan, true);
}, A => { const a = A.ph.a * 0.7, p = 0.5 + 0.5 * Math.sin(A.t * 4), w = A.working; for (let i = 0; i < 8; i++) arcSeg(72, 72, 50, a + i * PI / 4, a + i * PI / 4 + 0.45, rgba(CYAN, w ? 0.85 : 0.3), 6); if (w) { ring(72, 72, 50, 12, rgba(CYAN, 0.12 + 0.08 * p)); glow(72, 72, 14, VIOLET, 0.4 + 0.3 * p); circle(72, 72, 5, rgba('#eefaff', 0.9)); } statusLamp(134, 10, 3.5, A); });

/* ── research ── */
def('study_table', () => {
  box(4, 6, 40, 36, 5, MAT.wood); planks(5, 7, 38, 30, 3, false, MAT.wood);
  fillR(9, 12, 18, 22, MAT.bone.f); strokeR(9, 12, 18, 22, MAT.bone.e); for (let i = 0; i < 5; i++) line(11, 16 + i * 4, 24 - (i % 2) * 3, 16 + i * 4, rgba(INK, 0.5), 0.9);
  circle(36, 16, 3.5, MAT.dark.f, INK); line(30, 28, 40, 20, BONE2, 1.2); circle(36, 30, 3, MAT.bone.f, MAT.bone.e);
}, A => { flame(36, 27, 2, A, 3); });
const FLASK = [SKY, OKC, AMBER, VERM, VIOLET];
def('lab_basic', () => {
  machineBody(3, 3, 90, 90, undefined, 2);
  box(10, 14, 50, 14, 4, MAT.wood); box(10, 44, 50, 14, 4, MAT.wood);
  for (let i = 0; i < 4; i++) circle(18 + i * 12, 20, 3.5, rgba(FLASK[i], 0.85), INK); for (let i = 0; i < 3; i++) circle(20 + i * 14, 50, 3, rgba(FLASK[i + 1], 0.85), INK);
  fillR(66, 10, 22, 48, MAT.dark.f); strokeR(66, 10, 22, 48, MAT.iron.e); for (let i = 0; i < 5; i++) line(69, 16 + i * 8, 77 + (i % 3) * 4, 16 + i * 8, rgba(BONE, 0.5), 0.9);
  box(10, 68, 20, 16, 4, MAT.iron);
}, A => { if (A.working && A.lod > 1) for (let i = 0; i < 2; i++) { const p = (A.t * 0.9 + i * 0.5) % 1; dot(30 + i * 2, 22 - p * 8, 1, rgba(BONE, 0.5 * (1 - p))); } statusLamp(86, 86, 2.5, A); });
def('lab_industrial', () => {
  machineBody(3, 3, 138, 138, undefined, 4);
  box(10, 12, 60, 20, 5, MAT.steel); fins(80, 12, 50, 28, 8, false, MAT.iron);
  fillR(14, 50, 52, 36, MAT.dark.f); strokeR(14, 50, 52, 36, MAT.steel.e); for (let i = 1; i < 4; i++) line(14 + i * 13, 50, 14 + i * 13, 86, rgba(OKC, 0.15));
  cylinder(100, 70, 16, MAT.steel); cylinder(100, 112, 16, MAT.steel); hatch(14, 126, 40, 6, 3);
  for (let i = 0; i < 5; i++) circle(18 + i * 10, 22, 3, rgba(FLASK[i], 0.85), INK);
}, A => { c.beginPath(); for (let x = 16; x <= 64; x += 2) { const y = 68 + Math.sin((x + A.t * 40) * 0.25) * 8 * (A.working ? 1 : 0.2); if (x === 16) c.moveTo(x, y); else c.lineTo(x, y); } c.strokeStyle = rgba(OKC, 0.9); c.lineWidth = 1.4; c.stroke(); statusLamp(134, 10, 3.5, A); });
def('lab_quantum', () => {
  machineBody(3, 3, 138, 138, undefined, 6);
  circle(72, 72, 44, MAT.dark.f, MAT.steel.e); ring(72, 72, 44, 3, MAT.titan.f);
  box(8, 8, 36, 18, 4, MAT.steel); box(100, 8, 36, 18, 4, MAT.steel); box(8, 118, 36, 18, 4, MAT.steel); fins(100, 118, 36, 18, 6, true, MAT.steel);
  for (let i = 0; i < 3; i++) dot(14 + i * 10, 14, 1.6, FLASK[i]);
}, A => {
  const a = A.ph.a * 0.3, p = 0.5 + 0.5 * Math.sin(A.t * 2);
  c.save(); c.beginPath(); c.arc(72, 72, 40, 0, TAU); c.clip(); c.translate(72, 72); c.rotate(a); c.strokeStyle = rgba(CYAN, 0.35 + 0.25 * p * (A.working ? 1 : 0.2)); c.lineWidth = 1; c.beginPath(); for (let i = -40; i <= 40; i += 10) { c.moveTo(i, -40); c.lineTo(i, 40); c.moveTo(-40, i); c.lineTo(40, i); } c.stroke(); c.restore();
  for (let i = 0; i < 5; i++) { const t0 = A.t * 0.5 + i * 1.3; dot(72 + Math.cos(t0) * (14 + i * 5), 72 + Math.sin(t0 * 1.3) * (10 + i * 4), 2, rgba(VIOLET, 0.8)); }
  glow(72, 72, 16, CYAN, 0.2 + 0.15 * p); statusLamp(134, 10, 3.5, A);
});

/* ── defense ── */
def('watchtower', () => { fillR(3, 3, 42, 42, MAT.soil.f); strokeR(3, 3, 42, 42, MAT.soil.e); planks(8, 8, 32, 32, 4, true, MAT.wood); [[8, 8], [40, 8], [8, 40], [40, 40]].forEach(p => post(p[0], p[1], 3.5, MAT.wood2)); strokeR(10, 10, 28, 28, MAT.wood2.f, 1.5); fillR(30, 30, 6, 8, MAT.leather.f); strokeR(30, 30, 6, 8, MAT.leather.e); },
  A => { const a = aimAngle(A); c.save(); c.translate(24, 24); c.rotate(a); arcSeg(0, 0, 8, -1.2, 1.2, MAT.wood2.f, 2); line(Math.cos(-1.2) * 8, Math.sin(-1.2) * 8, Math.cos(1.2) * 8, Math.sin(1.2) * 8, MAT.rope.f, 0.8); line(-3, 0, 10, 0, BONE2, 1.2); c.restore(); });
def('ballista', () => { fillR(2, 2, 92, 92, MAT.soil.f); strokeR(2, 2, 92, 92, MAT.soil.e); planks(10, 10, 76, 76, 6, true, MAT.wood); circle(48, 48, 30, MAT.wood2.f, MAT.wood.e); ring(48, 48, 26, 3, MAT.bronze.f); for (let i = 0; i < 8; i++) dot(48 + Math.cos(i * PI / 4) * 26, 48 + Math.sin(i * PI / 4) * 26, 1.4, MAT.bronze.e); for (let i = 0; i < 4; i++) line(14, 14 + i * 5, 30, 14 + i * 5, MAT.wood2.e, 1.4); },
  A => { const a = aimAngle(A); c.save(); c.translate(48, 48); c.rotate(a); line(-22, 0, 30, 0, MAT.wood.e, 9); line(-22, 0, 30, 0, MAT.wood.f, 7); line(-22, -2, 30, -2, rgba(MAT.wood.l, 0.5), 1); arcSeg(30, 0, 24, PI - 1.2, PI + 1.2, MAT.wood2.f, 3.5); line(30 + Math.cos(PI - 1.2) * 24, Math.sin(PI - 1.2) * 24, 30 + Math.cos(PI + 1.2) * 24, Math.sin(PI + 1.2) * 24, MAT.rope.f, 1.2); line(20, 0, 40, 0, MAT.iron.f, 2); poly([40, -2.5, 46, 0, 40, 2.5], MAT.iron.d); c.restore(); circle(48, 48, 4, MAT.bronze.f, MAT.bronze.e); });
def('cannon_turret', () => { plate(2, 2, 92, 92, MAT.steel); rivets(2, 2, 92, 92, 3, 12, MAT.steel); circle(48, 48, 34, MAT.iron.f, MAT.iron.e); ring(48, 48, 30, 2, MAT.steel.l); for (let i = 0; i < 12; i++) dot(48 + Math.cos(i * PI / 6) * 32, 48 + Math.sin(i * PI / 6) * 32, 1.4, MAT.iron.e); fillR(8, 8, 22, 12, MAT.dark.f); strokeR(8, 8, 22, 12, MAT.steel.e); for (let i = 0; i < 3; i++) dot(12 + i * 7, 14, 2, MAT.bronze.f); },
  A => { const a = aimAngle(A); c.save(); c.translate(48, 48); c.rotate(a); circle(0, 0, 20, MAT.steel.f, MAT.steel.e); ring(0, 0, 15, P.hair, MAT.steel.d); line(0, 0, 44, 0, MAT.iron.e, 10); line(0, 0, 44, 0, MAT.iron.f, 8); line(0, -2, 44, -2, rgba(MAT.iron.l, 0.6), 1.5); line(40, -6, 40, 6, MAT.iron.e, 3); line(44, -5, 44, 5, MAT.iron.d, 3); c.restore(); circle(48, 48, 5, MAT.steel.d, MAT.steel.e); statusLamp(86, 10, 2.5, A); });
def('gatling_turret', () => { machineBody(3, 3, 42, 42, undefined, 4); circle(24, 24, 15, MAT.iron.f, MAT.iron.e); ring(24, 24, 12, 1.5, MAT.steel.l); },
  A => { const a = aimAngle(A), spin = A.ph.a * 10; c.save(); c.translate(24, 24); c.rotate(a); circle(0, 0, 9, MAT.steel.f, MAT.steel.e); fillR(-9, -6, 8, 12, MAT.dark.f); strokeR(-9, -6, 8, 12, MAT.iron.e); for (let i = 0; i < 3; i++) { const o = Math.sin(spin + i * 2.09) * 2.6; line(4, o, 20, o, MAT.iron.e, 2.6); line(4, o, 20, o, MAT.iron.f, 1.6); } c.restore(); statusLamp(40, 8, 1.8, A); });
def('tesla_coil', () => { machineBody(3, 3, 42, 42, undefined, 4); circle(24, 24, 14, MAT.copper.d, MAT.copper.e); for (let i = 0; i < 5; i++) ring(24, 24, 5 + i * 2, 1.2, i % 2 ? MAT.copper.f : MAT.copper.l); },
  A => { const p = 0.5 + 0.5 * Math.sin(A.t * 6), w = A.working; if (w) { glow(24, 24, 13, CYAN, 0.35 + 0.3 * p); for (let i = 0; i < 3; i++) { const a = A.t * 9 + i * 2.1; jag(24, 24, 24 + Math.cos(a) * 18, 24 + Math.sin(a) * 18, 5, 2.5, A.t * 50 + i, rgba('#dff6ff', 0.85), 1); } } else if (A.state !== 'no_power') glow(24, 24, 8, SKY, 0.15); ring(24, 24, 9, 3, rgba(BONE2, 0.9)); ring(24, 24, 9, 1, rgba(BONE, 0.6)); statusLamp(40, 40, 1.8, A); });
def('laser_turret', () => { machineBody(3, 3, 42, 42, undefined, 5); circle(24, 24, 15, MAT.titan.d, MAT.titan.e); ring(24, 24, 12, 1.4, rgba(SKY, 0.7)); },
  A => { const a = aimAngle(A), p = 0.5 + 0.5 * Math.sin(A.t * 5); c.save(); c.translate(24, 24); c.rotate(a); fillR(-6, -7, 20, 14, MAT.titan.f); strokeR(-6, -7, 20, 14, MAT.titan.e); fins(-4, -5, 8, 10, 3, false, MAT.steel); line(14, 0, 22, 0, MAT.titan.e, 6); line(14, 0, 22, 0, MAT.titan.d, 4); dome(20, 0, 3.5, rgba(CYAN, A.working ? 0.6 + 0.4 * p : 0.4)); if (A.working) glow(21, 0, 6, CYAN, 0.5 * p); c.restore(); statusLamp(40, 40, 1.8, A); });
def('plasma_turret', () => { machineBody(3, 3, 90, 90, undefined, 7); circle(48, 48, 34, MAT.quantum.d, MAT.quantum.l); ring(48, 48, 30, 2, rgba(VIOLET, 0.5)); for (let i = 0; i < 16; i++) dot(48 + Math.cos(i * PI / 8) * 32, 48 + Math.sin(i * PI / 8) * 32, 1.2, MAT.quantum.l); fins(8, 70, 30, 16, 6, true, MAT.titan); },
  A => { const a = aimAngle(A), p = 0.5 + 0.5 * Math.sin(A.t * 4), w = A.working; c.save(); c.translate(48, 48); c.rotate(a); circle(0, 0, 20, MAT.quantum.f, MAT.quantum.l); fins(-10, -14, 20, 6, 5, true, MAT.titan); fins(-10, 8, 20, 6, 5, true, MAT.titan); for (const o of [-6, 6]) { line(6, o, 44, o, MAT.quantum.e, 8); line(6, o, 44, o, MAT.titan.f, 6); line(40, o - 4, 40, o + 4, MAT.quantum.e, 3); dot(45, o, 2.5, rgba(CYAN, w ? 0.6 + 0.4 * p : 0.35)); if (w) glow(45, o, 6, CYAN, 0.5 * p); } ring(0, 0, 8, 2, rgba(VIOLET, 0.5 + 0.4 * p)); c.restore(); statusLamp(86, 10, 2.5, A); });

/* ── tile overlays: conveyors, cables, pipes (48-unit tile, shape from the neighbour mask n=1 e=2 s=4 w=8) ── */
const DIRA = [-PI / 2, 0, PI / 2, PI];
function armsOf(mask, rot) {
  mask &= 15;
  if (!mask) mask = (rot & 1) ? 5 : 10;
  else if (mask === 1 || mask === 4) mask = 5; else if (mask === 2 || mask === 8) mask = 10;
  const arms = []; for (let i = 0; i < 4; i++) if (mask >> i & 1) arms.push(i); return arms;
}
const isStraight = arms => arms.length === 2 && (arms[1] - arms[0]) === 2;
function conveyorMats(t) { return t === 0 ? MAT.wood : t === 2 ? MAT.iron : t === 3 ? MAT.steel : t === 5 ? MAT.titan : t === 7 ? MAT.quantum : tierMat(t); }
function conveyorBase(mask, rot) {
  const t = P.tier, arms = armsOf(mask, rot), rm = conveyorMats(t), bw = 26, rail = 4, belt = t === 0 ? '#3d3229' : t === 7 ? '#23212c' : '#232427';
  for (const d of arms) {
    c.save(); c.translate(24, 24); c.rotate(DIRA[d]);
    fillR(-1, -bw / 2 - rail, 25, rail, rm.f); fillR(-1, bw / 2, 25, rail, rm.f);
    line(-1, -bw / 2 - rail + 0.6, 24, -bw / 2 - rail + 0.6, rm.l); line(-1, bw / 2 + rail - 0.6, 24, bw / 2 + rail - 0.6, rm.d);
    fillR(-1, -bw / 2, 25, bw, belt);
    if (t === 0) { for (let x = 4; x < 24; x += 6) { line(x, -bw / 2 + 1, x, bw / 2 - 1, MAT.wood.f, 3); line(x - 1, -bw / 2 + 1, x - 1, bw / 2 - 1, MAT.wood.l, 0.8); } }
    else { for (let x = 4; x < 24; x += 6) line(x, -bw / 2 + 1, x, bw / 2 - 1, rgba(rm.l, 0.28), 1.2); }
    if (t === 7) line(0, 0, 24, 0, rgba(VIOLET, 0.25), 3);
    c.restore();
  }
  if (!isStraight(arms)) { fillR(24 - bw / 2, 24 - bw / 2, bw, bw, belt); for (const d of [0, 1, 2, 3]) if (!arms.includes(d)) { c.save(); c.translate(24, 24); c.rotate(DIRA[d]); fillR(bw / 2, -bw / 2 - rail, rail, bw + 2 * rail, rm.f); strokeR(bw / 2, -bw / 2 - rail, rail, bw + 2 * rail, rm.e); c.restore(); } for (const d of arms) { c.save(); c.translate(24, 24); c.rotate(DIRA[d]); strokeR(-bw / 2 - rail, -bw / 2 - rail, rail, rail, rm.e); c.restore(); } }
  for (const d of arms) { c.save(); c.translate(24, 24); c.rotate(DIRA[d]); strokeR(-1, -bw / 2 - rail, 25, rail, rm.e); strokeR(-1, bw / 2, 25, rail, rm.e); c.restore(); }
}
function cableBase(mask, rot) {
  const t = P.tier, arms = armsOf(mask, rot), kind = t <= 1 ? 0 : t <= 3 ? 1 : t <= 6 ? 2 : 3;
  for (const d of arms) {
    c.save(); c.translate(24, 24); c.rotate(DIRA[d]);
    if (kind === 0) { line(0, 0, 24, 0, MAT.wood.e, 8); line(0, 0, 24, 0, MAT.wood.f, 6); line(0, -1.5, 24, -1.5, rgba(MAT.wood.l, 0.6), 1); fillR(13, -6, 4, 12, MAT.iron.f); strokeR(13, -6, 4, 12, MAT.iron.e); }
    else if (kind === 1) { line(0, 0, 24, 0, INK, 3.4); line(0, 0, 24, 0, MAT.copper.f, 2.2); }
    else if (kind === 2) { for (const o of [-3, 3]) { line(0, o, 24, o, INK, 2.6); line(0, o, 24, o, MAT.steel.l, 1.4); } line(13, -4.5, 13, 4.5, MAT.iron.f, 1.6); }
    else { line(0, 0, 24, 0, rgba(VIOLET, 0.18), 7); line(0, 0, 24, 0, INK, 4); line(0, 0, 24, 0, '#cbb8ff', 2.4); }
    c.restore();
  }
  if (kind === 0) { circle(24, 24, 5.5, MAT.iron.f, MAT.iron.e); dot(24, 24, 1.6, MAT.iron.d); }
  else if (kind === 1) { circle(24, 24, 3.4, MAT.bone.f, INK); dot(24, 24, 1, MAT.bone.d); }
  else if (kind === 2) { circle(24, 24, 4.6, MAT.bone.f, INK); ring(24, 24, 2.4, P.hair, MAT.bone.d); }
  else { circle(24, 24, 5, rgba(VIOLET, 0.25)); circle(24, 24, 3.6, '#e6dcff', INK); }
}
function pipeMat(t) { return t === 0 ? MAT.wood : t === 1 ? MAT.bronze : t === 3 ? MAT.steel : t === 5 ? MAT.titan : t === 7 ? MAT.quantum : tierTrim(t); }
function pipeBase(mask, rot) {
  const t = P.tier, arms = armsOf(mask, rot), m = pipeMat(t), r = t === 0 ? 6 : 5;
  const arm = (d, x0) => { c.save(); c.translate(24, 24); c.rotate(DIRA[d]); pipe(x0, 0, 24, 0, r, m, false); if (t === 0) { line(x0, -r * 0.45, 24, -r * 0.45, rgba(m.e, 0.5)); line(x0, r * 0.2, 24, r * 0.2, rgba(m.e, 0.5)); } if (t === 7) line(x0, 0, 24, 0, rgba(CYAN, 0.35), 1.5); flange(19.5, 0, 0, 1, r, m); c.restore(); };
  if (isStraight(arms)) { c.save(); c.translate(24, 24); c.rotate(DIRA[arms[1]]); pipe(-24, 0, 24, 0, r, m, false); if (t === 0) { line(-24, -r * 0.45, 24, -r * 0.45, rgba(m.e, 0.5)); line(-24, r * 0.2, 24, r * 0.2, rgba(m.e, 0.5)); } if (t === 7) line(-24, 0, 24, 0, rgba(CYAN, 0.35), 1.5); flange(-19.5, 0, 0, 1, r, m); flange(19.5, 0, 0, 1, r, m); c.restore(); return; }
  for (const d of arms) arm(d, 0);
  if (t === 0) { circle(24, 24, r + 2, MAT.wood2.f, m.e); ring(24, 24, r + 0.5, 1.6, MAT.rope.f); }
  else { fillR(24 - r - 1.5, 24 - r - 1.5, 2 * r + 3, 2 * r + 3, m.f); strokeR(24 - r - 1.5, 24 - r - 1.5, 2 * r + 3, 2 * r + 3, m.e); line(24 - r, 24 - r, 24 + r, 24 - r, rgba(m.l, 0.6)); for (const p of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) dot(24 + p[0] * (r - 0.5), 24 + p[1] * (r - 0.5), Math.max(0.6, r * 0.14), m.e); if (t === 7) ring(24, 24, r * 0.6, 1.2, rgba(CYAN, 0.6)); }
}
const OVERLAY = { conveyor: conveyorBase, cable: cableBase, pipe: pipeBase };
function overlayKind(def) { const k = spriteKey(def); if (OVERLAY[k]) return k; if (def.overlay === 'cable' || def.overlay === 'pipe') return def.overlay; if (def.conveyor) return 'conveyor'; if (def.cable) return 'cable'; if (def.pipe) return 'pipe'; return null; }
function overlayBase(kind, def, sizePx, mask, rot, cls) {
  cls = cls || 'n';
  const zoom = sizePx / TILE, b = bucketFor(zoom), tier = U.clamp((def.tier | 0), 0, 7), ck = 'ov:' + kind + ':' + tier + ':' + b + ':' + (mask & 15) + ':' + (mask ? 0 : rot & 1) + ':' + cls;
  let cv = cacheGet(ck); if (cv) return cv;
  const px = Math.round(TILE * b); cv = U.canvas(px, px);
  const g = cv.getContext('2d'); g.scale(b, b); g.lineCap = 'butt'; g.lineJoin = 'round';
  const prev = begin(g, makeP(def, TILE, b, cls));
  try { OVERLAY[kind](mask, rot); if (cls === 'w') paintWorn(false); else if (cls === 'b') paintWorn(true); } catch (err) { console.error('[Sprites] overlay painter failed', err); }
  end(prev); applyNoise(g, px);
  return cacheSet(ck, cv);
}
function integrityClass(def, inst) {
  if (!inst) return 'n';
  if (inst.state === 'broken') return 'b';
  if (typeof inst.hp !== 'number') return 'n';
  const B = LD.Sim && LD.Sim.Build, mx = inst.maxHp || inst._maxHp || def.hp || 0;
  const integ = B && typeof B.integrity === 'function' ? B.integrity(inst) : (mx > 0 ? inst.hp / mx : 1);
  return integ < 0.5 ? 'w' : 'n';
}

/* ── prerender: cached static base, keyed id:bucket:rot:stateClass ── */
function spriteKey(def) { return (def && (def.sprite || def.id)) || 'generic'; }
const warned = new Set();
function painterFor(key) { let p = SP[key]; if (!p) { if (!warned.has(key)) { warned.add(key); console.warn('[Sprites] unknown sprite key "' + key + '": drawing a generic tiered machine'); } p = SP.generic; } return p; }
function makeP(def, W, k, cls) {
  const tier = U.clamp((def && def.tier) | 0, 0, 7);
  return { def: def || {}, id: (def && def.id) || 'unknown', W, size: W / TILE, tier, k, hair: Math.max(1 / k, 0.6), A: S.TIER_COLORS[tier], cls, rnd: U.rng(U.hashStr((def && def.id) || 'x')) };
}
function applyNoise(g, px) { g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = 0.035; g.fillStyle = noisePattern(g); g.fillRect(0, 0, px, px); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
function paintWorn(broken) {
  const W = P.W, r = U.rng(U.hashStr(P.id) ^ 0x5bd1);
  c.save(); c.globalCompositeOperation = 'source-atop';
  if (broken) { fillR(0, 0, W, W, 'rgba(12,12,13,0.42)'); for (let i = 0; i < 3; i++) { const x = W * 0.2 + r() * W * 0.6, y = W * 0.1 + r() * W * 0.4; circle(x, y, W * 0.12 + r() * W * 0.08, 'rgba(8,8,8,0.35)'); circle(x + W * 0.05, y + W * 0.03, W * 0.08, 'rgba(8,8,8,0.3)'); } }
  for (let i = 0; i < (broken ? 6 : 4); i++) circle(r() * W, r() * W, W * 0.08 + r() * W * 0.06, 'rgba(20,18,14,0.16)');
  c.strokeStyle = 'rgba(12,12,13,0.72)'; c.lineWidth = P.hair; c.lineJoin = 'miter';
  for (let i = 0, n = broken ? 5 : 3; i < n; i++) { let x = r() * W, y = r() * W; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (r() - 0.5) * W * 0.25; y += (r() - 0.5) * W * 0.25; c.lineTo(x, y); } c.stroke(); }
  c.restore();
}
function paintScaffold() {
  const W = P.W, m = MAT.wood, hw = Math.max(2, W * 0.035), n = P.size + 1, bay = (W - 8) / (n - 1), h = Math.min(W * 0.22, bay * 0.6);
  fillR(2, 2, W - 4, W - 4, 'rgba(12,12,13,0.22)'); dashRect(2, 2, W - 4, W - 4, rgba(BONE, 0.45), 3);
  for (let i = 0; i < n - 1; i++) { const a = 4 + i * bay, b = a + bay; line(a, 4, b, 4 + h, m.d, hw * 0.6); line(b, 4, a, 4 + h, m.d, hw * 0.6); line(a, W - 4, b, W - 4 - h, m.d, hw * 0.6); line(b, W - 4, a, W - 4 - h, m.d, hw * 0.6); line(4, a, 4 + h, b, m.d, hw * 0.6); line(4, b, 4 + h, a, m.d, hw * 0.6); line(W - 4, a, W - 4 - h, b, m.d, hw * 0.6); line(W - 4, b, W - 4 - h, a, m.d, hw * 0.6); }
  for (const e of [[4, 4, W - 4, 4], [4, W - 4, W - 4, W - 4], [4, 4, 4, W - 4], [W - 4, 4, W - 4, W - 4], [4, 4 + h, W - 4, 4 + h], [4, W - 4 - h, W - 4, W - 4 - h], [4 + h, 4, 4 + h, W - 4], [W - 4 - h, 4, W - 4 - h, W - 4]]) { line(e[0], e[1], e[2], e[3], m.e, hw + P.hair * 2); line(e[0], e[1], e[2], e[3], m.f, hw); }
  for (let i = 0; i < n; i++) { post(4 + i * bay, 4, hw * 1.3, MAT.wood2); post(4 + i * bay, W - 4, hw * 1.3, MAT.wood2); post(4, 4 + i * bay, hw * 1.3, MAT.wood2); post(W - 4, 4 + i * bay, hw * 1.3, MAT.wood2); }
}
S.prerender = function (def, sizePx, rot, cls) {
  def = def || {};
  const size = Math.max(1, def.size | 0 || 1), W = size * TILE, b = bucketFor(sizePx / W), key = spriteKey(def);
  rot = (rot | 0) & 3; cls = cls || 'n';
  const kind = OVERLAY[key] ? key : OVERLAY[def.overlay] ? def.overlay : null;
  if (kind && cls !== 's') return overlayBase(kind, def, sizePx, 0, rot);
  const ck = (def.id || key) + ':' + key + ':' + b + ':' + rot + ':' + cls + ':' + (def.tier | 0) + ':' + size;
  let cv = cacheGet(ck); if (cv) return cv;
  const px = Math.round(W * b); cv = U.canvas(px, px);
  const g = cv.getContext('2d');
  g.translate(px / 2, px / 2); g.rotate(rot * PI / 2); g.translate(-px / 2, -px / 2); g.scale(b, b);
  g.lineCap = 'butt'; g.lineJoin = 'round';
  const prev = begin(g, makeP(def, W, b, cls));
  try { if (cls === 's') paintScaffold(); else { painterFor(key).base(); if (cls === 'w') paintWorn(false); else if (cls === 'b') paintWorn(true); } }
  catch (err) { console.error('[Sprites] painter failed for "' + key + '"', err); }
  end(prev);
  if (cls !== 's') applyNoise(g, px);
  return cacheSet(ck, cv);
};

/* ── per-frame animation state (WeakMap on the instance, never serialised) ── */
const phases = new WeakMap();
function motion(inst, t, target) {
  if (!inst) return { t, dt: 0, s: target, a: 0, aim: null, p0: 0.3 };
  let ph = phases.get(inst);
  if (!ph) { ph = { t, dt: 0, s: 0, a: 0, aim: null, p0: U.hash2(inst.x | 0, inst.y | 0, 7) }; phases.set(inst, ph); }
  const dt = Math.min(0.1, Math.max(0, t - ph.t)); ph.t = t; ph.dt = dt;
  ph.s += (target - ph.s) * Math.min(1, dt * 2.5);
  ph.a += dt * ph.s;
  return ph;
}
const AP = { def: null, id: '', W: 0, size: 1, tier: 0, k: 1, hair: 1, A: '', cls: 'n', rnd: null };
const AA = { t: 0, dt: 0, inst: null, state: 'idle', working: false, ph: null, lod: 2 };
function animArgs(def, inst, t, state, sp, lod) {
  const working = state === 'working';
  AA.t = t; AA.inst = inst; AA.state = state || 'idle'; AA.working = working; AA.lod = lod;
  AA.ph = motion(inst, t, working ? 1 : (sp.idle || 0)); AA.dt = AA.ph.dt;
  return AA;
}
function animP(def, W, k) { AP.def = def; AP.id = def.id || ''; AP.W = W; AP.size = W / TILE; AP.tier = U.clamp((def.tier | 0), 0, 7); AP.k = k; AP.hair = Math.max(1 / k, 0.6); AP.A = S.TIER_COLORS[AP.tier]; return AP; }
function drawOcGlow(ctx, px, py, sizePx, oc, t) {
  const k = U.clamp(oc / 3), col = U.mixHex(AMBER, VERM, k), pulse = 0.85 + 0.15 * Math.sin(t * 3);
  ctx.save();
  ctx.strokeStyle = rgba(col, (0.22 + 0.2 * k) * pulse); ctx.lineWidth = Math.max(3, sizePx * 0.06); ctx.strokeRect(px + 1.5, py + 1.5, sizePx - 3, sizePx - 3);
  ctx.strokeStyle = rgba(col, 0.85 * pulse); ctx.lineWidth = Math.max(1, sizePx * 0.02); ctx.strokeRect(px + 1, py + 1, sizePx - 2, sizePx - 2);
  ctx.restore();
}
function drawBuilding(ctx, def, px, py, sizePx, t, inst, rot) {
  let prog = 0;
  if (inst) { if (inst.build && inst.build.total > 0) prog = 1 - inst.build.left / inst.build.total; else if (typeof inst.progress === 'number') prog = inst.progress; }
  prog = U.clamp(prog);
  const base = S.prerender(def, sizePx, rot, 'n'), scaf = S.prerender(def, sizePx, rot, 's');
  if (prog > 0.01) { ctx.save(); ctx.beginPath(); ctx.rect(px, py + sizePx * (1 - prog), sizePx, sizePx * prog); ctx.clip(); ctx.globalAlpha = 0.85; ctx.drawImage(base, px, py, sizePx, sizePx); ctx.restore(); }
  ctx.drawImage(scaf, px, py, sizePx, sizePx);
  if (sizePx >= 14) S.drawBadge(ctx, 'building', px, py, sizePx, prog);
}

S.draw = function (ctx, def, px, py, sizePx, t, inst) {
  if (!def) return;
  const key = spriteKey(def), ov = OVERLAY[key] ? key : (def.overlay === 'cable' || def.overlay === 'pipe') ? def.overlay : null;
  if (ov) return S.drawOverlay(ctx, def, px, py, sizePx, t, inst, null);
  const size = Math.max(1, def.size | 0 || 1), W = size * TILE, rot = inst ? (inst.rot | 0) & 3 : 0, state = inst ? (inst.state || 'idle') : 'idle';
  t = t || 0;
  if (state === 'building') return drawBuilding(ctx, def, px, py, sizePx, t, inst, rot);
  const cls = integrityClass(def, inst);
  ctx.drawImage(S.prerender(def, sizePx, rot, cls), px, py, sizePx, sizePx);
  const sp = painterFor(key), tilePx = sizePx / size;
  const lod = tilePx >= 40 ? 2 : 1;
  if (sp.anim && tilePx >= 16 && cls !== 'b' && (lod > 1 || state === 'working' || sp.live)) {
    const k = sizePx / W;
    const A = animArgs(def, inst, t, state, sp, lod);
    ctx.save(); ctx.translate(px + sizePx / 2, py + sizePx / 2); if (rot) ctx.rotate(rot * PI / 2); ctx.scale(k, k); ctx.translate(-W / 2, -W / 2);
    ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
    const prev = begin(ctx, animP(def, W, k));
    try { sp.anim(A); } catch (err) { if (!warned.has('anim:' + key)) { warned.add('anim:' + key); console.error('[Sprites] anim failed for "' + key + '"', err); } }
    end(prev); ctx.restore();
  }
  if (inst && inst.oc > 0) drawOcGlow(ctx, px, py, sizePx, inst.oc, t);
};

S.drawOverlay = function (ctx, def, px, py, sizePx, t, inst, nb) {
  if (!def) return;
  const kind = overlayKind(def);
  if (!kind) return S.draw(ctx, def, px, py, sizePx, t, inst);
  const rot = inst ? (inst.rot | 0) & 3 : 0, mask = nb ? ((nb.n ? 1 : 0) | (nb.e ? 2 : 0) | (nb.s ? 4 : 0) | (nb.w ? 8 : 0)) : 0;
  if (inst && inst.state === 'building') return drawBuilding(ctx, def, px, py, sizePx, t || 0, inst, rot);
  const cls = integrityClass(def, inst);
  ctx.drawImage(overlayBase(kind, def, sizePx, mask, rot, cls), px, py, sizePx, sizePx);
  const k = sizePx / TILE; t = t || 0;
  if (kind === 'conveyor' && sizePx >= 16 && cls !== 'b') {
    const tier = U.clamp(def.tier | 0, 0, 7), speed = [7, 8, 10, 14, 16, 18, 20, 24][tier], arms = armsOf(mask, rot), off = (t * speed) % 8, fx = Math.cos(DIRA[rot]), fy = Math.sin(DIRA[rot]);
    ctx.save(); ctx.translate(px + sizePx / 2, py + sizePx / 2); ctx.scale(k, k);
    ctx.strokeStyle = tier === 7 ? rgba(CYAN, 0.55) : rgba(BONE, 0.42); ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (const d of arms) {
      const dx = Math.cos(DIRA[d]), dy = Math.sin(DIRA[d]), sgn = (dx * fx + dy * fy) < 0 ? -1 : 1;
      for (let i = 0; i < 3; i++) {
        let p = (i * 8 + off) % 24; if (sgn < 0) p = 24 - p; if (p < 3 || p > 22) continue;
        const nx = -dy, ny = dx, tipX = dx * (p + 3 * sgn), tipY = dy * (p + 3 * sgn), bx = dx * p, by = dy * p;
        ctx.moveTo(bx + nx * 4.5, by + ny * 4.5); ctx.lineTo(tipX, tipY); ctx.lineTo(bx - nx * 4.5, by - ny * 4.5);
      }
    }
    ctx.stroke(); ctx.restore();
  } else if ((def.tier | 0) === 7 && sizePx >= 24) {
    const p = 0.5 + 0.5 * Math.sin(t * 2 + (inst ? (inst.x | 0) * 0.7 : 0));
    ctx.save(); ctx.fillStyle = rgba(kind === 'cable' ? VIOLET : CYAN, 0.12 + 0.1 * p); ctx.beginPath(); ctx.arc(px + sizePx / 2, py + sizePx / 2, sizePx * 0.16, 0, TAU); ctx.fill(); ctx.restore();
  }
  if (inst && inst.oc > 0) drawOcGlow(ctx, px, py, sizePx, inst.oc, t);
};

S.drawGhost = function (ctx, def, px, py, sizePx, valid, rot) {
  if (!def) return;
  const kind = overlayKind(def), size = kind ? 1 : Math.max(1, def.size | 0 || 1), W = size * TILE, b = bucketFor(sizePx / W);
  rot = (rot | 0) & 3;
  const ck = 'ghost:' + (def.id || spriteKey(def)) + ':' + b + ':' + rot + ':' + (valid ? 'v' : 'i') + ':' + (def.tier | 0) + ':' + size;
  let cv = cacheGet(ck);
  if (!cv) {
    const base = kind ? overlayBase(kind, def, sizePx, 0, rot) : S.prerender(def, sizePx, rot, 'n');
    cv = U.canvas(base.width, base.height); const g = cv.getContext('2d');
    g.drawImage(base, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = valid ? BONE : VERM; g.fillRect(0, 0, cv.width, cv.height);
    g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.4; g.drawImage(base, 0, 0);
    cacheSet(ck, cv);
  }
  ctx.save(); ctx.globalAlpha = 0.5; ctx.drawImage(cv, px, py, sizePx, sizePx);
  ctx.globalAlpha = 0.9; ctx.setLineDash([Math.max(2, sizePx * 0.05), Math.max(2, sizePx * 0.05)]); ctx.strokeStyle = valid ? BONE : VERM; ctx.lineWidth = 1; ctx.strokeRect(px + 0.5, py + 0.5, sizePx - 1, sizePx - 1);
  ctx.restore();
};

S.thumb = function (def, sizePx) {
  def = def || {}; sizePx = Math.max(8, sizePx | 0);
  const kind = overlayKind(def), ck = 'thumb:' + (def.id || spriteKey(def)) + ':' + sizePx + ':' + (def.tier | 0) + ':' + (def.size | 0);
  let cv = cacheGet(ck); if (cv) return cv;
  cv = U.canvas(sizePx, sizePx); const g = cv.getContext('2d');
  if (kind) S.drawOverlay(g, def, 0, 0, sizePx, 0, null, { e: true, w: true }); else S.draw(g, def, 0, 0, sizePx, 0, null);
  return cacheSet(ck, cv);
};

/* ── state badges: ink disc + bone monoline glyph ── */
S.drawBadge = function (ctx, state, px, py, sizePx, progress) {
  if (!state || state === 'idle' || state === 'working') return;
  const r = U.clamp(sizePx * 0.14, 7, 13), cx = px + sizePx / 2, cy = py + sizePx / 2, lw = Math.max(1.2, r * 0.17), g = r * 0.5;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fillStyle = 'rgba(12,12,13,0.92)'; ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = rgba(BONE, 0.35); ctx.stroke();
  ctx.strokeStyle = state === 'broken' ? VERM : BONE; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.translate(cx, cy); ctx.beginPath();
  switch (state) {
    case 'no_power': ctx.moveTo(g * 0.3, -g); ctx.lineTo(-g * 0.45, g * 0.15); ctx.lineTo(g * 0.15, g * 0.15); ctx.lineTo(-g * 0.3, g); break;
    case 'no_input': ctx.moveTo(0, -g); ctx.lineTo(0, g); ctx.moveTo(-g * 0.7, g * 0.3); ctx.lineTo(0, g); ctx.lineTo(g * 0.7, g * 0.3); break;
    case 'output_full': ctx.rect(-g * 0.8, -g * 0.8, g * 1.6, g * 1.6); break;
    case 'no_fuel': ctx.moveTo(0, -g); ctx.lineTo(g * 0.95, g * 0.75); ctx.lineTo(-g * 0.95, g * 0.75); ctx.closePath(); break;
    case 'no_fluid': ctx.moveTo(0, -g); ctx.bezierCurveTo(g * 0.1, -g * 0.3, g * 0.85, g * 0.05, g * 0.85, g * 0.35); ctx.arc(0, g * 0.35, g * 0.85, 0, PI, false); ctx.bezierCurveTo(-g * 0.85, g * 0.05, -g * 0.1, -g * 0.3, 0, -g); break;
    case 'no_link': ctx.moveTo(-g * 0.25, -g * 0.45); ctx.lineTo(-g * 0.75, -g * 0.45); ctx.arc(-g * 0.75, 0, g * 0.45, -PI / 2, PI / 2, true); ctx.lineTo(-g * 0.25, g * 0.45); ctx.moveTo(g * 0.25, -g * 0.45); ctx.lineTo(g * 0.75, -g * 0.45); ctx.arc(g * 0.75, 0, g * 0.45, -PI / 2, PI / 2, false); ctx.lineTo(g * 0.25, g * 0.45); ctx.moveTo(-g * 0.35, g * 0.9); ctx.lineTo(g * 0.35, -g * 0.9); break;
    case 'broken': ctx.moveTo(-g * 0.8, -g * 0.8); ctx.lineTo(g * 0.8, g * 0.8); ctx.moveTo(g * 0.8, -g * 0.8); ctx.lineTo(-g * 0.8, g * 0.8); break;
    case 'paused': ctx.moveTo(-g * 0.4, -g * 0.85); ctx.lineTo(-g * 0.4, g * 0.85); ctx.moveTo(g * 0.4, -g * 0.85); ctx.lineTo(g * 0.4, g * 0.85); break;
    case 'building': ctx.strokeStyle = rgba(BONE, 0.3); ctx.arc(0, 0, g * 1.1, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.strokeStyle = BONE; ctx.arc(0, 0, g * 1.1, -PI / 2, -PI / 2 + TAU * U.clamp(progress || 0)); break;
    default: ctx.arc(0, 0, g * 0.35, 0, TAU); ctx.fill(); break;
  }
  ctx.stroke(); ctx.restore();
};

/* ── enemies: 48-unit frame, centred, facing +x; 12 cached walk frames per id and zoom bucket ── */
const EN = {}, EN_FRAMES = 12;
const enemy = (id, o) => { EN[id] = o; };
const leg = (x0, y0, x1, y1, col, w) => { line(x0, y0, x1, y1, INK, w + P.hair * 1.6); line(x0, y0, x1, y1, col, w); };
const eye = (x, y, col) => dot(x, y, 1, col || '#f0e6c8');
enemy('wolf', { color: '#8a8378', color2: '#3a3733', draw(f, c1, c2) {
  const s = Math.sin(f * TAU), s2 = -s;
  for (const q of [[32, -7, s], [32, 7, s2], [14, -7, s2], [14, 7, s]]) ellipse(q[0] + q[2] * 3, 24 + q[1], 3.4, 2.2, 0, c2, INK);
  path([9, 24, 2, 21 + s * 2.5], c2, 2.6);
  ellipse(23, 24, 15, 7, 0, c1, INK); ellipse(23, 24, 12, 2.6, 0, rgba(c2, 0.55));
  ellipse(38, 24, 7, 5.5, 0, c1, INK); poly([34, 19, 32, 13, 37, 17], c2, INK); poly([34, 29, 32, 35, 37, 31], c2, INK); ellipse(44, 24, 3.2, 2.4, 0, c2, INK); eye(40, 21.5); eye(40, 26.5);
} });
enemy('boar', { color: '#6e5a48', color2: '#3b2f26', draw(f, c1, c2) {
  const s = Math.sin(f * TAU);
  for (const q of [[31, -8, s], [31, 8, -s], [15, -8, -s], [15, 8, s]]) ellipse(q[0] + q[2] * 2.5, 24 + q[1], 3, 2.4, 0, c2, INK);
  path([8, 24, 3, 26 + s * 2], c2, 2);
  ellipse(23, 24, 16, 9.5, 0, c1, INK); for (let i = 0; i < 7; i++) line(12 + i * 3.6, 24 - 2, 13 + i * 3.6, 24 - 6, c2, 1.2);
  ellipse(38, 24, 8, 6.5, 0, c1, INK); circle(45, 24, 3, c2, INK); line(43, 21, 47, 18, '#e8e0cc', 1.6); line(43, 27, 47, 30, '#e8e0cc', 1.6); eye(40, 21); eye(40, 27);
} });
enemy('bear', { color: '#5a4a3c', color2: '#2e251d', draw(f, c1, c2) {
  const s = Math.sin(f * TAU);
  for (const q of [[33, -10, s], [33, 10, -s], [13, -10, -s], [13, 10, s]]) circle(q[0] + q[2] * 3, 24 + q[1], 4.2, c2, INK);
  ellipse(23, 24, 18, 12, 0, c1, INK); ellipse(20, 24, 12, 7, 0, rgba(c2, 0.35));
  circle(38, 24, 7.5, c1, INK); circle(34, 17.5, 3, c2, INK); circle(34, 30.5, 3, c2, INK); ellipse(44, 24, 3.6, 3, 0, c2, INK); eye(40.5, 21); eye(40.5, 27);
} });
enemy('cave_bat', { color: '#4a4550', color2: '#2a262e', draw(f, c1, c2) {
  const w = 0.35 + 0.65 * Math.abs(Math.sin(f * TAU));
  for (const sg of [-1, 1]) { const pts = [26, 24 + sg * 3, 22, 24 + sg * 12 * w, 14, 24 + sg * 20 * w, 8, 24 + sg * 14 * w, 12, 24 + sg * 8 * w, 18, 24 + sg * 4]; poly(pts, c1, INK); line(26, 24 + sg * 3, 14, 24 + sg * 20 * w, c2, 1); line(24, 24 + sg * 4, 8, 24 + sg * 14 * w, c2, 1); }
  ellipse(26, 24, 7, 4, 0, c2, INK); circle(32, 24, 3.5, c2, INK); line(31, 21, 33, 17, c2, 1.6); line(31, 27, 33, 31, c2, 1.6); eye(34, 22.5, VERM); eye(34, 25.5, VERM);
} });
enemy('cave_spider', { color: '#5c5348', color2: '#2f2a24', draw(f, c1, c2) {
  for (let i = 0; i < 4; i++) for (const sg of [-1, 1]) { const ph = Math.sin(f * TAU + i * PI / 2 + (sg > 0 ? PI : 0)) * 2.5, bx = 30 - i * 4, kx = bx + 2 - i * 3 + ph, ky = 24 + sg * 12, fx = kx + 1 - i * 2 + ph, fy = 24 + sg * 18; leg(bx, 24 + sg * 4, kx, ky, c2, 1.8); leg(kx, ky, fx, fy, c2, 1.4); }
  ellipse(16, 24, 9, 7.5, 0, c1, INK); ellipse(16, 24, 5, 3, 0, rgba(c2, 0.6)); circle(29, 24, 5.5, c2, INK); for (let i = 0; i < 4; i++) eye(33 + (i % 2) * 1.5, 21 + i * 2, VERM);
} });
enemy('armored_mole', { color: '#6b5e52', color2: '#3d352c', boss: true, draw(f, c1, c2) {
  const s = Math.sin(f * TAU);
  for (const sg of [-1, 1]) { const y = 24 + sg * 10; for (let i = 0; i < 3; i++) leg(36, y - sg * 2, 43 + s * 2 * sg, y + i * 2.5 * sg - sg * 3, BONE2, 1.6); circle(36, y, 3, c2, INK); }
  ellipse(22, 24, 20, 11, 0, c1, INK);
  for (let i = 0; i < 5; i++) arcSeg(14 + i * 5.5, 24, 8, -PI / 2 - 0.5, PI / 2 + 0.5, c2, 1.6);
  ellipse(38, 24, 8, 6.5, 0, c1, INK); circle(45, 24, 2.6, '#a87f78', INK); eye(40, 22, INK); eye(40, 26, INK);
} });
enemy('crystal_golem', { color: '#8aa4b0', color2: '#4f6674', glow: CYAN, draw(f, c1, c2) {
  const s = Math.sin(f * TAU);
  poly([30, 32, 36 + s * 2, 40, 28 + s * 2, 42, 24, 34], c2, INK); poly([18, 32, 12 - s * 2, 40, 20 - s * 2, 42, 24, 34], c2, INK);
  poly([10, 22, 16, 8, 30, 6, 40, 16, 38, 32, 26, 38, 12, 32], c1, INK);
  path([16, 8, 24, 22, 40, 16], rgba(INK, 0.5), 1); path([24, 22, 26, 38], rgba(INK, 0.5), 1); path([10, 22, 24, 22], rgba(INK, 0.5), 1); path([16, 8, 18, 20, 30, 6], rgba(BONE, 0.35), 1);
  circle(25, 22, 4.5, rgba(CYAN, 0.85), INK); circle(25, 22, 2, '#e8ffff');
} });
enemy('silica_swarm', { color: '#c9c3b4', color2: '#8aa3a6', glow: CYAN, draw(f, c1, c2) {
  for (let i = 0; i < 7; i++) { const a = f * TAU + i * TAU / 7, r = 7 + (i % 3) * 3, x = 24 + Math.cos(a) * r, y = 24 + Math.sin(a) * r * 0.8, rot = a * 1.5 + i; c.save(); c.translate(x, y); c.rotate(rot); poly([0, -4.5, 3, 2.5, -3, 2.5], i % 2 ? c1 : c2, INK); line(0, -4.5, 0, 2.5, rgba(BONE, 0.5), 0.8); c.restore(); }
  circle(24, 24, 3, rgba(CYAN, 0.6));
} });
enemy('quartz_serpent', { color: '#b7aecb', color2: '#6c5f8a', boss: true, glow: VIOLET, draw(f, c1, c2) {
  for (let i = 6; i >= 0; i--) { const x = 34 - i * 4.6, y = 24 + Math.sin(f * TAU * 2 + i * 0.9) * 4.5, r = 5.2 - i * 0.45; circle(x, y, r, i % 2 ? c2 : c1, INK); if (r > 2.5) { line(x - r * 0.6, y - r * 0.5, x + r * 0.6, y, rgba(BONE, 0.45), 0.9); line(x - r * 0.6, y + r * 0.5, x + r * 0.6, y, rgba(INK, 0.4), 0.9); } }
  const hy = 24 + Math.sin(f * TAU * 2 - 0.9) * 4.5; poly([34, hy - 6, 46, hy - 2, 46, hy + 2, 34, hy + 6], c1, INK); line(38, hy - 3, 44, hy, rgba(BONE, 0.5), 0.9); eye(41, hy - 3, VIOLET); eye(41, hy + 3, VIOLET); line(46, hy, 49, hy + Math.sin(f * TAU * 4) * 2, VERM, 0.9);
} });
enemy('magma_salamander', { color: '#3a3230', color2: '#221d1b', glow: FIRE, draw(f, c1, c2) {
  const s = Math.sin(f * TAU);
  path([10, 24, 6, 26 + s * 3, 1, 22 + s * 4], c1, 3.2);
  for (const q of [[30, -1, s], [30, 1, -s], [16, -1, -s], [16, 1, s]]) { leg(q[0], 24 + q[1] * 4, q[0] + q[2] * 2, 24 + q[1] * 10, c1, 2.2); leg(q[0] + q[2] * 2, 24 + q[1] * 10, q[0] + q[2] * 2 + 3, 24 + q[1] * 13, c1, 1.6); }
  ellipse(23, 24, 14, 5.8, 0, c1, INK); poly([34, 19, 45, 22, 45, 26, 34, 29], c1, INK);
  const g = 0.7 + 0.3 * Math.sin(f * TAU * 2); path([11, 24, 16, 22, 22, 25, 28, 22, 34, 24], rgba(FIRE, g), 1.4); for (let i = 0; i < 4; i++) line(13 + i * 6, 24, 14 + i * 6, 24 + (i % 2 ? 3 : -3), rgba(AMBER, g * 0.8), 1);
  eye(40, 22, AMBER); eye(40, 26, AMBER);
} });
enemy('titan_beetle', { color: '#5f6a6e', color2: '#333a3e', draw(f, c1, c2) {
  for (let i = 0; i < 3; i++) for (const sg of [-1, 1]) { const ph = Math.sin(f * TAU + i * 2.1 + (sg > 0 ? PI : 0)) * 2; leg(28 - i * 7, 24 + sg * 8, 32 - i * 8 + ph, 24 + sg * 15, c2, 1.8); }
  ellipse(21, 24, 15.5, 11, 0, c1, INK); line(6, 24, 36, 24, c2, 1.2); ellipse(17, 20, 9, 3, -0.15, rgba(BONE, 0.18)); arcSeg(21, 24, 14, PI * 0.15, PI * 0.5, rgba(INK, 0.4), 1);
  circle(38, 24, 4.5, c2, INK); arcSeg(41, 20.5, 4, -PI * 0.9, -PI * 0.1, c2, 1.6); arcSeg(41, 27.5, 4, PI * 0.1, PI * 0.9, c2, 1.6); eye(40, 22, AMBER); eye(40, 26, AMBER);
} });
enemy('basalt_colossus', { color: '#3f3c3a', color2: '#26241f', boss: true, glow: FIRE, draw(f, c1, c2) {
  const s = Math.sin(f * TAU), g = 0.6 + 0.4 * Math.sin(f * TAU * 2);
  fillR(22 - s * 3, 2, 10, 9, c2); strokeR(22 - s * 3, 2, 10, 9, INK); fillR(22 + s * 3, 37, 10, 9, c2); strokeR(22 + s * 3, 37, 10, 9, INK);
  fillR(8, 8, 26, 32, c1); strokeR(8, 8, 26, 32, INK); fillR(6, 12, 30, 8, c2); strokeR(6, 12, 30, 8, INK); fillR(6, 28, 30, 8, c2); strokeR(6, 28, 30, 8, INK);
  fillR(34, 18, 10, 12, c1); strokeR(34, 18, 10, 12, INK); eye(41, 21.5, FIRE); eye(41, 26.5, FIRE);
  jag(10, 12, 30, 34, 5, 1.5, 3, rgba(FIRE, g), 1.3); jag(28, 10, 14, 30, 4, 1.5, 7, rgba(AMBER, g * 0.8), 1);
} });
enemy('void_wraith', { color: '#d9d0e8', color2: '#6c5f8a', glow: VIOLET, translucent: true, draw(f, c1, c2) {
  for (let i = 0; i < 5; i++) { const y0 = 24 + (i - 2) * 3, pts = [18, y0]; for (let k = 1; k <= 4; k++) pts.push(18 - k * 4, y0 + Math.sin(f * TAU + i * 1.3 + k * 1.1) * (2 + k * 1.2)); path(pts, rgba(c2, 0.75), 2.2 - i * 0.2); }
  circle(24, 24, 9, rgba(c2, 0.55), rgba(c1, 0.6)); circle(26, 24, 5.5, rgba(c1, 0.7)); eye(30, 22, CYAN); eye(30, 26, CYAN);
} });
enemy('plasma_devourer', { color: '#2e3a44', color2: '#1a2229', glow: CYAN, draw(f, c1, c2) {
  const o = 0.6 + 0.4 * Math.abs(Math.sin(f * TAU));
  for (let i = 0; i < 4; i++) { const a = PI + (i - 1.5) * 0.7, x0 = 24 + Math.cos(a) * 11, y0 = 24 + Math.sin(a) * 11; path([x0, y0, x0 + Math.cos(a) * 6, y0 + Math.sin(a) * 6 + Math.sin(f * TAU + i) * 3, x0 + Math.cos(a) * 11, y0 + Math.sin(a) * 11 + Math.sin(f * TAU + i + 1) * 4], c1, 2.4); }
  circle(24, 24, 13, c1, INK); ring(24, 24, 11, 2, rgba(CYAN, 0.75)); circle(24, 24, 9 * o, c2, INK);
  for (let i = 0; i < 8; i++) { const a = i * PI / 4; poly([24 + Math.cos(a) * 9 * o, 24 + Math.sin(a) * 9 * o, 24 + Math.cos(a + 0.25) * 9 * o, 24 + Math.sin(a + 0.25) * 9 * o, 24 + Math.cos(a + 0.12) * 5 * o, 24 + Math.sin(a + 0.12) * 5 * o], '#c8d4d8', INK, 0.6); }
  circle(24, 24, 3 * o, rgba(CYAN, 0.9));
} });
enemy('core_guardian', { color: '#8c7fb0', color2: '#3b3452', boss: true, glow: VIOLET, draw(f, c1, c2) {
  const a = f * TAU;
  ellipse(24, 24, 20, 7, a, null, rgba(CYAN, 0.7), 1.4); ellipse(24, 24, 20, 7, a + PI / 3, null, rgba(c1, 0.7), 1.4); ellipse(24, 24, 20, 7, a + 2 * PI / 3, null, rgba(VIOLET, 0.7), 1.4);
  circle(24, 24, 9, c2, INK); circle(24, 24, 6, c1); circle(22, 22, 2.5, rgba(BONE, 0.5)); ring(24, 24, 9, 1, rgba(CYAN, 0.5));
  for (let i = 0; i < 3; i++) { const t0 = -a * 1.5 + i * TAU / 3; circle(24 + Math.cos(t0) * 20, 24 + Math.sin(t0) * 7 * Math.cos(a) + Math.sin(t0) * 0, 2.6, i ? VIOLET : CYAN, INK); }
  eye(29, 24, '#f4f0ff');
} });
enemy('generic', { color: '#7a746a', color2: '#3a3733', draw(f, c1, c2) { const s = Math.sin(f * TAU); for (const q of [[30, -8, s], [30, 8, -s], [16, -8, -s], [16, 8, s]]) circle(q[0] + q[2] * 2, 24 + q[1], 3, c2, INK); ellipse(24, 24, 14, 8, 0, c1, INK); circle(36, 24, 5, c2, INK); eye(38, 22); eye(38, 26); } });

function enemyFrame(E, id, def, b, frame) {
  const ck = 'en:' + id + ':' + b + ':' + frame;
  let cv = cacheGet(ck); if (cv) return cv;
  const px = Math.round(TILE * b); cv = U.canvas(px, px);
  const g = cv.getContext('2d'); g.scale(b, b); g.lineCap = 'round'; g.lineJoin = 'round';
  const prev = begin(g, { def, id, W: TILE, size: 1, tier: 0, k: b, hair: Math.max(1 / b, 0.6), A: BONE, cls: 'n', rnd: U.rng(1) });
  if (E.translucent) g.globalAlpha = 0.72;
  try { E.draw(frame / EN_FRAMES, def.color || E.color, def.color2 || E.color2, 0); } catch (err) { console.error('[Sprites] enemy painter failed for "' + id + '"', err); }
  end(prev); applyNoise(g, px);
  return cacheSet(ck, cv);
}
function enemyFacing(inst, t) {
  let ph = phases.get(inst);
  if (!ph) { ph = { t, dt: 0, s: 0, a: 0, aim: null, p0: U.hash2(Math.round((inst.x || 0) * 13), Math.round((inst.y || 0) * 13), 11) }; phases.set(inst, ph); }
  const dt = Math.min(0.1, Math.max(0, t - ph.t)); ph.t = t;
  let target = null;
  if (typeof inst.aim === 'number') target = inst.aim; else if (typeof inst.dir === 'number') target = inst.dir; else if (typeof inst.angle === 'number') target = inst.angle;
  else if (inst.path && inst.path.length) { const p = inst.path[Math.min(inst.pi | 0, inst.path.length - 1)]; if (p) { const dx = p[0] - inst.x, dy = p[1] - inst.y; if (dx * dx + dy * dy > 0.09) target = Math.atan2(dy, dx); } }
  if (ph.aim === null) ph.aim = target === null ? 0 : target;
  else if (target !== null) { let d = target - ph.aim; d = Math.atan2(Math.sin(d), Math.cos(d)); ph.aim += U.clamp(d, -dt * 6, dt * 6); }
  return ph;
}
S.drawEnemy = function (ctx, def, px, py, sizePx, t, inst) {
  if (!def) return; t = t || 0;
  const id = def.sprite || def.id, E = EN[id] || EN.generic, b = bucketFor(sizePx / TILE);
  let facing = 0, p0 = 0.3;
  if (inst) { const ph = enemyFacing(inst, t); facing = ph.aim; p0 = ph.p0; }
  const hz = 0.9 + (def.speed || 2) * 0.45, frame = Math.floor(((t * hz + p0) % 1) * EN_FRAMES) % EN_FRAMES;
  const cv = enemyFrame(E, id, def, b, frame), cx = px + sizePx / 2, cy = py + sizePx / 2;
  if (E.glow && sizePx >= 14) { ctx.save(); ctx.fillStyle = rgba(E.glow, 0.08 + 0.06 * Math.sin(t * 4 + p0 * 9)); ctx.beginPath(); ctx.arc(cx, cy, sizePx * 0.4, 0, TAU); ctx.fill(); ctx.restore(); }
  ctx.save(); ctx.translate(cx, cy); if (facing) ctx.rotate(facing); ctx.drawImage(cv, -sizePx / 2, -sizePx / 2, sizePx, sizePx); ctx.restore();
};
S.enemyThumb = function (def, sizePx) {
  def = def || {}; sizePx = Math.max(8, sizePx | 0);
  const ck = 'ethumb:' + (def.sprite || def.id) + ':' + sizePx;
  let cv = cacheGet(ck); if (cv) return cv;
  cv = U.canvas(sizePx, sizePx); S.drawEnemy(cv.getContext('2d'), def, 0, 0, sizePx, 0, null);
  return cacheSet(ck, cv);
};
for (const k of LIVE.split(' ')) if (SP[k]) SP[k].live = true;
S.enemyIds = () => Object.keys(EN).filter(k => k !== 'generic');
S.spriteKeys = () => Object.keys(SP).concat(Object.keys(OVERLAY));

/* ── KDZDUSTRY lockup: hero K D Z (LD.KDZ.glyphs) + "DUSTRY" in the 4×6 technical lettering (LD.KDZ.font) ── */
const LOCK = { spaceKD: 253, spaceDZ: 131, gapZD: 200, gap: 190, penMul: 0.8, reveal: 1.4 };
function lockupLayout(cap) {
  const K = LD.KDZ, g = K && K.glyphs; if (!g || !g.K || !K.font) return null;
  const s = cap / 1000, hw = K.PEN_HW || 20, hwF = hw * LOCK.penMul, k = 1000 / 6, cw = 4 * k + 2 * hwF;
  const kx = -g.K.x0, dx = kx + g.K.x1 + LOCK.spaceKD - g.D.x0, zx = dx + g.D.x1 + LOCK.spaceDZ - g.Z.x0, tx = zx + g.Z.x1 + LOCK.gapZD + hwF;
  return { s, hw, hwF, k, cw, kx, dx, zx, tx, adv: cw + LOCK.gap, width: (tx + 6 * cw + 5 * LOCK.gap) * s, glyphs: g, font: K.font };
}
function strokeGlyph(ctx, g, ox, oy, s, budget) {
  ctx.beginPath();
  for (let i = 0; i < g.parts.length && budget > 0; i++) {
    const p = g.parts[i], f = budget >= p.len ? 1 : budget / p.len; budget -= p.len;
    if (p.arc) { const a0 = p.a0, a1 = p.a0 + p.sweep * f; ctx.moveTo(ox + (p.cx + p.r * Math.cos(a0)) * s, oy - (p.cy + p.r * Math.sin(a0)) * s); ctx.arc(ox + p.cx * s, oy - p.cy * s, p.r * s, -a0, -a1, p.sweep > 0); }
    else { ctx.moveTo(ox + p.x0 * s, oy - p.y0 * s); ctx.lineTo(ox + (p.x0 + (p.x1 - p.x0) * f) * s, oy - (p.y0 + (p.y1 - p.y0) * f) * s); }
  }
  ctx.stroke();
  return budget;
}
S.lockupWidth = function (cap) { const L = lockupLayout(cap); return L ? L.width : cap * 0.78 * 9; };
S.lockup = function (ctx, x, y, cap, t) {
  const L = lockupLayout(cap), col = (!ctx.strokeStyle || ctx.strokeStyle === '#000000') ? BONE : ctx.strokeStyle;
  ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (!L) { ctx.font = '700 ' + (cap / 0.72).toFixed(1) + 'px ' + 'ui-monospace,"SF Mono",Menlo,Consolas,"DejaVu Sans Mono",monospace'; ctx.textBaseline = 'alphabetic'; ctx.fillText('KDZDUSTRY', x, y); const w = ctx.measureText('KDZDUSTRY').width; ctx.restore(); return { w, h: cap }; }
  const s = L.s, g = L.glyphs, prog = (typeof t === 'number' && isFinite(t) && t >= 0 && t < LOCK.reveal) ? U.easeOut(t / LOCK.reveal) : 1;
  const heroLen = g.K.len + g.D.len + g.Z.len, textLen = 6 * 3000, total = heroLen + textLen;
  let budget = prog * total;
  ctx.lineWidth = 2 * L.hw * s;
  budget = strokeGlyph(ctx, g.K, x + L.kx * s, y, s, budget);
  if (budget > 0) budget = strokeGlyph(ctx, g.D, x + L.dx * s, y, s, budget);
  if (budget > 0) budget = strokeGlyph(ctx, g.Z, x + L.zx * s, y, s, budget);
  ctx.lineWidth = 2 * L.hwF * s;
  const word = 'DUSTRY', ks = L.k * s;
  for (let i = 0; i < word.length && budget > 0; i++) {
    const src = L.font[word[i]]; if (!src) continue;
    const ox = x + (L.tx + i * L.adv) * s, f = Math.min(1, budget / 3000); budget -= 3000;
    ctx.beginPath();
    for (const pl of src.split('|')) {
      const v = pl.trim().split(/[ ,]+/).map(Number); let L2 = 0; for (let j = 0; j + 3 < v.length; j += 2) L2 += Math.hypot(v[j + 2] - v[j], v[j + 3] - v[j + 1]);
      let rem = f * L2; ctx.moveTo(ox + v[0] * ks, y - v[1] * ks);
      for (let j = 0; j + 3 < v.length && rem > 0; j += 2) { const sl = Math.hypot(v[j + 2] - v[j], v[j + 3] - v[j + 1]), q = rem >= sl ? 1 : rem / sl; rem -= sl; ctx.lineTo(ox + (v[j] + (v[j + 2] - v[j]) * q) * ks, y - (v[j + 1] + (v[j + 3] - v[j + 1]) * q) * ks); }
    }
    ctx.stroke();
  }
  ctx.restore();
  return { w: L.width, h: cap + (LD.KDZ.OVERSHOOT + L.hw) * s, baselineOvershoot: (LD.KDZ.OVERSHOOT + L.hw) * s };
};

/* ── canon table (id:tier:size:sprite:cat) so thumbs and the gallery work before content loads ── */
S.CANON = 'hub:0:3:hub:core elevator:2:2:elevator:core elevator_steel:3:2:elevator:logistics elevator_industrial:5:2:elevator:logistics elevator_quantum:7:2:elevator:logistics drive_shaft:1:1:cable:logistics cable_copper:2:1:cable:logistics cable_hv:4:1:cable:logistics cable_super:7:1:cable:logistics pipe_wood:0:1:pipe:logistics pipe_bronze:1:1:pipe:logistics pipe_steel:3:1:pipe:logistics pipe_titanium:5:1:pipe:logistics pipe_quantum:7:1:pipe:logistics tank_wood:0:1:tank:storage tank_iron:2:1:tank:storage tank_steel:3:2:tank:storage tank_titanium:5:2:tank:storage tank_cryo:6:2:tank:storage tank_quantum:7:3:tank:storage conveyor_wood:0:1:conveyor:logistics conveyor_iron:2:1:conveyor:logistics conveyor_steel:3:1:conveyor:logistics conveyor_titanium:5:1:conveyor:logistics conveyor_quantum:7:1:conveyor:logistics shaft_coal:2:2:shaft:logistics shaft_deep:3:2:shaft:logistics shaft_abyss:5:2:shaft:logistics shaft_core:7:2:shaft:logistics warehouse_wood:0:2:warehouse:storage warehouse_stone:1:2:warehouse:storage warehouse_steel:3:2:warehouse:storage warehouse_auto:5:2:warehouse:storage silo_quantum:7:3:warehouse:storage torch:0:1:torch:special lamp:2:1:lamp:special maintenance_bay:4:2:maintenance_bay:special gather_hut:0:2:gather_hut:nature woodcutter:0:2:woodcutter:nature hunting_lodge:0:2:hunting_lodge:nature well:0:1:well:nature pump_hand:1:1:pump_hand:nature pump_electric:3:1:pump_electric:nature quarry:0:2:quarry:extract clay_pit:0:2:clay_pit:extract sand_pit:1:2:sand_pit:extract peat_cutter:1:2:peat_cutter:extract salt_works:1:2:salt_works:extract planter:1:2:planter:nature tree_farm:2:3:tree_farm:nature fiber_farm:1:3:fiber_farm:nature bonsai:3:1:bonsai:nature bonsai_hydro:5:1:bonsai_hydro:nature algae_farm:4:3:algae_farm:nature greenhouse:4:3:greenhouse:nature borer_steam:2:2:borer:extract borer_electric:3:2:borer:extract borer_laser:5:2:borer:extract borer_plasma:7:3:borer:extract mine_hand:0:2:drill:extract mine_gallery:1:2:drill:extract drill_steam:2:2:drill:extract drill_electric:3:2:drill:extract excavator:4:3:drill:extract drill_laser:5:2:drill:extract drill_cryo:6:2:drill:extract extractor_plasma:7:3:drill:extract pumpjack:3:2:pumpjack:extract gas_well:4:2:gas_well:extract brine_pump:6:2:brine_pump:extract he3_collector:7:2:he3_collector:extract workbench:0:1:workbench:process charcoal_pit:0:2:charcoal_pit:process stone_furnace:0:1:stone_furnace:process kiln:0:1:kiln:process tannery:0:2:tannery:process bronze_forge:1:2:bronze_forge:process trip_hammer:1:2:trip_hammer:process sawmill:1:2:sawmill:process millstone:1:2:millstone:process steam_hammer:2:2:steam_hammer:process blast_furnace:2:3:blast_furnace:process coke_oven:2:2:coke_oven:process crusher:2:2:crusher:process press:3:2:press:process lathe:3:1:lathe:process wiremill:3:1:wiremill:process assembler:3:2:assembler:process electric_furnace:3:1:electric_furnace:process mixer:3:2:mixer:process distillery:3:2:distillery:process chemical_plant:4:3:chemical_plant:process refinery:4:3:refinery:process electrolyzer:4:2:electrolyzer:process centrifuge:4:2:centrifuge:process compressor:4:1:compressor:process arc_furnace:5:3:arc_furnace:process vacuum_furnace:5:2:vacuum_furnace:process fabricator:5:2:fabricator:process enrichment_centrifuge:6:3:enrichment_centrifuge:process fuel_fabricator:6:2:fuel_fabricator:process cryo_plant:6:2:cryo_plant:process nano_forge:7:3:nano_forge:process matter_assembler:7:3:matter_assembler:process water_wheel:1:2:water_wheel:power windmill:1:2:windmill:power steam_engine:2:2:steam_engine:power coal_plant:3:3:coal_plant:power diesel_generator:4:2:diesel_generator:power gas_turbine:4:3:gas_turbine:power solar_panel:4:1:solar_panel:power geothermal_plant:4:3:geothermal_plant:power battery:3:1:battery:power capacitor_bank:5:2:capacitor_bank:power fission_reactor:6:3:fission_reactor:power cooling_tower:6:2:cooling_tower:power fusion_reactor:7:3:fusion_reactor:power study_table:0:1:study_table:research lab_basic:2:2:lab_basic:research lab_industrial:4:3:lab_industrial:research lab_quantum:6:3:lab_quantum:research palisade:0:1:wall:defense stone_wall:1:1:wall:defense steel_wall:3:1:wall:defense titanium_wall:5:1:wall:defense thermal_wall:7:1:wall:defense watchtower:0:1:watchtower:defense ballista:1:2:ballista:defense cannon_turret:3:2:cannon_turret:defense gatling_turret:4:1:gatling_turret:defense tesla_coil:4:1:tesla_coil:defense laser_turret:5:1:laser_turret:defense plasma_turret:7:2:plasma_turret:defense';
S.canonDefs = function () { return S.CANON.split(' ').map(r => { const p = r.split(':'); const d = { id: p[0], tier: +p[1], size: +p[2], sprite: p[3], cat: p[4], hp: 100 }; if (d.sprite === 'cable') d.overlay = 'cable'; if (d.sprite === 'pipe') d.overlay = 'pipe'; if (d.sprite === 'conveyor') d.conveyor = { rate: 1 }; if (d.sprite === 'tank') d.tank = { cap: 100 }; return d; }); };
S.cacheSize = () => cache.size;
S.clearCache = () => { cache.clear(); cacheBytes = 0; };
S.cacheBytes = () => cacheBytes;

/* ── self-test gallery: ?spritetest ── */
function gallery() {
  const R = LD.Registry, defs = (R && R.structures && R.structures.size) ? Array.from(R.structures.values()) : S.canonDefs();
  const enemies = (R && R.enemies && R.enemies.size) ? Array.from(R.enemies.values()) : S.enemyIds().map(id => ({ id, name: id, speed: 2 }));
  const root = U.el('div#spritetest', { style: { position: 'fixed', inset: '0', zIndex: '1000', background: '#0c0c0d', color: '#ece7dc', overflow: 'auto', fontFamily: 'ui-monospace,Menlo,Consolas,monospace', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', padding: '16px' } });
  const cols = 10, cell = 128, states = ['working', 'idle', 'no_power', 'no_input', 'output_full', 'no_fuel', 'no_fluid', 'no_link', 'broken', 'paused'];
  const cv = U.canvas(cols * cell, Math.ceil(defs.length / cols) * cell + 1000), g = cv.getContext('2d');
  cv.style.display = 'block'; cv.style.maxWidth = '100%';
  root.appendChild(U.el('div', { style: { marginBottom: '8px' } }, 'KDZDUSTRY SPRITE TEST — ' + defs.length + ' structures, ' + enemies.length + ' enemies, badges, overlays, lockup'));
  root.appendChild(cv); document.body.appendChild(root);
  const insts = defs.map((d, i) => ({ uid: 'g' + i, id: d.id, x: i % cols, y: (i / cols) | 0, rot: 0, hp: 100, maxHp: 100, state: 'working', oc: 0, tank: { fluid: 'water', amt: 60 } }));
  const t0 = performance.now();
  let frames = 0, fps = 0, acc = 0;
  const label = (txt, x, y, col) => { g.fillStyle = col || BONE3; g.font = '9px ui-monospace,Menlo,Consolas,monospace'; g.textAlign = 'left'; g.fillText(txt, x, y); };
  const frame = () => {
    const t = (performance.now() - t0) / 1000; frames++;
    g.fillStyle = '#0c0c0d'; g.fillRect(0, 0, cv.width, cv.height);
    defs.forEach((d, i) => { const x = (i % cols) * cell + 10, y = ((i / cols) | 0) * cell + 4, inst = insts[i]; inst.rot = 0; inst.state = 'working'; g.fillStyle = '#141416'; g.fillRect(x - 2, y - 2, 100, 100); S.draw(g, d, x + (96 - Math.min(96, d.size * 32)) / 2 * 0, y, 96, t, inst); label(d.id.slice(0, 22), x, y + 108, BONE2); label('T' + d.tier + ' ' + d.size + '×' + d.size + ' ' + (d.sprite || ''), x, y + 118, BONE4); });
    let y = Math.ceil(defs.length / cols) * cell + 10, x = 10;
    label('STATES / INTEGRITY / OVERCLOCK / BUILDING / GHOST', x, y - 2); y += 6;
    const demo = defs.find(d => d.id === 'steam_engine') || defs[0];
    states.forEach((st, i) => { const inst = { uid: 's' + i, id: demo.id, x: i, y: 0, rot: i & 3, hp: 100, maxHp: 100, state: st, oc: 0 }; S.draw(g, demo, x + i * 100, y, 72, t, inst); S.drawBadge(g, st, x + i * 100, y, 72, 0.5); label(st, x + i * 100, y + 84); });
    y += 96;
    const variants = [{ hp: 100, state: 'working' }, { hp: 40, state: 'working' }, { hp: 0, state: 'broken' }, { oc: 1, state: 'working' }, { oc: 3, state: 'working' }, { state: 'building', build: { left: (1 - ((t * 0.15) % 1)) * 10, total: 10 } }];
    variants.forEach((v, i) => { const inst = Object.assign({ uid: 'v' + i, id: demo.id, x: i, y: 1, rot: 0, hp: 100, maxHp: 100, oc: 0 }, v); S.draw(g, demo, x + i * 100, y, 72, t, inst); label(v.state + (v.oc ? ' oc' + v.oc : '') + (v.hp !== undefined ? ' hp' + v.hp : ''), x + i * 100, y + 84); });
    S.drawGhost(g, demo, x + 600, y, 72, true, 1); label('ghost ok', x + 600, y + 84); S.drawGhost(g, demo, x + 700, y, 72, false, 2); label('ghost bad', x + 700, y + 84);
    const big = defs.find(d => d.id === 'fusion_reactor'); if (big) { S.draw(g, big, x + 820, y, 144, t, { uid: 'big', id: big.id, x: 0, y: 0, rot: 0, hp: 100, maxHp: 100, state: 'working', oc: 0 }); label('fusion 144px', x + 820, y + 156); }
    const hubd = defs.find(d => d.id === 'hub'); if (hubd) { S.draw(g, hubd, x + 990, y, 144, t, { uid: 'hub', id: 'hub', x: 0, y: 0, rot: 0, hp: 100, maxHp: 100, state: 'idle', oc: 0 }); S.draw(g, hubd, x + 1150, y, 48, t, null); S.draw(g, demo, x + 1150, y + 60, 24, t, { uid: 'sm', id: demo.id, x: 0, y: 0, rot: 0, hp: 100, maxHp: 100, state: 'working', oc: 0 }); label('hub 144 / 48 / demo 24', x + 990, y + 156); }
    y += 170;
    label('OVERLAYS: straight / corner / T / cross per tier', x, y - 2); y += 6;
    const masks = [10, 6, 14, 15, 5], ovs = defs.filter(d => overlayKind(d));
    ovs.forEach((d, i) => { masks.forEach((m, j) => { const nb = { n: !!(m & 1), e: !!(m & 2), s: !!(m & 4), w: !!(m & 8) }; S.drawOverlay(g, d, x + i * 56 + j * 0, y + j * 0, 48, t, { uid: 'o' + i + j, id: d.id, x: i, y: j, rot: 0 }, j === 0 ? nb : null); }); });
    ovs.forEach((d, i) => { masks.forEach((m, j) => { const nb = { n: !!(m & 1), e: !!(m & 2), s: !!(m & 4), w: !!(m & 8) }; S.drawOverlay(g, d, x + i * 56, y + 52 + j * 52, 48, t, { uid: 'o' + i + j, id: d.id, x: i, y: j, rot: 0 }, nb); }); label(d.id.slice(0, 12), x + i * 56, y + 52 * 6 + 8); });
    y += 52 * 6 + 20;
    label('ENEMIES at 40px and 96px (walk cycle, facing rotates)', x, y - 2); y += 6;
    enemies.forEach((e, i) => { const inst = { uid: 'e' + i, id: e.id, x: 0, y: 0, dir: t * 0.6 + i }; S.drawEnemy(g, e, x + i * 100, y, 40, t, inst); S.drawEnemy(g, e, x + i * 100, y + 44, 96, t, null); label(e.id.slice(0, 14), x + i * 100, y + 150); });
    y += 160;
    label('LOCKUP (t-reveal loops every 4 s)', x, y - 2); y += 6;
    g.strokeStyle = BONE; S.lockup(g, x, y + 100, 100, t % 4); g.strokeStyle = VERM; S.lockup(g, x + 10, y + 150, 30, null);
    label('cache ' + S.cacheSize() + ' canvases · ' + fps.toFixed(0) + ' fps', x, y + 175);
    acc += 1; if (frames % 30 === 0) { fps = 30 / ((performance.now() - t0) / 1000 - lastT); lastT = (performance.now() - t0) / 1000; }
    requestAnimationFrame(frame);
  };
  let lastT = 0;
  requestAnimationFrame(frame);
}
if (typeof location !== 'undefined' && /[?&]spritetest/.test(location.search)) { if (document.readyState === 'loading') addEventListener('DOMContentLoaded', gallery); else setTimeout(gallery, 0); }
})();
