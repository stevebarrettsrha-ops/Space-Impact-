/* ============================================================================
   Mascot Capsule Micro3D v3 loader  (MBAC geometry + MTRA animation)
   ----------------------------------------------------------------------------
   Deep 3D ships its models in HI CORP's MBAC container.  Format version 5 with
   vertexFormat 2 (bit packed vertex blocks), normalFormat 2 (7/7/1 packed unit
   normals) and polygonFormat 3 (bit packed indices + 8 bit texel coordinates).
   Everything below follows that layout exactly, so the meshes you see in game
   are the original artists' meshes, triangle for triangle.
   ========================================================================== */
'use strict';

const Micro3D = (() => {

  const SIZES = [8, 10, 13, 16];
  const POOL = [0, 0, 4096, 0, 0, -4096, 0, 0];

  class Reader {
    constructor(d) { this.d = d; this.pos = 0; this.cache = 0; this.cached = 0; }
    u8() { return this.d[this.pos++]; }
    u16() { const v = this.d[this.pos] | (this.d[this.pos + 1] << 8); this.pos += 2; return v; }
    s16() { const v = this.u16(); return v & 0x8000 ? v - 65536 : v; }
    ubits(n) {
      while (n > this.cached) { this.cache |= this.d[this.pos++] << this.cached; this.cached += 8; }
      const r = this.cache & ((1 << n) - 1);
      this.cached -= n; this.cache >>>= n;
      return r;
    }
    sbits(n) { const v = this.ubits(n); return v & (1 << (n - 1)) ? v - (1 << n) : v; }
    clear() { this.cache = 0; this.cached = 0; }
    left() { return this.d.length - this.pos; }
  }

  /* material flag bits, as used by the Micro3D renderer */
  const M_TRANSPARENT = 0x01, M_LIGHT = 0x20, M_SPECULAR = 0x40;

  function loadMBAC(d) {
    const r = new Reader(d);
    if (r.u8() !== 0x4d || r.u8() !== 0x42) throw new Error('not MBAC');
    const version = r.u8();
    if (r.u8() !== 0 || version < 2 || version > 5) throw new Error('MBAC v' + version);

    let vf = 1, nf = 0, pf = 1;
    if (version > 3) { vf = r.u8(); nf = r.u8(); pf = r.u8(); r.u8(); }

    const numVerts = r.u16(), numT3 = r.u16(), numT4 = r.u16(), numBones = r.u16();
    let numC3 = 0, numC4 = 0, numTex = 1, numPat = 1, numCol = 0;
    if (pf >= 3) {
      numC3 = r.u16(); numC4 = r.u16(); numTex = r.u16(); numPat = r.u16(); numCol = r.u16();
    }
    const patterns = [];
    if (version === 5) {
      for (let i = 0; i < numPat; i++) {
        const pat = [[r.u16(), r.u16()]];
        for (let j = 0; j < numTex; j++) pat.push([r.u16(), r.u16()]);
        patterns.push(pat);
      }
    } else patterns.push([[numC3, numC4], [numT3, numT4]]);

    /* vertices ------------------------------------------------------------ */
    const verts = new Int16Array(numVerts * 3);
    if (vf === 1) { for (let i = 0; i < numVerts * 3; i++) verts[i] = r.s16(); }
    else {
      let got = 0;
      while (got < numVerts) {
        const chunk = r.ubits(8), size = SIZES[chunk >> 6], count = (chunk & 0x3f) + 1;
        for (let i = 0; i < count; i++) {
          verts[got * 3] = r.sbits(size);
          verts[got * 3 + 1] = r.sbits(size);
          verts[got * 3 + 2] = r.sbits(size);
          got++;
        }
      }
    }
    r.clear();

    /* normals ------------------------------------------------------------- */
    let norms = null;
    if (nf === 1) {
      norms = new Int16Array(numVerts * 3);
      for (let i = 0; i < numVerts * 3; i++) norms[i] = r.s16();
    } else if (nf === 2) {
      norms = new Int16Array(numVerts * 3);
      for (let i = 0; i < numVerts; i++) {
        let x = r.ubits(7), y, z;
        if (x === 64) {
          let t = r.ubits(3);
          z = POOL[t]; y = POOL[t + 1]; x = POOL[t + 2];
        } else {
          x = (x > 64 ? x - 128 : x) * 64;
          const yy = r.ubits(7);
          y = (yy > 64 ? yy - 128 : yy) * 64;
          const sign = r.ubits(1);
          const dq = 4096 * 4096 - x * x - y * y;
          z = dq > 0 ? Math.round(Math.sqrt(dq)) : 0;
          if (sign) z = -z;
        }
        norms[i * 3] = x; norms[i * 3 + 1] = y; norms[i * 3 + 2] = z;
      }
      r.clear();
    }

    /* polygons ------------------------------------------------------------ */
    const tris = [];
    if (numC3 + numC4 > 0) throw new Error('coloured polygons unsupported');
    if (numT3 + numT4 > 0) {
      const matBits = r.ubits(8), idxBits = r.ubits(8), uvBits = r.ubits(8); r.ubits(8);
      const groups = [[numT3, 3], [numT4, 4]];
      for (const [count, k] of groups) {
        for (let i = 0; i < count; i++) {
          const mat = matBits ? r.ubits(matBits) : 0;
          const idx = [];
          for (let j = 0; j < k; j++) idx.push(r.ubits(idxBits));
          const uv = [];
          for (let j = 0; j < k; j++) uv.push(r.ubits(uvBits), r.ubits(uvBits));
          if (k === 3) {
            tris.push({ m: mat, a: idx[0], b: idx[1], c: idx[2],
                        ua: uv[0], va: uv[1], ub: uv[2], vb: uv[3], uc: uv[4], vc: uv[5] });
          } else {
            tris.push({ m: mat, a: idx[0], b: idx[1], c: idx[2],
                        ua: uv[0], va: uv[1], ub: uv[2], vb: uv[3], uc: uv[4], vc: uv[5] });
            tris.push({ m: mat, a: idx[2], b: idx[1], c: idx[3],
                        ua: uv[4], va: uv[5], ub: uv[2], vb: uv[3], uc: uv[6], vc: uv[7] });
          }
        }
      }
      r.clear();
    }

    /* bones --------------------------------------------------------------- */
    const bones = [];
    let first = 0;
    for (let i = 0; i < numBones; i++) {
      const n = r.u16(), parent = r.s16(), m = new Float32Array(12);
      for (let j = 0; j < 12; j++) {
        const v = r.s16();
        m[j] = (j % 4 === 3) ? v : v / 4096;
      }
      bones.push({ first, count: n, parent, m });
      first += n;
    }

    return buildModel({ verts, norms, tris, bones, numVerts, numTex, patterns });
  }

  /* Flatten the bone hierarchy once: Deep's models are rigid apart from the
     animated ones, and pre-transforming makes the software rasteriser cheap. */
  function buildModel(src) {
    const { verts, norms, tris, bones, numVerts } = src;
    const V = new Float32Array(numVerts * 3);
    const N = norms ? new Float32Array(numVerts * 3) : null;
    const world = [];
    for (let i = 0; i < bones.length; i++) {
      const b = bones[i];
      world[i] = b.parent >= 0 && world[b.parent] ? mul(world[b.parent], b.m) : b.m;
    }
    for (let bi = 0; bi < bones.length; bi++) {
      const b = bones[bi], m = world[bi];
      for (let i = b.first; i < b.first + b.count; i++) {
        const x = verts[i * 3], y = verts[i * 3 + 1], z = verts[i * 3 + 2];
        V[i * 3]     = m[0] * x + m[1] * y + m[2] * z + m[3];
        V[i * 3 + 1] = m[4] * x + m[5] * y + m[6] * z + m[7];
        V[i * 3 + 2] = m[8] * x + m[9] * y + m[10] * z + m[11];
        if (N) {
          const nx = norms[i * 3], ny = norms[i * 3 + 1], nz = norms[i * 3 + 2];
          N[i * 3]     = m[0] * nx + m[1] * ny + m[2] * nz;
          N[i * 3 + 1] = m[4] * nx + m[5] * ny + m[6] * nz;
          N[i * 3 + 2] = m[8] * nx + m[9] * ny + m[10] * nz;
        }
      }
    }
    /* normalise scale to roughly unit radius, keep the factor for sizing */
    let r2 = 1;
    for (let i = 0; i < numVerts; i++) {
      const d = V[i * 3] ** 2 + V[i * 3 + 1] ** 2 + V[i * 3 + 2] ** 2;
      if (d > r2) r2 = d;
    }
    const radius = Math.sqrt(r2);
    const bbox = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let i = 0; i < numVerts; i++) {
      for (let k = 0; k < 3; k++) {
        bbox[k] = Math.min(bbox[k], V[i * 3 + k]);
        bbox[k + 3] = Math.max(bbox[k + 3], V[i * 3 + k]);
      }
    }
    if (N) {
      for (let i = 0; i < numVerts; i++) {
        const x = N[i * 3], y = N[i * 3 + 1], z = N[i * 3 + 2];
        const l = Math.hypot(x, y, z) || 1;
        N[i * 3] = x / l; N[i * 3 + 1] = y / l; N[i * 3 + 2] = z / l;
      }
    }
    return { V, N, tris, radius, bbox, count: numVerts };
  }

  function mul(a, b) {
    const o = new Float32Array(12);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
      o[r * 4 + c] = a[r * 4] * b[c] + a[r * 4 + 1] * b[4 + c] + a[r * 4 + 2] * b[8 + c] +
                     (c === 3 ? a[r * 4 + 3] : 0);
    }
    return o;
  }

  return { loadMBAC, M_TRANSPARENT, M_LIGHT, M_SPECULAR };
})();
