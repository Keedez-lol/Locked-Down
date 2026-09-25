(() => {
'use strict';
const LD = window.LD, U = LD.U, E = LD.Events, el = U.el;
LD.UI = LD.UI || {};

const STATES = {
  building: ['EN CONSTRUCCIÓN', 'info'], idle: ['INACTIVO', 'dim'], working: ['EN MARCHA', 'ok'], no_power: ['SIN ENERGÍA', 'warn'],
  no_input: ['SIN MATERIALES', 'warn'], output_full: ['SALIDA LLENA', 'warn'], no_fuel: ['SIN COMBUSTIBLE', 'warn'], no_link: ['SIN CONEXIÓN', 'warn'],
  no_fluid: ['SIN FLUIDO', 'warn'], broken: ['AVERIADO', 'bad'], paused: ['EN PAUSA', 'dim']
};
const STATE_HINT = {
  no_power: 'La red no cubre la demanda o no hay cable adyacente.', no_input: 'Faltan los materiales de la receta en este estrato.', output_full: 'El inventario del estrato ha llegado a su tope; amplía el almacén.',
  no_fuel: 'Sin combustible en el inventario del estrato (o en la red de tuberías).', no_link: 'Sin conexión al almacén: coloca una cinta adyacente hasta el almacén central o el elevador.',
  no_fluid: 'No hay fluido de entrada en la red de tuberías conectada.', broken: 'Integridad a cero. Repara para volver a producir.', paused: 'Pausada manualmente.'
};
const MODE_NAMES = { up: 'Subir', down: 'Bajar', keep: 'Mantener' };
const TIER_COLORS = ['#8f8b82', '#b08d57', '#7f8ea3', '#c9a227', '#6fa8dc', '#8fb87a', '#c9603b', '#b28cff'];
const LAYER_NAMES = ['Superficie', 'Cuevas someras', 'Profundidad media', 'Profundidad profunda', 'Núcleo'];
const tierColors = () => (LD.Sprites && LD.Sprites.TIER_COLORS) || TIER_COLORS;

const G = () => LD.G;
const R = () => LD.Registry;
const S = name => (LD.Sim && LD.Sim[name]) || null;
const W = () => LD.World || null;
const Rn = () => LD.Render || null;
const has = (o, fn) => !!(o && typeof o[fn] === 'function');
const call = (o, fn, ...a) => has(o, fn) ? o[fn](...a) : undefined;
const sdef = id => (R() && R().structure(id)) || null;
const itemName = id => (R() ? R().itemName(id) : id);
const layerName = i => { const d = R() && R().layer(i); return (d && d.name) || LAYER_NAMES[i] || ('Capa ' + i); };
const toast = (text, kind, ms) => { if (has(LD.UI, 'toast')) LD.UI.toast(text, kind, ms); else E.emit('toast', { text, kind }); };
const play = name => { if (LD.Audio && has(LD.Audio, 'play')) LD.Audio.play(name); };
const tip = (node, fn) => { const T = LD.UI.tooltip; if (T && typeof T.attach === 'function') T.attach(node, fn); else node.addEventListener('pointerenter', () => { const c = fn(); node.title = c ? (c.textContent || String(c)) : ''; }); return node; };
const icon = (id, size) => has(LD.UI, 'icon') ? LD.UI.icon(id, size) : (LD.Tex && has(LD.Tex, 'icon') ? LD.Tex.icon(id, size) : el('i.ico-blank'));
const thumb = (id, size) => { if (has(LD.UI, 'structThumb')) { try { const c = LD.UI.structThumb(id, size); if (c) return c; } catch (e) { /* optional */ } } const d = sdef(id); return el('div.thumb-blank', { style: { width: size + 'px', height: size + 'px', background: tierColors()[(d && d.tier) || 0] } }); };
const count = (L, id) => { const Eco = S('Economy'); if (has(Eco, 'count')) return Eco.count(L, id); const g = G(); return (g && g.inv[L] && g.inv[L][id]) || 0; };
const isFluid = id => { const F = S('Fluids'); if (has(F, 'isFluid')) return F.isFluid(id); const d = R() && R().item(id); return !!d && (d.cat === 'fluid' || d.cat === 'gas'); };
const chip = (id, n) => { if (has(LD.UI, 'itemChip')) { try { const c = LD.UI.itemChip(id, n, {}); if (c instanceof Node) return c; } catch (e) { /* fall through */ } } return el('span.chip', [icon(id, 16), el('span.num', String(n))]); };
const costList = (cost, L, compact) => { if (has(LD.UI, 'costList')) { try { const n = LD.UI.costList(cost, { layer: L, compact: !!compact }); if (n instanceof Node) return n; } catch (e) { /* fall through */ } } return el('div.cost-list', Object.keys(cost || {}).map(k => el('span.cost' + (count(L, k) >= cost[k] ? '.ok' : '.bad'), [icon(k, 14), el('span.num', String(cost[k]))]))); };
const affordable = (cost, L) => { for (const k in (cost || {})) if (count(L, k) < cost[k]) return false; return true; };
const sec = (title, children, cls) => el('section.p-sec' + (cls ? '.' + cls : ''), [title ? el('div.p-sec-title.label', title) : null, ...children.filter(Boolean)]);
const row = (label, val, cls) => { const v = el('span.p-val' + (cls ? '.' + cls : ''), val); return { el: el('div.p-row', [el('span.label', label), v]), v }; };
const bar = kind => { const i = el('i'); const b = el('div.pbar' + (kind ? '.' + kind : ''), i); return { el: b, set(frac, k) { i.style.width = Math.round(U.clamp(frac) * 100) + '%'; if (k !== undefined) b.className = 'pbar' + (k ? ' ' + k : ''); } }; };
const btn = (text, fn, cls) => el('button.p-btn' + (cls ? '.' + cls : ''), { type: 'button', on: { click: fn } }, text);
const footprint = inst => { const Bd = S('Build'); if (has(Bd, 'footprint')) { const f = Bd.footprint(inst); if (f) return f; } const d = sdef(inst.id), s = (d && d.size) || 1; return { x: inst.x, y: inst.y, w: s, h: s }; };
const maxHp = inst => { const Bd = S('Build'); if (has(Bd, 'maxHp')) return Bd.maxHp(inst) || 1; const d = sdef(inst.id); return (d && d.hp) || 1; };
const integrity = inst => { const Bd = S('Build'); if (has(Bd, 'integrity')) return U.clamp(Bd.integrity(inst)); return U.clamp((inst.hp || 0) / maxHp(inst)); };

const P = LD.UI.Panel = {
  uid: null, root: null, els: {}, offs: [], sections: [], sig: '', last: 0, keyBound: false,

  mount(root) {
    P.root = root || document.getElementById('hud-root');
    if (!P.root) return;
    const x = P.els;
    x.panel = el('#hud-panel.side-panel', { hidden: true }, [x.scroll = el('div.panel-scroll')]);
    P.root.appendChild(x.panel);
    const on = (name, fn) => P.offs.push(E.on(name, fn));
    on('tick', () => { const now = performance.now(); if (now - P.last >= 100) { P.last = now; P.refresh(); } });
    on('structure:removed', uid => { if (uid === P.uid) P.select(null); });
    on('structure:broken', uid => { if (uid === P.uid) P.sig = ''; });
    on('structure:built', uid => { if (uid === P.uid) P.sig = ''; });
    on('layer:changed', () => P.select(null));
    on('tech:researched', () => { P.sig = ''; });
    on('game:new', () => P.select(null));
    on('game:loaded', () => P.select(null));
    on('screen:changed', s => { if (s !== 'game') P.select(null); });
    P.bindKeys();
  },

  unmount() {
    P.select(null, true);
    for (const off of P.offs) off();
    P.offs = [];
    if (P.els.panel && P.els.panel.parentNode) P.els.panel.remove();
    P.els = {}; P.sections = []; P.root = null;
  },

  bindKeys() {
    if (P.keyBound) return;
    P.keyBound = true;
    const busy = e => { const t = (e.target && e.target.tagName) || ''; return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || !LD.Main || LD.Main.screen !== 'game' || (LD.Main.overlays && LD.Main.overlays.length); };
    addEventListener('keydown', e => {
      if (!P.uid || busy(e)) return;
      if (e.code === 'Delete') { e.preventDefault(); P.dismantle(); }
    });
    addEventListener('keydown', e => {
      if (e.code !== 'Escape' || !P.uid || busy(e)) return;
      const B = LD.UI.Build;
      if (B && (B.mode !== 'normal' || B.placing || B.popover)) return;
      e.preventDefault(); e.stopImmediatePropagation();
      P.select(null);
      play('ui_close');
    }, true);
  },

  inst() { const g = G(); return (g && P.uid && g.structures[P.uid]) || null; },

  select(uid, silent) {
    const g = G();
    if (!P.els.panel) { if (!P.root) P.mount(document.getElementById('hud-root')); if (!P.els.panel) return; }
    if (uid && (!g || !g.structures[uid])) uid = null;
    const prev = P.uid;
    P.uid = uid || null;
    call(Rn(), 'setSelection', P.uid);
    if (LD.UI.HUD && has(LD.UI.HUD, 'setPanelOpen')) LD.UI.HUD.setPanelOpen(!!P.uid);
    if (P.uid) {
      P.els.panel.hidden = false;
      requestAnimationFrame(() => P.els.panel.classList.add('open'));
      P.sig = '';
      P.rebuild();
      if (!silent && prev !== P.uid) play('ui_open');
    } else {
      P.els.panel.classList.remove('open');
      P.sections = [];
      const pnl = P.els.panel;
      setTimeout(() => { if (!P.uid && pnl) { pnl.hidden = true; U.clear(P.els.scroll || pnl); } }, 140);
    }
    if (prev !== P.uid && !silent) E.emit('structure:selected', P.uid);
  },

  signature(inst) {
    const g = G(), rules = inst.rules ? inst.rules.length : 0;
    return [inst.id, inst.state, inst.recipe || '', inst.oc | 0, inst.paused ? 1 : 0, inst.build ? 1 : 0, rules, inst.tank ? inst.tank.fluid || '' : '', inst.rot | 0, g ? U.count(g.research.done) : 0, inst.hp <= 0 ? 'B' : ''].join('|');
  },

  refresh() {
    const inst = P.inst();
    if (!inst) { if (P.uid) P.select(null); return; }
    const sig = P.signature(inst);
    if (sig !== P.sig) { P.rebuild(); return; }
    for (const s of P.sections) if (s && s.update) { try { s.update(inst); } catch (e) { console.error('[Panel] section update failed', e); } }
  },

  rebuild() {
    const inst = P.inst(), x = P.els;
    if (!inst || !x.scroll) return;
    const def = sdef(inst.id) || { id: inst.id, name: inst.id, tier: 0, size: 1 };
    const top = x.scroll.scrollTop;
    P.sig = P.signature(inst);
    P.sections = [
      P.secHeader(inst, def), P.secBuilding(inst, def), P.secIntegrity(inst, def), P.secOverclock(inst, def), P.secRecipes(inst, def),
      P.secProgress(inst, def), P.secPower(inst, def), P.secFuel(inst, def), P.secFluids(inst, def), P.secLink(inst, def),
      P.secExtractor(inst, def), P.secBorer(inst, def), P.secElevator(inst, def), P.secShaft(inst, def), P.secTurret(inst, def),
      P.secStorage(inst, def), P.secLab(inst, def), P.secMisc(inst, def), P.secActions(inst, def)
    ].filter(Boolean);
    U.clear(x.scroll);
    for (const s of P.sections) x.scroll.appendChild(s.el);
    x.scroll.scrollTop = top;
    for (const s of P.sections) if (s.update) s.update(inst);
  },

  /* ── sections ── */
  secHeader(inst, def) {
    const st = el('span.p-state');
    const hint = el('div.p-state-hint', { hidden: true });
    const L = inst.layer | 0;
    const head = el('div.p-head', [
      el('div.p-thumb', [thumb(def.id, 52)]),
      el('div.p-title', [
        el('div.p-name', [def.name, el('span.tier-chip', { style: { color: tierColors()[def.tier | 0] } }, 'T' + def.tier)]),
        el('div.p-sub.num', layerName(L) + ' · ' + inst.x + ',' + inst.y + ' · ' + (def.size || 1) + '×' + (def.size || 1)),
        st
      ]),
      el('button.p-close', { type: 'button', title: 'Cerrar (Esc)', on: { click: () => P.select(null) } }, '×')
    ]);
    const wrap = el('div.p-header-wrap', [head, def.desc ? el('div.p-desc', def.desc) : null, hint]);
    return { el: wrap, update(i) {
      const s = STATES[i.state] || [String(i.state || '').toUpperCase(), 'dim'];
      const txt = i.paused && i.state !== 'paused' ? 'EN PAUSA' : s[0];
      if (st.textContent !== txt) { st.textContent = txt; st.className = 'p-state ' + (i.paused ? 'dim' : s[1]); }
      const h = (!i.paused && STATE_HINT[i.state]) || '';
      if (hint.textContent !== h) { hint.textContent = h; hint.hidden = !h; }
    } };
  },

  secBuilding(inst, def) {
    if (!inst.build) return null;
    const b = bar('info'), r = row('MONTAJE', '');
    return { el: sec('CONSTRUCCIÓN', [r.el, b.el]), update(i) { if (!i.build) return; const f = i.build.total ? 1 - i.build.left / i.build.total : 0; b.set(f); r.v.textContent = U.fmtPct(f) + ' · ' + U.fmtTime(i.build.left) + ' restantes'; } };
  },

  secIntegrity(inst, def) {
    if (def.overlay) return null;
    const L = inst.layer | 0, Bd = S('Build'), F = S('Fluids');
    const b = bar('ok'), r = row('INTEGRIDAD', '');
    const cost = has(Bd, 'repairCost') ? (Bd.repairCost(P.uid) || {}) : {};
    const repair = btn('REPARAR', () => { if (!has(Bd, 'repair')) return; const ok = Bd.repair(P.uid); if (ok) { P.sig = ''; P.refresh(); } else { play('error'); toast('No hay materiales suficientes para reparar', 'warn'); } });
    const costEl = el('div.p-cost');
    const notes = el('div.p-notes', { hidden: true });
    const repairRow = el('div.p-row.p-repair', [repair, costEl]);
    tip(repair, () => el('div', [el('div.tip-title', 'Reparar'), el('div.tip-body', 'Coste = ceil(coste × fracción perdida × 0,5), pagado desde el inventario de este estrato. Instantáneo.')]));
    const update = i => {
      const f = integrity(i), mh = maxHp(i);
      b.set(f, f <= 0 ? 'bad' : f < 0.3 ? 'warn' : 'ok');
      r.v.textContent = U.fmt(i.hp || 0, 0) + ' / ' + U.fmt(mh, 0) + ' · ' + U.fmtPct(f);
      r.v.className = 'p-val num ' + (f <= 0 ? 'bad' : f < 0.3 ? 'warn' : '');
      const c = has(Bd, 'repairCost') ? (Bd.repairCost(P.uid) || {}) : cost;
      const need = f < 0.999 && Object.keys(c).length;
      repairRow.hidden = !need && f >= 0.999;
      if (need) { const ks = Object.keys(c).join(',') + ':' + Object.values(c).join(','); if (costEl._k !== ks) { costEl._k = ks; U.clear(costEl); costEl.appendChild(costList(c, L, true)); } else if (costEl.firstChild && typeof costEl.firstChild.refresh === 'function') costEl.firstChild.refresh(); repair.disabled = !affordable(c, L); }
      const ns = [];
      if (def.id === 'hub') ns.push('Indestructible: nunca baja del 10 %. Por debajo, su capacidad de intercambio cae a ×0,1.');
      if (L === 4 && !def.heatproof) ns.push('Calor del núcleo: −0,05 %/s de integridad (estructura no blindada).');
      if (has(F, 'hasLubricant') && F.hasLubricant(P.uid)) ns.push('Lubricado: desgaste ÷1,5 (consume 0,005 u/s).');
      if (f < 0.3 && f > 0) { const mul = has(Bd, 'integrityMul') ? Bd.integrityMul(i) : Math.max(0.1, 1 - 0.03 * (30 - f * 100)); ns.push('Integridad baja: rendimiento ×' + U.fmt(mul, 2) + '.'); }
      const txt = ns.join(' ');
      if (notes.textContent !== txt) { notes.textContent = txt; notes.hidden = !txt; }
    };
    return { el: sec('INTEGRIDAD', [r.el, b.el, repairRow, notes]), update };
  },

  secOverclock(inst, def) {
    if (!(def.ocMax > 0)) return null;
    const Eco = S('Economy'), Bd = S('Build');
    const lvl = el('span.oc-level.num'), eff = el('span.p-val.num'), mul = el('div.oc-muls.num');
    const set = d => { const v = U.clamp((inst.oc | 0) + d, 0, def.ocMax); if (v === (inst.oc | 0)) return; if (has(Bd, 'setOverclock')) { if (Bd.setOverclock(P.uid, v) === false) { play('error'); return; } } else inst.oc = v; P.sig = ''; P.refresh(); };
    const minus = btn('−', () => set(-1), 'oc-btn'), plus = btn('+', () => set(1), 'oc-btn');
    tip(plus, () => { const n = Math.min(def.ocMax, (inst.oc | 0) + 1); return el('div', [el('div.tip-title', 'Overclock +' + n), el('div.tip-body', 'Nivel ' + n + ': tier +' + n + ', potencia ×' + Math.pow(2, n) + ', velocidad ×' + U.fmt(Math.pow(1.5, n), 2) + ', desgaste ×' + Math.pow(3, n) + '.')]); });
    const ctl = el('div.oc-ctl', [minus, lvl, plus, el('span.dim.num', '/ ' + def.ocMax)]);
    return { el: sec('OVERCLOCK', [ctl, el('div.p-row', [el('span.label', 'TIER EFECTIVO'), eff]), mul]), update(i) {
      const oc = i.oc | 0;
      lvl.textContent = '+' + oc;
      minus.disabled = oc <= 0; plus.disabled = oc >= def.ocMax;
      const t = has(Eco, 'effectiveTier') ? Eco.effectiveTier(i) : (def.tier | 0) + oc;
      eff.textContent = 'T' + t + ' (' + U.tierName(t).replace(/^T\d /, '') + ')';
      mul.textContent = 'potencia ×' + Math.pow(2, oc) + ' · velocidad ×' + U.fmt(Math.pow(1.5, oc), 2) + ' · desgaste ×' + Math.pow(3, oc);
    } };
  },

  secRecipes(inst, def) {
    if (!def.types || !def.types.length) return null;
    const Eco = S('Economy'), R_ = R();
    const list = has(Eco, 'availableRecipes') ? (Eco.availableRecipes(P.uid) || []) : (R_ ? R_.recipesFor(def.id) : []);
    const speed = has(Eco, 'machineSpeed') ? (Eco.machineSpeed(inst) || 1) : 1;
    const rows = list.map(rc => {
      const ins = Object.keys(rc.in || {}).map(k => chip(k, rc.in[k])), outs = Object.keys(rc.out || {}).map(k => chip(k, rc.out[k]));
      const b = el('button.rc-row' + (inst.recipe === rc.id ? '.current' : ''), { type: 'button', data: { id: rc.id }, on: { click: () => { if (has(Eco, 'setRecipe')) Eco.setRecipe(P.uid, rc.id); else inst.recipe = rc.id; P.sig = ''; P.refresh(); } } }, [
        el('div.rc-name', [rc.name || rc.id, el('span.tier-chip', 'T' + rc.tier)]),
        el('div.rc-io', [el('span.rc-in', ins), el('span.rc-arrow', '→'), el('span.rc-out', outs), el('span.rc-time.num', U.fmtTime(rc.time / Math.max(0.01, speed)))])
      ]);
      tip(b, () => el('div', [el('div.tip-title', rc.name || rc.id), el('div.tip-row', [el('span.label', 'ENTRADA'), el('span', Object.keys(rc.in || {}).map(k => rc.in[k] + ' ' + itemName(k) + (isFluid(k) ? ' (tubería)' : '')).join(', '))]), el('div.tip-row', [el('span.label', 'SALIDA'), el('span', Object.keys(rc.out || {}).map(k => rc.out[k] + ' ' + itemName(k) + (isFluid(k) ? ' (tubería)' : '')).join(', '))]), el('div.tip-row', [el('span.label', 'TIEMPO'), el('span.num', U.fmtTime(rc.time) + ' base · ' + U.fmtTime(rc.time / Math.max(0.01, speed)) + ' efectivo')]), rc.energy ? el('div.tip-row', [el('span.label', 'ENERGÍA'), el('span.num', U.fmtW(rc.energy))]) : null]));
      return b;
    });
    const none = el('button.rc-row.rc-none' + (!inst.recipe ? '.current' : ''), { type: 'button', on: { click: () => { if (has(Eco, 'setRecipe')) Eco.setRecipe(P.uid, null); else inst.recipe = null; P.sig = ''; P.refresh(); } } }, [el('div.rc-name.dim', 'Ninguna receta')]);
    const all = btn('APLICAR A TODAS', () => { if (has(Eco, 'applyRecipeToAll')) { Eco.applyRecipeToAll(P.uid); toast('Receta aplicada a todas las «' + def.name + '» de este estrato', 'ok'); } }, 'p-btn-wide');
    all.disabled = !inst.recipe;
    tip(all, () => el('div', [el('div.tip-body', 'Asigna esta receta a todas las máquinas del mismo tipo en este estrato.')]));
    const listEl = el('div.rc-list', [...rows, none]);
    if (!rows.length) listEl.appendChild(el('div.p-empty.label', 'SIN RECETAS DISPONIBLES PARA ESTE TIER'));
    return { el: sec('RECETA', [listEl, all]), update() {} };
  },

  secProgress(inst, def) {
    if (!def.types && !def.extract && !def.nature) return null;
    const Eco = S('Economy'), R_ = R();
    const b = bar('ok'), r = row('PROGRESO', '');
    const made = row('PRODUCIDO', '');
    return { el: sec('TRABAJO', [r.el, b.el, made.el]), update(i) {
      const rc = i.recipe && R_ ? R_.recipe(i.recipe) : null;
      let p = i.progress || 0;
      if (rc && rc.time) p = p / rc.time;
      b.set(p, i.state === 'working' ? 'ok' : 'dim');
      const speed = has(Eco, 'machineSpeed') ? Eco.machineSpeed(i) : 1;
      r.v.textContent = (rc ? rc.name + ' · ' : '') + U.fmtPct(U.clamp(p)) + ' · velocidad ×' + U.fmt(speed || 0, 2);
      const m = i.stats && i.stats.made;
      made.el.hidden = !m;
      if (m) made.v.textContent = typeof m === 'number' ? U.fmt(m, 0) : Object.keys(m).map(k => U.fmt(m[k], 0) + ' ' + itemName(k)).join(', ');
    } };
  },

  secPower(inst, def) {
    const Pw = S('Power');
    const isGen = !!(def.power && def.power.gen), isUse = !!(def.power && def.power.use), isStore = !!(def.power && def.power.store), isCable = def.overlay === 'cable';
    if (!isGen && !isUse && !isStore && !isCable) return null;
    const r1 = row(isGen ? 'GENERACIÓN' : isUse ? 'DEMANDA' : isStore ? 'ALMACENADO' : 'CAPACIDAD', ''), r2 = row('RED', ''), r3 = row('CABLE', '');
    const hint = el('div.p-hint', { hidden: true });
    const b = bar('ok');
    return { el: sec('ENERGÍA', [r1.el, isStore ? b.el : null, r2.el, r3.el, hint]), update(i) {
      if (isGen) r1.v.textContent = U.fmtW(has(Pw, 'genOf') ? Pw.genOf(i) : 0) + ' / ' + U.fmtW(def.power.gen);
      else if (isUse) r1.v.textContent = U.fmtW(has(Pw, 'demandOf') ? Pw.demandOf(i) : 0) + ' (nominal ' + U.fmtW(def.power.use * Math.pow(2, i.oc | 0)) + ')';
      else if (isStore) { const st = i.stored || 0; r1.v.textContent = U.fmtJ(st) + ' / ' + U.fmtJ(def.power.store); b.set(st / def.power.store); }
      else if (isCable) r1.v.textContent = isFinite(def.cable.cap) ? U.fmtW(def.cable.cap) : 'sin límite';
      const grid = has(Pw, 'gridOf') ? Pw.gridOf(P.uid) : null;
      if (grid) { const ratio = grid.use > 0 ? U.clamp(grid.ratio === undefined ? 1 : grid.ratio) : 1; r2.v.textContent = U.fmtW(grid.gen) + ' ▸ ' + U.fmtW(grid.use) + ' · ' + U.fmtPct(ratio); r2.v.className = 'p-val num ' + (ratio < 0.999 ? 'warn' : ''); }
      else { r2.v.textContent = 'sin red'; r2.v.className = 'p-val num dim'; }
      const cap = has(Pw, 'cableCap') ? Pw.cableCap(P.uid) : null;
      r3.el.hidden = isCable || cap === null || cap === undefined;
      if (!r3.el.hidden) r3.v.textContent = isFinite(cap) ? U.fmtW(cap) + ' máx.' : 'sin límite';
      let h = '';
      if (!grid && (isGen || isUse)) h = isGen ? 'Sin red: tiende cables (o ejes) desde este generador hasta los consumidores.' : 'Sin red: coloca un cable adyacente conectado a un generador.';
      else if (isUse && cap !== null && isFinite(cap) && cap < def.power.use * Math.pow(2, i.oc | 0)) h = 'El cable adyacente limita la potencia a ' + U.fmtW(cap) + ': usa un cable de mayor tier.';
      else if (grid && grid.use > 0 && grid.ratio < 0.999 && isUse) h = 'La red está saturada: las máquinas funcionan al ' + U.fmtPct(grid.ratio) + '.';
      if (hint.textContent !== h) { hint.textContent = h; hint.hidden = !h; }
    } };
  },

  secFuel(inst, def) {
    const fuels = (def.power && def.power.fuel) || (def.burn && def.burn.fuels) || null;
    if (!fuels || !fuels.length) return null;
    const Pw = S('Power'), L = inst.layer | 0;
    const b = bar('warn'), r = row('RESERVA', ''), acc = el('div.p-fuels');
    const burn = def.burn && def.burn.mjPerSec ? def.burn.mjPerSec : (def.power && def.power.gen ? def.power.gen / 1e6 : 0.01);
    return { el: sec('COMBUSTIBLE', [r.el, b.el, acc]), update(i) {
      const fs = has(Pw, 'fuelState') ? (Pw.fuelState(i) || { mj: i.fuel || 0, item: null }) : { mj: i.fuel || 0, item: null };
      const secs = fs.seconds !== undefined ? fs.seconds : (burn > 0 ? fs.mj / (burn * Math.pow(2, i.oc | 0)) : 0);
      r.v.textContent = U.fmt(fs.mj || 0, 1) + ' MJ' + (fs.item ? ' (' + itemName(fs.item) + ')' : '') + (isFinite(secs) ? ' · ≈' + U.fmtTime(secs) : (fs.mj > 0 ? ' · sin consumo' : ''));
      b.set(isFinite(secs) ? U.clamp(secs / 120) : (fs.mj > 0 ? 1 : 0), !isFinite(secs) ? 'ok' : secs < 15 ? 'bad' : secs < 45 ? 'warn' : 'ok');
      const k = fuels.map(f => f + ':' + Math.floor(count(L, f))).join(',');
      if (acc._k !== k) { acc._k = k; U.clear(acc); acc.append(el('span.label', 'ACEPTA'), ...fuels.map(f => el('span.chip.fuel' + (isFluid(f) ? '.fluid' : count(L, f) > 0 ? '' : '.empty'), [icon(f, 14), el('span.num', isFluid(f) ? 'tubería' : U.fmt(count(L, f), 0))]))); }
    } };
  },

  secFluids(inst, def) {
    const F = S('Fluids'), R_ = R();
    const usesFluid = !!(def.tank || def.pipe || (def.power && def.power.fluidIn) || (def.extract && def.extract.fluid) || (def.nature && def.nature.consumes) || (def.types && R_ && R_.recipesFor(def.id).some(rc => Object.keys(rc.in).concat(Object.keys(rc.out)).some(isFluid))) || def.shaft || def.elevator);
    if (!usesFluid) return null;
    const parts = [];
    let tankRow = null, tb = null, empty = null;
    if (def.tank) {
      tb = bar('info'); tankRow = row('CONTENIDO', '');
      empty = btn('VACIAR TANQUE', () => { if (has(F, 'setTankFluid')) F.setTankFluid(P.uid, null); else inst.tank = { fluid: null, amt: 0 }; P.sig = ''; P.refresh(); }, 'p-btn-wide');
      tip(empty, () => el('div', [el('div.tip-body', 'Los tanques son monofluido. Vaciar descarta el contenido y permite asignar otro fluido.')]));
      parts.push(tankRow.el, tb.el, empty);
    }
    const net = el('div.p-fluid-net'), rate = row('TUBERÍA', ''), hint = el('div.p-hint', { hidden: true });
    const needsPipe = !(def.shaft || def.elevator || def.pipe);
    parts.push(rate.el, net, hint);
    return { el: sec('FLUIDOS', parts), update(i) {
      if (def.tank) {
        const t = has(F, 'tankInfo') ? (F.tankInfo(P.uid) || {}) : (i.tank || {});
        const cap = t.cap || def.tank.cap || 1;
        tankRow.v.textContent = (t.fluid ? itemName(t.fluid) + ' · ' : 'vacío · ') + U.fmt(t.amt || 0, 0) + ' / ' + U.fmt(cap, 0);
        tb.set((t.amt || 0) / cap);
        empty.disabled = !t.fluid;
      }
      const pr = has(F, 'pipeRate') ? F.pipeRate(P.uid) : null;
      rate.el.hidden = pr === null || pr === undefined;
      if (!rate.el.hidden) rate.v.textContent = isFinite(pr) ? U.fmt(pr, 1) + ' u/s máx.' : 'sin límite';
      const n = has(F, 'networkOf') ? F.networkOf(P.uid) : null;
      const k = n ? Object.keys(n.fluids || {}).map(f => f + ':' + Math.floor(n.fluids[f].amt) + '/' + n.fluids[f].cap).join(',') + '#' + (n.tanks ? n.tanks.length : 0) : '';
      if (net._k !== k) {
        net._k = k; U.clear(net);
        if (n) {
          net.appendChild(el('div.p-row', [el('span.label', 'RED ' + (n.id !== undefined ? n.id : '')), el('span.p-val.num', (n.tanks ? n.tanks.length : 0) + ' tanques · ' + (n.members ? n.members.length : 0) + ' miembros')]));
          for (const f in (n.fluids || {})) { const fl = n.fluids[f]; net.appendChild(el('div.p-row', [el('span.fluid-name', [icon(f, 14), ' ' + itemName(f)]), el('span.p-val.num', U.fmt(fl.amt, 0) + ' / ' + U.fmt(fl.cap, 0))])); }
          if (!Object.keys(n.fluids || {}).length) net.appendChild(el('div.p-row.dim', 'Red sin fluidos almacenados'));
        }
      }
      let h = '';
      if (!n) h = needsPipe ? 'Sin red de tuberías: coloca una tubería adyacente que llegue a un tanque.' : '';
      else if (i.state === 'no_fluid') h = 'La red no contiene el fluido de entrada que necesita la receta.';
      else if (i.state === 'output_full' && def.tank === undefined) h = 'No hay tanque con espacio para la salida en esta red.';
      if (hint.textContent !== h) { hint.textContent = h; hint.hidden = !h; }
    } };
  },

  secLink(inst, def) {
    if (!(def.types || def.extract || def.borer || def.nature || def.lab || def.turret && def.turret.ammo)) return null;
    if (def.id === 'hub') return null;
    const Eco = S('Economy');
    const r = row('ALMACÉN', ''), hint = el('div.p-hint', { hidden: true });
    return { el: sec('LOGÍSTICA', [r.el, hint]), update(i) {
      const linked = has(Eco, 'isLinked') ? Eco.isLinked(P.uid) : true;
      const rate = has(Eco, 'linkRate') ? Eco.linkRate(P.uid) : Infinity;
      r.v.textContent = !linked ? 'sin conexión' : (isFinite(rate) ? U.fmt(rate, 1) + ' objetos/s' : 'adyacente al almacén');
      r.v.className = 'p-val num ' + (linked ? 'ok' : 'bad');
      const hub = has(Eco, 'hubMul') ? Eco.hubMul(i.layer | 0) : 1;
      let h = '';
      if (!linked) h = 'Sin conexión al almacén: coloca una cinta adyacente que llegue al ' + ((i.layer | 0) === 0 ? 'almacén central' : 'elevador') + '.';
      else if (hub < 1) h = 'El almacén central está al 10 %: la capacidad de intercambio es ×0,1.';
      else if (isFinite(rate) && rate < 4) h = 'La cinta adyacente limita el flujo a ' + U.fmt(rate, 1) + '/s: mejora la cinta para más caudal.';
      if (hint.textContent !== h) { hint.textContent = h; hint.hidden = !h; }
    } };
  },

  secExtractor(inst, def) {
    if (!def.extract) return null;
    const w = W(), L = inst.layer | 0;
    const r1 = row('YACIMIENTO', ''), r2 = row('CASILLAS', ''), r3 = row('RESTANTE', ''), r4 = row('RITMO', '');
    const hint = el('div.p-hint', { hidden: true });
    return { el: sec('EXTRACCIÓN', [r1.el, r2.el, r3.el, r4.el, hint]), update(i) {
      const fp = footprint(i);
      const res = {}; let tiles = 0, rem = 0, inf = false, hard = 0;
      if (has(w, 'depositAt')) for (let y = fp.y; y < fp.y + fp.h; y++) for (let x = fp.x; x < fp.x + fp.w; x++) { const d = w.depositAt(L, x, y); if (!d) continue; if (d.hardness > def.extract.hardnessMax) { hard++; continue; } tiles++; res[d.res] = (res[d.res] || 0) + 1; if (d.amt < 0) inf = true; else rem += d.amt; }
      r1.v.textContent = Object.keys(res).length ? Object.keys(res).map(itemName).join(', ') : 'ninguno';
      r2.v.textContent = tiles + ' / ' + (fp.w * fp.h) + (hard ? ' (' + hard + ' demasiado duras)' : '');
      r3.v.textContent = inf ? '∞' : U.fmt(rem, 0);
      const Eco = S('Economy'), sp = has(Eco, 'machineSpeed') ? Eco.machineSpeed(i) : 1;
      r4.v.textContent = U.fmt(def.extract.rate * tiles * (sp || 0), 2) + '/s' + (def.extract.fluid ? ' → tuberías' : '');
      const h = !tiles ? (hard ? 'La dureza del yacimiento supera la de esta máquina (máx. ' + def.extract.hardnessMax + ').' : 'No cubre ningún yacimiento: colócala sobre un depósito.') : (!inf && rem < 200 ? 'El yacimiento está casi agotado.' : '');
      if (hint.textContent !== h) { hint.textContent = h; hint.hidden = !h; }
    } };
  },

  secBorer(inst, def) {
    if (!def.borer) return null;
    const w = W(), g = G(), L = inst.layer | 0, ld = R() && R().layer(L);
    const r1 = row('PARCELA', ''), r2 = row('DUREZA', ''), r3 = row('AVANCE', ''), b = bar('info'), hint = el('div.p-hint', { hidden: true });
    const target = i => {
      let t = i.target;
      if (typeof t === 'string' && t.indexOf(',') > 0) { const k = U.unkey(t); t = { cx: k[0], cy: k[1] }; }
      if (t && t.cx !== undefined) return { cx: t.cx, cy: t.cy, dig: ((g.layers[L].digging || {})[t.cx + ',' + t.cy]) || null };
      if (!has(w, 'chunkOf') || !has(w, 'isExcavated')) return null;
      const fp = footprint(i), seen = new Set(); let best = null;
      const digging = (g.layers[L] && g.layers[L].digging) || {};
      const check = (x, y) => { const c = w.chunkOf(L, x, y); if (!c) return; const k = c.cx + ',' + c.cy; if (seen.has(k)) return; seen.add(k); if (w.isExcavated(L, c.cx, c.cy)) return; const cand = { cx: c.cx, cy: c.cy, dig: digging[k] || null }; if (!best || (cand.dig && !best.dig)) best = cand; };
      for (let x = fp.x - 1; x <= fp.x + fp.w; x++) { check(x, fp.y - 1); check(x, fp.y + fp.h); }
      for (let y = fp.y; y < fp.y + fp.h; y++) { check(fp.x - 1, y); check(fp.x + fp.w, y); }
      return best;
    };
    return { el: sec('EXCAVACIÓN', [r1.el, r2.el, r3.el, b.el, hint]), update(i) {
      const t = target(i);
      if (!t) { r1.v.textContent = 'ninguna'; r2.v.textContent = '–'; r3.v.textContent = '–'; b.set(0); hint.textContent = 'Coloca la tuneladora pegada al borde de una parcela sin excavar (adyacente a una excavada).'; hint.hidden = false; return; }
      const dig = t.dig || ((g.layers[L].digging || {})[t.cx + ',' + t.cy]) || null;
      const H = has(w, 'rockHardness') ? w.rockHardness(L, t.cx, t.cy) : null;
      r1.v.textContent = t.cx + ',' + t.cy;
      r2.v.textContent = H === null ? '–' : U.fmt(H, 2);
      const f = dig && dig.total ? dig.work / dig.total : 0;
      r3.v.textContent = dig ? U.fmtPct(f) + ' · ' + U.fmt(dig.work, 0) + ' / ' + U.fmt(dig.total, 0) : 'sin empezar';
      b.set(f, i.state === 'working' ? 'ok' : 'info');
      const tier = ld && ld.borerTier !== undefined ? ld.borerTier : 0;
      const Eco = S('Economy'), et = has(Eco, 'effectiveTier') ? Eco.effectiveTier(i) : def.tier;
      let h = '';
      if (et < tier) h = 'Tier insuficiente: este estrato requiere tuneladoras T' + tier + '+ (overclock sube el tier efectivo).';
      else if (has(w, 'canDig')) { const cd = w.canDig(L, t.cx, t.cy); if (cd && !cd.ok && !dig) h = cd.reason || 'Esa parcela no se puede excavar todavía.'; }
      if (hint.textContent !== h) { hint.textContent = h; hint.hidden = !h; }
    } };
  },

  secElevator(inst, def) {
    if (!def.elevator) return null;
    const Eco = S('Economy'), g = G(), L = inst.layer | 0;
    const rules = (has(Eco, 'elevatorRules') ? Eco.elevatorRules(P.uid) : inst.rules) || [];
    const commit = next => { if (has(Eco, 'setElevatorRules')) Eco.setElevatorRules(P.uid, next); else inst.rules = next; P.sig = ''; P.refresh(); };
    const items = Object.keys((g && g.discovered.items) || {}).filter(id => !isFluid(id)).map(id => ({ id, name: itemName(id) })).sort((a, b) => a.name.localeCompare(b.name));
    const table = el('div.rules');
    table.appendChild(el('div.rule.rule-default', [el('span.rule-item.dim', '* todo lo demás'), el('span.rule-mode.dim', 'Subir'), el('span.rule-keep.dim', '—'), el('span')]));
    rules.forEach((rule, idx) => {
      const sel = el('select.rule-item', { on: { change: () => { const nx = rules.map(r => Object.assign({}, r)); nx[idx].item = sel.value; commit(nx); } } }, items.map(it => el('option', { value: it.id, selected: it.id === rule.item }, it.name)));
      if (rule.item && !items.some(it => it.id === rule.item)) sel.insertBefore(el('option', { value: rule.item, selected: true }, itemName(rule.item)), sel.firstChild);
      const mode = el('select.rule-mode', { on: { change: () => { const nx = rules.map(r => Object.assign({}, r)); nx[idx].mode = mode.value; commit(nx); } } }, ['up', 'down', 'keep'].map(m => el('option', { value: m, selected: m === rule.mode }, MODE_NAMES[m])));
      const keep = el('input.rule-keep', { type: 'number', min: '0', step: '1', value: String(rule.keep || 0), disabled: rule.mode === 'up', on: { change: () => { const nx = rules.map(r => Object.assign({}, r)); nx[idx].keep = Math.max(0, +keep.value | 0); commit(nx); }, keydown: e => e.stopPropagation() } });
      const del = el('button.rule-del', { type: 'button', title: 'Quitar regla', on: { click: () => { const nx = rules.filter((_, j) => j !== idx); commit(nx); } } }, '×');
      const rowEl = el('div.rule', [sel, mode, keep, del]);
      tip(rowEl, () => el('div', [el('div.tip-body', rule.mode === 'down' ? 'Bajar: trae desde la superficie hasta que este estrato tenga «mantener» unidades.' : rule.mode === 'keep' ? 'Mantener: no sube este objeto mientras el estrato tenga menos de «mantener» unidades.' : 'Subir: envía todo este objeto a la superficie.')]));
      table.appendChild(rowEl);
    });
    const add = btn('+ AÑADIR REGLA', () => { if (!items.length) { toast('Aún no hay objetos descubiertos', 'warn'); return; } const nx = rules.map(r => Object.assign({}, r)); nx.push({ item: items[0].id, mode: 'down', keep: 10 }); commit(nx); }, 'p-btn-wide');
    const r = row('CAUDAL', ''), hint = el('div.p-hint', 'Por defecto todo sube a la superficie. Añade reglas para bajar materiales o retener existencias.');
    const head = el('div.rule.rule-head', [el('span.label', 'OBJETO'), el('span.label', 'MODO'), el('span.label', 'MANTENER'), el('span')]);
    return { el: sec('ELEVADOR · REGLAS', [r.el, hint, head, table, add]), update(i) {
      const Eco2 = S('Economy'), hub = has(Eco2, 'hubMul') ? Eco2.hubMul(0) : 1;
      r.v.textContent = U.fmt(def.elevator.rate * hub, 1) + ' objetos/s ↔ ' + layerName(0) + (hub < 1 ? ' (almacén al 10 %)' : '');
    } };
  },

  secShaft(inst, def) {
    if (!def.shaft) return null;
    const g = G(), tl = def.shaft.layer | 0;
    const r1 = row('DESTINO', layerName(tl)), r2 = row('ESTADO', ''), r3 = row('CAUDAL', (isFinite(def.shaft.rate) ? U.fmt(def.shaft.rate, 1) + ' u/s' : 'sin límite') + ' de fluido · energía');
    return { el: sec('POZO', [r1.el, r2.el, r3.el, el('div.p-hint', 'El pozo une la red eléctrica y las tuberías de la superficie con el elevador del estrato inferior.')]), update(i) {
      const un = !!(g && g.layers[tl] && g.layers[tl].unlocked);
      r2.v.textContent = i.build ? 'perforando…' : un ? 'conectado con el elevador' : 'pendiente';
      r2.v.className = 'p-val num ' + (un ? 'ok' : 'warn');
    } };
  },

  secTurret(inst, def) {
    if (!def.turret) return null;
    const D = S('Defense'), L = inst.layer | 0, t = def.turret;
    const r1 = row('ALCANCE', t.range + ' casillas'), r2 = row('DAÑO', t.dmg + ' × ' + t.rate + '/s · ' + t.dmgType + (t.ap ? ' · perforante' : '')), r3 = row('MUNICIÓN', ''), r4 = row('OBJETIVO', '');
    return { el: sec('DEFENSA', [r1.el, r2.el, t.ammo ? r3.el : null, r4.el]), update(i) {
      if (t.ammo) { const parts = Object.keys(t.ammo).map(a => itemName(a) + ' ' + U.fmt(count(L, a), 0)); r3.v.textContent = parts.join(', '); r3.v.className = 'p-val num ' + (Object.keys(t.ammo).some(a => count(L, a) > 0) ? '' : 'bad'); }
      const en = has(D, 'turretTarget') ? D.turretTarget(P.uid) : null;
      const ed = en && R() && R().enemy(en.id);
      r4.v.textContent = en ? (ed ? ed.name : en.id) + ' · ' + U.fmt(en.hp, 0) + ' pv' : 'ninguno';
      r4.v.className = 'p-val num ' + (en ? 'warn' : 'dim');
    } };
  },

  secStorage(inst, def) {
    if (!def.storage) return null;
    const Eco = S('Economy'), L = inst.layer | 0, g = G();
    const r1 = row('APORTA', '+' + U.fmt(def.storage.cap, 0) + ' por objeto'), r2 = row('TOPE DEL ESTRATO', '');
    return { el: sec('ALMACENAMIENTO', [r1.el, r2.el, el('div.p-hint', 'Cada objeto puede acumularse hasta el tope del estrato (base + suma de almacenes construidos).')]), update() {
      r2.v.textContent = U.fmt(has(Eco, 'cap') ? Eco.cap(L, 'stone') : ((g && g.caps && g.caps.base) || 0), 0) + ' por objeto';
    } };
  },

  secLab(inst, def) {
    if (!def.lab) return null;
    const Rs = S('Research'), R_ = R();
    const r1 = row('NIVEL', 'T' + def.lab.tier), r2 = row('INVESTIGANDO', ''), r3 = row('VELOCIDAD', '');
    return { el: sec('LABORATORIO', [r1.el, r2.el, r3.el]), update() {
      const p = has(Rs, 'progress') ? Rs.progress() : null;
      const t = p && R_ ? R_.tech(p.tech) : null;
      r2.v.textContent = p ? (t ? t.name : p.tech) + ' · ' + U.fmtPct(p.total ? 1 - p.left / p.total : 0) : 'nada';
      r2.v.className = 'p-val num ' + (p ? '' : 'dim');
      const ok = !t || (t.lab | 0) <= (def.lab.tier | 0);
      r3.v.textContent = p ? (ok ? '×' + U.fmt(p.speed || 0, 1) + ' entre todos los laboratorios' : 'requiere laboratorio T' + t.lab) : '–';
      r3.v.className = 'p-val num ' + (ok ? '' : 'warn');
    } };
  },

  secMisc(inst, def) {
    const rows = [];
    if (def.light) rows.push(row('LUZ', 'radio ' + def.light.radius).el);
    if (def.wall) rows.push(row('MURO', 'bloquea el paso; los enemigos abren brecha por el muro más débil').el);
    if (def.conveyor) rows.push(row('CINTA', U.fmt(def.conveyor.rate, 1) + ' objetos/s').el);
    if (def.pipe) rows.push(row('TUBERÍA', isFinite(def.pipe.rate) ? U.fmt(def.pipe.rate, 1) + ' u/s' : 'sin límite').el);
    if (def.nature) rows.push(row('NATURALEZA', (def.nature.kind || '') + (def.nature.radius ? ' · radio ' + def.nature.radius : '') + (def.nature.rate ? ' · ' + U.fmt(def.nature.rate, 2) + '/s' : '')).el);
    if (def.heatproof) rows.push(row('BLINDAJE', 'resiste el calor del núcleo').el);
    if (!rows.length) return null;
    return { el: sec('CARACTERÍSTICAS', rows), update() {} };
  },

  secActions(inst, def) {
    const Bd = S('Build'), hub = def.id === 'hub';
    const pause = btn('', () => { const v = !P.inst().paused; if (has(Bd, 'setPaused')) Bd.setPaused(P.uid, v); else P.inst().paused = v; P.sig = ''; P.refresh(); });
    const rot = btn('ROTAR', () => { if (has(Bd, 'rotate')) Bd.rotate(P.uid); else { const i = P.inst(); i.rot = ((i.rot | 0) + 1) & 3; } P.sig = ''; P.refresh(); });
    const centre = btn('CENTRAR', () => { const i = P.inst(); if (!i) return; const fp = footprint(i); call(Rn(), 'centerOn', i.layer | 0, fp.x + fp.w / 2, fp.y + fp.h / 2); });
    const dis = btn('DESMONTAR', () => P.dismantle(), 'danger');
    tip(dis, () => { const r = has(Bd, 'refundPreview') ? Bd.refundPreview(P.uid) : null; return el('div', [el('div.tip-title', 'Desmontar'), el('div.tip-body', (P.inst() && P.inst().build) ? 'Reembolso del 100 % (en construcción).' : 'Reembolso del 65 % del coste.'), r && Object.keys(r).length ? el('div.tip-row', [el('span.label', 'DEVUELVE'), el('span', Object.keys(r).map(k => r[k] + ' ' + itemName(k)).join(', '))]) : null, el('div.tip-hint', 'Tecla Supr con la estructura seleccionada')]); });
    const cd = has(Bd, 'canDismantle') ? Bd.canDismantle(P.uid) : null;
    if (hub || (cd && !cd.ok)) { dis.disabled = true; if (cd && cd.reason) dis.title = cd.reason; }
    if (hub) pause.hidden = true;
    if (def.overlay || def.conveyor || def.wall) { pause.hidden = true; if (def.overlay) rot.hidden = true; }
    return { el: sec(null, [el('div.p-actions', [pause, rot, centre, dis])], 'p-actions-sec'), update(i) { pause.textContent = i.paused ? 'REANUDAR' : 'PAUSAR'; pause.classList.toggle('active', !!i.paused); } };
  },

  async dismantle() {
    const inst = P.inst(); if (!inst) return;
    const def = sdef(inst.id), Bd = S('Build');
    const cd = has(Bd, 'canDismantle') ? (Bd.canDismantle(P.uid) || { ok: true }) : { ok: !(def && def.id === 'hub'), reason: 'El almacén central no se puede desmontar' };
    if (!cd.ok) { toast(cd.reason || 'No se puede desmontar', 'warn'); play('error'); return; }
    const r = has(Bd, 'refundPreview') ? (Bd.refundPreview(P.uid) || {}) : {};
    const list = Object.keys(r).map(k => r[k] + ' ' + itemName(k)).join(', ');
    const ok = await P.confirm('Desmontar ' + (def ? def.name : inst.id), (inst.build ? 'Reembolso del 100 %' : 'Reembolso del 65 %') + (list ? ': ' + list : '') + '.', { danger: true, ok: 'Desmontar' });
    if (!ok) return;
    const uid = P.uid;
    if (has(Bd, 'dismantle')) Bd.dismantle(uid);
    P.select(null);
  },

  confirm(title, text, o) {
    if (has(LD.UI, 'confirm')) return Promise.resolve(LD.UI.confirm(title, text, o || {}));
    if (LD.UI.Build && has(LD.UI.Build, 'confirm')) return LD.UI.Build.confirm(title, text, o);
    return Promise.resolve(window.confirm(title + '\n' + text));
  }
};
})();
