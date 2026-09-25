#!/usr/bin/env node
'use strict';
/* Content validator: node tools/validate.js  (exit 1 on errors) */
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const window = { performance: { now: () => 0 }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, addEventListener() {}, document: { createElement: () => ({ getContext: () => null, style: {}, classList: { add() {} }, appendChild() {}, setAttribute() {}, addEventListener() {}, dataset: {} }), documentElement: { style: {} }, createTextNode: () => ({}) }, innerWidth: 1920, innerHeight: 1080, devicePixelRatio: 1 };
window.window = window;
const ctx = vm.createContext(Object.assign({ console, Math, JSON, Date, Map, Set, Array, Object, Number, String, Boolean, Error, Float32Array, Uint8Array, Int32Array, Uint16Array, Uint32Array, Float64Array, Int16Array, Int8Array, isFinite, isNaN, parseInt, parseFloat, btoa: s => Buffer.from(s, 'binary').toString('base64'), atob: s => Buffer.from(s, 'base64').toString('binary'), encodeURIComponent, decodeURIComponent, escape, unescape }, window));
const load = f => { const p = path.join(root, 'src/js', f); if (!fs.existsSync(p)) { console.log('  (missing ' + f + ')'); return false; } vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f }); return true; };
['core/util.js', 'core/events.js', 'core/registry.js', 'core/state.js'].forEach(load);
const contentFiles = ['content/items.js', 'content/recipes.js', 'content/structures.js', 'content/techs.js', 'content/enemies.js', 'content/layers.js', 'content/guides.js'];
const present = contentFiles.filter(load);
const LD = ctx.window.LD; const C = LD.Content; LD.Registry.init(); const R = LD.Registry;
const errors = [], warns = [];
const err = m => errors.push(m), warn = m => warns.push(m);
const CANON = fs.readFileSync(path.join(root, 'docs/CANON.md'), 'utf8');
const canonStructures = [...CANON.matchAll(/^([a-z0-9_]+) \| [^|]+\| (core|logistics|storage|nature|extract|process|power|research|defense|special) \| (\d) \| (\d) \| ([a-z0-9_]+) \| ([a-z0-9_-]+) \|/gm)].map(m => ({ id: m[1], cat: m[2], tier: +m[3], size: +m[4], sprite: m[5], sfx: m[6] }));
const canonEnemies = [...CANON.matchAll(/^([a-z_]+) \| [^|]+ \| L(\d) \|/gm)].map(m => ({ id: m[1], layer: +m[2] }));
const canonRaw = (() => { const sec = CANON.split('## C.')[1].split('## D.')[0]; return [...sec.matchAll(/\b([a-z][a-z0-9_]+)(?:\((?:h\d[^)]*|infinite[^)]*)\))?/g)].map(m => m[1]).filter(id => R.items.has(id) || /_ore$|^(wood_log|stick|plant_fiber|stone|flint|clay|sand|water|hide|bone|sinew|resin|sapling|peat|salt|coal|limestone|sulfur|saltpeter|crude_oil|quartz|amethyst|bauxite|chromite|natural_gas|rutile|wolframite|spodumene|molybdenite|vanadinite|monazite|uraninite|thorite|diamond_raw|ruby_raw|sapphire_raw|obsidian|basalt|corestone|plasma_crystal|magma|deuterium_brine|helium3|algae|rubber_sap|chitin|crystal_shard|heat_gland|void_essence)$/.test(id)); })();
const RECIPE_TYPES = 'hand, workbench, kiln, smelting, blast, forging, sawing, crushing, tanning, pressing, lathe, wiremill, assembling, mixing, distilling, chemical, refining, electrolysis, centrifuge, compressing, arc, vacuum, fabrication, enrichment, nuclear_fab, cryo, quantum, research, ammo'.split(', ');
const ITEM_CATS = 'raw ore crushed ingot plate rod gear wire part component circuit fluid gas chemical fuel nuclear crystal organic building ammo science exotic'.split(' ');
const SFX_KEYS = new Set('furnace, kiln, forge, hammer, saw, mill, steam, boiler, crusher, press, lathe, wiremill, assembler, electric_hum, chemical, refinery, electrolyzer, centrifuge, compressor, arc, vacuum, enrichment, cryo, fabricator, nano, quantum, drill_hand, drill_steam, drill_electric, drill_laser, drill_plasma, pump, wheel, windmill, generator_diesel, turbine, reactor, fusion, lab, turret_charge, waterwheel, farm, bonsai'.split(', ').concat(['-']));

