(() => {
'use strict';
const LD = window.LD, U = LD.U, E = LD.Events;
LD.Sim = LD.Sim || {};
const DAY = 600, DAY_START = 0.3, NL = 5;
const R = () => LD.Registry;
const World = () => LD.World;
const Eco = () => LD.Sim.Economy;

/* ── objectives (checked once per second) ── */
const isBuilt = (G, pred) => { for (const uid in G.structures) { const s = G.structures[uid]; if (s.build) continue; const d = R().structure(s.id); if (d && pred(d, s)) return true; } return false; };
const built = id => G => isBuilt(G, d => d.id === id);
const OBJECTIVES = [
  { id: 'gather_20_sticks', title: 'Reúne 20 palos', desc: 'Usa la herramienta manual (H) sobre bosque o pradera.', check: G => (G.inv[0].stick || 0) >= 20 },
  { id: 'build_workbench', title: 'Construye una mesa de trabajo', desc: 'Abre construcción (B) y colócala junto al almacén central.', check: built('workbench') },
  { id: 'build_woodcutter', title: 'Construye una cabaña del leñador', desc: 'Su radio debe cubrir casillas de bosque.', check: built('woodcutter') },
  { id: 'build_quarry', title: 'Abre una cantera', desc: 'Sobre roca: produce piedra y sílex.', check: built('quarry') },
  { id: 'build_furnace', title: 'Enciende un horno de piedra', desc: 'Funde mineral quemando leña o carbón vegetal.', check: built('stone_furnace') },
  { id: 'research_first', title: 'Investiga tu primera tecnología', desc: 'Mesa de estudio + saber primitivo. Pulsa T.', check: G => Object.keys(G.research.done).length > 0 },
  { id: 'build_conveyor', title: 'Tiende una cinta transportadora', desc: 'Conecta las máquinas al almacén central.', check: G => isBuilt(G, d => !!d.conveyor) },
  { id: 'build_water_wheel', title: 'Genera energía mecánica', desc: 'Rueda hidráulica junto al agua o molino de viento.', check: G => isBuilt(G, d => d.id === 'water_wheel' || d.id === 'windmill') },
  { id: 'build_steam_engine', title: 'Pon en marcha una máquina de vapor', desc: 'Necesita combustible y agua por tubería.', check: built('steam_engine') },
  { id: 'build_shaft', title: 'Excava un pozo minero', desc: 'Abre el acceso al primer estrato inferior.', check: G => isBuilt(G, d => !!d.shaft) },
  { id: 'excavate_chunk', title: 'Excava un sector de roca', desc: 'Coloca una tuneladora pegada a la roca sin excavar.', check: G => (G.flags.chunksDug || 0) > 0 },
  { id: 'build_turret', title: 'Levanta una defensa', desc: 'Torre de vigía con flechas y empalizadas.', check: G => isBuilt(G, d => !!d.turret) },
  { id: 'survive_wave', title: 'Sobrevive a una oleada', desc: 'Las oleadas atacan el almacén central y los elevadores.', check: G => (G.flags.wavesSurvived || 0) > 0 || (G.stats.waves || 0) > 0 },
  { id: 'reach_era_3', title: 'Alcanza la era eléctrica', desc: 'Investiga hasta la era 3.', check: G => (G.meta.era || 0) >= 3 },
  { id: 'build_fission', title: 'Enciende un reactor de fisión', desc: 'Completa la cadena del uranio.', check: built('fission_reactor') },
  { id: 'build_fusion', title: 'Enciende el reactor de fusión', desc: 'El objetivo final: 2 GW desde el núcleo.', check: built('fusion_reactor') }
];
const OBJ_WINDOW = 4;
function refillObjectives(G) {
  const cur = G.objectives.current; cur.length = 0;
  for (const o of OBJECTIVES) { if (G.objectives.done[o.id]) continue; cur.push({ id: o.id, title: o.title, hint: o.desc }); if (cur.length >= OBJ_WINDOW) break; }
}
function checkObjectives() {
  const G = LD.G; if (!G) return;
  if (!G.objectives) G.objectives = { done: {}, current: [] };
  if (!G.objectives.current.length) refillObjectives(G);
  let changed = false;
  for (const c of G.objectives.current.slice()) {
    const id = typeof c === 'string' ? c : c && c.id;
    const o = OBJECTIVES.find(x => x.id === id); if (!o) continue;
    let ok = false; try { ok = !!o.check(G); } catch (e) { ok = false; }
    if (!ok) continue;
    G.objectives.done[id] = true; changed = true;
    LD.State.log('Objetivo cumplido: ' + o.title, 'ok');
    if (LD.Audio && LD.Audio.play) LD.Audio.play('objective');
    E.emit('objective:done', id);
  }
  if (changed) refillObjectives(G);
}

/* ── free placement (hub, elevators, debug) ── */
function makeInstance(def, L, x, y, rot) {
  return { uid: U.uid(), id: def.id, layer: L, x, y, rot: (rot | 0) & 3, hp: def.hp || 100, state: 'idle', build: null, oc: 0, recipe: null, progress: 0, loaded: false, paused: false, fuel: 0,
    tank: def.tank ? { fluid: null, amt: 0 } : null, rules: def.elevator ? Eco().DEFAULT_RULES() : undefined, target: null, stats: { made: 0 } };
}
function placeFree(id, L, x, y, rot = 0) {
  const G = LD.G, B = LD.Sim.Build, W = World();
  if (!G) return null;
  if (B && B.placeFree) { try { const uid = B.placeFree(id, L, x, y, rot, true); if (uid) return uid; } catch (e) { console.error('[Sim] Build.placeFree', e); } }
  const def = R().structure(id); if (!def) return null;
  const inst = makeInstance(def, L, x, y, rot);
  G.structures[inst.uid] = inst;
  if (W) { if (def.overlay) W.setOverlay(def.overlay, L, x, y, inst.uid); else W.setOcc(L, x, y, def.size || 1, def.size || 1, inst.uid); }
  G.discovered.structures[id] = true;
  Eco().rebuildNetworks(L);
  if (LD.Sim.Defense && LD.Sim.Defense.markPathsDirty) LD.Sim.Defense.markPathsDirty(L);
  E.emit('structure:placed', inst.uid);
  E.emit('structure:built', inst.uid);
  return inst.uid;
}
/* nearest anchor around (cx,cy) where a size×size structure fits */
function findSpot(id, L, cx, cy, size) {
  const W = World();
  const half = Math.floor(size / 2);
  for (let rad = 0; rad <= 8; rad++) for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
    const x = cx - half + dx, y = cy - half + dy;
    let ok = true;
    if (W && W.canPlace) { const c = W.canPlace(id, L, x, y, 0); ok = !!(c && c.ok); }
    else if (W && W.isBuildable) { for (let j = 0; j < size && ok; j++) for (let i = 0; i < size && ok; i++) ok = W.isBuildable(L, x + i, y + j); }
    if (ok) return { x, y };
  }
  return { x: cx - half, y: cy - half };
}
function hubOf(G) { for (const uid in G.structures) if (G.structures[uid].id === 'hub') return G.structures[uid]; return null; }

const Sim = LD.Sim;
Sim.paused = false; Sim.speed = 1; Sim.ff = false; Sim.OBJECTIVES = OBJECTIVES;
let tickAcc = 0, secAcc = 0, listening = false;
const errAt = {};

Sim.init = function (G, { fresh = false } = {}) {
  LD.G = G;
  const W = World();
  if (W && W.gen) W.gen(G);
  const S = LD.Sim;
  const callInit = m => { if (m && typeof m.init === 'function') { try { m.init(G); } catch (e) { console.error('[Sim] init failed', e); } } };
  callInit(S.Economy);
  if (fresh) Sim.newGameSetup(G);
  for (const uid in G.structures) {
    const inst = G.structures[uid], def = R().structure(inst.id);
    if (!def) { console.warn('[Sim] dropping unknown structure ' + inst.id); delete G.structures[uid]; continue; }
    if (inst.uid !== uid) inst.uid = uid;
    if (W) { if (def.overlay) W.setOverlay(def.overlay, inst.layer, inst.x, inst.y, uid); else W.setOcc(inst.layer, inst.x, inst.y, def.size || 1, def.size || 1, uid); }
  }
  callInit(S.Fluids); callInit(S.Power); callInit(S.Build);
  S.Economy.rebuildNetworks();
  callInit(S.Research); callInit(S.Nature); callInit(S.Events); callInit(S.Defense); callInit(S.Stats);
  if (!G.objectives) G.objectives = { done: {}, current: [] };
  refillObjectives(G);
  if (!listening) { listening = true; E.on('wave:ended', () => { if (LD.G) LD.G.flags.wavesSurvived = (LD.G.flags.wavesSurvived || 0) + 1; }); }
  Sim.paused = false; Sim.speed = 1; Sim.ff = false; tickAcc = 0; secAcc = 0;
  for (const k in errAt) delete errAt[k];
  return G;
};

Sim.newGameSetup = function (G) {
  const W = World(), Ec = Eco();
  const c = W && W.centre ? W.centre(0) : { x: 128, y: 96 };
  if (!hubOf(G)) { const p = findSpot('hub', 0, c.x, c.y, 3); placeFree('hub', 0, p.x, p.y, 0); }
  const starter = { stick: 12, stone: 8, plant_fiber: 6 };
  for (const id in starter) if (R().item(id)) Ec.give(0, id, starter[id]);
  for (const id of R().START.structures) G.discovered.structures[id] = true;
  for (const id of R().START.recipes) G.discovered.recipes[id] = true;
  G.layers[0].waveAt = G.time.t + 900;
  G.discovered.layers[0] = true;
  G.view.layer = 0;
  if (!G.objectives) G.objectives = { done: {}, current: [] };
  refillObjectives(G);
  LD.State.log('Nueva colonia: ' + G.meta.name, 'ok');
};

Sim.unlockLayer = function (L) {
  const G = LD.G, W = World(); L = L | 0;
  if (!G || L < 1 || L >= NL || !G.layers[L]) return false;
  const lay = G.layers[L], ldef = R().layer(L) || {};
  const first = !lay.unlocked;
  lay.unlocked = true; G.discovered.layers[L] = true;
  const c = W && W.centre ? W.centre(L) : { x: 64, y: 48 };
  if (W && W.excavateStart) W.excavateStart(L, false);
  else if (W && W.chunkOf && W.excavate) {
    const ch = W.chunkOf(L, c.x, c.y);
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const cx = ch.cx + dx, cy = ch.cy + dy;
      if (W.layers[L] && (cx < 0 || cy < 0 || cx >= W.layers[L].cw || cy >= W.layers[L].ch)) continue;
      if (!W.isExcavated(L, cx, cy)) W.excavate(L, cx, cy);
    }
  }
  let elev = lay.elevator && G.structures[lay.elevator] ? G.structures[lay.elevator] : null;
  if (!elev) for (const uid in G.structures) { const s = G.structures[uid]; const d = R().structure(s.id); if (s.layer === L && d && d.elevator) { elev = s; break; } }
  if (!elev && R().structure('elevator')) { const p = findSpot('elevator', L, c.x, c.y, 2); const uid = placeFree('elevator', L, p.x, p.y, 0); if (uid) elev = G.structures[uid]; }
  if (elev) lay.elevator = elev.uid;
  Eco().rebuildNetworks(L);
  if (LD.Sim.Defense && LD.Sim.Defense.markPathsDirty) LD.Sim.Defense.markPathsDirty(L);
  if (!lay.waveAt || lay.waveAt < G.time.t) lay.waveAt = G.time.t + (ldef.waveBase || 720);
  E.emit('layer:unlocked', L);
  if (first) {
    const name = ldef.name || ('Estrato ' + L);
    E.emit('toast', { text: 'Nuevo estrato accesible: ' + name, kind: 'ok' });
    LD.State.log('Estrato desbloqueado: ' + name + '. Elevador instalado en el centro.', 'ok');
  }
  return true;
};

