(() => {
'use strict';
const LD = window.LD, U = LD.U, E = LD.Events, el = U.el;
LD.UI = LD.UI || {};

const LAYER_NAMES = ['Superficie', 'Cuevas someras', 'Profundidad media', 'Profundidad profunda', 'Núcleo'];
const LAYER_FLOOR = ['grass', 'cave_floor', 'deep_floor', 'abyss_floor', 'core_floor'];
const LAYER_COLORS = ['#6b7a4a', '#5a5550', '#4b5a66', '#5c4036', '#4a2f4f'];
const SHAFT_IDS = [null, 'shaft_coal', 'shaft_deep', 'shaft_abyss', 'shaft_core'];
const SHAFT_NAMES = [null, 'Pozo minero', 'Pozo profundo', 'Pozo abisal', 'Pozo del núcleo'];
const BAND_H = [16, 18, 20, 22, 24];
const WEATHER = { clear: 'Despejado', fog: 'Niebla', rain: 'Lluvia', storm: 'Tormenta' };
const CAT_ORDER = ['raw', 'ore', 'crushed', 'ingot', 'plate', 'rod', 'gear', 'wire', 'part', 'component', 'circuit', 'chemical', 'fuel', 'nuclear', 'crystal', 'organic', 'building', 'ammo', 'science', 'exotic'];
const CAT_NAMES = { raw: 'Materias', ore: 'Menas', crushed: 'Triturado', ingot: 'Lingotes', plate: 'Planchas', rod: 'Varillas', gear: 'Engranajes', wire: 'Hilo', part: 'Piezas', component: 'Componentes', circuit: 'Circuitos', chemical: 'Químicos', fuel: 'Combustible', nuclear: 'Nuclear', crystal: 'Cristales', organic: 'Orgánico', building: 'Construcción', ammo: 'Munición', science: 'Ciencia', exotic: 'Exótico' };
const ICONS = {
  clear: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
  fog: '<path d="M4 9h16M4 13h12M8 17h12"/>',
  rain: '<path d="M7 15a4 4 0 0 1-.5-8 5.5 5.5 0 0 1 10.6 1.5A3.3 3.3 0 0 1 17 15"/><path d="M9 17l-1 3M13 17l-1 3M17 17l-1 3"/>',
  storm: '<path d="M7 14a4 4 0 0 1-.5-8 5.5 5.5 0 0 1 10.6 1.5A3.3 3.3 0 0 1 17 14"/><path d="M13 12l-3 5h4l-2 4"/>',
  night: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
  wave: '<path d="M3 15c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/><path d="M12 4v6M9 7l3-3 3 3"/>',
  flask: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/><path d="M7.5 15h9"/>',
  drop: '<path d="M12 3s-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11z"/>',
  chev: '<path d="M6 9l6 6 6-6"/>',
  lock: '<rect x="6" y="11" width="12" height="9"/><path d="M9 11V8a3 3 0 0 1 6 0v3"/>',
  check: '<path d="M5 12l4 4 10-10"/>',
  layers: '<path d="M4 8l8-4 8 4-8 4z"/><path d="M4 12l8 4 8-4M4 16l8 4 8-4"/>'
};

const G = () => LD.G;
const R = () => LD.Registry;
const S = name => (LD.Sim && LD.Sim[name]) || null;
const has = (o, fn) => !!(o && typeof o[fn] === 'function');
const call = (o, fn, ...a) => has(o, fn) ? o[fn](...a) : undefined;
const svg = (name, cls) => U.svg(ICONS[name] || '', 24, 24, 'hi ' + (cls || ''));
const curL = () => { const g = G(); return g ? (g.view.layer | 0) : 0; };
const layerDef = i => (R() && R().layer(i)) || null;
const layerName = i => { const d = layerDef(i); return (d && d.name) || LAYER_NAMES[i] || ('Capa ' + i); };
const layerColor = i => { const d = R() && R().terrain(LAYER_FLOOR[i]); return (d && d.color) || LAYER_COLORS[i]; };
const shaftName = i => { const d = layerDef(i); const sid = (d && d.unlockedBy) || SHAFT_IDS[i]; const s = sid && R() && R().structure(sid); return (s && s.name) || SHAFT_NAMES[i] || 'pozo'; };
const itemDef = id => (R() && R().item(id)) || null;
const itemName = id => { const d = itemDef(id); return d ? d.name : id; };
const isFluid = id => { const F = S('Fluids'); if (has(F, 'isFluid')) return F.isFluid(id); const d = itemDef(id); return !!d && (d.cat === 'fluid' || d.cat === 'gas'); };
const icon = (id, size) => { if (has(LD.UI, 'icon')) return LD.UI.icon(id, size); if (LD.Tex && has(LD.Tex, 'icon')) return LD.Tex.icon(id, size); return el('i.ico-blank', { style: { width: size + 'px', height: size + 'px' } }); };
const tip = (node, fn) => {
  const T = LD.UI.tooltip;
  if (T && typeof T.attach === 'function') T.attach(node, fn);
  else node.addEventListener('pointerenter', () => { const c = fn(); node.title = c ? (c.textContent || String(c)) : ''; });
  return node;
};
const keycap = t => has(LD.UI, 'keycap') ? LD.UI.keycap(t) : el('kbd.key', t);

const HUD = LD.UI.HUD = {
  root: null, mounted: false, els: {}, offs: [], acc: 0, secAcc: 0,
  trayLayer: -1, showSurface: false, trayCollapsed: false, objCollapsed: false,
  chips: new Map(), fluidRows: new Map(), logNodes: [], lastMode: null, brownoutAt: -1e9,
  waveActive: {}, dirty: { tray: true, strata: true, objectives: true, research: true, fluids: true, log: true },

  mount(root) {
    HUD.unmount();
    HUD.root = root || document.getElementById('hud-root');
    if (!HUD.root) return;
    HUD.root.classList.add('hud');
    U.clear(HUD.root);
    HUD.trayLayer = -1; HUD.showSurface = false; HUD.chips.clear(); HUD.fluidRows.clear(); HUD.logNodes = [];
    for (const k in HUD.dirty) HUD.dirty[k] = true;
    HUD.build();
    HUD.subscribe();
    HUD.mounted = true;
    document.body.classList.toggle('reduced-motion', !!LD.Settings.get().reducedMotion);
    call(LD.UI.Build, 'mount', HUD.root);
    call(LD.UI.Panel, 'mount', HUD.root);
    if (has(LD.UI, 'sfxHooks')) { try { LD.UI.sfxHooks(HUD.root); } catch (e) { /* optional */ } }
    HUD.refreshAll();
  },

  unmount() {
    if (!HUD.mounted) return;
    call(LD.UI.Build, 'unmount');
    call(LD.UI.Panel, 'unmount');
    for (const off of HUD.offs) off();
    HUD.offs = [];
    if (HUD.root) { U.clear(HUD.root); HUD.root.classList.remove('hud', 'panel-open', 'pal-open'); }
    HUD.els = {}; HUD.chips.clear(); HUD.fluidRows.clear(); HUD.logNodes = [];
    HUD.mounted = false;
  },

  el(id) { return HUD.els[id] || null; },
  setPanelOpen(v) { if (HUD.root) HUD.root.classList.toggle('panel-open', !!v); },
  setPaletteOpen(v) { if (HUD.root) HUD.root.classList.toggle('pal-open', !!v); },

  /* ── DOM ── */
  build() {
    const x = HUD.els;
    HUD.root.append(
      HUD.buildTop(),
      el('#hud-left.hud-left', [HUD.buildStrata(), HUD.buildDock()]),
      HUD.buildObjectives(),
      x.log = el('#hud-log.hud-log', { 'aria-live': 'polite' }),
      HUD.buildTray()
    );
  },

  buildTop() {
    const x = HUD.els;
    const block = (id, label, cls) => el('div.top-block' + (cls ? '.' + cls : '') + (id ? '#' + id : ''), [el('span.label', label), el('div.top-val')]);
    const top = el('#hud-top.hud-top', [
      x.era = block(null, 'ERA', 'top-era'),
      x.time = block(null, 'DÍA', 'top-time'),
      x.weather = block(null, 'CLIMA', 'top-weather'),
      x.layer = block(null, 'CAPA', 'top-layer'),
      x.power = block('hud-power', 'ENERGÍA', 'top-power'),
      x.threat = block('hud-threat', 'AMENAZA', 'top-threat'),
      x.research = block('hud-research', 'INVESTIGACIÓN', 'top-research'),
      el('div.top-spacer'),
      x.sim = el('div.top-block.top-sim', [el('span.label', 'SIM'), el('div.top-val')]),
      el('div.top-btns', [
        HUD.topBtn('ENCICLOPEDIA', 'E', () => call(LD.UI.Encyclopedia, 'toggle')),
        HUD.topBtn('TECNOLOGÍAS', 'T', () => call(LD.UI.Encyclopedia, 'toggle', 'techs')),
        HUD.topBtn('ESTADÍSTICAS', 'G', () => call(LD.UI.Stats, 'toggle')),
        HUD.topBtn('PAUSA', 'ESC', () => call(LD.UI.Pause, 'toggle'), 'verm')
      ])
    ]);
    x.research.setAttribute('role', 'button');
    x.research.tabIndex = 0;
    x.research.addEventListener('click', () => { const p = HUD.researchInfo(); call(LD.UI.Encyclopedia, 'open', 'techs', p ? p.tech : undefined); });
    tip(x.power, () => HUD.powerTip());
    tip(x.threat, () => HUD.threatTip());
    tip(x.research, () => HUD.researchTip());
    tip(x.weather, () => HUD.weatherTip());
    tip(x.time, () => { const g = G(); if (!g) return null; const night = HUD.isNight(); return el('div', [el('div.tip-title', 'Día ' + g.time.day + ' · ' + U.fmtClock(g.time.dayFrac)), el('div.tip-body', night ? 'Noche: las oleadas en superficie son ×1,5 más grandes.' : 'Día: 600 s por ciclo. La noche empieza a las 13:12 del reloj.')]); });
    return top;
  },

  topBtn(text, key, fn, cls) {
    return el('button.top-btn' + (cls ? '.' + cls : ''), { type: 'button', on: { click: fn } }, [el('span', text), keycap(key)]);
  },

  buildStrata() {
    const x = HUD.els;
    x.strata = el('#hud-strata.hud-strata', [el('div.strata-title.label', 'ESTRATOS')]);
    x.strataCol = el('div.strata-col');
    x.strata.appendChild(x.strataCol);
    x.bands = [];
    return x.strata;
  },

  rebuildStrata() {
    const x = HUD.els, g = G();
    if (!x.strataCol || !g) return;
    U.clear(x.strataCol);
    x.bands = [];
    let deepest = 0, acc = 0, shaftEnd = 0;
    for (let i = 0; i < 5; i++) {
      const L = g.layers[i], unlocked = !!(L && L.unlocked);
      if (unlocked) { deepest = i; shaftEnd = acc + BAND_H[i] / 2; }
      const band = el('div.strata-band' + (unlocked ? '.unlocked' : '.locked'), { style: { height: BAND_H[i] + '%' }, data: { l: i }, on: { click: () => { if (has(LD.Main, 'switchLayer')) LD.Main.switchLayer(i); } } }, [
        el('div.band-stripe', { style: { background: layerColor(i) } }),
        el('div.band-body', [
          el('div.band-key.num', String(i + 1)),
          el('div.band-name', layerName(i).toUpperCase()),
          el('div.band-sub.num')
        ])
      ]);
      if (!unlocked) band.appendChild(svg('lock', 'band-lock'));
      tip(band, () => HUD.layerTip(i));
      x.strataCol.appendChild(band);
      x.bands.push(band);
      acc += BAND_H[i];
    }
    x.shaft = el('div.strata-shaft', { style: { height: shaftEnd + '%' } });
    x.strataCol.appendChild(x.shaft);
    x.deepest = deepest;
    HUD.refreshStrata(true);
  },

  refreshStrata(force) {
    const x = HUD.els, g = G();
    if (!x.bands || !g) return;
    const cur = curL();
    for (let i = 0; i < 5; i++) {
      const band = x.bands[i], L = g.layers[i], sub = band.querySelector('.band-sub');
      band.classList.toggle('current', i === cur);
      if (!L || !L.unlocked) { sub.textContent = 'REQ. ' + shaftName(i).toUpperCase(); continue; }
      if (i === 0) { sub.textContent = 'LIBRE'; continue; }
      const st = call(LD.World, 'regionStats', i);
      if (st && st.totalChunks) sub.textContent = 'EXCAVADO ' + Math.round(100 * st.excavatedChunks / st.totalChunks) + '%';
      else { const n = U.count(L.excavated || {}); sub.textContent = n ? n + ' PARCELAS' : '—'; }
    }
  },

  layerTip(i) {
    const g = G(), d = layerDef(i), L = g && g.layers[i];
    const rows = [el('div.tip-title', layerName(i))];
    if (d && d.desc) rows.push(el('div.tip-body', d.desc));
    if (L && L.unlocked) {
      const D = S('Defense');
      const th = has(D, 'threat') ? D.threat(i) : L.threat;
      rows.push(el('div.tip-row', [el('span.label', 'AMENAZA'), el('span.num', U.fmt(th || 0, 1))]));
      const nw = has(D, 'nextWave') ? D.nextWave(i) : null;
      if (nw) rows.push(el('div.tip-row', [el('span.label', 'OLEADA'), el('span.num', 'en ' + U.fmtTime(nw.in) + ' · ' + nw.size + ' enemigos')]));
      if (i > 0) { const st = call(LD.World, 'regionStats', i); if (st) rows.push(el('div.tip-row', [el('span.label', 'PARCELAS'), el('span.num', st.excavatedChunks + ' / ' + st.totalChunks)])); }
      if (d && d.borerTier !== undefined) rows.push(el('div.tip-row', [el('span.label', 'TUNELADORA'), el('span.num', 'T' + d.borerTier + '+')]));
      rows.push(el('div.tip-hint', 'Clic o tecla ' + (i + 1) + ' para cambiar de estrato'));
    } else {
      rows.push(el('div.tip-row', [el('span.label', 'BLOQUEADA'), el('span', 'Construye «' + shaftName(i) + '» en la superficie')]));
      if (d && d.enemies && d.enemies.length && R()) rows.push(el('div.tip-row', [el('span.label', 'FAUNA'), el('span', d.enemies.map(e => { const ed = R().enemy(e); return ed ? ed.name : e; }).join(', '))]));
    }
    return el('div', rows);
  },

  buildDock() {
    const x = HUD.els;
    const B = () => LD.UI.Build;
    const btn = (mode, text, key, fn) => el('button.dock-btn', { type: 'button', data: { mode }, on: { click: fn } }, [el('span.dock-text', text), keycap(key)]);
    x.dock = el('#hud-dock.hud-dock', [
      btn('build', 'CONSTRUIR', 'B', () => call(B(), 'toggle')),
      btn('blueprints', 'PLANOS', 'C·V', () => call(B(), 'openLibrary')),
      btn('hand', 'MANO', 'H', () => call(B(), 'setMode', B() && B().mode === 'hand' ? 'normal' : 'hand')),
      btn('dismantle', 'DESMONTAR', 'X', () => call(B(), 'setMode', B() && B().mode === 'dismantle' ? 'normal' : 'dismantle'))
    ]);
    const tips = { build: 'Abre la paleta de construcción. Arrastra para trazar cintas, cables y tuberías.', blueprints: 'Biblioteca de planos. C selecciona una zona para copiar, V pega el último plano.', hand: 'Recolecta a mano en casillas naturales (1 objeto / 1,2 s).', dismantle: 'Desmonta estructuras: reembolso del 65 % (100 % en construcción).' };
    for (const b of x.dock.children) tip(b, () => el('div', [el('div.tip-title', b.querySelector('.dock-text').textContent), el('div.tip-body', tips[b.dataset.mode])]));
    return x.dock;
  },

  refreshDock() {
    const x = HUD.els, B = LD.UI.Build;
    const mode = (B && B.mode) || 'normal';
    const palOpen = !!(B && B.paletteOpen);
    if (mode === HUD.lastMode && palOpen === HUD.lastPal) return;
    HUD.lastMode = mode; HUD.lastPal = palOpen;
    for (const b of x.dock.children) {
      const m = b.dataset.mode;
      b.classList.toggle('active', m === mode || (m === 'build' && palOpen) || (m === 'blueprints' && (mode === 'select' || mode === 'paste')));
    }
  },

  buildObjectives() {
    const x = HUD.els;
    x.objectives = el('#hud-objectives.hud-objectives', [
      el('button.obj-head', { type: 'button', on: { click: () => { HUD.objCollapsed = !HUD.objCollapsed; x.objectives.classList.toggle('collapsed', HUD.objCollapsed); } } }, [
        el('span.label.strong', 'OBJETIVOS'), x.objCount = el('span.obj-count.num'), svg('chev', 'obj-chev')
      ]),
      x.objList = el('ul.obj-list')
    ]);
    return x.objectives;
  },

  objectiveText(o) {
    if (!o) return '';
    if (typeof o === 'string') {
      const C = LD.Content || {}, R_ = R();
      const src = (C.objectives && (Array.isArray(C.objectives) ? C.objectives.find(q => q.id === o) : C.objectives[o])) || (R_ && R_.objectives && R_.objectives.get && R_.objectives.get(o)) || null;
      return src ? (src.text || src.name || src.title || o) : o;
    }
    return o.text || o.name || o.title || o.desc || o.id || '';
  },
  objectiveId(o) { return typeof o === 'string' ? o : (o && (o.id || o.text)) || ''; },
  objectiveMap() { const Sm = LD.Sim; if (!has(Sm, 'objectives')) return null; const m = new Map(); try { for (const o of Sm.objectives() || []) m.set(o.id, o); } catch (e) { return null; } return m; },

  rebuildObjectives() {
    const x = HUD.els, g = G();
    if (!x.objList || !g) return;
    const cur = (g.objectives && g.objectives.current) || [];
    const done = (g.objectives && g.objectives.done) || {};
    U.clear(x.objList);
    let pending = 0;
    const map = HUD.objectiveMap();
    for (const o of cur) {
      const id = HUD.objectiveId(o), isDone = !!(done[id] || (o && o.done));
      const src = map && map.get(id);
      if (!isDone) pending++;
      const text = (o && typeof o === 'object' && (o.text || o.title)) || (src && src.title) || HUD.objectiveText(o);
      const hint = (o && typeof o === 'object' && (o.hint || o.desc)) || (src && src.desc) || '';
      const li = el('li.obj-item' + (isDone ? '.done' : ''), { data: { id } }, [el('span.obj-box', isDone ? svg('check') : null), el('span.obj-text', text)]);
      if (hint) tip(li, () => el('div', [el('div.tip-title', text), el('div.tip-body', hint)]));
      x.objList.appendChild(li);
    }
    x.objCount.textContent = cur.length ? (cur.length - pending) + '/' + cur.length : '';
    x.objectives.classList.toggle('empty', !cur.length);
    HUD.objSig = cur.map(o => HUD.objectiveId(o) + (done[HUD.objectiveId(o)] ? '+' : '')).join('|');
  },

  buildTray() {
    const x = HUD.els;
    x.tray = el('#hud-tray.hud-tray', [
      el('div.tray-head', [
        x.trayTitle = el('span.label.strong'),
        x.traySurface = el('button.tray-toggle', { type: 'button', on: { click: () => { HUD.showSurface = !HUD.showSurface; HUD.dirty.tray = true; HUD.dirty.fluids = true; } } }, 'VER SUPERFICIE'),
        el('span.tray-spacer'),
        x.trayCap = el('span.tray-cap.num'),
        el('button.tray-toggle.tray-collapse', { type: 'button', on: { click: () => { HUD.trayCollapsed = !HUD.trayCollapsed; x.tray.classList.toggle('collapsed', HUD.trayCollapsed); } } }, [svg('chev')])
      ]),
      x.trayBody = el('div.tray-body'),
      x.trayFluids = el('div.tray-fluids')
    ]);
    tip(x.traySurface, () => el('div', [el('div.tip-body', 'La construcción paga desde el inventario de cada estrato. La investigación paga desde la superficie.')]));
    return x.tray;
  },

  trayLayerIdx() { const L = curL(); return (L > 0 && HUD.showSurface) ? 0 : L; },

  rebuildTray() {
    const x = HUD.els, g = G();
    if (!x.trayBody || !g) return;
    const L = HUD.trayLayerIdx();
    HUD.trayLayer = L;
    x.trayTitle.textContent = 'INVENTARIO · ' + layerName(L).toUpperCase();
    x.traySurface.hidden = curL() === 0;
    x.traySurface.classList.toggle('active', HUD.showSurface && curL() > 0);
    U.clear(x.trayBody);
    HUD.chips.clear();
    const disc = g.discovered.items || {}, inv = g.inv[L] || {};
    const groups = new Map();
    const rates = (S('Economy') && S('Economy').rates && S('Economy').rates[L]) || {};
    const ids = new Set(L === 0 ? Object.keys(disc) : []);
    for (const id in inv) if (inv[id] > 0) ids.add(id);
    if (L > 0) for (const id in rates) if (disc[id] && ((rates[id].plus || 0) > 0 || (rates[id].minus || 0) > 0)) ids.add(id);
    for (const id of ids) {
      if (isFluid(id)) continue;
      const d = itemDef(id); if (!d) continue;
      if (!groups.has(d.cat)) groups.set(d.cat, []);
      groups.get(d.cat).push(d);
    }
    const cats = Array.from(groups.keys()).sort((a, b) => (CAT_ORDER.indexOf(a) + 1 || 99) - (CAT_ORDER.indexOf(b) + 1 || 99));
    if (!cats.length) x.trayBody.appendChild(el('div.tray-empty.label', 'SIN OBJETOS · RECOLECTA CON LA MANO (H)'));
    for (const cat of cats) {
      const list = groups.get(cat).sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
      const grp = el('div.tray-group', [el('span.tray-group-label.label', (CAT_NAMES[cat] || cat).toUpperCase())]);
      for (const d of list) {
        const wrap = el('div.tray-item', { data: { item: d.id } });
        tip(wrap, () => HUD.itemTip(d.id, L));
        wrap.addEventListener('click', () => call(LD.UI.Encyclopedia, 'open', 'items', d.id));
        grp.appendChild(wrap);
        HUD.chips.set(d.id, { wrap, sig: null });
      }
      x.trayBody.appendChild(grp);
    }
    HUD.refreshTray(true);
  },

  chipSig(n, rate, cap) { return Math.floor(n) + '|' + (rate ? rate.toFixed(1) : 0) + '|' + (cap && n >= cap ? 'F' : cap && n >= cap * 0.9 ? 'H' : '') + '|' + (cap || 0); },

  refreshTray(force) {
    const g = G(); if (!g || !HUD.chips.size) return;
    const L = HUD.trayLayer, inv = g.inv[L] || {}, Eco = S('Economy');
    const rates = (Eco && Eco.rates && Eco.rates[L]) || {};
    let total = 0;
    for (const [id, c] of HUD.chips) {
      const n = inv[id] || 0, r = rates[id], rate = r ? (r.plus || 0) - (r.minus || 0) : 0;
      const cap = has(Eco, 'cap') ? Eco.cap(L, id) : (g.caps ? g.caps.base : 0);
      total += n;
      const sig = HUD.chipSig(n, rate, cap);
      if (sig === c.sig && !force) continue;
      c.sig = sig;
      if (c.chip && typeof c.chip.set === 'function') c.chip.set(n, { rate: r ? rate : undefined, cap, tip: false });
      else { U.clear(c.wrap); c.chip = HUD.makeChip(id, n, r ? rate : undefined, cap); c.wrap.appendChild(c.chip); }
      c.wrap.classList.toggle('full', cap > 0 && n >= cap);
      c.wrap.classList.toggle('empty', n <= 0);
    }
    HUD.els.trayCap.textContent = 'CAP/OBJ ' + U.fmt(has(Eco, 'cap') ? Eco.cap(L, 'stone') : ((g.caps && g.caps.base) || 0), 0);
  },

  makeChip(id, n, rate, cap) {
    if (has(LD.UI, 'itemChip')) { try { const c = LD.UI.itemChip(id, n, { rate, cap, tip: false }); if (c instanceof Node) return c; } catch (e) { /* fall through */ } }
    return el('div.chip', [icon(id, 20), el('span.chip-n.num', U.fmt(n, 0)), rate ? el('span.chip-rate.num' + (rate > 0 ? '.ok' : '.bad'), U.fmtRate(rate, 1)) : null]);
  },

  itemTip(id, L) {
    const d = itemDef(id), g = G(), R_ = R();
    if (!d || !g) return null;
    const Eco = S('Economy');
    const n = (g.inv[L] || {})[id] || 0, cap = has(Eco, 'cap') ? Eco.cap(L, id) : 0;
    const r = Eco && Eco.rates && Eco.rates[L] && Eco.rates[L][id];
    const rows = [el('div.tip-title', [d.name, el('span.tier-chip', 'T' + d.tier)]), el('div.tip-body', d.desc || '')];
    rows.push(el('div.tip-row', [el('span.label', 'EXISTENCIAS'), el('span.num', U.fmt(n, 0) + (cap ? ' / ' + U.fmt(cap, 0) : ''))]));
    if (r) rows.push(el('div.tip-row', [el('span.label', 'FLUJO'), el('span.num', [el('span.ok', '+' + U.fmt(r.plus || 0, 2)), ' ', el('span.bad', '−' + U.fmt(r.minus || 0, 2)), ' /s'])]));
    if (d.fuel) rows.push(el('div.tip-row', [el('span.label', 'COMBUSTIBLE'), el('span.num', U.fmt(d.fuel, 1) + ' MJ')]));
    if (R_) {
      const names = arr => arr.slice(0, 5).map(x => x.name || x.id).join(', ') + (arr.length > 5 ? ' …' : '');
      const prod = R_.producers(id), cons = R_.consumers(id);
      if (prod.length) rows.push(el('div.tip-row', [el('span.label', 'PRODUCEN'), el('span', names(prod))]));
      if (cons.length) rows.push(el('div.tip-row', [el('span.label', 'CONSUMEN'), el('span', names(cons))]));
      const where = [];
      for (const Ld of R_.layers || []) for (const dep of (Ld.deposits || [])) if (dep.res === id) { where.push(layerName(Ld.idx) + ' (h' + dep.hardness + ')'); break; }
      for (const t of R_.terrains.values()) if (t.natural && t.natural.item === id) where.push(t.name + ' (mano)');
      if (where.length) rows.push(el('div.tip-row', [el('span.label', 'ENCONTRAR EN'), el('span', where.join(', '))]));
    }
    rows.push(el('div.tip-hint', 'Clic: ficha en la enciclopedia'));
    return el('div', rows);
  },

  rebuildFluids() {
    const x = HUD.els, g = G();
    if (!x.trayFluids || !g) return;
    const F = S('Fluids'), L = HUD.trayLayerIdx();
    const list = has(F, 'summary') ? (F.summary(L) || []) : [];
    U.clear(x.trayFluids); HUD.fluidRows.clear();
    if (!list.length) { x.trayFluids.classList.add('empty'); HUD.fluidSig = ''; return; }
    x.trayFluids.classList.remove('empty');
    x.trayFluids.appendChild(el('span.label', 'FLUIDOS'));
    for (const f of list) {
      const key = f.fluid + '@' + (f.netId === undefined ? '' : f.netId);
      const d = itemDef(f.fluid);
      const row = el('div.fluid-chip', { data: { fluid: f.fluid } }, [
        svg('drop', 'fluid-drop'), el('span.fluid-name', d ? d.name : f.fluid), el('span.fluid-amt.num'), el('span.fluid-bar', [el('i')])
      ]);
      row.querySelector('.fluid-drop').style.color = (d && d.color) || 'var(--info)';
      tip(row, () => el('div', [el('div.tip-title', d ? d.name : f.fluid), el('div.tip-body', d ? d.desc : ''), el('div.tip-row', [el('span.label', 'RED'), el('span.num', String(f.netId === undefined ? '–' : f.netId))]), el('div.tip-hint', 'Los fluidos viven en tanques y tuberías, nunca en el inventario.')]));
      x.trayFluids.appendChild(row);
      HUD.fluidRows.set(key, row);
    }
    HUD.fluidSig = list.map(f => f.fluid + '@' + f.netId).join('|');
    HUD.refreshFluids(list);
  },

  refreshFluids(list) {
    const F = S('Fluids'), L = HUD.trayLayerIdx();
    if (!list) list = has(F, 'summary') ? (F.summary(L) || []) : [];
    const sig = list.map(f => f.fluid + '@' + f.netId).join('|');
    if (sig !== HUD.fluidSig) { HUD.rebuildFluids(); return; }
    for (const f of list) {
      const row = HUD.fluidRows.get(f.fluid + '@' + (f.netId === undefined ? '' : f.netId)); if (!row) continue;
      row.querySelector('.fluid-amt').textContent = U.fmt(f.amt, 0) + (f.cap ? ' / ' + U.fmt(f.cap, 0) : '');
      row.querySelector('.fluid-bar i').style.width = (f.cap ? Math.round(100 * U.clamp(f.amt / f.cap)) : 0) + '%';
      row.classList.toggle('full', f.cap > 0 && f.amt >= f.cap * 0.98);
    }
  },

  /* ── top bar refresh ── */
  isNight() { const N = S('Nature'); if (has(N, 'isNight')) return N.isNight(); const g = G(); return !!g && g.time.dayFrac >= 0.55; },

  refreshTop() {
    const x = HUD.els, g = G(); if (!g) return;
    const L = curL();
    HUD.setVal(x.era, U.eraName(g.meta.era || 0));
    const night = HUD.isNight();
    HUD.setVal(x.time, [el('span.num', String(g.time.day)), el('span.sep', '·'), el('span.num', U.fmtClock(g.time.dayFrac)), night ? svg('night', 'ico-night') : null], 'day' + g.time.day + U.fmtClock(g.time.dayFrac) + night);
    const Ev = S('Events');
    if (L === 0 && has(Ev, 'weather')) {
      const w = Ev.weather(0) || { kind: 'clear' };
      x.weather.hidden = false;
      HUD.setVal(x.weather, [svg(w.kind || 'clear', 'ico-weather'), el('span', WEATHER[w.kind] || w.kind)], 'w' + w.kind);
      x.weather.classList.toggle('active', w.kind !== 'clear');
    } else x.weather.hidden = true;
    HUD.setVal(x.layer, layerName(L), 'L' + L);
    HUD.refreshPower(L);
    HUD.refreshThreat(L);
    HUD.refreshResearch();
    const Sim = LD.Sim || {};
    const parts = [];
    if (Sim.paused) parts.push(el('span.bad.blink', 'DETENIDA'));
    else parts.push(el('span', 'EN CURSO' + (Sim.speed && Sim.speed !== 1 ? ' ×' + Sim.speed : '')));
    if (LD.Settings.get().showFps && LD.Main) parts.push(el('span.num.dim', Math.round(LD.Main.fps || 0) + ' FPS'));
    HUD.setVal(x.sim, parts, (Sim.paused ? 'P' : 'R') + (Sim.speed || 1) + (LD.Settings.get().showFps ? Math.round(LD.Main.fps || 0) : ''));
    x.sim.classList.toggle('paused', !!Sim.paused);
  },

  setVal(block, content, sig) {
    if (!block) return;
    const v = block.querySelector('.top-val');
    const s = sig === undefined ? (typeof content === 'string' ? content : null) : sig;
    if (s !== null && block._sig === s) return;
    block._sig = s;
    U.clear(v);
    if (typeof content === 'string') v.textContent = content; else v.append(...[].concat(content).filter(Boolean));
  },

  powerSummary(L) { const P = S('Power'); return has(P, 'summary') ? (P.summary(L) || null) : null; },

  refreshPower(L) {
    const x = HUD.els, s = HUD.powerSummary(L);
    if (!s) { HUD.setVal(x.power, 'SIN RED', 'none'); x.power.classList.remove('warn', 'bad'); return; }
    const ratio = s.use > 0 ? U.clamp(s.ratio === undefined ? 1 : s.ratio) : 1;
    const brown = (performance.now() - HUD.brownoutAt < 3000) || (s.use > 0 && ratio < 0.999);
    const sig = U.fmtW(s.gen) + U.fmtW(s.use) + Math.round(ratio * 100) + s.grids + (brown ? 'B' : '') + (s.cap ? Math.round(100 * s.stored / s.cap) : '');
    if (x.power._sig !== sig) {
      HUD.setVal(x.power, [
        el('span.num.ok', U.fmtW(s.gen)), el('span.sep', '▸'), el('span.num', U.fmtW(s.use)),
        el('span.ratio-bar', [el('i', { style: { width: Math.round(ratio * 100) + '%' } })]),
        s.cap > 0 ? el('span.num.dim', U.fmtPct(s.stored / s.cap) + ' ALM') : null,
        el('span.dim.num', (s.grids || 0) + (s.grids === 1 ? ' RED' : ' REDES')),
        brown ? el('span.bad.blink', 'APAGÓN') : null
      ], sig);
    }
    x.power.classList.toggle('bad', brown);
    x.power.classList.toggle('warn', !brown && s.use > 0 && s.gen < s.use * 1.1);
  },

  powerTip() {
    const L = curL(), s = HUD.powerSummary(L);
    if (!s) return el('div', [el('div.tip-title', 'Energía'), el('div.tip-body', 'No hay red eléctrica en este estrato. Construye un generador y cables (o ejes) hasta los consumidores.')]);
    const rows = [el('div.tip-title', 'Energía · ' + layerName(L)), el('div.tip-row', [el('span.label', 'GENERACIÓN'), el('span.num.ok', U.fmtW(s.gen))]), el('div.tip-row', [el('span.label', 'CONSUMO'), el('span.num', U.fmtW(s.use))]), el('div.tip-row', [el('span.label', 'SATISFACCIÓN'), el('span.num', U.fmtPct(s.use > 0 ? U.clamp(s.ratio === undefined ? 1 : s.ratio) : 1))])];
    if (s.cap > 0) rows.push(el('div.tip-row', [el('span.label', 'ALMACENADO'), el('span.num', U.fmtJ(s.stored) + ' / ' + U.fmtJ(s.cap))]));
    rows.push(el('div.tip-row', [el('span.label', 'REDES'), el('span.num', String(s.grids || 0))]));
    const list = (arr, sign) => arr.slice(0, 6).map(p => el('div.tip-row.sub', [el('span', (R() ? R().structureName(p.id) : p.id) + ' ×' + p.count), el('span.num', sign + U.fmtW(p.gen !== undefined ? p.gen : p.use))]));
    if (s.producers && s.producers.length) rows.push(el('div.tip-sub.label', 'PRODUCTORES'), ...list(s.producers, '+'));
    if (s.consumers && s.consumers.length) rows.push(el('div.tip-sub.label', 'CONSUMIDORES'), ...list(s.consumers, '−'));
    const P = S('Power'); if (has(P, 'energyHandled')) rows.push(el('div.tip-hint', 'Energía manejada (media): ' + U.fmtW(P.energyHandled(L)) + ' — impulsa la amenaza.'));
    return el('div', rows);
  },

  refreshThreat(L) {
    const x = HUD.els, D = S('Defense'), g = G();
    const nw = has(D, 'nextWave') ? D.nextWave(L) : null;
    const diff = LD.State.difficulty();
    const active = !!HUD.waveActive[L] || !!(nw && nw.active) || (has(D, 'enemiesIn') && D.enemiesIn(L).length > 0);
    const th = has(D, 'threat') ? D.threat(L) : (g.layers[L] ? g.layers[L].threat : 0);
    if (diff && diff.waves === false) { HUD.setVal(x.threat, 'PACÍFICO', 'peace'); x.threat.classList.remove('warn', 'bad', 'active'); return; }
    if (active) {
      const n = has(D, 'enemiesIn') ? D.enemiesIn(L).length : 0;
      HUD.setVal(x.threat, [svg('wave', 'ico-wave'), el('span.bad', 'OLEADA'), el('span.num', n + ' enemigos')], 'A' + n);
      x.threat.classList.add('active', 'bad'); x.threat.classList.remove('warn');
      return;
    }
    if (!nw) { HUD.setVal(x.threat, [el('span.num', U.fmt(th || 0, 1)), el('span.dim', 'sin oleadas')], 'N' + U.fmt(th || 0, 1)); x.threat.classList.remove('warn', 'bad', 'active'); return; }
    const secs = Math.max(0, nw.in);
    const soon = secs < 60;
    const boss = nw.boss !== undefined ? !!nw.boss : (nw.no !== undefined && (((nw.no | 0) - 1) % 5 === 4));
    HUD.setVal(x.threat, [el('span.num', U.fmt(th || 0, 1)), el('span.sep', '·'), el('span.num.countdown', U.fmtTime(secs)), el('span.dim.num', '×' + (nw.size || 0)), boss ? el('span.warn', 'JEFE') : null], 'T' + Math.floor(secs) + '|' + nw.size + '|' + U.fmt(th || 0, 1) + (boss ? 'B' : ''));
    x.threat.classList.toggle('warn', soon);
    x.threat.classList.remove('bad', 'active');
  },

  threatTip() {
    const L = curL(), D = S('Defense'), g = G(), d = layerDef(L);
    const rows = [el('div.tip-title', 'Amenaza · ' + layerName(L))];
    const th = has(D, 'threat') ? D.threat(L) : (g && g.layers[L] ? g.layers[L].threat : 0);
    rows.push(el('div.tip-row', [el('span.label', 'NIVEL'), el('span.num', U.fmt(th || 0, 2))]));
    const nw = has(D, 'nextWave') ? D.nextWave(L) : null;
    if (nw) { rows.push(el('div.tip-row', [el('span.label', 'PRÓXIMA OLEADA'), el('span.num', U.fmtTime(nw.in))])); rows.push(el('div.tip-row', [el('span.label', 'TAMAÑO'), el('span.num', String(nw.size) + (nw.no !== undefined ? ' · nº ' + nw.no : '') + (nw.boss ? ' · JEFE' : ''))])); }
    if (d && d.enemies && R()) rows.push(el('div.tip-row', [el('span.label', 'FAUNA'), el('span', d.enemies.map(e => { const ed = R().enemy(e); return ed ? ed.name : e; }).join(', '))]));
    rows.push(el('div.tip-body', 'La amenaza crece sobre todo con la energía manejada en el estrato; también con el tiempo y el número de estructuras.' + (L === 0 ? ' De noche las oleadas son ×1,5.' : '')));
    return el('div', rows);
  },

  researchInfo() { const Rs = S('Research'); return has(Rs, 'progress') ? (Rs.progress() || null) : null; },

  refreshResearch() {
    const x = HUD.els, p = HUD.researchInfo(), R_ = R();
    if (!p) {
      const g = G(), q = g && g.research.queue && g.research.queue.length;
      HUD.setVal(x.research, [el('span.dim', q ? 'EN COLA: ' + q : 'NADA EN CURSO'), el('span.dim', '(T)')], 'idle' + (q || 0));
      x.research.classList.remove('active'); return;
    }
    const t = R_ && R_.tech(p.tech), name = t ? t.name : p.tech;
    const frac = p.total > 0 ? 1 - p.left / p.total : 0;
    const etaS = p.eta !== undefined ? p.eta : (p.speed > 0 ? p.left / p.speed : Infinity);
    const eta = isFinite(etaS) ? U.fmtTime(etaS) : 'SIN LABORATORIO';
    const sig = name + '|' + Math.round(frac * 200) + '|' + eta;
    if (x.research._sig !== sig) HUD.setVal(x.research, [el('span.res-name', name), el('span.ratio-bar.res-bar', [el('i', { style: { width: Math.round(frac * 100) + '%' } })]), el('span.num' + (p.speed > 0 ? '' : '.warn'), eta)], sig);
    x.research.classList.add('active');
    x.research.classList.toggle('warn', !(p.speed > 0));
  },

  researchTip() {
    const p = HUD.researchInfo(), R_ = R(), g = G();
    if (!p) return el('div', [el('div.tip-title', 'Investigación'), el('div.tip-body', 'Nada en curso. Abre TECNOLOGÍAS (T) y elige una tecnología; la ciencia se paga desde la superficie.')]);
    const t = R_ && R_.tech(p.tech);
    const rows = [el('div.tip-title', t ? t.name : p.tech), el('div.tip-body', t ? t.desc : '')];
    rows.push(el('div.tip-row', [el('span.label', 'RESTANTE'), el('span.num', U.fmtTime(p.left) + ' de trabajo')]));
    rows.push(el('div.tip-row', [el('span.label', 'LABORATORIOS'), el('span.num', p.speed > 0 ? '×' + U.fmt(p.speed, 1) : 'ninguno activo')]));
    if (g && g.research.queue && g.research.queue.length) rows.push(el('div.tip-row', [el('span.label', 'COLA'), el('span', g.research.queue.map(id => (R_ && R_.tech(id)) ? R_.tech(id).name : id).join(' → '))]));
    rows.push(el('div.tip-hint', 'Clic: abrir el árbol tecnológico'));
    return el('div', rows);
  },

  weatherTip() {
    const Ev = S('Events'), w = has(Ev, 'weather') ? Ev.weather(0) : null;
    const g = G(); if (!w || !g) return null;
    const eff = { clear: 'Sin efectos.', fog: 'Ambiente ×0,8; alcance de torretas −1.', rain: 'Pozos y bombas ×1,5; solar ×0,3.', storm: 'Molinos ×1,6; solar ×0,3; desgaste leve en molinos.' };
    const rows = [el('div.tip-title', WEATHER[w.kind] || w.kind), el('div.tip-body', eff[w.kind] || '')];
    if (w.until) rows.push(el('div.tip-row', [el('span.label', 'CAMBIA EN'), el('span.num', U.fmtTime(Math.max(0, w.until - g.time.t)))]));
    if (w.next) rows.push(el('div.tip-row', [el('span.label', 'SIGUIENTE'), el('span', WEATHER[w.next.kind || w.next] || String(w.next.kind || w.next))]));
    return el('div', rows);
  },

  /* ── log ── */
  pushLog(entry) {
    const x = HUD.els; if (!x.log) return;
    const node = el('div.log-line.' + (entry.kind || 'info'), { data: { t: String(performance.now()) } }, entry.text);
    x.log.appendChild(node);
    HUD.logNodes.push(node);
    while (HUD.logNodes.length > 3) HUD.logNodes.shift().remove();
  },

  refreshLog() {
    const now = performance.now();
    for (const n of HUD.logNodes) {
      const age = (now - (+n.dataset.t)) / 1000;
      n.style.opacity = age < 6 ? 1 : age > 14 ? 0 : (1 - (age - 6) / 8).toFixed(2);
    }
  },

  /* ── events ── */
  subscribe() {
    const on = (name, fn) => HUD.offs.push(E.on(name, fn));
    on('layer:changed', () => { HUD.dirty.tray = true; HUD.dirty.fluids = true; HUD.refreshStrata(true); HUD.refreshTop(); });
    on('layer:unlocked', () => { HUD.dirty.strata = true; });
    on('chunk:excavated', () => HUD.refreshStrata(true));
    on('item:discovered', () => { HUD.dirty.tray = true; });
    on('inv:changed', p => { if (p && p.layer === HUD.trayLayer && p.item && !HUD.chips.has(p.item) && !isFluid(p.item)) HUD.dirty.tray = true; });
    on('tech:started', () => { HUD.dirty.research = true; });
    on('tech:researched', () => { HUD.dirty.research = true; HUD.dirty.tray = true; });
    on('objective:done', () => { HUD.dirty.objectives = true; });
    on('tutorial:step', () => { HUD.dirty.objectives = true; });
    on('log', p => HUD.pushLog(p));
    on('wave:started', p => { if (p) HUD.waveActive[p.layer] = true; });
    on('wave:ended', p => { if (p) HUD.waveActive[p.layer] = false; });
    on('power:brownout', p => { if (!p || p.layer === undefined || p.layer === curL()) { HUD.brownoutAt = performance.now(); if (LD.Audio && LD.Audio.play) LD.Audio.play('brownout'); } });
    on('settings:changed', s => { document.body.classList.toggle('reduced-motion', !!s.reducedMotion); });
    on('game:new', () => HUD.refreshAll());
    on('game:loaded', () => HUD.refreshAll());
    on('structure:selected', uid => HUD.setPanelOpen(!!uid));
  },

  refreshAll() {
    if (!HUD.mounted || !G()) return;
    HUD.rebuildStrata();
    HUD.rebuildTray();
    HUD.rebuildFluids();
    HUD.rebuildObjectives();
    HUD.refreshTop();
    HUD.refreshDock();
    for (const k in HUD.dirty) HUD.dirty[k] = false;
    const g = G();
    for (const n of HUD.logNodes) n.remove(); HUD.logNodes = [];
    for (const e of (g.log || []).slice(-3)) HUD.pushLog(e);
  },

  update(dt) {
    if (!HUD.mounted || !G()) return;
    call(LD.UI.Build, 'update', dt);
    HUD.acc += dt;
    if (HUD.acc < 0.1) return;
    HUD.acc = 0;
    const d = HUD.dirty;
    if (d.strata) { d.strata = false; HUD.rebuildStrata(); }
    if (d.tray || HUD.trayLayer !== HUD.trayLayerIdx()) { d.tray = false; HUD.rebuildTray(); } else HUD.refreshTray(false);
    if (d.fluids) { d.fluids = false; HUD.rebuildFluids(); } else HUD.refreshFluids();
    if (d.objectives) { d.objectives = false; HUD.rebuildObjectives(); }
    d.research = false;
    HUD.refreshTop();
    HUD.refreshDock();
    HUD.refreshLog();
    HUD.secAcc += 0.1;
    if (HUD.secAcc >= 1) {
      HUD.secAcc = 0;
      HUD.refreshStrata(false);
      const g = G(), cur = (g.objectives && g.objectives.current) || [], done = (g.objectives && g.objectives.done) || {};
      const sig = cur.map(o => HUD.objectiveId(o) + (done[HUD.objectiveId(o)] ? '+' : '')).join('|');
      if (sig !== HUD.objSig) HUD.rebuildObjectives();
    }
  }
};
})();
