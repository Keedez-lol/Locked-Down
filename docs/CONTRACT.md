# LOCKED DOWN — Architecture & Content Contract

Single-file HTML idle/incremental factory game. Spanish UI. Everything procedural (no external assets, no CDN).
This document is the binding contract between all modules. Read it fully before writing any module.

## 0. Vision

You are sealed inside a territory above five strata of a planet's crust. Start in a medieval era with sticks and
stones; end extracting neutronium from the core with fusion power. GregTech-flavoured: long material chains,
voltage-like tiers, overclocking, integrity/wear, power in W/kW/MW/GW, realistic fuel chains (uranium ore →
yellowcake → UF6 → enrichment → pellets → fuel rods → fission reactor). Base defense against hostile fauna
(surface) up to void entities (core). Territory expansion by chunks. Encyclopedia of everything discovered.

Tone: technical drawing / Swiss modular grid / matte minimalism. The main menu background is the KDZ kinetic
typography piece (WebGL2, ink #0c0c0d on bone paper #ece7dc, vermilion #e8401c accents, monospace uppercase
labels with wide tracking, hairline rules, "DWG NO." title blocks). The whole game inherits that identity.

## 1. Visual identity (binding)

CSS tokens (defined in `src/css/base.css`, use them, never hardcode colours in modules):

```
--ink:#0c0c0d  --ink2:#141416  --ink3:#1c1c1f  --ink4:#26262a
--bone:#ece7dc --bone2:#c9c4b8 --bone3:#8f8b82 --bone4:#5a5751
--line:rgba(236,231,220,.14)  --line2:rgba(236,231,220,.28)
--verm:#e8401c --verm2:#f0704f
--ok:#8fb87a --warn:#d9a441 --bad:#e8401c --info:#7aa6c9
--mono: ui-monospace, "SF Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace
--sans: "Inter", "Helvetica Neue", Helvetica, Arial, sans-serif
```

Rules:
- Matte. No drop shadows, no glossy gradients, no rounded blobs (max radius 2px), no emoji. Hairline 1px rules.
- Labels: monospace, uppercase, letter-spacing .12em–.18em, sizes 10–12px (in rem units, see stage scaling).
- Body text: sans, 13–14px. Numbers: monospace, tabular.
- Accent = vermilion, used sparingly (active state, alerts, the one CTA).
- In-game UI is ink-dark (panels `--ink2`, borders `--line`). Menu overlays over the KDZ paper are ink slabs
  (bone text on ink) or paper sheets (ink text on bone) — never grey translucent boxes.
- Icons are drawn (canvas or inline SVG), monoline, 1.5px strokes, never emoji.
- World rendering is naturalistic but desaturated/matte, no cartoon outlines.

## 2. Stage & scaling (16:9)

`#stage` is a 1920×1080 logical box centred in the viewport with letterboxing. `LD.Stage` sets
`document.documentElement.style.fontSize = (stageWidthPx / 1920 * 16) + 'px'`, so **all CSS must use `rem`**
(1rem = 16 logical px) and never `px`/`vw`/`vh` for sizes (1px hairlines are the only exception, written as
`1px`). Canvases are `1920×1080 × min(devicePixelRatio,2)` backing pixels, CSS-sized to the stage.
`LD.Stage.toLogical(clientX, clientY)` → `{x,y}` in 1920×1080 space.

## 3. Files, namespaces, build

No module system. Every file is an IIFE that attaches to the global `LD` object (`window.LD`). Build order
(`build.js` concatenates in this exact order into `dist/index.html`; CSS files in alphabetical order into one
`<style>`):

