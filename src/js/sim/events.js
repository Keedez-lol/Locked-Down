(() => {
'use strict';
const LD = window.LD, U = LD.U, E = LD.Events;
const Sim = LD.Sim = LD.Sim || {};

const TILE = 48;
const WEATHER = [['clear', 55], ['fog', 15], ['rain', 20], ['storm', 10]];
const W_MIN = 180, W_MAX = 480, W_WARN = 30;
const EV_MIN = 720, EV_MAX = 1500, EV_WARN = 60, EV_GRACE = 600;
const DURATION = { earthquake: 6, plasma_storm: 90, migration: 45, vein: 30 };
const ONE = { pump: 1, solar: 1, wind: 1, ambient: 1, turretRange: 0 };
const MULT = {
  clear: ONE,
  fog:   { pump: 1, solar: 1, wind: 1, ambient: 0.8, turretRange: -1 },
  rain:  { pump: 1.5, solar: 0.3, wind: 1, ambient: 1, turretRange: 0 },
  storm: { pump: 1.5, solar: 0.3, wind: 1.6, ambient: 0.9, turretRange: 0 }
};
const WEATHER_NAMES = { clear: 'Despejado', fog: 'Niebla', rain: 'Lluvia', storm: 'Tormenta' };
const EVENT_NAMES = { earthquake: 'Terremoto', plasma_storm: 'Tormenta de plasma', migration: 'Migración', vein: 'Nueva veta' };
const CLEAR = { kind: 'clear', until: Infinity, next: null };

let curG = null, plasmaAcc = 0;
const candK = [], candL = [], candW = [];
const blobX = new Int32Array(64), blobY = new Int32Array(64);

const log = (text, kind) => { if (LD.State && LD.State.log) LD.State.log(text, kind); };
const toast = (text, kind) => E.emit('toast', { text, kind });
const sfx = name => { const A = LD.Audio; if (A && A.play) A.play(name); };
const layerName = L => { const d = LD.Registry.layer(L); return d && d.name ? d.name : 'estrato ' + L; };
const itemName = id => LD.Registry.itemName(id);
const peaceful = () => !!(LD.State && LD.State.difficulty && LD.State.difficulty().waves === false);
const rand = (a, b) => a + Math.random() * (b - a);
const particles = (kind, L, x, y, n) => { const P = LD.Particles; if (P && P.emit && LD.G.view.layer === L) P.emit(kind, (x + 0.5) * TILE, (y + 0.5) * TILE, { n, layer: L }); };

/* ── weather (surface) ── */
function pickWeather() { let r = Math.random() * 100; for (let i = 0; i < WEATHER.length; i++) { r -= WEATHER[i][1]; if (r <= 0) return WEATHER[i][0]; } return 'clear'; }
const wDur = () => rand(W_MIN, W_MAX);

function switchWeather(w, t) {
  const prev = w.kind;
  w.kind = w.next.kind; w.until = t + wDur();
  w.next = { kind: pickWeather(), at: w.until, announced: false };
  if (prev === w.kind) return;
  if (w.kind === 'rain') sfx('weather_rain'); else if (w.kind === 'storm') sfx('weather_storm');
  log('Tiempo en superficie: ' + WEATHER_NAMES[w.kind], w.kind === 'storm' ? 'warn' : 'info');
  toast('Tiempo: ' + WEATHER_NAMES[w.kind], w.kind === 'storm' ? 'warn' : 'info');
  E.emit('weather:changed', { kind: w.kind, prev, layer: 0 });
}
/* Storm wear on windmills is applied by Build (it reads weather.kind). */
function tickWeather(G, t) {
  const L0 = G.layers[0]; if (!L0) return;
  let w = L0.weather;
  if (!w || typeof w !== 'object') w = L0.weather = { kind: 'clear', until: 0, next: null };
  if (!WEATHER_NAMES[w.kind]) w.kind = 'clear';
  if (!w.next || typeof w.next !== 'object') {
    if (!(w.until > t)) w.until = t + wDur();
    w.next = { kind: pickWeather(), at: w.until, announced: false };
  }
  const nx = w.next;
  if (!nx.announced && nx.kind !== w.kind && t >= nx.at - W_WARN) {
    nx.announced = true;
    const ev = { kind: 'weather', weather: nx.kind, layer: 0, at: nx.at, in: Math.max(0, nx.at - t) };
    toast('Previsión: ' + WEATHER_NAMES[nx.kind].toLowerCase() + ' en ' + Math.round(ev.in) + ' s', nx.kind === 'storm' ? 'warn' : 'info');
    E.emit('event:announced', ev);
  }
  if (t >= nx.at) switchWeather(w, t);
}

/* ── special events ── */
function structureCount(G, L) { let n = 0; for (const uid in G.structures) if (G.structures[uid].layer === L) n++; return n; }
function pushCand(k, L, w) { candK.push(k); candL.push(L); candW.push(w); }
function pickEvent(G) {
  candK.length = candL.length = candW.length = 0;
  let nUnlocked = 0;
  for (let L = 0; L < G.layers.length; L++) if (G.layers[L].unlocked) nUnlocked++;
  if (!nUnlocked) return null;
  let pick = (Math.random() * nUnlocked) | 0, veinL = 0;
  for (let L = 0; L < G.layers.length; L++) if (G.layers[L].unlocked && pick-- === 0) veinL = L;
  pushCand('vein', veinL, 1.4);
  if (!peaceful() && structureCount(G, 0) > 0) pushCand('migration', 0, 1.0);
  let nLower = 0;
  for (let L = 1; L < G.layers.length; L++) if (G.layers[L].unlocked && structureCount(G, L) > 0) nLower++;
  if (nLower) {
    let q = (Math.random() * nLower) | 0;
    for (let L = 1; L < G.layers.length; L++) if (G.layers[L].unlocked && structureCount(G, L) > 0 && q-- === 0) pushCand('earthquake', L, 1.2);
  }
  if (G.layers[4] && G.layers[4].unlocked) pushCand('plasma_storm', 4, 0.8);
  let total = 0; for (let i = 0; i < candW.length; i++) total += candW[i];
  let r = Math.random() * total;
  for (let i = 0; i < candK.length; i++) { r -= candW[i]; if (r <= 0) return { kind: candK[i], layer: candL[i] }; }
  return { kind: candK[0], layer: candL[0] };
}
function scheduleEvent(G, t) {
  const c = pickEvent(G); if (!c) return;
  G.events.next = { kind: c.kind, layer: c.layer, at: t + rand(EV_MIN, EV_MAX), announced: false };
}
function announceText(ev) {
  switch (ev.kind) {
    case 'earthquake': return 'Actividad sísmica en ' + layerName(ev.layer) + ': terremoto en ' + EV_WARN + ' s';
    case 'plasma_storm': return 'Tormenta de plasma inminente en ' + layerName(ev.layer) + ' (' + EV_WARN + ' s)';
    case 'migration': return 'Migración masiva detectada: gran oleada en la superficie en ' + EV_WARN + ' s';
    case 'vein': return 'Los sensores detectan una veta sin explotar en ' + layerName(ev.layer);
    default: return EVENT_NAMES[ev.kind] || ev.kind;
  }
}
function announce(G, nx, t) {
  nx.announced = true;
  const ev = { kind: nx.kind, layer: nx.layer, at: nx.at, in: Math.max(0, nx.at - t) };
  const text = announceText(ev), kind = nx.kind === 'vein' ? 'info' : 'warn';
  log(text, kind); toast(text, kind);
  sfx('event_warning');
  E.emit('event:announced', ev);
}

function veinOk(W, L, x, y) {
  const WL = W.layers[L]; if (x < 0 || y < 0 || x >= WL.w || y >= WL.h) return false;
  if (W.isBuildable && !W.isBuildable(L, x, y)) return false;
  if (W.depositAt && W.depositAt(L, x, y)) return false;
  return true;
}
/* Places a finite deposit blob of one of the layer's resources on free buildable ground; fills ev.x/y/res/tiles. */
function vein(ev, quiet) {
  const G = LD.G, L = ev.layer, W = LD.World, R = LD.Registry;
  const ldef = R.layer(L), WL = W && W.layers && W.layers[L];
  if (!ldef || !WL || !WL.w) return false;
  const deps = ldef.deposits || []; let total = 0;
  for (let i = 0; i < deps.length; i++) if (deps[i].res && R.items.has(deps[i].res)) total += deps[i].freq || 0.01;
  if (!total) return false;
  let dep = null, r = Math.random() * total;
  for (let i = 0; i < deps.length; i++) { if (!deps[i].res || !R.items.has(deps[i].res)) continue; r -= deps[i].freq || 0.01; if (r <= 0) { dep = deps[i]; break; } }
  if (!dep) dep = deps[deps.length - 1];
  const layer = G.layers[L], ch = WL.chunk || ldef.chunk || 16;
  const excKeys = L > 0 ? Object.keys(layer.excavated || {}) : null;
  if (excKeys && !excKeys.length) return false;
  let sx = -1, sy = -1;
  for (let tries = 0; tries < 80 && sx < 0; tries++) {
    let x, y;
    if (!excKeys) { x = (Math.random() * WL.w) | 0; y = (Math.random() * WL.h) | 0; }
    else { const k = excKeys[(Math.random() * excKeys.length) | 0], c = k.indexOf(','); x = (+k.slice(0, c)) * ch + ((Math.random() * ch) | 0); y = (+k.slice(c + 1)) * ch + ((Math.random() * ch) | 0); }
    if (veinOk(W, L, x, y)) { sx = x; sy = y; }
  }
  if (sx < 0) return false;
  const sz = dep.size || [4, 9], want = U.clamp(Math.round(rand(sz[0], sz[1])), 2, 14);
  let n = 1; blobX[0] = sx; blobY[0] = sy;
  for (let tries = 0; tries < want * 10 && n < want; tries++) {
    const i = (Math.random() * n) | 0, dir = (Math.random() * 4) | 0;
    const x = blobX[i] + (dir === 0 ? 1 : dir === 1 ? -1 : 0), y = blobY[i] + (dir === 2 ? 1 : dir === 3 ? -1 : 0);
    let dup = false; for (let j = 0; j < n; j++) if (blobX[j] === x && blobY[j] === y) { dup = true; break; }
    if (dup || !veinOk(W, L, x, y)) continue;
    blobX[n] = x; blobY[n] = y; n++;
  }
  const am = dep.amount || [2000, 6000];
  if (!layer.deposits) layer.deposits = {};
  for (let i = 0; i < n; i++) {
    const amt = Math.max(1, Math.round(rand(am[0], am[1])));
    layer.deposits[blobX[i] + ',' + blobY[i]] = { res: dep.res, amt, max: amt, hardness: dep.hardness | 0, fluid: !!dep.fluid };
    if (LD.Tex && LD.Tex.invalidate) LD.Tex.invalidate(L, blobX[i], blobY[i]);
    if (i < 12) particles('dust', L, blobX[i], blobY[i], 4);
  }
  ev.x = sx; ev.y = sy; ev.res = dep.res; ev.tiles = n;
  if (!quiet) {
    const text = 'Nueva veta de ' + itemName(dep.res) + ' en ' + layerName(L) + ' (' + sx + ', ' + sy + ')';
    log(text, 'ok'); toast(text, 'ok');
  }
  return true;
}

function quake(ev) {
  const G = LD.G, L = ev.layer, B = Sim.Build, frac = rand(0.2, 0.4);
  let hit = 0, broken = 0, fx = 0;
  for (const uid in G.structures) {
    const inst = G.structures[uid];
    if (inst.layer !== L || inst.build || Math.random() > frac) continue;
    const def = LD.Registry.structures.get(inst.id), max = B && B.maxHp ? B.maxHp(inst) : (def && def.hp) || 100;
    const dmg = max * rand(0.03, 0.08);
    let br = false;
    if (B && B.damage) br = !!B.damage(uid, dmg, 'earthquake');
    else { inst.hp = Math.max(0, (inst.hp == null ? max : inst.hp) - dmg); br = inst.hp <= 0; }
    hit++; if (br) broken++;
    if (fx < 40) { fx++; particles('rubble', L, inst.x, inst.y, 6); }
  }
  ev.hit = hit; ev.broken = broken;
  if (Math.random() < 0.4 && vein(ev, true)) ev.vein = true;
  let text = 'Terremoto en ' + layerName(L) + ': ' + hit + ' estructuras dañadas';
  if (broken) text += ', ' + broken + ' fuera de servicio';
  if (ev.vein) text += '. El temblor ha expuesto una veta de ' + itemName(ev.res);
  log(text, broken ? 'bad' : 'warn'); toast('Terremoto en ' + layerName(L), 'warn');
  return true;
}
function migration(ev, force) {
  if (peaceful() && !force) return false;
  const Df = Sim.Defense; if (!Df || !Df.spawnWave) return false;
  Df.spawnWave(0, { mul: 2.5, reason: 'migration' });
  log('Migración: una manada enorme cruza la superficie', 'bad'); toast('Migración: oleada masiva en la superficie', 'bad');
  return true;
}
function plasmaStorm(ev) {
  const G = LD.G; G.flags.plasmaStorm = ev.until; ev.heat = 3; plasmaAcc = 0;
  log('Tormenta de plasma en ' + layerName(ev.layer) + ': desgaste térmico ×3 durante ' + DURATION.plasma_storm + ' s', 'bad');
  toast('Tormenta de plasma: desgaste térmico ×3', 'bad');
  return true;
}
function applyEvent(kind, L, t, force) {
  const G = LD.G;
  const ev = { kind, layer: L, at: t, until: t + (DURATION[kind] || 10) };
  let ok;
  switch (kind) {
    case 'earthquake': ok = quake(ev); break;
    case 'plasma_storm': ok = plasmaStorm(ev); break;
    case 'migration': ok = migration(ev, force); break;
    case 'vein': ok = vein(ev, false); break;
    default: return null;
  }
  if (!ok) return null;
  G.events.active.push(ev);
  E.emit('event:started', ev);
  return ev;
}
function tickEvents(G, t, dt) {
  const ev = G.events;
  if (!ev.next) { if (t >= EV_GRACE) scheduleEvent(G, t); }
  else {
    const nx = ev.next;
    if (!nx.announced && t >= nx.at - EV_WARN) announce(G, nx, t);
    if (t >= nx.at) { ev.next = null; applyEvent(nx.kind, nx.layer | 0, t, false); }
  }
  const act = ev.active;
  for (let i = act.length - 1; i >= 0; i--) {
    const a = act[i];
    if (a.kind === 'plasma_storm' && G.view.layer === a.layer) {
      plasmaAcc += dt;
      if (plasmaAcc >= 0.3) { plasmaAcc = 0; const W = LD.World; if (W && W.excavatedBounds) { const b = W.excavatedBounds(a.layer); if (b) { const x = Math.round(rand(b.x0, b.x1)), y = Math.round(rand(b.y0, b.y1)); if (!W.isSolid || !W.isSolid(a.layer, x, y)) particles('plasma', a.layer, x, y, 3); } } }
    }
    if (t >= a.until) {
      act.splice(i, 1);
      if (a.kind === 'plasma_storm') { G.flags.plasmaStorm = 0; log('La tormenta de plasma ha remitido', 'info'); }
      E.emit('event:ended', a);
    }
  }
  if (G.flags.plasmaStorm && t >= G.flags.plasmaStorm && !act.some(a => a.kind === 'plasma_storm')) G.flags.plasmaStorm = 0;
}

const Events = Sim.Events = {
  WEATHER_NAMES, EVENT_NAMES, W_WARN, EV_WARN,
  tick(dt) {
    const G = LD.G; if (!G) return;
    if (G !== curG) { curG = G; plasmaAcc = 0; if (!G.events) G.events = { next: null, active: [] }; if (!Array.isArray(G.events.active)) G.events.active = []; if (!G.flags) G.flags = {}; }
    const t = G.time.t;
    tickWeather(G, t);
    tickEvents(G, t, dt);
  },
  weather(L) { const G = LD.G; if (!G || (L | 0) !== 0 || !G.layers[0] || !G.layers[0].weather) return CLEAR; return G.layers[0].weather; },
  multipliers(L) { const G = LD.G; if (!G || (L | 0) !== 0 || !G.layers[0]) return ONE; const w = G.layers[0].weather; return (w && MULT[w.kind]) || ONE; },
  upcoming() { const G = LD.G; return G && G.events && G.events.next ? G.events.next : null; },
  active() { const G = LD.G; return G && G.events && G.events.active ? G.events.active : []; },
  label(kind) { return EVENT_NAMES[kind] || WEATHER_NAMES[kind] || kind; },
  /* 0..1 camera-shake intensity for an earthquake in the viewed layer */
  shake() {
    const G = LD.G; if (!G) return 0;
    const act = G.events.active, t = G.time.t; let k = 0;
    for (let i = 0; i < act.length; i++) { const a = act[i]; if (a.kind === 'earthquake' && a.layer === G.view.layer) k = Math.max(k, 1 - (t - a.at) / Math.max(0.1, a.until - a.at)); }
    return U.clamp(k);
  },
  /* Debug: immediate weather switch or special event (bypasses schedule, difficulty and grace) */
  trigger(kind, L) {
    const G = LD.G; if (!G) return null;
    const t = G.time.t;
    if (WEATHER_NAMES[kind]) { const w = Events.weather(0); if (w === CLEAR) return null; w.next = { kind, at: t, announced: true }; switchWeather(w, t); return w; }
    if (!EVENT_NAMES[kind]) return null;
    if (L == null) L = kind === 'migration' ? 0 : kind === 'plasma_storm' ? 4 : (G.view.layer | 0);
    return applyEvent(kind, U.clamp(L | 0, 0, 4), t, true);
  }
};
})();
