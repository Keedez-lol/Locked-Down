// Autonomous player: node tools/bot.mjs [hours] [--seed N] [--quiet] [--stuck H] [--dump]
// Plays a NEW GAME on normal difficulty with legitimate actions only (hand gathering with cooldown, paid
// placements, recipes, overclock, research, elevator rules, borers) and prints sim time per era vs the targets.
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, '..', 'dist', 'index.html');
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const HOURS = +(argv.find(a => /^\d+(\.\d+)?$/.test(a)) || 30);
const SEED = +flag('--seed', 42);
const QUIET = argv.includes('--quiet');
const STUCK_H = +flag('--stuck', 4);
const TARGETS = [0, 600, 2400, 7200, 18000, 36000, 64800, 108000];

/* ───────────────────────────── in-page agent ───────────────────────────── */
const AGENT = () => {
'use strict';
const LD = window.LD, R = LD.Registry, U = LD.U, S = LD.Sim;
const Eco = S.Economy, Bd = S.Build, Rs = S.Research, Na = S.Nature, Fl = S.Fluids, Pw = S.Power, W = LD.World, Dbg = LD.Debug;
const G = () => LD.G;
const now = () => LD.G.time.t;
const out = [];
const fmtT = s => { s = Math.floor(s); return String(Math.floor(s / 3600)).padStart(2, '0') + ':' + String(Math.floor(s % 3600 / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
const say = m => out.push('[' + fmtT(now()) + '] ' + m);

const CONVEYORS = ['conveyor_wood', 'conveyor_iron', 'conveyor_steel', 'conveyor_titanium', 'conveyor_quantum'];
const CABLES = ['drive_shaft', 'cable_copper', 'cable_hv', 'cable_super'];
const PIPES = ['pipe_wood', 'pipe_bronze', 'pipe_steel', 'pipe_titanium', 'pipe_quantum'];
const TANKS = ['tank_wood', 'tank_iron', 'tank_steel', 'tank_titanium', 'tank_cryo', 'tank_quantum'];
const WAREHOUSES = ['warehouse_wood', 'warehouse_stone', 'warehouse_steel', 'warehouse_auto', 'silo_quantum'];
const GENERATORS = ['windmill', 'steam_engine', 'coal_plant', 'diesel_generator', 'gas_turbine', 'fission_reactor', 'fusion_reactor'];
const BORERS = ['borer_steam', 'borer_electric', 'borer_laser', 'borer_plasma'];
const LABS_BY_TIER = ['study_table', 'lab_basic', 'lab_industrial', 'lab_quantum'];
const FUELS0 = ['charcoal', 'coal', 'coke', 'peat'];
const DROPS = ['chitin', 'crystal_shard', 'heat_gland', 'void_essence'];
const TERRAIN_ITEM = { stick: 'forest', wood_log: 'forest', stone: 'rock', flint: 'rock', plant_fiber: 'grass', clay: 'clay', sand: 'sand', peat: 'bog', salt: 'saltflat', gravel: 'gravel' };
const MAX_MACH = { hub: 1, workbench: 4, study_table: 3, lab_basic: 3, lab_industrial: 3, lab_quantum: 2 };
const MAXLEN = 70, GATHER_BUDGET = 90;

const st = { cycle: 0, layout: {}, paths: {}, rules: {}, boost: new Map(), waitSince: {}, eras: {}, blocked: {}, tech: null, lastWanted: new Set(), dig: {}, depositWaits: {}, spent: 0, lastGen: 0, extractorRes: {}, noPath: {} };
let ctx = null;

/* ── helpers ── */
const isFluid = id => Fl.isFluid(id);
const count = (L, id) => Eco.count(L, id);
const unlocked = id => Rs.isUnlocked('structure', id);
const recipeOk = id => Rs.isUnlocked('recipe', id);
const afford = (id, L) => Bd.canAfford(id, L);
const structs = L => { const o = []; const S = G().structures; for (const uid in S) if (S[uid].layer === L) o.push(S[uid]); return o; };
const byId = (L, id) => structs(L).filter(s => s.id === id);
const built = s => !s.build && s.state !== 'broken';
const key = (x, y) => x + ',' + y;
const def = s => R.structure(s.id);
const footTiles = (x, y, k) => { const o = []; for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) o.push([x + i, y + j]); return o; };
const neighTiles = (x, y, k) => { const o = []; for (let i = 0; i < k; i++) { o.push([x + i, y - 1], [x + i, y + k]); o.push([x - 1, y + i], [x + k, y + i]); } return o; };
const bestOf = list => { let b = null; for (const id of list) if (unlocked(id)) b = id; return b; };
const bestAffordable = (list, L) => { let b = null; for (const id of list) if (unlocked(id) && afford(id, L)) b = id; return b; };
const techFor = id => R.unlockerOf('structure', id);
const wantTech = (id, why) => { if (!id || Rs.isDone(id)) return; if (!st.boost.has(id)) say('want tech ' + id + (why ? ' (' + why + ')' : '')); st.boost.set(id, now()); };
const conveyorAt = (L, x, y) => { const uid = W.uidAt(L, x, y); if (!uid) return null; const s = G().structures[uid]; return s && def(s).conveyor ? s : null; };
const hubOf = L => { if (L === 0) { for (const s of structs(0)) if (s.id === 'hub') return s; return null; } const l = G().layers[L]; return (l.elevator && G().structures[l.elevator]) || structs(L).find(s => def(s).elevator) || null; };
const dist2 = (a, b, c, d) => (a - c) * (a - c) + (b - d) * (b - d);
const fmtObj = o => Object.keys(o).map(k => o[k] + ' ' + k).join(', ');

/* ── layout: radial streets from the hub/elevator; trunk tiles carry conveyor + pipe + cable overlays ── */
function layoutOf(L) {
  if (st.layout[L]) return st.layout[L];
  const h = hubOf(L); if (!h) return null;
  const k = def(h).size;
  const ring = [];
  for (let y = h.y - 1; y <= h.y + k; y++) for (let x = h.x - 1; x <= h.x + k; x++) if (x === h.x - 1 || y === h.y - 1 || x === h.x + k || y === h.y + k) ring.push([x, y]);
  const mid = h.y + (k === 3 ? 1 : 0), midx = h.x + (k === 3 ? 1 : 0);
  const streets = [
    { x0: h.x + k, y0: mid, dx: 1, dy: 0, len: 0, max: MAXLEN },
    { x0: h.x - 1, y0: mid, dx: -1, dy: 0, len: 0, max: MAXLEN },
    { x0: midx, y0: h.y - 1, dx: 0, dy: -1, len: 0, max: MAXLEN },
    { x0: midx, y0: h.y + k, dx: 0, dy: 1, len: 0, max: MAXLEN }
  ];
  const lo = { L, hub: h, size: k, ring, streets, reserved: new Set(), ringDone: false, branchAt: 12 };
  for (const [x, y] of ring) lo.reserved.add(key(x, y));
  for (const s of streets) reserveStreet(lo, s);
  st.layout[L] = lo;
  return lo;
}
function reserveStreet(lo, s) { for (let i = 0; i < s.max; i++) lo.reserved.add(key(s.x0 + s.dx * i, s.y0 + s.dy * i)); }
const trunkTile = (s, i) => [s.x0 + s.dx * i, s.y0 + s.dy * i];
function placeConveyor(L, x, y) {
  if (conveyorAt(L, x, y)) return true;
  const id = bestOf(CONVEYORS) || 'conveyor_wood';
  const c = W.canPlace(id, L, x, y, 0); if (!c.ok) return 'blocked';
  if (!afford(id, L)) { needCost(id, L, 1); return false; }
  return !!Bd.place(id, L, x, y, 0);
}
/* the ring joins the four streets' cables (the hub conducts fluids but not power) */
function ensureRing(lo) {
  if (lo.ringDone) return true;
  let ok = true;
  for (const [x, y] of lo.ring) { const r = placeConveyor(lo.L, x, y); if (r !== true) ok = false; }
  lo.ringDone = ok;
  return ok;
}
function ensureTrunk(lo, s, upTo) {
  for (let i = s.len; i <= upTo && i < s.max; i++) {
    const [x, y] = trunkTile(s, i);
    const r = placeConveyor(lo.L, x, y);
    if (r === 'blocked') { s.max = i; return false; }
    if (r !== true) return false;
    s.len = i + 1;
  }
  return s.len > upTo;
}
function slotRect(s, i, side, k) {
  if (s.dy === 0) { const x = s.dx > 0 ? s.x0 + i : s.x0 - i - k + 1; return { x, y: side > 0 ? s.y0 + 1 : s.y0 - k }; }
  const y = s.dy > 0 ? s.y0 + i : s.y0 - i - k + 1; return { y, x: side > 0 ? s.x0 + 1 : s.x0 - k };
}
/* a perpendicular branch off a long street (its first tile touches the trunk, so it is linked) */
function addBranch(lo) {
  for (const s of lo.streets.slice()) {
    if (s.len < lo.branchAt + 2) continue;
    for (const side of [1, -1]) {
      const [tx, ty] = trunkTile(s, lo.branchAt);
      const nx = s.dy === 0 ? 0 : side, ny = s.dy === 0 ? side : 0;
      const b = { x0: tx + nx, y0: ty + ny, dx: nx, dy: ny, len: 0, max: MAXLEN, branch: true };
      if (lo.streets.some(o => o.x0 === b.x0 && o.y0 === b.y0)) continue;
      if (!W.canPlace('conveyor_wood', lo.L, b.x0, b.y0, 0).ok && !conveyorAt(lo.L, b.x0, b.y0)) continue;
      lo.streets.push(b); reserveStreet(lo, b);
      say('branch street at ' + b.x0 + ',' + b.y0 + ' L' + lo.L);
      return true;
    }
  }
  lo.branchAt += 12;
  return lo.branchAt < 60;
}
/* nearest free slot beside a trunk for a k×k structure; builds the trunk up to it */
function findSlot(L, id, opts = {}) {
  const lo = layoutOf(L); if (!lo) return null;
  const k = R.structure(id).size || 1;
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < MAXLEN; i++) for (const s of lo.streets) {
      if (i >= s.max || i > s.len + 8) continue;
      for (const side of [1, -1]) {
        const r = slotRect(s, i, side, k);
        let bad = false;
        for (const [x, y] of footTiles(r.x, r.y, k)) if (lo.reserved.has(key(x, y))) { bad = true; break; }
        if (bad) continue;
        if (!W.canPlace(id, L, r.x, r.y, 0).ok) continue;
        if (opts.pred && !opts.pred(r.x, r.y, k)) continue;
        if (!ensureTrunk(lo, s, i + k - 1)) continue;
        if (!W.canPlace(id, L, r.x, r.y, 0).ok) continue;
        return { x: r.x, y: r.y, street: s, i };
      }
    }
    if (!addBranch(lo)) break;
  }
  return null;
}
function buildInSlot(L, id, opts = {}) {
  if (!unlocked(id)) { wantTech(techFor(id), 'for ' + id); return null; }
  if (!afford(id, L)) { needCost(id, L, 1); return null; }
  const sp = findSlot(L, id, opts);
  if (!sp) { say('no slot for ' + id + ' on L' + L); return null; }
  if (!afford(id, L)) { needCost(id, L, 1); return null; }
  const uid = Bd.place(id, L, sp.x, sp.y, 0);
  if (!uid) { say('place failed ' + id + ' at ' + sp.x + ',' + sp.y + ': ' + W.canPlace(id, L, sp.x, sp.y, 0).reason); return null; }
  say('built ' + id + ' L' + L + ' @' + sp.x + ',' + sp.y + (opts.why ? ' — ' + opts.why : ''));
  st.spent++;
  afterBuild(uid);
  return uid;
}
function needCost(id, L, n) { const c = Bd.cost(id); for (const k in c) needOn(L, k, c[k] * n, 'cost of ' + id); }

/* ── conveyor path from a footprint to the linked network (BFS over free tiles and existing conveyors) ── */
function findPath(L, fx, fy, k) {
  const lay = W.layers[L], convId = bestOf(CONVEYORS) || 'conveyor_wood';
  const start = neighTiles(fx, fy, k).filter(([x, y]) => x >= 0 && y >= 0 && x < lay.w && y < lay.h);
  const goalAt = (x, y) => { const uid = W.uidAt(L, x, y); if (!uid) return false; const s = G().structures[uid], d = def(s); return d.id === 'hub' || !!d.elevator || (!!d.conveyor && Eco.isLinked(uid)); };
  for (const [x, y] of start) if (goalAt(x, y)) return [];
  const prev = new Map(), q = [];
  const pass = (x, y) => { if (x < 0 || y < 0 || x >= lay.w || y >= lay.h) return false; if (conveyorAt(L, x, y)) return true; return W.canPlace(convId, L, x, y, 0).ok; };
  for (const [x, y] of start) if (pass(x, y)) { prev.set(key(x, y), null); q.push([x, y]); }
  let goal = null, n = 0, qi = 0;
  while (qi < q.length && n++ < 25000) {
    const [x, y] = q[qi++];
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      const kk = key(nx, ny); if (prev.has(kk)) continue;
      if (goalAt(nx, ny)) { goal = [x, y]; break; }
      if (!pass(nx, ny)) continue;
      prev.set(kk, [x, y]); q.push([nx, ny]);
    }
    if (goal) break;
  }
  if (!goal) return null;
  const path = []; for (let p = goal; p; p = prev.get(key(p[0], p[1]))) path.push(p);
  return path;   // network end first
}
function connect(L, fx, fy, k, why) {
  const path = findPath(L, fx, fy, k);
  if (!path) return null;
  const convId = bestOf(CONVEYORS) || 'conveyor_wood';
  for (const [x, y] of path) { const r = placeConveyor(L, x, y); if (r !== true) { if (r === 'blocked') return null; needCost(convId, L, path.length); return 'pending'; } }
  if (path.length) say('conveyor path ' + path.length + ' tiles L' + L + (why ? ' for ' + why : ''));
  return path.slice().reverse();
}
/* overlays (cable/pipe) along the trunk and along registered paths */
function overlayAt(kind, L, x, y) { const uid = kind === 'cable' ? W.cableAt(L, x, y) : W.pipeAt(L, x, y); return uid ? G().structures[uid] : null; }
function placeOverlay(kind, L, x, y, minCap) {
  const list = kind === 'cable' ? CABLES : PIPES;
  const capOf = id => { const d = R.structure(id); return kind === 'cable' ? d.cable.cap : d.pipe.rate; };
  const cur = overlayAt(kind, L, x, y);
  if (cur && (!minCap || capOf(cur.id) >= minCap)) return true;
  let id = null;
  for (const c of list) if (unlocked(c) && (!minCap || capOf(c) >= minCap)) { id = c; break; }
  if (!id) {
    if (cur) { const nxt = list.find(c => !unlocked(c) && capOf(c) >= minCap); if (nxt) wantTech(techFor(nxt), kind + ' cap ' + minCap); return false; }
    id = bestOf(list); if (!id) return false;
  }
  if (cur && cur.id === id) return true;
  if (!afford(id, L)) { needCost(id, L, 1); return false; }
  if (!W.canPlace(id, L, x, y, 0).ok && !cur) return false;
  if (cur) Bd.dismantle(cur.uid);
  return !!Bd.place(id, L, x, y, 0);
}
function trunkTiles(L) {
  const lo = layoutOf(L), tiles = [];
  if (!lo) return tiles;
  for (const t of lo.ring) tiles.push(t);
  for (const s of lo.streets) for (let i = 0; i < s.len; i++) tiles.push(trunkTile(s, i));
  return tiles;
}
function ensureOverlay(kind, L) {
  const lo = layoutOf(L); if (!lo) return false;
  if (kind === 'cable' && !ensureRing(lo)) { const c = Bd.cost(bestOf(CONVEYORS) || 'conveyor_wood'); for (const k in c) needOn(L, k, c[k] * 16, 'ring L' + L); }
  let ok = true, placed = 0;
  const all = trunkTiles(L);
  for (const uid in st.paths) { const p = st.paths[uid]; if (p.L === L && p[kind]) for (const t of p.tiles) all.push(t); }
  for (const [x, y] of all) { if (!conveyorAt(L, x, y)) continue; if (overlayAt(kind, L, x, y)) continue; if (placeOverlay(kind, L, x, y, 0)) placed++; else { ok = false; break; } }
  if (placed) say(kind + ' overlay +' + placed + ' tiles L' + L);
  return ok;
}
/* the cable/pipe touching a structure must carry its demand/output */
function fixOverlayCap(s, kind, cap) {
  const L = s.layer, k = def(s).size || 1;
  for (const [x, y] of neighTiles(s.x, s.y, k)) { if (!conveyorAt(L, x, y)) continue; if (placeOverlay(kind, L, x, y, cap)) return true; }
  return false;
}
function afterBuild(uid) {
  const s = G().structures[uid]; if (!s) return;
  const d = def(s), L = s.layer;
  if (d.power && (d.power.use > 0 || d.power.gen > 0)) { ensureOverlay('cable', L); fixOverlayCap(s, 'cable', d.power.use || d.power.gen); if (d.power.use > 0) ensurePower(L); }
  if (d.shaft || d.elevator) { ensureOverlay('cable', L); ensureOverlay('pipe', L); }
  const needsPipe = Fl.handlesFluid(d) && !d.conveyor && !d.tank && !d.types;
  if (needsPipe || d.tank) ensureOverlay('pipe', L);
  for (const f of fluidsNeeded(s)) needFluidRate(f, 0.1, L);
}

