/* ============================================================================
   The story campaign.  Chapter titles and log entries are main.lang 366-421,
   the scenes are the 47 dialogue packs.  The MIDlet keeps the speaker of each
   line in code rather than in the language file, so the speaker maps are
   reconstructed here, line for line.
   ========================================================================== */
'use strict';

const Campaign = (() => {

  /* speakers:  . narration   m M.A.I.   p player   j Jack Dawn   r Pierre
                l Lea         a Ayumi    y Raymond  f Fenko       g other     */
  const SPK = {
    0: '......mpmhph', 1: 'jpjmp', 2: 'm', 3: 'mh', 4: 'hhmpmgph',
    5: 'jmjpj', 6: 'mpmpm', 7: 'gpgmh', 8: 'jpjpj', 9: 'mpjpmp',
    10: 'jmpmpmpm', 11: 'mgpgpgmgrpmrprprp', 12: 'mpmplplpmlplplplmpm',
    13: 'mlplplplp', 14: 'mplplplpl', 15: 'mpmp', 16: 'grmrprprm',
    17: 'apapapapampm', 18: 'ampmpamp', 19: 'apapapapapam',
    20: 'ypympyyyaypymp', 21: 'apapapapa', 22: 'mma', 23: 'lplplpmplapapa',
    24: 'mjaaypla' + 'mpmampapapa', 25: 'mpypympmp',
    26: 'myaypmpmpypypmpypypmpyypmmm',
    27: 'apapa', 28: 'mgga', 29: 'lpr' + 'apapapa' + 'lra',
    30: 'rrgrmr', 31: 'apamp' + 'apapapapapap',
    32: 'mp', 33: 'fpfpfpfpf', 34: 'mgpp', 35: 'fpfpfmp', 36: 'mp',
    37: 'apamapmpmp', 38: 'pm', 39: 'mpmp', 40: 'lmplpmpm',
    41: 'mpgmmp', 42: 'mljpjmljpmpa', 43: 'papapapapapa',
    44: 'gmpgmpg', 45: 'mplplplpl',
    46: 'ajppjpjlaajpmjmpjjmj' + 'plpmpm' + 'aaalpm'
  };
  /* fixed portrait seeds so each character always looks the same */
  const SEED = { j: 268, r: 91, l: 617, a: 733, y: 415, f: 152, g: 884, p: -1, m: -1, '.': null };
  const NAME = { m: 'M.A.I.', j: 'Jack Dawn', r: 'Pierre', l: 'Lea', a: 'Ayumi', y: 'Raymond', f: 'Fenko', g: '', '.': '' };

  /* Every chapter: log entry (title/text index in main.lang) plus a list of
     beats.  A beat plays a dialogue and then waits for a condition. */
  const CH = [
    { t: -1, x: -1, beats: [
      { dlg: 0, at: 'launch' },
      { goal: 'catch', n: 1, hint: 337 },
      { goal: 'dock', station: 'Gosu', hint: 338 },
      { dlg: 1, at: 'dock' }
    ] },
    { t: 366, x: 367, beats: [
      { goal: 'ownGun', hint: 288 },
      { dlg: 2, at: 'dock' }
    ] },
    { t: 368, x: 369, beats: [
      { dlg: 3, at: 'launch' },
      { goal: 'sector', kind: 'pirates', n: 1, dlg: 4, hint: 340 },
      { goal: 'dock', station: 'Gosu', hint: 339 }
    ] },
    { t: 370, x: 371, beats: [
      { dlg: 5, at: 'dock' },
      { goal: 'sector', kind: 'nautilus', n: 4, station: 'Darhoven', dlg: 6 },
      { goal: 'dock', station: 'Darhoven' },
      { dlg: 7, at: 'dock' }
    ] },
    { t: 372, x: 373, beats: [
      { goal: 'jobs', n: 3 },
      { dlg: 8, at: 'dock' }
    ] },
    { t: 374, x: 375, beats: [
      { goal: 'sector', kind: 'capsules', n: 6, station: 'Cho', dlg: 9 },
      { goal: 'dock', station: 'Cho' },
      { dlg: 10, at: 'dock' }
    ] },
    { t: 376, x: 377, beats: [
      { goal: 'dock', station: 'Talon' },
      { dlg: 11, at: 'dock' }
    ] },
    { t: 378, x: 379, beats: [
      { goal: 'dock', station: 'Gaja' },
      { dlg: 12, at: 'dock' }
    ] },
    { t: 380, x: 381, beats: [
      { goal: 'dock', station: 'Holos' },
      { dlg: 13, at: 'dock' }
    ] },
    { t: 382, x: 383, beats: [
      { goal: 'produce', n: 5 },
      { dlg: 14, at: 'dock' }
    ] },
    { t: 384, x: 385, beats: [
      { goal: 'visit', n: 6 },
      { dlg: 15, at: 'dock' },
      { goal: 'dock', station: 'Talon' },
      { dlg: 16, at: 'dock' }
    ] },
    { t: 386, x: 387, beats: [
      { goal: 'dockRebel' },
      { dlg: 17, at: 'dock' }
    ] },
    { t: 388, x: 389, beats: [
      { goal: 'sector', kind: 'protect', n: 5, dlg: 18 },
      { goal: 'dock' }
    ] },
    { t: 390, x: 391, beats: [
      { dlg: 19, at: 'dock' },
      { goal: 'sector', kind: 'gang', n: 5, dlg: 20 },
      { goal: 'dock', station: 'Shiva' }
    ] },
    { t: 392, x: 393, beats: [
      { dlg: 21, at: 'dock' },
      { goal: 'sector', kind: 'mines', n: 6, dlg: 22 },
      { goal: 'dock', station: 'Shiva' }
    ] },
    { t: 394, x: 395, beats: [
      { dlg: 23, at: 'dock' },
      { goal: 'sector', kind: 'escortAyumi', n: 6, station: 'Sula', dlg: 24 },
      { goal: 'dock', station: 'Sula' }
    ] },
    { t: 396, x: 397, beats: [
      { goal: 'kills', n: 12 },
      { dlg: 25, at: 'dock' }
    ] },
    { t: 398, x: 399, beats: [
      { goal: 'sector', kind: 'raymond', n: 1, station: 'Goblor', dlg: 26 },
      { goal: 'dock', station: 'Pecibel' },
      { dlg: 27, at: 'dock' }
    ] },
    { t: 400, x: 401, beats: [
      { goal: 'sector', kind: 'convoyGuard', n: 5, station: 'Fiir', dlg: 28 },
      { goal: 'dock', station: 'Fiir' },
      { dlg: 29, at: 'dock' }
    ] },
    { t: 402, x: 403, beats: [
      { goal: 'sector', kind: 'convoyRaid', n: 5, station: 'Cho', dlg: 30 },
      { goal: 'dock', station: 'Fiir' },
      { dlg: 31, at: 'dock' }
    ] },
    { t: 404, x: 405, beats: [
      { goal: 'dock', station: 'Choral' },
      { dlg: 32, at: 'dock' },
      { dlg: 33, at: 'dock', log: 407 },
      { goal: 'sector', kind: 'raoul', n: 3, dlg: 34 },
      { goal: 'dock', station: 'Choral' },
      { dlg: 35, at: 'dock', log: 408, eclipse: true },
      { goal: 'ownEclipse' },
      { dlg: 36, at: 'launch' },
      { goal: 'dock', station: 'Fiir' },
      { dlg: 37, at: 'dock' }
    ] },
    { t: 409, x: 410, beats: [
      { goal: 'dock', station: 'Wagoll' },
      { dlg: 38, at: 'dock' },
      { goal: 'produce', n: 3 },
      { dlg: 39, at: 'dock', log: 411 },
      { goal: 'dock', station: 'Fiir' },
      { dlg: 40, at: 'dock' }
    ] },
    { t: 412, x: 413, beats: [
      { goal: 'sector', kind: 'eclipseTest', n: 6, dlg: 41 },
      { goal: 'dock', station: 'Fiir' }
    ] },
    { t: 414, x: 415, beats: [
      { goal: 'sector', kind: 'defendFiir', n: 8, station: 'Fiir', dlg: 42 },
      { goal: 'dock', station: 'Fiir' },
      { dlg: 43, at: 'dock' }
    ] },
    { t: 416, x: 417, beats: [
      { goal: 'sector', kind: 'offensive', n: 8, station: 'Zavnek', dlg: 44 },
      { goal: 'dock', station: 'Zavnek' },
      { dlg: 45, at: 'dock' }
    ] },
    { t: 418, x: 419, beats: [
      { goal: 'sector', kind: 'final', n: 10, station: 'Gosu', dlg: 46, last: true },
      { goal: 'end' }
    ] }
  ];

  /* stations that join the rebellion as the story advances */
  const REBEL_WAVES = {
    6: ['Talon'], 8: ['Gaja', 'Holos'], 11: ['Shiva', 'Avita', 'Sula'],
    15: ['Goblor', 'Pecibel', 'Fiir'], 19: ['Choral', 'Wagoll'],
    23: ['Zavnek', 'Balthasar', 'Obsulkesh'], 25: ['Gosu']
  };

  function chapter() { return CH[Math.min(World.state().chapter, CH.length - 1)]; }
  function beat() {
    const c = chapter();
    return c.beats[Math.min(World.state().chapterStep, c.beats.length - 1)];
  }
  function done() { return World.state().chapter >= CH.length; }

  /* The current objective, spelled out the way the original log does it. */
  function hint() {
    if (done()) return GameData.T(352);
    const W = World.state(), b = beat();
    if (!b) return '';
    if (b.hint) return GameData.T(b.hint);
    switch (b.goal) {
      case 'catch': return GameData.T(337);
      case 'dock': return b.station ? GameData.T(420).replace('#', b.station) : GameData.T(24);
      case 'dockRebel': return GameData.T(386);
      case 'jobs': return GameData.T(372) + ': ' + W.stats.missions + '/' + b.n;
      case 'produce': return GameData.T(382) + ': ' + W.stats.goodsProduced + '/' + b.n;
      case 'visit': return GameData.T(314) + ': ' + W.stats.stationsVisited + '/' + b.n;
      case 'kills': return GameData.T(72) + ': ' + W.stats.kills + '/' + b.n;
      case 'ownGun': return GameData.T(288);
      case 'ownEclipse': return GameData.T(289);
      case 'sector': {
        const st = b.station ? b.station : GameData.stations[W.station].name;
        return GameData.T(420).replace('#', st);
      }
      case 'end': return GameData.T(419);
      default:
        if (b.at === 'launch') return GameData.T(241);      /* undock */
        if (b.at === 'dock') return GameData.T(24);         /* dock */
        return '';
    }
  }

  function logEntry() {
    const W = World.state();
    const c = chapter();
    if (!c) return null;
    const b = beat();
    let title = c.t >= 0 ? GameData.T(c.t) : GameData.T(26);
    let text = c.x >= 0 ? GameData.T(c.x) : '';
    if (b && b.log) text = GameData.T(b.log);
    const h = hint();
    if (h) text = (text ? text + '\n\n' : '') + h;
    return { story: true, id: -1 - W.chapter, title, text, target: targetStation(), type: 0, done: false, reward: 0 };
  }
  function targetStation() {
    const b = beat();
    if (b && b.station) { const i = World.byName(b.station); if (i >= 0) return i; }
    if (b && b.goal === 'dock' && b.station) return World.byName(b.station);
    return World.state().station;
  }

  function advance() {
    const W = World.state();
    const c = chapter();
    W.chapterStep++;
    if (W.chapterStep >= c.beats.length) {
      W.chapter++;
      W.chapterStep = 0;
      applyRebelWave();
      if (W.chapter >= CH.length) W.flags.liberated = true;
      Sfx.play('message');
    }
    World.autosave();
  }
  function applyRebelWave() {
    const wave = REBEL_WAVES[World.state().chapter];
    if (!wave) return;
    for (const n of wave) World.setRebel(World.byName(n), true);
  }

  /* --------------------------------------------------------------- events */
  /* Returns a dialogue id to play, or null. */
  function onDock() {
    const W = World.state();
    if (done()) return null;
    const b = beat();
    if (!b) return null;
    if (b.dlg !== undefined && b.at === 'dock') return b.dlg;
    if (b.goal === 'dock') {
      if (!b.station || W.station === World.byName(b.station)) { advance(); return onDock(); }
    }
    if (b.goal === 'dockRebel' && World.isRebel(W.station)) { advance(); return onDock(); }
    if (b.goal === 'jobs' && W.stats.missions >= b.n) { advance(); return onDock(); }
    if (b.goal === 'produce' && W.stats.goodsProduced >= b.n) { advance(); return onDock(); }
    if (b.goal === 'visit' && W.stats.stationsVisited >= b.n) { advance(); return onDock(); }
    if (b.goal === 'kills' && W.stats.kills >= b.n) { advance(); return onDock(); }
    if (b.goal === 'ownGun' && World.fitted(GameData.EQ.GUN).length > 0) { advance(); return onDock(); }
    if (b.goal === 'ownEclipse' && World.state().ship.slots.indexOf(42) >= 0) { advance(); return onDock(); }
    if (b.goal === 'end') { W.flags.liberated = true; advance(); return null; }
    return null;
  }
  function onLaunch() {
    if (done()) return null;
    const b = beat();
    if (b && b.dlg !== undefined && b.at === 'launch') return b.dlg;
    return null;
  }
  function dialogueDone() {
    const b = beat();
    if (b && b.dlg !== undefined) {
      if (b.eclipse) World.state().flags.eclipseForSale = World.state().station;
      advance();
      return true;
    }
    return false;
  }
  function onCatch() {
    const b = beat();
    if (b && b.goal === 'catch') { advance(); return true; }
    return false;
  }
  function sectorBeat() {
    const b = beat();
    return (b && b.goal === 'sector') ? b : null;
  }
  function sectorCleared() {
    const b = beat();
    if (b && b.goal === 'sector') { advance(); return true; }
    return false;
  }

  /* --------------------------------------------------------- dialogue play */
  /* A playable scene: [{who, name, face, text}] */
  async function scene(n) {
    const lines = await GameData.dialogue(n);
    const map = SPK[n] || '';
    const W = World.state();
    return lines.map((t, i) => {
      const who = map[i] || 'm';
      return {
        who,
        name: who === 'p' ? W.name : (NAME[who] || ''),
        face: who === 'm' ? 'mai' : null,
        portrait: who === 'p' ? W.face : (who === 'm' || who === '.' ? null : SEED[who]),
        text: t.replace(/#/g, W.name)
      };
    });
  }

  return { CH, chapter, beat, done, hint, logEntry, advance, onDock, onLaunch, onCatch,
           dialogueDone, sectorBeat, sectorCleared, scene, targetStation, applyRebelWave };
})();
