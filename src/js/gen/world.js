(() => {
'use strict';
const LD = window.LD, U = LD.U;

/* ── fallback content (used only when content/layers.js is absent or incomplete) ── */
const AMT = [null, [3000, 8000], [4000, 10000], [6000, 15000], [8000, 20000]];
const dep = (res, hardness, freq, size, amount, fluid) => ({ res, hardness, freq, size, amount, fluid: !!fluid });
const DEF_LAYERS = [
  { idx: 0, w: 256, h: 192, chunk: 16, rockBase: 0, rockPerChunk: 0, borerTier: 0, deposits: [
    dep('copper_ore', 0, 0.28, [3, 6], [400, 900]), dep('tin_ore', 0, 0.22, [3, 5], [300, 700]),
    dep('iron_ore', 0, 0.14, [3, 5], [400, 800]), dep('coal', 0, 0.10, [3, 6], [500, 1000])] },
  { idx: 1, w: 128, h: 96, chunk: 16, rockBase: 1.0, rockPerChunk: 0.35, borerTier: 2, deposits: [
    dep('coal', 1, 3.0, [5, 14], AMT[1]), dep('iron_ore', 1, 2.2, [4, 10], [2500, 6000]), dep('limestone', 1, 2.0, [5, 12], AMT[1]),
    dep('copper_ore', 1, 1.4, [4, 8], AMT[1]), dep('tin_ore', 1, 1.0, [3, 7], AMT[1]), dep('sulfur', 1, 0.9, [3, 7], [1500, 4000]),
    dep('saltpeter', 1, 0.8, [3, 6], [1500, 4000]), dep('salt', 1, 0.6, [3, 6], AMT[1]), dep('flint', 1, 0.5, [2, 5], [800, 2000]),
    dep('crude_oil', 2, 0.5, [3, 6], [4000, 12000], true)] },
  { idx: 2, w: 128, h: 96, chunk: 16, rockBase: 2.0, rockPerChunk: 0.40, borerTier: 3, deposits: [
    dep('zinc_ore', 2, 1.4, [4, 9], AMT[2]), dep('lead_ore', 2, 1.2, [4, 8], AMT[2]), dep('nickel_ore', 2, 1.0, [4, 8], AMT[2]),
    dep('quartz', 2, 1.2, [4, 9], AMT[2]), dep('bauxite', 2, 1.0, [4, 9], AMT[2]), dep('copper_ore', 2, 1.0, [4, 8], AMT[2]),
    dep('tin_ore', 2, 0.7, [3, 7], AMT[2]), dep('coal', 2, 0.9, [4, 10], AMT[2]), dep('silver_ore', 3, 0.6, [3, 6], AMT[2]),
    dep('gold_ore', 3, 0.45, [3, 5], AMT[2]), dep('amethyst', 3, 0.5, [3, 6], AMT[2]), dep('chromite', 3, 0.7, [3, 7], AMT[2]),
    dep('manganese_ore', 3, 0.8, [3, 7], AMT[2]), dep('natural_gas', 3, 0.5, [3, 6], [6000, 16000], true)] },
  { idx: 3, w: 112, h: 80, chunk: 16, rockBase: 4.0, rockPerChunk: 0.45, borerTier: 5, deposits: [
    dep('basalt', 4, 1.6, [5, 12], AMT[3]), dep('obsidian', 4, 1.2, [4, 9], AMT[3]), dep('rutile', 4, 1.0, [4, 8], AMT[3]),
    dep('wolframite', 4, 0.9, [3, 7], AMT[3]), dep('cobalt_ore', 4, 0.9, [3, 7], AMT[3]), dep('spodumene', 4, 0.8, [3, 7], AMT[3]),
    dep('molybdenite', 4, 0.7, [3, 6], AMT[3]), dep('vanadinite', 5, 0.6, [3, 6], AMT[3]), dep('platinum_ore', 5, 0.5, [3, 5], AMT[3]),
    dep('monazite', 5, 0.5, [3, 6], AMT[3]), dep('uraninite', 5, 0.55, [3, 6], AMT[3]), dep('thorite', 5, 0.45, [3, 5], AMT[3]),
    dep('diamond_raw', 5, 0.35, [2, 4], AMT[3]), dep('ruby_raw', 5, 0.3, [2, 4], AMT[3]), dep('sapphire_raw', 5, 0.3, [2, 4], AMT[3])] },
  { idx: 4, w: 96, h: 64, chunk: 16, rockBase: 7.0, rockPerChunk: 0.5, borerTier: 7, deposits: [
    dep('corestone', 6, 1.4, [4, 10], AMT[4]), dep('iridium_ore', 6, 0.9, [3, 7], AMT[4]), dep('osmium_ore', 6, 0.8, [3, 7], AMT[4]),
    dep('plasma_crystal', 6, 0.8, [3, 7], AMT[4]), dep('neutronium_ore', 7, 0.5, [3, 6], AMT[4]),
    dep('magma', 6, 0.7, [3, 7], null, true), dep('deuterium_brine', 6, 0.6, [3, 6], null, true), dep('helium3', 7, 0.5, [3, 6], null, true)] }
];
/* terrain flag bits */
const WALK = 1, BUILD = 2, SOLID = 4, WATER = 8, MAGMA = 16, ROCK = 32, FOREST = 64, VENT = 128;
const tdef = (id, name, flags, extra) => Object.assign({ id, name, walkable: !!(flags & WALK), buildable: !!(flags & BUILD), solid: !!(flags & SOLID), water: !!(flags & WATER), magma: !!(flags & MAGMA), rock: !!(flags & ROCK), color: '#555' }, extra || {});
const DEF_TERRAINS = {
  grass: tdef('grass', 'Pradera', WALK | BUILD, { layer: 0, color: '#6b7a4a', natural: { item: 'plant_fiber', rate: 1 } }),
  forest: tdef('forest', 'Bosque', WALK | BUILD | FOREST, { layer: 0, color: '#3f5a36', natural: { item: 'stick', rate: 1 } }),
  dirt: tdef('dirt', 'Tierra', WALK | BUILD, { layer: 0, color: '#8a7454' }),
  sand: tdef('sand', 'Arena', WALK | BUILD, { layer: 0, color: '#c8b98a', natural: { item: 'sand', rate: 1 } }),
  water: tdef('water', 'Agua', WATER, { layer: 0, color: '#3d5f73' }),
  rock: tdef('rock', 'Roca', WALK | BUILD | ROCK, { layer: 0, color: '#7d7b74', natural: { item: 'stone', rate: 1 } }),
  clay: tdef('clay', 'Arcilla', WALK | BUILD, { layer: 0, color: '#9a7b62', natural: { item: 'clay', rate: 1 } }),
  bog: tdef('bog', 'Turbera', WALK | BUILD, { layer: 0, color: '#4f5a3c', natural: { item: 'peat', rate: 1 } }),
  saltflat: tdef('saltflat', 'Salar', WALK | BUILD, { layer: 0, color: '#d9d6c8', natural: { item: 'salt', rate: 1 } }),
  gravel: tdef('gravel', 'Grava', WALK | BUILD, { layer: 0, color: '#8f8b82', natural: { item: 'gravel', rate: 1 } }),
  cave_floor: tdef('cave_floor', 'Suelo de cueva', WALK | BUILD, { layer: 1, color: '#4a4640' }),
  cave_wall: tdef('cave_wall', 'Roca de cueva', SOLID | ROCK, { layer: 1, color: '#2b2926' }),
  cave_water: tdef('cave_water', 'Agua subterránea', WATER, { layer: 1, color: '#2f4a55' }),
  rubble: tdef('rubble', 'Escombros', WALK | BUILD, { layer: 1, color: '#5d5750', natural: { item: 'stone', rate: 1 } }),
  coal_seam: tdef('coal_seam', 'Veta de carbón', WALK | BUILD, { layer: 1, color: '#2e2d2c' }),
  deep_floor: tdef('deep_floor', 'Suelo profundo', WALK | BUILD, { layer: 2, color: '#3c3b44' }),
  deep_wall: tdef('deep_wall', 'Roca profunda', SOLID | ROCK, { layer: 2, color: '#232229' }),
  crystal_floor: tdef('crystal_floor', 'Suelo cristalino', WALK | BUILD, { layer: 2, color: '#6d7fa3', light: 0.5 }),
  deep_water: tdef('deep_water', 'Agua profunda', WATER, { layer: 2, color: '#243a4a' }),
  abyss_floor: tdef('abyss_floor', 'Suelo abisal', WALK | BUILD, { layer: 3, color: '#3a2f2c' }),
  abyss_wall: tdef('abyss_wall', 'Roca abisal', SOLID | ROCK, { layer: 3, color: '#1f1a18' }),
  obsidian_floor: tdef('obsidian_floor', 'Suelo de obsidiana', WALK | BUILD, { layer: 3, color: '#1b1b21' }),
  magma: tdef('magma', 'Magma', MAGMA, { layer: 3, color: '#c9512a', light: 0.8 }),
  vent: tdef('vent', 'Fumarola', WALK | BUILD | VENT, { layer: 3, color: '#6b4a3a' }),
  core_floor: tdef('core_floor', 'Suelo del núcleo', WALK | BUILD, { layer: 4, color: '#2c2530' }),
  core_wall: tdef('core_wall', 'Roca del núcleo', SOLID | ROCK, { layer: 4, color: '#161219' }),
  magma_sea: tdef('magma_sea', 'Mar de magma', MAGMA, { layer: 4, color: '#d8642e', light: 1 }),
  plasma_floor: tdef('plasma_floor', 'Suelo de plasma', WALK | BUILD, { layer: 4, color: '#6e4aa8', light: 0.7 }),
  void_crack: tdef('void_crack', 'Grieta del vacío', WALK, { layer: 4, color: '#0a0710' })
};
const LAYER_TIDS = [
  ['grass', 'forest', 'dirt', 'sand', 'water', 'rock', 'clay', 'bog', 'saltflat', 'gravel'],
  ['cave_floor', 'cave_wall', 'cave_water', 'rubble', 'coal_seam'],
  ['deep_floor', 'deep_wall', 'crystal_floor', 'deep_water', 'rubble'],
  ['abyss_floor', 'abyss_wall', 'obsidian_floor', 'magma', 'vent'],
  ['core_floor', 'core_wall', 'magma_sea', 'plasma_floor', 'void_crack']
];
const FLOOR_ID = ['grass', 'cave_floor', 'deep_floor', 'abyss_floor', 'core_floor'];
const WALL_ID = [null, 'cave_wall', 'deep_wall', 'abyss_wall', 'core_wall'];
const SURFACE_ONLY = new Set(['windmill', 'solar_panel', 'hunting_lodge', 'planter', 'tree_farm', 'fiber_farm', 'greenhouse', 'algae_farm']);
const NEEDS_WATER = new Set(['water_wheel', 'pump_hand', 'pump_electric']);
const NEEDS_VENT = new Set(['geothermal_plant']);
const HUB_HALF = 6; // flat 12×12 grass around the surface centre

const registryTerrain = id => { const R = LD.Registry; return (R && R.terrains && R.terrains.get(id)) || null; };
function terrainFlags(def, id) {
  const base = DEF_TERRAINS[id];
  const pick = (k, fb) => def && def[k] !== undefined ? !!def[k] : base ? !!base[k] : fb;
  const solid = pick('solid', /_wall$/.test(id)), water = pick('water', /water$/.test(id));
  const magma = pick('magma', /magma/.test(id));
  const walk = pick('walkable', !(solid || water || magma)), build = pick('buildable', walk && !(water || magma));
  let f = (walk ? WALK : 0) | (build ? BUILD : 0) | (solid ? SOLID : 0) | (water ? WATER : 0) | (magma ? MAGMA : 0);
  if (pick('rock', false) && !solid) f |= ROCK;
  if (id === 'forest') f |= FOREST;
  if (id === 'vent') f |= VENT;
  return f;
}
function layerDef(L) {
  const R = LD.Registry, c = (R && R.layers && R.layers[L]) || null, d = DEF_LAYERS[L] || DEF_LAYERS[4];
  const num = (k, fb) => c && typeof c[k] === 'number' && isFinite(c[k]) ? c[k] : fb;
  const deposits = (c && Array.isArray(c.deposits) && c.deposits.length ? c.deposits : d.deposits).map(x => ({
    res: x.res, hardness: typeof x.hardness === 'number' ? x.hardness : 0, freq: typeof x.freq === 'number' ? x.freq : 1,
    size: Array.isArray(x.size) ? x.size : [4, 8], amount: Array.isArray(x.amount) ? x.amount : (x.infinite || x.amount === null ? null : AMT[L] || [1000, 3000]), fluid: !!x.fluid
  }));
  return { idx: L, w: num('w', d.w) | 0, h: num('h', d.h) | 0, chunk: num('chunk', d.chunk) | 0, rockBase: num('rockBase', d.rockBase), rockPerChunk: num('rockPerChunk', d.rockPerChunk), borerTier: num('borerTier', d.borerTier), deposits, id: c && c.id, name: c && c.name };
}
const chunkSeed = (seed, L, cx, cy) => U.hashStr(seed + ':' + L + ':' + cx + ':' + cy);
const stochRound = (rng, mean) => { if (mean <= 0) return 0; const k = Math.floor(mean); return k + (rng() < mean - k ? 1 : 0); };

const World = LD.World = { layers: [], occRef: [null], occIndex: new Map(), seed: 0, ready: false };

function allocLayer(L) {
  const d = layerDef(L), w = d.w, h = d.h, chunk = d.chunk, n = w * h;
  const cw = Math.ceil(w / chunk), ch = Math.ceil(h / chunk);
  const ccx = (cw - 1) >> 1, ccy = (ch - 1) >> 1;
  const maxD = Math.max(ccx, cw - 1 - ccx, ccy, ch - 1 - ccy);
  const prev = World.layers[L];
  const lay = prev && prev.w === w && prev.h === h && prev.chunk === chunk ? prev : {
    w, h, chunk, cw, ch, ccx, ccy, maxD, terrain: new Uint8Array(n), occ: new Int32Array(n), occCable: new Int32Array(n), occPipe: new Int32Array(n),
    exc: new Uint8Array(cw * ch), dirty: { paths: true }, tIds: [], tIndex: {}, tFlags: null, def: null
  };
  lay.def = d; lay.idx = L; lay.rockBase = d.rockBase; lay.rockPerChunk = d.rockPerChunk; lay.borerTier = d.borerTier;
  lay.tIds = LAYER_TIDS[L].slice(); lay.tIndex = {}; lay.tIds.forEach((id, i) => { lay.tIndex[id] = i; });
  lay.tFlags = new Uint8Array(64);
  lay.tIds.forEach((id, i) => { lay.tFlags[i] = terrainFlags(registryTerrain(id), id); });
  lay.occ.fill(-1); lay.occCable.fill(-1); lay.occPipe.fill(-1); lay.exc.fill(0); lay.dirty.paths = true;
  World.layers[L] = lay;
  return lay;
}
function tId(lay, id) {
  let i = lay.tIndex[id];
  if (i === undefined) { if (lay.tIds.length >= 64) return 0; i = lay.tIds.length; lay.tIds.push(id); lay.tIndex[id] = i; lay.tFlags[i] = terrainFlags(registryTerrain(id), id); }
  return i;
}

/* ── field / shape helpers ── */
function upsample(w, h, step, fn) {
  // sample fn on a coarse grid and interpolate bilinearly to full resolution
  const gw = Math.ceil(w / step) + 1, gh = Math.ceil(h / step) + 1, g = new Float32Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) g[gy * gw + gx] = fn(gx * step, gy * step);
  const out = new Float32Array(w * h), inv = 1 / step;
  for (let y = 0; y < h; y++) {
    const fy = y * inv, iy = Math.floor(fy), ty = fy - iy, r0 = iy * gw, r1 = Math.min(iy + 1, gh - 1) * gw;
    for (let x = 0; x < w; x++) {
      const fx = x * inv, ix = Math.floor(fx), tx = fx - ix, ix1 = Math.min(ix + 1, gw - 1);
      const top = g[r0 + ix] + (g[r0 + ix1] - g[r0 + ix]) * tx, bot = g[r1 + ix] + (g[r1 + ix1] - g[r1 + ix]) * tx;
      out[y * w + x] = top + (bot - top) * ty;
    }
  }
  return out;
}
function percentile(arr, mask, p) {
  const H = new Uint32Array(256); let total = 0;
  for (let i = 0; i < arr.length; i++) if (!mask || mask[i]) { let b = (arr[i] * 255) | 0; b = b < 0 ? 0 : b > 255 ? 255 : b; H[b]++; total++; }
  if (!total) return 0;
  let acc = 0; const target = p * total;
  for (let b = 0; b < 256; b++) { acc += H[b]; if (acc >= target) return (b + 1) / 255; }
  return 1;
}
const scratch = lay => lay.mark || (lay.mark = new Uint8Array(lay.w * lay.h));
function growBlob(lay, rng, sx, sy, size, allow, x0, y0, x1, y1) {
  // random frontier growth from (sx,sy): compact organic blobs; bounds are exclusive on x1/y1
  const w = lay.w, mark = scratch(lay), out = [], front = [], start = sy * w + sx;
  if (sx < x0 || sx >= x1 || sy < y0 || sy >= y1 || !allow(start)) return out;
  mark[start] = 1; front.push(start);
  const push = j => { if (!mark[j] && allow(j)) { mark[j] = 1; front.push(j); } };
  while (front.length && out.length < size) {
    const k = Math.floor(rng() * Math.min(front.length, 3));
    const i = front[k]; front[k] = front[front.length - 1]; front.pop();
    out.push(i);
    const x = i % w, y = (i - x) / w;
    if (x > x0) push(i - 1); if (x < x1 - 1) push(i + 1); if (y > y0) push(i - w); if (y < y1 - 1) push(i + w);
  }
  for (let k = 0; k < out.length; k++) mark[out[k]] = 0;
  for (let k = 0; k < front.length; k++) mark[front[k]] = 0;
  return out;
}
function stampDisc(lay, px, py, r, paint) {
  const w = lay.w, h = lay.h, r2 = r * r;
  for (let y = Math.max(0, Math.floor(py - r)); y <= Math.min(h - 1, Math.ceil(py + r)); y++) for (let x = Math.max(0, Math.floor(px - r)); x <= Math.min(w - 1, Math.ceil(px + r)); x++) {
    const dx = x + 0.5 - px, dy = y + 0.5 - py; if (dx * dx + dy * dy <= r2) paint(y * w + x, x, y);
  }
}
function carvePolyline(lay, pts, radiusFn, paint) {
  let total = 0; for (let k = 1; k < pts.length; k++) total += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
  let walked = 0;
  for (let k = 1; k < pts.length; k++) {
    const ax = pts[k - 1][0], ay = pts[k - 1][1], bx = pts[k][0], by = pts[k][1], len = Math.hypot(bx - ax, by - ay) || 1e-6, steps = Math.ceil(len * 2);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      stampDisc(lay, ax + (bx - ax) * t, ay + (by - ay) * t, radiusFn((walked + len * t) / total), paint);
    }
    walked += len;
  }
}
function distField(lay, isSrc, maxD) {
  // multi-source BFS (8-neighbour) distance to the nearest source tile, 255 = farther than maxD
  const w = lay.w, h = lay.h, n = w * h, d = new Uint8Array(n).fill(255), q = new Int32Array(n);
  let qh = 0, qt = 0;
  for (let i = 0; i < n; i++) if (isSrc(i)) { d[i] = 0; q[qt++] = i; }
  while (qh < qt) {
    const i = q[qh++], x = i % w, y = (i - x) / w, nd = d[i] + 1;
    if (nd > maxD) continue;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      if (!ox && !oy) continue;
      const nx = x + ox, ny = y + oy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx; if (d[j] > nd) { d[j] = nd; q[qt++] = j; }
    }
  }
  return d;
}
function connectLand(lay, bridgeId, waterId) {
  // every walkable landmass gets a causeway to the hub's landmass across the shortest run of water (path-finding needs one connected surface)
  const w = lay.w, h = lay.h, n = w * h, T = lay.terrain, F = lay.tFlags, comp = new Int32Array(n).fill(-1), q = new Int32Array(n), parent = new Int32Array(n);
  const walk = i => !!(F[T[i]] & WALK);
  const sizes = []; let nc = 0;
  for (let s = 0; s < n; s++) {
    if (comp[s] >= 0 || !walk(s)) continue;
    let qh = 0, qt = 0, size = 0; q[qt++] = s; comp[s] = nc;
    while (qh < qt) {
      const i = q[qh++], x = i % w; size++;
      if (x > 0 && comp[i - 1] < 0 && walk(i - 1)) { comp[i - 1] = nc; q[qt++] = i - 1; }
      if (x < w - 1 && comp[i + 1] < 0 && walk(i + 1)) { comp[i + 1] = nc; q[qt++] = i + 1; }
      if (i >= w && comp[i - w] < 0 && walk(i - w)) { comp[i - w] = nc; q[qt++] = i - w; }
      if (i < n - w && comp[i + w] < 0 && walk(i + w)) { comp[i + w] = nc; q[qt++] = i + w; }
    }
    sizes.push(size); nc++;
  }
  if (nc <= 1) return;
  const joined = new Uint8Array(nc); joined[comp[(h >> 1) * w + (w >> 1)]] = 1;
  const seen = new Int32Array(n).fill(-1);
  for (let c = 0; c < nc; c++) {
    if (joined[c]) continue;
    if (sizes[c] <= 2) { for (let i = 0; i < n; i++) if (comp[i] === c) T[i] = waterId; continue; }
    let qh = 0, qt = 0, hit = -1;
    for (let i = 0; i < n; i++) if (comp[i] === c) { seen[i] = c; parent[i] = -1; q[qt++] = i; }
    while (qh < qt && hit < 0) {
      const i = q[qh++], x = i % w;
      const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i >= w ? i - w : -1, i < n - w ? i + w : -1];
      for (let k = 0; k < 4; k++) {
        const j = nb[k]; if (j < 0 || seen[j] === c) continue;
        if (walk(j)) { if (joined[comp[j]]) { parent[j] = i; hit = j; break; } continue; }
        seen[j] = c; parent[j] = i; q[qt++] = j;
      }
    }
    if (hit < 0) continue;
    for (let i = parent[hit]; i >= 0 && !walk(i); i = parent[i]) { T[i] = bridgeId; comp[i] = c; }
    joined[c] = 1;
  }
}
const inHub = (lay, x, y) => { const dx = x - (lay.w >> 1), dy = y - (lay.h >> 1); return dx >= -HUB_HALF && dx < HUB_HALF && dy >= -HUB_HALF && dy < HUB_HALF; };

