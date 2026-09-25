# KDZDUSTRY — Architecture & Content Contract (v2, after questionnaire)

Single-file HTML idle/incremental factory game. Spanish UI. Everything procedural (no external assets, no CDN).
Binding for every module. Read fully, plus docs/CANON.md, docs/API.md, docs/DECISIONS.md, and the code in
src/js/core and src/js/main.js before writing anything.

## 0. Vision

You are sealed above five strata of a planet's crust. Start in a medieval era with sticks and stones; end
extracting neutronium from the core with fusion power. GregTech-flavoured: long material chains, voltage-like
tiers, overclocking, integrity/wear, power in W/kW/MW/GW, separate cable and pipe networks, tanks, realistic
fuel chains (uranium ore → yellowcake → UF6 → enrichment → pellets → fuel rods → fission reactor). Base defense
against hostile fauna (surface) up to void entities (core). Lower strata are solid rock you must excavate chunk
by chunk with tunnel borers. Inventory is per stratum; elevators haul between strata. Encyclopedia of everything
discovered. No offline progress.

Tone: technical drawing / Swiss modular grid / matte minimalism. The main menu background is the KDZ kinetic
typography piece (WebGL2, ink #0c0c0d on bone paper #ece7dc, vermilion #e8401c accents, monospace uppercase
labels with wide tracking, hairline rules, "DWG NO." title blocks). The whole game inherits that identity.

## 1. Visual identity (binding)

CSS tokens in `src/css/00_base.css` (use them; never hardcode colours in modules):
```
--ink:#0c0c0d  --ink2:#141416  --ink3:#1c1c1f  --ink4:#26262a  --ink5:#333338
--bone:#ece7dc --bone2:#c9c4b8 --bone3:#8f8b82 --bone4:#5a5751
--line:rgba(236,231,220,.14)  --line2:rgba(236,231,220,.28)
--verm:#e8401c --verm2:#f0704f  --ok:#8fb87a --warn:#d9a441 --bad:#e8401c --info:#7aa6c9
--mono: ui-monospace,"SF Mono",Menlo,Consolas,"DejaVu Sans Mono",monospace
--sans: "Inter","Helvetica Neue",Helvetica,Arial,sans-serif
```
Rules:
- Matte. No drop shadows, no glossy gradients, max radius 2px, no emoji. Hairline 1px rules. Flat fills.
- Labels: monospace, uppercase, letter-spacing .12–.18em, 10–12px (rem-based). Body: sans 13–14px. Numbers:
  monospace tabular.
- Accent = vermilion, sparingly (active state, alerts, the one CTA). Semantic colours (ok/warn/bad) only for state.
- **In-game UI is entirely ink-dark** (decision 3): panels `--ink2`, borders `--line`, text `--bone`. Encyclopedia,
  pause, settings, modals: dark too. Only the main menu sits on the KDZ paper, with an **ink slab on the left**
  (decision 4) holding the drawn KDZDUSTRY lockup and the options (bone text on ink).
- Title lockup (decision 5): drawn on a canvas with the KDZ monoline pen (round pen, stencil gaps): the hero K, D,
  Z glyph geometry from kdz.js (exported as `LD.KDZ.glyphs` — see kdz.js `api.glyphs`) followed by "DUSTRY" in the
  same 4×6 technical lettering (`LD.KDZ.font`), plus mono subtitle "SIMULADOR INDUSTRIAL DE ESTRATOS".
- Letterbox bands outside the 16:9 stage (decision 8): body background = textured paper (menu) / textured ink
  (game), switched by `LD.Stage.setBackdrop('paper'|'ink')` (CSS class on body, noise via `LD.Tex.noiseCanvas`).
- Icons drawn (canvas/inline SVG), monoline 1.5px. World rendering naturalistic but desaturated/matte.

## 2. Stage & scaling (16:9)

`#stage` is a 1920×1080 logical box centred with letterboxing. `LD.Stage` sets the root font-size to
`stageWidthPx/1920*16px`, so **all CSS uses `rem`** (1rem = 16 logical px); `1px` only for hairlines. Canvases:
1920×1080 × min(dpr,2) backing pixels. `LD.Stage.toLogical(clientX, clientY)` → logical coords.

