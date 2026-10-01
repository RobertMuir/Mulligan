import path from 'node:path';
import { isTestFile } from '@mulligan/core';

/**
 * What a candidate proposes. Models are asked for complete file contents
 * (far more reliable than hand-written diffs); a unified diff is accepted as
 * a fallback. Mulligan generates the real diff itself with git.
 */
export interface ProposedChange {
  files: { path: string; content: string }[];
  diff?: string;
  approach: string;
  successCriteria: string;
  assumptions: string;
  tradeoffs: string;
  notVerified: string;
}

export const CHANGE_FORMAT = [
  'Answer in exactly this format:',
  '',
  'APPROACH: one paragraph — what you are doing and why this way.',
  'ASSUMPTIONS: what you assumed where the task is ambiguous.',
  'SUCCESS CRITERIA: the checks that prove it works.',
  '',
  'Then every file you create or change, each as a fenced block whose info string is "file:" plus the path from the project root,',
  'containing the COMPLETE new file contents:',
  '',
  '```file:src/example.ts',
  '…complete file…',
  '```',
  '',
  'TRADE-OFFS: what this approach gives up.',
  'NOT VERIFIED: what you could not check.',
].join('\n');

const LABELS = ['APPROACH', 'ASSUMPTIONS', 'SUCCESS CRITERIA', 'TRADE-OFFS', 'TRADEOFFS', 'NOT VERIFIED'];

function labelOf(line: string): { label: string; rest: string } | undefined {
  const clean = line.replace(/^[\s#*_]+/, '');
  for (const label of LABELS) {
    if (clean.toUpperCase().startsWith(`${label}:`) || clean.toUpperCase().startsWith(`${label}**:`)) {
      return { label: label === 'TRADEOFFS' ? 'TRADE-OFFS' : label, rest: clean.slice(clean.indexOf(':') + 1).trim() };
    }
  }
  return undefined;
}

/** Text after "LABEL:" up to the next label or code fence. */
function section(text: string, label: string): string {
  const out: string[] = [];
  let inside = false;
  let inFence = false;
  for (const line of text.split('\n')) {
    if (line.startsWith('```')) {
      inFence = !inFence;
      if (inside) break;
      continue;
    }
    if (inFence) continue;
    const found = labelOf(line);
    if (found) {
      if (inside) break;
      if (found.label === label) {
        inside = true;
        if (found.rest) out.push(found.rest);
      }
      continue;
    }
    if (inside) out.push(line);
  }
  return out.join('\n').trim();
}

export function parseChange(text: string): ProposedChange {
  const files: ProposedChange['files'] = [];
  const fileBlock = /```file:([^\n`]+)\n([\s\S]*?)```/g;
  for (const [, rawPath = '', body = ''] of text.matchAll(fileBlock)) {
    const p = rawPath.trim().replace(/\\/g, '/').replace(/^\.\//, '');
    files.push({ path: p, content: body.endsWith('\n') ? body : `${body}\n` });
  }
  const diff = /```(?:diff|patch)\s*\n([\s\S]*?)```/.exec(text)?.[1];
  return {
    files,
    ...(diff ? { diff: diff.endsWith('\n') ? diff : `${diff}\n` } : {}),
    approach: section(text, 'APPROACH') || (text.split('\n').find((l) => l.trim() && !l.startsWith('```')) ?? '').slice(0, 300),
    assumptions: section(text, 'ASSUMPTIONS'),
    successCriteria: section(text, 'SUCCESS CRITERIA'),
    tradeoffs: section(text, 'TRADE-OFFS'),
    notVerified: section(text, 'NOT VERIFIED'),
  };
}

/** Rejects paths that would escape the project. */
export function safeRelativePath(root: string, file: string): string | undefined {
  if (path.isAbsolute(file) || /^[A-Za-z]:/.test(file)) return undefined;
  const resolved = path.resolve(root, file);
  const rel = path.relative(root, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel) || rel.split(path.sep)[0] === '.git') return undefined;
  return rel.split(path.sep).join('/');
}

export interface DiffStats {
  files: string[];
  added: number;
  removed: number;
  testsTouched: boolean;
}

export function diffStats(diff: string): DiffStats {
  const files = new Set<string>();
  let added = 0;
  let removed = 0;
  for (const line of diff.split('\n')) {
    const f = /^\+\+\+ b\/(.+)$/.exec(line);
    if (f?.[1]) files.add(f[1]);
    else if (line.startsWith('+') && !line.startsWith('+++')) added++;
    else if (line.startsWith('-') && !line.startsWith('---')) removed++;
  }
  const list = [...files];
  return { files: list, added, removed, testsTouched: list.some(isTestFile) };
}
