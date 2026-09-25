(() => {
'use strict';
const LD = window.LD, U = LD.U;
const TILE = 48, SW = 1920, SH = 1080, HW = SW / 2, HH = SH / 2, ZMIN = 0.5, ZMAX = 3, MARGIN = 6 * TILE;
const LIGHT_W = 480, LIGHT_H = 270, LS = 0.25;
const TAU = Math.PI * 2;
const BONE = '#ece7dc', BONE2 = '#c9c4b8', BONE3 = '#8f8b82', VERM = '#e8401c', INK = '#0c0c0d', INK2 = '#141416';
const LINE = 'rgba(236,231,220,0.14)', LINE2 = 'rgba(236,231,220,0.28)', GRID = 'rgba(236,231,220,0.07)';
const MONO = 'ui-monospace,"SF Mono",Menlo,Consolas,"DejaVu Sans Mono",monospace';
const FONT_LABEL = '500 11px ' + MONO, FONT_SMALL = '500 10px ' + MONO, FONT_BIG = '500 13px ' + MONO;
const TIER_FALLBACK = ['#8f8b82', '#b08d57', '#7f8ea3', '#c9a227', '#6fa8dc', '#8fb87a', '#c9603b', '#b28cff'];
const EMISSIVE = { magma: [0xff6e2a, 2.2, 0.55], magma_sea: [0xff7a34, 2.6, 0.62], vent: [0xff9a50, 1.8, 0.32], plasma_floor: [0x6ec8ff, 2.0, 0.5], crystal_floor: [0x9ab4ff, 1.6, 0.28], void_crack: [0x8a6cff, 1.5, 0.3] };
const MODE_HINTS = {
  build: 'CLIC COLOCAR · ARRASTRAR TRAZA LÍNEA · R ROTAR · CLIC DER. / ESC CANCELAR',
  dismantle: 'CLIC DESMANTELAR · ESC SALIR',
  hand: 'CLIC SOBRE UN RECURSO NATURAL PARA RECOLECTAR · ESC SALIR',
  select: 'ARRASTRA UN RECTÁNGULO PARA COPIAR UN PLANO · ESC SALIR',
  paste: 'CLIC PEGAR PLANO · R ROTAR · ESC CANCELAR'
};
const NO_STATE_BADGE = { idle: 1, working: 1 };
const DARK_STATES = { building: 1, broken: 1, no_power: 1, paused: 1 };

const R = LD.Render = { TILE, view: { x: 0, y: 0, z: 1, ox: 0, oy: 0, L: 0 }, mode: 'normal', hover: null, ghost: null, selection: null, selRect: null, bpGhost: null, rangesAll: false, hintOffset: 200 };

let worldC = null, fxC = null, wc = null, fc = null, kScale = 1;
let lightC = null, lc = null, fogC = null, fogPat = null;
let tx0 = 0, ty0 = 0, tx1 = 0, ty1 = 0, frameT = 0;
const visibleUids = [], visNow = new Set(), visPrev = new Set();

const nb = { n: false, e: false, s: false, w: false };
const flashes = []; for (let i = 0; i < 48; i++) flashes.push({ L: 0, x: 0, y: 0, color: VERM, t0: -1 });
let flashIdx = 0;
const emissive = new Map();
let emissiveScanKeys = [], emissiveScanAt = 0;
const spawnCache = [];
const defInfo = new Map();
const lightSprites = new Map();
let stormFlashAt = 0, stormNext = 5, rainAcc = 0, fogDrift = 0, fogDrift2 = 0;
let bpValidKey = '', bpValid = [];
const clickFns = [], hoverFns = [], dragFns = [];

/* ── helpers ── */
const G = () => LD.G;
const Wd = () => LD.World || null;
const layerDef = L => (LD.Registry && LD.Registry.layers[L]) || null;
const layerDim = L => { const w = Wd(); if (w && w.layers && w.layers[L]) return w.layers[L]; const d = layerDef(L); return d ? { w: d.w, h: d.h, chunk: d.chunk || 16 } : { w: 256, h: 192, chunk: 16 }; };
const sdef = id => LD.Registry.structures.get(id);
const tierColor = t => { const S = LD.Sprites; const arr = (S && S.TIER_COLORS) || TIER_FALLBACK; return arr[U.clamp(t | 0, 0, arr.length - 1)]; };
const settings = () => LD.Settings.get();
const setFont = (ctx, f, spacing) => { ctx.font = f; try { ctx.letterSpacing = spacing || '0.14em'; } catch (e) { /* older engine */ } };

function ensureCam(L) {
  const g = G(); if (!g) return R.view;
  if (!g.view) g.view = { layer: 0, cam: [] };
  if (!Array.isArray(g.view.cam)) g.view.cam = [];
  let c = g.view.cam[L];
  if (!c || typeof c.x !== 'number' || !isFinite(c.x)) {
    const d = layerDim(L); let cx = d.w * TILE / 2, cy = d.h * TILE / 2;
    const B = LD.Sim && LD.Sim.Build;
    let hub = null; try { hub = B && B.hubOf ? B.hubOf(L) : null; } catch (e) { hub = null; }
    if (hub) { const def = sdef(hub.id), sz = def ? def.size || 1 : 1; cx = (hub.x + sz / 2) * TILE; cy = (hub.y + sz / 2) * TILE; }
    else { const w = Wd(); if (w && w.centre) { try { const ce = w.centre(L); if (ce) { cx = (ce.x + 0.5) * TILE; cy = (ce.y + 0.5) * TILE; } } catch (e) { /* fallback centre */ } } }
    c = g.view.cam[L] = { x: cx, y: cy, z: 1 };
  }
  return c;
}
function clampCam(c, L) {
  const d = layerDim(L), z = c.z, hw = HW / z, hh = HH / z, mw = d.w * TILE, mh = d.h * TILE;
  const minX = hw - MARGIN, maxX = mw - hw + MARGIN, minY = hh - MARGIN, maxY = mh - hh + MARGIN;
  c.x = minX > maxX ? mw / 2 : U.clamp(c.x, minX, maxX);
  c.y = minY > maxY ? mh / 2 : U.clamp(c.y, minY, maxY);
  return c;
}
function syncView(L) {
  const c = ensureCam(L), v = R.view;
  v.L = L; v.x = c.x; v.y = c.y; v.z = c.z;
  v.ox = Math.round(HW - c.x * c.z); v.oy = Math.round(HH - c.y * c.z);
  const d = layerDim(L), tz = TILE * c.z;
  tx0 = Math.max(0, Math.floor(-v.ox / tz)); ty0 = Math.max(0, Math.floor(-v.oy / tz));
  tx1 = Math.min(d.w - 1, Math.ceil((SW - v.ox) / tz)); ty1 = Math.min(d.h - 1, Math.ceil((SH - v.oy) / tz));
  return v;
}

/* ── camera API ── */
R.cam = L => ensureCam(L === undefined ? (G() ? G().view.layer : 0) : L);
R.setCam = (L, x, y, z) => { const c = ensureCam(L); if (x !== undefined) c.x = x; if (y !== undefined) c.y = y; if (z !== undefined) c.z = U.clamp(z, ZMIN, ZMAX); clampCam(c, L); };
R.panBy = (dx, dy) => { const g = G(); if (!g) return; const L = g.view.layer, c = ensureCam(L); c.x += dx; c.y += dy; clampCam(c, L); };
R.zoomAt = (factor, lx, ly) => {
  const g = G(); if (!g) return; const L = g.view.layer, c = ensureCam(L);
  if (lx === undefined) { lx = HW; ly = HH; }
  const z0 = c.z, z1 = U.clamp(z0 * factor, ZMIN, ZMAX);
  if (z1 === z0) return;
  const wx = (lx - HW) / z0 + c.x, wy = (ly - HH) / z0 + c.y;
  c.z = z1; c.x = wx - (lx - HW) / z1; c.y = wy - (ly - HH) / z1;
  clampCam(c, L);
};
R.centerOn = (L, x, y) => { const c = ensureCam(L); c.x = (x + 0.5) * TILE; c.y = (y + 0.5) * TILE; clampCam(c, L); };
R.screenToTile = (lx, ly) => {
  const v = R.view, wx = (lx - v.ox) / v.z / TILE, wy = (ly - v.oy) / v.z / TILE, x = Math.floor(wx), y = Math.floor(wy);
  return { x, y, fx: wx - x, fy: wy - y };
};
R.tileToScreen = (x, y) => { const v = R.view; return { x: x * TILE * v.z + v.ox, y: y * TILE * v.z + v.oy }; };
R.tileSize = () => TILE * R.view.z;
R.visibleRange = () => ({ x0: tx0, y0: ty0, x1: tx1, y1: ty1 });

/* ── UI state setters ── */
R.setMode = m => { R.mode = m || 'normal'; if (R.mode !== 'build') R.ghost = null; if (R.mode !== 'paste') R.bpGhost = null; if (R.mode !== 'select') R.selRect = null; };
R.setHover = (x, y) => { if (x === null || x === undefined) { R.hover = null; return; } if (!R.hover) R.hover = { x: 0, y: 0 }; R.hover.x = x; R.hover.y = y; };
R.setGhost = gh => { R.ghost = gh || null; };
R.setSelection = uid => { R.selection = uid || null; };
R.setSelectionRect = r => { R.selRect = r || null; };
R.setBlueprintGhost = b => { R.bpGhost = b || null; bpValidKey = ''; };
R.showRanges = v => { R.rangesAll = !!v; };
R.visibleStructures = () => visibleUids;
R.flash = (L, x, y, color) => { const f = flashes[flashIdx]; flashIdx = (flashIdx + 1) % flashes.length; f.L = L; f.x = x; f.y = y; f.color = color || VERM; f.t0 = frameT; };
R.onTileClick = fn => { clickFns.push(fn); return () => { const i = clickFns.indexOf(fn); if (i >= 0) clickFns.splice(i, 1); }; };
R.onTileHover = fn => { hoverFns.push(fn); return () => { const i = hoverFns.indexOf(fn); if (i >= 0) hoverFns.splice(i, 1); }; };
R.onTileDrag = fn => { dragFns.push(fn); return () => { const i = dragFns.indexOf(fn); if (i >= 0) dragFns.splice(i, 1); }; };

/* ── input (bound on the world canvas: .fx is pointer-events:none) ── */
const ptr = { down: false, button: -1, id: -1, sx: 0, sy: 0, lx: 0, ly: 0, x0: 0, y0: 0, dragging: false, panning: false, claimed: false, hx: NaN, hy: NaN, dx: NaN, dy: NaN };
const evInfo = { x: 0, y: 0, fx: 0, fy: 0, x0: 0, y0: 0, lx: 0, ly: 0, button: 0, shift: false, ctrl: false, alt: false, layer: 0 };
function fillInfo(lx, ly, e) {
  const t = R.screenToTile(lx, ly);
  evInfo.x = t.x; evInfo.y = t.y; evInfo.fx = t.fx; evInfo.fy = t.fy; evInfo.lx = lx; evInfo.ly = ly;
  evInfo.x0 = ptr.x0; evInfo.y0 = ptr.y0; evInfo.button = ptr.button;
  evInfo.shift = !!(e && e.shiftKey); evInfo.ctrl = !!(e && (e.ctrlKey || e.metaKey)); evInfo.alt = !!(e && e.altKey);
  evInfo.layer = G() ? G().view.layer : 0;
  return evInfo;
}
function emitHover(lx, ly, e) {
  const t = R.screenToTile(lx, ly);
  if (t.x === ptr.hx && t.y === ptr.hy) return;
  ptr.hx = t.x; ptr.hy = t.y;
  const d = layerDim(evInfo.layer = G() ? G().view.layer : 0);
  const inside = t.x >= 0 && t.y >= 0 && t.x < d.w && t.y < d.h;
  R.setHover(inside ? t.x : null, inside ? t.y : null);
  const info = inside ? fillInfo(lx, ly, e) : null;
  for (let i = 0; i < hoverFns.length; i++) { try { hoverFns[i](info); } catch (err) { console.error('[Render] hover handler', err); } }
}
function dragPhase(phase, lx, ly, e) {
  const info = fillInfo(lx, ly, e);
  let claimed = false;
  for (let i = 0; i < dragFns.length; i++) { try { if (dragFns[i](phase, info) === true) claimed = true; } catch (err) { console.error('[Render] drag handler', err); } }
  return claimed;
}
function bindInput(el) {
  el.style.touchAction = 'none';
  el.addEventListener('contextmenu', e => e.preventDefault());
  el.addEventListener('wheel', e => {
    e.preventDefault();
    if (!G() || LD.Main.screen !== 'game') return;
    const p = LD.Stage.toLogical(e.clientX, e.clientY);
    const f = U.clamp(Math.exp(-(e.deltaMode === 1 ? e.deltaY * 20 : e.deltaY) * 0.0012), 0.8, 1.25);
    R.zoomAt(f, p.x, p.y);
  }, { passive: false });
  el.addEventListener('pointerdown', e => {
    if (!G() || ptr.down) return;
    const p = LD.Stage.toLogical(e.clientX, e.clientY);
    ptr.down = true; ptr.button = e.button; ptr.id = e.pointerId; ptr.sx = ptr.lx = p.x; ptr.sy = ptr.ly = p.y;
    const t = R.screenToTile(p.x, p.y); ptr.x0 = t.x; ptr.y0 = t.y;
    ptr.dragging = false; ptr.panning = e.button === 1; ptr.claimed = false;
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* capture unsupported */ }
    if (e.button === 1) e.preventDefault();
  });
  el.addEventListener('pointermove', e => {
    if (!G()) return;
    const p = LD.Stage.toLogical(e.clientX, e.clientY);
    if (!ptr.down || e.pointerId !== ptr.id) { emitHover(p.x, p.y, e); return; }
    if (ptr.panning) { R.panBy((ptr.lx - p.x) / R.view.z, (ptr.ly - p.y) / R.view.z); ptr.lx = p.x; ptr.ly = p.y; return; }
    if (!ptr.dragging) {
      if (Math.hypot(p.x - ptr.sx, p.y - ptr.sy) < 4) return;
      ptr.dragging = true;
      if (ptr.button === 0) { ptr.claimed = dragPhase('start', ptr.sx, ptr.sy, e); if (!ptr.claimed) ptr.panning = true; }
      else ptr.panning = true;
      if (ptr.panning) { R.panBy((ptr.sx - p.x) / R.view.z, (ptr.sy - p.y) / R.view.z); ptr.lx = p.x; ptr.ly = p.y; return; }
    }
    const t = R.screenToTile(p.x, p.y);
    emitHover(p.x, p.y, e);
    if (t.x !== ptr.dx || t.y !== ptr.dy) { ptr.dx = t.x; ptr.dy = t.y; dragPhase('move', p.x, p.y, e); }
    ptr.lx = p.x; ptr.ly = p.y;
  });
  const finish = (e, cancel) => {
    if (!ptr.down || e.pointerId !== ptr.id) return;
    const p = LD.Stage.toLogical(e.clientX, e.clientY);
    ptr.down = false;
    try { el.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (ptr.dragging) { if (ptr.claimed) dragPhase(cancel ? 'cancel' : 'end', p.x, p.y, e); ptr.dragging = false; ptr.panning = false; return; }
    ptr.panning = false;
    if (cancel || ptr.button === 1) return;
    const info = fillInfo(p.x, p.y, e);
    for (let i = 0; i < clickFns.length; i++) { try { clickFns[i](info); } catch (err) { console.error('[Render] click handler', err); } }
  };
  el.addEventListener('pointerup', e => finish(e, false));
  el.addEventListener('pointercancel', e => finish(e, true));
  el.addEventListener('pointerleave', e => { if (!ptr.down) { ptr.hx = ptr.hy = NaN; R.setHover(null); for (let i = 0; i < hoverFns.length; i++) { try { hoverFns[i](null); } catch (err) { /* handler error */ } } } });
}
function keyboardPan(dt) {
  const M = LD.Main; if (!M || !M.keys || M.keys.size === 0 || (M.overlayDepth && M.overlayDepth() > 0)) return;
  const k = M.keys; let dx = 0, dy = 0;
  if (k.has('KeyA') || k.has('ArrowLeft')) dx -= 1; if (k.has('KeyD') || k.has('ArrowRight')) dx += 1;
  if (k.has('KeyW') || k.has('ArrowUp')) dy -= 1; if (k.has('KeyS') || k.has('ArrowDown')) dy += 1;
  if (!dx && !dy) return;
  const sp = (k.has('ShiftLeft') || k.has('ShiftRight') ? 1600 : 800) * dt / R.view.z;
  if (dx && dy) { dx *= 0.7071; dy *= 0.7071; }
  R.panBy(dx * sp, dy * sp);
}

/* ── per-definition cached info (fx profile, conduction, light) ── */
function info(def) {
  let i = defInfo.get(def.id); if (i) return i;
  const id = def.id, s = def.sprite || '', f = def.sfx || '', cx = def.complexity || 1;
  const has = (...keys) => keys.some(k => id.includes(k) || s.includes(k));
  i = { fx: null, fx2: null, rate: 0, color: undefined, conduct: !def.wall && !def.conveyor && !def.overlay, fluid: false, sfx: f && f !== '-' ? f : null };
  i.fluid = !!(def.tank || def.pipe || def.shaft || def.elevator || def.needsWater || (def.power && def.power.fluidIn) || (def.extract && def.extract.fluid) || (def.nature && def.nature.consumes) || def.borer || def.types || def.cat === 'process' || def.cat === 'power');
  // ordered heuristics: sprite/id/sfx -> particle kind (+ secondary kind)
  if (def.conveyor || def.overlay || def.wall || def.storage || (def.elevator && f !== 'quantum') || (id.indexOf('elevator') === 0 && f !== 'quantum')) { /* no machine fx */ }
  else if (id === 'workbench') { i.fx = 'dust'; i.rate = 0.8; i.color = '#a08a62'; }
  else if (f !== 'nano' && f !== 'quantum' && (f === 'forge' || f === 'hammer' || f === 'arc' || f === 'assembler' || f === 'fabricator' || has('forge', 'hammer', 'arc_furnace', 'assembler'))) { i.fx = 'spark'; i.rate = 2.4; i.fx2 = f === 'forge' || has('forge') ? 'smoke' : has('steam') ? 'steam' : has('arc') ? 'glow' : null; i.color = f === 'assembler' || f === 'fabricator' ? '#cfe6ff' : undefined; }
  else if (has('magma', 'geothermal', 'vent')) { i.fx = 'ember'; i.rate = 2; i.fx2 = has('geothermal') ? 'steam' : null; }
  else if (f === 'cryo' || has('cryo', 'he3', 'nitrogen')) { i.fx = 'steam'; i.rate = 2; i.color = '#cfe4ff'; }
  else if (f !== 'electric_hum' && f !== 'vacuum' && (f === 'furnace' || f === 'kiln' || f === 'generator_diesel' || has('furnace', 'kiln', 'coke', 'charcoal', 'blast', 'coal_plant', 'diesel'))) { i.fx = 'smoke'; i.rate = 2.2; i.fx2 = f === 'furnace' || has('blast', 'coke', 'charcoal') ? 'ember' : has('coal_plant') ? 'steam' : null; i.color = f === 'generator_diesel' || has('coal_plant') ? '#3a3835' : undefined; }
  else if (f === 'electric_hum' && has('furnace')) { i.fx = 'glow'; i.rate = 0.8; i.color = '#ffb070'; }
  else if (f === 'steam' || f === 'boiler' || f === 'turbine' || f === 'compressor' || has('boiler', 'steam_engine', 'steam_hammer', 'cooling_tower')) { i.fx = 'steam'; i.rate = f === 'compressor' ? 1 : 3; }
  else if (f === 'chemical' || f === 'refinery' || f === 'centrifuge' || has('algae', 'chemical', 'distill', 'mixer', 'tannery', 'brine')) { i.fx = 'bubble'; i.rate = 2.4; i.fx2 = f === 'refinery' ? 'smoke' : null; }
  else if (f.indexOf('drill') === 0 || f === 'crusher' || f === 'mill' || has('borer', 'drill', 'quarry', 'crusher', 'excavator', 'mine', '_pit', 'millstone')) { i.fx = 'dust'; i.rate = 3; i.fx2 = f === 'drill_laser' || f === 'drill_plasma' ? 'ember' : f === 'drill_steam' ? 'steam' : null; }
  else if (f === 'lab' || f === 'reactor' || f === 'fusion' || f === 'quantum' || f === 'nano' || f === 'vacuum' || f === 'enrichment' || has('lab_', 'reactor', 'quantum', 'nano')) { if ((def.tier | 0) > 0) { i.fx = 'glow'; i.rate = 1.2; i.color = tierColor(def.tier); } }
  else if (f === 'electrolyzer' || has('tesla', 'electrolyzer', 'capacitor')) { i.fx = 'arc'; i.rate = 0.7; i.fx2 = f === 'electrolyzer' ? 'bubble' : null; }
  else if (f === 'pump' || f === 'waterwheel' || has('well', 'pump', 'wheel')) { i.fx = 'bubble'; i.rate = 0.6; }
  else if (f === 'saw' || f === 'press' || f === 'lathe' || f === 'wiremill') { i.fx = 'dust'; i.rate = 1; i.color = f === 'saw' ? '#a08a62' : '#9a9690'; }
  i.rate *= 0.6 + 0.4 * cx;
  defInfo.set(def.id, i);
  return i;
}
function daylight() {
  const N = LD.Sim && LD.Sim.Nature;
  if (N && N.daylight) { try { const d = N.daylight(); if (typeof d === 'number' && isFinite(d)) return U.clamp(d); } catch (e) { /* fallback */ } }
  const g = G(), f = g && g.time ? g.time.dayFrac : 0.3;
  if (f < 0.05) return U.smooth(f / 0.05); if (f < 0.5) return 1; if (f < 0.58) return 1 - U.smooth((f - 0.5) / 0.08); return 0;
}
function weatherKind(L) {
  const E = LD.Sim && LD.Sim.Events;
  if (E && E.weather) { try { const w = E.weather(L); if (w && w.kind) return w.kind; } catch (e) { /* fallback */ } }
  const g = G(); const lw = g && g.layers[L] && g.layers[L].weather; return (lw && lw.kind) || 'clear';
}
function lightSprite(col) {
  let c = lightSprites.get(col);
  if (!c) {
    c = U.canvas(64, 64);
    const g = c.getContext('2d'), rgb = typeof col === 'number' ? col : (() => { const [r, gg, b] = U.hexToRgb(col); return (r << 16) | (gg << 8) | b; })();
    const r = rgb >> 16 & 255, gg = rgb >> 8 & 255, b = rgb & 255;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(' + r + ',' + gg + ',' + b + ',1)');
    grad.addColorStop(0.3, 'rgba(' + r + ',' + gg + ',' + b + ',0.6)');
    grad.addColorStop(0.7, 'rgba(' + r + ',' + gg + ',' + b + ',0.15)');
    grad.addColorStop(1, 'rgba(' + r + ',' + gg + ',' + b + ',0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    lightSprites.set(col, c);
  }
  return c;
}
// wx, wy world px; radius world px; intensity 0..1
function addLight(wx, wy, radius, intensity, col) {
  const v = R.view, sx = (wx * v.z + v.ox) * LS, sy = (wy * v.z + v.oy) * LS, r = radius * v.z * LS;
  if (r < 0.5 || sx + r < 0 || sy + r < 0 || sx - r > LIGHT_W || sy - r > LIGHT_H) return;
  lc.globalAlpha = intensity > 1 ? 1 : intensity;
  lc.drawImage(lightSprite(col), sx - r, sy - r, r * 2, r * 2);
}
function emissiveChunk(L, cx, cy, chunk, lay) {
  const key = ((L * 256 + cy) * 256) + cx;
  let e = emissive.get(key);
  if (e && frameT - e.at < 3) return e;
  const W = Wd(); if (!W || !W.terrainAt) return null;
  if (!e) { e = { tiles: new Int16Array(chunk * chunk * 3), n: 0, at: 0, key }; emissive.set(key, e); }
  else if (emissiveScanAt === frameT && e.n >= 0 && frameT - e.at < 8) return e; // one rescan per frame
  emissiveScanAt = frameT;
  let n = 0; const x0 = cx * chunk, y0 = cy * chunk, tiles = e.tiles;
  for (let y = 0; y < chunk; y++) for (let x = 0; x < chunk; x++) {
    const id = W.terrainAt(L, x0 + x, y0 + y);
    if (!id) continue;
    const em = EMISSIVE[id]; if (!em) continue;
    tiles[n * 3] = x0 + x; tiles[n * 3 + 1] = y0 + y; tiles[n * 3 + 2] = em === EMISSIVE.magma ? 0 : em === EMISSIVE.magma_sea ? 1 : em === EMISSIVE.vent ? 2 : em === EMISSIVE.plasma_floor ? 3 : em === EMISSIVE.crystal_floor ? 4 : 5; n++;
  }
  e.n = n; e.at = frameT; e.sparse = n > 48;
  return e;
}
const EM_LIST = [EMISSIVE.magma, EMISSIVE.magma_sea, EMISSIVE.vent, EMISSIVE.plasma_floor, EMISSIVE.crystal_floor, EMISSIVE.void_crack];

/* ── frame passes ── */
function drawTerrain(L, lay, v) {
  const chunk = lay.chunk || 16, cpx = chunk * TILE * v.z, cw = lay.cw || Math.ceil(lay.w / chunk), ch = lay.ch || Math.ceil(lay.h / chunk);
  const cx0 = Math.max(0, Math.floor(tx0 / chunk)), cx1 = Math.min(cw - 1, Math.floor(tx1 / chunk)), cy0 = Math.max(0, Math.floor(ty0 / chunk)), cy1 = Math.min(ch - 1, Math.floor(ty1 / chunk));
  const bucket = v.z < 0.75 ? 0.5 : v.z > 1.5 ? 2 : 1;
  const T = LD.Tex, W = Wd();
  wc.imageSmoothingEnabled = Math.abs(v.z - bucket) > 0.001;
  for (let cy = cy0; cy <= cy1; cy++) {
    const dy0 = Math.round(cy * cpx) + v.oy, dy1 = Math.round((cy + 1) * cpx) + v.oy;
    for (let cx = cx0; cx <= cx1; cx++) {
      const dx0 = Math.round(cx * cpx) + v.ox, dx1 = Math.round((cx + 1) * cpx) + v.ox;
      let c = null;
      if (T && T.chunkCanvas) { try { c = T.chunkCanvas(L, cx, cy, bucket); } catch (e) { c = null; } }
      if (c) { wc.drawImage(c, dx0, dy0, dx1 - dx0, dy1 - dy0); continue; }
      // fallback without textures: flat terrain colours
      const tz = TILE * v.z;
      for (let y = 0; y < chunk; y++) for (let x = 0; x < chunk; x++) {
        const tx = cx * chunk + x, ty = cy * chunk + y;
        if (tx < tx0 || tx > tx1 || ty < ty0 || ty > ty1) continue;
        const d = W && W.terrainDef ? W.terrainDef(L, tx, ty) : null;
        wc.fillStyle = d && d.color ? d.color : '#2a2a2c';
        wc.fillRect(tx * tz + v.ox, ty * tz + v.oy, tz + 0.5, tz + 0.5);
      }
    }
  }
  wc.imageSmoothingEnabled = true;
}
function conductsAt(lay, idx, structs, ref, kind) {
  const u = lay.occ[idx]; if (u <= 0) return false;
  const inst = structs[ref[u]]; if (!inst) return false;
  const def = sdef(inst.id); if (!def) return false;
  const i = info(def);
  return kind === 0 ? i.fluid : i.conduct;
}
function drawOverlayPass(L, lay, v, t, kind) {
  const S = LD.Sprites; if (!S || !S.drawOverlay) return;
  const grid = kind === 0 ? lay.occPipe : kind === 1 ? lay.occCable : lay.occ;
  if (!grid) return;
  const W = Wd(), ref = W.occRef, structs = G().structures, w = lay.w, h = lay.h, tz = TILE * v.z;
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const idx = ty * w + tx, u = grid[idx];
      if (u <= 0) continue;
      const inst = structs[ref[u]]; if (!inst) continue;
      const def = sdef(inst.id); if (!def) continue;
      if (kind === 2 && !def.conveyor) continue;
      if (kind === 2) {
        nb.n = ty > 0 && lay.occ[idx - w] > 0; nb.s = ty < h - 1 && lay.occ[idx + w] > 0;
        nb.w = tx > 0 && lay.occ[idx - 1] > 0; nb.e = tx < w - 1 && lay.occ[idx + 1] > 0;
      } else {
        nb.n = ty > 0 && (grid[idx - w] > 0 || conductsAt(lay, idx - w, structs, ref, kind));
        nb.s = ty < h - 1 && (grid[idx + w] > 0 || conductsAt(lay, idx + w, structs, ref, kind));
        nb.w = tx > 0 && (grid[idx - 1] > 0 || conductsAt(lay, idx - 1, structs, ref, kind));
        nb.e = tx < w - 1 && (grid[idx + 1] > 0 || conductsAt(lay, idx + 1, structs, ref, kind));
      }
      S.drawOverlay(wc, def, tx * tz + v.ox, ty * tz + v.oy, tz, t, inst, nb);
      if (kind === 2) { visibleUids.push(inst.uid); visNow.add(inst.uid); }
    }
  }
}
function emitMachineFx(def, inst, i, px, py, sizePx, dt, zoomMul) {
  const P = LD.Particles, L = inst.layer, tz = TILE * R.view.z;
  const cxw = (inst.x + (def.size || 1) / 2) * TILE, cyw = (inst.y + (def.size || 1) / 2) * TILE, sz = (def.size || 1) * TILE;
  const p = i.rate * dt * zoomMul;
  if (Math.random() < p) {
    switch (i.fx) {
      case 'smoke': P.emit('smoke', cxw + (Math.random() - 0.5) * sz * 0.4, inst.y * TILE + sz * 0.22, { layer: L, color: i.color, size: 3 + sz * 0.05 }); break;
      case 'steam': P.emit('steam', cxw + (Math.random() - 0.5) * sz * 0.5, inst.y * TILE + sz * 0.25, { layer: L, color: i.color, size: 3 + sz * 0.04 }); break;
      case 'spark': P.emit('spark', cxw + (Math.random() - 0.5) * sz * 0.3, cyw, { layer: L, color: i.color, n: 2 + (def.complexity | 0) }); break;
      case 'dust': P.emit('dust', cxw + (Math.random() - 0.5) * sz * 0.8, cyw + sz * 0.3, { layer: L, color: i.color }); break;
      case 'ember': P.emit('ember', cxw + (Math.random() - 0.5) * sz * 0.6, cyw, { layer: L }); break;
      case 'glow': P.emit('glow', cxw + (Math.random() - 0.5) * sz * 0.3, cyw + (Math.random() - 0.5) * sz * 0.3, { layer: L, color: i.color, size: 4 + sz * 0.12 }); break;
      case 'arc': { const a = Math.random() * TAU, r = sz * 0.42; P.emit('arc', cxw, cyw - sz * 0.15, { layer: L, tx: cxw + Math.cos(a) * r, ty: cyw - sz * 0.15 + Math.sin(a) * r * 0.6 }); break; }
      case 'bubble': P.emit('bubble', cxw + (Math.random() - 0.5) * sz * 0.8, cyw + (Math.random() - 0.5) * sz * 0.6, { layer: L, color: i.color }); break;
      default: break;
    }
  }
  if (i.fx2 && Math.random() < p * 0.35) {
    switch (i.fx2) {
      case 'ember': P.emit('ember', cxw + (Math.random() - 0.5) * sz * 0.4, inst.y * TILE + sz * 0.3, { layer: L, speed: 30 }); break;
      case 'bubble': P.emit('bubble', cxw + (Math.random() - 0.5) * sz * 0.6, cyw + sz * 0.2, { layer: L }); break;
      case 'smoke': P.emit('smoke', cxw + (Math.random() - 0.5) * sz * 0.4, inst.y * TILE + sz * 0.2, { layer: L, size: 3 + sz * 0.04 }); break;
      case 'steam': P.emit('steam', cxw + (Math.random() - 0.5) * sz * 0.5, inst.y * TILE + sz * 0.25, { layer: L, size: 3 + sz * 0.03 }); break;
      case 'glow': P.emit('glow', cxw, cyw, { layer: L, color: '#ffb070', size: 4 + sz * 0.1 }); break;
      default: break;
    }
  }
}
function drawStructures(L, lay, v, t, dt) {
  const S = LD.Sprites, W = Wd(); if (!S || !S.draw || !lay.occ) return;
  const ref = W.occRef, structs = G().structures, w = lay.w, tz = TILE * v.z;
  const A = LD.Audio, useAudio = !!(A && A.loop), s = settings();
  const zoomMul = s.particles === 'off' ? 0 : v.z < 0.75 ? 0.35 : v.z < 1 ? 0.7 : 1;
  const xa = Math.max(0, tx0 - 2), yb = Math.min(lay.h - 1, ty1 + 2);
  const smallBadge = tz < 14;
  for (let ty = ty0; ty <= yb; ty++) {
    for (let tx = xa; tx <= tx1; tx++) {
      const u = lay.occ[ty * w + tx];
      if (u <= 0) continue;
      const inst = structs[ref[u]];
      if (!inst || inst.x !== tx) continue;
      const def = sdef(inst.id); if (!def || def.conveyor) continue;
      const sz = def.size || 1;
      if (inst.y + sz - 1 !== ty) continue;
      const px = tx * tz + v.ox, py = inst.y * tz + v.oy, sizePx = sz * tz;
      S.draw(wc, def, px, py, sizePx, t, inst);
      const st = inst.state;
      if (!smallBadge && st && !NO_STATE_BADGE[st] && S.drawBadge) {
        const prog = inst.build && inst.build.total ? 1 - inst.build.left / inst.build.total : (inst.progress || 0);
        S.drawBadge(wc, st, px, py, sizePx, prog);
      }
      visibleUids.push(inst.uid); visNow.add(inst.uid);
      if (st === 'working') {
        const i = info(def);
        if (i.fx && zoomMul > 0) emitMachineFx(def, inst, i, px, py, sizePx, dt, zoomMul);
        if (useAudio && i.sfx) {
          const dx = (px + sizePx / 2 - HW) / HW, dy = (py + sizePx / 2 - HH) / HH;
          const dist = Math.min(1, Math.sqrt(dx * dx + dy * dy));
          A.loop(i.sfx, inst.uid, U.clamp((0.35 + 0.65 * Math.min(1, v.z / 1.5)) * (1 - 0.55 * dist) * (0.6 + 0.1 * (def.complexity || 1)), 0.05, 1));
        }
      }
    }
  }
}
function enemyMaxHp(def) { const d = LD.State.difficulty(); return (def.hp || 10) * (d ? d.enemyHp : 1); }
function drawEnemies(L, v, t) {
  const g = G(), S = LD.Sprites, list = g.enemies; if (!list || !S || !S.drawEnemy) return;
  const tz = TILE * v.z;
  for (let i = 0; i < list.length; i++) {
    const e = list[i]; if (e.layer !== L) continue;
    const def = LD.Registry.enemies.get(e.id); if (!def) continue;
    const size = Math.max(6, (def.size || 0.6) * tz * 1.4), sx = e.x * tz + v.ox, sy = e.y * tz + v.oy;
    if (sx + size < 0 || sy + size < 0 || sx - size > SW || sy - size > SH) continue;
    S.drawEnemy(wc, def, sx - size / 2, sy - size / 2, size, t, e);
  }
}
function drawEnemyBars(L, v) {
  const g = G(), list = g.enemies; if (!list) return;
  const tz = TILE * v.z;
  for (let i = 0; i < list.length; i++) {
    const e = list[i]; if (e.layer !== L) continue;
    const def = LD.Registry.enemies.get(e.id); if (!def) continue;
    const max = enemyMaxHp(def); if (!(e.hp < max)) continue;
    const size = Math.max(6, (def.size || 0.6) * tz * 1.4), sx = e.x * tz + v.ox, sy = e.y * tz + v.oy;
    if (sx + size < 0 || sy + size < 0 || sx - size > SW || sy - size > SH) continue;
    const bw = Math.max(12, size * 0.9), bx = Math.round(sx - bw / 2), by = Math.round(sy - size / 2 - 5), ratio = U.clamp(e.hp / max);
    fc.fillStyle = 'rgba(12,12,13,0.7)'; fc.fillRect(bx, by, bw, 2);
    fc.fillStyle = ratio > 0.5 ? BONE2 : ratio > 0.25 ? '#d9a441' : VERM; fc.fillRect(bx, by, Math.round(bw * ratio), 2);
  }
}
function drawProjectiles(L, v, t) {
  const D = LD.Sim && LD.Sim.Defense, list = D && D.projectiles; if (!list || !list.length) return;
  const tz = TILE * v.z, P = LD.Particles;
  wc.lineCap = 'round';
  for (let i = 0; i < list.length; i++) {
    const p = list[i]; if (p.layer !== L) continue;
    const k = p.kind || 'arrow', life = p.life || 0.5, u = U.clamp(1 - (p.t || 0) / life);
    const sx = p.x * tz + v.ox, sy = p.y * tz + v.oy, ex = (p.tx !== undefined ? p.tx : p.x) * tz + v.ox, ey = (p.ty !== undefined ? p.ty : p.y) * tz + v.oy;
    if (Math.min(sx, ex) > SW + 50 || Math.max(sx, ex) < -50 || Math.min(sy, ey) > SH + 50 || Math.max(sy, ey) < -50) continue;
    const dx = ex - sx, dy = ey - sy, len = Math.hypot(dx, dy) || 1, nx = dx / len, ny = dy / len;
    if (k.indexOf('laser') >= 0) {
      wc.globalCompositeOperation = 'lighter';
      wc.strokeStyle = 'rgba(255,110,70,' + (0.28 * u).toFixed(3) + ')'; wc.lineWidth = Math.max(3, 5 * v.z); wc.beginPath(); wc.moveTo(sx, sy); wc.lineTo(ex, ey); wc.stroke();
      wc.strokeStyle = 'rgba(255,236,220,' + (0.9 * u).toFixed(3) + ')'; wc.lineWidth = Math.max(1, 1.4 * v.z); wc.beginPath(); wc.moveTo(sx, sy); wc.lineTo(ex, ey); wc.stroke();
      wc.globalCompositeOperation = 'source-over';
    } else if (k.indexOf('tesla') >= 0) {
      wc.globalCompositeOperation = 'lighter';
      const px = -ny, py = nx, segs = 8, seed = Math.floor(t * 50);
      for (let pass = 0; pass < 2; pass++) {
        wc.strokeStyle = pass === 0 ? 'rgba(150,200,255,' + (0.25 * u + 0.05).toFixed(3) + ')' : 'rgba(225,240,255,' + (0.95 * u).toFixed(3) + ')';
        wc.lineWidth = pass === 0 ? Math.max(3, 4 * v.z) : 1.2;
        wc.beginPath(); wc.moveTo(sx, sy);
        for (let s = 1; s < segs; s++) { const tt = s / segs, off = (U.hash2(s, seed, i) - 0.5) * Math.min(16 * v.z, len * 0.25) * Math.sin(Math.PI * tt); wc.lineTo(sx + dx * tt + px * off, sy + dy * tt + py * off); }
        wc.lineTo(ex, ey); wc.stroke();
      }
      wc.globalCompositeOperation = 'source-over';
    } else if (k.indexOf('plasma') >= 0) {
      wc.globalCompositeOperation = 'lighter';
      const r = Math.max(3, 5 * v.z);
      wc.strokeStyle = 'rgba(122,208,255,0.35)'; wc.lineWidth = r; wc.beginPath(); wc.moveTo(sx - nx * r * 3, sy - ny * r * 3); wc.lineTo(sx, sy); wc.stroke();
      wc.fillStyle = 'rgba(190,150,255,0.6)'; wc.beginPath(); wc.arc(sx, sy, r, 0, TAU); wc.fill();
      wc.fillStyle = 'rgba(240,250,255,0.95)'; wc.beginPath(); wc.arc(sx, sy, r * 0.45, 0, TAU); wc.fill();
      wc.globalCompositeOperation = 'source-over';
      if (P && Math.random() < 0.5) P.emit('plasma', p.x * TILE, p.y * TILE, { layer: L, n: 1 });
    } else if (k.indexOf('shell') >= 0 || k.indexOf('cannon') >= 0) {
      const r = Math.max(1.5, 2.2 * v.z);
      for (let q = 3; q >= 1; q--) { wc.fillStyle = 'rgba(120,116,108,' + (0.12 * (4 - q)).toFixed(2) + ')'; wc.beginPath(); wc.arc(sx - nx * r * 2.2 * q, sy - ny * r * 2.2 * q, r * (1 - q * 0.15), 0, TAU); wc.fill(); }
      wc.fillStyle = '#2a2826'; wc.beginPath(); wc.arc(sx, sy, r, 0, TAU); wc.fill();
    } else if (k.indexOf('bullet') >= 0 || k.indexOf('gatling') >= 0) {
      wc.strokeStyle = 'rgba(255,224,160,0.85)'; wc.lineWidth = Math.max(1, 1.2 * v.z); const l = 7 * v.z;
      wc.beginPath(); wc.moveTo(sx - nx * l, sy - ny * l); wc.lineTo(sx, sy); wc.stroke();
    } else {
      wc.strokeStyle = BONE2; wc.lineWidth = Math.max(1, 1.3 * v.z); const l = 9 * v.z;
      wc.beginPath(); wc.moveTo(sx - nx * l, sy - ny * l); wc.lineTo(sx + nx * l * 0.3, sy + ny * l * 0.3); wc.stroke();
    }
  }
}
function lighting(L, v, t) {
  const ld = layerDef(L);
  let level, tr, tg, tb;
  if (L === 0) {
    const d = U.smooth(daylight());
    level = U.lerp(0.35, 1, d);
    tr = U.lerp(0.72, 1.0, d); tg = U.lerp(0.80, 0.985, d); tb = U.lerp(1.0, 0.93, d);
  } else {
    level = ld && typeof ld.ambient === 'number' ? ld.ambient : 0.35;
    const rgb = ld && ld.tint ? U.hexToRgb(ld.tint) : [200, 200, 200], mx = Math.max(1, rgb[0], rgb[1], rgb[2]);
    tr = rgb[0] / mx; tg = rgb[1] / mx; tb = rgb[2] / mx;
  }
  const E = LD.Sim && LD.Sim.Events;
  if (E && E.multipliers) { try { const m = E.multipliers(L); if (m && typeof m.ambient === 'number') level *= m.ambient; } catch (e) { /* ignore */ } }
  if (level >= 0.98) return;
  lc.setTransform(1, 0, 0, 1, 0, 0);
  lc.globalCompositeOperation = 'source-over'; lc.globalAlpha = 1;
  lc.fillStyle = 'rgb(' + Math.round(level * tr * 255) + ',' + Math.round(level * tg * 255) + ',' + Math.round(level * tb * 255) + ')';
  lc.fillRect(0, 0, LIGHT_W, LIGHT_H);
  lc.globalCompositeOperation = 'lighter';
  const g = G(), structs = g.structures;
  for (let i = 0; i < visibleUids.length; i++) {
    const inst = structs[visibleUids[i]]; if (!inst) continue;
    const def = sdef(inst.id); if (!def) continue;
    const sz = def.size || 1, cxw = (inst.x + sz / 2) * TILE, cyw = (inst.y + sz / 2) * TILE;
    if (def.light && !DARK_STATES[inst.state]) {
      const lt = def.light, flick = def.tier <= 1 ? 0.88 + 0.12 * Math.sin(t * 9 + inst.x * 1.7 + inst.y * 2.3) : 1;
      addLight(cxw, cyw, (lt.radius || 4) * TILE, (lt.intensity || 0.8) * flick, lt.color || '#ffb060');
    } else if (inst.state === 'working' && (def.tier | 0) >= 1) {
      addLight(cxw, cyw, (sz * 0.7 + 1) * TILE, Math.min(0.32, 0.1 + 0.035 * (def.complexity || 1)) * (def.tier >= 2 ? 1 : 0.45), tierColor(def.tier));
    }
  }
  const W = Wd(), lay = W && W.layers ? W.layers[L] : null;
  if (lay) {
    const chunk = lay.chunk || 16, cw = lay.cw || Math.ceil(lay.w / chunk), ch = lay.ch || Math.ceil(lay.h / chunk);
    const cx0 = Math.max(0, Math.floor(tx0 / chunk)), cx1 = Math.min(cw - 1, Math.floor(tx1 / chunk)), cy0 = Math.max(0, Math.floor(ty0 / chunk)), cy1 = Math.min(ch - 1, Math.floor(ty1 / chunk));
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      if (W.isExcavated && L > 0 && !W.isExcavated(L, cx, cy)) continue;
      const e = emissiveChunk(L, cx, cy, chunk, lay); if (!e || !e.n) continue;
      const tiles = e.tiles, sparse = e.sparse;
      for (let q = 0; q < e.n; q++) {
        const x = tiles[q * 3], y = tiles[q * 3 + 1];
        if (sparse && ((x | y) & 1)) continue;
        if (x < tx0 - 3 || x > tx1 + 3 || y < ty0 - 3 || y > ty1 + 3) continue;
        const em = EM_LIST[tiles[q * 3 + 2]], flick = 0.86 + 0.14 * Math.sin(t * 5 + x * 3.1 + y * 1.9);
        addLight((x + 0.5) * TILE, (y + 0.5) * TILE, em[1] * TILE * (sparse ? 1.7 : 1), em[2] * flick, em[0]);
      }
    }
  }
  const D = LD.Sim && LD.Sim.Defense, pl = D && D.projectiles;
  if (pl) for (let i = 0; i < pl.length; i++) {
    const p = pl[i]; if (p.layer !== L) continue;
    const k = p.kind || '';
    if (k.indexOf('laser') >= 0) { addLight((p.tx !== undefined ? p.tx : p.x) * TILE, (p.ty !== undefined ? p.ty : p.y) * TILE, 1.3 * TILE, 0.45, '#ff7a50'); addLight(p.x * TILE, p.y * TILE, TILE, 0.3, '#ff7a50'); }
    else if (k.indexOf('tesla') >= 0) { addLight(p.x * TILE, p.y * TILE, 1.6 * TILE, 0.4, '#bfe0ff'); addLight((p.tx !== undefined ? p.tx : p.x) * TILE, (p.ty !== undefined ? p.ty : p.y) * TILE, 1.2 * TILE, 0.35, '#bfe0ff'); }
    else if (k.indexOf('plasma') >= 0) addLight(p.x * TILE, p.y * TILE, 2 * TILE, 0.5, '#7ad0ff');
    else addLight(p.x * TILE, p.y * TILE, 0.7 * TILE, 0.22, '#ffd27a');
  }
  const P = LD.Particles; if (P && P.forEachLight) P.forEachLight(L, addLightPacked);
  lc.globalCompositeOperation = 'source-over'; lc.globalAlpha = 1;
  wc.globalCompositeOperation = 'multiply';
  wc.imageSmoothingEnabled = true;
  wc.drawImage(lightC, 0, 0, SW, SH);
  wc.globalCompositeOperation = 'source-over';
}
function addLightPacked(x, y, r, i, rgb) { addLight(x, y, r, i, rgb); }
function makeFogCanvas() {
  const N = 256, c = U.canvas(N, N), g = c.getContext('2d'), img = g.createImageData(N, N), d = img.data, sc = 1 / 48;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    // seamless tiling: blend four offset samples
    const f = (px, py) => U.fbm(px * sc, py * sc, 913, 4);
    const v = (f(x, y) * (N - x) * (N - y) + f(x - N, y) * x * (N - y) + f(x, y - N) * (N - x) * y + f(x - N, y - N) * x * y) / (N * N);
    const a = U.clamp((v - 0.42) * 2.4), o = (y * N + x) * 4;
    d[o] = 205; d[o + 1] = 200; d[o + 2] = 190; d[o + 3] = Math.round(a * 255);
  }
  g.putImageData(img, 0, 0);
  return c;
}
function weather(L, v, dt, t) {
  const P = LD.Particles;
  if (L !== 0) { if (P) P.wind = 0; return; }
  const kind = weatherKind(0), s = settings(), q = s.particles === 'off' ? 0 : s.particles === 'low' ? 0.45 : 1;
  if (P) P.wind = kind === 'storm' ? 42 : kind === 'rain' ? 14 : kind === 'fog' ? 3 : 8;
  if (kind === 'rain' || kind === 'storm') {
    const storm = kind === 'storm';
    if (P && q > 0) {
      rainAcc += (storm ? 30 : 15) * q * dt * 60;
      const vy = storm ? 1900 : 1500, vx = storm ? -380 : -120;
      while (rainAcc >= 1) {
        rainAcc -= 1;
        const vv = vy * (0.85 + Math.random() * 0.3);
        P.emit('rain', Math.random() * (SW + 400) - 200, -20, { vx: vx * (0.8 + Math.random() * 0.4), vy: vv, life: (SH + 60) / vv, size: 0.5 + Math.random() * 0.6 });
      }
    }
    wc.fillStyle = storm ? 'rgba(52,66,96,0.17)' : 'rgba(56,72,100,0.09)'; wc.fillRect(0, 0, SW, SH);
    if (storm) {
      stormNext -= dt;
      if (stormNext <= 0) { stormFlashAt = t; stormNext = 4 + Math.random() * 7; }
      if (t - stormFlashAt < 0.04) { wc.fillStyle = 'rgba(236,231,220,0.32)'; wc.fillRect(0, 0, SW, SH); }
    }
  } else if (kind === 'fog') {
    if (!fogC) { fogC = makeFogCanvas(); fogPat = wc.createPattern(fogC, 'repeat'); }
    fogDrift = (fogDrift + dt * 7) % 768; fogDrift2 = (fogDrift2 - dt * 4 + 768) % 768;
    wc.save();
    wc.globalAlpha = 0.20;
    wc.setTransform(kScale * 3, 0, 0, kScale * 3, kScale * (fogDrift - 768 - v.ox * 0.15), kScale * (-v.oy * 0.15 - 200));
    wc.fillStyle = fogPat; wc.fillRect(-256, -256, 1280, 900);
    wc.globalAlpha = 0.14;
    wc.setTransform(kScale * 2.1, 0, 0, kScale * 2.1, kScale * (fogDrift2 - 768 - v.ox * 0.25), kScale * (-v.oy * 0.25 - 300));
    wc.fillRect(-256, -256, 1600, 1100);
    wc.restore();
    wc.setTransform(kScale, 0, 0, kScale, 0, 0);
    wc.fillStyle = 'rgba(190,188,182,0.06)'; wc.fillRect(0, 0, SW, SH);
  }
}

