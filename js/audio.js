/* ============================================================================
   Audio.  The MIDlet ships AMR clips and two MIDI tracks, neither of which a
   browser can decode, so the sound design is reproduced with WebAudio: the
   same cue set (sonar, harpoon, mine, gate, alert, explosion...) plus the
   ambient drone and the station theme.
   ========================================================================== */
'use strict';

const Sfx = (() => {
  let ctx = null, master = null, musicGain = null, sfxGain = null;
  let musicTimer = 0, musicStep = 0, musicMode = null, ambNode = null;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.32; musicGain.connect(master);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.8; sfxGain.connect(master);
    return ctx;
  }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

  function tone(f0, f1, dur, type, vol, dest) {
    if (!ensure()) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f0, ctx.currentTime);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), ctx.currentTime + dur);
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(vol === undefined ? 0.3 : vol, ctx.currentTime + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0008, ctx.currentTime + dur);
    o.connect(g); g.connect(dest || sfxGain);
    o.start(); o.stop(ctx.currentTime + dur + 0.02);
  }
  function noise(dur, filt, vol, sweepTo) {
    if (!ensure()) return;
    const n = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const b = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ctx.createBufferSource(); s.buffer = b;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(filt, ctx.currentTime);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(60, sweepTo), ctx.currentTime + dur);
    const g = ctx.createGain(); g.gain.value = vol === undefined ? 0.4 : vol;
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    s.connect(f); f.connect(g); g.connect(sfxGain);
    s.start(); s.stop(ctx.currentTime + dur);
  }

  const CUES = {
    beep:      () => tone(880, 880, 0.05, 'square', 0.16),
    select:    () => tone(1320, 1760, 0.07, 'square', 0.16),
    back:      () => tone(660, 440, 0.08, 'square', 0.14),
    deny:      () => tone(220, 160, 0.16, 'sawtooth', 0.18),
    money:     () => { tone(1046, 1046, 0.07, 'triangle', 0.2); setTimeout(() => tone(1568, 1568, 0.1, 'triangle', 0.18), 60); },
    railgun:   () => { tone(340, 90, 0.1, 'square', 0.2); noise(0.09, 2600, 0.22, 500); },
    coilgun:   () => { tone(1500, 300, 0.16, 'sawtooth', 0.16); },
    fusion:    () => { tone(180, 60, 0.22, 'sawtooth', 0.2); noise(0.2, 900, 0.22, 160); },
    massdriver:() => { tone(120, 40, 0.3, 'square', 0.24); noise(0.28, 500, 0.25, 90); },
    eclipse:   () => { tone(90, 30, 0.55, 'sawtooth', 0.3); noise(0.5, 1800, 0.3, 80); },
    torpedo:   () => { noise(0.5, 800, 0.2, 200); },
    harpoon:   () => { tone(700, 1500, 0.12, 'triangle', 0.2); },
    harpoonHit:() => { tone(300, 900, 0.14, 'triangle', 0.22); },
    hit:       () => { noise(0.12, 1400, 0.3, 300); },
    explosion: () => { noise(0.75, 1100, 0.5, 70); tone(120, 35, 0.5, 'sawtooth', 0.22); },
    mine:      () => { noise(1.0, 900, 0.55, 50); tone(90, 28, 0.7, 'square', 0.25); },
    alert:     () => { tone(1200, 700, 0.18, 'square', 0.2); setTimeout(() => tone(1200, 700, 0.18, 'square', 0.2), 200); },
    sonar:     () => { tone(1760, 1760, 0.5, 'sine', 0.16); },
    gate:      () => { tone(80, 1400, 0.9, 'sine', 0.24); noise(0.9, 3000, 0.16, 400); },
    dock:      () => { tone(220, 440, 0.3, 'triangle', 0.2); setTimeout(() => tone(330, 660, 0.35, 'triangle', 0.18), 160); },
    turbo:     () => { noise(0.6, 400, 0.3, 1600); },
    pickup:    () => { tone(660, 1320, 0.1, 'square', 0.18); },
    message:   () => { tone(1046, 1568, 0.09, 'sine', 0.2); setTimeout(() => tone(1568, 2093, 0.09, 'sine', 0.16), 90); },
    medal:     () => { [0, 120, 240, 420].forEach((d, i) => setTimeout(() => tone([784, 988, 1175, 1568][i], [784, 988, 1175, 1568][i], 0.25, 'triangle', 0.2), d)); },
    fail:      () => { [0, 130, 300].forEach((d, i) => setTimeout(() => tone([392, 330, 233][i], [392, 330, 200][i], 0.3, 'sawtooth', 0.2), d)); }
  };
  function play(name) { if (enabled.sfx && CUES[name]) { ensure(); resume(); CUES[name](); } }

  const enabled = { sfx: true, music: true };
  function setSfx(v) { enabled.sfx = v; }
  function setMusic(v) {
    enabled.music = v;
    if (!v) stopMusic();
  }

  /* --- ambience + music ---------------------------------------------------- */
  const THEME_STATION = [0, 3, 7, 10, 7, 3, 5, 8, 12, 8, 5, 3];
  const THEME_INTRO = [0, 7, 12, 10, 7, 5, 3, 5, 7, 12, 15, 12];
  function startAmbient() {
    if (!enabled.music || !ensure()) return;
    stopAmbient();
    const n = ctx.sampleRate * 2;
    const b = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(); s.buffer = b; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 180; f.Q.value = 2;
    const g = ctx.createGain(); g.gain.value = 0.1;
    s.connect(f); f.connect(g); g.connect(musicGain);
    s.start();
    ambNode = { s, g };
  }
  function stopAmbient() { if (ambNode) { try { ambNode.s.stop(); } catch (e) { } ambNode = null; } }

  function music(mode) {
    if (musicMode === mode) return;
    musicMode = mode;
    clearInterval(musicTimer); musicTimer = 0; musicStep = 0;
    stopAmbient();
    if (!enabled.music || mode === null) return;
    ensure(); resume();
    if (mode === 'flight') { startAmbient(); return; }
    const theme = mode === 'intro' ? THEME_INTRO : THEME_STATION;
    const root = mode === 'intro' ? 174.6 : 130.8;
    musicTimer = setInterval(() => {
      if (!enabled.music) return;
      const n = theme[musicStep % theme.length];
      const f = root * Math.pow(2, n / 12);
      tone(f, f, 0.5, 'triangle', 0.12, musicGain);
      if (musicStep % 4 === 0) tone(f / 2, f / 2, 0.9, 'sine', 0.14, musicGain);
      musicStep++;
    }, 430);
  }
  function stopMusic() { clearInterval(musicTimer); musicTimer = 0; musicMode = null; stopAmbient(); }

  return { play, music, stopMusic, setSfx, setMusic, resume, ensure, enabled };
})();