/* ── surface ── */
function genSurface(lay, seed) {
  const w = lay.w, h = lay.h, n = w * h, T = lay.terrain, X = lay.tIndex;
  const rng = U.rng((seed ^ 0x9E3779B9) >>> 0), s0 = (seed % 65521) | 0, cx0 = w >> 1, cy0 = h >> 1;
  const t0 = performance.now();
  // low-frequency fields are sampled coarsely and interpolated (fbm per tile is too slow for 256×192)
  const elev = upsample(w, h, 4, (x, y) => U.fbm(x / 72 + 0.7, y / 72 + 0.3, s0 + 11, 4));
  const moist = upsample(w, h, 4, (x, y) => U.fbm(x / 38 + 7.3, y / 38 + 2.1, s0 + 23, 4));
  const wood = upsample(w, h, 2, (x, y) => U.fbm(x / 17 + 3.7, y / 17 + 9.2, s0 + 37, 3));
  const ridge = upsample(w, h, 2, (x, y) => U.ridge(x / 27 + 1.3, y / 27 + 5.5, s0 + 41, 3));
  const detail = upsample(w, h, 2, (x, y) => U.noise2(x / 6.5 + 0.2, y / 6.5 + 0.9, s0 + 53));
  const water = X.water, grass = X.grass, forest = X.forest, dirt = X.dirt, sand = X.sand, rock = X.rock, clay = X.clay, bog = X.bog, saltflat = X.saltflat, gravel = X.gravel;
  T.fill(grass);
  const lake = new Uint8Array(n);
  const farFromCentre = (x, y, r) => Math.abs(x - cx0) >= r || Math.abs(y - cy0) >= r;
  // lowland pools from the continent field, with the centre lifted so the hub sits on dry land
  const elevW = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = i % w, y = (i - x) / w, dc = Math.max(Math.abs(x - cx0), Math.abs(y - cy0)); const lift = dc < 40 ? (1 - dc / 40) : 0; elevW[i] = elev[i] + lift * lift * 0.6; }
  const lowT = percentile(elevW, null, 0.045);
  for (let i = 0; i < n; i++) if (elevW[i] < lowT) { T[i] = water; lake[i] = 1; }
  // explicit lakes
  const nLakes = rng.int(4, 7);
  for (let k = 0; k < nLakes; k++) {
    let lx = 0, ly = 0;
    for (let tries = 0; tries < 24; tries++) { lx = rng.int(14, w - 15); ly = rng.int(12, h - 13); if (farFromCentre(lx, ly, 40)) break; }
    if (!farFromCentre(lx, ly, 40)) continue;
    const rx = rng.range(4, 11), ry = rng.range(3, 8), ns = rng.int(1, 1e6);
    for (let y = Math.max(0, Math.floor(ly - ry - 3)); y <= Math.min(h - 1, Math.ceil(ly + ry + 3)); y++) for (let x = Math.max(0, Math.floor(lx - rx - 3)); x <= Math.min(w - 1, Math.ceil(lx + rx + 3)); x++) {
      const dx = (x - lx) / rx, dy = (y - ly) / ry, wob = 0.55 + 0.9 * U.noise2(x / 5, y / 5, ns);
      if ((dx * dx + dy * dy) * wob < 0.75) { const i = y * w + x; T[i] = water; lake[i] = 1; }
    }
  }
  // winding river across the whole map (kept clear of the hub) plus a tributary
  const paintRiver = i => { T[i] = water; lake[i] = 0; };
  const vertical = rng.chance(0.5), span = vertical ? w : h, side = rng.chance(0.5) ? 0.22 : 0.78;
  const amp = span * 0.08, ph = rng.range(0, 6.2832), kf = rng.range(1.2, 2.4), rs = rng.int(1, 1e6), N = 40, pts = [];
  for (let k = 0; k <= N; k++) {
    const t = k / N;
    let off = side * span + amp * Math.sin(ph + t * kf * 6.2832) + (U.fbm(t * 5 + 0.3, 0.37, rs, 3) - 0.5) * span * 0.16;
    const mid = span / 2; if (Math.abs(off - mid) < 26) off = mid + (off >= mid ? 26 : -26);
    pts.push(vertical ? [off, t * (h - 1)] : [t * (w - 1), off]);
  }
  carvePolyline(lay, pts, t => 1.2 + U.noise2(t * 9 + 0.5, 0.5, rs + 1) * 1.5, paintRiver);
  // fords: gravel crossings so both banks stay connected for path-finding
  const fords = [];
  for (let k = 0; k < 3; k++) { const p = pts[Math.round((k + rng.range(0.25, 0.75)) / 3 * N)]; fords.push([p[0], p[1], 3.4]); }
  if (rng.chance(0.8)) {
    const j = rng.int(Math.floor(N * 0.25), Math.floor(N * 0.75)), end = pts[j];
    const start = vertical ? [side < 0.5 ? 0 : w - 1, rng.int(6, h - 7)] : [rng.int(6, w - 7), side < 0.5 ? 0 : h - 1];
    const tp = [start];
    for (let k = 1; k < 5; k++) { const t = k / 5; tp.push([start[0] + (end[0] - start[0]) * t + rng.range(-9, 9), start[1] + (end[1] - start[1]) * t + rng.range(-9, 9)]); }
    tp.push(end);
    carvePolyline(lay, tp, t => 0.7 + t * 0.7, paintRiver);
    fords.push([tp[2][0], tp[2][1], 2.4]);
  }
  for (const [px, py, r] of fords) stampDisc(lay, px, py, r, i => { if (T[i] === water && !lake[i]) T[i] = gravel; });
  connectLand(lay, gravel, water);
  // distances to water (all) and to lake water (for beaches)
  const dAll = distField(lay, i => T[i] === water, 6), dLake = distField(lay, i => lake[i] === 1, 4);
  const land = new Uint8Array(n); for (let i = 0; i < n; i++) land[i] = T[i] !== water ? 1 : 0;
  const rockT = percentile(ridge, land, 0.945), bogE = percentile(elev, land, 0.28), saltM = percentile(moist, land, 0.14);
  const eLo = percentile(elev, land, 0.30), eHi = percentile(elev, land, 0.62), dirtM = percentile(moist, land, 0.32);
  for (let i = 0; i < n; i++) {
    if (!land[i]) continue;
    const x = i % w, y = (i - x) / w;
    if (inHub(lay, x, y)) continue;
    const dl = dLake[i], dw = dAll[i], dt = detail[i], m = moist[i] + (dw < 4 ? (4 - dw) * 0.06 : 0), e = elev[i];
    if (dl === 1 || (dl === 2 && dt > 0.3) || (dl === 3 && dt > 0.66)) T[i] = sand;
    else if (ridge[i] > rockT && e > 0.47 && farFromCentre(x, y, 12)) T[i] = rock;
    else if (e < bogE && m > 0.6 && dt > 0.35) T[i] = bog;
    else if (m < saltM && e > eLo && e < eHi && dt > 0.5) T[i] = saltflat;
    else if (dw >= 1 && dw <= 3 && m > 0.5 && dt > 0.58) T[i] = clay;
  }
  // gravel scree beside outcrops
  for (let i = 0; i < n; i++) {
    if (T[i] !== grass) continue;
    const x = i % w, y = (i - x) / w; if (inHub(lay, x, y) || U.hash2(x, y, s0 + 61) < 0.45) continue;
    let near = false;
    for (let oy = -1; oy <= 1 && !near; oy++) for (let ox = -1; ox <= 1; ox++) { const nx = x + ox, ny = y + oy; if (nx >= 0 && ny >= 0 && nx < w && ny < h && T[ny * w + nx] === rock) { near = true; break; } }
    if (near) T[i] = gravel;
  }
  // forests: clustered, ~22 % of all tiles, chosen by percentile over the remaining grass
  const fscore = new Float32Array(n), fmask = new Uint8Array(n); let free = 0;
  for (let i = 0; i < n; i++) { if (T[i] !== grass) continue; const x = i % w, y = (i - x) / w; if (Math.abs(x - cx0) <= HUB_HALF + 2 && Math.abs(y - cy0) <= HUB_HALF + 2) continue; fscore[i] = wood[i] * 0.72 + moist[i] * 0.28; fmask[i] = 1; free++; }
  const forestT = percentile(fscore, fmask, Math.max(0, 1 - (0.22 * n) / Math.max(1, free)));
  for (let i = 0; i < n; i++) if (fmask[i] && fscore[i] >= forestT) T[i] = forest;
  // dry dirt patches
  for (let i = 0; i < n; i++) if (fmask[i] && T[i] === grass && moist[i] < dirtM && detail[i] < 0.42) T[i] = dirt;
  // dirt trails from the hub towards the borders
  const trailOk = new Set([grass, forest, gravel, dirt, bog]);
  const nTrails = rng.int(3, 5);
  for (let k = 0; k < nTrails; k++) {
    const ang = (k + rng.range(0.1, 0.9)) / nTrails * 6.2832, sx = cx0 + Math.round(Math.cos(ang) * (HUB_HALF + 1)), sy = cy0 + Math.round(Math.sin(ang) * (HUB_HALF + 1));
    const R = Math.max(w, h), ex = U.clamp(cx0 + Math.cos(ang) * R, 0, w - 1), ey = U.clamp(cy0 + Math.sin(ang) * R, 0, h - 1);
    const tp = [[sx, sy]], segs = 7;
    for (let s = 1; s < segs; s++) { const t = s / segs; tp.push([sx + (ex - sx) * t + rng.range(-10, 10), sy + (ey - sy) * t + rng.range(-10, 10)]); }
    tp.push([ex, ey]);
    carvePolyline(lay, tp, () => 0.62, (i, x, y) => { if (trailOk.has(T[i]) && !inHub(lay, x, y)) T[i] = dirt; });
  }
  for (let y = cy0 - HUB_HALF; y < cy0 + HUB_HALF; y++) for (let x = cx0 - HUB_HALF; x < cx0 + HUB_HALF; x++) T[y * w + x] = grass;
  lay.genMs = performance.now() - t0;
}

