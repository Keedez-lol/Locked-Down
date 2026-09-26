(() => {
'use strict';
const LD = window.LD, U = LD.U;
const SAVE_PREFIX = 'lockeddown.save.', SETTINGS_KEY = 'lockeddown.settings', META_KEY = 'lockeddown.meta';
const VERSION = 3;
const SLOTS = ['auto', '1', '2', '3'];

/* ── settings (global, not per save) ── */
const S = LD.Settings = {
  DEFAULTS: {
    volMaster: 0.8, volMusic: 0.6, volSfx: 0.8, volAmbient: 0.6,
    particles: 'high', texture: 'high', grid: false, ranges: false, autosave: 3, reducedMotion: false,
    tutorial: true, lang: 'es', uiScale: 1, showFps: false, menuTrack: 'kdz'
  },
  data: null,
  get() { if (!S.data) S.load(); return S.data; },
  load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null'); } catch (e) { d = null; }
    if (!d || typeof d !== 'object' || Array.isArray(d)) d = null;
    S.data = Object.assign({}, S.DEFAULTS, d || {});
    for (const k in S.DEFAULTS) if (typeof S.data[k] !== typeof S.DEFAULTS[k]) S.data[k] = S.DEFAULTS[k];
    return S.data;
  },
  set(patch) {
    Object.assign(S.get(), patch);
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(S.data)); } catch (e) { /* storage unavailable */ }
    LD.Events.emit('settings:changed', S.data);
    return S.data;
  },
  reset() { S.data = Object.assign({}, S.DEFAULTS); S.set({}); }
};

/* ── compact save format (v3) ──
   · keys starting with '_' are per-tick scratch (power/fluid/turret caches) and are never written;
   · numeric arrays with runs of zeros (the 60-sample stat rings) become { $r: "z12,3.5,z47" };
   · deposits become [res, amt, max, hardness, fluid?] and are expanded again in migrate(). */
const isNumArr = a => { if (!Array.isArray(a) || a.length < 8) return false; let z = 0; for (let i = 0; i < a.length; i++) { const v = a[i]; if (typeof v !== 'number' || !isFinite(v)) return false; if (v === 0) z++; } return z >= 4; };
const rleEncode = a => {
  let out = '', run = 0;
  const flush = () => { if (run) { out += (out ? ',' : '') + 'z' + run; run = 0; } };
  for (let i = 0; i < a.length; i++) { if (a[i] === 0) { run++; continue; } flush(); out += (out ? ',' : '') + String(a[i]); }
  flush();
  return out;
};
const rleDecode = s => {
  const out = [];
  if (!s) return out;
  for (const tok of s.split(',')) {
    if (tok[0] === 'z') { const n = +tok.slice(1) | 0; for (let i = 0; i < n; i++) out.push(0); }
    else { const v = +tok; out.push(isFinite(v) ? v : 0); }
  }
  return out;
};
const isDeposit = d => d && typeof d === 'object' && !Array.isArray(d) && typeof d.res === 'string' && typeof d.amt === 'number';
const packDeposit = d => { const a = [d.res, d.amt, d.max, d.hardness]; if (d.fluid !== undefined) a.push(d.fluid); return a; };
const unpackDeposit = a => { const d = { res: a[0], amt: +a[1] || 0, max: a[2], hardness: a[3] }; if (a.length > 4) d.fluid = a[4]; return d; };
const replacer = function (key, value) {
  if (key.charCodeAt(0) === 95 /* _ */) return undefined;
  if (key === 'power' && value && Array.isArray(value.grids) && this && this.meta && this.layers) return { grids: [] };
  if (isNumArr(value)) return { $r: rleEncode(value) };
  if (key === 'deposits' && value && typeof value === 'object' && !Array.isArray(value)) {
    const out = {};
    for (const k in value) { const d = value[k]; out[k] = isDeposit(d) ? packDeposit(d) : d; }
    return out;
  }
  return value;
};
// One post-parse walk is ~5× cheaper than a JSON.parse reviver on a 400 kB save.
const expand = o => {
  if (!o || typeof o !== 'object') return o;
  if (Array.isArray(o)) { for (let i = 0; i < o.length; i++) { const v = o[i]; if (v && typeof v === 'object') o[i] = typeof v.$r === 'string' ? rleDecode(v.$r) : expand(v); } return o; }
  for (const k in o) { const v = o[k]; if (v && typeof v === 'object') o[k] = typeof v.$r === 'string' ? rleDecode(v.$r) : expand(v); }
  return o;
};
const parse = json => expand(JSON.parse(json));

