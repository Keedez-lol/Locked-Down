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
- Menú: sin numeral romano ni etiqueta «ACT n / IV» en la esquina superior derecha (solo «LOOP 20.00 S» y el contador de beats del acto III, ya con dos dígitos); ventana `uExempt` del shader de lente eliminada.
- Tutorial plegable (▾) y paso de recolección con tablones en el Almacén central; cabecera «Fabricación manual» en el panel del almacén.
- Lotes: AUTO / ×1 / ×5 / ×10 / ×25 / n por máquina (`Economy.setJobs`, `inst.jobs`).
- Flecha con punta de piedra desde el inicio; más sílex al picar roca.
- Niebla anclada al mapa; sin pista duplicada en el lienzo en modo mano.
- Música del menú (`audio/music.js`): dos pistas seleccionables en Ajustes → Audio → «Pista del menú» (`Settings.menuTrack`), ambas enganchadas en fase al reloj de la hoja KDZ mediante `sheetClock` (retícula de semicorcheas anclada al acto III, impacto en `lead`, acentos exactos en los cues fuera de retícula, estimación de velocidad de la hoja y reloj interno si la animación se detiene).
  - «KDZ» (`makeMenuKdz`, por defecto): kit de batería renderizado una vez con `OfflineAudioContext` (bombo con click y saturación, palmas con cola, charles metálicos 808, rim, caja, crash, boom 808), sub, bajo de sierras con doble filtro y drive, pad de 12 voces con coro, plucks con delay ping-pong a corchea con puntillo, reverb plate propia y compresor de bus. Composición en re menor: gancho de dos compases en el acto IV, arpegios de notas del acorde en el acto II, golpes de permutación en el acto III, ocho ciclos de macroforma (i · i · VI · III · VII · VI · iv · V) con breakdown en el ciclo 4 y resolución cada 160 s. Picos ≈ −11 dBFS en el bus de música.
  - «Pulso» (`makeMenuPulse`): la versión anterior de síntesis directa, conservada.
  - Herramientas: `tools/musictest.mjs` (reloj real, traza, niveles), `tools/musicsync.mjs` (precisión del planificador), `tools/musiclevels.mjs` (picos pre/post clipper por acto), `tools/musicspec.mjs` (espectrograma, envolvente, ventana de forma de onda contigua y formas de onda del kit → `tools/out/spec_*.png`).
- QA de la segunda pasada aplicada: mezcla de audio y admisión de bucles, campo de distancia Dial en defensa, guardado v3 compacto con ranuras dañadas, ediciones de terreno y árboles persistidos, sprites de pozo/tanque por tier, chevrones de cintas.
