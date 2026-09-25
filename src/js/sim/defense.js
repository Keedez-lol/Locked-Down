(() => {
'use strict';
const LD = window.LD, U = LD.U, E = LD.Events;

const WAVE_BASE = [720, 780, 840, 900, 960];
const WARN_S = 60, WAVE_MAX_S = 360, MAX_ALIVE = 120, REPATH_S = 2, FIELD_MIN_S = 0.5, FIELD_MAX_AGE = 10, CELL = 4;
const ENGAGE = 0.8, STUCK_S = 3, LOST_S = 12, MAX_FIELD_PATH = 32, ASTAR_NODES = 6000;
const PROJ_SPEED = { arrow: 8, bolt: 10, shell: 12, bullet: 28, plasma: 14 };
const BEAM_LIFE = { laser: 0.08, tesla: 0.12 };
const SHOT_SFX = { arrow: 'shot_arrow', bolt: 'shot_ballista', shell: 'shot_cannon', bullet: 'shot_gatling', laser: 'shot_laser', tesla: 'shot_tesla', plasma: 'shot_plasma' };
const AMMO_KIND = { arrow: 'arrow', ballista_bolt: 'bolt', cannon_shell: 'shell', bullet: 'bullet' };
const damageMatrix = {
  kinetic: { none: 1, chitin: 1, crystal: 0.5, basalt: 0.4, void: 0 },
  thermal: { none: 1, chitin: 1.4, crystal: 1.2, basalt: 0.6, void: 0 },
  electric: { none: 1.2, chitin: 0.8, crystal: 1.5, basalt: 0.5, void: 0 },
  plasma: { all: 1, none: 1, chitin: 1, crystal: 1, basalt: 1, void: 1 }
};
const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const SQ2 = 1.41421356;
/* flow field: integer costs 5 (orthogonal) / 7 (diagonal, ≈5·√2) so a bucket queue replaces the heap */
const F_ORTH = 5, F_DIAG = 7, F_INF = 0x3fffffff, F_BUCKETS = 8;

const Reg = () => LD.Registry, World = () => LD.World, Sim = () => LD.Sim || {};
const Build = () => Sim().Build, Power = () => Sim().Power, Economy = () => Sim().Economy, Ev = () => Sim().Events, Nature = () => Sim().Nature;
const WL = L => { const W = World(); return W && W.layers ? W.layers[L] || null : null; };
const diff = () => (LD.State && LD.State.difficulty && LD.State.difficulty()) || { waves: true, enemyHp: 1, enemyDmg: 1, interval: 1 };
const layerName = L => { const d = Reg() && Reg().layer(L); return d && d.name ? d.name : 'Estrato ' + L; };
const log = (text, kind) => { if (LD.State && LD.State.log) LD.State.log(text, kind); };
const tilePx = () => (LD.Render && LD.Render.TILE) || 48;
/* shared flow field by default: one Dijkstra per layer change instead of one A* per enemy (Defense.externalPaths = true opts into World.findPathToAny) */
const useExternalPaths = () => { const W = World(); return !!(Defense.externalPaths && W && typeof W.findPathToAny === 'function'); };

/* sound / particles gated to the viewed layer, throttled per key */
const sfxLast = Object.create(null);
function sfx(name, L, gain, minGap) {
  const A = LD.Audio, G = LD.G;
  if (!A || !A.play || !name) return;
  if (G && L !== undefined && L !== G.view.layer) return;
  const now = U.now();
  if (minGap && now - (sfxLast[name] || 0) < minGap * 1000) return;
  sfxLast[name] = now;
  try { A.play(name, gain !== undefined ? { gain } : undefined); } catch (err) { /* audio optional */ }
}
function fx(kind, L, x, y, opts) {
  const P = LD.Particles, G = LD.G;
  if (!P || !P.emit || !G || L !== G.view.layer) return;
  const k = tilePx();
  if (opts) { opts.layer = L; if (opts.tx !== undefined) { opts.tx *= k; opts.ty *= k; } }
  try { P.emit(kind, x * k, y * k, opts); } catch (err) { /* particles optional */ }
}

/* ── per-layer runtime (never saved) ── */
const LR = [];
let initFor = null, structDirty = true, structAt = -1e9, bound = false;
function layerRT(L) {
  L = U.clamp(L | 0, 0, 4);
  let r = LR[L];
  if (!r) r = LR[L] = {
    L, warned: false, active: false, wno: 0, start: 0, kills: 0, losses: 0, spawned: 0, pending: [], spots: [], list: [], enemyCount: 0,
    w: 0, h: 0, walk: null, tWalk: null, tIdsLen: -1, hash: null, buckets: null, astar: null,
    field: null, fieldValid: false, fieldAt: -1e9, fieldVer: 0, pathsDirty: true, pathsVer: 0,
    targets: [], targetSet: new Set(), tcx: 0, tcy: 0, targetsDirty: true, turrets: [], structCount: 0
  };
  return r;
}

/* ── walkability ── */
function terrainWalkable(id) {
  const d = Reg() && Reg().terrain(id);
  if (d) return d.walkable !== false && !/_wall$/.test(id);
  return !(/_wall$/.test(id) || /water|magma_sea/.test(id));
}
function ensureGrid(r) {
  const wl = WL(r.L);
  if (!wl || !wl.terrain) return false;
  const n = wl.w * wl.h;
  if (r.w !== wl.w || r.h !== wl.h || !r.walk) {
    r.w = wl.w; r.h = wl.h; r.walk = new Uint8Array(n); r.field = new Int32Array(n); r.fieldValid = false;
    r.hash = makeHash(wl.w, wl.h); r.astar = null; r.tIdsLen = -1;
  }
  const ids = wl.tIds || [];
  if (!r.tWalk || r.tIdsLen !== ids.length) {
    r.tIdsLen = ids.length; r.tWalk = new Uint8Array(Math.max(256, ids.length));
    for (let i = 0; i < ids.length; i++) r.tWalk[i] = terrainWalkable(ids[i]) ? 1 : 0;
  }
  return true;
}
function blockerAt(L, x, y) {
  const W = World(), G = LD.G;
  if (!W || !W.uidAt || !G) return null;
  const uid = W.uidAt(L, x, y);
  if (!uid) return null;
  const s = G.structures[uid];
  return s && s.state !== 'broken' ? s : null;
}
function terrainOk(r, x, y) {
  if (r.w && (x < 0 || y < 0 || x >= r.w || y >= r.h)) return false;
  const wl = WL(r.L);
  if (!wl || !r.tWalk) return true;
  return r.tWalk[wl.terrain[y * r.w + x]] === 1;
}
const tileWalkable = (r, x, y) => terrainOk(r, x, y) && !blockerAt(r.L, x, y);
function buildWalk(r) {
  const wl = WL(r.L), S = LD.G.structures, ref = World().occRef || [], terr = wl.terrain, occ = wl.occ, tw = r.tWalk, walk = r.walk;
  for (let i = 0, n = r.w * r.h; i < n; i++) {
    let ok = tw[terr[i]];
    if (ok && occ) { const o = occ[i]; if (o > 0) { const inst = S[ref[o]]; if (inst && inst.state !== 'broken') ok = 0; } }
    walk[i] = ok;
  }
}

/* ── binary heap on typed arrays (lazy deletion) ── */
function makeHeap(cap) { return { idx: new Int32Array(cap), key: new Float32Array(cap), cap, n: 0, popKey: 0 }; }
function heapPush(H, i, k) {
  if (H.n >= H.cap) return;
  let p = H.n++; const idx = H.idx, key = H.key;
  while (p > 0) { const q = (p - 1) >> 1; if (key[q] <= k) break; idx[p] = idx[q]; key[p] = key[q]; p = q; }
  idx[p] = i; key[p] = k;
}
function heapPop(H) {
  const idx = H.idx, key = H.key, top = idx[0];
  H.popKey = key[0];
  const n = --H.n;
  if (n === 0) return top;
  const li = idx[n], lk = key[n];
  let p = 0;
  for (;;) {
    let c = 2 * p + 1;
    if (c >= n) break;
    if (c + 1 < n && key[c + 1] < key[c]) c++;
    if (key[c] >= lk) break;
    idx[p] = idx[c]; key[p] = key[c]; p = c;
  }
  idx[p] = li; key[p] = lk;
  return top;
}

/* ── distance field: multi-source Dijkstra from the hub/elevator ring (8-neighbour, no corner cutting) ──
   Dial's algorithm: costs are 5/7, so F_BUCKETS circular buckets of pending tiles replace the binary heap (~3× faster on 256×192). */
function makeBuckets() { const b = []; for (let k = 0; k < F_BUCKETS; k++) b.push({ a: new Int32Array(2048), n: 0 }); return b; }
function bucketPush(B, i) { if (B.n >= B.a.length) { const na = new Int32Array(B.a.length * 2); na.set(B.a); B.a = na; } B.a[B.n++] = i; }
function buildField(r, t) {
  buildWalk(r);
  const w = r.w, h = r.h, dist = r.field, walk = r.walk;
  if (!r.buckets) r.buckets = makeBuckets();
  const buckets = r.buckets;
  for (let k = 0; k < F_BUCKETS; k++) buckets[k].n = 0;
  dist.fill(F_INF);
  let pending = 0;
  for (let k = 0; k < r.targets.length; k++) { const tg = r.targets[k], i = tg[1] * w + tg[0]; if (walk[i] && dist[i] !== 0) { dist[i] = 0; bucketPush(buckets[0], i); pending++; } }
  for (let cur = 0; pending > 0; cur++) {
    const B = buckets[cur & (F_BUCKETS - 1)];
    while (B.n > 0) {
      const i = B.a[--B.n]; pending--;
      const d = dist[i];
      if (d !== cur) continue;   // stale entry, a shorter route was found later
      const x = i % w, y = (i - x) / w;
      const wU = y > 0 && walk[i - w], wD = y < h - 1 && walk[i + w], wL = x > 0 && walk[i - 1], wR = x < w - 1 && walk[i + 1];
      const d1 = d + F_ORTH, d2 = d + F_DIAG;
      if (wU && d1 < dist[i - w]) { dist[i - w] = d1; bucketPush(buckets[d1 & (F_BUCKETS - 1)], i - w); pending++; }
      if (wD && d1 < dist[i + w]) { dist[i + w] = d1; bucketPush(buckets[d1 & (F_BUCKETS - 1)], i + w); pending++; }
      if (wL && d1 < dist[i - 1]) { dist[i - 1] = d1; bucketPush(buckets[d1 & (F_BUCKETS - 1)], i - 1); pending++; }
      if (wR && d1 < dist[i + 1]) { dist[i + 1] = d1; bucketPush(buckets[d1 & (F_BUCKETS - 1)], i + 1); pending++; }
      if (wU && wL && walk[i - w - 1] && d2 < dist[i - w - 1]) { dist[i - w - 1] = d2; bucketPush(buckets[d2 & (F_BUCKETS - 1)], i - w - 1); pending++; }
      if (wU && wR && walk[i - w + 1] && d2 < dist[i - w + 1]) { dist[i - w + 1] = d2; bucketPush(buckets[d2 & (F_BUCKETS - 1)], i - w + 1); pending++; }
      if (wD && wL && walk[i + w - 1] && d2 < dist[i + w - 1]) { dist[i + w - 1] = d2; bucketPush(buckets[d2 & (F_BUCKETS - 1)], i + w - 1); pending++; }
      if (wD && wR && walk[i + w + 1] && d2 < dist[i + w + 1]) { dist[i + w + 1] = d2; bucketPush(buckets[d2 & (F_BUCKETS - 1)], i + w + 1); pending++; }
    }
  }
  r.fieldValid = true; r.fieldAt = t; r.fieldVer++; r.pathsDirty = false;
  const wl = WL(r.L); if (wl && wl.dirty) wl.dirty.paths = false;
}
function setNode(path, k, x, y) { const p = path[k]; if (p) { p[0] = x; p[1] = y; } else path[k] = [x, y]; }
function pathFromField(r, e) {
  const w = r.w, h = r.h, dist = r.field, walk = r.walk, path = e.path;
  let x = e.x | 0, y = e.y | 0, i = y * w + x, k = 0;
  if (x < 0 || y < 0 || x >= w || y >= h) { path.length = 0; return false; }
  if (dist[i] >= F_INF) {
    let best = -1, bd = F_INF;
    for (let d = 0; d < 8; d++) {
      const nx = x + DIRS8[d][0], ny = y + DIRS8[d][1];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (dist[j] < bd) { bd = dist[j]; best = j; }
    }
    if (best < 0) { path.length = 0; return false; }
    i = best; x = i % w; y = (i - x) / w; setNode(path, k++, x, y);
  }
  while (dist[i] > 0 && k < MAX_FIELD_PATH) {
    let best = -1, bd = dist[i];
    for (let d = 0; d < 8; d++) {
      const nx = x + DIRS8[d][0], ny = y + DIRS8[d][1];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (d >= 4 && (!walk[y * w + nx] || !walk[ny * w + x])) continue;
      const j = ny * w + nx;
      if (dist[j] < bd) { bd = dist[j]; best = j; }
    }
    if (best < 0) break;
    i = best; x = i % w; y = (i - x) / w; setNode(path, k++, x, y);
  }
  path.length = k; e.pi = 0;
  return true;
}

/* ── bounded A* to any goal tile (used for breaches) ── */
function astar(r, sx, sy, goals, path, maxNodes) {
  const w = r.w, h = r.h, n = w * h, walk = r.walk;
  if (sx < 0 || sy < 0 || sx >= w || sy >= h || !goals.length) return false;
  if (!r.astar) r.astar = { g: new Float32Array(n), par: new Int32Array(n), seen: new Int32Array(n), closed: new Int32Array(n), goal: new Int32Array(n), gen: 0, heap: makeHeap(n * 2) };
  const A = r.astar, g = A.g, par = A.par, seen = A.seen, closed = A.closed, goal = A.goal, H = A.heap, gen = ++A.gen;
  let gx = 0, gy = 0;
  for (let k = 0; k < goals.length; k++) { gx += goals[k][0]; gy += goals[k][1]; goal[goals[k][1] * w + goals[k][0]] = gen; }
  gx /= goals.length; gy /= goals.length;
  const heur = (x, y) => { const dx = Math.abs(x - gx), dy = Math.abs(y - gy); return Math.max(dx, dy) + 0.41421356 * Math.min(dx, dy); };
  const start = sy * w + sx;
  H.n = 0; seen[start] = gen; g[start] = 0; par[start] = -1;
  heapPush(H, start, heur(sx, sy));
  let expanded = 0, found = -1;
  while (H.n > 0 && expanded < maxNodes) {
    const i = heapPop(H);
    if (closed[i] === gen) continue;
    closed[i] = gen; expanded++;
    if (goal[i] === gen) { found = i; break; }
    const x = i % w, y = (i - x) / w, gi = g[i];
    for (let k = 0; k < 8; k++) {
      const nx = x + DIRS8[k][0], ny = y + DIRS8[k][1];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (!walk[j] && goal[j] !== gen) continue;
      if (k >= 4 && (!walk[y * w + nx] || !walk[ny * w + x])) continue;
      const ng = gi + (k >= 4 ? SQ2 : 1);
      if (seen[j] !== gen || ng < g[j]) { seen[j] = gen; g[j] = ng; par[j] = i; heapPush(H, j, ng + heur(nx, ny)); }
    }
  }
  if (found < 0) return false;
  let len = 0;
  for (let i = found; i >= 0; i = par[i]) len++;
  let k = len - 2;
  for (let i = found; i >= 0 && k >= 0; i = par[i]) { const x = i % w; setNode(path, k--, x, (i - x) / w); }
  path.length = len - 1;
  return true;
}

/* ── targets: tiles adjacent to the hub (L0) / elevators (L≥1) ── */
function rebuildTargets(r) {
  const G = LD.G, L = r.L, S = G.structures, Rg = Reg(), B = Build();
  ensureGrid(r);
  let hub = null;
  if (B && B.hubOf) { try { hub = B.hubOf(L); } catch (err) { hub = null; } }
  const goals = [];
  if (L === 0) {
    if (!hub) for (const uid in S) { const s = S[uid]; if (s.layer === 0 && s.id === 'hub') { hub = s; break; } }
    if (hub) goals.push(hub);
  } else {
    for (const uid in S) { const s = S[uid]; if (s.layer !== L || s.state === 'broken') continue; const d = Rg.structure(s.id); if (d && d.elevator) goals.push(s); }
    if (!goals.length && hub && hub.layer === L) goals.push(hub);
  }
  r.targets.length = 0; r.targetSet.clear(); r.targetsDirty = false;
  if (!goals.length) {
    const W = World(); let c = null;
    if (W && W.centre) { try { c = W.centre(L); } catch (err) { c = null; } }
    r.tcx = c ? c.x + 0.5 : r.w / 2; r.tcy = c ? c.y + 0.5 : r.h / 2;
    return;
  }
  let cx = 0, cy = 0;
  for (const s of goals) {
    const d = Rg.structure(s.id), size = d ? d.size || 1 : 1;
    cx += s.x + size / 2; cy += s.y + size / 2;
    r.targetSet.add(s.uid);
    ringOf(r, s, size, r.targets, r.targets.length);
  }
  r.tcx = cx / goals.length; r.tcy = cy / goals.length;
}
/* walkable 4-adjacent ring around a footprint, appended to out from index k0 */
function ringOf(r, s, size, out, k0) {
  let k = k0;
  for (let x = s.x - 1; x <= s.x + size; x++) for (let y = s.y - 1; y <= s.y + size; y++) {
    const ox = x < s.x || x >= s.x + size, oy = y < s.y || y >= s.y + size;
    if (!(ox || oy) || (ox && oy)) continue;
    if (tileWalkable(r, x, y)) setNode(out, k++, x, y);
  }
  out.length = k;
  return out;
}
function rectDist(e, s, size) {
  const px = U.clamp(e.x, s.x, s.x + size), py = U.clamp(e.y, s.y, s.y + size);
  return Math.hypot(e.x - px, e.y - py);
}
function sizeOf(s) { const d = Reg().structure(s.id); return d ? d.size || 1 : 1; }

/* ── structure scan (turrets per layer, counts for threat) ── */
function scanStructures(t) {
  const G = LD.G, Rg = Reg();
  for (let L = 0; L < 5; L++) { const r = layerRT(L); r.turrets.length = 0; r.structCount = 0; }
  for (const uid in G.structures) {
    const s = G.structures[uid], r = layerRT(s.layer);
    r.structCount++;
    const d = Rg.structure(s.id);
    if (d && d.turret) r.turrets.push(s);
  }
  structDirty = false; structAt = t;
}

/* ── spawn spots: a cluster of 2–4 tiles from World.spawnTiles ── */
function pickSpots(r, out) {
  const W = World(); let tiles = null;
  if (W && W.spawnTiles) { try { tiles = W.spawnTiles(r.L); } catch (err) { tiles = null; } }
  out.length = 0;
  if (!tiles || !tiles.length) return fallbackSpots(r, out);
  const anchor = tiles[Math.floor(Math.random() * tiles.length)], want = 2 + Math.floor(Math.random() * 3);
  out.push(anchor);
  for (let tries = 0; tries < 60 && out.length < want; tries++) {
    const c = tiles[Math.floor(Math.random() * tiles.length)];
    if (c !== anchor && Math.abs(c[0] - anchor[0]) <= 6 && Math.abs(c[1] - anchor[1]) <= 6 && out.indexOf(c) < 0) out.push(c);
  }
  return out;
}
function fallbackSpots(r, out) {
  if (!ensureGrid(r)) { out.push([0, 0]); return out; }
  const W = World(); let b = null;
  if (r.L > 0 && W && W.excavatedBounds) { try { b = W.excavatedBounds(r.L); } catch (err) { b = null; } }
  const x0 = b ? b.x0 : 0, y0 = b ? b.y0 : 0, x1 = b ? b.x1 : r.w - 1, y1 = b ? b.y1 : r.h - 1;
  const side = Math.floor(Math.random() * 4);
  for (let tries = 0; tries < 400 && out.length < 3; tries++) {
    const d = Math.floor(Math.random() * 3), along = Math.random();
    const x = side === 0 ? x0 + d : side === 1 ? x1 - d : Math.round(x0 + (x1 - x0) * along);
    const y = side === 2 ? y0 + d : side === 3 ? y1 - d : Math.round(y0 + (y1 - y0) * along);
    if (Math.hypot(x - r.tcx, y - r.tcy) < 12) continue;
    if (tileWalkable(r, x, y)) out.push([x, y]);
  }
  return out;
}

/* ── threat & wave scheduling ── */
function updateThreat(r, dt) {
  const GL = LD.G.layers[r.L];
  if (!GL || !GL.unlocked || r.structCount < 1) return;
  const perMin = 0.3 + 1.2 * Math.log10(1 + Math.max(0, GL.energyHandled || 0) / 1e3) + 0.01 * r.structCount;
  GL.threat = (GL.threat || 0) + perMin * dt / 60;
}
function isNight() {
  const N = Nature();
  if (N && N.isNight) { try { return !!N.isNight(); } catch (err) { /* fall through */ } }
  const G = LD.G; return !!G && G.time.dayFrac >= 0.55;
}
function waveSize(L, threat, mul) {
  let n = 2 + Math.floor(Math.max(0, threat) / 6);
  if (L === 0 && isNight()) n = Math.ceil(n * 1.5);
  return Math.max(1, Math.round(n * (mul || 1)));
}
function scheduleWave(r, t) {
  const GL = LD.G.layers[r.L], ld = Reg().layer(r.L);
  const base = (ld && ld.waveBase > 0) ? ld.waveBase : WAVE_BASE[r.L] || 900;
  GL.waveAt = t + base * (diff().interval || 1) * (0.8 + Math.random() * 0.4);
  r.warned = false;
}
function updateWaves(r, t) {
  const GL = LD.G.layers[r.L], D = diff();
  if (!GL || !D.waves || !GL.unlocked) return;
  if (!(GL.waveAt > 0)) scheduleWave(r, t);
  if (!r.warned && t >= GL.waveAt - WARN_S) {
    r.warned = true;
    const size = waveSize(r.L, GL.threat || 0, 1), boss = (GL.waveNo | 0) % 5 === 4;
    E.emit('wave:incoming', { layer: r.L, at: GL.waveAt, size, boss });
    sfx('wave_warning');
    const M = LD.Music; if (M && M.duck) { try { M.duck(6); } catch (err) { /* music optional */ } }
    const text = 'Oleada ' + ((GL.waveNo | 0) + 1) + ' inminente en ' + layerName(r.L) + ': ~' + size + ' hostiles en ' + WARN_S + ' s' + (boss ? '. Se aproxima una bestia mayor' : '');
    log(text, 'warn');
    E.emit('toast', { text, kind: 'warn' });
  }
  if (t >= GL.waveAt) { spawnWave(r.L, null); scheduleWave(r, t); }
}

/* ── spawning ── */
const cache = new Map();   // uid → { e, def, hpMax, phase, repathAt, pathVer, sfxAt, lx, ly, stuck, lost, brecha, breachUid }
function makeCache(e, d) {
  const c = { e, def: d, hpMax: Math.max(1, e.hp), phase: Math.random() * 6.2832, repathAt: -1e9, pathVer: -1, sfxAt: -1e9, lx: e.x, ly: e.y, stuck: 0, lost: 0, brecha: false, breachUid: null };
  cache.set(e.uid, c);
  return c;
}
function spawnEnemy(L, id, x, y, wno) {
  const G = LD.G, d = Reg().enemy(id);
  if (!d) return null;
  const e = { uid: U.uid(), id, layer: L, x, y, hp: (d.hp || 10) * (diff().enemyHp || 1), path: [], pi: 0, target: null, cd: Math.random() * 0.6, aim: 0, wave: wno };
  G.enemies.push(e);
  makeCache(e, d);
  if (!G.discovered.enemies[id]) {
    G.discovered.enemies[id] = true;
    log('Nueva amenaza identificada: ' + d.name, 'info');
    E.emit('toast', { text: 'Amenaza identificada: ' + d.name, kind: 'info' });
    sfx('discover', L, 0.6, 0.5);
  }
  return e;
}
function drainPending(r) {
  const G = LD.G, spots = r.spots;
  if (!spots.length) pickSpots(r, spots);
  if (!spots.length) { r.pending.length = 0; return; }
  while (r.pending.length && r.enemyCount < MAX_ALIVE) {
    const id = r.pending.shift(), sp = spots[r.spawned % spots.length];
    const e = spawnEnemy(r.L, id, sp[0] + 0.5 + (Math.random() - 0.5) * 0.7, sp[1] + 0.5 + (Math.random() - 0.5) * 0.7, r.wno);
    if (!e) continue;
    r.list.push(e); r.enemyCount++; r.spawned++;
    if (G.view.layer === r.L) fx('dust', r.L, e.x, e.y, { n: 4 });
  }
}
function spawnWave(L, opts) {
  const G = LD.G; if (!G) return 0;
  opts = opts || {};
  const r = layerRT(L), GL = G.layers[r.L], Rg = Reg(), ld = Rg.layer(r.L);
  if (!GL) return 0;
  if (r.targetsDirty) rebuildTargets(r);
  const pool = [], bosses = [];
  const ids = (ld && ld.enemies && ld.enemies.length) ? ld.enemies : Array.from(Rg.enemies.values()).filter(d => d.layer === r.L).map(d => d.id);
  for (const id of ids) { const d = Rg.enemy(id); if (d) (d.boss ? bosses : pool).push(d); }
  if (!pool.length && !bosses.length) return 0;
  const threat = GL.threat || 0, no = GL.waveNo | 0;
  const size = opts.size !== undefined ? Math.max(0, opts.size | 0) : waveSize(r.L, threat, opts.mul);
  const boss = opts.boss !== undefined ? !!opts.boss : no % 5 === 4;
  const base = pool.length ? pool : bosses;
  const k = 2 / (1 + threat / 10);   // low threat → weak enemies dominate; the spread widens as threat grows
  let wsum = 0;
  const ws = base.map(d => { const w = Math.exp(-Math.max(0, (d.threat || 1) - 1) * k); wsum += w; return w; });
  const list = r.pending, before = list.length;
  for (let i = 0; i < size; i++) {
    let x = Math.random() * wsum, pick = base[base.length - 1];
    for (let j = 0; j < base.length; j++) { x -= ws[j]; if (x <= 0) { pick = base[j]; break; } }
    list.push(pick.id);
  }
  if (boss && bosses.length) { const nb = 1 + Math.floor(threat / 30); for (let i = 0; i < nb; i++) list.push(bosses[Math.floor(Math.random() * bosses.length)].id); }
  const total = list.length - before;
  GL.waveNo = no + 1;
  G.stats.waves = (G.stats.waves || 0) + 1;
  if (!r.active) { r.kills = 0; r.losses = 0; r.spawned = 0; }
  r.active = true; r.wno = GL.waveNo; r.start = G.time.t; r.warned = false;
  pickSpots(r, r.spots);
  drainPending(r);
  E.emit('wave:started', { layer: r.L, no: GL.waveNo, size: total, boss });
  sfx('wave_start');
  log('Oleada ' + GL.waveNo + ' en ' + layerName(r.L) + ': ' + total + ' hostiles' + (boss ? ' con bestia mayor' : ''), 'bad');
  return total;
}

/* ── enemies ── */
const tmpGoals = [];
function copyPath(e, p) {
  for (let k = 0; k < p.length; k++) setNode(e.path, k, p[k][0] | 0, p[k][1] | 0);
  e.path.length = p.length; e.pi = 0;
}
function straightPath(r, e, s) {
  let tx = r.tcx | 0, ty = r.tcy | 0;
  if (s) { const size = sizeOf(s); tx = U.clamp(e.x | 0, s.x - 1, s.x + size); ty = U.clamp(e.y | 0, s.y - 1, s.y + size); }
  setNode(e.path, 0, tx, ty); e.path.length = 1; e.pi = 0;
}
/* "brecha": first structure hit by the straight line to the hub; the weakest of its lateral neighbours wins (walls preferred) */
function breachTarget(r, e) {
  const G = LD.G, Rg = Reg(), L = r.L;
  let dx = r.tcx - e.x, dy = r.tcy - e.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.5) return null;
  dx /= len; dy /= len;
  let hit = null, hx = 0, hy = 0;
  for (let s = 0.5; s <= len; s += 0.5) {
    const x = (e.x + dx * s) | 0, y = (e.y + dy * s) | 0;
    const b = blockerAt(L, x, y);
    if (b) { hit = b; hx = x; hy = y; break; }
  }
  if (!hit) return null;
  const px = Math.abs(dx) > Math.abs(dy) ? 0 : 1, py = 1 - px;
  const score = s => { const d = Rg.structure(s.id); return (s.hp || 0) * (d && d.wall ? 1 : 1.5); };
  let best = hit, bs = score(hit);
  for (let k = -1; k <= 1; k += 2) {
    const b = blockerAt(L, hx + px * k, hy + py * k);
    if (b && b !== hit && G.structures[b.uid]) { const sc = score(b); if (sc < bs) { bs = sc; best = b; } }
  }
  return best;
}
function repath(r, e, c, t) {
  c.repathAt = t + Math.random() * 0.4; c.stuck = 0; c.brecha = false; c.breachUid = null;
  const W = World();
  if (useExternalPaths()) {
    c.pathVer = r.pathsVer;
    let p = null;
    if (r.targets.length) { try { p = W.findPathToAny(r.L, e.x | 0, e.y | 0, r.targets); } catch (err) { p = null; } }
    if (p && p.length) { copyPath(e, p); return; }
  } else {
    c.pathVer = r.fieldVer;
    if (!r.fieldValid) { straightPath(r, e, null); return; }
    if (pathFromField(r, e)) return;
  }
  c.brecha = true;
  const b = breachTarget(r, e);
  if (b) {
    c.breachUid = b.uid;
    if (r.walk && ringOf(r, b, sizeOf(b), tmpGoals, 0).length && astar(r, e.x | 0, e.y | 0, tmpGoals, e.path, ASTAR_NODES)) { e.pi = 0; return; }
  }
  straightPath(r, e, b);
}
function engageFinal(r, e, c) {
  const G = LD.G, x = e.x | 0, y = e.y | 0;
  if (c.breachUid) { const s = G.structures[c.breachUid]; if (s && s.state !== 'broken' && rectDist(e, s, sizeOf(s)) <= ENGAGE) { e.target = s.uid; return true; } }
  for (let d = 0; d < 8; d++) {
    const s = blockerAt(r.L, x + DIRS8[d][0], y + DIRS8[d][1]);
    if (s && r.targetSet.has(s.uid) && rectDist(e, s, sizeOf(s)) <= ENGAGE) { e.target = s.uid; return true; }
  }
  return false;
}
function opportunistic(r, e) {
  const Rg = Reg(), x = e.x | 0, y = e.y | 0;
  for (let d = 0; d < 4; d++) {
    const s = blockerAt(r.L, x + DIRS8[d][0], y + DIRS8[d][1]);
    if (!s) continue;
    const def = Rg.structure(s.id);
    if (def && (def.turret || def.wall) && rectDist(e, s, def.size || 1) <= ENGAGE) return s;
  }
  return null;
}
function moveEnemy(r, e, c, d, dt, t) {
  const L = r.L, ver = useExternalPaths() ? r.pathsVer : r.fieldVer;
  const exhausted = e.pi >= e.path.length;
  const stale = c.pathVer !== ver, forced = c.stuck >= STUCK_S;
  if ((exhausted && t - c.repathAt >= 0.5) || ((stale || forced) && t - c.repathAt >= REPATH_S) || (forced && t - c.repathAt >= 0.5)) repath(r, e, c, t);
  if (e.pi >= e.path.length) {
    if (!engageFinal(r, e, c)) { c.lost += dt; if (c.brecha && !c.breachUid && c.lost > LOST_S) e.hp = 0; }
    return;
  }
  if (c.brecha || c.stuck >= STUCK_S) { const opp = opportunistic(r, e); if (opp) { e.target = opp.uid; c.lost = 0; return; } }   // adjacent walls/turrets only when blocked (§7.7)
  const node = e.path[e.pi], last = e.pi === e.path.length - 1;
  let tx = node[0] + 0.5, ty = node[1] + 0.5, dx = tx - e.x, dy = ty - e.y;
  const dist = Math.hypot(dx, dy);
  if (!last && dist > 0.01) { const j = Math.sin(t * 2.3 + c.phase) * 0.18; tx += -dy / dist * j; ty += dx / dist * j; dx = tx - e.x; dy = ty - e.y; }
  const dd = Math.hypot(dx, dy), step = (d.speed || 1) * dt;
  if (dd > 0.001) e.aim = Math.atan2(dy, dx);
  let nx, ny;
  if (dd <= step) { nx = tx; ny = ty; } else { nx = e.x + dx / dd * step; ny = e.y + dy / dd * step; }
  const cx0 = e.x | 0, cy0 = e.y | 0, cx1 = nx | 0, cy1 = ny | 0;
  if (cx1 !== cx0 || cy1 !== cy0) {
    const b = blockerAt(L, cx1, cy1);
    if (b) { e.target = b.uid; c.stuck = 0; return; }
    if (!terrainOk(r, cx1, cy1)) { c.stuck += dt; return; }
  }
  e.x = nx; e.y = ny;
  if (dd <= step) e.pi++;
  const moved = Math.hypot(e.x - c.lx, e.y - c.ly);
  c.stuck = moved < 0.004 ? c.stuck + dt : 0;
  c.lx = e.x; c.ly = e.y; c.lost = 0;
}
function attack(r, e, c, d, tgt, dt, dmgMul) {
  const L = r.L, size = sizeOf(tgt), cx = tgt.x + size / 2, cy = tgt.y + size / 2;
  e.aim = Math.atan2(cy - e.y, cx - e.x);
  e.cd -= dt;
  if (e.cd > 0) return;
  e.cd += 1 / (d.attackRate || 1);
  const amount = (d.dmg || 1) * dmgMul, B = Build();
  let broken = false;
  if (B && B.damage) { try { broken = !!B.damage(tgt.uid, amount, e.uid); } catch (err) { broken = false; } }
  else {
    const def = Reg().structure(tgt.id), max = def ? def.hp || 100 : 100;
    tgt.hp = Math.max(tgt.id === 'hub' ? max * 0.1 : 0, (tgt.hp || 0) - amount);
    if (tgt.hp <= 0) { tgt.state = 'broken'; broken = true; }
  }
  const px = U.clamp(e.x, tgt.x, tgt.x + size), py = U.clamp(e.y, tgt.y, tgt.y + size);
  fx('hit', L, px, py, { n: 3, color: d.color2 || '#3a3733' });
  sfx('hit', L, 0.5, 0.1);
  if (broken || tgt.state === 'broken' || !LD.G.structures[tgt.uid]) { e.target = null; if (c.breachUid === tgt.uid) c.breachUid = null; markPathsDirty(L); }
}
function updateEnemies(r, dt, t) {
  const G = LD.G, L = r.L, list = r.list, dmgMul = diff().enemyDmg || 1, Rg = Reg();
  const gridOk = ensureGrid(r);
  if (r.targetsDirty) rebuildTargets(r);
  const wl = WL(L), wlDirty = !!(wl && wl.dirty && wl.dirty.paths), external = useExternalPaths();
  if (external) { if (r.pathsDirty || wlDirty) { r.pathsVer++; r.pathsDirty = false; if (wl && wl.dirty) wl.dirty.paths = false; } }
  else if (gridOk && (r.pathsDirty || wlDirty || !r.fieldValid || t - r.fieldAt > FIELD_MAX_AGE) && t - r.fieldAt >= FIELD_MIN_S) buildField(r, t);
  const ver = external ? r.pathsVer : r.fieldVer;
  for (let n = 0; n < list.length; n++) {
    const e = list[n];
    if (e.hp <= 0) continue;
    let c = cache.get(e.uid);
    if (!c) { const d0 = Rg.enemy(e.id); if (!d0) { e.hp = 0; continue; } c = makeCache(e, d0); }
    const d = c.def;
    let tgt = e.target ? G.structures[e.target] : null;
    if (tgt && (tgt.state === 'broken' || tgt.layer !== L || rectDist(e, tgt, sizeOf(tgt)) > ENGAGE + 0.3)) tgt = null;
    // a wall under attack is abandoned as soon as the map changes and a route exists again (§7.7: attack only while blocked)
    if (tgt && !r.targetSet.has(tgt.uid) && c.pathVer !== ver && t - c.repathAt >= REPATH_S) { repath(r, e, c, t); if (!c.brecha) tgt = null; }
    if (!tgt) { e.target = null; moveEnemy(r, e, c, d, dt, t); tgt = e.target ? G.structures[e.target] : null; }
    if (tgt) attack(r, e, c, d, tgt, dt, dmgMul);
    else if (e.cd > 0) e.cd = Math.max(0, e.cd - dt);
    if (t - c.sfxAt > 5 && Math.random() < dt / 14) { c.sfxAt = t; sfx(d.sfx || 'growl', L, 0.5, 1.2); }
  }
}

/* ── spatial hash of enemies per layer (rebuilt each tick, arrays reused) ── */
function makeHash(w, h) { const cw = Math.ceil(w / CELL), ch = Math.ceil(h / CELL); return { cw, ch, cells: new Array(cw * ch).fill(null), used: [] }; }
function rebuildHash(r) {
  const H = r.hash, list = r.list;
  for (let i = 0; i < H.used.length; i++) H.cells[H.used[i]].length = 0;
  H.used.length = 0;
  for (let i = 0; i < list.length; i++) {
    const e = list[i], cx = U.clamp((e.x / CELL) | 0, 0, H.cw - 1), cy = U.clamp((e.y / CELL) | 0, 0, H.ch - 1), k = cy * H.cw + cx;
    let cell = H.cells[k];
    if (!cell) cell = H.cells[k] = [];
    if (cell.length === 0) H.used.push(k);
    cell.push(e);
  }
}
function nearestEnemy(r, x, y, range) {
  const H = r.hash, r2 = range * range;
  let best = null, bd = r2;
  if (!H) {
    for (let i = 0; i < r.list.length; i++) { const e = r.list[i]; if (e.hp <= 0) continue; const dx = e.x - x, dy = e.y - y, d2 = dx * dx + dy * dy; if (d2 <= bd) { bd = d2; best = e; } }
    return best;
  }
  const x0 = Math.max(0, ((x - range) / CELL) | 0), x1 = Math.min(H.cw - 1, ((x + range) / CELL) | 0), y0 = Math.max(0, ((y - range) / CELL) | 0), y1 = Math.min(H.ch - 1, ((y + range) / CELL) | 0);
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
    const cell = H.cells[cy * H.cw + cx];
    if (!cell || !cell.length) continue;
    for (let i = 0; i < cell.length; i++) { const e = cell[i]; if (e.hp <= 0) continue; const dx = e.x - x, dy = e.y - y, d2 = dx * dx + dy * dy; if (d2 <= bd) { bd = d2; best = e; } }
  }
  return best;
}
const tmpHits = [];
function enemiesInRange(r, x, y, range, out) {
  out.length = 0;
  const H = r.hash, r2 = range * range;
  const test = e => { if (e.hp <= 0) return; const dx = e.x - x, dy = e.y - y; if (dx * dx + dy * dy <= r2) out.push(e); };
  if (!H) { for (let i = 0; i < r.list.length; i++) test(r.list[i]); return out; }
  const x0 = Math.max(0, ((x - range) / CELL) | 0), x1 = Math.min(H.cw - 1, ((x + range) / CELL) | 0), y0 = Math.max(0, ((y - range) / CELL) | 0), y1 = Math.min(H.ch - 1, ((y + range) / CELL) | 0);
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) { const cell = H.cells[cy * H.cw + cx]; if (cell) for (let i = 0; i < cell.length; i++) test(cell[i]); }
  return out;
}

