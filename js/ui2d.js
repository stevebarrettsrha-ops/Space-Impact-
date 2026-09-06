/* ============================================================================
   2D layer: the original 11x16 bitmap font, sprite helpers and the widgets the
   station screens are built from.
   ========================================================================== */
'use strict';

const Font = (() => {
  /* The sheet is 176x176: 16 columns of 11px and 11 rows of 16px, holding
     codes 32..127 followed by the Cyrillic block and a row of accents. */
  const CW = 11, CH = 16, COLS = 16;
  let sheet = null, widths = null, top = 0, ink = CH, tints = new Map();

  function build(img) {
    sheet = img;
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, img.width, img.height).data;
    const rows = Math.floor(img.height / CH);
    widths = new Uint8Array(COLS * rows);
    let minY = CH, maxY = 0;
    for (let g = 0; g < COLS * rows; g++) {
      const gx = (g % COLS) * CW, gy = ((g / COLS) | 0) * CH;
      let w = 0;
      for (let yy = 0; yy < CH; yy++)
        for (let xx = 0; xx < CW; xx++)
          if (d[((gy + yy) * img.width + gx + xx) * 4 + 3] > 0) {
            if (xx + 1 > w) w = xx + 1;
            if (yy < minY) minY = yy;
            if (yy > maxY) maxY = yy;
          }
      widths[g] = w || 4;
    }
    top = minY; ink = maxY - minY + 1;
    Font.height = ink;
    tints.clear();
  }

  function tinted(colour) {
    let t = tints.get(colour);
    if (t) return t;
    const c = document.createElement('canvas');
    c.width = sheet.width; c.height = sheet.height;
    const x = c.getContext('2d');
    x.drawImage(sheet, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = colour;
    x.fillRect(0, 0, c.width, c.height);
    tints.set(colour, c);
    return c;
  }

  function glyph(ch) {
    const code = ch.charCodeAt(0);
    if (code >= 32 && code <= 127) return code - 32;
    if (code >= 0x410 && code <= 0x44f) return 96 + (code - 0x410);   /* Cyrillic block */
    if (code === 0xae) return 160;                                    /* (R) */
    if (code === 0xa9) return 161;                                    /* (C) */
    if (code === 0x2122) return 162;                                  /* TM  */
    if (code === 0x2014 || code === 0x2013) return 13;                /* dashes */
    if (code === 0x2019 || code === 0x2018) return 7;
    if (code === 0x201c || code === 0x201d) return 2;
    if (code === 0xfc) return 'u'.charCodeAt(0) - 32;
    if (code === 0xf6) return 'o'.charCodeAt(0) - 32;
    if (code === 0xe4) return 'a'.charCodeAt(0) - 32;
    return 31;                                                        /* '?' */
  }

  function measure(s) {
    let w = 0;
    for (let i = 0; i < s.length; i++) w += widths[glyph(s[i])] + 1;
    return w ? w - 1 : 0;
  }

  function draw(ctx, s, x, y, colour) {
    const sh = tinted(colour || '#ffffff');
    let cx = Math.round(x);
    const yy = Math.round(y);
    for (let i = 0; i < s.length; i++) {
      const g = glyph(s[i]), w = widths[g];
      if (s[i] !== ' ')
        ctx.drawImage(sh, (g % COLS) * CW, ((g / COLS) | 0) * CH + top, CW, ink, cx, yy, CW, ink);
      cx += w + 1;
    }
    return cx - x;
  }
  function drawCentre(ctx, s, cx, y, colour) { return draw(ctx, s, Math.round(cx - measure(s) / 2), y, colour); }
  function drawRight(ctx, s, rx, y, colour) { return draw(ctx, s, rx - measure(s), y, colour); }

  function wrap(s, maxW) {
    const out = [];
    for (const para of String(s).split('\n')) {
      if (!para.length) { out.push(''); continue; }
      let line = '';
      for (const word of para.split(' ')) {
        const t = line ? line + ' ' + word : word;
        if (measure(t) > maxW && line) { out.push(line); line = word; }
        else line = t;
      }
      out.push(line);
    }
    return out;
  }
  const height = 11;
  return { build, draw, drawCentre, drawRight, measure, wrap, height, glyph, tinted };
})();