```
src/js/core/util.js        LD.U        (written, do not rewrite; extend only by adding functions)
src/js/core/events.js      LD.Events
src/js/core/registry.js    LD.Registry (indexes LD.Content.*)
src/js/core/state.js       LD.State, LD.Settings, LD.G (current game)
src/js/core/stage.js       LD.Stage
src/js/content/items.js    LD.Content.items[]
src/js/content/recipes.js  LD.Content.recipes[]
src/js/content/structures.js LD.Content.structures[]
src/js/content/techs.js    LD.Content.techs[]
src/js/content/enemies.js  LD.Content.enemies[]
src/js/content/layers.js   LD.Content.layers[], LD.Content.terrains[]
src/js/content/guides.js   LD.Content.guides[] (encyclopedia mechanics articles)
src/js/gen/textures.js     LD.Tex   (terrain tiles, icons)
src/js/gen/sprites.js      LD.Sprites (structure & enemy sprites)
src/js/gen/world.js        LD.World (worldgen, tile access, territory)
src/js/sim/economy.js      LD.Sim.Economy (inventory, recipes, machines, logistics)
src/js/sim/power.js        LD.Sim.Power
src/js/sim/build.js        LD.Sim.Build (construction, dismantle, integrity, repair, overclock)
src/js/sim/research.js     LD.Sim.Research
src/js/sim/nature.js       LD.Sim.Nature (trees, regrowth, farms, water, gathering)
src/js/sim/defense.js      LD.Sim.Defense (waves, enemies, turrets, walls)
src/js/sim/sim.js          LD.Sim (tick orchestration, offline progress, debug API)
src/js/render/particles.js LD.Particles
src/js/render/render.js    LD.Render (camera, world, lighting, overlays)
src/js/audio/audio.js      LD.Audio (engine, mixer, sfx synths, machine loops)
src/js/audio/music.js      LD.Music (menu ambient)
src/js/ui/ui.js            LD.UI (shared widgets: modal, toast, tooltip, icon helpers, number formatting hooks)
src/js/ui/menu.js          LD.UI.Menu (main menu + KDZ adapter hooks, new game/continue/slots)
src/js/ui/hud.js           LD.UI.HUD (top bar, strata widget, inventory tray, layer switch, notifications)
src/js/ui/build.js         LD.UI.Build (build palette, placement, dismantle mode)
src/js/ui/panel.js         LD.UI.Panel (selected structure panel, recipe picker, OC, repair)
src/js/ui/encyclopedia.js  LD.UI.Encyclopedia (also research/tech tree view)
src/js/ui/settings.js      LD.UI.Settings
src/js/ui/pause.js         LD.UI.Pause (ESC menu: continuar, guardar, enciclopedia, ajustes, salir)
src/js/vendor/kdz.js       LD.KDZ (adapted animation: init(canvas) → {start, stop, seek})
src/js/main.js             LD.Main (boot, screen state machine, game loop)
```

Each file starts with `(() => { 'use strict'; const LD = window.LD; ... })();` and ends there. Never use
`import`/`export`. Never rely on load order at definition time other than `LD.U` (core) being present; resolve
other namespaces at call time (`LD.Sim.Economy.x()` inside functions, not at file top level).

Build: `node build.js` → `dist/index.html` (single file). `node tools/validate.js` validates content.
`node tools/smoke.mjs` runs Playwright headless smoke tests and screenshots into `tools/out/`.

## 4. Core APIs (implemented in src/js/core — read the code)

- `LD.U`: math (`clamp, lerp, smooth, easeOut...`), `fmt(n)` compact numbers with es-ES style, `fmtW(watts)` →
  `"1,20 kW"`, `fmtJ`, `fmtTime(s)`, `fmtPct`, `hash2(x,y,seed)`, `rng(seed)` (mulberry32), `noise2`, `fbm`,
  `hex→rgb` helpers, `uid()`, `el(tag, attrs, children)` DOM builder, `esc(str)`.
