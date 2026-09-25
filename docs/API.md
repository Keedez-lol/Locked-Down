# API.md — exact cross-module signatures (binding, v2)

Every function below MUST exist with this signature. Modules may add more. `G` = `LD.G`, `L` = layer index.
Tile coords are integers; world px = tile × `LD.Render.TILE` (48). Resolve other namespaces at call time.

## LD.World (gen/world.js)
```
World.gen(G)                          // regenerate terrain for all layers from G.meta.seed (idempotent); lower layers: excavated chunks get floors, others *_wall
World.layers[L] = { w, h, chunk, cw, ch (chunks), terrain: Uint8Array, tIds: string[], occ: Int32Array (-1 free; index into World.occRef),
                    occCable: Int32Array, occPipe: Int32Array, dirty:{ paths:true } }
World.occRef: uid[]                   // index → uid (0 unused)
World.terrainAt(L,x,y) → id|null;  World.terrainDef(L,x,y) → def|null
World.depositAt(L,x,y) → {res,amt,max,hardness,fluid}|null
World.treeAt(L,x,y) → growth|null
World.isSolid(L,x,y) → bool           // unexcavated rock or *_wall
World.isBuildable(L,x,y) → bool       // buildable terrain, excavated (or L0), no structure (overlays allowed by canPlace)
World.canPlace(structId, L, x, y, rot=0) → { ok, reason }   // footprint, terrain, deposit, needsWater/needsVent, surfaceOnly, overlay rules, borer adjacency
World.chunkOf(L,x,y) → {cx,cy};  World.chunkKey(cx,cy) → 'cx,cy'
World.isExcavated(L,cx,cy) → bool (L0 always true)
World.chunkDistance(L,cx,cy) → Chebyshev distance from the centre chunk
World.rockHardness(L,cx,cy) → number;  World.excavationWork(L,cx,cy) → number
World.canDig(L,cx,cy) → { ok, reason } // unexcavated and adjacent to an excavated chunk
World.excavate(L,cx,cy)               // generate the chunk's interior, mark excavated, invalidate textures, emit chunk:excavated
World.setTerrain(L,x,y,id)            // + LD.Tex.invalidate
World.tilesInRadius(L,x,y,r) → [[x,y]...]
World.centre(L) → {x,y}
World.uidAt(L,x,y) → uid|null;  World.cableAt(L,x,y) → uid|null;  World.pipeAt(L,x,y) → uid|null
World.setOcc(L,x,y,w,h,uid|null);  World.setOverlay(kind:'cable'|'pipe', L,x,y, uid|null)
World.spawnTiles(L) → [[x,y]...]
World.excavatedBounds(L) → {x0,y0,x1,y1}
World.findPath(L, sx, sy, tx, ty, opts={maxNodes}) → [[x,y]...]|null   // A* over walkable tiles (structures/walls/water/solid blocked)
World.regionStats(L) → { excavatedChunks, totalChunks }
```

## LD.Tex (gen/textures.js)
```
Tex.init(progressCb) → Promise;  Tex.TILE = 48;  Tex.VARIANTS = 6;  Tex.quality
Tex.tile(terrainId, variant, size) → canvas
Tex.chunkCanvas(L, cx, cy, bucket /*0.5|1|2*/) → canvas   // terrain + edges + deposits + trees; unexcavated = rock + hatch
Tex.invalidate(L,x,y);  Tex.invalidateLayer(L)
Tex.icon(itemId, size) → canvas;  Tex.iconDataUrl(itemId,size) → string
Tex.depositOverlay(resId, size) → canvas
Tex.noiseCanvas(w,h,seed,opts) → canvas
Tex.backdrop(kind:'paper'|'ink') → dataURL   // body letterbox texture
```