const UI = (() => {
  const COL = {
    text: '#cfe6f2', dim: '#6d8fa3', hi: '#7fe4ff', warn: '#ff6a52', good: '#7dff9a',
    gold: '#ffcf4a', frame: '#2b566b', frameHi: '#4f9dbd', bg: '#061620', bgHi: '#0e3145',
    panel: '#0b2433', shadow: '#03090f'
  };

  function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, w | 0, h | 0); }
  function frame(ctx, x, y, w, h, fill, edge) {
    if (fill) rect(ctx, x, y, w, h, fill);
    ctx.strokeStyle = edge || COL.frame;
    ctx.lineWidth = 1;
    ctx.strokeRect((x | 0) + 0.5, (y | 0) + 0.5, (w | 0) - 1, (h | 0) - 1);
  }
  /* the angular HUD panel used all over the original interface */
  function panel(ctx, x, y, w, h, title) {
    ctx.fillStyle = 'rgba(4,20,30,0.86)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = COL.frame; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, y + 6.5); ctx.lineTo(x + 6.5, y + 0.5); ctx.lineTo(x + w - 0.5, y + 0.5);
    ctx.lineTo(x + w - 0.5, y + h - 6.5); ctx.lineTo(x + w - 6.5, y + h - 0.5);
    ctx.lineTo(x + 0.5, y + h - 0.5); ctx.closePath(); ctx.stroke();
    if (title) {
      rect(ctx, x + 4, y + 3, w - 8, 11, COL.bgHi);
      Font.draw(ctx, title, x + 7, y + 3, COL.hi);
    }
  }
  function bar(ctx, x, y, w, h, frac, col, back) {
    rect(ctx, x, y, w, h, back || '#0a2230');
    const f = Math.max(0, Math.min(1, frac));
    rect(ctx, x + 1, y + 1, Math.max(0, (w - 2) * f), h - 2, col);
  }
  /* dimming always covers the whole display, not just the page, so a menu
     over the sector does not leave a bright ring around itself */
  function shade(ctx, a) {
    Gfx.pushFull();
    ctx.fillStyle = 'rgba(2,8,14,' + a + ')';
    ctx.fillRect(0, 0, SCR_W, SCR_H);
    Gfx.pop();
  }

  /* soft key bar at the bottom of every screen */
  function softkeys(ctx, left, right, centre) {
    const y = SCR_H - 13;
    rect(ctx, 0, y, SCR_W, 13, '#04141d');
    rect(ctx, 0, y, SCR_W, 1, COL.frame);
    if (left) Font.draw(ctx, left, 3, y + 1, COL.hi);
    if (right) Font.drawRight(ctx, right, SCR_W - 3, y + 1, COL.hi);
    if (centre) Font.drawCentre(ctx, centre, SCR_W / 2, y + 1, COL.gold);
  }
  return { COL, rect, frame, panel, bar, shade, softkeys };
})();

/* ============================================================================
   Portraits.  faces/*.png are not whole pictures but the layers the MIDlet
   composites into one: a background, a collar, a mouth, a pair of eyes, hair
   and an optional accessory.  That is what the "Generate portrait" option in
   the original character screen does.
   ========================================================================== */
const Portrait = (() => {
  const BG = [84, 85, 86, 87];
  const CLOTH = [78, 79, 80, 81, 82, 83];
  const MOUTH = [58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 74, 75, 76, 77];
  const EYES = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27];
  const HAIR = [30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48,
                49, 50, 51, 52, 53, 54, 89, 90, 91, 92, 93, 94];
  const ACC = [1, 2, 3, 4, 5, 6, 7, 8];
  let IMG = null;
  const cache = new Map();

  function rnd(seed, k) {
    let h = Math.imul(seed + 1, 73856093) ^ Math.imul(k + 1, 19349663);
    h = Math.imul(h ^ (h >>> 15), 2246822519);
    h = Math.imul(h ^ (h >>> 13), 3266489917);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  const pick = (arr, seed, k) => arr[Math.floor(rnd(seed, k) * arr.length) % arr.length];

  function bind(images) { IMG = images; cache.clear(); }

  function layers(seed) {
    const out = [pick(BG, seed, 1), pick(CLOTH, seed, 2), pick(MOUTH, seed, 3),
                 pick(EYES, seed, 4), pick(HAIR, seed, 5)];
    if (rnd(seed, 6) < 0.34) out.push(pick(ACC, seed, 7));
    return out;
  }

  function canvasFor(seed) {
    let c = cache.get(seed);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = 40; c.height = 40;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    for (const id of layers(seed)) {
      const im = IMG && IMG['faces/' + id];
      if (im) x.drawImage(im, 0, 0, 40, 40);
    }
    cache.set(seed, c);
    return c;
  }

  function draw(ctx, seed, x, y, size) {
    const c = canvasFor(seed);
    const s = size || 40;
    ctx.drawImage(c, x | 0, y | 0, s, s);
  }
  return { bind, draw, canvasFor, layers };
})();
