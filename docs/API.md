# API.md — exact cross-module signatures (binding)

All functions below MUST exist with these signatures. A module may add more. Resolve other namespaces at call
time. `G` = `LD.G`. Tile coordinates are integers; world pixel = tile × 32 (`LD.Render.TILE = 32`).

## LD.World (gen/world.js)
```
World.gen(G)                       // (re)generate terrain for all layers from G.meta.seed; idempotent; builds World.layers[idx]
World.layers[idx] = { w, h, chunk, terrain: Uint8Array (terrain index per tile), tIds: string[] (index→terrain id),
                      occ: Int32Array (structure index per tile, -1 = free; see World.occRef), light: null }
World.terrainAt(L, x, y) → terrain id string | null (out of bounds → null)
World.terrainDef(L, x, y) → terrain def (LD.Registry.terrain) | null
World.depositAt(L, x, y) → { res, amt, max, hardness, fluid } | null      (reads G.layers[L].deposits)
World.treeAt(L, x, y) → growth (0..1) | null                               (forest tiles; G.layers[L].trees; missing key = 1)
World.isBuildable(L, x, y) → bool (terrain buildable, claimed, no structure)
World.canPlace(structId, L, x, y) → { ok:bool, reason:string|null }        (footprint, terrain, deposit rules, adjacency rules)
World.chunkOf(L, x, y) → { cx, cy }
World.isClaimed(L, x, y) → bool
World.claimable(L, cx, cy) → { ok, cost:{item:n}|null, reason }
World.claimChunk(L, cx, cy) → bool                                         (pays cost via Economy.take, emits territory:claimed)
World.chunkCost(L, cx, cy) → {item:n}
World.claimedBounds(L) → { x0, y0, x1, y1 } in tiles (inclusive-exclusive)
World.setTerrain(L, x, y, terrainId)                                       (updates + LD.Tex.invalidate)
World.tilesInRadius(L, x, y, r) → iterator/array of [x,y]
World.centre(L) → { x, y } (tile of hub / elevator)
World.uidAt(L, x, y) → structure uid | null                                (uses occ + World.occRef[] array of uids)
World.setOcc(L, x, y, w, h, uid|null)
World.spawnTiles(L) → [[x,y],...] border/spawn candidates for enemies
World.regionStats(L) → { claimedChunks, totalChunks }
```

## LD.Tex (gen/textures.js)
```
Tex.init(progressCb) → Promise (pre-generates tile variants; call progressCb(0..1, label))
Tex.TILE = 32
Tex.tile(terrainId, variant /*0..N-1*/, size /*px*/) → canvas               (cached)
Tex.VARIANTS = 6
Tex.chunkCanvas(L, cx, cy, zoomBucket /*0.5|1|2*/) → canvas                 (cached; draws terrain + deposits + trees + edges)
Tex.invalidate(L, x, y)                                                       (drops cached chunk containing tile)
Tex.invalidateLayer(L)
Tex.icon(itemId, size /*px*/) → canvas                                       (cached; category-shaped monoline icon tinted by item colour)
Tex.iconDataUrl(itemId, size) → string                                       (for <img>)
Tex.depositOverlay(resId, size) → canvas
Tex.noiseCanvas(w, h, seed, opts) → canvas                                   (grain helper)
Tex.quality = 'high' | 'low'
```

## LD.Sprites (gen/sprites.js)
```
Sprites.TIER_COLORS = ['#8f8b82','#b08d57','#7f8ea3','#c9a227','#6fa8dc','#8fb87a','#c9603b','#b28cff']
Sprites.draw(ctx, structDef, px, py, sizePx, t, inst)   // inst = G.structures[uid] or null (ghost); state via inst.state; oc glow; integrity cracks
Sprites.drawEnemy(ctx, enemyDef, px, py, sizePx, t, inst)
Sprites.drawGhost(ctx, structDef, px, py, sizePx, valid)
Sprites.drawBadge(ctx, state, px, py, sizePx, progress)  // state badges (§8)
Sprites.prerender(structDef, sizePx, state) → canvas       // cached static base (no anim); draw() may use it
Sprites.thumb(structDef, sizePx) → canvas                  // for build palette / encyclopedia (cached)
Sprites.enemyThumb(enemyDef, sizePx) → canvas
```

