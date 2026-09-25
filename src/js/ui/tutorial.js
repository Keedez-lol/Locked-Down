(() => {
'use strict';
const LD = window.LD, U = LD.U;
LD.UI = LD.UI || {};
const el = U.el;
const TOTAL = 8, W = 1920, H = 1080, CARD_W = 352;

const state = { active: false, step: 0, root: null, card: null, ring: null, line: null, dot: null, timer: 0, offs: [], cam: { moved: false, zoomed: false }, advancing: 0, completed: false, lastAnchor: null, keyFn: null, wheelFn: null };
const G = () => LD.G;
const Rg = () => LD.Registry;
const sfx = n => { const A = LD.Audio; if (A && A.play) { try { A.play(n); } catch (e) { /* optional */ } } };
const toast = (t, k, ms) => { if (LD.UI.toast) LD.UI.toast(t, k, ms); };
const nameOf = id => { const s = Rg().structure(id); return s ? s.name : id; };
const has = id => { const g = G(); if (!g) return false; for (const k in g.structures) if (g.structures[k].id === id) return true; return false; };
const hasRecipe = id => { const g = G(); if (!g) return false; for (const k in g.structures) { const s = g.structures[k]; if (s.id === id && s.recipe) return true; } return false; };
const anyWall = () => { const g = G(); if (!g) return false; for (const k in g.structures) { const d = Rg().structure(g.structures[k].id); if (d && d.wall) return true; } return false; };
const inv0 = id => { const g = G(); return g && g.inv && g.inv[0] ? (g.inv[0][id] || 0) : 0; };
const researchStarted = () => { const g = G(); return !!g && (!!g.research.current || U.count(g.research.done) > 0); };
const powerOn = () => { const P = LD.Sim && LD.Sim.Power; if (!P || !P.summary) return false; try { const s = P.summary(0); return !!s && s.gen > 0; } catch (e) { return false; } };
const unlocked = id => { const Rs = LD.Sim && LD.Sim.Research; if (Rg().isStart('structure', id)) return true; if (Rs && Rs.isUnlocked) { try { return !!Rs.isUnlocked('structure', id); } catch (e) { return false; } } const g = G(); const t = Rg().unlockerOf('structure', id); return !!(g && t && g.research.done[t]); };
const techFor = id => { const t = Rg().unlockerOf('structure', id); const d = t && Rg().tech(t); return d ? d.name : null; };
const kbd = t => el('kbd', t);

const STEPS = [
  { id: 'welcome', anchor: 'hud-top', title: 'Bienvenido a KDZDUSTRY', manual: true,
    body: () => ['Estás sellado sobre cinco estratos de corteza. Empiezas con palos y piedras; el objetivo es llegar al núcleo y a la fusión.',
      ['Mueve la cámara con ', kbd('W'), kbd('A'), kbd('S'), kbd('D'), ' o las flechas y haz zoom con la rueda. Las teclas ', kbd('1'), '–', kbd('5'), ' cambian de estrato cuando lo hayas abierto.']],
    progress: () => [['Desplazar la cámara', state.cam.moved], ['Hacer zoom', state.cam.zoomed]],
    check: () => state.cam.moved && state.cam.zoomed },
  { id: 'gather', anchor: 'hud-dock', title: 'Recolección manual',
    body: () => [['Pulsa ', kbd('H'), ' para coger la herramienta de mano y haz clic sobre árboles y rocas. Cada golpe entrega un objeto y tarda 1,2 s; los árboles alternan palos y troncos.'], ['Los tablones se hacen en el ', el('b', 'Almacén central'), ': haz clic en él y elige la receta «Tablón» (1 tronco → 2). Reúne 20 palos, 6 tablones y 10 piedras.']],
    progress: () => [['Palos ' + U.fmtInt(inv0('stick')) + ' / 20', inv0('stick') >= 20], ['Tablones ' + U.fmtInt(inv0('plank')) + ' / 6', inv0('plank') >= 6], ['Piedra ' + U.fmtInt(inv0('stone')) + ' / 10', inv0('stone') >= 10]],
    check: () => inv0('stick') >= 20 && inv0('stone') >= 10 && inv0('plank') >= 6 },
  { id: 'workbench', anchor: 'hud-dock', title: 'Tu primera máquina',
    body: () => [['Pulsa ', kbd('B'), ', abre Procesado y coloca una ', el('b', nameOf('workbench')), ' pegada al Almacén central.'], 'Las estructuras que tocan el almacén quedan enlazadas: reciben y entregan materiales sin cintas.'],
    progress: () => [[nameOf('workbench') + ' colocada', has('workbench')]],
    check: () => has('workbench') },
  { id: 'recipe', anchor: 'hud-tray', title: 'Recetas y cintas', manual: true,
    body: () => ['Haz clic en la mesa para seleccionarla y elige una receta en el panel derecho. Cada máquina fabrica una sola receta; puedes aplicarla a todas las de su tipo.', ['Si una máquina no toca el almacén, únela con ', el('b', nameOf('conveyor_wood')), ': sin enlace se detiene con el aviso "sin enlace".']],
    progress: () => [['Receta asignada a la mesa', hasRecipe('workbench')]],
    check: () => hasRecipe('workbench') },
  { id: 'nature', anchor: 'hud-dock', title: 'Producción automática',
    body: () => [['Coloca una ', el('b', nameOf('woodcutter')), ' junto a un bosque y una ', el('b', nameOf('quarry')), ' sobre roca. Trabajan solas y llenan el inventario del estrato.'], 'La bandeja inferior muestra existencias, ritmo y tope por objeto: por encima del tope la producción se para.'],
    progress: () => [[nameOf('woodcutter'), has('woodcutter')], [nameOf('quarry'), has('quarry')]],
    check: () => has('woodcutter') && has('quarry') },
  { id: 'research', anchor: 'hud-research', title: 'Investigación',
    body: () => [['Construye una ', el('b', nameOf('study_table')), ' y fabrica Saber primitivo en la mesa de trabajo. Abre el árbol con ', kbd('T'), ' y lanza tu primera tecnología.'], 'La investigación se paga desde el inventario de la superficie y avanza mientras un laboratorio del nivel adecuado trabaja.'],
    progress: () => [[nameOf('study_table'), has('study_table')], ['Tecnología en curso', researchStarted()]],
    check: () => researchStarted() },
  { id: 'power', anchor: 'hud-power', title: 'Energía y cables',
    body: () => { const need = !unlocked('water_wheel') && techFor('water_wheel'); return [['Coloca una ', el('b', nameOf('water_wheel')), ' tocando agua y tiende ', el('b', nameOf('drive_shaft')), ' hasta las máquinas. Las estructuras conducen por sí mismas; los ejes cruzan casillas vacías y cintas.'], 'La barra superior compara generación y consumo de la capa: por debajo de 1, todas las máquinas de la red van más lentas.', need ? ['Primero investiga ', el('b', need), '.'] : null]; },
    progress: () => [[nameOf('water_wheel'), has('water_wheel') || has('windmill')], [nameOf('drive_shaft'), has('drive_shaft')]],
    check: () => ((has('water_wheel') || has('windmill')) && has('drive_shaft')) || (powerOn() && has('drive_shaft')) },
  { id: 'defense', anchor: 'hud-threat', title: 'Amenazas y defensa',
    body: () => [['La fauna atacará el Almacén central cuando el contador de la oleada llegue a cero; de noche las oleadas crecen. La amenaza sube sobre todo con la energía que manejas.'], ['Levanta una ', el('b', nameOf('watchtower')), ' con flechas y una ', el('b', nameOf('palisade')), ' en la ruta de entrada. Los enemigos rodean los muros o abren brecha por el más débil.']],
    progress: () => [[nameOf('watchtower'), has('watchtower')], ['Muro o empalizada', anyWall()]],
    check: () => has('watchtower') && anyWall() }
];

/* ── DOM ── */
function mount() {
  if (state.root) return;
  const host = document.getElementById('overlay-root') || document.body;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'tut-svg'); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('preserveAspectRatio', 'none');
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('vector-effect', 'non-scaling-stroke');
  const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  dot.setAttribute('r', '3'); dot.setAttribute('vector-effect', 'non-scaling-stroke');
  svg.append(line, dot);
  state.line = line; state.dot = dot;
  state.ring = el('div.tut-ring');
  state.card = el('div.tut-card');
  state.root = el('div.tut-root' + (LD.Settings && LD.Settings.get().reducedMotion ? '.no-anim' : ''), [svg, state.ring, state.card]);
  host.appendChild(state.root);
}
function unmount() {
  if (state.root && state.root.parentNode) state.root.parentNode.removeChild(state.root);
  state.root = null; state.card = null; state.ring = null; state.line = null; state.dot = null;
}
function renderCard() {
  const s = STEPS[state.step - 1]; if (!s || !state.card) return;
  const card = state.card; U.clear(card);
  const body = (s.body() || []).filter(Boolean).map(p => el('p', p));
  const prog = (s.progress ? s.progress() : []).map(([t, ok]) => el('li' + (ok ? '.ok' : ''), [el('i'), t]));
  const fold = el('button.tut-fold', { type: 'button', title: state.collapsed ? 'Mostrar el paso' : 'Ocultar mientras lo haces', 'aria-label': 'Plegar tutorial', on: { click: () => { state.collapsed = !state.collapsed; sfx('ui_click'); renderCard(); } } }, state.collapsed ? '▴' : '▾');
  card.classList.toggle('collapsed', !!state.collapsed);
  card.append(
    el('div.tut-eyebrow', [el('span', 'Tutorial'), el('b', 'Paso ' + state.step + ' / ' + TOTAL), fold]),
    el('h3', s.title),
    ...body,
    prog.length ? el('ul.tut-progress', prog) : null,
    el('div.tut-actions', [
      el('button.tut-btn.skip', { type: 'button', on: { click: () => { sfx('ui_click'); skip(); } } }, 'Saltar tutorial'),
      el('div.spacer'),
      s.manual ? el('button.tut-btn.next', { type: 'button', on: { click: () => { sfx('ui_click'); advance(true); } } }, 'Siguiente') : el('span.tut-wait', 'Se completa solo')
    ])
  );
  card.classList.toggle('done', !!state.completed);
  if (LD.UI.sfxHooks) { try { LD.UI.sfxHooks(card); } catch (e) { /* optional */ } }
  place();
}
function targetRect(id) {
  const t = id && document.getElementById(id);
  if (!t || !LD.Stage) return null;
  const r = t.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return null;
  const a = LD.Stage.toLogical(r.left, r.top), b = LD.Stage.toLogical(r.right, r.bottom);
  return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
}
function place() {
  const s = STEPS[state.step - 1]; if (!s || !state.card || !state.root) return;
  const u = (LD.Stage && LD.Stage.scale) || 1;
  const rect = targetRect(s.anchor);
  const cw = CARD_W, ch = Math.max(120, state.card.offsetHeight / u);
  const M = 24, GAP = 28;
  let cx, cy;
  if (!rect) {
    cx = (W - cw) / 2; cy = H - ch - 140;
    state.ring.hidden = true; state.line.setAttribute('opacity', '0'); state.dot.setAttribute('opacity', '0');
  } else {
    const tcx = rect.x + rect.w / 2, tcy = rect.y + rect.h / 2;
    const tall = rect.h > H * 0.45, wide = rect.w > W * 0.45;
    let side;
    if (tall) side = tcx < W / 2 ? 'right' : 'left';
    else if (wide) side = tcy < H / 2 ? 'below' : 'above';
    else if (tcx < W * 0.25) side = 'right';
    else if (tcx > W * 0.75) side = 'left';
    else side = tcy < H / 2 ? 'below' : 'above';
    if (side === 'below' && rect.y + rect.h + GAP + ch > H - M) side = 'above';
    if (side === 'above' && rect.y - GAP - ch < M) side = tcx < W / 2 ? 'right' : 'left';
    if (side === 'right' && rect.x + rect.w + GAP + cw > W - M) side = 'left';
    if (side === 'left' && rect.x - GAP - cw < M) side = 'below';
    if (side === 'below') { cx = tcx - cw / 2; cy = rect.y + rect.h + GAP; }
    else if (side === 'above') { cx = tcx - cw / 2; cy = rect.y - GAP - ch; }
    else if (side === 'right') { cx = rect.x + rect.w + GAP; cy = tcy - ch / 2; }
    else { cx = rect.x - GAP - cw; cy = tcy - ch / 2; }
    cx = U.clamp(cx, M, W - cw - M); cy = U.clamp(cy, M, H - ch - M);
    const pad = 6;
    state.ring.hidden = false;
    Object.assign(state.ring.style, { left: ((rect.x - pad) / 16) + 'rem', top: ((rect.y - pad) / 16) + 'rem', width: ((rect.w + pad * 2) / 16) + 'rem', height: ((rect.h + pad * 2) / 16) + 'rem' });
    // pointer: from the card edge facing the target to the nearest point on the ring
    const ccx = cx + cw / 2, ccy = cy + ch / 2;
    const px = U.clamp(ccx, rect.x - pad, rect.x + rect.w + pad), py = U.clamp(ccy, rect.y - pad, rect.y + rect.h + pad);
    let sx = ccx, sy = ccy;
    if (side === 'below') { sy = cy; sx = U.clamp(px, cx + 12, cx + cw - 12); }
    else if (side === 'above') { sy = cy + ch; sx = U.clamp(px, cx + 12, cx + cw - 12); }
    else if (side === 'right') { sx = cx; sy = U.clamp(py, cy + 12, cy + ch - 12); }
    else { sx = cx + cw; sy = U.clamp(py, cy + 12, cy + ch - 12); }
    state.line.setAttribute('x1', sx.toFixed(1)); state.line.setAttribute('y1', sy.toFixed(1));
    state.line.setAttribute('x2', px.toFixed(1)); state.line.setAttribute('y2', py.toFixed(1));
    state.line.setAttribute('opacity', '1');
    state.dot.setAttribute('cx', px.toFixed(1)); state.dot.setAttribute('cy', py.toFixed(1)); state.dot.setAttribute('opacity', '1');
  }
  Object.assign(state.card.style, { left: (cx / 16) + 'rem', top: (cy / 16) + 'rem', width: (cw / 16) + 'rem' });
  state.lastAnchor = rect ? [rect.x, rect.y, rect.w, rect.h].join(',') : 'none';
}

/* ── flow ── */
function show(n) {
  const g = G(); if (!g) return;
  state.step = U.clamp(n | 0, 1, TOTAL);
  g.tutorial.step = state.step;
  state.completed = false;
  mount(); renderCard();
  requestAnimationFrame(place);
  if (LD.Events) LD.Events.emit('tutorial:step', state.step);
}
function advance(manual) {
  if (!state.active || state.advancing) return;
  if (state.step >= TOTAL) { finish(); return; }
  if (manual) { show(state.step + 1); sfx('ui_open'); return; }
  state.completed = true; renderCard(); sfx('objective');
  state.advancing = setTimeout(() => { state.advancing = 0; if (!state.active) return; show(state.step + 1); sfx('ui_open'); }, 900);
}
function check() {
  if (!state.active || state.advancing) return;
  const s = STEPS[state.step - 1]; if (!s) return;
  let ok = false; try { ok = !!s.check(); } catch (e) { ok = false; }
  if (ok) { if (state.step >= TOTAL) { state.completed = true; renderCard(); sfx('objective'); state.advancing = setTimeout(() => { state.advancing = 0; finish(); }, 900); } else advance(false); }
  else if (state.card && s.progress) {
    const items = state.card.querySelectorAll('.tut-progress li');
    const prog = s.progress();
    prog.forEach(([t, done], i) => { const li = items[i]; if (!li) return; li.classList.toggle('ok', !!done); if (li.lastChild && li.lastChild.nodeType === 3) li.lastChild.textContent = t; });
  }
}
function poll() {
  if (!state.active) return;
  const overlays = LD.Main && LD.Main.overlays ? LD.Main.overlays.length : 0;
  if (state.root) state.root.classList.toggle('hidden', overlays > 0 || (LD.Main && LD.Main.screen !== 'game'));
  check();
  const s = STEPS[state.step - 1];
  if (s && state.card) { const r = targetRect(s.anchor); const key = r ? [r.x, r.y, r.w, r.h].join(',') : 'none'; if (key !== state.lastAnchor) place(); }
}
function finish() {
  const g = G();
  if (g) { g.tutorial.done = true; g.tutorial.step = TOTAL; }
  stop();
  sfx('research_done');
  toast('Tutorial completado. Los objetivos siguen en la tarjeta de la derecha.', 'ok', 4000);
  if (LD.Events) LD.Events.emit('tutorial:done', TOTAL);
}
function bind() {
  const E = LD.Events; if (!E) return;
  const c = () => check();
  state.offs = [E.on('inv:changed', c), E.on('structure:placed', c), E.on('structure:built', c), E.on('tech:started', c), E.on('tech:researched', c), E.on('structure:selected', () => setTimeout(check, 50)),
    E.on('stage:resize', () => place()), E.on('layer:changed', () => place()),
    E.on('screen:changed', sname => { if (sname !== 'game') stop(); }),
    E.on('game:new', () => stop()), E.on('game:loaded', () => stop())];
  state.keyFn = e => { if (!state.active) return; if (/^(KeyW|KeyA|KeyS|KeyD|Arrow(Up|Down|Left|Right))$/.test(e.code)) { const tag = (e.target && e.target.tagName) || ''; if (tag !== 'INPUT' && tag !== 'TEXTAREA') state.cam.moved = true; } };
  state.wheelFn = () => { if (state.active) state.cam.zoomed = true; };
  addEventListener('keydown', state.keyFn, { passive: true });
  addEventListener('wheel', state.wheelFn, { passive: true });
  state.timer = setInterval(poll, 500);
}
function unbind() {
  for (const off of state.offs) { try { off(); } catch (e) { /* ignore */ } }
  state.offs = [];
  if (state.keyFn) removeEventListener('keydown', state.keyFn); if (state.wheelFn) removeEventListener('wheel', state.wheelFn);
  state.keyFn = null; state.wheelFn = null;
  if (state.timer) clearInterval(state.timer); state.timer = 0;
  if (state.advancing) clearTimeout(state.advancing); state.advancing = 0;
}
function stop() {
  if (!state.active) return;
  state.active = false;
  unbind(); unmount();
}

/* ── public API ── */
function start(opts = {}) {
  const g = G(); if (!g) return false;
  if (!LD.Registry || !LD.Registry.ready) return false;
  if (opts.reset) { g.tutorial.step = 0; g.tutorial.done = false; }
  if (g.tutorial.done) return false;
  if (state.active) stop();
  state.active = true; state.cam = { moved: false, zoomed: false }; state.completed = false;
  bind();
  show(Math.max(1, g.tutorial.step | 0));
  setTimeout(check, 200);
  return true;
}
function skip() {
  const g = G();
  if (g) { g.tutorial.done = true; }
  const was = state.active;
  stop();
  if (was) toast('Tutorial omitido. Puedes reiniciarlo desde Ajustes.', 'info', 3500);
  if (LD.Events && was) LD.Events.emit('tutorial:step', 0);
  return true;
}
function step(n) {
  if (n === undefined || n === null) { if (!state.active) return state.step; if (state.step >= TOTAL) finish(); else advance(true); return state.step; }
  n = n | 0;
  if (n < 1) { skip(); return 0; }
  if (n > TOTAL) { if (state.active) finish(); return TOTAL; }
  if (!state.active) { const g = G(); if (g) { g.tutorial.step = n; g.tutorial.done = false; } start(); }
  show(n);
  return state.step;
}

LD.UI.Tutorial = {
  start, skip, step, stop,
  get active() { return state.active; },
  get current() { return state.step; },
  total: TOTAL,
  steps: STEPS.map(s => ({ id: s.id, title: s.title, anchor: s.anchor })),
  reposition: place
};
})();
