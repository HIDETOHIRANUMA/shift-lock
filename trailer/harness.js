// Trailer harness, injected before the game loads: virtual time, seeded randomness,
// virtual timers, manual frames and a log of every sound call (rendered offline later).
(() => {
  let vt = 0;                                   // virtual milliseconds
  performance.now = () => vt;
  let seed = 20261201;
  Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const timers = []; let tid = 1;
  window.setTimeout = (fn, ms, ...a) => { const id = tid++; timers.push({ id, t: vt + (+ms || 0), fn, a }); return id; };
  window.setInterval = (fn, ms, ...a) => { const id = tid++; timers.push({ id, t: vt + Math.max(1, +ms || 1), fn, a, every: Math.max(1, +ms || 1) }); return id; };
  window.clearTimeout = window.clearInterval = (id) => { const k = timers.findIndex((x) => x.id === id); if (k >= 0) timers.splice(k, 1); };
  let rafCb = null;
  window.requestAnimationFrame = (cb) => { rafCb = cb; return 1; };
  window.cancelAnimationFrame = () => { rafCb = null; };
  try {
    localStorage.setItem('shiftlock.ja', 'false');
    localStorage.setItem('shiftlock.line', '0');
    localStorage.setItem('shiftlock.muted', 'false');
    localStorage.removeItem('shiftlock.best');
  } catch (e) { /* ignore */ }

  window.__ready = () => !!rafCb && !!window.SHIFTLOCK && !!window.SOUND;
  window.__vt = () => vt / 1000;
  // one video frame: advance time, fire due timers, run the game's frame, then the director
  window.__frame = (ms) => {
    vt += ms;
    for (;;) {
      timers.sort((a, b) => a.t - b.t);
      const x = timers[0];
      if (!x || x.t > vt) break;
      if (x.every) x.t += x.every; else timers.shift();
      try { x.fn(...(x.a || [])); } catch (e) { console.error(e); }
    }
    const cb = rafCb; rafCb = null;
    if (cb) cb(vt);
    return window.__director ? window.__director(vt / 1000) : true;
  };

  window.__soundLog = []; window.__logOn = true; window.__t0 = 0;
  window.__installSoundLog = () => {
    const S = window.SOUND;
    for (const k of Object.keys(S)) {
      if (['init', 'setMuted', 'muted', 'renderOffline'].includes(k)) continue;
      const f = S[k]; if (typeof f !== 'function') continue;
      S[k] = (...a) => { if (window.__logOn) window.__soundLog.push({ name: k, args: a, t: vt / 1000 }); return f.apply(S, a); };
    }
  };
  // render the logged sound calls to a 16-bit stereo WAV, returned as base64
  window.__renderAudio = async (dur) => {
    window.__logOn = false;
    const ev = JSON.parse(JSON.stringify(window.__soundLog)).map((e) => ({ ...e, t: e.t - window.__t0 })).filter((e) => e.t >= 0 && e.t < dur);
    const buf = await window.SOUND.renderOffline(ev, dur);
    const n = buf.length, rate = buf.sampleRate, ch = [buf.getChannelData(0), buf.getChannelData(buf.numberOfChannels > 1 ? 1 : 0)];
    const bytes = new Uint8Array(44 + n * 4), dv = new DataView(bytes.buffer);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) bytes[o + i] = s.charCodeAt(i); };
    w(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); w(8, 'WAVE'); w(12, 'fmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true); dv.setUint32(24, rate, true);
    dv.setUint32(28, rate * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, n * 4, true);
    let o = 44, peak = 0;
    for (let i = 0; i < n; i++) for (let c = 0; c < 2; c++) {
      const v = Math.max(-1, Math.min(1, ch[c][i])); peak = Math.max(peak, Math.abs(v));
      dv.setInt16(o, v < 0 ? v * 32768 : v * 32767, true); o += 2;
    }
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return { b64: btoa(s), events: ev.length, peak };
  };
})();