## LD.Sim.Economy (sim/economy.js)
```
Economy.init(G)                          // rebuild derived data
Economy.tick(dt)                         // extractors, machines, nature outputs are in Nature; elevator transfer; caps
Economy.has(items:{id:n}, mul=1) → bool
Economy.take(items:{id:n}, mul=1) → bool (atomic: all or nothing)
Economy.add(itemId, n) → number actually added (respects cap; emits inv:changed, item:discovered)
Economy.addMany(items:{id:n}, mul=1) → bool (true if all fit; partial adds allowed only via addPartial)
Economy.addPartial(items, mul)
Economy.count(itemId) → number
Economy.cap(itemId) → number
Economy.rates → { [itemId]: { plus:number, minus:number } } (rolling 5 s average, for HUD)
Economy.rebuildNetworks(L?)              // connectivity + linkRate per structure; call after structure changes
Economy.linkRate(uid) → number|Infinity  // 0 = not linked
Economy.isLinked(uid) → bool
Economy.machineSpeed(inst) → number      // combined multiplier (integrity, oc, power ratio, difficulty)
Economy.setRecipe(uid, recipeId|null)
Economy.availableRecipes(uid) → recipe[] (unlocked, tier ≤ effective tier)
Economy.effectiveTier(inst) → number
Economy.elevatorCapacity(L) → number
Economy.discover(itemId)
```

## LD.Sim.Power (sim/power.js)
```
Power.tick(dt)                           // computes G.power {gen,use,ratio,stored,cap}; burns fuel; charges batteries
Power.demandOf(inst) → W (with oc)
Power.genOf(inst) → W (actual this tick)
Power.fuelState(inst) → { buffered MJ, item|null }
Power.isNetworked(inst) → bool           // layer connected to surface via shaft
Power.summary() → { gen, use, ratio, stored, cap, producers:[{id,count,gen}], consumers:[{id,count,use}] }
```

## LD.Sim.Build (sim/build.js)
```
Build.canAfford(structId) → bool
Build.cost(structId) → {item:n} (difficulty-adjusted)
Build.place(structId, L, x, y) → uid|null   (validates via World.canPlace, pays, creates inst with build.left, occ, emits structure:placed)
Build.tick(dt)                              // construction progress, wear, heat, broken, maintenance bays
Build.dismantle(uid) → {item:n} refunded    (100% while building, 65% after; emits structure:removed)
Build.refundPreview(uid) → {item:n}
Build.repair(uid) → bool                    (pays cost; instant)
Build.repairCost(uid) → {item:n}
Build.setOverclock(uid, level) → bool
Build.integrity(inst) → 0..1
Build.speedMulFromIntegrity(inst) → number
Build.maxHp(inst) → number
Build.damage(uid, amount, source) → bool (broken?)
Build.setPaused(uid, bool)
Build.structuresIn(L) → inst[]
Build.footprint(inst) → { x, y, w, h }
Build.hubOf(L) → inst|null                  (hub for L0, elevator for others)
```

## LD.Sim.Research (sim/research.js)
```
Research.canResearch(techId) → { ok, missing:{item:n}, prereqs:[] }
Research.research(techId) → bool            (pays, marks done, discovers unlocks, emits tech:researched, updates G.meta.era)
Research.isDone(techId) → bool
Research.isUnlocked(kind:'structure'|'recipe', id) → bool
Research.available() → tech[] (prereqs done, not done)
Research.nextSteps() → [{ tech, missing, affordable }] sorted by era/cost
Research.eraOf(G) → number (max era of done techs)
```

## LD.Sim.Nature (sim/nature.js)
```
Nature.tick(dt)                             // regrowth, gather huts, woodcutters, planters, farms, wells/pumps, bonsais, solar daylight factor
Nature.gather(L, x, y) → { item, n } | null (manual hand tool; cooldown handled here; emits inv:changed)
Nature.gatherCooldown() → seconds left
Nature.cutTree(L, x, y) → n wood
Nature.daylight() → 0..1 (surface light factor from G.time.dayFrac)
Nature.isNight() → bool
```

## LD.Sim.Defense (sim/defense.js)
```
Defense.tick(dt)
Defense.threat(L) → number
Defense.nextWave(L) → { at, in:seconds, size, no }
Defense.spawnWave(L, opts?)                 // immediate wave (also used by Debug)
Defense.enemiesIn(L) → enemy[]
Defense.projectiles → [{x,y,tx,ty,kind,t}] (for rendering, layer field)
Defense.damageMatrix
Defense.turretTargets(uid) → enemy|null
```

## LD.Sim (sim/sim.js)
```
Sim.init(G)                                 // calls World.gen, Economy.init, etc.; places hub on new game
Sim.tick(dt)                                // §7 order; increments G.time; emits 'tick' every 0.5 s of sim time with {t}
Sim.paused (bool), Sim.setPaused(v), Sim.speed (1|2|4 debug)
Sim.offline(elapsedSeconds) → summary { seconds, produced:{}, events:[] } (emits offline:summary)
Sim.newGameSetup(G)                         // hub, initial claimed chunks, starter items, tutorial flags
LD.Debug = { ff(seconds), give(id,n), giveAll(n), unlockAll(), unlockLayer(L), place(id,L,x,y), spawnWave(L), setThreat(L,v), state(), tp(L,x,y) }
```

