(() => {
'use strict';
const LD = window.LD;
const handlers = new Map();
LD.Events = {
  on(name, fn) {
    if (!handlers.has(name)) handlers.set(name, new Set());
    handlers.get(name).add(fn);
    return () => LD.Events.off(name, fn);
  },
  once(name, fn) { const off = LD.Events.on(name, p => { off(); fn(p); }); return off; },
  off(name, fn) { const s = handlers.get(name); if (s) s.delete(fn); },
  emit(name, payload) {
    const s = handlers.get(name);
    if (!s) return;
    for (const fn of Array.from(s)) { try { fn(payload); } catch (err) { console.error('[LD.Events] handler for "' + name + '" failed:', err); } }
  },
  clear(name) { if (name) handlers.delete(name); else handlers.clear(); }
};
})();