/* ── elevator rules & lower-layer supply ── */
function rulesOf(L) { return st.rules[L] || (st.rules[L] = {}); }
function needOn(L, item, n, why) {
  if (L === 0 || isFluid(item)) return need(item, n, 0, why);
  const r = rulesOf(L), cur = r[item];
  if (!cur || cur.mode === 'down') r[item] = { mode: 'down', keep: Math.max(n, cur ? cur.keep : 0), until: now() + 900 };
  else cur.until = now() + 900;
  if (count(L, item) >= n) return 'ok';
  return need(item, n + Math.max(0, n - count(L, item)), 0, why + ' (L' + L + ')');
}
function keepOn(L, item, n) { const r = rulesOf(L); r[item] = { mode: 'keep', keep: n, until: now() + 3600 }; }
function applyRules(L) {
  const r = rulesOf(L), rules = [{ item: '*', mode: 'up', keep: 0 }];
  for (const item in r) { if (r[item].until < now()) { delete r[item]; continue; } rules.push({ item, mode: r[item].mode, keep: r[item].keep }); }
  for (const e of structs(L)) if (def(e).elevator) Eco.setElevatorRules(e.uid, rules);
}

/* ── items ── */
function ensureCap(L, item, n) {
  if (isFluid(item)) return true;
  const cap = Eco.cap(L, item);
  if (cap >= n) return true;
  const id = bestAffordable(WAREHOUSES, L);
  if (id) { if (buildInSlot(L, id, { why: 'cap ' + item + ' ' + cap + '→' + n })) return true; }
  else {
    const best = bestOf(WAREHOUSES);
    if (best) needCost(best, L, 1);
    const nxt = WAREHOUSES.find(w => !unlocked(w)); if (nxt) wantTech(techFor(nxt), 'storage cap ' + n);
  }
  return false;
}
function natureMakes(d, item) {
  const n = d.nature; if (!n) return false;
  if (n.out && n.out[item]) return true;
  if (n.byproducts && n.byproducts[item]) return true;
  if (d.id === 'woodcutter') return item === 'wood_log' || item === 'resin';
  if (d.id === 'gather_hut') return ['stick', 'plant_fiber', 'stone', 'flint', 'clay', 'sand', 'peat', 'salt', 'gravel'].includes(item);
  return false;
}
function providersOf(item, L) {
  const o = [];
  for (const s of structs(L)) {
    const d = def(s);
    if (d.types) { if (s.recipe) { const rc = R.recipe(s.recipe); if (rc && rc.out[item]) o.push(s); } continue; }
    if (d.extract && !d.borer) { if (st.extractorRes[s.uid] === item) o.push(s); else { const deps = Eco.depositsOf(s.uid); if (deps.some(k => { const dp = G().layers[L].deposits[k]; return dp && dp.res === item; })) o.push(s); } continue; }
    if (d.nature && natureMakes(d, item)) o.push(s);
  }
  return o;
}
function natureStructuresFor(item) { const o = []; for (const d of R.structures.values()) if (d.nature && !d.extract && natureMakes(d, item)) o.push(d.id); return o; }
function depositLayersFor(item) { const o = []; for (const l of R.layers) if ((l.deposits || []).some(d => d.res === item)) o.push(l.idx); return o; }
function maxProviders(item) { return isFluid(item) ? 2 : 3; }
function fluidAmount(item, L) { let a = 0; for (const s of Fl.summary(L)) if (s.fluid === item) a += s.amt; return a; }

