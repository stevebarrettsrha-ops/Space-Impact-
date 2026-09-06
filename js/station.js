/* ============================================================================
   The station screens.  Layout, wording and flow follow the original: a menu
   with Hangar / Missions / Trade / Map / Status, each of which is a pair of
   pages you switch between with left and right.
   ========================================================================== */
'use strict';

const Station = (() => {

  const C = UI.COL;
  let IMG = {}, M = {}, TEX = {}, texFor = () => null;
  let screen = 'menu', sel = 0, sub = 0, scroll = 0, pane = 0;
  let popup = null, help = null, info = null;
  let onUndock = null, onQuit = null;
  let flash = 0, flashMsg = '';
  let quantity = 0, trade = { side: 0, sel: 0 };
  let mapCur = 0, mapMode = 0, mapSpecies = -1;
  let stationRot = 0;

  function bind(models, textures, images, texture) { M = models; TEX = textures; IMG = images; texFor = texture; }

  function open(hooks) {
    onUndock = hooks.undock; onQuit = hooks.quit;
    screen = 'menu'; sel = 0; scroll = 0; pane = 0; popup = null; help = null; info = null;
    mapCur = World.state().station;
    Sfx.music('station');
  }
  function current() { return screen; }
  function note(t) { flash = 110; flashMsg = t; Sfx.play('beep'); }

  /* --------------------------------------------------------------- helpers */
  function sprite(ctx, name, x, y) { const im = IMG[name]; if (im) ctx.drawImage(im, x | 0, y | 0); }
  function header(ctx, title, sub2) {
    UI.rect(ctx, 0, 0, SCR_W, 16, '#0b2433');
    UI.rect(ctx, 0, 16, SCR_W, 1, C.frame);
    Font.draw(ctx, title, 4, 3, C.hi);
    if (sub2) Font.drawRight(ctx, sub2, SCR_W - 4, 3, C.gold);
  }
  const LIST_Y = 20;
  /* the list fills whatever is between the header and the soft keys, so it
     grows with the page instead of assuming the old 320 row screen */
  function listH() { return SCR_H - LIST_Y - 15; }
  function listView(ctx, items, selIndex, draw, rowH) {
    const ROW = rowH || 15;
    const LIST_H = listH();
    const rows = Math.floor(LIST_H / ROW);
    if (selIndex < scroll) scroll = selIndex;
    if (selIndex >= scroll + rows) scroll = selIndex - rows + 1;
    scroll = Math.max(0, Math.min(scroll, Math.max(0, items.length - rows)));
    for (let i = 0; i < rows && scroll + i < items.length; i++) {
      const idx = scroll + i, y = LIST_Y + i * ROW;
      if (idx === selIndex) UI.rect(ctx, 0, y - 1, SCR_W, ROW, '#0e3145');
      draw(ctx, items[idx], idx, y, idx === selIndex);
    }
    if (items.length > rows) {
      const h = Math.max(8, LIST_H * rows / items.length);
      const y = LIST_Y + (LIST_H - h) * scroll / Math.max(1, items.length - rows);
      UI.rect(ctx, SCR_W - 2, y, 2, h, C.frameHi);
    }
  }
  function moveSel(In, n) {
    if (!n) return sel;
    if (In.pressed('up')) { sel = (sel - 1 + n) % n; Sfx.play('beep'); }
    if (In.pressed('down')) { sel = (sel + 1) % n; Sfx.play('beep'); }
    return sel;
  }

  /* ================================================================= update */
  function update(In) {
    if (flash > 0) flash--;
    stationRot += 0.006;
    if (popup) return updatePopup(In);
    if (help !== null) { if (In.pressed('fire') || In.pressed('back') || In.pressed('help') || In.pressed('action')) { help = null; Sfx.play('back'); } return; }
    if (info) {
      if (In.pressed('fire')) {
        if (info.onOk) { const f = info.onOk; info = null; Sfx.play('select'); f(); }
        else { info = null; Sfx.play('back'); }
      } else if (In.pressed('back')) { info = null; Sfx.play('back'); }
      return;
    }
    if (In.pressed('help') || In.pressed('action')) { help = helpFor(screen); Sfx.play('select'); return; }
    switch (screen) {
      case 'menu': return menuUpdate(In);
      case 'hangar': return hangarUpdate(In);
      case 'shop': return shopUpdate(In);
      case 'missions': return missionsUpdate(In);
      case 'board': return boardUpdate(In);
      case 'trade': return tradeUpdate(In);
      case 'factory': return factoryUpdate(In);
      case 'map': return mapUpdate(In);
      case 'depthmap': return depthUpdate(In);
      case 'status': return statusUpdate(In);
      case 'medals': return medalsUpdate(In);
      case 'system': return systemUpdate(In);
    }
  }
  function render(ctx) {
    switch (screen) {
      case 'menu': menuRender(ctx); break;
      case 'hangar': hangarRender(ctx); break;
      case 'shop': shopRender(ctx); break;
      case 'missions': missionsRender(ctx); break;
      case 'board': boardRender(ctx); break;
      case 'trade': tradeRender(ctx); break;
      case 'factory': factoryRender(ctx); break;
      case 'map': mapRender(ctx); break;
      case 'depthmap': depthRender(ctx); break;
      case 'status': statusRender(ctx); break;
      case 'medals': medalsRender(ctx); break;
      case 'system': systemRender(ctx); break;
    }
    if (info) infoRender(ctx);
    if (help !== null) helpRender(ctx);
    if (popup) popupRender(ctx);
    if (flash > 0) {
      const a = Math.min(1, flash / 40);
      ctx.globalAlpha = a;
      UI.rect(ctx, 0, SCR_H - 30, SCR_W, 14, '#123a4c');
      Font.drawCentre(ctx, flashMsg, SCR_W / 2, SCR_H - 28, C.gold);
      ctx.globalAlpha = 1;
    }
  }
  function go(s) { screen = s; sel = 0; scroll = 0; Sfx.play('select'); }

  /* ------------------------------------------------------------- popup box */
  function ask(text, yes, no) { popup = { text, yes, no, sel: 0, type: 'confirm' }; }
  function say(text, then) { popup = { text, yes: then, sel: 0, type: 'ok' }; }
  function number(text, max, then) { popup = { text, max, value: 1, then, type: 'number' }; }
  function updatePopup(In) {
    const p = popup;
    if (p.type === 'number') {
      if (In.pressed('left')) p.value = Math.max(1, p.value - 1);
      if (In.pressed('right')) p.value = Math.min(p.max, p.value + 1);
      if (In.pressed('down')) p.value = Math.max(1, p.value - 10);
      if (In.pressed('up')) p.value = Math.min(p.max, p.value + 10);
      if (In.pressed('fire')) { const v = p.value; popup = null; Sfx.play('select'); p.then(v); }
      if (In.pressed('back')) { popup = null; Sfx.play('back'); }
      return;
    }
    if (p.type === 'confirm') {
      if (In.pressed('left') || In.pressed('right')) { p.sel = 1 - p.sel; Sfx.play('beep'); }
      if (In.pressed('fire')) {
        const y = p.sel === 0;
        popup = null; Sfx.play(y ? 'select' : 'back');
        if (y && p.yes) p.yes(); else if (!y && p.no) p.no();
      }
      if (In.pressed('back')) { popup = null; Sfx.play('back'); if (p.no) p.no(); }
      return;
    }
    if (In.pressed('fire') || In.pressed('back')) { const f = p.yes; popup = null; Sfx.play('select'); if (f) f(); }
  }
  function popupRender(ctx) {
    UI.shade(ctx, 0.6);
    const lines = Font.wrap(popup.text, SCR_W - 30);
    const h = 30 + lines.length * 12 + (popup.type === 'ok' ? 0 : 16);
    const y = (SCR_H - h) / 2;
    UI.panel(ctx, 12, y, SCR_W - 24, h);
    let ly = y + 10;
    for (const l of lines) { Font.drawCentre(ctx, l, SCR_W / 2, ly, C.text); ly += 12; }
    if (popup.type === 'confirm') {
      Font.draw(ctx, GameData.T(45), 40, ly + 4, popup.sel === 0 ? C.gold : C.dim);
      Font.drawRight(ctx, GameData.T(46), SCR_W - 40, ly + 4, popup.sel === 1 ? C.gold : C.dim);
    } else if (popup.type === 'number') {
      Font.drawCentre(ctx, '< ' + popup.value + ' >', SCR_W / 2, ly + 4, C.gold);
    } else {
      Font.drawCentre(ctx, GameData.T(41), SCR_W / 2, ly + 2, C.gold);
    }
  }

  /* --------------------------------------------------------------- info box */
  function showInfo(title, body, icon) { info = { title, body, icon }; Sfx.play('select'); }
  function infoRender(ctx) {
    UI.shade(ctx, 0.72);
    UI.panel(ctx, 8, 24, SCR_W - 16, SCR_H - 60, info.title);
    let y = 42;
    if (info.face !== undefined && info.face !== null) { Portrait.draw(ctx, info.face, SCR_W - 56, y, 40); }
    if (info.icon && IMG[info.icon]) { ctx.drawImage(IMG[info.icon], 14, y); y += IMG[info.icon].height + 4; }
    for (const l of Font.wrap(info.body, SCR_W - 28)) {
      if (y > SCR_H - 44) break;
      Font.draw(ctx, l, 14, y, C.text); y += 12;
    }
    UI.softkeys(ctx, '', GameData.T(41));
  }

  /* ----------------------------------------------------------------- help */
  const HELP_INDEX = { hangar: 353, shop: 354, board: 355, missions: 356, trade: 357, factory: 358, map: 361, depthmap: 362, status: 363, medals: 364, menu: 365 };
  function helpFor(s) { return GameData.T(HELP_INDEX[s] !== undefined ? HELP_INDEX[s] : 365); }
  function helpRender(ctx) {
    UI.shade(ctx, 0.8);
    UI.panel(ctx, 6, 20, SCR_W - 12, SCR_H - 52, GameData.T(4));
    let y = 38;
    for (const l of Font.wrap(help, SCR_W - 24)) {
      if (y > SCR_H - 40) break;
      Font.draw(ctx, l, 12, y, C.text); y += 12;
    }
    UI.softkeys(ctx, '', GameData.T(41));
  }

  /* =============================================================== the menu */
  const MENU = [
    { t: 62, s: 'hangar' }, { t: 37, s: 'missions' }, { t: 235, s: 'trade' },
    { t: 73, s: 'map' }, { t: 64, s: 'status' }, { t: 66, s: 'system' }, { t: 241, s: 'undock' }
  ];
  function menuUpdate(In) {
    moveSel(In, MENU.length);
    if (In.pressed('fire')) {
      const m = MENU[sel];
      if (m.s === 'undock') {
        ask(GameData.T(234), () => { Sfx.play('gate'); onUndock(); });
      } else if (m.s === 'trade' && !World.canTrade(World.state().station)) {
        say(GameData.T(256) + '\n\n' + GameData.T(258));
      } else go(m.s);
    }
    if (In.pressed('back')) ask(GameData.T(35), () => onQuit && onQuit());
  }
  function menuRender(ctx) {
    const st = World.station();
    Gfx.clearTo(6, 22, 34);
    /* A slow orbit of the docked station behind the console.  The camera used
       to sit 2400 units out, well inside the module cluster, and only read as
       a backdrop because the fog swallowed it; now that you can see that far
       it has to stand off the whole structure. */
    Gfx.setFog(6, 22, 34, 5000, 34000);
    Gfx.setLamp(0.22, 9000);
    Gfx.setCamera(Math.sin(stationRot) * 13500, 3400, Math.cos(stationRot) * 13500,
      stationRot + Math.PI, 0.2, 0, 1.0);
    if (M.station_starter) {
      const mods = [['station_starter', 0, 0, 0], ['station_top', 0, 3400, 0], ['station_bottom', 0, -3400, 0],
      [World.isRebel(st.id) ? 'station_hangar_ve' : 'station_hangar_de', 0, -900, 3000],
      ['station_sidehabitat', 0, 400, -3400]];
      for (const [name, x, y, z] of mods) {
        const m = M[name];
        if (m) Gfx.drawModel(m, x, y, z, null, 1.4, TEX.deep, { ambient: 0.8 });
      }
    }
    Gfx.flush();
    /* the orbit fills the whole display behind the console, so the veil has
       to as well or the page would read as a hole in it */
    UI.shade(ctx, 0.62);
    header(ctx, st.name, GameData.T(44) + ' ' + st.tech);
    Font.draw(ctx, GameData.T(World.isRebel(st.id) ? 237 : 236), 4, 20,
      World.isRebel(st.id) ? C.good : C.hi);
    Font.drawRight(ctx, World.state().credits.toLocaleString() + ' $', SCR_W - 4, 20, C.gold);

    const y0 = 40;
    for (let i = 0; i < MENU.length; i++) {
      const y = y0 + i * 22;
      if (i === sel) { UI.rect(ctx, 16, y - 3, SCR_W - 32, 19, '#0e3145'); UI.frame(ctx, 16, y - 3, SCR_W - 32, 19, null, C.frameHi); }
      Font.draw(ctx, GameData.T(MENU[i].t), 30, y, i === sel ? C.hi : C.text);
    }
    if (IMG.mai) ctx.drawImage(IMG.mai, SCR_W - 34, SCR_H - 62);
    const h = (typeof Campaign !== 'undefined' && !Campaign.done()) ? Campaign.hint() : '';
    if (h) {
      UI.rect(ctx, 0, SCR_H - 28, SCR_W, 14, '#0a2a3a');
      let t = h;
      while (Font.measure(t) > SCR_W - 42 && t.length > 4) t = t.slice(0, -2);
      Font.draw(ctx, t, 4, SCR_H - 27, C.gold);
    }
    UI.softkeys(ctx, GameData.T(4) + ' (0)', GameData.T(41));
  }

  /* ================================================================ hangar */
  function hangarUpdate(In) {
    const slots = World.state().ship.slots;
    const n = slots.length + 1;
    moveSel(In, n);
    if (In.pressed('right')) { go('shop'); return; }
    if (In.pressed('back')) { go('menu'); return; }
    if (In.pressed('fire')) {
      if (sel === 0) { showInfo(GameData.shipName(World.state().ship.type), GameData.shipDesc(World.state().ship.type), World.ship().icon + 'a'); return; }
      const e = World.slotItem(sel - 1);
      if (!e) { say(GameData.T(84)); return; }
      showInfo(GameData.equipName(e.id), GameData.equipDesc(e.id) + '\n\n' + statLine(e) +
        '\n' + GameData.T(61) + ': ' + sellPrice(e).toLocaleString() + ' $', e.icon);
    }
    if (In.pressed('sell') && sel > 0) {
      const e = World.slotItem(sel - 1);
      if (!e) return;
      ask(GameData.T(61) + ' ' + GameData.equipName(e.id) + '?', () => {
        World.state().credits += sellPrice(e);
        World.state().ship.slots[sel - 1] = null;
        Sfx.play('money'); note(GameData.equipName(e.id) + ' ' + GameData.T(90));
      });
    }
  }
  function sellPrice(e) { return Math.round(e.price * 0.62); }
  function statLine(e) {
    const T = GameData.T, EQ = GameData.EQ;
    switch (e.type) {
      case EQ.GUN: return T(48) + ': ' + e.value + '   ' + T(52) + ': ' + e.range + '\n' + T(49) + ': ' + (60 / e.reload).toFixed(1) + '/s   ' + T(336) + ': ' + e.weight + 't';
      case EQ.TORPEDO: return T(48) + ': ' + e.value + '   ' + T(52) + ': ' + e.range;
      case EQ.HARPOON: return T(54) + ': ' + e.value + '   ' + T(55) + ': ' + (18 - e.value);
      case EQ.SHIELD: return T(50) + ': ' + e.value + '   ' + T(51) + ': ' + (e.id >= 20 ? T(14) : T(15));
      case EQ.ARMOUR: return T(59) + ': ' + e.value;
      case EQ.COMPACTOR: return T(60) + ': +' + e.value + '%';
      case EQ.ENGINE: return T(52) + ': ' + e.value;
      case EQ.THRUSTER: return T(58) + ': +' + e.value;
      case EQ.RADAR: return T(141) + ': ' + e.value;
      case EQ.BOOSTER: return T(53) + ': ' + e.value;
      default: return T(57) + ': ' + e.value;
    }
  }
  function hangarRender(ctx) {
    const W = World.state();
    Gfx.clearTo(5, 18, 28); Gfx.flush();
    header(ctx, GameData.T(62), W.credits.toLocaleString() + ' $');
    /* the ship, drawn from its own sprite plus live stats */
    const shipIcon = IMG[World.ship().icon + 'a'];
    if (sel === 0) UI.rect(ctx, 0, 19, SCR_W, 40, '#0e3145');
    if (shipIcon) ctx.drawImage(shipIcon, 6, 22);
    Font.draw(ctx, GameData.shipName(W.ship.type), 74, 22, sel === 0 ? C.hi : C.text);
    Font.draw(ctx, GameData.T(59) + ' ' + World.hullMax() + '  ' + GameData.T(320) + ' ' + World.shieldMax(), 74, 34, C.dim);
    Font.draw(ctx, GameData.T(60) + ' ' + World.holdUsed() + '/' + World.holdMax() + 't', 74, 46, C.dim);

    Font.draw(ctx, GameData.T(329) + ' ' + World.usedSlots() + '/' + W.ship.slots.length, 6, 62, C.hi);
    const y0 = 76;
    for (let i = 0; i < W.ship.slots.length; i++) {
      const y = y0 + i * 18;
      const on = sel === i + 1;
      if (on) UI.rect(ctx, 0, y - 2, SCR_W, 18, '#0e3145');
      const e = World.slotItem(i);
      if (e && IMG[e.icon]) ctx.drawImage(IMG[e.icon], 5, y, 14, 12);
      else UI.frame(ctx, 6, y - 1, 14, 14, '#08202c', C.frame);
      Font.draw(ctx, e ? GameData.equipName(e.id) : GameData.T(70), 26, y, on ? C.hi : (e ? C.text : C.dim));
      if (e) Font.drawRight(ctx, sellPrice(e).toLocaleString() + ' $', SCR_W - 4, y, C.gold);
    }
    UI.softkeys(ctx, GameData.T(65), GameData.T(226), GameData.T(81) + ' >');
  }

  /* ================================================================== shop */
  function shopList() {
    const stId = World.state().station;
    return World.shopEquip(stId).map(e => ({ kind: 'e', e })).concat(
      World.shopShips(stId).map(s => ({ kind: 's', s })));
  }
  function shopUpdate(In) {
    const list = shopList();
    moveSel(In, list.length);
    if (In.pressed('left')) { go('hangar'); return; }
    if (In.pressed('back')) { go('menu'); return; }
    if (In.pressed('fire') && list.length) {
      const it = list[sel];
      if (it.kind === 'e') buyEquip(it.e); else buyShip(it.s);
    }
  }
  function buyEquip(e) {
    const W = World.state();
    showInfo(GameData.equipName(e.id), GameData.equipDesc(e.id) + '\n\n' + statLine(e) +
      '\n' + GameData.T(42) + ': ' + e.price.toLocaleString() + ' $', e.icon);
    const doBuy = () => {
      if (W.credits < e.price) { say(GameData.T(85).replace('#', (e.price - W.credits).toLocaleString())); return; }
      if (World.freeSlot() < 0) { say(GameData.T(145)); return; }
      if (e.type !== GameData.EQ.GUN && e.type !== GameData.EQ.TORPEDO &&
        World.fitted(e.type).length > 0) { say(GameData.T(144)); return; }
      W.credits -= e.price;
      W.ship.slots[World.freeSlot()] = e.id;
      W.stats.bought++;
      Sfx.play('money');
      note(GameData.equipName(e.id) + ' ' + GameData.T(89));
      World.checkMedals();
    };
    info.body += '\n\n' + GameData.T(43) + '?';
    info.onOk = doBuy;
  }
  function buyShip(s) {
    const W = World.state();
    const trade = Math.round(World.ship().price * 0.6);
    const cost = Math.max(0, s.price - trade);
    showInfo(GameData.shipName(s.id), GameData.shipDesc(s.id) + '\n\n' +
      GameData.T(59) + ': ' + s.hull + '  ' + GameData.T(60) + ': ' + s.hold + 't\n' +
      GameData.T(329) + ': ' + s.slots + '  ' + GameData.T(58) + ': ' + s.handling + '\n' +
      GameData.T(42) + ': ' + cost.toLocaleString() + ' $\n\n' + GameData.T(43) + '?', s.icon + 'a');
    info.onOk = () => {
      if (W.credits < cost) { say(GameData.T(85).replace('#', (cost - W.credits).toLocaleString())); return; }
      const used = World.usedSlots();
      if (used > s.slots) { say(GameData.T(86).replace('#', used - s.slots)); return; }
      if (World.holdUsed() > s.hold) { say(GameData.T(87)); return; }
      W.credits -= cost;
      W.ship.type = s.id;
      const slots = W.ship.slots.slice(0, s.slots);
      while (slots.length < s.slots) slots.push(null);
      W.ship.slots = slots;
      W.ship.hullDmg = 0;
      Sfx.play('money');
      note(GameData.shipName(s.id) + ' ' + GameData.T(89));
    };
  }
  function shopRender(ctx) {
    Gfx.clearTo(5, 18, 28); Gfx.flush();
    header(ctx, GameData.T(81), World.state().credits.toLocaleString() + ' $');
    const list = shopList();
    if (!list.length) { Font.drawCentre(ctx, GameData.T(70), SCR_W / 2, 60, C.dim); }
    listView(ctx, list, sel, (c, it, i, y, on) => {
      if (it.kind === 'e') {
        if (IMG[it.e.icon]) c.drawImage(IMG[it.e.icon], 3, y, 14, 12);
        Font.draw(c, GameData.equipName(it.e.id), 20, y + 1, on ? C.hi : C.text);
        Font.drawRight(c, it.e.price.toLocaleString(), SCR_W - 4, y + 1, C.gold);
      } else {
        if (IMG[it.s.icon + 'b']) c.drawImage(IMG[it.s.icon + 'b'], 3, y + 1, 15, 10);
        Font.draw(c, GameData.shipName(it.s.id), 20, y + 1, on ? C.hi : C.good);
        Font.drawRight(c, it.s.price.toLocaleString(), SCR_W - 4, y + 1, C.gold);
      }
    });
    UI.softkeys(ctx, '< ' + GameData.T(62), GameData.T(226));
  }

  /* ============================================================== missions */
  function missionsUpdate(In) {
    const ms = World.state().missions;
    moveSel(In, Math.max(1, ms.length));
    if (In.pressed('right')) { go('board'); return; }
    if (In.pressed('back')) { go('menu'); return; }
    if (In.pressed('fire') && ms.length) {
      const m = ms[sel];
      showInfo(missionTitle(m), missionText(m) + '\n\n' +
        GameData.T(334) + ': ' + GameData.stations[m.target].name + '\n' +
        GameData.T(333) + ': ' + Math.round(World.distance(World.state().station, m.target)) + '\n' +
        GameData.T(40) + ': ' + m.reward.toLocaleString() + ' $', m.story ? 'mission_story' : 'mission_' + m.type);
      info.onOk = () => {
        if (m.story) return;
        ask(GameData.T(250) + '?', () => { World.abortJob(m.id); note(GameData.T(250)); });
      };
    }
  }
  function missionTitle(m) { return m.story ? m.title : GameData.missionTypeName(m.type); }
  function missionText(m) {
    if (m.story) return m.text;
    return GameData.missionTypeDesc(m.type).replace('#', GameData.stations[m.target].name);
  }
  function missionsRender(ctx) {
    Gfx.clearTo(5, 18, 28); Gfx.flush();
    header(ctx, GameData.T(37), World.state().missions.length + '');
    const ms = World.state().missions;
    if (!ms.length) Font.drawCentre(ctx, GameData.T(209), SCR_W / 2, 60, C.dim);
    listView(ctx, ms, sel, (c, m, i, y, on) => {
      const icon = m.story ? 'mission_story' : 'mission_' + m.type;
      if (IMG[icon]) c.drawImage(IMG[icon], 3, y + 2, 16, 14);
      Font.draw(c, missionTitle(m), 22, y + 1, on ? C.hi : (m.story ? C.gold : C.text));
      Font.draw(c, GameData.stations[m.target].name, 22, y + 11, C.dim);
      Font.drawRight(c, GameData.T(m.story ? 308 : 309), SCR_W - 4, y + 1, C.dim);
    }, 22);
    UI.softkeys(ctx, GameData.T(65), GameData.T(226), GameData.T(328) + ' >');
  }

  /* =============================================================== job board */
  function boardUpdate(In) {
    const jobs = World.board(World.state().station);
    moveSel(In, jobs.length);
    if (In.pressed('left')) { go('missions'); return; }
    if (In.pressed('back')) { go('menu'); return; }
    if (In.pressed('fire') && jobs.length) {
      const j = jobs[sel];
      const target = GameData.stations[j.target];
      showInfo(GameData.missionTypeName(j.type),
        GameData.missionTypeDesc(j.type).replace('#', target.name) + '\n\n' +
        GameData.T(142) + ': ' + j.client + '\n' +
        GameData.T(334) + ': ' + target.name + '\n' +
        GameData.T(333) + ': ' + Math.round(World.distance(World.state().station, j.target)) + '\n' +
        GameData.T(245) + ': ' + World.depthMetres(target.depth) + 'm\n' +
        GameData.T(39) + ': ' + GameData.T(272 + j.diff) + '\n' +
        GameData.T(331) + ': ' + (j.stops < 0 ? GameData.T(335) : j.stops) + '\n' +
        GameData.T(40) + ': ' + j.reward.toLocaleString() + ' $',
        'mission_' + j.type);
      info.face = j.face;
      info.onOk = () => {
        if (World.state().missions.length >= 4) { say(GameData.T(242)); return; }
        if (World.acceptJob(j)) { note(GameData.T(249)); Sfx.play('message'); }
      };
    }
  }
  function boardRender(ctx) {
    Gfx.clearTo(5, 18, 28); Gfx.flush();
    header(ctx, GameData.T(328), World.station().name);
    const jobs = World.board(World.state().station);
    listView(ctx, jobs, sel, (c, j, i, y, on) => {
      const icon = 'mission_' + j.type;
      if (IMG[icon]) c.drawImage(IMG[icon], 3, y + 2, 16, 14);
      Font.draw(c, GameData.missionTypeName(j.type), 22, y + 1, on ? C.hi : C.text);
      Font.draw(c, j.client, 22, y + 11, C.dim);
      Font.drawRight(c, j.reward.toLocaleString() + ' $', SCR_W - 4, y + 1, C.gold);
      Font.drawRight(c, GameData.stations[j.target].name, SCR_W - 4, y + 11, C.dim);
      const medal = 'medal_' + (j.diff + 1);
      if (IMG[medal]) c.drawImage(IMG[medal], 12, y + 10, 8, 9);
    }, 22);
    UI.softkeys(ctx, '< ' + GameData.T(37), GameData.T(226));
  }

  /* ================================================================== trade */
  function tradeGoods() {
    const stId = World.state().station;
    const out = [];
    for (const g of GameData.goods) {
      const st = World.stock(stId, g.id), have = World.state().cargo[g.id] || 0;
      if (st > 0 || have > 0) out.push(g);
    }
    return out;
  }
  let tradeMode = false;
  function tradeUpdate(In) {
    const list = tradeGoods();
    moveSel(In, Math.max(1, list.length));
    if (In.pressed('back')) {
      if (tradeMode) { tradeMode = false; Sfx.play('back'); } else go('menu');
      return;
    }
    if (!list.length) { if (In.pressed('right')) go('factory'); return; }
    const g = list[Math.min(sel, list.length - 1)];
    const stId = World.state().station;
    if (!tradeMode) {
      if (In.pressed('right')) { go('factory'); return; }
      if (In.pressed('left')) { go('menu'); return; }
      if (In.pressed('fire')) { tradeMode = true; Sfx.play('select'); }
      return;
    }
    if (In.pressed('fire')) {
      showInfo(GameData.goodName(g.id), GameData.goodDesc(g.id) +
        '\n\n' + GameData.T(42) + ': ' + World.price(stId, g.id) + ' $   ' +
        GameData.T(336) + ': ' + World.cargoWeight(g.id) + 't', g.icon);
      return;
    }
    if (In.pressed('right')) {
      const p = World.price(stId, g.id), st = World.stock(stId, g.id);
      const room = Math.floor((World.holdMax() - World.holdUsed()) / World.cargoWeight(g.id));
      const canAfford = Math.floor(World.state().credits / Math.max(1, p));
      const max = Math.min(st, room, canAfford);
      if (max <= 0) { Sfx.play('deny'); note(room <= 0 ? GameData.T(143) : st <= 0 ? GameData.T(70) : GameData.T(85).replace('#', p)); return; }
      number(GameData.T(43) + ' ' + GameData.goodName(g.id) + '  ' + p + ' $', max, n => {
        World.state().credits -= n * p;
        World.addCargo(g.id, n);
        Sfx.play('money'); note(n + ' ' + GameData.goodName(g.id) + ' ' + GameData.T(89));
      });
      return;
    }
    if (In.pressed('left')) {
      const have = World.state().cargo[g.id] || 0;
      if (!have) { Sfx.play('deny'); return; }
      const p = World.price(stId, g.id);
      number(GameData.T(61) + ' ' + GameData.goodName(g.id) + '  ' + p + ' $', have, n => {
        World.removeCargo(g.id, n);
        World.state().credits += n * p;
        World.state().stats.bestCredits = Math.max(World.state().stats.bestCredits, World.state().credits);
        Sfx.play('money'); note(n + ' ' + GameData.goodName(g.id) + ' ' + GameData.T(90));
        World.checkMedals();
      });
      return;
    }
  }
  function coinIcon(rating) { return ['c_b_f', 'c_g_f', 'c_go_f'][rating] || 'c_b_f'; }
  function tradeRender(ctx) {
    Gfx.clearTo(5, 18, 28); Gfx.flush();
    const W = World.state(), stId = W.station;
    header(ctx, GameData.T(235), W.credits.toLocaleString() + ' $');
    Font.draw(ctx, GameData.T(80) + ' ' + World.holdUsed() + '/' + World.holdMax() + 't', 4, 19, C.dim);
    const list = tradeGoods();
    const saveY = LIST_Y;
    listView(ctx, list, Math.min(sel, Math.max(0, list.length - 1)), (c, g, i, y, on) => {
      if (IMG[g.icon]) c.drawImage(IMG[g.icon], 3, y, 14, 12);
      Font.draw(c, GameData.goodName(g.id), 20, y + 1, on ? C.hi : C.text);
      const p = World.price(stId, g.id);
      const ic = IMG[coinIcon(World.priceRating(stId, g.id))];
      if (ic) c.drawImage(ic, 118, y + 2);
      Font.draw(c, p + '', 131, y + 1, C.gold);
      Font.drawRight(c, (W.cargo[g.id] || 0) + '/' + World.stock(stId, g.id), SCR_W - 4, y + 1, C.dim);
    });
    if (tradeMode) UI.softkeys(ctx, '< ' + GameData.T(61), GameData.T(43) + ' >', GameData.T(226));
    else UI.softkeys(ctx, GameData.T(65), GameData.T(41), GameData.T(267) + ' >');
  }

  /* ================================================================ factory */
  function producible() { return GameData.goods.filter(g => g.recipe); }
  function recipeState(g) {
    const cargo = World.state().cargo;
    let have = 0;
    for (const r of g.recipe) if ((cargo[r.id] || 0) >= r.n) have++;
    return { have, need: g.recipe.length };
  }
  function factoryUpdate(In) {
    const list = producible().slice().sort((a, b) => {
      const A = recipeState(a), B = recipeState(b);
      return (B.have / B.need) - (A.have / A.need);
    });
    moveSel(In, list.length);
    if (In.pressed('left')) { go('trade'); return; }
    if (In.pressed('back')) { go('menu'); return; }
    if (!list.length) return;
    const g = list[sel];
    if (In.pressed('fire')) {
      const rs = recipeState(g);
      let body = GameData.goodDesc(g.id) + '\n\n' + GameData.T(330) + ':\n';
      for (const r of g.recipe)
        body += '  ' + GameData.goodName(r.id) + '  ' + (World.state().cargo[r.id] || 0) + '/' + r.n + '\n';
      body += '\n' + GameData.T(42) + ': ' + World.price(World.state().station, g.id) + ' $';
      showInfo(GameData.goodName(g.id), body, g.icon);
      info.onOk = () => {
        if (rs.have < rs.need) { Sfx.play('deny'); return; }
        let max = 99;
        for (const r of g.recipe) max = Math.min(max, Math.floor((World.state().cargo[r.id] || 0) / r.n));
        max = Math.min(max, Math.floor((World.holdMax() - World.holdUsed()) / World.cargoWeight(g.id)) + 1);
        if (max < 1) { say(GameData.T(143)); return; }
        number(GameData.T(263) + ' ' + GameData.goodName(g.id), max, n => {
          for (const r of g.recipe) World.removeCargo(r.id, r.n * n);
          World.addCargo(g.id, n);
          World.state().stats.goodsProduced += n;
          World.state().goodsMade[g.id] = true;
          Sfx.play('money');
          note(n + ' ' + GameData.goodName(g.id) + ' ' + GameData.T(89));
          World.checkMedals();
        });
      };
    }
  }
  function factoryRender(ctx) {
    Gfx.clearTo(5, 18, 28); Gfx.flush();
    header(ctx, GameData.T(267), World.station().name);
    const list = producible().slice().sort((a, b) => {
      const A = recipeState(a), B = recipeState(b);
      return (B.have / B.need) - (A.have / A.need);
    });
    listView(ctx, list, sel, (c, g, i, y, on) => {
      if (IMG[g.icon]) c.drawImage(IMG[g.icon], 3, y, 14, 12);
      Font.draw(c, GameData.goodName(g.id), 20, y + 1, on ? C.hi : C.text);
      const rs = recipeState(g);
      const cross = rs.have === 0 ? 'x_1' : rs.have === rs.need - 1 ? 'x_3' : rs.have < rs.need ? 'x_2' : null;
      if (rs.have >= rs.need) Font.drawRight(c, GameData.T(263), SCR_W - 4, y + 2, C.good);
      else if (IMG[cross]) c.drawImage(IMG[cross], SCR_W - 16, y + 2);
    });
    UI.softkeys(ctx, '< ' + GameData.T(235), GameData.T(226));
  }

  /* ==================================================================== map */
  let mapNav = false;
  function mapUpdate(In) {
    const W = World.state();
    if (In.pressed('back')) { if (mapNav) { mapNav = false; Sfx.play('back'); } else go('menu'); return; }
    if (!mapNav) {
      if (In.pressed('right')) { go('depthmap'); return; }
      if (In.pressed('left')) { go('menu'); return; }
      if (In.pressed('fire')) { mapNav = true; Sfx.play('select'); return; }
      return;
    }
    if (In.pressed('species')) {
      const seen = Object.keys(W.speciesSeen).map(Number);
      if (!seen.length) { Sfx.play('deny'); return; }
      const i = seen.indexOf(mapSpecies);
      mapSpecies = i + 1 >= seen.length ? -1 : seen[i + 1];
      Sfx.play('beep');
      return;
    }
    const step = In.pressed('up') ? [0, -1] : In.pressed('down') ? [0, 1] :
      In.pressed('left') ? [-1, 0] : In.pressed('right') ? [1, 0] : null;
    if (step) {
      const cur = GameData.stations[mapCur];
      let best = -1, bd = 1e9;
      for (const s of GameData.stations) {
        if (s.id === mapCur) continue;
        const dx = s.x - cur.x, dy = s.y - cur.y;
        if (step[0] && Math.sign(dx) !== step[0]) continue;
        if (step[1] && Math.sign(dy) !== step[1]) continue;
        const along = step[0] ? Math.abs(dx) : Math.abs(dy);
        const off = step[0] ? Math.abs(dy) : Math.abs(dx);
        const d = along + off * 3;
        if (d < bd) { bd = d; best = s.id; }
      }
      if (best >= 0) { mapCur = best; Sfx.play('beep'); }
    }
    if (In.pressed('fire')) {
      const target = GameData.stations[mapCur];
      if (mapCur === W.station) { say(GameData.T(310)); return; }
      const r = World.route(W.station, mapCur);
      const reach = World.reachable(W.station, mapCur);
      const ok = World.depthOK(mapCur);
      let body = target.name + '\n' + GameData.T(44) + ': ' + target.tech +
        '\n' + GameData.T(245) + ': ' + World.depthMetres(target.depth) + 'm' +
        '\n' + GameData.T(333) + ': ' + Math.round(World.distance(W.station, mapCur)) +
        '\n' + GameData.T(World.isRebel(mapCur) ? 237 : 236);
      if (!ok) body += '\n\n' + GameData.T(255);
      if (!reach) body += '\n\n' + GameData.T(252) + ' (' + (r ? r.length - 1 : '-') + ')';
      showInfo(GameData.T(73), body, World.isRebel(mapCur) ? 'p_rebels_big_0' : 'p_colonists_big_0');
      info.onOk = () => {
        if (!r) { say(GameData.T(255)); return; }
        ask(GameData.T(247), () => {
          W.plannedRoute = r;
          note(GameData.T(253) + ': ' + r.length);
        });
      };
    }
  }
  function mapRender(ctx) {
    Gfx.clearTo(4, 14, 22); Gfx.flush();
    const W = World.state();
    header(ctx, GameData.T(73), GameData.stations[mapCur].name);
    const X0 = 8, Y0 = 22, MW = SCR_W - 16, MH = SCR_H - 22 - 40;
    UI.rect(ctx, X0, Y0, MW, MH, '#061e2a');
    UI.frame(ctx, X0, Y0, MW, MH, null, C.frame);
    /* engine range ring */
    const cur = GameData.stations[W.station];
    const sx = x => X0 + (x / 100) * MW, sy = y => Y0 + (y / 100) * MH;
    ctx.strokeStyle = 'rgba(80,180,220,0.35)';
    ctx.beginPath();
    ctx.ellipse(sx(cur.x), sy(cur.y), World.engineRange() / 100 * MW, World.engineRange() / 100 * MH, 0, 0, Math.PI * 2);
    ctx.stroke();
    for (const s of GameData.stations) {
      const x = sx(s.x), y = sy(s.y);
      if (!W.visited[s.id]) {                       /* not yet charted */
        ctx.fillStyle = 'rgba(120,170,200,0.42)';
        ctx.fillRect((x - 1) | 0, (y - 1) | 0, 2, 2);
        continue;
      }
      let icon = World.isRebel(s.id) ? 'p_rebels_0' : 'p_colonists_0';
      if (s.id === W.station) icon = 'p_home';
      else if (W.missions.some(m => m.target === s.id)) icon = 'p_mission';
      const im = IMG[icon];
      if (im) ctx.drawImage(im, (x - im.width / 2) | 0, (y - im.height / 2) | 0);
      else { ctx.fillStyle = '#7fe4ff'; ctx.fillRect(x - 1, y - 1, 2, 2); }
    }
    /* where a species you have caught is found (map -> "Species") */
    if (mapSpecies >= 0) {
      const band = GameData.creatures[mapSpecies].algae ? 24 : 12 + mapSpecies * 6;
      ctx.fillStyle = 'rgba(90,255,154,0.75)';
      for (const s of GameData.stations)
        if (Math.abs(s.depth - band) < 22) ctx.fillRect(sx(s.x) - 2, sy(s.y) - 2, 4, 4);
    }
    if (W.plannedRoute) {
      ctx.strokeStyle = '#ffcf4a'; ctx.beginPath();
      W.plannedRoute.forEach((id, i) => {
        const s = GameData.stations[id];
        if (i === 0) ctx.moveTo(sx(s.x), sy(s.y)); else ctx.lineTo(sx(s.x), sy(s.y));
      });
      ctx.stroke();
    }
    const t = GameData.stations[mapCur];
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
    ctx.strokeRect(sx(t.x) - 4.5, sy(t.y) - 4.5, 9, 9);

    Font.draw(ctx, t.name, 6, SCR_H - 36, C.hi);
    Font.draw(ctx, GameData.T(44) + ' ' + t.tech + '   ' + GameData.T(245) + ' ' + World.depthMetres(t.depth) + 'm', 6, SCR_H - 25, C.dim);
    Font.drawRight(ctx, GameData.T(World.isRebel(mapCur) ? 237 : 236), SCR_W - 6, SCR_H - 36,
      World.isRebel(mapCur) ? C.good : C.text);
    if (mapSpecies >= 0) Font.drawRight(ctx, GameData.goodName(mapSpecies), SCR_W - 6, SCR_H - 25, C.good);
    UI.softkeys(ctx, GameData.T(65), mapNav ? GameData.T(226) : GameData.T(259),
      mapNav ? GameData.T(260) : GameData.T(245) + ' >');
  }

  /* ------------------------------------------------------------- depth map */
  function depthUpdate(In) {
    if (In.pressed('back') || In.pressed('left')) { go('map'); return; }
    if (In.pressed('up')) { mapCur = (mapCur - 1 + GameData.stations.length) % GameData.stations.length; Sfx.play('beep'); }
    if (In.pressed('down')) { mapCur = (mapCur + 1) % GameData.stations.length; Sfx.play('beep'); }
    if (In.pressed('fire')) go('map');
  }
  function depthRender(ctx) {
    Gfx.clearTo(3, 10, 18); Gfx.flush();
    header(ctx, GameData.T(245), GameData.stations[mapCur].name);
    const lim = World.depthLimits();
    const Y0 = 24, MH = SCR_H - 24 - 40;
    /* the water column, tinted from sunlit shallows to the abyss */
    for (let i = 0; i < MH; i++) {
      const d = i / MH;
      ctx.fillStyle = 'rgb(' + Math.round(30 - 28 * d) + ',' + Math.round(90 - 84 * d) + ',' + Math.round(120 - 106 * d) + ')';
      ctx.fillRect(0, Y0 + i, SCR_W, 1);
    }
    const dy = d => Y0 + (d / 100) * MH;
    ctx.fillStyle = 'rgba(255,90,60,0.25)';
    ctx.fillRect(0, Y0, SCR_W, dy(lim.min) - Y0);
    ctx.fillRect(0, dy(lim.max), SCR_W, Y0 + MH - dy(lim.max));
    for (const s of GameData.stations) {
      const x = 8 + (s.x / 100) * (SCR_W - 16), y = dy(s.depth);
      ctx.fillStyle = s.id === mapCur ? '#ffffff' : World.isRebel(s.id) ? '#5cff9a' : '#7fb0c8';
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }
    const t = GameData.stations[mapCur];
    const tx = 8 + (t.x / 100) * (SCR_W - 16), ty = dy(t.depth);
    ctx.strokeStyle = '#ffcf4a'; ctx.strokeRect(tx - 4.5, ty - 4.5, 9, 9);
    Font.draw(ctx, t.name + '  ' + World.depthMetres(t.depth) + 'm', 6, SCR_H - 36,
      World.depthOK(mapCur) ? C.good : C.warn);
    Font.draw(ctx, GameData.T(321) + ' ' + World.depthMetres(lim.max) + 'm   ' +
      GameData.T(322) + ' ' + World.depthMetres(lim.min) + 'm', 6, SCR_H - 25, C.dim);
    UI.softkeys(ctx, '< ' + GameData.T(73), GameData.T(41));
  }

  /* ================================================================= status */
  const STATS = [
    [71, 'hours'], [72, 'kills'], [283, 'pirateKills'], [311, 'fishCaught'], [312, 'fishLost'],
    [313, 'fishKilled'], [314, 'stationsVisited'], [315, 'goodsProduced'], [316, 'deadFish'],
    [317, 'crates'], [318, 'streams'], [321, 'maxDepthM'], [322, 'minDepthM']
  ];
  function statusUpdate(In) {
    if (In.pressed('back')) { go('menu'); return; }
    if (In.pressed('right')) { go('medals'); return; }
    moveSel(In, STATS.length);
  }
  function statusRender(ctx) {
    Gfx.clearTo(5, 18, 28); Gfx.flush();
    const W = World.state();
    header(ctx, GameData.T(64), W.name);
    Portrait.draw(ctx, W.face, 4, 20, 40);
    Font.draw(ctx, GameData.shipName(W.ship.type), 48, 20, C.hi);
    Font.draw(ctx, GameData.T(319) + ': ' + World.fitted(GameData.EQ.GUN).reduce((a, f) => a + f.e.value, 0), 48, 32, C.text);
    Font.draw(ctx, GameData.T(320) + ': ' + (World.shieldMax() + World.hullMax()), 48, 44, C.text);
    Font.drawRight(ctx, W.credits.toLocaleString() + ' $', SCR_W - 4, 20, C.gold);
    let y = 66;
    for (const [k, stat] of STATS) {
      let v = World.statValue(stat);
      if (stat === 'hours') v = v.toFixed(1);
      else if (stat.endsWith('DepthM')) v = Math.round(v) + 'm';
      else v = Math.round(v);
      Font.draw(ctx, GameData.T(k), 6, y, C.text);
      Font.drawRight(ctx, '' + v, SCR_W - 6, y, C.hi);
      y += 13;
      if (y > SCR_H - 30) break;
    }
    UI.softkeys(ctx, GameData.T(65), '', GameData.T(63) + ' >');
  }

  /* ================================================================= medals */
  function medalsUpdate(In) {
    if (In.pressed('back') || In.pressed('left')) { go('status'); return; }
    moveSel(In, World.MEDALS.length);
    if (In.pressed('fire')) {
      const m = World.MEDALS[sel], g = World.medalGrade(sel);
      const have = m.stat ? World.statValue(m.stat) : 0;
      let body = GameData.medalDesc(sel).replace('#', World.medalThreshold(sel));
      if (m.stat && m.grades.length > 1)
        body += '\n\n' + (Math.round(have * 10) / 10) + ' / ' + World.medalThreshold(sel);
      body += '\n' + (g ? ['', 'BRONZE', 'SILVER', 'GOLD'][g] : GameData.T(15));
      showInfo(GameData.medalName(sel), body, 'medal_' + Math.max(1, Math.min(7, g * 2)));
    }
  }
  function medalsRender(ctx) {
    Gfx.clearTo(5, 18, 28); Gfx.flush();
    header(ctx, GameData.T(63), Object.keys(World.state().medals).length + '/' + World.MEDALS.length);
    listView(ctx, World.MEDALS, sel, (c, m, i, y, on) => {
      const g = World.medalGrade(i);
      const icon = g ? 'medal_' + Math.min(7, g * 2) : 'lock';
      if (IMG[icon]) c.drawImage(IMG[icon], 4, y + 1);
      Font.draw(c, GameData.medalName(i), 24, y + 2, on ? C.hi : (g ? C.text : C.dim));
      if (g) Font.drawRight(c, ['', 'I', 'II', 'III'][g], SCR_W - 6, y + 2, C.gold);
    });
    UI.softkeys(ctx, '< ' + GameData.T(64), GameData.T(226));
  }

  /* ================================================================= system */
  const SYS = [[2, 'save'], [1, 'load'], [3, 'settings'], [305, 'tips'], [20, 'credits'], [5, 'quit']];
  function systemUpdate(In) {
    moveSel(In, SYS.length);
    if (In.pressed('back')) { go('menu'); return; }
    if (In.pressed('fire')) {
      const a = SYS[sel][1];
      if (a === 'save') { World.save(0); World.autosave(); say(GameData.T(32)); }
      else if (a === 'load') ask(GameData.T(33), () => {
        if (World.load(0)) { Sfx.play('message'); Game.reloadStation(); } else Sfx.play('deny');
      });
      else if (a === 'settings') Game.openSettings();
      else if (a === 'tips') say(GameData.T(146 + ((Math.random() * 17) | 0)));
      else if (a === 'credits') say(GameData.T(28) + '\n\n' + GameData.T(25));
      else if (a === 'quit') ask(GameData.T(35), () => onQuit && onQuit());
    }
  }
  function systemRender(ctx) {
    Gfx.clearTo(5, 18, 28); Gfx.flush();
    header(ctx, GameData.T(66));
    for (let i = 0; i < SYS.length; i++) {
      const y = 34 + i * 20;
      if (i === sel) UI.rect(ctx, 12, y - 3, SCR_W - 24, 17, '#0e3145');
      Font.draw(ctx, GameData.T(SYS[i][0]), 26, y, i === sel ? C.hi : C.text);
    }
    UI.softkeys(ctx, GameData.T(65), GameData.T(41));
  }

  /* the info overlay confirms with fire, so route it here */
  function infoConfirm() {
    if (info && info.onOk) { const f = info.onOk; info = null; f(); return true; }
    return false;
  }
  return { bind, open, update, render, current, note, ask, say, showInfo, infoConfirm, go, get info() { return info; } };
})();
