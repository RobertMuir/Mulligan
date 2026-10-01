import readline from 'node:readline/promises';
import { bold, dim, green } from '@mulligan/mascot';

export interface Io {
  readonly interactive: boolean;
  print(text?: string): void;
  ask(question: string, fallback?: string): Promise<string>;
  confirm(question: string, defaultYes?: boolean): Promise<boolean>;
  choose<T extends string>(question: string, options: { key: string; label: string; value: T }[], fallback: T): Promise<T>;
  /** Collects lines until an empty line. */
  askMany(question: string): Promise<string[]>;
  close(): void;
}

export function createIo(): Io {
  const interactive = Boolean(process.stdin.isTTY);
  let rl: readline.Interface | undefined;
  const iface = (): readline.Interface => (rl ??= readline.createInterface({ input: process.stdin, output: process.stdout }));

  const io: Io = {
    interactive,
    print(text = '') {
      process.stdout.write(`${text}\n`);
    },
    async ask(question, fallback = '') {
      if (!interactive) return fallback;
      const answer = (await iface().question(`${green('›')} ${question} `)).trim();
      return answer || fallback;
    },
    async confirm(question, defaultYes = false) {
      if (!interactive) return false;
      const answer = (await iface().question(`${green('›')} ${question} ${dim(defaultYes ? '[Y/n]' : '[y/N]')} `)).trim().toLowerCase();
      return answer === '' ? defaultYes : answer === 'y' || answer === 'yes';
    },
    async choose(question, options, fallback) {
      if (!interactive) return fallback;
      io.print(bold(question));
      for (const o of options) io.print(`  ${green(`[${o.key}]`)} ${o.label}`);
      for (;;) {
        const answer = (await iface().question(`${green('›')} `)).trim().toLowerCase();
        const match = options.find((o) => o.key.toLowerCase() === answer || o.label.toLowerCase() === answer);
        if (match) return match.value;
        if (answer === '') return fallback;
        io.print(dim(`Choose one of: ${options.map((o) => o.key).join(', ')}`));
      }
    },
    async askMany(question) {
      if (!interactive) return [];
      io.print(`${bold(question)} ${dim('(blank line to finish)')}`);
      const lines: string[] = [];
      for (;;) {
        const line = (await iface().question(`${green('·')} `)).trim();
        if (!line) return lines;
        lines.push(line);
      }
    },
    close() {
      rl?.close();
      rl = undefined;
    },
  };
  return io;
}

export function heading(text: string): string {
  return bold(green(text));
}
