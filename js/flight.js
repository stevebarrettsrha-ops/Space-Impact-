/* ============================================================================
   The 3D sector: flying the boat, fishing, fighting, mines, cargo, the
   S.T.R.E.A.M. gates and docking.  Everything you see out of the window is an
   original Micro3D mesh textured with the original deep.bmp / fx.bmp atlases.
   ========================================================================== */
'use strict';

const Flight = (() => {

  const U = 100;                 /* world units per metre */
  const SECTOR = 900 * U;        /* play area radius */
  const TAU = Math.PI * 2;

  let M = {}, TEX = {}, IMG = {}, texFor = () => null;
  let S = null;                  /* sector state */

  function bind(models, textures, images, texture) { M = models; TEX = textures; IMG = images; texFor = texture; }

  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  function wrapAngle(a) { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; }

  /* ---------------------------------------------------------------- setup */
  /* kind: 'cruise' | 'mission' | 'combat' | 'fish' */
  function enter(cfg) {
    cfg = cfg || {};
    const st = World.station();
    const W = World.state();
    S = {
      cfg,
      t: 0,
      px: 0, py: 6 * U, pz: -430 * U,
      vx: 0, vy: 0, vz: 0,
      yaw: 0, pitch: 0, roll: 0,
      throttle: 0.45, boost: 0, boostFuel: 1,
      depth: st.depth * 100,           /* metres */
      weapon: 0,                       /* index into weapon list */
      cool: 0, harpoonCool: 0,
      autofire: W.autofire,
      autopilot: null,
      camera: 0,                       /* 0 chase, 1 cockpit */
      ents: [], shots: [], fx: [], bubbles: [],
      snow: [],                        /* marine snow drifting in the beam */
      line: null,                      /* harpoon line */
      target: null,
      msg: [], msgT: 0,
      docking: null, streaming: null,
      alarm: 0, hitFlash: 0, shake: 0,
      cleared: false, failed: false,
      killsHere: 0, caughtHere: 0,
      radar: World.radarLevel(),
      hint: cfg.hint || null,
      objective: cfg.objective || null, objectiveLabel: cfg.objectiveLabel || null,
      objectiveSpecies: undefined,
      objectiveDone: 0, objectiveNeed: cfg.need || 0,
      timeLimit: cfg.timeLimit || 0,
      onDone: cfg.onDone || null,
      exitReady: false
    };
    for (let i = 0; i < 60; i++) S.bubbles.push(newBubble(true));
    for (let i = 0; i < 150; i++) S.snow.push(newSnow());
    buildSector(cfg);
    Sfx.music('flight');
    return S;
  }
  function state() { return S; }

  function newSnow() {
    return {
      x: S.px + rnd(-70, 70) * U, y: S.py + rnd(-60, 60) * U, z: S.pz + rnd(-70, 70) * U,
      s: rnd(2, 5), v: rnd(-120, -40), d: rnd(0, TAU)
    };
  }
  function newBubble(spread) {
    return {
      x: S.px + rnd(-30 * U, 30 * U), y: S.py + (spread ? rnd(-30 * U, 30 * U) : -25 * U),
      z: S.pz + rnd(-30 * U, 30 * U), s: rnd(3, 9), f: (Math.random() * 6) | 0,
      v: rnd(900, 2400)
    };
  }

  function ent(o) { S.ents.push(o); return o; }

  function buildSector(cfg) {
    const st = World.station();
    const W = World.state();
    /* --- the home station ------------------------------------------------ */
    if (cfg.station !== false) {
      S.station = ent({
        kind: 'station', x: 0, y: 0, z: 0, yaw: 0, pitch: 0,
        scale: 1.5, hp: 1e9, r: 110 * U, id: st.id,
        modules: stationModules(st)
      });
    }
    /* --- a S.T.R.E.A.M. gate --------------------------------------------- */
    const ga = rnd(0, TAU);
    S.gate = ent({
      kind: 'gate', x: Math.cos(ga) * 520 * U, y: rnd(-40, 40) * U, z: Math.sin(ga) * 520 * U,
      yaw: ga, pitch: 0, scale: 1.4, r: 90 * U, spin: 0
    });

    /* --- sea life --------------------------------------------------------- */
    const shoals = cfg.noLife ? 0 : 4 + ((World.hash(st.id, 3, 5) * 4) | 0);
    for (let i = 0; i < shoals; i++) spawnShoal(pickSpecies(st, i));

    /* --- algae fields ----------------------------------------------------- */
    if (!cfg.noLife) for (let i = 0; i < 7; i++) {
      const sp = 13 + ((World.hash(st.id, i, 9) * 5) | 0);
      const a = rnd(0, TAU), d = rnd(150, 760) * U;
      spawnCreature(sp, Math.cos(a) * d, rnd(-300, -140) * U, Math.sin(a) * d);
    }

    /* --- drifting junk & crates ------------------------------------------- */
    for (let i = 0; i < 6; i++) {
      const a = rnd(0, TAU), d = rnd(150, 700) * U;
      ent({
        kind: 'trash', model: 'trash', x: Math.cos(a) * d, y: rnd(-200, 120) * U, z: Math.sin(a) * d,
        yaw: rnd(0, TAU), pitch: rnd(0, TAU), scale: 1, r: 12 * U, hp: 3,
        spin: rnd(-0.4, 0.4)
      });
    }
    /* --- traffic and hostiles --------------------------------------------- */
    const danger = cfg.enemies !== undefined ? cfg.enemies : (World.isRebel(st.id) ? 2 : 3);
    for (let i = 0; i < danger; i++) spawnShip('pirate');
    if (!cfg.noFriends) for (let i = 0; i < 2; i++) spawnShip('trader');

    if (cfg.build) cfg.build(S, { ent, spawnShip, spawnCreature, spawnShoal, U });
  }

  function stationModules(st) {
    /* the station is assembled from the original module meshes, exactly the
       way the MIDlet builds them: a core, habitats, hangar, engines, cannons */
    const rebel = World.isRebel(st.id);
    const suffix = rebel ? '_ve' : '_de';
    const mods = [
      { m: 'station_starter', x: 0, y: 0, z: 0 },
      { m: 'station_top', x: 0, y: 46 * U, z: 0 },
      { m: 'station_bottom', x: 0, y: -46 * U, z: 0 },
      { m: 'station_hangar' + suffix, x: 0, y: -12 * U, z: 40 * U },
      { m: 'station_habitat' + suffix, x: 34 * U, y: 8 * U, z: -18 * U },
      { m: 'station_habitat' + suffix, x: -34 * U, y: 8 * U, z: -18 * U, yaw: Math.PI },
      { m: 'station_sidehabitat', x: 0, y: 6 * U, z: -46 * U },
      { m: 'station_bridge_01', x: 20 * U, y: 26 * U, z: 0 },
      { m: 'station_bridge_02', x: -20 * U, y: 26 * U, z: 0, yaw: Math.PI },
      { m: 'station_engine', x: 0, y: -6 * U, z: -74 * U }
    ];
    const guards = Math.min(4, Math.round(st.tech / 3));
    for (let i = 0; i < guards; i++) {
      const a = i / guards * TAU;
      mods.push({ m: 'station_cannon', x: Math.cos(a) * 40 * U, y: 30 * U, z: Math.sin(a) * 40 * U, yaw: a });
    }
    return mods;
  }

  function pickSpecies(st, i) {
    const h = World.hash(st.id, i, 13);
    const depthBias = st.depth / 100;
    let sp = Math.floor(h * 13);
    if (depthBias > 0.66 && sp < 5) sp += 5;
    if (depthBias < 0.33 && sp > 8) sp -= 5;
    return clamp(sp, 0, 12);
  }

  function spawnShoal(species) {
    const a = rnd(0, TAU), d = rnd(180, 700) * U;
    const cx = Math.cos(a) * d, cz = Math.sin(a) * d, cy = rnd(-220, 160) * U;
    const n = 3 + ((Math.random() * 5) | 0);
    for (let i = 0; i < n; i++)
      spawnCreature(species, cx + rnd(-60, 60) * U, cy + rnd(-30, 30) * U, cz + rnd(-60, 60) * U);
  }

  function spawnCreature(species, x, y, z) {
    const c = GameData.creatures[species];
    const algae = c.algae;
    return ent({
      kind: 'fish', species, x, y, z,
      yaw: rnd(0, TAU), pitch: 0, scale: algae ? 1.1 : 1,
      r: (algae ? 16 : 20 + c.weight) * U * 0.6,
      hp: 3 + c.toughness, hpMax: 3 + c.toughness,
      paralysis: 0, hooked: false, flee: 0, panic: 0,
      speed: algae ? 0 : (900 + c.toughness * 150),
      frame: 0, anim: Math.random() * 10, wander: rnd(0, TAU), dead: false
    });
  }

  const SHIP_LOOK = {
    pirate: { ship: 2, tint: [1.0, 0.72, 0.72] },
    colonist: { ship: 3, tint: [0.85, 0.95, 1.05] },
    rebel: { ship: 5, tint: [0.8, 1.05, 0.9] },
    trader: { ship: 6, tint: [1.0, 1.0, 0.9] },
    aquarian: { ship: 1, tint: [0.75, 1.0, 1.05] },
    convoy: { ship: 6, tint: [1, 1, 1] }
  };

  function spawnShip(faction, x, y, z, opts) {
    opts = opts || {};
    const look = SHIP_LOOK[faction] || SHIP_LOOK.pirate;
    if (x === undefined) {
      const a = rnd(0, TAU), d = rnd(320, 820) * U;
      x = Math.cos(a) * d; y = rnd(-180, 140) * U; z = Math.sin(a) * d;
    }
    const tier = opts.tier || 1;
    return ent({
      kind: 'ship', faction, x, y, z, vx: 0, vy: 0, vz: 0,
      yaw: rnd(0, TAU), pitch: 0, roll: 0,
      model: 'u' + look.ship, tint: look.tint, scale: 1,
      r: 18 * U, hp: 26 * tier, hpMax: 26 * tier,
      hostile: faction === 'pirate' || faction === 'colonist' || !!opts.hostile,
      speed: 2300 + tier * 340, cool: rnd(20, 90), aggro: 0,
      cargo: opts.cargo !== undefined ? opts.cargo : (Math.random() * 18) | 0,
      escort: !!opts.escort, protect: opts.protect || null, tag: opts.tag || null,
      dodge: rnd(0, TAU)
    });
  }

  function spawnMine(x, y, z) {
    return ent({ kind: 'mine', x, y, z, yaw: rnd(0, TAU), pitch: 0, scale: 1.2, r: 8 * U, hp: 6, armed: false, arm: 0 });
  }
  function spawnCapsule(x, y, z, hostile) {
    return ent({ kind: 'capsule', x, y, z, yaw: 0, pitch: 0, scale: 1.4, r: 20 * U, hp: 30, rise: 800, dead: false });
  }
  function spawnCrate(x, y, z, goodId, n) {
    return ent({
      kind: 'crate', x, y, z, vx: rnd(-60, 60), vy: -40, vz: rnd(-60, 60),
      yaw: rnd(0, TAU), pitch: rnd(0, TAU), scale: 0.9, r: 8 * U,
      goodId: goodId === undefined ? (Math.random() * 18) | 0 : goodId, n: n || 1, life: 26
    });
  }
  function spawnWaypoint(x, y, z, tag) {
    return ent({ kind: 'waypoint', x, y, z, r: 60 * U, tag: tag || null, scale: 1 });
  }

  /* ------------------------------------------------------------- weapons */
  function weaponList() {
    const out = [];
    for (const f of World.fitted(GameData.EQ.GUN)) out.push({ e: f.e, kind: 'gun' });
    for (const f of World.fitted(GameData.EQ.TORPEDO)) out.push({ e: f.e, kind: 'torpedo' });
    for (const f of World.fitted(GameData.EQ.HARPOON)) out.push({ e: f.e, kind: 'harpoon' });
    return out;
  }
  function currentWeapon() {
    const w = weaponList();
    if (!w.length) return null;
    if (S.weapon >= w.length) S.weapon = 0;
    return w[S.weapon];
  }
  function cycleWeapon() {
    const w = weaponList();
    if (!w.length) return;
    S.weapon = (S.weapon + 1) % w.length;
    Sfx.play('beep');
    toast(GameData.equipName(w[S.weapon].e.id));
  }
  const GUN_SOUND = id => id <= 2 ? 'railgun' : id <= 5 ? 'coilgun' : id <= 8 ? 'fusion' : id === 42 ? 'eclipse' : 'massdriver';
  const GUN_MODEL = id => id === 42 ? 'laser_8' : ['laser_0', 'laser_1', 'laser_2', 'laser_6', 'laser_7', 'laser_8',
    'laser_9', 'laser_10', 'laser_11', 'laser_0', 'laser_1', 'laser_2'][id] || 'laser_0';

  function fire() {
    const w = currentWeapon();
    if (!w) return;
    if (S.cool > 0) return;
    const e = w.e;
    S.cool = e.reload;
    const dir = forward();
    const muzzle = 30 * U;
    if (w.kind === 'harpoon') {
      if (S.line) return;
      S.line = {
        x: S.px + dir.x * muzzle, y: S.py + dir.y * muzzle, z: S.pz + dir.z * muzzle,
        dx: dir.x, dy: dir.y, dz: dir.z, len: 0, max: 260 * U, e, back: false, hit: null
      };
      Sfx.play('harpoon');
      return;
    }
    if (w.kind === 'torpedo') {
      S.shots.push({
        kind: 'torpedo', x: S.px + dir.x * muzzle, y: S.py + dir.y * muzzle, z: S.pz + dir.z * muzzle,
        dx: dir.x, dy: dir.y, dz: dir.z, spd: 11000, life: 300, dmg: e.value * 3,
        mine: true, model: 'torpedo', scale: 1, seek: S.target
      });
      Sfx.play('torpedo');
      return;
    }
    const spd = 21000 + e.value * 260;
    S.shots.push({
      kind: 'bolt', x: S.px + dir.x * muzzle, y: S.py + dir.y * muzzle, z: S.pz + dir.z * muzzle,
      dx: dir.x, dy: dir.y, dz: dir.z, spd, life: Math.max(45, e.range / 14), dmg: e.value,
      mine: true, model: GUN_MODEL(e.id), scale: e.id === 42 ? 2.2 : 1
    });
    Sfx.play(GUN_SOUND(e.id));
    S.shake = Math.min(6, S.shake + (e.id === 42 ? 5 : 1.2));
  }

  function forward() {
    const cp = Math.cos(S.pitch), sp = Math.sin(S.pitch);
    return { x: Math.sin(S.yaw) * cp, y: sp, z: Math.cos(S.yaw) * cp };
  }

  /* ------------------------------------------------------------- messages */
  function toast(text, ms) {
    let t = String(text);
    while (Font.measure(t) > SCR_W - 12 && t.length > 4) t = t.slice(0, -2);
    S.msg.push({ t, life: (ms || 1800) / 16.6 });
    if (S.msg.length > 3) S.msg.shift();
  }

  /* ---------------------------------------------------------------- update */
  function update(dt, In) {
    if (!S) return;
    S.t += dt;
    const W = World.state();
    W.stats.playMs += dt * 16.6;

    if (S.docking || S.streaming) { updateTransition(dt); return; }

    /* ---- steering ---- */
    const hand = World.handling() / 110;
    const turn = 0.028 * dt * (0.55 + hand * 0.7);
    let ix = In.axisX(), iy = In.axisY();
    if (W.invert) iy = -iy;
    if (S.autopilot) {
      const tgt = S.autopilot;
      const dx = tgt.x - S.px, dy = tgt.y - S.py, dz = tgt.z - S.pz;
      const wantYaw = Math.atan2(dx, dz);
      const wantPitch = Math.atan2(dy, Math.hypot(dx, dz));
      ix = clamp(wrapAngle(wantYaw - S.yaw) * 2.4, -1, 1);
      iy = clamp((wantPitch - S.pitch) * 2.4, -1, 1);
      S.throttle = 1;
      if (Math.hypot(dx, dy, dz) < (tgt.r || 60 * U)) { S.autopilot = null; toast(GameData.T(294)); }
    }
    S.yaw += ix * turn;
    S.pitch = clamp(S.pitch + iy * turn * 0.8, -1.2, 1.2);
    S.roll += (-ix * 0.5 - S.roll) * 0.09 * dt;

    if (In.pressed('throttleUp')) S.throttle = clamp(S.throttle + 0.25, 0, 1);
    if (In.pressed('throttleDown')) S.throttle = clamp(S.throttle - 0.25, 0, 1);

    /* booster */
    const bo = World.best(GameData.EQ.BOOSTER);
    if (In.pressed('boost') && bo && S.boostFuel > 0.25) { S.boost = bo.value * 12; Sfx.play('turbo'); }
    if (S.boost > 0) { S.boost -= dt; S.boostFuel = Math.max(0, S.boostFuel - dt / (bo ? bo.value * 26 : 100)); }
    else S.boostFuel = Math.min(1, S.boostFuel + dt / 900);

    /* all speeds are world units per second; one metre is U units */
    const baseSpeed = 2400 + World.handling() * 20;
    const speed = baseSpeed * (0.25 + S.throttle * 0.75) * (S.boost > 0 ? 2.6 : 1);
    const f = forward();
    const step = speed * dt / 60;
    S.vx = f.x * speed; S.vy = f.y * speed; S.vz = f.z * speed;
    S.px += f.x * step;
    S.py += f.y * step;
    S.pz += f.z * step;
    S.speed = speed;

    /* depth */
    S.depth = Math.max(0, World.station().depth * 100 - S.py / U);
    W.stats.maxDepth = Math.max(W.stats.maxDepth, S.depth / 100);
    W.stats.minDepth = Math.min(W.stats.minDepth, S.depth / 100);

    /* keep inside the sector */
    const d2 = Math.hypot(S.px, S.py, S.pz);
    if (d2 > SECTOR) {
      const k = SECTOR / d2;
      S.px *= k; S.py *= k; S.pz *= k;
      if (!(S.edgeWarn > 0)) { S.edgeWarn = 300; toast(GameData.T(255)); }
    }
    if (S.edgeWarn > 0) S.edgeWarn -= dt;

    /* pressure & radiation hazard */
    const lim = World.depthLimits();
    const dm = S.depth / 100;
    S.pressureWarn = dm > lim.max - 4;
    S.radiationWarn = dm < lim.min + 4;
    if (dm > lim.max || dm < lim.min) {
      S.alarm = 1;
      damagePlayer(0.5 * dt, dm > lim.max ? 'pressure' : 'radiation');
    } else S.alarm = Math.max(0, S.alarm - dt / 40);

    /* weapons */
    if (S.cool > 0) S.cool -= dt;
    if (In.pressed('fire') || (S.autofire && currentWeapon() && currentWeapon().kind !== 'harpoon')) fire();
    if (In.pressed('weapon')) cycleWeapon();
    if (In.pressed('autofire')) { W.autofire = S.autofire = !S.autofire; toast('AUTO ' + (S.autofire ? GameData.T(14) : GameData.T(15))); }
    if (In.pressed('camera')) S.camera = (S.camera + 1) % 2;
    if (In.pressed('autopilot')) autopilotToggle();
    if (In.pressed('action')) actionKey();

    updateShots(dt);
    updateLine(dt);
    updateEnts(dt);
    collide(dt);
    updateFx(dt);
    updateBubbles(dt);
    updateSnow(dt);
    acquireTarget();

    if (S.hitFlash > 0) S.hitFlash -= dt;
    if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 0.5);
    for (let i = S.msg.length - 1; i >= 0; i--) if ((S.msg[i].life -= dt) <= 0) S.msg.splice(i, 1);

    if (S.timeLimit > 0) {
      S.timeLimit -= dt;
      if (S.timeLimit <= 0) missionFail();
    }
    if (World.hull() <= 0 && !S.failed) { S.failed = true; if (S.onDone) S.onDone('dead'); }
  }

  function autopilotToggle() {
    if (S.autopilot) { S.autopilot = null; toast(GameData.T(323) + ' ' + GameData.T(15)); return; }
    const wp = S.ents.find(e => e.kind === 'waypoint');
    const t = wp || S.gate || S.station;
    if (!t) return;
    S.autopilot = t;
    Sfx.play('beep');
    toast(GameData.T(294));
  }

  function actionKey() {
    if (S.station && dist(S.station) < 150 * U) { beginDock(); return; }
    if (S.gate && dist(S.gate) < 110 * U) { beginStream(); return; }
    toast(GameData.T(271));
  }
  function dist(e) { return Math.hypot(e.x - S.px, e.y - S.py, e.z - S.pz); }

  function beginDock() {
    if (World.activeMission() && S.cfg.blockDock) { toast(GameData.T(269)); return; }
    S.docking = { t: 0 };
    S.autopilot = null;
    Sfx.play('dock');
  }
  function beginStream() {
    S.streaming = { t: 0 };
    Sfx.play('gate');
    World.state().stats.streams++;
  }
  function updateTransition(dt) {
    const tr = S.docking || S.streaming;
    tr.t += dt;
    const tgt = S.docking ? S.station : S.gate;
    const dx = tgt.x - S.px, dy = tgt.y - S.py, dz = tgt.z - S.pz;
    const d = Math.hypot(dx, dy, dz) || 1;
    const step = Math.min(d, 6000 * dt / 60);
    S.px += dx / d * step; S.py += dy / d * step; S.pz += dz / d * step;
    S.yaw += wrapAngle(Math.atan2(dx, dz) - S.yaw) * 0.1 * dt;
    if (tr.t > 55 || d < 40 * U) {
      if (S.docking) { if (S.onDone) S.onDone('dock'); }
      else { if (S.onDone) S.onDone('stream'); }
      S.docking = S.streaming = null;
    }
  }

  /* --------------------------------------------------------------- shots */
  function updateShots(dt) {
    for (let i = S.shots.length - 1; i >= 0; i--) {
      const s = S.shots[i];
      if (s.seek && s.seek.hp > 0) {
        const dx = s.seek.x - s.x, dy = s.seek.y - s.y, dz = s.seek.z - s.z;
        const d = Math.hypot(dx, dy, dz) || 1;
        s.dx += (dx / d - s.dx) * 0.06 * dt;
        s.dy += (dy / d - s.dy) * 0.06 * dt;
        s.dz += (dz / d - s.dz) * 0.06 * dt;
        const l = Math.hypot(s.dx, s.dy, s.dz) || 1;
        s.dx /= l; s.dy /= l; s.dz /= l;
      }
      s.x += s.dx * s.spd * dt / 60;
      s.y += s.dy * s.spd * dt / 60;
      s.z += s.dz * s.spd * dt / 60;
      s.life -= dt;
      let gone = s.life <= 0;
      if (!gone) {
        if (s.mine) {
          for (const e of S.ents) {
            if (e.dead || e.hp === undefined || e.hp <= 0) continue;
            if (e.kind === 'station' || e.kind === 'waypoint' || e.kind === 'crate') continue;
            if (Math.hypot(e.x - s.x, e.y - s.y, e.z - s.z) < e.r + 8 * U) { hitEntity(e, s.dmg, s); gone = true; break; }
          }
        } else {
          if (Math.hypot(S.px - s.x, S.py - s.y, S.pz - s.z) < 20 * U) { damagePlayer(s.dmg, 'hit'); gone = true; }
        }
        /* whoever fired it, a bolt stops at the station hull instead of
           sailing straight through the middle of it */
        if (!gone && S.station) {
          const st = S.station;
          if (Math.hypot(st.x - s.x, st.y - s.y, st.z - s.z) < st.r * 0.78) {
            sparks(s.x, s.y, s.z); gone = true;
          }
        }
      }
      if (gone) {
        if (s.kind === 'torpedo') boom(s.x, s.y, s.z, 1.6);
        S.shots.splice(i, 1);
      }
    }
  }

  /* --------------------------------------------------------------- harpoon */
  function updateLine(dt) {
    const L = S.line;
    if (!L) return;
    const spd = 11000 * dt / 60;
    if (!L.back) {
      L.x += L.dx * spd; L.y += L.dy * spd; L.z += L.dz * spd;
      L.len += spd;
      for (const e of S.ents) {
        if (e.dead) continue;
        if (e.kind !== 'fish' && e.kind !== 'crate') continue;
        if (Math.hypot(e.x - L.x, e.y - L.y, e.z - L.z) < e.r + 10 * U) {
          L.hit = e; L.back = true;
          if (e.kind === 'fish') {
            const c = GameData.creatures[e.species];
            e.paralysis = L.e.value * 8 - c.toughness * 4;
            e.hooked = e.paralysis > 0;
            e.panic = 60;
            if (!e.hooked) { toast(GameData.T(348)); World.state().stats.fishLost++; World.state().stats.catchStreak = 0; L.hit = null; }
          }
          Sfx.play('harpoonHit');
          break;
        }
      }
      if (L.len > L.max) L.back = true;
    } else {
      const dx = S.px - L.x, dy = S.py - L.y, dz = S.pz - L.z;
      const d = Math.hypot(dx, dy, dz) || 1;
      const step = Math.min(d, spd * 1.3);
      L.x += dx / d * step; L.y += dy / d * step; L.z += dz / d * step;
      if (L.hit && !L.hit.dead) { L.hit.x = L.x; L.hit.y = L.y; L.hit.z = L.z; }
      if (d < 24 * U) {
        if (L.hit) collect(L.hit);
        S.line = null;
        return;
      }
    }
  }

  function collect(e) {
    const W = World.state();
    if (e.kind === 'crate') {
      const got = World.addCargo(e.goodId, e.n);
      if (got) {
        W.stats.crates++;
        toast(GameData.T(293) + ': ' + GameData.goodName(e.goodId));
        Sfx.play('pickup');
      } else toast(GameData.T(143));
      e.dead = true;
      return;
    }
    const c = GameData.creatures[e.species];
    const room = World.holdMax() - World.holdUsed();
    if (room < c.weight) { toast(GameData.T(349)); Sfx.play('deny'); e.hooked = false; e.paralysis = 0; return; }
    World.addCargo(e.species, 1);
    W.speciesSeen[e.species] = true;
    W.stats.fishCaught++;
    W.stats.catchStreak++;
    W.stats.bestCatchStreak = Math.max(W.stats.bestCatchStreak, W.stats.catchStreak);
    S.caughtHere++;
    e.dead = true;
    Sfx.play('pickup');
    toast(GameData.T(10 + 0) && GameData.goodName(e.species));
    if (S.objective === 'fish' && (S.objectiveSpecies === undefined || S.objectiveSpecies === e.species)) progress();
  }

  /* ------------------------------------------------------------- collision --
     The boat is a sphere and so is everything solid out there.  Anything it
     runs into now stops it at the contact point and, if it was moving, costs
     hull and shakes the cabin.  Without this the sub flew straight through
     stations, wrecks, ships and whales, which is what made the sector read as
     a painted backdrop rather than a place. */
  const PLAYER_R = 9 * U;

  function solidRadius(e) {
    if (!e || e.dead || !e.r) return 0;
    switch (e.kind) {
      case 'gate': return 0;                      /* a ring you fly through */
      case 'waypoint': return 0;                  /* a marker, not a thing */
      case 'crate': case 'capsule': return 0;     /* collected, not bumped */
      case 'mine': return 0;                      /* has its own trigger */
      case 'fish': {
        const c = GameData.creatures[e.species];
        return c && c.algae ? 0 : e.r;            /* kelp bends out of the way */
      }
      case 'station': return e.r * 0.78;          /* the hull, inside the bay */
      default: return e.r;
    }
  }

  function collide(dt) {
    for (let i = 0; i < S.ents.length; i++) {
      const e = S.ents[i];
      const er = solidRadius(e);
      if (!er) continue;
      const rr = er + PLAYER_R;
      let dx = S.px - e.x, dy = S.py - e.y, dz = S.pz - e.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= rr * rr) { e.contact = false; continue; }
      const resting = e.contact === true;      /* already leaning on it */
      e.contact = true;
      let d = Math.sqrt(d2);
      if (d < 1e-3) { dx = 0; dy = 1; dz = 0; d = 1; }
      const nx = dx / d, ny = dy / d, nz = dz / d;
      /* put the boat back on the outside of the shell */
      S.px = e.x + nx * rr; S.py = e.y + ny * rr; S.pz = e.z + nz * rr;
      /* how hard the nose was driving into it */
      const closing = -(S.vx * nx + S.vy * ny + S.vz * nz);
      /* everything but the station gives a little, so a shoal is shouldered
         aside instead of pinning the player in place */
      if (e.kind !== 'station') {
        const back = Math.min(rr * 0.4, 14 * U * dt);
        e.x -= nx * back; e.y -= ny * back; e.z -= nz * back;
        if (e.kind === 'fish') { e.panic = Math.max(e.panic, 90); e.hooked = false; }
        if (e.kind === 'ship' && closing > 0) e.aggro = Math.max(e.aggro || 0, 200);
      }
      /* the hit lands once, when the two first touch: scraping along a hull
         you are already pressed against costs nothing but progress */
      if (resting || closing <= 200) continue;
      const mass = e.kind === 'station' ? 1.7 : e.kind === 'ship' ? 1.15
        : e.kind === 'trash' ? 0.55 : 0.75;
      const dmg = Math.min(26, (closing / 3600) * mass * 7);
      if (dmg < 0.5) continue;
      damagePlayer(dmg, 'hit');
      S.throttle = Math.min(S.throttle, 0.3);          /* the crash stalls you */
      S.shake = Math.min(11, S.shake + Math.min(6, dmg));
      sparks(S.px - nx * PLAYER_R, S.py - ny * PLAYER_R, S.pz - nz * PLAYER_R);
      /* the other party takes the same knock, unless it is the station */
      if (e.hp !== undefined && e.hp < 1e8) hitEntity(e, dmg * 0.6, null);
    }
    /* traffic keeps out of the station too, so nothing is seen sliding
       through the hull it is supposed to be docking at */
    const st = S.station;
    if (!st) return;
    const sr = st.r * 0.78;
    for (let i = 0; i < S.ents.length; i++) {
      const e = S.ents[i];
      if (e.dead || e === st || (e.kind !== 'ship' && e.kind !== 'trash')) continue;
      const rr = sr + (e.r || 0);
      const dx = e.x - st.x, dy = e.y - st.y, dz = e.z - st.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= rr * rr || d2 < 1e-6) continue;
      const k = rr / Math.sqrt(d2);
      e.x = st.x + dx * k; e.y = st.y + dy * k; e.z = st.z + dz * k;
    }
  }

  /* ---------------------------------------------------------------- damage */
  function hitEntity(e, dmg, s) {
    if (e.kind === 'mine' && !e.armed) { Sfx.play('hit'); return; }
    e.hp -= dmg;
    Sfx.play('hit');
    sparks(s ? s.x : e.x, s ? s.y : e.y, s ? s.z : e.z);
    if (e.kind === 'ship') e.aggro = 260;
    if (e.hp <= 0) destroy(e);
  }
  function destroy(e) {
    const W = World.state();
    e.dead = true;
    boom(e.x, e.y, e.z, e.kind === 'ship' ? 2.2 : 1.4);
    if (e.kind === 'ship') {
      W.stats.kills++;
      W.stats.streak++;
      W.stats.bestStreak = Math.max(W.stats.bestStreak, W.stats.streak);
      if (e.faction === 'pirate') W.stats.pirateKills++;
      S.killsHere++;
      for (let i = 0; i < 1 + ((Math.random() * 2) | 0); i++)
        if (e.cargo !== undefined) spawnCrate(e.x, e.y, e.z, e.cargo, 1);
      if (S.objective === 'kill' || (S.objective === 'pirates' && e.faction === 'pirate')) progress();
      if (e.tag === 'target') progress();
    } else if (e.kind === 'fish') {
      W.stats.fishKilled++;
      W.stats.catchStreak = 0;
      if (Math.random() < 0.6) spawnCrate(e.x, e.y, e.z, 18, 1);      /* dead fish */
      if (S.objective === 'cull') progress();
      if (S.objective === 'protect') { S.protectLost = (S.protectLost || 0) + 1; }
    } else if (e.kind === 'mine') {
      Sfx.play('mine');
      if (S.objective === 'mines') progress();
    } else if (e.kind === 'trash') {
      if (S.objective === 'trash') progress();
      if (Math.random() < 0.4) spawnCrate(e.x, e.y, e.z, 35, 1);
    } else if (e.kind === 'capsule') {
      if (S.objective === 'capsuleKill') progress();
      if (S.objective === 'capsuleGuard') S.protectLost = (S.protectLost || 0) + 1;
    }
  }
  function progress() {
    S.objectiveDone++;
    if (S.objectiveNeed && S.objectiveDone >= S.objectiveNeed && !S.cleared) {
      S.cleared = true;
      Sfx.play('medal');
      toast(GameData.T(92));
      if (S.onDone) setTimeout(() => S.onDone('clear'), 900);
    }
  }
  function missionFail() {
    if (S.failed) return;
    S.failed = true;
    Sfx.play('fail');
    toast(GameData.T(228));
    if (S.onDone) setTimeout(() => S.onDone('fail'), 900);
  }

  function damagePlayer(dmg, why) {
    const W = World.state();
    const sh = World.shield();
    if (sh > 0) {
      W.ship.shieldDmg = Math.min(World.shieldMax(), W.ship.shieldDmg + dmg);
    } else {
      W.ship.hullDmg = Math.min(World.hullMax(), W.ship.hullDmg + dmg);
      W.stats.streak = 0;
    }
    S.hitFlash = 8;
    S.shake = Math.min(9, S.shake + 2);
    if (why === 'hit') Sfx.play('hit');
    if (World.hull() <= 0) Sfx.play('explosion');
  }

  /* ---------------------------------------------------------------- entities */
  function updateEnts(dt) {
    const sh = World.best(GameData.EQ.SHIELD);
    /* shield regeneration for the ion / plasma deflectors */
    if (sh && sh.id >= 20) {
      const W = World.state();
      W.ship.shieldDmg = Math.max(0, W.ship.shieldDmg - dt * (sh.id === 21 ? 0.055 : 0.022));
    }
    for (let i = S.ents.length - 1; i >= 0; i--) {
      const e = S.ents[i];
      if (e.dead) { S.ents.splice(i, 1); continue; }
      switch (e.kind) {
        case 'fish': updateFish(e, dt); break;
        case 'ship': updateShip(e, dt); break;
        case 'mine': updateMine(e, dt); break;
        case 'crate': updateCrate(e, dt); break;
        case 'capsule': updateCapsule(e, dt); break;
        case 'trash': e.yaw += e.spin * dt / 60; break;
        case 'gate': e.spin = (e.spin || 0) + dt * 0.012; break;
      }
    }
  }

  function updateFish(e, dt) {
    e.anim += dt * 0.09;
    e.frame = ((e.anim | 0) % 2);
    const c = GameData.creatures[e.species];
    if (c.algae) return;
    if (e.hooked) {
      e.paralysis -= dt * 0.05;
      if (e.paralysis <= 0) { e.hooked = false; if (S.line && S.line.hit === e) { S.line.hit = null; S.line.back = true; } }
      return;
    }
    const dx = S.px - e.x, dy = S.py - e.y, dz = S.pz - e.z;
    const d = Math.hypot(dx, dy, dz) || 1;
    if (e.panic > 0) e.panic -= dt;
    let tx, ty, tz;
    if (d < 200 * U || e.panic > 0) {          /* flee the boat */
      tx = -dx / d; ty = -dy / d; tz = -dz / d;
    } else {
      e.wander += rnd(-0.06, 0.06) * dt;
      tx = Math.sin(e.wander); ty = Math.sin(e.wander * 0.4) * 0.2; tz = Math.cos(e.wander);
    }
    const want = Math.atan2(tx, tz);
    e.yaw += wrapAngle(want - e.yaw) * 0.05 * dt;
    e.pitch += (Math.atan2(ty, 1) - e.pitch) * 0.04 * dt;
    const sp = e.speed * (e.panic > 0 ? 1.8 : 1) * dt / 60;
    e.x += Math.sin(e.yaw) * Math.cos(e.pitch) * sp;
    e.y += Math.sin(e.pitch) * sp;
    e.z += Math.cos(e.yaw) * Math.cos(e.pitch) * sp;
    if (Math.hypot(e.x, e.y, e.z) > SECTOR) { e.wander += Math.PI; }
  }

  function updateShip(e, dt) {
    const dx = S.px - e.x, dy = S.py - e.y, dz = S.pz - e.z;
    const d = Math.hypot(dx, dy, dz) || 1;
    if (e.aggro > 0) e.aggro -= dt;
    const hostile = e.hostile || e.aggro > 0;
    let tx, ty, tz;
    if (hostile && d < 900 * U) {
      e.dodge += dt * 0.03;
      const off = Math.sin(e.dodge) * 0.5;
      tx = dx / d + Math.cos(e.dodge) * off;
      ty = dy / d + Math.sin(e.dodge * 1.3) * 0.25;
      tz = dz / d - Math.sin(e.dodge) * off;
      if (d < 90 * U) { tx = -tx; ty = -ty; tz = -tz; }
    } else if (e.protect) {
      const px = e.protect.x - e.x, py = e.protect.y - e.y, pz = e.protect.z - e.z;
      const pd = Math.hypot(px, py, pz) || 1;
      tx = px / pd; ty = py / pd; tz = pz / pd;
    } else {
      e.dodge += dt * 0.006;
      tx = Math.sin(e.dodge); ty = Math.sin(e.dodge * 0.3) * 0.15; tz = Math.cos(e.dodge);
    }
    const want = Math.atan2(tx, tz);
    e.yaw += wrapAngle(want - e.yaw) * 0.035 * dt;
    e.pitch += (Math.atan2(ty, 1) - e.pitch) * 0.03 * dt;
    e.roll = (e.roll || 0) * 0.9 + wrapAngle(want - e.yaw) * 0.5;
    const sp = e.speed * dt / 60;
    e.x += Math.sin(e.yaw) * Math.cos(e.pitch) * sp;
    e.y += Math.sin(e.pitch) * sp;
    e.z += Math.cos(e.yaw) * Math.cos(e.pitch) * sp;

    if (hostile) {
      e.cool -= dt;
      if (e.cool <= 0 && d < 620 * U) {
        e.cool = 55 + Math.random() * 60;
        const lead = 0.06;
        const ax = dx / d + S.vx * lead, ay = dy / d + S.vy * lead, az = dz / d + S.vz * lead;
        const l = Math.hypot(ax, ay, az) || 1;
        S.shots.push({
          kind: 'bolt', x: e.x, y: e.y, z: e.z, dx: ax / l, dy: ay / l, dz: az / l,
          spd: 15000, life: 110, dmg: 2 + World.state().difficulty, mine: false,
          model: 'laser_1', scale: 1
        });
        Sfx.play('railgun');
      }
    }
  }

  function updateMine(e, dt) {
    const d = Math.hypot(S.px - e.x, S.py - e.y, S.pz - e.z);
    if (!e.armed && d < 120 * U) { e.armed = true; Sfx.play('alert'); toast(GameData.T(200)); }
    if (e.armed) {
      e.arm += dt;
      if (d < 40 * U) { destroy(e); damagePlayer(18, 'mine'); }
    }
    e.yaw += dt * 0.01;
  }
  function updateCrate(e, dt) {
    e.y -= 420 * dt / 60;
    e.yaw += dt * 0.02; e.pitch += dt * 0.014;
    e.life -= dt / 60;
    if (e.life <= 0) e.dead = true;
  }
  function updateCapsule(e, dt) {
    e.y += e.rise * dt / 60;
    e.yaw += dt * 0.006;
    if (e.y > 400 * U) { e.dead = true; if (S.objective === 'capsuleGuard') progress(); }
  }

  /* ------------------------------------------------------------------- fx */
  function boom(x, y, z, s) {
    S.fx.push({ kind: 'boom', x, y, z, t: 0, s: s || 1 });
    Sfx.play('explosion');
    S.shake = Math.min(10, S.shake + 4 * s);
  }
  function sparks(x, y, z) { S.fx.push({ kind: 'spark', x, y, z, t: 0, s: 0.5 }); }
  function updateFx(dt) {
    for (let i = S.fx.length - 1; i >= 0; i--) {
      const f = S.fx[i];
      f.t += dt;
      if (f.t > (f.kind === 'boom' ? 42 : 14)) S.fx.splice(i, 1);
    }
  }
  function updateSnow(dt) {
    for (const p of S.snow) {
      p.d += dt * 0.01;
      p.y += p.v * dt / 60;
      p.x += Math.sin(p.d) * 30 * dt / 60;
      if (Math.abs(p.y - S.py) > 65 * U || Math.hypot(p.x - S.px, p.z - S.pz) > 80 * U) {
        const n = newSnow();
        p.x = n.x; p.y = S.py + 60 * U; p.z = n.z; p.s = n.s;
      }
    }
  }
  function updateBubbles(dt) {
    for (const b of S.bubbles) {
      b.y += b.v * dt / 60;
      if (b.y - S.py > 45 * U || Math.hypot(b.x - S.px, b.z - S.pz) > 55 * U) {
        const n = newBubble(false);
        b.x = n.x; b.y = n.y; b.z = n.z; b.s = n.s; b.v = n.v; b.f = n.f;
      }
    }
  }

  function acquireTarget() {
    let best = null, bestScore = 1e30;
    const f = forward();
    for (const e of S.ents) {
      if (e.dead) continue;
      if (e.kind !== 'ship' && e.kind !== 'fish' && e.kind !== 'mine' && e.kind !== 'capsule') continue;
      const dx = e.x - S.px, dy = e.y - S.py, dz = e.z - S.pz;
      const d = Math.hypot(dx, dy, dz);
      if (d > 900 * U) continue;
      const dot = (dx * f.x + dy * f.y + dz * f.z) / (d || 1);
      if (dot < 0.86) continue;
      const score = d * (2 - dot);
      if (score < bestScore) { bestScore = score; best = e; }
    }
    S.target = best;
  }

  /* ---------------------------------------------------------------- render */
  const FOG_SHALLOW = [22, 78, 104], FOG_DEEP = [2, 10, 22];
  /* the sector is full bleed: it pushes its own region so it covers the whole
     display, whatever page a menu on top of it is using */
  function render(ctx) {
    Gfx.pushFull();
    try { renderSector(ctx); } finally { Gfx.pop(); }
  }
  function renderSector(ctx) {
    const dm = clamp(S.depth / 9000, 0, 1);
    const fr = Math.round(FOG_SHALLOW[0] + (FOG_DEEP[0] - FOG_SHALLOW[0]) * dm);
    const fg = Math.round(FOG_SHALLOW[1] + (FOG_DEEP[1] - FOG_SHALLOW[1]) * dm);
    const fb = Math.round(FOG_SHALLOW[2] + (FOG_DEEP[2] - FOG_SHALLOW[2]) * dm);
    Gfx.setFog(fr, fg, fb, 40 * U, (620 - dm * 260) * U);
    /* light falls from the surface, so the water column is graded */
    const lift = 1 - dm;
    Gfx.clearGradient(
      [Math.round(fr + 34 * lift), Math.round(fg + 52 * lift), Math.round(fb + 58 * lift)],
      [Math.round(fr * 0.45), Math.round(fg * 0.45), Math.round(fb * 0.5)],
      SCR_H / 2 + Math.sin(S.pitch) * SCR_H * 0.9);

    /* camera */
    const shake = S.shake > 0 ? S.shake : 0;
    const back = S.camera === 0 ? 76 * U : 2 * U;
    const up = S.camera === 0 ? 11 * U : 5 * U;
    const f = forward();
    const cx = S.px - f.x * back + rnd(-shake, shake) * 30;
    const cy = S.py - f.y * back + up + rnd(-shake, shake) * 30;
    const cz = S.pz - f.z * back + rnd(-shake, shake) * 30;
    Gfx.setCamera(cx, cy, cz, S.yaw, S.pitch - (S.camera === 0 ? 0.055 : 0), S.roll * 0.35, 1.02);

    /* entities, far first so the painter's order plays nicely with the z buffer */
    const order = S.ents.slice().sort((a, b) =>
      Math.hypot(b.x - cx, b.y - cy, b.z - cz) - Math.hypot(a.x - cx, a.y - cy, a.z - cz));
    for (const e of order) drawEnt(e, cx, cy, cz);

    /* the player's own boat in chase view */
    if (S.camera === 0) {
      const m = M['u' + World.state().ship.type];
      if (m) Gfx.drawModel(m, S.px, S.py, S.pz, Gfx.rotMatrix(S.yaw, S.pitch, S.roll * 0.5), 1, TEX.deep,
        { ambient: 0.66, noFog: true });
    }

    /* shots */
    for (const s of S.shots) {
      const m = M[s.model];
      if (!m) continue;
      const yaw = Math.atan2(s.dx, s.dz), pitch = Math.atan2(s.dy, Math.hypot(s.dx, s.dz));
      Gfx.drawModel(m, s.x, s.y, s.z, Gfx.rotMatrix(yaw, pitch, 0), s.scale, texFor(s.model),
        { ambient: 1, alpha: 0.8 });
    }

    /* harpoon line */
    if (S.line) {
      const L = S.line;
      const steps = 12;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        Gfx.point(S.px + (L.x - S.px) * t, S.py + (L.y - S.py) * t, S.pz + (L.z - S.pz) * t,
          40, 210, 240, 255);
      }
    }

    /* explosions and sparks */
    for (const fx of S.fx) {
      if (fx.kind === 'boom' && M.explosion) {
        const k = fx.t / 42;
        Gfx.drawModel(M.explosion, fx.x, fx.y, fx.z, Gfx.rotMatrix(fx.t * 0.05, fx.t * 0.03, 0),
          fx.s * (0.4 + k * 1.5), TEX.fx, { additive: true, alpha: 1 - k, ambient: 1, noFog: true });
      } else {
        for (let i = 0; i < 5; i++)
          Gfx.point(fx.x + rnd(-4, 4) * U, fx.y + rnd(-4, 4) * U, fx.z + rnd(-4, 4) * U,
            70, 255, Math.max(80, 210 - fx.t * 8), 120);
      }
    }

    /* marine snow, then the boat's own bubble trail */
    for (const p of S.snow) Gfx.point(p.x, p.y, p.z, p.s, 150, 190, 210);
    for (const b of S.bubbles) Gfx.point(b.x, b.y, b.z, b.s, 180, 220, 240);

    Gfx.flush();
    hud(ctx);
  }

  function drawEnt(e, cx, cy, cz) {
    const d = Math.hypot(e.x - cx, e.y - cy, e.z - cz);
    if (d > 1400 * U) return;
    switch (e.kind) {
      case 'station': {
        const rot = Gfx.rotMatrix(e.yaw, 0, 0);
        for (const mod of e.modules) {
          const m = M[mod.m];
          if (!m) continue;
          const r = Gfx.rotMatrix(e.yaw + (mod.yaw || 0), 0, 0);
          const sx = e.x + Math.cos(e.yaw) * mod.x + Math.sin(e.yaw) * mod.z;
          const sz = e.z - Math.sin(e.yaw) * mod.x + Math.cos(e.yaw) * mod.z;
          Gfx.drawModel(m, sx, e.y + mod.y, sz, r, e.scale, TEX.deep, {});
        }
        break;
      }
      case 'gate': {
        if (M.stream) Gfx.drawModel(M.stream, e.x, e.y, e.z, Gfx.rotMatrix(e.yaw, 0, e.spin),
          e.scale, TEX.deep, { ambient: 0.8 });
        break;
      }
      case 'fish': {
        const c = GameData.creatures[e.species];
        const names = c.models;
        const m = M[names[Math.min(e.frame, names.length - 1)]] || M[names[0]];
        if (!m) return;
        Gfx.drawModel(m, e.x, e.y, e.z, Gfx.rotMatrix(e.yaw, e.pitch, 0), e.scale, TEX.fx,
          { tint: e.hooked ? [1.5, 1.3, 0.8] : null, ambient: 0.55 });
        break;
      }
      case 'ship': {
        const m = M[e.model];
        if (!m) return;
        Gfx.drawModel(m, e.x, e.y, e.z, Gfx.rotMatrix(e.yaw, e.pitch, e.roll * 0.4), e.scale,
          TEX.deep, { tint: e.tint });
        break;
      }
      case 'mine':
        if (M.mine) Gfx.drawModel(M.mine, e.x, e.y, e.z, Gfx.rotMatrix(e.yaw, e.pitch, 0), e.scale, TEX.deep,
          { tint: e.armed ? [1.6, 0.6, 0.5] : null });
        break;
      case 'crate':
        if (M.box) Gfx.drawModel(M.box, e.x, e.y, e.z, Gfx.rotMatrix(e.yaw, e.pitch, 0), e.scale, TEX.deep, {});
        break;
      case 'capsule':
        if (M.kapsel) Gfx.drawModel(M.kapsel, e.x, e.y, e.z, Gfx.rotMatrix(e.yaw, 0, 0), e.scale, TEX.deep, {});
        break;
      case 'trash':
        if (M.trash) Gfx.drawModel(M.trash, e.x, e.y, e.z, Gfx.rotMatrix(e.yaw, e.pitch, 0), e.scale, TEX.deep, {});
        break;
      case 'waypoint':
        if (M.pfeil) Gfx.drawModel(M.pfeil, e.x, e.y + Math.sin(S.t * 0.04) * 6 * U, e.z,
          Gfx.rotMatrix(S.t * 0.02, 0, 0), 2, TEX.fx, { additive: true, ambient: 1, alpha: 0.8 });
        break;
    }
  }

  /* ------------------------------------------------------------------- HUD */
  function sprite(ctx, name, x, y) {
    const im = IMG[name];
    if (im) ctx.drawImage(im, x | 0, y | 0);
  }
  function bracketFor(e) {
    if (e.kind === 'fish') return 'bracket_creature';
    if (e.kind === 'ship') return (e.hostile ? 'bracket_enemy' : 'bracket_friend');
    if (e.kind === 'waypoint') return 'bracket_waypoint';
    if (e.kind === 'station' || e.kind === 'gate') return 'bracket_landmark';
    return 'bracket_box';
  }

  function hud(ctx) {
    const W = World.state();
    const C = UI.COL;

    /* target brackets over everything that matters */
    for (const e of S.ents) {
      if (e.dead) continue;
      if (e.kind === 'trash' || e.kind === 'crate') continue;
      const range = Math.hypot(e.x - S.px, e.y - S.py, e.z - S.pz);
      if (e.kind === 'fish' && e !== S.target && range > 260 * U) continue;
      if (range > 900 * U && e !== S.target) continue;
      const p = Gfx.project(e.x, e.y, e.z);
      if (!p || p.x < -20 || p.x > SCR_W + 20 || p.y < -20 || p.y > SCR_H + 20) continue;
      const base = bracketFor(e);
      let name;
      if (p.z < 160 * U) name = base + '_in';
      else if (p.z < 420 * U) name = base + '_out';
      else name = IMG[base + '_far'] ? base + '_far' : base + '_out';
      const im = IMG[name] || IMG[base + '_out'] || IMG[base + '_in'];
      if (!im) continue;
      ctx.globalAlpha = e === S.target ? 1 : 0.55;
      ctx.drawImage(im, (p.x - im.width / 2) | 0, (p.y - im.height / 2) | 0);
      ctx.globalAlpha = 1;
    }
    /* crosshair */
    sprite(ctx, 'crosshair', SCR_W / 2 - 5, SCR_H / 2 - 5);

    /* --- top strip: hull, shield, depth ---------------------------------- */
    ctx.fillStyle = 'rgba(3,16,24,0.72)';
    ctx.fillRect(0, 0, SCR_W, 26);
    sprite(ctx, 'i_hull', 3, 3);
    UI.bar(ctx, 15, 4, 60, 6, World.hull() / Math.max(1, World.hullMax()), '#5cff9a');
    sprite(ctx, 'i_shield', 3, 13);
    UI.bar(ctx, 15, 14, 60, 6, World.shield() / Math.max(1, World.shieldMax()), '#4fc8ff');
    Font.draw(ctx, Math.round(S.depth) + 'm', 80, 2,
      S.alarm > 0 ? C.warn : (S.pressureWarn || S.radiationWarn) ? C.gold : C.text);
    Font.drawRight(ctx, World.holdUsed() + '/' + World.holdMax() + 't', SCR_W - 4, 2, C.dim);
    Font.drawRight(ctx, W.credits.toLocaleString() + ' $', SCR_W - 4, 13, C.gold);

    /* the big hazard banner only when the hull is actually taking damage */
    if (S.alarm > 0) {
      const pressure = S.depth / 100 > World.depthLimits().max;
      const blink = S.t % 30 < 15;
      const name = pressure ? (blink ? 'display_warning_pressure' : 'display_pressure')
                            : (blink ? 'display_warning_radiation' : 'display_radiation');
      const im = IMG[name];
      if (im) ctx.drawImage(im, ((SCR_W - im.width) / 2) | 0, 52);
    }

    /* --- weapon & booster ------------------------------------------------- */
    const w = currentWeapon();
    const by = SCR_H - 44;
    ctx.fillStyle = 'rgba(3,16,24,0.72)';
    ctx.fillRect(0, by, SCR_W, 30);
    if (w) {
      sprite(ctx, w.kind === 'harpoon' ? 'i_harpoon' : 'i_laser', 3, by + 2);
      Font.draw(ctx, GameData.equipName(w.e.id), 15, by + 2, C.text);
      UI.bar(ctx, 15, by + 14, 70, 4, 1 - Math.max(0, S.cool) / w.e.reload, '#ffcf4a');
    } else Font.draw(ctx, GameData.T(145), 4, by + 2, C.dim);
    if (World.best(GameData.EQ.BOOSTER)) {
      sprite(ctx, 'i_booster', 96, by + 2);
      UI.bar(ctx, 108, by + 3, 40, 5, S.boostFuel, S.boost > 0 ? '#ff8a3c' : '#7fe4ff');
      if (S.boostFuel > 0.99) Font.draw(ctx, GameData.T(138), 108, by + 10, C.good);
    }
    if (S.autofire) sprite(ctx, 'i_autofire', 154, by + 2);
    if (S.autopilot) sprite(ctx, 'i_autopilot', 166, by + 2);
    /* throttle */
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = (S.throttle * 5 > i) ? '#7fe4ff' : '#123a4c';
      ctx.fillRect(SCR_W - 40 + i * 7, by + 20, 5, 6);
    }

    /* --- radar ------------------------------------------------------------- */
    if (S.radar > 0) radar(ctx);

    /* --- target read-out --------------------------------------------------- */
    if (S.target) {
      const e = S.target;
      const y = 28;
      let label = '';
      if (e.kind === 'fish') label = GameData.goodName(e.species);
      else if (e.kind === 'ship') label = GameData.T(e.faction === 'pirate' ? 240 : e.faction === 'rebel' ? 239 : 238);
      else if (e.kind === 'mine') label = GameData.T(170);
      else if (e.kind === 'capsule') label = GameData.T(266);
      const d = Math.round(Math.hypot(e.x - S.px, e.y - S.py, e.z - S.pz) / U);
      Font.draw(ctx, label + '  ' + d + 'm', 4, y, e.hostile ? C.warn : C.hi);
      if (S.radar >= 2 && e.hpMax) UI.bar(ctx, 4, y + 11, 54, 4, e.hp / e.hpMax, '#ff6a52');
    }

    /* --- objective --------------------------------------------------------- */
    if (S.objectiveNeed) {
      const txt = (S.objectiveLabel || GameData.T(297)) + ': ' + S.objectiveDone + '/' + S.objectiveNeed;
      Font.drawCentre(ctx, txt, SCR_W / 2, 41, C.gold);
    } else if (S.hint) {
      let h = S.hint;
      while (Font.measure(h) > SCR_W - 8 && h.length > 4) h = h.slice(0, -2);
      Font.drawCentre(ctx, h, SCR_W / 2, 41, C.gold);
    }
    if (S.timeLimit > 0) Font.drawRight(ctx, Math.ceil(S.timeLimit / 60) + 's', SCR_W - 4, 41, C.warn);

    /* --- prompts ----------------------------------------------------------- */
    if (S.station && dist(S.station) < 150 * U && !S.docking)
      Font.drawCentre(ctx, GameData.T(271), SCR_W / 2, SCR_H - 58, C.good);
    else if (S.gate && dist(S.gate) < 110 * U && !S.streaming)
      Font.drawCentre(ctx, GameData.T(270), SCR_W / 2, SCR_H - 58, C.good);

    /* --- toasts ------------------------------------------------------------ */
    let my = 56;
    for (const m of S.msg) { Font.drawCentre(ctx, m.t, SCR_W / 2, my, C.hi); my += 12; }

    /* --- flashes ----------------------------------------------------------- */
    if (S.hitFlash > 0) {
      ctx.fillStyle = 'rgba(255,60,40,' + (S.hitFlash / 26) + ')';
      ctx.fillRect(0, 0, SCR_W, SCR_H);
    }
    if (S.alarm > 0 && S.t % 40 < 20) {
      ctx.strokeStyle = 'rgba(255,90,60,0.8)'; ctx.lineWidth = 3;
      ctx.strokeRect(1.5, 1.5, SCR_W - 3, SCR_H - 3);
    }
    if (S.docking || S.streaming) {
      UI.shade(ctx, 0.35);
      Font.drawCentre(ctx, S.docking ? GameData.T(24) : 'S.T.R.E.A.M.', SCR_W / 2, SCR_H / 2 - 6, C.hi);
    }
    UI.softkeys(ctx, GameData.T(67), GameData.T(21));
  }

  function radar(ctx) {
    const R = 26, cx = SCR_W - R - 6, cy = SCR_H - 44 - R - 6;
    ctx.fillStyle = 'rgba(4,26,36,0.8)';
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#2b566b'; ctx.lineWidth = 1; ctx.stroke();
    const range = 900 * U;
    const cs = Math.cos(-S.yaw), sn = Math.sin(-S.yaw);
    for (const e of S.ents) {
      if (e.dead) continue;
      let col = null;
      if (e.kind === 'ship') col = e.hostile ? '#ff5a3c' : '#5cff9a';
      else if (e.kind === 'fish') col = S.radar >= 3 ? '#7fe4ff' : null;
      else if (e.kind === 'station') col = '#ffcf4a';
      else if (e.kind === 'gate') col = '#b06bff';
      else if (e.kind === 'waypoint') col = '#ffcf4a';
      else if (e.kind === 'mine' && S.radar >= 2) col = '#ff8a3c';
      if (!col) continue;
      const dx = e.x - S.px, dz = e.z - S.pz;
      const d = Math.hypot(dx, dz);
      if (d > range) continue;
      const rx = (dx * cs - dz * sn) / range * R, rz = (dx * sn + dz * cs) / range * R;
      ctx.fillStyle = col;
      ctx.fillRect(cx + rx - 1, cy - rz - 1, 2, 2);
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - 1, cy - 1, 2, 2);
  }

  return {
    bind, enter, state, update, render, toast, spawnShip, spawnCreature, spawnMine,
    spawnCapsule, spawnCrate, spawnWaypoint, ent: o => ent(o), U, boom, progress,
    missionFail, weaponList, currentWeapon
  };
})();
