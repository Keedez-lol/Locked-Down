(() => {
'use strict';
const LD = window.LD, U = LD.U;
const CAP = 6000, SW = 1920, SH = 1080;
const KINDS = ['smoke', 'steam', 'spark', 'dust', 'ember', 'glow', 'shot', 'hit', 'death', 'build', 'rubble', 'rain', 'plasma', 'arc', 'fog', 'bubble'];
const K = {}; KINDS.forEach((k, i) => { K[k] = i; });
const NK = KINDS.length;
const ADD = new Uint8Array(NK); [K.spark, K.ember, K.glow, K.shot, K.plasma, K.arc].forEach(i => { ADD[i] = 1; });
const LIGHT = new Uint8Array(NK); [K.ember, K.glow, K.plasma].forEach(i => { LIGHT[i] = 1; });
const HPI = Math.PI / 2, TAU = Math.PI * 2, rnd = Math.random;

/* per-kind defaults: world px/s, seconds, px at zoom 1 */
const DEF = [];
DEF[K.smoke] = { n: 1, life: 2.8, size: 5, speed: 12, spread: 0.45, dir: -HPI, color: 0x56544f, alpha: 0.30 };
DEF[K.steam] = { n: 1, life: 1.4, size: 4, speed: 26, spread: 0.55, dir: -HPI, color: 0xd9d6cf, alpha: 0.24 };
DEF[K.spark] = { n: 3, life: 0.5, size: 1.4, speed: 120, spread: 0.9, dir: -HPI, color: 0xffd27a, alpha: 0.95 };
DEF[K.dust] = { n: 1, life: 1.8, size: 3.5, speed: 16, spread: 1.4, dir: -HPI, color: 0x8a7a62, alpha: 0.28 };
DEF[K.ember] = { n: 1, life: 1.6, size: 1.8, speed: 22, spread: 0.8, dir: -HPI, color: 0xff8c3a, alpha: 0.9 };
DEF[K.glow] = { n: 1, life: 1.4, size: 10, speed: 4, spread: Math.PI, dir: 0, color: 0x9ab8ff, alpha: 0.22 };
DEF[K.shot] = { n: 4, life: 0.25, size: 1.6, speed: 90, spread: Math.PI, dir: 0, color: 0xfff0c0, alpha: 0.9 };
DEF[K.hit] = { n: 6, life: 0.4, size: 1.8, speed: 110, spread: Math.PI, dir: 0, color: 0xffb070, alpha: 0.9 };
DEF[K.death] = { n: 10, life: 0.9, size: 3, speed: 70, spread: Math.PI, dir: -HPI, color: 0x8a8378, alpha: 0.9 };
DEF[K.build] = { n: 12, life: 0.7, size: 2.4, speed: 40, spread: Math.PI, dir: 0, color: 0xb8b0a0, alpha: 0.6 };
DEF[K.rubble] = { n: 4, life: 1.6, size: 3, speed: 60, spread: 0.7, dir: -HPI, color: 0x6e6b66, alpha: 0.95 };
DEF[K.rain] = { n: 1, life: 1.1, size: 1, speed: 1500, spread: 0, dir: Math.atan2(1500, -120), color: 0xa8bfd8, alpha: 0.32 };
DEF[K.plasma] = { n: 2, life: 0.5, size: 4, speed: 30, spread: Math.PI, dir: 0, color: 0x7ad0ff, alpha: 0.55 };
DEF[K.arc] = { n: 1, life: 0.08, size: 1, speed: 0, spread: 0, dir: 0, color: 0xbfe0ff, alpha: 0.9 };
DEF[K.fog] = { n: 1, life: 9, size: 110, speed: 6, spread: 0.3, dir: 0, color: 0xc9c4b8, alpha: 0.05 };
DEF[K.bubble] = { n: 1, life: 1.3, size: 2.2, speed: 14, spread: 0.4, dir: -HPI, color: 0xbfd6e8, alpha: 0.55 };

const X = new Float32Array(CAP), Y = new Float32Array(CAP), VX = new Float32Array(CAP), VY = new Float32Array(CAP);
const LIFE = new Float32Array(CAP), MAX = new Float32Array(CAP), SIZE = new Float32Array(CAP), ROT = new Float32Array(CAP);
const KIND = new Uint8Array(CAP), COL = new Uint32Array(CAP), LAY = new Int8Array(CAP);
const ORDER = new Int32Array(CAP), CNT = new Int32Array(NK + 1), START = new Int32Array(NK + 1);
let n = 0, steal = 0, tNow = 0;
const NOOPTS = {};

const colCache = new Map(), strCache = new Map(), spriteCache = new Map();
const packColor = c => {
  if (typeof c === 'number') return c;
  let v = colCache.get(c);
  if (v === undefined) {
    if (typeof c === 'string' && c[0] === '#') { const [r, g, b] = U.hexToRgb(c); v = (r << 16) | (g << 8) | b; } else v = 0xffffff;
    colCache.set(c, v);
  }
  return v;
};
const colStr = rgb => {
  let s = strCache.get(rgb);
  if (s === undefined) { s = 'rgb(' + (rgb >> 16 & 255) + ',' + (rgb >> 8 & 255) + ',' + (rgb & 255) + ')'; strCache.set(rgb, s); }
  return s;
};
// soft radial disc, cached per colour; drawn with drawImage (no per-frame gradient allocation)
const softSprite = rgb => {
  let c = spriteCache.get(rgb);
  if (!c) {
    c = U.canvas(32, 32);
    const g = c.getContext('2d'), r = rgb >> 16 & 255, gg = rgb >> 8 & 255, b = rgb & 255;
    const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(' + r + ',' + gg + ',' + b + ',1)');
    grad.addColorStop(0.45, 'rgba(' + r + ',' + gg + ',' + b + ',0.45)');
    grad.addColorStop(1, 'rgba(' + r + ',' + gg + ',' + b + ',0)');
    g.fillStyle = grad; g.fillRect(0, 0, 32, 32);
    spriteCache.set(rgb, c);
  }
  return c;
};

const alloc = () => { if (n < CAP) return n++; steal = (steal + 1) % CAP; return steal; };

const P = LD.Particles = {
  KINDS, K, wind: 0, rateMul: 1, t: 0,
  get count() { return n; },
  setQuality(q) { P.rateMul = q === 'off' ? 0 : q === 'low' ? 0.25 : 1; },

  emit(kind, x, y, opts) {
    const ki = typeof kind === 'number' ? kind : K[kind];
    if (ki === undefined || P.rateMul <= 0) return;
    const d = DEF[ki], o = opts || NOOPTS;
    let cnt = o.n !== undefined ? o.n : d.n;
    if (P.rateMul < 1) { if (cnt > 1) cnt = Math.max(1, Math.round(cnt * P.rateMul)); else if (rnd() > P.rateMul) return; }
    const col = o.color !== undefined ? packColor(o.color) : d.color;
    const layer = ki === K.rain ? -1 : o.layer !== undefined ? o.layer : (LD.G ? LD.G.view.layer : 0);
    const dir = o.dir !== undefined ? o.dir : d.dir, spread = o.spread !== undefined ? o.spread : d.spread;
    const speed = o.speed !== undefined ? o.speed : d.speed, life = o.life || d.life, size = o.size || d.size;
    const jit = o.jitter || 0;
    for (let j = 0; j < cnt; j++) {
      const i = alloc();
      const ang = dir + (rnd() - 0.5) * 2 * spread, sp = speed * (0.55 + rnd() * 0.9);
      X[i] = x + (rnd() - 0.5) * jit; Y[i] = y + (rnd() - 0.5) * jit;
      VX[i] = o.vx !== undefined ? o.vx : Math.cos(ang) * sp; VY[i] = o.vy !== undefined ? o.vy : Math.sin(ang) * sp;
      LIFE[i] = MAX[i] = life * (ki === K.arc || ki === K.rain ? 1 : 0.7 + rnd() * 0.6);
      SIZE[i] = size * (0.7 + rnd() * 0.6); KIND[i] = ki; COL[i] = col; LAY[i] = layer; ROT[i] = rnd() * TAU;
      if (ki === K.build) { const r0 = o.radius || 12, a = rnd() * TAU; X[i] = x + Math.cos(a) * r0; Y[i] = y + Math.sin(a) * r0; VX[i] = Math.cos(a) * sp; VY[i] = Math.sin(a) * sp * 0.6; }
      else if (ki === K.arc) { VX[i] = (o.tx !== undefined ? o.tx : x + 24) - x; VY[i] = (o.ty !== undefined ? o.ty : y) - y; }
      else if (ki === K.fog) { VX[i] = 4 + rnd() * 6; VY[i] = (rnd() - 0.5) * 2; }
    }
  },

  update(dt) {
    if (dt <= 0) return;
    tNow += dt; P.t = tNow;
    const wind = P.wind, drag = Math.pow(0.9, dt * 10), dragH = Math.pow(0.6, dt * 10);
    for (let i = 0; i < n;) {
      const l = LIFE[i] - dt;
      if (l <= 0) { n--; if (i !== n) { X[i] = X[n]; Y[i] = Y[n]; VX[i] = VX[n]; VY[i] = VY[n]; LIFE[i] = LIFE[n]; MAX[i] = MAX[n]; SIZE[i] = SIZE[n]; ROT[i] = ROT[n]; KIND[i] = KIND[n]; COL[i] = COL[n]; LAY[i] = LAY[n]; } continue; }
      LIFE[i] = l;
      switch (KIND[i]) {
        case 0: VY[i] -= 9 * dt; VX[i] += (wind * 0.6 - VX[i]) * dt * 0.8; SIZE[i] += 9 * dt; break;
        case 1: VY[i] -= 14 * dt; VX[i] += (wind - VX[i]) * dt; SIZE[i] += 14 * dt; break;
        case 2: VY[i] += 520 * dt; VX[i] *= drag; break;
        case 3: VX[i] += (wind * 0.4 - VX[i]) * dt * 0.7; VY[i] *= drag; SIZE[i] += 4 * dt; break;
        case 4: VY[i] -= 18 * dt; VX[i] += (rnd() - 0.5) * 60 * dt + wind * 0.3 * dt; break;
        case 5: VX[i] *= drag; VY[i] *= drag; break;
        case 6: VX[i] *= dragH; VY[i] *= dragH; break;
        case 7: VX[i] *= drag; VY[i] += 200 * dt; break;
        case 8: VY[i] += 380 * dt; VX[i] *= drag; ROT[i] += VX[i] * 0.02 * dt; if (l < MAX[i] * 0.3 && VY[i] > 0) { VX[i] = 0; VY[i] = 0; } break;
        case 9: VX[i] *= dragH; VY[i] *= dragH; break;
        case 10: VY[i] += 480 * dt; VX[i] *= drag; ROT[i] += (VX[i] > 0 ? 3 : -3) * dt; if (VY[i] > 0 && l < MAX[i] * 0.55) { VX[i] = 0; VY[i] = 0; } break;
        case 11: break;
        case 12: X[i] += (rnd() - 0.5) * 3; Y[i] += (rnd() - 0.5) * 3; VX[i] *= drag; VY[i] *= drag; break;
        case 13: break;
        case 14: VX[i] += (wind * 0.15 - VX[i]) * dt * 0.2; break;
        case 15: VY[i] -= 10 * dt; VX[i] += Math.sin(tNow * 6 + ROT[i]) * 12 * dt; break;
        default: break;
      }
      X[i] += VX[i] * dt; Y[i] += VY[i] * dt;
      i++;
    }
  },

  draw(ctx, cam, L) {
    if (n === 0) return;
    const z = cam.z || 1, ox = cam.ox !== undefined ? cam.ox : Math.round(SW / 2 - cam.x * z), oy = cam.oy !== undefined ? cam.oy : Math.round(SH / 2 - cam.y * z);
    CNT.fill(0);
    for (let i = 0; i < n; i++) { const ly = LAY[i]; if (ly === L || ly === -1) CNT[KIND[i]]++; }
    let acc = 0;
    for (let k = 0; k < NK; k++) { START[k] = acc; acc += CNT[k]; CNT[k] = START[k]; }
    if (acc === 0) return;
    for (let i = 0; i < n; i++) { const ly = LAY[i]; if (ly === L || ly === -1) ORDER[CNT[KIND[i]]++] = i; }
    const prevAlpha = ctx.globalAlpha, prevComp = ctx.globalCompositeOperation;
    let lastCol = -1;
    for (let k = 0; k < NK; k++) {
      const a0 = START[k], a1 = CNT[k];
      if (a1 === a0) continue;
      ctx.globalCompositeOperation = ADD[k] ? 'lighter' : 'source-over';
      const d = DEF[k];
      lastCol = -1;
      if (k === K.spark || k === K.rain || k === K.bubble || k === K.arc) ctx.lineWidth = k === K.spark ? Math.max(1, 1.1 * z) : 1;
      for (let q = a0; q < a1; q++) {
        const i = ORDER[q], u = LIFE[i] / MAX[i];
        let sx, sy;
        if (k === K.rain) { sx = X[i]; sy = Y[i]; } else { sx = X[i] * z + ox; sy = Y[i] * z + oy; }
        const s = SIZE[i] * z;
        if (sx < -s - 40 || sx > SW + s + 40 || sy < -s - 40 || sy > SH + s + 40) continue;
        const col = COL[i];
        switch (k) {
          case 0: case 1: case 3: case 14: {
            const fadeIn = k === 14 ? Math.min(1, (1 - u) * 4) : Math.min(1, (1 - u) * 6);
            if (col !== lastCol) { ctx.fillStyle = colStr(col); lastCol = col; }
            ctx.globalAlpha = d.alpha * u * fadeIn;
            ctx.beginPath(); ctx.arc(sx, sy, Math.max(0.8, s), 0, TAU); ctx.fill();
            break;
          }
          case 2: {
            if (col !== lastCol) { ctx.strokeStyle = colStr(col); lastCol = col; }
            ctx.globalAlpha = d.alpha * Math.min(1, u * 1.5);
            ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - VX[i] * 0.022 * z, sy - VY[i] * 0.022 * z); ctx.stroke();
            break;
          }
          case 4: {
            if (col !== lastCol) { ctx.fillStyle = colStr(col); lastCol = col; }
            ctx.globalAlpha = d.alpha * u * (0.7 + 0.3 * Math.sin(tNow * 23 + ROT[i] * 7));
            const e = Math.max(1.2, s); ctx.fillRect(sx - e * 0.5, sy - e * 0.5, e, e);
            break;
          }
          case 5: case 12: {
            const sp = softSprite(col), r = Math.max(2, s * (k === 12 ? 1.6 : 2.2));
            ctx.globalAlpha = d.alpha * (k === 5 ? Math.sin(Math.PI * (1 - u)) : u);
            const jx = k === 12 ? (rnd() - 0.5) * 2 : 0;
            ctx.drawImage(sp, sx - r + jx, sy - r - jx, r * 2, r * 2);
            break;
          }
          case 6: case 7: case 9: {
            if (col !== lastCol) { ctx.fillStyle = colStr(col); lastCol = col; }
            ctx.globalAlpha = d.alpha * u;
            const e = Math.max(1, s); ctx.fillRect(sx - e * 0.5, sy - e * 0.5, e, e);
            break;
          }
          case 8: case 10: {
            if (col !== lastCol) { ctx.fillStyle = colStr(col); lastCol = col; }
            ctx.globalAlpha = d.alpha * Math.min(1, u * 2.5);
            const e = Math.max(1.5, s);
            ctx.save(); ctx.translate(sx, sy); ctx.rotate(ROT[i]); ctx.fillRect(-e * 0.5, -e * 0.35, e, e * 0.7); ctx.restore();
            break;
          }
          case 11: {
            if (col !== lastCol) { ctx.strokeStyle = colStr(col); lastCol = col; }
            ctx.globalAlpha = d.alpha * SIZE[i];
            ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - VX[i] * 0.011, sy - VY[i] * 0.011); ctx.stroke();
            break;
          }
          case 13: {
            const ex = sx + VX[i] * z, ey = sy + VY[i] * z, dx = ex - sx, dy = ey - sy, len = Math.hypot(dx, dy) || 1;
            const nx = -dy / len, ny = dx / len, segs = 7, seed = ROT[i] + Math.floor(tNow * 60);
            ctx.strokeStyle = colStr(col);
            for (let pass = 0; pass < 2; pass++) {
              ctx.lineWidth = pass === 0 ? 3 : 1; ctx.globalAlpha = pass === 0 ? 0.22 * u + 0.1 : d.alpha;
              ctx.beginPath(); ctx.moveTo(sx, sy);
              for (let sgi = 1; sgi < segs; sgi++) {
                const tt = sgi / segs, off = (U.hash2(sgi, seed | 0, i) - 0.5) * Math.min(18, len * 0.22) * Math.sin(Math.PI * tt);
                ctx.lineTo(sx + dx * tt + nx * off, sy + dy * tt + ny * off);
              }
              ctx.lineTo(ex, ey); ctx.stroke();
            }
            lastCol = -1;
            break;
          }
          case 15: {
            if (col !== lastCol) { ctx.strokeStyle = colStr(col); lastCol = col; }
            ctx.globalAlpha = d.alpha * u;
            ctx.beginPath(); ctx.arc(sx, sy, Math.max(1, s * (1.3 - u * 0.3)), 0, TAU); ctx.stroke();
            break;
          }
          default: break;
        }
      }
    }
    ctx.globalAlpha = prevAlpha; ctx.globalCompositeOperation = prevComp;
  },

  // lights for the render light map: cb(x, y, radiusPx, intensity, packedRgb) for ember/glow/plasma on layer L
  forEachLight(L, cb) {
    for (let i = 0; i < n; i++) {
      const k = KIND[i];
      if (!LIGHT[k] || LAY[i] !== L) continue;
      const u = LIFE[i] / MAX[i];
      cb(X[i], Y[i], SIZE[i] * (k === K.ember ? 9 : 4), (k === K.glow ? Math.sin(Math.PI * (1 - u)) : u) * (k === K.ember ? 0.35 : 0.25), COL[i]);
    }
  },
  colorString: colStr,
  clear() { n = 0; },
  clearKind(kind) {
    const ki = typeof kind === 'number' ? kind : K[kind];
    for (let i = 0; i < n;) { if (KIND[i] === ki) { n--; if (i !== n) { X[i] = X[n]; Y[i] = Y[n]; VX[i] = VX[n]; VY[i] = VY[n]; LIFE[i] = LIFE[n]; MAX[i] = MAX[n]; SIZE[i] = SIZE[n]; ROT[i] = ROT[n]; KIND[i] = KIND[n]; COL[i] = COL[n]; LAY[i] = LAY[n]; } } else i++; }
  },
  clearLayer(L) {
    for (let i = 0; i < n;) { if (LAY[i] === L) { n--; if (i !== n) { X[i] = X[n]; Y[i] = Y[n]; VX[i] = VX[n]; VY[i] = VY[n]; LIFE[i] = LIFE[n]; MAX[i] = MAX[n]; SIZE[i] = SIZE[n]; ROT[i] = ROT[n]; KIND[i] = KIND[n]; COL[i] = COL[n]; LAY[i] = LAY[n]; } } else i++; }
  }
};
})();
