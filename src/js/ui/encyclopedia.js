(() => {
'use strict';
const LD = window.LD, U = LD.U;
LD.UI = LD.UI || {};
const el = U.el;

const SECTIONS = [
  { id: 'materials', name: 'Materiales' }, { id: 'fluids', name: 'Fluidos' }, { id: 'components', name: 'Componentes' },
  { id: 'machines', name: 'Máquinas' }, { id: 'techs', name: 'Tecnologías' }, { id: 'layers', name: 'Capas' },
  { id: 'enemies', name: 'Amenazas' }, { id: 'guides', name: 'Mecánicas' }
];
const FLUID_CATS = ['fluid', 'gas'];
const COMP_CATS = ['part', 'component', 'circuit', 'chemical', 'nuclear', 'building', 'ammo', 'science', 'exotic'];
const CAT_NAMES = { raw: 'Materia prima', ore: 'Mena', crushed: 'Triturado', ingot: 'Lingote', plate: 'Plancha', rod: 'Varilla', gear: 'Engranaje', wire: 'Hilo', part: 'Pieza', component: 'Componente', circuit: 'Circuito', fluid: 'Fluido', gas: 'Gas', chemical: 'Químico', fuel: 'Combustible', nuclear: 'Nuclear', crystal: 'Cristal', organic: 'Orgánico', building: 'Construcción', ammo: 'Munición', science: 'Ciencia', exotic: 'Exótico' };
const SCAT_ORDER = ['core', 'logistics', 'storage', 'nature', 'extract', 'process', 'power', 'research', 'defense', 'special'];
const SCAT_NAMES = { core: 'Núcleo', logistics: 'Logística', storage: 'Almacén', nature: 'Naturaleza', extract: 'Extracción', process: 'Procesado', power: 'Energía', research: 'Investigación', defense: 'Defensa', special: 'Especial' };
const RTYPE_NAMES = { hand: 'Manual', workbench: 'Mesa de trabajo', kiln: 'Horno', smelting: 'Fundición', blast: 'Alto horno', forging: 'Forja', sawing: 'Aserrado', crushing: 'Trituración', washing: 'Lavado', tanning: 'Curtido', pressing: 'Prensado', lathe: 'Torneado', wiremill: 'Trefilado', assembling: 'Ensamblaje', mixing: 'Mezcla', distilling: 'Destilación', chemical: 'Química', refining: 'Refinado', electrolysis: 'Electrólisis', centrifuge: 'Centrifugado', compressing: 'Compresión', arc: 'Arco eléctrico', vacuum: 'Vacío', fabrication: 'Fabricación', enrichment: 'Enriquecimiento', nuclear_fab: 'Fabricación nuclear', cryo: 'Criogenia', quantum: 'Cuántico', research: 'Investigación', ammo: 'Munición', build: 'Construcción' };
const LAB_NAMES = ['Mesa de estudio', 'Laboratorio', 'Laboratorio industrial', 'Laboratorio cuántico'];
const DMG_NAMES = { kinetic: 'Cinético', thermal: 'Térmico', electric: 'Eléctrico', plasma: 'Plasma' };
const ARMOR_NAMES = { none: 'Sin blindaje', chitin: 'Quitina', crystal: 'Cristal', basalt: 'Basalto', void: 'Vacío' };
const DMG_MATRIX = { kinetic: { none: 1, chitin: 1, crystal: .5, basalt: .4, void: 0 }, thermal: { none: 1, chitin: 1.4, crystal: 1.2, basalt: .6, void: 0 }, electric: { none: 1.2, chitin: .8, crystal: 1.5, basalt: .5, void: 0 }, plasma: { none: 1, chitin: 1, crystal: 1, basalt: 1, void: 1 } };
const NATURE_NAMES = { woodcutter: 'Tala', gather: 'Recolección', hunt: 'Caza', well: 'Pozo', pump: 'Bombeo', planter: 'Replantado', farm: 'Cultivo', bonsai: 'Bonsái', algae: 'Algas', greenhouse: 'Invernadero' };

/* monoline silhouettes (24×24) for undiscovered entries and chips */
const SIL = {
  raw: '<path d="M4 15l4-8 8-1 4 6-3 7H7z"/>', ore: '<path d="M4 15l4-8 8-1 4 6-3 7H7z"/><path d="M10 10h.01M14 13h.01M9 15h.01"/>',
  crushed: '<path d="M3 17l3-4 3 4zM9 12l3-5 3 5zM15 17l3-4 3 4z"/>', ingot: '<path d="M3 17l2-8h14l2 8zM5 9l2-3h10l2 3"/>',
  plate: '<path d="M4 7h16v10H4zM7 10h10"/>', rod: '<path d="M3 10h18v4H3z"/>',
  gear: '<path d="M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
  wire: '<path d="M3 12c3-6 6 6 9 0s6-6 9 0"/>', part: '<path d="M5 5h6v6H5zM13 13h6v6h-6zM11 8h5v5"/>',
  component: '<path d="M7 7h10v10H7zM10 4v3M14 4v3M10 17v3M14 17v3M4 10h3M4 14h3M17 10h3M17 14h3"/>',
  circuit: '<path d="M3 5h18v14H3zM7 9h4v4H7zM11 11h6M17 8v6M7 16h10"/>', fluid: '<path d="M12 3s-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11z"/>',
  gas: '<circle cx="8" cy="14" r="3"/><circle cx="13" cy="9" r="4"/><circle cx="16" cy="16" r="2.5"/>',
  chemical: '<path d="M9 3h6M10 3v6l-5 9a1 1 0 0 0 1 2h12a1 1 0 0 0 1-2l-5-9V3M7 15h10"/>',
  fuel: '<path d="M12 3c0 4-5 6-5 11a5 5 0 0 0 10 0c0-3-2-4-2-7-1 2-3 3-3 3s0-4 0-7z"/>',
  nuclear: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><path d="M12 3v7M4.2 16.5l6-3.5M19.8 16.5l-6-3.5"/>',
  crystal: '<path d="M12 3l6 7-6 11-6-11zM6 10h12M12 3v18"/>', organic: '<path d="M4 20C4 10 10 4 20 4c0 10-6 16-16 16zM4 20L20 4"/>',
  building: '<path d="M3 5h18v14H3zM3 10h18M3 15h18M8 5v5M14 5v5M11 10v5M5 15v4M17 15v4"/>', ammo: '<path d="M9 21h6V9a3 3 0 0 0-6 0zM9 15h6"/>',
  science: '<circle cx="12" cy="12" r="1.5"/><ellipse cx="12" cy="12" rx="9" ry="3.5"/><ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(120 12 12)"/>',
  exotic: '<path d="M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/>',
  core: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 8v8M8 10l8 4M16 10l-8 4"/>', logistics: '<path d="M3 12h14M13 8l4 4-4 4M3 6h6M3 18h6"/>',
  storage: '<path d="M3 8l9-4 9 4v10l-9 4-9-4zM3 8l9 4 9-4M12 12v10"/>', nature: '<path d="M12 21v-6M12 15l-6-3 3-4-2-3 5-2 5 2-2 3 3 4z"/>',
  extract: '<path d="M4 20l7-7M9 8l7 7M6 5c4-2 9-1 13 4-5-4-10-3-13-4z"/>', process: '<path d="M4 9h16v10H4zM8 5h8v4M8 13h8M8 16h5"/>',
  power: '<path d="M13 2L5 13h6l-1 9 9-12h-6z"/>', research: '<path d="M9 3h6M10 3v6l-5 9a1 1 0 0 0 1 2h12a1 1 0 0 0 1-2l-5-9V3"/>',
  defense: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM12 7v10"/>', special: '<path d="M12 3l2.5 6 6.5.5-5 4.5 1.5 6.5L12 17l-5.5 3.5L8 14 3 9.5 9.5 9z"/>',
  enemy: '<path d="M4 19c0-7 3-10 8-10s8 3 8 10zM8 9V4l3 3M16 9V4l-3 3M9 15h.01M15 15h.01"/>', tech: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 9v6M9 12h6"/>',
  layer: '<path d="M3 6h18M3 11h18M3 16h18M3 21h18M7 6v5M13 11v5M9 16v5M17 6v5"/>', guide: '<path d="M4 4h7a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-7a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h7z"/>',
  recipe: '<path d="M4 12h9M10 8l4 4-4 4M17 6v12"/>', unknown: '<path d="M9 9a3 3 0 1 1 4.5 2.6c-1 .6-1.5 1.2-1.5 2.4M12 18h.01"/>'
};
function sil(key, px) {
  const s = U.svg(SIL[key] || SIL.unknown, 24, 24, 'ency-sil');
  s.style.width = s.style.height = (px / 16) + 'rem';
  return s;
}

/* ── discovery snapshot (live game or the most recent save when opened from the menu) ── */
let DS = null;
function snapshot() {
  const G = LD.G;
  if (G) { DS = { live: true, d: G.discovered || {}, inv: G.inv || [], done: (G.research && G.research.done) || {}, layers: G.layers || [], research: G.research || {} }; return DS; }
  let best = null;
  try {
    const slots = LD.State && LD.State.slots ? LD.State.slots() : [];
    for (const s of slots) {
      if (!s.exists) continue;
      const raw = localStorage.getItem('lockeddown.save.' + s.slot); if (!raw) continue;
      const G2 = JSON.parse(raw);
      if (G2 && G2.meta && (!best || (G2.meta.lastSave || 0) > (best.meta.lastSave || 0))) best = G2;
    }
  } catch (e) { best = null; }
  if (best) { DS = { live: false, d: best.discovered || {}, inv: best.inv || [], done: (best.research && best.research.done) || {}, layers: best.layers || [], research: best.research || {} }; return DS; }
  DS = { live: false, d: {}, inv: [], done: {}, layers: [], research: { done: {}, current: null, queue: [] } };
  return DS;
}
const ds = () => DS || snapshot();
const R = () => LD.Registry;
const dmap = k => ds().d[k] || {};

const Disc = {
  item(id) { if (dmap('items')[id]) return true; for (const inv of ds().inv) if (inv && inv[id] > 0) return true; return false; },
  recipe(id) { if (dmap('recipes')[id]) return true; if (R().isStart('recipe', id)) return true; const t = R().unlockerOf('recipe', id); return !!(t && ds().done[t]); },
  structure(id) { if (dmap('structures')[id]) return true; if (id === 'hub' || id === 'elevator' || R().isStart('structure', id)) return true; const t = R().unlockerOf('structure', id); return !!(t && ds().done[t]); },
  techDone(id) { return !!ds().done[id]; },
  techAvailable(id) { const t = R().tech(id); return !!t && !ds().done[id] && (t.requires || []).every(r => ds().done[r]); },
  tech(id) {
    if (ds().done[id] || dmap('techs')[id]) return true;
    const t = R().tech(id); if (!t) return false;
    const req = t.requires || []; if (!req.length) return true;
    if (req.every(r => ds().done[r])) return true;
    return req.some(r => ds().done[r] || Disc.techAvailable(r));
  },
  enemy(id) { return !!dmap('enemies')[id]; },
  layer(idx) { if (idx === 0) return true; const L = ds().layers[idx]; return !!(dmap('layers')[idx] || (L && L.unlocked)); },
  guide() { return true; }
};

/* ── classification & lookup ── */
const SECTION_ALIAS = { items: 'materials', item: 'materials', material: 'materials', fluid: 'fluids', component: 'components', structures: 'machines', structure: 'machines', machine: 'machines', tech: 'techs', technologies: 'techs', research: 'techs', layer: 'layers', strata: 'layers', enemy: 'enemies', threats: 'enemies', guide: 'guides', mechanics: 'guides' };
const catName = c => (LD.UI.CAT_NAMES && LD.UI.CAT_NAMES[c]) || CAT_NAMES[c] || c;
const itemSection = it => FLUID_CATS.includes(it.cat) ? 'fluids' : COMP_CATS.includes(it.cat) ? 'components' : 'materials';
function sectionOf(kind, id) {
  switch (kind) {
    case 'item': { const it = R().item(id); return it ? itemSection(it) : 'materials'; }
    case 'recipe': return 'materials';
    case 'structure': return 'machines'; case 'tech': return 'techs'; case 'layer': return 'layers'; case 'enemy': return 'enemies'; case 'guide': return 'guides';
  }
  return 'materials';
}
function layerByAny(id) {
  const Ls = R().layers;
  if (typeof id === 'number') return Ls[id] || null;
  const s = String(id);
  if (/^\d$/.test(s)) return Ls[+s] || null;
  return Ls.find(L => L.id === s) || null;
}
function resolveKind(id, prefer) {
  const Rg = R();
  if (id === null || id === undefined) return null;
  if (prefer === 'layers') { const L = layerByAny(id); if (L) return { kind: 'layer', id: String(L.idx) }; }
  if (prefer === 'guides') { const gd = Rg.guides.find(x => x.id === id); if (gd) return { kind: 'guide', id }; }
  if (typeof id === 'number') { const L = layerByAny(id); return L ? { kind: 'layer', id: String(L.idx) } : null; }
  if (Rg.items.has(id)) return { kind: 'item', id };
  if (Rg.structures.has(id)) return { kind: 'structure', id };
  if (Rg.techs.has(id)) return { kind: 'tech', id };
  if (Rg.enemies.has(id)) return { kind: 'enemy', id };
  const L = layerByAny(id); if (L) return { kind: 'layer', id: String(L.idx) };
  if (Rg.guides.some(x => x.id === id)) return { kind: 'guide', id };
  const rc = Rg.recipe(id); if (rc) { const first = Object.keys(rc.out || {})[0]; if (first) return { kind: 'item', id: first }; }
  return null;
}
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const layerName = idx => { const L = R().layers[idx]; return L ? L.name : 'Capa ' + idx; };
const layerLabel = idx => Disc.layer(idx) ? layerName(idx) : 'capa ' + idx;

/* ── discovery hints ── */
function hintFor(kind, id) {
  const Rg = R();
  if (kind === 'item') {
    const prods = Rg.producers(id).slice().sort((a, b) => a.tier - b.tier);
    if (prods.length) {
      const rc = prods[0];
      const t = Rg.unlockerOf('recipe', rc.id);
      if (t && Rg.tech(t)) return 'Se descubre al investigar ' + Rg.tech(t).name;
      const ms = Rg.structuresThatMake(id);
      return ms.length ? 'Se descubre al fabricarlo en ' + Rg.structureName(ms[0]) : 'Se descubre al fabricarlo';
    }
    for (const L of Rg.layers) if ((L.deposits || []).some(d => d.res === id)) return L.idx === 0 ? 'Se descubre al extraerlo en la superficie' : 'Se descubre en la capa ' + L.idx;
    for (const t of Rg.terrains.values()) if (t.natural && t.natural.item === id) return 'Se descubre al recolectarlo a mano';
    for (const s of Rg.structures.values()) if (s.nature && ((s.nature.out && s.nature.out[id]) || (s.nature.byproducts && s.nature.byproducts[id]))) return 'Se descubre al construir ' + s.name;
    for (const e of Rg.enemies.values()) if (e.drops && e.drops[id]) return 'Se descubre al abatir fauna de la capa ' + e.layer;
    if (id === 'stone' || id === 'gravel') return 'Se descubre al excavar';
    return 'Se descubre al obtenerlo';
  }
  if (kind === 'structure') {
    if (id === 'elevator') return 'Se coloca automáticamente al completar un pozo';
    const t = Rg.unlockerOf('structure', id);
    return t && Rg.tech(t) ? 'Se descubre al investigar ' + Rg.tech(t).name : 'Se descubre al obtenerlo';
  }
  if (kind === 'tech') {
    const t = Rg.tech(id); const req = (t && t.requires) || [];
    const pend = req.filter(r => !ds().done[r]);
    return pend.length ? 'Se descubre al investigar ' + pend.map(r => Rg.tech(r) ? Rg.tech(r).name : r).join(', ') : 'Se descubre al investigar';
  }
  if (kind === 'enemy') { const e = Rg.enemy(id); return e ? (e.layer === 0 ? 'Se descubre en la superficie' : 'Se descubre en la capa ' + e.layer) : 'Se descubre al enfrentarlo'; }
  if (kind === 'layer') { const L = R().layers[+id]; const sh = L && L.unlockedBy && Rg.structure(L.unlockedBy); return sh ? 'Se descubre al construir ' + sh.name : 'Se descubre al abrir un pozo'; }
  return 'Se descubre al obtenerlo';
}

/* ── icons / thumbs (always copies, never the cached canvas itself) ── */
const thumbCache = new Map();
function copyCanvas(src) { const c = U.canvas(src.width, src.height); c.getContext('2d').drawImage(src, 0, 0); return c; }
function sizeRem(node, px) { node.style.width = node.style.height = (px / 16) + 'rem'; node.style.display = 'block'; return node; }
function itemIcon(id, px) {
  const it = R().item(id);
  if (LD.UI.icon) { try { const c = LD.UI.icon(id, px); if (c) return c; } catch (e) { /* fallback below */ } }
  let src = null;
  try { if (LD.Tex && LD.Tex.icon) src = LD.Tex.icon(id, Math.min(128, Math.max(16, px * 2))); } catch (e) { src = null; }
  if (src && src.width) return sizeRem(copyCanvas(src), px);
  const c = U.canvas(32, 32), ctx = c.getContext('2d');
  ctx.fillStyle = (it && it.color) || '#8f8b82'; ctx.fillRect(6, 6, 20, 20);
  ctx.strokeStyle = (it && it.color2) || '#5a5751'; ctx.lineWidth = 2; ctx.strokeRect(7, 7, 18, 18);
  return sizeRem(c, px);
}
function structThumb(id, px) {
  const def = R().structure(id); if (!def) return sil('process', px);
  if (LD.UI.structThumb) { try { const c = LD.UI.structThumb(id, px); if (c) return c; } catch (e) { /* fallback below */ } }
  const key = id + ':' + px;
  let src = thumbCache.get(key);
  if (!src) { try { if (LD.Sprites && LD.Sprites.thumb) src = LD.Sprites.thumb(def, Math.round(px * 2)); } catch (e) { src = null; } if (src) thumbCache.set(key, src); }
  return src && src.width ? sizeRem(copyCanvas(src), px) : sil(def.cat, px);
}
function enemyThumb(id, px) {
  const def = R().enemy(id); if (!def) return sil('enemy', px);
  const key = 'e:' + id + ':' + px;
  let src = thumbCache.get(key);
  if (!src) { try { if (LD.Sprites && LD.Sprites.enemyThumb) src = LD.Sprites.enemyThumb(def, Math.round(px * 2)); } catch (e) { src = null; } if (src) thumbCache.set(key, src); }
  return src && src.width ? sizeRem(copyCanvas(src), px) : sil('enemy', px);
}
function iconFor(kind, id, px, disc) {
  const Rg = R();
  if (!disc) {
    if (kind === 'item') { const it = Rg.item(id); return sil(it ? it.cat : 'unknown', px); }
    if (kind === 'structure') { const s = Rg.structure(id); return sil(s ? s.cat : 'process', px); }
    return sil(kind, px);
  }
  if (kind === 'item') return itemIcon(id, px);
  if (kind === 'structure') return structThumb(id, px);
  if (kind === 'enemy') return enemyThumb(id, px);
  return sil(kind, px);
}
function describe(kind, id) {
  const Rg = R();
  switch (kind) {
    case 'item': { const it = Rg.item(id); return { name: it ? it.name : id, disc: !!it && Disc.item(id), ok: !!it }; }
    case 'structure': { const s = Rg.structure(id); return { name: s ? s.name : id, disc: !!s && Disc.structure(id), ok: !!s }; }
    case 'tech': { const t = Rg.tech(id); return { name: t ? t.name : id, disc: !!t && Disc.tech(id), ok: !!t }; }
    case 'enemy': { const e = Rg.enemy(id); return { name: e ? e.name : id, disc: !!e && Disc.enemy(id), ok: !!e }; }
    case 'layer': { const L = Rg.layers[+id]; return { name: L ? L.name : 'Capa ' + id, disc: !!L && Disc.layer(+id), ok: !!L }; }
    case 'guide': { const gd = Rg.guides.find(x => x.id === id); return { name: gd ? gd.title : id, disc: true, ok: !!gd }; }
  }
  return { name: String(id), disc: true, ok: false };
}

/* ── UI state ── */
const state = { open: false, section: 'materials', sel: {}, query: '', root: null, handle: null, offs: [], timer: 0, pending: 0, listEl: null, detailEl: null, treeLayout: null, treeNodes: null, treeCanvas: null, treeInner: null, treeBar: null, treeSide: null, hoverTech: null };
const sfx = n => { const A = LD.Audio; if (A && A.play) { try { A.play(n); } catch (e) { /* audio optional */ } } };
const fmtN = n => U.fmt(n, 1);
const fmtItems = obj => Object.keys(obj || {}).map(k => R().itemName(k) + ' ×' + fmtN(obj[k])).join(', ');

/* chip: clickable link to any entry */
function link(kind, id, opts = {}) {
  if (kind === 'layer') { const L = layerByAny(id); id = String(L ? L.idx : id); }
  const info = describe(kind, id);
  const b = el('button.ency-chip' + (info.disc ? '' : '.undisc') + (opts.cls ? '.' + opts.cls : ''), { type: 'button', title: info.disc ? info.name : hintFor(kind, id) }, [
    el('span.ico', iconFor(kind, id, 16, info.disc)),
    el('span.t', info.disc ? info.name : '???'),
    opts.n !== undefined && opts.n !== null ? el('span.n', '×' + fmtN(opts.n)) : null,
    opts.tag ? el('span.tag', opts.tag) : null
  ]);
  if (info.ok) b.addEventListener('click', e => { e.stopPropagation(); sfx('ui_click'); open(sectionOf(kind, id), id); });
  else b.disabled = true;
  return b;
}
const chips = arr => el('div.ency-chips', arr);

/* ── entries per section ── */
function entries(section) {
  const Rg = R(); const out = [];
  const mk = (kind, id, name, tier, disc, group, order) => out.push({ kind, id, name, tier: tier | 0, disc, group: group || '', order: order || 0 });
  if (section === 'materials' || section === 'fluids' || section === 'components') {
    for (const it of Rg.items.values()) if (itemSection(it) === section) mk('item', it.id, it.name, it.tier, Disc.item(it.id));
  } else if (section === 'machines') {
    SCAT_ORDER.forEach((cat, gi) => { for (const s of Rg.structuresByCat(cat)) mk('structure', s.id, s.name, s.tier, Disc.structure(s.id), SCAT_NAMES[cat], gi); });
    for (const s of Rg.structures.values()) if (!SCAT_ORDER.includes(s.cat)) mk('structure', s.id, s.name, s.tier, Disc.structure(s.id), 'Otros', 99);
  } else if (section === 'techs') {
    for (const t of Rg.techs.values()) mk('tech', t.id, t.name, t.era, Disc.tech(t.id), U.eraName(t.era), t.era);
  } else if (section === 'layers') {
    for (const L of Rg.layers) mk('layer', String(L.idx), L.name, L.idx, Disc.layer(L.idx), '', L.idx);
  } else if (section === 'enemies') {
    for (const e of Rg.enemies.values()) mk('enemy', e.id, e.name, e.layer, Disc.enemy(e.id), 'Capa ' + e.layer + ' · ' + layerLabel(e.layer), e.layer * 10 + (e.boss ? 1 : 0));
  } else if (section === 'guides') {
    Rg.guides.forEach((gd, i) => mk('guide', gd.id, gd.title, 0, true, '', i));
  }
  const keepOrder = section === 'layers' || section === 'guides';
  out.sort((a, b) => a.order - b.order || (keepOrder ? 0 : (b.disc - a.disc) || (a.tier - b.tier) || a.name.localeCompare(b.name, 'es')));
  return out;
}

/* ── mounting ── */
function mount() {
  const host = document.getElementById('overlay-root') || document.body;
  const root = el('div.ency', { tabindex: -1, role: 'dialog', 'aria-label': 'Enciclopedia' });
  const head = el('div.ency-head', [
    el('div.ency-eyebrow#ency-eyebrow'),
    el('div.ency-title', 'Enciclopedia'),
    el('div.spacer'),
    el('div.ency-dwg#ency-dwg'),
    el('button.ency-close', { type: 'button', on: { click: () => { sfx('ui_close'); close(); } } }, ['Cerrar', el('kbd', 'Esc')])
  ]);
  const rail = el('nav.ency-rail#ency-rail');
  const body = el('div.ency-body#ency-body', [rail]);
  root.append(el('div.ency-frame', [head, body]));
  root.addEventListener('keydown', onKey);
  host.appendChild(root);
  state.root = root;
  if (LD.UI.sfxHooks) { try { LD.UI.sfxHooks(root); } catch (e) { /* optional */ } }
}
function unmount() {
  if (state.root && state.root.parentNode) state.root.parentNode.removeChild(state.root);
  state.root = null; state.listEl = null; state.detailEl = null; state.countEl = null; state.scrollEl = null; state.treeNodes = null; state.treeCanvas = null; state.treeInner = null; state.treeBar = null; state.treeSide = null;
}
function onKey(e) {
  const tag = (e.target && e.target.tagName) || '';
  const inInput = tag === 'INPUT' || tag === 'TEXTAREA';
  if (e.code === 'Escape') {
    if (inInput) { e.preventDefault(); e.stopPropagation(); if (e.target.value) { e.target.value = ''; state.query = ''; renderList(); } else { e.target.blur(); sfx('ui_close'); close(); } }
    return;
  }
  if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
    if (state.section === 'techs') return;
    e.preventDefault(); moveSelection(e.code === 'ArrowDown' ? 1 : -1);
    return;
  }
  if (inInput) return;
  if (e.code === 'KeyE') { e.preventDefault(); sfx('ui_close'); close(); return; }
  if (e.code === 'Slash' || e.code === 'KeyF') { const inp = state.root && state.root.querySelector('.ency-search input'); if (inp) { e.preventDefault(); inp.focus(); inp.select(); } }
}
function moveSelection(dir) {
  if (!state.listEl) return;
  const rows = Array.from(state.listEl.querySelectorAll('.ency-row'));
  if (!rows.length) return;
  let i = rows.findIndex(r => r.classList.contains('active'));
  i = i < 0 ? (dir > 0 ? 0 : rows.length - 1) : U.clamp(i + dir, 0, rows.length - 1);
  const r = rows[i];
  select(r.dataset.kind, r.dataset.id, true);
  r.scrollIntoView({ block: 'nearest' });
}

/* ── render: frame, rail ── */
function renderAll() {
  if (!state.root) return;
  const idx = Math.max(0, SECTIONS.findIndex(s => s.id === state.section));
  const eb = state.root.querySelector('#ency-eyebrow');
  U.clear(eb).append('Enciclopedia / ', el('b', 'Hoja ' + (idx + 1)), ds().live ? '' : ' / última partida');
  state.root.querySelector('#ency-dwg').textContent = 'DWG NO. KDZ-ENC-' + U.pad2(idx + 1) + ' · REV A';
  renderRail();
  const body = state.root.querySelector('#ency-body');
  while (body.children.length > 1) body.removeChild(body.lastChild);
  body.classList.toggle('tree', state.section === 'techs');
  if (state.section === 'techs') renderTechSection(body);
  else {
    state.listEl = buildList(); state.detailEl = el('div.ency-detail');
    body.append(state.listEl, state.detailEl);
    renderList(); renderDetail();
  }
}
function buildList() {
  const input = el('input', { type: 'search', placeholder: 'Buscar…', value: state.query, spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Buscar' });
  input.addEventListener('input', () => { state.query = input.value; renderList(); });
  state.countEl = el('div.ency-count'); state.scrollEl = el('div.ency-scroll');
  return el('div.ency-list', [el('div.ency-search', [U.svg('<circle cx="11" cy="11" r="6"/><path d="M15.5 15.5L20 20"/>', 24, 24, 'ency-sil'), input]), state.countEl, state.scrollEl]);
}
function renderRail() {
  const rail = state.root.querySelector('#ency-rail');
  U.clear(rail);
  SECTIONS.forEach((s, i) => {
    const list = entries(s.id);
    const disc = list.filter(e => e.disc).length;
    rail.appendChild(el('button' + (s.id === state.section ? '.active' : ''), { type: 'button', on: { click: () => { if (state.section !== s.id) { sfx('ui_tab'); state.section = s.id; state.query = ''; persist(); renderAll(); } } } }, [
      el('span.idx', U.pad2(i + 1)), el('span.nm', s.name), el('span.n', s.id === 'guides' ? String(list.length) : disc + '/' + list.length)
    ]));
  });
  rail.appendChild(el('div.ency-rail-foot', [el('div', 'Esc cierra · ↑↓ navega'), el('div', 'Las entradas ??? se revelan al descubrirlas')]));
}

/* ── render: list ── */
function renderList() {
  const listEl = state.listEl; if (!listEl) return;
  const sec = state.section;
  const all = entries(sec);
  const q = norm(state.query).trim();
  const visible = q ? all.filter(e => e.disc && (norm(e.name).includes(q) || e.id.includes(q))) : all;
  const discN = all.filter(e => e.disc).length;
  const scroll = state.scrollEl; if (!scroll) return;
  const scrollTop = scroll.scrollTop;
  U.clear(scroll);
  state.countEl.textContent = sec === 'guides' ? all.length + ' artículos' : discN + ' / ' + all.length + ' descubiertos' + (q ? ' · ' + visible.length + ' coincidencias' : '');
  let lastGroup = null;
  const selId = state.sel[sec];
  const row = e => {
    const r = el('button.ency-row' + (e.disc ? '' : '.undisc') + (e.id === selId && e.kind === kindOfSection(sec) ? '.active' : ''), { type: 'button', data: { kind: e.kind, id: e.id } }, [
      el('span.ico', iconFor(e.kind, e.id, 24, e.disc)),
      el('span.nm', e.disc ? [e.name, el('span.hint', e.kind === 'tech' ? U.eraName(e.tier) : e.kind === 'layer' ? 'Capa ' + e.tier : '')] : ['???', el('span.hint', hintFor(e.kind, e.id))]),
      e.disc && (e.kind === 'item' || e.kind === 'structure') ? el('span.tag', 'T' + e.tier) : null
    ]);
    r.addEventListener('click', () => { sfx('ui_click'); select(e.kind, e.id); });
    return r;
  };
  for (const e of visible) {
    if (e.group !== lastGroup) { lastGroup = e.group; if (e.group) scroll.appendChild(el('div.ency-group', e.group)); }
    scroll.appendChild(row(e));
  }
  if (!visible.length) scroll.appendChild(el('div.ency-empty', q ? 'Sin coincidencias entre lo descubierto.' : 'Nada por aquí todavía.'));
  if (q.length >= 2) {
    const others = [];
    for (const s of SECTIONS) if (s.id !== sec) for (const e of entries(s.id)) if (e.disc && norm(e.name).includes(q)) { others.push(e); if (others.length >= 12) break; }
    if (others.length) {
      scroll.appendChild(el('div.ency-group', 'En otras secciones'));
      for (const e of others) { const r = row(e); r.addEventListener('click', () => open(sectionOf(e.kind, e.id), e.id)); scroll.appendChild(r); }
    }
  }
  scroll.scrollTop = scrollTop;
}
const kindOfSection = sec => ({ materials: 'item', fluids: 'item', components: 'item', machines: 'structure', techs: 'tech', layers: 'layer', enemies: 'enemy', guides: 'guide' }[sec] || 'item');
function select(kind, id, keepFocus) {
  const sec = sectionOf(kind, id);
  if (sec !== state.section) { open(sec, id); return; }
  state.sel[sec] = id; persist();
  if (state.listEl) {
    for (const r of state.listEl.querySelectorAll('.ency-row')) r.classList.toggle('active', r.dataset.id === id && r.dataset.kind === kind);
  }
  if (state.section === 'techs') { updateTreeStates(); renderTreeSide(); }
  else renderDetail();
  if (!keepFocus && state.root && document.activeElement && document.activeElement.tagName !== 'INPUT') state.root.focus();
}
function persist() { const G = LD.G; if (G) { G.flags = G.flags || {}; G.flags.ency = { section: state.section, sel: state.sel }; } }

/* ── render: detail ── */
const H = (t, extra) => el('div.ency-sec-h', [el('span', t), extra || null]);
const sec = (title, body, extra) => body ? el('section.ency-sec', [H(title, extra), body]) : null;
const kv = rows => el('dl.ency-kv', rows.filter(r => r && r[1] !== null && r[1] !== undefined && r[1] !== '').map(([k, v]) => [el('dt', k), el('dd', v)]));
const tierChip = t => el('span.ency-tag', U.tierName(t));
const tag = t => el('span.ency-tag', t);
const para = (cls, t) => t ? el('p.' + cls, t) : null;
const fmtRate = n => fmtN(n) + '/s';
const fmtMul = m => (m * 100).toFixed(0) + ' %';

function renderDetail() {
  const d = state.detailEl; if (!d) return;
  U.clear(d);
  const sec0 = state.section; const kind = kindOfSection(sec0);
  let id = state.sel[sec0];
  if (!id) { const first = entries(sec0).find(e => e.disc) || entries(sec0)[0]; if (first) { id = first.id; state.sel[sec0] = id; if (state.listEl) { const r = state.listEl.querySelector('.ency-row[data-id="' + CSS.escape(id) + '"]'); if (r) r.classList.add('active'); } } }
  if (!id) { d.appendChild(el('div.ency-empty', 'Selecciona una entrada.')); return; }
  const node = kind === 'item' ? itemDetail(id) : kind === 'structure' ? structureDetail(id) : kind === 'tech' ? techDetail(id) : kind === 'layer' ? layerDetail(+id) : kind === 'enemy' ? enemyDetail(id) : guideDetail(id);
  d.appendChild(node || el('div.ency-empty', 'Entrada desconocida.'));
  d.scrollTop = 0;
}
function unknownDetail(kind, id, catLabel) {
  return el('article.ency-entry.undisc', [
    el('header.ency-entry-h', [el('div.ency-thumb', iconFor(kind, id, 64, false)), el('div', [el('h2', '???'), el('div.ency-tags', [catLabel ? tag(catLabel) : null, tag('Sin descubrir')])])]),
    el('p.ency-hint', hintFor(kind, id)),
    el('p.ency-lore', 'La ficha se completará cuando la colonia lo registre.')
  ]);
}
function recipeRow(rc, opts = {}) {
  const Rg = R();
  const disc = Disc.recipe(rc.id);
  const machines = [...Rg.structures.values()].filter(s => s.types && s.types.includes(rc.type)).sort((a, b) => a.tier - b.tier);
  const unl = Rg.unlockerOf('recipe', rc.id);
  const io = el('div.io', [
    chips(Object.keys(rc.in || {}).map(k => link('item', k, { n: rc.in[k], cls: opts.focus === k ? 'focus' : null }))),
    el('span.arrow', '→'),
    chips(Object.keys(rc.out || {}).map(k => link('item', k, { n: rc.out[k], cls: opts.focus === k ? 'focus' : null })))
  ]);
  const meta = el('div.meta', [
    el('span.mono', U.fmtTime(rc.time || 0) + ' · ' + (RTYPE_NAMES[rc.type] || rc.type) + ' T' + (rc.tier | 0) + (rc.energy ? ' · ' + U.fmtW(rc.energy) : '')),
    !opts.noMachines && machines.length ? chips(machines.map(s => link('structure', s.id))) : null,
    !disc && unl ? el('span.lock', ['Requiere ', link('tech', unl)]) : null,
    !disc && !unl ? el('span.lock', 'Sin descubrir') : null
  ]);
  return el('div.ency-recipe' + (disc ? '' : '.locked'), [io, meta]);
}
function costList(cost, layer) {
  if (LD.UI.costList) { try { const n = LD.UI.costList(cost, { layer }); if (n) return n; } catch (e) { /* fallback below */ } }
  const inv = ds().inv[layer] || {};
  return chips(Object.keys(cost || {}).map(k => { const have = inv[k] || 0; const c = link('item', k, { n: cost[k] }); if (ds().live) c.classList.add(have >= cost[k] ? 'have' : 'lack'); return c; }));
}

function itemDetail(id) {
  const Rg = R(); const it = Rg.item(id); if (!it) return null;
  if (!Disc.item(id)) return unknownDetail('item', id, catName(it.cat));
  const isFluid = FLUID_CATS.includes(it.cat);
  const obtain = [], uses = [];
  // sources
  const deps = [];
  for (const L of Rg.layers) for (const dp of (L.deposits || [])) if (dp.res === id) deps.push(el('div.ency-line', [link('layer', L.idx), el('span.mono.dim', 'dureza ' + (dp.hardness | 0) + (dp.fluid ? ' · fluido' : '') + (dp.amount ? ' · ' + fmtN(dp.amount[0]) + '–' + fmtN(dp.amount[1]) + ' u' : '')), el('span.dim', 'finito en el centro, infinito en el borde')]));
  if (deps.length) obtain.push(sec('Depósitos', el('div', deps)));
  const nat = [...Rg.terrains.values()].filter(t => t.natural && t.natural.item === id);
  if (nat.length) obtain.push(sec('Recolección manual', el('div.ency-lines', nat.map(t => el('div.ency-line', [tag(t.name), el('span.dim', 'capa ' + (t.layer | 0) + (t.natural.rate ? ' · ' + fmtN(t.natural.rate) + ' por golpe' : '')), el('span.dim', 'herramienta de mano (H), 1 cada 1,2 s')])))));
  const natS = [...Rg.structures.values()].filter(s => s.nature && ((s.nature.out && s.nature.out[id]) || (s.nature.byproducts && s.nature.byproducts[id])));
  if (natS.length) obtain.push(sec('Estructuras naturales', el('div.ency-lines', natS.map(s => el('div.ency-line', [link('structure', s.id), el('span.mono.dim', s.nature.out && s.nature.out[id] ? fmtRate(s.nature.out[id]) : 'subproducto' + (s.nature.byproducts && typeof s.nature.byproducts[id] === 'number' ? ' ' + fmtMul(s.nature.byproducts[id]) : ''))])))));
  const drops = [...Rg.enemies.values()].filter(e => e.drops && e.drops[id]);
  if (drops.length) obtain.push(sec('Botín', chips(drops.map(e => link('enemy', e.id, { n: e.drops[id] })))));
  if (id === 'stone' || id === 'gravel') { const borers = [...Rg.structures.values()].filter(s => s.borer); if (borers.length) obtain.push(sec('Excavación', el('div.ency-lines', [el('div.ency-line', [chips(borers.map(s => link('structure', s.id))), el('span.mono.dim', (id === 'stone' ? '0,3' : '0,2') + '/s mientras excavan')])]))); }
  const prods = Rg.producers(id).slice().sort((a, b) => a.tier - b.tier || (a.name || '').localeCompare(b.name || ''));
  if (prods.length) obtain.push(sec('Recetas', el('div.ency-recipes', prods.map(rc => recipeRow(rc, { focus: id }))), el('span.mono.dim', prods.length + ' recetas')));
  // uses
  const cons = Rg.consumers(id).filter(rc => rc.type !== 'build').slice().sort((a, b) => a.tier - b.tier || (a.name || '').localeCompare(b.name || ''));
  if (cons.length) uses.push(sec('Recetas', el('div.ency-recipes', cons.map(rc => recipeRow(rc, { focus: id }))), el('span.mono.dim', cons.length + ' recetas')));
  const builds = [...Rg.structures.values()].filter(s => s.cost && s.cost[id]).sort((a, b) => a.tier - b.tier);
  if (builds.length) uses.push(sec('Construcción', chips(builds.map(s => link('structure', s.id, { n: s.cost[id] })))));
  const techs = [...Rg.techs.values()].filter(t => t.cost && t.cost[id]).sort((a, b) => a.era - b.era);
  if (techs.length) uses.push(sec('Investigación', chips(techs.map(t => link('tech', t.id, { n: t.cost[id] })))));
  const fuelOf = [...Rg.structures.values()].filter(s => (s.power && s.power.fuel && s.power.fuel.includes(id)) || (s.burn && s.burn.fuels && s.burn.fuels.includes(id)));
  if (fuelOf.length) uses.push(sec('Combustible de', chips(fuelOf.map(s => link('structure', s.id)))));
  const ammoOf = [...Rg.structures.values()].filter(s => s.turret && s.turret.ammo && s.turret.ammo[id]);
  if (ammoOf.length) uses.push(sec('Munición de', chips(ammoOf.map(s => link('structure', s.id, { n: s.turret.ammo[id] })))));
  const consumedBy = [...Rg.structures.values()].filter(s => (s.nature && s.nature.consumes && s.nature.consumes[id]) || (s.power && s.power.fluidIn && s.power.fluidIn[id]) || (s.extract && s.extract.consumes && s.extract.consumes[id]) || (s.borer && s.borer.consumes && s.borer.consumes[id]));
  if (consumedBy.length) uses.push(sec('Consumido por', chips(consumedBy.map(s => { const r = (s.nature && s.nature.consumes && s.nature.consumes[id]) || (s.power && s.power.fluidIn && s.power.fluidIn[id]) || (s.extract && s.extract.consumes && s.extract.consumes[id]) || (s.borer && s.borer.consumes && s.borer.consumes[id]); return link('structure', s.id, { tag: typeof r === 'number' ? fmtRate(r) : null }); }))));
  if (id === 'lubricant') uses.push(sec('Lubricación', para('ency-p', 'Cualquier máquina cuya red de tuberías contenga lubricante consume 0,005 u/s y reduce su desgaste a ×1/1,5.')));
  // stock per layer
  let stock = null;
  if (ds().live && !isFluid) {
    const rows = ds().inv.map((inv, L) => [L, (inv && inv[id]) || 0]).filter(([L, n]) => n > 0 || L === 0);
    stock = el('div.ency-stock', rows.map(([L, n]) => el('span.mono', ['L' + L + ' ', el('b', U.fmtInt(n))])));
  }
  return el('article.ency-entry', [
    el('header.ency-entry-h', [
      el('div.ency-thumb', itemIcon(id, 64)),
      el('div', [el('h2', it.name), el('div.ency-tags', [tag(catName(it.cat)), tierChip(it.tier), isFluid ? tag('En tuberías y tanques') : null, it.final ? tag('Producto final') : null, it.fuel > 0 ? tag(fmtN(it.fuel) + ' MJ/u') : null]), el('div.ency-id', it.id)])
    ]),
    para('ency-p', it.desc), para('ency-lore', it.lore),
    kv([
      ['Combustible', it.fuel > 0 ? fmtN(it.fuel) + ' MJ por unidad' : null],
      ['Almacenaje', isFluid ? 'Nunca entra en el inventario: vive en tanques de su red de tuberías, por capa' + (['liquid_nitrogen', 'deuterium', 'tritium', 'helium3', 'cryo_coolant', 'liquid_hydrogen'].includes(id) ? ' · criogénico (tanque con aislamiento)' : '') : 'Inventario de cada estrato; tope ampliable con almacenes'],
      ['Existencias', stock]
    ]),
    obtain.length ? el('div.ency-block', [el('h3.ency-h3', 'Cómo obtenerlo'), ...obtain]) : el('div.ency-block', [el('h3.ency-h3', 'Cómo obtenerlo'), para('ency-p dim', 'Sin fuente registrada.')]),
    uses.length ? el('div.ency-block', [el('h3.ency-h3', 'Se usa en'), ...uses]) : el('div.ency-block', [el('h3.ency-h3', 'Se usa en'), para('ency-p dim', it.final ? 'Producto final: no se consume.' : 'Sin usos registrados.')])
  ]);
}

function structureDetail(id) {
  const Rg = R(); const s = Rg.structure(id); if (!s) return null;
  if (!Disc.structure(id)) return unknownDetail('structure', id, SCAT_NAMES[s.cat] || s.cat);
  const p = s.power || {};
  const powerRows = [];
  if (p.gen) powerRows.push(['Generación', el('span', [el('b.mono', U.fmtW(p.gen)), p.fuel ? [' · combustible: ', chips(p.fuel.map(f => link('item', f)))] : null, p.fluidIn ? [' · fluidos: ', chips(Object.keys(p.fluidIn).map(f => link('item', f, { tag: fmtRate(p.fluidIn[f]) })))] : null, id === 'solar_panel' ? ' × luz diurna (superficie)' : null])]);
  if (p.use) powerRows.push(['Consumo', el('span', [el('b.mono', U.fmtW(p.use)), s.ocMax ? el('span.dim', ' · ×2 por nivel de overclock') : null])]);
  if (p.store || p.storage) powerRows.push(['Acumulación', el('b.mono', U.fmtJ(p.store || p.storage))]);
  if (s.burn) powerRows.push(['Quema', el('span', [el('b.mono', fmtN(s.burn.mjPerSec || 0) + ' MJ/s'), s.burn.fuels ? [' · ', chips(s.burn.fuels.map(f => link('item', f)))] : null])]);
  if (!powerRows.length) powerRows.push(['Energía', 'No necesita ni produce energía']);
  const rates = [];
  if (s.extract) rates.push(['Extracción', 'dureza ≤ ' + (s.extract.hardnessMax | 0) + ' · ' + fmtN(s.extract.rate) + '/s por casilla de depósito cubierta' + (s.extract.fluid ? ' · salida a tuberías' : '')]);
  if (s.nature) rates.push(['Naturaleza', (NATURE_NAMES[s.nature.kind] || s.nature.kind || 'producción') + (s.nature.radius ? ' · radio ' + s.nature.radius : '') + (s.nature.rate ? ' · ' + fmtRate(s.nature.rate) : '') + (s.nature.out ? ' → ' + fmtItems(s.nature.out) : '') + (s.nature.consumes ? ' · consume ' + Object.keys(s.nature.consumes).map(k => Rg.itemName(k) + ' ' + fmtRate(s.nature.consumes[k])).join(', ') : '')]);
  if (s.conveyor) rates.push(['Cinta', fmtN(s.conveyor.rate) + ' objetos/s (tope del enlace)']);
  if (s.cable) rates.push(['Cable', (isFinite(s.cable.cap) ? U.fmtW(s.cable.cap) : 'sin límite') + ' de capacidad']);
  if (s.pipe) rates.push(['Tubería', (isFinite(s.pipe.rate) ? fmtN(s.pipe.rate) + ' u/s' : 'sin límite') + ' de caudal']);
  if (s.tank) rates.push(['Tanque', U.fmtInt(s.tank.cap) + ' u · un solo fluido' + (s.tank.cryo ? ' · criogénico' : '')]);
  if (s.storage) rates.push(['Almacén', '+' + U.fmtInt(s.storage.cap) + ' al tope de cada objeto en la capa']);
  if (s.elevator) rates.push(['Elevador', fmtN(s.elevator.rate) + ' objetos/s entre el estrato y la superficie']);
  if (s.borer) rates.push(['Tuneladora', fmtN(s.borer.rate) + ' casillas/s a velocidad 1 · ×2 por nivel sobre la dureza de la capa']);
  if (s.shaft) rates.push(['Pozo', el('span', ['Abre la ', link('layer', s.shaft.layer), ' · ' + fmtN(s.shaft.rate) + ' u/s de fluidos · conduce energía'])]);
  if (s.turret) rates.push(['Torreta', el('span', ['alcance ' + s.turret.range + ' · daño ' + fmtN(s.turret.dmg) + ' × ' + fmtN(s.turret.rate) + '/s · ' + (DMG_NAMES[s.turret.dmgType] || s.turret.dmgType) + (s.turret.ap ? ' · perforante' : ''), s.turret.ammo ? [' · munición: ', chips(Object.keys(s.turret.ammo).map(a => link('item', a, { n: s.turret.ammo[a] })))] : ' · solo energía'])]);
  if (s.wall) rates.push(['Muro', 'Bloquea el paso; los enemigos abren brecha por el más débil si no hay ruta']);
  if (s.light) rates.push(['Luz', 'radio ' + s.light.radius + (s.light.intensity ? ' · intensidad ' + fmtN(s.light.intensity) : '')]);
  if (s.lab) rates.push(['Laboratorio', 'nivel ' + (s.lab.tier | 0) + ' (' + (LAB_NAMES[s.lab.tier | 0] || '') + ') · cada laboratorio activo suma ×1 de velocidad']);
  if (s.types) rates.push(['Velocidad', '×' + fmtN(s.speed || 1) + (s.ocMax ? ' · overclock hasta +' + s.ocMax + ' (×1,5 velocidad, ×2 energía, ×3 desgaste por nivel)' : '')]);
  if (id === 'maintenance_bay') rates.push(['Mantenimiento', 'Repara estructuras en radio 8 cada 10 s con materiales de la capa']);
  const placement = [];
  if (s.surfaceOnly) placement.push('Solo en la superficie.');
  if (s.needsWater) placement.push('Debe tocar una casilla de agua.');
  if (s.needsVent) placement.push('Debe colocarse sobre una fumarola.');
  if (s.overlay === 'cable') placement.push('Superposición: se tiende sobre casillas vacías y cintas; las estructuras conducen por sí mismas.');
  if (s.overlay === 'pipe') placement.push('Superposición: se tiende sobre casillas vacías y cintas; puede compartir casilla con un cable.');
  if (s.extract) placement.push('Su huella debe cubrir al menos una casilla de depósito de dureza ≤ ' + (s.extract.hardnessMax | 0) + '.');
  if (s.borer) placement.push('Solo en estratos inferiores, pegada a un bloque sin excavar que toque uno ya abierto.');
  if (s.shaft) placement.push('Cabeza de pozo en la superficie; al completarse aparece el elevador en el centro del estrato.');
  if (s.heatproof) placement.push('Blindada contra el calor del núcleo (capa 4).'); else placement.push('En la capa 4 pierde 0,05 % de integridad por segundo sin blindaje.');
  if (s.types && !s.overlay) placement.push('Necesita enlace con el almacén: adyacente o unida por cintas.');
  placement.push('Ocupa ' + s.size + '×' + s.size + ' · rotación estética con R.');
  const recipes = s.types ? Rg.recipesFor(id) : [];
  const unl = Rg.unlockerOf('structure', id);
  const G = LD.G; const layer = G ? (G.view.layer || 0) : 0;
  return el('article.ency-entry', [
    el('header.ency-entry-h', [
      el('div.ency-thumb.big', structThumb(id, 96)),
      el('div', [el('h2', s.name), el('div.ency-tags', [tag(SCAT_NAMES[s.cat] || s.cat), tierChip(s.tier), tag(s.size + '×' + s.size), s.heatproof ? tag('Termorresistente') : null]), el('div.ency-id', s.id)])
    ]),
    para('ency-p', s.desc), para('ency-lore', s.lore),
    kv([
      ['Construcción', el('span', [el('b.mono', U.fmtTime(s.buildTime || 0)), s.complexity ? el('span.dim', ' · complejidad ' + s.complexity) : null])],
      ['Integridad', el('b.mono', U.fmtInt(s.hp || 0))],
      ['Desgaste', s.types || s.extract || s.borer ? '0,004 %/s en marcha (×3 por nivel de overclock, ÷1,5 con lubricante)' : null]
    ]),
    sec('Coste', s.cost && Object.keys(s.cost).length ? costList(s.cost, layer) : para('ency-p dim', id === 'hub' ? 'Se coloca al fundar la colonia. Indestructible: nunca baja del 10 %.' : 'Se coloca automáticamente.')),
    sec('Energía', kv(powerRows)),
    rates.length ? sec('Rendimiento', kv(rates)) : null,
    s.types ? sec('Recetas', el('div', [chips(s.types.map(t => tag(RTYPE_NAMES[t] || t))), el('div.ency-recipes', recipes.length ? recipes.map(rc => recipeRow(rc, { noMachines: true })) : [para('ency-p dim', 'Sin recetas registradas.')])]), el('span.mono.dim', recipes.length + ' recetas')) : null,
    sec('Desbloqueo', unl ? chips([link('tech', unl)]) : para('ency-p', id === 'elevator' ? 'Aparece al completar un pozo.' : 'Disponible desde el inicio.')),
    sec('Colocación', el('ul.ency-ul', placement.map(t => el('li', t))))
  ]);
}

function techStatus(id) {
  const Rs = LD.Sim && LD.Sim.Research;
  const cur = ds().research.current;
  if (ds().done[id]) return 'done';
  if (cur && (cur.tech === id || (cur.tech && cur.tech.id === id))) return 'current';
  if ((ds().research.queue || []).includes(id)) return 'queued';
  if (Rs && Rs.canStart) { try { const c = Rs.canStart(id); if (c && c.ok) return 'ready'; } catch (e) { /* fallthrough */ } }
  return Disc.techAvailable(id) ? 'available' : 'locked';
}
const STATUS_ES = { done: 'Hecha', current: 'En curso', queued: 'En cola', ready: 'Disponible', available: 'Disponible', locked: 'Bloqueada' };
function techActions(id) {
  const Rs = LD.Sim && LD.Sim.Research; if (!ds().live || !Rs) return null;
  const st = techStatus(id);
  if (st === 'done') return null;
  const wrap = el('div.ency-actions');
  let missing = null;
  if (st !== 'current' && st !== 'queued') {
    let cs = null; try { cs = Rs.canStart ? Rs.canStart(id) : null; } catch (e) { cs = null; }
    const miss = cs && cs.missing ? Object.keys(cs.missing).filter(k => cs.missing[k] > 0) : [];
    const pre = cs && cs.prereqs ? cs.prereqs.filter(p => !ds().done[p]) : [];
    if (miss.length) missing = el('div.ency-missing', [el('span.label', 'Falta en superficie'), chips(miss.map(k => link('item', k, { n: cs.missing[k] })))]);
    else if (pre.length) missing = el('div.ency-missing', [el('span.label', 'Requiere'), chips(pre.map(p => link('tech', p)))]);
    const busy = !!ds().research.current;
    const start = el('button.ency-btn' + (busy ? '' : '.primary'), { type: 'button', disabled: !(cs && cs.ok) || busy, title: busy ? 'Ya hay una investigación en curso: encólala' : null }, 'Investigar');
    start.addEventListener('click', () => { let ok = false; try { ok = Rs.start(id); } catch (e) { ok = false; } if (ok) { sfx('research'); afterResearchChange(); } else { sfx('error'); if (LD.UI.toast) LD.UI.toast('No se puede iniciar: faltan materiales o requisitos', 'warn'); } });
    const q = el('button.ency-btn' + (busy ? '.primary' : ''), { type: 'button', on: { click: () => { try { Rs.queue(id); } catch (e) { /* ignore */ } sfx('ui_click'); afterResearchChange(); } } }, 'En cola');
    wrap.append(start, q);
  } else if (st === 'queued') {
    wrap.append(el('button.ency-btn', { type: 'button', on: { click: () => { try { Rs.dequeue(id); } catch (e) { /* ignore */ } sfx('ui_click'); afterResearchChange(); } } }, 'Quitar de la cola'));
  } else if (st === 'current' && Rs.cancel) {
    wrap.append(el('button.ency-btn', { type: 'button', on: { click: () => { try { Rs.cancel(); } catch (e) { /* ignore */ } sfx('ui_click'); afterResearchChange(); } } }, 'Cancelar investigación'));
  }
  return el('div', [missing, wrap]);
}
function afterResearchChange() { snapshot(); if (state.section === 'techs') { updateTreeStates(); drawTreeEdges(); renderTreeSide(); renderTreeBar(); } else renderDetail(); renderRail(); }
function techDetail(id, compact) {
  const Rg = R(); const t = Rg.tech(id); if (!t) return null;
  if (!Disc.tech(id)) return unknownDetail('tech', id, U.eraName(t.era));
  const st = techStatus(id);
  const leads = [...Rg.techs.values()].filter(x => (x.requires || []).includes(id));
  const inv0 = ds().inv[0] || {};
  const cost = chips(Object.keys(t.cost || {}).map(k => { const c = link('item', k, { n: t.cost[k] }); if (ds().live) c.classList.add((inv0[k] || 0) >= t.cost[k] ? 'have' : 'lack'); return c; }));
  const un = t.unlocks || {};
  const prog = st === 'current' ? progressBar() : null;
  return el('article.ency-entry' + (compact ? '.compact' : ''), [
    el('header.ency-entry-h', [
      compact ? null : el('div.ency-thumb', sil('tech', 64)),
      el('div', [el('h2', t.name), el('div.ency-tags', [tag('Era ' + t.era + ' · ' + U.eraName(t.era)), el('span.ency-tag.st-' + st, STATUS_ES[st]), tag(LAB_NAMES[t.lab | 0] || 'Laboratorio ' + t.lab)]), el('div.ency-id', t.id)])
    ]),
    prog,
    para('ency-p', t.desc), t.hint ? el('p.ency-hint', t.hint) : null,
    kv([
      ['Coste', cost],
      ['Tiempo', el('span', [el('b.mono', U.fmtTime(t.time || 0)), el('span.dim', ' de laboratorio · más laboratorios, más rápido')])],
      ['Laboratorio', 'nivel ' + (t.lab | 0) + ' o superior · ' + (LAB_NAMES[t.lab | 0] || '')]
    ]),
    techActions(id),
    sec('Prerrequisitos', (t.requires || []).length ? chips(t.requires.map(r => link('tech', r))) : para('ency-p dim', 'Ninguno.')),
    sec('Desbloquea', el('div', [
      (un.structures || []).length ? chips(un.structures.map(s => link('structure', s))) : null,
      (un.recipes || []).length ? el('div.ency-recipes', un.recipes.map(rid => Rg.recipe(rid)).filter(Boolean).map(rc => recipeRow(rc))) : null,
      !(un.structures || []).length && !(un.recipes || []).length ? para('ency-p dim', 'Sin desbloqueos directos.') : null
    ])),
    leads.length ? sec('Lleva a', chips(leads.map(x => link('tech', x.id)))) : null
  ]);
}
function progressBar() {
  const Rs = LD.Sim && LD.Sim.Research; let p = null;
  try { p = Rs && Rs.progress ? Rs.progress() : null; } catch (e) { p = null; }
  const cur = ds().research.current;
  const left = p ? p.left : cur ? cur.left : 0, total = p ? p.total : cur ? cur.total : 1, speed = p ? p.speed : 0;
  const frac = total > 0 ? U.clamp(1 - left / total) : 0;
  return el('div.ency-progress', [
    el('div.bar', [el('i', { style: { width: (frac * 100).toFixed(1) + '%' } })]),
    el('div.mono', U.fmtPct(frac) + ' · ' + (speed > 0 ? 'quedan ' + U.fmtTime(left / speed) : left > 0 ? U.fmtTime(left) + ' de laboratorio · sin laboratorio activo' : 'completando'))
  ]);
}

function layerDetail(idx) {
  const Rg = R(); const L = Rg.layers[idx]; if (!L) return null;
  if (!Disc.layer(idx)) return unknownDetail('layer', String(idx), 'Capa ' + idx);
  const cw = Math.ceil(L.w / (L.chunk || 16)), ch = Math.ceil(L.h / (L.chunk || 16));
  const maxD = Math.max(Math.floor(cw / 2), Math.floor(ch / 2));
  const shaft = L.unlockedBy && Rg.structure(L.unlockedBy);
  const deps = (L.deposits || []).slice().sort((a, b) => (a.hardness | 0) - (b.hardness | 0));
  const exc = idx > 0 ? el('div', [
    para('ency-p', 'Cada bloque de ' + (L.chunk || 16) + '×' + (L.chunk || 16) + ' casillas nace como roca maciza. Una tuneladora de nivel ≥ ' + (L.borerTier | 0) + ' pegada a un bloque abierto lo excava; la dureza crece con la distancia d (en bloques) al elevador central:'),
    el('div.ency-formula', 'H = ' + fmtN(L.rockBase || 1) + ' · (1 + ' + fmtN(L.rockPerChunk || 0) + ' · d)     trabajo = H · 256'),
    el('table.ency-table', [
      el('thead', el('tr', [el('th', 'd'), el('th', 'dureza'), el('th', 'trabajo'), el('th', 'depósitos')])),
      el('tbody', U.arr(maxD + 1).map(d => { const Hh = (L.rockBase || 1) * (1 + (L.rockPerChunk || 0) * d); return el('tr', [el('td', String(d)), el('td', fmtN(Hh)), el('td', U.fmtInt(Hh * 256)), el('td', d >= maxD - 1 ? 'infinitos' : d <= maxD - 2 ? 'finitos' : '—')]); }))
    ]),
    para('ency-p dim', 'Mientras excava, la tuneladora entrega piedra 0,3/s, grava 0,2/s y un 5 % de la mena común de la capa.')
  ]) : para('ency-p', 'La superficie es edificable en su totalidad: no hay que excavar ni reclamar terreno. Los depósitos del anillo exterior son infinitos.');
  const live = ds().live && LD.G && LD.G.layers[idx];
  const st = live ? LD.G.layers[idx] : null;
  const exStats = idx > 0 && LD.World && LD.World.regionStats ? (() => { try { return LD.World.regionStats(idx); } catch (e) { return null; } })() : null;
  return el('article.ency-entry', [
    el('header.ency-entry-h', [
      el('div.ency-thumb', sil('layer', 64)),
      el('div', [el('h2', L.name), el('div.ency-tags', [tag('Capa ' + idx), tag(L.w + '×' + L.h + ' casillas'), L.heat ? tag('Calor extremo') : null, st && st.unlocked ? tag('Abierta') : null]), el('div.ency-id', L.id)])
    ]),
    para('ency-p', L.desc),
    kv([
      ['Dimensiones', L.w + '×' + L.h + ' casillas · ' + cw + '×' + ch + ' bloques de ' + (L.chunk || 16)],
      ['Ambiente', fmtMul(L.ambient === undefined ? 1 : L.ambient) + ' de luz' + (idx === 0 ? ' · ciclo día/noche de 600 s, clima' : ' · oscuridad real: necesita lámparas')],
      ['Acceso', idx === 0 ? 'Punto de partida' : el('span', [shaft ? link('structure', shaft.id) : 'Pozo', el('span.dim', ' desde la superficie; el elevador aparece en el centro')])],
      ['Tuneladora', idx > 0 ? 'nivel ≥ ' + (L.borerTier | 0) + ' · ' + U.tierName(L.borerTier | 0) : null],
      ['Oleadas', L.waveBase ? 'cada ' + U.fmtTime(L.waveBase) + ' (±20 %, según dificultad)' + (idx === 0 ? ' · de noche ×1,5' : '') : null],
      ['Excavado', exStats ? U.fmtPct(exStats.excavatedChunks / Math.max(1, exStats.totalChunks)) + ' (' + exStats.excavatedChunks + ' / ' + exStats.totalChunks + ' bloques)' : null],
      ['Amenaza', st ? fmtN(st.threat || 0) : null]
    ]),
    sec('Recursos', deps.length ? el('div.ency-lines', deps.map(dp => el('div.ency-line', [link('item', dp.res), el('span.mono.dim', 'dureza ' + (dp.hardness | 0) + (dp.fluid ? ' · fluido' : '') + (dp.size ? ' · vetas de ' + dp.size[0] + '–' + dp.size[1] : '') + (dp.amount ? ' · ' + fmtN(dp.amount[0]) + '–' + fmtN(dp.amount[1]) + ' u' : '')), el('span.dim', 'finito en el centro, infinito en el borde')]))) : para('ency-p dim', 'Sin depósitos.')),
    sec('Amenazas', (L.enemies || []).length ? chips(L.enemies.map(e => link('enemy', e))) : para('ency-p dim', 'Sin fauna registrada.')),
    sec('Excavación', exc)
  ]);
}

function enemyDetail(id) {
  const Rg = R(); const e = Rg.enemy(id); if (!e) return null;
  if (!Disc.enemy(id)) return unknownDetail('enemy', id, 'Capa ' + e.layer);
  const D = LD.Sim && LD.Sim.Defense;
  const M = (D && D.damageMatrix) || DMG_MATRIX;
  const vuln = Object.keys(DMG_NAMES).map(type => {
    const row = M[type] || {}; let m = row[e.armorType]; if (m === undefined) m = row.all !== undefined ? row.all : 1;
    if (e.armorType === 'void') m = (type === 'plasma' || type === 'thermal') ? 1 : 0;
    const cls = m <= 0 ? 'bad' : m < 1 ? 'warn' : 'ok';
    return el('div.ency-vuln', [el('span.t', DMG_NAMES[type]), el('span.bar', el('i.' + cls, { style: { width: Math.round(U.clamp(m / 1.5) * 100) + '%' } })), el('span.mono.' + cls, m <= 0 ? (e.armorType === 'void' ? 'solo perforante' : 'inmune') : '×' + fmtN(m))]);
  });
  const dps = (e.dmg || 0) * (e.attackRate || 1);
  return el('article.ency-entry', [
    el('header.ency-entry-h', [
      el('div.ency-thumb', enemyThumb(id, 64)),
      el('div', [el('h2', e.name), el('div.ency-tags', [link('layer', e.layer), e.boss ? el('span.ency-tag.verm', 'Jefe') : null, e.night ? tag('Nocturno') : null, tag(ARMOR_NAMES[e.armorType] || e.armorType)]), el('div.ency-id', e.id)])
    ]),
    para('ency-p', e.desc),
    kv([
      ['Integridad', el('b.mono', U.fmtInt(e.hp))],
      ['Velocidad', el('b.mono', fmtN(e.speed) + ' casillas/s')],
      ['Daño', el('span', [el('b.mono', fmtN(e.dmg) + ' × ' + fmtN(e.attackRate || 1) + '/s'), el('span.dim', ' = ' + fmtN(dps) + ' por segundo')])],
      ['Blindaje', (ARMOR_NAMES[e.armorType] || e.armorType) + ' · reduce ' + fmtN(e.armor || 0) + ' por impacto (mínimo 10 % del daño)'],
      ['Amenaza', el('b.mono', fmtN(e.threat || 1))],
      ['Tamaño', fmtN(e.size || 1)]
    ]),
    sec('Vulnerabilidad', el('div', [...vuln, para('ency-p dim', e.armorType === 'void' ? 'Solo lo hieren armas perforantes de plasma o térmicas.' : 'Las torretas perforantes ignoran el blindaje.')])),
    sec('Botín', e.drops && Object.keys(e.drops).length ? chips(Object.keys(e.drops).map(k => link('item', k, { n: e.drops[k] }))) : para('ency-p dim', 'No deja nada.')),
    sec('Comportamiento', el('ul.ency-ul', [
      el('li', e.night ? 'Nocturno: aparece sobre todo de noche, cuando las oleadas crecen ×1,5.' : 'Activo a cualquier hora.'),
      el('li', 'Busca la ruta más corta hasta el almacén o el elevador rodeando los muros; si no hay paso, abre brecha por el muro más débil.'),
      el('li', 'Ataca cualquier estructura a menos de 0,8 casillas de su camino cuando algo lo bloquea.'),
      e.boss ? el('li', 'Jefe: acompaña a una de cada cinco oleadas.') : null
    ]))
  ]);
}

/* markdown-lite: paragraphs, **bold**, `code`, "- " lists, "## " headings, [[kind:id]] links */
function inline(s) {
  const out = []; const re = /\*\*(.+?)\*\*|`(.+?)`|\[\[([a-z]+):([a-z0-9_]+)\]\]/g; let last = 0, m;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    if (m[1]) out.push(el('b', m[1])); else if (m[2]) out.push(el('code', m[2])); else out.push(link(m[3], m[4]));
    last = re.lastIndex;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}
function renderMd(src) {
  const root = el('div.ency-md'); let para0 = [], list = null;
  const flushP = () => { if (para0.length) { root.appendChild(el('p', inline(para0.join(' ')))); para0 = []; } };
  const flushL = () => { if (list) { root.appendChild(list); list = null; } };
  for (const raw of String(src || '').split('\n')) {
    const line = raw.trim();
    if (!line) { flushP(); flushL(); continue; }
    if (line.startsWith('## ') || line.startsWith('# ')) { flushP(); flushL(); root.appendChild(el('h3', inline(line.replace(/^#+\s*/, '')))); continue; }
    if (line.startsWith('- ') || line.startsWith('* ')) { flushP(); if (!list) list = el('ul'); list.appendChild(el('li', inline(line.slice(2)))); continue; }
    flushL(); para0.push(line);
  }
  flushP(); flushL();
  return root;
}
function guideDetail(id) {
  const Rg = R(); const gd = Rg.guides.find(x => x.id === id); if (!gd) return null;
  const i = Rg.guides.indexOf(gd);
  const related = (gd.related || []).map(rid => resolveKind(rid)).filter(Boolean);
  return el('article.ency-entry.ency-article', [
    el('header.ency-article-h', [el('div.ency-eyebrow', 'Mecánicas / ' + U.pad2(i + 1) + ' de ' + U.pad2(Rg.guides.length)), el('h2', gd.title)]),
    renderMd(gd.body),
    related.length ? sec('Relacionado', chips(related.map(r => link(r.kind, r.id)))) : null
  ]);
}

/* ── tech tree ── */
const TREE = { colW: 232, nodeW: 200, nodeH: 58, rowH: 74, padX: 28, padY: 18, headH: 46 };
function layoutTree() {
  const Rg = R(); const cols = U.arr(8).map(() => []);
  for (const t of Rg.techs.values()) cols[U.clamp(t.era | 0, 0, 7)].push(t);
  const pos = new Map();
  for (let e = 0; e < 8; e++) {
    const arr = cols[e]; const depth = new Map();
    const dep = t => { if (depth.has(t.id)) return depth.get(t.id); depth.set(t.id, 0); let d = 0; for (const r of (t.requires || [])) { const p = Rg.tech(r); if (p && (p.era | 0) === e) d = Math.max(d, dep(p) + 1); } depth.set(t.id, d); return d; };
    arr.forEach(dep);
    arr.sort((a, b) => dep(a) - dep(b) || a.name.localeCompare(b.name, 'es'));
    const prov = new Map(arr.map((t, i) => [t.id, i]));
    const bary = t => { const rows = (t.requires || []).map(r => pos.has(r) ? pos.get(r).row : prov.has(r) ? prov.get(r) + 0.5 : null).filter(v => v !== null); return rows.length ? rows.reduce((a, b) => a + b, 0) / rows.length : prov.get(t.id); };
    arr.sort((a, b) => bary(a) - bary(b) || dep(a) - dep(b) || a.name.localeCompare(b.name, 'es'));
    arr.forEach((t, i) => pos.set(t.id, { era: e, row: i, x: TREE.padX + e * TREE.colW, y: TREE.headH + TREE.padY + i * TREE.rowH }));
  }
  const rows = Math.max(1, ...cols.map(c => c.length));
  return { pos, cols, w: TREE.padX * 2 + 8 * TREE.colW, h: TREE.headH + TREE.padY * 2 + rows * TREE.rowH };
}
function pathSet() {
  const set = new Set(); const rs = ds().research; const cur = rs.current;
  const targets = []; if (cur) targets.push(typeof cur.tech === 'string' ? cur.tech : cur.tech && cur.tech.id); for (const q of (rs.queue || [])) targets.push(q);
  const walk = id => { if (!id || set.has(id) || ds().done[id]) return; set.add(id); const t = R().tech(id); if (t) for (const r of (t.requires || [])) walk(r); };
  targets.forEach(walk);
  return set;
}
function renderTechSection(body) {
  state.treeLayout = state.treeLayout || layoutTree();
  const lay = state.treeLayout;
  const main = el('div.ency-tree-main');
  state.treeBar = el('div.ency-tree-bar');
  const scroll = el('div.ency-tree-scroll');
  const inner = el('div.ency-tree-inner', { style: { width: (lay.w / 16) + 'rem', height: (lay.h / 16) + 'rem' } });
  const canvas = el('canvas.ency-tree-canvas');
  inner.appendChild(canvas);
  state.treeCanvas = canvas; state.treeInner = inner; state.treeNodes = new Map();
  for (let e = 0; e < 8; e++) {
    const col = lay.cols[e]; const done = col.filter(t => ds().done[t.id]).length;
    inner.appendChild(el('div.ency-era', { style: { left: ((TREE.padX + e * TREE.colW) / 16) + 'rem', width: (TREE.nodeW / 16) + 'rem' } }, [el('span', 'Era ' + e), el('b', U.eraName(e)), el('span.n', done + '/' + col.length)]));
  }
  for (const t of R().techs.values()) {
    const p = lay.pos.get(t.id); if (!p) continue;
    const n = el('button.ency-node', { type: 'button', data: { id: t.id }, style: { left: (p.x / 16) + 'rem', top: (p.y / 16) + 'rem', width: (TREE.nodeW / 16) + 'rem', height: (TREE.nodeH / 16) + 'rem' } }, [el('div.nm'), el('div.meta'), el('i.pip')]);
    n.addEventListener('click', () => { sfx('ui_click'); select('tech', t.id); });
    n.addEventListener('mouseenter', () => { state.hoverTech = t.id; drawTreeEdges(); });
    n.addEventListener('mouseleave', () => { if (state.hoverTech === t.id) { state.hoverTech = null; drawTreeEdges(); } });
    inner.appendChild(n); state.treeNodes.set(t.id, n);
  }
  scroll.appendChild(inner);
  main.append(state.treeBar, scroll);
  state.treeSide = el('div.ency-tree-side');
  body.append(main, state.treeSide);
  updateTreeStates(); renderTreeBar(); renderTreeSide();
  requestAnimationFrame(() => { drawTreeEdges(); scrollToFrontier(scroll, lay); });
}
function scrollToFrontier(scroll, lay) {
  let era = 0; const cols = lay.cols;
  for (let e = 0; e < 8; e++) if (cols[e].some(t => !ds().done[t.id])) { era = e; break; }
  const sel = state.sel.techs && lay.pos.get(state.sel.techs);
  const u = LD.Stage ? LD.Stage.scale : 1;
  scroll.scrollLeft = Math.max(0, ((sel ? sel.era : era) - 1) * TREE.colW) * u;
  if (sel) scroll.scrollTop = Math.max(0, sel.y - 200) * u;
}
function updateTreeStates() {
  if (!state.treeNodes) return;
  const path = pathSet(); const selId = state.sel.techs;
  for (const [id, n] of state.treeNodes) {
    const t = R().tech(id); const vis = Disc.tech(id); const st = techStatus(id);
    n.className = 'ency-node ' + (vis ? st : 'hidden') + (path.has(id) ? ' path' : '') + (id === selId ? ' sel' : '');
    n.querySelector('.nm').textContent = vis ? t.name : '???';
    n.querySelector('.meta').textContent = vis ? Object.keys(t.cost || {}).map(k => k.toUpperCase() + '×' + t.cost[k]).join(' ') + ' · ' + U.fmtTime(t.time || 0) + ' · L' + (t.lab | 0) : hintFor('tech', id);
    n.title = vis ? t.name + ' — ' + STATUS_ES[st] : hintFor('tech', id);
  }
}
function drawTreeEdges() {
  const c = state.treeCanvas, lay = state.treeLayout; if (!c || !lay) return;
  const S = LD.Stage || { scale: 1, dpr: 1 };
  const k = Math.max(0.1, (S.scale || 1) * (S.dpr || 1));
  const bw = Math.round(lay.w * k), bh = Math.round(lay.h * k);
  if (c.width !== bw || c.height !== bh) { c.width = bw; c.height = bh; c.style.width = (lay.w / 16) + 'rem'; c.style.height = (lay.h / 16) + 'rem'; }
  const ctx = c.getContext('2d'); ctx.setTransform(k, 0, 0, k, 0, 0); ctx.clearRect(0, 0, lay.w, lay.h);
  const cs = getComputedStyle(document.documentElement);
  const tok = n => cs.getPropertyValue(n).trim();
  const cLine = tok('--line') || 'rgba(236,231,220,.14)', cLine2 = tok('--line2') || 'rgba(236,231,220,.28)', cVerm = tok('--verm') || '#e8401c', cBone = tok('--bone2') || '#c9c4b8';
  ctx.lineWidth = 1; ctx.strokeStyle = cLine;
  for (let e = 1; e < 8; e++) { const x = Math.round(TREE.padX + e * TREE.colW - (TREE.colW - TREE.nodeW) / 2) + 0.5; ctx.beginPath(); ctx.moveTo(x, 8); ctx.lineTo(x, lay.h - 8); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(TREE.padX, TREE.headH - 8 + 0.5); ctx.lineTo(lay.w - TREE.padX, TREE.headH - 8 + 0.5); ctx.stroke();
  const path = pathSet(); const focus = state.hoverTech || state.sel.techs;
  const edges = [[], [], []]; // 0 dim, 1 done/focus, 2 path
  for (const t of R().techs.values()) {
    const b = lay.pos.get(t.id); if (!b) continue;
    for (const r of (t.requires || [])) {
      const a = lay.pos.get(r); if (!a) continue;
      const lvl = (path.has(t.id) && (path.has(r) || ds().done[r])) ? 2 : (focus === t.id || focus === r || ds().done[t.id]) ? 1 : 0;
      edges[lvl].push([a, b]);
    }
  }
  const draw = (a, b) => {
    ctx.beginPath();
    if (a.era === b.era) {
      const x = Math.round(a.x + TREE.nodeW - 12) + 0.5;
      const y1 = a.row < b.row ? a.y + TREE.nodeH : a.y, y2 = a.row < b.row ? b.y : b.y + TREE.nodeH;
      ctx.moveTo(x, y1); ctx.lineTo(x, y2);
    } else {
      const x1 = a.x + TREE.nodeW, y1 = Math.round(a.y + TREE.nodeH / 2) + 0.5, x2 = b.x, y2 = Math.round(b.y + TREE.nodeH / 2) + 0.5;
      const mx = Math.round(x2 - (TREE.colW - TREE.nodeW) / 2) + 0.5;
      ctx.moveTo(x1, y1); ctx.lineTo(mx, y1); ctx.lineTo(mx, y2); ctx.lineTo(x2, y2);
    }
    ctx.stroke();
  };
  ctx.strokeStyle = cLine; for (const [a, b] of edges[0]) draw(a, b);
  ctx.strokeStyle = focus ? cBone : cLine2; for (const [a, b] of edges[1]) draw(a, b);
  ctx.strokeStyle = cVerm; ctx.lineWidth = 1.5; for (const [a, b] of edges[2]) draw(a, b);
  // endpoint ticks on path edges
  ctx.fillStyle = cVerm; for (const [, b] of edges[2]) ctx.fillRect(b.x - 3, Math.round(b.y + TREE.nodeH / 2) - 2, 3, 4);
}
function renderTreeBar() {
  const bar = state.treeBar; if (!bar) return;
  U.clear(bar);
  const rs = ds().research; const cur = rs.current;
  const curId = cur ? (typeof cur.tech === 'string' ? cur.tech : cur.tech && cur.tech.id) : null;
  const t = curId && R().tech(curId);
  const n = U.count(ds().done), total = R().techs.size;
  bar.append(el('div.ency-eyebrow', 'Investigación'));
  if (t) {
    const Rs = LD.Sim && LD.Sim.Research; let p = null; try { p = Rs && Rs.progress ? Rs.progress() : null; } catch (e) { p = null; }
    const left = p ? p.left : cur.left, total2 = p ? p.total : cur.total, speed = p ? p.speed : 0;
    const frac = total2 > 0 ? U.clamp(1 - left / total2) : 0;
    bar.append(
      el('button.ency-tree-cur', { type: 'button', on: { click: () => select('tech', curId) } }, t.name),
      el('div.ency-progress.inline', [el('div.bar', [el('i', { style: { width: (frac * 100).toFixed(1) + '%' } })]), el('span.mono', U.fmtPct(frac) + (speed > 0 ? ' · ' + U.fmtTime(left / speed) : left > 0 ? ' · sin laboratorio' : ''))])
    );
  } else bar.append(el('span.dim', ds().live ? 'Nada en curso' : 'Última partida'));
  bar.append(el('div.spacer'), el('span.mono.dim', n + '/' + total + ' · ' + U.eraName(LD.G ? LD.G.meta.era || 0 : 0)));
  bar.append(el('div.ency-legend', [el('span.k.done', 'hecha'), el('span.k.avail', 'disponible'), el('span.k.locked', 'bloqueada'), el('span.k.path', 'ruta')]));
}
function renderTreeSide() {
  const side = state.treeSide; if (!side) return;
  const scrollTop = side.scrollTop;
  U.clear(side);
  const selId = state.sel.techs;
  if (selId && R().tech(selId)) side.appendChild(el('div.ency-side-sec', techDetail(selId, true)));
  else side.appendChild(el('div.ency-side-sec', [el('div.ency-eyebrow', 'Tecnología'), para('ency-p dim', 'Selecciona un nodo del árbol para ver su ficha.')]));
  const Rs = LD.Sim && LD.Sim.Research;
  let steps = [];
  if (ds().live && Rs && Rs.nextSteps) { try { steps = (Rs.nextSteps() || []).slice(0, 6); } catch (e) { steps = []; } }
  else { steps = [...R().techs.values()].filter(t => Disc.techAvailable(t.id)).slice(0, 6).map(t => ({ tech: t.id, missing: {}, affordable: false })); }
  const next = el('div.ency-side-sec.ency-next', [el('div.ency-eyebrow', 'Siguiente paso')]);
  if (!steps.length) next.appendChild(para('ency-p dim', U.count(ds().done) >= R().techs.size && R().techs.size ? 'Árbol completo.' : 'Nada disponible todavía.'));
  for (const s of steps) {
    const id = typeof s.tech === 'string' ? s.tech : s.tech && s.tech.id; const t = R().tech(id); if (!t) continue;
    const miss = Object.keys(s.missing || {}).filter(k => s.missing[k] > 0);
    const row = el('div.ency-next-row' + (s.affordable ? '.ok' : ''), [
      el('div.top', [link('tech', id), el('span.mono.dim', U.fmtTime(t.time || 0))]),
      miss.length ? el('div.miss', [el('span.label', 'Falta'), chips(miss.map(k => link('item', k, { n: s.missing[k] })))]) : el('div.miss', [el('span.label.ok', 'Materiales listos')]),
      ds().live && Rs ? el('div.ency-actions', [
        el('button.ency-btn' + (s.affordable && !ds().research.current ? '.primary' : ''), { type: 'button', disabled: !s.affordable || !!ds().research.current, on: { click: () => { let ok = false; try { ok = Rs.start(id); } catch (e) { ok = false; } if (ok) sfx('research'); else sfx('error'); afterResearchChange(); } } }, 'Investigar'),
        (ds().research.queue || []).includes(id) ? el('button.ency-btn', { type: 'button', on: { click: () => { try { Rs.dequeue(id); } catch (e) { /* ignore */ } afterResearchChange(); } } }, 'Quitar') : el('button.ency-btn', { type: 'button', on: { click: () => { try { Rs.queue(id); } catch (e) { /* ignore */ } sfx('ui_click'); afterResearchChange(); } } }, 'En cola')
      ]) : null
    ]);
    next.appendChild(row);
  }
  side.appendChild(next);
  const q = (ds().research.queue || []).slice();
  const queue = el('div.ency-side-sec.ency-queue', [el('div.ency-eyebrow', ['Cola ', el('span.n', String(q.length))])]);
  if (!q.length) queue.appendChild(para('ency-p dim', 'La cola está vacía. Al terminar la investigación actual arrancará la primera de la cola si es asequible.'));
  q.forEach((id, i) => {
    const G = LD.G;
    const move = d => { if (!G) return; const arr = G.research.queue; const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; sfx('ui_click'); afterResearchChange(); };
    queue.appendChild(el('div.ency-queue-row', [
      el('span.mono.dim', U.pad2(i + 1)), link('tech', id),
      el('div.spacer'),
      el('button.ency-mini', { type: 'button', disabled: i === 0, title: 'Subir', on: { click: () => move(-1) } }, '↑'),
      el('button.ency-mini', { type: 'button', disabled: i === q.length - 1, title: 'Bajar', on: { click: () => move(1) } }, '↓'),
      el('button.ency-mini', { type: 'button', title: 'Quitar', on: { click: () => { try { Rs && Rs.dequeue(id); } catch (e) { /* ignore */ } if (G && !(Rs && Rs.dequeue)) { const k = G.research.queue.indexOf(id); if (k >= 0) G.research.queue.splice(k, 1); } sfx('ui_click'); afterResearchChange(); } } }, '✕')
    ]));
  });
  side.appendChild(queue);
  side.scrollTop = scrollTop;
}

/* ── events while open ── */
function bind() {
  const E = LD.Events; if (!E) return;
  const soft = () => { snapshot(); scheduleRefresh(false); };
  const hard = () => { snapshot(); scheduleRefresh(true); };
  state.offs = [
    E.on('item:discovered', hard), E.on('tech:researched', hard), E.on('tech:started', hard), E.on('structure:placed', soft), E.on('structure:built', soft),
    E.on('layer:unlocked', hard), E.on('enemy:killed', soft), E.on('inv:changed', soft), E.on('stage:resize', () => { if (state.section === 'techs') drawTreeEdges(); }),
    E.on('screen:changed', s => { if (s !== 'game' && state.open && LD.G === null) { /* menu keeps the sheet usable */ } })
  ];
  state.timer = setInterval(() => { if (!state.open) return; if (state.section === 'techs') { renderTreeBar(); const cur = state.treeSide && state.treeSide.querySelector('.ency-progress'); if (cur) cur.replaceWith(progressBar()); } }, 1000);
}
function unbind() { for (const off of state.offs) { try { off(); } catch (e) { /* ignore */ } } state.offs = []; if (state.timer) clearInterval(state.timer); state.timer = 0; }
function scheduleRefresh(hard) {
  if (state.pending) clearTimeout(state.pending);
  state.pending = setTimeout(() => {
    state.pending = 0; if (!state.open || !state.root) return;
    renderRail();
    if (state.section === 'techs') { updateTreeStates(); drawTreeEdges(); renderTreeBar(); if (hard) renderTreeSide(); }
    else { renderList(); if (hard) renderDetail(); }
  }, 150);
}

/* ── public API ── */
function open(section, id) {
  snapshot();
  if (!state.open) { const G = LD.G; if (G && G.flags && G.flags.ency) { state.section = G.flags.ency.section || state.section; state.sel = Object.assign({}, G.flags.ency.sel || {}); } }
  if (section && SECTION_ALIAS[section]) section = SECTION_ALIAS[section];
  const prefer = section;
  if (id !== undefined && id !== null) {
    const k = resolveKind(id, prefer);
    if (k) { section = sectionOf(k.kind, k.id); state.sel[section] = k.id; }
  }
  if (section && !SECTIONS.some(s => s.id === section)) section = null;
  state.section = section || state.section || 'materials';
  const wasOpen = state.open;
  if (!wasOpen) {
    mount(); state.open = true;
    state.handle = { close: () => { state.handle = null; close(); } };
    if (LD.Main && LD.Main.pushOverlay) LD.Main.pushOverlay(state.handle);
    bind(); sfx('ui_open');
  }
  persist();
  renderAll();
  if (state.root) state.root.focus({ preventScroll: true });
  return true;
}
function close() {
  if (!state.open) return;
  state.open = false;
  unbind();
  if (state.pending) { clearTimeout(state.pending); state.pending = 0; }
  if (state.handle && LD.Main && LD.Main.removeOverlay) LD.Main.removeOverlay(state.handle);
  state.handle = null;
  unmount();
}
function toggle(section) {
  if (state.open && (!section || section === state.section)) { sfx('ui_close'); close(); return false; }
  open(section); return true;
}

LD.UI.Encyclopedia = {
  open, close, toggle, link,
  get isOpen() { return state.open; },
  get section() { return state.section; },
  sections: SECTIONS.map(s => ({ id: s.id, name: s.name })),
  hint: hintFor, isDiscovered: (kind, id) => describe(kind, id).disc,
  invalidate() { state.treeLayout = null; thumbCache.clear(); if (state.open) renderAll(); }
};
})();