/* main entry: make sure inv[L] reaches n of item; returns 'ok' | 'pending' | 'blocked…' */
function need(item, n, L, why, depth = 0) {
  L = L | 0;
  if (!R.item(item)) return 'blocked';
  if (isFluid(item)) return needFluid(item, n, L, why, depth);
  ctx.want.add(item);
  const have = count(L, item);
  if (have >= n) return 'ok';
  if (depth > 14) return 'deep';
  const kk = L + ':' + item;
  if (ctx.stack.has(kk)) return 'cycle';
  ctx.stack.add(kk);
  try {
    ensureCap(L, item, n);
    const missing = n - have;
    let provs = providersOf(item, L);
    if (!provs.length) {
      const r = createProvider(item, missing, L, depth, why, false);
      if (r === 'ok') provs = providersOf(item, L); else { st.blocked[item] = r; return r; }
    }
    delete st.blocked[item];
    let active = 0;
    for (const p of provs) { if (p.build) { active++; continue; } maintain(p, item, missing, depth); if (p.state === 'working' || (def(p).nature && p.state === 'no_input') || (def(p).types && p.state === 'no_input')) active++; }
    if (active) {
      const rate = (Eco.rates[L][item] || { plus: 0 }).plus, eta = rate > 0 ? missing / rate : Infinity;
      st.waitSince[kk] = st.waitSince[kk] || now();
      if (now() - st.waitSince[kk] > 240 && eta > 300 && provs.length < maxProviders(item)) { const r = createProvider(item, missing, L, depth, 'scale ' + item, true); if (r === 'ok') st.waitSince[kk] = now(); }
    } else delete st.waitSince[kk];
    return 'pending';
  } finally { ctx.stack.delete(kk); }
}

/* fluids live in tanks on the trunk network */
function ensureTank(item, L, minCap = 0) {
  if (L > 0 && item === 'water') return true;   // via the shaft from the surface
  const tanks = structs(L).filter(s => def(s).tank && !s.build);
  const has = tanks.find(s => s.tank && s.tank.fluid === item);
  if (has && (!minCap || def(has).tank.cap >= minCap)) return true;
  const cryo = Fl.isCryo(item);
  const free = tanks.find(s => s.tank && !s.tank.fluid && !s.tank.lock && (!cryo || def(s).tank.cryo) && def(s).tank.cap >= minCap);
  if (free) { Fl.setTankFluid(free.uid, item); say('tank ' + free.id + ' assigned to ' + item); return true; }
  const cands = TANKS.filter(t => unlocked(t) && (!cryo || R.structure(t).tank.cryo) && R.structure(t).tank.cap >= minCap);
  const id = cands.filter(t => afford(t, L)).pop() || cands.pop();
  if (!id) { const nxt = TANKS.find(t => !unlocked(t) && (!cryo || R.structure(t).tank.cryo)); if (nxt) wantTech(techFor(nxt), 'tank for ' + item); return false; }
  const uid = buildInSlot(L, id, { why: 'tank ' + item });
  if (uid) { Fl.setTankFluid(uid, item); return true; }
  return false;
}
function needFluidRate(f, rate, L) {
  const k = L + ':' + f; ctx.fluidRate[k] = (ctx.fluidRate[k] || 0) + rate;
  if (L > 0) { ensureOverlay('pipe', L); if (f === 'water') { ensureWater(0); return; } }
  ensureTank(f, L);
  if (f === 'water') ensureWater(L); else need(f, 20, L, 'fluid rate', 1);
}
function waterDemand(L) {
  let d = 0;
  for (const s of structs(L)) {
    if (!built(s)) continue; const dd = def(s);
    if (dd.power && dd.power.fluidIn && dd.power.fluidIn.water) d += dd.power.fluidIn.water;
    if (dd.burn && dd.burn.fluidIn && dd.burn.fluidIn.water) d += dd.burn.fluidIn.water;
    if (dd.nature && dd.nature.consumes && dd.nature.consumes.water) d += dd.nature.consumes.water;
    if (dd.extract && dd.extract.consumes && dd.extract.consumes.water) d += dd.extract.consumes.water;
    if (dd.types && s.recipe) { const rc = R.recipe(s.recipe); if (rc && rc.in.water) d += rc.in.water / rc.time; }
  }
  return d;
}
function ensureWater(L) {
  ensureTank('water', L);
  const wells = structs(L).filter(s => ['well', 'pump_hand', 'pump_electric'].includes(s.id) && !s.build);
  const supply = wells.reduce((a, s) => a + def(s).nature.out.water, 0);
  let demand = waterDemand(0); for (let l = 1; l < 5; l++) if (G().layers[l].unlocked) demand += waterDemand(l);
  demand += ctx.fluidRate['0:water'] || 0;
  if (supply >= demand * 1.3 + 0.15) return true;
  if (wells.length >= 30) return false;
  if (unlocked('pump_electric') && afford('pump_electric', L) && buildNearWater(L, 'pump_electric')) return true;
  return !!buildInSlot(L, 'well', { why: 'water ' + supply.toFixed(2) + '/' + demand.toFixed(2) });
}
function buildNearWater(L, id) {
  const lay = W.layers[L], lo = layoutOf(L), h = lo.hub;
  for (let r = 4; r < 70; r += 2) for (let y = h.y - r; y <= h.y + r; y++) for (let x = h.x - r; x <= h.x + r; x++) {
    if (x < 0 || y < 0 || x >= lay.w || y >= lay.h || Math.max(Math.abs(x - h.x), Math.abs(y - h.y)) !== r) continue;
    if (W.canPlace(id, L, x, y, 0).ok && findPath(L, x, y, 1)) return buildAt(L, id, x, y, 'near water');
  }
  return null;
}
function needFluid(item, n, L, why, depth) {
  ensureTank(item, L);
  const have = fluidAmount(item, L);
  if (have >= n) return 'ok';
  if (item === 'water') { ensureWater(L); return 'pending'; }
  const kk = L + ':' + item; if (ctx.stack.has(kk)) return 'cycle'; ctx.stack.add(kk);
  try {
    let provs = providersOf(item, L);
    if (!provs.length) { const r = createProvider(item, n - have, L, depth, why, false); if (r !== 'ok') { st.blocked[item] = r; return r; } provs = providersOf(item, L); }
    delete st.blocked[item];
    for (const p of provs) if (!p.build) maintain(p, item, n - have, depth);
    return 'pending';
  } finally { ctx.stack.delete(kk); }
}

