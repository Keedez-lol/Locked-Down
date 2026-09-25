// Menu music: level, event trace and phase lock against the KDZ sheet clock. node tools/musictest.mjs [seconds]
import { chromium } from 'playwright';
const SECS = +(process.argv[2] || 46);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
await p.goto('file://' + process.cwd() + '/dist/index.html');
await p.waitForFunction(() => window.LD && LD.Main && LD.Main.ready, null, { timeout: 60000 });
await p.mouse.click(300, 300);
await p.waitForFunction(() => LD.Music.playing && LD.Music.mode === 'menu', null, { timeout: 10000 });
await p.evaluate(() => {
  const ctx = LD.Audio.ctx, an = ctx.createAnalyser(); an.fftSize = 2048;
  LD.Audio.busses.music.connect(an);
  const buf = new Float32Array(an.fftSize);
  window.__probe = { levels: [], clock: [], an };
  LD.Music._trace = [];
  setInterval(() => { an.getFloatTimeDomainData(buf); let pk = 0, sq = 0; for (let i = 0; i < buf.length; i++) { const a = Math.abs(buf[i]); if (a > pk) pk = a; sq += buf[i] * buf[i]; } window.__probe.levels.push([ctx.currentTime, pk, Math.sqrt(sq / buf.length), LD.Main.kdz ? LD.Main.kdz.rawTime() : -1]); }, 50);
  const tick = () => { if (LD.Main.kdz) window.__probe.clock.push([ctx.currentTime, LD.Main.kdz.rawTime()]); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
});
await p.waitForTimeout(SECS * 1000);
const r = await p.evaluate(() => ({ levels: window.__probe.levels, clock: window.__probe.clock, trace: LD.Music._trace, seq: LD.Music._seq(), state: LD.Music._state(), ctxRate: LD.Audio.ctx.sampleRate }));
// fallback clock: freeze the sheet and check the music keeps going from an internal clock
const fb = await p.evaluate(async () => {
  const K = LD.Main.kdz; K.seek(5);
  const n0 = LD.Music._trace.length;
  await new Promise(r => setTimeout(r, 2500));
  const s = LD.Music._seq(), n1 = LD.Music._trace.length;
  K.seek(null);
  await new Promise(r => setTimeout(r, 1500));
  return { source: s.source, eventsWhileFrozen: n1 - n0, resumed: LD.Music._seq() };
});
await b.close();

const db = v => (20 * Math.log10(Math.max(1e-6, v))).toFixed(1);
const L = r.levels, dur = L[L.length - 1][0] - L[0][0];
const sheetPerSec = (() => { const c = r.clock; let adv = 0; for (let i = 1; i < c.length; i++) { let d = c[i][1] - c[i - 1][1]; if (d < -10) d += 20; adv += d; } return adv / (c[c.length - 1][0] - c[0][0]); })();
let pk = 0; const rmsAll = []; for (const [, a, rms] of L) { if (a > pk) pk = a; rmsAll.push(rms); }
rmsAll.sort((a, b) => a - b);
const byAct = {}; for (const [, a, rms, u] of L) { const act = u < 3.2 ? 'I' : u < 9.8 ? 'II' : u < 15.2 ? 'III' : u < 19.1 ? 'IV' : 'exit'; (byAct[act] = byAct[act] || []).push(rms); }
console.log('duration ' + dur.toFixed(1) + ' s · sheet speed ' + sheetPerSec.toFixed(3) + ' s/s · peak ' + db(pk) + ' dBFS · RMS median ' + db(rmsAll[rmsAll.length >> 1]) + ' dBFS · RMS p95 ' + db(rmsAll[Math.floor(rmsAll.length * 0.95)]) + ' dBFS');
for (const k in byAct) { const v = byAct[k].sort((a, b) => a - b); console.log('  act ' + k.padEnd(4) + ' RMS median ' + db(v[v.length >> 1]) + ' dBFS · p90 ' + db(v[Math.floor(v.length * 0.9)])); }
// phase lock: predicted sheet time of each event from the rAF clock samples
const C = r.clock; let worst = 0, sum = 0, n = 0, late = 0, ci = 0;
for (const ev of r.trace) {
  while (ci < C.length - 1 && C[ci + 1][0] < ev.at) ci++;
  if (ci >= C.length - 1 || C[ci][0] > ev.at) continue;
  const [t0, u0] = C[ci], [t1, u1] = C[ci + 1]; let du = u1 - u0; if (du < -10) du += 20;
  if (t1 - t0 > 0.25) continue;
  const uAt = (u0 + du * (ev.at - t0) / (t1 - t0)) % 20;
  let err = uAt - ev.u; if (err > 10) err -= 20; if (err < -10) err += 20;
  const a = Math.abs(err); if (a > worst) worst = a; sum += a; n++; if (a > 0.03) late++;
}
console.log('phase lock over ' + n + ' events: mean |err| ' + (1000 * sum / n).toFixed(1) + ' ms · worst ' + (1000 * worst).toFixed(1) + ' ms · >30 ms: ' + late);
const kinds = {}; for (const ev of r.trace) kinds[ev.kind] = (kinds[ev.kind] || 0) + 1;
console.log('events ' + r.trace.length + ' ' + JSON.stringify(kinds) + ' · cycles seen ' + r.seq.cyc + ' · source ' + r.seq.source);
const lead = r.trace.filter(e => e.k === 88).map(e => 'c' + e.c + '@' + e.at.toFixed(2)); console.log('impacts: ' + lead.join(' '));
console.log('freeze test: source=' + fb.source + ' events while frozen=' + fb.eventsWhileFrozen + ' resumed=' + JSON.stringify(fb.resumed));
console.log('tracks ' + JSON.stringify(r.state));
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
