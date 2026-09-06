/* ============================================================================
   Persistent world: the player, the ship, the 200 station economy, the job
   board, the medal cabinet and the save games.
   ========================================================================== */
'use strict';

const World = (() => {

  const SAVE_KEY = 'deep.submarine.odyssey.v1';
  let S = null;                                   /* the whole savable state */

  /* deterministic hash so a station's prices and stock stay stable */
  function hash(a, b, c) {
    let h = (a * 73856093) ^ (b * 19349663) ^ ((c || 0) * 83492791);
    h = Math.imul(h ^ (h >>> 15), 2246822519);
    h = Math.imul(h ^ (h >>> 13), 3266489917);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  /* ------------------------------------------------------------- creation */
  function fresh(name, face, difficulty) {
    const st = GameData.stations;
    S = {
      version: 1,
      name: name || GameData.T(300),
      face: face === undefined ? 0 : face,
      difficulty: difficulty || 1,
      credits: 6400,
      station: 0,                                   /* Gosu */
      chapter: 0, chapterStep: 0,
      flags: {},
      ship: { type: 0, hullDmg: 0, shieldDmg: 0, slots: [15, null, null, null, null, null] },
      cargo: {},                                    /* goodId -> tonnes */
      rebel: {},                                    /* stationId -> true      */
      seenDialog: {},
      speciesSeen: {},
      goodsMade: {},
      missions: [], boardDay: 0,
      medals: {},
      stats: {
        kills: 0, pirateKills: 0, fishCaught: 0, fishLost: 0, fishKilled: 0,
        stationsVisited: 1, goodsProduced: 0, deadFish: 0, crates: 0, streams: 0,
        missions: 0, bought: 0, maxDepth: 50, minDepth: 50, playMs: 0,
        streak: 0, bestStreak: 0, catchStreak: 0, bestCatchStreak: 0, bestCredits: 4200
      },
      visited: { 0: true },
      autofire: false, music: true, sfx: true, invert: false
    };
    /* Talon is the first rebel station the story sends you to */
    setRebel(byName('Talon'), true);
    return S;
  }

  const state = () => S;
  const byName = n => GameData.stations.findIndex(s => s.name === n);
  const station = i => GameData.stations[i === undefined ? S.station : i];
  const ship = () => GameData.ships[S.ship.type];

  function setRebel(id, v) { if (id >= 0) S.rebel[id] = !!v; }
  const isRebel = id => !!S.rebel[id];

  /* ------------------------------------------------------------ the ship */
  function slotItem(i) { const id = S.ship.slots[i]; return id === null || id === undefined ? null : GameData.equip[id]; }
  function fitted(type) {
    const out = [];
    for (let i = 0; i < S.ship.slots.length; i++) {
      const e = slotItem(i);
      if (e && e.type === type) out.push({ slot: i, e });
    }
    return out;
  }
  function best(type) {
    let b = null;
    for (const f of fitted(type)) if (!b || f.e.value > b.e.value) b = f;
    return b ? b.e : null;
  }
  function hullMax() {
    const a = best(GameData.EQ.ARMOUR);
    return ship().hull + (a ? a.value : 0);
  }
  function shieldMax() {
    const s = best(GameData.EQ.SHIELD);
    return s ? s.value : 0;
  }
  function hull() { return Math.max(0, hullMax() - S.ship.hullDmg); }
  function shield() { return Math.max(0, shieldMax() - S.ship.shieldDmg); }
  function holdMax() {
    let h = ship().hold;
    for (const f of fitted(GameData.EQ.COMPACTOR)) h += Math.round(ship().hold * f.e.value / 100);
    return h;
  }
  function holdUsed() {
    let t = 0;
    for (const k in S.cargo) t += S.cargo[k] * cargoWeight(+k);
    return t;
  }
  function cargoWeight(goodId) {
    const c = GameData.creatures[goodId];
    return c ? c.weight : 1;
  }
  function handling() {
    let h = ship().handling;
    for (const f of fitted(GameData.EQ.THRUSTER)) h += f.e.value;
    return h;
  }
  function engineRange() {
    const e = best(GameData.EQ.ENGINE);
    return 18 + (e ? e.value : 0);
  }
  function radarLevel() {
    const r = best(GameData.EQ.RADAR);
    return r ? r.value : 0;
  }
  function depthLimits() {
    const s = best(GameData.EQ.SHIELD), a = best(GameData.EQ.ARMOUR);
    const min = Math.max(0, 45 - (s ? s.value / 4 : 0));
    const max = Math.min(100, 60 + (a ? a.value / 4.5 : 0));
    return { min, max };
  }
  function freeSlot() { return S.ship.slots.indexOf(null); }
  function usedSlots() { return S.ship.slots.filter(v => v !== null && v !== undefined).length; }

  function addCargo(goodId, n) {
    n = n | 0;
    if (!n) return 0;
    const room = holdMax() - holdUsed();
    const per = cargoWeight(goodId);
    const canTake = Math.min(n, Math.floor(room / per));
    if (canTake <= 0) return 0;
    S.cargo[goodId] = (S.cargo[goodId] || 0) + canTake;
    return canTake;
  }
  function removeCargo(goodId, n) {
    const have = S.cargo[goodId] || 0;
    const take = Math.min(have, n);
    if (take <= 0) return 0;
    S.cargo[goodId] = have - take;
    if (!S.cargo[goodId]) delete S.cargo[goodId];
    return take;
  }

  /* --------------------------------------------------------- the economy */
  /* Price bands come from goods.txt; each station sits at a fixed point in
     the band, so hauling from a cheap producer to a needy buyer pays. */
  function price(stationId, goodId) {
    const g = GameData.goods[goodId];
    const st = GameData.stations[stationId];
    let f = hash(stationId + 1, goodId + 1, 7);
    /* stations near the good's home region are cheap, far ones expensive */
    const regionBias = ((g.region % 17) - (st.tech * 1.4)) / 34;
    f = Math.max(0, Math.min(1, f * 0.72 + 0.14 + regionBias * 0.3));
    return Math.round(g.min + (g.max - g.min) * f);
  }
  /* 0..2 -> the bronze / silver / gold coin stack of the original UI */
  function priceRating(stationId, goodId) {
    const g = GameData.goods[goodId];
    const p = price(stationId, goodId);
    const f = (p - g.min) / Math.max(1, g.max - g.min);
    return f < 0.34 ? 0 : f < 0.67 ? 1 : 2;
  }
  function stock(stationId, goodId) {
    const g = GameData.goods[goodId];
    const st = GameData.stations[stationId];
    if (g.cat === 0 && goodId < 18) return 0;                 /* live catch is not sold */
    if (goodId === 38 || goodId === 40) return 0;             /* story only */
    const h = hash(stationId + 5, goodId + 3, S.boardDay + 11);
    const base = g.spread * (0.35 + h) * (0.5 + st.tech / 12);
    return Math.max(0, Math.round(base / 4));
  }
  function canTrade(stationId) { return isRebel(stationId); }
  /* Colonist stations forbid trade: they simply take your hold at a fixed
     rate the moment you dock (main.lang 256/257). */
  function colonistBuyout() {
    let total = 0;
    for (const k in S.cargo) {
      const id = +k, n = S.cargo[k];
      total += n * GameData.goods[id].max;
    }
    if (total > 0) {
      S.cargo = {};
      S.credits += total;
      S.stats.bestCredits = Math.max(S.stats.bestCredits, S.credits);
    }
    return total;
  }

  /* Equipment on sale: gated by the station tech level and the availability
     percentage stored in equipment.txt. */
  function shopEquip(stationId) {
    const st = GameData.stations[stationId];
    const out = [];
    for (const e of GameData.equip) {
      if (e.price <= 0) continue;
      const techNeed = 1 + Math.min(9, Math.floor(Math.log(Math.max(1, e.price)) / Math.log(3.05)) - 6);
      if (st.tech < techNeed) continue;
      if (hash(stationId + 31, e.id + 17, 3) * 100 > e.avail + st.tech * 3) continue;
      out.push(e);
    }
    if (S.flags.eclipseForSale && stationId === S.flags.eclipseForSale) out.push(GameData.equip[42]);
    return out;
  }
  function shopShips(stationId) {
    const st = GameData.stations[stationId];
    const out = [];
    for (const s of GameData.ships) {
      if (s.id === 10 && !allMedals()) continue;             /* the Aquarius */
      const techNeed = 4 + Math.floor(s.id * 0.62);
      if (st.tech < techNeed) continue;
      if (hash(stationId + 61, s.id + 5, 9) > 0.55) continue;
      out.push(s);
    }
    return out;
  }
  function equipTech(e) {
    return 1 + Math.min(9, Math.floor(Math.log(Math.max(1, e.price)) / Math.log(3.05)) - 6);
  }

  /* --------------------------------------------------------- the job board */
  const MISSION_TYPES = 15;
  function board(stationId) {
    const out = [];
    const n = 3 + Math.floor(hash(stationId + 3, S.boardDay + 1, 21) * 4);
    for (let i = 0; i < n; i++) {
      out.push(makeJob(stationId, i));
    }
    return out;
  }
  function makeJob(stationId, i) {
    const r = (k) => hash(stationId * 97 + i * 13 + k, S.boardDay + 1, 41);
    const type = Math.floor(r(1) * MISSION_TYPES);
    const st = GameData.stations[stationId];
    /* pick a target station within reach */
    let target = stationId;
    const cand = [];
    for (const s of GameData.stations) {
      const d = Math.hypot(s.x - st.x, s.y - st.y);
      if (d > 4 && d < 46) cand.push(s.id);
    }
    if (cand.length) target = cand[Math.floor(r(2) * cand.length) % cand.length];
    const diff = 1 + Math.floor(r(3) * 3);
    const amount = 2 + Math.floor(r(4) * 6);
    const clientM = r(5) < 0.55;
    const names = clientM ? GameData.D.namesM : GameData.D.namesF;
    const reward = Math.round((900 + r(6) * 5200) * diff *
      (1 + Math.hypot(GameData.stations[target].x - st.x, GameData.stations[target].y - st.y) / 60));
    return {
      id: stationId * 1000 + i, type, from: stationId, target, diff, amount,
      client: names[Math.floor(r(7) * names.length) % names.length],
      face: Math.floor(r(8) * 95),
      goodId: Math.floor(r(9) * 18),
      reward, deposit: Math.round(reward * 0.25),
      stops: r(10) < 0.4 ? 1 + Math.floor(r(11) * 3) : -1,
      story: false, progress: 0, done: false
    };
  }

  function acceptJob(job) {
    if (S.missions.some(m => m.id === job.id)) return false;
    S.missions.push(JSON.parse(JSON.stringify(job)));
    return true;
  }
  function abortJob(id) {
    const i = S.missions.findIndex(m => m.id === id);
    if (i >= 0) { S.missions.splice(i, 1); return true; }
    return false;
  }
  function activeMission() { return S.missions.find(m => !m.done) || null; }

  /* ------------------------------------------------------------- medals */
  /* index -> {thresholds for bronze / silver / gold}.  A threshold of 0 means
     the medal is a single award rather than a graded one. */
  const MEDALS = [
    { id: 0, stat: null, grades: [0] },                       /* Immigrant   */
    { id: 1, stat: 'lowEnergyArrival', grades: [10] },
    { id: 2, stat: 'algaeAll', grades: [0] },
    { id: 3, stat: 'fishAll', grades: [0] },
    { id: 4, stat: 'kills', grades: [50, 250, 1000] },
    { id: 5, stat: 'fishCaught', grades: [50, 250, 1000] },
    { id: 6, stat: 'stationsVisited', grades: [25, 75, 150] },
    { id: 7, stat: 'goodsAll', grades: [0] },
    { id: 8, stat: 'goodsProduced', grades: [50, 250, 1000] },
    { id: 9, stat: 'bestStreak', grades: [10, 25, 50] },
    { id: 10, stat: 'bestCatchStreak', grades: [10, 25, 50] },
    { id: 11, stat: 'hours', grades: [2, 6, 15] },
    { id: 12, stat: 'missions', grades: [10, 40, 100] },
    { id: 13, stat: 'streams', grades: [25, 100, 400] },
    { id: 14, stat: 'pirateKills', grades: [25, 100, 400] },
    { id: 15, stat: 'unarmed', grades: [0] },
    { id: 16, stat: 'guns', grades: [2, 3, 4] },
    { id: 17, stat: 'hero', grades: [0] },
    { id: 18, stat: 'crates', grades: [25, 100, 400] },
    { id: 19, stat: 'bestCredits', grades: [100000, 500000, 2000000] },
    { id: 20, stat: 'bought', grades: [10, 30, 60] },
    { id: 21, stat: 'minDepthM', grades: [1200, 700, 200] },
    { id: 22, stat: 'maxDepthM', grades: [3000, 6000, 9000] },
    { id: 23, stat: 'collector', grades: [0] }
  ];
  function statValue(k) {
    const st = S.stats;
    switch (k) {
      case 'hours': return st.playMs / 3600000;
      case 'guns': return fitted(GameData.EQ.GUN).length;
      case 'unarmed': return S.flags.unarmedLaunch ? 1 : 0;
      case 'hero': return S.flags.liberated ? 1 : 0;
      case 'lowEnergyArrival': return S.flags.lowEnergyArrival ? 10 : 0;
      case 'algaeAll': return [13, 14, 15, 16, 17].every(i => S.speciesSeen[i]) ? 1 : 0;
      case 'fishAll': return [0,1,2,3,4,5,6,7,8,9,10,11,12].every(i => S.speciesSeen[i]) ? 1 : 0;
      case 'goodsAll': return GameData.goods.filter(g => g.recipe).every(g => S.goodsMade[g.id]) ? 1 : 0;
      case 'collector': return Object.keys(S.medals).length >= 23 ? 1 : 0;
      case 'minDepthM': return depthMetres(st.minDepth);
      case 'maxDepthM': return depthMetres(st.maxDepth);
      default: return st[k] || 0;
    }
  }
  function depthMetres(d) { return Math.round(d * 100); }
  /* returns 0 = none, 1 = bronze, 2 = silver, 3 = gold */
  function medalGrade(i) {
    const m = MEDALS[i];
    if (!m.stat) return S.medals[i] ? 3 : 0;
    const v = statValue(m.stat);
    if (m.grades.length === 1) return v >= (m.grades[0] || 1) ? 3 : 0;
    const inverted = m.stat === 'minDepthM';
    let g = 0;
    for (let k = 0; k < m.grades.length; k++) {
      if (inverted ? v <= m.grades[k] && v > 0 : v >= m.grades[k]) g = k + 1;
    }
    return g;
  }
  function medalThreshold(i) {
    const m = MEDALS[i];
    const g = medalGrade(i);
    return m.grades[Math.min(g, m.grades.length - 1)] || 0;
  }
  function allMedals() { return MEDALS.every((m, i) => medalGrade(i) > 0); }
  function checkMedals() {
    const gained = [];
    for (let i = 0; i < MEDALS.length; i++) {
      const g = medalGrade(i);
      if (g > (S.medals[i] || 0)) { S.medals[i] = g; gained.push(i); }
    }
    return gained;
  }
  function awardMedal(i) { S.medals[i] = Math.max(S.medals[i] || 0, 1); }

  /* -------------------------------------------------------- travel & map */
  function distance(a, b) {
    const A = GameData.stations[a], B = GameData.stations[b];
    return Math.hypot(A.x - B.x, A.y - B.y);
  }
  function reachable(a, b) { return distance(a, b) <= engineRange(); }
  function depthOK(id) {
    const l = depthLimits(), d = GameData.stations[id].depth;
    return d >= l.min && d <= l.max;
  }
  /* Dijkstra over stations within engine range - the "plot route" feature */
  function route(from, to) {
    const n = GameData.stations.length;
    const dist = new Float64Array(n).fill(Infinity);
    const prev = new Int32Array(n).fill(-1);
    const seen = new Uint8Array(n);
    dist[from] = 0;
    for (; ;) {
      let u = -1, bd = Infinity;
      for (let i = 0; i < n; i++) if (!seen[i] && dist[i] < bd) { bd = dist[i]; u = i; }
      if (u < 0 || u === to) break;
      seen[u] = 1;
      for (let v = 0; v < n; v++) {
        if (seen[v]) continue;
        const d = distance(u, v);
        if (d > engineRange()) continue;
        const w = d + (depthOK(v) ? 0 : 60);
        if (dist[u] + w < dist[v]) { dist[v] = dist[u] + w; prev[v] = u; }
      }
    }
    if (dist[to] === Infinity) return null;
    const path = [];
    for (let c = to; c >= 0; c = prev[c]) path.unshift(c);
    return path;
  }

  function visit(id) {
    S.station = id;
    if (!S.visited[id]) { S.visited[id] = true; S.stats.stationsVisited++; }
    const d = GameData.stations[id].depth;
    S.stats.maxDepth = Math.max(S.stats.maxDepth, d);
    S.stats.minDepth = Math.min(S.stats.minDepth, d);
  }

  /* ------------------------------------------------------------- persistence */
  function slots() {
    const out = [];
    for (let i = 0; i < 3; i++) {
      try {
        const raw = localStorage.getItem(SAVE_KEY + '.' + i);
        out.push(raw ? JSON.parse(raw) : null);
      } catch (e) { out.push(null); }
    }
    return out;
  }
  function save(slot) {
    try { localStorage.setItem(SAVE_KEY + '.' + slot, JSON.stringify(S)); return true; }
    catch (e) { return false; }
  }
  function load(slot) {
    try {
      const raw = localStorage.getItem(SAVE_KEY + '.' + slot);
      if (!raw) return false;
      S = JSON.parse(raw);
      return true;
    } catch (e) { return false; }
  }
  function autosave() { try { localStorage.setItem(SAVE_KEY + '.auto', JSON.stringify(S)); } catch (e) { } }
  function hasAuto() { return !!localStorage.getItem(SAVE_KEY + '.auto'); }
  function loadAuto() {
    try { S = JSON.parse(localStorage.getItem(SAVE_KEY + '.auto')); return !!S; } catch (e) { return false; }
  }
  function adopt(o) { S = o; }

  return {
    fresh, state, station, ship, byName, setRebel, isRebel,
    slotItem, fitted, best, hullMax, shieldMax, hull, shield, holdMax, holdUsed,
    cargoWeight, handling, engineRange, radarLevel, depthLimits, freeSlot, usedSlots,
    addCargo, removeCargo,
    price, priceRating, stock, canTrade, colonistBuyout, shopEquip, shopShips, equipTech,
    board, makeJob, acceptJob, abortJob, activeMission,
    MEDALS, medalGrade, medalThreshold, allMedals, checkMedals, awardMedal, statValue, depthMetres,
    distance, reachable, depthOK, route, visit, hash,
    slots, save, load, autosave, hasAuto, loadAuto, adopt
  };
})();