/* choose how to make an item and set the provider up */
function createProvider(item, missing, L, depth, why, scale) {
  const dl = depositLayersFor(item);
  let depositState = null;
  for (const l of dl) if (G().layers[l].unlocked) { const r = placeExtractor(item, l, why); if (r === 'ok' || r === 'pending') return r; if (r !== 'none') depositState = r; }
  const natAll = natureStructuresFor(item), nat = natAll.filter(unlocked);
  for (const id of nat.sort((a, b) => R.structure(a).tier - R.structure(b).tier)) { if (!afford(id, L)) continue; if (placeNature(id, item, L, why)) return 'ok'; }
  const rcs = R.producers(item).filter(rc => recipeOk(rc.id) && rc.type !== 'build');
  const ranked0 = rcs.map(rc => ({ rc, score: recipeScore(rc, item, L) })).filter(x => x.score > -1e8).sort((a, b) => b.score - a.score);
  let pending0 = false;
  for (const { rc } of ranked0) { if (Object.keys(rc.in).some(k => !isFluid(k) && count(L, k) < rc.in[k] && !providersOf(k, L).length)) continue; const m = ensureMachineFor(rc, L, why, scale); if (m === 'ok') return 'ok'; if (m === 'pending') pending0 = true; }
  if (nat.length) {
    if (TERRAIN_ITEM[item] && L === 0 && !scale) gatherNow(item, Math.min(missing, 40));
    needCost(nat[0], L, 1);
    return 'pending';
  }
  if (TERRAIN_ITEM[item] && L === 0) {
    if (natAll.length) wantTech(techFor(natAll[0]), item);
    return (scale || pending0 || gatherNow(item, Math.min(missing, 40))) ? 'pending' : 'blocked:gather ' + item;
  }
  if (!rcs.length) {
    if (depositState) return depositState;
    if (dl.length) {
      const l = dl.find(l => !G().layers[l].unlocked);
      if (l !== undefined && !dl.some(l2 => G().layers[l2].unlocked)) { ensureLayer(l, item); return 'blocked:layer' + l; }
      const lu = dl.find(l => G().layers[l].unlocked); st.dig[lu] = now(); st.depositWaits[item] = lu; return 'blocked:excavate L' + lu + ' for ' + item;
    }
    const any = R.producers(item)[0];
    if (any) wantTech(R.unlockerOf('recipe', any.id), item);
    else if (natAll.length) wantTech(techFor(natAll[0]), item);
    return 'blocked:no route ' + item;
  }
  const ranked = rcs.map(rc => ({ rc, score: recipeScore(rc, item, L) })).filter(x => x.score > -1e8).sort((a, b) => b.score - a.score);
  let pending = false;
  for (const { rc } of ranked) { const m = ensureMachineFor(rc, L, why, scale); if (m === 'ok') return 'ok'; if (m === 'pending') pending = true; }
  if (!ranked.length) { for (const rc of rcs) { const ms = machinesForType(rc.type); if (!ms.some(d => unlocked(d.id)) && ms[0]) wantTech(techFor(ms[0].id), rc.id); } return 'blocked:no machine ' + item; }
  return pending ? 'pending' : 'blocked:no machine ' + item;
}
function machinesForType(type) { const o = []; for (const d of R.structures.values()) if (d.types && d.types.includes(type)) o.push(d); return o; }
function recipeScore(rc, item, L) {
  const ms = machinesForType(rc.type).filter(d => unlocked(d.id));
  if (!ms.length) return -1e9;
  if (rc.tier > Math.max(...ms.map(d => d.tier + (d.ocMax | 0)))) return -1e9;
  let s = rc.out[item] / rc.time * 10;
  for (const k in rc.in) {
    const have = count(L, k) + (isFluid(k) ? fluidAmount(k, L) : 0), q = rc.in[k];
    if (have >= q) s += 3; else if (providersOf(k, L).length) s += 1; else if (routeExists(k, L, 0)) s -= 2; else s -= 40;
    if (DROPS.includes(k)) s -= 30;
    s -= q * 0.05;
  }
  return s - rc.tier * 0.5;
}
const routeMemo = new Map();
function routeExists(item, L, depth) {
  if (depth > 6) return false;
  const kk = item + '@' + L; if (routeMemo.has(kk)) return routeMemo.get(kk);
  routeMemo.set(kk, false);
  let ok = false;
  if (TERRAIN_ITEM[item] && L === 0) ok = true;
  else if (depositLayersFor(item).some(l => G().layers[l].unlocked)) ok = true;
  else if (natureStructuresFor(item).some(unlocked)) ok = true;
  else for (const rc of R.producers(item)) { if (!recipeOk(rc.id) || !machinesForType(rc.type).some(d => unlocked(d.id))) continue; if (Object.keys(rc.in).every(k => count(L, k) > 0 || routeExists(k, L, depth + 1))) { ok = true; break; } }
  routeMemo.set(kk, ok);
  return ok;
}
function ensureMachineFor(rc, L, why, scale) {
  const cands = machinesForType(rc.type).filter(d => unlocked(d.id) && d.tier + (d.ocMax | 0) >= rc.tier).sort((a, b) => a.tier - b.tier);
  if (!cands.length) return 'blocked';
  ctx.wantedRecipes.add(rc.id);
  const same = structs(L).filter(s => cands.some(d => d.id === s.id) && s.state !== 'broken');
  if (!scale && same.find(s => s.recipe === rc.id)) return 'ok';
  const idle = same.find(s => !s.build && !s.recipe);
  if (idle && assignRecipe(idle, rc)) return 'ok';
  const maxN = MAX_MACH[cands[0].id] || (cands[0].tier >= 5 ? 3 : 4);
  if (same.length < maxN) {
    const dd = cands.find(d => d.tier >= rc.tier && afford(d.id, L)) || cands.find(d => afford(d.id, L));
    if (dd) { const uid = buildInSlot(L, dd.id, { why: rc.id + (why ? ' ← ' + why : '') }); if (uid) { assignRecipe(G().structures[uid], rc); return 'ok'; } }
    else needCost((cands.find(d => d.tier >= rc.tier) || cands[0]).id, L, 1);
  }
  const stale = same.find(s => !s.build && s.recipe && !ctx.wantedRecipes.has(s.recipe) && !st.lastWanted.has(s.recipe));
  if (stale && assignRecipe(stale, rc)) return 'ok';
  const other = same.find(s => !s.build && s.recipe && !ctx.wantedRecipes.has(s.recipe));
  if (other && assignRecipe(other, rc)) return 'ok';
  return 'pending';
}
function stockRatio(s) { const rc = s.recipe && R.recipe(s.recipe); if (!rc) return 1; let m = 1; for (const o in rc.out) if (!isFluid(o)) m = Math.min(m, count(s.layer, o) / Math.max(1, Eco.cap(s.layer, o))); return m; }
function assignRecipe(s, rc) {
  const d = def(s), needOc = Math.max(0, rc.tier - d.tier);
  if (needOc > (d.ocMax | 0)) return false;
  if ((s.oc | 0) < needOc) Bd.setOverclock(s.uid, needOc);
  if (!Eco.setRecipe(s.uid, rc.id)) { say('setRecipe failed ' + rc.id + ' on ' + s.id); return false; }
  say('recipe ' + rc.id + ' → ' + s.id + (needOc ? ' (OC' + needOc + ')' : ''));
  for (const o in rc.out) if (isFluid(o)) ensureTank(o, s.layer);
  for (const i in rc.in) if (isFluid(i)) ensureTank(i, s.layer);
  if (d.power && d.power.use) fixOverlayCap(s, 'cable', d.power.use * Math.pow(2, s.oc | 0));
  return true;
}
function maintain(p, item, missing, depth) {
  const d = def(p), L = p.layer;
  if (p.state === 'broken') { Bd.repair(p.uid); return; }
  if (d.types && p.recipe) {
    const rc = R.recipe(p.recipe);
    for (const k in rc.in) need(k, Math.min(400, Math.ceil(missing * rc.in[k] / (rc.out[item] || 1))), L, 'input of ' + rc.id, depth + 1);
  }
  if ((d.burn && d.burn.mjPerSec > 0) || (d.power && d.power.fuel)) ensureFuel(L, (d.burn && d.burn.fuels) || d.power.fuel);
  switch (p.state) {
    case 'no_power': ensurePower(L); fixOverlayCap(p, 'cable', d.power.use * Math.pow(2, p.oc | 0)); break;
    case 'no_fluid': for (const f of fluidsNeeded(p)) needFluidRate(f, 0.1, L); if (!Fl.networkOf(p.uid)) ensureOverlay('pipe', L); break;
    case 'no_link': relink(p); break;
    case 'output_full':
      if (p.recipe) { const rc = R.recipe(p.recipe); for (const o in rc.out) { if (isFluid(o)) { ensureTank(o, L); dumpUnwanted(o, L); } else ensureCap(L, o, count(L, o) + 20); } }
      else if (d.extract) { for (const k of Eco.depositsOf(p.uid)) { const dp = G().layers[L].deposits[k]; if (!dp) continue; if (isFluid(dp.res)) { ensureTank(dp.res, L); dumpUnwanted(dp.res, L); } else ensureCap(L, dp.res, count(L, dp.res) + 20); } }
      else if (d.nature) { for (const o in (d.nature.out || {})) if (!isFluid(o)) ensureCap(L, o, count(L, o) + 20); }
      break;
    default: break;
  }
}
function fluidsNeeded(p) {
  const d = def(p), o = [];
  if (d.burn && d.burn.fluidIn) o.push(...Object.keys(d.burn.fluidIn));
  if (d.power && d.power.fluidIn) o.push(...Object.keys(d.power.fluidIn));
  if (d.nature && d.nature.consumes) for (const f in d.nature.consumes) if (isFluid(f)) o.push(f);
  if (d.extract && d.extract.consumes) for (const f in d.extract.consumes) if (isFluid(f)) o.push(f);
  if (d.borer && d.borer.consumes) for (const f in d.borer.consumes) if (isFluid(f)) o.push(f);
  if (p.recipe) { const rc = R.recipe(p.recipe); for (const f in rc.in) if (isFluid(f)) o.push(f); }
  return o;
}
/* byproduct fluid with no consumer and full tanks: empty the tank (the tank panel lets the player do this) */
function dumpUnwanted(fluid, L) {
  if (ctx.want.has(fluid)) return;
  const consumer = structs(L).some(s => { const d = def(s); if (s.recipe) { const rc = R.recipe(s.recipe); if (rc && rc.in[fluid]) return true; } return !!(d.power && d.power.fuel && d.power.fuel.includes(fluid)) || !!(d.burn && d.burn.fuels && d.burn.fuels.includes(fluid)); });
  if (consumer) return;
  for (const s of structs(L)) if (def(s).tank && s.tank && s.tank.fluid === fluid && s.tank.amt >= def(s).tank.cap * 0.95) { Fl.setTankFluid(s.uid, null); Fl.setTankFluid(s.uid, fluid); say('dumped full tank of ' + fluid + ' (no consumer yet)'); }
}
function ensureFuel(L, fuels) {
  const list = (fuels || FUELS0).filter(f => !isFluid(f) && FUELS0.includes(f));
  for (const f of list) if (count(L, f) >= 15) return;
  const f = list.find(f => routeExists(f, 0, 0)) || list[0];
  if (!f) return;
  needOn(L, f, 30, 'fuel');
  if (L > 0 && providersOf(f, L).length) keepOn(L, f, 30);
}
function relink(p) {
  const d = def(p), k = d.size || 1;
  if (st.noPath[p.uid] && now() - st.noPath[p.uid] < 600) return;
  const r = connect(p.layer, p.x, p.y, k, 'relink ' + p.id);
  if (Array.isArray(r) && r.length) registerPath(p, r);
  else if (r === null) st.noPath[p.uid] = now();
}
function registerPath(s, tiles) {
  const d = def(s);
  const cable = !!(d.power && (d.power.use > 0 || d.power.gen > 0));
  const pipe = Fl.handlesFluid(d) && !d.conveyor && !d.tank && !d.types;
  st.paths[s.uid] = { L: s.layer, tiles, cable, pipe };
  if (cable) ensureOverlay('cable', s.layer);
  if (pipe) ensureOverlay('pipe', s.layer);
}
/* place at an explicit tile after checking a conveyor route exists, then link it */
function buildAt(L, id, x, y, why) {
  if (!afford(id, L)) { needCost(id, L, 1); return null; }
  const k = R.structure(id).size || 1;
  if (!findPath(L, x, y, k)) { say('no route to network for ' + id + ' @' + x + ',' + y + ' L' + L); return null; }
  const uid = Bd.place(id, L, x, y, 0);
  if (!uid) { say('place failed ' + id + ' @' + x + ',' + y + ' L' + L + ': ' + W.canPlace(id, L, x, y, 0).reason); return null; }
  say('built ' + id + ' L' + L + ' @' + x + ',' + y + (why ? ' — ' + why : ''));
  st.spent++;
  const s = G().structures[uid];
  const p = connect(L, x, y, k, id);
  if (Array.isArray(p)) registerPath(s, p);
  afterBuild(uid);
  return uid;
}

