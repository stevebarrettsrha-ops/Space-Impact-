/* ============================================================================
   DEEP - Submarine Odyssey
   Boot, input, the screen state machine and the mission runner.
   ========================================================================== */
'use strict';

/* ------------------------------------------------------------------ input */
const Input = (() => {
  const down = {}, edge = {};
  const MAP = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    KeyW: 'up', KeyS2: 'down', KeyA: 'left', KeyD: 'right',
    Space: 'fire', Enter: 'fire', Numpad5: 'fire', Digit5: 'fire',
    Escape: 'back', Backspace: 'back',
    Digit1: 'weapon', Digit7: 'autofire', Digit3: 'boost', Digit9: 'autopilot',
    Digit0: 'action', KeyC: 'camera', Digit2: 'throttleUp', Digit8: 'throttleDown',
    KeyX: 'sell', Tab: 'species', KeyP: 'pause', KeyH: 'help', KeyM: 'map'
  };
  let text = '', capture = false;
  function key(e) {
    if (e.code === 'KeyS') return e.shiftKey ? 'sell' : 'down';
    return MAP[e.code];
  }
  window.addEventListener('keydown', e => {
    if (capture) {
      if (e.key.length === 1 && text.length < 14) text += e.key;
      else if (e.code === 'Backspace') text = text.slice(0, -1);
      if (e.code !== 'Enter' && e.code !== 'Escape') { e.preventDefault(); return; }
    }
    const k = key(e);
    if (!k) return;
    e.preventDefault();
    if (!down[k]) edge[k] = true;
    down[k] = true;
    Sfx.resume();
  });
  window.addEventListener('keyup', e => { const k = key(e); if (k) down[k] = false; });
  window.addEventListener('blur', () => { for (const k in down) down[k] = false; });

  function virtual(name, on) {
    if (on) { if (!down[name]) edge[name] = true; down[name] = true; }
    else down[name] = false;
    Sfx.resume();
  }
  function pressed(n) { return !!edge[n]; }
  function held(n) { return !!down[n]; }
  function axisX() { return (held('right') ? 1 : 0) - (held('left') ? 1 : 0) + (stick.x || 0); }
  function axisY() { return (held('up') ? 1 : 0) - (held('down') ? 1 : 0) - (stick.y || 0); }
  const stick = { x: 0, y: 0 };
  function endFrame() { for (const k in edge) edge[k] = false; }
  function startText(t) { capture = true; text = t || ''; }
  function stopText() { capture = false; return text; }
  function getText() { return text; }
  return { pressed, held, axisX, axisY, endFrame, virtual, stick, startText, stopText, getText, MAP };
})();

