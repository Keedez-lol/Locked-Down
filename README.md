# KDZDUSTRY

Juego idle/incremental de fábricas en un único archivo HTML. Empiezas en una era medieval con palos y piedras y
terminas extrayendo neutronio del núcleo del planeta con energía de fusión. Cinco estratos, cadenas de materiales
largas al estilo GregTech, overclock, integridad y desgaste, redes de cables y tuberías, tanques, inventario por
estrato con elevadores, excavación de parcelas con tuneladoras, defensa de base con pathfinding y una enciclopedia
que se va revelando con lo que descubres.

## Jugar

Abre `dist/index.html` en Chrome, Edge o Firefox recientes (WebGL2 para el fondo del menú, Web Audio para el
sonido). Todo es procedural: no hay descargas ni conexión.

Controles: `WASD`/flechas mover cámara · rueda zoom · `1–5` estrato · `B` construir · `H` mano (recolectar) ·
`X` desmontar · `C` copiar plano · `V` pegar plano · `R` rotar (construyendo) / tecnologías · `E` enciclopedia ·
`T` árbol tecnológico · `G` estadísticas · `Espacio` pausar simulación · `Esc` menú de pausa (guardar, cargar,
enciclopedia, ajustes, salir).

## Desarrollo

```
node build.js            # concatena src/ en dist/index.html
node tools/validate.js   # valida el contenido (materiales, recetas, máquinas, tecnologías, capas)
node tools/smoke.mjs     # prueba headless con Playwright y capturas en tools/out/
```

Estructura: `docs/` (contrato de arquitectura, canon de identificadores, API entre módulos, decisiones del
cuestionario), `src/js/core` (utilidades, eventos, registro, estado, escenario 16:9), `src/js/content` (datos),
`src/js/gen` (texturas, sprites, generación de mundo), `src/js/sim` (economía, fluidos, energía, construcción,
investigación, naturaleza, defensa, eventos, estadísticas), `src/js/render`, `src/js/audio`, `src/js/ui`,
`src/js/vendor/kdz.js` (animación KDZ del menú), `src/css`.

`cuestionario.html` es la hoja de 50 preguntas con la que se fijaron las decisiones de diseño (`docs/DECISIONS.md`).
