(() => {
'use strict';
const LD = window.LD, U = LD.U, el = U.el;
const UI = LD.UI = LD.UI || {};
UI.el = el;

const MONO = 'ui-monospace,"SF Mono",Menlo,Consolas,"DejaVu Sans Mono",monospace';
const $ = id => document.getElementById(id);
const stageEl = () => (LD.Stage && LD.Stage.el) || $('stage') || document.body;
const rootIn = id => { let r = $(id); if (!r) { r = el('div#' + id); stageEl().appendChild(r); } return r; };
const reduced = () => { try { return !!LD.Settings.get().reducedMotion; } catch (e) { return false; } };
const nextFrame = fn => { if (reduced()) fn(); else requestAnimationFrame(() => requestAnimationFrame(fn)); };
const sfx = name => { const A = LD.Audio; if (A && typeof A.play === 'function') { try { A.play(name); } catch (e) { /* audio is optional */ } } };
const R = () => LD.Registry;
const itemDef = id => { const r = R(); return r ? r.items.get(id) : null; };
const itemName = id => { const d = itemDef(id); return d ? d.name : id; };
const CAT_NAMES = { raw: 'Materia prima', ore: 'Mena', crushed: 'Triturado', ingot: 'Lingote', plate: 'Plancha', rod: 'Varilla', gear: 'Engranaje', wire: 'Hilo', part: 'Pieza', component: 'Componente', circuit: 'Circuito', fluid: 'Fluido', gas: 'Gas', chemical: 'Químico', fuel: 'Combustible', nuclear: 'Nuclear', crystal: 'Cristal', organic: 'Orgánico', building: 'Construcción', ammo: 'Munición', science: 'Ciencia', exotic: 'Exótico' };
const TIER_COLORS = ['#8f8b82', '#b08d57', '#7f8ea3', '#c9a227', '#6fa8dc', '#8fb87a', '#c9603b', '#b28cff'];
UI.CAT_NAMES = CAT_NAMES;
UI.catName = cat => CAT_NAMES[cat] || cat || '';
UI.sfx = sfx;
UI.reducedMotion = reduced;
UI.nextFrame = nextFrame;

const addContent = (node, c) => {
  if (c === null || c === undefined || c === false) return;
  if (Array.isArray(c)) { c.forEach(x => addContent(node, x)); return; }
  if (typeof c === 'function') { addContent(node, c()); return; }
  if (c instanceof Node) { node.appendChild(c); return; }
  node.insertAdjacentHTML('beforeend', String(c));
};
UI.addContent = addContent;

/* ── primitives ── */
UI.button = (label, o = {}) => el('button.ui-btn' + (o.primary ? '.primary' : '') + (o.danger ? '.danger' : '') + (o.ghost ? '.ghost' : '') + (o.small ? '.small' : '') + (o.className ? '.' + o.className : ''),
  { type: 'button', disabled: !!o.disabled, title: o.title || null, on: o.onClick ? { click: o.onClick } : null }, label);
UI.input = (o = {}) => {
  const i = el('input.ui-input' + (o.mono ? '.mono' : ''), { type: o.type || 'text', placeholder: o.placeholder || null, maxlength: o.maxlength || null, spellcheck: 'false', autocomplete: 'off', on: o.onInput ? { input: e => o.onInput(e.target.value, e) } : null });
  i.value = o.value == null ? '' : String(o.value);
  return i;
};
UI.textarea = (o = {}) => {
  const t = el('textarea.ui-input', { placeholder: o.placeholder || null, readOnly: !!o.readonly, rows: o.rows || 8, spellcheck: 'false' });
  t.value = o.value == null ? '' : String(o.value);
  return t;
};
UI.keycap = text => el('kbd.ui-key', text);
UI.hr = () => el('div.hr');
UI.empty = text => el('div.ui-empty', text);
UI.section = (title, children, o = {}) => el('section.ui-section' + (o.className ? '.' + o.className : ''), [el('h3.ui-section-title', [el('span.label', title), o.aside ? el('span.ui-section-aside', o.aside) : null]), children]);
UI.field = (label, control, o = {}) => el('div.ui-field' + (o.stack ? '.stack' : '') + (o.className ? '.' + o.className : ''), [el('div.ui-field-label.label', label), el('div.ui-field-ctl', control), o.hint ? el('div.ui-field-hint', o.hint) : null]);
UI.fmtDate = ts => { if (!ts) return '—'; try { return new Date(ts).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return new Date(ts).toISOString().slice(0, 16).replace('T', ' '); } };
UI.fmtItems = obj => { const parts = []; for (const id in (obj || {})) parts.push(U.fmt(obj[id]) + ' ' + itemName(id)); return parts.join(' · '); };

/* ── toasts ── */
const KIND = { info: { label: 'INFO', ms: 2600 }, ok: { label: 'OK', ms: 2200 }, warn: { label: 'AVISO', ms: 3400 }, bad: { label: 'ERROR', ms: 4200 } };
const toasts = [];
const dropToast = (t, fast) => {
  const i = toasts.indexOf(t); if (i >= 0) toasts.splice(i, 1);
  clearTimeout(t.timer);
  const remove = () => { if (t.node.parentNode) t.node.parentNode.removeChild(t.node); };
  if (fast || reduced()) remove(); else { t.node.classList.remove('in'); t.node.classList.add('out'); setTimeout(remove, 240); }
};
const armToast = t => { clearTimeout(t.timer); t.timer = setTimeout(() => dropToast(t), t.ms); };
UI.toast = (text, kind = 'info', ms) => {
  text = String(text == null ? '' : text);
  if (!text) return null;
  const k = KIND[kind] ? kind : 'info';
  const last = toasts[toasts.length - 1];
  if (last && last.text === text && last.kind === k) { last.n++; last.count.textContent = '×' + last.n; last.count.hidden = false; armToast(last); return last; }
  const count = el('span.ui-toast-n', { hidden: true });
  const node = el('div.ui-toast.' + k, { role: 'status' }, [el('span.ui-toast-k', KIND[k].label), el('span.ui-toast-t', text), count]);
  const t = { node, text, kind: k, n: 1, count, timer: 0, ms: ms > 0 ? ms : KIND[k].ms, close: () => dropToast(t) };
  toasts.push(t);
  while (toasts.length > 4) dropToast(toasts[0], true);
  rootIn('toast-root').appendChild(node);
  nextFrame(() => node.classList.add('in'));
  armToast(t);
  return t;
};
UI.clearToasts = () => { while (toasts.length) dropToast(toasts[0], true); };

/* ── modal ── */
let figNo = 0;
const isFormTag = t => t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT';
const actionButton = (a, close) => {
  if (a instanceof Node) return a;
  const b = UI.button(a.label, { primary: a.primary, danger: a.danger, ghost: a.ghost, small: a.small, disabled: a.disabled, title: a.title });
  if (a.left) b.classList.add('left');
  b.addEventListener('click', () => {
    let keep = false;
    if (a.onClick) { try { keep = a.onClick(b) === false; } catch (err) { console.error('[UI.modal] action failed', err); } }
    if (a.close !== false && !keep) close();
  });
  return b;
};
UI.modal = (o = {}) => {
  const root = rootIn('overlay-root');
  UI.sfxHooks(root);
  const fig = String(++figNo % 100).padStart(2, '0');
  let closed = false;
  const bodyEl = el('div.ui-modal-body.ui-scroll');
  addContent(bodyEl, o.body);
  const close = fromStack => {
    if (closed) return; closed = true;
    if (!fromStack && LD.Main && LD.Main.removeOverlay) LD.Main.removeOverlay(ov);
    UI.tooltip.hide();
    const remove = () => { if (scrim.parentNode) scrim.parentNode.removeChild(scrim); };
    if (reduced()) remove(); else { scrim.classList.remove('in'); setTimeout(remove, 220); }
    if (o.onClose) { try { o.onClose(); } catch (err) { console.error('[UI.modal] onClose failed', err); } }
  };
  const head = el('header.ui-modal-head', [
    el('span.ui-eyebrow', [el('b', 'FIG. ' + fig), o.title ? el('span', o.title) : null]),
    o.noClose ? null : el('button.ui-modal-x', { type: 'button', 'aria-label': 'Cerrar', on: { click: () => close() } }, [UI.keycap('ESC'), 'Cerrar'])
  ]);
  const sheet = el('section.ui-modal' + (o.wide ? '.wide' : '') + (o.narrow ? '.narrow' : '') + (o.className ? '.' + o.className : ''), { role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title || 'Diálogo', tabindex: -1 }, [head, bodyEl]);
  let footer = null;
  if (o.actions && o.actions.length) { footer = el('footer.ui-modal-actions'); for (const a of o.actions) footer.appendChild(actionButton(a, close)); sheet.appendChild(footer); }
  const scrim = el('div.ui-scrim', { on: { pointerdown: e => { if (e.target === scrim && !o.static) { e.preventDefault(); close(); } } } }, sheet);
  const ov = { close, el: sheet, body: bodyEl, footer, scrim, fig, isOpen: () => !closed };
  const isTop = () => { const M = LD.Main; return !M || !M.overlays.length || M.overlays[M.overlays.length - 1] === ov; };
  sheet.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !isFormTag(e.target.tagName)) return;
    e.stopPropagation(); e.preventDefault();
    if (isTop()) { close(); sfx('ui_close'); } else e.target.blur();
  });
  root.appendChild(scrim);
  if (LD.Main && LD.Main.pushOverlay) LD.Main.pushOverlay(ov);
  nextFrame(() => scrim.classList.add('in'));
  const first = sheet.querySelector(o.focus || 'input:not([disabled]),textarea,select,.ui-btn.primary,[tabindex="0"]');
  (first || sheet).focus({ preventScroll: true });
  sfx('ui_open');
  return ov;
};
UI.confirm = (title, text, o = {}) => new Promise(resolve => {
  let done = false;
  UI.modal({
    title, narrow: true, className: 'ui-confirm', focus: '.ui-btn.primary,.ui-btn.danger',
    body: el('p.ui-modal-text', text),
    onClose: () => { if (!done) { done = true; resolve(false); } },
    actions: [{ label: o.cancel || 'Cancelar', ghost: true }, { label: o.ok || 'Confirmar', primary: !o.danger, danger: !!o.danger, onClick: () => { done = true; resolve(true); } }]
  });
});

