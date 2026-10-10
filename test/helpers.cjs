const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = file => fs.readFileSync(path.join(root, file), 'utf8');

function eventTarget() {
  const handlers = new Map();
  return {
    addEventListener(name, fn) {
      if (!handlers.has(name)) handlers.set(name, []);
      handlers.get(name).push(fn);
    },
    dispatch(name, event = {}) { for (const fn of handlers.get(name) || []) fn(event); }
  };
}

function drawingContext() {
  const calls = [], states = [];
  return {
    calls, imageSmoothingEnabled: false,
    save() { states.push(this.imageSmoothingEnabled); },
    restore() { this.imageSmoothingEnabled = states.pop(); },
    drawImage(...args) { calls.push({type: 'image', args, smoothing: this.imageSmoothingEnabled}); },
    fillText(...args) { calls.push({type: 'text', args}); },
    measureText: text => ({width: String(text).length * 6}),
    fillRect() {}, strokeRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}
  };
}

async function game(options = {}) {
  const stored = new Map();
  const storage = {
    failRead: false, failWrite: false,
    getItem(key) {
      if (this.failRead) throw new Error('Storage unavailable');
      return stored.get(key) ?? null;
    },
    setItem(key, value) {
      if (this.failWrite) throw new Error('Quota exceeded');
      stored.set(key, value);
    }
  };
  const window = eventTarget(), document = { ...eventTarget(), hidden: false };
  document.createElement = () => options.createCanvas ? options.createCanvas(40, 40) : {getContext: () => drawingContext()};
  const gfx = {
    page: {w:240, h:320}, pageRect() { return this.page; },
    pushFull() {}, pop() {}, clearTo() {}, flush() {}, init() {},
    context: () => drawingContext()
  };
  const context = vm.createContext({
    console, window, document, localStorage: storage, TextDecoder,
    SCR_W: 240, SCR_H: 320,
    Sfx: { play() {}, music() {}, resume() {} },
    Gfx: gfx,
    fetch: async file => {
      const bytes = fs.readFileSync(path.join(root, file));
      return { ok: true, arrayBuffer: async () => Uint8Array.from(bytes).buffer };
    },
    setTimeout() { throw new Error('Gameplay must not schedule wall-clock timers'); }
  });
  const run = code => vm.runInContext(code, context);
  for (const file of ['assets', 'station-model', 'realism', 'ui2d', 'data', 'world', 'campaign', 'flight']) run(source(`js/${file}.js`));
  await run('Promise.all([GameData.load(), GameData.loadLang("en")])');
  // Expose state-machine entry points only in this isolated test context.
  // Production code and all behavior under test are executed unchanged.
  run(source('js/main.js').replace('return { boot,', `return { review: {
    update, mainItems, renderScene, sceneContent, sceneLayout, renderNewGame,
    setContext: value => { ctx = value; },
    setScene: (items, after) => { scene = items; sceneIdx = scenePage = 0; sceneAfter = after; mode = 'dialogue'; },
    setPicker: () => { mode = 'newgame'; newGame = {step:1, face:0, name:'Pilot', diff:1}; },
    get newGame() { return newGame; }, get sceneIdx() { return sceneIdx; }, get scenePage() { return scenePage; },
    setMode: value => { mode = value; if (value === 'flight' || value === 'station') lastMode = value; },
    setPause: value => { mode = 'pause'; pauseSel = value; },
    get overlay() { return overlay; }, get pauseSel() { return pauseSel; }
  }, boot,`));
  run(source('js/station.js'));
  run('World.fresh("Test pilot", 0, 1)');
  const api = run('({World, GameData, Campaign, Flight, Input, Game, Station, Assets, Portrait, Font, UI, Realism})');
  function press(name) { api.Input.reset(); api.Input.virtual(name, true); api.Game.review.update(1); api.Input.reset(); }
  function enter(onDone, config = {}) {
    const sector = api.Flight.enter({station: false, noLife: true, noFriends: true, enemies: 0, onDone, ...config});
    sector.ents = [];
    api.Game.review.setMode('flight');
    return sector;
  }
  return { ...api, stored, storage, window, document, run, press, enter, gfx, context };
}

module.exports = { game, root, source, eventTarget, drawingContext };