/* ------------------------------------------------------------------- game */
const Game = (() => {

  const IMG = {}, MODELS = {}, TEX = {};
  const FACE_IDS = [];
  let mode = 'boot', ctx = null, last = 0, acc = 0;
  let bootMsg = 'LOADING', bootPct = 0;
  let splash = { i: 0, t: 0 };
  let menuSel = 0, settingSel = 0, resultData = null, pauseSel = 0;
  let scene = null, sceneIdx = 0, sceneAfter = null, sceneT = 0;
  let newGame = { step: 0, face: 0, diff: 1 };
  let travel = null;
  let missionCtx = null;

  /* ---------------------------------------------------------------- assets */
  const UI_IMAGES = [
    'abyss', 'fishlabs', 'logo', 'logo_0', 'logo_1', 'logo_2', 'mai', 'font_deep_white',
    'arrow', 'arrows', 'skip', 'menu', 'lock', 'crosshair', 'numbers', 'coin', 'coins', 'coin_red',
    'crate', 'hull', 'hull_icon', 'i_autofire', 'i_autopilot', 'i_bar', 'i_barend', 'i_booster',
    'i_harpoon', 'i_hull', 'i_laser', 'i_shield', 'i_weight', 'i_weight_box',
    'display_pressure', 'display_radiation', 'display_warning_pressure', 'display_warning_radiation',
    'map_pressure', 'map_radiation', 'cargo_recovery', 'cargo_salvage',
    'p_colonists_0', 'p_colonists_1', 'p_colonists_big_0', 'p_rebels_0', 'p_rebels_1',
    'p_rebels_big_0', 'p_home', 'p_home_big', 'p_mask', 'p_mask_big', 'p_mission', 'p_mission_big',
    'radar_logo_0', 'radar_logo_1', 'x_1', 'x_2', 'x_3',
    'c_b_f', 'c_b_s', 'c_g_f', 'c_g_s', 'c_go_f', 'c_go_s',
    'bracket_box', 'bracket_creature_in', 'bracket_creature_out',
    'bracket_enemy_far', 'bracket_enemy_in', 'bracket_enemy_out',
    'bracket_friend_far', 'bracket_friend_in', 'bracket_friend_out',
    'bracket_landmark_in', 'bracket_landmark_out',
    'bracket_waypoint_far', 'bracket_waypoint_in', 'bracket_waypoint_out',
    'bubble_0', 'bubble_1', 'bubble_2', 'bubble_3', 'bubble_4', 'bubble_5'
  ];
  const MODEL_NAMES = [
    'u0', 'u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8', 'u9', 'u10',
    'nautilus', 'gulper_eel', 'jellyfish', 'manta', 'fish_swarm',
    'anglerfish_01', 'anglerfish_02', 'devilfish_01', 'devilfish_02',
    'marlin_01', 'marlin_02', 'shark_01', 'shark_02', 'shrimp_01', 'shrimp_02',
    'squid_01', 'squid_02', 'turtle_01', 'turtle_02', 'whale_01', 'whale_02',
    'alga_gold', 'alga_blue', 'alga_brown', 'alga_red', 'alga_green',
    'box', 'trash', 'mine', 'torpedo', 'kapsel', 'stream', 'skybox', 'explosion',
    'eclipse', 'biowaste', 'fischtod', 'pfeil', 'aquar', 'tanker1', 'limiter_up', 'limiter_down',
    'laser_0', 'laser_1', 'laser_2', 'laser_6', 'laser_7', 'laser_8', 'laser_9',
    'laser_10', 'laser_11', 'laser_aqua',
    'station_starter', 'station_top', 'station_bottom', 'station_engine', 'station_cannon',
    'station_bridge_01', 'station_bridge_02', 'station_sidehabitat',
    'station_hangar_de', 'station_hangar_ve', 'station_habitat_de', 'station_habitat_ve'
  ];

  /* which atlas each mesh is painted from: the creatures and every effect
     come off fx.bmp, the hardware and the world off deep.bmp */
  const FX_TEXTURED = new Set([
    'nautilus', 'gulper_eel', 'jellyfish', 'manta', 'fish_swarm',
    'anglerfish_01', 'anglerfish_02', 'devilfish_01', 'devilfish_02',
    'marlin_01', 'marlin_02', 'shark_01', 'shark_02', 'shrimp_01', 'shrimp_02',
    'squid_01', 'squid_02', 'turtle_01', 'turtle_02', 'whale_01', 'whale_02',
    'alga_gold', 'alga_blue', 'alga_brown', 'alga_red', 'alga_green',
    'aquar', 'biowaste', 'fischtod', 'explosion', 'pfeil',
    'laser_0', 'laser_1', 'laser_2', 'laser_6', 'laser_7', 'laser_8',
    'laser_9', 'laser_10', 'laser_11', 'laser_aqua'
  ]);
  function texFor(name) {
    if (name === 'skybox') return TEX.skybox;
    return FX_TEXTURED.has(name) ? TEX.fx : TEX.deep;
  }

  async function boot(canvas) {
    Gfx.init(canvas);
    ctx = Gfx.context();
    bootMsg = 'DECODING ASSETS';
    requestAnimationFrame(frame);

    const jobs = [];
    let total = 0, done = 0;
    const track = p => { total++; return p.then(v => { done++; bootPct = done / total; return v; }); };

    /* language first so the loading screen can speak the player's language */
    let lang = 'en';
    try { lang = localStorage.getItem('deep.lang') || 'en'; } catch (e) { }
    await GameData.loadLang(lang === 'ru' ? 'ru' : 'en');
    bootMsg = GameData.T(229);

    for (const n of UI_IMAGES) jobs.push(track(Assets.image(n + '.png').then(im => IMG[n] = im).catch(() => { })));
    /* the portrait set has four gaps in the original numbering */
    const NO_FACE = new Set([55, 56, 57, 73]);
    for (let i = 0; i <= 94; i++) {
      if (NO_FACE.has(i)) continue;
      jobs.push(track(Assets.image('faces/' + i + '.png').then(im => IMG['faces/' + i] = im).catch(() => { })));
    }
    for (let i = 0; i < 44; i++) jobs.push(track(Assets.image('equipment/slot_' + i + '.png').then(im => IMG['equipment/slot_' + i] = im).catch(() => { })));
    for (let i = 0; i < 11; i++) {
      jobs.push(track(Assets.image('equipment/u' + i + 'a.png').then(im => IMG['equipment/u' + i + 'a'] = im).catch(() => { })));
      jobs.push(track(Assets.image('equipment/u' + i + 'b.png').then(im => IMG['equipment/u' + i + 'b'] = im).catch(() => { })));
    }
    for (let i = 0; i < 42; i++) jobs.push(track(Assets.image('cargo_' + i + '.png').then(im => IMG['cargo_' + i] = im).catch(() => { })));
    for (let i = 0; i < 15; i++) jobs.push(track(Assets.image('mission_' + i + '.png').then(im => IMG['mission_' + i] = im).catch(() => { })));
    jobs.push(track(Assets.image('mission_story.png').then(im => IMG['mission_story'] = im).catch(() => { })));
    for (let i = 1; i <= 7; i++) jobs.push(track(Assets.image('medal_' + i + '.png').then(im => IMG['medal_' + i] = im).catch(() => { })));

    for (const n of ['deep', 'fx', 'skybox'])
      jobs.push(track(Assets.texture('textures/' + n + '.bmp').then(t => TEX[n] = t).catch(() => { })));

    for (const n of MODEL_NAMES)
      jobs.push(track(Assets.raw(n + '.mbac').then(d => { MODELS[n] = Micro3D.loadMBAC(d); }).catch(e => console.warn(n, e.message))));

    jobs.push(track(GameData.load()));

    await Promise.all(jobs);
    for (let i = 0; i <= 94; i++) if (IMG['faces/' + i]) FACE_IDS.push(i);
    Font.build(IMG.font_deep_white);
    Portrait.bind(IMG);
    /* work out, per polygon, what is hull and what is light */
    for (const name in MODELS) Micro3D.classifyBlend(MODELS[name], texFor(name));
    Flight.bind(MODELS, TEX, IMG, texFor);
    Station.bind(MODELS, TEX, IMG, texFor);
    mode = 'splash';
    splash = { i: 0, t: 0 };
    Sfx.music('intro');
  }

  /* ----------------------------------------------------------------- loop */
  function frame(ts) {
    requestAnimationFrame(frame);
    const dtms = Math.min(64, ts - last || 16); last = ts;
    const dt = dtms / 16.6667;
    update(dt);
    render();
    Input.endFrame();
  }

  function update(dt) {
    switch (mode) {
      case 'boot': break;
      case 'splash': updateSplash(dt); break;
      case 'mainmenu': updateMainMenu(); break;
      case 'newgame': updateNewGame(); break;
      case 'station': updateStation(); break;
      case 'flight': updateFlight(dt); break;
      case 'dialogue': updateScene(dt); break;
      case 'settings': updateSettings(); break;
      case 'pause': updatePause(); break;
      case 'travel': if (overlay !== null) { if (Input.pressed('fire') || Input.pressed('back')) { overlay = null; Sfx.play('back'); } } else updateTravel(); break;
      case 'result': updateResult(); break;
    }
  }
  function render() {
    switch (mode) {
      case 'boot': renderBoot(); break;
      case 'splash': renderSplash(); break;
      case 'mainmenu': renderMainMenu(); renderOverlay(); break;
      case 'newgame': renderNewGame(); break;
      case 'station': Station.render(ctx); renderOverlay(); break;
      case 'flight': Flight.render(ctx); break;
      case 'dialogue': renderScene(); break;
      case 'settings': renderSettings(); break;
      case 'pause': renderPause(); break;
      case 'travel': renderTravel(); renderOverlay(); break;
      case 'result': renderResult(); break;
    }
  }

  /* ----------------------------------------------------------------- boot */
  function renderBoot() {
    Gfx.clearTo(4, 14, 22); Gfx.flush();
    ctx.fillStyle = '#7fe4ff';
    ctx.fillRect(30, SCR_H / 2, (SCR_W - 60) * bootPct, 3);
    ctx.strokeStyle = '#2b566b';
    ctx.strokeRect(29.5, SCR_H / 2 - 0.5, SCR_W - 59, 4);
    ctx.font = '9px monospace'; ctx.fillStyle = '#6d8fa3'; ctx.textAlign = 'center';
    ctx.fillText(bootMsg, SCR_W / 2, SCR_H / 2 - 10);
    ctx.textAlign = 'left';
  }

  /* --------------------------------------------------------------- splash */
  const SPLASH = ['fishlabs', 'abyss', 'logo'];
  function updateSplash(dt) {
    splash.t += dt;
    if (Input.pressed('fire') || Input.pressed('back') || splash.t > 110) {
      splash.t = 0; splash.i++;
      if (splash.i >= SPLASH.length) { mode = 'mainmenu'; menuSel = 0; }
    }
  }
  function renderSplash() {
    Gfx.clearTo(4, 14, 22); Gfx.flush();
    const im = IMG[SPLASH[splash.i]];
    if (im) ctx.drawImage(im, (SCR_W - im.width) / 2 | 0, (SCR_H - im.height) / 2 | 0);
    if (splash.i === SPLASH.length - 1)
      Font.drawCentre(ctx, 'SUBMARINE ODYSSEY', SCR_W / 2, SCR_H / 2 + 40, UI.COL.dim);
    Font.drawCentre(ctx, GameData.T(83), SCR_W / 2, SCR_H - 30, UI.COL.dim);
  }

  /* ------------------------------------------------------------ main menu */
  function mainItems() {
    const it = [{ t: 232, a: 'new' }];
    if (World.hasAuto()) it.push({ t: 276, a: 'auto' });
    it.push({ t: 1, a: 'load' }, { t: 3, a: 'settings' }, { t: 4, a: 'help' }, { t: 20, a: 'credits' });
    return it;
  }
  function updateMainMenu() {
    if (overlay !== null) { if (Input.pressed('fire') || Input.pressed('back')) { overlay = null; Sfx.play('back'); } return; }
    const it = mainItems();
    if (Input.pressed('up')) { menuSel = (menuSel - 1 + it.length) % it.length; Sfx.play('beep'); }
    if (Input.pressed('down')) { menuSel = (menuSel + 1) % it.length; Sfx.play('beep'); }
    if (Input.pressed('fire')) {
      const a = it[menuSel].a;
      Sfx.play('select');
      if (a === 'new') { mode = 'newgame'; newGame = { step: 0, face: 0, diff: 1 }; Input.startText(''); }
      else if (a === 'auto') { if (World.loadAuto()) enterStation(); }
      else if (a === 'load') { if (World.load(0)) enterStation(); else Sfx.play('deny'); }
      else if (a === 'settings') { mode = 'settings'; settingSel = 0; }
      else if (a === 'help') showText(GameData.T(365));
      else if (a === 'credits') showText(GameData.T(28) + '\n\n' + GameData.T(25));
    }
  }
  function renderMainMenu() {
    Gfx.clearTo(4, 16, 26); Gfx.flush();
    const im = IMG.logo;
    if (im) ctx.drawImage(im, (SCR_W - im.width) / 2 | 0, 26);
    Font.drawCentre(ctx, 'SUBMARINE ODYSSEY', SCR_W / 2, 26 + (im ? im.height : 20) + 4, UI.COL.dim);
    const it = mainItems();
    for (let i = 0; i < it.length; i++) {
      const y = 120 + i * 22;
      if (i === menuSel) { UI.rect(ctx, 30, y - 3, SCR_W - 60, 18, '#0e3145'); UI.frame(ctx, 30, y - 3, SCR_W - 60, 18, null, UI.COL.frameHi); }
      Font.drawCentre(ctx, GameData.T(it[i].t), SCR_W / 2, y, i === menuSel ? UI.COL.hi : UI.COL.text);
    }
    Font.drawCentre(ctx, GameData.T(26) + '  © 2007 FISHLABS', SCR_W / 2, SCR_H - 26, UI.COL.dim);
    UI.softkeys(ctx, '', GameData.T(41));
  }

  /* text overlay ---------------------------------------------------------- */
  let overlay = null;
  function showText(t) { overlay = t; }
  function renderOverlay() {
    if (overlay === null) return;
    UI.shade(ctx, 0.82);
    UI.panel(ctx, 6, 18, SCR_W - 12, SCR_H - 48);
    let y = 26;
    for (const l of Font.wrap(overlay, SCR_W - 24)) {
      if (y > SCR_H - 36) break;
      Font.draw(ctx, l, 12, y, UI.COL.text); y += 12;
    }
    UI.softkeys(ctx, '', GameData.T(41));
  }

  /* --------------------------------------------------------- new game flow */
  function updateNewGame() {
    if (newGame.step === 0) {
      if (Input.pressed('fire')) {
        const n = Input.getText().trim();
        Input.stopText();
        newGame.name = n || GameData.T(300);
        newGame.step = 1; Sfx.play('select');
      }
      if (Input.pressed('back')) { Input.stopText(); mode = 'mainmenu'; }
      return;
    }
    if (newGame.step === 1) {
      if (Input.pressed('left')) { newGame.face = (newGame.face + 999) % 1000; Sfx.play('beep'); }
      if (Input.pressed('right')) { newGame.face = (newGame.face + 1) % 1000; Sfx.play('beep'); }
      if (Input.pressed('up')) { newGame.face = (newGame.face + 990) % 1000; Sfx.play('beep'); }
      if (Input.pressed('down')) { newGame.face = (newGame.face + 10) % 1000; Sfx.play('beep'); }
      if (Input.pressed('fire')) { newGame.step = 2; Sfx.play('select'); }
      if (Input.pressed('back')) { newGame.step = 0; Input.startText(newGame.name); }
      return;
    }
    if (Input.pressed('left')) { newGame.diff = Math.max(0, newGame.diff - 1); Sfx.play('beep'); }
    if (Input.pressed('right')) { newGame.diff = Math.min(2, newGame.diff + 1); Sfx.play('beep'); }
    if (Input.pressed('fire')) {
      World.fresh(newGame.name, newGame.face, newGame.diff);
      Campaign.applyRebelWave();
      Sfx.play('select');
      startCampaign();
    }
    if (Input.pressed('back')) newGame.step = 1;
  }
  function renderNewGame() {
    Gfx.clearTo(5, 18, 28); Gfx.flush();
    UI.rect(ctx, 0, 0, SCR_W, 16, '#0b2433');
    Font.draw(ctx, GameData.T(232), 4, 3, UI.COL.hi);
    if (newGame.step === 0) {
      Font.drawCentre(ctx, GameData.T(299), SCR_W / 2, 60, UI.COL.text);
      UI.frame(ctx, 30, 84, SCR_W - 60, 18, '#08202c', UI.COL.frameHi);
      Font.draw(ctx, Input.getText() + ((Date.now() / 400 | 0) % 2 ? '_' : ''), 36, 88, UI.COL.gold);
    } else if (newGame.step === 1) {
      Font.drawCentre(ctx, GameData.T(301), SCR_W / 2, 20, UI.COL.text);
      Portrait.draw(ctx, newGame.face, (SCR_W - 96) / 2, 36, 96);
      /* a strip of the neighbouring rolls, so it reads as a picker */
      for (let k = -4; k <= 4; k++) {
        if (!k) continue;
        const id = (newGame.face + k + 1000) % 1000;
        Portrait.draw(ctx, id, SCR_W / 2 - 20 + k * 26 - 4, 148, 26);
      }
      Font.drawCentre(ctx, GameData.T(302), SCR_W / 2, 190, UI.COL.dim);
      Font.drawCentre(ctx, newGame.name, SCR_W / 2, SCR_H - 40, UI.COL.gold);
    } else {
      Font.drawCentre(ctx, GameData.T(39), SCR_W / 2, 60, UI.COL.text);
      for (let i = 0; i < 3; i++) {
        const y = 90 + i * 22;
        if (i === newGame.diff) UI.rect(ctx, 40, y - 3, SCR_W - 80, 18, '#0e3145');
        Font.drawCentre(ctx, GameData.T(273 + i), SCR_W / 2, y, i === newGame.diff ? UI.COL.hi : UI.COL.text);
      }
      Portrait.draw(ctx, newGame.face, (SCR_W - 56) / 2, SCR_H - 116, 56);
      Font.drawCentre(ctx, newGame.name, SCR_W / 2, SCR_H - 52, UI.COL.gold);
    }
    UI.softkeys(ctx, GameData.T(65), GameData.T(41));
  }

  /* ------------------------------------------------------------- campaign */
  function startCampaign() {
    World.visit(0);
    playScene(0, () => { launch({ tutorial: true }); });
  }

  /* ------------------------------------------------------------- dialogue */
  async function playScene(n, after) {
    scene = await Campaign.scene(n);
    sceneIdx = 0; sceneAfter = after || null; sceneT = 0;
    mode = 'dialogue';
    Sfx.play('message');
  }
  function updateScene(dt) {
    sceneT += dt;
    if (Input.pressed('fire') || Input.pressed('action')) {
      sceneIdx++;
      sceneT = 0;
      Sfx.play('beep');
      if (sceneIdx >= scene.length) endScene();
    }
    if (Input.pressed('back')) endScene();
  }
  function endScene() {
    const after = sceneAfter;
    scene = null; sceneAfter = null;
    Campaign.dialogueDone();
    if (after) after(); else enterStation();
  }
  function renderScene() {
    if (!scene) return;
    /* keep the world visible behind the conversation */
    if (Flight.state() && lastMode === 'flight') Flight.render(ctx); else { Gfx.clearTo(4, 16, 26); Gfx.flush(); }
    UI.shade(ctx, 0.68);
    const line = scene[Math.min(sceneIdx, scene.length - 1)];
    const boxY = SCR_H - 118;
    UI.panel(ctx, 4, boxY, SCR_W - 8, 100, line.name || '');
    let y = boxY + 18;
    let tx = 10, portraitH = 0;
    if (line.face === 'mai' && IMG.mai) { ctx.drawImage(IMG.mai, 8, y); tx = 8 + IMG.mai.width + 6; portraitH = IMG.mai.height; }
    else if (line.portrait !== null && line.portrait !== undefined) {
      Portrait.draw(ctx, line.portrait, 8, y, 40);
      tx = 52; portraitH = 40;
    }
    const narrow = SCR_W - tx - 10, wide = SCR_W - 20;
    const indented = Math.ceil(portraitH / 12);
    const lines = Font.wrap(line.text, portraitH ? narrow : wide);
    for (let i = 0; i < lines.length; i++) {
      if (y > boxY + 88) { Font.draw(ctx, '...', tx, y, UI.COL.dim); break; }
      Font.draw(ctx, lines[i], i < indented ? tx : 10, y, UI.COL.text);
      y += 12;
    }
    Font.drawRight(ctx, (sceneIdx + 1) + '/' + scene.length, SCR_W - 10, boxY + 4, UI.COL.dim);
    UI.softkeys(ctx, GameData.T(233), GameData.T(74));
  }

  /* -------------------------------------------------------------- station */
  let lastMode = 'station';
  function enterStation() {
    mode = 'station';
    lastMode = 'station';
    Station.open({ undock: () => beforeLaunch(), quit: () => { World.autosave(); mode = 'mainmenu'; Sfx.music('intro'); } });
    /* the colonists take the hold at a fixed price; rebels let you trade */
    if (!World.canTrade(World.state().station)) {
      const paid = World.colonistBuyout();
      if (paid > 0) Station.note(GameData.T(257) + ' ' + paid.toLocaleString() + ' $');
    }
    /* pay out finished jobs and fire story beats */
    settleMissions();
    const dlg = Campaign.onDock();
    if (dlg !== null && dlg !== undefined) playScene(dlg, () => enterStation());
    syncStoryLog();
    World.checkMedals();
    World.autosave();
  }
  function updateStation() {
    if (overlay !== null) { if (Input.pressed('fire') || Input.pressed('back')) { overlay = null; Sfx.play('back'); } return; }
    if (Input.pressed('pause')) { mode = 'pause'; pauseSel = 0; return; }
    Station.update(Input);
    /* beats such as "buy a gun" or "produce five goods" can be met while
       docked, so re-check them every frame rather than only on arrival */
    if (mode === 'station' && !Campaign.done()) {
      const before = World.state().chapter * 100 + World.state().chapterStep;
      const dlg = Campaign.onDock();
      const after = World.state().chapter * 100 + World.state().chapterStep;
      if (dlg !== null && dlg !== undefined) { playScene(dlg, () => enterStation()); syncStoryLog(); }
      else if (after !== before) syncStoryLog();
    }
  }

  function syncStoryLog() {
    const W = World.state();
    W.missions = W.missions.filter(m => !m.story);
    const e = Campaign.logEntry();
    if (e) W.missions.unshift(e);
  }

  function settleMissions() {
    const W = World.state();
    for (const m of W.missions) {
      if (m.story || !m.done || m.paid) continue;
      if (m.from !== W.station) continue;
      m.paid = true;
      W.credits += m.reward;
      W.stats.missions++;
      W.stats.bestCredits = Math.max(W.stats.bestCredits, W.credits);
      Sfx.play('money');
      Station.say(GameData.T(210 + ((Math.random() * 5) | 0)).replace('#', W.name) +
        '\n\n' + GameData.T(40) + ': ' + m.reward.toLocaleString() + ' $');
    }
    W.missions = W.missions.filter(m => m.story || !m.paid);
    const gained = World.checkMedals();
    if (gained.length) { Sfx.play('medal'); Station.note(GameData.T(163) + ' ' + GameData.medalName(gained[0])); }
  }

  /* --------------------------------------------------------------- launch */
  function beforeLaunch() {
    const dlg = Campaign.onLaunch();
    if (dlg !== null && dlg !== undefined) { playScene(dlg, () => launch({})); return; }
    launch({});
  }

  function launch(opts) {
    const W = World.state();
    if (!World.fitted(GameData.EQ.GUN).length && !World.fitted(GameData.EQ.TORPEDO).length) W.flags.unarmedLaunch = true;
    const sb = Campaign.sectorBeat();
    const job = W.missions.find(m => !m.story && !m.done && m.target === W.station);
    let cfg = { onDone: onSectorDone, hint: Campaign.done() ? null : Campaign.hint() };
    missionCtx = null;

    if (sb && (!sb.station || World.byName(sb.station) === W.station)) {
      cfg = Object.assign(cfg, storySector(sb));
      missionCtx = { story: true, beat: sb };
    } else if (job) {
      cfg = Object.assign(cfg, jobSector(job));
      missionCtx = { job };
    }
    mode = 'flight';
    lastMode = 'flight';
    const S = Flight.enter(cfg);
    if (missionCtx && missionCtx.story && missionCtx.beat.dlg !== undefined) {
      playScene(missionCtx.beat.dlg, () => { mode = 'flight'; });
    }
  }

  /* --- freelance mission set-ups ---------------------------------------- */
  const JOB_KIND = [
    'fish', 'raid', 'pirates', 'rescue', 'hunt', 'trash', 'mines', 'produce',
    'escort', 'intercept', 'passenger', 'protect', 'cull', 'capsuleGuard', 'capsuleKill'
  ];
  function jobSector(job) {
    const kind = JOB_KIND[job.type];
    const need = Math.max(2, job.amount);
    return {
      objective: kind, need,
      objectiveLabel: GameData.missionTypeName(job.type),
      timeLimit: job.type === 5 ? 120 * 60 : 0,
      enemies: 2 + job.diff,
      build: (S, api) => {
        const U = api.U;
        switch (job.type) {
          case 0: S.objective = 'fish'; S.objectiveSpecies = job.goodId; api.spawnShoal(job.goodId); api.spawnShoal(job.goodId); break;
          case 1: case 4: {
            const t = api.spawnShip('pirate', 0, 0, 420 * U, { tier: 2, hostile: true, cargo: job.goodId });
            t.tag = 'target'; S.objective = 'kill'; break;
          }
          case 2: for (let i = 0; i < need; i++) api.spawnShip('pirate', undefined, undefined, undefined, { hostile: true }); S.objective = 'pirates'; break;
          case 3: {
            const t = api.spawnShip('pirate', 120 * U, 0, 460 * U, { tier: 2, hostile: true });
            t.tag = 'target'; S.objective = 'kill'; S.objectiveNeed = 1; break;
          }
          case 5: for (let i = 0; i < need; i++) Flight.ent({ kind: 'trash', model: 'trash', x: Math.cos(i) * 300 * U, y: (i % 3 - 1) * 80 * U, z: Math.sin(i * 1.7) * 300 * U, yaw: 0, pitch: 0, scale: 1, r: 12 * U, hp: 3, spin: 0.2 }); S.objective = 'trash'; break;
          case 6: for (let i = 0; i < need; i++) Flight.spawnMine(Math.cos(i * 1.3) * 280 * U, (i % 3 - 1) * 60 * U, Math.sin(i * 1.9) * 280 * U); S.objective = 'mines'; break;
          case 7: S.objective = 'produce'; S.objectiveNeed = 0; break;
          case 8: case 13: for (let i = 0; i < need; i++) Flight.spawnCapsule(Math.cos(i) * 160 * U, -120 * U, Math.sin(i) * 160 * U); S.objective = 'capsuleGuard'; break;
          case 9: for (let i = 0; i < need; i++) api.spawnShip('colonist', undefined, undefined, undefined, { hostile: true, tier: 2 }); S.objective = 'kill'; break;
          case 10: Flight.spawnWaypoint(0, 0, 700 * U, 'dest'); S.objective = 'reach'; break;
          case 11: api.spawnShoal(job.goodId); for (let i = 0; i < 3; i++) api.spawnShip('colonist', undefined, undefined, undefined, { hostile: true }); S.objective = 'kill'; break;
          case 12: api.spawnShoal(job.goodId); api.spawnShoal(job.goodId); S.objective = 'cull'; break;
          case 14: for (let i = 0; i < need; i++) Flight.spawnCapsule(Math.cos(i) * 160 * U, -120 * U, Math.sin(i) * 160 * U); S.objective = 'capsuleKill'; break;
        }
      }
    };
  }

  /* --- story mission set-ups -------------------------------------------- */
  function storySector(sb) {
    const n = sb.n || 1;
    const base = { objective: 'kill', need: n, objectiveLabel: GameData.T(75) };
    switch (sb.kind) {
      case 'pirates': return Object.assign(base, {
        objective: 'pirates', enemies: 0,
        build: (S, api) => { for (let i = 0; i < n; i++) api.spawnShip('pirate', undefined, undefined, undefined, { hostile: true }); }
      });
      case 'nautilus': return Object.assign(base, {
        objective: 'cull', enemies: 1,
        build: (S, api) => { api.spawnShoal(0); api.spawnShoal(0); S.objectiveLabel = GameData.goodName(0); }
      });
      case 'capsules': return Object.assign(base, {
        objective: 'capsuleGuard', enemies: 0,
        build: (S, api) => {
          for (let i = 0; i < n; i++) Flight.spawnCapsule(Math.cos(i) * 180 * api.U, -140 * api.U, Math.sin(i * 2) * 180 * api.U);
          for (let i = 0; i < 4; i++) api.spawnShip('aquarian', undefined, undefined, undefined, { hostile: true });
        }
      });
      case 'protect': return Object.assign(base, {
        objective: 'kill', enemies: 0,
        build: (S, api) => { api.spawnShoal(10); for (let i = 0; i < n; i++) api.spawnShip('colonist', undefined, undefined, undefined, { hostile: true }); }
      });
      case 'gang': return Object.assign(base, {
        objective: 'pirates', enemies: 0,
        build: (S, api) => {
          for (let i = 0; i < n; i++) api.spawnShip('pirate', undefined, undefined, undefined, { hostile: true });
          api.spawnShip('rebel', 60 * api.U, 0, 90 * api.U, { escort: true });
        }
      });
      case 'mines': return Object.assign(base, {
        objective: 'mines', enemies: 2,
        build: (S, api) => { for (let i = 0; i < n; i++) Flight.spawnMine(Math.cos(i * 1.1) * 300 * api.U, (i % 3 - 1) * 70 * api.U, Math.sin(i * 1.7) * 300 * api.U); }
      });
      case 'escortAyumi': return Object.assign(base, {
        objective: 'kill', enemies: 0,
        build: (S, api) => {
          const a = api.spawnShip('rebel', 0, 0, 120 * api.U, { escort: true });
          for (let i = 0; i < n; i++) api.spawnShip('colonist', undefined, undefined, undefined, { hostile: true, tier: 2 });
        }
      });
      case 'raymond': return Object.assign(base, {
        objective: 'kill', need: 1, enemies: 0,
        build: (S, api) => {
          const t = api.spawnShip('pirate', 0, 40 * api.U, 500 * api.U, { tier: 6, hostile: true, cargo: 40 });
          t.tag = 'target'; t.model = 'u7'; t.scale = 1.15;
          for (let i = 0; i < 3; i++) api.spawnShip('pirate', undefined, undefined, undefined, { hostile: true });
        }
      });
      case 'convoyGuard': return Object.assign(base, {
        objective: 'kill', enemies: 0,
        build: (S, api) => {
          const c = api.spawnShip('convoy', 0, 0, 140 * api.U, { escort: true });
          c.model = 'tanker1'; c.scale = 0.5; c.r = 60 * api.U; c.hp = c.hpMax = 220;
          for (let i = 0; i < n; i++) api.spawnShip('pirate', undefined, undefined, undefined, { hostile: true });
        }
      });
      case 'convoyRaid': return Object.assign(base, {
        objective: 'kill', enemies: 0,
        build: (S, api) => {
          for (let i = 0; i < n; i++) {
            const s = api.spawnShip('colonist', undefined, undefined, undefined, { hostile: true, cargo: i === 2 ? 36 : (Math.random() * 18) | 0 });
          }
          api.spawnShip('rebel', -80 * api.U, 0, 90 * api.U, { escort: true });
        }
      });
      case 'raoul': return Object.assign(base, {
        objective: 'pirates', enemies: 0,
        build: (S, api) => {
          const t = api.spawnShip('pirate', 0, 0, 420 * api.U, { tier: 4, hostile: true });
          t.model = 'u5';
          for (let i = 1; i < n; i++) api.spawnShip('pirate', undefined, undefined, undefined, { hostile: true });
        }
      });
      case 'eclipseTest': return Object.assign(base, {
        objective: 'pirates', enemies: 0,
        build: (S, api) => { for (let i = 0; i < n; i++) api.spawnShip('pirate', undefined, undefined, undefined, { hostile: true, tier: 2 }); }
      });
      case 'defendFiir': case 'offensive': return Object.assign(base, {
        objective: 'kill', enemies: 0,
        build: (S, api) => {
          for (let i = 0; i < n; i++) api.spawnShip('colonist', undefined, undefined, undefined, { hostile: true, tier: 2 });
          for (let i = 0; i < 3; i++) api.spawnShip('rebel', undefined, undefined, undefined, { escort: true });
          for (let i = 0; i < 2; i++) api.spawnShip('aquarian', undefined, undefined, undefined, { escort: true });
        }
      });
      case 'final': return Object.assign(base, {
        objective: 'kill', enemies: 0,
        build: (S, api) => {
          for (let i = 0; i < n; i++) api.spawnShip('colonist', undefined, undefined, undefined, { hostile: true, tier: 3 });
          for (let i = 0; i < 4; i++) api.spawnShip('rebel', undefined, undefined, undefined, { escort: true });
        }
      });
      default: return Object.assign(base, { objective: 'pirates', enemies: n });
    }
  }

  /* --------------------------------------------------------------- flight */
  function updateFlight(dt) {
    if (Input.pressed('pause')) { mode = 'pause'; pauseSel = 0; return; }
    Flight.update(dt, Input);
    const S = Flight.state();
    if (S && S.caughtHere > 0 && Campaign.onCatch()) { syncStoryLog(); }
  }
  function onSectorDone(reason) {
    const W = World.state();
    if (reason === 'dock') {
      if (missionCtx && missionCtx.job) {
        const S = Flight.state();
        if (S.cleared) { missionCtx.job.done = true; }
      }
      World.visit(W.station);
      enterStation();
      return;
    }
    if (reason === 'stream') { openTravel(); return; }
    if (reason === 'clear') {
      if (missionCtx && missionCtx.story) { Campaign.sectorCleared(); syncStoryLog(); }
      if (missionCtx && missionCtx.job) missionCtx.job.done = true;
      resultData = { ok: true };
      mode = 'result';
      return;
    }
    if (reason === 'fail') { resultData = { ok: false }; mode = 'result'; return; }
    if (reason === 'dead') {
      resultData = { dead: true };
      mode = 'result';
      return;
    }
  }
  function updateResult() {
    if (Input.pressed('fire') || Input.pressed('back')) {
      if (resultData.dead) {
        W_reset();
      } else {
        mode = 'flight';
      }
    }
  }
  function W_reset() {
    const W = World.state();
    W.ship.hullDmg = 0; W.ship.shieldDmg = 0;
    W.credits = Math.max(0, Math.round(W.credits * 0.7));
    W.flags.lowEnergyArrival = true;
    enterStation();
  }
  function renderResult() {
    Flight.render(ctx);
    UI.shade(ctx, 0.7);
    const t = resultData.dead ? GameData.T(139) : resultData.ok ? GameData.T(92) : GameData.T(228);
    Font.drawCentre(ctx, t, SCR_W / 2, SCR_H / 2 - 20, resultData.ok ? UI.COL.good : UI.COL.warn);
    if (resultData.ok) Font.drawCentre(ctx, GameData.T(284 + Math.min(3, World.state().stats.missions % 4)), SCR_W / 2, SCR_H / 2, UI.COL.gold);
    UI.softkeys(ctx, '', GameData.T(41));
  }

  /* --------------------------------------------------------------- travel */
  function openTravel() {
    const W = World.state();
    travel = { sel: W.plannedRoute && W.plannedRoute.length > 1 ? W.plannedRoute[1] : nearest() };
    mode = 'travel';
  }
  function nearest() {
    const W = World.state();
    let best = W.station, bd = 1e9;
    for (const s of GameData.stations) {
      if (s.id === W.station) continue;
      const d = World.distance(W.station, s.id);
      if (d < bd && d <= World.engineRange() && World.depthOK(s.id)) { bd = d; best = s.id; }
    }
    return best;
  }
  function updateTravel() {
    const W = World.state();
    const list = GameData.stations.filter(s => s.id !== W.station && World.reachable(W.station, s.id))
      .sort((a, b) => World.distance(W.station, a.id) - World.distance(W.station, b.id));
    if (!list.length) { mode = 'flight'; return; }
    let i = Math.max(0, list.findIndex(s => s.id === travel.sel));
    if (Input.pressed('up')) { i = (i - 1 + list.length) % list.length; Sfx.play('beep'); }
    if (Input.pressed('down')) { i = (i + 1) % list.length; Sfx.play('beep'); }
    travel.sel = list[i].id;
    if (Input.pressed('back')) { mode = 'flight'; return; }
    if (Input.pressed('fire')) {
      if (!World.depthOK(travel.sel)) { Sfx.play('deny'); showText(GameData.T(255) + '\n\n' +
        GameData.T(245) + ': ' + World.depthMetres(GameData.stations[travel.sel].depth) + 'm\n' +
        GameData.T(321) + ': ' + World.depthMetres(World.depthLimits().max) + 'm\n' +
        GameData.T(322) + ': ' + World.depthMetres(World.depthLimits().min) + 'm'); return; }
      Sfx.play('gate');
      World.visit(travel.sel);
      if (W.plannedRoute) {
        const k = W.plannedRoute.indexOf(travel.sel);
        if (k >= 0) W.plannedRoute = W.plannedRoute.slice(k);
        if (W.plannedRoute.length <= 1) W.plannedRoute = null;
      }
      launch({});
    }
  }
  function renderTravel() {
    Flight.render(ctx);
    UI.shade(ctx, 0.72);
    UI.panel(ctx, 8, 20, SCR_W - 16, SCR_H - 50, 'S.T.R.E.A.M. OUT');
    const W = World.state();
    const list = GameData.stations.filter(s => s.id !== W.station && World.reachable(W.station, s.id))
      .sort((a, b) => World.distance(W.station, a.id) - World.distance(W.station, b.id));
    const i = Math.max(0, list.findIndex(s => s.id === travel.sel));
    const start = Math.max(0, Math.min(i - 4, list.length - 9));
    let y = 38;
    for (let k = start; k < Math.min(list.length, start + 9); k++) {
      const s = list[k];
      const on = s.id === travel.sel;
      if (on) UI.rect(ctx, 10, y - 2, SCR_W - 20, 14, '#0e3145');
      const ok = World.depthOK(s.id);
      Font.draw(ctx, s.name, 16, y, on ? UI.COL.hi : ok ? UI.COL.text : UI.COL.warn);
      Font.drawRight(ctx, Math.round(World.distance(W.station, s.id)) + '  ' + World.depthMetres(s.depth) + 'm',
        SCR_W - 16, y, UI.COL.dim);
      y += 14;
    }
    UI.softkeys(ctx, GameData.T(254), GameData.T(41));
  }

  /* --------------------------------------------------------------- pause */
  const PAUSE = [[17, 'resume'], [2, 'save'], [3, 'settings'], [4, 'help'], [67, 'menu']];
  function updatePause() {
    if (Input.pressed('up')) { pauseSel = (pauseSel - 1 + PAUSE.length) % PAUSE.length; Sfx.play('beep'); }
    if (Input.pressed('down')) { pauseSel = (pauseSel + 1) % PAUSE.length; Sfx.play('beep'); }
    if (Input.pressed('back')) { mode = lastMode; return; }
    if (Input.pressed('fire')) {
      const a = PAUSE[pauseSel][1];
      Sfx.play('select');
      if (a === 'resume') mode = lastMode;
      else if (a === 'save') { World.save(0); World.autosave(); showText(GameData.T(32)); }
      else if (a === 'settings') { mode = 'settings'; settingSel = 0; }
      else if (a === 'help') showText(GameData.T(18) + '\n\n' + GameData.T(19) + '\n' +
        'Arrows / WASD - steer\nSpace - fire\n1 - switch weapon\n7 - auto fire\n3 - booster\n9 - autopilot\n0 - dock / S.T.R.E.A.M.\n2 / 8 - throttle\nC - camera\nP - pause');
      else if (a === 'menu') { World.autosave(); mode = 'mainmenu'; Sfx.music('intro'); }
    }
  }
  function renderPause() {
    if (lastMode === 'flight') Flight.render(ctx); else Station.render(ctx);
    UI.shade(ctx, 0.72);
    UI.panel(ctx, 30, 80, SCR_W - 60, 130, GameData.T(16));
    for (let i = 0; i < PAUSE.length; i++) {
      const y = 100 + i * 20;
      if (i === pauseSel) UI.rect(ctx, 36, y - 3, SCR_W - 72, 17, '#0e3145');
      Font.drawCentre(ctx, GameData.T(PAUSE[i][0]), SCR_W / 2, y, i === pauseSel ? UI.COL.hi : UI.COL.text);
    }
    renderOverlay();
  }

  /* ------------------------------------------------------------- settings */
  const SET = [[6, 'music'], [12, 'autofire'], [13, 'invert'], [11, 'lang']];
  function openSettings() { mode = 'settings'; settingSel = 0; }
  function updateSettings() {
    const W = World.state();
    if (Input.pressed('up')) { settingSel = (settingSel - 1 + SET.length) % SET.length; Sfx.play('beep'); }
    if (Input.pressed('down')) { settingSel = (settingSel + 1) % SET.length; Sfx.play('beep'); }
    if (Input.pressed('back')) { mode = W ? lastMode : 'mainmenu'; return; }
    if (Input.pressed('fire') || Input.pressed('left') || Input.pressed('right')) {
      const a = SET[settingSel][1];
      Sfx.play('select');
      if (a === 'music') { const on = !Sfx.enabled.music; Sfx.setMusic(on); if (W) W.music = on; if (on) Sfx.music(lastMode === 'flight' ? 'flight' : 'station'); }
      else if (a === 'autofire' && W) W.autofire = !W.autofire;
      else if (a === 'invert' && W) W.invert = !W.invert;
      else if (a === 'lang') switchLanguage();
    }
  }
  async function switchLanguage() {
    const next = GameData.D.langDir === 'en' ? 'ru' : 'en';
    await GameData.loadLang(next);
    GameData.D.L = Object.fromEntries(Object.entries(GameData.D.L).filter(([k]) => !k.startsWith('d')));
    try { localStorage.setItem('deep.lang', next); } catch (e) { }
  }
  function renderSettings() {
    if (World.state()) { if (lastMode === 'flight') Flight.render(ctx); else Station.render(ctx); UI.shade(ctx, 0.75); }
    else { Gfx.clearTo(5, 18, 28); Gfx.flush(); }
    UI.panel(ctx, 20, 70, SCR_W - 40, 120, GameData.T(3));
    const W = World.state();
    for (let i = 0; i < SET.length; i++) {
      const y = 92 + i * 20;
      if (i === settingSel) UI.rect(ctx, 26, y - 3, SCR_W - 52, 17, '#0e3145');
      Font.draw(ctx, GameData.T(SET[i][0]), 32, y, i === settingSel ? UI.COL.hi : UI.COL.text);
      let v = '';
      const a = SET[i][1];
      if (a === 'music') v = GameData.T(Sfx.enabled.music ? 14 : 15);
      else if (a === 'autofire') v = GameData.T(W && W.autofire ? 14 : 15);
      else if (a === 'invert') v = GameData.T(W && W.invert ? 14 : 15);
      else if (a === 'lang') v = (GameData.D.langDir || 'en').toUpperCase();
      Font.drawRight(ctx, v, SCR_W - 32, y, UI.COL.gold);
    }
    UI.softkeys(ctx, GameData.T(65), GameData.T(41));
  }

  function reloadStation() { enterStation(); }
  return { boot, openSettings, reloadStation, get IMG() { return IMG; }, get MODELS() { return MODELS; }, get mode() { return mode; }, showText };
})();

window.addEventListener('load', () => {
  Game.boot(document.getElementById('screen')).catch(e => {
    document.getElementById('fatal').style.display = 'block';
    document.getElementById('fatal').textContent = 'Asset load failed: ' + e.message +
      '\n\nThis page reads the original game data with fetch(), so it has to be served over HTTP. ' +
      'Open it through GitHub Pages, or run a local server in the repository folder:\n\n  python3 -m http.server 8000\n\nthen visit http://localhost:8000/';
    console.error(e);
  });
});
