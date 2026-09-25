(() => {
'use strict';
const LD = window.LD, U = LD.U, E = LD.Events;
const DT = 0.1, MAX_STEPS = 50;
const Main = LD.Main = {
  ready: false, screen: 'boot', overlays: [], raf: 0, last: 0, acc: 0, t: 0, kdz: null, autosaveAcc: 0, dirty: false,
  keys: new Set(), fps: 0, _fpsAcc: 0, _fpsN: 0,

  async boot() {
    const $ = id => document.getElementById(id);
    LD.Stage.init($('stage'));
    LD.Settings.load();
    LD.Registry.init();
    const bar = document.querySelector('#boot .boot-bar i'), status = $('boot-status');
    const progress = (p, label) => { if (bar) bar.style.width = Math.round(U.clamp(p) * 100) + '%'; if (status && label) status.textContent = label; };
    try { await LD.Tex.init(progress); } catch (err) { console.error('[Main] texture init failed', err); }
    progress(1, 'LISTO');
    LD.UI.Menu && LD.UI.Menu.init($('menu-root'));
    LD.Render.init($('world'), $('fx'));
    Main.bindGlobalInput();
    E.on('toast', p => LD.UI.toast(p.text, p.kind));
    E.on('settings:changed', s => { LD.Audio.setVolumes({ master: s.volMaster, music: s.volMusic, sfx: s.volSfx, ambient: s.volAmbient }); if (Main.kdz) Main.kdz.setReducedMotion(!!s.reducedMotion); LD.Tex.quality = s.texture; if (LD.Render.showRanges) LD.Render.showRanges(!!s.ranges); if (LD.Particles && LD.Particles.setQuality) LD.Particles.setQuality(s.particles); });
    const s = LD.Settings.get();
    LD.Audio.setVolumes({ master: s.volMaster, music: s.volMusic, sfx: s.volSfx, ambient: s.volAmbient });
    $('boot').hidden = true;
    Main.ready = true;
    Main.showMenu();
  },

  /* ── screens ── */
  showMenu() {
    Main.screen = 'menu';
    document.getElementById('screen-game').hidden = true;
    document.getElementById('screen-menu').hidden = false;
    if (!Main.kdz) Main.kdz = LD.KDZ.init({ canvas: document.getElementById('kdz'), hint: document.getElementById('hint'), fallback: document.getElementById('fallback') });
    Main.kdz.setReducedMotion(!!LD.Settings.get().reducedMotion);
    Main.kdz.start();
    LD.Stage.setBackdrop('paper');
    LD.UI.Menu.show();
    if (LD.Audio.unlocked) LD.Music.menu();
    E.emit('screen:changed', 'menu');
  },

  startNewGame(opts) {
    const G = LD.State.newGame(opts);
    LD.Sim.init(G, { fresh: true });
    Main.enterGame();
    LD.State.log('Nueva colonia fundada: ' + G.meta.name, 'ok');
    return G;
  },

  continueGame(slot = 'auto') {
    const G = LD.State.load(slot);
    if (!G) { if (!LD.State.lastError) LD.UI.toast('No hay partida en esa ranura', 'bad'); return null; }
    LD.Sim.init(G, { fresh: false });
    Main.enterGame();
    const elapsed = G.meta.lastSave ? (Date.now() - G.meta.lastSave) / 1000 : 0;
    if (elapsed > 120) LD.UI.toast('Has estado fuera ' + U.fmtTime(elapsed) + '. La colonia estaba detenida.', 'info', 4000);
    return G;
  },

  enterGame() {
    Main.screen = 'game';
    LD.UI.Menu.hide();
    if (Main.kdz) Main.kdz.stop();
    LD.Music.stop(1.2);
    LD.Stage.setBackdrop('ink');
    document.getElementById('screen-menu').hidden = true;
    document.getElementById('screen-game').hidden = false;
    Main.closeAllOverlays();
    LD.UI.HUD.mount(document.getElementById('hud-root'));
    Main.switchLayer(LD.G.view.layer || 0, true);
    if (LD.Audio.unlocked) LD.Music.layer(LD.G.view.layer || 0);
    if (LD.Settings.get().tutorial && !LD.G.tutorial.done) LD.UI.Tutorial.start();
    Main.dirty = false; Main.autosaveAcc = 0; Main.acc = 0; Main.last = 0;
    if (!Main.raf) Main.raf = requestAnimationFrame(Main.loop);
    E.emit('screen:changed', 'game');
  },

  toMenu() {
    if (Main.screen !== 'game') return;
    Main.closeAllOverlays();
    if (Main.raf) { cancelAnimationFrame(Main.raf); Main.raf = 0; }
    LD.UI.HUD.unmount();
    LD.Audio.stopAll();
    if (LD.UI.clearToasts) LD.UI.clearToasts();
    Main.keys.clear();
    Main.dirty = false;
    LD.G = null;
    Main.showMenu();
  },

  save(slot = 'auto') { const ok = LD.State.save(slot); if (ok) { Main.dirty = false; LD.Audio.play('save'); LD.UI.toast('Partida guardada' + (slot === 'auto' ? ' (auto)' : ' en ranura ' + slot), 'ok'); } return ok; },
  unsavedChanges() { return Main.dirty; },

  switchLayer(idx, silent) {
    const G = LD.G; if (!G) return;
    idx = U.clamp(idx | 0, 0, 4);
    if (!G.layers[idx].unlocked) { if (!silent) LD.UI.toast('Capa bloqueada: construye el pozo correspondiente', 'warn'); return; }
    const prev = G.view.layer;
    G.view.layer = idx;
    LD.Render.setSelection(null);
    if (!silent && prev !== idx) { LD.Audio.play('layer_switch'); if (LD.Audio.unlocked) LD.Music.layer(idx); }
    E.emit('layer:changed', idx);
  },

  /* ── overlay stack (Esc closes topmost) ── */
  pushOverlay(o) { Main.overlays.push(o); return o; },
  popOverlay() { const o = Main.overlays.pop(); if (o && o.close) o.close(true); return o; },
  removeOverlay(o) { const i = Main.overlays.indexOf(o); if (i >= 0) Main.overlays.splice(i, 1); },
  overlayDepth() { return Main.overlays.length; },
  closeAllOverlays() { while (Main.overlays.length) Main.popOverlay(); },

  /* ── loop ── */
  loop(now) {
    if (Main.screen !== 'game' || !LD.G) { Main.raf = 0; return; }
    Main.raf = requestAnimationFrame(Main.loop);
    const dtReal = Main.last ? Math.min(0.25, (now - Main.last) / 1000) : 1 / 60;
    Main.last = now;
    Main._fpsAcc += dtReal; Main._fpsN++; if (Main._fpsAcc >= 0.5) { Main.fps = Main._fpsN / Main._fpsAcc; Main._fpsAcc = 0; Main._fpsN = 0; }
    const G = LD.G;
    G.meta.playtime += dtReal;
    if (!LD.Sim.paused) {
      Main.acc += dtReal * (LD.Sim.speed || 1);
      let steps = 0;
      while (Main.acc >= DT && steps < MAX_STEPS) { LD.Sim.tick(DT); Main.acc -= DT; steps++; }
      if (steps >= MAX_STEPS) Main.acc = 0;
    }
    Main.t += dtReal;
    LD.Render.frame(dtReal, Main.t);
    LD.Audio.update(dtReal);
    LD.UI.HUD.update(dtReal);
    const s = LD.Settings.get();
    if (s.autosave > 0) { Main.autosaveAcc += dtReal; if (Main.autosaveAcc >= s.autosave * 60) { Main.autosaveAcc = 0; if (LD.State.save('auto')) Main.dirty = false; } }
  },

  /* ── input ── */
  bindGlobalInput() {
    const unlockAudio = () => { LD.Audio.init(); if (LD.Audio.unlocked && !LD.Music.playing) { if (Main.screen === 'menu') LD.Music.menu(); else if (Main.screen === 'game' && LD.G) LD.Music.layer(LD.G.view.layer || 0); } };
    addEventListener('pointerdown', unlockAudio, { passive: true });
    addEventListener('keydown', unlockAudio, { passive: true });
    addEventListener('keydown', e => {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      Main.keys.add(e.code);
      if (e.code === 'Escape') {
        e.preventDefault();
        if (Main.overlays.length) { Main.popOverlay(); LD.Audio.play('ui_close'); return; }
        if (Main.screen === 'game') { if (LD.UI.Build.mode && LD.UI.Build.mode !== 'normal') { LD.UI.Build.cancel(); return; } LD.UI.Pause.toggle(); }
        return;
      }
      if (Main.screen !== 'game') return;
      if (e.ctrlKey || e.metaKey) { if (e.code === 'KeyS') { e.preventDefault(); Main.save('auto'); } return; }
      if (Main.overlays.length) return;
      switch (e.code) {
        case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': case 'Digit5': Main.switchLayer(+e.code.slice(5) - 1); break;
        case 'KeyB': LD.UI.Build.toggle(); break;
        case 'KeyE': LD.UI.Encyclopedia.toggle(); break;
        case 'KeyT': LD.UI.Encyclopedia.toggle('techs'); break;
        case 'KeyR': if (LD.UI.Build.mode === 'build' || LD.UI.Build.mode === 'paste') LD.UI.Build.rotate(); else LD.UI.Encyclopedia.toggle('techs'); break;
        case 'KeyX': LD.UI.Build.setMode(LD.UI.Build.mode === 'dismantle' ? 'normal' : 'dismantle'); break;
        case 'KeyH': LD.UI.Build.setMode(LD.UI.Build.mode === 'hand' ? 'normal' : 'hand'); break;
        case 'KeyC': LD.UI.Build.setMode(LD.UI.Build.mode === 'select' ? 'normal' : 'select'); break;
        case 'KeyV': LD.UI.Build.pasteLast && LD.UI.Build.pasteLast(); break;
        case 'KeyG': LD.UI.Stats.toggle(); break;
        case 'Space': e.preventDefault(); LD.Sim.setPaused(!LD.Sim.paused); LD.UI.toast(LD.Sim.paused ? 'Simulación en pausa' : 'Simulación reanudada', 'info', 1200); break;
        case 'F3': e.preventDefault(); LD.Settings.set({ showFps: !LD.Settings.get().showFps }); break;
        default: break;
      }
    });
    addEventListener('keyup', e => Main.keys.delete(e.code));
    addEventListener('blur', () => Main.keys.clear());
    addEventListener('beforeunload', () => { if (Main.screen === 'game' && LD.G) LD.State.save('auto'); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && Main.screen === 'game' && LD.G) LD.State.save('auto'); });
    E.on('structure:placed', () => { Main.dirty = true; });
    E.on('structure:removed', () => { Main.dirty = true; });
    E.on('tech:researched', () => { Main.dirty = true; });
  }
};
addEventListener('DOMContentLoaded', () => { Main.boot().catch(err => { console.error('[Main] boot failed', err); const s = document.getElementById('boot-status'); if (s) s.textContent = 'ERROR DE ARRANQUE: ' + err.message; }); });
})();
