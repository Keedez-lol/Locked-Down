(() => {
'use strict';
const LD = window.LD, U = LD.U, el = U.el;
const UI = () => LD.UI;
const VERSION = 'v0.1', DEFAULT_NAME = 'Colonia KDZ-01';
const SLOT_NAMES = { auto: 'AUTO', 1: 'RANURA 1', 2: 'RANURA 2', 3: 'RANURA 3' };
const BONE = '#ece7dc', MONO = 'ui-monospace,"SF Mono",Menlo,Consolas,"DejaVu Sans Mono",monospace';
const LOCKUP_UNITS = 7900;              // approximate width of the single-line lockup in 1000-unit cap space
const M = LD.UI.Menu = {};

let root = null, slab = null, canvas = null, nav = null, seedCell = null, contCell = null;
let visible = false, built = false, quizOk = false, proposedSeed = 0, animRaf = 0, animT0 = 0;

const hasSaves = () => { try { return !!(LD.State && LD.State.hasAny()); } catch (e) { return false; } };
const inGame = () => !!LD.G && !!LD.Main && LD.Main.screen === 'game';
const diffName = key => { const D = LD.State && LD.State.DIFFICULTIES; return (D && D[key] && D[key].name) || key || '—'; };
const mul = v => String(Math.round(v * 100) / 100).replace('.', ',');
const newSeed = () => Math.floor(Math.random() * 2147483647);

/* ── lockup drawing ── */
const fontCache = {};
const fontStrokes = ch => {
  if (fontCache[ch]) return fontCache[ch];
  const src = LD.KDZ && LD.KDZ.font && LD.KDZ.font[ch];
  return (fontCache[ch] = src ? src.split('|').map(pl => pl.trim().split(/[ ,]+/).map(Number)) : []);
};
// Flattens the hero K D Z glyph parts and the 4×6 "DUSTRY" lettering into one stroke list in 1000-unit cap space.
const lockupPieces = () => {
  const K = LD.KDZ, g = K && K.glyphs;
  if (!g || !g.K || !g.D || !g.Z) return null;
  const pieces = [];
  let cursor = 0, total = 0;
  const gaps = [0, 110, -120];
  [g.K, g.D, g.Z].forEach((gl, i) => {
    cursor += gaps[i];
    const ox = cursor - gl.x0;
    for (const p of gl.parts) {
      if (p.arc) pieces.push({ arc: true, cx: ox + p.cx, cy: p.cy, r: p.r, a0: p.a0, sweep: p.sweep, len: p.len });
      else pieces.push({ arc: false, x0: ox + p.x0, y0: p.y0, x1: ox + p.x1, y1: p.y1, len: p.len });
      total += p.len;
    }
    cursor = ox + gl.x1;
  });
  const k = 1000 / 6, adv = 5.4 * k;
  cursor += 200;
  for (const ch of 'DUSTRY') {
    for (const pl of fontStrokes(ch)) for (let j = 0; j + 3 < pl.length; j += 2) {
      const x0 = cursor + pl[j] * k, y0 = pl[j + 1] * k, x1 = cursor + pl[j + 2] * k, y1 = pl[j + 3] * k, len = Math.hypot(x1 - x0, y1 - y0);
      pieces.push({ arc: false, x0, y0, x1, y1, len }); total += len;
    }
    cursor += adv;
  }
  return { pieces, total, width: cursor - adv + 4 * k };
};
let pieceCache = null;
const drawLockupLocal = (ctx, x, y, cap, prog) => {
  if (!pieceCache) pieceCache = lockupPieces();
  if (!pieceCache) { ctx.fillStyle = BONE; ctx.font = '500 ' + cap + 'px ' + MONO; ctx.textBaseline = 'alphabetic'; ctx.fillText('KDZDUSTRY', x, y); return { w: ctx.measureText('KDZDUSTRY').width, h: cap }; }
  const s = cap / 1000, hw = (LD.KDZ.PEN_HW || 20) * s;
  ctx.save();
  ctx.strokeStyle = BONE; ctx.lineWidth = 2 * hw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  let rem = U.clamp(prog) * pieceCache.total;
  for (const p of pieceCache.pieces) {
    if (rem <= 0) break;
    const f = rem >= p.len ? 1 : rem / p.len; rem -= p.len;
    ctx.beginPath();
    if (p.arc) ctx.arc(x + p.cx * s, y - p.cy * s, p.r * s, -p.a0, -(p.a0 + p.sweep * f), p.sweep > 0);
    else { ctx.moveTo(x + p.x0 * s, y - p.y0 * s); ctx.lineTo(x + (p.x0 + (p.x1 - p.x0) * f) * s, y - (p.y0 + (p.y1 - p.y0) * f) * s); }
    ctx.stroke();
  }
  ctx.restore();
  return { w: pieceCache.width * s, h: cap };
};
const drawLockup = t => {
  if (!canvas || !visible) return;
  const St = LD.Stage, scale = (St && St.scale) || 1, dpr = (St && St.dpr) || 1;
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 4) return;
  const lw = rect.width / scale;
  const cap = Math.min(lw / (LOCKUP_UNITS / 1000), 128);
  const lh = Math.ceil(cap * 1.32);
  const bw = Math.round(rect.width * dpr), bh = Math.round(lh * scale * dpr);
  if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; canvas.style.height = (lh / 16) + 'rem'; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(bw / lw, 0, 0, bh / lh, 0, 0);
  ctx.clearRect(0, 0, lw, lh);
  const y = cap * 1.09, prog = UI().reducedMotion() ? 1 : U.easeOutExpo(t / 1.8);
  const Sp = LD.Sprites;
  if (Sp && typeof Sp.lockup === 'function') {
    try {
      const m = Sp.lockup(ctx, 0, y, cap, t);
      if (m && typeof m.w === 'number' && m.w > lw + 1) { ctx.clearRect(0, 0, lw, lh); Sp.lockup(ctx, 0, y, cap * lw / m.w, t); }
      return;
    } catch (err) { console.error('[Menu] Sprites.lockup failed, using local pen', err); ctx.clearRect(0, 0, lw, lh); }
  }
  drawLockupLocal(ctx, 0, y, cap, prog);
};
const animateLockup = () => {
  cancelAnimationFrame(animRaf);
  animT0 = performance.now();
  const step = now => {
    const t = (now - animT0) / 1000;
    drawLockup(t);
    if (visible && t < 2.4 && !UI().reducedMotion()) animRaf = requestAnimationFrame(step); else { animRaf = 0; drawLockup(10); }
  };
  animRaf = requestAnimationFrame(step);
};

/* ── DOM ── */
const items = () => [
  { id: 'new', label: 'Nueva partida', onSelect: () => M.newGame() },
  { id: 'continue', label: 'Continuar', disabled: !hasSaves(), onSelect: () => M.showSlots('load') },
  { id: 'enc', label: 'Enciclopedia', onSelect: () => M.openEncyclopedia() },
  { id: 'settings', label: 'Ajustes', onSelect: () => { const S = LD.UI.Settings; if (S && S.open) S.open(); else UI().toast('Ajustes no disponibles', 'warn'); } },
  { id: 'quiz', label: 'Cuestionario', href: './cuestionario.html', hidden: !quizOk, hint: 'NUEVA PESTAÑA' }
];
const tbCell = (label, value, cls) => { const b = el('b', value); const c = el('div' + (cls ? '.' + cls : ''), [el('small', label), b]); c.value = b; return c; };
const onKey = e => {
  if (!visible || !nav) return;
  const Mn = LD.Main;
  if (Mn && (Mn.screen !== 'menu' || (Mn.overlayDepth && Mn.overlayDepth() > 0))) return;
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (nav.key(e)) e.preventDefault();
};
const checkQuiz = () => {
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
  try { fetch('./cuestionario.html', { method: 'HEAD', cache: 'no-store' }).then(r => { if (r.ok) { quizOk = true; M.refresh(); } }).catch(() => { /* hidden when absent */ }); } catch (e) { /* no fetch */ }
};

M.init = r => {
  if (built) return M;
  built = true; root = r || document.getElementById('menu-root');
  root.classList.add('menu');
  proposedSeed = newSeed();
  canvas = el('canvas.menu-lockup', { role: 'img', 'aria-label': 'KDZDUSTRY' });
  nav = UI().optionList(items(), { className: 'menu-nav' });
  seedCell = tbCell('SEMILLA', String(proposedSeed), 'grow');
  contCell = tbCell('HOJA', '01 / 01');
  const tb = el('div.menu-tb', [tbCell('DWG NO.', 'KDZ-DUSTRY'), tbCell('REV', 'A'), tbCell('VER', LD.VERSION || VERSION), contCell, seedCell]);
  const hint = el('div.menu-hint', [UI().keycap('↑'), UI().keycap('↓'), el('span', 'navegar'), el('i'), UI().keycap('↵'), el('span', 'seleccionar'), el('i'), UI().keycap('Esc'), el('span', 'cerrar')]);
  slab = el('aside.menu-slab', { 'aria-label': 'Menú principal' }, [
    el('div.menu-eyebrow', [el('span.menu-eyebrow-k', 'KDZ / DUSTRY'), el('span', '— Simulador industrial de estratos')]),
    canvas,
    el('div.menu-caption', [el('span', 'FIG. 1'), el('span', 'Lockup · monolínea esténcil'), el('span', 'Trazo 40 / Hueco 60')]),
    nav.el,
    el('div.menu-foot', [tb, hint])
  ]);
  root.appendChild(slab);
  UI().sfxHooks(root);
  addEventListener('keydown', onKey);
  if (LD.Events) LD.Events.on('stage:resize', () => { if (visible) drawLockup(10); });
  checkQuiz();
  return M;
};
M.refresh = () => {
  if (!nav) return;
  nav.refresh(items());
  if (contCell) { const n = LD.State ? LD.State.slots().filter(s => s.exists).length : 0; contCell.value.textContent = String(n).padStart(2, '0') + ' / 04'; }
};
M.show = () => {
  if (!built) M.init();
  visible = true; root.hidden = false;
  proposedSeed = newSeed();
  if (seedCell) seedCell.value.textContent = String(proposedSeed);
  M.refresh();
  nav.select(hasSaves() ? 1 : 0);
  animateLockup();
};
M.hide = () => { visible = false; if (root) root.hidden = true; cancelAnimationFrame(animRaf); animRaf = 0; UI().tooltip.hide(); };
M.visible = () => visible;

/* ── new game ── */
M.newGame = () => {
  const ui = UI(), D = (LD.State && LD.State.DIFFICULTIES) || { normal: { name: 'Normal', desc: '' } };
  let diff = D.normal ? 'normal' : Object.keys(D)[0];
  const name = ui.input({ value: DEFAULT_NAME, maxlength: 32, placeholder: 'Nombre de la colonia' });
  const seed = ui.input({ value: String(proposedSeed), mono: true, maxlength: 32, placeholder: 'aleatoria' });
  const rows = {};
  const pick = key => { diff = key; for (const k in rows) rows[k].setAttribute('aria-checked', String(k === key)); };
  const diffList = el('div.ng-diffs', { role: 'radiogroup', 'aria-label': 'Dificultad' });
  for (const key in D) {
    const d = D[key];
    const spec = d.waves === false ? 'Sin oleadas' : 'Intervalo ×' + mul(d.interval == null ? 1 : d.interval) + ' · PV ×' + mul(d.enemyHp == null ? 1 : d.enemyHp) + ' · Daño ×' + mul(d.enemyDmg == null ? 1 : d.enemyDmg);
    const b = el('button.ng-diff', { type: 'button', role: 'radio', 'aria-checked': String(key === diff), on: { click: () => pick(key) } }, [
      el('span.ng-diff-name', d.name), el('span.ng-diff-desc', d.desc || ''), el('span.ng-diff-spec.mono', spec + ' · Coste ×' + mul(d.cost == null ? 1 : d.cost) + ' · Obra ×' + mul(d.build == null ? 1 : d.build))
    ]);
    rows[key] = b; diffList.appendChild(b);
  }
  diffList.addEventListener('keydown', e => { const keys = Object.keys(rows), i = keys.indexOf(diff); if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); pick(keys[(i + 1) % keys.length]); rows[diff].focus(); } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); pick(keys[(i - 1 + keys.length) % keys.length]); rows[diff].focus(); } });
  const found = () => {
    const Mn = LD.Main;
    if (!Mn || !Mn.startNewGame) { ui.toast('El motor no está listo', 'bad'); return false; }
    const n = name.value.trim().slice(0, 32) || DEFAULT_NAME;
    modal.close();
    Mn.startNewGame({ name: n, difficulty: diff, seed: seed.value.trim() });
    return false;
  };
  const form = el('form.ng-form', { on: { submit: e => { e.preventDefault(); found(); } } }, [
    ui.field('Nombre', name),
    ui.field('Dificultad', diffList, { stack: true }),
    ui.field('Semilla', el('div.ng-seed', [seed, ui.button('Aleatoria', { small: true, onClick: () => { seed.value = String(newSeed()); seed.focus(); } })]), { hint: 'Determina el mapa de cada estrato. Acepta números o texto; en blanco se elige una al azar.' }),
    el('button', { type: 'submit', hidden: true, tabindex: -1 })
  ]);
  const modal = ui.modal({ title: 'Nueva partida', body: form, focus: 'input', actions: [{ label: 'Cancelar', ghost: true }, { label: 'Fundar colonia', primary: true, onClick: found }] });
  name.select();
  return modal;
};