## 3. Files, namespaces, build

No module system. Each file is an IIFE attaching to the global `LD`. Build order (`build.js`):
```
core/util.js LD.U · core/events.js LD.Events · core/registry.js LD.Registry · core/state.js LD.State/LD.Settings/LD.G · core/stage.js LD.Stage
content/items.js · recipes.js · structures.js · techs.js · enemies.js · layers.js · guides.js   (LD.Content.*)
gen/textures.js LD.Tex · gen/sprites.js LD.Sprites · gen/world.js LD.World
sim/economy.js LD.Sim.Economy · sim/fluids.js LD.Sim.Fluids · sim/power.js LD.Sim.Power · sim/build.js LD.Sim.Build
sim/research.js LD.Sim.Research · sim/nature.js LD.Sim.Nature · sim/defense.js LD.Sim.Defense
sim/events.js LD.Sim.Events (weather + special events) · sim/stats.js LD.Sim.Stats · sim/sim.js LD.Sim (+ LD.Debug)
render/particles.js LD.Particles · render/render.js LD.Render
audio/audio.js LD.Audio · audio/music.js LD.Music
ui/ui.js LD.UI · ui/menu.js LD.UI.Menu · ui/hud.js LD.UI.HUD · ui/build.js LD.UI.Build · ui/panel.js LD.UI.Panel
ui/encyclopedia.js LD.UI.Encyclopedia · ui/settings.js LD.UI.Settings · ui/pause.js LD.UI.Pause · ui/tutorial.js LD.UI.Tutorial · ui/stats.js LD.UI.Stats
vendor/kdz.js LD.KDZ · main.js LD.Main
```
Each file: `(() => { 'use strict'; const LD = window.LD; ... })();`. Never `import`/`export`. Resolve other
namespaces at call time, not at file top level. CSS files in `src/css/` (alphabetical concat): `00_base.css`
(exists), `10_menu.css`, `20_hud.css`, `30_panels.css`, `40_encyclopedia.css`, `50_overlays.css`.
Build: `node build.js` → `dist/index.html`. `node tools/validate.js` validates content. `node tools/smoke.mjs`
runs Playwright headless smoke tests (screenshots in `tools/out/`).

## 4. Core APIs (implemented; read the code in src/js/core)

`LD.U` (math, `fmt`, `fmtW`, `fmtTime`, `fmtClock`, hashing/rng/noise, colour, `el()` DOM builder, `esc`,
`canvas`), `LD.Events` (`on/once/off/emit`), `LD.Registry` (Maps + indexes, `recipesFor`, `producers`,
`consumers`, `unlockerOf`, `structuresByCat`, `isStart`), `LD.State`/`LD.Settings`/`LD.G`, `LD.Stage`.
Event names (emit exactly these): `game:new, game:loaded, game:saved, tick({t}), inv:changed({layer,item}),
item:discovered(id), tech:researched(id), tech:started(id), structure:placed(uid), structure:built(uid),
structure:removed(uid), structure:selected(uid|null), structure:broken(uid), layer:changed(idx),
layer:unlocked(idx), chunk:excavated({layer,cx,cy}), wave:incoming({layer,at}), wave:started({layer}),
wave:ended({layer}), enemy:killed(enemy), power:brownout({layer,grid}), weather:changed({kind}),
event:announced(ev), event:started(ev), event:ended(ev), toast({text,kind}), screen:changed(name),
tutorial:step(n), objective:done(id), settings:changed(s), stage:resize(size)`.

## 5. Content schemas

Ids: lowercase snake_case ASCII. Names/desc Spanish, technical tone, no fluff. `desc` 1–2 sentences; optional `lore`.

### 5.1 Item
```js
{ id:'iron_ingot', name:'Lingote de hierro', cat:'ingot', tier:1, color:'#a8a49c', color2:'#6b6862', desc:'...',
  fuel:0 /* MJ per unit if burnable */, final:false /* true = intended end product, never consumed */ }
```
`cat` ∈ `raw | ore | crushed | ingot | plate | rod | gear | wire | part | component | circuit | fluid | gas |
chemical | fuel | nuclear | crystal | organic | building | ammo | science | exotic`.
**Items with cat `fluid` or `gas` are fluids**: they never enter item inventories; they live in tanks on pipe
networks (§7.4). Fluids may still be burnable (`fuel`) for fuel-burning generators that draw from pipes.