/* ── nature structures: placed on/near the terrain they exploit ── */
function terrainTiles(L, tid, cx, cy, maxR) {
  const lay = W.layers[L], o = [];
  for (let y = Math.max(0, cy - maxR); y < Math.min(lay.h, cy + maxR); y++) for (let x = Math.max(0, cx - maxR); x < Math.min(lay.w, cx + maxR); x++) if (W.terrainAt(L, x, y) === tid) o.push([x, y]);
  return o.sort((a, b) => dist2(a[0], a[1], cx, cy) - dist2(b[0], b[1], cx, cy));
}
function placeNature(id, item, L, why) {
  const d = R.structure(id), k = d.size || 1, lo = layoutOf(L), h = lo.hub, n = d.nature;
  let target = n.terrain || null;
  if (!target && (d.id === 'woodcutter' || d.id === 'planter' || d.id === 'hunting_lodge')) target = 'forest';
  if (!target && d.id === 'gather_hut') target = TERRAIN_ITEM[item] || 'forest';
  if (!target) return buildInSlot(L, id, { why: item });
  const tiles = terrainTiles(L, target, h.x, h.y, 90);
  if (!tiles.length) { say('no ' + target + ' terrain for ' + id); return null; }
  const radius = n.radius || 0, tried = new Set();
  const score = (x, y) => { let s = 0; const r = radius || 1; for (let yy = y - r; yy < y + k + r; yy++) for (let xx = x - r; xx < x + k + r; xx++) if (W.terrainAt(L, xx, yy) === target && !W.uidAt(L, xx, yy)) s++; return s; };
  let best = null, bestS = -1;
  for (let i = 0; i < Math.min(tiles.length, 300); i++) {
    const [tx, ty] = tiles[i];
    const e = radius ? 1 : 0;
    for (let dy = -k - e; dy <= e; dy++) for (let dx = -k - e; dx <= e; dx++) {
      const x = tx + dx, y = ty + dy, kk = key(x, y); if (tried.has(kk)) continue; tried.add(kk);
      if (lo.reserved.has(kk) || !W.canPlace(id, L, x, y, 0).ok) continue;
      const s = score(x, y) - dist2(x, y, h.x, h.y) / 3000;
      if (s > bestS) { bestS = s; best = [x, y]; }
    }
    if (best && i > 60 && bestS >= (radius ? radius * radius * 1.2 : 1)) break;
  }
  if (!best) { say('no site for ' + id); return null; }
  return buildAt(L, id, best[0], best[1], item + (why ? ' ← ' + why : ''));
}

