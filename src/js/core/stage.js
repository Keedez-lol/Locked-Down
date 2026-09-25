(() => {
'use strict';
const LD = window.LD;
const W = 1920, H = 1080;
const Stage = LD.Stage = {
  W, H, el: null, scale: 1, left: 0, top: 0, width: W, height: H, dpr: 1,
  init(el) {
    Stage.el = el || document.getElementById('stage');
    Stage.layout();
    addEventListener('resize', Stage.layout);
    if (window.visualViewport) visualViewport.addEventListener('resize', Stage.layout);
    return Stage;
  },
  layout() {
    const vw = Math.max(1, window.innerWidth), vh = Math.max(1, window.innerHeight);
    const scale = Math.min(vw / W, vh / H);
    const w = Math.floor(W * scale), h = Math.floor(H * scale);
    Stage.scale = scale; Stage.width = w; Stage.height = h;
    Stage.left = Math.floor((vw - w) / 2); Stage.top = Math.floor((vh - h) / 2);
    Stage.dpr = Math.min(2, window.devicePixelRatio || 1);
    const el = Stage.el;
    if (el) { el.style.width = w + 'px'; el.style.height = h + 'px'; el.style.left = Stage.left + 'px'; el.style.top = Stage.top + 'px'; }
    document.documentElement.style.fontSize = (scale * 16) + 'px';
    if (LD.Events) LD.Events.emit('stage:resize', Stage.size());
  },
  setBackdrop(kind) {
    document.body.classList.toggle('backdrop-paper', kind === 'paper');
    document.body.classList.toggle('backdrop-ink', kind !== 'paper');
    if (LD.Tex && LD.Tex.backdrop) { try { document.body.style.backgroundImage = 'url(' + LD.Tex.backdrop(kind) + ')'; } catch (e) { document.body.style.backgroundImage = ''; } }
  },
  size() { return { w: Stage.width, h: Stage.height, scale: Stage.scale, left: Stage.left, top: Stage.top, dpr: Stage.dpr }; },
  toLogical(clientX, clientY) { return { x: (clientX - Stage.left) / Stage.scale, y: (clientY - Stage.top) / Stage.scale }; },
  // Backing store matches the floored CSS box × dpr so the canvas is never resampled by a fractional pixel.
  fitCanvas(canvas) {
    const bw = Math.max(1, Math.round(Stage.width * Stage.dpr)), bh = Math.max(1, Math.round(Stage.height * Stage.dpr));
    if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
    canvas.style.width = '100%'; canvas.style.height = '100%';
    return { bw, bh, k: bw / W };
  }
};
})();