/* ── tooltip (single shared node, follows the pointer inside the stage) ── */
UI.tooltip = (() => {
  let node = null, cur = null, timer = 0, refresh = 0, lx = 0, ly = 0, shown = false;
  const fns = new WeakMap();
  const ensure = () => { if (!node) { node = el('div.ui-tip', { role: 'tooltip' }); stageEl().appendChild(node); } return node; };
  const render = () => {
    const fn = fns.get(cur); let c = null;
    try { c = typeof fn === 'function' ? fn(cur) : fn; } catch (err) { console.error('[UI.tooltip] content failed', err); c = null; }
    if (c === null || c === undefined || c === '' || c === false) return false;
    U.clear(node); addContent(node, c); return true;
  };
  const place = () => {
    if (!shown) return;
    const St = LD.Stage, sc = (St && St.scale) || 1, W = (St && St.W) || 1920, H = (St && St.H) || 1080;
    const r = node.getBoundingClientRect(), w = r.width / sc, h = r.height / sc;
    let x = lx + 16, y = ly + 20;
    if (x + w > W - 8) x = Math.max(8, lx - w - 12);
    if (y + h > H - 8) y = Math.max(8, ly - h - 14);
    node.style.left = (x / 16) + 'rem'; node.style.top = (y / 16) + 'rem';
  };
  const hide = () => { clearTimeout(timer); clearInterval(refresh); timer = 0; refresh = 0; shown = false; cur = null; if (node) node.classList.remove('in'); };
  const show = () => {
    if (!cur || !cur.isConnected) { hide(); return; }
    ensure();
    if (!render()) return;
    shown = true; node.classList.add('in'); place();
    clearInterval(refresh);
    refresh = setInterval(() => { if (!cur || !cur.isConnected) { hide(); return; } if (render()) place(); else hide(); }, 400);
  };
  const onMove = e => { const p = LD.Stage ? LD.Stage.toLogical(e.clientX, e.clientY) : { x: e.clientX, y: e.clientY }; lx = p.x; ly = p.y; if (shown) place(); };
  const onEnter = function (e) { if (cur && cur !== this) hide(); cur = this; onMove(e); clearTimeout(timer); timer = setTimeout(show, 250); };
  const onLeave = function () { if (cur === this) hide(); };
  addEventListener('pointerdown', hide, true);
  addEventListener('keydown', e => { if (e.key === 'Escape') hide(); }, true);
  addEventListener('blur', hide);
  const api = {
    attach(target, contentFn) {
      if (!target) return () => {};
      fns.set(target, contentFn);
      if (!target.dataset.tip) { target.dataset.tip = '1'; target.addEventListener('pointerenter', onEnter); target.addEventListener('pointermove', onMove); target.addEventListener('pointerleave', onLeave); }
      return () => api.detach(target);
    },
    detach(target) {
      if (!target) return;
      fns.delete(target);
      if (target.dataset.tip) { delete target.dataset.tip; target.removeEventListener('pointerenter', onEnter); target.removeEventListener('pointermove', onMove); target.removeEventListener('pointerleave', onLeave); }
      if (cur === target) hide();
    },
    hide, get visible() { return shown; }
  };
  return api;
})();
UI.tipBlock = (title, kicker, text) => el('div', [title ? el('div.ui-tip-h', title) : null, kicker ? el('div.ui-tip-k', kicker) : null, text ? el('div.ui-tip-p', text) : null]);
UI.itemTip = itemId => {
  const d = itemDef(itemId);
  if (!d) return UI.tipBlock(itemId, 'DESCONOCIDO');
  const fluid = d.cat === 'fluid' || d.cat === 'gas';
  return UI.tipBlock(d.name, UI.catName(d.cat) + ' · T' + (d.tier | 0) + (d.fuel ? ' · ' + U.fmt(d.fuel) + ' MJ' : '') + (fluid ? ' · RED DE TUBERÍAS' : ''), d.desc || '');
};

