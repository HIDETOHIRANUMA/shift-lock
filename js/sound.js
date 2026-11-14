// SHIFT LOCK: every sound is synthesized here (no audio files).
(function (root) {
  'use strict';
  let ac = null, master = null, noiseBuf = null, muted = false;
  let offline = false, fakeNow = null;   // set while the trailer's soundtrack is rendered offline

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return;
    ac = new AC(); graph();
  }
  function graph() {
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.7;
    master.connect(comp); comp.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const ok = () => ac && master && (offline || ac.state === 'running');
  const clock = () => (fakeNow != null ? fakeNow : ac.currentTime);
  const r = (a, b) => a + Math.random() * (b - a);

  function env(g, t, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }
  function noise(t, dur, type, freq, q, peak, dec, dest) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = r(0.9, 1.1);
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ac.createGain(); env(g, t, 0.002, peak, dec);
    s.connect(f); f.connect(g); g.connect(dest || master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur);
    return f;
  }
  function tone(t, type, f0, f1, peak, dec, dest) {
    const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dec);
    const g = ac.createGain(); env(g, t, 0.003, peak, dec);
    o.connect(g); g.connect(dest || master); o.start(t); o.stop(t + dec + 0.05);
  }

  // ---------------------------------------------------------------- music: a slow music box. Shift moves it up a fourth.
  const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];           // major pentatonic, two octaves
  const CHORDS = [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]]; // I vi IV V
  const hz = (semi) => 261.63 * Math.pow(2, semi / 12);
  let mus = null;
  function musicBus() {
    const bus = ac.createGain(); bus.gain.value = 0.55; bus.connect(master);
    const dl = ac.createDelay(1); dl.delayTime.value = 0.42;
    const fb = ac.createGain(); fb.gain.value = 0.33;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    const send = ac.createGain(); send.gain.value = 0.5;
    bus.connect(send); send.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(bus);
    return bus;
  }
  function pluck(t, semi, peak, dec) {
    tone(t, 'sine', hz(semi), 0, peak, dec, mus.bus);
    tone(t, 'sine', hz(semi) * 2, 0, peak * 0.16, dec * 0.45, mus.bus);
  }
  function pad(t, semi) {
    const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = hz(semi);
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 850;
    const g = ac.createGain(); env(g, t, 0.7, 0.03, 3.8);
    o.connect(f); f.connect(g); g.connect(mus.bus); o.start(t); o.stop(t + 4.7);
  }
  function musicTick() {
    if (!ok() || !mus || mus.stopped || (offline && fakeNow == null)) return;
    const now = clock();
    if (mus.next < now) mus.next = now + 0.05;
    while (mus.next < now + 0.35) {
      const t = mus.next, key = mus.shift ? 5 : 0, beat = mus.beat++;
      if (beat % 8 === 0) for (const s of CHORDS[(beat / 8) % 4]) pad(t, s + key - 12);
      if (beat % 8 !== 7 && Math.random() < 0.5) {
        mus.idx = Math.max(0, Math.min(SCALE.length - 1, mus.idx + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]));
        pluck(t, SCALE[mus.idx] + key, 0.075, 1.7);
      }
      mus.next += 0.62;
    }
  }

  const S = {
    init,
    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.7; },
    get muted() { return muted; },
    // a type bar hitting the platen
    clack(v = 1) {
      if (!ok()) return; const t = clock() + 0.005;
      noise(t, 0.08, 'bandpass', r(1900, 2900), 1.1, 0.55 * v, 0.035);
      noise(t, 0.06, 'highpass', 5200, 0.7, 0.18 * v, 0.02);
      tone(t, 'sine', r(150, 190), 70, 0.35 * v, 0.05);
    },
    space(v = 1) {
      if (!ok()) return; const t = clock() + 0.005;
      noise(t, 0.09, 'bandpass', 900, 1.4, 0.32 * v, 0.05);
      tone(t, 'sine', 110, 60, 0.3 * v, 0.06);
    },
    // the whole type basket shifting
    shift(up) {
      if (!ok()) return; const t = clock() + 0.005;
      noise(t, 0.12, 'bandpass', up ? 700 : 560, 2.2, 0.5, 0.07);
      tone(t, 'triangle', up ? 1320 : 1180, up ? 1480 : 990, 0.08, 0.06);
      tone(t, 'sine', up ? 95 : 80, 55, 0.4, 0.08);
      noise(t + 0.045, 0.06, 'bandpass', 2300, 1.2, 0.22, 0.03);
    },
    jam() {
      if (!ok()) return; const t = clock() + 0.005;
      tone(t, 'square', 118, 92, 0.11, 0.16); tone(t, 'square', 124, 97, 0.09, 0.16);
      noise(t, 0.14, 'bandpass', 420, 3, 0.45, 0.1);
      noise(t + 0.06, 0.08, 'bandpass', 1500, 4, 0.25, 0.05);
    },
    jump() {
      if (!ok()) return; const t = clock() + 0.005;
      tone(t, 'sine', 520, 900, 0.12, 0.07);
      noise(t, 0.04, 'highpass', 4200, 0.8, 0.08, 0.02);
    },
    land(v) {
      if (!ok()) return; const t = clock() + 0.005; const k = Math.min(1, v);
      noise(t, 0.06, 'lowpass', 900, 0.8, 0.2 + 0.35 * k, 0.04);
      tone(t, 'sine', 140, 70, 0.15 + 0.2 * k, 0.05);
    },
    carry(up) {
      if (!ok()) return; const t = clock() + 0.005;
      tone(t, 'triangle', up ? 300 : 700, up ? 820 : 260, 0.13, 0.12);
      noise(t, 0.12, 'bandpass', up ? 1600 : 900, 1.5, 0.2, 0.09);
    },
    // carriage return: ratchet and slide
    carriage(dur = 0.45) {
      if (!ok()) return; const t = clock() + 0.005;
      const f = noise(t, dur + 0.1, 'bandpass', 2400, 1.6, 0.16, dur);
      f.frequency.exponentialRampToValueAtTime(700, t + dur);
      for (let i = 0; i < 9; i++) noise(t + i * dur / 10, 0.03, 'bandpass', 3200, 3, 0.18, 0.012);
      noise(t + dur, 0.1, 'bandpass', 600, 1.5, 0.4, 0.06);
    },
    linefeed() {
      if (!ok()) return; const t = clock() + 0.005;
      for (let i = 0; i < 2; i++) noise(t + i * 0.06, 0.04, 'bandpass', 2600, 4, 0.22, 0.02);
    },
    bell() {
      if (!ok()) return; const t = clock() + 0.01;
      [[1, 0.32, 1.6], [2.01, 0.12, 0.9], [2.76, 0.09, 0.7], [5.4, 0.04, 0.4]].forEach(([m, a, d]) => tone(t, 'sine', 1568 * m, 0, a, d));
    },
    fall() {
      if (!ok()) return; const t = clock() + 0.005;
      tone(t, 'sine', 820, 130, 0.12, 0.45);
      noise(t + 0.35, 0.12, 'lowpass', 500, 0.7, 0.25, 0.08);
    },
    // background music (starts once, after the first key press)
    music() {
      if (!ok()) return;
      if (!mus) { mus = { bus: musicBus(), next: clock() + 0.4, beat: 0, idx: 3, shift: false, stopped: false }; if (!offline) setInterval(musicTick, 100); }
      else if (mus.stopped) { mus.stopped = false; mus.beat = 0; mus.next = clock() + 0.6; }
    },
    musicShift(m) { if (mus) mus.shift = !!m; },
    // the last chord of the letter
    musicEnd() {
      if (!ok() || !mus) return; mus.stopped = true;
      const t = clock() + 0.3;
      [0, 4, 7, 12, 16].forEach((s, i) => pluck(t + i * 0.2, s, 0.09, 2.6));
      for (const s of [0, 4, 7]) pad(t, s - 12);
    },
    // the trailer recorder: play back a log of sound calls into an offline buffer
    async renderOffline(events, dur, rate = 48000) {
      const OAC = root.OfflineAudioContext || root.webkitOfflineAudioContext;
      const keep = { ac, master, noiseBuf, mus, muted };
      ac = new OAC(2, Math.ceil(dur * rate), rate); offline = true; muted = false; mus = null; graph();
      let tick = 0;
      const runMusic = (until) => { while (mus && !mus.stopped && tick <= until) { fakeNow = tick; musicTick(); tick += 0.1; } };
      for (const e of events) {
        runMusic(e.t);
        fakeNow = e.t; if (typeof S[e.name] === 'function') S[e.name](...e.args);
        if (e.name === 'music') tick = Math.max(tick, e.t);
      }
      runMusic(dur); fakeNow = null;
      const buf = await ac.startRendering();
      ac = keep.ac; master = keep.master; noiseBuf = keep.noiseBuf; mus = keep.mus; muted = keep.muted; offline = false;
      return buf;
    },
    blocked() { // the broken period key
      if (!ok()) return; const t = clock() + 0.005;
      noise(t, 0.08, 'bandpass', 300, 2, 0.5, 0.06); tone(t, 'square', 70, 50, 0.08, 0.1);
    },
  };
  root.SOUND = S;
})(window);