/* ── deposits ── */
function outerRing(lay, cx, cy) {
  if (lay.idx === 0) return cx === 0 || cy === 0 || cx === lay.cw - 1 || cy === lay.ch - 1;
  return Math.max(Math.abs(cx - lay.ccx), Math.abs(cy - lay.ccy)) >= lay.maxD - 1;
}
function depositAllow(lay, gl, mark) {
  const T = lay.terrain, F = lay.tFlags, w = lay.w;
  return i => { const f = F[T[i]]; if (!(f & BUILD) || (f & (WATER | MAGMA | SOLID))) return false; if (mark && mark[i]) return false; if (lay.idx === 0) { const x = i % w; if (inHub(lay, x, (i - x) / w)) return false; } return !gl.deposits[U.key(i % w, (i - i % w) / w)]; };
}
function placeVein(lay, gl, rng, d, sx, sy, sizeMul, mark, bounds) {
  const size = Math.max(1, Math.round(rng.int(d.size[0], d.size[1]) * (sizeMul || 1)));
  const b = bounds || { x0: 0, y0: 0, x1: lay.w, y1: lay.h };
  const tiles = growBlob(lay, rng, sx, sy, size, depositAllow(lay, gl, mark), b.x0, b.y0, b.x1, b.y1);
  if (!tiles.length) return 0;
  const chunk = lay.chunk, infinite = !d.amount || outerRing(lay, Math.floor(sx / chunk), Math.floor(sy / chunk));
  const seam = lay.idx === 1 && d.res === 'coal' ? tId(lay, 'coal_seam') : -1;
  for (const i of tiles) {
    const x = i % lay.w, y = (i - x) / lay.w, amt = infinite ? -1 : rng.int(d.amount[0], d.amount[1]);
    gl.deposits[U.key(x, y)] = { res: d.res, amt, max: amt, hardness: d.hardness, fluid: d.fluid };
    if (mark) mark[i] = 1;
    if (seam >= 0) lay.terrain[i] = seam;
  }
  return tiles.length;
}
function rollSurfaceDeposits(lay, G, seed) {
  const gl = G.layers[0]; if (!gl) return;
  G.flags = G.flags || {};
  if (G.flags.worldDepositsL0) return;
  G.flags.worldDepositsL0 = true;
  if (Object.keys(gl.deposits || {}).length) return;
  gl.deposits = gl.deposits || {};
  const rng = U.rng((seed ^ 0x51ed27) >>> 0), w = lay.w, h = lay.h, n = w * h, cx0 = w >> 1, cy0 = h >> 1;
  const mark = new Uint8Array(n), allow = depositAllow(lay, gl, mark);
  for (const d of lay.def.deposits) {
    const count = stochRound(rng, d.freq * n / 1000);
    for (let k = 0; k < count; k++) for (let t = 0; t < 30; t++) { const x = rng.int(1, w - 2), y = rng.int(1, h - 2); if (allow(y * w + x)) { placeVein(lay, gl, rng, d, x, y, 1, mark); break; } }
    // starter guarantee: one vein of every surface resource within reach of the hub
    for (let t = 0; t < 60; t++) {
      const a = rng.range(0, 6.2832), r = rng.range(16, 30), x = Math.round(cx0 + Math.cos(a) * r), y = Math.round(cy0 + Math.sin(a) * r);
      if (x > 0 && y > 0 && x < w - 1 && y < h - 1 && allow(y * w + x) && placeVein(lay, gl, rng, d, x, y, 1, mark)) break;
    }
  }
}
function rollChunkDeposits(lay, gl, cx, cy, rng) {
  const chunk = lay.chunk, x0 = cx * chunk, y0 = cy * chunk, x1 = Math.min(lay.w, x0 + chunk), y1 = Math.min(lay.h, y0 + chunk);
  const tiles = (x1 - x0) * (y1 - y0), d = Math.max(Math.abs(cx - lay.ccx), Math.abs(cy - lay.ccy)), far = lay.maxD ? d / lay.maxD : 0;
  const defs = lay.def.deposits; if (!defs.length) return;
  let minH = Infinity; for (const df of defs) if (df.hardness < minH) minH = df.hardness;
  const staple = defs.filter(df => df.hardness === minH && !df.fluid).sort((a, b) => b.freq - a.freq).slice(0, 3);
  const allow = depositAllow(lay, gl, null), bounds = { x0, y0, x1, y1 };
  for (const df of defs) {
    const rare = df.hardness > minH;
    const weight = rare ? 0.35 + 1.65 * far : 1 + 0.35 * far;
    let mean = df.freq * tiles / 1000 * weight;
    if (d <= 1 && staple.includes(df)) mean = Math.max(mean, 0.6);   // the start set always yields the layer's staples
    const count = stochRound(rng, mean);
    for (let k = 0; k < count; k++) for (let t = 0; t < 20; t++) {
      const x = rng.int(x0, x1 - 1), y = rng.int(y0, y1 - 1);
      if (allow(y * lay.w + x)) { placeVein(lay, gl, rng, df, x, y, 1 + 0.6 * far, null, bounds); break; }
    }
  }
}