/* ── slots (load / save) ── */
let slotsModal = null;
const loadSlot = async slot => {
  const Mn = LD.Main, ui = UI();
  if (!Mn || !Mn.continueGame) { ui.toast('El motor no está listo', 'bad'); return; }
  if (inGame() && Mn.unsavedChanges && Mn.unsavedChanges() && !(await ui.confirm('Cargar partida', 'Hay cambios sin guardar en la colonia actual. ¿Cargar de todos modos?', { ok: 'Cargar' }))) return;
  const G = Mn.continueGame(slot);
  if (G) G.meta.saveName = slot;
};
const withSlotState = (slot, fn) => {
  const prev = LD.G, G = LD.State.load(slot);
  try { return G ? fn(G) : null; } finally { LD.G = prev; }
};
const download = (text, filename) => {
  try {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = el('a', { href: url, download: filename }); document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (e) { UI().toast('No se pudo generar el archivo', 'bad'); }
};
const copyText = async (text, ta) => {
  try { await navigator.clipboard.writeText(text); UI().toast('Copiado al portapapeles', 'ok'); return; } catch (e) { /* fallback below */ }
  try { ta.focus(); ta.select(); document.execCommand('copy'); UI().toast('Copiado al portapapeles', 'ok'); } catch (e) { UI().toast('Selecciona el texto y cópialo manualmente', 'warn'); }
};
M.exportModal = (str, name) => {
  const ui = UI(), ta = ui.textarea({ value: str, readonly: true, rows: 9 });
  const file = 'kdzdustry-' + String(name || 'partida').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + new Date().toISOString().slice(0, 10) + '.txt';
  return ui.modal({
    title: 'Exportar partida', body: [el('p.ui-modal-text', 'Cadena de guardado codificada. Guárdala en un archivo o pégala en IMPORTAR en cualquier navegador.'), ta, el('div.slots-size.mono.dim', (str.length / 1024).toFixed(1).replace('.', ',') + ' KiB')],
    actions: [{ label: 'Descargar .txt', ghost: true, left: true, close: false, onClick: () => download(str, file) }, { label: 'Copiar', primary: true, close: false, onClick: () => copyText(str, ta) }, { label: 'Cerrar' }]
  });
};
M.importModal = () => {
  const ui = UI(), ta = ui.textarea({ placeholder: 'Pega aquí la cadena exportada…', rows: 9 });
  const pickFile = () => {
    const inp = el('input', { type: 'file', accept: '.txt,text/plain', hidden: true });
    inp.addEventListener('change', () => { const f = inp.files && inp.files[0]; if (!f) return; f.text().then(t => { ta.value = t.trim(); ta.focus(); }).catch(() => ui.toast('No se pudo leer el archivo', 'bad')); });
    document.body.appendChild(inp); inp.click(); setTimeout(() => inp.remove(), 60000);
  };
  const doImport = async () => {
    const s = ta.value.trim();
    if (!s) { ui.toast('Pega una cadena de guardado', 'warn'); return false; }
    const Mn = LD.Main;
    if (inGame() && Mn.unsavedChanges && Mn.unsavedChanges() && !(await ui.confirm('Importar partida', 'Se sustituirá la colonia actual y hay cambios sin guardar. ¿Continuar?', { ok: 'Importar' }))) return false;
    const prev = LD.G, G = LD.State.importString(s);
    if (!G) { LD.G = prev; ui.toast('Cadena inválida o dañada', 'bad'); return false; }
    try { if (LD.Sim && LD.Sim.init) LD.Sim.init(G, { fresh: false }); }
    catch (err) { console.error('[Menu] import: Sim.init failed', err); LD.G = prev; ui.toast('La partida importada no se pudo inicializar', 'bad'); return false; }
    G.meta.saveName = '';
    if (Mn && Mn.enterGame) Mn.enterGame();
    ui.toast('Partida importada: ' + G.meta.name, 'ok', 3200);
    return true;
  };
  return ui.modal({
    title: 'Importar partida', body: [el('p.ui-modal-text', 'Pega una cadena exportada. La partida se abre sin guardarse en ninguna ranura: guarda después desde PAUSA › GUARDAR.'), ta],
    actions: [{ label: 'Abrir archivo…', ghost: true, left: true, close: false, onClick: pickFile }, { label: 'Cancelar', ghost: true }, { label: 'Importar y cargar', primary: true, close: false, onClick: () => { doImport(); } }]
  });
};
const slotRow = (s, mode, rerender) => {
  const ui = UI(), sum = s.summary, cur = inGame() && LD.G.meta.saveName === s.slot;
  const row = el('div.slot' + (s.exists ? '' : '.empty') + (cur ? '.current' : ''));
  row.appendChild(el('div.slot-head', [
    el('span.slot-tag.mono', SLOT_NAMES[s.slot] || s.slot.toUpperCase()),
    sum ? el('span.slot-name', sum.name) : el('span.slot-name.dim', s.exists ? 'Partida sin resumen' : 'Vacía'),
    cur ? el('span.slot-cur.mono', 'ACTUAL') : null,
    sum && sum.lastSave ? el('span.slot-date.mono', ui.fmtDate(sum.lastSave)) : null
  ]));
  if (sum) row.appendChild(el('div.slot-meta.mono', [diffName(sum.difficulty), 'Día ' + (sum.day || 1), U.eraName(sum.era || 0), U.fmtTime(sum.playtime || 0), (sum.structures || 0) + ' estructuras', (sum.techs || 0) + ' tecnologías'].map(t => el('span', t))));
  const acts = el('div.slot-actions');
  if (mode === 'save') acts.appendChild(ui.button(s.exists ? 'Sobrescribir' : 'Guardar aquí', { primary: !s.exists, small: true, onClick: async () => {
    if (s.exists && !(await ui.confirm('Sobrescribir ranura', 'Se reemplazará la partida guardada en ' + SLOT_NAMES[s.slot] + (sum ? ' («' + sum.name + '»)' : '') + '.', { ok: 'Sobrescribir' }))) return;
    if (LD.Main.save(s.slot)) { LD.G.meta.saveName = s.slot; rerender(); }
  } }));
  else if (s.exists) acts.appendChild(ui.button('Cargar', { primary: true, small: true, onClick: () => loadSlot(s.slot) }));
  if (s.exists) {
    acts.appendChild(ui.button('Exportar', { small: true, ghost: true, onClick: () => { const str = withSlotState(s.slot, G => LD.State.exportString(G)); if (str) M.exportModal(str, sum && sum.name); else ui.toast('No se pudo leer la partida', 'bad'); } }));
    acts.appendChild(ui.button('Borrar', { small: true, danger: true, onClick: async () => {
      if (!(await ui.confirm('Borrar partida', 'Se eliminará la partida de ' + SLOT_NAMES[s.slot] + (sum ? ' («' + sum.name + '»)' : '') + '. Esta acción no se puede deshacer.', { ok: 'Borrar', danger: true }))) return;
      LD.State.deleteSlot(s.slot);
      if (inGame() && LD.G.meta.saveName === s.slot) LD.G.meta.saveName = '';
      ui.toast('Partida borrada', 'info'); rerender();
    } }));
  }
  row.appendChild(acts);
  return row;
};
M.showSlots = mode => {
  const ui = UI();
  if (!LD.State) { ui.toast('Almacenamiento no disponible', 'bad'); return null; }
  mode = mode === 'save' && inGame() ? 'save' : 'load';
  if (slotsModal && slotsModal.isOpen()) slotsModal.close();
  const list = el('div.slots');
  const render = () => { U.clear(list); for (const s of LD.State.slots()) list.appendChild(slotRow(s, mode, render)); };
  render();
  const actions = [];
  if (inGame()) actions.push({ label: 'Exportar actual', ghost: true, left: true, close: false, onClick: () => M.exportModal(LD.State.exportString(), LD.G.meta.name) });
  actions.push({ label: 'Importar…', ghost: true, left: !inGame(), close: false, onClick: () => M.importModal() });
  actions.push({ label: 'Cerrar' });
  const intro = mode === 'save' ? 'El autoguardado usa la ranura AUTO' + (LD.Settings ? ' cada ' + (LD.Settings.get().autosave || 0) + ' min' : '') + '. Las ranuras 1–3 son manuales.' : 'Elige una ranura. Las partidas se guardan en este navegador; usa EXPORTAR para llevarlas a otro.';
  slotsModal = ui.modal({ title: mode === 'save' ? 'Guardar partida' : 'Cargar partida', body: [el('p.ui-modal-text', intro), list], actions, focus: '.slot .ui-btn.primary,.ui-btn', onClose: () => { slotsModal = null; if (visible) M.refresh(); } });
  return slotsModal;
};

/* ── encyclopedia from the menu: browse the most recent save without entering the game ── */
M.openEncyclopedia = () => {
  const ui = UI(), Enc = LD.UI.Encyclopedia;
  if (!Enc || typeof Enc.open !== 'function') { ui.toast('Enciclopedia no disponible', 'warn'); return; }
  if (LD.G) { Enc.open(); return; }
  const slots = LD.State ? LD.State.slots().filter(s => s.exists) : [];
  if (!slots.length) { ui.toast('No hay partidas guardadas: la enciclopedia muestra lo descubierto en tu colonia', 'info', 3400); return; }
  slots.sort((a, b) => ((b.summary && b.summary.lastSave) || 0) - ((a.summary && a.summary.lastSave) || 0));
  const G = LD.State.load(slots[0].slot);
  if (!G) { ui.toast('No se pudo leer la partida', 'bad'); return; }
  const Mn = LD.Main, depth = Mn ? Mn.overlays.length : 0;
  const restore = () => { if (LD.G === G && (!Mn || Mn.screen !== 'game')) LD.G = null; };
  try { Enc.open(); } catch (err) { console.error('[Menu] Encyclopedia.open failed', err); restore(); ui.toast('No se pudo abrir la enciclopedia', 'bad'); return; }
  const top = Mn && Mn.overlays.length > depth ? Mn.overlays[Mn.overlays.length - 1] : null;
  if (top && typeof top.close === 'function') { const orig = top.close; top.close = function (...a) { const r = orig.apply(this, a); restore(); return r; }; }
  else if (LD.Events) LD.Events.once('screen:changed', restore);
  ui.toast('Enciclopedia de «' + G.meta.name + '» (' + SLOT_NAMES[slots[0].slot] + ')', 'info', 2400);
};
})();