/* ── fx canvas overlays ── */
const DASH = [6, 4], NODASH = [];
function drawGrid(v) {
  const tz = TILE * v.z; if (tz < 10) return;
  fc.strokeStyle = GRID; fc.lineWidth = 1; fc.beginPath();
  const ya = Math.max(0, ty0 * tz + v.oy), yb = Math.min(SH, (ty1 + 1) * tz + v.oy), xa = Math.max(0, tx0 * tz + v.ox), xb = Math.min(SW, (tx1 + 1) * tz + v.ox);
  for (let x = tx0; x <= tx1 + 1; x++) { const sx = Math.round(x * tz + v.ox) + 0.5; fc.moveTo(sx, ya); fc.lineTo(sx, yb); }
  for (let y = ty0; y <= ty1 + 1; y++) { const sy = Math.round(y * tz + v.oy) + 0.5; fc.moveTo(xa, sy); fc.lineTo(xb, sy); }
  fc.stroke();
}
function drawChunkBorders(L, lay, v) {
  const chunk = lay.chunk || 16, cpx = chunk * TILE * v.z, cw = lay.cw || Math.ceil(lay.w / chunk), ch = lay.ch || Math.ceil(lay.h / chunk);
  const cx0 = Math.max(0, Math.floor(tx0 / chunk)), cx1 = Math.min(cw - 1, Math.floor(tx1 / chunk)), cy0 = Math.max(0, Math.floor(ty0 / chunk)), cy1 = Math.min(ch - 1, Math.floor(ty1 / chunk));
  fc.strokeStyle = LINE; fc.lineWidth = 1; fc.beginPath();
  for (let cx = cx0; cx <= cx1 + 1; cx++) { const sx = Math.round(cx * cpx) + v.ox + 0.5; fc.moveTo(sx, Math.max(0, cy0 * cpx + v.oy)); fc.lineTo(sx, Math.min(SH, (cy1 + 1) * cpx + v.oy)); }
  for (let cy = cy0; cy <= cy1 + 1; cy++) { const sy = Math.round(cy * cpx) + v.oy + 0.5; fc.moveTo(Math.max(0, cx0 * cpx + v.ox), sy); fc.lineTo(Math.min(SW, (cx1 + 1) * cpx + v.ox), sy); }
  fc.stroke();
  const gh = R.ghost, def = gh && R.mode === 'build' ? sdef(gh.structId) : null, W = Wd();
  if (!def || !def.borer || !W || !W.canDig || !W.isExcavated) return;
  fc.setLineDash(DASH); fc.strokeStyle = VERM; fc.globalAlpha = 0.55;
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
    if (W.isExcavated(L, cx, cy)) continue;
    let ok = false; try { ok = !!W.canDig(L, cx, cy).ok; } catch (e) { ok = false; }
    if (!ok) continue;
    const x = Math.round(cx * cpx) + v.ox, y = Math.round(cy * cpx) + v.oy, w = Math.round((cx + 1) * cpx) - Math.round(cx * cpx), h = Math.round((cy + 1) * cpx) - Math.round(cy * cpx);
    fc.fillStyle = 'rgba(232,64,28,0.07)'; fc.fillRect(x, y, w, h);
    fc.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  }
  fc.setLineDash(NODASH); fc.globalAlpha = 1;
}
function drawDigging(L, v) {
  const g = G(), lay = g.layers[L], dig = lay && lay.digging; if (!dig) return;
  const chunk = layerDim(L).chunk || 16, cpx = chunk * TILE * v.z;
  for (const key in dig) {
    const d = dig[key]; if (!d || !d.total) continue;
    const c = key.indexOf(','), cx = +key.slice(0, c), cy = +key.slice(c + 1);
    if ((cx + 1) * chunk < tx0 || cx * chunk > tx1 || (cy + 1) * chunk < ty0 || cy * chunk > ty1) continue;
    const sx = (cx + 0.5) * cpx + v.ox, sy = (cy + 0.5) * cpx + v.oy, r = U.clamp(cpx * 0.16, 14, 64), p = U.clamp(d.work / d.total);
    fc.lineWidth = 2; fc.strokeStyle = LINE2; fc.beginPath(); fc.arc(sx, sy, r, 0, TAU); fc.stroke();
    fc.strokeStyle = VERM; fc.beginPath(); fc.arc(sx, sy, r, -Math.PI / 2, -Math.PI / 2 + TAU * p); fc.stroke();
    fc.lineWidth = 1;
    if (cpx >= 120) {
      setFont(fc, FONT_LABEL); fc.textAlign = 'center'; fc.textBaseline = 'top'; fc.fillStyle = BONE;
      fc.fillText('EXCAVANDO ' + Math.round(p * 100) + '%', sx, sy + r + 8);
    }
  }
}
function labelBox(x, y, text, align) {
  setFont(fc, FONT_LABEL); fc.textBaseline = 'middle';
  const w = fc.measureText(text).width + 18, h = 22;
  const bx = align === 'center' ? x - w / 2 : x, by = y;
  fc.fillStyle = 'rgba(20,20,22,0.88)'; fc.fillRect(bx, by, w, h);
  fc.strokeStyle = LINE2; fc.strokeRect(bx + 0.5, by + 0.5, w - 1, h - 1);
  fc.fillStyle = BONE2; fc.textAlign = 'left'; fc.fillText(text, bx + 9, by + h / 2 + 0.5);
}
function drawHover(L, lay, v) {
  const h = R.hover; if (!h) return;
  const tz = TILE * v.z, W = Wd();
  if (L > 0 && W && W.isExcavated) {
    const chunk = (lay && lay.chunk) || 16, cx = Math.floor(h.x / chunk), cy = Math.floor(h.y / chunk);
    if (!W.isExcavated(L, cx, cy)) {
      const cpx = chunk * tz, x = Math.round(cx * cpx) + v.ox, y = Math.round(cy * cpx) + v.oy;
      fc.strokeStyle = BONE; fc.globalAlpha = 0.5; fc.strokeRect(x + 0.5, y + 0.5, Math.round(cpx) - 1, Math.round(cpx) - 1); fc.globalAlpha = 1;
      let hard = 0, dig = null; try { hard = W.rockHardness ? W.rockHardness(L, cx, cy) : 0; dig = W.canDig ? W.canDig(L, cx, cy) : null; } catch (e) { /* optional */ }
      const text = 'ROCA · DUREZA ' + U.fmt(hard, 1) + (dig && dig.ok ? ' · EXCAVABLE' : dig && dig.reason ? ' · ' + String(dig.reason).toUpperCase() : '');
      labelBox(U.clamp(h.x * tz + v.ox + tz / 2, 120, SW - 120), U.clamp(h.y * tz + v.oy - 34, 8, SH - 30), text, 'center');
      return;
    }
  }
  if (R.mode === 'build' && R.ghost) return;
  if (R.mode === 'paste' && R.bpGhost) return;
  fc.strokeStyle = BONE; fc.globalAlpha = 0.7; fc.lineWidth = 1;
  fc.strokeRect(Math.round(h.x * tz + v.ox) + 0.5, Math.round(h.y * tz + v.oy) + 0.5, Math.round(tz) - 1, Math.round(tz) - 1);
  fc.globalAlpha = 1;
}
function drawCircle(cx, cy, rPx, color, alpha) {
  if (rPx <= 0) return;
  fc.strokeStyle = color; fc.globalAlpha = alpha; fc.lineWidth = 1;
  fc.beginPath(); fc.arc(cx, cy, rPx, 0, TAU); fc.stroke(); fc.globalAlpha = 1;
}
let rangeKind = '';
function rangeOf(def) {
  if (def.turret && def.turret.range) { rangeKind = 'turret'; return def.turret.range; }
  if (def.nature && def.nature.radius) { rangeKind = 'nature'; return def.nature.radius; }
  const m = def.maintenance || def.repair || def.service;
  if (m && m.radius) { rangeKind = 'service'; return m.radius; }
  if (def.radius) { rangeKind = 'service'; return def.radius; }
  if (def.id === 'maintenance_bay') { rangeKind = 'service'; return 8; }
  if (def.light && def.light.radius) { rangeKind = 'light'; return def.light.radius; }
  rangeKind = ''; return 0;
}
function drawGhost(L, v, t) {
  const gh = R.ghost, S = LD.Sprites; if (!gh || !S || !S.drawGhost) return;
  const def = sdef(gh.structId); if (!def) return;
  const tz = TILE * v.z, rot = gh.rot || 0, sz = def.size || 1;
  if (gh.line && gh.line.length) {
    for (let i = 0; i < gh.line.length; i++) {
      const c = gh.line[i]; if (!c) continue;
      const x = c[0], y = c[1]; if (x < tx0 - 1 || x > tx1 + 1 || y < ty0 - 1 || y > ty1 + 1) continue;
      const valid = gh.lineValid ? !!gh.lineValid[i] : gh.valid !== false;
      S.drawGhost(fc, def, x * tz + v.ox, y * tz + v.oy, tz, valid, rot);
    }
    return;
  }
  if (gh.x === undefined || gh.x === null) return;
  const px = gh.x * tz + v.ox, py = gh.y * tz + v.oy, valid = gh.valid !== false;
  S.drawGhost(fc, def, px, py, sz * tz, valid, rot);
  if (!valid) { fc.strokeStyle = VERM; fc.globalAlpha = 0.9; fc.strokeRect(px + 0.5, py + 0.5, sz * tz - 1, sz * tz - 1); fc.globalAlpha = 1; }
  const r = rangeOf(def);
  if (r) drawCircle(px + sz * tz / 2, py + sz * tz / 2, r * tz, rangeKind === 'turret' ? VERM : BONE2, rangeKind === 'turret' ? 0.85 : 0.5);
}
function drawBlueprint(L, v) {
  const bg = R.bpGhost, S = LD.Sprites; if (!bg || !bg.bp) return;
  const b = bg.bp, tz = TILE * v.z, x = bg.x * tz + v.ox, y = bg.y * tz + v.oy, W = Wd();
  const cells = b.cells || [];
  const key = L + ':' + bg.x + ',' + bg.y + ':' + cells.length;
  if (key !== bpValidKey) {
    bpValidKey = key; bpValid.length = cells.length;
    for (let i = 0; i < cells.length; i++) { const c = cells[i]; let ok = true; if (W && W.canPlace) { try { ok = !!W.canPlace(c.id, L, bg.x + c.dx, bg.y + c.dy, c.rot || 0).ok; } catch (e) { ok = false; } } bpValid[i] = ok; }
  }
  if (S && S.drawGhost) for (let i = 0; i < cells.length; i++) {
    const c = cells[i], def = sdef(c.id); if (!def) continue;
    const cx = bg.x + c.dx, cy = bg.y + c.dy; if (cx > tx1 + 1 || cy > ty1 + 1 || cx + (def.size || 1) < tx0 - 1 || cy + (def.size || 1) < ty0 - 1) continue;
    S.drawGhost(fc, def, cx * tz + v.ox, cy * tz + v.oy, (def.size || 1) * tz, bpValid[i], c.rot || 0);
  }
  fc.setLineDash(DASH); fc.strokeStyle = BONE; fc.globalAlpha = 0.8; fc.lineWidth = 1;
  fc.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round((b.w || 1) * tz) - 1, Math.round((b.h || 1) * tz) - 1);
  fc.setLineDash(NODASH); fc.globalAlpha = 1;
  labelBox(x, y - 26, 'PLANO · ' + String(b.name || 'SIN NOMBRE').toUpperCase() + ' · ' + (b.w || 1) + '×' + (b.h || 1), 'left');
}
function drawRanges(L, v) {
  const s = settings(), all = R.rangesAll || !!s.ranges, structs = G().structures, tz = TILE * v.z;
  if (all) for (let i = 0; i < visibleUids.length; i++) {
    const inst = structs[visibleUids[i]]; if (!inst || inst.uid === R.selection) continue;
    const def = sdef(inst.id); if (!def || !def.turret || !def.turret.range) continue;
    const sz = def.size || 1;
    drawCircle((inst.x + sz / 2) * tz + v.ox, (inst.y + sz / 2) * tz + v.oy, def.turret.range * tz, VERM, 0.4);
  }
  const sel = R.selection && structs[R.selection];
  if (sel && sel.layer === L) {
    const def = sdef(sel.id), r = def ? rangeOf(def) : 0;
    if (r) { const sz = def.size || 1; drawCircle((sel.x + sz / 2) * tz + v.ox, (sel.y + sz / 2) * tz + v.oy, r * tz, rangeKind === 'turret' ? VERM : rangeKind === 'light' ? BONE3 : BONE2, rangeKind === 'turret' ? 0.9 : 0.6); }
  }
}
function brackets(x, y, w, h, len, color) {
  fc.strokeStyle = color; fc.lineWidth = 1.5; fc.beginPath();
  fc.moveTo(x, y + len); fc.lineTo(x, y); fc.lineTo(x + len, y);
  fc.moveTo(x + w - len, y); fc.lineTo(x + w, y); fc.lineTo(x + w, y + len);
  fc.moveTo(x + w, y + h - len); fc.lineTo(x + w, y + h); fc.lineTo(x + w - len, y + h);
  fc.moveTo(x + len, y + h); fc.lineTo(x, y + h); fc.lineTo(x, y + h - len);
  fc.stroke(); fc.lineWidth = 1;
}
function drawSelection(L, v) {
  const tz = TILE * v.z, structs = G().structures;
  const sel = R.selection && structs[R.selection];
  if (sel && sel.layer === L) {
    const def = sdef(sel.id), sz = def ? def.size || 1 : 1, px = Math.round(sel.x * tz + v.ox), py = Math.round(sel.y * tz + v.oy), w = Math.round(sz * tz);
    if (px + w >= 0 && py + w >= 0 && px <= SW && py <= SH) brackets(px - 2.5, py - 2.5, w + 5, w + 5, U.clamp(w * 0.22, 6, 16), BONE);
  }
  const r = R.selRect;
  if (r) {
    const x0 = Math.min(r.x0, r.x1), y0 = Math.min(r.y0, r.y1), x1 = Math.max(r.x0, r.x1), y1 = Math.max(r.y0, r.y1);
    const px = Math.round(x0 * tz + v.ox), py = Math.round(y0 * tz + v.oy), w = Math.round((x1 - x0 + 1) * tz), h = Math.round((y1 - y0 + 1) * tz);
    fc.fillStyle = 'rgba(236,231,220,0.06)'; fc.fillRect(px, py, w, h);
    fc.setLineDash(DASH); fc.strokeStyle = BONE; fc.strokeRect(px + 0.5, py + 0.5, w - 1, h - 1); fc.setLineDash(NODASH);
    labelBox(px, py - 26, 'SELECCIÓN ' + (x1 - x0 + 1) + '×' + (y1 - y0 + 1), 'left');
  }
}
function drawSpawns(L, lay, v) {
  const W = Wd(); if (!W || !W.spawnTiles || !lay) return;
  const tz = TILE * v.z; if (tz < 12) return;
  let sc = spawnCache[L];
  if (!sc || frameT - sc.at > 5) { let tiles = null; try { tiles = W.spawnTiles(L); } catch (e) { tiles = null; } if (!sc) sc = spawnCache[L] = { at: 0, tiles: null }; sc.at = frameT; sc.tiles = tiles; }
  const tiles = sc.tiles; if (!tiles || !tiles.length) return;
  fc.strokeStyle = VERM; fc.globalAlpha = 0.28; fc.lineWidth = 1; fc.beginPath();
  for (let i = 0; i < tiles.length; i++) {
    const x = tiles[i][0], y = tiles[i][1]; if (x < tx0 || x > tx1 || y < ty0 || y > ty1) continue;
    const cx = (x + 0.5) * tz + v.ox, cy = (y + 0.5) * tz + v.oy;
    fc.moveTo(cx - 3, cy - 2); fc.lineTo(cx, cy + 2); fc.lineTo(cx + 3, cy - 2);
  }
  fc.stroke(); fc.globalAlpha = 1;
}
function drawFlashes(L, v, t) {
  const tz = TILE * v.z;
  for (let i = 0; i < flashes.length; i++) {
    const f = flashes[i]; if (f.t0 < 0) continue;
    const age = t - f.t0; if (age > 0.55 || f.L !== L) { if (age > 0.55) f.t0 = -1; continue; }
    fc.strokeStyle = f.color; fc.globalAlpha = 1 - age / 0.55; fc.lineWidth = 1.5;
    fc.beginPath(); fc.arc((f.x + 0.5) * tz + v.ox, (f.y + 0.5) * tz + v.oy, tz * (0.3 + age * 1.6), 0, TAU); fc.stroke();
  }
  fc.globalAlpha = 1; fc.lineWidth = 1;
}
function drawHint() {
  const h = MODE_HINTS[R.mode]; if (!h) return;
  labelBox(HW, SH - R.hintOffset, h, 'center');
}
function drawFps() {
  if (!settings().showFps) return;
  const g = G(), M = LD.Main, P = LD.Particles;
  setFont(fc, FONT_SMALL, '0.1em'); fc.textAlign = 'left'; fc.textBaseline = 'alphabetic'; fc.fillStyle = BONE3;
  fc.fillText('FPS ' + Math.round(M ? M.fps : 0) + ' · T ' + U.fmtTime(g.time.t) + ' · DÍA ' + g.time.day + ' · EST ' + visibleUids.length + ' · PART ' + (P ? P.count : 0) + ' · Z ' + R.view.z.toFixed(2).replace('.', ','), 16, SH - 14);
}
function audioFrame(L) {
  const A = LD.Audio; if (!A) return;
  if (A.stopLoop) for (const uid of visPrev) if (!visNow.has(uid)) { try { A.stopLoop(uid); } catch (e) { /* ignore */ } }
  visPrev.clear(); for (const uid of visNow) visPrev.add(uid);
  if (A.ambient) { try { A.ambient(L, L === 0 && daylight() < 0.5, L === 0 ? weatherKind(0) : 'clear'); } catch (e) { /* ignore */ } }
}

