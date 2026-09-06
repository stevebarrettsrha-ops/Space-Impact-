/* ============================================================================
   Software renderer: bitmap font, sprite blitting and a perspective correct
   z-buffered triangle rasteriser with depth fog.  The framebuffer follows the
   window rather than the other way round, and is presented with a whole
   number block copy, so the picture fills the display and stays exact.
   ========================================================================== */
'use strict';

/* The logical framebuffer.  On the handset this was a fixed 240x320; here it
   is re-chosen on every resize so one logical pixel is a whole number of
   device pixels and the buffer covers the whole window.  Nothing is ever
   resampled, which is what keeps letters and sprites sharp, and the picture
   is as large as the display allows.  The 2D screens are laid out inside a
   centred "page" of roughly the original proportions so their design still
   reads on a wide monitor, while the sector fills the glass edge to edge. */
let SCR_W = 240, SCR_H = 320;

const Gfx = (() => {
  const TARGET_H = 320;          /* logical rows we aim for */
  const MAX_PIXELS = 250000;     /* what the software rasteriser can afford */
  const MAX_DEVICE = 9.5e6;      /* and what the compositor will blit for free */
  const MIN_COLS = 200;          /* fewest logical columns the layout wants */
  const PAGE_WIDE = 1.0;         /* widest a 2D page is allowed to get */
  const PAGE_TALL = 0.62;        /* and the tallest */

  /* ctx is the 2D layer and lives on the visible canvas at its full device
     resolution, so text is set by the browser at native size instead of being
     drawn into the low resolution surface and blown up with it.  sctx exists
     only to push the rasteriser's buffer into that surface. */
  let view, ctx, surface, sctx, img, buf32, zbuf;
  let W = SCR_W, H = SCR_H;
  let scale = 1, upscale = 1;
  let pageW = SCR_W, pageH = SCR_H, pageX = 0, pageY = 0;
  let region = 'full';
  const rstack = [];
  let held = 0;                  /* saved context levels we own */
  let layout = 'desktop';

  /* ---------------------------------------------------------------- setup */
  function init(cv) {
    view = cv;
    /* both contexts are handed out once and kept for the life of the game;
       their canvases are only ever resized, never re-created */
    ctx = view.getContext('2d', { alpha: false });
    surface = document.createElement('canvas');
    surface.width = W; surface.height = H;
    sctx = surface.getContext('2d', { alpha: false });
    sctx.imageSmoothingEnabled = false;
    img = sctx.createImageData(W, H);
    buf32 = new Uint32Array(img.data.buffer);
    zbuf = new Float32Array(W * H);
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', () => setTimeout(resize, 80));
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', resize);
      window.visualViewport.addEventListener('scroll', resize);
    }
  }

  function alloc(w, h) {
    if (w === W && h === H && img) return;
    W = w; H = h;
    surface.width = w; surface.height = h;
    sctx.imageSmoothingEnabled = false;
    img = sctx.createImageData(w, h);
    buf32 = new Uint32Array(img.data.buffer);
    zbuf = new Float32Array(w * h);
  }

  /* ------------------------------------------------------------- regions --
     Everything is drawn either full bleed (the sector, the HUD) or inside the
     page (menus, the station, dialogue boxes).  Pushing a region sets the 2D
     transform, a clip and the SCR_W / SCR_H the layout code reads, so the
     screens keep their hand-placed coordinates whatever the window is. */
  function applyRegion() {
    /* logical units in, device pixels out */
    ctx.setTransform(upscale, 0, 0, upscale, 0, 0);
    ctx.imageSmoothingEnabled = false;      /* sprites stay pixel art */
    if (region === 'page') {
      SCR_W = pageW; SCR_H = pageH;
      ctx.translate(pageX, pageY);
      ctx.beginPath(); ctx.rect(0, 0, pageW, pageH); ctx.clip();
    } else { SCR_W = W; SCR_H = H; }
  }
  /* A clip cannot be widened again once it is set, so every change unwinds
     the context back to its clean state and re-applies from scratch.  Only
     one region is ever live, so a single saved level is enough. */
  function sync() {
    while (held > 0) { ctx.restore(); held--; }
    ctx.save(); held = 1;
    applyRegion();
  }
  function pushPage() { rstack.push(region); region = 'page'; sync(); }
  function pushFull() { rstack.push(region); region = 'full'; sync(); }
  function pop() { region = rstack.pop() || 'full'; sync(); }
  function pageRect() { return { x: pageX, y: pageY, w: pageW, h: pageH }; }

  function chromeOf(el) {
    const cs = getComputedStyle(el), n = v => parseFloat(v) || 0;
    return {
      w: n(cs.paddingLeft) + n(cs.paddingRight) + n(cs.borderLeftWidth) + n(cs.borderRightWidth),
      h: n(cs.paddingTop) + n(cs.paddingBottom) + n(cs.borderTopWidth) + n(cs.borderBottomWidth)
    };
  }

  /* --------------------------------------------------------------- fitting
     One integer N is picked so that N logical pixels tile the display grid
     exactly: the backing store is (bufW*N) x (bufH*N) device pixels, the CSS
     box is that divided by the device pixel ratio, and the blit from the
     surface is a clean NxN block copy.  No fractional scaling anywhere, so
     nothing is ever blurred - and because the logical size follows the window
     instead of the other way round, the game fills the screen. */
  function resize() {
    if (!view) return;
    const vv = window.visualViewport;
    const vw = Math.max(64, Math.round(vv ? vv.width : window.innerWidth));
    const vh = Math.max(64, Math.round(vv ? vv.height : window.innerHeight));
    const root = document.documentElement;
    const frame = view.parentElement;
    const touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

    /* on a touch device the controls need room of their own: a band under
       the screen in portrait, the side gutters in landscape */
    layout = !touch ? 'desktop' : (vh / vw > 1.15 ? 'portrait' : 'landscape');
    const band = layout === 'portrait'
      ? Math.round(Math.min(190, Math.max(96, vh * 0.22))) : 0;

    /* the picture now reaches the edges, so the frame keeps no decoration */
    frame.classList.add('bare');
    const c = chromeOf(frame);
    const availW = Math.max(120, vw - c.w), availH = Math.max(160, vh - band - c.h);

    /* A very dense display can ask for more pixels than a canvas blit wants
       to move; halving the target keeps the ratio a whole number, so the
       browser's own upscale is still an exact block copy. */
    const real = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    let dpr = real;
    while (dpr > 0.3 && availW * dpr * availH * dpr > MAX_DEVICE) dpr /= 2;
    const devW = Math.max(120, Math.floor(availW * dpr));
    const devH = Math.max(160, Math.floor(availH * dpr));

    let n = Math.max(1, Math.min(10, Math.round(devH / TARGET_H)));
    while (n < 16 && (devW / n) * (devH / n) > MAX_PIXELS) n++;
    /* a tall narrow window would otherwise be left with fewer columns than
       the interface was drawn for, so trade a little sharpness back for room */
    while (n > 1 && devW / n < MIN_COLS && (devW / (n - 1)) * (devH / (n - 1)) <= MAX_PIXELS) n--;
    let bw = Math.max(120, Math.floor(devW / n));
    let bh = Math.max(120, Math.floor(devH / n));
    /* the minimums must never push the backing store past the window */
    n = Math.max(1, Math.min(n, Math.floor(devW / bw) || 1, Math.floor(devH / bh) || 1));
    bw = Math.max(60, Math.floor(devW / n));
    bh = Math.max(60, Math.floor(devH / n));
    upscale = n;
    alloc(bw, bh);

    pageW = Math.min(bw, Math.round(bh * PAGE_WIDE));
    pageH = Math.min(bh, Math.round(pageW / PAGE_TALL));
    pageX = (bw - pageW) >> 1;
    pageY = (bh - pageH) >> 1;
    if (region === 'page') { SCR_W = pageW; SCR_H = pageH; } else { SCR_W = bw; SCR_H = bh; }

    const cw = bw * n, ch = bh * n;
    if (view.width !== cw || view.height !== ch) { view.width = cw; view.height = ch; held = 0; }
    ctx.imageSmoothingEnabled = false;
    const w = cw / dpr, h = ch / dpr;
    view.style.width = w + 'px';
    view.style.height = h + 'px';
    view.style.imageRendering = 'pixelated';
    scale = w / bw;
    sync();

    /* Size the touch controls from the room they actually have.  A cluster
       is a stick (or fire button, 0.66 of it) beside a column of two keys,
       and both clusters have to sit side by side in the band, or one in
       each gutter, without straying onto the picture. */
    const gutter = Math.max(0, Math.round((vw - w) / 2));
    const EDGE = 10, GAP = 9;
    const keyw = Math.round(Math.min(60, Math.max(38, vw * 0.14)));
    const cluster = GAP + keyw + EDGE;
    let ctl = 120;
    if (layout === 'portrait') ctl = Math.min(148, (vw - 2 * cluster) / 1.66, band - 14);
    else if (layout === 'landscape') ctl = Math.min(148, gutter - cluster - 6, vh - 24);
    ctl = Math.max(64, Math.round(ctl));

    root.dataset.layout = layout;
    root.style.setProperty('--game-w', w + 'px');
    root.style.setProperty('--game-h', h + 'px');
    root.style.setProperty('--band', band + 'px');
    root.style.setProperty('--gutter', gutter + 'px');
    root.style.setProperty('--ctl', ctl + 'px');
    root.style.setProperty('--keyw', keyw + 'px');
    /* only when even that will not fit do the controls sit over the picture */
    root.dataset.overlay = (layout === 'landscape' && gutter < ctl + cluster) ? 'yes' : 'no';
    window.dispatchEvent(new CustomEvent('gamelayout'));
  }
  function screenScale() { return scale; }
  function screenLayout() { return layout; }

  /* ------------------------------------------------------------------ 3D -- */
  let fogR = 4, fogG = 26, fogB = 44, fogNear = 1200, fogFar = 9000;
  let fogPacked = 0;
  const camM = new Float32Array(12);
  let focal = 260;

  function packFog() { fogPacked = (255 << 24) | (fogB << 16) | (fogG << 8) | fogR; }
  packFog();

  function setFog(r, g, b, near, far) {
    fogR = r; fogG = g; fogB = b; fogNear = near; fogFar = far; packFog();
  }
  function fogColour() { return fogPacked; }

  function clear3D() {
    buf32.fill(fogPacked);
    zbuf.fill(1e30);
  }
  /* Filling the screen honours the current region: inside a page the surround
     gets a darker wash of the same colour and a hairline edge, so a menu on a
     wide monitor reads as a lit panel rather than a stripe of nothing. */
  function span(c, y, x0, x1) {
    if (y < 0 || y >= H) return;
    const a = x0 < 0 ? 0 : x0, b2 = x1 > W ? W : x1;
    if (b2 > a) buf32.fill(c, y * W + a, y * W + b2);
  }
  function clearTo(r, g, b) {
    const c = (255 << 24) | (b << 16) | (g << 8) | r;
    if (region === 'page' && (pageW < W || pageH < H)) {
      /* the surround is the same water, further off: it falls away from the
         page and darkens towards the abyss, so the console reads as a lit
         window rather than as a strip of dead black */
      const cx = W * 0.5, cy = H * 0.5, dmax = Math.hypot(cx, cy) || 1;
      for (let y = 0; y < H; y++) {
        const dy = (y - cy) / dmax;
        const lift = 0.62 + 0.38 * (1 - y / (H - 1 || 1));
        let idx = y * W;
        for (let x = 0; x < W; x++, idx++) {
          const dx = (x - cx) / dmax;
          let k = (0.66 - 0.52 * Math.sqrt(dx * dx + dy * dy)) * lift;
          if (k < 0.05) k = 0.05;
          buf32[idx] = (255 << 24) | (((b * k) | 0) << 16) | (((g * k) | 0) << 8) | ((r * k) | 0);
        }
      }
      for (let y = pageY; y < pageY + pageH; y++) span(c, y, pageX, pageX + pageW);
      const edge = (255 << 24) | (109 << 16) | (86 << 8) | 33;
      const glow = (255 << 24) | (58 << 16) | (44 << 8) | 16;
      span(edge, pageY - 1, pageX - 1, pageX + pageW + 1);
      span(edge, pageY + pageH, pageX - 1, pageX + pageW + 1);
      span(glow, pageY - 2, pageX - 2, pageX + pageW + 2);
      span(glow, pageY + pageH + 1, pageX - 2, pageX + pageW + 2);
      for (let y = pageY; y < pageY + pageH; y++) {
        span(edge, y, pageX - 1, pageX);
        span(edge, y, pageX + pageW, pageX + pageW + 1);
        span(glow, y, pageX - 2, pageX - 1);
        span(glow, y, pageX + pageW + 1, pageX + pageW + 2);
      }
    } else buf32.fill(c);
    zbuf.fill(1e30);
  }
  /* the water column: brighter towards the surface, black towards the abyss */
  function clearGradient(top, bot, horizon) {
    for (let y = 0; y < H; y++) {
      let t = (y - horizon) / H + 0.5;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const r = (top[0] + (bot[0] - top[0]) * t) | 0;
      const g = (top[1] + (bot[1] - top[1]) * t) | 0;
      const b2 = (top[2] + (bot[2] - top[2]) * t) | 0;
      const c = (255 << 24) | (b2 << 16) | (g << 8) | r;
      buf32.fill(c, y * W, y * W + W);
    }
    zbuf.fill(1e30);
  }

  /* camera: yaw about Y, pitch about X, position in world units */
  function setCamera(x, y, z, yaw, pitch, roll, fov) {
    /* view matrix = Rz(-roll) * Rx(-pitch) * Ry(-yaw) */
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const cr = Math.cos(roll || 0), sr = Math.sin(roll || 0);
    /* R = Rz(roll) * Rx(pitch) * Ry(yaw) */
    const m = [
      cy, 0, -sy,
      0, 1, 0,
      sy, 0, cy
    ];
    const p = [
      1, 0, 0,
      0, cp, sp,
      0, -sp, cp
    ];
    const rl = [
      cr, sr, 0,
      -sr, cr, 0,
      0, 0, 1
    ];
    const a = mul3(p, m), b = mul3(rl, a);
    camM[0] = b[0]; camM[1] = b[1]; camM[2] = b[2];
    camM[4] = b[3]; camM[5] = b[4]; camM[6] = b[5];
    camM[8] = b[6]; camM[9] = b[7]; camM[10] = b[8];
    camM[3] = -(b[0] * x + b[1] * y + b[2] * z);
    camM[7] = -(b[3] * x + b[4] * y + b[5] * z);
    camM[11] = -(b[6] * x + b[7] * y + b[8] * z);
    focal = (H / 2) / Math.tan((fov || 1.05) / 2);
  }
  function mul3(a, b) {
    const o = new Array(9);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++)
      o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
    return o;
  }

  function rotMatrix(yaw, pitch, roll) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const cr = Math.cos(roll), sr = Math.sin(roll);
    const ry = [cy, 0, sy, 0, 1, 0, -sy, 0, cy];
    const rx = [1, 0, 0, 0, cp, -sp, 0, sp, cp];
    const rz = [cr, -sr, 0, sr, cr, 0, 0, 0, 1];
    return mul3(ry, mul3(rx, rz));
  }

  /* scratch vertex arrays, grown on demand */
  let vx = new Float32Array(4096), vy = new Float32Array(4096), vz = new Float32Array(4096);
  let sx = new Float32Array(4096), sy2 = new Float32Array(4096), li = new Float32Array(4096);
  function ensure(n) {
    if (vx.length >= n) return;
    const m = 1 << Math.ceil(Math.log2(n));
    vx = new Float32Array(m); vy = new Float32Array(m); vz = new Float32Array(m);
    sx = new Float32Array(m); sy2 = new Float32Array(m); li = new Float32Array(m);
  }

  const KEY = 30;                      /* r+g+b at or below this is black */
  /* The boat carries lights, so there is a pool of brightness around it that
     falls off with the square of the distance.  It is measured in view space,
     where the camera sits at the origin, which costs one multiply-add per
     vertex and stops everything within working range reading as a silhouette. */
  let lampK = 0, lampR2 = 1;
  function setLamp(strength, range) {
    lampK = strength || 0;
    lampR2 = (range || 1) * (range || 1);
  }
  let filter = true;                   /* bilinear sampling on solid surfaces */
  function setFilter(v) { filter = !!v; }
  const LIGHT = [0.35, 0.75, -0.55];
  (function () {
    const l = Math.hypot(LIGHT[0], LIGHT[1], LIGHT[2]);
    LIGHT[0] /= l; LIGHT[1] /= l; LIGHT[2] /= l;
  })();

  /* opts: {tex, scale, rot(3x3), ambient, tint:[r,g,b], additive, noFog} */
  function drawModel(model, px, py, pz, rot, s, tex, opts) {
    opts = opts || {};
    const n = model.count;
    ensure(n);
    const V = model.V, N = model.N;
    const m = camM;
    const r = rot || IDENT3;
    /* combined object->view rotation */
    const a0 = m[0] * r[0] + m[1] * r[3] + m[2] * r[6];
    const a1 = m[0] * r[1] + m[1] * r[4] + m[2] * r[7];
    const a2 = m[0] * r[2] + m[1] * r[5] + m[2] * r[8];
    const b0 = m[4] * r[0] + m[5] * r[3] + m[6] * r[6];
    const b1 = m[4] * r[1] + m[5] * r[4] + m[6] * r[7];
    const b2 = m[4] * r[2] + m[5] * r[5] + m[6] * r[8];
    const c0 = m[8] * r[0] + m[9] * r[3] + m[10] * r[6];
    const c1 = m[8] * r[1] + m[9] * r[4] + m[10] * r[7];
    const c2 = m[8] * r[2] + m[9] * r[5] + m[10] * r[8];
    const tx = m[0] * px + m[1] * py + m[2] * pz + m[3];
    const ty = m[4] * px + m[5] * py + m[6] * pz + m[7];
    const tz = m[8] * px + m[9] * py + m[10] * pz + m[11];

    const cx = W / 2, cy2 = H / 2;
    const amb = opts.ambient === undefined ? 0.62 : opts.ambient;
    for (let i = 0; i < n; i++) {
      const x = V[i * 3] * s, y = V[i * 3 + 1] * s, z = V[i * 3 + 2] * s;
      const X = a0 * x + a1 * y + a2 * z + tx;
      const Y = b0 * x + b1 * y + b2 * z + ty;
      const Z = c0 * x + c1 * y + c2 * z + tz;
      vx[i] = X; vy[i] = Y; vz[i] = Z;
      if (Z > 1) { const iz = focal / Z; sx[i] = cx + X * iz; sy2[i] = cy2 - Y * iz; }
      if (N) {
        const nx = N[i * 3], ny = N[i * 3 + 1], nz = N[i * 3 + 2];
        const wx = r[0] * nx + r[1] * ny + r[2] * nz;
        const wy = r[3] * nx + r[4] * ny + r[5] * nz;
        const wz = r[6] * nx + r[7] * ny + r[8] * nz;
        let d = wx * LIGHT[0] + wy * LIGHT[1] + wz * LIGHT[2];
        if (d < 0) d = -d * 0.32;
        /* daylight comes down through the water, so a face turned upwards
           catches some of it whichever way the key light is pointing */
        const sky = 0.5 + 0.5 * wy;
        li[i] = amb + (1 - amb) * (d * 0.68 + sky * 0.32);
      } else li[i] = 1;
      if (lampK > 0) li[i] += lampK / (1 + (X * X + Y * Y + Z * Z) / lampR2);
    }
    const tris = model.tris;
    for (let t = 0; t < tris.length; t++) {
      const T = tris[t];
      const ia = T.a, ib = T.b, ic = T.c;
      if (vz[ia] < 8 || vz[ib] < 8 || vz[ic] < 8) continue;
      const ax = sx[ia], ay = sy2[ia], bx = sx[ib], by = sy2[ib], cxp = sx[ic], cyp = sy2[ic];
      const area = (bx - ax) * (cyp - ay) - (by - ay) * (cxp - ax);
      if (area <= 0) continue;              /* backface */
      if ((ax < 0 && bx < 0 && cxp < 0) || (ax >= W && bx >= W && cxp >= W)) continue;
      if (!(isFinite(ax) && isFinite(bx) && isFinite(cxp))) continue;
      if ((ay < 0 && by < 0 && cyp < 0) || (ay >= H && by >= H && cyp >= H)) continue;
      raster(T, ia, ib, ic, tex, opts);
    }
  }
  const IDENT3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

  /* perspective correct scanline fill ------------------------------------- */
  function raster(T, ia, ib, ic, tex, opts) {
    let i0 = ia, i1 = ib, i2 = ic;
    let u0 = T.ua, v0 = T.va, u1 = T.ub, v1 = T.vb, u2 = T.uc, v2 = T.vc;
    /* sort by y */
    if (sy2[i0] > sy2[i1]) { let t = i0; i0 = i1; i1 = t; t = u0; u0 = u1; u1 = t; t = v0; v0 = v1; v1 = t; }
    if (sy2[i1] > sy2[i2]) { let t = i1; i1 = i2; i2 = t; t = u1; u1 = u2; u2 = t; t = v1; v1 = v2; v2 = t; }
    if (sy2[i0] > sy2[i1]) { let t = i0; i0 = i1; i1 = t; t = u0; u0 = u1; u1 = t; t = v0; v0 = v1; v1 = t; }

    const y0 = sy2[i0], y1 = sy2[i1], y2 = sy2[i2];
    if (y2 - y0 < 0.0001) return;          /* horizontal sliver: nothing to fill */
    let yStart = Math.max(0, Math.ceil(y0)), yEnd = Math.min(H - 1, Math.floor(y2));
    if (yStart > yEnd) return;

    const x0 = sx[i0], x1 = sx[i1], x2 = sx[i2];
    const w0 = 1 / vz[i0], w1 = 1 / vz[i1], w2 = 1 / vz[i2];
    const uu0 = u0 * w0, vv0 = v0 * w0, uu1 = u1 * w1, vv1 = v1 * w1, uu2 = u2 * w2, vv2 = v2 * w2;
    const l0 = li[i0] * w0, l1 = li[i1] * w1, l2 = li[i2] * w2;

    const dy02 = y2 - y0 || 1e-6, dy01 = y1 - y0 || 1e-6, dy12 = y2 - y1 || 1e-6;
    const texW = tex ? tex.w : 0, texH = tex ? tex.h : 0, td = tex ? tex.data : null;
    const mw = texW - 1, mh = texH - 1;
    /* 0 opaque, 1 black cut out, 2 black cut out and added as light */
    const mode = opts.additive ? 2 : (T.blend | 0);
    const additive = mode === 2;
    const keyed = mode !== 0;
    const tint = opts.tint;
    const noFog = !!opts.noFog;
    const alphaMul = opts.alpha === undefined ? 1 : opts.alpha;
    const flat = opts.flatColour;
    /* Solid surfaces are sampled bilinearly.  The atlases pack many sprites
       side by side, so the four taps are clamped to the polygon's own texel
       box - it smooths the surface without ever fetching a neighbour's art.
       Cut-outs and glows stay on nearest: filtering a keyed edge would drag
       the key colour into the picture. */
    const smooth = filter && mode === 0 && td && !flat;
    let bu0 = 0, bu1 = 0, bv0 = 0, bv1 = 0;
    if (smooth) {
      if (T.bu0 === undefined) {
        const a1 = Math.min(T.ua, T.ub, T.uc), a2 = Math.max(T.ua, T.ub, T.uc);
        const b1 = Math.min(T.va, T.vb, T.vc), b2 = Math.max(T.va, T.vb, T.vc);
        T.bu0 = Math.floor(a1); T.bu1 = Math.max(T.bu0, Math.ceil(a2) - 1);
        T.bv0 = Math.floor(b1); T.bv1 = Math.max(T.bv0, Math.ceil(b2) - 1);
      }
      bu0 = T.bu0; bu1 = T.bu1; bv0 = T.bv0; bv1 = T.bv1;
    }

    for (let y = yStart; y <= yEnd; y++) {
      const ty = (y + 0.5);
      let xa, xb, wa, wb, ua, ub, va, vb, la, lb;
      let t02 = (ty - y0) / dy02;
      t02 = t02 < 0 ? 0 : t02 > 1 ? 1 : t02;
      xa = x0 + (x2 - x0) * t02; wa = w0 + (w2 - w0) * t02;
      ua = uu0 + (uu2 - uu0) * t02; va = vv0 + (vv2 - vv0) * t02; la = l0 + (l2 - l0) * t02;
      if (ty < y1) {
        let t = (ty - y0) / dy01; t = t < 0 ? 0 : t > 1 ? 1 : t;
        xb = x0 + (x1 - x0) * t; wb = w0 + (w1 - w0) * t;
        ub = uu0 + (uu1 - uu0) * t; vb = vv0 + (vv1 - vv0) * t; lb = l0 + (l1 - l0) * t;
      } else {
        let t = (ty - y1) / dy12; t = t < 0 ? 0 : t > 1 ? 1 : t;
        xb = x1 + (x2 - x1) * t; wb = w1 + (w2 - w1) * t;
        ub = uu1 + (uu2 - uu1) * t; vb = vv1 + (vv2 - vv1) * t; lb = l1 + (l2 - l1) * t;
      }
      if (xa > xb) {
        let t = xa; xa = xb; xb = t; t = wa; wa = wb; wb = t;
        t = ua; ua = ub; ub = t; t = va; va = vb; vb = t; t = la; la = lb; lb = t;
      }
      let xs = Math.max(0, Math.ceil(xa)), xe = Math.min(W - 1, Math.floor(xb));
      if (xs > xe) continue;
      const dx = (xb - xa) || 1e-6;
      const dw = (wb - wa) / dx, du = (ub - ua) / dx, dv = (vb - va) / dx, dl = (lb - la) / dx;
      const off = xs - xa;
      let w = wa + dw * off, u = ua + du * off, v = va + dv * off, l = la + dl * off;
      let idx = y * W + xs;
      for (let x = xs; x <= xe; x++, idx++, w += dw, u += du, v += dv, l += dl) {
        const z = 1 / w;
        if (z >= zbuf[idx]) continue;
        let r, g, b;
        if (flat) { r = flat[0]; g = flat[1]; b = flat[2]; }
        else if (smooth) {
          const fu = u * z - 0.5, fv = v * z - 0.5;
          const iu = Math.floor(fu), iv = Math.floor(fv);
          const au = fu - iu, av = fv - iv;
          let ua2 = iu < bu0 ? bu0 : iu > bu1 ? bu1 : iu;
          let ub2 = iu + 1 < bu0 ? bu0 : iu + 1 > bu1 ? bu1 : iu + 1;
          let va2 = iv < bv0 ? bv0 : iv > bv1 ? bv1 : iv;
          let vb2 = iv + 1 < bv0 ? bv0 : iv + 1 > bv1 ? bv1 : iv + 1;
          ua2 &= mw; ub2 &= mw;
          va2 = (va2 & mh) * texW; vb2 = (vb2 & mh) * texW;
          const pa = (va2 + ua2) << 2, pb = (va2 + ub2) << 2;
          const pc = (vb2 + ua2) << 2, pd = (vb2 + ub2) << 2;
          const k11 = au * av, k01 = (1 - au) * av, k10 = au * (1 - av), k00 = (1 - au) * (1 - av);
          r = td[pa] * k00 + td[pb] * k10 + td[pc] * k01 + td[pd] * k11;
          g = td[pa + 1] * k00 + td[pb + 1] * k10 + td[pc + 1] * k01 + td[pd + 1] * k11;
          b = td[pa + 2] * k00 + td[pb + 2] * k10 + td[pc + 2] * k01 + td[pd + 2] * k11;
        }
        else {
          const tu = (u * z) | 0, tv = (v * z) | 0;
          const p = (((tv & (texH - 1)) * texW) + (tu & (texW - 1))) << 2;
          /* cut-outs drop palette index 0, glows drop black; opaque
             polygons keep both, since index 0 is a white highlight there */
          if (mode === 1 && td[p + 3] === 0) continue;
          r = td[p]; g = td[p + 1]; b = td[p + 2];
          if (keyed && r + g + b <= KEY) continue;
          /* cut-out cells are anti-aliased against their white surround, so
             drop what is left of it too */
          if (mode === 1 && r >= 236 && g >= 236 && b >= 236) continue;
        }
        if (additive) {
          /* emissive: not shaded, and fog thins the light instead of
             tinting it, so no black halo is left around the source */
          if (tint) { r = r * tint[0]; g = g * tint[1]; b = b * tint[2]; }
          let k = alphaMul;
          if (!noFog) {
            let f = (z - fogNear) / (fogFar - fogNear);
            if (f > 0) k *= (f > 1 ? 0 : 1 - f);
          }
          if (k <= 0) continue;
          const o = buf32[idx];
          r = (o & 255) + r * k;
          g = ((o >> 8) & 255) + g * k;
          b = ((o >> 16) & 255) + b * k;
        } else {
          let lum = l * z;
          /* a low ceiling: the lamp is there to lift what the key light misses,
             not to blow the highlights out of a hull that is already pale */
          if (lum < 0) lum = 0; else if (lum > 1.15) lum = 1.15;
          r = r * lum; g = g * lum; b = b * lum;
          if (tint) { r = r * tint[0]; g = g * tint[1]; b = b * tint[2]; }
          if (!noFog) {
            let f = (z - fogNear) / (fogFar - fogNear);
            if (f > 0) {
              if (f > 1) f = 1;
              r += (fogR - r) * f; g += (fogG - g) * f; b += (fogB - b) * f;
            }
          }
          if (alphaMul < 1) {
            const o = buf32[idx];
            const orr = o & 255, ogg = (o >> 8) & 255, obb = (o >> 16) & 255;
            r = orr + (r - orr) * alphaMul; g = ogg + (g - ogg) * alphaMul; b = obb + (b - obb) * alphaMul;
          } else zbuf[idx] = z;
        }
        buf32[idx] = 0xff000000 | ((b > 255 ? 255 : b) << 16) | ((g > 255 ? 255 : g) << 8) | (r > 255 ? 255 : r);
      }
    }
  }

  /* point sprite / particle ---------------------------------------------
     Bubbles, marine snow and sparks used to be flat squares of solid colour.
     They are now round, soft edged and blended over what is behind them, so
     at the resolutions a modern display asks for they read as motes in the
     beam rather than as chunks of confetti. */
  function point(wx, wy, wz, size, r, g, b, fade) {
    const m = camM;
    const X = m[0] * wx + m[1] * wy + m[2] * wz + m[3];
    const Y = m[4] * wx + m[5] * wy + m[6] * wz + m[7];
    const Z = m[8] * wx + m[9] * wy + m[10] * wz + m[11];
    if (Z < 8) return;
    const iz = focal / Z;
    const cxp = W / 2 + X * iz, cyp = H / 2 - Y * iz;
    let s = size * iz;
    if (s < 1) s = 1; else if (s > 64) s = 64;
    let f = 1;
    if (fade !== false) {
      f = 1 - (Z - fogNear) / (fogFar - fogNear);
      if (f <= 0) return; if (f > 1) f = 1;
    }
    const rad = s * 0.5, inv = 1 / (rad * rad);
    const x0 = Math.max(0, Math.floor(cxp - rad)), x1 = Math.min(W - 1, Math.ceil(cxp + rad));
    const y0 = Math.max(0, Math.floor(cyp - rad)), y1 = Math.min(H - 1, Math.ceil(cyp + rad));
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - cyp;
      let idx = y * W + x0;
      for (let x = x0; x <= x1; x++, idx++) {
        const dx = x + 0.5 - cxp;
        const q = (dx * dx + dy * dy) * inv;
        if (q >= 1) continue;
        if (Z >= zbuf[idx]) continue;
        /* solid core, falling away to nothing at the rim */
        let k = f * (1 - q * q);
        if (k <= 0.004) continue;
        if (k > 1) k = 1;
        const o = buf32[idx];
        const or2 = o & 255, og = (o >> 8) & 255, ob = (o >> 16) & 255;
        const rr = or2 + (r - or2) * k, gg = og + (g - og) * k, bb = ob + (b - ob) * k;
        buf32[idx] = 0xff000000 | ((bb | 0) << 16) | ((gg | 0) << 8) | (rr | 0);
      }
    }
  }

  function project(wx, wy, wz) {
    const m = camM;
    const X = m[0] * wx + m[1] * wy + m[2] * wz + m[3];
    const Y = m[4] * wx + m[5] * wy + m[6] * wz + m[7];
    const Z = m[8] * wx + m[9] * wy + m[10] * wz + m[11];
    if (Z < 1) return null;
    const iz = focal / Z;
    return { x: W / 2 + X * iz, y: H / 2 - Y * iz, z: Z };
  }

  /* Hand the rasteriser's buffer to the display.  This is the boundary
     between the two layers: everything 3D has been drawn by now, everything
     2D is drawn after it, straight onto the canvas at device resolution.
     The copy has to escape whatever region is live - it always covers the
     whole display - so the context is unwound and re-applied around it. */
  function flush() {
    sctx.putImageData(img, 0, 0);
    const r = region;
    while (held > 0) { ctx.restore(); held--; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    /* an exact NxN block copy - the only scaling in the whole pipeline */
    ctx.drawImage(surface, 0, 0, W, H, 0, 0, W * upscale, H * upscale);
    region = r;
    sync();
  }
  function context() { return ctx; }
  function present() { }

  return {
    init, resize, screenScale, screenLayout, context, flush, present, clear3D, clearTo, clearGradient, setCamera, setFog, fogColour,
    drawModel, point, project, rotMatrix,
    pushPage, pushFull, pop, pageRect, setFilter, setLamp,
    get W() { return W; }, get H() { return H; },
    get zbuf() { return zbuf; }, get buf32() { return buf32; }
  };
})();
