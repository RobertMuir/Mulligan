import { MASCOT_HEIGHT, MASCOT_WIDTH, pixelColour } from './pixels.js';
import { BRAND } from './tokens.js';

function rgb(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255};${(n >> 8) & 255};${n & 255}`;
}

const colourEnabled = (): boolean => Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;

export function paint(hex: string, text: string): string {
  return colourEnabled() ? `\x1b[38;2;${rgb(hex)}m${text}\x1b[39m` : text;
}

export const green = (text: string): string => paint(BRAND.green, text);
export const bold = (text: string): string => (colourEnabled() ? `\x1b[1m${text}\x1b[22m` : text);
export const dim = (text: string): string => (colourEnabled() ? `\x1b[2m${text}\x1b[22m` : text);

/**
 * The 8-bit mascot for the terminal. Each character cell shows two pixels
 * stacked (upper half block: foreground = top pixel, background = bottom),
 * so the CLI draws exactly the same grid as the logo.
 */
export function mascotLines(options: { colour?: boolean } = {}): string[] {
  const colour = options.colour ?? colourEnabled();
  const lines: string[] = [];
  for (let y = 0; y < MASCOT_HEIGHT; y += 2) {
    let line = '';
    for (let x = 0; x < MASCOT_WIDTH; x++) {
      line += cell(pixelColour(x, y), pixelColour(x, y + 1), colour);
    }
    lines.push(line.replace(/\s+$/, ''));
  }
  return lines;
}

/** One character cell showing two stacked pixels. */
function cell(top: string | undefined, bottom: string | undefined, colour: boolean): string {
  if (!colour) return top && bottom ? '█' : top ? '▀' : bottom ? '▄' : ' ';
  if (top && bottom) return `\x1b[38;2;${rgb(top)}m\x1b[48;2;${rgb(bottom)}m▀\x1b[0m`;
  if (top) return `\x1b[38;2;${rgb(top)}m▀\x1b[0m`;
  if (bottom) return `\x1b[38;2;${rgb(bottom)}m▄\x1b[0m`;
  return ' ';
}

/** Printed width of a string, ignoring colour codes. */
const visible = (s: string): number => s.replace(/\x1b\[[0-9;]*m/g, '').length;

export function box(lines: string[], width = 46): string {
  const top = green(`╭${'─'.repeat(width)}╮`);
  const bottom = green(`╰${'─'.repeat(width)}╯`);
  const body = lines.map((line) => `${green('│')}  ${line}${' '.repeat(Math.max(0, width - 2 - visible(line)))}${green('│')}`);
  return [top, ...body, bottom].join('\n');
}

/** Mascot beside a box, as one block of text. */
export function besideMascot(boxText: string): string {
  const art = mascotLines();
  const right = boxText.split('\n');
  const height = Math.max(art.length, right.length);
  const offset = Math.max(0, Math.floor((right.length - art.length) / 2));
  const out: string[] = [];
  for (let i = 0; i < height; i++) {
    const a = art[i - offset] ?? '';
    out.push(`${a}${' '.repeat(Math.max(0, MASCOT_WIDTH - visible(a)))}  ${right[i] ?? ''}`);
  }
  return out.join('\n');
}