/* ── frame ── */
let needFit = true;
function fit() {
  if (!worldC) return;
  const f = LD.Stage.fitCanvas(worldC); LD.Stage.fitCanvas(fxC); kScale = f.k; needFit = false;
}
R.frame = (dt, t) => {
  frameT = t;
  const g = G(); if (!g || !wc) return;
  const L = g.view.layer | 0;
  keyboardPan(dt);
  if (needFit) fit();
  const v = syncView(L), s = settings(), P = LD.Particles;
  if (P) { P.setQuality(s.particles); P.update(dt); }
  visibleUids.length = 0; visNow.clear();
  wc.setTransform(kScale, 0, 0, kScale, 0, 0); wc.globalAlpha = 1; wc.globalCompositeOperation = 'source-over';
  wc.fillStyle = INK; wc.fillRect(0, 0, SW, SH);
  const W = Wd(), lay = W && W.layers ? W.layers[L] : null;
  if (lay) {
    drawTerrain(L, lay, v);
    drawOverlayPass(L, lay, v, t, 0); drawOverlayPass(L, lay, v, t, 1); drawOverlayPass(L, lay, v, t, 2);
    drawStructures(L, lay, v, t, dt);
  }
  drawEnemies(L, v, t);
  drawProjectiles(L, v, t);
  if (P) P.draw(wc, v, L);
  lighting(L, v, t);
  weather(L, v, dt, t);
  fc.setTransform(kScale, 0, 0, kScale, 0, 0); fc.clearRect(0, 0, SW, SH); fc.globalAlpha = 1; fc.lineWidth = 1; fc.lineCap = 'butt';
  if (s.grid) drawGrid(v);
  if (lay && L > 0) drawChunkBorders(L, lay, v);
  drawDigging(L, v);
  drawSpawns(L, lay, v);
  drawEnemyBars(L, v);
  drawHover(L, lay, v);
  drawGhost(L, v, t);
  drawBlueprint(L, v);
  drawRanges(L, v);
  drawSelection(L, v);
  drawFlashes(L, v, t);
  drawHint();
  drawFps();
  audioFrame(L);
};

