#!/usr/bin/env node
'use strict';
const fs = require('fs'), path = require('path');
const root = __dirname;
const ORDER = [
  'core/util.js', 'core/events.js', 'core/registry.js', 'core/state.js', 'core/stage.js',
  'content/items.js', 'content/recipes.js', 'content/structures.js', 'content/techs.js', 'content/enemies.js', 'content/layers.js', 'content/guides.js',
  'gen/textures.js', 'gen/sprites.js', 'gen/world.js',
  'sim/economy.js', 'sim/power.js', 'sim/build.js', 'sim/research.js', 'sim/nature.js', 'sim/defense.js', 'sim/sim.js',
  'render/particles.js', 'render/render.js',
  'audio/audio.js', 'audio/music.js',
  'ui/ui.js', 'ui/menu.js', 'ui/hud.js', 'ui/build.js', 'ui/panel.js', 'ui/encyclopedia.js', 'ui/settings.js', 'ui/pause.js',
  'vendor/kdz.js',
  'main.js'
];
const read = p => fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
const js = [], missing = [];
for (const f of ORDER) {
  const p = path.join(root, 'src/js', f);
  const src = read(p);
  if (src === null) { missing.push(f); continue; }
  js.push(`/* ==== ${f} ==== */\n${src.trim()}\n`);
}
const cssDir = path.join(root, 'src/css');
const css = fs.existsSync(cssDir) ? fs.readdirSync(cssDir).filter(f => f.endsWith('.css')).sort().map(f => `/* ==== ${f} ==== */\n${fs.readFileSync(path.join(cssDir, f), 'utf8').trim()}`).join('\n\n') : '';
const body = read(path.join(root, 'src/index.body.html')) || '<div id="stage"></div>';
const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0c0c0d">
<meta name="color-scheme" content="dark">
<title>Locked Down</title>
<style>
${css}
</style>
</head>
<body>
${body.trim()}
<script>
${js.join('\n')}
</script>
</body>
</html>
`;
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist/index.html');
fs.writeFileSync(out, html);
console.log(`built ${out}: ${(html.length / 1024).toFixed(0)} KiB, ${js.length} js modules` + (missing.length ? `, MISSING: ${missing.join(', ')}` : ''));
if (process.argv.includes('--strict') && missing.length) process.exit(1);