/* ── icons & thumbs (2× backing, rem-sized) ── */
const sized = (c, size, cls) => { c.className = cls; c.style.width = c.style.height = (size / 16) + 'rem'; return c; };
const fallbackIcon = (ctx, def, px) => {
  const m = Math.round(px * 0.14), s = px - 2 * m;
  ctx.fillStyle = def ? (def.color || '#8f8b82') : '#26262a';
  ctx.fillRect(m, m, s, s);
  ctx.strokeStyle = def ? (def.color2 || U.shade(def.color || '#8f8b82', 0.6)) : '#5a5751';
  ctx.lineWidth = Math.max(1, px / 20);
  ctx.strokeRect(m + 0.5, m + 0.5, s - 1, s - 1);
  if (!def) { ctx.fillStyle = '#8f8b82'; ctx.font = '500 ' + Math.round(px * 0.5) + 'px ' + MONO; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', px / 2, px / 2 + 1); }
};
UI.icon = (itemId, size = 20) => {
  const px = Math.max(8, Math.round(size * 2));
  const c = sized(U.canvas(px, px), size, 'ui-icon'), ctx = c.getContext('2d');
  let src = null;
  if (LD.Tex && typeof LD.Tex.icon === 'function') { try { src = LD.Tex.icon(itemId, px); } catch (e) { src = null; } }
  if (src && src.width) ctx.drawImage(src, 0, 0, px, px); else fallbackIcon(ctx, itemDef(itemId), px);
  return c;
};
UI.structThumb = (id, size = 48) => {
  const px = Math.max(8, Math.round(size * 2));
  const c = sized(U.canvas(px, px), size, 'ui-thumb'), ctx = c.getContext('2d');
  const def = R() ? R().structures.get(id) : null;
  let src = null;
  if (def && LD.Sprites && typeof LD.Sprites.thumb === 'function') { try { src = LD.Sprites.thumb(def, px); } catch (e) { src = null; } }
  if (src && src.width) { ctx.drawImage(src, 0, 0, px, px); return c; }
  const n = def ? U.clamp(def.size | 0, 1, 3) : 1, m = Math.round(px * 0.1), cell = (px - 2 * m) / n, tier = def ? def.tier | 0 : 0;
  const col = ((LD.Sprites && LD.Sprites.TIER_COLORS) || TIER_COLORS)[U.clamp(tier, 0, 7)];
  ctx.fillStyle = '#1c1c1f'; ctx.fillRect(m, m, px - 2 * m, px - 2 * m);
  ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, px / 32);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) ctx.strokeRect(m + x * cell + 0.5, m + y * cell + 0.5, cell - 1, cell - 1);
  return c;
};

