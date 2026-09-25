(() => {
'use strict';
const LD = window.LD;
LD.Sim = LD.Sim || {};

const DIRECT_CAP = 50e3;          // W · 2^tier between two touching structures without cable
const BROWNOUT_RATIO = 0.999, BROWNOUT_COOLDOWN = 30, EMA_SECONDS = 10, EPS = 1e-9;
const NEIGH = [[1, 0], [-1, 0], [0, 1], [0, -1]];

const P = LD.Sim.Power = {
  grids: [],           // grid = { id, key, layers, gen, genCap, use, served, ratio, stored, cap, batt, members, producers, consumers, batteries }
  comps: [],           // comps[L] = connected components of that layer (before shaft joins)
  gridMap: new Map(),  // uid → grid
  capOf: new Map(),    // uid → cable cap (W)
  coolersOf: new Map(),// reactor uid → [cooling tower uid]
  towers: [],          // towers[L] = cooling towers of that layer (state reset each tick)
  dirty: [],
  clock: 0, tickNo: 0,
  _G: null, _nextId: 1, _brownAt: new Map(), _towerUse: new Map(), _genAcc: new Float64Array(8), _sum: []
};

/* ── helpers ── */
const reg = () => LD.Registry;
const def = inst => (inst && reg()) ? reg().structure(inst.id) : null;
const G = () => LD.G;
const inst = uid => { const g = G(); return g && g.structures ? g.structures[uid] || null : null; };
const size = d => (d && d.size) || 1;
const ready = i => !!i && !i.build && !i.paused && i.state !== 'broken' && !(i.hp <= 0);
const isMember = d => !!d && !!(d.power || d.cable || d.overlay === 'cable' || d.shaft || d.elevator);
const isCable = d => !!d && (d.overlay === 'cable' || !!d.cable);
const needsCooling = d => !!(d.power && (d.power.cooling || d.power.needsCooling)) || d.id === 'fission_reactor';
const coolerIdOf = d => (d.power && typeof d.power.cooling === 'string') ? d.power.cooling : 'cooling_tower';
const isTower = d => !!d && (d.cooler === true || d.id === 'cooling_tower' || !!(d.power && d.power.fluidIn && !(d.power.gen > 0) && !(d.power.use > 0) && !(d.power.store > 0)));
const towerFluids = d => d ? ((d.power && d.power.fluidIn) || d.fluidIn || (d.consumes && hasFluidKeys(d.consumes) ? d.consumes : null)) : null;
const hasFluidKeys = o => { const Fl = LD.Sim.Fluids; if (!Fl) return false; for (const k in o) if (Fl.isFluid(k)) return true; return false; };
const sourceOf = d => {
  if (d.power && d.power.source) return d.power.source;
  const id = d.id || '';
  return id.indexOf('solar') >= 0 ? 'solar' : id.indexOf('wind') >= 0 ? 'wind' : id.indexOf('water') >= 0 ? 'water' : null;
};
const pow2 = n => n > 0 ? Math.pow(2, n) : 1;
const pow15 = n => n > 0 ? Math.pow(1.5, n) : 1;

let fbCable = null, fbOcc = null;
const KEYW = 4096;
const cableAt = (L, x, y) => { const W = LD.World; if (W && W.cableAt) return W.cableAt(L, x, y); return fbCable ? (fbCable.get(y * KEYW + x) || null) : null; };
const uidAt = (L, x, y) => { const W = LD.World; if (W && W.uidAt) return W.uidAt(L, x, y); return fbOcc ? (fbOcc.get(y * KEYW + x) || null) : null; };

/* ── rebuild: per-layer components, then shaft ↔ elevator joins into grids (one grid object spanning layers) ── */
const resetState = () => {
  P.grids = []; P.comps = []; P.gridMap = new Map(); P.capOf = new Map(); P.coolersOf = new Map(); P.towers = []; P.dirty = []; P._towerUse = new Map(); P._sum = []; P._nextId = 1;
  P._G = G();
  const g = G(); if (g && g.power) g.power.grids = [];
};
const checkG = () => {
  const g = G();
  if (g !== P._G) { resetState(); if (g) for (let L = 0; L < g.layers.length; L++) P.dirty[L] = true; }
  return g;
};

P.rebuild = L => {
  const g = checkG(); if (!g || !reg()) return;
  L = L | 0;
  const useFallback = !(LD.World && LD.World.uidAt && LD.World.cableAt);
  if (useFallback) { fbCable = new Map(); fbOcc = new Map(); }
  const uids = [], insts = [], defs = [], index = new Map(), reactors = [], towers = [];
  for (const uid in g.structures) {
    const i = g.structures[uid];
    if (!i || i.layer !== L) continue;
    const d = def(i); if (!d) continue;
    if (useFallback) {
      const s = size(d);
      if (d.overlay) { if (d.overlay === 'cable') fbCable.set(i.y * KEYW + i.x, uid); }
      else for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) fbOcc.set((i.y + dy) * KEYW + i.x + dx, uid);
    }
    if (isTower(d) && !i.build) towers.push(i);
    if ((d.overlay && d.overlay !== 'cable') || i.build || !isMember(d)) continue;
    index.set(uid, uids.length); uids.push(uid); insts.push(i); defs.push(d);
    if (needsCooling(d)) reactors.push(i);
  }
  const n = uids.length, parent = new Int32Array(n), caps = new Float64Array(n);
  for (let k = 0; k < n; k++) parent[k] = k;
  const find = a => { let r = a; while (parent[r] !== r) r = parent[r]; while (parent[a] !== r) { const t = parent[a]; parent[a] = r; a = t; } return r; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };
  let k = 0, best = 0, direct = 0, tier = 0;
  const visit = (nx, ny) => {
    const c = cableAt(L, nx, ny), cj = c ? index.get(c) : undefined;
    if (cj !== undefined && cj !== k) { union(k, cj); const cc = defs[cj].cable; const cap = cc ? (cc.cap > 0 ? cc.cap : Infinity) : 0; if (cap > best) best = cap; }
    const u = uidAt(L, nx, ny), uj = u ? index.get(u) : undefined;
    if (uj !== undefined && uj !== k) {
      union(k, uj);
      const od = defs[uj];
      if (!isCable(od)) { const cap = DIRECT_CAP * pow2(Math.min(tier, od.tier | 0)); if (cap > direct) direct = cap; }
    }
  };
  for (k = 0; k < n; k++) {
    const i = insts[k], d = defs[k], s = size(d), cable = isCable(d);
    best = 0; direct = 0; tier = d.tier | 0;
    if (cable || s === 1) { for (let q = 0; q < 4; q++) visit(i.x + NEIGH[q][0], i.y + NEIGH[q][1]); }
    else for (let q = 0; q < s; q++) { visit(i.x + q, i.y - 1); visit(i.x + q, i.y + s); visit(i.x - 1, i.y + q); visit(i.x + s, i.y + q); }
    caps[k] = cable ? (d.cable && d.cable.cap > 0 ? d.cable.cap : Infinity) : Math.max(best, direct);
  }
  /* cooling towers touching each reactor (any structure of the cooler id, member or not) */
  for (const r of reactors) {
    const d = def(r), s = size(d), want = coolerIdOf(d), list = [];
    const look = (nx, ny) => { const u = uidAt(L, nx, ny); if (u && u !== r.uid && list.indexOf(u) < 0) { const o = g.structures[u]; if (o && o.id === want) list.push(u); } };
    for (let k = 0; k < s; k++) { look(r.x + k, r.y - 1); look(r.x + k, r.y + s); look(r.x - 1, r.y + k); look(r.x + s, r.y + k); }
    P.coolersOf.set(r.uid, list);
  }
  const old = P.comps[L] || [];
  for (const c of old) for (const uid of c.members) { P.capOf.delete(uid); P.gridMap.delete(uid); if (!index.has(uid)) P.coolersOf.delete(uid); }
  const byRoot = new Map();
  for (let k = 0; k < n; k++) {
    const r = find(k), uid = uids[k], d = defs[k];
    let c = byRoot.get(r);
    if (!c) { c = { id: P._nextId++, layer: L, members: [], shafts: [], hasElevator: false }; byRoot.set(r, c); }
    c.members.push(uid);
    P.capOf.set(uid, caps[k]);
    if (d.shaft) c.shafts.push(d.shaft.layer | 0);
    if (d.elevator) c.hasElevator = true;
  }
  P.comps[L] = Array.from(byRoot.values());
  P.towers[L] = towers;
  P.dirty[L] = false;
  relink();
  if (useFallback) { fbCable = null; fbOcc = null; }
};

const relink = () => {
  const g = G(); if (!g) return;
  const all = [];
  for (const arr of P.comps) if (arr) for (const c of arr) all.push(c);
  const parent = new Map(all.map(c => [c.id, c.id]));
  const find = a => { while (parent.get(a) !== a) a = parent.get(a); return a; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
  for (const c of all) for (const k of c.shafts) if (k !== c.layer) for (const o of (P.comps[k] || [])) if (o.hasElevator) union(c.id, o.id);
  const byRoot = new Map();
  const prevBrown = new Map(); for (const gr of P.grids) prevBrown.set(gr.key, gr._brown);
  P.grids = []; P.gridMap = new Map();
  for (const c of all) {
    const r = find(c.id);
    let gr = byRoot.get(r);
    if (!gr) {
      gr = { id: P._nextId++, key: '', layers: [], gen: 0, genCap: 0, use: 0, served: 0, ratio: 1, stored: 0, cap: 0, batt: 0, members: [], producers: [], consumers: [], batteries: [], _brown: false, _snap: null };
      byRoot.set(r, gr); P.grids.push(gr);
    }
    if (gr.layers.indexOf(c.layer) < 0) gr.layers.push(c.layer);
    for (const uid of c.members) {
      gr.members.push(uid); P.gridMap.set(uid, gr);
      if (!gr.key || uid < gr.key) gr.key = uid;
      const i = g.structures[uid], d = def(i); if (!d) continue;
      const pw = d.power; if (!pw) continue;
      if (pw.gen > 0) gr.producers.push(i);
      else if (pw.store > 0) { gr.batteries.push(i); if (typeof i.stored !== 'number') i.stored = 0; }
      else if (pw.use > 0) gr.consumers.push(i);
    }
  }
  for (const gr of P.grids) {
    gr.layers.sort((a, b) => a - b);
    gr._brown = !!prevBrown.get(gr.key);
    for (const i of gr.batteries) { const st = def(i).power.store; gr.cap += st; gr.stored += Math.min(st, i.stored); }
  }
  syncSnapshot(g);
};
const syncSnapshot = g => {
  if (!g.power) g.power = { grids: [] };
  g.power.grids = P.grids.map(gr => (gr._snap = { layer: gr.layers[0], layers: gr.layers.slice(), gen: gr.gen, use: gr.use, ratio: gr.ratio, stored: gr.stored, cap: gr.cap, members: gr.members.length }));
};

/* ── producers ── */
const takeItem = (L, id) => {
  const Ec = LD.Sim.Economy, g = G();
  if (Ec && Ec.take) { const o = {}; o[id] = 1; return Ec.take(L, o); }
  const inv = g && g.inv && g.inv[L]; if (!inv || !(inv[id] >= 1)) return false;
  inv[id] -= 1; if (inv[id] <= 0) delete inv[id];
  LD.Events.emit('inv:changed', { layer: L, item: id });
  return true;
};
const wasteRoom = (L, waste) => {
  const Ec = LD.Sim.Economy;
  for (const id in waste) {
    if (Ec && Ec.cap && Ec.count) { if (Ec.count(L, id) + waste[id] > Ec.cap(L, id)) return false; }
  }
  return true;
};
const addWaste = (L, waste) => {
  const Ec = LD.Sim.Economy, g = G();
  if (Ec && Ec.addMany) { Ec.addMany(L, waste); return; }
  if (Ec && Ec.add) { for (const id in waste) Ec.add(L, id, waste[id]); return; }
  const inv = g && g.inv && g.inv[L]; if (!inv) return;
  for (const id in waste) { inv[id] = (inv[id] || 0) + waste[id]; LD.Events.emit('inv:changed', { layer: L, item: id }); }
};
const refuel = (p, pw, need) => {
  const R = reg(), Fl = LD.Sim.Fluids, L = p.layer | 0;
  if (typeof p.fuel !== 'number' || !(p.fuel >= 0)) p.fuel = 0;
  for (let iter = 0; p.fuel < need && iter < 8; iter++) {
    let ok = false;
    for (let k = 0; k < pw.fuel.length && !ok; k++) {
      const f = pw.fuel[k], it = R.item(f); if (!it || !(it.fuel > 0)) continue;
      if (Fl && Fl.isFluid(f)) {
        const n = Fl.take(p.uid, f, 1);
        if (n > 0) { p.fuel += n * it.fuel; p.fuelItem = f; ok = true; }
      } else {
        if (pw.waste && !wasteRoom(L, pw.waste)) { p.state = 'output_full'; return false; }
        if (takeItem(L, f)) { p.fuel += it.fuel; p.fuelItem = f; ok = true; if (pw.waste) addWaste(L, pw.waste); }
      }
    }
    if (!ok) break;
  }
  if (p.fuel <= 1e-12) { p.state = 'no_fuel'; return false; }
  return true;
};
const pickCooler = (p, dt) => {
  const list = P.coolersOf.get(p.uid); if (!list || !list.length) return null;
  const Fl = LD.Sim.Fluids;
  for (let k = 0; k < list.length; k++) {
    const t = inst(list[k]); if (!ready(t)) continue;
    if (P._towerUse.get(t.uid) === P.tickNo) continue;
    const fi = towerFluids(def(t));
    if (fi && Fl) {
      let ok = true;
      for (const f in fi) { const need = fi[f] * dt; if (Fl.available(t.uid, f) < need * 0.5 || Fl.budgetLeft(t.uid) < need * 0.5) { ok = false; break; } }
      if (!ok) { t.state = 'no_fluid'; continue; }
    }
    P._towerUse.set(t.uid, P.tickNo);
    return t;
  }
  return null;
};
/* potential output this tick (W); refuels, checks fluids/cooling/environment, sets state on failure */
const potential = (p, d, dt) => {
  const pw = d.power, L = p.layer | 0;
  p._cooler = null;
  if (!ready(p)) return 0;
  let mul = pow15(p.oc | 0);
  const src = sourceOf(d);
  if (src === 'solar' || src === 'wind') {
    if (L !== 0) mul = 0;
    else {
      const Ev = LD.Sim.Events, m = Ev && Ev.multipliers ? Ev.multipliers(0) : null;
      if (m) { const v = src === 'solar' ? m.solar : m.wind; if (v != null) mul *= v; }
      if (src === 'solar') { const N = LD.Sim.Nature; if (N && N.daylight) mul *= N.daylight(); }
    }
    if (mul <= 1e-6) { p.state = 'idle'; return 0; }
  }
  if (needsCooling(d)) {
    const t = pickCooler(p, dt);
    if (t) { p._cooler = t.uid; p._overheat = false; } else { mul *= 0.5; p._overheat = true; }
  } else if (p._overheat) p._overheat = false;
  let fluidFrac = 1;
  if (pw.fluidIn) {
    const Fl = LD.Sim.Fluids;
    if (!Fl) fluidFrac = 0;
    else {
      const bud = Fl.budgetLeft(p.uid);
      for (const f in pw.fluidIn) {
        const need = pw.fluidIn[f] * dt; if (!(need > 0)) continue;
        const fr = Math.min(1, Fl.available(p.uid, f) / need, bud / need);
        if (fr < fluidFrac) fluidFrac = fr;
      }
    }
    if (fluidFrac < 0.01) { p.state = 'no_fluid'; return 0; }
  }
  const base = pw.gen * mul * fluidFrac;
  p._genBase = pw.gen * mul;
  if (pw.fuel && pw.fuel.length) {
    if (!refuel(p, pw, base * dt / 1e6)) return 0;
    return Math.min(base, p.fuel * 1e6 / dt);
  }
  return base;
};
const burn = (p, pw, out, dt) => {
  if (out <= EPS) { p._burn = 0; return; }
  if (pw.fuel && pw.fuel.length) { p.fuel -= out * dt / 1e6; if (p.fuel < 0) p.fuel = 0; p._burn = out / 1e6; }
  const frac = p._genBase > 0 ? out / p._genBase : 0;
  const Fl = LD.Sim.Fluids;
  if (Fl && frac > 0) {
    if (pw.fluidIn) for (const f in pw.fluidIn) Fl.take(p.uid, f, pw.fluidIn[f] * frac * dt);
    if (p._cooler) {
      const t = inst(p._cooler), fi = towerFluids(def(t));
      if (t) { if (fi) for (const f in fi) Fl.take(t.uid, f, fi[f] * frac * dt); t.state = 'working'; }
    }
  }
};

/* ── tick ── */
P.tick = dt => {
  const g = checkG(); if (!g || !(dt > 0)) return;
  P.clock += dt; P.tickNo++;
  for (let L = 0; L < P.dirty.length; L++) if (P.dirty[L]) P.rebuild(L);
  const acc = P._genAcc; acc.fill(0);
  for (let L = 0; L < P.towers.length; L++) { const tw = P.towers[L]; if (tw) for (let k = 0; k < tw.length; k++) if (ready(tw[k])) tw[k].state = 'idle'; }
  for (let gi = 0; gi < P.grids.length; gi++) {
    const gr = P.grids[gi];
    const cons = gr.consumers, prod = gr.producers, batt = gr.batteries;
    /* demand */
    let use = 0;
    for (let k = 0; k < cons.length; k++) {
      const c = cons[k], w = c._wantPower;
      c._wantPower = 0;
      if (!(w > 0) || !ready(c)) { c._demandW = 0; continue; }
      const dW = w * pow2(c.oc | 0);
      c._demandW = dW;
      const cap = P.capOf.get(c.uid) || 0;
      use += dW < cap ? dW : cap;
    }
    /* supply */
    let pFree = 0, pFuel = 0;
    for (let k = 0; k < prod.length; k++) {
      const p = prod[k], d = def(p), cap = P.capOf.get(p.uid) || 0;
      let pot = d ? potential(p, d, dt) : 0;
      if (pot > cap) pot = cap;
      p._genCap = pot;
      const free = !(d && d.power.fuel && d.power.fuel.length);
      p._free = free;
      if (free) pFree += pot; else pFuel += pot;
    }
    let dis = 0, room = 0, stored = 0, capMJ = 0;
    for (let k = 0; k < batt.length; k++) {
      const b = batt[k], st = def(b).power.store, cap = P.capOf.get(b.uid) || 0;
      if (!(b.stored >= 0)) b.stored = 0;
      if (b.stored > st) b.stored = st;
      capMJ += st; stored += b.stored;
      if (!ready(b)) { b._dis = 0; b._room = 0; continue; }
      b._dis = Math.min(cap, b.stored * 1e6 / dt);
      b._room = Math.min(cap, (st - b.stored) * 1e6 / dt);
      dis += b._dis; room += b._room;
    }
    const supply = pFree + pFuel + dis;
    const ratio = use > EPS ? Math.min(1, supply / use) : (supply > EPS ? 1 : 0);
    const served = use * ratio;
    let usedFree = Math.min(pFree, served), r = served - usedFree;
    let usedFuel = Math.min(pFuel, r); r -= usedFuel;
    const usedBatt = Math.min(dis, r > 0 ? r : 0);
    const surplusFree = pFree - usedFree, surplusFuel = pFuel - usedFuel;
    const charged = Math.min(room, surplusFree + surplusFuel);
    const chargeFree = Math.min(surplusFree, charged);
    usedFree += chargeFree; usedFuel += charged - chargeFree;
    const fracFree = pFree > EPS ? usedFree / pFree : 0, fracFuel = pFuel > EPS ? usedFuel / pFuel : 0;
    /* apply to producers */
    for (let k = 0; k < prod.length; k++) {
      const p = prod[k], pot = p._genCap, d = def(p);
      const out = pot * (p._free ? fracFree : fracFuel);
      p._powerOut = out;
      if (pot > EPS) p.state = out > EPS ? 'working' : 'idle';
      if (d) burn(p, d.power, out, dt);
      acc[p.layer | 0] += out;
    }
    /* batteries */
    for (let k = 0; k < batt.length; k++) {
      const b = batt[k]; let flow = 0;
      if (usedBatt > EPS && b._dis > 0) flow -= b._dis / dis * usedBatt;
      if (charged > EPS && b._room > 0) flow += b._room / room * charged;
      b.stored += flow * dt / 1e6;
      const st = def(b).power.store;
      if (b.stored < 0) b.stored = 0; else if (b.stored > st) b.stored = st;
      b._flow = flow;
      if (ready(b)) b.state = Math.abs(flow) > EPS ? 'working' : 'idle';
    }
    /* consumers: ratio (× own cable limit) applied by Economy/Defense next tick */
    for (let k = 0; k < cons.length; k++) {
      const c = cons[k], dW = c._demandW;
      if (dW > 0) { const cap = P.capOf.get(c.uid) || 0; c._powerRatio = ratio * (dW <= cap ? 1 : cap / dW); }
      else c._powerRatio = ratio;
    }
    gr.gen = usedFree + usedFuel; gr.genCap = pFree + pFuel; gr.use = use; gr.served = served; gr.ratio = ratio;
    gr.stored = stored + (charged - usedBatt) * dt / 1e6; gr.cap = capMJ; gr.batt = charged - usedBatt;
    const s = gr._snap; if (s) { s.gen = gr.gen; s.use = gr.use; s.ratio = gr.ratio; s.stored = gr.stored; s.cap = gr.cap; }
    /* brownout: edge-triggered, once per 30 s per grid */
    if (ratio < BROWNOUT_RATIO && use > EPS && (gr.genCap > EPS || gr.cap > EPS)) {
      if (!gr._brown) {
        gr._brown = true;
        const last = P._brownAt.get(gr.key);
        if (last === undefined || P.clock - last >= BROWNOUT_COOLDOWN) {
          P._brownAt.set(gr.key, P.clock);
          const layer = gr.layers[0];
          if (LD.State && LD.State.log) LD.State.log('Caída de tensión en la capa ' + (layer + 1) + ': demanda cubierta al ' + Math.round(ratio * 100) + ' %', 'warn');
          LD.Events.emit('power:brownout', { layer, grid: gr.id, ratio, gen: gr.gen, use });
        }
      }
    } else if (gr._brown && ratio >= BROWNOUT_RATIO) gr._brown = false;
  }
  const k = Math.min(1, dt / EMA_SECONDS);
  for (let L = 0; L < g.layers.length && L < acc.length; L++) {
    const lay = g.layers[L]; if (!lay) continue;
    if (!(lay.energyHandled >= 0)) lay.energyHandled = 0;
    lay.energyHandled += (acc[L] - lay.energyHandled) * k;
  }
};

/* ── queries ── */
P.gridOf = uid => P.gridMap.get(uid) || null;
P.gridsIn = L => P.grids.filter(gr => gr.layers.indexOf(L | 0) >= 0);
P.cableCap = uid => { const c = P.capOf.get(uid); return c === undefined ? 0 : c; };
P.demandOf = i => { if (!i) return 0; if (i._wantPower > 0) return i._wantPower * pow2(i.oc | 0); return i._demandW > 0 ? i._demandW : 0; };
P.genOf = i => {
  if (!i) return 0;
  if (typeof i._genCap === 'number') return i._genCap;
  const d = def(i); return d && d.power && d.power.gen > 0 && ready(i) ? d.power.gen : 0;
};
P.outputOf = i => (i && i._powerOut > 0) ? i._powerOut : 0;
P.ratioOf = uid => { const i = inst(uid); if (i && typeof i._powerRatio === 'number') return i._powerRatio; const gr = P.gridMap.get(uid); return gr ? gr.ratio : 0; };
P.setDemand = (uid, watts) => { const i = inst(uid); if (!i) return 0; i._wantPower = watts > 0 ? watts : 0; return P.ratioOf(uid); };
P.fuelState = i => {
  if (!i) return { mj: 0, item: null, burn: 0, seconds: 0, fuels: [] };
  const d = def(i), fuels = (d && d.power && d.power.fuel) || [];
  const mj = i.fuel > 0 ? i.fuel : 0, b = i._burn > 0 ? i._burn : 0;
  return { mj, item: i.fuelItem || null, burn: b, seconds: b > 0 ? mj / b : (mj > 0 ? Infinity : 0), fuels };
};
P.energyHandled = L => { const g = G(); const lay = g && g.layers[L | 0]; return lay && lay.energyHandled > 0 ? lay.energyHandled : 0; };
P.summary = L => {
  L = L | 0;
  const c = P._sum[L];
  if (c && c.tick === P.tickNo) return c.data;
  const out = { gen: 0, genCap: 0, use: 0, served: 0, ratio: 1, stored: 0, cap: 0, batt: 0, grids: 0, producers: [], consumers: [] };
  const pm = new Map(), cm = new Map();
  for (const gr of P.grids) {
    if (gr.layers.indexOf(L) < 0) continue;
    out.grids++; out.gen += gr.gen; out.genCap += gr.genCap; out.use += gr.use; out.served += gr.served; out.stored += gr.stored; out.cap += gr.cap; out.batt += gr.batt;
    for (const p of gr.producers) { let e = pm.get(p.id); if (!e) { e = { id: p.id, count: 0, gen: 0, cap: 0 }; pm.set(p.id, e); } e.count++; e.gen += p._powerOut > 0 ? p._powerOut : 0; e.cap += p._genCap > 0 ? p._genCap : 0; }
    for (const q of gr.consumers) { let e = cm.get(q.id); if (!e) { e = { id: q.id, count: 0, use: 0 }; cm.set(q.id, e); } e.count++; e.use += q._demandW > 0 ? q._demandW : 0; }
  }
  out.ratio = out.use > EPS ? Math.min(1, out.served / out.use) : 1;
  out.producers = Array.from(pm.values()).sort((a, b) => b.gen - a.gen);
  out.consumers = Array.from(cm.values()).sort((a, b) => b.use - a.use);
  P._sum[L] = { tick: P.tickNo, data: out };
  return out;
};

/* ── lifecycle ── */
P.init = () => {
  resetState();
  const g = G(); if (!g) return;
  for (let L = 0; L < g.layers.length; L++) P.rebuild(L);
};
const markDirty = p => {
  const uid = p && typeof p === 'object' ? p.uid : p;
  const i = inst(uid), gr = P.gridMap.get(uid);
  if (i) P.dirty[i.layer | 0] = true;
  else if (gr) for (const L of gr.layers) P.dirty[L] = true;
};
LD.Events.on('structure:placed', markDirty);
LD.Events.on('structure:built', markDirty);
LD.Events.on('structure:removed', markDirty);
LD.Events.on('game:new', resetState);
LD.Events.on('game:loaded', resetState);
})();
