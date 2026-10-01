import { SOURCE_GLOBS, readSourceFiles, walkProject } from './files.js';

const STOP = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'add', 'make', 'when', 'should', 'need', 'use', 'new', 'fix', 'all', 'are', 'not']);

function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

export interface CodeContext {
  /** Every project path, for orientation. */
  tree: string[];
  /** The most relevant files, in full, within the budget. */
  files: { path: string; content: string }[];
  truncated: boolean;
}

/**
 * Picks the files most relevant to a task so a model sees real code, not
 * just a description. Files named in the task rank first, then files whose
 * path and contents share the task's vocabulary.
 */
export async function gatherCodeContext(
  root: string,
  task: string,
  options: { maxChars?: number; maxFiles?: number; include?: string[] } = {},
): Promise<CodeContext> {
  const maxChars = options.maxChars ?? 60_000;
  const tree = await walkProject(root, { include: ['**/*'], maxFiles: 5_000 });
  const sources = tree.filter((p) => /\.(ts|tsx|js|jsx|mjs|cjs|json|md|yaml|yml|css)$/.test(p) && !/lock|\.min\./.test(p));
  const taskWords = new Set(words(task));
  const named = new Set(options.include ?? []);
  for (const path of sources) if (task.includes(path) || task.includes(path.slice(path.lastIndexOf('/') + 1))) named.add(path);

  const contents = await readSourceFiles(root, await walkProject(root, { include: SOURCE_GLOBS }));
  const scored = contents
    .map((f) => {
      const pathHits = words(f.path).filter((w) => taskWords.has(w)).length;
      const body = new Set(words(f.content.slice(0, 20_000)));
      let bodyHits = 0;
      for (const w of taskWords) if (body.has(w)) bodyHits++;
      return { file: f, score: (named.has(f.path) ? 100 : 0) + pathHits * 5 + bodyHits };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  const files: CodeContext['files'] = [];
  let used = 0;
  let truncated = false;
  for (const { file } of scored) {
    if (files.length >= (options.maxFiles ?? 12)) {
      truncated = true;
      break;
    }
    if (used + file.content.length > maxChars) {
      truncated = true;
      continue;
    }
    files.push({ path: file.path, content: file.content });
    used += file.content.length;
  }
  return { tree: tree.slice(0, 400), files, truncated };
}

export function renderCodeContext(ctx: CodeContext): string {
  const parts = [`PROJECT FILES (${ctx.tree.length}${ctx.tree.length >= 400 ? '+' : ''}):\n${ctx.tree.join('\n')}`];
  for (const f of ctx.files) parts.push(`=== ${f.path} ===\n${f.content}`);
  if (ctx.truncated) parts.push('(More relevant files exist but were left out to fit the budget. Ask for them by path if needed.)');
  return parts.join('\n\n');
}
