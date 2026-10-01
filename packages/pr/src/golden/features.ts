import { isDocFile, isTestFile } from '@mulligan/core';
import type { ChangedFile, PullRequest, ReviewComment } from '../provider/types.js';

export const DESCRIPTION_SECTIONS = ['problem', 'summary', 'testing', 'risks', 'rollback', 'migration', 'screenshots'] as const;
export type DescriptionSection = (typeof DESCRIPTION_SECTIONS)[number];
export const isDescriptionSection = (value: unknown): value is DescriptionSection => DESCRIPTION_SECTIONS.some((s) => s === value);

const SECTION_PATTERNS: Record<DescriptionSection, RegExp> = {
  problem: /\b(problem|motivation|why|context|background|issue)\b/i,
  summary: /\b(summary|what|changes?|overview|description)\b/i,
  testing: /\b(test(s|ing)?|how (to|was this) test(ed)?|verification|qa)\b/i,
  risks: /\b(risks?|impact|blast radius|caveats?)\b/i,
  rollback: /\b(roll ?back|revert)\b/i,
  migration: /\b(migrations?|upgrade|deployment notes?)\b/i,
  screenshots: /\b(screenshots?|screen recordings?|before\s*\/\s*after|demo)\b/i,
};

/** Markdown headings and bold "label:" lines are treated as section headers. */
function sectionHeaders(body: string): string[] {
  return body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^#{1,6}\s+\S/.test(l) || /^\*\*[^*]+\*\*:?\s*$/.test(l) || /^[A-Z][\w /]{2,30}:$/.test(l))
    .map((l) => l.replace(/^#+\s*|\*\*|:$/g, ''));
}

export function detectSections(body: string): Record<DescriptionSection, boolean> {
  const headers = sectionHeaders(body);
  const has = (s: DescriptionSection): boolean => headers.some((h) => SECTION_PATTERNS[s].test(h));
  return {
    problem: has('problem'),
    summary: has('summary'),
    testing: has('testing'),
    risks: has('risks'),
    rollback: has('rollback'),
    migration: has('migration'),
    // Screenshots count even without a heading if an image is embedded.
    screenshots: has('screenshots') || /!\[[^\]]*\]\([^)]+\)|<img\s/i.test(body),
  };
}

const UI_FILE = /\.(tsx|jsx|vue|svelte|css|scss|less)$|(^|\/)(components?|screens?|pages?|views?|ui)\//i;
const MIGRATION_FILE = /(^|\/)migrations?\/|\.sql$|schema\.prisma$/i;

export interface PrFeatures {
  id: string;
  title: string;
  linesChanged: number;
  filesChanged: number;
  sections: Record<DescriptionSection, boolean>;
  descriptionLength: number;
  testsChanged: boolean;
  docsChanged: boolean;
  uiChanged: boolean;
  migrationChanged: boolean;
  /** Distinct top-level areas touched, excluding tests and docs. */
  areas: string[];
  commits?: number;
  reviewComments: number;
  changesRequested: boolean;
}

const GROUPING_DIRS = new Set(['packages', 'apps', 'libs', 'services', 'src']);

export function areaOf(file: string): string {
  const [first = '', second, ...rest] = file.split('/');
  if (second === undefined) return '(root)';
  // Monorepo-aware: packages/foo/... and apps/foo/... count as one area each.
  return GROUPING_DIRS.has(first) && rest.length > 0 ? `${first}/${second}` : first;
}

export function extractFeatures(pr: PullRequest, files: ChangedFile[], comments: ReviewComment[]): PrFeatures {
  const lines = files.length ? files.reduce((n, f) => n + f.additions + f.deletions, 0) : pr.additions + pr.deletions;
  const code = files.filter((f) => !isTestFile(f.path) && !isDocFile(f.path));
  return {
    id: pr.id,
    title: pr.title,
    linesChanged: lines,
    filesChanged: files.length || pr.changedFiles,
    sections: detectSections(pr.body),
    descriptionLength: pr.body.trim().length,
    testsChanged: files.some((f) => isTestFile(f.path)),
    docsChanged: files.some((f) => isDocFile(f.path)),
    uiChanged: files.some((f) => UI_FILE.test(f.path)),
    migrationChanged: files.some((f) => MIGRATION_FILE.test(f.path)),
    areas: [...new Set(code.map((f) => areaOf(f.path)))],
    ...(pr.commits !== undefined ? { commits: pr.commits } : {}),
    reviewComments: comments.length,
    changesRequested: comments.some((c) => c.verdict === 'changes_requested'),
  };
}
