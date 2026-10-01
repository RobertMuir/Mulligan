// Regenerates every logo file from the one pixel grid in @mulligan/mascot.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mascotPng, mascotSvg } from '@mulligan/mascot';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputs: [string, string | Buffer][] = [
  ['packages/mascot/assets/mulligan-mascot.svg', mascotSvg({ scale: 10 })],
  ['assets/logo.svg', mascotSvg({ scale: 10 })],
  ['assets/logo.png', mascotPng(16)],
];

for (const [rel, data] of outputs) {
  const file = path.join(root, rel);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, data);
  console.log(`wrote ${rel}`);
}
