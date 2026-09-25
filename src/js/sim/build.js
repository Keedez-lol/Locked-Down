(() => {
'use strict';
const LD = window.LD, U = LD.U, E = LD.Events;
LD.Sim = LD.Sim || {};

/* binding numbers: CONTRACT §7.4/§7.5, decisions 25, 29, 30, 32, 33 */
const WEAR_RATE = 0.00004, HEAT_RATE = 0.0005, STORM_WEAR = 0.0002;
const LUBRICANT_DIV = 1.5, LUBRICANT_RATE = 0.005, OVERHEAT_MUL = 5;
const OC_WEAR = [1, 3, 9, 27, 81, 243, 729, 2187];
const LOW = 0.3, HUB_FLOOR = 0.1, REFUND_BUILT = 0.65;
const BAY_RADIUS = 8, BAY_PERIOD = 10, BAY_MAX = 5, BAY_THRESHOLD = 0.9;
const QUEUE_PERIOD = 0.5;
const SFX_GAP = { integrity_low: 3000, structure_broken: 250, build_done: 120, build_place: 60, dismantle: 80, repair: 150, blueprint_paste: 300 };
const SOURCE_NAMES = { earthquake: 'terremoto', plasma_storm: 'tormenta de plasma', storm: 'tormenta', heat: 'calor del núcleo', wear: 'desgaste', debug: 'depuración' };
const KIND_ORDER = { structure: 0, cable: 1, pipe: 2 };
const EMPTY = Object.freeze({}), EMPTY_ARR = Object.freeze([]);
const NORMAL = {}, QUIET = { quiet: true }, SILENT = { quiet: true, silent: true };

const cache = { G: null, dirty: true, occChecked: false, byLayer: [], hubs: [], elevators: [], costs: new Map(), costKey: '' };
const timers = { queue: 0, sfx: new Map(), toast: new Map(), log: new Map() };
const scratch = { resStruct: new Set(), resOverlay: new Set(), cand: [] };
const netDirty = [];
let batchDepth = 0;

/* ── small helpers ── */
const defOf = inst => (inst && LD.Registry.structures.get(inst.id)) || null;
const resolve = x => typeof x === 'string' ? (LD.G ? LD.G.structures[x] || null : null) : (x || null);
const sizeOf = d => d.overlay ? 1 : ((d.size | 0) || 1);
const isLogistic = d => !!(d.wall || d.conveyor || d.overlay);
const hidden = (o, k, v) => { Object.defineProperty(o, k, { value: v, writable: true, configurable: true, enumerable: false }); return v; };
const now = () => (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
const gate = (map, key, ms) => { const t = now(); if (t - (map.get(key) || 0) < ms) return false; map.set(key, t); return true; };
const layerName = L => { const l = LD.Registry.layers[L]; return l && l.name ? l.name : 'Estrato ' + L; };
const diff = () => (LD.State && LD.State.difficulty()) || EMPTY;
const Eco = () => LD.Sim.Economy;
const byIntegrity = (a, b) => a.hp / (a._maxHp || 1) - b.hp / (b._maxHp || 1);
const cellOrder = (a, b) => (KIND_ORDER[a.kind] - KIND_ORDER[b.kind]) || (a.dy - b.dy) || (a.dx - b.dx);

function fmtItems(items) { const parts = []; for (const k in items) parts.push(U.fmtInt(items[k]) + '× ' + LD.Registry.itemName(k)); return parts.join(', '); }
function missingText(L, c) { const inv = (LD.G && LD.G.inv[L]) || EMPTY, parts = []; for (const k in c) { const lack = c[k] - (inv[k] || 0); if (lack > 0) parts.push(U.fmtInt(lack) + '× ' + LD.Registry.itemName(k)); } return parts.join(', ') || '—'; }
function srcName(s) {
  if (!s) return 'daño';
  const id = typeof s === 'string' ? s : s.id;
  if (!id) return 'daño';
  if (SOURCE_NAMES[id]) return SOURCE_NAMES[id];
  const e = LD.Registry.enemies.get(id);
  return e ? e.name : String(id);
}
function sfx(name, inst) {
  const A = LD.Audio; if (!A || typeof A.play !== 'function' || !gate(timers.sfx, name, SFX_GAP[name] || 60)) return;
  try {
    if (!inst) { A.play(name); return; }
    const d = defOf(inst), s = d ? sizeOf(d) : 1;
    A.play(name, { x: inst.x + s / 2, y: inst.y + s / 2, layer: inst.layer });
  } catch (e) { /* audio is optional */ }
}
function fx(kind, inst, n) {
  const P = LD.Particles; if (!P || typeof P.emit !== 'function') return;
  const d = defOf(inst), s = d ? sizeOf(d) : 1;
  const T = (LD.Render && LD.Render.TILE) || 48;
  try { P.emit(kind, (inst.x + s / 2) * T, (inst.y + s / 2) * T, { n, layer: inst.layer, size: s * T }); } catch (e) { /* particles are optional */ }
}
function toast(text, kind, key, ms) { if (!gate(timers.toast, key || text, ms || 1500)) return; E.emit('toast', { text, kind: kind || 'info' }); }
function log(text, kind, key, ms) { if (key && !gate(timers.log, key, ms || 1500)) return; if (LD.State && LD.State.log) LD.State.log(text, kind || 'info'); }

/* ── inventory (Economy, with a local fallback while it is absent) ── */
function has(L, items, mul) {
  const e = Eco(); if (e && typeof e.has === 'function') return !!e.has(L, items, mul || 1);
  const inv = LD.G && LD.G.inv[L]; if (!inv) return false; mul = mul || 1;
  for (const k in items) if ((inv[k] || 0) < items[k] * mul) return false;
  return true;
}
function take(L, items, mul) {
  const e = Eco(); if (e && typeof e.take === 'function') return !!e.take(L, items, mul || 1);
  if (!has(L, items, mul)) return false;
  const inv = LD.G.inv[L]; mul = mul || 1;
  for (const k in items) { inv[k] -= items[k] * mul; if (inv[k] <= 0) delete inv[k]; E.emit('inv:changed', { layer: L, item: k }); }
  return true;
}
function add(L, item, n) {
  const e = Eco(); if (e && typeof e.add === 'function') return e.add(L, item, n) || 0;
  const G = LD.G, inv = G.inv[L], cap = (e && typeof e.cap === 'function') ? e.cap(L, item) : ((G.caps && G.caps.base) || 200);
  const cur = inv[item] || 0, k = Math.max(0, Math.min(n, cap - cur));
  if (k > 0) { inv[item] = cur + k; E.emit('inv:changed', { layer: L, item }); }
  return k;
}
function unlocked(id) {
  const Rs = LD.Sim.Research;
  if (Rs && typeof Rs.isUnlocked === 'function') { try { return !!Rs.isUnlocked('structure', id); } catch (e) { /* fall through */ } }
  const R = LD.Registry; if (R.isStart('structure', id)) return true;
  const t = R.unlockerOf('structure', id), G = LD.G;
  return !!(t && G && G.research && G.research.done[t]);
}

/* ── networks / occupancy ── */
function rebuildNetworks(L) {
  if (batchDepth > 0) { netDirty[L] = true; return; }
  const e = Eco();
  try {
    if (e && typeof e.rebuildNetworks === 'function') e.rebuildNetworks(L);
    else { const P = LD.Sim.Power, F = LD.Sim.Fluids; if (P && P.rebuild) P.rebuild(L); if (F && F.rebuild) F.rebuild(L); }
  } catch (err) { console.error('[Build] rebuildNetworks', err); }
}
function flushNetworks() { for (let L = 0; L < netDirty.length; L++) if (netDirty[L]) { netDirty[L] = false; rebuildNetworks(L); } }
function batch(fn) { batchDepth++; try { return fn(); } finally { batchDepth--; if (batchDepth === 0) flushNetworks(); } }
function occupy(inst, d, uid) {
  const W = LD.World; if (!W || !W.layers || !W.layers[inst.layer]) return;
  try {
    if (d.overlay) W.setOverlay(d.overlay, inst.layer, inst.x, inst.y, uid);
    else { const s = sizeOf(d); W.setOcc(inst.layer, inst.x, inst.y, s, s, uid); }
  } catch (e) { console.error('[Build] occupancy', e); }
}
function rebuildOccupancy(G) {
  G = G || LD.G; const W = LD.World;
  if (!G || !W || !W.layers || !W.layers.length || typeof W.setOcc !== 'function') return false;
  const reg = LD.Registry.structures;
  for (const uid in G.structures) { const inst = G.structures[uid], d = reg.get(inst.id); if (d) occupy(inst, d, uid); }
  return true;
}
function verifyOccupancy(G) {
  cache.occChecked = true;
  const W = LD.World; if (!W || !W.layers || !W.layers.length || typeof W.uidAt !== 'function') return;
  const reg = LD.Registry.structures;
  for (const uid in G.structures) {
    const inst = G.structures[uid], d = reg.get(inst.id);
    if (!d || !W.layers[inst.layer]) continue;
    let at = uid;
    try {
      if (d.overlay === 'cable') { if (W.cableAt) at = W.cableAt(inst.layer, inst.x, inst.y); }
      else if (d.overlay === 'pipe') { if (W.pipeAt) at = W.pipeAt(inst.layer, inst.x, inst.y); }
      else at = W.uidAt(inst.layer, inst.x, inst.y);
    } catch (e) { return; }
    if (at !== uid) { rebuildOccupancy(G); return; }
  }
}

/* ── caches ── */
function markDirty() { cache.dirty = true; }
function ensure(G) { if (cache.G !== G) init(G); }
function prime(inst, d) {
  d = d || defOf(inst);
  const mhp = d && d.hp > 0 ? d.hp : Math.max(1, +inst.hp || 1);
  hidden(inst, '_maxHp', mhp);
  if (typeof inst.hp !== 'number' || inst.hp !== inst.hp) inst.hp = mhp;
  if (inst.hp > mhp) inst.hp = mhp;
  return mhp;
}
function init(G) {
  G = G || LD.G; if (!G) return;
  cache.G = G; cache.dirty = true; cache.occChecked = false; cache.costs.clear(); cache.costKey = '';
  timers.queue = 0; netDirty.length = 0; batchDepth = 0;
  G.flags = G.flags || {};
  if (!Array.isArray(G.blueprints)) G.blueprints = [];
  if (!Array.isArray(G.flags.bpQueue)) G.flags.bpQueue = [];
  let seq = G.flags.seq | 0;
  for (const uid in G.structures) {
    const inst = G.structures[uid];
    if (!inst || typeof inst !== 'object') { delete G.structures[uid]; continue; }
    if (inst.uid !== uid) inst.uid = uid;
    if (!(inst.seq > 0)) inst.seq = ++seq; else if (inst.seq > seq) seq = inst.seq;
    prime(inst);
    if (inst.build && !(inst.build.left > 0)) { inst.build = null; inst.state = 'idle'; }
    if (!inst.state) inst.state = inst.build ? 'building' : 'idle';
    if (typeof inst.oc !== 'number') inst.oc = 0;
    if (!inst.stats) inst.stats = { made: 0 };
  }
  G.flags.seq = seq;
  rebuildOccupancy(G);
  rebuildCache();
}
function rebuildCache() {
  const G = LD.G; if (!G) return;
  const n = G.layers.length, by = cache.byLayer, el = cache.elevators, hubs = cache.hubs, reg = LD.Registry.structures, S = G.structures;
  by.length = n; el.length = n; hubs.length = n;
  for (let L = 0; L < n; L++) { by[L] = []; el[L] = []; hubs[L] = null; }   // fresh arrays: loops holding the old ones stay valid
  for (const uid in S) {
    const inst = S[uid], L = inst.layer | 0;
    if (L < 0 || L >= n) continue;
    if (!inst._maxHp) prime(inst);
    by[L].push(inst);
    const d = reg.get(inst.id); if (!d) continue;
    if (d.id === 'hub' && !hubs[L]) hubs[L] = inst;
    if (d.elevator) el[L].push(inst);
  }
  for (let L = 1; L < n; L++) {
    if (el[L].length > 1) el[L].sort((a, b) => (a.seq | 0) - (b.seq | 0));
    const layer = G.layers[L], want = layer.elevator && S[layer.elevator];
    let h = (want && want.layer === L && defOf(want) && defOf(want).elevator) ? want : null;
    if (!h && el[L].length) h = el[L][0];
    if (!hubs[L]) hubs[L] = h;
    layer.elevator = h ? h.uid : null;
  }
  cache.dirty = false;
}

/* ── cost ── */
function cost(id) {
  const G = LD.G, key = (G && G.meta && G.meta.difficulty) || 'normal';
  if (cache.costKey !== key) { cache.costs.clear(); cache.costKey = key; }
  let c = cache.costs.get(id);
  if (c) return c;
  const d = LD.Registry.structures.get(id), mul = diff().cost || 1;
  c = {};
  if (d && d.cost) for (const k in d.cost) { const n = Math.ceil(d.cost[k] * mul); if (n > 0) c[k] = n; }
  cache.costs.set(id, Object.freeze(c));
  return c;
}
function canAfford(id, L) { return !!LD.G && has(L | 0, cost(id)); }

/* ── placement ── */
function createInst(id, d, L, x, y, rot, free) {
  const G = LD.G, bt = free ? 0 : (d.buildTime || 0) * (diff().build || 1);
  const instant = free || bt <= 0 || ((d.conveyor || d.overlay) && (d.buildTime || 0) <= 1);
  G.flags.seq = (G.flags.seq | 0) + 1;
  const inst = {
    uid: U.uid(), id, layer: L, x, y, rot, hp: d.hp > 0 ? d.hp : 1, state: instant ? 'idle' : 'building',
    build: instant ? null : { left: bt, total: bt }, oc: 0, recipe: null, progress: 0, paused: false, fuel: 0,
    tank: d.tank ? { fluid: null, amt: 0 } : null, rules: d.elevator ? [{ item: '*', mode: 'up', keep: 0 }] : null,
    stats: { made: 0 }, seq: G.flags.seq
  };
  prime(inst, d);
  return inst;
}
function placeImpl(id, L, x, y, rot, opts) {
  const G = LD.G; if (!G) return null;
  ensure(G);
  const d = LD.Registry.structures.get(id);
  if (!d) { console.warn('[Build] estructura desconocida: ' + id); return null; }
  L |= 0; x |= 0; y |= 0; rot = (rot | 0) & 3;
  const layer = G.layers[L]; if (!layer) return null;
  const free = !!opts.free, quiet = !!opts.quiet;
  if (!free) {
    if (!layer.unlocked) { if (!quiet) toast('Estrato bloqueado', 'warn', 'place-layer'); return null; }
    if (!unlocked(id)) { if (!quiet) toast('Sin investigar: ' + d.name, 'warn', 'place-lock:' + id); return null; }
  }
  const W = LD.World;
  if (W && typeof W.canPlace === 'function') {
    let r = null;
    try { r = W.canPlace(id, L, x, y, rot); } catch (e) { console.error('[Build] canPlace', e); }
    if (!r || !r.ok) {
      if (!opts.force) { if (!quiet) toast((r && r.reason) || 'No se puede construir aquí', 'warn', 'place-no:' + id); return null; }
      console.warn('[Build] colocación forzada de ' + id + ' en L' + L + ' (' + x + ',' + y + '): ' + ((r && r.reason) || 'sin motivo'));
    }
  }
  const c = cost(id);
  if (!free) {
    if (!has(L, c)) { if (!quiet) toast('Faltan materiales: ' + missingText(L, c), 'bad', 'place-cost:' + id); return null; }
    if (!take(L, c)) return null;
  }
  const inst = createInst(id, d, L, x, y, rot, free);
  G.structures[inst.uid] = inst;
  occupy(inst, d, inst.uid);
  G.discovered.structures[id] = true;
  if (!free) G.stats.builds = (G.stats.builds | 0) + 1;
  if (d.elevator && L > 0 && !(layer.elevator && G.structures[layer.elevator])) layer.elevator = inst.uid;
  markDirty();
  E.emit('structure:placed', inst.uid);
  if (!inst.build) complete(inst, d, true);
  rebuildNetworks(L);
  if (!opts.silent) { sfx('build_place', inst); fx('build', inst, 8); }
  return inst.uid;
}
function place(id, L, x, y, rot) { return placeImpl(id, L, x, y, rot || 0, NORMAL); }
function placeFree(id, L, x, y, rot, force) { return placeImpl(id, L, x, y, rot || 0, { free: true, quiet: true, silent: true, force: !!force }); }
function complete(inst, d, fromPlace) {
  const G = LD.G;
  inst.build = null;
  inst.state = inst.paused ? 'paused' : 'idle'; inst.reason = null;
  E.emit('structure:built', inst.uid);
  if (!fromPlace) {
    sfx('build_done', inst); fx('build', inst, 10);
    if (!isLogistic(d)) log('Construcción terminada: ' + d.name + ' · ' + layerName(inst.layer), 'ok', 'built:' + d.id, 1500);
  }
  if (d.shaft && d.shaft.layer >= 1) {
    const target = d.shaft.layer, tl = G.layers[target];
    if (tl && !(tl.shaft && G.structures[tl.shaft])) tl.shaft = inst.uid;
    if (tl && !tl.unlocked) {
      const S = LD.Sim;
      if (S && typeof S.unlockLayer === 'function') { try { S.unlockLayer(target); } catch (e) { console.error('[Build] unlockLayer', e); } }
      else { tl.unlocked = true; G.discovered.layers[target] = true; E.emit('layer:unlocked', target); }
      log('Pozo operativo: acceso a ' + layerName(target), 'ok');
    }
  }
  if (!fromPlace) rebuildNetworks(inst.layer);
}
function remove(inst, d) {
  const G = LD.G, uid = inst.uid, L = inst.layer;
  occupy(inst, d, null);
  delete G.structures[uid];
  hidden(inst, '_dead', true);
  const layer = G.layers[L]; if (layer && layer.elevator === uid) layer.elevator = null;
  if (d.shaft) { const tl = G.layers[d.shaft.layer]; if (tl && tl.shaft === uid) tl.shaft = null; }
  const A = LD.Audio; if (A && typeof A.stopLoop === 'function') { try { A.stopLoop(uid); } catch (e) { /* optional */ } }
  markDirty();
  E.emit('structure:removed', uid);
  const D = LD.Sim.Defense; if (D && typeof D.markPathsDirty === 'function') { try { D.markPathsDirty(L); } catch (e) { /* optional */ } }
  rebuildNetworks(L);
}

/* ── dismantle / repair ── */
function canDismantle(uid) {
  const G = LD.G, inst = G && G.structures[uid];
  if (!inst) return { ok: false, reason: 'No existe' };
  const d = defOf(inst); if (!d) return { ok: false, reason: 'Definición desconocida' };
  if (d.id === 'hub') return { ok: false, reason: 'El almacén central no se puede desmantelar' };
  if (d.elevator && inst.layer > 0 && hubOf(inst.layer) === inst) return { ok: false, reason: 'El primer elevador del estrato no se puede desmantelar' };
  return { ok: true, reason: '' };
}
function refundOf(inst) {
  const c = cost(inst.id), out = {}, k = inst.build ? 1 : REFUND_BUILT;
  for (const it in c) { const n = k >= 1 ? c[it] : Math.floor(c[it] * k); if (n > 0) out[it] = n; }
  return out;
}
function refundPreview(uid) { const inst = resolve(uid); return inst ? refundOf(inst) : EMPTY; }
function dismantle(uid) {
  const G = LD.G; if (!G) return null;
  const chk = canDismantle(uid);
  if (!chk.ok) { toast(chk.reason, 'warn', 'dismantle-no'); return null; }
  const inst = G.structures[uid], d = defOf(inst), refund = refundOf(inst), got = {}, lost = {};
  let anyLost = false, anyGot = false;
  for (const it in refund) { const n = add(inst.layer, it, refund[it]); if (n > 0) { got[it] = n; anyGot = true; } if (n < refund[it]) { lost[it] = refund[it] - n; anyLost = true; } }
  remove(inst, d);
  G.stats.dismantled = (G.stats.dismantled | 0) + 1;
  sfx('dismantle', inst); fx('rubble', inst, 10);
  const lostTxt = anyLost ? ' · perdido por falta de espacio: ' + fmtItems(lost) : '';
  if (!isLogistic(d)) log('Desmontaje: ' + d.name + (anyGot ? ' · reembolso ' + fmtItems(got) : '') + lostTxt, 'info');
  if (anyLost) toast('Reembolso parcial de ' + d.name + lostTxt, 'warn', 'dismantle-lost', 3000);
  return got;
}
function repairCost(uid) {
  const inst = resolve(uid); if (!inst) return EMPTY;
  const mhp = inst._maxHp || prime(inst), missing = 1 - U.clamp(inst.hp / mhp);
  if (missing <= 0) return EMPTY;
  const c = cost(inst.id), out = {};
  for (const k in c) { const n = Math.ceil(c[k] * missing * 0.5); if (n > 0) out[k] = n; }
  return out;
}
function doRepair(inst, d, quiet) {
  if (inst.build) return false;
  const mhp = inst._maxHp || prime(inst, d);
  if (inst.hp >= mhp) return false;
  if (!take(inst.layer, repairCost(inst))) return false;
  const wasBroken = inst.state === 'broken';
  inst.hp = mhp;
  if (wasBroken) { inst.state = inst.paused ? 'paused' : 'idle'; inst.reason = null; }
  if (!quiet) { sfx('repair', inst); fx('build', inst, 6); }
  if (wasBroken) log('Reparación completada: ' + d.name + ' · ' + layerName(inst.layer), 'ok', 'repair:' + d.id, 1000);
  return true;
}
function repair(uid) {
  const inst = resolve(uid), d = defOf(inst); if (!inst || !d) return false;
  if (inst.build) { toast('Todavía en construcción', 'info', 'repair-building'); return false; }
  if (inst.hp >= (inst._maxHp || prime(inst, d))) return false;
  const rc = repairCost(inst);
  if (!has(inst.layer, rc)) { toast('Faltan materiales para reparar: ' + missingText(inst.layer, rc), 'bad', 'repair-cost'); return false; }
  return doRepair(inst, d, false);
}

/* ── controls ── */
function effectiveTier(inst, d) {
  const e = Eco(); if (e && typeof e.effectiveTier === 'function') { try { return e.effectiveTier(inst); } catch (err) { /* fall through */ } }
  return (d.tier | 0) + (inst.oc | 0);
}
function clearRecipe(inst) {
  const e = Eco(); if (e && typeof e.setRecipe === 'function') { try { e.setRecipe(inst.uid, null); return; } catch (err) { /* fall through */ } }
  inst.recipe = null; inst.progress = 0;
}
function setOverclock(uid, level) {
  const inst = resolve(uid), d = defOf(inst); if (!inst || !d) return false;
  level = U.clamp(level | 0, 0, d.ocMax | 0);
  if (level === (inst.oc | 0)) return false;
  inst.oc = level;
  if (inst.recipe) {
    const rc = LD.Registry.recipes.get(inst.recipe);
    if (rc && (rc.tier | 0) > effectiveTier(inst, d)) { clearRecipe(inst); toast('Receta descartada: el nivel efectivo ya no la admite', 'warn', 'oc-recipe'); }
  }
  return true;
}
function setPaused(uid, v) {
  const inst = resolve(uid); if (!inst) return false;
  inst.paused = !!v;
  if (inst.build || inst.state === 'broken') return true;
  if (inst.paused) inst.state = 'paused'; else if (inst.state === 'paused') inst.state = 'idle';
  return true;
}
function rotate(uid) { const inst = resolve(uid); if (!inst) return 0; inst.rot = ((inst.rot | 0) + 1) & 3; return inst.rot; }

/* ── integrity ── */
function maxHp(inst) { inst = resolve(inst); return inst ? (inst._maxHp || prime(inst)) : 1; }
function integrity(inst) { inst = resolve(inst); return inst ? U.clamp(inst.hp / (inst._maxHp || prime(inst))) : 0; }
function integrityMul(inst) { const i = integrity(inst); return i >= LOW ? 1 : Math.max(0.1, 1 - 0.03 * (30 - i * 100)); }
function buildProgress(inst) { inst = resolve(inst); if (!inst || !inst.build || !(inst.build.total > 0)) return 1; return U.clamp(1 - inst.build.left / inst.build.total); }
function wearRate(inst, oc) {
  inst = resolve(inst); const d = defOf(inst); if (!inst || !d) return 0;
  const o = oc === undefined ? inst.oc | 0 : oc | 0;
  let w = WEAR_RATE * OC_WEAR[U.clamp(o, 0, 7)];
  const F = LD.Sim.Fluids; if (F && typeof F.hasLubricant === 'function') { try { if (F.hasLubricant(inst.uid)) w /= LUBRICANT_DIV; } catch (e) { /* optional */ } }
  if (inst._overheat) w *= OVERHEAT_MUL;
  if (inst.layer === 4 && !d.heatproof) w += HEAT_RATE;
  return w;
}
function timeToBreak(inst, oc) { const w = wearRate(inst, oc); return w > 0 ? integrity(inst) / w : Infinity; }
function warnLow(inst, d) {
  sfx('integrity_low', inst);
  log('Integridad baja: ' + d.name + ' · ' + layerName(inst.layer), 'warn', 'low:' + d.id, 3000);
  toast('Integridad baja: ' + d.name + ' (' + layerName(inst.layer) + ')', 'warn', 'low-toast', 5000);
}
function breakDown(inst, d, cause) {
  const G = LD.G;
  if (isLogistic(d)) {
    fx('death', inst, 6); fx('rubble', inst, 8);
    sfx('structure_broken', inst);
    remove(inst, d);
    G.stats.destroyed = (G.stats.destroyed | 0) + 1;
    log('Pérdida total: ' + d.name + ' · ' + cause + ' · ' + layerName(inst.layer), 'bad', 'lost:' + d.id, 2000);
    return true;
  }
  inst.state = 'broken'; inst.reason = 'Avería: requiere reparación';
  E.emit('structure:broken', inst.uid);
  sfx('structure_broken', inst); fx('smoke', inst, 6);
  log('Avería: ' + d.name + ' · ' + cause + ' · ' + layerName(inst.layer), 'bad', 'broken:' + d.id, 1000);
  toast('Avería: ' + d.name + ' (' + layerName(inst.layer) + ')', 'bad', 'broken-toast', 3000);
  return true;
}
function applyLoss(inst, d, mhp, amount, cause) {
  const old = inst.hp; let hp = old - amount;
  if (d.id === 'hub') { const floor = mhp * HUB_FLOOR; if (hp < floor) hp = floor; }
  inst.hp = hp;
  if (hp <= 0) { inst.hp = 0; return breakDown(inst, d, cause); }
  if (old >= LOW * mhp && hp < LOW * mhp) warnLow(inst, d);
  return false;
}
function damage(uid, amount, source) {
  const inst = resolve(uid), d = defOf(inst);
  if (!inst || !d || !(amount > 0) || inst.state === 'broken') return false;
  return applyLoss(inst, d, inst._maxHp || prime(inst, d), amount, srcName(source));
}

/* ── queries ── */
function structuresIn(L) { const G = LD.G; if (!G) return EMPTY_ARR; ensure(G); if (cache.dirty) rebuildCache(); return cache.byLayer[L] || EMPTY_ARR; }
function elevatorsIn(L) { const G = LD.G; if (!G) return EMPTY_ARR; ensure(G); if (cache.dirty) rebuildCache(); return cache.elevators[L] || EMPTY_ARR; }
function hubOf(L) { const G = LD.G; if (!G) return null; ensure(G); if (cache.dirty) rebuildCache(); return cache.hubs[L] || null; }
function footprint(inst) { inst = resolve(inst); if (!inst) return null; const d = defOf(inst), s = d ? sizeOf(d) : 1; return { x: inst.x, y: inst.y, w: s, h: s }; }

/* ── tick: construction, wear, heat, maintenance, blueprint queue ── */
function lubricated(inst, dt) {
  const F = LD.Sim.Fluids; if (!F || typeof F.hasLubricant !== 'function') return false;
  try {
    if (!F.hasLubricant(inst.uid)) return false;
    if (typeof F.consumeLubricant === 'function') return !!F.consumeLubricant(inst.uid, dt);
    if (typeof F.take === 'function') return F.take(inst.uid, 'lubricant', LUBRICANT_RATE * dt) > 0;
    return true;
  } catch (e) { return false; }
}
function heatMul(G) {
  const Ev = LD.Sim.Events;
  if (Ev && typeof Ev.multipliers === 'function') { try { const m = Ev.multipliers(4); if (m && typeof m.heat === 'number') return m.heat; } catch (e) { /* fall through */ } }
  const a = G.events && G.events.active;
  if (a) for (let i = 0; i < a.length; i++) { const ev = a[i]; if (ev && ev.kind === 'plasma_storm' && (ev.layer === 4 || ev.layer == null)) return ev.heat > 0 ? ev.heat : 3; }
  return 1;
}
function powerRatio(inst, d) {
  if (!d.power || !(d.power.use > 0)) return 1;
  const P = LD.Sim.Power; if (!P || typeof P.gridOf !== 'function') return 1;
  try { const g = P.gridOf(inst.uid); if (!g) return 0; const r = +g.ratio; return r === r ? U.clamp(r) : 1; } catch (e) { return 1; }
}
function isLinked(inst) {
  const e = Eco(); if (!e || typeof e.isLinked !== 'function') return true;
  try { return !!e.isLinked(inst.uid); } catch (err) { return true; }
}
function bayTick(inst, d, dt) {
  if (inst.paused) { inst._wantPower = 0; return; }
  if (inst._mt === undefined) { hidden(inst, '_mt', (U.hashStr(inst.uid) % 100) / 10); hidden(inst, '_mtBusy', 0); }
  inst._wantPower = d.power && d.power.use > 0 ? d.power.use : 0;
  if (!isLinked(inst)) { inst.state = 'no_link'; inst.reason = 'Sin enlace con el almacén'; return; }
  const ratio = powerRatio(inst, d);
  if (ratio <= 0) { inst.state = 'no_power'; inst.reason = 'Sin energía'; return; }
  inst.reason = null;
  if (inst._mtBusy > 0) { inst._mtBusy -= dt; inst.state = 'working'; } else inst.state = 'idle';
  inst._mt += dt * ratio;
  if (inst._mt >= BAY_PERIOD) { inst._mt = 0; if (bayCycle(inst, d) > 0) { inst._mtBusy = 2; inst.state = 'working'; } }
}
function bayCycle(bay, d) {
  const L = bay.layer, arr = structuresIn(L), cand = scratch.cand, reg = LD.Registry.structures;
  const s = sizeOf(d), bx0 = bay.x, by0 = bay.y, bx1 = bay.x + s - 1, by1 = bay.y + s - 1;
  cand.length = 0;
  for (let i = 0; i < arr.length; i++) {
    const t = arr[i]; if (t._dead || t.build) continue;
    const mhp = t._maxHp || prime(t); if (t.hp >= mhp) continue;
    if (t.state !== 'broken' && t.hp >= mhp * BAY_THRESHOLD) continue;
    const td = reg.get(t.id); if (!td) continue;
    const ts = sizeOf(td), tx1 = t.x + ts - 1, ty1 = t.y + ts - 1;
    const dx = Math.max(0, t.x - bx1, bx0 - tx1), dy = Math.max(0, t.y - by1, by0 - ty1);   // gap between footprints
    if (dx > BAY_RADIUS || dy > BAY_RADIUS) continue;
    cand.push(t);
  }
  if (!cand.length) return 0;
  if (cand.length > 1) cand.sort(byIntegrity);
  let n = 0;
  for (let i = 0; i < cand.length && n < BAY_MAX; i++) { const t = cand[i]; if (doRepair(t, reg.get(t.id), true)) { n++; fx('build', t, 4); } }
  cand.length = 0;
  if (n) { sfx('repair', bay); log('Taller de mantenimiento: ' + n + (n === 1 ? ' reparación' : ' reparaciones') + ' · ' + layerName(L), 'ok', 'bay:' + L, 8000); }
  return n;
}
function tick(dt) {
  const G = LD.G; if (!G || !(dt > 0)) return;
  ensure(G);
  if (!cache.occChecked) verifyOccupancy(G);
  if (cache.dirty) rebuildCache();
  const reg = LD.Registry.structures, by = cache.byLayer;
  const heat4 = heatMul(G), storm = !!(G.layers[0] && G.layers[0].weather && G.layers[0].weather.kind === 'storm');
  batchDepth++;
  try {
    for (let L = 0; L < by.length; L++) {
      const arr = by[L]; if (!arr) continue;
      const hot = L === 4, surface = L === 0;
      for (let i = 0; i < arr.length; i++) {
        const inst = arr[i]; if (inst._dead) continue;
        const d = reg.get(inst.id); if (!d) continue;
        if (inst.build) { inst.build.left -= dt; if (inst.build.left <= 0) { inst.build.left = 0; complete(inst, d, false); } continue; }
        if (inst.state === 'broken') continue;
        const mhp = inst._maxHp || prime(inst, d);
        let loss = 0, cause = 'desgaste';
        if (inst.state === 'working' || inst._active) {
          let w = WEAR_RATE * OC_WEAR[(inst.oc | 0) > 7 ? 7 : (inst.oc | 0) < 0 ? 0 : inst.oc | 0];
          if (lubricated(inst, dt)) w /= LUBRICANT_DIV;
          if (inst._overheat) { w *= OVERHEAT_MUL; cause = 'sobrecalentamiento'; }
          loss = w;
        }
        if (hot && !d.heatproof) { if (loss === 0) cause = 'calor del núcleo'; loss += HEAT_RATE * heat4; }
        else if (surface && storm && d.id === 'windmill') { if (loss === 0) cause = 'tormenta'; loss += STORM_WEAR; }
        if (d.id === 'maintenance_bay') bayTick(inst, d, dt);
        if (loss > 0) applyLoss(inst, d, mhp, loss * mhp * dt, cause);
      }
    }
    queueTick(G, dt);
  } finally { batchDepth--; if (batchDepth === 0) flushNetworks(); }
}

/* ── blueprints (decision 28) ── */
function overlaps(d, c) {
  const rs = scratch.resStruct, ro = scratch.resOverlay, s = sizeOf(d), base = c.L * 1e6;
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const k = base + (c.y + y) * 1000 + c.x + x;
    if (rs.has(k) || (!d.overlay && ro.has(k))) return true;
  }
  return false;
}
function reserve(d, c) {
  const set = d.overlay ? scratch.resOverlay : scratch.resStruct, s = sizeOf(d), base = c.L * 1e6;
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) set.add(base + (c.y + y) * 1000 + c.x + x);
}
function queueTick(G, dt) {
  const q = G.flags.bpQueue;
  if (!q || !q.length) { timers.queue = 0; return; }
  timers.queue += dt;
  if (timers.queue < QUEUE_PERIOD) return;
  timers.queue = 0;
  const W = LD.World, reg = LD.Registry.structures;
  scratch.resStruct.clear(); scratch.resOverlay.clear();
  let dropped = 0, placed = false;
  for (let i = 0; i < q.length; i++) {
    const c = q[i], d = c && reg.get(c.id), layer = d && G.layers[c.L];
    if (!d || !layer || !layer.unlocked) { q.splice(i--, 1); dropped++; continue; }
    if (W && typeof W.canPlace === 'function') {
      let r = null; try { r = W.canPlace(c.id, c.L, c.x, c.y, c.rot | 0); } catch (e) { r = null; }
      if (!r || !r.ok) { q.splice(i--, 1); dropped++; continue; }
    }
    if (overlaps(d, c)) continue;
    if (unlocked(c.id) && has(c.L, cost(c.id)) && placeImpl(c.id, c.L, c.x, c.y, c.rot | 0, QUIET)) { q.splice(i, 1); placed = true; break; }
    reserve(d, c);   // an unaffordable cell keeps its tiles for cells behind it in the queue
  }
  scratch.resStruct.clear(); scratch.resOverlay.clear();
  if (dropped) toast(dropped + (dropped === 1 ? ' celda del plano bloqueada y descartada' : ' celdas del plano bloqueadas y descartadas'), 'warn', 'bp-drop', 3000);
  if (!q.length && placed) { log('Plano completado', 'ok'); toast('Plano completado', 'ok', 'bp-done', 3000); }
}
function copyBlueprint(L, x0, y0, x1, y1) {
  const G = LD.G, W = LD.World; if (!G || !W || typeof W.uidAt !== 'function') return null;
  ensure(G); L |= 0;
  if (x1 < x0) { const t = x0; x0 = x1; x1 = t; } if (y1 < y0) { const t = y0; y0 = y1; y1 = t; }
  x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
  const wl = W.layers && W.layers[L];
  if (wl) { x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(wl.w - 1, x1); y1 = Math.min(wl.h - 1, y1); }
  if (x1 < x0 || y1 < y0) return null;
  const reg = LD.Registry.structures, seen = new Set(), cells = [];
  const push = (uid, kind) => {
    if (!uid || seen.has(uid)) return; seen.add(uid);
    const inst = G.structures[uid], d = inst && reg.get(inst.id); if (!d || d.id === 'hub') return;
    const s = sizeOf(d);
    if (inst.x < x0 || inst.y < y0 || inst.x + s - 1 > x1 || inst.y + s - 1 > y1) return;   // whole footprint inside the selection
    cells.push({ dx: inst.x - x0, dy: inst.y - y0, id: inst.id, rot: inst.rot | 0, kind });
  };
  try {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      push(W.uidAt(L, x, y), 'structure');
      if (W.cableAt) push(W.cableAt(L, x, y), 'cable');
      if (W.pipeAt) push(W.pipeAt(L, x, y), 'pipe');
    }
  } catch (e) { console.error('[Build] copyBlueprint', e); return null; }
  if (!cells.length) return null;
  cells.sort(cellOrder);
  return { name: 'Plano ' + (G.blueprints.length + 1), w: x1 - x0 + 1, h: y1 - y0 + 1, cells };
}
function pasteBlueprint(bp, L, x, y) {
  const res = { placed: 0, queued: 0, blocked: 0 };
  const G = LD.G; if (!G || !bp || !Array.isArray(bp.cells)) return res;
  ensure(G); L |= 0; x |= 0; y |= 0;
  const layer = G.layers[L];
  if (!layer || !layer.unlocked) { toast('Estrato bloqueado', 'warn', 'paste-layer'); return res; }
  const W = LD.World, reg = LD.Registry.structures, q = G.flags.bpQueue;
  scratch.resStruct.clear(); scratch.resOverlay.clear();
  batch(() => {
    for (let i = 0; i < bp.cells.length; i++) {
      const c = bp.cells[i], d = reg.get(c.id);
      if (!d || !unlocked(c.id)) { res.blocked++; continue; }
      const cell = { L, x: x + (c.dx | 0), y: y + (c.dy | 0), id: c.id, rot: (c.rot | 0) & 3 };
      if (W && typeof W.canPlace === 'function') {
        let r = null; try { r = W.canPlace(c.id, L, cell.x, cell.y, cell.rot); } catch (e) { r = null; }
        if (!r || !r.ok) { res.blocked++; continue; }
      }
      if (!overlaps(d, cell) && has(L, cost(c.id)) && placeImpl(c.id, L, cell.x, cell.y, cell.rot, SILENT)) { res.placed++; continue; }
      q.push(cell); reserve(d, cell); res.queued++;
    }
  });
  scratch.resStruct.clear(); scratch.resOverlay.clear();
  if (res.placed || res.queued) sfx('blueprint_paste');
  const parts = [];
  if (res.placed) parts.push(res.placed + ' colocadas');
  if (res.queued) parts.push(res.queued + ' en cola');
  if (res.blocked) parts.push(res.blocked + ' bloqueadas');
  const txt = 'Plano' + (bp.name ? ' «' + bp.name + '»' : '') + ': ' + (parts.join(', ') || 'sin celdas');
  log(txt, res.placed || res.queued ? 'ok' : 'warn');
  toast(txt, res.placed || res.queued ? 'ok' : 'warn', 'paste-result', 500);
  return res;
}
function blueprintCost(bp) {
  const out = {}; if (!bp || !Array.isArray(bp.cells)) return out;
  for (let i = 0; i < bp.cells.length; i++) { const c = cost(bp.cells[i].id); for (const k in c) out[k] = (out[k] || 0) + c[k]; }
  return out;
}
function uniqueName(name) {
  const names = new Set(LD.G.blueprints.map(b => b.name));
  if (!names.has(name)) return name;
  const base = name.replace(/ \(\d+\)$/, ''); let i = 2;
  while (names.has(base + ' (' + i + ')')) i++;
  return base + ' (' + i + ')';
}
function saveBlueprint(bp) {
  const G = LD.G; if (!G || !bp || !Array.isArray(bp.cells) || !bp.cells.length) return -1;
  ensure(G);
  const copy = { name: uniqueName(String(bp.name || 'Plano').trim() || 'Plano'), w: bp.w | 0, h: bp.h | 0, cells: bp.cells.map(c => ({ dx: c.dx | 0, dy: c.dy | 0, id: c.id, rot: (c.rot | 0) & 3, kind: c.kind || 'structure' })) };
  G.blueprints.push(copy);
  return G.blueprints.length - 1;
}
function deleteBlueprint(i) { const G = LD.G; if (!G || !(i >= 0 && i < G.blueprints.length)) return false; G.blueprints.splice(i, 1); return true; }
function renameBlueprint(i, name) { const G = LD.G; if (!G || !(i >= 0 && i < G.blueprints.length)) return false; name = String(name || '').trim(); if (!name) return false; G.blueprints[i].name = uniqueName(name); return true; }
function queue() { const G = LD.G; return G && G.flags && Array.isArray(G.flags.bpQueue) ? G.flags.bpQueue : EMPTY_ARR; }
function clearQueue() { const G = LD.G; if (!G || !G.flags || !G.flags.bpQueue) return 0; const n = G.flags.bpQueue.length; G.flags.bpQueue.length = 0; if (n) toast('Cola del plano cancelada (' + n + ')', 'info', 'bp-clear'); return n; }

LD.Sim.Build = {
  WEAR_RATE, HEAT_RATE, STORM_WEAR, OC_WEAR, LUBRICANT_RATE, LUBRICANT_DIV, OVERHEAT_MUL, LOW_INTEGRITY: LOW, HUB_FLOOR, REFUND_BUILT,
  BAY_RADIUS, BAY_PERIOD, BAY_MAX, BAY_THRESHOLD, QUEUE_PERIOD,
  init, tick, rebuildOccupancy, batch,
  cost, canAfford, isUnlocked: unlocked, place, placeFree,
  dismantle, canDismantle, refundPreview, repair, repairCost,
  setOverclock, setPaused, rotate,
  integrity, integrityMul, maxHp, damage, wearRate, timeToBreak, buildProgress,
  structuresIn, elevatorsIn, hubOf, footprint,
  copyBlueprint, pasteBlueprint, blueprintCost, saveBlueprint, deleteBlueprint, renameBlueprint, queue, clearQueue
};
E.on('game:new', () => init(LD.G));
E.on('game:loaded', () => init(LD.G));
E.on('structure:placed', markDirty);
E.on('structure:removed', markDirty);
})();