/* ── composed widgets ── */
UI.itemChip = (itemId, n, o = {}) => {
  const qty = el('span.ui-chip-q.mono'), rate = el('span.ui-chip-r.mono'), cap = el('span.ui-chip-c.mono.dim');
  const chip = el('span.ui-chip', { data: { item: itemId } }, [UI.icon(itemId, o.size || 18), qty, rate, cap]);
  const set = (n2, o2 = o) => {
    n = n2; o = o2;
    qty.textContent = U.fmt(n);
    const r = o.rate;
    if (r === undefined || r === null || Math.abs(r) < 0.0005) rate.hidden = true;
    else { rate.hidden = false; rate.textContent = U.fmtRate(r); rate.className = 'ui-chip-r mono ' + (r > 0.0005 ? 'ok' : r < -0.0005 ? 'bad' : 'dim'); }
    if (o.cap) { cap.hidden = false; cap.textContent = '/ ' + U.fmt(o.cap); chip.classList.toggle('full', n >= o.cap); } else { cap.hidden = true; chip.classList.remove('full'); }
  };
  set(n, o);
  chip.set = set;
  if (o.tip !== false) UI.tooltip.attach(chip, () => UI.itemTip(itemId));
  return chip;
};
const countIn = (layer, id) => {
  const Ec = LD.Sim && LD.Sim.Economy;
  if (Ec && typeof Ec.count === 'function') { try { return Ec.count(layer, id) || 0; } catch (e) { /* fall through */ } }
  const G = LD.G; return (G && G.inv && G.inv[layer] && G.inv[layer][id]) || 0;
};
UI.costList = (cost, o = {}) => {
  const root = el('div.ui-cost' + (o.compact ? '.compact' : ''));
  const rows = [];
  const layer = () => (o.layer !== undefined && o.layer !== null) ? o.layer : (LD.G ? LD.G.view.layer | 0 : 0);
  for (const id in (cost || {})) {
    const have = el('span.ui-cost-have.mono'), need = el('span.ui-cost-need.mono', U.fmt(cost[id]));
    const row = el('div.ui-cost-row', [UI.icon(id, o.compact ? 14 : 18), el('span.ui-cost-name', itemName(id)), need, have]);
    UI.tooltip.attach(row, () => UI.itemTip(id));
    rows.push({ id, row, have, need });
    root.appendChild(row);
  }
  root.refresh = () => {
    let ok = true;
    const hasG = !!LD.G;
    for (const r of rows) {
      const n = hasG ? countIn(layer(), r.id) : null, good = !hasG || n >= cost[r.id];
      r.have.hidden = !hasG;
      if (hasG) r.have.textContent = '/ ' + U.fmt(n);
      r.row.classList.toggle('ok', hasG && good); r.row.classList.toggle('bad', hasG && !good);
      if (!good) ok = false;
    }
    root.affordable = ok;
    root.classList.toggle('unaffordable', !ok);
    return ok;
  };
  root.refresh();
  if (!rows.length) root.appendChild(el('span.ui-cost-free.mono.dim', 'SIN COSTE'));
  return root;
};
UI.tabs = (items, active, onSelect) => {
  const root = el('nav.ui-tabs', { role: 'tablist' });
  const norm = items.map(it => typeof it === 'string' ? { id: it, label: it } : it);
  const btns = new Map();
  for (const it of norm) {
    const b = el('button.ui-tab', { type: 'button', role: 'tab', disabled: !!it.disabled, data: { tab: it.id }, title: it.title || null }, [el('span', it.label), it.badge !== undefined && it.badge !== null ? el('i.ui-tab-badge.mono', String(it.badge)) : null]);
    b.addEventListener('click', () => { if (root.active === it.id) return; root.select(it.id); sfx('ui_tab'); });
    btns.set(it.id, b); root.appendChild(b);
  }
  root.select = (id, silent) => {
    root.active = id;
    for (const [k, b] of btns) { const on = k === id; b.classList.toggle('is-active', on); b.setAttribute('aria-selected', String(on)); }
    if (!silent) { if (onSelect) onSelect(id); root.dispatchEvent(new CustomEvent('select', { detail: id })); }
  };
  root.badge = (id, v) => { const b = btns.get(id); if (!b) return; let i = b.querySelector('.ui-tab-badge'); if (v === null || v === undefined || v === 0 || v === '') { if (i) i.remove(); return; } if (!i) { i = el('i.ui-tab-badge.mono'); b.appendChild(i); } i.textContent = String(v); };
  root.select(active !== undefined ? active : (norm[0] && norm[0].id), true);
  return root;
};
UI.bar = (v, o = {}) => {
  const fill = el('i');
  const root = el('div.ui-bar' + (o.kind ? '.' + o.kind : '') + (o.className ? '.' + o.className : ''), { role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100 }, fill);
  root.set = (v2, kind) => { const p = U.clamp(+v2 || 0); fill.style.width = (p * 100).toFixed(1) + '%'; root.setAttribute('aria-valuenow', Math.round(p * 100)); if (kind !== undefined) root.className = 'ui-bar' + (kind ? ' ' + kind : '') + (o.className ? ' ' + o.className : ''); };
  root.set(v);
  return root;
};
UI.sfxHooks = root => {
  if (!root || root.dataset.sfx) return root;
  root.dataset.sfx = '1';
  let last = null;
  const HOVER = 'button:not([disabled]),a[href],[data-sfx]';
  root.addEventListener('pointerover', e => { const b = e.target.closest && e.target.closest(HOVER); if (!b || b === last || b.hasAttribute('data-nosfx')) return; last = b; sfx('ui_hover'); });
  root.addEventListener('pointerout', e => { if (last && !(e.relatedTarget && last.contains(e.relatedTarget))) last = null; });
  root.addEventListener('click', e => { const b = e.target.closest && e.target.closest('button,a[href],[data-sfx]'); if (!b || b.disabled || b.hasAttribute('data-nosfx')) return; sfx('ui_click'); });
  return root;
};

