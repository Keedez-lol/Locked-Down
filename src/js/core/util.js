(() => {
'use strict';
const LD = window.LD = window.LD || {};
const U = LD.U = {};

U.clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
U.lerp = (a, b, t) => a + (b - a) * t;
U.mix = U.lerp;
U.smooth = t => { t = U.clamp(t); return t * t * (3 - 2 * t); };
U.easeOut = t => 1 - Math.pow(1 - U.clamp(t), 3);
U.easeIn = t => Math.pow(U.clamp(t), 3);
U.easeInOut = t => { t = U.clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
U.easeOutExpo = t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
U.dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
U.sign = x => x < 0 ? -1 : x > 0 ? 1 : 0;
U.round = (x, d = 0) => { const k = Math.pow(10, d); return Math.round(x * k) / k; };

/* ── number formatting (es-ES: coma decimal, punto de millar) ── */
const SUFFIX = ['', 'k', 'M', 'G', 'T', 'P', 'E'];
U.fmt = (n, dec = 1) => {
  if (n === undefined || n === null || isNaN(n)) return '–';
  const neg = n < 0; n = Math.abs(n);
  if (n < 1000) {
    const v = n < 10 && n !== Math.floor(n) ? n.toFixed(dec) : Math.floor(n).toString();
    return (neg ? '-' : '') + v.replace('.', ',');
  }
  let i = 0;
  while (n >= 1000 && i < SUFFIX.length - 1) { n /= 1000; i++; }
  const v = n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : n.toFixed(0);
  return (neg ? '-' : '') + v.replace('.', ',') + ' ' + SUFFIX[i];
};
U.fmtInt = n => Math.floor(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
U.fmtRate = (n, dec = 2) => (n >= 0 ? '+' : '') + U.fmt(n, dec) + '/s';
U.fmtSI = (n, unit, dec = 2) => {
  if (n === 0) return '0 ' + unit;
  const neg = n < 0; n = Math.abs(n);
  let i = 0;
  while (n >= 1000 && i < SUFFIX.length - 1) { n /= 1000; i++; }
  const v = n < 10 ? n.toFixed(dec) : n < 100 ? n.toFixed(Math.max(0, dec - 1)) : n.toFixed(0);
  return (neg ? '-' : '') + v.replace('.', ',') + ' ' + SUFFIX[i] + unit;
};
U.fmtW = w => U.fmtSI(w, 'W');
U.fmtJ = j => U.fmtSI(j, 'J');
U.fmtPct = (x, dec = 0) => (x * 100).toFixed(dec).replace('.', ',') + '%';
U.fmtTime = s => {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  if (h > 0) return h + 'h ' + String(m).padStart(2, '0') + 'm';
  if (m > 0) return m + 'm ' + String(r).padStart(2, '0') + 's';
  return r + 's';
};
U.fmtClock = dayFrac => {
  const mins = Math.floor(dayFrac * 24 * 60);
  return String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
};
U.pad2 = n => String(n).padStart(2, '0');

/* ── hashing / random / noise ── */
U.hash2 = (x, y, seed = 0) => {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (seed | 0) * 1274126177;
  h = (h ^ (h >>> 13)) * 1274126177;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};
U.hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
U.rng = seed => {
  let a = (seed >>> 0) || 1;
  const r = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  r.int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  r.pick = arr => arr[Math.floor(r() * arr.length)];
  r.range = (lo, hi) => lo + r() * (hi - lo);
  r.chance = p => r() < p;
  return r;
};
U.noise2 = (x, y, seed = 0) => {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = U.hash2(xi, yi, seed), b = U.hash2(xi + 1, yi, seed), c = U.hash2(xi, yi + 1, seed), d = U.hash2(xi + 1, yi + 1, seed);
  return U.lerp(U.lerp(a, b, u), U.lerp(c, d, u), v);
};
U.fbm = (x, y, seed = 0, oct = 4, lac = 2, gain = 0.5) => {
  let s = 0, a = 1, n = 0, f = 1;
  for (let i = 0; i < oct; i++) { s += a * U.noise2(x * f, y * f, seed + i * 101); n += a; a *= gain; f *= lac; }
  return s / n;
};
U.ridge = (x, y, seed = 0, oct = 4) => { let s = 0, a = 1, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += a * (1 - Math.abs(2 * U.noise2(x * f, y * f, seed + i * 77) - 1)); n += a; a *= 0.5; f *= 2; } return s / n; };

/* ── colour ── */
U.hexToRgb = hex => { const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
U.rgbToHex = (r, g, b) => '#' + [r, g, b].map(v => Math.round(U.clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
U.rgba = (hex, a) => { const [r, g, b] = U.hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; };
U.mixHex = (h1, h2, t) => { const a = U.hexToRgb(h1), b = U.hexToRgb(h2); return U.rgbToHex(U.lerp(a[0], b[0], t), U.lerp(a[1], b[1], t), U.lerp(a[2], b[2], t)); };
U.shade = (hex, k) => { const [r, g, b] = U.hexToRgb(hex); return U.rgbToHex(r * k, g * k, b * k); };
U.lighten = (hex, k) => U.mixHex(hex, '#ffffff', k);

/* ── ids & misc ── */
let uidCounter = 0;
U.uid = () => { uidCounter = (uidCounter + 1) | 0; return Date.now().toString(36) + '-' + (uidCounter).toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36); };
U.key = (x, y) => x + ',' + y;
U.unkey = k => { const i = k.indexOf(','); return [+k.slice(0, i), +k.slice(i + 1)]; };
U.deepClone = o => JSON.parse(JSON.stringify(o));
U.sum = (o, f) => { let s = 0; for (const k in o) s += f ? f(o[k], k) : o[k]; return s; };
U.count = o => { let n = 0; for (const _ in o) n++; return n; };
U.mapObj = (o, f) => { const r = {}; for (const k in o) r[k] = f(o[k], k); return r; };
U.arr = n => Array.from({ length: n }, (_, i) => i);
U.shuffle = (arr, r = Math.random) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
U.now = () => performance.now();
U.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ── DOM builder: el('div.cls#id', {attr, on:{click}}, [children|string]) ── */
U.el = (spec, attrs, children) => {
  if (Array.isArray(attrs) || typeof attrs === 'string' || attrs instanceof Node) { children = attrs; attrs = null; }
  const m = spec.match(/^([a-z0-9-]+)?((?:[.#][\w-]+)*)$/i);
  const tag = (m && m[1]) || 'div';
  const e = document.createElement(tag);
  if (m && m[2]) for (const part of m[2].match(/[.#][\w-]+/g)) { if (part[0] === '.') e.classList.add(part.slice(1)); else e.id = part.slice(1); }
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v === null || v === undefined || v === false) continue;
    if (k === 'on') { for (const ev in v) e.addEventListener(ev, v[ev]); }
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k === 'class' || k === 'className') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'data' && typeof v === 'object') { for (const d in v) e.dataset[d] = v[d]; }
    else if (k in e && typeof v !== 'string') e[k] = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  const add = c => { if (c === null || c === undefined || c === false) return; if (Array.isArray(c)) c.forEach(add); else if (c instanceof Node) e.appendChild(c); else e.appendChild(document.createTextNode(String(c))); };
  add(children);
  return e;
};
U.clear = e => { while (e.firstChild) e.removeChild(e.firstChild); return e; };
U.svg = (inner, w = 24, h = 24, cls = '') => { const t = document.createElement('template'); t.innerHTML = `<svg class="${cls}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`; return t.content.firstChild; };

/* ── canvas helpers ── */
U.canvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; };
U.ctx2d = (c, alpha = true) => c.getContext('2d', { alpha });

/* ── unit helpers for game ── */
U.TIER_NAMES = ['T0 Manual', 'T1 Mecánico', 'T2 Vapor', 'T3 Eléctrico', 'T4 Industrial', 'T5 Avanzado', 'T6 Nuclear', 'T7 Cuántico'];
U.ERA_NAMES = ['Edad de piedra', 'Edad del bronce', 'Era del vapor', 'Era eléctrica', 'Era industrial', 'Era avanzada', 'Era nuclear', 'Era cuántica'];
U.tierName = t => U.TIER_NAMES[U.clamp(t | 0, 0, 7)];
U.eraName = e => U.ERA_NAMES[U.clamp(e | 0, 0, 7)];
})();
