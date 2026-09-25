(() => {
'use strict';
const LD = window.LD, U = LD.U, E = LD.Events;
const Sim = LD.Sim = LD.Sim || {};

const TILE = 48;
const TREE_REGROW = 1 / 900, SEED_RATE = 1 / 1800, SEED_SAMPLES = 200, FOREST_REFRESH = 60;
const GATHER_CD = 1.2, CUT_MIN = 0.6, CUT_WOOD = 3, RESIN_P = 0.05, SAPLING_GROWTH = 0.05;
const TALLY_REFRESH = 30, RESCAN = 5, NO_POWER = 0.02;

/* Fallback parameters when the structure definition lacks a `nature` block (values from CANON §A). */
const DEFAULTS = {
  gather_hut:    { kind: 'gather', radius: 4, rate: 0.25 },
  woodcutter:    { kind: 'woodcutter', radius: 5, rate: 0.4 },
  hunting_lodge: { kind: 'hunt', radius: 6, out: { hide: 0.05, bone: 0.04, sinew: 0.03 } },
  well:          { kind: 'well', out: { water: 0.3 } },
  pump_hand:     { kind: 'pump', out: { water: 1.2 } },
  pump_electric: { kind: 'pump', out: { water: 8 } },
  planter:       { kind: 'planter', radius: 5, interval: 20, consumes: { water: 0.05 } },
  tree_farm:     { kind: 'farm', out: { wood_log: 0.5 }, consumes: { water: 0.1 } },
  fiber_farm:    { kind: 'farm', out: { plant_fiber: 0.4 }, consumes: { water: 0.08 } },
  bonsai:        { kind: 'farm', out: { wood_log: 0.15 }, consumes: { water: 0.05 } },
  bonsai_hydro:  { kind: 'farm', out: { wood_log: 0.6, resin: 0.06 }, consumes: { water: 0.15 } },
  algae_farm:    { kind: 'farm', out: { algae: 0.8 }, consumes: { water: 0.3 } },
  greenhouse:    { kind: 'farm', out: { plant_fiber: 0.6, rubber_sap: 0.2, sapling: 0.05 }, consumes: { water: 0.25 } },
  salt_works:    { kind: 'farm', out: { salt: 0.3 }, consumes: { water: 0.3 } }
};
const KIND_ALIAS = { gather: 'gather', gatherer: 'gather', gather_hut: 'gather', woodcutter: 'woodcutter', lumber: 'woodcutter', hunt: 'hunt', hunting: 'hunt', hunting_lodge: 'hunt', well: 'well', pump: 'pump', planter: 'planter', nursery: 'planter', farm: 'farm' };
const WILD_WEIGHT = { forest: 1, grass: 0.5, bog: 0.5, dirt: 0.25, gravel: 0.1 };

let curG = null, dirty = true, rescanAcc = 0, treeAcc = 0, seedAcc = 0, lastGather = -1e9, gatherAlt = false;
const list = [];                 // [{uid, def, cfg}]
const D = new Map();             // uid → derived per-structure scratch (never serialised)
const cfgCache = new Map();      // structure id → resolved config or null
let forestIdx = null, forestN = -1, forestAt = -1e9;

const Eco = () => Sim.Economy || null, Fl = () => Sim.Fluids || null;
const log = (text, kind) => { if (LD.State && LD.State.log) LD.State.log(text, kind); };
const toast = (text, kind) => E.emit('toast', { text, kind });
const sfx = name => { const A = LD.Audio; if (A && A.play) A.play(name); };
const itemName = id => LD.Registry.itemName(id);
const particles = (kind, L, x, y, n) => { const P = LD.Particles; if (P && P.emit && LD.G && LD.G.view.layer === L) P.emit(kind, (x + 0.5) * TILE, (y + 0.5) * TILE, { n, layer: L }); };

const markDirty = () => { dirty = true; };
E.on('structure:placed', markDirty); E.on('structure:built', markDirty);
E.on('structure:removed', uid => { dirty = true; D.delete(uid); });
E.on('game:new', markDirty); E.on('game:loaded', markDirty);

function cfgOf(def) {
  if (cfgCache.has(def.id)) return cfgCache.get(def.id);
  const base = DEFAULTS[def.id] || null, n = def.nature || null;
  let cfg = null;
  if (n || (base && !def.extract)) {
    cfg = Object.assign({}, base || {}, n || {});
    const k = (n && n.kind) || (base && base.kind) || null;
    cfg.kind = KIND_ALIAS[k] || (cfg.out ? 'farm' : (base ? base.kind : 'farm'));
    if (!cfg.out && base && base.out) cfg.out = base.out;
    if (!cfg.consumes && base && base.consumes) cfg.consumes = base.consumes;
    cfg.outKeys = Object.keys(cfg.out || {});
    cfg.consKeys = Object.keys(cfg.consumes || {});
    cfg.byKeys = Object.keys(cfg.byproducts || {});
    if (cfg.kind === 'well' || cfg.kind === 'pump') {   // Fluids joins a well to pipes only when nature.out names the fluid
      cfg.fluid = cfg.fluid || cfg.outKeys[0] || 'water';
      cfg.rate = cfg.rate || (cfg.out && cfg.out[cfg.fluid]) || 0.3;
    }
  }
  cfgCache.set(def.id, cfg);
  return cfg;
}

function rebuild() {
  const G = LD.G; list.length = 0; dirty = false; rescanAcc = 0;
  if (!G) return;
  for (const uid in G.structures) {
    const inst = G.structures[uid], def = LD.Registry.structures.get(inst.id); if (!def) continue;
    const cfg = cfgOf(def); if (cfg) list.push({ uid, def, cfg });
  }
}

function dOf(uid) {
  let d = D.get(uid);
  if (!d) { d = { prog: 0, carry: 0, acc: {}, cons: {}, items: [], weights: [], full: [], wTotal: 0, tallyAt: -1e9, wild: 0, retryAt: 0, tx: 0, ty: 0, sap: false }; D.set(uid, d); }
  return d;
}

/* ── inventory / fluid / power helpers (all guarded) ── */
function linked(uid) { const e = Eco(); return e && e.isLinked ? !!e.isLinked(uid) : true; }
function count(L, id) { const e = Eco(); if (e && e.count) return e.count(L, id); const inv = LD.G.inv[L]; return (inv && inv[id]) || 0; }
function cap(L, id) { const e = Eco(); if (e && e.cap) return e.cap(L, id); return (LD.G.caps && LD.G.caps.base) || 200; }
function add(L, id, n) {
  const e = Eco(); if (e && e.add) return e.add(L, id, n);
  const G = LD.G, inv = G.inv[L] || (G.inv[L] = {}), k = Math.min(n, Math.max(0, cap(L, id) - (inv[id] || 0)));
  if (k > 0) { inv[id] = (inv[id] || 0) + k; E.emit('inv:changed', { layer: L, item: id }); }
  return k;
}
function takeOne(L, id) {
  const e = Eco(); if (e && e.take) { const o = {}; o[id] = 1; return !!e.take(L, o); }
  const inv = LD.G.inv[L]; if (!inv || !(inv[id] >= 1)) return false;
  inv[id] -= 1; if (inv[id] <= 0) delete inv[id]; E.emit('inv:changed', { layer: L, item: id }); return true;
}
function isFluid(id) { const F = Fl(); if (F && F.isFluid) return F.isFluid(id); const it = LD.Registry.items.get(id); return !!it && (it.cat === 'fluid' || it.cat === 'gas'); }
function fluidAvail(uid, f) { const F = Fl(); return F && F.available ? F.available(uid, f) : 0; }
function fluidSpace(uid, f) { const F = Fl(); return F && F.space ? F.space(uid, f) : 0; }
function fluidTake(uid, f, n) { const F = Fl(); return F && F.take ? F.take(uid, f, n) : 0; }
function fluidGive(uid, f, n) { const F = Fl(); return F && F.give ? F.give(uid, f, n) : 0; }
function powerRatio(inst) {
  if (typeof inst._powerRatio === 'number') return U.clamp(inst._powerRatio);
  const P = Sim.Power; if (!P || !P.gridOf) return 1;
  const g = P.gridOf(inst.uid); if (!g) return 0;
  return g.ratio == null ? 1 : U.clamp(g.ratio);
}
/* Base demand for this tick (Power applies the 2^oc overclock factor itself): `inst._wantPower`, plus Power.setDemand when present. */
function setDemand(inst, w) { inst._wantPower = w; const P = Sim.Power; if (P && typeof P.setDemand === 'function') P.setDemand(inst.uid, w); }
function integrityMul(inst, def) {
  const B = Sim.Build; if (B && B.integrityMul) return B.integrityMul(inst);
  const max = def.hp || 1, i = U.clamp((inst.hp == null ? max : inst.hp) / max);
  return i < 0.3 ? Math.max(0.1, 1 - 0.03 * (30 - i * 100)) : 1;
}
function hubMul(L) { const e = Eco(); return e && e.hubMul ? e.hubMul(L) : 1; }
const baseSpeed = (inst, def) => (def.speed || 1) * Math.pow(1.5, inst.oc | 0) * integrityMul(inst, def) * hubMul(inst.layer);
function block(inst, def, st) { inst.state = st; if (def.power && def.power.use) setDemand(inst, 0); return 0; }
/* Registers the demand and returns the grid ratio (consumers demand only while trying to work). */
function powered(inst, def) {
  if (!(def.power && def.power.use)) return 1;
  setDemand(inst, def.power.use);
  return powerRatio(inst);
}
function multipliers(L) { const Ev = Sim.Events; return Ev && Ev.multipliers ? Ev.multipliers(L) : null; }

/* ── terrain helpers ── */
const terrainAt = (L, x, y) => { const W = LD.World; return W && W.terrainAt ? W.terrainAt(L, x, y) : null; };
const terrainDefOf = tid => LD.Registry.terrain(tid) || (LD.World && LD.World.terrainInfo ? LD.World.terrainInfo(tid) : null);
function occupied(L, x, y) {
  const W = LD.World; if (!W) return false;
  if (W.uidAt && W.uidAt(L, x, y) != null) return true;
  if (W.cableAt && W.cableAt(L, x, y) != null) return true;
  if (W.pipeAt && W.pipeAt(L, x, y) != null) return true;
  return false;
}
function tileFree(L, x, y) { const W = LD.World; if (occupied(L, x, y)) return false; return !(W && W.depositAt && W.depositAt(L, x, y)); }
function growthAt(x, y) { const tr = LD.G.layers[0].trees, g = tr && tr[x + ',' + y]; return g === undefined ? 1 : g; }
function forestNeighbours(x, y) {
  let k = 0;
  if (terrainAt(0, x + 1, y) === 'forest') k++;
  if (terrainAt(0, x - 1, y) === 'forest') k++;
  if (terrainAt(0, x, y + 1) === 'forest') k++;
  if (terrainAt(0, x, y - 1) === 'forest') k++;
  return k;
}
function setGrowth(x, y, growth) {
  const G = LD.G, W = LD.World;
  if (W && W.setTree && W.setTree(0, x, y, growth)) return;
  const trees = G.layers[0].trees || (G.layers[0].trees = {}), key = x + ',' + y;
  if (growth >= 1) delete trees[key]; else trees[key] = Math.max(0, growth);
  if (LD.Tex && LD.Tex.invalidate) LD.Tex.invalidate(0, x, y);
}
function plant(x, y, growth) {
  const W = LD.World; if (!W || !W.setTerrain) return false;
  W.setTerrain(0, x, y, 'forest');
  setGrowth(x, y, growth);
  const WL = W.layers && W.layers[0];
  if (forestIdx && WL && forestN >= 0 && forestN < forestIdx.length) forestIdx[forestN++] = y * WL.w + x;
  const Df = Sim.Defense; if (Df && Df.markPathsDirty) Df.markPathsDirty(0);
  return true;
}

/* ── trees: regrowth and natural seeding (surface only) ── */
function growTrees(elapsed) {
  const G = LD.G, trees = G.layers[0] && G.layers[0].trees; if (!trees) return;
  const Tex = LD.Tex, inc = TREE_REGROW * elapsed;
  for (const key in trees) {
    const g = +trees[key];
    if (!(g < 1)) { delete trees[key]; continue; }
    const ng = g + inc;
    if (ng >= 1) delete trees[key]; else trees[key] = ng;
    if (((g * 4) | 0) !== ((ng * 4) | 0) || ng >= 1) { if (Tex && Tex.invalidate) { const c = key.indexOf(','); Tex.invalidate(0, +key.slice(0, c), +key.slice(c + 1)); } }
  }
}
function refreshForest(t) {
  const W = LD.World, WL = W && W.layers && W.layers[0]; forestAt = t; forestN = 0;
  if (!WL || !WL.w) return;
  const w = WL.w, h = WL.h;
  if (!forestIdx || forestIdx.length < w * h) forestIdx = new Int32Array(w * h);
  let n = 0;
  const code = WL.terrain && WL.tIds ? WL.tIds.indexOf('forest') : -1;
  if (code >= 0) { const terr = WL.terrain; for (let i = 0, len = w * h; i < len; i++) if (terr[i] === code) forestIdx[n++] = i; }
  else if (W.terrainAt) { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (W.terrainAt(0, x, y) === 'forest') forestIdx[n++] = y * w + x; }
  forestN = n;
}
/* Sampling 200 forest tiles/s and pushing into a random neighbour gives each qualifying grass tile
   (k ≥ 2 forest neighbours) a chance of k·n/(4F)·p per second; p is chosen so that this equals SEED_RATE. */
function seedForest(elapsed) {
  const G = LD.G, W = LD.World; if (!W || !W.terrainAt || !W.setTerrain) return;
  const t = G.time.t;
  if (forestN < 0 || t - forestAt >= FOREST_REFRESH) refreshForest(t);
  const F = forestN; if (!F) return;
  const WL = W.layers[0], w = WL.w, h = WL.h, n = Math.min(SEED_SAMPLES, F);
  for (let i = 0; i < n; i++) {
    const idx = forestIdx[(Math.random() * F) | 0], x = idx % w, y = (idx / w) | 0, dir = (Math.random() * 4) | 0;
    const nx = x + (dir === 0 ? 1 : dir === 1 ? -1 : 0), ny = y + (dir === 2 ? 1 : dir === 3 ? -1 : 0);
    if (nx < 0 || ny < 0 || nx >= w || ny >= h || W.terrainAt(0, nx, ny) !== 'grass') continue;
    const k = forestNeighbours(nx, ny); if (k < 2) continue;
    if (Math.random() >= SEED_RATE * elapsed * 4 * F / (k * n)) continue;
    if (tileFree(0, nx, ny)) plant(nx, ny, SAPLING_GROWTH);
  }
}

/* ── per-kind structure logic ── */
function tickWell(inst, def, cfg, dt) {
  const F = Fl(); if (!F || !F.networkOf) return block(inst, def, 'idle');
  const net = F.networkOf(inst.uid);
  if (!net || !net.tanks || !net.tanks.length) return block(inst, def, 'no_link');
  const fluid = cfg.fluid;
  if (fluidSpace(inst.uid, fluid) <= 0) return block(inst, def, 'output_full');
  const ratio = powered(inst, def); if (ratio < NO_POWER) { inst.state = 'no_power'; return; }
  const m = multipliers(inst.layer), d = dOf(inst.uid);
  const want = cfg.rate * (m ? m.pump : 1) * baseSpeed(inst, def) * ratio * dt + d.carry;
  const given = want > 0 ? fluidGive(inst.uid, fluid, want) : 0;
  d.carry = Math.min(1, want - given);
  inst.state = given > 0 ? 'working' : 'output_full';
}

function tallyGather(inst, def, cfg, d, t) {
  const L = inst.layer, size = def.size || 1, r = cfg.radius || 4, R = LD.Registry;
  const cx = inst.x + (size - 1) / 2, cy = inst.y + (size - 1) / 2, rr = r + (size - 1) / 2;
  d.items.length = 0; d.weights.length = 0; d.full.length = 0; d.wTotal = 0; d.tallyAt = t;
  const addW = (id, w) => { const i = d.items.indexOf(id); if (i >= 0) d.weights[i] += w; else { d.items.push(id); d.weights.push(w); d.full.push(false); } d.wTotal += w; };
  for (let y = inst.y - r; y <= inst.y + size - 1 + r; y++) for (let x = inst.x - r; x <= inst.x + size - 1 + r; x++) {
    const dx = x - cx, dy = y - cy; if (dx * dx + dy * dy > rr * rr) continue;
    const tid = terrainAt(L, x, y); if (!tid || occupied(L, x, y)) continue;
    const tdef = terrainDefOf(tid);
    if (tdef && tdef.natural && tdef.natural.item && R.items.has(tdef.natural.item)) addW(tdef.natural.item, tdef.natural.rate || 1);
    if (tid === 'forest' && R.items.has('stick')) addW('stick', 0.6);
    if (tid === 'rock' && R.items.has('flint')) addW('flint', 0.25);
  }
}
function tickGather(inst, def, cfg, dt, t) {
  if (!linked(inst.uid)) return block(inst, def, 'no_link');
  const d = dOf(inst.uid), L = inst.layer;
  if (t - d.tallyAt >= TALLY_REFRESH) tallyGather(inst, def, cfg, d, t);
  if (!d.wTotal) return block(inst, def, 'no_input');
  let room = 0;
  for (let i = 0; i < d.items.length; i++) { d.full[i] = count(L, d.items[i]) >= cap(L, d.items[i]); if (!d.full[i]) room += d.weights[i]; }
  if (!room) return block(inst, def, 'output_full');
  const ratio = powered(inst, def); if (ratio < NO_POWER) { inst.state = 'no_power'; return; }
  d.prog += (cfg.rate || 0.25) * baseSpeed(inst, def) * ratio * dt;
  if (d.prog >= 1) {
    d.prog -= 1;
    let r = Math.random() * room, pick = -1;
    for (let i = 0; i < d.items.length; i++) { if (d.full[i]) continue; pick = i; r -= d.weights[i]; if (r <= 0) break; }
    if (pick >= 0 && add(L, d.items[pick], 1) && inst.stats) inst.stats.made = (inst.stats.made || 0) + 1;
  }
  inst.progress = d.prog; inst.state = 'working';
}

function nearestTree(inst, def, cfg, d) {
  if (inst.layer !== 0) return false;
  const size = def.size || 1, r = cfg.radius || 5;
  const cx = inst.x + (size - 1) / 2, cy = inst.y + (size - 1) / 2, rr = r + (size - 1) / 2;
  let best = Infinity;
  for (let y = inst.y - r; y <= inst.y + size - 1 + r; y++) for (let x = inst.x - r; x <= inst.x + size - 1 + r; x++) {
    const dx = x - cx, dy = y - cy, dd = dx * dx + dy * dy;
    if (dd > rr * rr || dd >= best || terrainAt(0, x, y) !== 'forest' || growthAt(x, y) < CUT_MIN || occupied(0, x, y)) continue;
    best = dd; d.tx = x; d.ty = y;
  }
  return best < Infinity;
}
function tickWoodcutter(inst, def, cfg, dt, t) {
  if (!linked(inst.uid)) return block(inst, def, 'no_link');
  const d = dOf(inst.uid), L = inst.layer;
  if (count(L, 'wood_log') + CUT_WOOD > cap(L, 'wood_log')) return block(inst, def, 'output_full');
  if (d.prog >= 1) {
    if (t < d.retryAt) return block(inst, def, 'no_input');
    if (!nearestTree(inst, def, cfg, d)) { d.retryAt = t + 2; return block(inst, def, 'no_input'); }
  }
  const ratio = powered(inst, def); if (ratio < NO_POWER) { inst.state = 'no_power'; return; }
  if (d.prog >= 1) {
    const res = Nature.cutTree(L, d.tx, d.ty);
    if (!res) { d.retryAt = t + 2; return block(inst, def, 'no_input'); }
    d.prog -= 1;
    if (inst.stats) inst.stats.made = (inst.stats.made || 0) + res.n;
  }
  d.prog = Math.min(1, d.prog + (cfg.rate || 0.4) * baseSpeed(inst, def) * ratio * dt);
  inst.progress = d.prog; inst.state = 'working';
}

/* Generic producer: `out` items/fluids per second, `consumes` fluids/items per second, `byproducts` chance per unit. */
function runFarm(inst, def, cfg, d, dt, eff) {
  const L = inst.layer, uid = inst.uid, outs = cfg.outKeys;
  if (!outs.length) return block(inst, def, 'idle');
  const main = outs[0];
  if (isFluid(main) ? fluidSpace(uid, main) <= 0 : count(L, main) >= cap(L, main)) return block(inst, def, 'output_full');
  const base = baseSpeed(inst, def) * eff, cons = cfg.consKeys;
  for (let i = 0; i < cons.length; i++) {
    const f = cons[i], need = cfg.consumes[f] * base * dt;
    if (isFluid(f)) { if (fluidAvail(uid, f) < need) return block(inst, def, 'no_fluid'); }
    else if ((d.cons[f] || 0) + need >= 1 && count(L, f) < 1) return block(inst, def, 'no_input');
  }
  const ratio = powered(inst, def); if (ratio < NO_POWER) { inst.state = 'no_power'; return; }
  const spd = base * ratio; let frac = 1;
  for (let i = 0; i < cons.length; i++) {
    const f = cons[i], need = cfg.consumes[f] * spd * dt;
    if (isFluid(f)) { const got = fluidTake(uid, f, need); if (need > 0) frac = Math.min(frac, got / need); }
    else { d.cons[f] = (d.cons[f] || 0) + need; if (d.cons[f] >= 1) { if (takeOne(L, f)) d.cons[f] -= 1; else { d.cons[f] = 1; frac = 0; } } }
  }
  let mainMade = 0;
  for (let i = 0; i < outs.length; i++) {
    const id = outs[i], amt = cfg.out[id] * spd * dt * frac;
    if (isFluid(id)) { const want = amt + (d.acc[id] || 0), given = want > 0 ? fluidGive(uid, id, want) : 0; d.acc[id] = Math.min(2, want - given); if (i === 0) mainMade = given; continue; }
    let a = (d.acc[id] || 0) + amt;
    if (a >= 1) { const n = a | 0, added = add(L, id, n); a -= added; if (a > 3) a = 3; if (i === 0) mainMade = added; }
    d.acc[id] = a;
  }
  if (mainMade > 0) {
    if (inst.stats) inst.stats.made = (inst.stats.made || 0) + mainMade;
    const by = cfg.byKeys;
    for (let i = 0; i < by.length; i++) { const p = cfg.byproducts[by[i]] * mainMade; if (p > 0 && Math.random() < p) add(L, by[i], 1); }
  }
  inst.progress = isFluid(main) ? 1 : U.clamp(d.acc[main] || 0); inst.state = 'working';
}
function tickFarm(inst, def, cfg, dt) {
  if (!linked(inst.uid)) return block(inst, def, 'no_link');
  runFarm(inst, def, cfg, dOf(inst.uid), dt, 1);
}
function tickHunt(inst, def, cfg, dt, t) {
  if (!linked(inst.uid)) return block(inst, def, 'no_link');
  const d = dOf(inst.uid);
  if (t - d.tallyAt >= TALLY_REFRESH) {
    const L = inst.layer, size = def.size || 1, r = cfg.radius || 6;
    const cx = inst.x + (size - 1) / 2, cy = inst.y + (size - 1) / 2, rr = r + (size - 1) / 2;
    let wild = 0;
    for (let y = inst.y - r; y <= inst.y + size - 1 + r; y++) for (let x = inst.x - r; x <= inst.x + size - 1 + r; x++) {
      const dx = x - cx, dy = y - cy; if (dx * dx + dy * dy > rr * rr) continue;
      const w = WILD_WEIGHT[terrainAt(L, x, y)]; if (w && !occupied(L, x, y)) wild += w;
    }
    d.wild = Math.min(1, wild / 24); d.tallyAt = t;
  }
  if (!d.wild) return block(inst, def, 'no_input');
  runFarm(inst, def, cfg, d, dt, d.wild);
}

/* Reservoir-samples a free grass tile in range, preferring tiles that touch a forest tile. */
function findPlantTile(inst, def, cfg, d) {
  const size = def.size || 1, r = cfg.radius || 5;
  const cx = inst.x + (size - 1) / 2, cy = inst.y + (size - 1) / 2, rr = r + (size - 1) / 2;
  let nAdj = 0, nAny = 0, ax = 0, ay = 0, bx = 0, by = 0;
  for (let y = inst.y - r; y <= inst.y + size - 1 + r; y++) for (let x = inst.x - r; x <= inst.x + size - 1 + r; x++) {
    const dx = x - cx, dy = y - cy; if (dx * dx + dy * dy > rr * rr) continue;
    if (terrainAt(0, x, y) !== 'grass' || !tileFree(0, x, y)) continue;
    if (forestNeighbours(x, y) > 0) { nAdj++; if (Math.random() * nAdj < 1) { ax = x; ay = y; } }
    else { nAny++; if (Math.random() * nAny < 1) { bx = x; by = y; } }
  }
  if (nAdj) { d.tx = ax; d.ty = ay; return true; }
  if (nAny) { d.tx = bx; d.ty = by; return true; }
  return false;
}
function tickPlanter(inst, def, cfg, dt, t) {
  if (inst.layer !== 0) return block(inst, def, 'idle');
  if (!linked(inst.uid)) return block(inst, def, 'no_link');
  const d = dOf(inst.uid), uid = inst.uid, base = baseSpeed(inst, def), cons = cfg.consKeys;
  for (let i = 0; i < cons.length; i++) { const f = cons[i]; if (isFluid(f) && fluidAvail(uid, f) < cfg.consumes[f] * base * dt) return block(inst, def, 'no_fluid'); }
  if (d.prog >= 1) {
    if (t < d.retryAt) return block(inst, def, 'idle');
    if (!findPlantTile(inst, def, cfg, d)) { d.retryAt = t + 5; return block(inst, def, 'idle'); }
    if (d.sap) takeOne(0, 'sapling');
    plant(d.tx, d.ty, SAPLING_GROWTH);
    particles('dust', 0, d.tx, d.ty, 4);
    if (inst.stats) inst.stats.made = (inst.stats.made || 0) + 1;
    d.prog = 0;
  }
  const ratio = powered(inst, def); if (ratio < NO_POWER) { inst.state = 'no_power'; return; }
  const spd = base * ratio; let frac = 1;
  for (let i = 0; i < cons.length; i++) { const f = cons[i]; if (!isFluid(f)) continue; const need = cfg.consumes[f] * spd * dt, got = fluidTake(uid, f, need); if (need > 0) frac = Math.min(frac, got / need); }
  if (d.prog === 0) d.sap = count(0, 'sapling') >= 1;   // decided per cycle: a sapling makes the cycle 30 % faster
  d.prog = Math.min(1, d.prog + spd * frac * dt * (d.sap ? 1 : 0.7) / (cfg.interval || 20));
  inst.progress = d.prog; inst.state = 'working';
}

function tickStructure(inst, def, cfg, dt, t) {
  if (inst.paused) { if (inst.state !== 'paused') block(inst, def, 'paused'); return; }
  if (inst.state === 'broken') return;
  switch (cfg.kind) {
    case 'well': case 'pump': return tickWell(inst, def, cfg, dt);
    case 'gather': return tickGather(inst, def, cfg, dt, t);
    case 'woodcutter': return tickWoodcutter(inst, def, cfg, dt, t);
    case 'hunt': return tickHunt(inst, def, cfg, dt, t);
    case 'planter': return tickPlanter(inst, def, cfg, dt, t);
    default: return tickFarm(inst, def, cfg, dt);
  }
}

const Nature = Sim.Nature = {
  GATHER_CD, TREE_REGROW, CUT_MIN,

  tick(dt) {
    const G = LD.G; if (!G) return;
    if (G !== curG) { curG = G; dirty = true; D.clear(); forestN = -1; treeAcc = seedAcc = 0; lastGather = -1e9; }
    const t = G.time.t;
    treeAcc += dt; if (treeAcc >= 1) { growTrees(treeAcc); treeAcc = 0; }
    seedAcc += dt; if (seedAcc >= 1) { seedForest(seedAcc); seedAcc = 0; }
    rescanAcc += dt; if (dirty || rescanAcc >= RESCAN) rebuild();
    for (let i = 0; i < list.length; i++) {
      const it = list[i], inst = G.structures[it.uid];
      if (!inst) { dirty = true; continue; }
      if (inst.build) continue;
      tickStructure(inst, it.def, it.cfg, dt, t);
    }
  },

  /* Non-mutating probe used by gather() and available to the UI: { ok, item, n, bonus, bonusP, reason, text } */
  gatherInfo(L, x, y) {
    const G = LD.G, W = LD.World;
    const out = { ok: false, item: null, n: 0, bonus: null, bonusP: 0, reason: null, text: null };
    if (!G || !W || !W.terrainAt) { out.reason = 'unavailable'; return out; }
    if (L !== 0) { out.reason = 'layer'; out.text = 'La recolección manual solo es posible en la superficie'; return out; }
    const tid = W.terrainAt(0, x, y); if (!tid) { out.reason = 'bounds'; return out; }
    if (W.uidAt && W.uidAt(0, x, y) != null) { out.reason = 'occupied'; out.text = 'Hay una estructura en esta casilla'; return out; }
    if (Nature.gatherCooldown() > 0) { out.reason = 'cooldown'; out.text = 'Espera ' + U.fmt(Nature.gatherCooldown(), 1) + ' s'; return out; }
    switch (tid) {
      case 'forest':
        if (growthAt(x, y) < 0.3) { out.reason = 'young'; out.text = 'Este árbol aún es demasiado joven'; return out; }
        if (gatherAlt) { out.item = 'stick'; out.n = 2; } else { out.item = 'wood_log'; out.n = 1; }
        break;
      case 'rock': out.item = 'stone'; out.n = 1; out.bonus = 'flint'; out.bonusP = 0.35; break;
      case 'water': case 'cave_water': case 'deep_water': out.reason = 'water'; out.text = 'Necesitas un pozo o una bomba para extraer agua'; return out;
      default: { const tdef = terrainDefOf(tid); const it = tdef && tdef.natural && tdef.natural.item; if (!it) { out.reason = 'nothing'; out.text = 'Aquí no hay nada que recolectar'; return out; } out.item = it; out.n = 1; }
    }
    if (W.depositAt) { const dp = W.depositAt(0, x, y); if (dp && !dp.fluid && (dp.hardness | 0) === 0 && dp.amt !== 0 && LD.Registry.items.has(dp.res)) { out.item = dp.res; out.n = 1; out.bonus = null; out.deposit = dp; } }
    if (!LD.Registry.items.has(out.item)) { out.reason = 'nothing'; out.text = 'Aquí no hay nada que recolectar'; out.item = null; return out; }
    if (count(0, out.item) >= cap(0, out.item)) { out.reason = 'full'; out.text = 'Almacén lleno: ' + itemName(out.item); return out; }
    out.ok = true;
    return out;
  },

  gather(L, x, y) {
    const info = Nature.gatherInfo(L, x, y);
    if (!info.ok) return null;
    const G = LD.G, W = LD.World, item = info.item;
    const added = add(0, item, info.n); if (!added) return null;
    const extra = info.bonus && LD.Registry.items.has(info.bonus) && Math.random() < info.bonusP && add(0, info.bonus, 1) ? info.bonus : null;
    if (item === 'stick' || item === 'wood_log') gatherAlt = !gatherAlt;
    const dep = info.deposit;
    if (dep && dep.amt > 0) { dep.amt -= 1; if (dep.amt <= 0) { if (W.removeDeposit) W.removeDeposit(0, x, y); else { delete G.layers[0].deposits[x + ',' + y]; if (LD.Tex && LD.Tex.invalidate) LD.Tex.invalidate(0, x, y); } } }
    lastGather = G.time.t;
    sfx('gather');
    particles('dust', 0, x, y, 3);
    return { item, n: added, extra };
  },

  gatherCooldown() { const G = LD.G; if (!G) return 0; return Math.max(0, GATHER_CD - (G.time.t - lastGather)); },

  cutTree(L, x, y) {
    const G = LD.G, W = LD.World; if (!G || !W || !W.terrainAt || L !== 0) return null;
    if (W.terrainAt(0, x, y) !== 'forest') return null;
    if (growthAt(x, y) < CUT_MIN) return null;
    if (count(0, 'wood_log') + CUT_WOOD > cap(0, 'wood_log')) return null;
    const n = add(0, 'wood_log', CUT_WOOD);
    const resin = Math.random() < RESIN_P ? add(0, 'resin', 1) : 0;
    setGrowth(x, y, 0);
    particles('dust', 0, x, y, 6);
    return { item: 'wood_log', n, resin };
  },

  treeGrowth(x, y) { const G = LD.G; return G && terrainAt(0, x, y) === 'forest' ? growthAt(x, y) : null; },
  forestCount() { return Math.max(0, forestN); },

  daylight() {
    const G = LD.G; if (!G) return 1;
    return U.smooth(0.5 + 0.5 * Math.cos(2 * Math.PI * ((G.time.dayFrac || 0) - 0.3)));
  },
  isNight() { const G = LD.G; if (!G) return false; const f = G.time.dayFrac || 0; return f >= 0.55 && f < 1; }
};
})();