- `LD.Events.on(name, fn)`/`off`/`emit(name, payload)`. Event names (emit exactly these):
  `game:new, game:loaded, game:saved, tick, inv:changed(itemId), item:discovered(itemId), tech:researched(id),
  structure:placed(uid), structure:built(uid), structure:removed(uid), structure:selected(uid|null),
  structure:broken(uid), layer:changed(idx), layer:unlocked(idx), territory:claimed({layer,cx,cy}),
  wave:incoming({layer, at}), wave:started({layer}), wave:ended({layer}), enemy:killed(enemy), power:brownout(bool),
  offline:summary(summary), toast({text, kind}), screen:changed(name)`.
- `LD.Registry`: `items, recipes, structures, techs, enemies, layers, terrains` (Maps by id) plus
  `recipesByType(type)`, `recipesFor(structureId)`, `producing(itemId)`, `consuming(itemId)`,
  `unlockerOf(kind,id)` → techId|null, `structuresByCat(cat)`, `init()` (called by Main after content loads).
- `LD.State`: `newGame({name, difficulty, seed})`, `save(slot)`, `load(slot)`, `slots()`, `exportString()`,
  `importString(s)`, `deleteSlot(slot)`; `LD.G` = live game state (shape §6). `LD.Settings` (global, not per
  save): `get()`, `set(patch)`, `DEFAULTS`.
- `LD.Stage`: `init()`, `toLogical(cx,cy)`, `size()` → `{w,h,scale,left,top}`, `on('resize')` via Events
  (`stage:resize`).

## 5. Content schemas (src/js/content)

All ids: lowercase snake_case ASCII. All display names Spanish (`name`), with `desc` (1–2 sentences, Spanish,
technical tone, no fluff) and optionally `lore` (encyclopedia extra paragraph).

### 5.1 Item
```js
{ id:'iron_ingot', name:'Lingote de hierro', cat:'ingot', tier:1, color:'#a8a49c', color2:'#6b6862',
  desc:'...', fuel:0 /* MJ per unit if burnable */, science:false }
```
`cat` ∈ `raw | ore | crushed | ingot | plate | rod | gear | wire | part | component | circuit | fluid | gas |
chemical | fuel | nuclear | crystal | organic | building | ammo | science | exotic`.
Icons are generated from `cat` + `color`/`color2` by `LD.Tex.icon(itemId, size)`.

### 5.2 Recipe
```js
{ id:'smelt_iron', type:'smelting', tier:1, in:{iron_ore:1}, out:{iron_ingot:1}, time:6, energy:null,
  name:null /* derived from first output */ }
```
`type` is a crafting category; a structure lists the `types` it can run. `tier` is the minimum effective tier of the
machine (native tier + overclock). `time` in seconds at speed 1. `energy` (W) overrides the machine's `power.use`
while running this recipe (null = machine default). Recipe types (fixed list):
`hand, workbench, kiln, smelting, blast, forging, sawing, crushing, tanning, pressing, lathe, wiremill,
assembling, mixing, distilling, chemical, refining, electrolysis, centrifuge, compressing, arc, vacuum,
fabrication, enrichment, nuclear_fab, cryo, quantum, research, ammo`.
Fluids/gases are ordinary items (units = litres-ish); no fluid network.

### 5.3 Structure
```js
{ id:'steam_engine', name:'Máquina de vapor', cat:'power', tier:2, size:2, sprite:'steam_engine', sfx:'steam',
  cost:{ iron_plate:12, bronze_gear:4, brick:20, copper_pipe:6 }, buildTime:6, hp:600,
  power:{ gen:60000, fuel:['coal','coke','charcoal','wood_log'], water:0.2 } // producer
  // or power:{ use:30000 } consumer, or none for T0 fuel machines: burn:{ mjPerSec:0.05, fuels:[...] }
  types:['smelting'], speed:1, ocMax:2,
  extract:{ hardnessMax:2, rate:0.5, fluids:false },   // extractors only
  conveyor:{ rate:8 },                                 // conveyors only
  storage:{ cap:600 },                                 // adds to per-item cap
  nature:{ kind:'woodcutter', radius:5, rate:0.4, consumes:{water:0.05} },
  turret:{ range:6, dmg:6, rate:1, dmgType:'kinetic', ap:false, ammo:{arrow:1}, ammoPerShot:1 },
  wall:true, heatproof:false, light:{ radius:4, color:'#ffb060', intensity:0.8 },
  shaft:{ layer:1 }, research:{ /* labs are ordinary machines running 'research' recipes */ },
  desc:'...', lore:'...' }
```
`cat` ∈ `core | logistics | storage | nature | extract | process | power | research | defense | special`.
`size` ∈ 1|2|3 (square footprint, anchored at top-left tile `x,y`). `buildTime` seconds (2–60; hub instant).
`hp` = integrity pool used by defense damage → integrity% = hpNow/hp. Sprites/sfx keys are the canonical ones in
§9/§10. `tier` 0–7.