## LD.Sprites (gen/sprites.js)
```
Sprites.TIER_COLORS = ['#8f8b82','#b08d57','#7f8ea3','#c9a227','#6fa8dc','#8fb87a','#c9603b','#b28cff']
Sprites.draw(ctx, structDef, px, py, sizePx, t, inst|null)     // handles inst.rot (0–3), state anim, oc glow, integrity cracks
Sprites.drawOverlay(ctx, structDef, px, py, sizePx, t, inst, neighbours:{n,e,s,w})  // cables/pipes/conveyors connect to neighbours
Sprites.drawEnemy(ctx, enemyDef, px, py, sizePx, t, inst)
Sprites.drawGhost(ctx, structDef, px, py, sizePx, valid, rot)
Sprites.drawBadge(ctx, state, px, py, sizePx, progress)
Sprites.thumb(structDef, sizePx) → canvas;  Sprites.enemyThumb(enemyDef, sizePx) → canvas
Sprites.lockup(ctx, x, y, capHeightPx, t) // KDZDUSTRY title lockup with the KDZ pen (uses LD.KDZ.glyphs / LD.KDZ.font)
```

## LD.KDZ (vendor/kdz.js) — already implemented plus:
```
KDZ.init({canvas,hint,fallback}) → { start, stop, seek, running, relayout, setReducedMotion, frame, ready }
KDZ.glyphs = { K, D, Z } geometry (parts with lines/arcs in 1000-unit cap space) ; KDZ.font = FONT_SRC (4×6 lettering)
KDZ.PEN_HW = 20, KDZ.GAP = 60
```

## LD.Sim.Economy (sim/economy.js)
```
Economy.init(G);  Economy.tick(dt)          // extractors, machines (item+fluid I/O via Fluids), borers, elevators, caps, rates
Economy.has(L, items, mul=1) → bool;  Economy.take(L, items, mul=1) → bool (atomic)
Economy.add(L, itemId, n) → added;  Economy.addMany(L, items, mul=1) → bool;  Economy.count(L,itemId);  Economy.cap(L,itemId)
Economy.rates[L] → { itemId:{plus,minus} }  (rolling 5 s)
Economy.rebuildNetworks(L?)                 // link graph (conveyors) → linkRate; also calls Power.rebuild(L), Fluids.rebuild(L)
Economy.linkRate(uid) → number|Infinity (0 = unlinked);  Economy.isLinked(uid)
Economy.machineSpeed(inst) → number;  Economy.effectiveTier(inst)
Economy.setRecipe(uid, recipeId|null);  Economy.applyRecipeToAll(uid);  Economy.availableRecipes(uid) → recipe[]
Economy.elevatorRules(uid) → rules[];  Economy.setElevatorRules(uid, rules)
Economy.discover(itemId)
Economy.hubMul(L) → 1 or 0.1 (hub ≤10 %)
```

## LD.Sim.Fluids (sim/fluids.js)
```
Fluids.isFluid(itemId) → bool
Fluids.rebuild(L)                          // networks over pipes + fluid structures; shaft/elevator joins
Fluids.networkOf(uid) → net|null           // net = { id, layer, tanks:[uid], members:[uid], fluids:{id:{amt,cap}} }
Fluids.available(uid, fluidId) → amount reachable from inst's network
Fluids.space(uid, fluidId) → free capacity for that fluid on inst's network
Fluids.take(uid, fluidId, n) → taken;  Fluids.give(uid, fluidId, n) → given   (both limited by adjacent pipe rate per second: Fluids.pipeRate(uid))
Fluids.pipeRate(uid) → number|Infinity
Fluids.tick(dt)                            // per-second rate accounting reset, lubricant consumption bookkeeping
Fluids.tankInfo(uid) → { fluid, amt, cap }
Fluids.setTankFluid(uid, fluidId|null)     // user can empty/assign a tank
Fluids.summary(L) → [{ fluid, amt, cap, netId }]
Fluids.hasLubricant(uid) → bool
```

