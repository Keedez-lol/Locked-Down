(() => {
'use strict';
const LD = window.LD, U = LD.U, E = LD.Events;
const Sim = LD.Sim = LD.Sim || {};

const RESCAN = 5;        // s between defensive rescans of the structure table (event-driven rebuilds are the norm)
const QUEUE_RETRY = 1;   // s between attempts to start a queued tech that could not be afforded

let curG = null, labUids = [], labsDirty = true, rescanAcc = 0, retryAcc = 0;
const info = { speed: 0, labs: 0, working: 0 };

const techOf = id => (id && typeof id === 'object') ? id : (LD.Registry.techs.get(id) || null);
const structDef = id => LD.Registry.structures.get(id);
const Eco = () => Sim.Economy || null;
const hasKeys = o => { for (const k in o) return true; return false; };
const costSum = t => { let s = 0; for (const k in (t.cost || {})) s += t.cost[k]; return s; };
const byEraCost = (a, b) => (a.era - b.era) || (costSum(a) - costSum(b)) || a.name.localeCompare(b.name);
const log = (text, kind) => { if (LD.State && LD.State.log) LD.State.log(text, kind); };
const toast = (text, kind) => E.emit('toast', { text, kind });
const sfx = name => { const A = LD.Audio; if (A && A.play) A.play(name); };

const markDirty = () => { labsDirty = true; };
E.on('structure:placed', markDirty); E.on('structure:built', markDirty); E.on('structure:removed', markDirty);
E.on('game:new', markDirty); E.on('game:loaded', markDirty);

function rebuildLabs() {
  const G = LD.G; labUids.length = 0; labsDirty = false; rescanAcc = 0;
  if (!G) return;
  for (const uid in G.structures) { const def = structDef(G.structures[uid].id); if (def && def.lab) labUids.push(uid); }
}

function pay(cost) {
  const G = LD.G, eco = Eco();
  if (eco && eco.take) return !!eco.take(0, cost);
  const inv = G.inv[0];
  for (const k in cost) if ((inv[k] || 0) < cost[k]) return false;
  for (const k in cost) { inv[k] -= cost[k]; if (inv[k] <= 0) delete inv[k]; E.emit('inv:changed', { layer: 0, item: k }); }
  return true;
}
function refund(cost) {
  const G = LD.G, eco = Eco();
  for (const k in cost) {
    if (eco && eco.add) eco.add(0, k, cost[k]);
    else { G.inv[0][k] = (G.inv[0][k] || 0) + cost[k]; E.emit('inv:changed', { layer: 0, item: k }); }
  }
}

function check(id, ignoreBusy) {
  const G = LD.G, t = techOf(id);
  const res = { ok: false, missing: {}, prereqs: [], reason: null };
  if (!G || !t) { res.reason = 'unknown'; return res; }
  const R = G.research;
  if (R.done[t.id]) { res.reason = 'done'; return res; }
  for (const r of (t.requires || [])) if (!R.done[r]) res.prereqs.push(r);
  const inv = G.inv[0] || {};
  for (const k in (t.cost || {})) { const short = t.cost[k] - (inv[k] || 0); if (short > 0) res.missing[k] = short; }
  if (res.prereqs.length) res.reason = 'prereqs';
  else if (hasKeys(res.missing)) res.reason = 'cost';
  else if (!ignoreBusy && R.current) res.reason = R.current.tech === t.id ? 'running' : 'busy';
  else res.ok = true;
  return res;
}

function powerRatio(inst) {
  if (typeof inst._powerRatio === 'number') return U.clamp(inst._powerRatio);
  const P = Sim.Power; if (!P || !P.gridOf) return 1;
  const g = P.gridOf(inst.uid); if (!g) return 0;
  return g.ratio == null ? 1 : U.clamp(g.ratio);
}
/* Base demand for this tick (Power applies the 2^oc overclock factor itself): `inst._wantPower`, plus Power.setDemand when present. */
function setDemand(inst, w) { inst._wantPower = w; const P = Sim.Power; if (P && typeof P.setDemand === 'function') P.setDemand(inst.uid, w); }
function linked(uid) { const eco = Eco(); return eco && eco.isLinked ? !!eco.isLinked(uid) : true; }
function integrityMul(inst, def) {
  const B = Sim.Build; if (B && B.integrityMul) return B.integrityMul(inst);
  const max = def.hp || 1, i = U.clamp((inst.hp == null ? max : inst.hp) / max);
  return i < 0.3 ? Math.max(0.1, 1 - 0.03 * (30 - i * 100)) : 1;
}

/* Sums the research speed (labs/s) available for tech `t`; apply=true also writes lab states and power demands.
   A lab that is also a machine with an active recipe (study_table crafting rp0) keeps Economy's state/demand. */
function evalLabs(t, apply) {
  const G = LD.G; let total = 0, labs = 0, working = 0;
  for (let i = 0; i < labUids.length; i++) {
    const uid = labUids[i], inst = G.structures[uid];
    if (!inst) { labsDirty = true; continue; }
    const def = structDef(inst.id); if (!def || !def.lab) continue;
    const powered = !!(def.power && def.power.use), owned = !(def.types && inst.recipe);
    if (inst.build || inst.state === 'broken' || inst.paused) { if (apply && powered && owned) setDemand(inst, 0); continue; }
    labs++;
    let st = 'idle', s = 0;
    if (t && def.lab.tier >= (t.lab | 0)) {
      if (!linked(uid)) st = 'no_link';
      else {
        let ratio = 1;
        if (powered) { if (apply && owned) setDemand(inst, def.power.use); ratio = powerRatio(inst); }
        if (ratio < 0.02) st = 'no_power';
        else { st = 'working'; s = ratio * Math.pow(1.5, inst.oc | 0) * integrityMul(inst, def); working++; }
      }
    }
    if (apply && owned) { inst.state = st; if (powered && (st === 'idle' || st === 'no_link')) setDemand(inst, 0); }
    total += s;
  }
  if (apply) { info.speed = total; info.labs = labs; info.working = working; }
  return total;
}

function prereqChain(id, out, seen) {
  const G = LD.G, t = techOf(id); if (!t || seen[t.id]) return; seen[t.id] = true;
  for (const r of (t.requires || [])) if (!G.research.done[r]) prereqChain(r, out, seen);
  out.push(t.id);
}

/* Drops queued techs whose prerequisites are neither done, running nor queued (they could never start). */
function pruneStranded(R) {
  let changed = true;
  while (changed) {
    changed = false;
    for (let j = R.queue.length - 1; j >= 0; j--) {
      const t = techOf(R.queue[j]);
      if (!t || (t.requires || []).some(r => !R.done[r] && !R.queue.includes(r) && !(R.current && R.current.tech === r))) { R.queue.splice(j, 1); changed = true; }
    }
  }
}

function tryQueue() {
  const G = LD.G, R = G.research;
  for (let i = R.queue.length - 1; i >= 0; i--) { const id = R.queue[i]; if (!techOf(id) || R.done[id]) R.queue.splice(i, 1); }
  if (R.current) return false;
  for (let i = 0; i < R.queue.length; i++) if (check(R.queue[i], true).ok) return startTech(R.queue[i], true);
  return false;
}

/* auto=true when the queue starts a tech by itself: the UI plays its own sound for user-initiated starts */
function startTech(techId, auto) {
  const G = LD.G, t = techOf(techId); if (!G || !t) return false;
  if (!check(t, false).ok) return false;
  if (!pay(t.cost || {})) return false;
  const R = G.research, qi = R.queue.indexOf(t.id); if (qi >= 0) R.queue.splice(qi, 1);
  R.current = { tech: t.id, left: t.time, total: t.time };
  G.discovered.techs[t.id] = true;
  retryAcc = 0;
  log('Investigación iniciada: ' + t.name, 'info');
  if (auto) sfx('research');
  E.emit('tech:started', t.id);
  return true;
}

function complete(id) {
  const G = LD.G, R = G.research, D = G.discovered, t = techOf(id);
  R.done[id] = true; R.current = null;
  D.techs[id] = true;
  const un = (t && t.unlocks) || {};
  for (const s of (un.structures || [])) D.structures[s] = true;
  for (const r of (un.recipes || [])) D.recipes[r] = true;
  for (const o of LD.Registry.techs.values()) if (!R.done[o.id] && (o.requires || []).every(r => R.done[r])) D.techs[o.id] = true;
  const prevEra = G.meta.era | 0, era = Research.eraOf(G);
  if (era > prevEra) G.meta.era = era;
  const name = t ? t.name : id;
  log('Investigación completada: ' + name, 'ok');
  toast('Investigación completada: ' + name, 'ok');
  sfx('research_done');
  E.emit('tech:researched', id);
  if (era > prevEra) { log('Nueva era: ' + U.eraName(era), 'ok'); toast('Nueva era alcanzada: ' + U.eraName(era), 'ok'); }
  tryQueue();
}

const Research = Sim.Research = {
  canStart(techId) { return check(techId, false); },
  costOf(techId) { const t = techOf(techId); return t ? (t.cost || {}) : {}; },

  start(techId) { return startTech(techId, false); },

  queue(techId) {
    const G = LD.G, t = techOf(techId); if (!G || !t) return false;
    const R = G.research;
    if (R.done[t.id] || (R.current && R.current.tech === t.id) || R.queue.includes(t.id)) return false;
    const chain = []; prereqChain(t.id, chain, {});
    for (const id of chain) if (!R.queue.includes(id) && !(R.current && R.current.tech === id)) R.queue.push(id);
    if (!R.current) tryQueue();
    return true;
  },

  dequeue(techId) {
    const G = LD.G; if (!G) return false;
    const R = G.research, i = R.queue.indexOf(techId); if (i < 0) return false;
    R.queue.splice(i, 1);
    pruneStranded(R);
    return true;
  },

  cancel() {
    const G = LD.G; if (!G || !G.research.current) return false;
    const cur = G.research.current, t = techOf(cur.tech);
    G.research.current = null;
    if (t) refund(t.cost || {});
    pruneStranded(G.research);
    log('Investigación cancelada: ' + (t ? t.name : cur.tech) + ' (coste devuelto al almacén de superficie)', 'warn');
    toast('Investigación cancelada', 'warn');
    return true;
  },

  tick(dt) {
    const G = LD.G; if (!G) return;
    if (G !== curG) { curG = G; labsDirty = true; retryAcc = 0; }
    rescanAcc += dt;
    if (labsDirty || rescanAcc >= RESCAN) rebuildLabs();
    const R = G.research;
    let cur = R.current;
    if (cur && (!techOf(cur.tech) || R.done[cur.tech])) R.current = cur = null;
    if (!cur) {
      evalLabs(null, true);
      if (R.queue.length) { retryAcc += dt; if (retryAcc >= QUEUE_RETRY) { retryAcc = 0; tryQueue(); } }
      return;
    }
    const speed = evalLabs(techOf(cur.tech), true);
    if (speed > 0) { cur.left -= dt * speed; if (cur.left <= 0) complete(cur.tech); }
  },

  isDone(id) { const G = LD.G; return !!(G && G.research.done[id]); },
  isUnlocked(kind, id) {
    const R = LD.Registry;
    if (R.isStart(kind, id)) return true;
    const t = R.unlockerOf(kind, id);
    return !!(t && LD.G && LD.G.research.done[t]);
  },
  unlockerOf(kind, id) { return LD.Registry.unlockerOf(kind, id); },

  available() {
    const G = LD.G, out = []; if (!G) return out;
    const R = G.research;
    for (const t of LD.Registry.techs.values()) if (!R.done[t.id] && (t.requires || []).every(r => R.done[r])) out.push(t);
    return out.sort(byEraCost);
  },

  nextSteps() {
    const G = LD.G; if (!G) return [];
    const inv = G.inv[0] || {}, R = G.research, cur = R.current && R.current.tech, out = [];
    for (const t of Research.available()) {
      if (t.id === cur) continue;
      const missing = {}; let affordable = true;
      for (const k in (t.cost || {})) { const s = t.cost[k] - (inv[k] || 0); if (s > 0) { missing[k] = s; affordable = false; } }
      out.push({ tech: t, missing, affordable, queued: R.queue.includes(t.id) });
    }
    return out;
  },

  eraOf(G = LD.G) {
    let era = 0; if (!G) return 0;
    for (const id in G.research.done) { const t = techOf(id); if (t && t.era > era) era = t.era; }
    return era;
  },

  labSpeed(tech) { if (!LD.G) return 0; if (labsDirty) rebuildLabs(); return evalLabs(techOf(tech), false); },
  labInfo() { return info; },

  progress() {
    const G = LD.G; if (!G || !G.research.current) return null;
    const c = G.research.current;
    return { tech: c.tech, left: c.left, total: c.total, speed: info.speed, eta: info.speed > 0 ? c.left / info.speed : Infinity };
  },

  queued() { const G = LD.G; return G ? G.research.queue : []; },
  isQueued(id) { const G = LD.G; return !!(G && G.research.queue.includes(id)); },
  isRunning(id) { const G = LD.G; return !!(G && G.research.current && G.research.current.tech === id); }
};
})();