### 5.2 Recipe
```js
{ id:'smelt_iron', type:'smelting', tier:1, in:{iron_ore:1}, out:{iron_ingot:1}, time:6, energy:null }
```
Types (fixed): `hand, workbench, kiln, smelting, blast, forging, sawing, crushing, washing, tanning, pressing,
lathe, wiremill, assembling, mixing, distilling, chemical, refining, electrolysis, centrifuge, compressing, arc,
vacuum, fabrication, enrichment, nuclear_fab, cryo, quantum, research, ammo`. `tier` = minimum effective machine
tier. `time` seconds at speed 1. `energy` W override (null = machine default). Item and fluid inputs/outputs mix
freely in `in`/`out`; the sim routes fluids to the pipe network.

### 5.3 Structure
```js
{ id:'steam_engine', name:'Máquina de vapor', cat:'power', tier:2, size:2, sprite:'steam_engine', sfx:'steam',
  cost:{ iron_plate:12, bronze_gear:4, brick:20, bronze_pipe:6 }, buildTime:6, hp:600, complexity:2,
  power:{ gen:60000, fuel:['coal','coke','charcoal','wood_log'], fluidIn:{ water:0.2 } },   // producer
  // consumer: power:{ use:30000 }; T0/T1 fuel machines: burn:{ mjPerSec:0.05, fuels:[...] }
  types:['smelting'], speed:1, ocMax:2,
  extract:{ hardnessMax:2, rate:0.5, fluid:false },     // extractors (fluid:true → output goes to pipes)
  conveyor:{ rate:8 }, cable:{ cap:300000 }, pipe:{ rate:8 }, overlay:'cable'|'pipe' (cables/pipes only),
  tank:{ cap:2000, cryo:false }, storage:{ cap:600 }, elevator:{ rate:20 }, borer:{ rate:4 }, shaft:{ layer:1, rate:5 },
  nature:{ kind:'woodcutter', radius:5, rate:0.4, consumes:{ water:0.05 } },
  turret:{ range:6, dmg:6, rate:1, dmgType:'kinetic', ap:false, ammo:{ arrow:1 } },
  wall:true, heatproof:false, light:{ radius:4, color:'#ffb060', intensity:0.8 }, lab:{ tier:0 },
  surfaceOnly:false, needsWater:false /* must touch a water tile */, needsVent:false,
  desc:'...', lore:'...' }
```
`cat` ∈ `core | logistics | storage | nature | extract | process | power | research | defense | special`.
`size` 1|2|3 square, anchored top-left; `rot` 0–3 stored per instance (aesthetic). `buildTime` 1–60 s. `hp` =
integrity pool. `complexity` 1–5 drives particle/sound intensity.

### 5.4 Tech
```js
{ id:'bronze_working', name:'Trabajo del bronce', era:1, requires:['stone_tools'], cost:{ rp0:40 }, time:90,
  lab:0 /* min lab tier: 0 study_table, 1 lab_basic, 2 lab_industrial, 3 lab_quantum */,
  unlocks:{ structures:['bronze_forge'], recipes:['alloy_bronze'] }, desc:'...', hint:'Funde cobre y estaño 9:1.' }
```
Eras 0–7 (`LD.U.ERA_NAMES`). `cost` items are paid from the **surface** inventory when research starts; `time`
seconds of lab work; each powered lab of tier ≥ `lab` adds 1× speed (linear). Everything is unlocked by exactly
one tech, except `LD.Content.START = { structures:[...], recipes:[...] }` (exported from techs.js).

### 5.5 Enemy
```js
{ id:'wolf', name:'Lobo', layer:0, hp:30, speed:2.4, dmg:4, attackRate:1, armor:0, armorType:'none', size:0.6,
  color:'#8a8378', color2:'#3a3733', sprite:'wolf', sfx:'growl', drops:{hide:1,bone:1}, threat:1, boss:false,
  night:true, desc:'...' }
```
`armorType` ∈ `none | chitin | crystal | basalt | void`. Damage rule in §7.7.

