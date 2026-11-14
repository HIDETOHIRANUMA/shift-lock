// SHIFT LOCK: the game. You are the full stop Gran's typewriter can no longer type.
(function () {
  'use strict';
  const SL = window.SL, LEVELS = window.SLEVELS, SND = window.SOUND;
  const { FS, ADV, MARGIN, FONT, P } = SL;
  const cvs = document.getElementById('game'), ctx = cvs.getContext('2d');

  const LINE_H = 250;              // line spacing on the page (world px)
  const PAPER_L = 110;             // paper's left edge
  const VIEW_H = 800, MIN_VIEW_W = 900;
  const INK = '#1c1a17', RED = '#b3302a', PAPER = '#efe8d8', PENCIL = '#6c665f', DESK = '#2a2522';
  const DT = 1 / 120;
  const JAFONT = '"Hiragino Maru Gothic ProN", "Hiragino Sans", "Yu Gothic", "Meiryo", "Noto Sans JP", sans-serif';
  const DEFAULT_REPLY = 'thank you, gran';

  // ---------------------------------------------------------------- storage (per viewer, optional)
  const store = {
    get(k, d) { try { const v = localStorage.getItem('shiftlock.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('shiftlock.' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  let JA = store.get('ja', /^ja/.test(navigator.language || ''));
  SND.setMuted(store.get('muted', false));

  // ---------------------------------------------------------------- canvas
  let W = 0, H = 0, DPR = 1, SC = 1;
  function resize() {
    DPR = Math.min(2.5, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    cvs.width = Math.round(W * DPR); cvs.height = Math.round(H * DPR);
    SC = Math.min(H / VIEW_H, W / MIN_VIEW_W);
  }
  window.addEventListener('resize', resize); resize();
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  // paper grain
  const grain = (() => {
    const c = mk(256, 256), g = c.getContext('2d'), img = g.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 120 + Math.random() * 60; img.data[i] = v; img.data[i + 1] = v * 0.95; img.data[i + 2] = v * 0.85;
      img.data[i + 3] = Math.random() < 0.5 ? 10 : 0;
    }
    g.putImageData(img, 0, 0);
    for (let k = 0; k < 90; k++) { // fibres
      g.strokeStyle = `rgba(120,100,70,${0.04 + Math.random() * 0.05})`; g.lineWidth = 0.6;
      const x = Math.random() * 256, y = Math.random() * 256, a = Math.random() * 6.28, l = 6 + Math.random() * 18;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    return ctx.createPattern(c, 'repeat');
  })();

  // ---------------------------------------------------------------- input
  const held = { left: false, right: false, jump: false, shift: false };
  const touchHeld = { left: false, right: false, jump: false, shift: false };
  let padHeld = { left: false, right: false, jump: false, shift: false };
  let lockToggle = false, capsOn = false, jumpQueued = false, anyKeyQueued = false;
  let usingTouch = false;
  const coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    Space: 'jump', ArrowUp: 'jump', KeyW: 'jump', KeyZ: 'jump',
    ShiftLeft: 'shift', ShiftRight: 'shift', KeyX: 'shift',
  };
  const menuEl = document.getElementById('menu'), replyEl = document.getElementById('reply'), replyInput = document.getElementById('reply-input');
  const touchEl = document.getElementById('touch');
  const menuOpen = () => !menuEl.hidden;

  function lockOn() { return lockToggle !== capsOn; }
  window.addEventListener('keydown', (e) => {
    if (e.getModifierState) capsOn = e.getModifierState('CapsLock');
    if (scene === 'reply' && document.activeElement === replyInput) return;
    const k = KEYMAP[e.code];
    if (k || e.code === 'Tab') e.preventDefault();
    SND.init();
    if (menuOpen()) { if (e.code === 'Escape' || e.code === 'KeyP') closeMenu(); return; }
    if (e.code === 'KeyM') { toggleSound(); return; }
    if (e.code === 'KeyJ') { toggleLang(); return; }
    if (k) { if (k === 'jump' && !held.jump && !e.repeat) jumpQueued = true; held[k] = true; }
    if (e.repeat) return;
    if (e.code === 'KeyL') lockToggle = !lockToggle;
    if (e.code === 'Escape' || e.code === 'KeyP') { if (scene === 'play' || scene === 'feed') openMenu(); return; }
    if (e.code === 'KeyR' && scene === 'play') { restartLine(); return; }
    if (e.code === 'Enter' && scene === 'play' && cur.reply && deaths >= 6) { forceWin(); return; }
    anyKeyQueued = true;
  });
  window.addEventListener('keyup', (e) => {
    if (e.getModifierState) capsOn = e.getModifierState('CapsLock');
    const k = KEYMAP[e.code];
    if (k) held[k] = false;
  });
  window.addEventListener('blur', () => { for (const k in held) held[k] = false; for (const k in touchHeld) touchHeld[k] = false; });
  cvs.addEventListener('pointerdown', (e) => { SND.init(); if (e.pointerType === 'touch') showTouch(); anyKeyQueued = true; });

  function showTouch() { if (!usingTouch) { usingTouch = true; touchEl.hidden = false; } }
  for (const b of touchEl.querySelectorAll('button')) {
    const k = b.dataset.k;
    const down = (e) => {
      e.preventDefault(); SND.init(); b.setPointerCapture && b.setPointerCapture(e.pointerId);
      if (k === 'menu') { openMenu(); return; }
      if (k === 'lock') { lockToggle = !lockToggle; return; }
      if (k === 'jump' && !touchHeld.jump) jumpQueued = true;
      touchHeld[k] = true; b.classList.add('on'); anyKeyQueued = true;
    };
    const up = (e) => { e.preventDefault(); if (k in touchHeld) { touchHeld[k] = false; b.classList.remove('on'); } };
    b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
  }
  let padPrev = {};
  function pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const p = pads && [...pads].find((x) => x && x.connected);
    if (!p) { padHeld = { left: false, right: false, jump: false, shift: false }; return; }
    const b = (i) => !!(p.buttons[i] && p.buttons[i].pressed);
    const ax = p.axes[0] || 0;
    const now = { left: ax < -0.4 || b(14), right: ax > 0.4 || b(15), jump: b(0) || b(1), shift: b(4) || b(5) || b(6) || b(7), lock: b(3), start: b(9), back: b(8) };
    if (now.jump && !padPrev.jump) { jumpQueued = true; anyKeyQueued = true; SND.init(); }
    if (now.lock && !padPrev.lock) lockToggle = !lockToggle;
    if (now.start && !padPrev.start) { if (menuOpen()) closeMenu(); else if (scene === 'play') openMenu(); else anyKeyQueued = true; }
    if (now.back && !padPrev.back && scene === 'play') restartLine();
    padHeld = now; padPrev = now;
  }
  const inp = (k) => held[k] || touchHeld[k] || padHeld[k];
  const wantMode = () => ((inp('shift') ? 1 : 0) ^ (lockOn() ? 1 : 0));

  // ---------------------------------------------------------------- menu
  function openMenu() { menuEl.hidden = false; for (const k in held) held[k] = false; syncMenu(); const b = menuEl.querySelector('button'); b && b.focus(); }
  function closeMenu() { menuEl.hidden = true; cvs.focus && cvs.focus(); }
  function syncMenu() {
    document.getElementById('lang-state').textContent = JA ? 'on' : 'off';
    document.getElementById('sound-state').textContent = SND.muted ? 'off' : 'on';
  }
  function toggleSound() { SND.setMuted(!SND.muted); store.set('muted', SND.muted); syncMenu(); }
  function toggleLang() { JA = !JA; store.set('ja', JA); syncMenu(); }
  menuEl.addEventListener('click', (e) => {
    const a = e.target.closest('button'); if (!a) return;
    const act = a.dataset.act;
    if (act === 'resume') closeMenu();
    if (act === 'retype') { closeMenu(); if (scene === 'play') restartLine(); }
    if (act === 'lang') toggleLang();
    if (act === 'sound') toggleSound();
    if (act === 'title') { closeMenu(); toTitle(); }
  });

  // ---------------------------------------------------------------- page & lines
  let lines = [];                  // lines on the current page
  let cur = null;                  // the line being played
  let scene = 'title', sceneT = 0;
  let dot = null, deadT = 0, deaths = 0, checkpoint = null;
  let mode = 0, prevMode = 0, modeT = 1, shake = 0, jamT = 0, jamLatch = false, keyFlash = 0;
  let carryVis = 0, squash = { x: 1, y: 1 }, blinkT = 2, blink = 0, wasGround = false, airT = 0;
  const particles = [];
  const cam = { x: 0, y: 0 };
  let feed = null;                 // typing animation state
  let won = null, ending = null, replyText = '';
  let runT = 0, slips = 0, fullRun = false;   // this run: time in play, falls, started from line 1?
  let drive = null, pending = null, trailer = false; // scripted input for the trailer recorder

  const lineOffset = (k) => 80 + k * LINE_H;     // world y of the top of line k's mask
  function makeLine(k, level) {
    const L = SL.build(level, mk);
    return { k, level, L, oy: lineOffset(k), typed: 0, done: false, period: null, reply: !!level.reply };
  }

  function startGame(from) {
    lines = [];
    for (let k = 0; k < from; k++) {     // lines already finished on an earlier visit
      const ln = makeLine(k, LEVELS[k]); ln.typed = ln.L.n; ln.done = true;
      ln.period = { x: ln.L.goalX + 44.5, y: ln.oy + ln.L.base - 12 };
      lines.push(ln);
    }
    mode = 0; prevMode = 0; modeT = 1;
    runT = 0; slips = 0; fullRun = from === 0; drive = null; SND.music(); SND.musicShift(0);
    cam.x = 0; cam.y = lineOffset(from) + 143 - (H / SC) * 0.62;
    beginLine(from);
  }

  function beginLine(k) {
    const level = k < LEVELS.length ? LEVELS[k] : null;
    if (!level) { beginReply(); return; }
    cur = makeLine(k, level); lines.push(cur);
    deaths = 0; checkpoint = null; dot = null; drive = null;
    startFeed();
  }

  function startFeed() {
    feed = { phase: 'return', t: 0, from: { x: cam.x, y: cam.y }, typed: 0, acc: 0 };
    scene = 'feed'; sceneT = 0;
    SND.carriage(0.5); setTimeout(() => SND.linefeed(), 120);
  }

  function spawnDot(fromCheckpoint) {
    if (pending) { checkpoint = pending.c; fromCheckpoint = pending.c != null; drive = pending.plan ? { plan: pending.plan, i: 0, n: 0, pj: 0, last: 0 } : null; pending = null; acc = 0; }
    const cp = fromCheckpoint && checkpoint != null ? checkpoint : null;
    dot = SL.newDot(cur.L, cp);
    dot.mode = mode;
    // if the page is shifted and the drop point would be inside ink, look for room above
    for (let k = 0; k < 60 && !SL.free(cur.L, mode, dot.x, dot.y, P.w, P.h); k++) dot.y -= 4;
    wasGround = false; airT = 0; squash = { x: 0.6, y: 1.5 };
    SND.clack(0.7);
  }

  function restartLine() { if (!cur || scene !== 'play') return; checkpoint = null; burst(dotWorld(), 10, 0.6); spawnDot(false); }

  // ---------------------------------------------------------------- reply
  function beginReply() {
    const k = LEVELS.length;
    replyText = '';
    cur = { k, level: { text: '', seed: 7 }, L: SL.layout({ text: '', seed: 7 }), oy: lineOffset(k), typed: 0, done: false, period: null, reply: true, typing: true };
    lines.push(cur);
    feed = { phase: 'return', t: 0, from: { x: cam.x, y: cam.y }, typed: 0, acc: 0, reply: true };
    scene = 'feed'; sceneT = 0; dot = null; deaths = 0; checkpoint = null; drive = null;
    SND.carriage(0.5);
  }
  function openReplyInput() {
    scene = 'reply'; sceneT = 0;
    replyEl.hidden = false; replyInput.value = replyText; replyInput.placeholder = JA ? 'おばあちゃんへの返事' : 'your reply to gran';
    setTimeout(() => replyInput.focus(), 30);
  }
  const ALLOWED = /[a-zA-Z0-9 !@#$%^&*()\-_=+[\]{};:'",/?`~\\|]/;
  function sanitize(s) {
    let out = '';
    for (const ch of s) if (ALLOWED.test(ch)) out += ch;
    return out.replace(/ {2,}/g, ' ').replace(/^ +/, '').slice(0, 26);
  }
  let brokenNoteT = 0;
  replyInput.addEventListener('keydown', (e) => {
    if (e.key === '.' || e.key === '>' || e.key === '。') { e.preventDefault(); SND.blocked(); brokenNoteT = 2.2; shake = 6; return; }
    if (e.key === 'Enter') { e.preventDefault(); submitReply(); return; }
    e.stopPropagation();
  });
  replyInput.addEventListener('input', () => {
    const before = replyText;
    replyText = sanitize(replyInput.value);
    if (replyInput.value !== replyText) replyInput.value = replyText;
    if (replyText.length > before.length) (replyText.endsWith(' ') ? SND.space() : SND.clack(0.8));
    else if (replyText.length < before.length) SND.space(0.5);
    cur.L = SL.layout({ text: replyText, seed: 7 }); cur.typed = cur.L.n;
  });
  document.getElementById('reply-done').addEventListener('click', submitReply);
  function submitReply() {
    if (scene !== 'reply') return;
    let t = sanitize(replyText).replace(/ +$/, '');
    if (!t) t = DEFAULT_REPLY;
    replyText = t;
    replyEl.hidden = true; replyInput.blur();
    const level = { text: t, seed: 7, reply: true };
    const ln = makeLine(cur.k, level); ln.typed = ln.L.n;
    lines[lines.length - 1] = ln; cur = ln;
    feed = { phase: 'back', t: 0, from: { x: cam.x, y: cam.y }, typed: ln.L.n, acc: 0 };
    scene = 'feed'; sceneT = 0;
    SND.carriage(0.35);
  }

  // ---------------------------------------------------------------- win / ending
  function onWin() {
    scene = 'won'; sceneT = 0;
    const L = cur.L;
    won = { from: { x: dot.x + P.w / 2, y: dot.y + P.h / 2 + cur.oy }, to: { x: L.goalX + 44.5, y: cur.oy + L.base - 12 } };
    SND.clack(1.2); setTimeout(() => SND.bell(), 90);
    burst({ x: won.to.x, y: won.to.y }, 16, 1);
    if (!cur.reply) store.set('line', Math.max(store.get('line', 0), cur.k + 1));
  }
  function forceWin() { if (!dot) spawnDot(true); dot.x = cur.L.goalX + 36; dot.y = cur.oy; onWin(); }
  function finishWon() {
    cur.done = true; cur.period = { x: won.to.x, y: won.to.y };
    dot = null; won = null;
    if (cur.reply) { startEnding(); return; }
    beginLine(cur.k + 1);
  }
  function startEnding() {
    scene = 'ending'; sceneT = 0;
    store.set('line', 0); store.set('finished', true);
    let maxX = 0; for (const ln of lines) maxX = Math.max(maxX, ln.L.goalX + ADV * 2);
    const top = lineOffset(0) - 40, bottom = lineOffset(lines.length - 1) + 260;
    if (fullRun) { const b = store.get('best', 0); if (!b || runT < b) store.set('best', runT); }
    ending = { from: { x: cam.x, y: cam.y, s: SC }, box: { x0: PAPER_L - 30, x1: maxX + 60, y0: top, y1: bottom },
      stats: { t: runT, slips, full: fullRun, best: store.get('best', 0) } };
    SND.carriage(0.8); setTimeout(() => SND.musicEnd(), 900);
  }
  function toTitle() {
    scene = 'title'; sceneT = 0; dot = null; ending = null; won = null; replyEl.hidden = true;
    lines = []; cur = null; mode = 0; modeT = 1;
  }

  // ---------------------------------------------------------------- effects
  function burst(p, n, power) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = (60 + Math.random() * 220) * power;
      particles.push({ x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120 * power, r: 1.2 + Math.random() * 2.6, life: 0.4 + Math.random() * 0.5, max: 0.9 });
    }
  }
  const dotWorld = () => dot ? { x: dot.x + P.w / 2, y: dot.y + P.h / 2 + cur.oy } : { x: 0, y: 0 };

  // ---------------------------------------------------------------- update
  let acc = 0, last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    pollPad();
    if (!menuOpen()) update(dt);
    render(dt);
    requestAnimationFrame(frame);
  }

  function update(dt) {
    sceneT += dt;
    if (modeT < 1) modeT = Math.min(1, modeT + dt / 0.11);
    shake = Math.max(0, shake - dt * 40);
    jamT = Math.max(0, jamT - dt); keyFlash = Math.max(0, keyFlash - dt);
    brokenNoteT = Math.max(0, brokenNoteT - dt);
    carryVis *= Math.exp(-dt * 16);
    squash.x += (1 - squash.x) * Math.min(1, dt * 14); squash.y += (1 - squash.y) * Math.min(1, dt * 14);
    blinkT -= dt; if (blinkT < 0) { blink = 0.12; blinkT = 2 + Math.random() * 3.5; } blink = Math.max(0, blink - dt);
    for (let i = particles.length - 1; i >= 0; i--) {
      const q = particles[i]; q.vy += 1500 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt;
      if (q.life <= 0) particles.splice(i, 1);
    }

    if (scene === 'title') {
      if (anyKeyQueued && sceneT > 0.3) {
        anyKeyQueued = false; SND.init(); SND.clack();
        const saved = store.get('line', 0);
        startGame(saved > 0 && saved < LEVELS.length ? saved : 0);
      }
      anyKeyQueued = false;
      return;
    }
    if (scene === 'feed') { updateFeed(dt); anyKeyQueued = false; jumpQueued = false; return; }
    if (scene === 'reply') { followCam(dt, MARGIN + cur.L.n * ADV, 0.55); anyKeyQueued = false; return; }
    if (scene === 'won') {
      if (sceneT > 1.15) finishWon();
      followCam(dt, won ? won.to.x : cam.x, 0.55);
      anyKeyQueued = false; return;
    }
    if (scene === 'ending') {
      if (sceneT > 4 && anyKeyQueued) { SND.clack(); toTitle(); }
      anyKeyQueued = false; return;
    }
    if (scene !== 'play') return;
    runT += dt;

    // shift requests that come from the keyboard even while dead change the page
    const want = drive ? drive.last : wantMode();
    if (!dot) {
      deadT -= dt;
      if (want !== mode) setMode(want);
      if (deadT <= 0) spawnDot(true);
      followCam(dt, cam.x + (W / SC) * 0.4, 0.62);
      anyKeyQueued = false; jumpQueued = false;
      return;
    }
    acc += dt;
    while (acc >= DT) {
      acc -= DT;
      const before = dot.mode;
      const I = drive ? driveInput() : { left: inp('left'), right: inp('right'), jumpHeld: inp('jump'), jumpPressed: jumpQueued, shift: wantMode() };
      const ev = SL.step(cur.L, dot, I, DT);
      jumpQueued = false;
      if (dot.mode !== before) onModeChanged(before, dot.mode, ev);
      if (ev === 'jam') { if (!jamLatch) { SND.jam(); jamT = 0.35; shake = 5; jamLatch = true; } }
      if (I.shift === dot.mode) jamLatch = false;
      if (ev === 'jump') { SND.jump(); squash = { x: 0.72, y: 1.32 }; }
      if (dot.ground && !wasGround && airT > 0.06) {
        const v = Math.min(1, (dot.landed || 300) / 900); SND.land(v);
        squash = { x: 1 + 0.4 * v, y: 1 - 0.35 * v };
        if (v > 0.35) burst({ x: dot.x + P.w / 2, y: dot.y + P.h + cur.oy }, 3 + Math.round(v * 5), 0.35);
      }
      airT = dot.ground ? 0 : airT + DT;
      wasGround = dot.ground;
      if (dot.won) { onWin(); break; }
      if (dot.fell) { onFall(); break; }
      // checkpoints
      if (cur.level.cp && dot.ground) {
        const cx = dot.x + P.w / 2;
        for (const c of cur.level.cp) if ((checkpoint == null || c > checkpoint) && cx > MARGIN + c * ADV + ADV * 0.5) checkpoint = c;
      }
    }
    if (dot) followCam(dt, dot.x + P.w / 2 + dot.face * 70, 0.62);
    anyKeyQueued = false;
  }

  // a recorded plan: [[physics steps, dir -1|0|1, jump 0|1, shift 0|1], ...]
  function driveInput() {
    const d = drive;
    while (d.i < d.plan.length && d.n >= d.plan[d.i][0]) { d.i++; d.n = 0; }
    if (d.i >= d.plan.length) { d.pj = 0; return { left: false, right: false, jumpHeld: false, jumpPressed: false, shift: d.last }; }
    const [, dir, j, s] = d.plan[d.i]; d.n++;
    const r = { left: dir < 0, right: dir > 0, jumpHeld: !!j, jumpPressed: !!j && !d.pj, shift: s };
    d.pj = j; d.last = s; return r;
  }
  function setMode(m) { if (m === mode) return; prevMode = mode; mode = m; modeT = 0; SND.shift(m === 1); SND.musicShift(m); shake = Math.max(shake, 2.5); }
  function onModeChanged(a, b, ev) {
    prevMode = a; mode = b; modeT = 0; keyFlash = 0.15;
    if (ev === 'carry' && Math.abs(dot.carried) > 4) { SND.carry(dot.carried > 0); carryVis = dot.carried; squash = { x: 1.25, y: 0.75 }; }
    SND.shift(b === 1); SND.musicShift(b); shake = Math.max(shake, 2.5);
  }
  function onFall() {
    deaths++; slips++;
    const p = dotWorld(); burst({ x: p.x, y: Math.min(p.y, cur.oy + cur.L.base + 140) }, 14, 0.8);
    SND.fall(); dot = null; deadT = 0.55; shake = 4;
  }

  function followCam(dt, focusX, baseFrac) {
    const vw = W / SC, vh = H / SC;
    const L = cur ? cur.L : null;
    let tx = focusX - vw * 0.42;
    const maxX = L ? Math.max(0, L.goalX + ADV * 3 - vw) : 0;
    tx = Math.max(0, Math.min(maxX, tx));
    const ty = (cur ? cur.oy + cur.L.base : 0) - vh * baseFrac;
    const k = 1 - Math.exp(-dt * 6);
    cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
  }

  function updateFeed(dt) {
    const f = feed; f.t += dt;
    const vw = W / SC, vh = H / SC;
    const startX = 0, baseY = cur.oy + (cur.L.base || 143) - vh * 0.62;
    const skip = anyKeyQueued;
    if (f.phase === 'return') {
      const d = 0.55, u = ease(Math.min(1, f.t / d));
      cam.x = f.from.x + (startX - f.from.x) * u; cam.y = f.from.y + (baseY - f.from.y) * u;
      if (f.t >= d || skip) {
        cam.x = startX; cam.y = baseY;
        if (f.reply) { openReplyInput(); return; }
        f.phase = 'type'; f.t = 0;
      }
    }
    if (f.phase === 'type') {
      const n = cur.L.n;
      f.acc += dt;
      while (f.acc > 0.03 && cur.typed < n) {
        f.acc -= 0.03; const c = cur.L.cells[cur.typed]; cur.typed++;
        if (c.ch) SND.clack(0.55 + Math.random() * 0.25); else SND.space(0.6);
      }
      const head = MARGIN + cur.typed * ADV;
      cam.x += (Math.max(0, head - vw * 0.7) - cam.x) * (1 - Math.exp(-dt * 10));
      if (skip) cur.typed = n;
      if (cur.typed >= n) { f.phase = 'back'; f.t = 0; f.from = { x: cam.x, y: cam.y }; SND.carriage(0.35); }
    }
    if (f.phase === 'back') {
      const d = 0.4, u = ease(Math.min(1, f.t / d));
      cam.x = f.from.x + (startX - f.from.x) * u;
      if (f.t >= d || (skip && f.t > 0.05)) { cam.x = startX; scene = 'play'; sceneT = 0; spawnDot(false); }
    }
  }
  const ease = (u) => u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;

  // ---------------------------------------------------------------- render
  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = DESK; ctx.fillRect(0, 0, cvs.width, cvs.height);
    if (scene === 'title') { renderTitle(); return; }

    let s = SC, cx = cam.x, cy = cam.y;
    if (scene === 'ending' && ending) {
      const b = ending.box, u = ease(Math.min(1, sceneT / 2.4));
      const rh = Math.max(22, H * 0.055), room = H - rh - 170;
      const fit = Math.min(W * 0.96 / (b.x1 - b.x0), room / (b.y1 - b.y0));
      s = ending.from.s + (fit - ending.from.s) * u;
      const tx = (b.x0 + b.x1) / 2 - W / s / 2, ty = b.y0 - ((room - (b.y1 - b.y0) * fit) / 2 + 8) / s;
      cx = ending.from.x + (tx - ending.from.x) * u; cy = ending.from.y + (ty - ending.from.y) * u;
    }
    const sh = shake > 0 ? (Math.random() - 0.5) * shake : 0, shy = (modeT < 1 ? (1 - modeT) * (mode ? -3 : 3) : 0);
    ctx.setTransform(DPR * s, 0, 0, DPR * s, -cx * DPR * s + sh * DPR, -cy * DPR * s + shy * DPR);
    const vx0 = cx, vx1 = cx + W / s, vy0 = cy, vy1 = cy + H / s;

    // the sheet of paper
    let paperR = 2600; for (const ln of lines) paperR = Math.max(paperR, ln.L.goalX + ADV * 4);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(PAPER_L + 8, vy0 - 10, paperR - PAPER_L, vy1 - vy0 + 20);
    ctx.fillStyle = PAPER; ctx.fillRect(PAPER_L, vy0 - 10, paperR - PAPER_L, vy1 - vy0 + 20);
    ctx.save(); ctx.globalAlpha = 1; ctx.fillStyle = grain; ctx.fillRect(PAPER_L, vy0 - 10, paperR - PAPER_L, vy1 - vy0 + 20); ctx.restore();

    ctx.font = FONT; ctx.textBaseline = 'alphabetic';
    for (const ln of lines) {
      const top = ln.oy, bottom = ln.oy + ln.L.height;
      if (bottom < vy0 - 50 || top > vy1 + 50) continue;
      drawLine(ln, vx0, vx1);
    }
    if (cur && (scene === 'play' || scene === 'feed' || scene === 'won' || scene === 'reply')) drawNotes(cur, vx0, vx1);
    for (const q of particles) { ctx.globalAlpha = Math.max(0, Math.min(1, q.life / 0.4)); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 6.283); ctx.fill(); }
    ctx.globalAlpha = 1;
    if (dot && cur && scene === 'play') drawDot(dot.x + P.w / 2, dot.y + P.h + cur.oy + carryVis, 1, true);
    if (scene === 'won' && won) {
      const u = ease(Math.min(1, sceneT / 0.22));
      drawDot(won.from.x + (won.to.x - won.from.x) * u, won.from.y + (won.to.y - won.from.y) * u + 11, 1, sceneT < 0.6);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    renderUI();
  }

  function drawLine(ln, vx0, vx1) {
    const L = ln.L, base = ln.oy + L.base;
    ctx.fillStyle = RED; ctx.globalAlpha = 0.86;
    for (let i = 0; i < L.cells.length; i++) {
      const c = L.cells[i];
      if (!c.under || (L.cells[i - 1] && L.cells[i - 1].under)) continue;
      let j = i; while (L.cells[j + 1] && L.cells[j + 1].under) j++;
      if (!ln.done) j = Math.min(j, ln.typed - 1);
      if (j < i) continue;
      const x0 = c.x - 3, x1 = L.cells[j].x + 92;
      if (x1 < vx0 - 10 || x0 > vx1 + 10) continue;
      ctx.beginPath();
      for (let x = x0; x <= x1; x += 24) ctx.lineTo(Math.min(x, x1), base + 21 + Math.sin(x * 0.031 + i) * 0.9);
      for (let x = x1; x >= x0; x -= 24) ctx.lineTo(Math.max(x, x0), base + 36 + Math.sin(x * 0.027 + i * 2) * 1.1);
      ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = INK;
    for (const c of L.cells) {
      if (!c.ch || c.x + ADV < vx0 - 10 || c.x > vx1 + 10) continue;
      if (!ln.done && c.i >= ln.typed) continue;
      if (modeT < 1 && SL.toggles(c.ch)) {
        ctx.globalAlpha = c.ink * (1 - modeT); SL.drawCell(ctx, c, !!prevMode, c.x, base, 'key');
        ctx.globalAlpha = c.ink * modeT; SL.drawCell(ctx, c, !!mode, c.x, base, 'key');
      } else { ctx.globalAlpha = c.ink; SL.drawCell(ctx, c, !!mode, c.x, base, 'key'); }
    }
    ctx.globalAlpha = 1;
    if (ln.period) { ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(ln.period.x, ln.period.y, 11.5, 12.5, 0, 0, 6.283); ctx.fill(); }
    else if (ln === cur && scene === 'play' && ln.typed >= L.n) {   // where the full stop belongs
      const t = performance.now() / 1000, r = 12.5 + Math.sin(t * 3) * 1.2;
      ctx.save(); ctx.setLineDash([4, 4]); ctx.lineDashOffset = -t * 8; ctx.strokeStyle = PENCIL; ctx.lineWidth = 2.2; ctx.globalAlpha = 0.75;
      ctx.beginPath(); ctx.arc(L.goalX + 44.5, base - 12, r, 0, 6.283); ctx.stroke(); ctx.restore();
    }
    if (ln.reply && scene === 'reply') { // the typing head
      const x = MARGIN + L.n * ADV, blinkOn = (sceneT * 2 % 1) < 0.6;
      if (blinkOn) { ctx.fillStyle = RED; ctx.fillRect(x + 8, base + 14, ADV - 16, 6); }
    }
  }

  function drawNotes(ln, vx0, vx1) {
    const notes = (ln.level && ln.level.notes) || [];
    const base = ln.oy + ln.L.base;
    for (const n of notes) {
      const x = MARGIN + n.at * ADV, y = n.below ? base + 112 : base - 196;
      if (x > vx1 + 400 || x < vx0 - 1400) continue;
      ctx.save(); ctx.translate(x, y); ctx.rotate(-0.025);
      ctx.fillStyle = PENCIL; ctx.globalAlpha = 0.9;
      const tch = usingTouch || coarse;
      if (JA) { ctx.font = '500 34px ' + JAFONT; ctx.fillText((tch && n.tja) || n.ja, 0, 0); }
      else { ctx.font = 'italic 400 36px "Courier Prime", monospace'; ctx.fillText((tch && n.ten) || n.en, 0, 0); }
      ctx.restore();
    }
    if (ln.reply) {
      const msg = scene === 'reply'
        ? (brokenNoteT > 0 ? (JA ? 'ピリオドのキーは折れている。それは、きみの仕事' : 'the period key is broken. that part is your job')
          : (JA ? 'こんどは、きみが打つ番。おばあちゃんへの返事を書いて、Enter' : 'now you type. write back to gran, then press enter'))
        : (deaths >= 6 ? (JA ? 'むずかしければ Enter で手紙を終えられる' : 'stuck? press enter to end the letter here') : '');
      if (msg) {
        ctx.save(); ctx.translate(Math.max(MARGIN, vx0 + 60), base - 196); ctx.rotate(-0.02); ctx.fillStyle = brokenNoteT > 0 ? RED : PENCIL;
        ctx.font = JA ? '500 34px ' + JAFONT : 'italic 400 36px "Courier Prime", monospace';
        ctx.fillText(msg, 0, 0); ctx.restore();
      }
    }
    ctx.font = FONT;
  }

  // the dot: x = centre, yb = bottom of its box (world)
  function drawDot(x, yb, a, eyes) {
    const r = 11.2;
    ctx.save();
    ctx.translate(x, yb); ctx.scale(squash.x, squash.y); ctx.translate(0, -P.h / 2 - 0.5);
    ctx.fillStyle = INK; ctx.globalAlpha = a;
    ctx.beginPath();
    const t = performance.now() / 1000;
    for (let i = 0; i <= 24; i++) {
      const ang = (i / 24) * Math.PI * 2, rr = r + Math.sin(ang * 3 + t * 5) * 0.45 + Math.sin(ang * 5 - t * 3) * 0.3;
      const px = Math.cos(ang) * rr, py = Math.sin(ang) * rr;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.ellipse(-4, -5, 3.2, 2, -0.6, 0, 6.283); ctx.fill();
    if (eyes) {
      const f = dot ? dot.face : 1, jam = jamT > 0;
      for (const sx of [-4.2, 4.2]) {
        const ex = sx + f * 1.6, ey = -1.2;
        if (blink > 0 || jam) {
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; ctx.beginPath();
          if (jam) { ctx.moveTo(ex - 2, ey - 2); ctx.lineTo(ex + 2, ey + 2); ctx.moveTo(ex + 2, ey - 2); ctx.lineTo(ex - 2, ey + 2); }
          else { ctx.moveTo(ex - 2.2, ey); ctx.lineTo(ex + 2.2, ey); }
          ctx.stroke();
        } else {
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex, ey, 2.6, 3.1, 0, 0, 6.283); ctx.fill();
          ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex + f * 0.9, ey + 0.4, 1.35, 0, 6.283); ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function renderUI() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    // platen roller along the bottom edge
    const rh = Math.max(22, H * 0.055);
    const gr = ctx.createLinearGradient(0, H - rh, 0, H);
    gr.addColorStop(0, '#0d0c0b'); gr.addColorStop(0.35, '#3b3633'); gr.addColorStop(0.55, '#1d1a18'); gr.addColorStop(1, '#090807');
    ctx.fillStyle = gr; ctx.fillRect(0, H - rh, W, rh);
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(0, H - rh + rh * 0.3, W, 2);

    if (scene === 'ending') { renderEnding(); return; }
    const pad = Math.max(12, W * 0.015);
    // line counter
    ctx.font = '700 17px "Courier Prime", monospace'; ctx.fillStyle = 'rgba(28,26,23,0.75)'; ctx.textBaseline = 'top';
    const label = cur && cur.reply ? (JA ? 'きみの返事' : 'your reply') : cur ? (JA ? `${cur.k + 1}行目 / ${LEVELS.length}` : `line ${cur.k + 1} of ${LEVELS.length}`) : '';
    ctx.fillStyle = 'rgba(239,232,216,0.9)'; const lw = ctx.measureText(label).width;
    roundRect(pad - 8, pad - 6, lw + 16, 30, 4); ctx.fill();
    ctx.fillStyle = INK; ctx.fillText(label, pad, pad);

    // the shift key
    const kw = 128, kh = 58, kx = W - kw - pad - (usingTouch ? 56 : 0), ky = pad;
    const down = mode === 1, jx = jamT > 0 ? Math.sin(jamT * 90) * 4 : 0;
    ctx.save(); ctx.translate(kx + jx, ky + (down ? 4 : 0));
    ctx.fillStyle = '#1c1a17'; roundRect(0, down ? 2 : 6, kw, kh, 10); ctx.fill();
    ctx.fillStyle = jamT > 0 ? '#e7b4ad' : down ? '#d8ceb8' : '#efe8d8'; roundRect(0, 0, kw, kh, 10); ctx.fill();
    ctx.strokeStyle = jamT > 0 ? RED : INK; ctx.lineWidth = 2.5; roundRect(0, 0, kw, kh, 10); ctx.stroke();
    ctx.fillStyle = INK; ctx.font = '700 22px "Courier Prime", monospace'; ctx.textBaseline = 'middle';
    ctx.fillText('⇧ shift', 14, kh / 2 + 1);
    ctx.restore();
    // shift-lock lamp
    ctx.save(); ctx.translate(kx - 74, ky + 14);
    ctx.fillStyle = lockOn() ? RED : 'rgba(239,232,216,0.85)'; ctx.beginPath(); ctx.arc(10, 12, 8, 0, 6.283); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = INK; ctx.font = '700 15px "Courier Prime", monospace'; ctx.textBaseline = 'middle';
    ctx.fillText('lock', 24, 13);
    ctx.restore();

    // Japanese subtitle of the line
    if (JA && cur && !cur.reply && (scene === 'play' || scene === 'won' || scene === 'feed') && cur.level.ja) {
      ctx.font = '600 ' + Math.round(Math.max(15, Math.min(22, W / 50))) + 'px ' + JAFONT; ctx.textBaseline = 'middle';
      const t = cur.level.ja, tw = ctx.measureText(t).width, y = H - rh - (usingTouch ? 110 : 30);
      ctx.fillStyle = 'rgba(28,26,23,0.78)'; roundRect(W / 2 - tw / 2 - 14, y - 18, tw + 28, 36, 6); ctx.fill();
      ctx.fillStyle = '#f4efe4'; ctx.fillText(t, W / 2 - tw / 2, y + 1);
    }
    ctx.textBaseline = 'alphabetic';
  }

  function renderTitle() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const pw = Math.min(W * 0.86, 980), ph = Math.min(H * 0.82, 640), px = (W - pw) / 2, py = (H - ph) / 2 - H * 0.02;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(px + 10, py + 12, pw, ph);
    ctx.fillStyle = PAPER; ctx.fillRect(px, py, pw, ph); ctx.fillStyle = grain; ctx.fillRect(px, py, pw, ph);
    const t = sceneT, k = Math.min(1, pw / 980);
    const title = 'SHIFT LOCK', n = Math.min(title.length, Math.floor(t / 0.07));
    ctx.fillStyle = INK; ctx.font = `700 ${Math.round(112 * k)}px "Courier Prime", monospace`; ctx.textBaseline = 'alphabetic';
    const tw = ctx.measureText(title).width, tx = px + (pw - tw) / 2, ty = py + ph * 0.36;
    ctx.fillText(title.slice(0, n), tx, ty);
    if (n >= 6) { ctx.fillStyle = RED; ctx.globalAlpha = 0.85; ctx.fillRect(tx + tw * 0.62, ty + 18 * k, tw * 0.38, 9 * k); ctx.globalAlpha = 1; }
    // the dot waiting where the full stop belongs
    if (n >= title.length) {
      const bob = Math.sin(t * 3) * 4;
      squash = { x: 1, y: 1 };
      ctx.save(); ctx.translate(tx + tw + 30 * k, ty - 16 * k + bob); ctx.scale(k * 1.6, k * 1.6);
      ctx.translate(-0, 0); drawDotAt(0, 0); ctx.restore();
    }
    ctx.fillStyle = PENCIL; ctx.font = `italic 400 ${Math.round(30 * k)}px "Courier Prime", monospace`;
    const sub = JA ? '' : 'a letter needs its full stops';
    if (!JA) { const sw = ctx.measureText(sub).width; ctx.fillText(sub, px + (pw - sw) / 2, py + ph * 0.5); }
    else { ctx.font = `500 ${Math.round(28 * k)}px ${JAFONT}`; const s2 = '手紙には、ピリオドが必要だ'; const sw = ctx.measureText(s2).width; ctx.fillText(s2, px + (pw - sw) / 2, py + ph * 0.5); }
    if (t > 0.9 && (t * 1.6 % 1) < 0.7) {
      ctx.fillStyle = INK; ctx.font = `700 ${Math.round(26 * k)}px "Courier Prime", monospace`;
      const saved = store.get('line', 0);
      const tp = usingTouch || coarse;
      const msg = JA ? (saved > 0 ? (tp ? `タップして続きから（${saved + 1}行目）` : `何かキーを押して続きから（${saved + 1}行目）`) : (tp ? 'タップしてはじめる' : '何かキーを押してはじめる'))
        : (saved > 0 ? ((usingTouch || coarse) ? `tap to continue (line ${saved + 1})` : `press any key to continue (line ${saved + 1})`) : ((usingTouch || coarse) ? 'tap to begin' : 'press any key'));
      const mw = ctx.measureText(msg).width; ctx.fillText(msg, px + (pw - mw) / 2, py + ph * 0.68);
    }
    ctx.fillStyle = '#7d766d'; ctx.font = `400 ${Math.round(16 * Math.max(0.8, k))}px "Courier Prime", monospace`;
    const help = (usingTouch || coarse)
      ? (JA ? '◀ ▶ 移動 · ⤒ ジャンプ · ⇧ 長押しでシフト · LOCK 固定 · II メニュー' : '◀ ▶ move · ⤒ jump · hold ⇧ to shift · LOCK locks it · II menu')
      : (JA ? '← → 移動 · スペース ジャンプ · シフト長押し · Caps Lock / L 固定 · R 打ち直し · J 日本語 · M 音' : '← → move · space jump · hold shift · caps lock / L lock · R retype · J 日本語 · M sound');
    const hw = ctx.measureText(help).width; ctx.fillText(help, px + Math.max(10, (pw - hw) / 2), py + ph * 0.9);
    // platen
    const rh = Math.max(22, H * 0.055); const gr = ctx.createLinearGradient(0, H - rh, 0, H);
    gr.addColorStop(0, '#0d0c0b'); gr.addColorStop(0.35, '#3b3633'); gr.addColorStop(0.55, '#1d1a18'); gr.addColorStop(1, '#090807');
    ctx.fillStyle = gr; ctx.fillRect(0, H - rh, W, rh);
  }
  function drawDotAt(x, y) { const save = dot; drawDot(x, y + P.h / 2, 1, true); dot = save; }

  function renderEnding() {
    if (sceneT < 2.6) return;
    const a = Math.min(1, (sceneT - 2.6) / 0.8);
    ctx.globalAlpha = a;
    const st = ending && !trailer && ending.stats;
    const mmss = (v) => { v = Math.round(v); return Math.floor(v / 60) + ':' + String(v % 60).padStart(2, '0'); };
    const fun = (v) => { v = Math.round(v); return Math.floor(v / 60) + '分' + String(v % 60).padStart(2, '0') + '秒'; };
    const statEn = st ? `  ·  ${mmss(st.t)}, ${st.slips} ${st.slips === 1 ? 'slip' : 'slips'}` + (st.full && st.best ? ` (best ${mmss(st.best)})` : '') : '';
    const statJa = st ? `　・　${fun(st.t)}、落下${st.slips}回` + (st.full && st.best ? `（ベスト ${fun(st.best)}）` : '') : '';
    const lines2 = JA
      ? ['おわり', 'おばあちゃんの手紙に、ぜんぶのピリオドが打てた。', 'SHIFT LOCK をあそんでくれて、ありがとう' + statJa, 'GitHub Game Off 2026（テーマ：SHIFT）参加作品 · フォント Courier Prime（SIL OFL）']
      : ['the end', 'every sentence ended where it should.', 'thank you for playing SHIFT LOCK' + statEn, 'made for GitHub Game Off 2026 (theme: SHIFT) · font: Courier Prime (SIL OFL)'];
    const rh = Math.max(22, H * 0.055);
    ctx.fillStyle = 'rgba(28,26,23,0.86)'; roundRect(W * 0.08, H - rh - 150, W * 0.84, 132, 8); ctx.fill();
    ctx.fillStyle = '#f4efe4'; ctx.textBaseline = 'middle';
    ctx.font = (JA ? '700 26px ' + JAFONT : '700 28px "Courier Prime", monospace');
    const cx = W / 2;
    const put = (t, y) => { const w = ctx.measureText(t).width; ctx.fillText(t, cx - Math.min(w, W * 0.8) / 2, y, W * 0.8); };
    put(lines2[0] + '  —  ' + lines2[1], H - rh - 118);
    ctx.font = (JA ? '500 18px ' + JAFONT : '400 18px "Courier Prime", monospace'); put(lines2[2], H - rh - 80);
    ctx.font = (JA ? '400 13px ' + JAFONT : '400 13px "Courier Prime", monospace'); ctx.fillStyle = '#cfc6b5'; put(lines2[3], H - rh - 50);
    if (sceneT > 4 && (sceneT * 1.6 % 1) < 0.7) { ctx.font = '700 15px "Courier Prime", monospace'; ctx.fillStyle = '#f4efe4'; put(JA ? '何かキーを押してタイトルへ' : 'press any key', H - rh - 28); }
    ctx.globalAlpha = 1; ctx.textBaseline = 'alphabetic';
  }

  // ---------------------------------------------------------------- go
  window.SHIFTLOCK = { // tiny hooks for automated tests and the trailer recorder
    get scene() { return scene; }, get line() { return cur ? cur.k : -1; }, get dot() { return dot; }, get mode() { return mode; },
    start(k) { SND.init(); startGame(k || 0); }, skipFeed() { anyKeyQueued = true; },
    hold(k, v) { held[k] = v; if (k === 'jump' && v) jumpQueued = true; }, reply(t) { replyInput.value = t; replyInput.dispatchEvent(new Event('input')); submitReply(); },
    lock(v) { lockToggle = v; },
    queue(c, plan) { pending = { c: c == null ? null : c, plan: plan || null }; }, // next spawn: checkpoint cell + scripted input
    set trailer(v) { trailer = !!v; },
    warp() { if (dot && cur) { dot.x = cur.L.goalX + ADV / 2 - P.w / 2; dot.y = cur.L.base - FS; dot.vx = 0; dot.vy = 0; } },
  };
  Promise.all([document.fonts.load(FONT), document.fonts.load('italic 400 36px "Courier Prime"'), document.fonts.load('400 16px "Courier Prime"')])
    .catch(() => {}).then(() => requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); }));
})();
