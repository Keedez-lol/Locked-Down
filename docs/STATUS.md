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
- Contenido: `content/items.js` (282 objetos), `content/recipes.js` (299 recetas), `content/structures.js` (133), `content/enemies.js` (15), `content/layers.js` (5 capas + 29 terrenos).
- `gen/sprites.js`: completo (todas las claves del canon, 15 enemigos, lockup, galería `?spritetest`).
- Cuestionario `cuestionario.html` (publicado como artefacto) y `README.md`.

## Pendiente (en este orden)
1. Contenido restante: `content/techs.js` (~100 tecnologías con `time`, `lab`, `LD.Content.START`), `content/guides.js` (artículos de mecánicas, admiten enlaces `[[kind:id]]`).
2. `node tools/validate.js` hasta 0 errores (cadena de progresión completa, todo desbloqueado por exactamente una tecnología).
3. `node build.js` y `node tools/smoke.mjs` (Chromium en `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`); corregir errores de arranque y de integración; revisar capturas en `tools/out/`.
4. Revisión adversarial por dimensiones (corrección, balance, estética, audio, rendimiento, guardado) y pases de pulido.
5. Publicar `dist/index.html` como artefacto y subir (quitar `dist/` de `.gitignore` cuando exista un build integrado).

## Notas de integración conocidas
Ver `docs/INTEGRATION_NOTES.md`. Resumen: convención `_wantPower` = vatios base (Power aplica 2^oc); partículas en píxeles de mundo (casilla·48); `Fluids` solo reconoce pozos/bombas con `nature.out:{water:…}`; extractores de terreno (cantera, arcilla, arena, turba, salinas) van como `nature` con `terrain`; `Render.showRanges` y `Particles.setQuality` ya se propagan desde `main.js`.

## Hecho tras la primera prueba del usuario
- Menú: hoja KDZ reestructurada a 1:1 (1080×1080, retícula 8×8) a la derecha del bloque de tinta; sin subtítulo, sin pie «FIG. 1», sin «SCALE 1:1», sin miras laterales.
- Menú (petición del usuario, verificado con capturas en 10 puntos del ciclo de 20 s): eliminado por completo el numeral romano de la esquina superior derecha de `src/js/vendor/kdz.js` — tanto el numeral grande (`composeNumeral`/`NUMERALS`, con su rectángulo de recorte del semitono) como la etiqueta «ACT n / IV» de la cabecera y la ventana `uExempt` del shader de lente que solo existía para él. En esa esquina ya no cambia nada de un acto a otro: solo el rótulo fijo «LOOP 20.00 S» (y el contador «BEAT nn / 12  133 BPM» durante el acto III, cuyo `nbInt` se corrigió a 2 dígitos porque los beats 10–12 se imprimían como 0–2). **Cambio pendiente de commit** en el árbol de trabajo junto con los demás parches de QA (audio.js, music.js, stage.js, state.js, sprites.js, textures.js, main.js, defense.js); `tools/bot.mjs` está sin seguimiento.
- Tutorial plegable (▾) y paso de recolección con tablones en el Almacén central; cabecera «Fabricación manual» en el panel del almacén.
- Lotes: AUTO / ×1 / ×5 / ×10 / ×25 / n por máquina (`Economy.setJobs`, `inst.jobs`).
- Flecha con punta de piedra desde el inicio; más sílex al picar roca.
- Niebla anclada al mapa; sin pista duplicada en el lienzo en modo mano.
- Música del menú: en curso (agente) — pulso a 133 BPM sincronizado con el ciclo de la animación, macroestructura de 8 ciclos.
