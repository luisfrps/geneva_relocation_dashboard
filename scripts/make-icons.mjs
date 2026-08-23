/* Gera icon-192.png e icon-512.png sem dependencias (node scripts/make-icons.mjs).
   PNG cru: assinatura + IHDR + IDAT (zlib) + IEND. Desenho: fundo do painel,
   dois picos e um sol, dentro dos 80% centrais para aguentar mascaras redondas. */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..');

const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function png(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // colour type: RGBA
  const stride = w * 4 + 1;
  const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0; // filter: none
    rgba.copy(raw, y * stride + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

function draw(s) {
  const px = Buffer.alloc(s * s * 4);
  const set = (x, y, c) => {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= s || y >= s) return;
    const i = (y * s + x) * 4;
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255;
  };
  const BG = [13, 28, 47], SUN = [255, 202, 104], FAR = [104, 225, 215], NEAR = [78, 168, 245];

  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) set(x, y, BG);

  // sol
  const cx = s * 0.70, cy = s * 0.27, r = s * 0.075;
  for (let y = cy - r - 1; y <= cy + r + 1; y++)
    for (let x = cx - r - 1; x <= cx + r + 1; x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) set(x, y, SUN);

  // picos: apex, meia-largura na base, cor
  const base = s * 0.74;
  const peak = (ax, ay, halfW, col) => {
    for (let y = ay; y <= base; y++) {
      const t = (y - ay) / (base - ay);
      const half = halfW * t;
      for (let x = ax - half; x <= ax + half; x++) set(x, y, col);
    }
  };
  peak(s * 0.63, s * 0.40, s * 0.20, FAR);
  peak(s * 0.40, s * 0.28, s * 0.25, NEAR);

  return png(s, s, px);
}

mkdirSync(OUT, { recursive: true });
for (const size of [192, 512]) {
  const file = join(OUT, `icon-${size}.png`);
  writeFileSync(file, draw(size));
  console.log('wrote', file);
}