/* ── damage ── */
function calcDamage(dmg, type, ap, edef) {
  const at = edef.armorType || 'none';
  if (at === 'void') return ap && (type === 'plasma' || type === 'thermal') ? dmg : 0;
  const base = ap ? dmg : Math.max(dmg * 0.1, dmg - (edef.armor || 0));
  const row = damageMatrix[type] || damageMatrix.kinetic;
  const m = row[at] !== undefined ? row[at] : row.all !== undefined ? row.all : 1;
  return base * m;
}
function addItem(L, id, n) {
  const Ec = Economy(), G = LD.G;
  if (Ec && Ec.add) { try { return Ec.add(L, id, n); } catch (err) { return 0; } }
  const inv = G.inv[L] || (G.inv[L] = {}), cap = (G.caps && G.caps.base) || 200, add = Math.max(0, Math.min(n, cap - (inv[id] || 0)));
  inv[id] = (inv[id] || 0) + add;
  return add;
}
function kill(r, e, c, d) {
  const G = LD.G, L = r.L;
  e.hp = 0;
  for (const k in (d.drops || {})) { const n = d.drops[k], q = Math.floor(n) + (Math.random() < n - Math.floor(n) ? 1 : 0); if (q > 0) addItem(L, k, q); }
  G.stats.kills = (G.stats.kills || 0) + 1; r.kills++;
  sfx('enemy_die', L, 0.7, 0.08);
  E.emit('enemy:killed', e);   // Render emits the death particles
}
function hurt(r, e, dmg, type, ap) {
  const c = cache.get(e.uid), d = c ? c.def : Reg().enemy(e.id);
  if (!d || e.hp <= 0) return 0;
  const amount = calcDamage(dmg, type, ap, d);
  if (amount <= 0) { fx('spark', r.L, e.x, e.y, { n: 2 }); return 0; }
  e.hp -= amount;
  if (e.hp <= 0) kill(r, e, c, d);
  return amount;
}