/* ── form controls (custom, drawn with hairlines) ── */
UI.slider = (o = {}) => {
  const min = o.min === undefined ? 0 : o.min, max = o.max === undefined ? 1 : o.max, step = o.step || 0.01;
  const fmt = o.format || (v => Math.round(v * 100) + ' %');
  const snap = v => { v = U.clamp(+v || 0, min, max); return +(min + Math.round((v - min) / step) * step).toFixed(6); };
  let value = snap(o.value === undefined ? min : o.value);
  const fill = el('i.ui-slider-fill'), knob = el('b.ui-slider-knob'), track = el('div.ui-slider-track', [fill, knob]), val = el('span.ui-slider-val.mono');
  const root = el('div.ui-slider', { role: 'slider', tabindex: 0, 'aria-valuemin': min, 'aria-valuemax': max, 'aria-label': o.label || null }, [track, val]);
  const paint = () => { const p = (value - min) / ((max - min) || 1) * 100; fill.style.width = p + '%'; knob.style.left = p + '%'; val.textContent = fmt(value); root.setAttribute('aria-valuenow', value); root.setAttribute('aria-valuetext', fmt(value)); };
  const set = (v, silent) => { v = snap(v); if (v === value) return false; value = v; paint(); if (!silent && o.onInput) o.onInput(value); return true; };
  const commit = () => { if (o.onChange) o.onChange(value); };
  const fromEvent = e => { const r = track.getBoundingClientRect(); return min + U.clamp((e.clientX - r.left) / (r.width || 1)) * (max - min); };
  track.addEventListener('pointerdown', e => {
    e.preventDefault(); root.focus({ preventScroll: true }); root.classList.add('drag');
    try { track.setPointerCapture(e.pointerId); } catch (err) { /* capture optional */ }
    set(fromEvent(e));
    const mv = ev => set(fromEvent(ev));
    const up = () => { root.classList.remove('drag'); track.removeEventListener('pointermove', mv); track.removeEventListener('pointerup', up); track.removeEventListener('pointercancel', up); commit(); };
    track.addEventListener('pointermove', mv); track.addEventListener('pointerup', up); track.addEventListener('pointercancel', up);
  });
  root.addEventListener('keydown', e => {
    const d = { ArrowLeft: -step, ArrowDown: -step, ArrowRight: step, ArrowUp: step, PageDown: -step * 10, PageUp: step * 10 }[e.key];
    if (d !== undefined) { e.preventDefault(); if (set(value + d)) commit(); }
    else if (e.key === 'Home') { e.preventDefault(); if (set(min)) commit(); }
    else if (e.key === 'End') { e.preventDefault(); if (set(max)) commit(); }
  });
  root.addEventListener('wheel', e => { e.preventDefault(); if (set(value - Math.sign(e.deltaY) * step)) commit(); }, { passive: false });
  root.set = v => set(v, true);
  Object.defineProperty(root, 'value', { get: () => value });
  paint();
  return root;
};
UI.segmented = (options, value, onChange) => {
  const root = el('div.ui-seg', { role: 'radiogroup' });
  const btns = options.map(opt => {
    const b = el('button.ui-seg-b', { type: 'button', role: 'radio', 'aria-checked': String(opt.value === value), title: opt.title || null }, opt.label);
    b.addEventListener('click', () => { if (opt.value === value) return; root.set(opt.value); if (onChange) onChange(opt.value); });
    root.appendChild(b); return b;
  });
  root.set = v => { value = v; options.forEach((opt, i) => btns[i].setAttribute('aria-checked', String(opt.value === v))); };
  Object.defineProperty(root, 'value', { get: () => value });
  return root;
};
UI.toggle = (value, onChange, o = {}) => {
  const box = el('i.ui-toggle-box'), txt = el('span.ui-toggle-t');
  const b = el('button.ui-toggle', { type: 'button', role: 'switch' }, [box, txt]);
  const paint = () => { b.setAttribute('aria-checked', String(!!value)); txt.textContent = value ? (o.on || 'SÍ') : (o.off || 'NO'); };
  b.addEventListener('click', () => { value = !value; paint(); if (onChange) onChange(value); });
  b.set = v => { value = !!v; paint(); };
  Object.defineProperty(b, 'value', { get: () => !!value });
  paint();
  return b;
};