### 5.6 Layer & terrain
```js
{ idx:1, id:'caves', name:'Cuevas someras', w:128, h:96, chunk:16, ambient:0.35, tint:'#3b3a38', heat:false,
  unlockedBy:'shaft_coal', borerTier:2, rockBase:1.0, rockPerChunk:0.35,
  deposits:[{ res:'coal', hardness:1, freq:0.02, size:[5,14], amount:[3000,8000] }, ...],
  enemies:['cave_bat','cave_spider','armored_mole'], waveBase:720, music:'caves', desc:'...' }
```
Terrains (`LD.Content.terrains`): `{ id:'grass', name:'Pradera', layer:0, walkable:true, buildable:true,
natural:{ item:'plant_fiber', rate:1 }, color:'#6b7a4a', rock:false }`. Fixed ids:
- L0: `grass, forest, dirt, sand, water, rock, clay, bog, saltflat, gravel`
- L1: `cave_floor, cave_wall (solid, unexcavated), cave_water, rubble, coal_seam`
- L2: `deep_floor, deep_wall, crystal_floor, deep_water, rubble`
- L3: `abyss_floor, abyss_wall, obsidian_floor, magma, vent`
- L4: `core_floor, core_wall, magma_sea, plasma_floor, void_crack`
Walls (`*_wall`) = solid rock inside unexcavated chunks; excavated chunks contain floors/water/rubble with some
wall pillars. Deposits are an overlay (`G.layers[L].deposits`) on buildable terrain.

## 6. Game state (LD.G) — JSON-serialisable (see state.js `blank()`)

```js
G = { v:2, meta:{ name, created, playtime, difficulty, seed, lastSave, era },
  time:{ t, day, dayFrac },
  inv:[ {itemId:n} ×5 ],            // per layer; fluids never here
  caps:{ base:200 },                 // per-item cap per layer = base + Σ storage.cap in that layer
  discovered:{ items:{}, structures:{}, techs:{}, enemies:{}, layers:{0:true}, recipes:{} },
  research:{ done:{}, current:null|{ tech, left, total }, queue:[techId] },
  layers:[ { unlocked, excavated:{'cx,cy':true}, digging:{'cx,cy':{ work, total }}, deposits:{'x,y':{res,amt,max,hardness,fluid}},
             trees:{'x,y':growth}, threat, waveAt, waveNo, weather:{ kind, until }, energyHandled } ],
  structures:{ uid:{ uid, id, layer, x, y, rot, hp, state, build:{left,total}|null, oc, recipe, progress, paused,
                     fuel /*MJ*/, tank:{ fluid, amt }|null, rules:[{item,mode:'up'|'down',keep}] /*elevators*/, stats:{made} } },
  enemies:[ { uid, id, layer, x, y, hp, path:[[x,y]...], pi, target, cd } ],
  power:{ grids:[ { layer, gen, use, ratio, stored, cap } ] },
  events:{ next:{ kind, layer, at }|null, active:[] },
  stats:{ produced:{}, consumed:{}, kills, builds, dismantled, waves, hist:{ /* Stats module ring buffers */ } },
  blueprints:[ { name, w, h, cells:[{dx,dy,id,rot}] } ],
  objectives:{ done:{}, current:[] }, tutorial:{ step, done },
  log:[], view:{ layer:0, cam:[] }, flags:{} }
```
Structure `state` ∈ `building | idle | working | no_power | no_input | output_full | no_fuel | no_link | no_fluid |
broken | paused`. Derived data (occ grids, networks, paths) is rebuilt on load (`LD.Sim.init`).

## 7. Simulation rules (binding numbers)

Fixed step `DT = 0.1 s`; `LD.Sim.tick(DT)` from Main's accumulator (max 50 steps/frame). Order: Events/weather →
Nature → Economy (extractors, machines, borers, elevators) → Fluids → Power (ratio applied next tick) → Build
(construction, wear) → Research → Defense → Stats → time/day. **No offline progress** (decision 24).

