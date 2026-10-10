/* ============================================================================
   2D layer: the original 11x16 bitmap font, sprite helpers and the widgets the
   station screens are built from.
   ========================================================================== */
'use strict';

/* ----------------------------------------------------------------------------
   Text.  The handset's own 11x16 sheet is a stylised display face - its "a"
   and "n" are all but the same shape at this size, which makes a menu item
   guesswork.  Since the 2D layer is now drawn at the display's real
   resolution rather than into the low resolution surface, text can be set
   with a proper typeface instead: hinted, anti-aliased and readable, while
   sprites and the sector stay pixel exact beside it.  The API is unchanged,
   so every hand-placed coordinate in the interface still lands where it did.
   -------------------------------------------------------------------------- */
const Font = (() => {
  const SIZE = 11;
  const FACE = '600 ' + SIZE + 'px system-ui, "Segoe UI", Roboto, "Helvetica Neue", ' +
               '"DejaVu Sans", Arial, sans-serif';
  const SHADOW = 'rgba(1,10,16,0.85)';
  const widths = new Map();
  let mc = null;

  function metrics() {
    if (!mc) {
      mc = document.createElement('canvas').getContext('2d');
      mc.font = FACE;
    }
    return mc;
  }
  /* kept so the loader can still hand over the original sheet */
  function build() { widths.clear(); }

  function measure(s) {
    s = String(s);
    let w = widths.get(s);
    if (w === undefined) {
      w = Math.round(metrics().measureText(s).width);
      if (widths.size > 4000) widths.clear();
      widths.set(s, w);
    }
    return w;
  }

  function draw(ctx, s, x, y, colour) {
    s = String(s);
    ctx.font = FACE;
    ctx.textBaseline = 'top';
    /* the original glyphs carried their own outline; a one pixel shadow keeps
       the same weight against the water without hurting legibility */
    ctx.fillStyle = SHADOW;
    ctx.fillText(s, Math.round(x) + 1, Math.round(y));
    ctx.fillStyle = colour || '#ffffff';
    ctx.fillText(s, Math.round(x), Math.round(y) - 1);
    return measure(s);
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
  return { build, draw, drawCentre, drawRight, measure, wrap, height };
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
   Realistic portraits. Named speakers use fixed artwork; saved numeric player
   and contact seeds select a stable entry in the bundled portrait bank.
   ========================================================================== */
const Portrait = (() => {
  const ART_PATH = 'portraits/cast.webp';
  const POOL = Array.from({ length: 8 }, (_, i) =>
    'portraits/pilot-' + String(i + 1).padStart(2, '0') + '.webp');
  /* Frames exclude the approved cast sheet's labels and dividers. */
  const CAST = {
    j: { name: 'Jack Dawn', path: ART_PATH, frame: [2, 2, 432, 530] },
    r: { name: 'Pierre', path: ART_PATH, frame: [439, 2, 434, 530] },
    l: { name: 'Lea', path: ART_PATH, frame: [879, 2, 431, 530] },
    a: { name: 'Ayumi', path: ART_PATH, frame: [2, 580, 432, 556] },
    y: { name: 'Raymond', path: ART_PATH, frame: [439, 580, 434, 556] },
    f: { name: 'Fenko', path: ART_PATH, frame: [879, 580, 431, 556] },
    m: { name: 'M.A.I.', path: 'portraits/mai.webp' }
  };
  const PATHS = [...POOL, ART_PATH, CAST.m.path];
  let IMG = {}, fallback = null;

  function bind(images) {
    IMG = images;
    const path = POOL.find(path => IMG[path]);
    if (path) fallback = { path };
    else fallback = Object.values(CAST).find(entry => IMG[entry.path]) || null;
  }
  function index(seed) { return Math.abs(Math.trunc(Number(seed)) || 0) % POOL.length; }
  function hasCharacter(character) { return Object.prototype.hasOwnProperty.call(CAST, character); }
  function drawPicture(ctx, entry, x, y, width, height) {
    if (!IMG[entry.path]) entry = fallback;
    if (!entry) return false;
    const art = IMG[entry.path];
    let [sx, sy, sw, sh] = entry.frame || [0, 0, art.width, art.height];
    const aspect = width / height;
    if (sw / sh > aspect) { const crop = sh * aspect; sx += (sw - crop) / 2; sw = crop; }
    else { const crop = sw / aspect; sy += (sh - crop) / 2; sh = crop; }
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(art, sx, sy, sw, sh, x, y, width, height);
    ctx.restore();
    return true;
  }
  function draw(ctx, seed, x, y, size, height) {
    const width = size || 40;
    return drawPicture(ctx, { path: POOL[index(seed)] }, x, y, width, height || width);
  }
  function drawCharacter(ctx, character, x, y, width, height) {
    if (!hasCharacter(character)) return false;
    return drawPicture(ctx, CAST[character], x, y, width, height);
  }
  return { bind, draw, hasCharacter, drawCharacter, index, ART_PATH, CAST, PATHS,
    get count() { return POOL.length; }, ready: () => !!fallback };
})();