R.init = (worldCanvas, fxCanvas) => {
  worldC = worldCanvas; fxC = fxCanvas;
  wc = worldC.getContext('2d', { alpha: false }); fc = fxC.getContext('2d');
  lightC = U.canvas(LIGHT_W, LIGHT_H); lc = lightC.getContext('2d', { alpha: false });
  fit();
  bindInput(worldC);
  const E = LD.Events;
  E.on('stage:resize', () => { needFit = true; });
  E.on('layer:changed', idx => { R.hover = null; ptr.hx = ptr.hy = NaN; bpValidKey = ''; if (idx !== 0 && LD.Particles && LD.Particles.clearKind) LD.Particles.clearKind('rain'); });
  const reset = () => { emissive.clear(); spawnCache.length = 0; bpValidKey = ''; for (let i = 0; i < flashes.length; i++) flashes[i].t0 = -1; R.hover = null; R.ghost = null; R.selection = null; R.selRect = null; R.bpGhost = null; R.mode = 'normal'; if (LD.Particles) LD.Particles.clear(); visPrev.clear(); visNow.clear(); };
  E.on('game:new', reset); E.on('game:loaded', reset);
  E.on('chunk:excavated', p => { if (p && p.layer !== undefined) emissive.delete(((p.layer * 256 + p.cy) * 256) + p.cx); });
  E.on('structure:removed', uid => { if (uid && uid === R.selection) R.selection = null; });
  E.on('structure:built', uid => { const g = G(), inst = g && g.structures[uid]; if (!inst) return; const def = sdef(inst.id), sz = def ? def.size || 1 : 1; if (LD.Particles) LD.Particles.emit('build', (inst.x + sz / 2) * TILE, (inst.y + sz / 2) * TILE, { layer: inst.layer, radius: sz * TILE * 0.35, n: 6 + sz * 4 }); });
  E.on('structure:broken', uid => { const g = G(), inst = g && g.structures[uid]; if (!inst) return; const def = sdef(inst.id), sz = def ? def.size || 1 : 1; if (LD.Particles) { LD.Particles.emit('smoke', (inst.x + sz / 2) * TILE, (inst.y + sz / 2) * TILE, { layer: inst.layer, n: 6, color: '#2e2c2a', jitter: sz * 20 }); LD.Particles.emit('spark', (inst.x + sz / 2) * TILE, (inst.y + sz / 2) * TILE, { layer: inst.layer, n: 8 }); } });
  E.on('enemy:killed', e => { if (!e || !LD.Particles) return; const def = LD.Registry.enemies.get(e.id); LD.Particles.emit('death', (e.x || 0) * TILE, (e.y || 0) * TILE, { layer: e.layer, color: def && def.color ? def.color : '#8a8378', n: 8 + Math.round((def && def.size || 0.6) * 10) }); });
  return R;
};
})();
