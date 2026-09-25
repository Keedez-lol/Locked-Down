// Peak/RMS at the menu mix's clipper input (post PRE), clipper output and the music bus, per act. node tools/musiclevels.mjs [seconds] [rate]
import { chromium } from 'playwright';
const SECS = +(process.argv[2] || 42), RATE = +(process.argv[3] || 1);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
await p.goto('file://' + process.cwd() + '/dist/index.html');
await p.waitForFunction(() => window.LD && LD.Main && LD.Main.ready, null, { timeout: 60000 });
await p.evaluate(rate => { const K = LD.Main.kdz; K.rawTime = () => (LD.Audio.ctx ? LD.Audio.ctx.currentTime * rate : 0) % 20; K.running = () => true; }, RATE);
await p.mouse.click(300, 300);
await p.waitForFunction(() => LD.Music.playing && LD.Music.mode === 'menu', null, { timeout: 10000 });
await p.evaluate(() => {
  const ctx = LD.Audio.ctx, e = LD.Music._env();
  const taps = { pre: e.sum, clip: e.clip, bus: LD.Audio.busses.music };
  window.__lv = { rows: [], an: {} };
  for (const k in taps) { const an = ctx.createAnalyser(); an.fftSize = 2048; taps[k].connect(an); window.__lv.an[k] = [an, new Float32Array(an.fftSize)]; }
  setInterval(() => {
    const row = [ctx.currentTime, LD.Main.kdz.rawTime()];
    for (const k in window.__lv.an) { const [an, buf] = window.__lv.an[k]; an.getFloatTimeDomainData(buf); let pk = 0, sq = 0; for (let i = 0; i < buf.length; i++) { const a = Math.abs(buf[i]); if (a > pk) pk = a; sq += buf[i] * buf[i]; } row.push(pk, Math.sqrt(sq / buf.length)); }
    window.__lv.rows.push(row);
  }, 40);
});
await p.waitForTimeout(SECS * 1000);
const rows = await p.evaluate(() => window.__lv.rows);
await b.close();
const db = v => (20 * Math.log10(Math.max(1e-6, v))).toFixed(1);
const actOf = u => u < 3.2 ? 'I' : u < 9.8 ? 'II' : u < 15.2 ? 'III' : u < 19.1 ? 'IV' : 'exit';
const acc = {};
for (const r of rows.slice(25)) { const a = actOf(r[1]); const o = acc[a] = acc[a] || { pre: [0, []], clip: [0, []], bus: [0, []] }; [['pre', 2], ['clip', 4], ['bus', 6]].forEach(([k, i]) => { if (r[i] > o[k][0]) o[k][0] = r[i]; o[k][1].push(r[i + 1]); }); }
for (const a of ['I', 'II', 'III', 'IV', 'exit']) { const o = acc[a]; if (!o) continue; const line = ['pre', 'clip', 'bus'].map(k => { const v = o[k][1].sort((x, y) => x - y); return k + ' peak ' + o[k][0].toFixed(2) + ' (' + db(o[k][0]) + ') rms ' + db(v[v.length >> 1]); }); console.log('act ' + a.padEnd(4) + ' · ' + line.join(' · ')); }
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
