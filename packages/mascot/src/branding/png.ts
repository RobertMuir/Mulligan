import { deflateSync } from 'node:zlib';
import { MASCOT_HEIGHT, MASCOT_WIDTH, pixelColour } from './pixels.js';

/** CRC-32 as PNG requires it, bit by bit — the logo is a few kilobytes, so no lookup table is needed. */
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** A nearest-neighbour scaled RGBA PNG of the mascot, padded to a square. */
export function mascotPng(scale = 16, padding = 2): Buffer {
  const side = Math.max(MASCOT_WIDTH, MASCOT_HEIGHT) + padding * 2;
  const offX = Math.floor((side - MASCOT_WIDTH) / 2);
  const offY = Math.floor((side - MASCOT_HEIGHT) / 2);
  const size = side * scale;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let py = 0; py < size; py++) {
    const rowStart = py * (size * 4 + 1);
    raw[rowStart] = 0;
    for (let px = 0; px < size; px++) {
      const hex = pixelColour(Math.floor(px / scale) - offX, Math.floor(py / scale) - offY);
      if (!hex) continue;
      const i = rowStart + 1 + px * 4;
      raw[i] = Number.parseInt(hex.slice(1, 3), 16);
      raw[i + 1] = Number.parseInt(hex.slice(3, 5), 16);
      raw[i + 2] = Number.parseInt(hex.slice(5, 7), 16);
      raw[i + 3] = 255;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
