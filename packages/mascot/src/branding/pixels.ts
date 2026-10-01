import { BRAND } from './tokens.js';

/**
 * Mulligan, the 8-bit golf ball. This grid is the single source for the
 * logo SVG, the logo PNG and the terminal rendering, so every surface shows
 * the same character.
 *
 * K ink outline · W ball · D dimple · G Mulligan Green · L visor highlight ·
 * C cheek · S ground shadow · . transparent
 */
export const MASCOT_PIXELS: readonly string[] = [
  '........GGGGGGGG............',
  '......GGGLLLLGGGGG..........',
  '.KK..GGGGGGGGGGGGGGGGGG.....',
  'KWWK.KWWWWWWWWWDWWGGGGGG....',
  'KWWK.KWWWWWWWKKKWWK.KKKK....',
  '.KK.KWDKKKWWWWWWWWWK....KGGG',
  '..K.KWWWKWWWWKWWWWWK....KGG.',
  '...KKDWWKKWWWKKWWWDK....KG..',
  '....KWWWKKWWWKKWWWWK....K...',
  '....KWCCWWWWWWWWCCWK....K...',
  '....KWWWWKWWWWKWWWDKK...K...',
  '....KWWWWWKKKKWWWWWK.K.KK...',
  '.....KWDWWWWWWWWDWK...KWWK..',
  '.....KWWWWWWWDWWWWK...KWWK..',
  '......KWDWDWWWWWWK.....KK...',
  '.......KKWWWWWWKK.......K...',
  '.........KKKKKK.........K...',
  '.........K....K.........K...',
  '.........K....K.........K...',
  '.........K....K.........K...',
  '.......GGGG..GGGG.......K...',
  '.......KKKK..KKKK...........',
  '.....SSSSSSSSSSSSSS.........',
];

export const PIXEL_PALETTE: Readonly<Record<string, string | undefined>> = {
  '.': undefined,
  K: BRAND.ink,
  W: BRAND.white,
  D: '#C9D9D4',
  G: BRAND.green,
  L: '#2E9479',
  C: '#A8D5C6',
  S: '#DCE5E2',
};

export const MASCOT_WIDTH = Math.max(...MASCOT_PIXELS.map((row) => row.length));
export const MASCOT_HEIGHT = MASCOT_PIXELS.length;

export function pixelColour(x: number, y: number): string | undefined {
  return PIXEL_PALETTE[MASCOT_PIXELS[y]?.[x] ?? '.'];
}

/** Crisp-edged SVG; horizontal runs of one colour become one rect. */
export function mascotSvg(options: { scale?: number; padding?: number; title?: string } = {}): string {
  const scale = options.scale ?? 10;
  const pad = options.padding ?? 1;
  const w = (MASCOT_WIDTH + pad * 2) * scale;
  const h = (MASCOT_HEIGHT + pad * 2) * scale;
  const rects: string[] = [];
  MASCOT_PIXELS.forEach((row, y) => {
    // Each run of one repeated character becomes one rect.
    for (const run of row.matchAll(/(.)\1*/g)) {
      const fill = PIXEL_PALETTE[run[0].charAt(0)];
      const x = run.index ?? 0;
      if (fill) {
        rects.push(`<rect x="${(x + pad) * scale}" y="${(y + pad) * scale}" width="${run[0].length * scale}" height="${scale}" fill="${fill}"/>`);
      }
    }
  });
  const title = options.title ?? 'Mulligan';
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" shape-rendering="crispEdges" role="img" aria-label="${title}">`,
    `<title>${title}</title>`,
    ...rects,
    '</svg>',
    '',
  ].join('\n');
}
