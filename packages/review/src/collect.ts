import {
  SOURCE_GLOBS,
  addedLinesByFile,
  changesSince,
  git,
  isGitRepo,
  readSourceFiles,
  walkProject,
  type SourceFile,
} from '@mulligan/core';
import type { ChangedFile } from '@mulligan/pr';

export interface ScopedLine {
  file: string;
  line: number;
  text: string;
}

export interface ReviewInput {
  mode: 'diff' | 'all';
  against?: string;
  files: SourceFile[];
  changed: ChangedFile[];
  /** Lines under review. In `all` mode every line is in scope. */
  scopeLines?: Map<string, Set<number>>;
  lines: ScopedLine[];
  /** Lines the change deleted (diff mode only). */
  removed: { file: string; text: string }[];
  /** Per file: changed lines that differ only in whitespace (diff mode only). */
  whitespaceOnly: Map<string, number>;
  commitSubjects: string[];
  branch?: string;
}

export function removedLinesFromDiff(diff: string): { file: string; text: string }[] {
  const out: { file: string; text: string }[] = [];
  let file: string | undefined;
  for (const raw of diff.split('\n')) {
    const header = /^--- (?:a\/(.+)|\/dev\/null)$/.exec(raw);
    if (header) {
      file = header[1];
      continue;
    }
    if (raw.startsWith('+++') || raw.startsWith('diff --git')) continue;
    if (file && raw.startsWith('-')) out.push({ file, text: raw.slice(1) });
  }
  return out;
}

function parseNumstat(text: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of text.split(/\r?\n/)) {
    const m = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(row);
    if (m?.[3]) map.set(m[3], (m[1] === '-' ? 0 : Number(m[1])) + (m[2] === '-' ? 0 : Number(m[2])));
  }
  return map;
}

const MAX_BYTES = 400_000;

/** Mulligan's own workspace is never part of the change under review. */
const isMulliganFile = (file: string): boolean => file.startsWith('.mulligan/') || file === '.MulliganMem';

const isReviewable = (f: SourceFile): boolean => f.content.length <= MAX_BYTES && !f.content.includes('\0');

function linesInScope(files: SourceFile[], scope?: Map<string, Set<number>>): ScopedLine[] {
  const out: ScopedLine[] = [];
  for (const file of files) {
    const set = scope?.get(file.path);
    if (scope && !set) continue;
    file.content.split('\n').forEach((text, i) => {
      if (!set || set.has(i + 1)) out.push({ file: file.path, line: i + 1, text });
    });
  }
  return out;
}

export async function collectReviewInput(root: string, options: { base: string; all?: boolean }): Promise<ReviewInput> {
  const repo = await isGitRepo(root);
  if (options.all || !repo) {
    const paths = await walkProject(root, { include: SOURCE_GLOBS });
    const files = (await readSourceFiles(root, paths)).filter(isReviewable);
    return {
      mode: 'all',
      files,
      changed: files.map((f) => ({ path: f.path, status: 'modified', additions: f.content.split('\n').length, deletions: 0 })),
      lines: linesInScope(files),
      removed: [],
      whitespaceOnly: new Map(),
      commitSubjects: [],
    };
  }

  const changes = await changesSince(root, options.base);
  const untracked = changes.untracked.filter((f) => !isMulliganFile(f));
  const files = (await readSourceFiles(root, changes.files.filter((f) => !isMulliganFile(f)))).filter(isReviewable);
  const scopeLines = addedLinesByFile(changes.diff);
  for (const file of files) {
    if (untracked.includes(file.path)) {
      scopeLines.set(file.path, new Set(file.content.split('\n').map((_, i) => i + 1)));
    }
  }

  const numstat = changes.against === 'HEAD' && changes.diff === '' ? '' : await git(root, ['diff', '--numstat', changes.against]).catch(() => '');
  const changed: ChangedFile[] = [];
  for (const row of numstat.split(/\r?\n/)) {
    const m = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(row);
    if (m?.[3] && !isMulliganFile(m[3])) {
      changed.push({ path: m[3], status: 'modified', additions: m[1] === '-' ? 0 : Number(m[1]), deletions: m[2] === '-' ? 0 : Number(m[2]) });
    }
  }
  for (const path of untracked) {
    const file = files.find((f) => f.path === path);
    changed.push({ path, status: 'added', additions: file ? file.content.split('\n').length : 0, deletions: 0 });
  }

  const whitespaceOnly = new Map<string, number>();
  if (numstat) {
    const all = parseNumstat(numstat);
    const ignoringWhitespace = parseNumstat(await git(root, ['diff', '--numstat', '-w', changes.against]).catch(() => ''));
    for (const [file, n] of all) {
      const delta = n - (ignoringWhitespace.get(file) ?? 0);
      if (delta > 0 && !isMulliganFile(file)) whitespaceOnly.set(file, delta);
    }
  }

  let commitSubjects: string[] = [];
  let branch: string | undefined;
  try {
    if (changes.against !== 'HEAD') {
      commitSubjects = (await git(root, ['log', '--format=%s', `${changes.against}..HEAD`])).split(/\r?\n/).filter(Boolean);
    }
    branch = (await git(root, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
  } catch {
    // No commits yet.
  }

  return {
    mode: 'diff',
    against: changes.against,
    files,
    changed,
    scopeLines,
    lines: linesInScope(files, scopeLines),
    removed: removedLinesFromDiff(changes.diff).filter((r) => !isMulliganFile(r.file)),
    whitespaceOnly,
    commitSubjects,
    ...(branch ? { branch } : {}),
  };
}