/* ── extractors ── */
function extractorsFor(res, hardness, fluid) {
  const o = []; for (const d of R.structures.values()) if (d.extract && !d.borer && !!d.extract.fluid === !!fluid && d.extract.hardnessMax >= hardness && (!d.extract.res || d.extract.res.includes(res))) o.push(d); return o;
}
function placeExtractor(res, L, why) {
  const deps = G().layers[L].deposits, tiles = [];
  for (const k in deps) { const dp = deps[k]; if (dp.res === res && dp.amt !== 0) { const [x, y] = k.split(',').map(Number); if (!W.uidAt(L, x, y)) tiles.push({ x, y, h: dp.hardness || 0, fluid: !!dp.fluid }); } }
  if (!tiles.length) return 'none';
  const hmin = Math.min(...tiles.map(t => t.h)), fluid = tiles[0].fluid;
  const exs = extractorsFor(res, hmin, fluid).sort((a, b) => b.extract.rate - a.extract.rate);
  const unl = exs.filter(d => unlocked(d.id));
  if (!unl.length) { const first = exs.slice().sort((a, b) => a.tier - b.tier)[0]; if (first) wantTech(techFor(first.id), res); return 'blocked:extractor for ' + res; }
  let d = unl.find(x => Eco.has(L, Bd.cost(x.id)));
  if (!d) { needCost(unl[unl.length - 1].id, L, 1); return 'pending'; }
  const k = d.size || 1, lo = layoutOf(L), h = lo.hub;
  let best = null, bs = -1;
  const seen = new Set();
  for (const t of tiles) {
    if (t.h > d.extract.hardnessMax) continue;
    for (let dy = 0; dy < k; dy++) for (let dx = 0; dx < k; dx++) {
      const x = t.x - dx, y = t.y - dy, kk = key(x, y); if (seen.has(kk)) continue; seen.add(kk);
      if (lo.reserved.has(kk) || !W.canPlace(d.id, L, x, y, 0).ok) continue;
      let cov = 0; for (const [fx, fy] of footTiles(x, y, k)) { const dp = deps[key(fx, fy)]; if (dp && dp.res === res && dp.hardness <= d.extract.hardnessMax) cov++; }
      const s = cov * 1000 - Math.sqrt(dist2(x, y, h.x, h.y));
      if (s > bs) { bs = s; best = [x, y]; }
    }
  }
  if (!best) return 'blocked:no site ' + res;
  const uid = buildAt(L, d.id, best[0], best[1], res + (why ? ' ← ' + why : ''));
  if (!uid) return 'pending';
  st.extractorRes[uid] = res;
  if (d.burn) ensureFuel(L, d.burn.fuels);
  return 'ok';
}

/* ── hand gathering (1 item / 1.2 s, advancing the sim while waiting for the cooldown) ── */
function gatherNow(item, n) {
  if (ctx.gathered >= GATHER_BUDGET) return false;
  const tid = TERRAIN_ITEM[item]; if (!tid) return false;
  const h = hubOf(0);
  const tiles = terrainTiles(0, tid, h.x + 1, h.y + 1, 70).filter(([x, y]) => !W.uidAt(0, x, y)).slice(0, 12);
  if (!tiles.length) { say('gather: no ' + tid + ' near hub'); return false; }
  let got = 0, tries = 0, i = 0;
  while (got < n && tries < n * 3 + 6 && ctx.gathered < GATHER_BUDGET) {
    const [x, y] = tiles[i++ % tiles.length];
    const cd = Na.gatherCooldown(); if (cd > 0) Dbg.ff(Math.ceil(cd * 10) / 10 + 0.1);
    const r = Na.gather(0, x, y); tries++;
    if (r) { if (r.item === item) got += r.n; ctx.gathered++; }
    else if (Na.gatherInfo(0, x, y).reason === 'full') break;
  }
  if (got) say('gathered ' + got + ' ' + item + ' by hand');
  return got > 0;
}

/* ── power ── */
function powerDemand(L) { let d = 0; for (const s of structs(L)) { const dd = def(s); if (built(s) && dd.power && dd.power.use > 0 && !dd.tank) d += dd.power.use * Math.pow(2, s.oc | 0); } return d; }
function ensurePower(L) {
  const sum = Pw.summary(L);
  let demand = 0; for (let l = 0; l < 5; l++) if (G().layers[l].unlocked) demand += powerDemand(l);
  const cap = sum.genCap || 0;
  if (cap >= demand * 0.8 && sum.ratio >= 0.98) return true;
  if (L > 0) { ensureOverlay('cable', L); return ensurePower(0); }
  if (now() - st.lastGen < 20) return false;
  const cands = GENERATORS.filter(unlocked).reverse();
  for (const id of cands) {
    const d = R.structure(id);
    if (d.power.fuel && !d.power.fuel.some(f => (isFluid(f) ? fluidAmount(f, 0) > 5 : count(0, f) > 5) || routeExists(f, 0, 0))) continue;
    if (!afford(id, 0)) { needCost(id, 0, 1); continue; }
    const uid = buildInSlot(0, id, { why: 'power ' + U.fmtW(cap) + '/' + U.fmtW(demand) });
    if (!uid) continue;
    st.lastGen = now();
    const s = G().structures[uid];
    if (d.power.fuel) { const f = d.power.fuel.find(f => routeExists(f, 0, 0)) || d.power.fuel[0]; if (isFluid(f)) needFluid(f, 50, 0, 'generator fuel', 1); else need(f, 40, 0, 'generator fuel'); }
    fixOverlayCap(s, 'cable', d.power.gen);
    return true;
  }
  const nxt = GENERATORS.find(g => !unlocked(g)); if (nxt) wantTech(techFor(nxt), 'power');
  return false;
}
function planPower() {
  for (let L = 0; L < 5; L++) if (G().layers[L].unlocked && powerDemand(L) > 0) ensurePower(L);
  for (const s of structs(0)) {
    const d = def(s); if (!built(s) || !d.power || !d.power.fuel) continue;
    const f = d.power.fuel.find(f => !isFluid(f) && routeExists(f, 0, 0));
    if (f) need(f, 40, 0, 'generator ' + s.id);
    else { const ff = d.power.fuel.find(f => isFluid(f) && routeExists(f, 0, 0)); if (ff) needFluid(ff, 100, 0, 'generator ' + s.id, 1); }
  }
  for (let L = 0; L < 5; L++) if (G().layers[L].unlocked) for (const s of structs(L)) {
    const d = def(s); if (!built(s) || !d.power || d.overlay) continue;
    const w = (d.power.use || d.power.gen || 0) * Math.pow(2, s.oc | 0);
    if (w > 0 && Pw.cableCap(s.uid) < w * 0.99) fixOverlayCap(s, 'cable', w);
  }
}

