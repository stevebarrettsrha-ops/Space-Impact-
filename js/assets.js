/* ============================================================================
   DEEP - Submarine Odyssey  :  asset pipeline
   ----------------------------------------------------------------------------
   Every resource that ships inside the original Deep 3D MIDlet is obfuscated:
   the loader swaps the first N bytes of a file with the mirrored last N bytes,
   where N depends on the file length.  Nothing else is altered, so undoing the
   swap in the browser restores the byte-exact original PNG / BMP / MBAC / MTRA.
   The repository files are therefore left completely untouched.
   ========================================================================== */
'use strict';

const Assets = (() => {

  /* --- the MIDlet's own obfuscation (see cv.class) ------------------------ */
  function swapCount(len) {
    if (len < 100) return 10 + len % 10;
    if (len < 200) return 50 + len % 20;
    if (len < 300) return 80 + len % 20;
    return 100 + len % 50;
  }
  function deobfuscate(buf) {
    const d = new Uint8Array(buf), len = d.length, n = swapCount(len);
    for (let i = 0; i < n; i++) {
      const j = len - i - 1, t = d[i];
      d[i] = d[j]; d[j] = t;
    }
    return d;
  }

  const cache = new Map();
  let pending = 0, done = 0, label = '';

  function progress() { return { done, total: Math.max(pending, 1), label }; }

  async function raw(path, obf = true) {
    if (cache.has(path)) return cache.get(path);
    pending++;
    const p = fetch(path).then(r => {
      if (!r.ok) throw new Error('missing asset: ' + path);
      return r.arrayBuffer();
    }).then(b => {
      done++; label = path;
      return obf ? deobfuscate(b) : new Uint8Array(b);
    });
    cache.set(path, p);
    return p;
  }

  /* --- images ------------------------------------------------------------- */
  const imgCache = new Map();
  async function image(path) {
    if (imgCache.has(path)) return imgCache.get(path);
    const p = raw(path).then(bytes => new Promise((res, rej) => {
      const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
      const im = new Image();
      im.onload = () => { URL.revokeObjectURL(url); res(im); };
      im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('bad png ' + path)); };
      im.src = url;
    }));
    imgCache.set(path, p);
    return p;
  }

  /* --- 8 bit palette BMP (the three Micro3D texture atlases) -------------- */
  function decodeBMP(d) {
    const dv = new DataView(d.buffer, d.byteOffset, d.byteLength);
    if (d[0] !== 0x42 || d[1] !== 0x4d) throw new Error('not a BMP');
    const rasterOffset = dv.getUint32(10, true);
    const dibSize = dv.getUint32(14, true);
    let w, h, reversed;
    if (dibSize === 12) {
      w = dv.getUint16(18, true); h = dv.getUint16(20, true); reversed = true;
    } else {
      w = dv.getInt32(18, true);
      const hh = dv.getInt32(22, true);
      reversed = hh > 0; h = Math.abs(hh);
    }
    const paletteOffset = 14 + dibSize;
    const stride = (w + 3) & ~3;
    const out = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      const srcRow = reversed ? (h - 1 - y) : y;
      let o = y * w * 4;
      for (let x = 0; x < w; x++) {
        const idx = d[rasterOffset + srcRow * stride + x];
        const p = paletteOffset + idx * 4;
        out[o++] = d[p + 2]; out[o++] = d[p + 1]; out[o++] = d[p];
        /* Two keying conventions live in these atlases: cut-out cells leave
           their surround on palette index 0, glow cells paint theirs pure
           black.  Both are recorded here - alpha 0 marks index 0 - and which
           one applies is decided per polygon (see Micro3D.classifyBlend). */
        out[o++] = idx === 0 ? 0 : 255;
      }
    }
    return { w, h, data: out };
  }
  async function texture(path) {
    const key = 'tex:' + path;
    if (imgCache.has(key)) return imgCache.get(key);
    const p = raw(path).then(decodeBMP);
    imgCache.set(key, p);
    return p;
  }

  /* --- language packs (Java DataOutputStream.writeUTF records) ------------ */
  async function lang(dir, name) {
    const d = await raw(dir + '/' + name, false);
    const dv = new DataView(d.buffer, d.byteOffset, d.byteLength);
    const dec = new TextDecoder('utf-8');
    const out = [];
    let i = 0;
    while (i < d.length) {
      const n = dv.getUint16(i, false); i += 2;
      out.push(dec.decode(d.subarray(i, i + n))); i += n;
    }
    return out;
  }

  /* --- plain text tables -------------------------------------------------- */
  async function text(path) {
    const d = await raw(path, false);
    return new TextDecoder('utf-8').decode(d);
  }

  return { raw, image, texture, lang, text, decodeBMP, deobfuscate, progress };
})();
