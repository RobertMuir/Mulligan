import type { Session } from '../session.js';

export interface Command {
  name: string;
  aliases?: string[];
  summary: string;
  usage?: string;
  run(session: Session, args: string): Promise<void>;
}

export interface FlagSpec {
  /** Flags that take a value (`--base main`). Every other flag is a switch. */
  values?: string[];
  /** Flags that take a value only when the next word is a number (`--fanout 4`). */
  numbers?: string[];
}

export interface ParsedFlags {
  flags: Record<string, string | true>;
  /** Every value given for a repeatable flag (`--scope a --scope b`). */
  multi: Record<string, string[]>;
  rest: string;
}

const unquote = (s: string): string => s.replace(/^['"]|['"]$/g, '');

/** Separates `--flag`, `--flag value` and `--flag=value` from the positional text. */
export function parseFlags(args: string, spec: FlagSpec = {}): ParsedFlags {
  const flags: ParsedFlags['flags'] = {};
  const multi: ParsedFlags['multi'] = {};
  const rest: string[] = [];
  const tokens = args.match(/(?:"[^"]*"|'[^']*'|\S)+/g) ?? [];
  const record = (name: string, value: string | true): void => {
    flags[name] = value;
    if (typeof value === 'string') multi[name] = [...(multi[name] ?? []), value];
  };
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i] ?? '';
    const [, name, inline] = /^--([\w-]+)(?:=(.*))?$/.exec(token) ?? [];
    if (!name) {
      rest.push(token);
      continue;
    }
    if (inline !== undefined) {
      record(name, unquote(inline));
      continue;
    }
    const next = tokens[i + 1];
    const takesValue = spec.values?.includes(name) || (spec.numbers?.includes(name) && next !== undefined && /^\d+$/.test(next));
    if (takesValue && next !== undefined && !next.startsWith('--')) {
      record(name, unquote(next));
      i++;
    } else {
      record(name, true);
    }
  }
  return { flags, multi, rest: rest.join(' ') };
}
