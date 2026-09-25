// Scheduler accuracy with a smooth sheet clock driven by the audio clock (rate = sheet seconds per audio second).
import { chromium } from 'playwright';
const RATE = +(process.argv[2] || 1), SECS = +(process.argv[3] || 30);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
await p.goto('file://' + process.cwd() + '/dist/index.html');
await p.waitForFunction(() => window.LD && LD.Main && LD.Main.ready, null, { timeout: 60000 });
await p.evaluate(rate => { const K = LD.Main.kdz; K.rawTime = () => (LD.Audio.ctx ? LD.Audio.ctx.currentTime * rate : 0) % 20; K.running = () => true; }, RATE);
await p.mouse.click(300, 300);
await p.waitForFunction(() => LD.Music.playing && LD.Music.mode === 'menu', null, { timeout: 10000 });
await p.evaluate(() => { LD.Music._trace = []; });
await p.waitForTimeout(SECS * 1000);
const r = await p.evaluate(() => ({ trace: LD.Music._trace, seq: LD.Music._seq() }));
await b.close();
let worst = 0, sum = 0, n = 0, bad = 0, first = null; const kinds = {};
for (const ev of r.trace) {
  let err = ((ev.at * RATE) % 20) - ev.u; if (err > 10) err -= 20; if (err < -10) err += 20;
  const a = Math.abs(err); if (a > worst) { worst = a; first = ev; } sum += a; n++; if (a > 0.01) bad++;
  kinds[ev.kind] = (kinds[ev.kind] || 0) + 1;
}
// duplicates: same (cycle, u) fired twice
const seen = new Set(); let dup = 0; for (const ev of r.trace) { const key = ev.u + '@' + Math.floor(ev.at * RATE / 20); if (seen.has(key)) dup++; seen.add(key); }
console.log('rate ' + RATE + ' · ' + n + ' events · mean |err| ' + (1000 * sum / n).toFixed(2) + ' ms · worst ' + (1000 * worst).toFixed(1) + ' ms (' + JSON.stringify(first) + ') · >10 ms: ' + bad + ' · duplicates: ' + dup);
console.log('seq ' + JSON.stringify(r.seq) + ' kinds ' + JSON.stringify(kinds));
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
