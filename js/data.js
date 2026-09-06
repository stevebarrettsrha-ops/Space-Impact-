/* ============================================================================
   Game data.  Every table below is read straight out of the original
   /data/txt files that ship with the MIDlet, so ship prices, cargo recipes,
   creature weights and the 200 station map are exactly the ones Fishlabs
   shipped.  Names and descriptions come from the language pack.
   ========================================================================== */
'use strict';

const GameData = (() => {

  function rows(txt) {
    return txt.split(';').map(s => s.trim()).filter(s => s.length)
              .map(s => s.split(',').map(v => v.trim()));
  }
  const num = v => parseInt(v, 10) || 0;

  const D = {
    stations: [], ships: [], equip: [], goods: [], creatures: [],
    namesM: [], namesF: [],
    L: {}                                   /* language pack, by file */
  };

  /* equipment categories, in the order the MIDlet stores them */
  const EQ = D.EQ = {
    GUN: 0, TORPEDO: 1, HARPOON: 2, SHIELD: 3, ARMOUR: 4,
    COMPACTOR: 5, ENGINE: 6, THRUSTER: 7, RADAR: 8, BOOSTER: 9, DROID: 10
  };
  const EQ_NAME_KEY = ['Armament', 'Armament', 'Harpoon', 'Shield', 'Armour',
    'Hold', 'Engine', 'Handling', 'Radar', 'Booster', 'Misc'];

  /* Reload times are not stored numerically in equipment.txt; the item texts
     describe them (long / improved / short), so they are tabulated here to
     match the descriptions.  Everything else is read from the table. */
  const RELOAD = {
    0: 34, 1: 25, 2: 17,          /* Railgun   MK I..III */
    3: 62, 4: 50, 5: 38,          /* Coil Gun  MK I..III */
    6: 46, 7: 36, 8: 26,          /* Fusion    MK I..III */
    9: 58, 10: 46, 11: 34,        /* Mass Driver MK I..III */
    12: 90, 13: 76, 14: 60,       /* torpedoes */
    15: 26, 16: 21, 17: 16,       /* harpoons  */
    42: 44                        /* Eclipse   */
  };

  async function load() {
    const [stat, ship, equip, goods, crea, nm, nf] = await Promise.all([
      Assets.text('txt/stations.txt'), Assets.text('txt/ships.txt'),
      Assets.text('txt/equipment.txt'), Assets.text('txt/goods.txt'),
      Assets.text('txt/creatures.txt'),
      Assets.text('txt/names_human_m.txt'), Assets.text('txt/names_human_f.txt')
    ]);

    D.stations = rows(stat).map((r, i) => ({
      id: i, name: r[0], tech: num(r[1]), x: num(r[2]), y: num(r[3]), depth: num(r[4]),
      faction: 0,                    /* 0 colonist, 1 rebel - set up by the world */
      visited: false
    }));

    D.ships = rows(ship).map((r, i) => ({
      id: i, hull: num(r[1]), hold: num(r[2]), price: num(r[3]),
      slots: num(r[4]), handling: num(r[5]),
      model: 'u' + i, icon: 'equipment/u' + i
    }));

    D.equip = rows(equip).map((r, i) => {
      const id = num(r[0]), type = num(r[1]);
      return {
        id, type, avail: num(r[2]), price: num(r[3]), priceHi: num(r[4]),
        value: num(r[5]), energy: num(r[6]), range: num(r[7]), weight: num(r[8]),
        reload: RELOAD[id] || 30,
        icon: 'equipment/slot_' + id,
        cat: EQ_NAME_KEY[type]
      };
    });

    D.goods = rows(goods).map(r => {
      const g = {
        id: num(r[0]), cat: num(r[1]), seed: num(r[2]), region: num(r[3]),
        spread: num(r[4]), min: num(r[5]), max: num(r[6]),
        recipe: null, icon: 'cargo_' + num(r[0])
      };
      if (r[7]) {
        const ing = r[7].split(/\s+/).map(num);
        const amt = (r[8] || '').split(/\s+/).map(num);
        g.recipe = ing.map((v, k) => ({ id: v, n: amt[k] || 1 }));
      }
      return g;
    });

    D.creatures = rows(crea).map(r => ({
      id: num(r[0]), weight: num(r[1]), toughness: num(r[2]),
      algae: num(r[0]) >= 13
    }));
    /* the swim cycle models: two frames each for the animated species */
    const CM = ['nautilus', 'gulper_eel', 'jellyfish', 'manta', 'fish_swarm',
      'anglerfish', 'devilfish', 'marlin', 'shark', 'shrimp', 'squid',
      'turtle', 'whale', 'alga_gold', 'alga_blue', 'alga_brown', 'alga_red', 'alga_green'];
    const TWO_FRAME = new Set([5, 6, 7, 8, 9, 10, 11, 12]);
    D.creatures.forEach((c, i) => {
      c.models = TWO_FRAME.has(i) ? [CM[i] + '_01', CM[i] + '_02'] : [CM[i]];
    });

    D.namesM = nm.split(';').map(s => s.trim()).filter(s => s);
    D.namesF = nf.split(';').map(s => s.trim()).filter(s => s);
    return D;
  }

  async function loadLang(dir) {
    const files = ['main', 'items', 'ships', 'cargo', 'medals'];
    const packs = await Promise.all(files.map(f => Assets.lang(dir, f + '.lang')));
    files.forEach((f, i) => { D.L[f] = packs[i]; });
    D.langDir = dir;
    return D.L;
  }
  async function dialogue(n) {
    if (!D.L['d' + n]) D.L['d' + n] = await Assets.lang(D.langDir, n + '.lang');
    return D.L['d' + n];
  }

  /* --- text helpers ------------------------------------------------------- */
  const T = i => (D.L.main && D.L.main[i]) || '';
  const shipName = i => D.L.ships[i * 2];
  const shipDesc = i => D.L.ships[i * 2 + 1];
  const equipName = i => D.L.items[i * 2];
  const equipDesc = i => D.L.items[i * 2 + 1];
  const goodName = i => T(93 + i);
  const goodDesc = i => D.L.cargo[i];
  const medalName = i => D.L.medals[i * 2];
  const medalDesc = i => D.L.medals[i * 2 + 1];
  const missionTypeName = i => T(164 + i);
  const missionTypeDesc = i => T(179 + i);
  const missionBrief = i => T(194 + i);

  return {
    load, loadLang, dialogue, D, EQ, T,
    shipName, shipDesc, equipName, equipDesc, goodName, goodDesc,
    medalName, medalDesc, missionTypeName, missionTypeDesc, missionBrief,
    get stations() { return D.stations; },
    get ships() { return D.ships; },
    get equip() { return D.equip; },
    get goods() { return D.goods; },
    get creatures() { return D.creatures; }
  };
})();