/* ── projectiles (pooled records for the renderer; damage resolved on impact) ── */
const projectiles = [], pool = [];
function addProj(L, x, y, target, kind, life, dmg, type, ap, src, resolved) {
  const p = pool.pop() || {};
  p.layer = L; p.x = x; p.y = y; p.tx = target.x; p.ty = target.y; p.kind = kind; p.t = 0; p.life = life;
  p.dmg = dmg; p.type = type; p.ap = ap; p.src = src; p.target = target.uid; p.done = resolved;
  projectiles.push(p);
  return p;
}
function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.t += dt;
    if (!p.done) {
      const c = cache.get(p.target), e = c && c.e.hp > 0 ? c.e : null;
      if (e) { p.tx = e.x; p.ty = e.y; }
      const dx = p.tx - p.x, dy = p.ty - p.y, dist = Math.hypot(dx, dy), step = (PROJ_SPEED[p.kind] || 10) * dt;
      if (dist > step && p.t < p.life) { p.x += dx / dist * step; p.y += dy / dist * step; continue; }
      p.x = p.tx; p.y = p.ty; p.done = true; p.t = p.life;
      if (e) { hurt(layerRT(p.layer), e, p.dmg, p.type, p.ap); fx('hit', p.layer, e.x, e.y, { n: 3 }); }
    }
    if (p.t < p.life) continue;
    projectiles[i] = projectiles[projectiles.length - 1]; projectiles.pop(); pool.push(p);
  }
}

