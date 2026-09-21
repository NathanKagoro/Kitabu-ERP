#!/usr/bin/env node
/**
 * Generates the PWA icons as real PNGs, with no image dependency.
 *
 * These are placeholders in the sense that a designer should replace the mark,
 * but not in the sense of being broken: they are correctly sized, maskable-safe
 * (the glyph sits inside the 80% safe zone) and installable today.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = join(root, 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const BRAND = [0x0f, 0x6b, 0x3f];
const PAPER = [0xff, 0xff, 0xff];

/** Block-letter H on a 10x10 grid, centred in the maskable safe zone. */
const GLYPH = [
  '..........',
  '..........',
  '..##..##..',
  '..##..##..',
  '..######..',
  '..######..',
  '..##..##..',
  '..##..##..',
  '..........',
  '..........',
];

function render(size) {
  const pixels = Buffer.alloc(size * size * 3);
  const cell = size / 10;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const gx = Math.min(9, Math.floor(x / cell));
      const gy = Math.min(9, Math.floor(y / cell));
      const on = GLYPH[gy][gx] === '#';
      const colour = on ? PAPER : BRAND;
      const offset = (y * size + x) * 3;
      pixels[offset] = colour[0];
      pixels[offset + 1] = colour[1];
      pixels[offset + 2] = colour[2];
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