## LD.Sim.Power (sim/power.js)
```
Power.rebuild(L);  Power.tick(dt)          // grids per layer joined across shafts; ratio per grid; fuel burn; batteries
Power.gridOf(uid) → grid|null  (grid = { id, layers:[..], gen, use, ratio, stored, cap, members:[uid] })
Power.demandOf(inst) → W;  Power.genOf(inst) → W;  Power.fuelState(inst) → { mj, item|null }
Power.cableCap(uid) → number|Infinity
Power.summary(L) → { gen, use, ratio, stored, cap, grids:n, producers:[{id,count,gen}], consumers:[{id,count,use}] }
Power.energyHandled(L) → W (moving average of gen)
```

## LD.Sim.Build (sim/build.js)
```
Build.canAfford(structId, L) → bool;  Build.cost(structId) → {item:n}
Build.place(structId, L, x, y, rot=0) → uid|null      // pays from inv[L]; overlays via World.setOverlay; emits structure:placed; networks rebuilt
Build.tick(dt)                                        // construction, wear (+lubricant), heat, broken, maintenance bays
Build.dismantle(uid) → refund;  Build.refundPreview(uid);  Build.repair(uid) → bool;  Build.repairCost(uid)
Build.setOverclock(uid, level) → bool;  Build.setPaused(uid, v);  Build.rotate(uid)
Build.integrity(inst) → 0..1;  Build.integrityMul(inst);  Build.maxHp(inst);  Build.damage(uid, amount, source) → broken?
Build.structuresIn(L) → inst[];  Build.footprint(inst) → {x,y,w,h};  Build.hubOf(L) → inst|null (hub / first elevator)
Build.elevatorsIn(L) → inst[]
Build.copyBlueprint(L, x0, y0, x1, y1) → blueprint;  Build.pasteBlueprint(bp, L, x, y) → { placed, queued }  (queue processed in Build.tick)
Build.blueprintCost(bp) → {item:n}
```

## LD.Sim.Research (sim/research.js)
```
Research.canStart(techId) → { ok, missing:{item:n}, prereqs:[] }
Research.start(techId) → bool;  Research.queue(techId);  Research.dequeue(techId);  Research.cancel()
Research.tick(dt)                          // lab speed; completion; queue advance
Research.isDone(id);  Research.isUnlocked('structure'|'recipe', id);  Research.available() → tech[]
Research.nextSteps() → [{tech, missing, affordable}];  Research.eraOf(G);  Research.labSpeed(tech) → number (labs/s)
Research.progress() → { tech, left, total, speed }|null
```

## LD.Sim.Nature (sim/nature.js)
```
Nature.tick(dt);  Nature.gather(L,x,y) → {item,n}|null;  Nature.gatherCooldown() → s;  Nature.cutTree(L,x,y)
Nature.daylight() → 0..1;  Nature.isNight() → bool
```

## LD.Sim.Defense (sim/defense.js)
```
Defense.tick(dt);  Defense.threat(L);  Defense.nextWave(L) → { at, in, size, no };  Defense.spawnWave(L, opts?)
Defense.enemiesIn(L) → enemy[];  Defense.projectiles → [{layer,x,y,tx,ty,kind,t,life}];  Defense.damageMatrix
Defense.turretTarget(uid) → enemy|null;  Defense.markPathsDirty(L)
```

## LD.Sim.Events (sim/events.js)
```
Events.tick(dt);  Events.weather(L) → { kind:'clear'|'fog'|'rain'|'storm', until, next }
Events.multipliers(L) → { pump, solar, wind, ambient, turretRange }
Events.upcoming() → { kind, layer, at }|null;  Events.active() → ev[];  Events.trigger(kind, L)  (Debug)
```

## LD.Sim.Stats (sim/stats.js)
```
Stats.tick(dt)                              // 1-s buckets, keeps 600 s fine + 60 min coarse per (layer,item) and power per layer
Stats.series(L, itemId, span:'10m'|'60m') → { plus:Float32Array, minus:Float32Array, step }
Stats.power(L, span) → { gen, use, step };  Stats.top(L, n) → [{item, plus, minus}]
Stats.record(L, itemId, delta)              // called by Economy.add/take
```