### 7.1 Inventory & caps
Per layer. Machines/extractors/builders use `G.inv[layer]`. Per-item cap per layer = `caps.base + Σ storage.cap`
of built storage structures in that layer. Production above cap blocks (`output_full`).

### 7.2 Logistics (conveyors) and elevators
A structure is **linked** if a 4-neighbour path of conveyor tiles connects it to the layer hub (surface `hub`,
lower layers any `elevator*`), or it is adjacent to the hub/elevator. `linkRate(uid)` = max conveyor rate among
its adjacent conveyor tiles (∞ if adjacent to hub/elevator). Item throughput (in+out) of a linked structure is
capped at `linkRate`. Unlinked machines: `no_link`. Conveyors/cables/pipes are structures with `overlay`
(cables/pipes) or size 1 (conveyors); they have no state and can be damaged.
**Elevators** (lower layers; the first is auto-placed at the layer centre when its shaft completes) transfer items
between that layer and the surface at `elevator.rate` items/s total. Rules per elevator: default rule
`{item:'*', mode:'up', keep:0}` (send everything up), plus user rules `{item, mode:'down', keep:N}` (bring from the
surface until the layer holds N) and `{item, mode:'keep', keep:N}` (do not send up below N). Transfer is capped
by both layers' caps. The surface shaft head is the counterpart; shafts also carry power and fluids (§7.3, §7.4).
Hub at ≤10 % integrity → all hub-side throughput ×0.1 (decision 32).

### 7.3 Power (cables, grids)
Cables are tile overlays (`overlay:'cable'`) placeable on empty tiles and on conveyor tiles, not under other
structures. A **grid** = connected component over cable tiles and structures (structures conduct; 4-neighbour).
Each layer has independent grids; a shaft/elevator pair joins the grid touching the shaft head with the grid
touching the elevator. A structure's power I/O is capped by the best adjacent cable `cap` (∞ if it touches a
generator/consumer directly? No: structures conduct but *capacity* between two structures without cable = the
lower of their tiers' default 50 kW·2^tier). Per grid: `gen`, `use`, `ratio = min(1,(gen+storedAvail)/use)`; all
consumers on the grid run at `ratio`; surplus charges batteries on the grid. Fuel generators burn
`P·dt/1e6 MJ` from an internal buffer refilled from the layer inventory (items) or pipes (fluid fuels).
`power:{ gen }` with `fluidIn` (water) needs pipes. Brownout events per grid. `energyHandled` per layer =
Σ gen actually produced (W) → threat driver (§7.7).

### 7.4 Fluids (pipes, tanks)
Pipes are tile overlays (`overlay:'pipe'`, same placement rules as cables; cable and pipe may share a tile). A
**fluid network** = connected component over pipe tiles + fluid-handling structures (tanks, pumps, wells, machines
with fluid I/O, shafts/elevators). Tanks hold one fluid each (`inst.tank = {fluid, amt}`), `tank.cap` units;
cryogenic fluids (`liquid_nitrogen, deuterium, tritium, helium3, cryo_coolant, liquid_hydrogen`) require
`tank.cryo`. A machine pushes fluid outputs into tanks of that fluid (or empty tanks) on its network; pulls inputs
from tanks of that fluid; throughput capped by the best adjacent pipe `rate`. No tank with room → `output_full`;
no fluid → `no_fluid`. Pipes have no storage. Shaft↔elevator link joins networks across layers at `shaft.rate`.
Lubricant: a machine whose network has lubricant consumes 0.005 units/s and gets wear ×(1/1.5).

### 7.5 Machines, overclock, integrity, construction
- `speedMul = structure.speed · 1.5^oc · grid.ratio · integrityMul · difficultyMul`. Consumers demand
  `power.use · 2^oc` only while `working`. `oc ∈ [0, ocMax]` raises effective tier by `oc`.
- Wear: working machines lose `0.004 %·maxHp/s · 3^oc` (÷1.5 with lubricant); in layer 4 non-heatproof
  structures lose `0.05 %/s` always. `integrity = hp/maxHp`; if `< 0.30`:
  `integrityMul = max(0.1, 1 − 0.03·(30 − integrity·100))`; `hp ≤ 0` → `broken` until repaired.