Sim.setPaused = function (v) { Sim.paused = !!v; };
Sim.setSpeed = function (n) { Sim.speed = n >= 4 ? 4 : n >= 2 ? 2 : 1; return Sim.speed; };
Sim.checkObjectives = checkObjectives;
Sim.objectives = function () { const G = LD.G; return OBJECTIVES.map(o => ({ id: o.id, title: o.title, desc: o.desc, done: !!(G && G.objectives.done[o.id]), active: !!(G && G.objectives.current.some(c => (typeof c === 'string' ? c : c && c.id) === o.id)) })); };
Sim.placeFree = placeFree;

function run(name, mod, dt) {
  if (!mod || typeof mod.tick !== 'function') return;
  try { mod.tick(dt); }
  catch (e) {
    const t = LD.G ? LD.G.time.t : 0;
    if (errAt[name] === undefined || t - errAt[name] >= 10) { errAt[name] = t; console.error('[Sim] ' + name + '.tick failed', e); }
  }
}
Sim.tick = function (dt) {
  const G = LD.G; if (!G) return;
  const S = LD.Sim;
  run('Events', S.Events, dt);
  run('Nature', S.Nature, dt);
  run('Economy', S.Economy, dt);
  run('Fluids', S.Fluids, dt);
  run('Power', S.Power, dt);
  run('Build', S.Build, dt);
  run('Research', S.Research, dt);
  run('Defense', S.Defense, dt);
  run('Stats', S.Stats, dt);
  G.time.t += dt;
  const d = DAY_START + G.time.t / DAY;
  G.time.dayFrac = d - Math.floor(d);
  G.time.day = 1 + Math.floor(d);
  secAcc += dt;
  if (secAcc >= 1) {
    secAcc -= 1;
    if (S.Research && S.Research.eraOf) { try { G.meta.era = S.Research.eraOf(G) | 0; } catch (e) { /* optional */ } }
    checkObjectives();
  }
  tickAcc += dt;
  if (tickAcc >= 0.5 - 1e-9) { tickAcc = 0; E.emit('tick', { t: G.time.t }); }
};

