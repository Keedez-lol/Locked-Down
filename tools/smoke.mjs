// Playwright smoke test: node tools/smoke.mjs [--keep]
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, '..', 'dist', 'index.html');
const out = path.join(here, 'out'); fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [], logs = [];
page.on('console', m => { const t = m.type(); if (t === 'error') errors.push(m.text()); logs.push(`[${t}] ${m.text()}`); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 6).join('\n')));
await page.goto('file://' + dist);
await page.waitForFunction(() => window.LD && LD.Main && LD.Main.ready, null, { timeout: 60000 }).catch(() => errors.push('boot timeout: LD.Main.ready never true'));
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(out, '01_menu.png') });
const steps = [
  ['new game', async () => { await page.evaluate(() => LD.Main.startNewGame({ name: 'Smoke', difficulty: 'normal', seed: 42 })); await page.waitForTimeout(800); }],
  ['ff 60', async () => { await page.evaluate(() => LD.Debug.ff(60)); await page.waitForTimeout(300); }],
  ['give/unlock/place', async () => { await page.evaluate(() => { LD.Debug.giveAll(500); LD.Debug.unlockAll(); const G = LD.G; const hub = Object.values(G.structures).find(s => s.id === 'hub'); const x = hub.x + 4, y = hub.y; LD.Debug.place('conveyor_wood', 0, hub.x + 3, hub.y + 1); LD.Debug.place('stone_furnace', 0, x, y + 1); LD.Debug.place('steam_engine', 0, hub.x - 3, hub.y); LD.Debug.place('workbench', 0, hub.x + 3, hub.y + 2); LD.Debug.ff(120); }); await page.waitForTimeout(500); }],
  ['screens', async () => { await page.screenshot({ path: path.join(out, '02_game.png') }); await page.keyboard.press('e'); await page.waitForTimeout(400); await page.screenshot({ path: path.join(out, '03_encyclopedia.png') }); await page.keyboard.press('Escape'); await page.waitForTimeout(200); await page.keyboard.press('Escape'); await page.waitForTimeout(400); await page.screenshot({ path: path.join(out, '04_pause.png') }); await page.keyboard.press('Escape'); await page.waitForTimeout(200); await page.keyboard.press('b'); await page.waitForTimeout(400); await page.screenshot({ path: path.join(out, '05_build.png') }); }],
  ['save/load', async () => { const ok = await page.evaluate(() => { LD.State.save('1'); const G1 = LD.State.load('1'); return !!G1 && Object.keys(G1.structures).length > 0; }); if (!ok) errors.push('save/load roundtrip failed'); }],
  ['layers', async () => { await page.evaluate(() => { for (let i = 1; i < 5; i++) LD.Debug.unlockLayer(i); LD.Main.switchLayer(1); }); await page.waitForTimeout(500); await page.screenshot({ path: path.join(out, '06_layer1.png') }); await page.evaluate(() => LD.Main.switchLayer(4)); await page.waitForTimeout(500); await page.screenshot({ path: path.join(out, '07_layer4.png') }); await page.evaluate(() => LD.Main.switchLayer(0)); }],
  ['wave', async () => { await page.evaluate(() => { LD.Debug.spawnWave(0); LD.Debug.ff(20); }); await page.waitForTimeout(600); await page.screenshot({ path: path.join(out, '08_wave.png') }); }],
  ['long ff', async () => { const t0 = Date.now(); await page.evaluate(() => LD.Debug.ff(3600)); logs.push('ff 3600 took ' + (Date.now() - t0) + ' ms'); }]
];
for (const [name, fn] of steps) { try { await fn(); logs.push('step ok: ' + name); } catch (e) { errors.push('step ' + name + ': ' + e.message); } }
const st = await page.evaluate(() => LD.Debug ? LD.Debug.state() : null).catch(() => null);
fs.writeFileSync(path.join(out, 'log.txt'), logs.join('\n') + '\n\nSTATE: ' + JSON.stringify(st, null, 1));
console.log(logs.filter(l => l.startsWith('step') || l.startsWith('ff')).join('\n'));
console.log(errors.length ? 'ERRORS:\n' + errors.map(e => ' - ' + e).join('\n') : 'no console errors');
await browser.close();
process.exit(errors.length ? 1 : 0);