## LD.Sim (sim/sim.js)
```
Sim.init(G, {fresh});  Sim.tick(dt);  Sim.paused;  Sim.setPaused(v);  Sim.speed
Sim.newGameSetup(G)                         // hub at surface centre, starter items in inv[0], objectives, tutorial
Sim.unlockLayer(L)                          // called when shaft completes: elevator auto-placed, start chunks excavated
LD.Debug = { ff(seconds), give(L,id,n), giveAll(n), unlockAll(), unlockLayer(L), excavateAll(L), place(id,L,x,y,rot), spawnWave(L), setThreat(L,v), state(), tp(L,x,y), fluid(L,id,n), event(kind,L) }
```

## LD.Particles (render/particles.js)
```
Particles.emit(kind, x, y, opts={n,color,dir,spread,speed,life,size,layer});  Particles.update(dt);  Particles.draw(ctx, cam, L);  Particles.clear();  Particles.count
```

## LD.Render (render/render.js)
```
Render.TILE = 48;  Render.init(worldCanvas, fxCanvas);  Render.frame(dt, t)
Render.cam(L?) → {x,y,z};  Render.setCam(L,x,y,z);  Render.panBy(dx,dy);  Render.zoomAt(factor, lx, ly);  Render.centerOn(L,x,y)
Render.screenToTile(lx,ly) → {x,y,fx,fy};  Render.tileToScreen(x,y) → {x,y}
Render.setHover(x|null,y|null);  Render.setGhost({structId,x,y,rot,valid,line:[[x,y]...]}|null);  Render.setSelection(uid|null)
Render.setMode('normal'|'build'|'dismantle'|'hand'|'select'|'paste');  Render.setSelectionRect({x0,y0,x1,y1}|null)
Render.setBlueprintGhost({bp,x,y}|null);  Render.visibleStructures() → uid[];  Render.flash(L,x,y,color);  Render.showRanges(v)
```

## LD.Audio (audio/audio.js)
```
Audio.init();  Audio.unlocked;  Audio.setVolumes({master,music,sfx,ambient});  Audio.busses:{master,music,sfx,ambient}
Audio.play(name, opts={gain,pitch,x,y});  Audio.loop(key, uid, intensity);  Audio.stopLoop(uid);  Audio.update(dt)
Audio.ambient(L, night, weatherKind);  Audio.stopAll()
```
## LD.Music (audio/music.js)
```
Music.menu();  Music.layer(L);  Music.stop(fade);  Music.playing;  Music.duck(seconds)
```

## LD.UI (ui/ui.js)
```
UI.toast(text, kind, ms);  UI.modal({title, body, actions, onClose, wide}) → {close};  UI.confirm(title,text) → Promise<bool>
UI.tooltip.attach(el, contentFn);  UI.icon(itemId,size);  UI.itemChip(itemId,n,{rate,cap});  UI.costList(cost,{layer});  UI.tabs(items,active)
UI.bar(v,{kind});  UI.keycap(text);  UI.sfxHooks(root);  UI.fmtItems(obj) → string;  UI.structThumb(id,size);  UI.el
```
Screens: `LD.UI.Menu.init(root)/show()/hide()/showSlots(mode)`, `LD.UI.HUD.mount(root)/unmount()/update(dt)`,
`LD.UI.Build.open()/close()/toggle()/setMode(m)/cancel()/mode/rotate()`, `LD.UI.Panel.select(uid|null)/refresh()`,
`LD.UI.Encyclopedia.open(section?,id?)/close()/toggle(section?)`, `LD.UI.Settings.open(opts)/close()`,
`LD.UI.Pause.open()/close()/toggle()`, `LD.UI.Tutorial.start()/skip()/step()`, `LD.UI.Stats.open()/close()/toggle()`.
Every openable UI registers with `LD.Main.pushOverlay({close})` so Esc closes the topmost first.

## LD.Main — see src/js/main.js