/* ── lower-layer chunk interiors (deterministic per chunk) ── */
function genChunkTerrain(lay, cx, cy, seed) {
  const L = lay.idx, w = lay.w, chunk = lay.chunk, T = lay.terrain, rng = U.rng(chunkSeed(seed, L, cx, cy) ^ 0x2545F491);
  const x0 = cx * chunk, y0 = cy * chunk, x1 = Math.min(w, x0 + chunk), y1 = Math.min(lay.h, y0 + chunk), cw = x1 - x0, chh = y1 - y0;
  const d = Math.max(Math.abs(cx - lay.ccx), Math.abs(cy - lay.ccy)), far = lay.maxD ? d / lay.maxD : 0, centre = d === 0;
  const floor = tId(lay, FLOOR_ID[L]), wall = tId(lay, WALL_ID[L]), rubble = tId(lay, 'rubble');
  for (let y = y0; y < y1; y++) T.subarray(y * w + x0, y * w + x1).fill(floor);
  const mx = x0 + (cw >> 1), my = y0 + (chh >> 1);
  const keep = i => { const x = i % w, y = (i - x) / w; return centre ? (Math.abs(x - mx + 0.5) <= 2.5 && Math.abs(y - my + 0.5) <= 2.5) : (Math.abs(x - mx + 0.5) <= 1.5 && Math.abs(y - my + 0.5) <= 1.5); };
  const isFloor = i => T[i] === floor && !keep(i);
  const patch = (id, count, lo, hi) => { for (let k = 0; k < count; k++) { const x = rng.int(x0, x1 - 1), y = rng.int(y0, y1 - 1); for (const i of growBlob(lay, rng, x, y, rng.int(lo, hi), isFloor, x0, y0, x1, y1)) T[i] = id; } };
  // pillars ≈ 6 % of the chunk, as small clusters
  patch(wall, Math.round(cw * chh * 0.06 / 2.2), 1, 3);
  patch(rubble, rng.int(1, 3), 2, 5);
  if (L === 1 || L === 2) patch(tId(lay, L === 1 ? 'cave_water' : 'deep_water'), rng.int(0, 2), 3, 8);
  if (L === 2) patch(tId(lay, 'crystal_floor'), rng.int(1, 2) + (far > 0.6 ? 1 : 0), 3, 7);
  if (L === 3) {
    patch(tId(lay, 'obsidian_floor'), rng.int(2, 3), 3, 8);
    patch(tId(lay, 'magma'), rng.int(1, 2) + (far > 0.6 ? 1 : 0), 3, 7);
    const vents = d >= lay.maxD - 1 ? rng.int(2, 4) : d >= 2 ? (rng.chance(0.5) ? 1 : 0) : 0;
    patch(tId(lay, 'vent'), vents, 1, 1);
  }
  if (L === 4) {
    patch(tId(lay, 'plasma_floor'), rng.int(1, 3), 3, 8);
    patch(tId(lay, 'magma_sea'), rng.int(1, 3) + (far > 0.6 ? 1 : 0), 4, 10);
    patch(tId(lay, 'void_crack'), rng.int(1, 3), 1, 1);
  }
  // guarantee passage: the chunk centre reaches the middle of each of its four edges
  const F = lay.tFlags, walk = i => !!(F[T[i]] & WALK);
  const mark = scratch(lay), q = [];
  const seen = [];
  const push = i => { if (!mark[i] && walk(i)) { mark[i] = 1; q.push(i); seen.push(i); } };
  push(my * w + mx);
  for (let qi = 0; qi < q.length; qi++) { const i = q[qi], x = i % w, y = (i - x) / w; if (x > x0) push(i - 1); if (x < x1 - 1) push(i + 1); if (y > y0) push(i - w); if (y < y1 - 1) push(i + w); }
  const carve = (ax, ay, bx, by) => { let x = ax, y = ay; while (x !== bx || y !== by) { if (x !== bx) x += x < bx ? 1 : -1; else y += y < by ? 1 : -1; const i = y * w + x; if (!walk(i)) T[i] = floor; } };
  for (const [ex, ey] of [[mx, y0], [mx, y1 - 1], [x0, my], [x1 - 1, my]]) { const i = ey * w + ex; if (!walk(i) || !mark[i]) { if (!walk(i)) T[i] = floor; carve(mx, my, ex, ey); } }
  // walkable pockets sealed off by pillars or pools become wall so no tile is unreachable
  for (let k = 0; k < seen.length; k++) mark[seen[k]] = 0;
  q.length = 0; seen.length = 0; push(my * w + mx);
  for (let qi = 0; qi < q.length; qi++) { const i = q[qi], x = i % w, y = (i - x) / w; if (x > x0) push(i - 1); if (x < x1 - 1) push(i + 1); if (y > y0) push(i - w); if (y < y1 - 1) push(i + w); }
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = y * w + x; if (walk(i) && !mark[i]) T[i] = wall; }
  for (let k = 0; k < seen.length; k++) mark[seen[k]] = 0;
  return rng;
}
function markExcavated(lay, cx, cy, v) { lay.exc[cy * lay.cw + cx] = v ? 1 : 0; }
function restoreChunk(lay, gl, cx, cy) {
  // rebuild an already-excavated chunk from the seed (saves hold only the excavated set and the deposits)
  genChunkTerrain(lay, cx, cy, World.seed);
  markExcavated(lay, cx, cy, 1);
  if (lay.idx === 1 && gl && gl.deposits) {
    const c = lay.chunk, seam = tId(lay, 'coal_seam');
    for (let y = cy * c; y < Math.min(lay.h, cy * c + c); y++) for (let x = cx * c; x < Math.min(lay.w, cx * c + c); x++) { const dp = gl.deposits[U.key(x, y)]; if (dp && dp.res === 'coal') lay.terrain[y * lay.w + x] = seam; }
  }
  lay.dirty.paths = true;
}

