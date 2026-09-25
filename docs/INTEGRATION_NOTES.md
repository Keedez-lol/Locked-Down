## build.js (done)
- Particles.emit / Audio.play called with TILE-unit coords (x+size/2) — verify vs particles.js (world px expected per API) → fix helpers fx()/sfx() in build.js if needed.
- Needs: Fluids.consumeLubricant(uid,dt) (fallback take); Power sums inst._wantPower for bays; Power sets inst._overheat on reactors; Sim.unlockLayer.
- Sim.init: World.gen before Build.init (self-heals). placeFree(id,L,x,y,rot,force).
- Bay repairs only < 90% integrity.
## music.js (done)
- Needs LD.Audio.ctx (or context/ac/actx), busses.music, optional reverbSend. Verify audio.js exposes ctx.
- Self-ducks on wave events. ≤10 oscillators menu.
## audio.js (done)
- play(name,{x,y,layer}) takes TILE coords (uses Render.tileToScreen). Consistent with build.js. Particles.emit expects world px per API → check particles.js and build.js helper.
- Exposes ctx, busses, reverbSend (music OK). Loops on sfx bus.
## economy.js + sim.js (done)
- _wantPower convention: BASE watts; power.js applies 2^oc. build.js bayTick pre-multiplies 2^oc → FIX build.js to base watts.
- Borer particles at world px (tile·TILE) — consistent with API. build.js uses tile coords for particles → check particles.js expectation.
- Link sources: hub, elevators, shaft heads (L0).
- G.objectives.current = [{id,title,hint}]; Sim.objectives().
## ui shell (done): ui.js, menu.js, settings.js, pause.js, 10_menu.css, 50_overlays.css
- Cuestionario link hidden on file:// (fetch would log console error). Fine.
- HUD may duplicate toasts (log cards) — check.
- Screenshots in scratchpad/h/.
## defense.js (done)
- Own flow field; broken structures walkable. Particles at world px. Turret state written by Defense. Migration → spawnWave(0,{mul:2.5}).
## fluids.js + power.js (done)
- _powerRatio undefined → treat as 0 (no grid). Power clears _wantPower each tick.
- build.js bayTick: change to base watts (line ~473).
- Brownout emits event only; HUD/Audio should play 'brownout' on power:brownout.
- Fission needs adjacent cooling tower with water.
## world.js (done)
- Structure schema extensions read: extract.res (restrict resources) and def.terrain/nature.terrain/extract.terrain (footprint terrain requirement: quarry rock, clay_pit clay, sand_pit sand, peat_cutter bog, salt_works saltflat). → tell structures content agent to set these fields!
- Layer deposit schema: amount:null / infinite:true → amt -1.
- dist/index.html is untracked build artefact → add to .gitignore? Keep dist tracked at the end (deliverable). For now ignore.
## encyclopedia/tutorial/stats UI (done)
- Guides support [[kind:id]] links. Tutorial not on overlay stack. Stats reads Stats.rate(L,id,60) optional.
- Sprites.thumb/enemyThumb fallback in place; verify once sprites.js lands.
## render.js + particles.js (done)
- Input bound on #world canvas; #hud-root must be pointer-events:none with children auto. Check 20_hud.css.
- Particles in world px. build.js passes tile coords → FIX build.js fx() helper (multiply by 48).
- Render.hintOffset: HUD should set to tray height.
- onTileDrag: return true from 'start' to claim.
## hud/build/panel UI (done)
- Settings should call Render.showRanges(v) on 'ranges' change → add in main.js settings:changed handler.
- Render.hintOffset should be set to tray height → check.
## enemies.js + layers.js (done)
- magma is an infinite fluid deposit h6 with no dedicated extractor in canon → structures.js must let brine_pump (or a fluid extractor with hardnessMax ≥ 6) pump magma (extract.res include 'magma').
- Validator needs pumpjack hardnessMax ≥2, gas_well ≥3, brine_pump ≥6, he3_collector ≥7.
## structures.js (done, 133 defs)
- Power demand for lamp/warehouse_auto/silo_quantum is never registered by any sim module (harmless, 0 demand) → optional: Build.tick or Economy could setDemand for `def.power.use` structures without types.
- `elevator` must be in START.structures or unlocked by shaft_coal tech for manual building.
- rp0–rp5 only consumed by tech costs → techs.js.