/* ── turrets ── */
function projKind(T) {
  if (T.kind) return T.kind;
  if (T.dmgType === 'thermal') return 'laser';
  if (T.dmgType === 'electric') return 'tesla';
  if (T.dmgType === 'plasma') return 'plasma';
  for (const a in (T.ammo || {})) return AMMO_KIND[a] || 'arrow';
  return 'arrow';
}
function takeAmmo(L, ammo) {
  const Ec = Economy();
  if (Ec && Ec.take) { try { return !!Ec.take(L, ammo); } catch (err) { return false; } }
  const inv = LD.G.inv[L] || {};
  for (const k in ammo) if ((inv[k] || 0) < ammo[k]) return false;
  for (const k in ammo) inv[k] -= ammo[k];
  return true;
}
function setDemand(inst, watts) {
  if (inst._demandW === watts) return;
  inst._demandW = watts;
  const P = Power();
  if (P && typeof P.setDemand === 'function') { try { P.setDemand(inst.uid, watts); } catch (err) { /* power optional */ } }
  else inst._demand = watts;
}
function powerRatio(inst) {
  if (typeof inst._powerRatio === 'number') return U.clamp(inst._powerRatio);
  const P = Power();
  if (P && P.gridOf) { try { const g = P.gridOf(inst.uid); return g ? U.clamp(typeof g.ratio === 'number' ? g.ratio : 1) : 0; } catch (err) { return 0; } }
  return 1;
}
function fire(r, inst, def, T, cx, cy, target, range) {
  const L = r.L, type = T.dmgType || 'kinetic', kind = projKind(T), dmg = T.dmg || 1, ap = !!T.ap;
  if (kind === 'tesla') {
    const hits = enemiesInRange(r, cx, cy, range, tmpHits);
    for (let i = 0; i < hits.length && i < 16; i++) { const e = hits[i]; addProj(L, cx, cy, e, 'tesla', BEAM_LIFE.tesla, dmg, type, ap, inst.uid, true); fx('arc', L, cx, cy, { n: 3, tx: e.x, ty: e.y }); hurt(r, e, dmg, type, ap); }
  } else if (kind === 'laser') {
    addProj(L, cx, cy, target, 'laser', BEAM_LIFE.laser, dmg, type, ap, inst.uid, true);
    fx('hit', L, target.x, target.y, { n: 2 });
    hurt(r, target, dmg, type, ap);
  } else {
    const life = 0.3 + 2 * Math.hypot(target.x - cx, target.y - cy) / (PROJ_SPEED[kind] || 10);   // travel cap; impact resolves on arrival
    addProj(L, cx, cy, target, kind, life, dmg, type, ap, inst.uid, false);
  }
  fx('shot', L, cx + Math.cos(inst.aim) * 0.45, cy + Math.sin(inst.aim) * 0.45, { n: 2, dir: inst.aim });
  sfx(SHOT_SFX[kind] || 'shot_arrow', L, 0.6, 0.05);
}
function updateTurrets(r, dt) {
  const L = r.L, Rg = Reg(), B = Build(), Evm = Ev(), turrets = r.turrets;
  if (!turrets.length) return;
  let rangeMod = 0;
  if (Evm && Evm.multipliers) { try { const m = Evm.multipliers(L); if (m && typeof m.turretRange === 'number') rangeMod = m.turretRange; } catch (err) { rangeMod = 0; } }
  for (let i = 0; i < turrets.length; i++) {
    const inst = turrets[i], def = Rg.structure(inst.id);
    if (!def || !def.turret) continue;
    const T = def.turret;
    if (inst.state === 'building' || inst.state === 'broken' || inst.paused) { inst._target = null; setDemand(inst, 0); continue; }
    const size = def.size || 1, cx = inst.x + size / 2, cy = inst.y + size / 2, range = Math.max(1, (T.range || 5) + rangeMod);
    const target = r.list.length ? nearestEnemy(r, cx, cy, range) : null;
    inst._target = target ? target.uid : null;
    if (target) inst.aim = Math.atan2(target.y - cy, target.x - cx);
    const needPower = !!(def.power && def.power.use), oc = inst.oc | 0;
    let ratio = 1;
    if (needPower) { setDemand(inst, target ? def.power.use : 0); ratio = powerRatio(inst); }   // base watts: Power applies 2^oc
    const period = 1 / (T.rate || 1);
    let state = 'idle';
    if (!target) inst._cd = Math.min(inst._cd || 0, period);
    else if (needPower && ratio <= 0.02) state = 'no_power';
    else {
      let im = 1;
      if (B && B.integrityMul) { try { im = B.integrityMul(inst) || 1; } catch (err) { im = 1; } }
      inst._cd = (inst._cd || 0) - dt * ratio * im * Math.pow(1.5, oc);
      state = 'working';
      let shots = 0;
      while (inst._cd <= 0 && shots < 4) {
        if (T.ammo && !takeAmmo(L, T.ammo)) { state = 'no_input'; inst._cd = 0; break; }
        fire(r, inst, def, T, cx, cy, target, range);
        inst._cd += period; shots++;
        if (target.hp <= 0) break;
      }
    }
    if (inst.state !== state && inst.state !== 'paused') inst.state = state;
  }
}

