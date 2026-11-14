// Trailer director: runs once per video frame (after the game's own frame) and walks a script.
// Needs window.__PLANS (solver input plans) and the harness. Returns true when the trailer is over.
(() => {
  const S = window.SHIFTLOCK, P = window.__PLANS;
  S.trailer = true;
  const vh = (v) => (innerHeight * v / 100).toFixed(1) + 'px';
  const JAF = "'Yu Gothic', 'YuGothic', 'Hiragino Sans', 'Noto Sans CJK JP', 'Noto Sans JP', Meiryo, sans-serif";

  // ---- caption box (top centre), faded by hand so it follows virtual time
  const cap = document.createElement('div');
  cap.style.cssText = `position:fixed;left:50%;top:${vh(5.2)};transform:translateX(-50%);background:rgba(28,26,23,.9);color:#f4efe4;` +
    `padding:${vh(1.3)} ${vh(2.6)} ${vh(1.1)};border-radius:6px;text-align:center;pointer-events:none;opacity:0;white-space:nowrap;z-index:5`;
  cap.innerHTML = `<div style="font:700 ${vh(3.6)} 'Courier Prime',monospace"></div><div style="font:600 ${vh(2.2)} ${JAF};margin-top:${vh(0.6)};color:#d9d0bf"></div>`;
  document.body.appendChild(cap);
  let capNow = null, capNext = null, capA = 0;
  const say = (c) => { capNext = c || null; };

  // ---- end card on paper
  const card = document.createElement('div');
  card.style.cssText = 'position:fixed;inset:0;background:#efe8d8;display:flex;flex-direction:column;align-items:center;justify-content:center;opacity:0;z-index:6;color:#1c1a17';
  const dot = `<span style="display:inline-block;position:relative;width:${vh(5.4)};height:${vh(5.4)};border-radius:50%;background:#1c1a17;margin-left:${vh(1.2)};vertical-align:0.02em">` +
    `<i style="position:absolute;left:28%;top:36%;width:17%;height:22%;border-radius:50%;background:#fff"></i><i style="position:absolute;left:58%;top:36%;width:17%;height:22%;border-radius:50%;background:#fff"></i></span>`;
  card.innerHTML =
    `<div style="font:700 ${vh(13)} 'Courier Prime',monospace;letter-spacing:.02em;position:relative">SHIFT LOCK${dot}` +
    `<div style="position:absolute;left:52%;right:9%;bottom:-${vh(1.6)};height:${vh(1.2)};background:#b3302a;opacity:.85"></div></div>` +
    `<div style="font:italic 400 ${vh(3.4)} 'Courier Prime',monospace;color:#5d564e;margin-top:${vh(6)}">a typewriter platformer about a grandmother's letter</div>` +
    `<div style="font:600 ${vh(2.4)} ${JAF};color:#5d564e;margin-top:${vh(1.2)}">おばあちゃんの手紙をめぐる、タイプライターのアクションパズル</div>` +
    `<div style="font:700 ${vh(2.8)} 'Courier Prime',monospace;margin-top:${vh(6)}">free · plays in your browser · GitHub Game Off 2026</div>`;
  document.body.appendChild(card);
  if (window.__noCaptions) { cap.style.display = 'none'; card.style.display = 'none'; }
  let cardOn = false, cardA = 0;

  const C = {
    intro1: ["gran's typewriter lost its period key.", 'おばあちゃんのタイプライターは、ピリオドのキーが折れている。'],
    intro2: ['every sentence still needs an end.', 'それでも、文には終わりがいる。'],
    shift: ['hold shift: every key on the page changes face.', 'シフトを押すと、紙の上の文字がぜんぶ姿を変える。'],
    dash: ['a dash rides the shift key like a lift.', 'ダッシュは、シフトといっしょに上下する。'],
    red: ["grandpa's red pen never shifts.", 'おじいちゃんの赤ペンだけは、シフトしない。'],
    reply: ['then you write back.', 'さいごは、きみが返事を書く。'],
  };
  const input = document.getElementById('reply-input');
  const typeChar = (ch) => { input.value += ch; input.dispatchEvent(new Event('input')); };
  const key = (k) => input.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));

  const STEPS = [
    { wait: 3.2 },
    { do: () => { say(C.intro1); S.queue(null, P.l1); S.start(0); } },
    { until: () => S.scene === 'play' }, { cue: 'l1' },
    { wait: 0.3 }, { do: () => say(C.intro2) },
    { until: () => S.scene === 'won' }, { wait: 1.0 },
    { do: () => { say(C.shift); S.queue(18, P.l3); S.start(2); } },
    { until: () => S.scene === 'play' }, { cue: 'l3' },
    { until: () => S.scene === 'won' }, { wait: 0.9 },
    { do: () => { say(C.dash); S.queue(18, P.l5); S.start(4); } },
    { until: () => S.scene === 'play' }, { cue: 'l5' },
    { until: () => S.scene === 'won' }, { wait: 0.9 },
    { do: () => { say(C.red); S.queue(9, P.l6); S.start(5); } },
    { until: () => S.scene === 'play' }, { cue: 'l6' },
    { until: () => S.scene === 'won' }, { wait: 0.9 },
    { do: () => { say(C.reply); S.start(8); } },
    { until: () => S.scene === 'reply' }, { cue: 'reply' }, { wait: 0.5 },
    { type: 'i love you too, gran', every: 0.075 },
    { wait: 0.45 }, { do: () => key('.') }, { wait: 1.7 },
    { do: () => { say(null); S.queue(11, P.reply); key('Enter'); } },
    { until: () => S.scene === 'ending' }, { cue: 'ending' }, { wait: 6.2 },
    { do: () => { cardOn = true; } }, { cue: 'card' }, { wait: 4.2 },
    { end: true },
  ];

  let i = 0, until = null, lastT = null, typed = 0;
  window.__cues = {};
  window.__director = (t) => {
    if (lastT === null) { lastT = t; window.__t0 = t; }
    const dt = Math.max(0, t - lastT); lastT = t;
    // captions: fade out, swap, fade in
    const same = capNow === capNext || (capNow && capNext && capNow[0] === capNext[0]);
    if (!same) { capA = Math.max(0, capA - dt / 0.18); if (capA === 0) { capNow = capNext; if (capNow) { cap.children[0].textContent = capNow[0]; cap.children[1].textContent = capNow[1]; } } }
    else if (capNow) capA = Math.min(1, capA + dt / 0.25);
    cap.style.opacity = capA.toFixed(3);
    cardA = cardOn ? Math.min(1, cardA + dt / 0.6) : cardA; card.style.opacity = cardA.toFixed(3);
    if (cardA > 0.5) cap.style.opacity = '0';
    // the script
    while (i < STEPS.length) {
      const s = STEPS[i];
      if (s.end) return true;
      if (s.wait != null) { if (until === null) until = t + s.wait; if (t < until - 1e-6) return false; until = null; i++; continue; }
      if (s.until) { if (!s.until()) return false; i++; continue; }
      if (s.type) {
        if (until === null) until = t;
        while (typed < s.type.length && t >= until - 1e-6) { typeChar(s.type[typed++]); until += s.every; }
        if (typed < s.type.length) return false;
        until = null; typed = 0; i++; continue;
      }
      if (s.cue) { window.__cues[s.cue] = +(t - window.__t0).toFixed(3); i++; continue; }
      if (s.do) { s.do(); i++; continue; }
      i++;
    }
    return true;
  };
})();
