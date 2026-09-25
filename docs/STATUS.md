# STATUS — punto de guardado (para retomar)

Rama: `claude/exciting-tesla-vgb2ey`. Todo lo listado como "hecho" está en `src/` y verificado sintácticamente
(`node -e "new Function(...)"`); los módulos de motor fueron probados por sus autores con arneses aislados, pero
**todavía no se ha hecho la integración completa ni el smoke test end-to-end** (faltan 3 archivos de contenido).

## Hecho
- Contrato y decisiones: `docs/CONTRACT.md` (v2), `docs/CANON.md`, `docs/API.md`, `docs/DECISIONS.md` (50 respuestas), `docs/AGENT_BRIEF.md`.
- Núcleo: `src/js/core/*`, `src/js/main.js`, `src/index.body.html`, `src/css/00_base.css`, `build.js`, `tools/validate.js`, `tools/smoke.mjs`, `tools/shot.mjs`.
- Animación del menú: `src/js/vendor/kdz.js` (adaptada, `LD.KDZ.init/start/stop`, exporta `glyphs`/`font`).
- Motor: `gen/textures.js`, `gen/world.js`, `sim/economy.js`, `sim/sim.js`, `sim/fluids.js`, `sim/power.js`, `sim/build.js`, `sim/research.js`, `sim/nature.js`, `sim/events.js`, `sim/stats.js`, `sim/defense.js`, `render/render.js`, `render/particles.js`, `audio/audio.js`, `audio/music.js`.
- Interfaz: `ui/ui.js`, `ui/menu.js`, `ui/settings.js`, `ui/pause.js`, `ui/hud.js`, `ui/build.js`, `ui/panel.js`, `ui/encyclopedia.js`, `ui/tutorial.js`, `ui/stats.js` y CSS `10_menu`, `20_hud`, `30_panels`, `40_encyclopedia`, `50_overlays`.
- Contenido: `content/items.js` (282 objetos), `content/recipes.js` (299 recetas).
- `gen/sprites.js`: escrito por su agente (142 KB, parsea) — **revisar si está completo** (galería `?spritetest`).
- Cuestionario `cuestionario.html` (publicado como artefacto) y `README.md`.

## Pendiente (en este orden)
1. Contenido restante: `content/structures.js` (131 estructuras del canon, con los campos que leen `world.js`/`nature.js`/`power.js`: ver `docs/INTEGRATION_NOTES.md` y el prompt del agente), `content/enemies.js`, `content/layers.js` (+ `terrains`), `content/techs.js` (~100 tecnologías con `time`, `lab`, `LD.Content.START`), `content/guides.js` (artículos de mecánicas, admiten enlaces `[[kind:id]]`).
2. `node tools/validate.js` hasta 0 errores (cadena de progresión completa, todo desbloqueado por exactamente una tecnología).
3. `node build.js` y `node tools/smoke.mjs` (Chromium en `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`); corregir errores de arranque y de integración; revisar capturas en `tools/out/`.
4. Revisión adversarial por dimensiones (corrección, balance, estética, audio, rendimiento, guardado) y pases de pulido.
5. Publicar `dist/index.html` como artefacto y subir.

## Notas de integración conocidas
Ver `docs/INTEGRATION_NOTES.md`. Resumen: convención `_wantPower` = vatios base (Power aplica 2^oc); partículas en píxeles de mundo (casilla·48); `Fluids` solo reconoce pozos/bombas con `nature.out:{water:…}`; extractores de terreno (cantera, arcilla, arena, turba, salinas) van como `nature` con `terrain`; `Render.showRanges` y `Particles.setQuality` ya se propagan desde `main.js`.