- Repair: cost `ceil(cost_i · missingFraction · 0.5)`, instant, from the layer inventory. `maintenance_bay`
  repairs structures within radius 8 every 10 s if materials exist in that layer.
- Construction: placing pays full cost from the layer inventory; `build.left = buildTime·difficultyBuildMul`.
  Dismantle: 100 % refund while building, `floor(0.65·cost_i)` after. Blueprints: placing a blueprint creates
  ghosts (`state:'planned'` entries are NOT structures; the UI queues placements and places each when affordable,
  in order, one per 0.5 s).
- Extractors: footprint must cover ≥1 deposit tile with `hardness ≤ extract.hardnessMax`; rate =
  `extract.rate · tilesCovered · speedMul`; finite deposits deplete (tile becomes plain, chunk canvas invalidated);
  infinite deposits `amt:-1`. Fluid deposits (crude_oil, natural_gas, deuterium_brine, helium3, magma) need
  `extract.fluid:true` extractors and output to pipes.

### 7.6 Excavation (lower layers, decision 10)
Lower-layer chunks start `excavated:false` (terrain = `*_wall`, undiggable visually hatched). Start set: the
elevator chunk + its 4 orthogonal neighbours. Rock hardness of chunk at Chebyshev distance `d` from the centre
chunk: `H = rockBase·(1 + rockPerChunk·d)`; `work = H · 256`. A **borer** (`borer.rate` tiles/s at speed 1, tier ≥
layer `borerTier`; higher tier ×2 per tier above) placed adjacent (its footprint touching the chunk boundary) to
an unexcavated chunk that is adjacent to an excavated one digs it: `digging[key].work += rate·speedMul·dt`; while
digging it yields `stone 0.3/s, gravel 0.2/s` + the layer's common ore at 5 % into the layer inventory (linked),
emits rubble particles. On completion: chunk excavated, terrain generated (floors, pillars, deposits revealed),
event `chunk:excavated`, borer goes idle. Surface has no excavation: all chunks free (decision 10).

### 7.7 Defense
Threat per layer grows per minute: `0.3 + 1.2·log10(1 + energyHandled/1e3) + 0.01·structuresInLayer` (energy is
the main driver, decision 37), only while unlocked with ≥1 structure. Waves: interval `waveBase` (L0 720 s, L1
780, L2 840, L3 900, L4 960) ×difficulty ±20 %; size `2 + floor(threat/6)`; composition weighted by threat;
boss when `waveNo % 5 === 4`. Night on L0: size ×1.5. Spawn: L0 at map border tiles (or `spawnTiles`); lower
layers at `void_crack`/`rubble`/border-of-excavated tiles. **Path-finding** (decision 35): A* on tiles (walls,
structures, water = blocked; unexcavated rock blocked) from spawn to hub/elevator; recompute when structures
change (dirty flag per layer, max 1 recompute per enemy per 2 s); if no path: target the wall/structure with the
lowest hp on the straight line to the hub and attack it ("brecha"). Enemies attack any structure within 0.8 tiles
of their path when blocked, else walk (`speed` tiles/s). Damage rule: turret `ap` → full; else
`dmg = max(dmg·0.1, dmg − armor)`; × type matrix `kinetic:{none:1,chitin:1,crystal:.5,basalt:.4,void:0}`,
`thermal:{none:1,chitin:1.4,crystal:1.2,basalt:.6,void:0}`, `electric:{none:1.2,chitin:.8,crystal:1.5,basalt:.5,void:0}`,
`plasma:{all:1}`; `void` armour only from `ap && (plasma|thermal)`. Turrets: nearest enemy in `range`, `rate`
shots/s, ammo from the layer inventory, need grid power when `power.use`. Kills add `drops`. Difficulty
multipliers as in `LD.State.DIFFICULTIES`. Hub never below 10 % hp.

