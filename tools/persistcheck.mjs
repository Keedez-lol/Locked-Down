// Round-trip checks for the QA persistence patches: terrain edits, trees under structures, State.read without re-binding.
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = 'file://' + path.join(here, '..', 'dist', 'index.html');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(dist);
await page.waitForFunction(() => window.LD && LD.Main && LD.Main.screen === 'menu', null, { timeout: 60000 });
const r = await page.evaluate(() => {
  const out = {};
  LD.Main.startNewGame({ name: "persist", difficulty: "normal", seed: 11 });
  const G = LD.G, W = LD.World, L0 = W.layers[0];
  // forest edit
  let gx = -1, gy = -1;
  for (let y = 10; y < L0.h && gx < 0; y++) for (let x = 10; x < L0.w; x++) if (W.terrainAt(0, x, y) === 'grass' && W.isBuildable(0, x, y)) { gx = x; gy = y; break; }
  W.setTerrain(0, gx, gy, 'forest');
  out.editStored = G.layers[0].edits && G.layers[0].edits[gx + ',' + gy];
  // tree under a structure
  const hub = W.hubArea();
  const tx = hub.x1 + 6, ty = hub.y1 + 6;
  G.layers[0].trees[tx + ',' + ty] = 0;
  LD.Debug.giveAll(500);
  const placed = LD.Debug.place("palisade", 0, tx, ty);
  out.placed = !!placed;
  LD.Debug.ff(120);
  out.treeAfter = G.layers[0].trees[tx + ',' + ty];
  // save, go to menu, reload
  LD.State.save('1');
  const raw = localStorage.getItem('lockeddown.save.1');
  out.hasGrids = /"grids":\[\{/.test(raw);
  out.bytes = raw.length;
  // State.read must not touch LD.G / modules
  const before = LD.G;
  const G2 = LD.State.read('1');
  out.readOk = !!G2 && G2 !== before && LD.G === before;
  LD.Main.toMenu();
  LD.Main.continueGame('1');
  out.terrainAfterLoad = LD.World.terrainAt(0, gx, gy);
  out.treeAfterLoad = LD.G.layers[0].trees[tx + ',' + ty];
  out.editAfterLoad = LD.G.layers[0].edits[gx + ',' + gy];
  // corrupt slot
  localStorage.setItem('lockeddown.save.2', '{"meta":1');
  out.slots = LD.State.slots().map(s => [s.slot, s.exists, s.corrupt]);
  return out;
});
console.log(JSON.stringify(r, null, 1));
console.log(errors.length ? errors : 'no errors');
await browser.close();