### 5.4 Tech
```js
{ id:'bronze_working', name:'Trabajo del bronce', era:1, requires:['stone_tools'], cost:{ rp0:40 },
  unlocks:{ structures:['bronze_forge'], recipes:['alloy_bronze','...'] }, desc:'...', hint:'Funde cobre y estaño 9:1.' }
```
Eras (0–7): `0 Edad de piedra, 1 Edad del bronce, 2 Era del vapor, 3 Era eléctrica, 4 Era industrial,
5 Era avanzada, 6 Era nuclear, 7 Era cuántica`. Research points are items `rp0..rp5` (science tiers) produced by
lab structures via `research` recipes; early techs may cost raw items instead. Paying the cost is instant.
Everything (structure/recipe) is unlocked by exactly one tech, except the start set listed in `LD.Content.START`
(`{structures:[...], recipes:[...]}` exported from techs.js).

### 5.5 Enemy
```js
{ id:'wolf', name:'Lobo', layer:0, hp:30, speed:2.4, dmg:4, attackRate:1, armor:0, armorType:'none',
  size:0.6, color:'#8a8378', color2:'#3a3733', sprite:'wolf', sfx:'growl', drops:{hide:1,bone:1},
  threat:1, boss:false, desc:'...', night:true }
```
`armorType` ∈ `none | chitin | crystal | basalt | void`. Damage rule (defense.js): if turret `ap` → full damage;
else `dmg = max(dmg*0.1, dmg - armor)`; then multiplied by type matrix
`kinetic:{none:1,chitin:1,crystal:.5,basalt:.4,void:0}`, `thermal:{none:1,chitin:1.4,crystal:1.2,basalt:.6,void:0}`,
`electric:{none:1.2,chitin:.8,crystal:1.5,basalt:.5,void:0}`, `plasma:{none:1,chitin:1,crystal:1,basalt:1,void:1}`.
`void` armour only takes damage from `ap && (dmgType==='plasma' || dmgType==='thermal')`.

### 5.6 Layer & terrain
```js
{ idx:0, id:'surface', name:'Superficie', w:160, h:120, chunk:16, startRadius:1 /* chunks around centre */,
  ambient:0.95, tint:'#c9c9b8', heat:false, unlockedBy:null /* or shaft structure id */,
  deposits:[{ res:'copper_ore', hardness:0, freq:0.0025, size:[4,9], amount:[1500,4000] }, ...],
  enemies:['wolf','boar','bear'], waveBase:240, desc:'...' }
```
Terrains (`LD.Content.terrains`): `{ id:'grass', name:'Pradera', layer:0, walkable:true, buildable:true,
natural:{ item:'plant_fiber', rate:1 } /* manual gather */, color:'#6b7a4a' }`. Fixed terrain ids per layer:
- L0: `grass, forest (tree tiles), dirt, sand, water, rock (stone outcrop, extract stone), clay, bog (peat), saltflat`
- L1: `cave_floor, cave_wall, cave_water, coal_seam(deposit overlay), rubble`
- L2: `deep_floor, deep_wall, crystal_floor, deep_water, rubble`
- L3: `abyss_floor, abyss_wall, obsidian_floor, magma (not buildable), vent (geothermal)`
- L4: `core_floor, core_wall, magma_sea (not buildable), plasma_floor, void_crack (enemy spawn)`
Deposits are a separate layer (`layer.deposits` map) over buildable terrain; a deposit tile shows an ore overlay.

