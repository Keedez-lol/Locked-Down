(() => {
'use strict';
const LD = window.LD, U = LD.U, el = U.el;
const UI = () => LD.UI;
const P = LD.UI.Pause = {};

let node = null, ov = null, list = null, status = null, timer = 0, wasPaused = false, gAtOpen = null;

const diffName = key => { const D = LD.State && LD.State.DIFFICULTIES; return (D && D[key] && D[key].name) || key || ''; };
const setSimPaused = v => { const Sim = LD.Sim; if (Sim && typeof Sim.setPaused === 'function') { try { Sim.setPaused(v); } catch (e) { /* sim optional */ } } };
const unsaved = () => { const Mn = LD.Main; return !!(Mn && Mn.unsavedChanges && Mn.unsavedChanges()); };

const renderStatus = () => {
  const G = LD.G; if (!status || !G) return;
  U.clear(status);
  const row = parts => el('div', parts.map(p => typeof p === 'string' ? el('span', p) : p));
  status.appendChild(row(['Día ' + (G.time.day || 1), U.eraName(G.meta.era || 0), U.fmtTime(G.meta.playtime || 0), diffName(G.meta.difficulty)]));
  status.appendChild(row([U.count(G.structures) + ' estructuras', U.count(G.research.done) + ' tecnologías', el('span' + (unsaved() ? '.warn' : '.ok'), unsaved() ? 'Sin guardar' : (G.meta.lastSave ? 'Guardado ' + UI().fmtDate(G.meta.lastSave) : 'Nunca guardado'))]));
};
const quit = () => {
  const Mn = LD.Main, ui = UI();
  if (!Mn || !Mn.toMenu) return;
  if (!unsaved()) { Mn.toMenu(); return; }
  ui.modal({
    title: 'Salir al menú', narrow: true, focus: '.ui-btn.primary',
    body: el('p.ui-modal-text', 'Hay cambios sin guardar desde el último guardado. Si sales ahora se perderán.'),
    actions: [
      { label: 'Cancelar', ghost: true },
      { label: 'Salir sin guardar', danger: true, onClick: () => Mn.toMenu() },
      { label: 'Guardar y salir', primary: true, onClick: () => { if (Mn.save((LD.G && LD.G.meta.saveName) || 'auto')) Mn.toMenu(); } }
    ]
  });
};
const items = () => [
  { id: 'resume', label: 'Continuar', hint: 'Esc', onSelect: () => P.close() },
  { id: 'save', label: 'Guardar', hint: LD.G && LD.G.meta.saveName ? (LD.G.meta.saveName === 'auto' ? 'AUTO' : 'RANURA ' + LD.G.meta.saveName) : null, onSelect: () => LD.UI.Menu.showSlots('save') },
  { id: 'load', label: 'Cargar', onSelect: () => LD.UI.Menu.showSlots('load') },
  { id: 'enc', label: 'Enciclopedia', hint: 'E', onSelect: () => { const E = LD.UI.Encyclopedia; if (E && E.open) E.open(); else UI().toast('Enciclopedia no disponible', 'warn'); } },
  { id: 'settings', label: 'Ajustes', onSelect: () => { const S = LD.UI.Settings; if (S && S.open) S.open(); else UI().toast('Ajustes no disponibles', 'warn'); } },
  { id: 'quit', label: 'Salir al menú', className: 'is-quit', onSelect: quit }
];

P.open = () => {
  const G = LD.G, Mn = LD.Main, ui = UI();
  if (node || !G || (Mn && Mn.screen !== 'game')) return;
  gAtOpen = G;
  wasPaused = !!(LD.Sim && LD.Sim.paused);
  setSimPaused(true);
  list = ui.optionList(items(), { className: 'pause-nav' });
  status = el('div.pause-status.mono');
  const col = el('div.pause-col', [
    el('div.pause-eyebrow.ui-eyebrow', [el('b', 'Pausa'), el('span', 'Simulación detenida')]),
    el('div.pause-name', G.meta.name || 'Colonia'),
    el('div.hr'), list.el, el('div.hr'), status
  ]);
  node = el('div.pause', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Pausa', tabindex: -1 }, col);
  node.addEventListener('keydown', e => { if (list && list.key(e)) e.preventDefault(); });
  node.addEventListener('pointerdown', e => { if (e.target === node) { e.preventDefault(); P.close(); } });
  ov = { close: fromStack => P.close(fromStack), el: node, kind: 'pause' };
  let root = document.getElementById('overlay-root');
  if (!root) { root = el('div#overlay-root'); ((LD.Stage && LD.Stage.el) || document.body).appendChild(root); }
  ui.sfxHooks(root);
  root.appendChild(node);
  if (Mn && Mn.pushOverlay) Mn.pushOverlay(ov);
  ui.nextFrame(() => { if (node) node.classList.add('in'); });
  renderStatus();
  timer = setInterval(() => { if (!LD.G) { P.close(); return; } renderStatus(); }, 1000);
  list.select(0);
  node.focus({ preventScroll: true });
  ui.sfx('ui_open');
  return ov;
};
P.close = fromStack => {
  if (!node) return;
  const n = node, o = ov, Mn = LD.Main;
  node = null; ov = null; list = null; status = null;
  clearInterval(timer); timer = 0;
  if (!fromStack && Mn && Mn.removeOverlay) Mn.removeOverlay(o);
  if (LD.G === gAtOpen) setSimPaused(wasPaused);
  gAtOpen = null;
  UI().tooltip.hide();
  const remove = () => { if (n.parentNode) n.parentNode.removeChild(n); };
  if (UI().reducedMotion()) remove(); else { n.classList.remove('in'); setTimeout(remove, 220); }
};
P.toggle = () => { if (node) P.close(); else P.open(); };
P.isOpen = () => !!node;
})();
