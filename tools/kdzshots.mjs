import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1120, height: 1120 } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('file://' + process.cwd() + '/tools/out/kdztest.html');
await p.waitForTimeout(1500);
const times = process.argv.slice(2).map(Number);
for (const t of (times.length ? times : [1.0, 2.6, 4.2, 6.6, 8.9, 10.6, 12.4, 13.9, 15.9, 18.6])) {
  await p.evaluate(tt => k.seek(tt), t); await p.waitForTimeout(400);
  await p.screenshot({ path: 'tools/out/kdz_' + t.toFixed(1) + '.png', clip: { x: 20, y: 20, width: 1080, height: 1080 } });
}
console.log('done', errs);
await b.close();