## 6. Game state (LD.G) — serialised as JSON

```js
G = {
  v:1, meta:{ name, created, playtime, difficulty:'normal', seed:12345, lastSave },
  time:{ t:0 /* sim seconds */, day:1, dayFrac:0 /* 0..1, day length 600 s */ },
  inv:{ itemId:number },                 // global inventory (floats; UI floors)
  caps:{ base:200 },                     // per-item cap = base + Σ storage.cap of built storages (all layers)
  discovered:{ items:{}, structures:{}, techs:{}, enemies:{}, layers:{}, recipes:{} },
  research:{ done:{ techId:true } },
  layers:[ { unlocked:true, claimed:{ 'cx,cy':true }, deposits:{ 'x,y':{res, amt, max} }, trees:{ 'x,y':growth0..1 },
             threat:0, waveAt:900, waveNo:0 } ],   // terrain itself is regenerated from seed (World.gen)
  structures:{ uid:{ uid, id, layer, x, y, hp, state, build:{ left, total }|null, oc:0, recipe:null, progress:0,
                     paused:false, fuel:0 /* MJ buffered */, tank:0, stats:{ made:0 } } },
  enemies:[ { uid, id, layer, x, y, hp, tx, ty, target:uid|null, cd:0 } ],
  power:{ gen:0, use:0, ratio:1, stored:0, cap:0 },
  stats:{ produced:{}, consumed:{}, kills:0, builds:0 },
  log:[ { t, text, kind } ] (max 200),
  view:{ layer:0, cam:{ x,y,z } per layer }
}
```
Structure `state` ∈ `building | idle | working | no_power | no_input | output_full | no_fuel | no_link | broken |
paused`. Derived (not saved): `occ` grids, connectivity, link rates → `LD.Sim.Economy.rebuildNetworks()`.

## 7. Simulation rules (binding numbers)

- Fixed step `DT = 0.1 s`, `LD.Sim.tick(DT)` from an accumulator in Main; max 50 steps per frame; offline: on
  load, elapsed real seconds (cap 8 h) simulated with `DT_OFFLINE = 5 s` steps at 60% efficiency (speed factor
  0.6), no enemy waves during offline (threat still grows), summary emitted (`offline:summary`).
- Order per tick: Nature → Economy (extractors, machines) → Power balance (applied next tick as `power.ratio`) →
  Build → Research (nothing per tick; techs are instant) → Defense → Territory/threat → time/day.
- **Power**: `gen` = Σ producers actually running (fuel/water available, integrity>0); `use` = Σ consumer demand of
  machines that want to run; `ratio = min(1, (gen + storedAvailable)/use)`; all consumers run at `ratio` speed;
  surplus charges batteries. Producers burning fuel consume `fuel MJ = P·dt / 1e6` from an internal buffer
  refilled from inventory (item `fuel` MJ). Brownout when `ratio<1` (event, HUD warning). Power is one global
  network across all layers connected through built shafts. T0 machines have no power; fuel machines use `burn`.
- **Logistics**: a structure is *linked* if a 4-neighbour path of conveyor tiles connects it to the layer hub
  (surface: `hub`; lower layers: `elevator`). Structures adjacent to the hub/elevator are linked directly. Each
  linked structure's item throughput (in+out) is capped at `linkRate` = max rate of adjacent conveyor tiles
  (directly adjacent to hub = unlimited). Elevator transfer capacity = Σ rates of conveyors adjacent to the
  elevator; items produced in a lower layer are counted into the global inventory only up to that capacity
  (excess production throttles machines in that layer: state `output_full`). Conveyors are not machines and have
  no state; they can be damaged.
