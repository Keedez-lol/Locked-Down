(() => {
'use strict';
const LD = window.LD;
LD.Content = LD.Content || {};
const R = LD.Registry = {
  items: new Map(), recipes: new Map(), structures: new Map(), techs: new Map(), enemies: new Map(),
  layers: [], terrains: new Map(), guides: [],
  byType: new Map(), producing: new Map(), consuming: new Map(), unlocker: new Map(), byCat: new Map(),
  START: { structures: [], recipes: [] },
  ready: false,

  init() {
    const C = LD.Content;
    const fill = (map, arr, label) => { map.clear(); for (const d of (arr || [])) { if (map.has(d.id)) console.warn('[Registry] duplicate ' + label + ' id ' + d.id); map.set(d.id, d); } };
    fill(R.items, C.items, 'item');
    fill(R.recipes, C.recipes, 'recipe');
    fill(R.structures, C.structures, 'structure');
    fill(R.techs, C.techs, 'tech');
    fill(R.enemies, C.enemies, 'enemy');
    fill(R.terrains, C.terrains, 'terrain');
    R.layers = (C.layers || []).slice().sort((a, b) => a.idx - b.idx);
    R.guides = C.guides || [];
    R.START = C.START || { structures: [], recipes: [] };
    R.byType.clear(); R.producing.clear(); R.consuming.clear(); R.unlocker.clear(); R.byCat.clear();
    for (const rc of R.recipes.values()) {
      if (!rc.name) { const first = Object.keys(rc.out || {})[0]; const it = first && R.items.get(first); rc.name = it ? it.name : rc.id; }
      if (!R.byType.has(rc.type)) R.byType.set(rc.type, []);
      R.byType.get(rc.type).push(rc);
      for (const id in rc.out) { if (!R.producing.has(id)) R.producing.set(id, []); R.producing.get(id).push(rc); }
      for (const id in rc.in) { if (!R.consuming.has(id)) R.consuming.set(id, []); R.consuming.get(id).push(rc); }
    }
    for (const s of R.structures.values()) {
      if (!R.byCat.has(s.cat)) R.byCat.set(s.cat, []);
      R.byCat.get(s.cat).push(s);
      for (const id in (s.cost || {})) { if (!R.consuming.has(id)) R.consuming.set(id, []); R.consuming.get(id).push({ id: 'build_' + s.id, structure: s.id, in: s.cost, out: {}, type: 'build', name: s.name, tier: s.tier, time: s.buildTime }); }
    }
    for (const t of R.techs.values()) {
      for (const sid of (t.unlocks && t.unlocks.structures) || []) R.unlocker.set('structure:' + sid, t.id);
      for (const rid of (t.unlocks && t.unlocks.recipes) || []) R.unlocker.set('recipe:' + rid, t.id);
    }
    for (const arr of R.byCat.values()) arr.sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
    R.ready = true;
    return R;
  },
  item(id) { return R.items.get(id); },
  recipe(id) { return R.recipes.get(id); },
  structure(id) { return R.structures.get(id); },
  tech(id) { return R.techs.get(id); },
  enemy(id) { return R.enemies.get(id); },
  layer(idx) { return R.layers[idx]; },
  terrain(id) { return R.terrains.get(id); },
  recipesByType(type) { return R.byType.get(type) || []; },
  recipesFor(structureId) {
    const s = R.structures.get(structureId);
    if (!s || !s.types) return [];
    const out = [];
    for (const t of s.types) for (const rc of R.recipesByType(t)) out.push(rc);
    return out.sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
  },
  producers(itemId) { return R.producing.get(itemId) || []; },
  consumers(itemId) { return R.consuming.get(itemId) || []; },
  unlockerOf(kind, id) { return R.unlocker.get(kind + ':' + id) || null; },
  isStart(kind, id) { return (kind === 'structure' ? R.START.structures : R.START.recipes).includes(id); },
  structuresByCat(cat) { return R.byCat.get(cat) || []; },
  structuresThatMake(itemId) {
    const set = new Set();
    for (const rc of R.producers(itemId)) for (const s of R.structures.values()) if (s.types && s.types.includes(rc.type)) set.add(s.id);
    return Array.from(set);
  },
  itemName(id) { const it = R.items.get(id); return it ? it.name : id; },
  structureName(id) { const s = R.structures.get(id); return s ? s.name : id; }
};
})();
