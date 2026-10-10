const test = require('node:test');
const assert = require('node:assert/strict');
const { game, source, eventTarget } = require('./helpers.cjs');
const key = slot => `deep.submarine.odyssey.v1.${slot}`;

test('all three difficulty choices survive creation and save/load', async () => {
  const { World } = await game();
  for (const difficulty of [0, 1, 2]) {
    assert.equal(World.fresh('Pilot', 0, difficulty).difficulty, difficulty);
    assert.equal(World.save(0), true);
    World.fresh('Another pilot', 0, 1);
    assert.equal(World.load(0), true);
    assert.equal(World.state().difficulty, difficulty);
  }
  for (const invalid of [undefined, null, -1, 3, '0', NaN])
    assert.equal(World.fresh('Pilot', 0, invalid).difficulty, 1);
});

test('version 1 progress, missions, cargo and routes round-trip through all save slots', async () => {
  const { World, Campaign } = await game();
  const state = World.state();
  state.face = 999; // Portraits use procedural seeds, not only the 0..94 image IDs.
  state.missions.push(Campaign.logEntry(), World.makeJob(0, 0));
  state.cargo[18] = 3;
  state.plannedRoute = [0, 1];
  state.stats.playMs = 1234.5;
  const expected = JSON.stringify(state);
  for (const slot of [0, 1, 2]) assert.equal(World.save(slot), true);
  assert.equal(World.autosave(), true);
  assert.equal(World.hasAuto(), true);
  assert.equal(World.slots().filter(Boolean).length, 3);
  World.fresh('Replacement', 0, 2);
  assert.equal(World.loadAuto(), true);
  assert.equal(JSON.stringify(World.state()), expected);
});

test('missing, malformed and incompatible saves preserve the current game', async () => {
  const { World, stored } = await game();
  const current = World.state();
  const valid = JSON.stringify(current);
  const invalid = [null, '', '{', 'null', '{}', '[]', 'false'];
  const corruptions = [
    s => s.version = 2,
    s => s.station = 99999,
    s => s.difficulty = 8,
    s => s.ship = null,
    s => s.ship.slots[0] = 99999,
    s => s.ship.slots.pop(),
    s => s.stats = {},
    s => s.stats.kills = 'ten',
    s => s.cargo = { 99999: 1 },
    s => s.cargo = { 0: -1 },
    s => s.missions = [null],
    s => s.plannedRoute = [99999],
    s => s.credits = -1
  ];
  for (const corrupt of corruptions) {
    const candidate = JSON.parse(valid); corrupt(candidate); invalid.push(JSON.stringify(candidate));
  }
  for (const raw of invalid) {
    if (raw === null) { stored.delete(key(0)); stored.delete(key('auto')); }
    else { stored.set(key(0), raw); stored.set(key('auto'), raw); }
    assert.equal(World.load(0), false, String(raw));
    assert.equal(World.loadAuto(), false, String(raw));
    assert.equal(World.hasAuto(), false, String(raw));
    assert.equal(World.slots()[0], null);
    assert.equal(World.state(), current);
  }
});

test('unavailable storage leaves the menu and current game usable', async () => {
  const { World, Game, storage } = await game();
  const current = World.state();
  storage.failRead = storage.failWrite = true;
  assert.equal(World.hasAuto(), false);
  assert.equal(World.load(0), false);
  assert.equal(World.loadAuto(), false);
  assert.equal(World.save(0), false);
  assert.equal(World.autosave(), false);
  assert.equal(World.slots().filter(Boolean).length, 0);
  assert.equal(Game.review.mainItems().some(item => item.a === 'auto'), false);
  assert.equal(World.state(), current);
});

test('failed writes preserve the last save and display failure instead of success', async () => {
  const { World, Game, GameData, stored, storage, press } = await game();
  assert.equal(World.save(0), true);
  const previous = stored.get(key(0));
  World.state().credits += 100;
  storage.failWrite = true;
  Game.review.setPause(1);
  press('fire');
  assert.match(Game.review.overlay, /Save failed/);
  assert.notEqual(Game.review.overlay, GameData.T(32));
  assert.equal(stored.get(key(0)), previous);
  press('fire'); // Dismiss the error without saving again.
  storage.failWrite = false;
  press('fire');
  assert.equal(Game.review.overlay, GameData.T(32));
  assert.notEqual(stored.get(key(0)), previous);
});

test('pause overlays consume navigation, confirm and back before the menu', async () => {
  const { Game, press } = await game();
  Game.review.setMode('flight');
  Game.review.setPause(3);
  press('fire');
  assert.match(Game.review.overlay, /steer/);
  press('down');
  assert.equal(Game.review.pauseSel, 3);
  press('fire');
  assert.equal(Game.mode, 'pause');
  assert.equal(Game.review.overlay, null);
  press('fire'); // Open Help again.
  press('back');
  assert.equal(Game.mode, 'pause');
  assert.equal(Game.review.overlay, null);
  press('back');
  assert.equal(Game.mode, 'flight');
});

test('the station save button reports failure and recovers after storage is available', async () => {
  const { World, Campaign, Game, Station, GameData, storage, press } = await game();
  World.state().chapter = Campaign.CH.length;
  Game.review.setMode('station');
  Station.open({});
  for (let i = 0; i < 5; i++) press('down');
  press('fire');
  assert.equal(Station.current(), 'system');
  storage.failWrite = true;
  press('fire');
  assert.match(Game.review.overlay, /Save failed/);
  press('back');
  assert.equal(Game.review.overlay, null);
  assert.equal(Station.current(), 'system');
  storage.failWrite = false;
  press('fire');
  assert.equal(Game.review.overlay, GameData.T(32));
  press('fire');
  assert.equal(Game.review.overlay, null);
  assert.equal(Station.current(), 'system');
});