function invalidateChunk(L, lay, cx, cy) {
  const Tex = LD.Tex; if (!Tex || typeof Tex.invalidate !== 'function') return;
  try { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = cx + dx, ny = cy + dy; if (nx >= 0 && ny >= 0 && nx < lay.cw && ny < lay.ch) Tex.invalidate(L, nx * lay.chunk, ny * lay.chunk); } } catch (e) { /* renderer not ready */ }
}

World.gen = function (G) {
  G = G || LD.G; if (!G) return World;
  const seed = (G.meta && G.meta.seed) >>> 0;
  World.seed = seed; World.occRef = [null]; World.occIndex = new Map();
  const nLayers = Math.max(5, (LD.Registry && LD.Registry.layers && LD.Registry.layers.length) || 0);
  for (let L = 0; L < nLayers; L++) {
    const lay = allocLayer(L), gl = G.layers && G.layers[L];
    if (L === 0) { genSurface(lay, seed); if (gl) rollSurfaceDeposits(lay, G, seed); continue; }
    lay.terrain.fill(tId(lay, WALL_ID[L]));
    if (!gl) continue;
    gl.excavated = gl.excavated || {}; gl.deposits = gl.deposits || {}; gl.digging = gl.digging || {};
    for (const key in gl.excavated) { if (!gl.excavated[key]) continue; const [cx, cy] = U.unkey(key); if (cx >= 0 && cy >= 0 && cx < lay.cw && cy < lay.ch) restoreChunk(lay, gl, cx, cy); }
    if (gl.unlocked && !Object.keys(gl.excavated).length) World.excavateStart(L, true);
  }
  World.ready = true;
  return World;
};
World.startChunks = function (L) { const lay = World.layers[L]; if (!lay || L === 0) return []; const c = [[lay.ccx, lay.ccy]]; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const cx = lay.ccx + dx, cy = lay.ccy + dy; if (cx >= 0 && cy >= 0 && cx < lay.cw && cy < lay.ch) c.push([cx, cy]); } return c; };
World.excavateStart = function (L, quiet) { let n = 0; for (const [cx, cy] of World.startChunks(L)) if (World.excavate(L, cx, cy, quiet)) n++; return n; };
World.excavate = function (L, cx, cy, quiet) {
  const lay = World.layers[L], G = LD.G; if (!lay || L === 0 || !G || !G.layers[L]) return false;
  if (cx < 0 || cy < 0 || cx >= lay.cw || cy >= lay.ch) return false;
  const gl = G.layers[L], key = U.key(cx, cy);
  if (lay.exc[cy * lay.cw + cx] || gl.excavated[key]) { if (!lay.exc[cy * lay.cw + cx]) restoreChunk(lay, gl, cx, cy); return false; }
  const rng = genChunkTerrain(lay, cx, cy, World.seed);
  gl.deposits = gl.deposits || {};
  rollChunkDeposits(lay, gl, cx, cy, rng);
  gl.excavated[key] = true;
  if (gl.digging) delete gl.digging[key];
  markExcavated(lay, cx, cy, 1);
  lay.dirty.paths = true;
  invalidateChunk(L, lay, cx, cy);
  if (!quiet) LD.Events.emit('chunk:excavated', { layer: L, cx, cy });
  return true;
};
World.excavateAll = function (L) { const lay = World.layers[L]; if (!lay || L === 0) return 0; let n = 0; for (let cy = 0; cy < lay.ch; cy++) for (let cx = 0; cx < lay.cw; cx++) if (World.excavate(L, cx, cy, true)) n++; if (n) LD.Events.emit('chunk:excavated', { layer: L, cx: lay.ccx, cy: lay.ccy, all: true }); return n; };