/* ── vertical option list (menu / pause): hover + ↑↓ Enter ── */
UI.optionList = (items, o = {}) => {
  const root = el('div.ui-options' + (o.className ? '.' + o.className : ''), { role: 'menu' });
  const list = { el: root, sel: -1, items: [], buttons: [] };
  const usable = i => { const it = list.items[i]; return it && !it.disabled && !it.hidden; };
  const build = arr => {
    U.clear(root); list.items = arr.filter(it => it && !it.hidden); list.buttons = [];
    list.items.forEach((it, i) => {
      const cls = 'ui-option' + (it.className ? ' ' + it.className : '');
      const kids = [o.index !== false ? el('span.ui-option-i.mono', String(i + 1).padStart(2, '0')) : null, el('span.ui-option-l', it.label), it.hint ? el('span.ui-option-h', it.hint) : null];
      const b = it.href ? el('a', { class: cls, href: it.href, target: '_blank', rel: 'noopener', role: 'menuitem' }, kids)
        : el('button', { class: cls, type: 'button', role: 'menuitem', disabled: !!it.disabled }, kids);
      if (it.disabled) b.setAttribute('aria-disabled', 'true');
      b.addEventListener('click', e => { if (it.disabled) { e.preventDefault(); return; } list.select(i); if (it.onSelect) it.onSelect(e); });
      b.addEventListener('pointerenter', () => { if (!it.disabled) list.select(i); });
      list.buttons.push(b); root.appendChild(b);
    });
    if (!usable(list.sel)) list.select(list.items.findIndex((_, i) => usable(i)));
  };
  list.select = (i, focus) => {
    list.sel = i;
    list.buttons.forEach((b, k) => b.classList.toggle('is-sel', k === i));
    if (focus && list.buttons[i]) list.buttons[i].focus({ preventScroll: true });
  };
  list.move = (d, focus) => {
    const n = list.items.length; if (!n) return;
    let i = list.sel;
    for (let k = 0; k < n; k++) { i = (i + d + n) % n; if (usable(i)) break; }
    if (i !== list.sel) sfx('ui_hover');
    list.select(i, focus);
  };
  list.activate = () => { const b = list.buttons[list.sel]; if (b && !b.disabled) b.click(); };
  list.key = e => {
    switch (e.key) {
      case 'ArrowDown': list.move(1, true); return true;
      case 'ArrowUp': list.move(-1, true); return true;
      case 'Home': list.select(list.items.findIndex((_, i) => usable(i)), true); return true;
      case 'End': { let i = list.items.length - 1; while (i > 0 && !usable(i)) i--; list.select(i, true); return true; }
      case 'Enter': { const b = list.buttons[list.sel]; if (b && document.activeElement !== b) { list.activate(); return true; } return false; }
      default: return false;
    }
  };
  list.refresh = arr => { const id = list.items[list.sel] && list.items[list.sel].id; build(arr); if (id !== undefined) { const i = list.items.findIndex(it => it.id === id); if (i >= 0 && usable(i)) list.select(i); } };
  build(items || []);
  return list;
};
})();
