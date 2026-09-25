(() => {
'use strict';
const LD = window.LD, U = LD.U, E = LD.Events;
LD.Sim = LD.Sim || {};

const NL = 5, WINDOW = 5, RING = 50;
const DEFAULT_RULES = () => [{ item: '*', mode: 'up', keep: 0 }];

/* runtime (non-serialised) per-structure data */
const rt = new Map();
const rtOf = uid => { let r = rt.get(uid); if (!r) { r = { tp: 0, tpT: -1, acc: null, fin: null, fout: null, dep: null, depDirty: true, bud: 0, lastMove: -1, fuelItem: null, fx: 0 }; rt.set(uid, r); } return r; };

/* per-layer caches */
const nets = [], capCache = new Float64Array(NL).fill(-1), byLayer = [], changed = [], ring = [], rates = [];
let ringIdx = 0, inTick = false, capClock = 0, listening = false, listsDirty = true, G = null;
for (let L = 0; L < NL; L++) {
  nets.push({ linked: new Map(), sources: [] });
  byLayer.push([]); changed.push(new Set()); rates.push({});
  const slots = []; for (let i = 0; i < RING; i++) slots.push({ plus: new Map(), minus: new Map() });
  ring.push(slots);
}

const R = () => LD.Registry;
const World = () => LD.World;
const Fluids = () => LD.Sim.Fluids;
const Power = () => LD.Sim.Power;
const Build = () => LD.Sim.Build;
const defOf = inst => R().structure(inst.id);
const isFluid = id => { const F = Fluids(); if (F && F.isFluid) return F.isFluid(id); const it = R().item(id); return !!it && (it.cat === 'fluid' || it.cat === 'gas'); };
const layerDef = L => R().layer(L) || {};
const now = () => G ? G.time.t : 0;

/* ── rates (rolling 5 s ring) ── */
const rateRec = (L, id) => { const o = rates[L]; let r = o[id]; if (!r) r = o[id] = { plus: 0, minus: 0 }; return r; };
function record(L, id, delta) {
  if (!delta) return;
  const slot = ring[L][ringIdx], r = rateRec(L, id);
  if (delta > 0) { slot.plus.set(id, (slot.plus.get(id) || 0) + delta); r.plus += delta / WINDOW; }
  else { slot.minus.set(id, (slot.minus.get(id) || 0) - delta); r.minus += -delta / WINDOW; }
  const S = LD.Sim.Stats; if (S && S.record) S.record(L, id, delta);
}
function expireSlot(L, idx) {
  const slot = ring[L][idx];
  if (slot.plus.size) { for (const [id, v] of slot.plus) { const r = rateRec(L, id); r.plus -= v / WINDOW; if (r.plus < 1e-6) r.plus = 0; } slot.plus.clear(); }
  if (slot.minus.size) { for (const [id, v] of slot.minus) { const r = rateRec(L, id); r.minus -= v / WINDOW; if (r.minus < 1e-6) r.minus = 0; } slot.minus.clear(); }
}

/* ── inventory ── */
function markChanged(L, id) {
  if (inTick) { changed[L].add(id); return; }
  E.emit('inv:changed', { layer: L, item: id, items: new Set([id]) });
}
function flushChanged() {
  for (let L = 0; L < NL; L++) {
    const set = changed[L];
    if (!set.size) continue;
    const items = new Set(set); set.clear();
    E.emit('inv:changed', { layer: L, item: items.size === 1 ? items.values().next().value : null, items });
  }
}
function discover(id) {
  if (!G || !id) return;
  const d = G.discovered.items;
  if (d[id]) return;
  if (!R().item(id)) return;
  d[id] = true;
  E.emit('item:discovered', id);
}
function computeCap(L) {
  let cap = (G.caps && G.caps.base) || 200;
  const list = byLayer[L];
  for (let i = 0; i < list.length; i++) {
    const inst = list[i];
    if (inst.build || inst.state === 'broken' || inst.hp <= 0) continue;
    const def = defOf(inst);
    if (def && def.storage && def.storage.cap > 0) cap += def.storage.cap;
  }
  return cap;
}
function collectStructures(force) {
  if (!listsDirty && !force) return;
  listsDirty = false;
  for (let L = 0; L < NL; L++) byLayer[L].length = 0;
  const S = G.structures;
  for (const uid in S) { const inst = S[uid]; const L = inst.layer | 0; if (L >= 0 && L < NL) byLayer[L].push(inst); }
}
function cap(L, id) {
  if (!G) return 0;
  if (capCache[L] < 0) { if (!inTick) collectStructures(); capCache[L] = computeCap(L); }
  return capCache[L];
}
function count(L, id) { const inv = G && G.inv[L]; return inv ? (inv[id] || 0) : 0; }
function room(L, id) { return Math.max(0, cap(L, id) - count(L, id)); }
function addRaw(L, id, n, ignoreCap) {
  if (!G || !(n > 0) || isFluid(id)) return 0;
  const inv = G.inv[L]; if (!inv) return 0;
  const have = inv[id] || 0;
  const added = ignoreCap ? n : Math.min(n, Math.max(0, cap(L, id) - have));
  if (added <= 0) return 0;
  inv[id] = have + added;
  record(L, id, added);
  markChanged(L, id);
  if (!G.discovered.items[id]) discover(id);
  return added;
}
function add(L, id, n) { return addRaw(L, id, n, false); }
function qty(n, mul) { return mul === 1 ? n : Math.ceil(n * mul - 1e-9); }
function has(L, items, mul = 1) {
  if (!G || !items) return false;
  const inv = G.inv[L]; if (!inv) return false;
  for (const id in items) { if (isFluid(id)) continue; if ((inv[id] || 0) < qty(items[id], mul)) return false; }
  return true;
}
function take(L, items, mul = 1) {
  if (!has(L, items, mul)) return false;
  const inv = G.inv[L];
  for (const id in items) {
    if (isFluid(id)) continue;
    const n = qty(items[id], mul); if (n <= 0) continue;
    inv[id] -= n; if (inv[id] <= 0) delete inv[id];
    record(L, id, -n); markChanged(L, id);
  }
  return true;
}
function addMany(L, items, mul = 1) {
  let all = true;
  for (const id in items) { const n = qty(items[id], mul); if (n > 0 && add(L, id, n) < n) all = false; }
  return all;
}
function invalidateCaps(L) { if (L === undefined) capCache.fill(-1); else capCache[L] = -1; }

/* ── link networks (conveyor BFS from hub / elevators) ── */
let visited = null, queue = null;
function gridUid(W, L, x, y) {
  const lay = W.layers && W.layers[L];
  if (lay && lay.occ && W.occRef) { const i = lay.occ[y * lay.w + x]; return i >= 0 ? W.occRef[i] : null; }
  return W.uidAt(L, x, y);
}
function footprint(inst, def) { const s = (def && def.size) || 1; return { x: inst.x, y: inst.y, w: s, h: s }; }
function isSource(def, L) { return !!def && (def.id === 'hub' || !!def.elevator || (L === 0 && !!def.shaft)); }
function rebuildLayer(L) {
  const W = World(), lay = W && W.layers && W.layers[L], net = nets[L];
  net.linked.clear(); net.sources.length = 0;
  capCache[L] = -1;
  const list = byLayer[L];
  for (let i = 0; i < list.length; i++) { const r = rt.get(list[i].uid); if (r) { r.dep = null; r.depDirty = true; } }
  if (!lay) return;
  const w = lay.w, h = lay.h, n = w * h;
  if (!visited || visited.length < n) { visited = new Uint8Array(n); queue = new Int32Array(n); } else visited.fill(0, 0, n);
  const S = G.structures;
  let qh = 0, qt = 0;
  const link = (uid, rate) => { const cur = net.linked.get(uid); if (cur === undefined || rate > cur) net.linked.set(uid, rate); };
  const touch = (x, y, rate) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const uid = gridUid(W, L, x, y); if (!uid) return;
    const inst = S[uid]; if (!inst) return;
    const def = defOf(inst);
    if (def && def.conveyor) {
      const i = y * w + x;
      if (visited[i]) return;
      visited[i] = 1; queue[qt++] = i;
      link(uid, def.conveyor.rate || 1);
    } else link(uid, rate);
  };
  for (let i = 0; i < list.length; i++) {
    const inst = list[i], def = defOf(inst);
    if (!isSource(def, L)) continue;
    net.sources.push(inst.uid); link(inst.uid, Infinity);
    const f = footprint(inst, def);
    for (let dx = 0; dx < f.w; dx++) { touch(f.x + dx, f.y - 1, Infinity); touch(f.x + dx, f.y + f.h, Infinity); }
    for (let dy = 0; dy < f.h; dy++) { touch(f.x - 1, f.y + dy, Infinity); touch(f.x + f.w, f.y + dy, Infinity); }
  }
  while (qh < qt) {
    const i = queue[qh++], x = i % w, y = (i - x) / w;
    const uid = gridUid(W, L, x, y), inst = uid && S[uid], def = inst && defOf(inst);
    const rate = (def && def.conveyor && def.conveyor.rate) || 1;
    touch(x + 1, y, rate); touch(x - 1, y, rate); touch(x, y + 1, rate); touch(x, y - 1, rate);
  }
}
function rebuildNetworks(L) {
  if (!G) return;
  collectStructures(true);
  for (const uid of rt.keys()) if (!G.structures[uid]) rt.delete(uid);
  const layers = L === undefined ? [0, 1, 2, 3, 4] : [L | 0];
  for (const l of layers) {
    rebuildLayer(l);
    const P = Power(); if (P && P.rebuild) { try { P.rebuild(l); } catch (e) { console.error('[Economy] Power.rebuild', e); } }
    const F = Fluids(); if (F && F.rebuild) { try { F.rebuild(l); } catch (e) { console.error('[Economy] Fluids.rebuild', e); } }
  }
}
function linkRate(uid) { const inst = G && G.structures[uid]; if (!inst) return 0; const v = nets[inst.layer].linked.get(uid); return v === undefined ? 0 : v; }
function isLinked(uid) { return linkRate(uid) > 0; }

/* ── hub / integrity / speed ── */
function integrity(inst) {
  const B = Build(); if (B && B.integrity) return B.integrity(inst);
  const def = defOf(inst); const max = (def && def.hp) || 1; return U.clamp(inst.hp / max, 0, 1);
}
function integrityMul(inst) {
  const B = Build(); if (B && B.integrityMul) return B.integrityMul(inst);
  const i = integrity(inst); return i < 0.3 ? Math.max(0.1, 1 - 0.03 * (30 - i * 100)) : 1;
}
function hubInst(L) {
  if (!G) return null;
  if (L === 0) { const list = byLayer[0]; for (let i = 0; i < list.length; i++) if (list[i].id === 'hub') return list[i]; return null; }
  const lay = G.layers[L], uid = lay && lay.elevator;
  if (uid && G.structures[uid]) return G.structures[uid];
  const list = byLayer[L]; for (let i = 0; i < list.length; i++) { const d = defOf(list[i]); if (d && d.elevator) return list[i]; }
  return null;
}
function hubMul(L) { const h = hubInst(L); return h && integrity(h) <= 0.1 ? 0.1 : 1; }
function effectiveTier(inst) { const def = defOf(inst); return ((def && def.tier) || 0) + (inst.oc | 0); }
function gridRatio(inst, def) {
  if (!def || !def.power || !(def.power.use > 0)) return 1;
  const P = Power(); if (!P || !P.gridOf) return 1;
  if (P.ratioOf) { const r = +P.ratioOf(inst.uid); return r === r ? U.clamp(r, 0, 1) : 0; }
  const g = P.gridOf(inst.uid); if (!g) return 0;
  const r = g.ratio; return r === undefined || r === null ? 1 : U.clamp(r, 0, 1);
}
function machineSpeed(inst) {
  const def = defOf(inst); if (!def) return 0;
  return (def.speed || 1) * Math.pow(1.5, inst.oc | 0) * gridRatio(inst, def) * integrityMul(inst) * hubMul(inst.layer);
}
/* base demand in W; Power applies the 2^oc overclock factor itself when it reads inst._wantPower */
function powerDemand(inst, def, rc) {
  if (!def.power || !(def.power.use > 0)) return 0;
  return rc && rc.energy > 0 ? rc.energy : def.power.use;
}
/* returns null when the machine may run, else a blocking state; consumes fuel/fluids when `consume` */
function powerCheck(inst, def, r, dt, consume) {
  if (def.power && def.power.use > 0) {
    inst._wantPower = powerDemand(inst, def, inst.recipe ? R().recipe(inst.recipe) : null);
    if (gridRatio(inst, def) <= 0) return { state: 'no_power', reason: 'Sin energía' };
  }
  const burn = def.burn;
  if (burn) {
    const L = inst.layer, F = Fluids();
    if (burn.fluidIn) for (const fid in burn.fluidIn) {
      const need = burn.fluidIn[fid] * dt;
      if (!F || !F.available || F.available(inst.uid, fid) < need) return { state: 'no_fluid', reason: 'Falta ' + R().itemName(fid) };
    }
    if (burn.mjPerSec > 0) {
      const need = burn.mjPerSec * Math.pow(2, inst.oc | 0) * dt;
      if (!(inst.fuel >= need)) refuel(inst, def, r, L, need);
      if (!(inst.fuel >= need)) return { state: 'no_fuel', reason: 'Sin combustible' };
      if (consume) inst.fuel -= need;
    }
    if (consume && burn.fluidIn) for (const fid in burn.fluidIn) F.take(inst.uid, fid, burn.fluidIn[fid] * dt);
  }
  return null;
}
function refuel(inst, def, r, L, need) {
  const fuels = def.burn.fuels || [], F = Fluids();
  inst.fuel = inst.fuel || 0;
  for (let i = 0; i < fuels.length && inst.fuel < need; i++) {
    const fid = fuels[i], it = R().item(fid); if (!it || !(it.fuel > 0)) continue;
    if (isFluid(fid)) { if (F && F.take && F.available(inst.uid, fid) >= 1) { const got = F.take(inst.uid, fid, 1); if (got > 0) { inst.fuel += got * it.fuel; r.fuelItem = fid; } } }
    else if (count(L, fid) >= 1) { take(L, { [fid]: 1 }); inst.fuel += it.fuel; r.fuelItem = fid; }
  }
}
/* link throughput: token bucket per structure refilled at linkRate items/s (5 s of burst capacity) */
function tpOk(r, n, rate, t) {
  if (rate === Infinity || n <= 0) return true;
  const cap = rate * 5;
  if (r.tpT < 0) { r.tp = cap; r.tpT = t; }
  r.tp = Math.min(cap, r.tp + rate * (t - r.tpT)); r.tpT = t;
  if (r.tp < Math.min(n, cap)) return false;
  r.tp -= n; return true;
}
function setState(inst, state, reason) { inst.state = state; inst.reason = reason || null; return state; }

/* ── recipes ── */
function availableRecipes(uid) {
  const inst = G && G.structures[uid]; if (!inst) return [];
  const def = defOf(inst); if (!def || !def.types) return [];
  const Rs = LD.Sim.Research, tier = effectiveTier(inst), out = [];
  for (const rc of R().recipesFor(def.id)) {
    if (rc.tier > tier) continue;
    const ok = Rs && Rs.isUnlocked ? Rs.isUnlocked('recipe', rc.id) : (R().isStart('recipe', rc.id) || !!G.research.done[R().unlockerOf('recipe', rc.id)]);
    if (ok) out.push(rc);
  }
  return out;
}
function setRecipe(uid, id) {
  const inst = G && G.structures[uid]; if (!inst) return false;
  if (id !== null && id !== undefined) { if (!availableRecipes(uid).some(rc => rc.id === id)) return false; } else id = null;
  if (inst.recipe === id) return true;
  const r = rtOf(uid), old = inst.recipe && R().recipe(inst.recipe);
  if (old && inst.loaded && inst.progress < old.time) addMany(inst.layer, old.in);
  inst.recipe = id; inst.progress = 0; inst.loaded = false; r.fin = null; r.fout = null;
  if (id) { G.discovered.recipes[id] = true; for (const o in R().recipe(id).out) discover(o); }
  setState(inst, 'idle', null);
  return true;
}
function applyRecipeToAll(uid) {
  const inst = G && G.structures[uid]; if (!inst) return 0;
  let n = 0;
  for (const k in G.structures) { const o = G.structures[k]; if (o !== inst && o.id === inst.id && o.layer === inst.layer && setRecipe(k, inst.recipe)) n++; }
  return n;
}

/* ── elevator rules ── */
function elevatorRules(uid) { const inst = G && G.structures[uid]; if (!inst) return []; if (!Array.isArray(inst.rules)) inst.rules = DEFAULT_RULES(); return inst.rules; }
function setElevatorRules(uid, rules) {
  const inst = G && G.structures[uid]; if (!inst) return false;
  const clean = [];
  for (const r of (rules || [])) {
    if (!r || !r.item || !['up', 'down', 'keep'].includes(r.mode)) continue;
    if (r.item !== '*' && !R().item(r.item)) continue;
    if (r.item === '*' && r.mode !== 'up') continue;
    clean.push({ item: r.item, mode: r.mode, keep: Math.max(0, Math.floor(+r.keep || 0)) });
  }
  inst.rules = clean;
  return true;
}

/* ── machines ── */
function takeOne(L, id, n) {
  const inv = G.inv[L]; if (!inv || (inv[id] || 0) < n) return false;
  inv[id] -= n; if (inv[id] <= 0) delete inv[id];
  record(L, id, -n); markChanged(L, id); return true;
}
function flushFluidOut(inst, r) {
  const F = Fluids();
  if (!F || !F.give) { r.fout = null; return true; }
  let left = 0;
  for (const fid in r.fout) {
    const amt = r.fout[fid];
    if (amt > 1e-9) { const got = F.give(inst.uid, fid, amt); r.fout[fid] = amt - got; }
    if (r.fout[fid] > 1e-9) left++; else delete r.fout[fid];
  }
  if (!left) r.fout = null;
  return !left;
}
function deliverOutputs(inst, rc, r, L, rate, t) {
  let items = 0;
  for (const id in rc.out) {
    if (isFluid(id)) continue;
    const n = rc.out[id]; items += n;
    if (room(L, id) < n) { r.reason = 'Almacén lleno: ' + R().itemName(id); return false; }
  }
  if (!tpOk(r, items, rate, t)) { r.reason = 'Cinta saturada'; return false; }
  for (const id in rc.out) {
    if (isFluid(id)) { if (!r.fout) r.fout = {}; r.fout[id] = (r.fout[id] || 0) + rc.out[id]; }
    else add(L, id, rc.out[id]);
  }
  if (r.fout) flushFluidOut(inst, r);
  inst.progress = 0; inst.loaded = false;
  inst.stats.made = (inst.stats.made || 0) + 1;
  return true;
}
function loadInputs(inst, rc, r, L, rate, t) {
  const F = Fluids();
  for (const id in rc.in) {
    if (!isFluid(id)) continue;
    if (!F || !F.take) return { state: 'no_fluid', reason: 'Sin red de tuberías' };
    if (!r.fin) r.fin = {};
    const have = r.fin[id] || 0, need = rc.in[id] - have;
    if (need > 1e-9) { const got = F.take(inst.uid, id, need); r.fin[id] = have + got; }
    if (r.fin[id] < rc.in[id] - 1e-9) return { state: 'no_fluid', reason: 'Falta ' + R().itemName(id) };
  }
  let items = 0;
  for (const id in rc.in) {
    if (isFluid(id)) continue;
    const n = rc.in[id]; items += n;
    if (count(L, id) < n) return { state: 'no_input', reason: 'Falta ' + R().itemName(id) };
  }
  if (!tpOk(r, items, rate, t)) return { state: 'output_full', reason: 'Cinta saturada' };
  take(L, rc.in);
  inst.loaded = true; r.fin = null;
  return null;
}
function tickMachine(inst, def, r, L, dt, t) {
  const rc = inst.recipe ? R().recipe(inst.recipe) : null;
  if (!rc) return setState(inst, 'idle', 'Sin receta');
  const rate = linkRate(inst.uid);
  if (!rate) return setState(inst, 'no_link', 'Sin conexión al almacén');
  if (effectiveTier(inst) < rc.tier) return setState(inst, 'idle', 'Requiere nivel T' + rc.tier);
  if (r.fout && !flushFluidOut(inst, r)) return setState(inst, 'output_full', 'Sin tanque con espacio');
  if (inst.progress >= rc.time && !deliverOutputs(inst, rc, r, L, rate, t)) return setState(inst, 'output_full', r.reason);
  if (!inst.loaded) { const s = loadInputs(inst, rc, r, L, rate, t); if (s) return setState(inst, s.state, s.reason); }
  const p = powerCheck(inst, def, r, dt, true);
  if (p) return setState(inst, p.state, p.reason);
  const spd = machineSpeed(inst);
  if (spd <= 0) return setState(inst, 'no_power', 'Sin energía');
  inst.progress += dt * spd;
  setState(inst, 'working', null);
  if (inst.progress >= rc.time) { inst.progress = rc.time; if (!deliverOutputs(inst, rc, r, L, rate, t)) setState(inst, 'output_full', r.reason); }
}

/* ── extractors ── */
function buildDeposits(inst, def, r, L) {
  const ex = def.extract, deps = G.layers[L].deposits, f = footprint(inst, def), wantFluid = !!(ex.fluid || ex.fluids);
  const out = r.dep || (r.dep = []); out.length = 0;
  for (let dy = 0; dy < f.h; dy++) for (let dx = 0; dx < f.w; dx++) {
    const key = (f.x + dx) + ',' + (f.y + dy), d = deps[key];
    if (!d || !!d.fluid !== wantFluid || (d.hardness || 0) > (ex.hardnessMax || 0)) continue;
    if (!wantFluid && isFluid(d.res)) continue;
    out.push(key);
  }
  r.depDirty = false;
  if (!r.acc) r.acc = {};
}
/* moves whole units from r.acc into inventory/pipes; false when blocked */
function deliverAcc(inst, r, L, rate, t) {
  let blocked = false;
  const F = Fluids();
  for (const id in r.acc) {
    const n = Math.floor(r.acc[id]); if (n < 1) continue;
    let done = 0;
    if (isFluid(id)) { if (F && F.give) done = F.give(inst.uid, id, n); if (done < n) r.reason = F ? 'Sin tanque con espacio' : 'Sin red de tuberías'; }
    else if (room(L, id) < 1) r.reason = 'Almacén lleno: ' + R().itemName(id);
    else if (!tpOk(r, n, rate, t)) r.reason = 'Cinta saturada';
    else done = add(L, id, n);
    r.acc[id] -= done;
    if (done > 0) inst.stats.made = (inst.stats.made || 0) + done;
    if (r.acc[id] >= 1) blocked = true;
  }
  return !blocked;
}
function consumesOk(inst, def, r, L, dt, spec, consume) {
  const F = Fluids();
  if (!r.cacc) r.cacc = {};
  for (const id in spec) {
    const n = spec[id] * dt;
    if (isFluid(id)) {
      if (!F || !F.available || F.available(inst.uid, id) < n) return { state: 'no_fluid', reason: 'Falta ' + R().itemName(id) };
      if (consume) F.take(inst.uid, id, n);
    } else {
      const acc = (r.cacc[id] || 0) + n;
      if (acc >= 1 && count(L, id) < 1) return { state: 'no_input', reason: 'Falta ' + R().itemName(id) };
      if (consume) { if (acc >= 1) { takeOne(L, id, 1); r.cacc[id] = acc - 1; } else r.cacc[id] = acc; }
    }
  }
  return null;
}
function tickExtractor(inst, def, r, L, dt, t) {
  const ex = def.extract;
  if (r.depDirty || !r.dep) buildDeposits(inst, def, r, L);
  if (!r.dep.length) return setState(inst, 'idle', 'Sin yacimiento explotable');
  const fluidOut = !!(ex.fluid || ex.fluids);
  const rate = fluidOut ? Infinity : linkRate(inst.uid);
  if (!rate) return setState(inst, 'no_link', 'Sin conexión al almacén');
  if (!deliverAcc(inst, r, L, rate, t)) return setState(inst, 'output_full', r.reason);
  if (ex.consumes) { const c = consumesOk(inst, def, r, L, dt, ex.consumes, false); if (c) return setState(inst, c.state, c.reason); }
  const p = powerCheck(inst, def, r, dt, true);
  if (p) return setState(inst, p.state, p.reason);
  const spd = machineSpeed(inst);
  if (spd <= 0) return setState(inst, 'no_power', 'Sin energía');
  if (ex.consumes) consumesOk(inst, def, r, L, dt, ex.consumes, true);
  const per = ex.rate * spd * dt, deps = G.layers[L].deposits, W = World();
  for (let i = 0; i < r.dep.length; i++) {
    const key = r.dep[i], d = deps[key];
    if (!d) { r.depDirty = true; continue; }
    let amt = per;
    if (d.amt >= 0) { amt = Math.min(per, d.amt); d.amt -= amt; }
    r.acc[d.res] = (r.acc[d.res] || 0) + amt;
    if (d.amt >= 0 && d.amt <= 1e-9) {
      const [x, y] = U.unkey(key); r.depDirty = true;
      if (W && W.removeDeposit) W.removeDeposit(L, x, y); else { delete deps[key]; if (LD.Tex && LD.Tex.invalidate) LD.Tex.invalidate(L, x, y); }
      LD.State.log('Yacimiento de ' + R().itemName(d.res) + ' agotado (' + (layerDef(L).name || 'capa ' + L) + ')', 'warn');
    }
  }
  setState(inst, 'working', null);
  deliverAcc(inst, r, L, rate, t);
}

/* ── borers (excavation) ── */
const candScratch = [];
function borerCandidates(inst, def, L) {
  const W = World(), lay = W.layers[L], f = footprint(inst, def), out = candScratch; out.length = 0;
  const tryTile = (x, y) => {
    if (x < 0 || y < 0 || x >= lay.w || y >= lay.h) return;
    const c = W.chunkOf(L, x, y), key = W.chunkKey(c.cx, c.cy);
    if (out.indexOf(key) >= 0 || W.isExcavated(L, c.cx, c.cy)) return;
    const ok = W.canDig ? W.canDig(L, c.cx, c.cy) : { ok: true };
    if (ok && ok.ok !== false) out.push(key);
  };
  for (let dx = 0; dx < f.w; dx++) { tryTile(f.x + dx, f.y - 1); tryTile(f.x + dx, f.y + f.h); }
  for (let dy = 0; dy < f.h; dy++) { tryTile(f.x - 1, f.y + dy); tryTile(f.x + f.w, f.y + dy); }
  return out;
}
function yieldAcc(r, L, id, v) {
  if (!R().item(id)) return;
  const acc = (r.acc[id] || 0) + v;
  if (acc >= 1) { const n = Math.floor(acc); add(L, id, n); r.acc[id] = acc - n; } else r.acc[id] = acc;
}
function commonOre(L) {
  const deps = layerDef(L).deposits || []; let best = null;
  for (const d of deps) if (!d.fluid && R().item(d.res) && !isFluid(d.res) && (!best || (d.freq || 0) > (best.freq || 0))) best = d;
  return best ? best.res : null;
}
function tickBorer(inst, def, r, L, dt, t) {
  const W = World(), lay = G.layers[L], ldef = layerDef(L);
  if (L === 0 || !W || !W.layers[L]) return setState(inst, 'idle', 'La superficie no se excava');
  const bt = ldef.borerTier || 0, tier = effectiveTier(inst);
  if (tier < bt) return setState(inst, 'idle', 'Roca demasiado dura (requiere T' + bt + ')');
  if (!r.acc) r.acc = {};
  if (r.depDirty || t - (r.candT || -9) >= 2) { r.depDirty = false; r.candT = t; const c = borerCandidates(inst, def, L); r.dep = r.dep || []; r.dep.length = 0; for (let i = 0; i < c.length; i++) r.dep.push(c[i]); }
  let key = inst.target;
  if (key && r.dep.indexOf(key) < 0) key = null;
  if (!key) { for (let i = 0; i < r.dep.length; i++) if (lay.digging[r.dep[i]]) { key = r.dep[i]; break; } if (!key && r.dep.length) key = r.dep[0]; inst.target = key || null; }
  if (!key) return setState(inst, 'idle', 'Sin roca adyacente que excavar');
  const p = powerCheck(inst, def, r, dt, true);
  if (p) return setState(inst, p.state, p.reason);
  const spd = machineSpeed(inst);
  if (spd <= 0) return setState(inst, 'no_power', 'Sin energía');
  const [cx, cy] = U.unkey(key);
  let dig = lay.digging[key];
  if (!dig) dig = lay.digging[key] = { work: 0, total: W.excavationWork ? W.excavationWork(L, cx, cy) : 256 * ((ldef.rockBase || 1) * (1 + (ldef.rockPerChunk || 0.35) * (W.chunkDistance ? W.chunkDistance(L, cx, cy) : 1))) };
  dig.work += def.borer.rate * Math.pow(2, tier - bt) * spd * dt;
  const linked = isLinked(inst.uid);
  if (linked) { yieldAcc(r, L, 'stone', 0.3 * spd * dt); yieldAcc(r, L, 'gravel', 0.2 * spd * dt); const ore = commonOre(L); if (ore) yieldAcc(r, L, ore, 0.05 * spd * dt); }
  setState(inst, 'working', linked ? null : 'Sin conexión: el escombro se pierde');
  if (LD.Particles && !LD.Sim.ff && t - r.fx >= 0.4) { r.fx = t; const T = (LD.Render && LD.Render.TILE) || 48, s = def.size || 1; try { LD.Particles.emit('rubble', (inst.x + s / 2) * T, (inst.y + s / 2) * T, { layer: L, n: 3 }); } catch (e) { /* optional */ } }
  if (dig.work >= dig.total) {
    delete lay.digging[key];
    inst.target = null; r.depDirty = true;
    G.flags.chunksDug = (G.flags.chunksDug || 0) + 1;
    inst.stats.made = (inst.stats.made || 0) + 1;
    W.excavate(L, cx, cy);
    if (LD.Audio && LD.Audio.play) LD.Audio.play('excavated');
    LD.State.log('Sector ' + cx + ',' + cy + ' excavado en ' + (ldef.name || 'capa ' + L), 'ok');
  }
}

/* ── elevators ── */
const elUp = new Map(), elKeep = new Map(), elDown = new Map();
let elStar = null;
function parseRules(rules) {
  elUp.clear(); elKeep.clear(); elDown.clear(); elStar = null;
  for (let i = 0; i < rules.length; i++) {
    const ru = rules[i], k = Math.max(0, ru.keep | 0);
    if (ru.mode === 'up') { if (ru.item === '*') elStar = k; else elUp.set(ru.item, Math.max(k, elUp.get(ru.item) || 0)); }
    else if (ru.mode === 'keep') elKeep.set(ru.item, Math.max(k, elKeep.get(ru.item) || 0));
    else if (ru.mode === 'down') elDown.set(ru.item, Math.max(k, elDown.get(ru.item) || 0));
  }
}
function tickElevator(inst, def, r, L, dt, t) {
  if (L === 0) return setState(inst, 'idle', 'Los elevadores operan en los estratos inferiores');
  const p = powerCheck(inst, def, r, dt, true);
  if (p) return setState(inst, p.state, p.reason);
  const rate = def.elevator.rate * gridRatio(inst, def) * integrityMul(inst) * hubMul(0) * hubMul(L);
  r.bud = Math.min(Math.max(1, rate), r.bud + rate * dt);
  let moved = 0;
  if (r.bud >= 1) {
    parseRules(elevatorRules(inst.uid));
    for (const [id, keep] of elDown) {
      if (r.bud < 1) break;
      const c = count(L, id); if (c >= keep) continue;
      const n = Math.min(Math.floor(r.bud), keep - c, count(0, id), room(L, id));
      if (n > 0 && takeOne(0, id, n)) { add(L, id, n); r.bud -= n; moved += n; }
    }
    const inv = G.inv[L];
    for (const id in inv) {
      if (r.bud < 1) break;
      if (elDown.has(id)) continue;
      let thr;
      if (elUp.has(id)) thr = Math.max(elUp.get(id), elKeep.get(id) || 0);
      else if (elStar !== null) thr = Math.max(elStar, elKeep.get(id) || 0);
      else continue;
      const c = inv[id]; if (c <= thr) continue;
      const n = Math.min(Math.floor(r.bud), c - thr, room(0, id));
      if (n > 0 && takeOne(L, id, n)) { add(0, id, n); r.bud -= n; moved += n; }
    }
  }
  if (moved) { r.lastMove = t; inst.stats.made = (inst.stats.made || 0) + moved; }
  setState(inst, t - r.lastMove < 1 ? 'working' : 'idle', null);
}

/* ── tick ── */
let pendingRebuild = 0;
function tick(dt) {
  if (!G) return;
  inTick = true;
  const t = now();
  for (let L = 0; L < NL; L++) expireSlot(L, ringIdx);
  capClock += dt; if (capClock >= 1) { capClock = 0; capCache.fill(-1); listsDirty = true; }
  collectStructures(false);
  for (let L = 0; L < NL; L++) {
    const list = byLayer[L];
    for (let i = 0; i < list.length; i++) {
      const inst = list[i];
      if (inst.build) continue;
      const def = defOf(inst); if (!def) continue;
      const kind = def.types ? 1 : def.extract ? 2 : def.borer ? 3 : def.elevator ? 4 : 0;
      if (!kind) continue;
      inst._wantPower = 0;
      if (inst.hp <= 0) continue;
      if (inst.paused) { setState(inst, 'paused', null); continue; }
      if (!inst.stats) inst.stats = { made: 0 };
      const r = rtOf(inst.uid);
      if (kind === 1) tickMachine(inst, def, r, L, dt, t);
      else if (kind === 2) tickExtractor(inst, def, r, L, dt, t);
      else if (kind === 3) tickBorer(inst, def, r, L, dt, t);
      else tickElevator(inst, def, r, L, dt, t);
    }
  }
  flushChanged();
  ringIdx = (ringIdx + 1) % RING;
  inTick = false;
  if (pendingRebuild) { const m = pendingRebuild; pendingRebuild = 0; for (let L = 0; L < NL; L++) if (m & (1 << L)) rebuildNetworks(L); }
}

function init(g) {
  G = g;
  if (!Array.isArray(G.inv)) G.inv = [];
  for (let L = 0; L < NL; L++) {
    if (!G.inv[L]) G.inv[L] = {};
    const rs = rates[L]; for (const k in rs) delete rs[k];
    changed[L].clear();
    for (const s of ring[L]) { s.plus.clear(); s.minus.clear(); }
  }
  for (const uid in G.structures) { const inst = G.structures[uid]; if (!inst.stats) inst.stats = { made: 0 }; if (inst.fuel === undefined) inst.fuel = 0; }
  rt.clear(); capCache.fill(-1); ringIdx = 0; capClock = 0; pendingRebuild = 0; inTick = false; listsDirty = true;
  if (!listening) {
    listening = true;
    const dirty = () => { capCache.fill(-1); listsDirty = true; };
    E.on('structure:removed', uid => { rt.delete(uid); dirty(); });
    E.on('structure:built', dirty); E.on('structure:placed', dirty); E.on('structure:broken', dirty);
    E.on('chunk:excavated', p => { if (!G || !p) return; const L = p.layer | 0; if (inTick) pendingRebuild |= 1 << L; else rebuildNetworks(L); });
  }
}

LD.Sim.Economy = {
  init, tick, has, take, add, addMany, count, cap, room, rates,
  rebuildNetworks, linkRate, isLinked, machineSpeed, effectiveTier, gridRatio, powerDemand, integrity, integrityMul, hubMul,
  setRecipe, applyRecipeToAll, availableRecipes, elevatorRules, setElevatorRules, discover, invalidateCaps,
  give: (L, id, n) => addRaw(L, id, n, true),
  reason: uid => { const i = G && G.structures[uid]; return i ? i.reason || null : null; },
  fuelItem: uid => { const r = rt.get(uid); return r ? r.fuelItem : null; },
  borerTarget: uid => { const i = G && G.structures[uid]; return i && i.target ? i.target : null; },
  depositsOf: uid => { const r = rt.get(uid); return r && r.dep ? r.dep : []; },
  DEFAULT_RULES
};
})();