/* ── tile queries ── */
const inb = (lay, x, y) => x >= 0 && y >= 0 && x < lay.w && y < lay.h;
const gLayer = L => { const G = LD.G; return G && G.layers ? G.layers[L] || null : null; };
World.layerDef = L => { const lay = World.layers[L]; return lay ? lay.def : layerDef(L); };
World.terrainAt = function (L, x, y) { const lay = World.layers[L]; if (!lay || !inb(lay, x, y)) return null; return lay.tIds[lay.terrain[y * lay.w + x]] || null; };
World.terrainDef = function (L, x, y) {
  const id = World.terrainAt(L, x, y); if (!id) return null;
  const r = registryTerrain(id); if (r) return r;
  return DEF_TERRAINS[id] || tdef(id, id, WALK | BUILD);
};
World.terrainInfo = id => registryTerrain(id) || DEF_TERRAINS[id] || null;
World.flagsAt = function (L, x, y) { const lay = World.layers[L]; if (!lay || !inb(lay, x, y)) return 0; return lay.tFlags[lay.terrain[y * lay.w + x]]; };
World.depositAt = function (L, x, y) { const gl = gLayer(L); if (!gl || !gl.deposits) return null; return gl.deposits[U.key(x, y)] || null; };
World.removeDeposit = function (L, x, y) {
  const gl = gLayer(L); if (!gl || !gl.deposits) return false; const k = U.key(x, y); if (!gl.deposits[k]) return false;
  delete gl.deposits[k];
  if (World.terrainAt(L, x, y) === 'coal_seam') { const lay = World.layers[L]; lay.terrain[y * lay.w + x] = tId(lay, 'cave_floor'); }
  const Tex = LD.Tex; if (Tex && typeof Tex.invalidate === 'function') { try { Tex.invalidate(L, x, y); } catch (e) { /* ignore */ } } return true; };
World.treeAt = function (L, x, y) {
  if (L !== 0) return null;
  const lay = World.layers[0]; if (!lay || !inb(lay, x, y) || !(lay.tFlags[lay.terrain[y * lay.w + x]] & FOREST)) return null;
  const gl = gLayer(0), v = gl && gl.trees ? gl.trees[U.key(x, y)] : undefined;
  return v === undefined ? 1 : v;
};
World.setTree = function (L, x, y, growth) {
  if (L !== 0 || World.treeAt(0, x, y) === null) return false;
  const gl = gLayer(0); if (!gl) return false; gl.trees = gl.trees || {};
  const k = U.key(x, y); if (growth >= 1) delete gl.trees[k]; else gl.trees[k] = Math.max(0, growth);
  const Tex = LD.Tex; if (Tex && typeof Tex.invalidate === 'function') { try { Tex.invalidate(0, x, y); } catch (e) { /* ignore */ } }
  return true;
};
World.chunkOf = function (L, x, y) { const lay = World.layers[L], c = lay ? lay.chunk : 16; return { cx: Math.floor(x / c), cy: Math.floor(y / c) }; };
World.chunkKey = (cx, cy) => cx + ',' + cy;
World.chunkBounds = function (L, cx, cy) { const lay = World.layers[L]; if (!lay) return null; const c = lay.chunk; return { x0: cx * c, y0: cy * c, x1: Math.min(lay.w, cx * c + c) - 1, y1: Math.min(lay.h, cy * c + c) - 1 }; };
World.isExcavated = function (L, cx, cy) {
  if (L === 0) return true;
  const lay = World.layers[L]; if (!lay || cx < 0 || cy < 0 || cx >= lay.cw || cy >= lay.ch) return false;
  if (lay.exc[cy * lay.cw + cx]) return true;
  const gl = gLayer(L);
  if (gl && gl.excavated && gl.excavated[U.key(cx, cy)]) { restoreChunk(lay, gl, cx, cy); return true; }
  return false;
};
World.isExcavatedTile = function (L, x, y) { if (L === 0) return true; const lay = World.layers[L]; if (!lay || !inb(lay, x, y)) return false; return World.isExcavated(L, Math.floor(x / lay.chunk), Math.floor(y / lay.chunk)); };
World.chunkDistance = function (L, cx, cy) { const lay = World.layers[L]; if (!lay) return 0; return Math.max(Math.abs(cx - lay.ccx), Math.abs(cy - lay.ccy)); };
World.rockHardness = function (L, cx, cy) { const lay = World.layers[L]; if (!lay || L === 0) return 0; return lay.rockBase * (1 + lay.rockPerChunk * World.chunkDistance(L, cx, cy)); };
World.excavationWork = (L, cx, cy) => World.rockHardness(L, cx, cy) * 256;
World.canDig = function (L, cx, cy) {
  const lay = World.layers[L];
  if (!lay) return { ok: false, reason: 'Estrato inexistente' };
  if (L === 0) return { ok: false, reason: 'La superficie no se excava' };
  if (cx < 0 || cy < 0 || cx >= lay.cw || cy >= lay.ch) return { ok: false, reason: 'Fuera del mapa' };
  if (World.isExcavated(L, cx, cy)) return { ok: false, reason: 'Bloque ya excavado' };
  const adj = World.isExcavated(L, cx - 1, cy) || World.isExcavated(L, cx + 1, cy) || World.isExcavated(L, cx, cy - 1) || World.isExcavated(L, cx, cy + 1);
  if (!adj) return { ok: false, reason: 'Debe ser contiguo a un bloque excavado' };
  const hardness = World.rockHardness(L, cx, cy);
  return { ok: true, reason: '', hardness, work: hardness * 256, tier: lay.borerTier };
};
World.isSolid = function (L, x, y) { const lay = World.layers[L]; if (!lay || !inb(lay, x, y)) return true; return !!(lay.tFlags[lay.terrain[y * lay.w + x]] & SOLID); };
World.isWalkable = function (L, x, y) { const lay = World.layers[L]; if (!lay || !inb(lay, x, y)) return false; const i = y * lay.w + x; return !!(lay.tFlags[lay.terrain[i]] & WALK) && lay.occ[i] < 0; };
World.isWater = function (L, x, y) { return !!(World.flagsAt(L, x, y) & WATER); };
World.isBuildable = function (L, x, y) {
  const lay = World.layers[L]; if (!lay || !inb(lay, x, y)) return false;
  const i = y * lay.w + x;
  if (!(lay.tFlags[lay.terrain[i]] & BUILD) || lay.occ[i] >= 0) return false;
  return L === 0 || World.isExcavated(L, Math.floor(x / lay.chunk), Math.floor(y / lay.chunk));
};
World.setTerrain = function (L, x, y, id) {
  const lay = World.layers[L]; if (!lay || !inb(lay, x, y) || !id) return false;
  lay.terrain[y * lay.w + x] = tId(lay, id);
  lay.dirty.paths = true;
  const Tex = LD.Tex; if (Tex && typeof Tex.invalidate === 'function') { try { Tex.invalidate(L, x, y); } catch (e) { /* ignore */ } }
  return true;
};
World.centre = function (L) {
  const lay = World.layers[L]; if (!lay) { const d = layerDef(L); return L === 0 ? { x: d.w >> 1, y: d.h >> 1 } : { x: (((Math.ceil(d.w / d.chunk) - 1) >> 1) * d.chunk) + (d.chunk >> 1), y: (((Math.ceil(d.h / d.chunk) - 1) >> 1) * d.chunk) + (d.chunk >> 1) }; }
  if (L === 0) return { x: lay.w >> 1, y: lay.h >> 1 };
  return { x: lay.ccx * lay.chunk + (lay.chunk >> 1), y: lay.ccy * lay.chunk + (lay.chunk >> 1) };
};
World.hubArea = function () { const lay = World.layers[0], w = lay ? lay.w : 256, h = lay ? lay.h : 192; return { x0: (w >> 1) - HUB_HALF, y0: (h >> 1) - HUB_HALF, x1: (w >> 1) + HUB_HALF - 1, y1: (h >> 1) + HUB_HALF - 1 }; };

/* ── occupancy ── */
function occIdx(uid) {
  if (uid === null || uid === undefined) return -1;
  let i = World.occIndex.get(uid);
  if (i === undefined) { i = World.occRef.length; World.occRef.push(uid); World.occIndex.set(uid, i); }
  return i;
}
World.setOcc = function (L, x, y, w, h, uid) {
  const lay = World.layers[L]; if (!lay) return false;
  const v = occIdx(uid), W = lay.w, gl = uid && L === 0 ? gLayer(0) : null;
  for (let yy = y; yy < y + h; yy++) { if (yy < 0 || yy >= lay.h) continue; for (let xx = x; xx < x + w; xx++) { if (xx < 0 || xx >= W) continue; const i = yy * W + xx; lay.occ[i] = v; if (gl && (lay.tFlags[lay.terrain[i]] & FOREST)) { gl.trees = gl.trees || {}; if (gl.trees[U.key(xx, yy)] !== 0) gl.trees[U.key(xx, yy)] = 0; } } }
  lay.dirty.paths = true;
  return true;
};
World.setOverlay = function (kind, L, x, y, uid) {
  const lay = World.layers[L]; if (!lay || !inb(lay, x, y)) return false;
  const grid = kind === 'pipe' ? lay.occPipe : lay.occCable;
  grid[y * lay.w + x] = occIdx(uid);
  return true;
};
const refAt = (grid, lay, x, y) => { if (!lay || !inb(lay, x, y)) return null; const v = grid[y * lay.w + x]; return v > 0 ? World.occRef[v] || null : null; };
World.uidAt = (L, x, y) => refAt(World.layers[L] && World.layers[L].occ, World.layers[L], x, y);
World.cableAt = (L, x, y) => refAt(World.layers[L] && World.layers[L].occCable, World.layers[L], x, y);
World.pipeAt = (L, x, y) => refAt(World.layers[L] && World.layers[L].occPipe, World.layers[L], x, y);
World.clearOcc = function (L) { const lay = World.layers[L]; if (!lay) return; lay.occ.fill(-1); lay.occCable.fill(-1); lay.occPipe.fill(-1); lay.dirty.paths = true; };