- **Machines**: selected `recipe` runs when inputs available (consumed at start), progress += dt·speedMul;
  on completion outputs added (if any output would exceed cap → wait `output_full`). `speedMul =
  structure.speed · 1.5^oc · power.ratio · integrityMul · difficultyMul`. Consumers demand
  `power.use · 2^oc` W only while `working`. **Overclock**: `oc ∈ [0, ocMax]`, raises effective tier by `oc`
  (allows recipes of `tier ≤ tier+oc`), ×2 power per level, ×1.5 speed per level, ×3 wear per level.
- **Integrity**: `hp` pool. Wear: working machines lose `0.004%·hp/s · 3^oc` (≈7 h to zero at oc0); in layer 4
  non-heatproof structures lose an extra `0.05%/s`. `integrity = hp/maxHp`. If `integrity < 0.30`:
  `integrityMul = max(0.1, 1 - 0.03·(30 - integrity·100))`. At `hp<=0`: `broken` (stops) until repaired.
  Repair: cost = `ceil(cost_i · missingFraction · 0.5)` per material, instant. `maintenance_bay` auto-repairs
  structures within radius 8 every 10 s if materials exist.
- **Construction**: placing consumes full cost immediately; `build.left = buildTime·difficultyBuildMul`; while
  building, dismantle refunds 100%; after completion, dismantle refunds `floor(0.65·cost_i)` per material
  (guides say 65%). Build time by complexity: conveyor 1 s, T0 huts 3–5 s, steam engine 6 s, T3 machines 10–15 s,
  T5 20–30 s, fission reactor 45 s, fusion reactor 60 s.
- **Extractors**: placed with footprint over ≥1 deposit tile with `hardness ≤ extract.hardnessMax`; rate =
  `extract.rate · tilesCovered · speedMul` items/s of the deposit resource; deposits deplete (amt) and the tile
  becomes plain. `magma`, `helium3`, `deuterium_brine`, `vent` deposits are infinite (`amt:-1`).
- **Nature**: trees (`forest` tiles with growth 0..1) regrow at `1/900 s` after being cut (tile → grass with a
  sapling marker when a planter/tree_farm replants, or slowly by natural seeding from adjacent forest 1/1800 s).
  Manual gather: click a natural tile with the hand tool: 1 item per 1.2 s cooldown (surface only, first hour).
  `well/pump` produce water; `bonsai` produces wood from water without land.
- **Research**: paying tech cost is instant; unlocking sets discovered flags; `hint` shown in encyclopedia.
- **Territory**: chunks (16×16). Cost to claim chunk at Chebyshev distance `d` from centre on layer `L`:
  `base[L]·(1.35^d)` in layer-specific materials (L0: wood_log+stone; L1: iron_plate+torch; L2: steel_plate+lamp;
  L3: titanium_plate+circuit_advanced; L4: thermal_plate+carbide_tip). Must be adjacent to a claimed chunk.
  Only claimed chunks are buildable; deposits everywhere are visible (dimmed outside territory).
- **Defense**: per layer `threat` grows `+1/min · (1 + 0.02·structuresInLayer)` while the layer is unlocked and
  has ≥1 structure. Waves at `waveAt` (base interval by layer; `waveBase` s ± 20%); wave size
  `= 2 + floor(threat/8)`, composition from `layer.enemies` weighted by `threat` (bosses when
  `waveNo % 5 === 4`). Spawn at random border tiles of the claimed area (surface: outside the claimed area; lower
  layers: `void_crack`/rubble tiles or claimed border). Enemies move (tiles/s) toward the nearest structure
  (walls are targeted when they block the straight path), attack every `1/attackRate` s dealing `dmg` to `hp`.
  Turrets target the nearest enemy in `range` (tiles) and fire at `rate` shots/s consuming ammo (if any) from
  inventory; they need power (`power.use`) when defined. Killed enemies add `drops` to inventory. Difficulty
  multipliers: `peaceful: no waves; easy: hp×0.6 dmg×0.6 interval×1.5; normal ×1; hard hp×1.6 dmg×1.4
  interval×0.75; brutal hp×2.5 dmg×2 interval×0.55`. Night on surface: `dayFrac in [0.55,1)` → wave size ×1.5.