for (const event of ['blur', 'visibilitychange']) {
  test(`${event} clears keys, pending presses and joystick, and requires explicit resume`, async () => {
    const { Input, Game, window, document, enter, Flight, press } = await game();
    const sector = enter(() => {});
    Input.virtual('fire', true);
    Input.virtual('right', true);
    Input.stick.x = 0.75; Input.stick.y = -0.5;
    if (event === 'blur') window.dispatch(event);
    else { document.hidden = true; document.dispatch(event); }
    assert.equal(Input.held('fire'), false);
    assert.equal(Input.pressed('fire'), false);
    assert.equal(Input.held('right'), false);
    assert.equal(Input.axisX(), 0);
    assert.equal(Input.axisY(), 0);
    assert.equal(Game.mode, 'pause');
    Game.review.update(60);
    assert.equal(sector.t, 0);
    document.hidden = false; document.dispatch('visibilitychange'); window.dispatch('focus');
    assert.equal(Game.mode, 'pause');
    press('fire');
    assert.equal(Game.mode, 'flight');
  });
}

test('mobile joystick releases its touch and recentres visually on focus loss', async () => {
  const { Input, document, window, run } = await game();
  const elements = {};
  for (const id of ['bFire', 'bWeap', 'bAct', 'bBack', 'bMenu', 'stick', 'knob'])
    elements[id] = { ...eventTarget(), style: {}, getBoundingClientRect: () => ({left:0, top:0, width:100, height:100}) };
  document.getElementById = id => elements[id];
  const inline = [...source('index.html').matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
  run(inline);
  for (const event of ['blur', 'visibilitychange']) {
    const touch = {identifier: 1, clientX:65, clientY:50};
    elements.stick.dispatch('touchstart', {preventDefault() {}, changedTouches:[touch]});
    assert.ok(Input.axisX() > 0);
    if (event === 'blur') window.dispatch(event);
    else { document.hidden = true; document.dispatch(event); }
    assert.equal(Input.axisX(), 0);
    assert.equal(elements.knob.style.transform, 'translate(0,0)');
    elements.stick.dispatch('touchmove', {preventDefault() {}, changedTouches:[{...touch, clientX:95}]});
    assert.equal(Input.axisX(), 0, 'the abandoned touch must not reactivate steering');
    document.hidden = false;
  }
});

for (const reason of ['clear', 'fail']) {
  test(`${reason} is emitted once, uses gameplay time, and cannot affect a new sector`, async () => {
    const { Flight, Game, enter, window, press } = await game();
    const events = [];
    enter(value => events.push(`old:${value}`), {need: 1});
    if (reason === 'clear') Flight.progress(); else Flight.missionFail();
    window.dispatch('blur');
    Game.review.update(1000);
    assert.deepEqual(events, []);
    press('fire');
    Game.review.update(53);
    assert.deepEqual(events, []);
    Game.review.update(1);
    assert.deepEqual(events, [`old:${reason}`]);
    Game.review.update(1);
    assert.equal(events.length, 1);

    enter(value => events.push(`abandoned:${value}`), {need: 1});
    if (reason === 'clear') Flight.progress(); else Flight.missionFail();
    Game.review.setMode('mainmenu');
    Game.review.update(1000);
    enter(value => events.push(`new:${value}`));
    Game.review.update(60);
    assert.deepEqual(events, [`old:${reason}`]);
  });
}

test('a completed objective cannot also fail, and a failed objective cannot clear', async () => {
  const { Flight, Game, enter } = await game();
  const events = [];
  enter(value => events.push(value), {need: 1});
  Flight.progress(); Flight.missionFail(); Game.review.update(54);
  enter(value => events.push(value), {need: 1});
  Flight.missionFail(); Flight.progress(); Game.review.update(54);
  assert.deepEqual(events, ['clear', 'fail']);
});

test('projectile damage consumes shields then applies the remainder to hull', async () => {
  const { World, GameData, Flight, Game, enter } = await game();
  const shield = GameData.equip.find(e => e.type === GameData.EQ.SHIELD);
  for (const remaining of [0, 1, 10]) {
    World.fresh('Pilot', 0, 1);
    const state = World.state();
    state.ship.slots[1] = shield.id;
    state.ship.shieldDmg = shield.value - remaining;
    state.stats.streak = 7;
    const sector = enter(() => {});
    sector.shots.push({x:sector.px, y:sector.py, z:sector.pz, dx:0, dy:0, dz:0, spd:0, life:10, dmg:10, mine:false});
    Game.review.update(1);
    assert.equal(World.shield(), 0);
    assert.equal(state.ship.hullDmg, 10 - remaining);
    assert.equal(state.stats.streak, remaining === 10 ? 7 : 0);
    assert.equal(Flight.state().shots.length, 0);
  }
});

test('hull destruction still produces death after a mission has failed', async () => {
  const { World, Game, Flight, enter } = await game();
  const events = [];
  enter(value => events.push(value));
  Flight.missionFail();
  Game.review.update(54);
  World.state().ship.hullDmg = World.hullMax();
  Game.review.update(1);
  Game.review.update(1);
  assert.deepEqual(events, ['fail', 'dead']);
});
