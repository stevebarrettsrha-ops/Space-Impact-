const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {game, drawingContext, root} = require('./helpers.cjs');

function artwork(Portrait) {
  return Object.fromEntries(Portrait.PATHS.map(path => [path, {
    path, width: path === Portrait.ART_PATH ? 1312 : 640,
    height: path === Portrait.ART_PATH ? 1199 : 800
  }]));
}

test('all cast, player and AI pictures are bundled WebP images', async () => {
  const {Portrait} = await game();
  assert.equal(Portrait.count, 8);
  assert.equal(Portrait.PATHS.length, 10);
  for (const file of Portrait.PATHS) {
    const bytes = fs.readFileSync(path.join(root, file));
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', file);
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP', file);
  }
});

test('each named character uses its own source frame at native UI resolution', async () => {
  const {Portrait} = await game();
  Portrait.bind(artwork(Portrait));
  const frames = new Set();
  for (const character of ['j', 'r', 'l', 'a', 'y', 'f', 'm']) {
    const ctx = drawingContext();
    assert.equal(Portrait.drawCharacter(ctx, character, 12, 30, 112, 140), true);
    assert.equal(ctx.calls.length, 1);
    const call = ctx.calls[0], [image, sx, sy, sw, sh, x, y, w, h] = call.args;
    assert.equal(image.path, Portrait.CAST[character].path);
    assert.ok(sx >= 0 && sy >= 0 && sx + sw <= image.width && sy + sh <= image.height);
    assert.ok(Math.abs(sw / sh - w / h) < 0.0001, 'preserve facial proportions');
    assert.ok(sw > 400 && sh > 500, 'sample high-resolution art, not a 40px intermediate');
    assert.deepEqual([x, y, w, h], [12, 30, 112, 140]);
    assert.equal(call.smoothing, true);
    assert.equal(ctx.imageSmoothingEnabled, false, 'restore rendering state for other sprites');
    frames.add([image.path, sx, sy].join(':'));
  }
  assert.equal(frames.size, 7);
});

test('saved seeds select stable realistic player/contact portraits without impersonating the cast', async () => {
  const {Portrait, World} = await game();
  Portrait.bind(artwork(Portrait));
  for (const seed of [0, 7, 94, 152, 268, 999]) {
    World.state().face = seed;
    assert.equal(World.save(0), true);
    assert.equal(World.load(0), true);
    const ctx = drawingContext();
    Portrait.draw(ctx, World.state().face, 0, 0, 96, 120);
    const image = ctx.calls[0].args[0];
    assert.match(image.path, /pilot-\d+\.webp$/);
    assert.equal(image.path, Portrait.PATHS[seed % 8]);
  }
});

test('missing pictures fall back to another realistic picture, never legacy face parts', async () => {
  const {Portrait} = await game();
  const images = artwork(Portrait);
  Portrait.bind({[Portrait.PATHS[2]]: images[Portrait.PATHS[2]]});
  const ctx = drawingContext();
  assert.equal(Portrait.ready(), true);
  assert.equal(Portrait.drawCharacter(ctx, 'f', 0, 0, 80, 100), true);
  assert.equal(Portrait.draw(ctx, 0, 0, 0, 40), true);
  assert.ok(ctx.calls.every(call => call.args[0].path === Portrait.PATHS[2]));
  Portrait.bind({[Portrait.ART_PATH]: images[Portrait.ART_PATH]});
  assert.equal(Portrait.draw(ctx, 7, 0, 0, 40), true);
  assert.equal(ctx.calls.at(-1).args[0].path, Portrait.ART_PATH);
  Portrait.bind({});
  assert.equal(Portrait.ready(), false);
  assert.equal(Portrait.drawCharacter(ctx, 'j', 0, 0, 80, 100), false);
});

test('all campaign appearances map the six characters and M.A.I. consistently', async () => {
  const {Campaign, Portrait} = await game();
  const seen = new Set();
  for (let n = 0; n < 47; n++) {
    for (const line of await Campaign.scene(n)) {
      if (!Portrait.hasCharacter(line.character)) continue;
      seen.add(line.character);
      assert.equal(line.name, Portrait.CAST[line.character].name);
    }
  }
  assert.equal(seen.size, 7);
});

test('the picker cycles through each realistic portrait once and wraps', async () => {
  const {Game, Portrait, press} = await game();
  Game.review.setPicker();
  const selected = new Set();
  for (let i = 0; i < Portrait.count; i++) {
    selected.add(Game.review.newGame.face);
    press('right');
  }
  assert.equal(selected.size, Portrait.count);
  assert.equal(Game.review.newGame.face, 0);
  press('left');
  assert.equal(Game.review.newGame.face, Portrait.count - 1);
});