/* ── wave end, compaction, tick ── */
function updateWaveEnd(r, t) {
  if (!r.active) return;
  let alive = 0;
  for (let i = 0; i < r.list.length; i++) { const e = r.list[i]; if (e.hp > 0 && e.wave === r.wno) alive++; }
  const timeout = t - r.start >= WAVE_MAX_S;
  if (!((alive === 0 && r.pending.length === 0) || timeout)) return;
  r.active = false; r.pending.length = 0;
  E.emit('wave:ended', { layer: r.L, no: r.wno, kills: r.kills, losses: r.losses, survivors: alive });
  sfx('wave_end');
  log('Oleada ' + r.wno + ' en ' + layerName(r.L) + ' terminada: ' + r.kills + ' bajas enemigas, ' + r.losses + ' estructuras averiadas' + (alive ? ', ' + alive + ' hostiles siguen activos' : ''), alive ? 'warn' : 'ok');
}
function compact() {
  const arr = LD.G.enemies;
  let w = 0;
  for (let i = 0; i < arr.length; i++) { const e = arr[i]; if (e.hp > 0) arr[w++] = e; else cache.delete(e.uid); }
  arr.length = w;
  for (let L = 0; L < LR.length; L++) {
    const r = LR[L]; if (!r) continue;
    let k = 0;
    for (let i = 0; i < r.list.length; i++) if (r.list[i].hp > 0) r.list[k++] = r.list[i];
    r.list.length = k; r.enemyCount = k;
  }
}
function tick(dt) {
  const G = LD.G;
  if (!G) return;
  if (initFor !== G) init();
  const t = G.time.t;
  if (structDirty || t - structAt >= 2) scanStructures(t);
  for (let L = 0; L < 5; L++) layerRT(L).list.length = 0;
  const arr = G.enemies;
  for (let i = 0; i < arr.length; i++) { const e = arr[i]; if (e.hp > 0) layerRT(e.layer).list.push(e); }
  for (let L = 0; L < 5; L++) {
    const r = LR[L];
    if (!G.layers[L]) continue;
    r.enemyCount = r.list.length;
    updateThreat(r, dt);
    updateWaves(r, t);
    if (r.pending.length) drainPending(r);
    if (r.list.length) { if (r.hash || ensureGrid(r)) rebuildHash(r); updateEnemies(r, dt, t); }
    updateTurrets(r, dt);
    updateWaveEnd(r, t);
  }
  updateProjectiles(dt);
  compact();
}