## LD.Particles (render/particles.js)
```
Particles.emit(kind, x /*world px*/, y, opts={ n, color, dir, spread, speed, life, size, layer })
Particles.update(dt)
Particles.draw(ctx, cam, L)                 // ctx already transformed to world space
Particles.clear()
Particles.count
```

## LD.Render (render/render.js)
```
Render.TILE = 32
Render.init(worldCanvas, fxCanvas)
Render.cam(L?) → { x, y, z } (world px centre + zoom) — persisted in G.view.cam[L]
Render.setCam(L, x, y, z), Render.panBy(dx, dy), Render.zoomAt(factor, logicalX, logicalY)
Render.frame(dt, tSeconds)                  // draws world + fx for G.view.layer
Render.screenToTile(logicalX, logicalY) → { x, y, fx, fy } (tile ints + fractional)
Render.tileToScreen(x, y) → { x, y }
Render.setHover(tileX|null, tileY|null)
Render.setGhost({ structId, x, y, valid } | null)
Render.setSelection(uid|null)
Render.setMode('normal'|'build'|'dismantle'|'hand'|'claim')
Render.visibleStructures() → uid[] (for audio loops)
Render.flash(L, x, y, color)                // small screen feedback
Render.centerOn(L, x, y)
Render.showRanges(bool)
```

## LD.Audio (audio/audio.js)
```
Audio.init()                                // create context lazily on first user gesture (call from pointerdown/keydown)
Audio.unlocked → bool
Audio.setVolumes({ master, music, sfx, ambient })
Audio.play(name, opts={ gain, pitch, x, y })  // one-shots (§10), returns nothing; must be cheap (voice cap 24)
Audio.loop(key, uid, intensity 0..1)        // machine loops: called each frame for visible working machines; fades out unseen
Audio.stopLoop(uid)
Audio.update(dt)                            // fades, culls
Audio.ambient(layerIdx, night:bool)         // layer ambience bed (wind/birds, cave drips, crystal hum, magma rumble, void drone)
Audio.stopAll()
Audio.busses: { master, music, sfx, ambient } (GainNodes) — Music uses Audio.busses.music
```

## LD.Music (audio/music.js)
```
Music.start()   // menu ambient (generative); Music.stop(fadeSeconds); Music.playing
```

## LD.UI (ui/ui.js)
```
UI.toast(text, kind='info'|'ok'|'warn'|'bad', ms=3200)
UI.modal({ title, body: Node|string, actions:[{label, kind, onClick}], onClose, wide }) → { close }
UI.confirm(title, text) → Promise<bool>
UI.tooltip.attach(el, contentFn)            // hover tooltip (delayed, follows mouse, stays in stage)
UI.icon(itemId, size=20) → <img>|<canvas>   // via LD.Tex.icon
UI.itemChip(itemId, n, {rate}) → Node       // icon + qty (+ rate) used in tray, costs, recipes
UI.costList(cost:{id:n}, {check:true}) → Node   // rows with have/need colouring
UI.tabs(items:[{id,label,render}], active) → { el, select(id) }
UI.bar(value 0..1, {kind}) → Node (hairline bar)
UI.keycap(text) → Node
UI.sfxHooks(root)                           // adds ui_click/ui_hover to buttons within root
UI.el = LD.U.el
```
Screens: `LD.UI.Menu.show()/hide()`, `LD.UI.HUD.mount(root)/unmount()/update(dt)`, `LD.UI.Build.open()/close()/toggle()`,
`LD.UI.Panel.select(uid|null)/refresh()`, `LD.UI.Encyclopedia.open(section?, id?)/close()/toggle()`,
`LD.UI.Settings.open(opts)/close()`, `LD.UI.Pause.open()/close()/toggle()`, `LD.UI.Menu.showSlots(mode:'load'|'save')`.
Every openable UI registers with `LD.Main.pushOverlay(obj{ close })` so Esc closes the topmost overlay first.

## LD.Main (main.js) — see code
```
Main.ready, Main.screen ('boot'|'menu'|'game'), Main.startNewGame(opts), Main.continueGame(slot), Main.toMenu(),
Main.switchLayer(idx), Main.pushOverlay(o), Main.popOverlay(), Main.overlayDepth(), Main.save(slot), Main.unsavedChanges()
```
