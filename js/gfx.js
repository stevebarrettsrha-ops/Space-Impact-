/* ============================================================================
   Software renderer: bitmap font, sprite blitting and a perspective correct
   z-buffered triangle rasteriser with depth fog.  The internal framebuffer is
   240x320 - the resolution Deep 3D was authored for - and is scaled up with
   nearest neighbour so the original pixel art stays crisp.
   ========================================================================== */
'use strict';

const SCR_W = 240, SCR_H = 320;

const Gfx = (() => {
  let canvas, ctx, img, buf32, zbuf, W = SCR_W, H = SCR_H;
  let scale = 2;

  function init(cv) {
    canvas = cv;
    canvas.width = W; canvas.height = H;
    ctx = canvas.getContext('2d', { alpha: false });
    ctx.imageSmoothingEnabled = false;
    img = ctx.createImageData(W, H);
    buf32 = new Uint32Array(img.data.buffer);
    zbuf = new Float32Array(W * H);
    resize();
    window.addEventListener('resize', resize);
  }
  function resize() {
    const pad = 8;
    const s = Math.max(1, Math.min((window.innerWidth - pad) / W, (window.innerHeight - pad) / H));
    scale = s;
    canvas.style.width = Math.floor(W * s) + 'px';
    canvas.style.height = Math.floor(H * s) + 'px';
  }
  function screenScale() { return scale; }

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
  function clearTo(r, g, b) {
    buf32.fill((255 << 24) | (b << 16) | (g << 8) | r);
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
    const amb = opts.ambient === undefined ? 0.5 : opts.ambient;
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
        li[i] = amb + (1 - amb) * d;
      } else li[i] = 1;
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
    /* 0 opaque, 1 black cut out, 2 black cut out and added as light */
    const mode = opts.additive ? 2 : (T.blend | 0);
    const additive = mode === 2;
    const keyed = mode !== 0;
    const tint = opts.tint;
    const noFog = !!opts.noFog;
    const alphaMul = opts.alpha === undefined ? 1 : opts.alpha;
    const flat = opts.flatColour;

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
          if (lum < 0) lum = 0; else if (lum > 1.9) lum = 1.9;
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

  /* point sprite / particle -------------------------------------------- */
  function point(wx, wy, wz, size, r, g, b, fade) {
    const m = camM;
    const X = m[0] * wx + m[1] * wy + m[2] * wz + m[3];
    const Y = m[4] * wx + m[5] * wy + m[6] * wz + m[7];
    const Z = m[8] * wx + m[9] * wy + m[10] * wz + m[11];
    if (Z < 8) return;
    const iz = focal / Z;
    const px = (W / 2 + X * iz) | 0, py = (H / 2 - Y * iz) | 0;
    let s = Math.max(1, (size * iz) | 0);
    if (s > 40) s = 40;
    let f = 1;
    if (fade !== false) {
      f = 1 - (Z - fogNear) / (fogFar - fogNear);
      if (f <= 0) return; if (f > 1) f = 1;
    }
    const rr = r * f + fogR * (1 - f), gg = g * f + fogG * (1 - f), bb = b * f + fogB * (1 - f);
    const col = 0xff000000 | (bb << 16) | (gg << 8) | rr;
    const h = s >> 1;
    for (let y = py - h; y <= py - h + s - 1; y++) {
      if (y < 0 || y >= H) continue;
      for (let x = px - h; x <= px - h + s - 1; x++) {
        if (x < 0 || x >= W) continue;
        const idx = y * W + x;
        if (Z < zbuf[idx]) buf32[idx] = col;
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

  function flush() { ctx.putImageData(img, 0, 0); }
  function context() { return ctx; }

  return {
    init, resize, screenScale, context, flush, clear3D, clearTo, clearGradient, setCamera, setFog, fogColour,
    drawModel, point, project, rotMatrix, W, H,
    get zbuf() { return zbuf; }, get buf32() { return buf32; }
  };
})();
