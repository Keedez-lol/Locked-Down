(() => {
'use strict';
const LD = window.LD;
LD.Sim = LD.Sim || {};

const CRYO = new Set(['liquid_nitrogen', 'deuterium', 'tritium', 'helium3', 'cryo_coolant', 'liquid_hydrogen']);
const LUBRICANT = 'lubricant', LUBE_RATE = 0.005, LUBE_MIN = 0.01, EPS = 1e-9;
const NEIGH = [[1, 0], [-1, 0], [0, 1], [0, -1]];

const F = LD.Sim.Fluids = {
  nets: [],            // nets[L] = [net]; net = { id, layer, tanks:[uid], members:[uid], memberSet, fluids:{id:{amt,cap}}, links, reach }
  netOf: new Map(),    // uid → net
  rateOf: new Map(),   // uid → adjacent pipe rate (0 = not connected, Infinity = touches a fluid structure directly)
  dirty: [],           // dirty[L] = true → rebuild pending
  clock: 0,
  _G: null, _nextId: 1, _bank: new Map(), _shaftBank: new Map(), _fluidCache: new Map()
};

/* ── helpers ── */
const reg = () => LD.Registry;
const def = inst => (inst && reg()) ? reg().structure(inst.id) : null;
const G = () => LD.G;
const inst = uid => { const g = G(); return g && g.structures ? g.structures[uid] || null : null; };
const size = d => (d && d.size) || 1;

F.isFluid = id => {
  const R = reg(); if (!R) return false;
  const it = R.item(id);
  return !!it && (it.cat === 'fluid' || it.cat === 'gas');
};
F.isCryo = id => { const R = reg(), it = R && R.item(id); return CRYO.has(id) || !!(it && it.cryo); };

/* def handles fluids: tank, pipe, shaft, elevator, any fluid I/O slot, fluid fuels, machines with recipe types */
const hasFluidKey = o => { if (!o) return false; for (const k in o) if (F.isFluid(k)) return true; return false; };
F.handlesFluid = d => {
  if (!d) return false;
  const c = F._fluidCache;
  if (c.has(d.id)) return c.get(d.id);
  let v = !!(d.tank || d.pipe || d.overlay === 'pipe' || d.shaft || d.elevator || d.types);
  if (!v) {
    const p = d.power, n = d.nature, x = d.extract, b = d.burn, bo = d.borer;
    v = !!((p && (p.fluidIn || p.fluidOut || (p.fuel && p.fuel.some(F.isFluid))))
      || (x && (x.fluid || hasFluidKey(x.consumes)))
      || (n && (hasFluidKey(n.out) || hasFluidKey(n.consumes) || hasFluidKey(n.byproducts)))
      || (b && (b.fluidIn || (b.fuels && b.fuels.some(F.isFluid))))
      || (bo && hasFluidKey(bo.consumes))
      || hasFluidKey(d.consumes) || hasFluidKey(d.fluidIn) || hasFluidKey(d.fluidOut));
  }
  c.set(d.id, v);
  return v;
};

/* tile lookups: World when present, else maps built from G.structures during rebuild */
let fbPipe = null, fbOcc = null;
const KEYW = 4096;
const pipeAt = (L, x, y) => { const W = LD.World; if (W && W.pipeAt) return W.pipeAt(L, x, y); return fbPipe ? (fbPipe.get(y * KEYW + x) || null) : null; };
const uidAt = (L, x, y) => { const W = LD.World; if (W && W.uidAt) return W.uidAt(L, x, y); return fbOcc ? (fbOcc.get(y * KEYW + x) || null) : null; };

/* per-uid throughput bank: pipeRate units per second, banked up to one second's worth */
const bank = uid => {
  const rate = F.rateOf.get(uid) || 0;
  if (rate === Infinity) return Infinity;
  if (rate <= 0) return 0;
  let b = F._bank.get(uid);
  if (!b) { b = { v: rate, at: F.clock }; F._bank.set(uid, b); }
  if (b.at !== F.clock) { b.v = Math.min(rate, b.v + rate * (F.clock - b.at)); b.at = F.clock; }
  return b.v;
};
const spend = (uid, n) => { const b = F._bank.get(uid); if (b) b.v = Math.max(0, b.v - n); };
const shaftBank = sh => {
  let b = F._shaftBank.get(sh.uid);
  if (!b) { b = { v: sh.rate, at: F.clock }; F._shaftBank.set(sh.uid, b); }
  if (b.at !== F.clock) { b.v = Math.min(sh.rate, b.v + sh.rate * (F.clock - b.at)); b.at = F.clock; }
  return b.v;
};
const pathCap = shafts => { let c = Infinity; for (let k = 0; k < shafts.length; k++) c = Math.min(c, shaftBank(shafts[k])); return c; };
const spendPath = (shafts, n) => { for (let k = 0; k < shafts.length; k++) { const b = F._shaftBank.get(shafts[k].uid); if (b) b.v = Math.max(0, b.v - n); } };

/* ── tanks (net._tanks = [{ uid, i, cap, cryo }]) ── */
const ensureTank = i => { if (!i.tank || typeof i.tank !== 'object') i.tank = { fluid: null, amt: 0, lock: null }; else if (i.tank.lock === undefined) i.tank.lock = null; return i.tank; };
const canHold = (e, fluid) => {
  const t = e.i.tank;
  if (t.fluid && t.fluid !== fluid) return false;
  if (t.lock && t.lock !== fluid) return false;
  return e.cryo || !F.isCryo(fluid);
};
F.canHold = (uid, fluid) => {
  const i = inst(uid), d = def(i);
  if (!d || !d.tank) return false;
  ensureTank(i);
  return canHold({ i, cryo: !!d.tank.cryo }, fluid);
};

const drainNet = (net, fluid, n) => {
  let got = 0;
  const tanks = net._tanks;
  while (n - got > EPS) {
    let best = null, bestAmt = 0;
    for (let k = 0; k < tanks.length; k++) { const t = tanks[k].i.tank; if (t.fluid === fluid && t.amt > bestAmt) { best = t; bestAmt = t.amt; } }
    if (!best) break;
    const d = Math.min(best.amt, n - got);
    best.amt -= d; got += d;
    if (best.amt <= EPS) { best.amt = 0; if (!best.lock) best.fluid = null; }
  }
  if (got > 0) net._dirty = true;
  return got;
};
const fillNet = (net, fluid, n) => {
  let put = 0;
  const tanks = net._tanks;
  for (let pass = 0; pass < 2 && n - put > EPS; pass++) {
    for (let k = 0; k < tanks.length && n - put > EPS; k++) {
      const e = tanks[k], t = e.i.tank;
      if (pass === 0 ? t.fluid !== fluid : t.fluid !== null) continue;
      if (!canHold(e, fluid)) continue;
      const room = e.cap - t.amt;
      if (room <= EPS) continue;
      const d = Math.min(room, n - put);
      t.fluid = fluid; t.amt += d; put += d;
    }
  }
  if (put > 0) net._dirty = true;
  return put;
};
const amountIn = (net, fluid) => { let s = 0; const tanks = net._tanks; for (let k = 0; k < tanks.length; k++) { const t = tanks[k].i.tank; if (t.fluid === fluid) s += t.amt; } return s; };
const spaceIn = (net, fluid) => {
  let s = 0; const tanks = net._tanks;
  for (let k = 0; k < tanks.length; k++) { const e = tanks[k]; if (canHold(e, fluid)) s += Math.max(0, e.cap - e.i.tank.amt); }
  return s;
};
const refreshNet = net => {
  if (!net._dirty) return net.fluids;
  const out = {};
  for (const e of net._tanks) {
    const t = e.i.tank; if (!t.fluid) continue;
    const f = out[t.fluid] || (out[t.fluid] = { amt: 0, cap: 0 });
    f.amt += t.amt; f.cap += e.cap;
  }
  net.fluids = out; net._dirty = false;
  return out;
};

/* ── rebuild ── */
const resetState = () => {
  F.nets = []; F.netOf = new Map(); F.rateOf = new Map(); F.dirty = []; F._bank = new Map(); F._shaftBank = new Map(); F._nextId = 1;
  F._G = G();
};
const checkG = () => {
  const g = G();
  if (g !== F._G) { resetState(); if (g) for (let L = 0; L < g.layers.length; L++) F.dirty[L] = true; }
  return g;
};

F.rebuild = L => {
  const g = checkG(); if (!g || !reg()) return;
  L = L | 0;
  const useFallback = !(LD.World && LD.World.uidAt && LD.World.pipeAt);
  if (useFallback) { fbPipe = new Map(); fbOcc = new Map(); }
  const uids = [], insts = [], defs = [], index = new Map();
  for (const uid in g.structures) {
    const i = g.structures[uid];
    if (!i || i.layer !== L) continue;
    const d = def(i); if (!d) continue;
    if (useFallback) {
      const s = size(d);
      if (d.overlay) { if (d.overlay === 'pipe') fbPipe.set(i.y * KEYW + i.x, uid); }
      else for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) fbOcc.set((i.y + dy) * KEYW + i.x + dx, uid);
    }
    if ((d.overlay && d.overlay !== 'pipe') || i.build || !F.handlesFluid(d)) continue;
    index.set(uid, uids.length); uids.push(uid); insts.push(i); defs.push(d);
    if (d.tank) ensureTank(i);
  }
  const n = uids.length, parent = new Int32Array(n), rates = new Float64Array(n);
  for (let k = 0; k < n; k++) parent[k] = k;
  const find = a => { let r = a; while (parent[r] !== r) r = parent[r]; while (parent[a] !== r) { const t = parent[a]; parent[a] = r; a = t; } return r; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };
  let k = 0, best = 0, direct = false;
  const visit = (nx, ny) => {
    const p = pipeAt(L, nx, ny), pj = p ? index.get(p) : undefined;
    if (pj !== undefined && pj !== k) { union(k, pj); const r = defs[pj].pipe; if (r && r.rate > best) best = r.rate; }
    const u = uidAt(L, nx, ny), uj = u ? index.get(u) : undefined;
    if (uj !== undefined && uj !== k) { union(k, uj); if (!defs[uj].overlay) direct = true; }
  };
  for (k = 0; k < n; k++) {
    const i = insts[k], d = defs[k], s = size(d), isPipe = d.overlay === 'pipe';
    best = 0; direct = false;
    if (isPipe || s === 1) { for (let q = 0; q < 4; q++) visit(i.x + NEIGH[q][0], i.y + NEIGH[q][1]); }
    else for (let q = 0; q < s; q++) { visit(i.x + q, i.y - 1); visit(i.x + q, i.y + s); visit(i.x - 1, i.y + q); visit(i.x + s, i.y + q); }
    rates[k] = isPipe ? (d.pipe && d.pipe.rate > 0 ? d.pipe.rate : Infinity) : direct ? Infinity : best;
  }
  const old = F.nets[L] || [];
  for (const net of old) for (const uid of net.members) { F.netOf.delete(uid); F.rateOf.delete(uid); if (!index.has(uid)) F._bank.delete(uid); }
  const byRoot = new Map();
  for (let k = 0; k < n; k++) {
    const r = find(k), uid = uids[k], d = defs[k];
    let net = byRoot.get(r);
    if (!net) { net = { id: F._nextId++, layer: L, tanks: [], members: [], memberSet: new Set(), fluids: {}, shafts: [], hasElevator: false, links: [], reach: [], _tanks: [], _dirty: true }; byRoot.set(r, net); }
    net.members.push(uid); net.memberSet.add(uid);
    F.netOf.set(uid, net); F.rateOf.set(uid, rates[k]);
    if (d.tank) { net.tanks.push(uid); net._tanks.push({ uid, i: insts[k], cap: d.tank.cap > 0 ? d.tank.cap : 0, cryo: !!d.tank.cryo }); }
    if (d.shaft) net.shafts.push({ uid, layer: d.shaft.layer | 0, rate: d.shaft.rate > 0 ? d.shaft.rate : Infinity });
    if (d.elevator) net.hasElevator = true;
  }
  F.nets[L] = Array.from(byRoot.values());
  F.dirty[L] = false;
  relink();
  if (useFallback) { fbPipe = null; fbOcc = null; }
};

/* shaft head ↔ elevator nets of shaft.layer: throughput budget per shaft; reach lists carry the shafts on the path */
const relink = () => {
  for (const arr of F.nets) if (arr) for (const net of arr) { net.links.length = 0; net.reach.length = 0; }
  for (const arr of F.nets) if (arr) for (const net of arr) for (const sh of net.shafts) {
    if (sh.layer === net.layer) continue;
    for (const other of (F.nets[sh.layer] || [])) if (other.hasElevator) { net.links.push({ net: other, shaft: sh }); other.links.push({ net, shaft: sh }); }
  }
  for (const arr of F.nets) if (arr) for (const net of arr) {
    const seen = new Set([net]), queue = [{ net, path: [] }];
    for (let q = 0; q < queue.length; q++) {
      const cur = queue[q];
      for (const link of cur.net.links) {
        if (seen.has(link.net)) continue;
        seen.add(link.net);
        const path = cur.path.concat(link.shaft);
        net.reach.push({ net: link.net, shafts: path });
        queue.push({ net: link.net, path });
      }
    }
  }
};

/* ── queries ── */
F.networkOf = uid => F.netOf.get(uid) || null;
F.pipeRate = uid => { const r = F.rateOf.get(uid); return r === undefined ? 0 : r; };
F.budgetLeft = uid => bank(uid);
F.shaftBudget = uid => {
  const net = F.netOf.get(uid);
  if (net) for (const sh of net.shafts) if (sh.uid === uid) return shaftBank(sh);
  return 0;
};
F.available = (uid, fluid) => {
  const net = F.netOf.get(uid); if (!net) return 0;
  let s = amountIn(net, fluid);
  for (let k = 0; k < net.reach.length; k++) s += amountIn(net.reach[k].net, fluid);
  return s;
};
F.space = (uid, fluid) => {
  const net = F.netOf.get(uid); if (!net) return 0;
  let s = spaceIn(net, fluid);
  for (let k = 0; k < net.reach.length; k++) s += spaceIn(net.reach[k].net, fluid);
  return s;
};
F.take = (uid, fluid, n) => {
  if (!(n > 0)) return 0;
  const net = F.netOf.get(uid); if (!net) return 0;
  n = Math.min(n, bank(uid)); if (n <= EPS) return 0;
  let got = drainNet(net, fluid, n);
  for (let k = 0; k < net.reach.length && n - got > EPS; k++) {
    const r = net.reach[k], cap = Math.min(n - got, pathCap(r.shafts));
    if (cap <= EPS) continue;
    const d = drainNet(r.net, fluid, cap);
    if (d > 0) { spendPath(r.shafts, d); got += d; }
  }
  spend(uid, got);
  return got;
};
F.give = (uid, fluid, n) => {
  if (!(n > 0)) return 0;
  const net = F.netOf.get(uid); if (!net) return 0;
  n = Math.min(n, bank(uid)); if (n <= EPS) return 0;
  let put = fillNet(net, fluid, n);
  for (let k = 0; k < net.reach.length && n - put > EPS; k++) {
    const r = net.reach[k], cap = Math.min(n - put, pathCap(r.shafts));
    if (cap <= EPS) continue;
    const d = fillNet(r.net, fluid, cap);
    if (d > 0) { spendPath(r.shafts, d); put += d; }
  }
  spend(uid, put);
  if (put > 0) discover(fluid);
  return put;
};
const discover = id => {
  const g = G(); if (!g || !g.discovered || g.discovered.items[id]) return;
  const Ec = LD.Sim.Economy;
  if (Ec && Ec.discover) { Ec.discover(id); return; }
  g.discovered.items[id] = true;
  LD.Events.emit('item:discovered', id);
};

/* lubricant: presence on the network; consumption bypasses the machine's own pipe budget (0.005/s is negligible) */
F.hasLubricant = uid => F.available(uid, LUBRICANT) >= LUBE_MIN;
F.consumeLubricant = (uid, dt) => {
  const net = F.netOf.get(uid); if (!net) return false;
  if (F.available(uid, LUBRICANT) < LUBE_MIN) return false;
  let n = LUBE_RATE * (dt > 0 ? dt : 0);
  n -= drainNet(net, LUBRICANT, n);
  for (let k = 0; k < net.reach.length && n > EPS; k++) { const r = net.reach[k], d = drainNet(r.net, LUBRICANT, n); spendPath(r.shafts, d); n -= d; }
  return true;
};

/* ── tanks API ── */
F.tankInfo = uid => {
  const i = inst(uid), d = def(i);
  if (!d || !d.tank) return null;
  const t = ensureTank(i);
  return { fluid: t.fluid, amt: t.amt, cap: d.tank.cap > 0 ? d.tank.cap : 0, lock: t.lock, cryo: !!d.tank.cryo };
};
F.setTankFluid = (uid, fluid) => {
  const i = inst(uid), d = def(i);
  if (!d || !d.tank) return false;
  const t = ensureTank(i);
  if (fluid === null || fluid === undefined) { t.fluid = null; t.amt = 0; t.lock = null; }
  else {
    if (!F.isFluid(fluid) || (F.isCryo(fluid) && !d.tank.cryo)) return false;
    if (t.fluid !== fluid) t.amt = 0;
    t.fluid = fluid; t.lock = fluid;
  }
  const net = F.netOf.get(uid); if (net) net._dirty = true;
  return true;
};
F.summary = L => {
  const out = [];
  for (const net of (F.nets[L | 0] || [])) {
    const fl = refreshNet(net);
    for (const id in fl) out.push({ fluid: id, amt: fl[id].amt, cap: fl[id].cap, netId: net.id });
  }
  return out;
};
F.netSummary = L => (F.nets[L | 0] || []).map(net => {
  let free = 0; for (const e of net._tanks) if (!e.i.tank.fluid) free += e.cap;
  return { id: net.id, layer: net.layer, tanks: net.tanks.length, members: net.members.length, fluids: refreshNet(net), freeCap: free, links: net.links.length };
});
/* debug/cheat: put fluid into the tanks of a layer, ignoring pipe budgets */
F.inject = (L, fluid, n) => {
  if (!F.isFluid(fluid) || !(n > 0)) return 0;
  let put = 0;
  for (const net of (F.nets[L | 0] || [])) { put += fillNet(net, fluid, n - put); if (n - put <= EPS) break; }
  if (put > 0) discover(fluid);
  return put;
};

/* ── lifecycle ── */
F.init = () => {
  resetState();
  const g = G(); if (!g) return;
  for (let L = 0; L < g.layers.length; L++) F.rebuild(L);
};
F.tick = dt => {
  const g = checkG(); if (!g) return;
  F.clock += dt > 0 ? dt : 0;
  for (let L = 0; L < F.dirty.length; L++) if (F.dirty[L]) F.rebuild(L);
  /* powered tanks (cryogenic) draw their power while holding fluid */
  const P = LD.Sim.Power;
  if (P && P.setDemand) for (const arr of F.nets) if (arr) for (const net of arr) for (const e of net._tanks) {
    if (e.i.tank.amt <= 0 || e.i.paused) continue;
    const d = def(e.i); if (d && d.power && d.power.use > 0) P.setDemand(e.uid, d.power.use);
  }
};
const markDirty = p => {
  const uid = p && typeof p === 'object' ? p.uid : p;
  const i = inst(uid), net = F.netOf.get(uid);
  if (i) F.dirty[i.layer | 0] = true;
  else if (net) F.dirty[net.layer] = true;   // removed member: its layer is only known from the old net
};
LD.Events.on('structure:placed', markDirty);
LD.Events.on('structure:built', markDirty);
LD.Events.on('structure:removed', markDirty);
LD.Events.on('game:new', resetState);
LD.Events.on('game:loaded', resetState);
})();
