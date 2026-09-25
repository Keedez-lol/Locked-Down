(() => {
'use strict';
const LD = window.LD, U = LD.U, E = LD.Events, el = U.el;
LD.UI = LD.UI || {};

const CATS = [
  { id: 'logistics', name: 'Logística' }, { id: 'power', name: 'Energía' }, { id: 'fluids', name: 'Fluidos' },
  { id: 'extract', name: 'Extracción' }, { id: 'process', name: 'Procesado' }, { id: 'nature', name: 'Naturaleza' },
  { id: 'defense', name: 'Defensa' }, { id: 'research', name: 'Investigación' }, { id: 'storage', name: 'Almacén' }, { id: 'special', name: 'Especial' }
];
const TIER_COLORS = ['#8f8b82', '#b08d57', '#7f8ea3', '#c9a227', '#6fa8dc', '#8fb87a', '#c9603b', '#b28cff'];
const RECIPE_TYPE_NAMES = { hand: 'manual', workbench: 'banco', kiln: 'horno', smelting: 'fundición', blast: 'alto horno', forging: 'forja', sawing: 'aserrado', crushing: 'triturado', washing: 'lavado', tanning: 'curtido', pressing: 'prensado', lathe: 'torneado', wiremill: 'trefilado', assembling: 'ensamblaje', mixing: 'mezcla', distilling: 'destilación', chemical: 'química', refining: 'refinado', electrolysis: 'electrólisis', centrifuge: 'centrifugado', compressing: 'compresión', arc: 'arco', vacuum: 'vacío', fabrication: 'fabricación', enrichment: 'enriquecimiento', nuclear_fab: 'nuclear', cryo: 'criogenia', quantum: 'cuántico', research: 'investigación', ammo: 'munición' };

const G = () => LD.G;
const R = () => LD.Registry;
const S = name => (LD.Sim && LD.Sim[name]) || null;
const W = () => LD.World || null;
const Rn = () => LD.Render || null;
const has = (o, fn) => !!(o && typeof o[fn] === 'function');
const call = (o, fn, ...a) => has(o, fn) ? o[fn](...a) : undefined;
const curL = () => { const g = G(); return g ? (g.view.layer | 0) : 0; };
const sdef = id => (R() && R().structure(id)) || null;
const itemName = id => (R() ? R().itemName(id) : id);
const toast = (text, kind, ms) => { if (has(LD.UI, 'toast')) LD.UI.toast(text, kind, ms); else E.emit('toast', { text, kind }); };
const play = name => { if (LD.Audio && has(LD.Audio, 'play')) LD.Audio.play(name); };
const tip = (node, fn) => { const T = LD.UI.tooltip; if (T && typeof T.attach === 'function') T.attach(node, fn); else node.addEventListener('pointerenter', () => { const c = fn(); node.title = c ? (c.textContent || String(c)) : ''; }); return node; };
const keycap = t => has(LD.UI, 'keycap') ? LD.UI.keycap(t) : el('kbd.key', t);
const icon = (id, size) => has(LD.UI, 'icon') ? LD.UI.icon(id, size) : (LD.Tex && has(LD.Tex, 'icon') ? LD.Tex.icon(id, size) : el('i.ico-blank'));
const thumb = (id, size) => { if (has(LD.UI, 'structThumb')) { try { const c = LD.UI.structThumb(id, size); if (c) return c; } catch (e) { /* optional */ } } const d = sdef(id); return el('div.thumb-blank', { style: { width: size + 'px', height: size + 'px', background: tierColors()[(d && d.tier) || 0] } }); };
const count = (L, id) => { const Eco = S('Economy'); if (has(Eco, 'count')) return Eco.count(L, id); const g = G(); return (g && g.inv[L] && g.inv[L][id]) || 0; };
const costOf = id => { const Bd = S('Build'); if (has(Bd, 'cost')) return Bd.cost(id) || {}; const d = sdef(id); return (d && d.cost) || {}; };
const canAfford = (id, L) => { const Bd = S('Build'); if (has(Bd, 'canAfford')) return !!Bd.canAfford(id, L); const c = costOf(id); for (const k in c) if (count(L, k) < c[k]) return false; return true; };
const costList = (cost, L, compact) => {
  if (has(LD.UI, 'costList')) { try { const n = LD.UI.costList(cost, { layer: L, compact: !!compact }); if (n instanceof Node) return n; } catch (e) { /* fall through */ } }
  return el('div.cost-list', Object.keys(cost || {}).map(k => el('span.cost' + (count(L, k) >= cost[k] ? '.ok' : '.bad'), [icon(k, 14), el('span.num', String(cost[k]))])));
};
const isUnlocked = id => { const Rs = S('Research'); if (has(Rs, 'isUnlocked')) return !!Rs.isUnlocked('structure', id); const R_ = R(), g = G(); if (!R_) return true; if (R_.isStart('structure', id)) return true; const t = R_.unlockerOf('structure', id); return !!(t && g && g.research.done[t]); };
const paletteCat = def => {
  if (def.pipe || def.tank || (def.nature && /pump|well/.test(def.nature.kind || '')) || /^(well|pump_)/.test(def.id)) return 'fluids';
  if (def.conveyor || def.cable || def.elevator || def.shaft) return 'logistics';
  if (def.cat === 'core') return 'special';
  return def.cat;
};
const buildable = def => !!def && def.id !== 'hub' && !def.unbuildable && def.cat !== undefined;
const lineable = def => !!def && (def.size || 1) === 1 && !!(def.conveyor || def.cable || def.pipe || def.overlay || def.wall);
const rotName = ['Este', 'Sur', 'Oeste', 'Norte'];
const tierColors = () => (LD.Sprites && LD.Sprites.TIER_COLORS) || TIER_COLORS;
const cssVar = (name, fb) => { try { const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); return v || fb; } catch (e) { return fb; } };
const tileToScreen = (x, y) => { const r = Rn(); if (has(r, 'tileToScreen')) { const p = r.tileToScreen(x, y); if (p) return p; } return null; };
const tilePx = () => { const r = Rn(); const c = has(r, 'cam') ? r.cam() : null; return ((r && r.TILE) || 48) * ((c && c.z) || 1); };
const uidAtTile = (L, x, y, def) => {
  const w = W(); if (!w) return null;
  if (def && def.overlay === 'cable') return call(w, 'cableAt', L, x, y) || null;
  if (def && def.overlay === 'pipe') return call(w, 'pipeAt', L, x, y) || null;
  return call(w, 'uidAt', L, x, y) || call(w, 'cableAt', L, x, y) || call(w, 'pipeAt', L, x, y) || null;
};
const PHASE = { start: 'start', begin: 'start', down: 'start', end: 'end', release: 'end', up: 'end', cancel: 'cancel', abort: 'cancel' };
const normPt = (a, b, c) => {
  if (typeof a === 'number') return { x: a | 0, y: b | 0, shift: !!(c && (c.shiftKey || c.shift)), button: (c && c.button) || 0, lx: c && c.lx, ly: c && c.ly };
  if (!a || typeof a !== 'object') return null;
  if (a.x === undefined || a.y === undefined) return null;
  return { x: a.x | 0, y: a.y | 0, shift: !!(a.shiftKey || a.shift || (a.ev && a.ev.shiftKey)), button: a.button || (a.ev && a.ev.button) || 0, lx: a.lx, ly: a.ly };
};
const normDrag = (a, b, c, d, e, f) => {
  if (typeof a === 'string') {
    if (b && typeof b === 'object') return { phase: PHASE[a] || 'move', x0: b.x0 | 0, y0: b.y0 | 0, x1: b.x | 0, y1: b.y | 0, shift: !!(b.shift || b.shiftKey), button: b.button || 0 };
    return { phase: PHASE[a] || 'move', x0: b | 0, y0: c | 0, x1: d | 0, y1: e | 0, shift: !!(f && f.shiftKey), button: (f && f.button) || 0 };
  }
  if (!a || typeof a !== 'object') return null;
  const ph = a.phase || a.type || a.state || 'move';
  const x1 = a.x1 !== undefined ? a.x1 : a.x, y1 = a.y1 !== undefined ? a.y1 : a.y;
  return { phase: PHASE[ph] || 'move', x0: (a.x0 !== undefined ? a.x0 : a.sx) | 0, y0: (a.y0 !== undefined ? a.y0 : a.sy) | 0, x1: x1 | 0, y1: y1 | 0, shift: !!(a.shiftKey || a.shift), button: a.button || 0 };
};

const B = LD.UI.Build = {
  mode: 'normal', paletteOpen: false, placing: null, line: null, rect: null, bp: null, lastBp: null, cat: 'logistics', query: '',
  hover: null, root: null, els: {}, offs: [], subscribed: false, cards: new Map(), affDirty: false, affAcc: 0, floats: [], camKey: '',
  popover: null, lastCancel: 0, lastRot: 0, lastQ: 0,

  /* ── lifecycle ── */
  mount(root) {
    B.root = root || document.getElementById('hud-root');
    if (!B.root) return;
    const x = B.els;
    x.palette = el('#hud-palette.palette', { hidden: true }, [
      el('div.pal-head', [
        el('span.label.strong', 'CONSTRUIR'),
        x.search = el('input.pal-search', { type: 'search', placeholder: 'Buscar…', spellcheck: 'false', autocomplete: 'off', on: {
          input: () => { B.query = x.search.value; B.rebuildGrid(); },
          keydown: e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (x.search.value) { x.search.value = ''; B.query = ''; B.rebuildGrid(); } else x.search.blur(); } }
        } }),
        el('button.pal-x', { type: 'button', title: 'Cerrar (B)', on: { click: () => B.close() } }, '×')
      ]),
      x.tabs = el('div.pal-tabs', CATS.map(c => el('button.pal-tab', { type: 'button', data: { cat: c.id }, on: { click: () => { B.cat = c.id; if (x.search.value) { x.search.value = ''; B.query = ''; } B.rebuildGrid(); play('ui_tab'); } } }, c.name.toUpperCase()))),
      x.grid = el('div.pal-grid'),
      x.foot = el('div.pal-foot.label')
    ]);
    x.modebar = el('#build-modebar.modebar', { hidden: true });
    x.hint = el('#build-hint.cursor-hint', { hidden: true });
    x.popover = el('#build-popover.popover', { hidden: true });
    x.floats = el('#build-floats.floats');
    B.root.append(x.palette, x.modebar, x.hint, x.popover, x.floats);
    B.subscribeRender();
    const on = (name, fn) => B.offs.push(E.on(name, fn));
    on('tech:researched', () => { if (B.paletteOpen) B.rebuildGrid(); });
    on('layer:changed', () => { B.hidePopover(); B.clearLine(); B.updateGhost(); if (B.paletteOpen) B.rebuildGrid(); });
    on('inv:changed', p => { if (!p || p.layer === curL()) B.affDirty = true; });
    on('game:new', () => B.reset());
    on('game:loaded', () => B.reset());
    on('screen:changed', s => { if (s !== 'game') B.reset(); });
    B.reset();
  },

  unmount() {
    B.reset();
    for (const off of B.offs) off();
    B.offs = [];
    for (const k in B.els) if (B.els[k] && B.els[k].remove && B.els[k].parentNode) B.els[k].remove();
    B.els = {}; B.cards.clear(); B.root = null;
  },

  reset() {
    B.placing = null; B.line = null; B.rect = null; B.bp = null; B.hover = null; B.floats = [];
    B.setMode('normal', true);
    B.hidePopover();
    if (B.els.floats) U.clear(B.els.floats);
  },

  /* ── input from Render (fx canvas): onTileClick / onTileHover / onTileDrag ── */
  subscribeRender() {
    if (B.subscribed) return;
    const r = Rn();
    if (has(r, 'onTileClick') && has(r, 'onTileHover')) {
      r.onTileClick((a, b, c) => B.onClick(normPt(a, b, c)));
      r.onTileHover((a, b, c) => B.onHover(a === null || a === undefined ? null : normPt(a, b, c)));
      if (has(r, 'onTileDrag')) r.onTileDrag((a, b, c, d, e, f) => B.onDrag(normDrag(a, b, c, d, e, f)));
      B.subscribed = true;
    } else if (r) {
      B.fallbackPointer();
      B.subscribed = true;
    }
    const game = document.getElementById('screen-game');
    if (game) game.addEventListener('contextmenu', e => { e.preventDefault(); if (B.mode !== 'normal' || B.placing) B.cancel(); });
    addEventListener('keydown', e => {
      if (e.code !== 'Escape' || !B.popover || B.mode !== 'normal') return;
      const t = (e.target && e.target.tagName) || '';
      if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || (LD.Main && LD.Main.overlays && LD.Main.overlays.length)) return;
      e.preventDefault(); e.stopImmediatePropagation();
      B.hidePopover();
    }, true);
  },

  fallbackPointer() {
    const canvas = document.getElementById('world'); if (!canvas) return;
    let down = null, dragging = false;
    const tileOf = e => { const p = LD.Stage.toLogical(e.clientX, e.clientY); const t = call(Rn(), 'screenToTile', p.x, p.y); return t ? { x: t.x | 0, y: t.y | 0, shift: e.shiftKey, button: e.button, lx: p.x, ly: p.y } : null; };
    canvas.addEventListener('pointerdown', e => { if (e.button !== 0) return; down = { t: tileOf(e), cx: e.clientX, cy: e.clientY }; dragging = false; });
    canvas.addEventListener('pointermove', e => {
      const t = tileOf(e); B.onHover(t);
      if (down && t && (dragging || Math.hypot(e.clientX - down.cx, e.clientY - down.cy) > 4)) {
        if (!dragging) { dragging = true; B.onDrag({ phase: 'start', x0: down.t.x, y0: down.t.y, x1: t.x, y1: t.y, shift: e.shiftKey, button: 0 }); }
        B.onDrag({ phase: 'move', x0: down.t.x, y0: down.t.y, x1: t.x, y1: t.y, shift: e.shiftKey, button: 0 });
      }
    });
    const up = e => { if (!down) return; const t = tileOf(e); if (dragging) B.onDrag({ phase: 'end', x0: down.t.x, y0: down.t.y, x1: t ? t.x : down.t.x, y1: t ? t.y : down.t.y, shift: e.shiftKey, button: 0 }); else if (t) B.onClick(t); down = null; dragging = false; };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', () => { if (dragging) B.onDrag({ phase: 'cancel' }); down = null; dragging = false; });
    canvas.addEventListener('pointerleave', () => B.onHover(null));
    canvas.addEventListener('auxclick', e => { if (e.button === 2) { const t = tileOf(e); if (t) B.onClick(t); } });
  },

  /* ── modes ── */
  setMode(m, silent) {
    if (!['normal', 'build', 'dismantle', 'hand', 'select', 'paste'].includes(m)) m = 'normal';
    const prev = B.mode;
    if (prev !== m || silent) {
      B.line = null; B.rect = null;
      if (m !== 'build') B.placing = null;
      if (m !== 'paste') B.bp = null;
      call(Rn(), 'setGhost', null); call(Rn(), 'setSelectionRect', null); call(Rn(), 'setBlueprintGhost', null);
    }
    B.mode = m;
    call(Rn(), 'setMode', m);
    B.hidePopover();
    const open = m === 'build';
    if (open !== B.paletteOpen) B.setPaletteOpen(open);
    B.refreshModebar();
    B.updateGhost();
    if (!silent && prev !== m) play(m === 'normal' ? 'ui_close' : 'ui_open');
    if (LD.UI.HUD && has(LD.UI.HUD, 'refreshDock')) LD.UI.HUD.refreshDock();
  },

  setPaletteOpen(v) {
    B.paletteOpen = !!v;
    const x = B.els;
    if (!x.palette) return;
    if (B.paletteOpen) { x.palette.hidden = false; requestAnimationFrame(() => x.palette.classList.add('open')); B.rebuildGrid(); }
    else { x.palette.classList.remove('open'); B.placing = null; if (x.search) x.search.blur(); setTimeout(() => { if (!B.paletteOpen && x.palette) x.palette.hidden = true; }, 140); }
    if (LD.UI.HUD && has(LD.UI.HUD, 'setPaletteOpen')) LD.UI.HUD.setPaletteOpen(B.paletteOpen);
  },

  open() { B.setMode('build'); },
  close() { if (B.mode === 'build') B.setMode('normal'); else B.setPaletteOpen(false); },
  toggle() { if (B.paletteOpen) B.close(); else B.open(); },

  cancel() {
    const now = performance.now();
    if (now - B.lastCancel < 60) return;
    B.lastCancel = now;
    if (B.popover) { B.hidePopover(); return; }
    if (B.line) { B.clearLine(); B.updateGhost(); return; }
    if (B.placing) { B.placing = null; B.markSelectedCard(); B.updateGhost(); B.refreshModebar(); return; }
    if (B.mode !== 'normal') { B.setMode('normal'); return; }
    if (LD.UI.Panel && LD.UI.Panel.uid && has(LD.UI.Panel, 'select')) LD.UI.Panel.select(null);
  },

  rotate() {
    if (B.mode === 'paste' && B.bp) { B.bp = B.rotateBp(B.bp); B.updateGhost(); return; }
    if (!B.placing) return;
    B.placing.rot = (B.placing.rot + 1) & 3;
    B.lastRot = B.placing.rot;
    B.updateGhost();
  },

  select(structId) {
    const def = sdef(structId);
    if (!def || !buildable(def)) return false;
    if (!isUnlocked(structId)) { const t = R() && R().unlockerOf('structure', structId); toast('Requiere: ' + ((t && R().tech(t)) ? R().tech(t).name : 'tecnología'), 'warn'); return false; }
    if (B.mode !== 'build') B.setMode('build');
    B.placing = { id: structId, rot: B.lastRot & 3 };
    B.line = null;
    B.markSelectedCard();
    B.refreshModebar();
    B.updateGhost();
    return true;
  },

  pasteLast() {
    const g = G(); if (!g) return;
    const bp = B.lastBp || (g.blueprints && g.blueprints[g.blueprints.length - 1]);
    if (!bp) { toast('No hay planos: pulsa C y arrastra para copiar una zona', 'warn'); return; }
    B.enterPaste(bp);
  },

  enterPaste(bp) {
    B.setMode('paste');
    B.bp = bp; B.lastBp = bp;
    B.refreshModebar();
    B.updateGhost();
  },

  /* ── palette ── */
  rebuildGrid() {
    const x = B.els, R_ = R(), g = G();
    if (!x.grid || !R_ || !g) return;
    const L = curL(), q = B.query.trim().toLowerCase(), era = g.meta.era || 0;
    for (const t of x.tabs.children) t.classList.toggle('active', !q && t.dataset.cat === B.cat);
    const list = []; let later = 0;
    for (const def of R_.structures.values()) {
      if (!buildable(def)) continue;
      const cat = paletteCat(def);
      if (!q && cat !== B.cat) continue;
      if (q && !(def.name.toLowerCase().includes(q) || def.id.includes(q.replace(/\s+/g, '_')))) continue;
      const unlocked = isUnlocked(def.id);
      const techId = R_.unlockerOf('structure', def.id), tech = techId ? R_.tech(techId) : null;
      if (!unlocked && !q && tech && tech.era > era + 1) { later++; continue; }
      list.push({ def, unlocked, tech, cat });
    }
    list.sort((a, b) => (a.unlocked === b.unlocked ? 0 : a.unlocked ? -1 : 1) || a.def.tier - b.def.tier || a.def.name.localeCompare(b.def.name));
    U.clear(x.grid); B.cards.clear();
    if (!list.length) x.grid.appendChild(el('div.pal-empty.label', q ? 'SIN RESULTADOS' : 'NADA DISPONIBLE TODAVÍA'));
    for (const it of list) x.grid.appendChild(B.makeCard(it, L));
    B.later = later;
    x.foot.textContent = later ? later + ' MÁS EN ERAS POSTERIORES · R ROTA · SHIFT MANTIENE' : 'R ROTA · SHIFT MANTIENE · ARRASTRA PARA TRAZAR LÍNEAS';
    B.markSelectedCard();
    B.refreshAffordability(true);
  },

  makeCard({ def, unlocked, tech, cat }, L) {
    const cost = costOf(def.id);
    const card = el('button.pal-card' + (unlocked ? '' : '.locked'), { type: 'button', data: { id: def.id }, on: { click: () => { if (unlocked) B.select(def.id); else { toast('Requiere: ' + (tech ? tech.name : 'tecnología desconocida'), 'warn'); play('error'); } } } }, [
      el('div.pal-thumb', [thumb(def.id, 44), el('span.tier-chip', { style: { color: tierColors()[def.tier | 0] } }, 'T' + def.tier), def.size > 1 ? el('span.pal-size.num', def.size + '×' + def.size) : null]),
      el('div.pal-name', def.name),
      unlocked ? el('div.pal-cost') : el('div.pal-req', [U.svg('<rect x="6" y="11" width="12" height="9"/><path d="M9 11V8a3 3 0 0 1 6 0v3"/>', 24, 24, 'hi'), 'Requiere: ' + (tech ? tech.name : '???')])
    ]);
    if (unlocked) card.querySelector('.pal-cost').appendChild(costList(cost, L, true));
    tip(card, () => B.structTip(def, L));
    B.cards.set(def.id, { card, cost, sig: null, unlocked });
    return card;
  },

  markSelectedCard() { for (const [id, c] of B.cards) c.card.classList.toggle('selected', !!B.placing && B.placing.id === id); },

  refreshAffordability(force) {
    const L = curL();
    for (const [id, c] of B.cards) {
      if (!c.unlocked) continue;
      const keys = Object.keys(c.cost);
      const sig = keys.map(k => count(L, k) >= c.cost[k] ? '1' : '0').join('');
      if (sig === c.sig && !force) continue;
      c.sig = sig;
      const aff = canAfford(id, L);
      c.card.classList.toggle('poor', !aff);
      const holder = c.card.querySelector('.pal-cost'), cl = holder && holder.firstChild;
      if (cl && typeof cl.refresh === 'function') cl.refresh();
      else if (holder) { U.clear(holder); holder.appendChild(costList(c.cost, L, true)); }
    }
  },

  structTip(def, L) {
    const rows = [el('div.tip-title', [def.name, el('span.tier-chip', 'T' + def.tier)]), el('div.tip-body', def.desc || '')];
    const row = (k, v) => rows.push(el('div.tip-row', [el('span.label', k), el('span.num', v)]));
    row('TAMAÑO', (def.size || 1) + '×' + (def.size || 1) + ' · ' + U.fmtTime(def.buildTime || 1) + ' de montaje');
    if (def.power) {
      if (def.power.gen) row('GENERA', U.fmtW(def.power.gen) + (def.power.fuel ? ' · combustible: ' + def.power.fuel.map(itemName).join(', ') : ''));
      if (def.power.use) row('CONSUME', U.fmtW(def.power.use));
      if (def.power.store) row('ALMACENA', U.fmtJ(def.power.store));
      if (def.power.fluidIn) row('FLUIDO', Object.keys(def.power.fluidIn).map(f => itemName(f) + ' ' + def.power.fluidIn[f] + '/s').join(', '));
    }
    if (def.burn) row('QUEMA', U.fmt(def.burn.mjPerSec || 0, 3) + ' MJ/s · ' + (def.burn.fuels || []).map(itemName).join(', '));
    if (def.types) row('PROCESOS', def.types.map(t => RECIPE_TYPE_NAMES[t] || t).join(', ') + (def.speed && def.speed !== 1 ? ' · velocidad ×' + def.speed : ''));
    if (def.ocMax) row('OVERCLOCK', 'hasta +' + def.ocMax);
    if (def.extract) row('EXTRAE', 'dureza ≤ ' + def.extract.hardnessMax + ' · ' + U.fmt(def.extract.rate, 2) + '/s por casilla' + (def.extract.fluid ? ' (a tuberías)' : ''));
    if (def.conveyor) row('CINTA', U.fmt(def.conveyor.rate, 1) + ' objetos/s');
    if (def.cable) row('CABLE', isFinite(def.cable.cap) ? U.fmtW(def.cable.cap) : 'sin límite');
    if (def.pipe) row('TUBERÍA', isFinite(def.pipe.rate) ? U.fmt(def.pipe.rate, 1) + ' u/s' : 'sin límite');
    if (def.tank) row('TANQUE', U.fmt(def.tank.cap, 0) + ' u' + (def.tank.cryo ? ' · criogénico' : ''));
    if (def.storage) row('CAPACIDAD', '+' + U.fmt(def.storage.cap, 0) + ' por objeto');
    if (def.elevator) row('ELEVADOR', U.fmt(def.elevator.rate, 1) + ' objetos/s');
    if (def.borer) row('TUNELADORA', U.fmt(def.borer.rate, 1) + ' casillas/s');
    if (def.shaft) row('POZO', 'abre ' + ((R() && R().layer(def.shaft.layer)) ? R().layer(def.shaft.layer).name : 'capa ' + def.shaft.layer));
    if (def.nature) row('NATURALEZA', (def.nature.kind || '') + (def.nature.radius ? ' · radio ' + def.nature.radius : '') + (def.nature.rate ? ' · ' + U.fmt(def.nature.rate, 2) + '/s' : ''));
    if (def.turret) row('TORRETA', 'alcance ' + def.turret.range + ' · ' + def.turret.dmg + ' dmg ×' + def.turret.rate + '/s · ' + def.turret.dmgType + (def.turret.ammo ? ' · munición: ' + Object.keys(def.turret.ammo).map(itemName).join(', ') : '') + (def.turret.ap ? ' · perforante' : ''));
    if (def.wall) row('MURO', U.fmt(def.hp, 0) + ' de integridad');
    if (def.light) row('LUZ', 'radio ' + def.light.radius);
    if (def.lab) row('LABORATORIO', 'nivel ' + def.lab.tier);
    const rules = [];
    if (def.surfaceOnly) rules.push('solo en superficie');
    if (def.needsWater) rules.push('debe tocar agua');
    if (def.needsVent) rules.push('sobre una fumarola');
    if (def.overlay) rules.push('sobre suelo libre o cintas');
    if (def.extract) rules.push('sobre un yacimiento');
    if (def.borer) rules.push('junto a una parcela sin excavar');
    if (def.heatproof) rules.push('resiste el calor del núcleo');
    if (rules.length) rows.push(el('div.tip-row', [el('span.label', 'REGLAS'), el('span', rules.join(' · '))]));
    if (def.hp) row('INTEGRIDAD', U.fmt(def.hp, 0));
    return el('div', rows);
  },

  /* ── ghost / hints ── */
  onHover(p) {
    B.hover = p;
    if (p) call(Rn(), 'setHover', p.x, p.y); else call(Rn(), 'setHover', null, null);
    if (B.line && p) { B.line.x1 = p.x; B.line.y1 = p.y; }
    B.updateGhost();
  },

  updateGhost() {
    const r = Rn(), p = B.hover, L = curL(), w = W();
    if (!r) return;
    if (B.mode === 'paste' && B.bp) {
      if (!p) { call(r, 'setBlueprintGhost', null); B.hint(null); return; }
      call(r, 'setBlueprintGhost', { bp: B.bp, x: p.x, y: p.y });
      B.hint(B.bpHint(B.bp, L), p.x, p.y + (B.bp.h || 1), 'info');
      return;
    }
    if (B.mode === 'dismantle') {
      call(r, 'setGhost', null);
      if (!p) { B.hint(null); return; }
      const uid = uidAtTile(L, p.x, p.y);
      const g = G(), inst = uid && g && g.structures[uid];
      if (!inst) { B.hint(null); return; }
      const def = sdef(inst.id), Bd = S('Build');
      const refund = has(Bd, 'refundPreview') ? Bd.refundPreview(uid) : null;
      const cd = has(Bd, 'canDismantle') ? (Bd.canDismantle(uid) || { ok: true }) : { ok: !(def && def.id === 'hub'), reason: 'El almacén central no se puede desmontar' };
      const parts = [el('b', def ? def.name : inst.id), el('span.dim', inst.state === 'building' ? ' · reembolso 100 %' : ' · reembolso 65 %')];
      if (cd.ok && refund && Object.keys(refund).length) parts.push(el('div.hint-cost', Object.keys(refund).map(k => el('span.cost', [icon(k, 12), el('span.num', String(refund[k]))]))));
      if (!cd.ok) parts.push(el('div.bad', cd.reason || 'No se puede desmontar'));
      B.hint(el('div', parts), inst.x, inst.y + (def ? def.size || 1 : 1), cd.ok ? 'warn' : 'bad');
      return;
    }
    if (B.mode === 'hand') {
      call(r, 'setGhost', null);
      if (!p) { B.hint(null); return; }
      const N = S('Nature');
      const gi = has(N, 'gatherInfo') ? N.gatherInfo(L, p.x, p.y) : null;
      if (gi) {
        if (gi.ok) B.hint(el('span', ['Recolectar ' + (gi.n > 1 ? gi.n + ' × ' : '') + itemName(gi.item), gi.bonus ? el('span.dim', ' · ' + Math.round((gi.bonusP || 0) * 100) + ' % ' + itemName(gi.bonus)) : null]), p.x, p.y + 1, 'ok');
        else B.hint(el('span', gi.text || 'Nada que recolectar aquí'), p.x, p.y + 1, gi.reason === 'cooldown' || gi.reason === 'full' ? 'warn' : 'dim');
        return;
      }
      const cd = has(N, 'gatherCooldown') ? N.gatherCooldown() : 0;
      const td = has(w, 'terrainDef') ? w.terrainDef(L, p.x, p.y) : null;
      const tree = has(w, 'treeAt') ? w.treeAt(L, p.x, p.y) : null;
      const nat = tree !== null && tree !== undefined ? 'wood_log' : (td && td.natural && td.natural.item);
      if (!nat) { B.hint(el('span.dim', 'Nada que recolectar aquí'), p.x, p.y + 1, 'dim'); return; }
      B.hint(cd > 0 ? el('span', ['Recolectar ' + itemName(nat) + ' · ', el('span.warn.num', U.fmt(cd, 1) + ' s')]) : el('span', 'Recolectar ' + itemName(nat)), p.x, p.y + 1, cd > 0 ? 'warn' : 'ok');
      return;
    }
    if (B.mode !== 'build' || !B.placing) { call(r, 'setGhost', null); B.hint(null); return; }
    if (!p) { call(r, 'setGhost', null); B.hint(null); return; }
    const { id, rot } = B.placing, def = sdef(id);
    if (B.line) {
      const tiles = B.lineTiles(B.line.x0, B.line.y0, B.line.x1, B.line.y1, rot);
      let valid = 0;
      const cost = costOf(id), L0 = L;
      let affordable = Infinity;
      for (const k in cost) affordable = Math.min(affordable, Math.floor(count(L0, k) / cost[k]));
      const line = tiles.map(t => { const ok = B.tileOk(id, L, t[0], t[1], t[2], def); if (ok) valid++; return [t[0], t[1], t[2], ok]; });
      const last = tiles[tiles.length - 1];
      call(r, 'setGhost', { structId: id, x: last[0], y: last[1], rot: last[2], valid: valid > 0 && valid <= affordable, line });
      const n = Math.min(valid, isFinite(affordable) ? affordable : valid);
      B.hint(el('span', [el('b', def.name), ' · ' + tiles.length + ' tramos · ', el('span.num' + (valid < tiles.length ? '.warn' : ''), valid + ' válidos'), isFinite(affordable) && affordable < valid ? el('span.bad', ' · sólo ' + affordable + ' asequibles') : null, n === 0 ? el('span.bad', ' · sin materiales') : null]), last[0], last[1] + 1, valid ? 'ok' : 'bad');
      return;
    }
    const cp = has(w, 'canPlace') ? (w.canPlace(id, L, p.x, p.y, rot) || { ok: true }) : { ok: true };
    const aff = canAfford(id, L);
    call(r, 'setGhost', { structId: id, x: p.x, y: p.y, rot, valid: !!cp.ok && aff });
    const size = (def && def.size) || 1;
    if (!cp.ok) B.hint(el('span', cp.reason || 'No se puede colocar aquí'), p.x, p.y + size, 'bad');
    else if (!aff) B.hint(el('span', [el('span.bad', 'Faltan materiales'), el('div.hint-cost', Object.keys(costOf(id)).filter(k => count(L, k) < costOf(id)[k]).map(k => el('span.cost.bad', [icon(k, 12), el('span.num', count(L, k) + '/' + costOf(id)[k])])))]), p.x, p.y + size, 'bad');
    else B.hint(el('span', [el('b', def ? def.name : id), el('span.dim', ' · ' + rotName[rot] + (lineable(def) ? ' · arrastra para trazar' : ''))]), p.x, p.y + size, 'ok');
  },

  tileOk(id, L, x, y, rot, def) {
    const w = W();
    const existing = uidAtTile(L, x, y, def);
    const g = G();
    if (existing && g && g.structures[existing] && g.structures[existing].id === id) return false;
    const cp = has(w, 'canPlace') ? w.canPlace(id, L, x, y, rot) : { ok: true };
    return !!(cp && cp.ok);
  },

  lineTiles(x0, y0, x1, y1, rot) {
    const out = [], dx = x1 - x0, dy = y1 - y0, sx = Math.sign(dx), sy = Math.sign(dy);
    const dirX = dx > 0 ? 0 : 2, dirY = dy > 0 ? 1 : 3;
    if (dx === 0 && dy === 0) return [[x0, y0, rot]];
    if (Math.abs(dx) >= Math.abs(dy)) {
      for (let x = x0; x !== x1; x += sx) out.push([x, y0, dirX]);
      for (let y = y0; y !== y1; y += sy) out.push([x1, y, dirY]);
      out.push([x1, y1, dy !== 0 ? dirY : dirX]);
    } else {
      for (let y = y0; y !== y1; y += sy) out.push([x0, y, dirY]);
      for (let x = x0; x !== x1; x += sx) out.push([x, y1, dirX]);
      out.push([x1, y1, dx !== 0 ? dirX : dirY]);
    }
    return out;
  },

  clearLine() { B.line = null; call(Rn(), 'setGhost', null); },

  bpHint(bp, L) {
    const Bd = S('Build');
    const cost = has(Bd, 'blueprintCost') ? Bd.blueprintCost(bp) : B.localBpCost(bp);
    const keys = Object.keys(cost || {});
    return el('div', [el('b', bp.name || 'Plano'), el('span.dim', ' · ' + bp.w + '×' + bp.h + ' · ' + (bp.cells ? bp.cells.length : 0) + ' piezas · R rota'),
      keys.length ? el('div.hint-cost', keys.map(k => el('span.cost' + (count(L, k) >= cost[k] ? '.ok' : '.bad'), [icon(k, 12), el('span.num', String(cost[k]))]))) : null,
      el('div.dim', 'Lo que no sea asequible queda en cola y se coloca al haber materiales')]);
  },

  localBpCost(bp) { const out = {}; for (const c of (bp.cells || [])) { const cost = costOf(c.id); for (const k in cost) out[k] = (out[k] || 0) + cost[k]; } return out; },

  rotateBp(bp) {
    const cells = (bp.cells || []).map(c => { const d = sdef(c.id), s = (d && d.size) || 1; return Object.assign({}, c, { dx: bp.h - s - c.dy, dy: c.dx, rot: ((c.rot || 0) + 1) & 3 }); });
    return Object.assign({}, bp, { w: bp.h, h: bp.w, cells });
  },

  hint(content, tx, ty, kind) {
    const h = B.els.hint; if (!h) return;
    if (!content) { h.hidden = true; B.hintTile = null; return; }
    U.clear(h);
    if (typeof content === 'string') h.textContent = content; else h.appendChild(content);
    h.className = 'cursor-hint' + (kind ? ' ' + kind : '');
    h.hidden = false;
    B.hintTile = [tx, ty];
    B.placeAt(h, tx, ty, 0.25);
  },

  placeAt(node, tx, ty, padRem) {
    const p = tileToScreen(tx, ty);
    if (!p) { node.style.left = '50%'; node.style.top = '50%'; return; }
    const off = p.x < -48 || p.x > 1968 || p.y < 0 || p.y > 1128;
    node.style.visibility = off ? 'hidden' : '';
    const lx = U.clamp(p.x, 8, 1880), ly = U.clamp(p.y, 56, 900);
    node.style.left = (lx / 16).toFixed(2) + 'rem';
    node.style.top = (ly / 16 + (padRem || 0)).toFixed(2) + 'rem';
  },

  refreshModebar() {
    const m = B.els.modebar; if (!m) return;
    let parts = null;
    const kc = (k, t) => el('span.mb-item', [keycap(k), ' ' + t]);
    if (B.mode === 'build' && B.placing) { const d = sdef(B.placing.id); parts = [el('span.mb-title', 'COLOCAR · ' + (d ? d.name.toUpperCase() : B.placing.id)), kc('R', 'rota'), kc('SHIFT', 'mantiene'), lineable(d) ? kc('ARRASTRA', 'traza') : null, kc('ESC', 'cancela')]; }
    else if (B.mode === 'dismantle') parts = [el('span.mb-title.bad', 'DESMONTAR'), el('span.mb-item', 'clic en una estructura · reembolso 65 % (100 % en obra)'), kc('ESC', 'sale')];
    else if (B.mode === 'hand') parts = [el('span.mb-title', 'RECOLECTAR A MANO'), el('span.mb-item', 'clic en árboles, piedra, arbustos y arcilla · 1 objeto / 1,2 s'), kc('ESC', 'sale')];
    else if (B.mode === 'select') parts = [el('span.mb-title', 'COPIAR PLANO'), el('span.mb-item', 'arrastra un rectángulo sobre las estructuras'), kc('ESC', 'sale')];
    else if (B.mode === 'paste' && B.bp) parts = [el('span.mb-title', 'PEGAR · ' + (B.bp.name || 'PLANO').toUpperCase()), kc('R', 'rota'), kc('SHIFT', 'mantiene'), kc('ESC', 'sale')];
    const Bd = S('Build'), q = has(Bd, 'queue') ? (Bd.queue() || []).length : 0;
    B.lastQ = q;
    if (q) parts = (parts || []).concat([el('span.mb-item.mb-queue', [el('span.warn', 'PLANO: ' + q + ' EN COLA'), el('button.mb-btn', { type: 'button', on: { click: () => { call(Bd, 'clearQueue'); B.refreshModebar(); } } }, 'CANCELAR')])]);
    U.clear(m);
    if (!parts) { m.hidden = true; return; }
    m.append(...parts.filter(Boolean));
    m.hidden = false;
  },

  /* ── clicks ── */
  onClick(p) {
    if (!p || !G()) return;
    const L = curL();
    if (p.button === 2) { if (B.mode !== 'normal' || B.placing || B.popover) B.cancel(); return; }
    if (p.button !== 0) return;
    B.hidePopover();
    switch (B.mode) {
      case 'build': return B.placing ? B.clickPlace(p, L) : B.clickNormal(p, L);
      case 'dismantle': return B.clickDismantle(p, L);
      case 'hand': return B.clickHand(p, L);
      case 'paste': return B.clickPaste(p, L);
      case 'select': return;
      default: return B.clickNormal(p, L);
    }
  },

  clickPlace(p, L) {
    const { id, rot } = B.placing, w = W(), Bd = S('Build');
    const cp = has(w, 'canPlace') ? (w.canPlace(id, L, p.x, p.y, rot) || { ok: true }) : { ok: true };
    if (!cp.ok) { play('error'); B.float(L, p.x, p.y, cp.reason || 'Aquí no', 'bad'); return; }
    if (!canAfford(id, L)) { play('error'); B.float(L, p.x, p.y, 'Faltan materiales', 'bad'); return; }
    const uid = has(Bd, 'place') ? Bd.place(id, L, p.x, p.y, rot) : null;
    if (!uid) { play('error'); B.float(L, p.x, p.y, 'No se pudo colocar', 'bad'); return; }
    if (!p.shift) { B.placing = null; B.markSelectedCard(); B.refreshModebar(); }
    B.affDirty = true;
    B.updateGhost();
  },

  clickNormal(p, L) {
    const w = W(), uid = uidAtTile(L, p.x, p.y);
    if (uid) { call(LD.UI.Panel, 'select', uid); return; }
    if (L > 0 && has(w, 'chunkOf') && has(w, 'isExcavated')) {
      const c = w.chunkOf(L, p.x, p.y);
      if (c && !w.isExcavated(L, c.cx, c.cy)) { B.showChunkPopover(L, c.cx, c.cy, p); return; }
    }
    call(LD.UI.Panel, 'select', null);
  },

  async clickDismantle(p, L) {
    const uid = uidAtTile(L, p.x, p.y), g = G();
    const inst = uid && g.structures[uid];
    if (!inst) return;
    const def = sdef(inst.id), Bd = S('Build');
    const cd = has(Bd, 'canDismantle') ? (Bd.canDismantle(uid) || { ok: true }) : { ok: !(def && def.id === 'hub'), reason: 'El almacén central no se puede desmontar' };
    if (!cd.ok) { toast(cd.reason || 'No se puede desmontar', 'warn'); play('error'); return; }
    if (def && (def.size || 1) >= 2) {
      const ok = await B.confirm('Desmontar ' + def.name, 'Se devolverá el ' + (inst.state === 'building' ? '100' : '65') + ' % del coste al inventario de este estrato.', { danger: true, ok: 'Desmontar' });
      if (!ok) return;
    }
    if (!has(Bd, 'dismantle')) return;
    const refund = Bd.dismantle(uid);
    if (refund && typeof refund === 'object') { const ks = Object.keys(refund); if (ks.length) B.float(L, p.x, p.y, '+' + ks.slice(0, 3).map(k => refund[k] + ' ' + itemName(k)).join(', ') + (ks.length > 3 ? '…' : ''), 'ok'); }
    if (LD.UI.Panel && LD.UI.Panel.uid === uid) call(LD.UI.Panel, 'select', null);
    B.affDirty = true;
    B.updateGhost();
  },

  clickHand(p, L) {
    const N = S('Nature'), w = W();
    if (!has(N, 'gather')) return;
    const res = N.gather(L, p.x, p.y);
    if (res && res.item) {
      const d = R() && R().item(res.item);
      call(Rn(), 'flash', L, p.x, p.y, (d && d.color) || cssVar('--bone', '#ece7dc'));
      B.float(L, p.x, p.y, '+' + (res.n || 1) + ' ' + itemName(res.item) + (res.extra ? ' · +1 ' + itemName(res.extra) : ''), 'ok');
      B.updateGhost();
      return;
    }
    const gi = has(N, 'gatherInfo') ? N.gatherInfo(L, p.x, p.y) : null;
    if (gi && gi.text) { B.float(L, p.x, p.y, gi.text, gi.reason === 'cooldown' || gi.reason === 'full' ? 'warn' : 'dim'); return; }
    const cd = has(N, 'gatherCooldown') ? N.gatherCooldown() : 0;
    const td = has(w, 'terrainDef') ? w.terrainDef(L, p.x, p.y) : null;
    if (cd > 0) B.float(L, p.x, p.y, 'Espera ' + U.fmt(cd, 1) + ' s', 'warn');
    else if (!td || !td.natural) B.float(L, p.x, p.y, 'Nada que recolectar', 'dim');
    else B.float(L, p.x, p.y, 'Inventario lleno', 'bad');
  },

  clickPaste(p, L) {
    const Bd = S('Build'); if (!B.bp || !has(Bd, 'pasteBlueprint')) return;
    const res = Bd.pasteBlueprint(B.bp, L, p.x, p.y) || { placed: 0, queued: 0 };
    B.float(L, p.x, p.y, (res.placed || 0) + ' colocados, ' + (res.queued || 0) + ' en cola', res.placed ? 'ok' : 'warn');
    B.affDirty = true;
    B.lastQ = -1;
    if (!p.shift) B.setMode('normal');
  },

  /* ── drags ── */
  onDrag(d) {
    if (!d || !G()) return false;
    const L = curL();
    if (d.phase === 'cancel') { const had = !!(B.line || B.rect); B.line = null; B.rect = null; call(Rn(), 'setSelectionRect', null); B.updateGhost(); return had; }
    if (B.mode === 'build' && B.placing) {
      const def = sdef(B.placing.id);
      if (!lineable(def)) return false;
      if (d.phase === 'start') B.line = { x0: d.x0, y0: d.y0, x1: d.x1, y1: d.y1 };
      else if (B.line) { B.line.x1 = d.x1; B.line.y1 = d.y1; }
      if (d.phase === 'end') { const ln = B.line || { x0: d.x0, y0: d.y0, x1: d.x1, y1: d.y1 }; B.line = null; B.placeLine(ln, L, d.shift); }
      B.updateGhost();
      return true;
    }
    if (B.mode === 'select') {
      const rect = { x0: Math.min(d.x0, d.x1), y0: Math.min(d.y0, d.y1), x1: Math.max(d.x0, d.x1), y1: Math.max(d.y0, d.y1) };
      if (d.phase === 'end') { B.rect = null; call(Rn(), 'setSelectionRect', null); B.finishSelect(rect, L); return true; }
      B.rect = rect;
      call(Rn(), 'setSelectionRect', rect);
      return true;
    }
    return false;
  },

  placeLine(ln, L, keep) {
    const { id, rot } = B.placing, def = sdef(id), Bd = S('Build');
    const tiles = B.lineTiles(ln.x0, ln.y0, ln.x1, ln.y1, rot);
    let placed = 0, skipped = 0, broke = false;
    for (const t of tiles) {
      if (!B.tileOk(id, L, t[0], t[1], t[2], def)) { skipped++; continue; }
      if (!canAfford(id, L)) { broke = true; break; }
      const uid = has(Bd, 'place') ? Bd.place(id, L, t[0], t[1], t[2]) : null;
      if (uid) placed++; else skipped++;
    }
    const last = tiles[tiles.length - 1];
    if (broke) B.float(L, last[0], last[1], placed + ' colocados · faltan materiales', 'warn');
    else if (placed) B.float(L, last[0], last[1], placed + (placed === 1 ? ' tramo' : ' tramos') + (skipped ? ' · ' + skipped + ' omitidos' : ''), 'ok');
    else { play('error'); B.float(L, last[0], last[1], 'Nada colocado', 'bad'); }
    B.affDirty = true;
    if (!keep && placed && tiles.length === 1) { B.placing = null; B.markSelectedCard(); B.refreshModebar(); }
  },

  finishSelect(rect, L) {
    const Bd = S('Build');
    const bp = has(Bd, 'copyBlueprint') ? Bd.copyBlueprint(L, rect.x0, rect.y0, rect.x1, rect.y1) : B.localCopy(L, rect);
    if (!bp || !bp.cells || !bp.cells.length) { toast('Selección vacía: no hay estructuras en ese rectángulo', 'warn'); play('error'); return; }
    B.saveDialog(bp);
  },

  localCopy(L, rect) {
    const g = G(), cells = [];
    for (const uid in g.structures) { const s = g.structures[uid]; if (s.layer !== L) continue; if (s.x < rect.x0 || s.y < rect.y0 || s.x > rect.x1 || s.y > rect.y1) continue; cells.push({ dx: s.x - rect.x0, dy: s.y - rect.y0, id: s.id, rot: s.rot || 0 }); }
    return { name: '', w: rect.x1 - rect.x0 + 1, h: rect.y1 - rect.y0 + 1, cells };
  },

  saveDialog(bp) {
    const g = G();
    const n = (g.blueprints || []).length + 1;
    const input = el('input.dlg-input', { type: 'text', value: bp.name || 'Plano ' + n, maxlength: '32', spellcheck: 'false' });
    const Bd = S('Build');
    const cost = has(Bd, 'blueprintCost') ? Bd.blueprintCost(bp) : B.localBpCost(bp);
    const body = el('div', [
      el('div.dlg-row', [B.bpPreview(bp, 160, 96), el('div.dlg-col', [el('div.label', 'NOMBRE'), input, el('div.dlg-meta.num', bp.w + '×' + bp.h + ' · ' + bp.cells.length + ' piezas')])]),
      el('div.label', 'COSTE TOTAL'), costList(cost, curL())
    ]);
    const finish = save => {
      bp.name = input.value.trim() || ('Plano ' + n);
      let target = bp;
      if (save) {
        if (has(Bd, 'saveBlueprint')) { const idx = Bd.saveBlueprint(bp); if (idx >= 0 && g.blueprints[idx]) target = g.blueprints[idx]; }
        else { if (!g.blueprints) g.blueprints = []; g.blueprints.push(bp); }
        toast('Plano guardado: ' + target.name, 'ok');
      }
      B.enterPaste(target);
    };
    const dlg = B.dialog({ title: 'GUARDAR PLANO', body, actions: [
      { label: 'GUARDAR Y PEGAR', kind: 'primary', fn: () => finish(true) },
      { label: 'SOLO PEGAR', fn: () => finish(false) },
      { label: 'CANCELAR', fn: () => { B.setMode('normal'); } }
    ], onClose: () => { if (B.mode === 'select') B.setMode('normal'); } });
    setTimeout(() => { input.focus(); input.select(); }, 30);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); finish(true); dlg.close(); } e.stopPropagation(); });
    return dlg;
  },

  openLibrary() {
    const g = G(); if (!g) return;
    const list = g.blueprints || [];
    const body = el('div.bp-lib');
    const render = () => {
      U.clear(body);
      if (!list.length) { body.appendChild(el('div.dlg-empty', ['No hay planos guardados. Pulsa ', keycap('C'), ' y arrastra sobre una zona para copiarla.'])); return; }
      list.forEach((bp, i) => {
        const Bd = S('Build');
        const cost = has(Bd, 'blueprintCost') ? Bd.blueprintCost(bp) : B.localBpCost(bp);
        body.appendChild(el('div.bp-row', [
          B.bpPreview(bp, 96, 64),
          el('div.bp-info', [el('div.bp-name', bp.name || 'Plano ' + (i + 1)), el('div.bp-meta.num', bp.w + '×' + bp.h + ' · ' + (bp.cells ? bp.cells.length : 0) + ' piezas'), costList(cost, curL())]),
          el('div.bp-actions', [
            el('button.dlg-btn.primary', { type: 'button', on: { click: () => { dlg.close(); B.enterPaste(bp); } } }, 'PEGAR'),
            el('button.dlg-btn', { type: 'button', on: { click: () => B.renameDialog(i, render) } }, 'RENOMBRAR'),
            el('button.dlg-btn.danger', { type: 'button', on: { click: async () => { if (await B.confirm('Borrar plano', '¿Borrar «' + (bp.name || 'Plano') + '»?', { danger: true, ok: 'Borrar' })) { if (has(Bd, 'deleteBlueprint')) Bd.deleteBlueprint(i); else list.splice(i, 1); if (B.lastBp === bp) B.lastBp = null; render(); } } } }, 'BORRAR')
          ])
        ]));
      });
    };
    render();
    const dlg = B.dialog({ title: 'PLANOS', body, wide: true, actions: [{ label: 'NUEVO PLANO (C)', fn: () => B.setMode('select') }, { label: 'CERRAR', fn: () => {} }] });
    return dlg;
  },

  renameDialog(i, done) {
    const g = G(), bp = g && g.blueprints && g.blueprints[i]; if (!bp) return;
    const Bd = S('Build');
    const input = el('input.dlg-input', { type: 'text', value: bp.name || '', maxlength: '32', spellcheck: 'false' });
    const apply = () => { const name = input.value.trim(); if (!name) return false; if (has(Bd, 'renameBlueprint')) Bd.renameBlueprint(i, name); else bp.name = name; if (done) done(); };
    const dlg = B.dialog({ title: 'RENOMBRAR PLANO', body: el('div.dlg-col', [el('div.label', 'NOMBRE'), input]), actions: [{ label: 'GUARDAR', kind: 'primary', fn: apply }, { label: 'CANCELAR', fn: () => {} }] });
    setTimeout(() => { input.focus(); input.select(); }, 30);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (apply() !== false) dlg.close(); } e.stopPropagation(); });
  },

  bpPreview(bp, w, h) {
    const c = U.canvas(w, h), ctx = c.getContext('2d');
    ctx.fillStyle = cssVar('--ink3', '#1c1c1f'); ctx.fillRect(0, 0, w, h);
    const k = Math.max(1, Math.floor(Math.min((w - 8) / Math.max(1, bp.w), (h - 8) / Math.max(1, bp.h))));
    const ox = Math.floor((w - k * bp.w) / 2), oy = Math.floor((h - k * bp.h) / 2);
    ctx.strokeStyle = cssVar('--line', 'rgba(236,231,220,.14)'); ctx.lineWidth = 1;
    ctx.strokeRect(ox + 0.5, oy + 0.5, k * bp.w, k * bp.h);
    for (const cell of (bp.cells || [])) {
      const d = sdef(cell.id), s = (d && d.size) || 1;
      const col = tierColors()[(d && d.tier) | 0] || tierColors()[0];
      if (d && d.overlay) { ctx.fillStyle = d.overlay === 'cable' ? cssVar('--warn', '#d9a441') : cssVar('--info', '#7aa6c9'); ctx.fillRect(ox + cell.dx * k + k * 0.35, oy + cell.dy * k + k * 0.35, Math.max(1, k * 0.3), Math.max(1, k * 0.3)); continue; }
      ctx.fillStyle = col; ctx.globalAlpha = d && d.conveyor ? 0.45 : 0.85;
      ctx.fillRect(ox + cell.dx * k + 1, oy + cell.dy * k + 1, Math.max(1, s * k - 2), Math.max(1, s * k - 2));
      ctx.globalAlpha = 1;
    }
    c.className = 'bp-preview';
    return c;
  },

  /* ── chunk popover (unexcavated rock) ── */
  showChunkPopover(L, cx, cy, p) {
    const w = W(), g = G(), x = B.els.popover;
    if (!x || !g) return;
    const ld = R() && R().layer(L);
    const H = has(w, 'rockHardness') ? w.rockHardness(L, cx, cy) : null;
    const work = has(w, 'excavationWork') ? w.excavationWork(L, cx, cy) : (H !== null ? H * 256 : null);
    const dig = (g.layers[L].digging || {})[cx + ',' + cy];
    const cd = has(w, 'canDig') ? (w.canDig(L, cx, cy) || { ok: false }) : { ok: true };
    const tier = ld && ld.borerTier !== undefined ? ld.borerTier : '?';
    const rows = [el('div.pop-head', [el('span.label.strong', 'ROCA SIN EXCAVAR'), el('span.num.dim', 'PARCELA ' + cx + ',' + cy), el('button.pop-x', { type: 'button', on: { click: () => B.hidePopover() } }, '×')])];
    const row = (k, v) => rows.push(el('div.tip-row', [el('span.label', k), el('span.num', v)]));
    if (H !== null) row('DUREZA', U.fmt(H, 2));
    if (dig) { rows.push(el('div.tip-row', [el('span.label', 'EXCAVACIÓN'), el('span.num', U.fmtPct(dig.total ? dig.work / dig.total : 0) + ' · ' + U.fmt(dig.work, 0) + ' / ' + U.fmt(dig.total, 0))])); rows.push(el('div.pop-bar', [el('i', { style: { width: Math.round(100 * U.clamp(dig.total ? dig.work / dig.total : 0)) + '%' } })])); }
    else if (work !== null) row('TRABAJO', U.fmt(work, 0) + ' unidades');
    row('TUNELADORA', 'nivel T' + tier + ' o superior');
    rows.push(el('div.pop-msg' + (cd.ok ? '.ok' : '.warn'), dig ? 'Una tuneladora está excavando esta parcela.' : cd.ok ? 'Coloca una tuneladora junto a esta parcela.' : (cd.reason || 'Solo se puede excavar junto a una parcela ya excavada.')));
    if (cd.ok && !dig) rows.push(el('button.dlg-btn.primary.pop-btn', { type: 'button', on: { click: () => { B.hidePopover(); B.setMode('build'); B.cat = 'extract'; B.rebuildGrid(); } } }, 'VER TUNELADORAS'));
    U.clear(x); x.append(...rows);
    x.hidden = false;
    B.popover = { L, cx, cy, tx: p.x, ty: p.y };
    B.placeAt(x, p.x + 1, p.y, 0);
  },

  hidePopover() { if (B.els.popover) B.els.popover.hidden = true; B.popover = null; },

  /* ── floating labels ── */
  float(L, x, y, text, kind) {
    const c = B.els.floats; if (!c) return;
    const n = el('div.float-label' + (kind ? '.' + kind : ''), text);
    c.appendChild(n);
    const f = { n, x, y, t: performance.now() };
    B.floats.push(f);
    B.placeAt(n, x + 0.5, y, 0);
    setTimeout(() => { n.remove(); const i = B.floats.indexOf(f); if (i >= 0) B.floats.splice(i, 1); }, 1500);
  },

  update(dt) {
    const r = Rn(); if (!r) return;
    B.affAcc += dt;
    if (B.affAcc >= 0.25) {
      B.affAcc = 0;
      if (B.affDirty) { B.affDirty = false; if (B.paletteOpen) B.refreshAffordability(false); }
      const Bd = S('Build'); if (has(Bd, 'queue') && (Bd.queue() || []).length !== B.lastQ) B.refreshModebar();
    }
    const c = has(r, 'cam') ? r.cam() : null;
    const key = c ? (c.x + ',' + c.y + ',' + c.z) : '';
    if (key === B.camKey) return;
    B.camKey = key;
    if (B.hintTile && !B.els.hint.hidden) B.placeAt(B.els.hint, B.hintTile[0], B.hintTile[1], 0.25);
    if (B.popover) B.placeAt(B.els.popover, B.popover.tx + 1, B.popover.ty, 0);
    for (const f of B.floats) B.placeAt(f.n, f.x + 0.5, f.y, 0);
  },

  /* ── dialogs (LD.UI.modal / LD.UI.confirm with local fallback) ── */
  dialog({ title, body, actions = [], wide = false, onClose }) {
    let closed = false, handle = null;
    const close = () => { if (closed) return; closed = true; if (handle) handle.close(); };
    if (has(LD.UI, 'modal')) {
      const m = LD.UI.modal({ title, body, wide, onClose: () => { closed = true; if (onClose) onClose(); },
        actions: actions.map(a => ({ label: a.label, primary: a.kind === 'primary', danger: a.kind === 'danger', ghost: !a.kind, onClick: () => { const r = a.fn && a.fn(); return r === false ? false : undefined; } })) });
      handle = { close: () => { if (m && m.close) m.close(); } };
      return { close };
    }
    const row = el('div.dlg-actions', actions.map(a => el('button.dlg-btn' + (a.kind ? '.' + a.kind : ''), { type: 'button', on: { click: () => { const r = a.fn && a.fn(); if (r !== false) close(); } } }, a.label)));
    const content = el('div.dlg-body', [body, row]);
    const host = document.getElementById('overlay-root') || document.body;
    const box = el('div.dlg' + (wide ? '.wide' : ''), [el('div.dlg-head', [el('span.label.strong', title), el('button.dlg-x', { type: 'button', on: { click: () => close() } }, '×')]), content]);
    const wrap = el('div.dlg-wrap', { on: { click: e => { if (e.target === wrap) close(); } } }, box);
    host.appendChild(wrap);
    const ov = { close: () => { if (!closed) { closed = true; } wrap.remove(); if (LD.Main) LD.Main.removeOverlay(ov); if (onClose) onClose(); } };
    if (LD.Main && has(LD.Main, 'pushOverlay')) LD.Main.pushOverlay(ov);
    handle = { close: () => ov.close() };
    play('ui_open');
    return { close };
  },

  confirm(title, text, o) {
    if (has(LD.UI, 'confirm')) return Promise.resolve(LD.UI.confirm(title, text, o || {}));
    return new Promise(resolve => {
      let done = false;
      const fin = v => { if (!done) { done = true; resolve(v); } };
      B.dialog({ title, body: el('div.dlg-text', text), actions: [{ label: (o && o.ok ? o.ok : 'Confirmar').toUpperCase(), kind: o && o.danger ? 'danger' : 'primary', fn: () => fin(true) }, { label: 'CANCELAR', fn: () => fin(false) }], onClose: () => fin(false) });
    });
  }
};
})();