/* ── research ── */
let critical = null;
function criticalSet() {
  if (critical) return critical;
  critical = new Set();
  const walk = id => { if (critical.has(id)) return; critical.add(id); const t = R.tech(id); if (t) for (const r of t.requires || []) walk(r); };
  walk('fusion'); walk('quantum_storage'); walk('plasma_defense');
  return critical;
}
function ensureLabs(tier, n) {
  const id = LABS_BY_TIER[tier];
  const have = structs(0).filter(s => def(s).lab && def(s).lab.tier >= tier && s.state !== 'broken').length;
  if (have >= n) return true;
  if (!unlocked(id)) { wantTech(techFor(id), 'lab tier ' + tier); return false; }
  return !!buildInSlot(0, id, { why: 'lab tier ' + tier });
}
let critW = null;
function critWeight(id) {
  if (!critW) { critW = new Map(); const crit = criticalSet(); for (const c of crit) { const seen = new Set(); const walk = x => { if (seen.has(x)) return; seen.add(x); critW.set(x, (critW.get(x) || 0) + 1); const t = R.tech(x); if (t) for (const r of t.requires || []) walk(r); }; walk(c); } }
  return critW.get(id) || 0;
}
function rankedTechs() {
  const av = Rs.available();
  const score = t => { let s = 0; if (st.boost.has(t.id)) s -= 5000; s -= critWeight(t.id) * 40; s += t.era * 100; let c = 0; for (const k in t.cost) c += t.cost[k]; return s + c / 50; };
  return av.sort((a, b) => score(a) - score(b));
}
function pickTech() { return rankedTechs()[0] || null; }
function planResearch() {
  const cur = Rs.progress();
  if (cur) {
    const t = R.tech(cur.tech);
    ensureLabs(t.lab | 0, 2);
    if (cur.speed <= 0) { if (now() - (st.stallSaid || -1e9) > 300) { st.stallSaid = now(); say('research stalled: ' + cur.tech + ' (labs ' + Rs.labInfo().labs + ')'); } ensurePower(0); }
    const nxt = pickTech(); if (nxt && nxt.id !== cur.tech) { ensureLabs(nxt.lab | 0, 1); for (const k in nxt.cost) need(k, nxt.cost[k], 0, 'tech ' + nxt.id); }
    return;
  }
  const t = pickTech(); if (!t) return;
  if (st.tech !== t.id) { st.tech = t.id; say('target tech: ' + t.id + ' cost ' + fmtObj(t.cost)); }
  const labOk = tier => structs(0).some(s => def(s).lab && def(s).lab.tier >= tier && built(s));
  ensureLabs(t.lab | 0, 1);
  if (labOk(t.lab | 0) && Rs.canStart(t.id).ok && Rs.start(t.id)) { say('research started: ' + t.id); st.boost.delete(t.id); return; }
  for (const k in t.cost) need(k, t.cost[k], 0, 'tech ' + t.id);
  // do not idle: start the best other tech that is startable now (its cost is already in stock)
  for (const o of rankedTechs().slice(1, 8)) if (labOk(o.lab | 0) && Rs.canStart(o.id).ok && Rs.start(o.id)) { say('research started (side): ' + o.id); return; }
}

/* ── defense ── */
function planDefense() {
  const era = G().meta.era | 0, wave = G().layers[0].waveAt - now();
  const turrets = structs(0).filter(s => def(s).turret && s.state !== 'broken');
  const towers = turrets.filter(s => s.id === 'watchtower').length;
  const alive = G().enemies.filter(e => e.layer === 0).length;
  const wantTowers = Math.min(10, 4 + Math.floor(G().layers[0].threat / 12) + (alive > 6 ? 2 : 0));
  if (towers > 0) need('arrow', Math.min(200, 60 + towers * 20), 0, 'ammo');
  if (towers < wantTowers && (wave < 500 || era >= 1 || alive) && buildInSlot(0, 'watchtower', { why: 'defense (' + alive + ' hostiles)' })) return;
  const plan = [[1, 'ballista', 2, 'ballista_bolt', 40], [3, 'cannon_turret', 3, 'cannon_shell', 40], [4, 'gatling_turret', 3, 'bullet', 200], [5, 'laser_turret', 3, null, 0], [7, 'plasma_turret', 4, null, 0]];
  for (const [e, id, n, ammo, q] of plan) {
    if (era < e || !unlocked(id)) continue;
    const have = turrets.filter(s => s.id === id).length;
    if (have < n) { if (afford(id, 0)) { if (buildInSlot(0, id, { why: 'defense era ' + era })) break; } else needCost(id, 0, 1); }
    if (have && ammo) need(ammo, q, 0, 'ammo ' + id);
  }
  for (let L = 1; L < 5; L++) {
    if (!G().layers[L].unlocked) continue;
    const list = structs(L).filter(s => def(s).turret && s.state !== 'broken');
    const id = era >= 5 && unlocked('laser_turret') ? 'laser_turret' : era >= 4 && unlocked('gatling_turret') ? 'gatling_turret' : era >= 3 && unlocked('cannon_turret') ? 'cannon_turret' : unlocked('ballista') ? 'ballista' : 'watchtower';
    if (list.length < 2) { const c = Bd.cost(id); if (Eco.has(L, c)) buildInSlot(L, id, { why: 'defense L' + L }); else for (const k in c) needOn(L, k, c[k], 'turret L' + L); }
    const ammo = { watchtower: 'arrow', ballista: 'ballista_bolt', cannon_turret: 'cannon_shell', gatling_turret: 'bullet' }[id];
    if (ammo && list.length) needOn(L, ammo, 60, 'ammo L' + L);
  }
}

/* ── lower layers ── */
function ensureLayer(L, why) {
  if (G().layers[L].unlocked) return true;
  const tech = R.layer(L).unlockedBy;
  if (!Rs.isDone(tech)) { wantTech(tech, 'layer ' + L + ' for ' + why); return false; }
  const shaft = (R.tech(tech).unlocks.structures || []).find(id => R.structure(id).shaft);
  if (!shaft || byId(0, shaft).length) return false;
  if (!afford(shaft, 0)) { needCost(shaft, 0, 1); return false; }
  return !!buildInSlot(0, shaft, { why: 'open L' + L });
}
function borerFor(L) {
  const bt = R.layer(L).borerTier, cands = BORERS.map(id => R.structure(id)).filter(d => d.tier >= bt);
  const unl = cands.filter(d => unlocked(d.id));
  if (!unl.length) { if (cands[0]) wantTech(techFor(cands[0].id), 'borer L' + L); return null; }
  return unl.find(d => Eco.has(L, Bd.cost(d.id))) || unl[0];
}
function borerSpot(L, d) {
  const lay = W.layers[L], k = d.size, g = G().layers[L], h = hubOf(L);
  let best = null, bs = -1;
  for (const ck in g.excavated) {
    const [cx, cy] = ck.split(',').map(Number);
    for (let y = cy * lay.chunk; y < (cy + 1) * lay.chunk; y++) for (let x = cx * lay.chunk; x < (cx + 1) * lay.chunk; x++) {
      const t = W.borerTargets(L, x, y, k); if (!t.length) continue;
      if (!W.canPlace(d.id, L, x, y, 0).ok) continue;
      const s = t.length * 100 - Math.min(...t.map(o => o.work)) / 50 - Math.sqrt(dist2(x, y, h.x, h.y)) * 0.5;
      if (s > bs && findPath(L, x, y, k)) { bs = s; best = [x, y]; }
    }
  }
  return best;
}
function planLayer(L) {
  const g = G().layers[L]; if (!g.unlocked) return;
  const lo = layoutOf(L); if (!lo) return;
  if (!ensureRing(lo)) { const c = Bd.cost(bestOf(CONVEYORS) || 'conveyor_wood'); for (const k in c) needOn(L, k, c[k] * 16, 'ring L' + L); }
  ensureOverlay('pipe', L); ensureOverlay('cable', L);
  const borers = structs(L).filter(s => def(s).borer);
  const wantBorers = st.dig[L] && now() - st.dig[L] < 3600 ? 3 : 1;
  for (const b of borers) {
    if (b.build) continue;
    if (b.state === 'idle' && /Sin roca/.test(b.reason || '')) { say('borer idle (no rock): dismantle ' + b.id + ' L' + L); Bd.dismantle(b.uid); delete st.paths[b.uid]; continue; }
    maintain(b, 'stone', 1, 1);
    if (b.state === 'no_fuel') { const f = def(b).burn.fuels.find(f => !isFluid(f) && routeExists(f, 0, 0)) || 'coal'; needOn(L, f, 40, 'borer fuel'); if (providersOf(f, L).length) keepOn(L, f, 40); }
  }
  const alive = structs(L).filter(s => def(s).borer);
  if (alive.length < wantBorers) {
    const d = borerFor(L);
    if (d) {
      if (!Eco.has(L, Bd.cost(d.id))) { const c = Bd.cost(d.id); for (const k in c) needOn(L, k, c[k], 'borer ' + d.id); }
      else {
        const sp = borerSpot(L, d);
        if (sp) { const uid = buildAt(L, d.id, sp[0], sp[1], 'excavate L' + L); if (uid && d.burn) { const f = d.burn.fuels.find(f => !isFluid(f) && routeExists(f, 0, 0)) || 'coal'; needOn(L, f, 40, 'borer fuel'); } }
        else say('no borer spot on L' + L);
      }
    }
  }
  for (const res in st.depositWaits) if (st.depositWaits[res] === L) { const r = placeExtractor(res, L, 'waited'); if (r === 'ok') { delete st.depositWaits[res]; say('deposit found & extractor placed: ' + res + ' L' + L); } }
  applyRules(L);
}

