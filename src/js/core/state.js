(() => {
'use strict';
const LD = window.LD, U = LD.U;
const SAVE_PREFIX = 'lockeddown.save.', SETTINGS_KEY = 'lockeddown.settings', META_KEY = 'lockeddown.meta';
const VERSION = 2;

/* ── settings (global, not per save) ── */
const S = LD.Settings = {
  DEFAULTS: {
    volMaster: 0.8, volMusic: 0.6, volSfx: 0.8, volAmbient: 0.6,
    particles: 'high', texture: 'high', grid: false, ranges: false, autosave: 3, reducedMotion: false,
    tutorial: true, lang: 'es', uiScale: 1, showFps: false
  },
  data: null,
  get() { if (!S.data) S.load(); return S.data; },
  load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null'); } catch (e) { d = null; }
    S.data = Object.assign({}, S.DEFAULTS, d || {});
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

/* ── game state ── */
LD.G = null;
const St = LD.State = {
  VERSION,
  DIFFICULTIES: {
    peaceful: { name: 'Pacífico', waves: false, enemyHp: 1, enemyDmg: 1, interval: 1, build: 0.8, cost: 0.8, desc: 'Sin amenazas. Construcción y costes reducidos.' },
    easy: { name: 'Fácil', waves: true, enemyHp: 0.6, enemyDmg: 0.6, interval: 1.5, build: 0.9, cost: 0.9, desc: 'Oleadas débiles y espaciadas.' },
    normal: { name: 'Normal', waves: true, enemyHp: 1, enemyDmg: 1, interval: 1, build: 1, cost: 1, desc: 'La experiencia prevista.' },
    hard: { name: 'Difícil', waves: true, enemyHp: 1.6, enemyDmg: 1.4, interval: 0.75, build: 1.15, cost: 1.15, desc: 'Oleadas fuertes y frecuentes.' },
    brutal: { name: 'Brutal', waves: true, enemyHp: 2.5, enemyDmg: 2, interval: 0.55, build: 1.3, cost: 1.3, desc: 'Para quien ya domina el núcleo.' }
  },
  difficulty() { const G = LD.G; return St.DIFFICULTIES[(G && G.meta.difficulty) || 'normal']; },

  blank({ name = 'Colonia', difficulty = 'normal', seed } = {}) {
    if (seed === undefined || seed === null || seed === '') seed = Math.floor(Math.random() * 2147483647);
    if (typeof seed === 'string') seed = isFinite(+seed) && seed.trim() !== '' ? (+seed | 0) : U.hashStr(seed);
    const layers = (LD.Registry.layers.length ? LD.Registry.layers : [{ idx: 0 }, { idx: 1 }, { idx: 2 }, { idx: 3 }, { idx: 4 }]).map((L, i) => ({
      unlocked: i === 0, excavated: {}, digging: {}, deposits: {}, trees: {}, threat: 0, waveAt: 0, waveNo: 0, shaft: null, elevator: null,
      weather: { kind: 'clear', until: 0, next: null }, energyHandled: 0
    }));
    return {
      v: VERSION,
      meta: { name, created: Date.now(), playtime: 0, difficulty, seed: seed >>> 0, lastSave: 0, era: 0, saveName: '' },
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

  serialize(G = LD.G) {
    const copy = Object.assign({}, G);
    copy.meta = Object.assign({}, G.meta, { lastSave: Date.now() });
    return JSON.stringify(copy);
  },

  summary(G) {
    if (!G) return null;
    return { name: G.meta.name, difficulty: G.meta.difficulty, playtime: G.meta.playtime, day: G.time.day, era: G.meta.era || 0, lastSave: G.meta.lastSave, structures: U.count(G.structures), techs: U.count(G.research.done) };
  },

  save(slot = 'auto', G = LD.G) {
    if (!G) return false;
    try {
      const s = St.serialize(G);
      localStorage.setItem(SAVE_PREFIX + slot, s);
      G.meta.lastSave = Date.now();
      const meta = St._meta(); meta[slot] = St.summary(G); localStorage.setItem(META_KEY, JSON.stringify(meta));
      LD.Events.emit('game:saved', { slot });
      return true;
    } catch (e) { console.error('[State] save failed', e); LD.Events.emit('toast', { text: 'No se pudo guardar (almacenamiento no disponible)', kind: 'bad' }); return false; }
  },

  _meta() { try { return JSON.parse(localStorage.getItem(META_KEY) || '{}') || {}; } catch (e) { return {}; } },

  slots() {
    const meta = St._meta(), out = [];
    for (const slot of ['auto', '1', '2', '3']) {
      let has = false;
      try { has = !!localStorage.getItem(SAVE_PREFIX + slot); } catch (e) { has = false; }
      out.push({ slot, exists: has, summary: has ? meta[slot] || null : null });
    }
    return out;
  },

  hasAny() { return St.slots().some(s => s.exists); },

  load(slot = 'auto') {
    let raw = null;
    try { raw = localStorage.getItem(SAVE_PREFIX + slot); } catch (e) { raw = null; }
    if (!raw) return null;
    const G = St.importString(raw, false);
    if (G) LD.Events.emit('game:loaded', { slot, G });
    return G;
  },

  deleteSlot(slot) { try { localStorage.removeItem(SAVE_PREFIX + slot); const meta = St._meta(); delete meta[slot]; localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (e) { /* ignore */ } },

  exportString(G = LD.G) { return btoa(unescape(encodeURIComponent(St.serialize(G)))); },

  importString(s, isEncoded = true) {
    try {
      const json = isEncoded ? decodeURIComponent(escape(atob(s.trim()))) : s;
      const G = JSON.parse(json);
      if (!G || typeof G !== 'object' || !G.meta || !G.layers) throw new Error('formato inválido');
      St.migrate(G);
      LD.G = G;
      return G;
    } catch (e) { console.error('[State] import failed', e); return null; }
  },

  migrate(G) {
    const blank = St.blank({ name: G.meta.name, difficulty: G.meta.difficulty, seed: G.meta.seed });
    const merge = (dst, src) => { for (const k in src) if (!(k in dst)) dst[k] = src[k]; };
    merge(G, blank); merge(G.meta, blank.meta); merge(G.time, blank.time); merge(G.stats, blank.stats); merge(G.discovered, blank.discovered); merge(G.research, blank.research); merge(G.events, blank.events);
    if (!Array.isArray(G.inv)) G.inv = blank.inv.map((o, i) => i === 0 && G.inv && typeof G.inv === 'object' ? G.inv : {});
    while (G.inv.length < blank.inv.length) G.inv.push({});
    if (!G.power || !Array.isArray(G.power.grids)) G.power = blank.power;
    while (G.layers.length < blank.layers.length) G.layers.push(blank.layers[G.layers.length]);
    G.layers.forEach((L, i) => merge(L, blank.layers[i]));
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