/* ── game state ── */
LD.G = null;
const St = LD.State = {
  VERSION, SLOTS,
  DIFFICULTIES: {
    peaceful: { name: 'Pacífico', waves: false, enemyHp: 1, enemyDmg: 1, interval: 1, build: 0.8, cost: 0.8, desc: 'Sin amenazas. Construcción y costes reducidos.' },
    easy: { name: 'Fácil', waves: true, enemyHp: 0.6, enemyDmg: 0.6, interval: 1.5, build: 0.9, cost: 0.9, desc: 'Oleadas débiles y espaciadas.' },
    normal: { name: 'Normal', waves: true, enemyHp: 1, enemyDmg: 1, interval: 1, build: 1, cost: 1, desc: 'La experiencia prevista.' },
    hard: { name: 'Difícil', waves: true, enemyHp: 1.6, enemyDmg: 1.4, interval: 0.75, build: 1.15, cost: 1.15, desc: 'Oleadas fuertes y frecuentes.' },
    brutal: { name: 'Brutal', waves: true, enemyHp: 2.5, enemyDmg: 2, interval: 0.55, build: 1.3, cost: 1.3, desc: 'Para quien ya domina el núcleo.' }
  },
  difficulty() { const G = LD.G; return St.DIFFICULTIES[(G && G.meta.difficulty) || 'normal']; },
  lastError: null,

  blank({ name = 'Colonia', difficulty = 'normal', seed } = {}) {
    if (seed === undefined || seed === null || seed === '') seed = Math.floor(Math.random() * 2147483647);
    if (typeof seed === 'string') seed = isFinite(+seed) && seed.trim() !== '' ? (+seed | 0) : U.hashStr(seed);
    if (!St.DIFFICULTIES[difficulty]) difficulty = 'normal';
    const layers = (LD.Registry.layers.length ? LD.Registry.layers : [{ idx: 0 }, { idx: 1 }, { idx: 2 }, { idx: 3 }, { idx: 4 }]).map((L, i) => ({
      unlocked: i === 0, excavated: {}, digging: {}, deposits: {}, trees: {}, edits: {}, threat: 0, waveAt: 0, waveNo: 0, shaft: null, elevator: null,
      weather: { kind: 'clear', until: 0, next: null }, energyHandled: 0
    }));
    return {
      v: VERSION,
      meta: { name: String(name || 'Colonia'), created: Date.now(), playtime: 0, difficulty, seed: seed >>> 0, lastSave: 0, era: 0, saveName: '' },
      time: { t: 0, day: 1, dayFrac: 0.3 },
      inv: layers.map(() => ({})), caps: { base: 200 },
      discovered: { items: {}, structures: {}, techs: {}, enemies: {}, layers: { 0: true }, recipes: {} },
      research: { done: {}, current: null, queue: [] },
      layers,
      structures: {},
      enemies: [],
      power: { grids: [] },
      events: { next: null, active: [] },
      stats: { produced: {}, consumed: {}, kills: 0, builds: 0, dismantled: 0, waves: 0, hist: {} },
      blueprints: [],
      objectives: { done: {}, current: [] },
      log: [],
      view: { layer: 0, cam: [] },
      tutorial: { step: 0, done: false },
      flags: {}
    };
  },

  newGame(opts) {
    const G = LD.G = St.blank(opts);
    LD.Events.emit('game:new', G);
    return G;
  },

  /* Compact JSON of G with meta.lastSave stamped to `at` (G itself is not modified). */
  serialize(G = LD.G, at = Date.now()) {
    const copy = Object.assign({}, G);
    copy.v = VERSION;
    copy.meta = Object.assign({}, G.meta, { lastSave: at });
    return JSON.stringify(copy, replacer);
  },

  summary(G) {
    if (!G || !G.meta) return null;
    return { name: G.meta.name, difficulty: G.meta.difficulty, playtime: G.meta.playtime || 0, day: G.time ? G.time.day : 1, era: G.meta.era || 0, lastSave: G.meta.lastSave || 0, structures: U.count(G.structures || {}), techs: U.count(G.research ? G.research.done : {}) };
  },

  save(slot = 'auto', G = LD.G) {
    if (!G) return false;
    const at = Date.now();
    let s;
    try { s = St.serialize(G, at); } catch (e) { console.error('[State] serialize failed', e); LD.Events.emit('toast', { text: 'No se pudo guardar (estado no serializable)', kind: 'bad' }); return false; }
    try { localStorage.setItem(SAVE_PREFIX + slot, s); }
    catch (e) {
      console.error('[State] save failed', e);
      const quota = e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014);
      LD.Events.emit('toast', { text: quota ? 'No se pudo guardar: almacenamiento lleno (' + U.fmt(s.length / 1024, 0) + ' kB). Borra alguna ranura.' : 'No se pudo guardar (almacenamiento no disponible)', kind: 'bad' });
      return false;
    }
    G.meta.lastSave = at;
    try { const meta = St._meta(); meta[slot] = St.summary(G); localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (e) { /* the save itself is on disk; slots() falls back to parsing it */ }
    LD.Events.emit('game:saved', { slot, bytes: s.length });
    return true;
  },

  _meta() { try { const m = JSON.parse(localStorage.getItem(META_KEY) || '{}'); return m && typeof m === 'object' && !Array.isArray(m) ? m : {}; } catch (e) { return {}; } },
  _raw(slot) { try { return localStorage.getItem(SAVE_PREFIX + slot); } catch (e) { return null; } },

  slots() {
    const meta = St._meta(), out = [];
    let repaired = false;
    for (const slot of SLOTS) {
      const raw = St._raw(slot);
      if (!raw) { out.push({ slot, exists: false, summary: null, corrupt: false, bytes: 0 }); continue; }
      let summary = meta[slot] && typeof meta[slot] === 'object' ? meta[slot] : null, corrupt = false;
      if (!summary) { const G = St.decode(raw); if (G) { summary = meta[slot] = St.summary(G); repaired = true; } else corrupt = true; }
      out.push({ slot, exists: true, summary, corrupt, bytes: raw.length });
    }
    if (repaired) { try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (e) { /* derived again next time */ } }
    return out;
  },

  hasAny() { return St.slots().some(s => s.exists); },

  /* Parses a slot without touching LD.G or emitting events (previews, exports of another slot). */
  read(slot = 'auto') { const raw = St._raw(slot); return raw ? St.decode(raw) : null; },

  /* Parses save JSON into a migrated G, or null; no side effects. */
  decode(json) {
    try {
      const G = parse(json);
      if (!G || typeof G !== 'object' || !G.meta || typeof G.meta !== 'object' || !Array.isArray(G.layers)) throw new Error('formato inválido');
      return St.migrate(G);
    } catch (e) { St.lastError = e; return null; }
  },

  load(slot = 'auto') {
    St.lastError = null;
    const raw = St._raw(slot);
    if (!raw) return null;
    const G = St.decode(raw);
    if (!G) {
      console.warn('[State] slot ' + slot + ' is corrupt', St.lastError);
      try { const meta = St._meta(); if (meta[slot]) { delete meta[slot]; localStorage.setItem(META_KEY, JSON.stringify(meta)); } } catch (e) { /* ignore */ }
      LD.Events.emit('toast', { text: 'La partida de la ranura ' + slot.toUpperCase() + ' está dañada y no se puede cargar', kind: 'bad' });
      return null;
    }
    LD.G = G;
    LD.Events.emit('game:loaded', { slot, G });
    return G;
  },

  deleteSlot(slot) {
    try { localStorage.removeItem(SAVE_PREFIX + slot); } catch (e) { /* ignore */ }
    try { const meta = St._meta(); delete meta[slot]; localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (e) { /* ignore */ }
    LD.Events.emit('game:deleted', { slot });
  },

  exportString(G = LD.G) { return btoa(unescape(encodeURIComponent(St.serialize(G)))); },

  importString(s, isEncoded = true) {
    St.lastError = null;
    try {
      const json = isEncoded ? decodeURIComponent(escape(atob(String(s).replace(/\s+/g, '')))) : s;
      const G = St.decode(json);
      if (!G) throw St.lastError || new Error('formato inválido');
      LD.G = G;
      return G;
    } catch (e) { St.lastError = e; console.warn('[State] import failed:', e && e.message); return null; }
  },

  migrate(G) {
    if (!G.meta || typeof G.meta !== 'object') G.meta = {};
    const blank = St.blank({ name: G.meta.name, difficulty: G.meta.difficulty, seed: G.meta.seed });
    const merge = (dst, src) => { for (const k in src) if (!(k in dst) || dst[k] === undefined) dst[k] = src[k]; };
    const obj = (o, k) => { if (!o[k] || typeof o[k] !== 'object' || Array.isArray(o[k])) o[k] = {}; return o[k]; };
    merge(G, blank);
    for (const k of ['time', 'stats', 'discovered', 'research', 'events', 'objectives', 'tutorial', 'view', 'caps']) { obj(G, k); merge(G[k], blank[k]); }
    merge(G.meta, blank.meta);
    if (!Array.isArray(G.inv)) G.inv = blank.inv.map((o, i) => i === 0 && G.inv && typeof G.inv === 'object' ? G.inv : {});
    while (G.inv.length < blank.inv.length) G.inv.push({});
    for (let i = 0; i < G.inv.length; i++) if (!G.inv[i] || typeof G.inv[i] !== 'object') G.inv[i] = {};
    if (!G.power || !Array.isArray(G.power.grids)) G.power = blank.power;
    if (!Array.isArray(G.layers)) G.layers = [];
    while (G.layers.length < blank.layers.length) G.layers.push(blank.layers[G.layers.length]);
    G.layers.forEach((L, i) => {
      if (!L || typeof L !== 'object') L = G.layers[i] = blank.layers[i];
      merge(L, blank.layers[i]);
      for (const k of ['excavated', 'digging', 'deposits', 'trees', 'edits']) obj(L, k);
      if (!L.weather || typeof L.weather !== 'object') L.weather = blank.layers[i].weather;
      const dep = L.deposits;
      for (const k in dep) if (Array.isArray(dep[k])) dep[k] = unpackDeposit(dep[k]);
    });
    for (const k of ['structures', 'flags']) obj(G, k);
    for (const k of ['enemies', 'blueprints', 'log']) if (!Array.isArray(G[k])) G[k] = [];
    if (!Array.isArray(G.research.queue)) G.research.queue = [];
    if (!Array.isArray(G.view.cam)) G.view.cam = [];
    if (!Array.isArray(G.objectives.current)) G.objectives.current = [];
    if (!Array.isArray(G.events.active)) G.events.active = [];
    if (!St.DIFFICULTIES[G.meta.difficulty]) G.meta.difficulty = 'normal';
    G.meta.seed = G.meta.seed >>> 0;
    G.v = VERSION;
    return G;
  },

  log(text, kind = 'info') {
    const G = LD.G; if (!G) return;
    G.log.push({ t: G.time.t, text, kind });
    if (G.log.length > 200) G.log.splice(0, G.log.length - 200);
    LD.Events.emit('log', { text, kind });
  }
};
})();