### 7.8 Nature, day/night, weather, events
Day 600 s; `dayFrac ∈ [0.55,1)` = night (ambient 0.35). Trees regrow 1/900 s; planters/tree farms replant.
Manual gather (hand tool, surface): 1 item / 1.2 s cooldown. Weather (L0): `clear 55 %, fog 15 %, rain 20 %,
storm 10 %`, 3–8 min each, announced 30 s before: rain → wells/pumps ×1.5, solar ×0.3; storm → windmill ×1.6,
solar ×0.3, tiny integrity loss on windmills; fog → ambient ×0.8, turret range −1. Events (announced 60 s
before, `event:*`): `earthquake` (L1–L4: 3–8 % hp loss to random structures, spawns rubble, may reveal a vein),
`plasma_storm` (L4: heat loss ×3 for 90 s), `migration` (L0: wave ×2.5), `vein` (new finite deposit appears in an
excavated/any chunk). Frequency: one event per 12–25 min.

### 7.9 Research
`Research.start(techId)` pays cost from `inv[0]`, sets `current={tech,left:time,total:time}`; each tick
`left −= dt · Σ(labs of tier ≥ tech.lab that are powered and linked) · grid.ratio`; on 0 → done, unlocks,
discovers, `tech:researched`, era update, next in queue starts if affordable. Labs show `working` while a
tech is active. Era 0 techs use `study_table` (no power).

### 7.10 Territory
Surface: everything buildable (no claiming). Lower layers: only excavated chunks buildable. `World.isBuildable`
enforces both. Deposits: finite in chunks with `d ≤ maxD−2`, infinite (`amt:-1`) in the outer ring (L0: border
ring; lower layers: `d ≥ maxD−1`).

## 8. Rendering & FX

- `TILE = 48` px at zoom 1 (decision 48). Zoom 0.5–3. Camera per layer persisted in `G.view.cam[L]`.
- Terrain from cached chunk canvases (`LD.Tex.chunkCanvas(L,cx,cy,bucket)`) with invalidation; unexcavated chunks
  drawn as solid rock with a diagonal hatch and hardness label on hover; digging chunks show a progress ring.
- Overlays drawn in order: terrain → deposits → trees → pipes → cables → conveyors → structures (sorted by y)
  → enemies → projectiles → particles → lighting (multiply, low-res light canvas 1/4) → weather (rain/fog) →
  UI overlays (grid, hover, ghost, ranges, selection, chunk borders, blueprint frame).
- Structures rotate by `rot` (sprites drawn rotated 90°·rot). State badges as vector glyphs (§8 of API).
- Day/night tint on L0; ambient per layer; light sources: `structure.light`, working machines (tier glow),
  crystal/magma/plasma terrain, turret shots.
- Particles kinds: `smoke, steam, spark, dust, ember, glow, shot, hit, death, build, rubble, rain, plasma, arc,
  fog, bubble`. Settings `particles: off|low|high`.