/* ── placement rules ── */
const structDef = id => { const R = LD.Registry; return R && R.structures ? R.structures.get(id) || null : null; };
const structOf = uid => { const G = LD.G; const inst = G && G.structures ? G.structures[uid] : null; return inst ? structDef(inst.id) : null; };
const itemName = id => { const R = LD.Registry; const it = R && R.items ? R.items.get(id) : null; return it ? it.name : id; };
const listNames = ids => ids.map(itemName).slice(0, 4).join(', ') + (ids.length > 4 ? '…' : '');
const asList = v => v === undefined || v === null ? null : Array.isArray(v) ? v : [v];
const NO = reason => ({ ok: false, reason });
World.canPlace = function (structId, L, x, y, rot) {
  const def = typeof structId === 'string' ? structDef(structId) : structId;
  if (!def) return NO('Estructura desconocida');
  const lay = World.layers[L]; if (!lay) return NO('Estrato inexistente');
  const size = Math.max(1, def.size | 0 || 1), W = lay.w, F = lay.tFlags, T = lay.terrain;
  x |= 0; y |= 0;
  if (x < 0 || y < 0 || x + size > W || y + size > lay.h) return NO('Fuera del mapa');
  if (def.overlay === 'cable' || def.overlay === 'pipe') {
    const grid = def.overlay === 'pipe' ? lay.occPipe : lay.occCable;
    for (let yy = y; yy < y + size; yy++) for (let xx = x; xx < x + size; xx++) {
      const i = yy * W + xx;
      if (L > 0 && !World.isExcavated(L, Math.floor(xx / lay.chunk), Math.floor(yy / lay.chunk))) return NO('Fuera del territorio excavado');
      if (!(F[T[i]] & BUILD)) return NO('Terreno no construible');
      if (grid[i] >= 0) return NO(def.overlay === 'pipe' ? 'Ya hay una tubería en esta casilla' : 'Ya hay un cable en esta casilla');
      if (lay.occ[i] >= 0) { const od = structOf(World.occRef[lay.occ[i]]); if (!od || !od.conveyor) return NO('Ocupado por otra estructura'); }
    }
    return { ok: true, reason: '' };
  }
  const surfaceOnly = def.surfaceOnly || SURFACE_ONLY.has(def.id);
  if (surfaceOnly && L !== 0) return NO('Solo en la superficie');
  if (def.shaft && L !== 0) return NO('Los pozos se excavan desde la superficie');
  if ((def.elevator || def.borer) && L === 0) return NO('Solo en estratos inferiores');
  if (def.borer && (def.tier | 0) < (lay.borerTier | 0)) return NO('Tuneladora insuficiente: este estrato exige T' + lay.borerTier);
  let deposits = 0, tooHard = null, wrongFluid = false, wrongRes = false, vent = false;
  const ex = def.extract, resList = ex ? asList(ex.res || ex.only || ex.resources || ex.deposit) : null;
  const terrList = asList(def.terrain || (def.nature && def.nature.terrain) || (ex && ex.terrain));
  let terrOk = !terrList;
  for (let yy = y; yy < y + size; yy++) for (let xx = x; xx < x + size; xx++) {
    const i = yy * W + xx, f = F[T[i]];
    if (L > 0 && !World.isExcavated(L, Math.floor(xx / lay.chunk), Math.floor(yy / lay.chunk))) return NO('Fuera del territorio excavado');
    if (f & SOLID) return NO('Roca sin excavar');
    if (!(f & BUILD)) return NO('Terreno no construible');
    if (lay.occ[i] >= 0) return NO('Ocupado por otra estructura');
    if (!def.conveyor && (lay.occCable[i] >= 0 || lay.occPipe[i] >= 0)) return NO('Hay un cable o tubería debajo');
    if (f & VENT) vent = true;
    if (terrList && terrList.includes(lay.tIds[T[i]])) terrOk = true;
    if (ex) {
      const dp = World.depositAt(L, xx, yy);
      if (dp) {
        if (!!dp.fluid !== !!ex.fluid) { wrongFluid = true; continue; }
        if (resList && !resList.includes(dp.res)) { wrongRes = true; continue; }
        if (typeof ex.hardnessMax === 'number' && (dp.hardness || 0) > ex.hardnessMax) { tooHard = dp; continue; }
        deposits++;
      }
    }
  }
  if (!terrOk) return NO('Debe cubrir terreno: ' + terrList.map(id => { const d = World.terrainInfo(id); return d ? d.name : id; }).join(', '));
  if (ex && !deposits) {
    if (tooHard) return NO('Yacimiento demasiado duro (dureza ' + tooHard.hardness + ', máx. ' + ex.hardnessMax + ')');
    if (wrongRes) return NO('Necesita un yacimiento de ' + listNames(resList));
    if (wrongFluid) return NO(ex.fluid ? 'Necesita un yacimiento de fluido' : 'Necesita un yacimiento sólido');
    const wanted = resList || lay.def.deposits.filter(d => !!d.fluid === !!ex.fluid && (typeof ex.hardnessMax !== 'number' || d.hardness <= ex.hardnessMax)).map(d => d.res);
    return NO(wanted.length ? 'Necesita un yacimiento de ' + listNames(wanted) : 'Necesita un yacimiento debajo');
  }
  if ((def.needsVent || NEEDS_VENT.has(def.id)) && !vent) return NO('Debe cubrir una fumarola');
  if (def.needsWater || NEEDS_WATER.has(def.id)) {
    let touch = false;
    for (let k = 0; k < size && !touch; k++) touch = World.isWater(L, x + k, y - 1) || World.isWater(L, x + k, y + size) || World.isWater(L, x - 1, y + k) || World.isWater(L, x + size, y + k);
    if (!touch) return NO('Debe tocar agua');
  }
  if (def.borer) {
    let ok = false;
    const c = lay.chunk, seen = new Set();
    const test = (tx, ty) => { if (!inb(lay, tx, ty)) return; const cx = Math.floor(tx / c), cy = Math.floor(ty / c), k = cx + ',' + cy; if (seen.has(k)) return; seen.add(k); if (World.canDig(L, cx, cy).ok) ok = true; };
    for (let k = 0; k < size && !ok; k++) { test(x + k, y - 1); test(x + k, y + size); test(x - 1, y + k); test(x + size, y + k); }
    if (!ok) return NO('Debe estar junto a un bloque de roca excavable');
  }
  return { ok: true, reason: '' };
};
World.borerTargets = function (L, x, y, size) {
  const lay = World.layers[L], out = []; if (!lay || L === 0) return out;
  const c = lay.chunk, seen = new Set();
  const test = (tx, ty) => { if (!inb(lay, tx, ty)) return; const cx = Math.floor(tx / c), cy = Math.floor(ty / c), k = cx + ',' + cy; if (seen.has(k)) return; seen.add(k); if (World.canDig(L, cx, cy).ok) out.push({ cx, cy, key: k, hardness: World.rockHardness(L, cx, cy), work: World.excavationWork(L, cx, cy) }); };
  for (let k = 0; k < size; k++) { test(x + k, y - 1); test(x + k, y + size); test(x - 1, y + k); test(x + size, y + k); }
  return out;
};