- **Caps**: per-item cap = `caps.base + Σ storage.cap`; production above cap is blocked (`output_full`).

## 8. Rendering & FX contract

- `LD.Render.init(canvas)`, `LD.Render.frame(dt, t)`, camera per layer `{x,y,z}` (world px = tile·32), zoom 0.5–3.
  Terrain drawn from cached chunk canvases (`LD.Tex.chunkCanvas(layerIdx, cx, cy)` with invalidation
  `LD.Tex.invalidate(layerIdx, x, y)`); tile size 32 px base at z=1; deposits overlay; trees; territory border
  (dashed hairline bone) and unclaimed dim (`rgba(12,12,13,.55)`); structures via `LD.Sprites.draw(ctx, s, x, y,
  size, t)`; build ghosts (valid = bone, invalid = vermilion, 50%); enemies; particles; lighting pass: low-res
  light canvas (1/4 res) multiply-composited on layers with `ambient<1` and during night; light sources from
  `structure.light` + working machines (tier glow) + magma/crystal terrain.
- Day/night on surface: 600 s day; tint bone-warm at noon, cool ink-blue at night (`ambient` 1.0→0.35).
- Particles: `LD.Particles.emit(kind, x, y, opts)` kinds: `smoke, steam, spark, dust, ember, glow, shot, hit,
  death, build, rubble, rain, plasma, arc`. Settings `particles: 'off'|'low'|'high'`.
- Structure state badge overlay (small monoline glyph top-right of sprite): `no_power ⚡, no_input ↓, output_full
  ■, no_fuel ▲, broken ✕, building progress ring` — drawn as vector, not text glyphs.

## 9. Sprite keys (LD.Sprites.draw(ctx, structureOrEnemy, px, py, sizePx, t, state))

Sprite keys (one per structure id unless shared): conveyors share `conveyor` (param tier), walls share `wall`
(param tier), warehouses share `warehouse` (param tier), shafts share `shaft` (param tier), drills share `drill`
(param tier). All others use their structure id as sprite key. Enemy sprite keys = enemy ids. Sprites must render
crisply at 32/48/64/96 px per tile (size·32·zoom) and animate (`t`) when `state==='working'`. Style: top-down 3/4
matte industrial, rivets/plates/pipes/gears drawn with vector ops + subtle noise, tier accent colour
(`LD.Sprites.TIER_COLORS[tier]`).

## 10. SFX keys (LD.Audio.loop(key, uid, intensity) / LD.Audio.play(name))

Machine loop keys: `furnace, kiln, forge, hammer, saw, mill, steam, boiler, crusher, press, lathe, wiremill,
assembler, electric_hum, chemical, refinery, electrolyzer, centrifuge, compressor, arc, vacuum, enrichment, cryo,
fabricator, nano, quantum, drill_hand, drill_steam, drill_electric, drill_laser, drill_plasma, pump, wheel,
windmill, generator_diesel, turbine, reactor, fusion, lab, turret_charge, waterwheel, farm, bonsai`.
One-shots: `ui_click, ui_hover, ui_open, ui_close, ui_tab, build_place, build_done, dismantle, repair, research,
discover, wave_warning, wave_start, wave_end, brownout, integrity_low, structure_broken, claim, shot_arrow,
shot_ballista, shot_cannon, shot_gatling, shot_laser, shot_tesla, shot_plasma, hit, enemy_die, growl, screech,
crystal_chime, magma_roar, void_whisper, layer_switch, save, error`.

## 11. UI screens & flows

- `menu` (KDZ background running) → `NUEVA PARTIDA` (name, difficulty, seed) | `CONTINUAR` (slots list with
  playtime/era/day) | `ENCICLOPEDIA` (global discoveries union of slots? No: last played save) | `AJUSTES` |
  `CUESTIONARIO` (opens `cuestionario.html` if present, else hidden).