/* ── init & events ── */
function init() {
  const G = LD.G;
  initFor = G; cache.clear(); projectiles.length = 0; LR.length = 0; structDirty = true; structAt = -1e9;
  bindEvents();
  if (!G) return;
  if (!Array.isArray(G.enemies)) G.enemies = [];
  const Rg = Reg();
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i], d = Rg.enemy(e.id);
    if (!d || !(e.hp > 0) || !G.layers[e.layer]) { G.enemies.splice(i, 1); continue; }
    if (!Array.isArray(e.path)) e.path = [];
    e.pi = e.pi | 0; e.cd = +e.cd || 0; e.aim = +e.aim || 0; e.x = +e.x || 0; e.y = +e.y || 0;
    if (e.target === undefined) e.target = null;
    if (e.wave === undefined) e.wave = G.layers[e.layer].waveNo | 0;
    makeCache(e, d);
  }
  for (let L = 0; L < 5; L++) {
    const r = layerRT(L), GL = G.layers[L];
    if (!GL) continue;
    let alive = 0;
    for (const e of G.enemies) if (e.layer === L && e.wave === (GL.waveNo | 0)) alive++;
    if (GL.waveNo > 0 && alive > 0) { r.active = true; r.wno = GL.waveNo | 0; r.start = G.time.t; }
    r.warned = GL.waveAt > 0 && G.time.t >= GL.waveAt - WARN_S;
  }
}
function markPathsDirty(L) {
  const W = World();
  const mark = i => { const wl = W && W.layers ? W.layers[i] : null; if (wl) { if (!wl.dirty) wl.dirty = {}; wl.dirty.paths = true; } layerRT(i).pathsDirty = true; };
  if (L === undefined || L === null) { for (let i = 0; i < 5; i++) mark(i); } else mark(L);
}
function bindEvents() {
  if (bound) return;
  bound = true;
  const onStruct = (uid, paths) => {
    const G = LD.G, s = G && G.structures ? G.structures[uid] : null;
    structDirty = true;
    if (s && typeof s.layer === 'number') { layerRT(s.layer).targetsDirty = true; if (paths) markPathsDirty(s.layer); }
    else if (paths) { markPathsDirty(); for (let i = 0; i < 5; i++) layerRT(i).targetsDirty = true; }
  };
  E.on('structure:placed', uid => onStruct(uid, true));
  E.on('structure:built', uid => onStruct(uid, false));
  E.on('structure:removed', uid => onStruct(uid, true));
  E.on('structure:broken', uid => { const G = LD.G, s = G && G.structures ? G.structures[uid] : null; onStruct(uid, true); if (s) { const r = layerRT(s.layer); if (r.active) r.losses++; } });
  E.on('chunk:excavated', p => markPathsDirty(p && typeof p.layer === 'number' ? p.layer : undefined));
  E.on('layer:unlocked', idx => { structDirty = true; layerRT(idx).targetsDirty = true; markPathsDirty(idx); });
}

