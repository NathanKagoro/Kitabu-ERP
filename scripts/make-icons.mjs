#!/usr/bin/env node
/**
 * Generates the PWA icons as real PNGs, with no image dependency.
 *
 * The mark is a ruled book -- the daftari every trader already keeps -- in the
 * app's own green and paper colours. Geometry is kept in a 24-unit space so it
 * matches components/brand/logo.tsx exactly; change one, change the other.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = join(root, 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const BRAND = [0x0f, 0x6b, 0x3f];
const SPINE = [0xc9, 0xc2, 0xb4]; // page edges, the line colour from the app
const PAPER = [0xfa, 0xf8, 0xf4];

/**
 * Rounded rectangles in a 24x24 space, painted in order: a closed book with its
 * spine to the left and three ruled lines. Later shapes cover earlier ones,
 * which is how the spine keeps round corners on the left and a straight edge
 * where the cover sits on top of it.
 */
const SHAPES = [
  { x: 4.4, y: 3.8, w: 6.4, h: 16.4, r: 1.8, colour: SPINE },
  { x: 7.6, y: 3.8, w: 12, h: 16.4, r: 1.8, colour: PAPER },
  { x: 10.2, y: 7.8, w: 6.6, h: 1.35, r: 0.67, colour: BRAND },
  { x: 10.2, y: 11.3, w: 6.6, h: 1.35, r: 0.67, colour: BRAND },
  { x: 10.2, y: 14.8, w: 4, h: 1.35, r: 0.67, colour: BRAND },
];

/** Inside a rounded rectangle? Corner circles, straight edges elsewhere. */
function inside(shape, x, y) {
  const { x: sx, y: sy, w, h, r } = shape;
  if (x < sx || x > sx + w || y < sy || y > sy + h) return false;
  const cx = Math.min(Math.max(x, sx + r), sx + w - r);
  const cy = Math.min(Math.max(y, sy + r), sy + h - r);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r + 1e-9;
}

const SAMPLES = 4; // supersampling, so edges are not jagged

function render(size) {
  const pixels = Buffer.alloc(size * size * 3);
  const scale = 24 / size;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const x = (px + (sx + 0.5) / SAMPLES) * scale;
          const y = (py + (sy + 0.5) / SAMPLES) * scale;
          let colour = BRAND;
          for (const shape of SHAPES) if (inside(shape, x, y)) colour = shape.colour;
          r += colour[0];
          g += colour[1];
          b += colour[2];
        }
      }
      const n = SAMPLES * SAMPLES;
      const offset = (py * size + px) * 3;
      pixels[offset] = Math.round(r / n);
      pixels[offset + 1] = Math.round(g / n);
      pixels[offset + 2] = Math.round(b / n);
    }
  }
  return pixels;
}

function png(size) {
  const raw = render(size);
  // PNG stores each row prefixed with a filter byte; 0 = no filter.
  const stride = size * 3;
  const scanlines = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    scanlines[y * (stride + 1)] = 0;
    raw.copy(scanlines, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(scanlines, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0, 0);
  return Buffer.concat([length, body, crc]);
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}

for (const size of [192, 512]) {
  writeFileSync(join(outDir, `icon-${size}.png`), png(size));
  console.log(`icons — wrote icon-${size}.png`);
}