console.log(`items ${R.items.size}, recipes ${R.recipes.size}, structures ${R.structures.size}, techs ${R.techs.size}, enemies ${R.enemies.size}, layers ${R.layers.length}, terrains ${R.terrains.size}, guides ${R.guides.length}`);

/* items */
const obtainable = new Map(); // itemId -> [sources]
const addSrc = (id, s) => { if (!obtainable.has(id)) obtainable.set(id, []); obtainable.get(id).push(s); };
for (const it of R.items.values()) {
  if (!ITEM_CATS.includes(it.cat)) err(`item ${it.id}: bad cat ${it.cat}`);
  if (typeof it.tier !== 'number' || it.tier < 0 || it.tier > 7) err(`item ${it.id}: bad tier`);
  if (!/^#[0-9a-f]{6}$/i.test(it.color || '')) err(`item ${it.id}: bad color`);
  if (!it.name || !it.desc) err(`item ${it.id}: missing name/desc`);
  if (it.fuel !== undefined && it.fuel !== null && (typeof it.fuel !== 'number' || it.fuel < 0)) err(`item ${it.id}: bad fuel`);
}
for (const rc of R.recipes.values()) {
  if (!RECIPE_TYPES.includes(rc.type)) err(`recipe ${rc.id}: bad type ${rc.type}`);
  if (!(rc.time > 0)) err(`recipe ${rc.id}: bad time`);
  if (typeof rc.tier !== 'number') err(`recipe ${rc.id}: missing tier`);
  for (const k in rc.in) { if (!R.items.has(k)) err(`recipe ${rc.id}: unknown input ${k}`); if (!(rc.in[k] > 0)) err(`recipe ${rc.id}: bad qty ${k}`); }
  for (const k in rc.out) { if (!R.items.has(k)) err(`recipe ${rc.id}: unknown output ${k}`); else addSrc(k, 'recipe:' + rc.id); if (!(rc.out[k] > 0)) err(`recipe ${rc.id}: bad qty ${k}`); }
  if (!Object.keys(rc.out || {}).length) err(`recipe ${rc.id}: no outputs`);
  if (!R.byType.get(rc.type)) err(`recipe ${rc.id}: type has no structure`);
  const hasMachine = [...R.structures.values()].some(s => s.types && s.types.includes(rc.type));
  if (!hasMachine) err(`recipe ${rc.id}: no structure runs type ${rc.type}`);
}
/* deposits & nature & drops as sources */
for (const L of R.layers) for (const d of (L.deposits || [])) { if (!R.items.has(d.res)) err(`layer ${L.idx}: deposit res ${d.res} unknown`); else addSrc(d.res, 'deposit:L' + L.idx); }
for (const t of R.terrains.values()) if (t.natural && t.natural.item) { if (!R.items.has(t.natural.item)) err(`terrain ${t.id}: natural item unknown`); else addSrc(t.natural.item, 'terrain:' + t.id); }
for (const e of R.enemies.values()) for (const k in (e.drops || {})) { if (!R.items.has(k)) err(`enemy ${e.id}: drop ${k} unknown`); else addSrc(k, 'drop:' + e.id); }
for (const s of R.structures.values()) if (s.nature && s.nature.out) for (const k in s.nature.out) { if (!R.items.has(k)) err(`structure ${s.id}: nature out ${k} unknown`); else addSrc(k, 'nature:' + s.id); }
for (const s of R.structures.values()) if (s.nature && s.nature.byproducts) for (const k in s.nature.byproducts) { if (!R.items.has(k)) err(`structure ${s.id}: byproduct ${k} unknown`); else addSrc(k, 'nature:' + s.id); }
/* every item obtainable & used */
let rawCount = 0, compCount = 0;
for (const it of R.items.values()) {
  const src = obtainable.get(it.id) || [];
  if (!src.length) err(`item ${it.id}: not obtainable anywhere`);
  const byRecipe = src.some(s => s.startsWith('recipe:'));
  if (!byRecipe) rawCount++; else compCount++;
  const used = (R.consuming.get(it.id) || []).length > 0 || [...R.structures.values()].some(s => (s.power && s.power.fuel && s.power.fuel.includes(it.id)) || (s.burn && s.burn.fuels && s.burn.fuels.includes(it.id)) || (s.turret && s.turret.ammo && s.turret.ammo[it.id]) || (s.nature && s.nature.consumes && s.nature.consumes[it.id]) || (s.extract && s.extract.consumes && s.extract.consumes[it.id]));
  const usedByTech = [...R.techs.values()].some(t => t.cost && t.cost[it.id]);
  if (!used && !usedByTech && it.cat !== 'exotic' && !it.final) warn(`item ${it.id}: never consumed (mark final:true if intended)`);
}
if (rawCount < 60) err(`only ${rawCount} raw materials (need ≥60)`);
if (compCount < 100) err(`only ${compCount} crafted items (need ≥100)`);
for (const id of canonRaw) if (!R.items.has(id)) err(`canon raw material missing from items: ${id}`);

/* structures */
const canonIds = new Set(canonStructures.map(c => c.id));
for (const c of canonStructures) {
  const s = R.structures.get(c.id);
  if (!s) { err(`canon structure missing: ${c.id}`); continue; }
  if (s.cat !== c.cat) err(`structure ${c.id}: cat ${s.cat} ≠ canon ${c.cat}`);
  if (s.tier !== c.tier) err(`structure ${c.id}: tier ${s.tier} ≠ canon ${c.tier}`);
  if (s.size !== c.size) err(`structure ${c.id}: size ${s.size} ≠ canon ${c.size}`);
  if (s.sprite !== c.sprite) err(`structure ${c.id}: sprite ${s.sprite} ≠ canon ${c.sprite}`);
  const sfx = s.sfx || '-'; if (sfx !== c.sfx) err(`structure ${c.id}: sfx ${sfx} ≠ canon ${c.sfx}`);
}
for (const s of R.structures.values()) {
  if (!canonIds.has(s.id)) err(`structure ${s.id} not in canon`);
  if (!s.name || !s.desc) err(`structure ${s.id}: missing name/desc`);
  if (s.id !== 'hub' && s.id !== 'elevator') { if (!s.cost || !Object.keys(s.cost).length) err(`structure ${s.id}: no cost`); if (!(s.buildTime >= 1 && s.buildTime <= 60)) err(`structure ${s.id}: buildTime out of range`); }
  if (!(s.hp > 0)) err(`structure ${s.id}: hp missing`);
  if (!SFX_KEYS.has(s.sfx || '-')) err(`structure ${s.id}: sfx key ${s.sfx} not canon`);
  for (const k in (s.cost || {})) { const it = R.items.get(k); if (!it) err(`structure ${s.id}: cost item ${k} unknown`); else if (it.tier > s.tier + 1) warn(`structure ${s.id}: cost item ${k} tier ${it.tier} > structure tier+1`); }
  if (s.types) for (const t of s.types) if (!RECIPE_TYPES.includes(t)) err(`structure ${s.id}: bad type ${t}`);
  if (s.power && s.power.use !== undefined && !(s.power.use > 0)) err(`structure ${s.id}: power.use must be >0`);
  if (s.power && s.power.gen !== undefined && !(s.power.gen > 0)) err(`structure ${s.id}: power.gen must be >0`);
  if (s.power && s.power.fuel) for (const f of s.power.fuel) { const it = R.items.get(f); if (!it) err(`structure ${s.id}: fuel ${f} unknown`); else if (!(it.fuel > 0)) err(`structure ${s.id}: fuel ${f} has no fuel value`); }
  if (s.burn && s.burn.fuels) for (const f of s.burn.fuels) { const it = R.items.get(f); if (!it) err(`structure ${s.id}: fuel ${f} unknown`); else if (!(it.fuel > 0)) err(`structure ${s.id}: fuel ${f} has no fuel value`); }
  if (s.turret && s.turret.ammo) for (const a in s.turret.ammo) if (!R.items.has(a)) err(`structure ${s.id}: ammo ${a} unknown`);
  if (s.extract && !(s.extract.rate > 0)) err(`structure ${s.id}: extract.rate`);
  if (s.conveyor && !(s.conveyor.rate > 0)) err(`structure ${s.id}: conveyor.rate`);
}
/* techs */
const start = R.START;
for (const sid of start.structures) if (!R.structures.has(sid)) err(`START structure unknown ${sid}`);
for (const rid of start.recipes) if (!R.recipes.has(rid)) err(`START recipe unknown ${rid}`);
const unlockCount = new Map();
for (const t of R.techs.values()) {
  if (!t.name || !t.desc) err(`tech ${t.id}: missing name/desc`);
  if (typeof t.era !== 'number' || t.era < 0 || t.era > 7) err(`tech ${t.id}: bad era`);
  for (const r of (t.requires || [])) if (!R.techs.has(r)) err(`tech ${t.id}: requires unknown ${r}`);
  for (const k in (t.cost || {})) if (!R.items.has(k)) err(`tech ${t.id}: cost item ${k} unknown`);
  if (!Object.keys(t.cost || {}).length) err(`tech ${t.id}: no cost`);
  for (const sid of (t.unlocks && t.unlocks.structures) || []) { if (!R.structures.has(sid)) err(`tech ${t.id}: unlocks unknown structure ${sid}`); unlockCount.set('s:' + sid, (unlockCount.get('s:' + sid) || 0) + 1); }
  for (const rid of (t.unlocks && t.unlocks.recipes) || []) { if (!R.recipes.has(rid)) err(`tech ${t.id}: unlocks unknown recipe ${rid}`); unlockCount.set('r:' + rid, (unlockCount.get('r:' + rid) || 0) + 1); }
}
for (const s of R.structures.values()) { const n = (unlockCount.get('s:' + s.id) || 0) + (start.structures.includes(s.id) ? 1 : 0); if (s.id === 'elevator') continue; if (n !== 1) err(`structure ${s.id}: unlocked by ${n} sources (need exactly 1)`); }
for (const rc of R.recipes.values()) { const n = (unlockCount.get('r:' + rc.id) || 0) + (start.recipes.includes(rc.id) ? 1 : 0); if (n !== 1) err(`recipe ${rc.id}: unlocked by ${n} sources (need exactly 1)`); }
/* tech graph acyclic + reachable */
const state = new Map();
const visit = (id, stack) => { if (state.get(id) === 2) return; if (state.get(id) === 1) { err(`tech cycle at ${id} via ${stack.join('>')}`); return; } state.set(id, 1); for (const r of (R.techs.get(id).requires || [])) if (R.techs.has(r)) visit(r, stack.concat(id)); state.set(id, 2); };
for (const t of R.techs.values()) visit(t.id, []);
/* progression feasibility: simulate unlocking with obtainable items */
const unlockedS = new Set(start.structures), unlockedR = new Set(start.recipes), done = new Set();
const canMake = new Set();
const recompute = () => {
  let changed = true;
  while (changed) {
    changed = false;
    for (const [id, srcs] of obtainable) {
      if (canMake.has(id)) continue;
      const ok = srcs.some(s => {
        if (s.startsWith('recipe:')) { const rc = R.recipes.get(s.slice(7)); if (!unlockedR.has(rc.id)) return false; const machineOk = [...unlockedS].some(sid => { const st = R.structures.get(sid); return st && st.types && st.types.includes(rc.type); }); if (!machineOk) return false; return Object.keys(rc.in).every(k => canMake.has(k)); }
        if (s.startsWith('nature:')) return unlockedS.has(s.slice(7));
        if (s.startsWith('deposit:')) { const L = +s.slice(9); const dep = R.layers[L].deposits.find(d => d.res === id); const layerOpen = L === 0 || [...unlockedS].some(sid => { const st = R.structures.get(sid); return st && st.shaft && st.shaft.layer >= L && Object.keys(st.cost).every(k => canMake.has(k)); }); if (!layerOpen) return false; return [...unlockedS].some(sid => { const st = R.structures.get(sid); return st && st.extract && st.extract.hardnessMax >= (dep.hardness || 0) && (!st.extract.fluids === !dep.fluid) && Object.keys(st.cost).every(k => canMake.has(k)); }); }
        if (s.startsWith('terrain:')) return true;
        if (s.startsWith('drop:')) { const e = R.enemies.get(s.slice(5)); return e.layer === 0 || [...unlockedS].some(sid => { const st = R.structures.get(sid); return st && st.shaft && st.shaft.layer >= e.layer && Object.keys(st.cost).every(k => canMake.has(k)); }); }
        return false;
      });
      if (ok) { canMake.add(id); changed = true; }
    }
  }
};
let progressed = true;
recompute();
while (progressed) {
  progressed = false;
  for (const t of R.techs.values()) {
    if (done.has(t.id)) continue;
    if ((t.requires || []).every(r => done.has(r)) && Object.keys(t.cost).every(k => canMake.has(k))) {
      done.add(t.id); for (const s of (t.unlocks.structures || [])) unlockedS.add(s); for (const r of (t.unlocks.recipes || [])) unlockedR.add(r); progressed = true; recompute();
    }
  }
}
const unreached = [...R.techs.values()].filter(t => !done.has(t.id));
for (const t of unreached) err(`tech ${t.id} unreachable: missing ${Object.keys(t.cost).filter(k => !canMake.has(k)).join(',') || 'prereqs ' + (t.requires || []).filter(r => !done.has(r)).join(',')}`);
const unmakeable = [...R.items.keys()].filter(id => !canMake.has(id));
for (const id of unmakeable) err(`item ${id} never makeable through progression`);
/* enemies */
const canonEnemyIds = new Set(canonEnemies.map(e => e.id));
for (const c of canonEnemies) { const e = R.enemies.get(c.id); if (!e) err(`canon enemy missing ${c.id}`); else if (e.layer !== c.layer) err(`enemy ${c.id}: layer ${e.layer} ≠ ${c.layer}`); }
for (const e of R.enemies.values()) { if (!canonEnemyIds.has(e.id)) err(`enemy ${e.id} not canon`); if (!(e.hp > 0 && e.speed > 0 && e.dmg > 0)) err(`enemy ${e.id}: stats`); if (!['none', 'chitin', 'crystal', 'basalt', 'void'].includes(e.armorType)) err(`enemy ${e.id}: armorType`); }
/* layers */
if (R.layers.length !== 5) err(`need 5 layers, got ${R.layers.length}`);
for (const L of R.layers) { for (const e of (L.enemies || [])) if (!R.enemies.has(e)) err(`layer ${L.idx}: enemy ${e} unknown`); if (!(L.w > 0 && L.h > 0 && L.chunk > 0)) err(`layer ${L.idx}: dims`); }
/* science & fuels */
for (const id of ['rp0', 'rp1', 'rp2', 'rp3', 'rp4', 'rp5']) if (!R.items.has(id)) err(`science item ${id} missing`);
for (const id of ['arrow', 'ballista_bolt', 'cannon_shell', 'bullet']) if (!R.items.has(id)) err(`ammo item ${id} missing`);
for (const id of ['fuel_rod', 'uranium_pellet', 'enriched_uf6', 'uf6', 'yellowcake', 'fusion_pellet', 'deuterium', 'tritium']) if (!R.items.has(id)) err(`nuclear chain item ${id} missing`);

console.log(`raw materials: ${rawCount}, crafted: ${compCount}`);
for (const w of warns) console.log('  warn: ' + w);
for (const e of errors) console.log('  ERROR: ' + e);
console.log(`${errors.length} errors, ${warns.length} warnings`);
process.exit(errors.length ? 1 : 0);
