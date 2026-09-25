# AGENT BRIEF — read first (binding for every module author)

You are one of ~20 engineers building **KDZDUSTRY**, a single-file HTML idle/incremental factory game, in parallel.
Read, in this order: `docs/DECISIONS.md`, `docs/CONTRACT.md`, `docs/CANON.md`, `docs/API.md`, then
`src/js/core/*.js`, `src/js/main.js`, `src/css/00_base.css`, `src/index.body.html`, `build.js`. Only then write.

## Quality bar (the user's words: "no seas conformista; si no parece profesional hay que hacerlo mejor")
- Professional, shippable code. Aesthetics are the top priority (decision 50): matte, technical-drawing identity.
- Depth over stubs: implement the full behaviour in the contract, not a placeholder. If something is impossible
  within your files, implement the closest complete behaviour and report it precisely.
- Performance: 256×192 tiles, thousands of structures, hundreds of enemies must run at 60 fps in Chrome. Cache
  everything renderable, avoid per-frame allocations in hot loops, use typed arrays for grids.
- Robustness: never throw on missing optional data; guard `LD.G` null; tolerate other modules being incomplete
  at load (resolve namespaces at call time).

## Hard rules
- Only touch the files assigned to you. Never edit core files, docs, or other modules. If you need an API that
  another module must provide, use the exact signature in `docs/API.md`; if it is missing there, implement a
  local fallback guarded by `typeof` checks and list it in your report under `apiGaps`.
- No external assets, no CDN, no fonts, no images: everything is drawn or synthesised in code.
- IIFE pattern: `(() => { 'use strict'; const LD = window.LD; ... })();` One file = one namespace as listed.
- Spanish for every user-facing string (UI, names, descriptions). Numbers via `LD.U.fmt/fmtW/fmtTime`.
- CSS: only `rem` units (1rem = 16 logical px on a 1920×1080 stage), `1px` only for hairlines; use the tokens
  in `00_base.css`; no shadows, no gradients except subtle noise/lighting in canvases; no emoji; no rounded blobs.
- Comments: few and useful (a line for a non-obvious algorithm). No banner comments, no narration.
- After writing, syntax-check every file: `node -e "new Function(require('fs').readFileSync('<file>','utf8'))"`.
  Content authors also run `node tools/validate.js` and fix everything that concerns their files.
- Do not commit. Do not create files outside your assignment (scratch files go in /tmp).

## Report (your final message is data, not prose for a human)
Return JSON with: `files` (paths written), `api` (public functions implemented), `apiGaps` (functions you
needed from other modules that API.md lacks, with the signature you assumed), `assumptions`, `knownGaps`,
`notesForIntegrator` (anything main.js/other modules must call or know).