/* ── LD.Debug ── */
const D = LD.Debug = {
  ff(seconds) {
    const G = LD.G; if (!G) return 0;
    const n = Math.min(36000, Math.max(0, Math.round((+seconds || 0) / 0.1)));
    const t0 = U.now(), wasPaused = Sim.paused;
    Sim.ff = true; Sim.paused = false;
    try { for (let i = 0; i < n; i++) Sim.tick(0.1); }
    finally { Sim.ff = false; Sim.paused = wasPaused; }
    if (LD.Tex && LD.Tex.invalidateLayer) for (let L = 0; L < NL; L++) if (G.layers[L].unlocked) { try { LD.Tex.invalidateLayer(L); } catch (e) { /* optional */ } }
    return Math.round(U.now() - t0);
  },
  give(L, id, n = 100) { const G = LD.G; if (!G || !R().item(id)) return 0; return Eco().give(L | 0, id, Math.max(0, Math.floor(n))); },
  giveAll(n = 100) {
    const G = LD.G; if (!G) return 0;
    let k = 0;
    for (const it of R().items.values()) {
      if (it.cat === 'fluid' || it.cat === 'gas') continue;
      for (let L = 0; L < NL; L++) if (L === 0 || G.layers[L].unlocked) { Eco().give(L, it.id, n); k++; }
    }
    return k;
  },
  unlockAll() {
    const G = LD.G; if (!G) return 0;
    const Rs = LD.Sim.Research;
    let k = 0;
    for (const t of R().techs.values()) {
      if (G.research.done[t.id]) continue;
      G.research.done[t.id] = true; G.discovered.techs[t.id] = true; k++;
      for (const s of (t.unlocks && t.unlocks.structures) || []) G.discovered.structures[s] = true;
      for (const r of (t.unlocks && t.unlocks.recipes) || []) G.discovered.recipes[r] = true;
      E.emit('tech:researched', t.id);
    }
    G.research.current = null; G.research.queue.length = 0;
    if (Rs && Rs.eraOf) { try { G.meta.era = Rs.eraOf(G) | 0; } catch (e) { G.meta.era = 7; } } else G.meta.era = 7;
    return k;
  },
  unlockLayer(L) { return Sim.unlockLayer(L); },
  excavateAll(L) {
    const G = LD.G, W = World(); L = L | 0;
    if (!G || !W || !W.layers[L] || L < 1) return 0;
    if (!G.layers[L].unlocked) Sim.unlockLayer(L);
    const lay = W.layers[L]; let k = 0;
    if (W.excavateAll) k = W.excavateAll(L);
    else for (let cy = 0; cy < lay.ch; cy++) for (let cx = 0; cx < lay.cw; cx++) if (!W.isExcavated(L, cx, cy)) { W.excavate(L, cx, cy); k++; }
    G.layers[L].digging = {};
    for (const uid in G.structures) { const s = G.structures[uid]; if (s.layer === L) s.target = null; }
    Eco().rebuildNetworks(L);
    if (LD.Tex && LD.Tex.invalidateLayer) LD.Tex.invalidateLayer(L);
    return k;
  },
  place(id, L, x, y, rot = 0) {
    const G = LD.G; if (!G || !R().structure(id)) return null;
    L = L | 0;
    if (L > 0 && !G.layers[L].unlocked) Sim.unlockLayer(L);
    const def = R().structure(id);
    if (L > 0 && World() && World().chunkOf) { const c = World().chunkOf(L, x, y); if (!World().isExcavated(L, c.cx, c.cy)) World().excavate(L, c.cx, c.cy); }
    const uid = placeFree(id, L, x | 0, y | 0, rot);
    if (uid && def.elevator && !G.layers[L].elevator) G.layers[L].elevator = uid;
    return uid;
  },
  spawnWave(L = 0) { const Df = LD.Sim.Defense; if (Df && Df.spawnWave) return Df.spawnWave(L | 0); return null; },
  setThreat(L, v) { const G = LD.G; if (!G || !G.layers[L | 0]) return 0; G.layers[L | 0].threat = Math.max(0, +v || 0); return G.layers[L | 0].threat; },
  setSpeed(n) { return Sim.setSpeed(n); },
  state() {
    const G = LD.G; if (!G) return null;
    const P = LD.Sim.Power, Df = LD.Sim.Defense;
    const inv = G.inv.map(o => { let items = 0, units = 0; for (const k in o) { items++; units += o[k]; } return { items, units }; });
    const states = {}, byId = {};
    for (const uid in G.structures) { const s = G.structures[uid]; states[s.state] = (states[s.state] || 0) + 1; byId[s.id] = (byId[s.id] || 0) + 1; }
    const layers = G.layers.map((l, i) => ({ unlocked: l.unlocked, threat: U.round(l.threat, 2), waveIn: l.waveAt ? U.round(l.waveAt - G.time.t) : null, excavated: Object.keys(l.excavated).length, digging: Object.keys(l.digging).length, weather: l.weather && l.weather.kind, enemies: G.enemies.filter(e => e.layer === i).length }));
    const power = [];
    if (P && P.summary) for (let L = 0; L < NL; L++) if (G.layers[L].unlocked) { try { const s = P.summary(L); power.push({ layer: L, gen: U.fmtW(s.gen || 0), use: U.fmtW(s.use || 0), ratio: U.round(s.ratio === undefined ? 1 : s.ratio, 2), grids: s.grids || 0 }); } catch (e) { /* optional */ } }
    return { era: G.meta.era, eraName: U.eraName(G.meta.era), day: G.time.day, clock: U.fmtClock(G.time.dayFrac), t: U.round(G.time.t, 1), playtime: U.fmtTime(G.meta.playtime), inv, structures: Object.keys(G.structures).length, states, byId, power, layers,
      research: G.research.current ? { tech: G.research.current.tech, left: U.round(G.research.current.left) } : null, techs: Object.keys(G.research.done).length, enemies: G.enemies.length, objectives: Object.keys(G.objectives.done).length + '/' + OBJECTIVES.length, threatFn: !!(Df && Df.threat) };
  },
  tp(L, x, y) {
    const G = LD.G; if (!G) return false;
    L = L | 0;
    if (LD.Main && LD.Main.switchLayer) LD.Main.switchLayer(L, true); else G.view.layer = L;
    if (LD.Render && LD.Render.centerOn) LD.Render.centerOn(L, x, y);
    return true;
  },
  fluid(L, id, n = 100) {
    const G = LD.G, F = LD.Sim.Fluids; L = L | 0;
    if (!G || !R().item(id)) return 0;
    if (F && F.inject) { const put = F.inject(L, id, n); if (put > 0) { Eco().discover(id); return put; } }
    const CRYO = new Set(['liquid_nitrogen', 'deuterium', 'tritium', 'helium3', 'cryo_coolant', 'liquid_hydrogen']);
    for (const uid in G.structures) {
      const s = G.structures[uid]; if (s.layer !== L || s.build) continue;
      const d = R().structure(s.id); if (!d || !d.tank) continue;
      if (CRYO.has(id) && !d.tank.cryo) continue;
      if (!s.tank) s.tank = { fluid: null, amt: 0 };
      if (s.tank.fluid && s.tank.fluid !== id && s.tank.amt > 0) continue;
      if (s.tank.fluid !== id) { if (F && F.setTankFluid) F.setTankFluid(uid, id); s.tank.fluid = id; s.tank.amt = 0; }
      const room = d.tank.cap - s.tank.amt; if (room <= 0) continue;
      const put = Math.min(room, n); s.tank.amt += put;
      Eco().discover(id);
      if (F && F.rebuild) F.rebuild(L);
      return put;
    }
    return 0;
  },
  event(kind, L = 0) { const Ev = LD.Sim.Events; if (Ev && Ev.trigger) return Ev.trigger(kind, L | 0); return null; },
  objectives() { return Sim.objectives(); }
};
})();
