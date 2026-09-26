(() => {
'use strict';
const LD = window.LD, U = LD.U, el = U.el;
const UI = () => LD.UI;
const S = LD.UI.Settings = {};

const TABS = [{ id: 'audio', label: 'Audio' }, { id: 'graphics', label: 'Gráficos' }, { id: 'game', label: 'Partida' }, { id: 'controls', label: 'Controles' }];
const KEYS = [
  ['Cámara', [['W A S D', 'Desplazar la vista'], ['↑ ↓ ← →', 'Desplazar la vista'], ['Rueda', 'Zoom 0,5× – 3×'], ['1 … 5', 'Cambiar de estrato']]],
  ['Construcción', [['B', 'Paleta de construcción'], ['R', 'Rotar (colocando) · Investigación'], ['X', 'Modo desmantelar'], ['H', 'Herramienta manual (recolectar)'], ['C', 'Seleccionar región → plano'], ['V', 'Pegar el último plano'], ['Esc', 'Cancelar el modo activo']]],
  ['Información', [['E', 'Enciclopedia'], ['T', 'Árbol tecnológico'], ['G', 'Estadísticas'], ['F3', 'Mostrar FPS']]],
  ['Sistema', [['Espacio', 'Pausar / reanudar la simulación'], ['Esc', 'Menú de pausa · cerrar ventanas'], ['Ctrl + S', 'Guardado rápido (AUTO)']]]
];

let modal = null, body = null, tabs = null, tab = 'audio', offSettings = null;
const get = () => (LD.Settings && LD.Settings.get()) || {};
const set = patch => { if (LD.Settings) LD.Settings.set(patch); };
const inGame = () => !!LD.G && !!LD.Main && LD.Main.screen === 'game';
const pct = v => Math.round(v * 100) + ' %';

const renderAudio = () => {
  const ui = UI(), s = get(), rows = [];
  const vol = (label, key, hint) => rows.push(ui.field(label, ui.slider({ value: s[key], min: 0, max: 1, step: 0.01, label, format: pct, onInput: v => set({ [key]: v }), onChange: () => ui.sfx('ui_click') }), { hint }));
  vol('General', 'volMaster', 'Volumen maestro de todos los buses.');
  vol('Música', 'volMusic', 'Pulso del menú y capa musical de cada estrato.');
  vol('Efectos', 'volSfx', 'Máquinas, torretas, interfaz y avisos.');
  vol('Ambiente', 'volAmbient', 'Viento, goteos, zumbido de cristal, vacío.');
  rows.push(ui.field('Pista del menú', ui.segmented([{ value: 'kdz', label: 'KDZ' }, { value: 'pulse', label: 'Pulso' }], s.menuTrack === 'pulse' ? 'pulse' : 'kdz', v => set({ menuTrack: v })), { hint: '«KDZ»: batería, bajo y gancho melódico enganchados a la animación. «Pulso»: la versión minimalista anterior.' }));
  const A = LD.Audio;
  const note = A && A.unlocked === false ? 'El audio se activa con la primera pulsación o clic.' : 'Los cambios se aplican al instante.';
  return [ui.section('Volumen', rows), el('p.st-note.dim', note)];
};
const renderGraphics = () => {
  const ui = UI(), s = get();
  const seg = (key, opts) => ui.segmented(opts, s[key], v => set({ [key]: v }));
  const tog = key => ui.toggle(!!s[key], v => set({ [key]: v }));
  return [
    ui.section('Render', [
      ui.field('Partículas', seg('particles', [{ value: 'off', label: 'No' }, { value: 'low', label: 'Bajas' }, { value: 'high', label: 'Altas' }]), { hint: 'Humo, chispas, polvo y lluvia. «Bajas» reduce la densidad a la mitad.' }),
      ui.field('Textura', seg('texture', [{ value: 'high', label: 'Alta' }, { value: 'low', label: 'Baja' }]), { hint: 'Detalle del terreno y de las máquinas. «Baja» acelera equipos modestos.' })
    ]),
    ui.section('Ayudas visuales', [
      ui.field('Rejilla', tog('grid'), { hint: 'Muestra la retícula de casillas sobre el terreno.' }),
      ui.field('Rangos siempre', tog('ranges'), { hint: 'Radio de torretas, extractores y talleres visible en todo momento, no solo al colocar o seleccionar.' }),
      ui.field('Mostrar FPS', tog('showFps'), { hint: 'Contador de imágenes por segundo en la esquina. También con F3.' }),
      ui.field('Movimiento reducido', tog('reducedMotion'), { hint: 'Detiene la animación del menú y suprime las transiciones de la interfaz.' })
    ])
  ];
};
const renderGame = () => {
  const ui = UI(), s = get(), game = inGame();
  const auto = ui.segmented([0, 1, 3, 5, 10].map(v => ({ value: v, label: v ? v + ' min' : 'No' })), s.autosave | 0, v => set({ autosave: v }));
  const resetTut = ui.button('Reiniciar tutorial', { small: true, onClick: async () => {
    if (game && !(await ui.confirm('Reiniciar tutorial', 'El tutorial guiado volverá a empezar desde el primer paso en esta colonia.', { ok: 'Reiniciar' }))) return;
    set({ tutorial: true });
    if (game && LD.G.tutorial) { LD.G.tutorial.step = 0; LD.G.tutorial.done = false; const T = LD.UI.Tutorial; if (T && T.start) { try { T.start(); } catch (err) { console.error('[Settings] Tutorial.start failed', err); } } }
    ui.toast(game ? 'Tutorial reiniciado' : 'El tutorial se mostrará en la próxima colonia', 'ok');
  } });
  const D = (LD.State && LD.State.DIFFICULTIES) || {};
  let diffCtl;
  if (game) { const d = D[LD.G.meta.difficulty] || { name: LD.G.meta.difficulty, desc: '' }; diffCtl = el('div.st-ro', [el('span.st-ro-v', d.name), el('span.st-ro-d.dim', d.desc || '')]); }
  else diffCtl = el('div.st-ro', [el('span.st-ro-v.dim', '—'), el('span.st-ro-d.dim', 'Se elige al fundar una colonia.')]);
  const sections = [
    ui.section('Guardado', [ui.field('Autoguardado', auto, { hint: 'Intervalo del guardado en la ranura AUTO. También se guarda al cerrar la pestaña.' })]),
    ui.section('Colonia', [
      ui.field('Dificultad', diffCtl, { hint: game ? 'Fija para esta partida.' : null }),
      ui.field('Tutorial', el('div.st-inline', [resetTut, el('span.dim', s.tutorial ? 'Activo en partidas nuevas.' : 'Desactivado (omitido).')]))
    ])
  ];
  if (game) sections.push(ui.section('Partida actual', [el('div.st-kv.mono', [
    el('span', 'Nombre'), el('b', LD.G.meta.name),
    el('span', 'Semilla'), el('b', String(LD.G.meta.seed)),
    el('span', 'Día'), el('b', String(LD.G.time.day)),
    el('span', 'Era'), el('b', U.eraName(LD.G.meta.era || 0)),
    el('span', 'Tiempo jugado'), el('b', U.fmtTime(LD.G.meta.playtime || 0)),
    el('span', 'Creada'), el('b', ui.fmtDate(LD.G.meta.created))
  ])]));
  return sections;
};
const renderControls = () => {
  const ui = UI();
  return KEYS.map(([title, rows]) => ui.section(title, el('table.st-keys', el('tbody', rows.map(([k, d]) => el('tr', [el('td', k.split(' ').filter(Boolean).map(part => part === '+' || part === '…' ? el('span.st-key-sep', part) : ui.keycap(part))), el('td', d)]))))));
};
const RENDER = { audio: renderAudio, graphics: renderGraphics, game: renderGame, controls: renderControls };

const show = id => {
  if (!body) return;
  tab = RENDER[id] ? id : 'audio';
  U.clear(body);
  UI().addContent(body, RENDER[tab]());
  body.scrollTop = 0;
  if (tabs) tabs.select(tab, true);
};

S.open = (opts = {}) => {
  const ui = UI();
  if (modal && modal.isOpen()) { if (opts.tab) show(opts.tab); return modal; }
  if (opts.tab) tab = opts.tab;
  tabs = ui.tabs(TABS, tab, show);
  tabs.classList.add('vertical', 'st-nav');
  body = el('div.st-body.ui-scroll');
  const wrap = el('div.st-wrap', [tabs, body]);
  modal = ui.modal({
    title: 'Ajustes', wide: true, className: 'st-modal', body: wrap, focus: '.ui-tab.is-active',
    actions: [
      { label: 'Restablecer', ghost: true, left: true, close: false, onClick: async () => {
        if (!(await ui.confirm('Restablecer ajustes', 'Todos los ajustes volverán a sus valores por defecto.', { ok: 'Restablecer' }))) return;
        if (LD.Settings) LD.Settings.reset();
        show(tab); ui.toast('Ajustes restablecidos', 'ok');
      } },
      { label: 'Cerrar', primary: true }
    ],
    onClose: () => { modal = null; body = null; tabs = null; if (offSettings) { offSettings(); offSettings = null; } if (opts.onClose) opts.onClose(); }
  });
  show(tab);
  if (LD.Events) offSettings = LD.Events.on('settings:changed', () => { if (tab === 'graphics' || tab === 'game') { if (!body.contains(document.activeElement)) show(tab); } });
  return modal;
};
S.close = () => { if (modal) modal.close(); };
S.isOpen = () => !!modal && modal.isOpen();
})();