/* ── upkeep ── */
function planRepairs() {
  for (const s of Object.values(G().structures)) {
    if (s.build) continue;
    const i = s.hp / Bd.maxHp(s);
    if (s.state === 'broken' || i < 0.5) { const c = Bd.repairCost(s.uid); if (Eco.has(s.layer, c)) { if (Bd.repair(s.uid)) say('repaired ' + s.id + ' L' + s.layer + ' (' + Math.round(i * 100) + '%)'); } else if (s.layer === 0 && s.state === 'broken') for (const k in c) need(k, c[k], 0, 'repair ' + s.id); }
  }
}
function planStock() {
  const era = G().meta.era | 0;
  need('plank', 40, 0, 'stock'); need('stick', 30, 0, 'stock'); need('rope', 8, 0, 'stock');
  if (era >= 1) { need('brick', 30, 0, 'stock'); need('bronze_ingot', 20, 0, 'stock'); need('iron_ingot', 20, 0, 'stock'); }
  if (era >= 2) { need('steel_ingot', 30, 0, 'stock'); need('iron_plate', 20, 0, 'stock'); need('circuit_basic', 8, 0, 'stock'); }
  if (era >= 3) { need('motor', 6, 0, 'stock'); need('steel_frame', 8, 0, 'stock'); need('concrete', 40, 0, 'stock'); }
  if (era >= 4) { need('circuit_advanced', 8, 0, 'stock'); need('stainless_plate', 16, 0, 'stock'); need('plastic', 20, 0, 'stock'); }
  if (era >= 5) { need('processor', 6, 0, 'stock'); need('titanium_frame', 4, 0, 'stock'); need('heat_exchanger', 6, 0, 'stock'); }
  const cap = era >= 5 ? 6000 : era >= 3 ? 2500 : era >= 2 ? 800 : 400;
  ensureCap(0, 'stone', cap);
  if (structs(0).some(s => def(s).burn && built(s))) ensureFuel(0, null);
}
function planIdleMachines() {
  for (const s of structs(0)) {
    if (!s.recipe || !def(s).types) continue;
    if (ctx.wantedRecipes.has(s.recipe)) continue;
    if (stockRatio(s) >= 0.95) Eco.setRecipe(s.uid, null);
  }
}

/* ── cycle ── */
function cycle(ffSeconds) {
  out.length = 0;
  ctx = { stack: new Set(), want: new Set(), wantedRecipes: new Set(), fluidRate: {}, gathered: 0 };
  routeMemo.clear();
  st.cycle++;
  const g = G(), era = g.meta.era | 0;
  if (st.eras[era] === undefined) { st.eras[era] = now(); say('=== ERA ' + era + ' (' + U.eraName(era) + ') reached at ' + fmtT(now()) + ' ==='); }
  try {
    planDefense();
    planResearch();
    planStock();
    planPower();
    for (let L = 1; L < 5; L++) planLayer(L);
    planRepairs();
    planIdleMachines();
    for (const [id, at] of st.boost) if (Rs.isDone(id) || now() - at > 7200) st.boost.delete(id);
  } catch (e) { say('AGENT ERROR ' + (e && e.stack || e)); }
  st.lastWanted = ctx.wantedRecipes;
  const before = performance.now();
  Dbg.ff(ffSeconds);
  const ms = performance.now() - before;
  const cur = Rs.progress(), stt = Dbg.state();
  return { log: out.slice(), t: now(), era: g.meta.era | 0, techs: Object.keys(g.research.done).length, research: cur ? cur.tech + ' ' + Math.round(cur.left) + 's×' + cur.speed.toFixed(1) : null, ms, structures: stt.structures, states: stt.states, inv: g.inv[0], eras: st.eras, blocked: st.blocked, boost: [...st.boost.keys()], power: stt.power, enemies: stt.enemies, hubHp: (hubOf(0) || {}).hp, spent: st.spent, target: st.tech, waves: g.stats.waves || 0, layers: stt.layers };
}
window.BOT = { cycle, st, need, say, out };
};

/* ───────────────────────────── driver ───────────────────────────── */
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
await page.goto('file://' + dist);
await page.waitForFunction(() => window.LD && LD.Main && LD.Main.ready, null, { timeout: 60000 });
await page.evaluate(seed => LD.Main.startNewGame({ name: 'Bot', difficulty: 'normal', seed }), SEED);
await page.evaluate(`(${AGENT.toString()})()`);

const fmtT = s => { s = Math.floor(s); return String(Math.floor(s / 3600)).padStart(2, '0') + ':' + String(Math.floor(s % 3600 / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
const t0 = Date.now();
let last = null, lastTechAt = 0, lastTechs = 0, ff = 30, lastPrint = -1;
const eraAt = { 0: 0 };
while (true) {
  const r = await page.evaluate(ff => BOT.cycle(ff), ff);
  if (!QUIET) for (const l of r.log) console.log(l);
  for (const e in r.eras) if (eraAt[e] === undefined) { eraAt[e] = r.eras[e]; console.log(`>>> ERA ${e} at ${fmtT(r.eras[e])} (target ${fmtT(TARGETS[e] || 0)})`); }
  if (r.techs !== lastTechs) { lastTechs = r.techs; lastTechAt = r.t; }
  if (Math.floor(r.t / 600) !== lastPrint) {
    lastPrint = Math.floor(r.t / 600);
    console.log(`--- t=${fmtT(r.t)} era ${r.era} techs ${r.techs} research ${r.research || '-'} target ${r.target} structures ${r.structures} states ${JSON.stringify(r.states)} power ${JSON.stringify(r.power)} enemies ${r.enemies} waves ${r.waves} hub ${r.hubHp} real ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    const inv = Object.entries(r.inv).sort((a, b) => b[1] - a[1]).slice(0, 26).map(([k, v]) => k + ':' + Math.round(v)).join(' ');
    console.log(`    inv0 ${inv}`);
    if (Object.keys(r.blocked).length) console.log(`    blocked ${JSON.stringify(r.blocked)} boost ${r.boost.join(',')}`);
  }
  last = r;
  if (r.t >= HOURS * 3600) { console.log('time budget reached'); break; }
  if (r.techs >= 108) { console.log('all techs researched'); break; }
  if (r.t - lastTechAt > STUCK_H * 3600) { console.log(`STUCK: no tech completed for ${STUCK_H} h (last target ${r.target})`); break; }
  ff = r.era === 0 ? 30 : r.research ? 90 : 60;
  if (r.t > 4 * 3600) ff = Math.max(ff, 150);
}
console.log('\nERA TABLE (sim time reached vs target)');
console.log('era  name                 reached    target     delta');
for (let e = 0; e <= 7; e++) {
  const at = eraAt[e], tg = TARGETS[e];
  const nm = await page.evaluate(e => LD.U.eraName(e), e);
  console.log(String(e).padEnd(4) + ' ' + nm.padEnd(20) + ' ' + (at === undefined ? '—'.padEnd(10) : fmtT(at).padEnd(10)) + ' ' + fmtT(tg).padEnd(10) + ' ' + (at === undefined ? '' : ((at - tg) >= 0 ? '+' : '-') + fmtT(Math.abs(at - tg))));
}
if (last) {
  console.log(`\nfinal: t=${fmtT(last.t)} era ${last.era} techs ${last.techs}/108 structures ${last.structures} waves ${last.waves} hub ${last.hubHp}`);
  console.log('blocked: ' + JSON.stringify(last.blocked));
  const missing = await page.evaluate(() => LD.Sim.Research.nextSteps().slice(0, 6).map(s => s.tech.id + ' missing ' + JSON.stringify(s.missing)));
  console.log('next steps: ' + missing.join(' | '));
}
if (errors.length) console.log('CONSOLE ERRORS:\n' + errors.slice(0, 20).map(e => ' - ' + e).join('\n'));
fs.mkdirSync(path.join(here, 'out'), { recursive: true });
fs.writeFileSync(path.join(here, 'out', 'bot_final.json'), JSON.stringify(last, null, 1));
if (argv.includes('--dump')) fs.writeFileSync(path.join(here, 'out', 'bot_save.json'), await page.evaluate(() => JSON.stringify(LD.G)));
await page.screenshot({ path: path.join(here, 'out', 'bot_final.png') }).catch(() => {});
await browser.close();
process.exit(0);