/* ── public API ── */
const Defense = {
  WAVE_BASE, WARN_S, WAVE_MAX_S, MAX_ALIVE, damageMatrix, projectiles, externalPaths: false,
  init, tick, markPathsDirty, spawnWave, calcDamage,
  threat(L) { const G = LD.G; return G && G.layers[L] ? G.layers[L].threat || 0 : 0; },
  setThreat(L, v) { const G = LD.G; if (G && G.layers[L]) G.layers[L].threat = Math.max(0, +v || 0); },
  nextWave(L) {
    const G = LD.G; if (!G || !G.layers[L]) return null;
    const GL = G.layers[L], D = diff();
    if (!D.waves || !GL.unlocked || !(GL.waveAt > 0)) return null;
    const r = LR[L];
    return { at: GL.waveAt, in: Math.max(0, GL.waveAt - G.time.t), size: waveSize(L, GL.threat || 0, 1), no: (GL.waveNo | 0) + 1, boss: (GL.waveNo | 0) % 5 === 4, active: !!(r && r.active) };
  },
  waveState(L) { const r = LR[L]; return r && r.active ? { no: r.wno, since: LD.G ? LD.G.time.t - r.start : 0, kills: r.kills, losses: r.losses, pending: r.pending.length } : null; },
  enemiesIn(L) { return layerRT(L).list; },
  enemy(uid) { const c = cache.get(uid); return c && c.e.hp > 0 ? c.e : null; },
  enemyDef(e) { const c = cache.get(e.uid); return c ? c.def : Reg().enemy(e.id) || null; },
  turretTarget(uid) { const G = LD.G, s = G && G.structures[uid]; if (!s || !s._target) return null; const c = cache.get(s._target); return c && c.e.hp > 0 ? c.e : null; },
  turretsIn(L) { return layerRT(L).turrets; },
  isNight
};
LD.Sim = LD.Sim || {};
LD.Sim.Defense = Defense;
})();