/* ── path-finding: A*, 8-neighbour without corner cutting, typed-array scratch reused across calls ── */
const PF = { cap: 0, g: null, f: null, parent: null, stamp: null, closed: null, heap: null, heapN: 0, tick: 0, goal: null };
World.lastPath = { expanded: 0, found: false, limited: false };
function pfEnsure(n) {
  if (PF.cap >= n) return;
  PF.cap = n; PF.g = new Float32Array(n); PF.f = new Float32Array(n); PF.parent = new Int32Array(n); PF.stamp = new Uint32Array(n); PF.closed = new Uint32Array(n); PF.goal = new Uint32Array(n);
  PF.heap = new Int32Array(Math.max(1024, n * 2));
}
function heapPush(i) {
  const H = PF.heap, f = PF.f; if (PF.heapN >= H.length) { const nh = new Int32Array(H.length * 2); nh.set(H); PF.heap = nh; return heapPush(i); }
  let k = PF.heapN++; H[k] = i;
  while (k > 0) { const p = (k - 1) >> 1; if (f[H[p]] <= f[H[k]]) break; const t = H[p]; H[p] = H[k]; H[k] = t; k = p; }
}
function heapPop() {
  const H = PF.heap, f = PF.f, top = H[0], n = --PF.heapN;
  if (n > 0) {
    H[0] = H[n]; let k = 0;
    for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < n && f[H[l]] < f[H[m]]) m = l; if (r < n && f[H[r]] < f[H[m]]) m = r; if (m === k) break; const t = H[m]; H[m] = H[k]; H[k] = t; k = m; }
  }
  return top;
}
const SQRT2 = Math.SQRT2;
function astar(lay, sx, sy, targets, maxNodes) {
  const w = lay.w, h = lay.h, n = w * h, T = lay.terrain, F = lay.tFlags, occ = lay.occ;
  pfEnsure(n);
  const tick = ++PF.tick || (PF.tick = 1), g = PF.g, f = PF.f, parent = PF.parent, stamp = PF.stamp, closed = PF.closed, goal = PF.goal;
  if (tick === 1) { stamp.fill(0); closed.fill(0); goal.fill(0); }
  let nT = 0, bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (const t of targets) { const tx = t[0] | 0, ty = t[1] | 0; if (tx < 0 || ty < 0 || tx >= w || ty >= h) continue; goal[ty * w + tx] = tick; nT++; if (tx < bx0) bx0 = tx; if (tx > bx1) bx1 = tx; if (ty < by0) by0 = ty; if (ty > by1) by1 = ty; }
  if (!nT || sx < 0 || sy < 0 || sx >= w || sy >= h) return null;
  // octile distance to the targets' bounding box: admissible for any number of goals, O(1) per node
  const heur = (x, y) => { const dx = x < bx0 ? bx0 - x : x > bx1 ? x - bx1 : 0, dy = y < by0 ? by0 - y : y > by1 ? y - by1 : 0; return dx > dy ? dx + dy * (SQRT2 - 1) : dy + dx * (SQRT2 - 1); };
  const walk = i => (F[T[i]] & WALK) && occ[i] < 0;
  const passable = i => walk(i) || goal[i] === tick;
  const start = sy * w + sx;
  PF.heapN = 0; g[start] = 0; f[start] = heur(sx, sy); parent[start] = -1; stamp[start] = tick; heapPush(start);
  let expanded = 0, found = -1;
  while (PF.heapN > 0) {
    const i = heapPop();
    if (closed[i] === tick) continue;
    closed[i] = tick;
    if (goal[i] === tick) { found = i; break; }
    if (++expanded > maxNodes) break;
    const x = i % w, y = (i - x) / w, gi = g[i];
    const up = y > 0, dn = y < h - 1, lf = x > 0, rt = x < w - 1;
    const pU = up && passable(i - w), pD = dn && passable(i + w), pL = lf && passable(i - 1), pR = rt && passable(i + 1);
    const relax = (j, cost, nx, ny) => { if (closed[j] === tick) return; const ng = gi + cost; if (stamp[j] !== tick || ng < g[j]) { stamp[j] = tick; g[j] = ng; f[j] = ng + heur(nx, ny); parent[j] = i; heapPush(j); } };
    if (pU) relax(i - w, 1, x, y - 1); if (pD) relax(i + w, 1, x, y + 1); if (pL) relax(i - 1, 1, x - 1, y); if (pR) relax(i + 1, 1, x + 1, y);
    // diagonals only when both orthogonal neighbours are free (no corner cutting)
    if (pU && pL && passable(i - w - 1)) relax(i - w - 1, SQRT2, x - 1, y - 1);
    if (pU && pR && passable(i - w + 1)) relax(i - w + 1, SQRT2, x + 1, y - 1);
    if (pD && pL && passable(i + w - 1)) relax(i + w - 1, SQRT2, x - 1, y + 1);
    if (pD && pR && passable(i + w + 1)) relax(i + w + 1, SQRT2, x + 1, y + 1);
  }
  World.lastPath.expanded = expanded; World.lastPath.found = found >= 0; World.lastPath.limited = found < 0 && expanded > maxNodes;
  if (found < 0) return null;
  const path = [];
  for (let i = found; i >= 0; i = parent[i]) { const x = i % w; path.push([x, (i - x) / w]); }
  path.reverse();
  return path;
}
World.findPath = function (L, sx, sy, tx, ty, opts) { const lay = World.layers[L]; if (!lay) return null; return astar(lay, sx | 0, sy | 0, [[tx | 0, ty | 0]], (opts && opts.maxNodes) || 20000); };
World.findPathToAny = function (L, sx, sy, targets, opts) { const lay = World.layers[L]; if (!lay || !targets || !targets.length) return null; return astar(lay, sx | 0, sy | 0, targets, (opts && opts.maxNodes) || 20000); };
World.pathCost = path => { if (!path || path.length < 2) return 0; let c = 0; for (let k = 1; k < path.length; k++) c += (path[k][0] !== path[k - 1][0] && path[k][1] !== path[k - 1][1]) ? SQRT2 : 1; return c; };

/* ── spawns, areas, stats ── */
World.spawnTiles = function (L) {
  const lay = World.layers[L], out = []; if (!lay) return out;
  const w = lay.w, h = lay.h, T = lay.terrain, F = lay.tFlags, occ = lay.occ;
  const free = i => (F[T[i]] & WALK) && occ[i] < 0;
  if (L === 0) {
    for (let x = 0; x < w; x++) { if (free(x)) out.push([x, 0]); if (free((h - 1) * w + x)) out.push([x, h - 1]); }
    for (let y = 1; y < h - 1; y++) { if (free(y * w)) out.push([0, y]); if (free(y * w + w - 1)) out.push([w - 1, y]); }
    return out;
  }
  const c = lay.chunk, crack = lay.tIndex.void_crack, rubble = lay.tIndex.rubble;
  for (let cy = 0; cy < lay.ch; cy++) for (let cx = 0; cx < lay.cw; cx++) {
    if (!lay.exc[cy * lay.cw + cx]) continue;
    const x0 = cx * c, y0 = cy * c, x1 = Math.min(w, x0 + c), y1 = Math.min(h, y0 + c);
    const openN = cy > 0 && !lay.exc[(cy - 1) * lay.cw + cx], openS = cy < lay.ch - 1 && !lay.exc[(cy + 1) * lay.cw + cx];
    const openW = cx > 0 && !lay.exc[cy * lay.cw + cx - 1], openE = cx < lay.cw - 1 && !lay.exc[cy * lay.cw + cx + 1];
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = y * w + x; if (!free(i)) continue;
      const t = T[i];
      if (t === crack || t === rubble || (openN && y === y0) || (openS && y === y1 - 1) || (openW && x === x0) || (openE && x === x1 - 1)) out.push([x, y]);
    }
  }
  return out;
};
World.tilesInRadius = function (L, x, y, r) {
  const lay = World.layers[L], out = []; if (!lay) return out;
  const r2 = r * r, y0 = Math.max(0, Math.floor(y - r)), y1 = Math.min(lay.h - 1, Math.ceil(y + r)), x0 = Math.max(0, Math.floor(x - r)), x1 = Math.min(lay.w - 1, Math.ceil(x + r));
  for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) { const dx = xx - x, dy = yy - y; if (dx * dx + dy * dy <= r2) out.push([xx, yy]); }
  return out;
};
World.excavatedBounds = function (L) {
  const lay = World.layers[L]; if (!lay) return { x0: 0, y0: 0, x1: 0, y1: 0 };
  if (L === 0) return { x0: 0, y0: 0, x1: lay.w - 1, y1: lay.h - 1 };
  let cx0 = Infinity, cy0 = Infinity, cx1 = -1, cy1 = -1;
  for (let cy = 0; cy < lay.ch; cy++) for (let cx = 0; cx < lay.cw; cx++) if (lay.exc[cy * lay.cw + cx]) { if (cx < cx0) cx0 = cx; if (cy < cy0) cy0 = cy; if (cx > cx1) cx1 = cx; if (cy > cy1) cy1 = cy; }
  if (cx1 < 0) { const c = World.centre(L); return { x0: c.x, y0: c.y, x1: c.x, y1: c.y }; }
  const c = lay.chunk;
  return { x0: cx0 * c, y0: cy0 * c, x1: Math.min(lay.w, (cx1 + 1) * c) - 1, y1: Math.min(lay.h, (cy1 + 1) * c) - 1 };
};
World.regionStats = function (L) {
  const lay = World.layers[L]; if (!lay) return { excavatedChunks: 0, totalChunks: 0, fraction: 0, digging: 0 };
  const total = lay.cw * lay.ch;
  if (L === 0) return { excavatedChunks: total, totalChunks: total, fraction: 1, digging: 0 };
  let n = 0; for (let k = 0; k < total; k++) if (lay.exc[k]) n++;
  const gl = gLayer(L);
  return { excavatedChunks: n, totalChunks: total, fraction: total ? n / total : 0, digging: gl && gl.digging ? Object.keys(gl.digging).length : 0 };
};
World.terrainCounts = function (L) { const lay = World.layers[L], out = {}; if (!lay) return out; const T = lay.terrain; for (let i = 0; i < T.length; i++) { const id = lay.tIds[T[i]]; out[id] = (out[id] || 0) + 1; } return out; };
const DUMP_CH = { grass: '.', forest: 'T', dirt: ':', sand: 's', water: '~', rock: '^', clay: 'c', bog: 'b', saltflat: '=', gravel: 'g', cave_floor: '.', cave_wall: '#', cave_water: '~', rubble: 'r', coal_seam: 'k', deep_floor: '.', deep_wall: '#', crystal_floor: '*', deep_water: '~', abyss_floor: '.', abyss_wall: '#', obsidian_floor: 'o', magma: 'M', vent: 'V', core_floor: '.', core_wall: '#', magma_sea: 'M', plasma_floor: 'p', void_crack: 'X' };
World.debugDump = function (L, opts) {
  const lay = World.layers[L]; if (!lay) return '';
  const showDep = !opts || opts.deposits !== false, gl = gLayer(L), rows = [];
  for (let y = 0; y < lay.h; y++) {
    let s = '';
    for (let x = 0; x < lay.w; x++) {
      const i = y * lay.w + x;
      if (lay.occ[i] >= 0) { s += '@'; continue; }
      if (showDep && gl && gl.deposits && gl.deposits[U.key(x, y)]) { s += gl.deposits[U.key(x, y)].amt < 0 ? '$' : 'o'; continue; }
      s += DUMP_CH[lay.tIds[lay.terrain[i]]] || '?';
    }
    rows.push(s);
  }
  return rows.join('\n');
};
World.DUMP_LEGEND = DUMP_CH;
World.FLAGS = { WALK, BUILD, SOLID, WATER, MAGMA, ROCK, FOREST, VENT };
})();