- `game`: HUD (§hud.js): top bar (era, day/hour, power gen/use + ratio bar, threat/next wave, research points),
  left: strata widget (vertical 5-band section with shaft depth, locked bands hatched, click to switch layer),
  left dock: build palette toggle; bottom: inventory tray (grouped by cat, tooltips with rates ±/s); right:
  selection panel. Keys: `WASD/arrows` pan, wheel zoom, `1–5` layer, `B` build, `E` encyclopedia, `R` research
  tab, `X` dismantle mode, `Esc` pause/cancel, `Space` pause sim, `H` hand tool.
- Pause (`Esc`): CONTINUAR / GUARDAR (slot picker) / ENCICLOPEDIA / AJUSTES / SALIR AL MENÚ (confirm if unsaved).
- Encyclopedia: categories Materiales, Componentes, Máquinas, Tecnologías (tree by era, with "Siguiente paso"
  panel listing affordable/near techs and what's missing), Capas, Amenazas, Mecánicas (guides). Undiscovered:
  `???` with a hint sentence. Entry shows: icon/sprite, stats, recipes producing/consuming, unlocked by, where found.
- Settings: dificultad (only at new game; shown read-only in game), volumen general/música/efectos/ambiente,
  partículas, calidad de textura, mostrar rejilla, mostrar rangos, autoguardado (1/3/5/10 min/off), movimiento
  reducido (disables menu animation motion), idioma (es only, disabled), reiniciar tutorial.
- Onboarding: first minutes show 6 short objective cards (recoger 20 palos y 20 piedras → mesa de trabajo → …).

## 12. Balance targets

- Era 0→1 in ~10 min, →2 in 40 min, →3 in 2 h, →4 in 5 h, →5 in 10 h, →6 in 18 h, →7 in 30 h of active play
  (offline progress at 60%). Costs scale ~×4–8 per era; production rates ×3–5 per tier of machine.
- Fuel energy (MJ/unit): wood_log 8, stick 1, charcoal 16, peat 10, coal 24, coke 30, tar 20, ethanol 22,
  biofuel 34, diesel 42, kerosene 40, naphtha 38, natural_gas 36, hydrogen 12, fuel_rod 4e5 (fission only),
  mox_rod 5e5, thorium_fuel 3e5, fusion_pellet 6e6, he3_pellet 9e6.
- Generator outputs: water_wheel 4 kW, windmill 2.5 kW, steam_engine 60 kW, coal_plant 400 kW, diesel 1.5 MW,
  gas_turbine 3 MW, solar 80 kW (day), geothermal 5 MW, fission 150 MW, fusion 2 GW.
- Typical consumer draw: T2 15–30 kW, T3 20–60 kW, T4 100–300 kW, T5 0.5–1.5 MW, T6 1–3 MW, T7 25–60 MW.

## 13. Testing & acceptance

- `node tools/validate.js` must pass: every recipe input/output item exists; every item is obtainable (deposit,
  nature, drop, or recipe output) and (except final products) used somewhere; every structure cost item is
  obtainable at or below its tier; every structure/recipe unlocked by exactly one tech or START; tech graph
  acyclic and all reachable from START; ≥60 raw materials, ≥100 components with recipes; every recipe type has
  ≥1 structure; every sprite/sfx key in the canon lists; fuel items have `fuel>0`.
- `node tools/smoke.mjs`: loads dist, zero console errors, new game, 600 sim seconds via `LD.Debug.ff(600)`,
  place structures via `LD.Debug`, screenshots.
- `LD.Debug` (sim.js): `ff(seconds)`, `give(itemId, n)`, `giveAll(n)`, `unlockAll()`, `place(id, layer, x, y)`,
  `spawnWave(layer)`, `setThreat(layer, v)`, `state()`.