test('dialogue keeps portraits, text and page indicators inside narrow and wide panels', async () => {
  const {Game, gfx} = await game();
  for (const [w, h] of [[200, 240], [234, 394], [240, 320], [330, 280], [360, 360], [600, 400]]) {
    gfx.page = {w, h};
    for (const line of [{character:'j'}, {character:'m'}, {portrait:999}, {}]) {
      const p = Game.review.sceneLayout(line), box = p.box;
      assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.w <= w && box.y + box.h <= h - 13);
      assert.ok(p.textWidth >= 100 && p.rows >= 1);
      assert.ok(p.ty + p.rows * 13 <= box.y + box.h - 22);
      if (p.portrait) {
        const r = p.portrait;
        assert.ok(r.x >= box.x && r.x + r.w <= box.x + box.w);
        assert.ok(r.y >= box.y && r.y + r.h < box.y + box.h - 22);
        assert.ok(p.tx >= r.x + r.w || p.ty >= r.y + r.h);
      }
    }
  }
});

test('long speeches show every page before advancing or ending dialogue', async () => {
  const {Game, Portrait, gfx, press, run} = await game();
  Portrait.bind(artwork(Portrait));
  gfx.page = {w:240, h:320};
  // During updates SCR_W/H can refer to the full display rather than the UI page.
  run('SCR_W = 1920; SCR_H = 1080');
  const text = Array.from({length:200}, (_, i) => `word${i}`).join(' ') + ' FINAL-WORD';
  let finished = 0;
  Game.review.setScene([{name:'Lea', character:'l', text}], () => finished++);
  const pages = Game.review.sceneContent().pages;
  assert.ok(pages > 1);
  const ctx = drawingContext(); Game.review.setContext(ctx);
  for (let i = 0; i < pages; i++) {
    assert.equal(Game.review.sceneIdx, 0);
    assert.equal(Game.review.scenePage, i);
    Game.review.renderScene();
    assert.equal(finished, 0);
    press('fire');
  }
  const displayed = ctx.calls.filter(call => call.type === 'text').map(call => call.args[0]).join(' ');
  for (let i = 0; i < 200; i++) assert.match(displayed, new RegExp(`\\bword${i}\\b`));
  assert.match(displayed, /FINAL-WORD/);
  assert.equal(finished, 1);
});

test('dialogue pages can be revisited and Back still skips the conversation', async () => {
  const {Game, press} = await game();
  let finished = 0;
  Game.review.setScene([{name:'Pierre', character:'r', text:'Words to read. '.repeat(100)}], () => finished++);
  press('down'); assert.equal(Game.review.scenePage, 1);
  press('up'); assert.equal(Game.review.scenePage, 0);
  press('back'); assert.equal(finished, 1);
});

test('normal portrait loading caches successes and retries failures without deobfuscation', async () => {
  const {Assets, context} = await game();
  const requests = [];
  let fail = true;
  context.Image = class {
    set src(path) { requests.push(path); queueMicrotask(() => fail ? this.onerror() : this.onload()); }
  };
  await assert.rejects(Assets.picture('portraits/test.webp'), /Unable to load picture/);
  fail = false;
  const first = await Assets.picture('portraits/test.webp');
  assert.equal(await Assets.picture('portraits/test.webp'), first);
  assert.deepEqual(requests, ['portraits/test.webp', 'portraits/test.webp']);
});

test('mission contact portraits do not cover their description and all text remains scrollable', async () => {
  const {Station, Portrait, Input} = await game();
  Portrait.bind(artwork(Portrait));
  Station.open({}); Station.go('system');
  Station.showInfo('Contract', 'mission '.repeat(200) + 'FINAL-INSTRUCTION');
  Station.info.face = 3;
  const ctx = drawingContext();
  Station.render(ctx);
  const photo = ctx.calls.find(call => call.type === 'image');
  const bottom = photo.args[6] + photo.args[8];
  for (const call of ctx.calls.filter(call => call.type === 'text' && call.args[0].includes('mission')))
    assert.ok(call.args[2] >= bottom, 'description begins below the portrait');
  for (let i = 0; i < 100; i++) {
    Input.virtual('down', true); Station.update(Input); Input.reset(); Station.render(ctx);
  }
  assert.ok(ctx.calls.some(call => call.type === 'text' && call.args[0].includes('FINAL-INSTRUCTION')));
  const previous = Station.info.scroll;
  Input.virtual('up', true); Station.update(Input); Input.reset();
  assert.equal(Station.info.scroll, previous - 1);
});

test('boot loads only realistic portrait assets and never requests the old face parts or M.A.I. sprite', async () => {
  const {Assets, Game, Portrait, Realism, context} = await game();
  const legacyRequests = [], photoRequests = [];
  context.requestAnimationFrame = () => {};
  context.Micro3D = {loadMBAC: () => ({}), classifyBlend() {}};
  Realism.load = async () => {};
  Realism.prepare = () => {};
  require('node:vm').runInContext('Catalog.load = async () => {}', context);
  Assets.image = async path => { legacyRequests.push(path); return {width:40, height:40}; };
  Assets.raw = async () => new Uint8Array();
  Assets.texture = async () => ({});
  Assets.picture = async path => { photoRequests.push(path); return artwork(Portrait)[path]; };
  await Game.boot({});
  assert.deepEqual(photoRequests, Array.from(Portrait.PATHS));
  assert.ok(legacyRequests.every(path => !path.startsWith('faces/') && path !== 'mai.png'));
  assert.equal(Portrait.ready(), true);
  assert.equal(Game.mode, 'splash');
});
