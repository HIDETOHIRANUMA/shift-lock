// SHIFT LOCK: glyph collision masks and the dot's physics.
// Shared by the game (main.js) and the offline level checker (tools/solve.html).
(function (root) {
  'use strict';
  // Every key has two faces. Shift shows the other one (US layout); letters swap case.
  const PAIRS = ['1!', '2@', '3#', '4$', '5%', '6^', '7&', '8*', '9(', '0)', '-_', '=+', '[{', ']}', ';:', '\'"', ',<', '.>', '/?', '`~', '\\|'];
  const OTHER = {};
  for (const p of PAIRS) { OTHER[p[0]] = p[1]; OTHER[p[1]] = p[0]; }
  const isLower = (ch) => ch >= 'a' && ch <= 'z';
  const isUpper = (ch) => ch >= 'A' && ch <= 'Z';
  const toggles = (ch) => isLower(ch) || isUpper(ch) || Object.prototype.hasOwnProperty.call(OTHER, ch);
  const face = (ch, shifted) => (!shifted || !toggles(ch)) ? ch : isLower(ch) ? ch.toUpperCase() : isUpper(ch) ? ch.toLowerCase() : OTHER[ch];

  const FS = 150;                 // font size = world units per em
  const ADV = FS * 0.6;           // Courier advance width (90)
  const CELL = 2;                 // collision grid resolution in px
  const TOP = FS * 0.95;          // the mask reaches this far above the baseline
  const BOT = FS * 0.45;          // ...and this far below it
  const MARGIN = ADV * 3;         // paper margin left of the first character
  const FONT = '700 ' + FS + 'px "Courier Prime", "Courier New", monospace';
  const PAD = 20;                 // per-cell mask padding (underscores reach into neighbours)

  const P = {
    w: 18, h: 18,                 // the dot's box (a full stop at this size is 23 x 27)
    g: 2400, jumpH: 44, run: 300, acc: 3000, airAcc: 2200, fric: 3600,
    step: 6, airStep: 3, coyote: 0.09, buffer: 0.12, cut: 0.45, lift: 6, carry: 110, maxFall: 1200,
  };
  P.jumpV = Math.sqrt(2 * P.g * P.jumpH);

  // A level: { text, under } — `under` marks overstruck underlines with '_' (they never shift).
  function layout(level) {
    const text = level.text, under = level.under || '';
    const n = Math.max(text.length, under.length);
    const width = Math.ceil(MARGIN * 2 + (n + 1) * ADV);
    const height = Math.ceil(TOP + BOT);
    const base = Math.round(TOP);            // baseline y inside the mask
    const cells = [];
    let seed = 2166136261;
    if (typeof level.seed === 'number') seed = Math.imul(seed ^ level.seed, 16777619);
    else for (let i = 0; i < text.length; i++) seed = Math.imul(seed ^ text.charCodeAt(i), 16777619);
    const rnd = () => { seed = Math.imul(seed ^ (seed >>> 15), 2246822507) ^ Math.imul(seed ^ (seed >>> 13), 3266489909); return ((seed >>> 0) % 10000) / 10000; };
    for (let i = 0; i < n; i++) {
      const ch = text[i] || ' ';
      // a typewriter never strikes two keys exactly alike
      cells.push({ i, x: MARGIN + i * ADV, ch: ch === ' ' ? '' : ch, under: under[i] === '_',
        jx: Math.round((rnd() - 0.5) * 2), jy: Math.round((rnd() - 0.5) * 2), rot: (rnd() - 0.5) * 0.02, ink: 0.86 + rnd() * 0.14 });
    }
    for (const c of cells) {                 // a run of dashes is drawn as one rule
      c.dashL = c.ch === '-' && cells[c.i - 1] && cells[c.i - 1].ch === '-';
      c.dashR = c.ch === '-' && cells[c.i + 1] && cells[c.i + 1].ch === '-';
    }
    const goalX = MARGIN + n * ADV;          // the slot after the last character
    return { level, n, width, height, base, cells, goalX };
  }

  // Draw one cell with the baseline at y = base. part: 'key' | 'under' | undefined (both).
  // Used for collision masks and for the screen, so what you see is what you stand on.
  function drawCell(g, cell, shifted, x, base, part) {
    if (cell.ch && part !== 'under') {
      const f = face(cell.ch, shifted);
      g.save();
      g.translate(x + ADV / 2 + (cell.jx || 0), base + (cell.jy || 0));
      if (cell.rot) g.rotate(cell.rot);
      if (f === '-') {
        const x0 = cell.dashL ? -3 : 12, x1 = cell.dashR ? 93 : 76;
        g.fillRect(x0 - ADV / 2, -51, x1 - x0, 15);
      } else g.fillText(f, -ADV / 2, 0);
      g.restore();
    }
    if (cell.under && part !== 'key') g.fillRect(x - 3, base + 21, 95, 15);   // the underscore's own ink box
  }

  function gridOf(c, w, h) {
    const g = c.getContext('2d', { willReadFrequently: true });
    const img = g.getImageData(0, 0, w, h).data;
    const gw = Math.ceil(w / CELL), gh = Math.ceil(h / CELL);
    const grid = new Uint8Array(gw * gh);
    for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
      const px = Math.min(w - 1, gx * CELL + 1), py = Math.min(h - 1, gy * CELL + 1);
      if (img[(py * w + px) * 4 + 3] > 110) grid[gy * gw + gx] = 1;
    }
    return { grid, gw, gh };
  }
  function prep(g) { g.fillStyle = '#000'; g.font = FONT; g.textBaseline = 'alphabetic'; }

  function build(level, canvasFactory) {
    const L = layout(level);
    const W = L.width, H = L.height;
    const c = canvasFactory(W, H), g = c.getContext('2d', { willReadFrequently: true });
    L.masks = []; L.bridges = [];
    const baseRow = Math.floor(L.base / CELL);
    for (let m = 0; m < 2; m++) {
      // keys only first: their skyline decides where the little dips get bridged
      g.clearRect(0, 0, W, H); prep(g);
      for (const cell of L.cells) drawCell(g, cell, !!m, cell.x, L.base, 'key');
      const keys = gridOf(c, W, H);
      g.clearRect(0, 0, W, H); prep(g);
      for (const cell of L.cells) drawCell(g, cell, !!m, cell.x, L.base);
      const all = gridOf(c, W, H);
      L.bridges.push(bridgesFor(L, keys, baseRow));
      for (const b of L.bridges[m]) for (let r = 0; r < 3; r++) all.grid[(b.row + r) * all.gw + b.gx] = 1;
      L.masks.push(all);
    }
    // Per-cell masks of the shifting face (plus its bridges): who is the dot standing on, and where does it go?
    const cw = ADV + PAD * 2;
    const scratch = canvasFactory(cw, H), sg = scratch.getContext('2d', { willReadFrequently: true });
    for (const cell of L.cells) {
      cell.m = [null, null];
      if (!cell.ch || !toggles(cell.ch)) continue;
      for (let m = 0; m < 2; m++) {
        sg.clearRect(0, 0, cw, H); prep(sg);
        drawCell(sg, cell, !!m, PAD, L.base, 'key');
        const M = gridOf(scratch, cw, H);
        const off = (cell.x - PAD) / CELL;
        for (const b of L.bridges[m]) {
          if (b.gx * CELL < cell.x || b.gx * CELL >= cell.x + ADV) continue;
          for (let r = 0; r < 3; r++) M.grid[(b.row + r) * M.gw + (b.gx - off)] = 1;
        }
        cell.m[m] = M;
      }
    }
    return L;
  }

  // Inside a word, fill dips narrower than ~2 x 60px (the cups of u, v, w, y, H, the notch after an i...)
  // with a thin invisible slab at the lower of the two rims, so the dot never gets stuck in a letter.
  function bridgesFor(L, M, baseRow) {
    const out = [], R = 30;
    let i = 0;
    while (i < L.n) {
      if (!L.cells[i].ch) { i++; continue; }
      let j = i; while (j + 1 < L.n && L.cells[j + 1].ch) j++;
      const g0 = Math.floor((L.cells[i].x - PAD) / CELL), g1 = Math.ceil((L.cells[j].x + ADV + PAD) / CELL);
      const h = [];
      for (let gx = g0; gx <= g1; gx++) {
        let top = -1;
        for (let gy = 0; gy <= baseRow; gy++) if (M.grid[gy * M.gw + gx]) { top = baseRow - gy; break; }
        h.push(top);
      }
      let first = h.findIndex((v) => v >= 0), last = h.length - 1 - [...h].reverse().findIndex((v) => v >= 0);
      for (let k = first + 1; k < last; k++) {
        let lm = -1, rm = -1;
        for (let q = Math.max(first, k - R); q < k; q++) lm = Math.max(lm, h[q]);
        for (let q = k + 1; q <= Math.min(last, k + R); q++) rm = Math.max(rm, h[q]);
        const b = Math.min(lm, rm);
        if (b > h[k] + 2) out.push({ gx: g0 + k, row: baseRow - b });
      }
      i = j + 1;
    }
    return out;
  }

  // Is the box (x,y = top-left, w,h) free of ink in mask m? Outside the mask counts as free.
  function free(L, m, x, y, w, h) {
    const M = L.masks[m];
    const x0 = Math.floor(x / CELL), x1 = Math.floor((x + w - 0.001) / CELL);
    const y0 = Math.floor(y / CELL), y1 = Math.floor((y + h - 0.001) / CELL);
    for (let gy = Math.max(0, y0); gy <= Math.min(M.gh - 1, y1); gy++) {
      const row = gy * M.gw;
      for (let gx = Math.max(0, x0); gx <= Math.min(M.gw - 1, x1); gx++) if (M.grid[row + gx]) return false;
    }
    return true;
  }
  // ink of one cell's face at world grid (gx, gy)?
  function cellInk(L, cell, m, gx, gy) {
    const M = cell.m[m]; if (!M) return 0;
    const lx = gx - (cell.x - PAD) / CELL;
    if (lx < 0 || lx >= M.gw || gy < 0 || gy >= M.gh) return 0;
    return M.grid[gy * M.gw + lx];
  }
  function dotCols(d) { return [Math.floor(d.x / CELL), Math.floor((d.x + P.w - 0.001) / CELL)]; }
  function nearCells(L, d) {
    const i0 = Math.floor((d.x - PAD - MARGIN) / ADV), i1 = Math.floor((d.x + P.w + PAD - MARGIN) / ADV);
    const out = [];
    for (let i = Math.max(0, i0); i <= Math.min(L.n - 1, i1); i++) out.push(L.cells[i]);
    return out;
  }
  // The toggling cells the dot is standing on (ink in the row right under its feet).
  function supports(L, d) {
    const [c0, c1] = dotCols(d), gy = Math.floor((d.y + P.h + 0.5) / CELL);
    return nearCells(L, d).filter((cell) => {
      for (let gx = c0; gx <= c1; gx++) if (cellInk(L, cell, d.mode, gx, gy)) return true;
      return false;
    });
  }

  function newDot(L, at) {
    const c = (at != null ? L.cells[at] : null) || L.cells.find((k) => k.ch) || L.cells[0];
    return { x: c.x + ADV / 2 - P.w / 2, y: L.base - FS, vx: 0, vy: 0, ground: false, coy: 0, buf: 0, jumped: false,
      mode: 0, face: 1, landed: 0, fell: false, won: false, carried: 0 };
  }

  function moveX(L, d, dx, grounded) {
    const steps = Math.ceil(Math.abs(dx));
    if (!steps) return;
    const inc = dx / steps;
    for (let s = 0; s < steps; s++) {
      if (free(L, d.mode, d.x + inc, d.y, P.w, P.h)) { d.x += inc; continue; }
      let up = 0;
      const maxUp = grounded ? P.step : (d.vy >= 0 ? P.airStep : 0);   // airborne: slide onto slopes and corners
      for (let k = 1; k <= maxUp; k++) if (free(L, d.mode, d.x + inc, d.y - k, P.w, P.h)) { up = k; break; }
      if (up) { d.y -= up; d.x += inc; continue; }
      d.vx = 0; return;
    }
  }
  function moveY(L, d, dy) {
    const steps = Math.ceil(Math.abs(dy));
    if (!steps) return;
    const inc = dy / steps;
    for (let s = 0; s < steps; s++) {
      if (free(L, d.mode, d.x, d.y + inc, P.w, P.h)) { d.y += inc; continue; }
      if (inc > 0) { if (!d.ground) d.landed = Math.max(d.landed, d.vy); d.ground = true; }
      d.vy = 0; return;
    }
  }

  // Try to shift the page to mode m. The key the dot stands on carries it to its other face.
  // Returns 'ok', 'carry', 'lift', 'jam' or 'same'.
  function trySetMode(L, d, m) {
    if (m === d.mode) return 'same';
    const grounded = !free(L, d.mode, d.x, d.y + 1, P.w, P.h);
    const sup = grounded ? supports(L, d) : [];
    if (sup.length) {
      const [c0, c1] = dotCols(d), bottom = d.y + P.h;
      const cand = new Set();
      for (const cell of sup) for (let gx = c0; gx <= c1; gx++) {
        const M = cell.m[m]; if (!M) continue;
        for (let gy = 1; gy < M.gh; gy++) if (cellInk(L, cell, m, gx, gy) && !cellInk(L, cell, m, gx, gy - 1)) cand.add(gy * CELL);
      }
      const list = [...cand].filter((b) => Math.abs(b - bottom) <= P.carry).sort((a, b) => Math.abs(a - bottom) - Math.abs(b - bottom));
      for (const b of list) {
        const ny = b - P.h;
        if (free(L, m, d.x, ny, P.w, P.h)) {
          d.carried = d.y - ny; d.y = ny; d.mode = m; d.vy = 0; d.ground = true;
          return 'carry';
        }
      }
    }
    if (free(L, m, d.x, d.y, P.w, P.h)) { d.mode = m; return 'ok'; }
    for (let k = 1; k <= P.lift; k++) {
      if (free(L, m, d.x, d.y - k, P.w, P.h)) { d.y -= k; d.mode = m; if (d.vy > 0) d.vy = 0; return 'lift'; }
    }
    return 'jam';
  }

  // One fixed physics step. inp: { left, right, jumpHeld, jumpPressed, shift } (shift = wanted mode 0/1)
  function step(L, d, inp, dt) {
    let ev = null;
    d.carried = 0;
    if (inp.shift !== d.mode) { const r = trySetMode(L, d, inp.shift); if (r !== 'same') ev = r; }
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (dir) d.face = dir;
    const acc = d.ground ? P.acc : P.airAcc;
    if (dir) {
      if (Math.sign(d.vx) !== dir) d.vx += dir * (d.ground ? P.fric : P.airAcc) * dt;
      d.vx += dir * acc * dt;
    } else if (d.ground) {
      const f = P.fric * dt; d.vx = Math.abs(d.vx) <= f ? 0 : d.vx - Math.sign(d.vx) * f;
    }
    d.vx = Math.max(-P.run, Math.min(P.run, d.vx));
    d.buf = inp.jumpPressed ? P.buffer : Math.max(0, d.buf - dt);
    d.coy = d.ground ? P.coyote : Math.max(0, d.coy - dt);
    if (d.buf > 0 && d.coy > 0) { d.vy = -P.jumpV; d.buf = 0; d.coy = 0; d.ground = false; d.jumped = true; if (!ev || ev === 'ok') ev = 'jump'; }
    if (d.jumped && !inp.jumpHeld && d.vy < 0) { d.vy *= P.cut; d.jumped = false; }
    if (d.vy >= 0) d.jumped = false;
    d.vy = Math.min(d.vy + P.g * dt, P.maxFall);
    const wasGround = d.ground;
    d.ground = false; d.landed = 0;
    moveX(L, d, d.vx * dt, wasGround);
    moveY(L, d, d.vy * dt);
    if (!d.ground && !free(L, d.mode, d.x, d.y + 1, P.w, P.h)) d.ground = true;
    if (d.ground && !wasGround && !ev) ev = 'land';
    // the full-stop slot: after the last character, from the x-height down
    const cx = d.x + P.w / 2, by = d.y + P.h;
    if (cx > L.goalX + ADV * 0.1 && cx < L.goalX + ADV * 0.9 && by > L.base - FS * 0.42 && by < L.base + FS * 0.3) { d.won = true; ev = 'win'; }
    if (d.y > L.height + 160 || d.x < -40 || d.x > L.width + 40) { d.fell = true; ev = 'fall'; }
    return ev;
  }

  root.SL = { FS, ADV, CELL, TOP, BOT, MARGIN, FONT, P, PAIRS, face, toggles, layout, build, drawCell, free, newDot, step, trySetMode, supports };
})(typeof window !== 'undefined' ? window : globalThis);
