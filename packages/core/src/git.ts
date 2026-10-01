import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Read-only git helpers used by Mulligan itself. Commands requested by agents
 * or users go through the bot's permission layer instead.
 */
export async function git(root: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd: root, maxBuffer: 64 * 1024 * 1024 });
  return stdout;
}

export async function isGitRepo(root: string): Promise<boolean> {
  try {
    return (await git(root, ['rev-parse', '--is-inside-work-tree'])).trim() === 'true';
  } catch {
    return false;
  }
}

export async function currentBranch(root: string): Promise<string | undefined> {
  try {
    const branch = (await git(root, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
    return branch === 'HEAD' ? undefined : branch;
  } catch {
    return undefined;
  }
}

/** Resolves the merge base with `base`, or undefined if `base` does not exist. */
export async function mergeBase(root: string, base: string): Promise<string | undefined> {
  try {
    return (await git(root, ['merge-base', base, 'HEAD'])).trim() || undefined;
  } catch {
    return undefined;
  }
}

export interface ChangeSet {
  /** What the diff was taken against (a commit, or "HEAD" when no base was found). */
  against: string;
  /** Unified diff (committed since base + staged + unstaged). */
  diff: string;
  files: string[];
  untracked: string[];
}

/**
 * Everything on the current branch since it diverged from `base`, including
 * uncommitted work and untracked files.
 */
export async function changesSince(root: string, base: string): Promise<ChangeSet> {
  const against = (await mergeBase(root, base)) ?? 'HEAD';
  let diff = '';
  try {
    diff = await git(root, ['diff', '--no-color', '--no-ext-diff', '-U0', against]);
  } catch {
    // A repository without commits has nothing to diff against.
  }
  const files = parseDiffFiles(diff);
  const untracked = (await git(root, ['ls-files', '--others', '--exclude-standard']))
    .split(/\r?\n/)
    .filter(Boolean);
  return { against, diff, files: [...new Set([...files, ...untracked])], untracked };
}

export function parseDiffFiles(diff: string): string[] {
  const files: string[] = [];
  for (const line of diff.split('\n')) {
    const match = /^\+\+\+ b\/(.+)$/.exec(line);
    if (match?.[1]) files.push(match[1]);
  }
  return files;
}

/** Map of file → 1-based line numbers added or modified in the diff. */
export function addedLinesByFile(diff: string): Map<string, Set<number>> {
  const result = new Map<string, Set<number>>();
  let current: Set<number> | undefined;
  let line = 0;
  for (const raw of diff.split('\n')) {
    const file = /^\+\+\+ (?:b\/(.+)|\/dev\/null)$/.exec(raw);
    if (file) {
      current = file[1] ? new Set<number>() : undefined;
      if (file[1] && current) result.set(file[1], current);
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
    if (hunk?.[1]) {
      line = Number(hunk[1]);
      continue;
    }
    if (!current) continue;
    if (raw.startsWith('+')) {
      current.add(line);
      line += 1;
    } else if (!raw.startsWith('-') && !raw.startsWith('\\')) {
      line += 1;
    }
  }
  return result;
}

export interface CommitSummary {
  hash: string;
  subject: string;
  files: { path: string; added: number; deleted: number }[];
}

export async function recentCommits(root: string, limit = 100): Promise<CommitSummary[]> {
  let out: string;
  try {
    out = await git(root, ['log', '--no-merges', `-n${limit}`, '--numstat', '--format=@@%H%x09%s']);
  } catch {
    return [];
  }
  const commits: CommitSummary[] = [];
  for (const line of out.split(/\r?\n/)) {
    if (line.startsWith('@@')) {
      const [hash = '', subject = ''] = line.slice(2).split('\t');
      commits.push({ hash, subject, files: [] });
      continue;
    }
    const stat = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(line);
    const commit = commits.at(-1);
    if (stat && commit) {
      commit.files.push({
        path: stat[3] ?? '',
        added: stat[1] === '-' ? 0 : Number(stat[1]),
        deleted: stat[2] === '-' ? 0 : Number(stat[2]),
      });
    }
  }
  return commits;
}
