// Renders the menu music as a spectrogram + waveform image (tools/out/spec_<track>.png) using a smooth sheet clock.
// node tools/musicspec.mjs [track=kdz|pulse] [seconds=42] [startCycle=0]
import { chromium } from 'playwright';
import fs from 'node:fs';
const TRACK = process.argv[2] || 'kdz', SECS = +(process.argv[3] || 42), START = +(process.argv[4] || 0);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
await p.goto('file://' + process.cwd() + '/dist/index.html');
await p.waitForFunction(() => window.LD && LD.Main && LD.Main.ready, null, { timeout: 60000 });
await p.evaluate(([track, start]) => { LD.Settings.set({ menuTrack: track }); LD.Music._cycleOffset = start; const K = LD.Main.kdz; K.rawTime = () => (LD.Audio.ctx ? LD.Audio.ctx.currentTime : 0) % 20; K.running = () => true; }, [TRACK, START]);
await p.mouse.click(300, 300);
await p.waitForFunction(() => LD.Music.playing && LD.Music.mode === 'menu', null, { timeout: 10000 });
await p.evaluate(secs => {
  const ctx = LD.Audio.ctx, an = ctx.createAnalyser(); an.fftSize = 2048; an.smoothingTimeConstant = 0; LD.Audio.busses.music.connect(an);
  const fbuf = new Float32Array(an.frequencyBinCount), tbuf = new Float32Array(an.fftSize);
  window.__spec = { cols: [], wave: [], t0: ctx.currentTime, kit: LD.Music._kit ? LD.Music._kit() : null };
  const iv = setInterval(() => { an.getFloatFrequencyData(fbuf); an.getFloatTimeDomainData(tbuf); let pk = 0, sq = 0; for (let i = 0; i < tbuf.length; i++) { const a = Math.abs(tbuf[i]); if (a > pk) pk = a; sq += tbuf[i] * tbuf[i]; } window.__spec.cols.push([ctx.currentTime, Array.from(fbuf)]); window.__spec.wave.push([ctx.currentTime, pk, Math.sqrt(sq / tbuf.length), LD.Main.kdz.rawTime(), Array.from(tbuf.subarray(0, 1102))]); if (ctx.currentTime - window.__spec.t0 > secs) clearInterval(iv); }, 25);
}, SECS);
await p.waitForTimeout((SECS + 1) * 1000);
await p.evaluate(() => {
  const S = window.__spec, W = 1900, H = 1040, cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.id = 'specc'; cv.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(cv);
  const c = cv.getContext('2d'); c.fillStyle = '#0c0c0d'; c.fillRect(0, 0, W, H);
  const cols = S.cols, n = cols.length, sr = LD.Audio.ctx.sampleRate, bins = cols[0][1].length, fMax = sr / 2, specH = 700, top = 30, x0 = 60, w = W - x0 - 20;
  const fLo = 30, fHi = 16000, yOf = f => top + specH - specH * (Math.log(f / fLo) / Math.log(fHi / fLo));
  const img = c.createImageData(w, specH), d = img.data;
  for (let x = 0; x < w; x++) { const col = cols[Math.floor(x * n / w)][1]; for (let y = 0; y < specH; y++) { const f = fLo * Math.pow(fHi / fLo, 1 - y / specH), bin = Math.min(bins - 1, Math.round(f / fMax * bins)); const db = col[bin]; const v = Math.max(0, Math.min(1, (db + 95) / 75)); const i = (y * w + x) * 4; d[i] = Math.round(236 * Math.pow(v, 1.4)); d[i + 1] = Math.round(231 * Math.pow(v, 1.8)); d[i + 2] = Math.round(220 * Math.pow(v, 2.6) + 20 * v); d[i + 3] = 255; } }
  c.putImageData(img, x0, top);
  c.font = '12px monospace'; c.fillStyle = '#8f8b82'; c.textAlign = 'right';
  for (const f of [50, 100, 200, 500, 1000, 2000, 5000, 10000]) { const y = yOf(f); c.fillText(f >= 1000 ? f / 1000 + 'k' : f, x0 - 6, y + 4); c.fillStyle = 'rgba(232,64,28,.25)'; c.fillRect(x0, y, w, 1); c.fillStyle = '#8f8b82'; }
  // sheet cue lines
  const cues = LD.Main.kdz.cues, t0 = cols[0][0], t1 = cols[n - 1][0], xOf = t => x0 + w * (t - t0) / (t1 - t0);
  c.textAlign = 'left';
  for (let i = 0; i < S.wave.length - 1; i++) { const [ta, , , ua] = S.wave[i], [, , , ub] = S.wave[i + 1]; if (ub < ua - 10) { const x = xOf(ta); c.fillStyle = 'rgba(232,64,28,.9)'; c.fillRect(x, top, 2, specH); c.fillText('lead/impact', x + 4, top + 14); } }
  for (const [name, u] of [['act2', cues.act2], ['act3', cues.act3], ['act4', cues.act4], ['exit', cues.exit]]) for (let i = 0; i < S.wave.length - 1; i++) { const [ta, , , ua] = S.wave[i], [, , , ub] = S.wave[i + 1]; if (ua < u && ub >= u) { const x = xOf(ta); c.fillStyle = 'rgba(122,166,201,.7)'; c.fillRect(x, top, 1, specH); c.fillStyle = '#7aa6c9'; c.fillText(name, x + 3, top + specH - 6); } }
  // waveform envelope (peak + rms)
  const wy = top + specH + 40, wh = 230; c.fillStyle = '#141416'; c.fillRect(x0, wy, w, wh);
  const db = v => 20 * Math.log10(Math.max(1e-5, v)), yDb = v => wy + wh - wh * Math.max(0, Math.min(1, (db(v) + 60) / 60));
  for (const [dbv, lbl] of [[-6, '−6'], [-12, '−12'], [-18, '−18'], [-24, '−24'], [-36, '−36']]) { const y = wy + wh - wh * ((dbv + 60) / 60); c.fillStyle = 'rgba(236,231,220,.12)'; c.fillRect(x0, y, w, 1); c.fillStyle = '#8f8b82'; c.textAlign = 'right'; c.fillText(lbl, x0 - 6, y + 4); }
  c.textAlign = 'left';
  const wv = S.wave, m = wv.length;
  c.fillStyle = 'rgba(236,231,220,.35)'; for (let i = 0; i < m; i++) { const x = xOf(wv[i][0]); c.fillRect(x, yDb(wv[i][1]), Math.max(1, w / m), wy + wh - yDb(wv[i][1])); }
  c.fillStyle = '#e8401c'; for (let i = 0; i < m; i++) { const x = xOf(wv[i][0]); c.fillRect(x, yDb(wv[i][2]), Math.max(1, w / m), 2); }
  // waveform detail: 2 s starting at sheet u = 5 (act II) of the second cycle seen
  let di = -1, seen = 0; for (let i = 1; i < m; i++) { if (wv[i][3] < wv[i - 1][3] - 10) seen++; if (seen === 1 && wv[i][3] >= 5 && di < 0) di = i; }
  if (di < 0) di = Math.floor(m / 2);
  const dy = wy + wh + 30, dh = 0; 
  c.fillStyle = '#ece7dc'; c.font = '13px monospace'; c.fillText('peak (grey) / RMS (red) dBFS at music bus · ' + (t1 - t0).toFixed(1) + ' s · kit ' + JSON.stringify(S.kit), x0, wy + wh + 18);
});
await p.evaluate(() => {
  // contiguous 3 s recording (ScriptProcessor) starting now, plus the kit waveforms
  const ctx = LD.Audio.ctx, sp = ctx.createScriptProcessor(4096, 2, 2), chunks = [], want = Math.ceil(ctx.sampleRate * 3);
  let got = 0; window.__rec = { chunks, done: false, u0: LD.Main.kdz.rawTime() };
  sp.onaudioprocess = ev => { if (got >= want) return; const d = ev.inputBuffer.getChannelData(0); chunks.push(Array.from(d)); got += d.length; if (got >= want) { window.__rec.done = true; try { sp.disconnect(); } catch (_) {} } };
  LD.Audio.busses.music.connect(sp); sp.connect(ctx.destination);
});
await p.waitForFunction(() => window.__rec && window.__rec.done, null, { timeout: 15000 });
await p.evaluate(() => {
  const R = window.__rec, samples = [].concat(...R.chunks), sr = LD.Audio.ctx.sampleRate, W = 1900, H = 720, cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.id = 'specd'; cv.style.cssText = 'position:fixed;left:0;top:0;z-index:100000'; document.body.appendChild(cv);
  const c = cv.getContext('2d'); c.fillStyle = '#0c0c0d'; c.fillRect(0, 0, W, H);
  const x0 = 60, w = W - 80, ph = 300, mid = 20 + ph / 2, amp = ph / 2;
  c.fillStyle = '#141416'; c.fillRect(x0, 20, w, ph); c.fillStyle = 'rgba(236,231,220,.15)'; c.fillRect(x0, mid, w, 1);
  let pk = 0, sq = 0; for (const v of samples) { const a = Math.abs(v); if (a > pk) pk = a; sq += v * v; } const rms = Math.sqrt(sq / samples.length);
  c.strokeStyle = '#ece7dc'; c.lineWidth = 1; c.beginPath();
  for (let x = 0; x < w; x++) { const i0 = Math.floor(x * samples.length / w), i1 = Math.floor((x + 1) * samples.length / w); let lo = 1, hi = -1; for (let i = i0; i < i1; i++) { if (samples[i] < lo) lo = samples[i]; if (samples[i] > hi) hi = samples[i]; } if (hi < lo) continue; c.moveTo(x0 + x, mid - hi * amp * 3); c.lineTo(x0 + x, mid - lo * amp * 3 + 0.5); }
  c.stroke();
  const secs = samples.length / sr; for (let k = 0; k * 0.45 < secs; k++) { const x = x0 + w * (k * 0.45) / secs; c.fillStyle = 'rgba(232,64,28,.5)'; c.fillRect(x, 20, 1, ph); }
  c.fillStyle = '#8f8b82'; c.font = '12px monospace'; c.fillText('contiguous ' + secs.toFixed(2) + ' s from sheet u=' + R.u0.toFixed(2) + ' · ×3 · peak ' + (20 * Math.log10(pk)).toFixed(1) + ' dBFS · rms ' + (20 * Math.log10(rms)).toFixed(1) + ' dBFS · crest ' + (20 * Math.log10(pk / rms)).toFixed(1) + ' dB · red ticks every 0.45 s from the recording start (not beat-aligned)', x0, 20 + ph + 16);
  // kit waveforms
  const names = ['kick', 'clap', 'hatC', 'hatO', 'rim', 'snare', 'crash', 'boom'], kw = (w - 7 * 12) / 8, ky = 20 + ph + 40, kh = H - ky - 30;
  names.forEach((n, i) => { const d = LD.Music._kitData(n), kx = x0 + i * (kw + 12); c.fillStyle = '#141416'; c.fillRect(kx, ky, kw, kh); if (!d) return; const m = ky + kh / 2; c.strokeStyle = '#ece7dc'; c.beginPath(); for (let x = 0; x < kw; x++) { const i0 = Math.floor(x * d.length / kw), i1 = Math.floor((x + 1) * d.length / kw); let lo = 1, hi = -1; for (let j = i0; j < i1; j++) { if (d[j] < lo) lo = d[j]; if (d[j] > hi) hi = d[j]; } if (hi < lo) continue; c.moveTo(kx + x, m - hi * kh / 2); c.lineTo(kx + x, m - lo * kh / 2 + 0.5); } c.stroke(); c.fillStyle = '#8f8b82'; c.fillText(n + ' ' + (d.length / LD.Audio.ctx.sampleRate).toFixed(2) + ' s', kx + 4, ky + kh + 14); });
});
fs.mkdirSync('tools/out', { recursive: true });
await p.locator('#specd').screenshot({ path: 'tools/out/specd_' + TRACK + '.png' });
await p.evaluate(() => document.getElementById('specd').remove());
await p.locator('#specc').screenshot({ path: 'tools/out/spec_' + TRACK + '.png' });
const kit = await p.evaluate(() => ({ kit: LD.Music._kit && LD.Music._kit(), state: LD.Music._state(), seq: LD.Music._seq() }));
await b.close();
console.log('kit', JSON.stringify(kit));
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