## 9. Sprite keys → see docs/CANON.md §A (column `sprite`). Shared parametric keys: `conveyor, cable, pipe, tank,
wall, warehouse, shaft, drill, elevator, borer` (param = tier). Enemy keys = enemy ids.

## 10. SFX keys → docs/CANON.md §F. Music: `LD.Music.menu()` 133 BPM minimal pulse; `LD.Music.layer(idx)`
subtle per-stratum bed (decision 7): L0 soft pads/wind, L1 low drone + drips, L2 crystal tones, L3 sub-bass +
heat, L4 void drone with slow pulses; crossfade 3 s on layer switch; ducks under wave warnings.

## 11. UI screens & flows

- Menu (KDZ background) with left ink slab: lockup + `NUEVA PARTIDA` (name, difficulty, seed) / `CONTINUAR`
  (slots: auto, 1, 2, 3 with playtime/era/day) / `ENCICLOPEDIA` (last save) / `AJUSTES` / `CUESTIONARIO` (link to
  ./cuestionario.html, hidden if not present) / version block "DWG NO. KDZ-DUSTRY REV A".
- Game HUD: top bar (era, day + clock, weather, power of current layer grids: gen/use with ratio bar, threat +
  next wave countdown, research in progress with bar); left: strata section widget (5 bands, shaft depth,
  hatched locked, excavated % for lower layers) = layer control; left dock: BUILD (B), BLUEPRINTS, HAND (H),
  DISMANTLE (X), STATS; bottom: inventory tray of the current layer grouped by cat with rates and caps; right:
  selection panel. Keys: WASD/arrows pan, wheel zoom, 1–5 layer, B build, E encyclopedia, T tech tree, X
  dismantle, H hand, R rotate (build mode) / research tab otherwise, C copy selection (blueprint), V paste,
  Esc close/cancel/pause, Space pause sim, F3 fps.
- Build palette: categories (Logística, Energía, Fluidos, Extracción, Procesado, Naturaleza, Defensa,
  Investigación, Almacén, Especial), locked items greyed with unlocking tech; cost list coloured by availability
  in the current layer; drag to draw lines for conveyors/cables/pipes; rotate with R.
- Panel: structure info, state, recipe picker (filtered by effective tier) + "aplicar a todas", progress, OC
  controls (+/− with power/speed/wear preview), integrity bar + repair, fuel/fluid gauges, elevator rules editor,
  tank contents, borer target, turret ammo/target, pause, dismantle (refund preview), rotate.
- Encyclopedia (dark): Materiales, Fluidos, Componentes, Máquinas, Tecnologías (tree by era + queue + "Siguiente
  paso"), Capas, Amenazas, Mecánicas (guides). Undiscovered = `???` + hint.
- Tutorial (decision 43): 8 steps with highlight of the relevant UI, skippable; objectives list (10–15
  milestones) in a collapsible HUD card.
- Stats (decision 44): canvas line charts (last 10/60 min) of item production/consumption per layer and power.
- Pause (Esc): CONTINUAR / GUARDAR / CARGAR / ENCICLOPEDIA / AJUSTES / SALIR AL MENÚ.
- Settings: volumes (general/música/efectos/ambiente), partículas, textura, rejilla, rangos siempre, autoguardado,
  movimiento reducido, mostrar FPS, reiniciar tutorial; dificultad read-only in game.

## 12. Balance targets
Era 0→1 ≈10 min, →2 40 min, →3 2 h, →4 5 h, →5 10 h, →6 18 h, →7 30 h active. Fuel MJ/unit: wood_log 8, stick 1,
charcoal 16, peat 10, coal 24, coke 30, tar 20, ethanol 22, biofuel 34, diesel 42, kerosene 40, naphtha 38,
natural_gas 36, hydrogen 12, fuel_rod 4e5, mox_rod 5e5, thorium_fuel 3e5, fusion_pellet 6e6, he3_pellet 9e6.
Generators: water_wheel 4 kW, windmill 2.5 kW, steam_engine 60 kW, coal_plant 400 kW, diesel 1.5 MW, gas_turbine
3 MW, solar 80 kW, geothermal 5 MW, fission 150 MW, fusion 2 GW. Consumers: T2 15–30 kW, T3 20–60 kW, T4
100–300 kW, T5 0.5–1.5 MW, T6 1–3 MW, T7 25–60 MW. Cable caps: drive_shaft 10 kW, cable_copper 300 kW, cable_hv
20 MW, cable_super ∞. Pipe rates: wood 2, bronze 8, steel 40, titanium 200, quantum ∞. Tank caps: wood 300, iron
2000, steel 10000, titanium 60000, cryo 30000, quantum 2e6. Elevators: 5 / 20 / 80 / 400 items/s. Borers: 2 / 4 /
10 / 30 tiles/s.

## 13. Testing & acceptance
`node tools/validate.js` passes (see file for rules incl. fluids need pipe/tank paths, every fluid has a tank tier
≤ its tier+1, every recipe type has a machine, tech graph acyclic and fully reachable). `node tools/smoke.mjs`:
zero console errors, new game, `LD.Debug.ff(600)`, placements, screenshots. `LD.Debug`: `ff, give(L,id,n),
giveAll(n), unlockAll(), unlockLayer(L), excavateAll(L), place(id,L,x,y,rot), spawnWave(L), setThreat(L,v),
state(), tp(L,x,y), fluid(L, id, n)`.
