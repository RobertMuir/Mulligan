import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  SOURCE_GLOBS,
  allDependencies,
  isTestFile,
  lineOf,
  readPackageJson,
  readSourceFiles,
  recentCommits,
  walkProject,
  type CommitSummary,
  type PackageJson,
  type SourceFile,
} from '@mulligan/core';
import type { Evidence } from '../types.js';

export type TopicKey =
  | 'type-safety'
  | 'runtime-validation'
  | 'error-boundaries'
  | 'accessibility-testing'
  | 'regression-testing'
  | 'error-handling'
  | 'small-changes'
  | 'react-list-keys';

export interface Signal {
  topic: TopicKey;
  polarity: 'strength' | 'gap';
  summary: string;
  evidence: Evidence[];
}

export interface ProjectSnapshot {
  root: string;
  files: SourceFile[];
  pkg?: PackageJson;
  tsconfig?: string;
  commits: CommitSummary[];
}

const MAX_FILE_BYTES = 400_000;
const MAX_EVIDENCE = 5;

const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

export async function snapshotProject(root: string): Promise<ProjectSnapshot> {
  const paths = await walkProject(root, { include: SOURCE_GLOBS });
  const files = (await readSourceFiles(root, paths)).filter((f) => f.content.length <= MAX_FILE_BYTES);
  let tsconfig: string | undefined;
  try {
    tsconfig = await readFile(path.join(root, 'tsconfig.json'), 'utf8');
  } catch {
    tsconfig = undefined;
  }
  return { root, files, pkg: await readPackageJson(root), tsconfig, commits: await recentCommits(root, 150) };
}

function findAll(files: SourceFile[], pattern: RegExp, limit = Infinity): Evidence[] {
  const out: Evidence[] = [];
  for (const file of files) {
    const regex = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
    for (const match of file.content.matchAll(regex)) {
      out.push({ kind: 'code', ref: `${file.path}:${lineOf(file.content, match.index ?? 0)}`, note: match[0].trim().slice(0, 80) });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

const VALIDATION_LIBS = ['zod', 'yup', 'valibot', 'io-ts', 'superstruct', 'ajv', '@sinclair/typebox', 'arktype', 'joi'];
const AXE_LIBS = ['jest-axe', 'vitest-axe', '@axe-core/react', '@axe-core/playwright', 'axe-playwright', 'cypress-axe', 'axe-core'];

/** Each detector reports observable facts with file:line evidence — never a score. */
export function detectSignals(snapshot: ProjectSnapshot): Signal[] {
  const signals: Signal[] = [];
  const deps = allDependencies(snapshot.pkg);
  const source = snapshot.files.filter((f) => !isTestFile(f.path));
  const tests = snapshot.files.filter((f) => isTestFile(f.path));
  const tsFiles = source.filter((f) => /\.tsx?$/.test(f.path) && !f.path.endsWith('.d.ts'));
  const componentFiles = source.filter((f) => /\.[jt]sx$/.test(f.path));
  const usesReact = 'react' in deps || 'react-native' in deps;

  // Type safety
  if (tsFiles.length > 0) {
    const strict = snapshot.tsconfig ? /"strict"\s*:\s*true/.test(snapshot.tsconfig) : false;
    const anys = findAll(tsFiles, /(?::|\bas|<)\s*any\b(?![\w$])/);
    if (strict && anys.length === 0) {
      signals.push({
        topic: 'type-safety',
        polarity: 'strength',
        summary: `Strict TypeScript with no explicit \`any\` across ${tsFiles.length} files.`,
        evidence: [{ kind: 'config', ref: 'tsconfig.json', note: '"strict": true' }],
      });
    } else if (!strict || anys.length >= 3) {
      signals.push({
        topic: 'type-safety',
        polarity: 'gap',
        summary: [!strict ? 'TypeScript strict mode is not enabled.' : '', anys.length ? `${plural(anys.length, 'explicit `any` usage')}.` : '']
          .filter(Boolean)
          .join(' '),
        evidence: [...(!strict ? [{ kind: 'config', ref: 'tsconfig.json', note: 'strict is not true' }] : []), ...anys.slice(0, MAX_EVIDENCE)],
      });
    }
  }

  // Runtime validation at API boundaries
  const network = findAll(source, /\bfetch\s*\(|\baxios(?:\.\w+)?\s*\(|\.json\s*\(\s*\)/);
  if (network.length > 0) {
    const libs = VALIDATION_LIBS.filter((lib) => lib in deps);
    const validationImports = findAll(source, new RegExp(`from\\s+['"](${VALIDATION_LIBS.join('|').replace(/\//g, '\\/')})['"]`), 1);
    if (libs.length === 0 || validationImports.length === 0) {
      signals.push({
        topic: 'runtime-validation',
        polarity: 'gap',
        summary: `External responses are consumed in ${plural(network.length, 'place')} without a runtime validation library; compile-time types are trusted at runtime.`,
        evidence: network.slice(0, MAX_EVIDENCE),
      });
    } else {
      signals.push({
        topic: 'runtime-validation',
        polarity: 'strength',
        summary: `Runtime validation (${libs.join(', ')}) is used at data boundaries.`,
        evidence: validationImports,
      });
    }
  }

  // Error boundaries
  if (usesReact && componentFiles.length > 0) {
    const boundaries = findAll(source, /componentDidCatch|getDerivedStateFromError|react-error-boundary|<ErrorBoundary\b/, MAX_EVIDENCE);
    signals.push(
      boundaries.length === 0
        ? {
            topic: 'error-boundaries',
            polarity: 'gap',
            summary: `${plural(componentFiles.length, 'component file')} and no error boundary — a render error can blank the whole tree.`,
            evidence: [{ kind: 'dependency', ref: 'package.json', note: `react ${deps.react ?? deps['react-native']}` }],
          }
        : { topic: 'error-boundaries', polarity: 'strength', summary: 'Error boundaries are in place.', evidence: boundaries },
    );
  }

  // Accessibility testing
  if (usesReact && tests.length > 0 && componentFiles.length > 0) {
    const axe = AXE_LIBS.filter((lib) => lib in deps);
    const roleQueries = findAll(tests, /\b(?:get|find|query)(?:All)?ByRole\s*\(/, MAX_EVIDENCE);
    if (axe.length === 0 && roleQueries.length === 0) {
      signals.push({
        topic: 'accessibility-testing',
        polarity: 'gap',
        summary: `${plural(tests.length, 'test file')}, but no automated accessibility checks or role-based queries.`,
        evidence: tests.slice(0, 3).map((t) => ({ kind: 'test', ref: t.path, note: 'no axe / ByRole usage' })),
      });
    } else {
      signals.push({
        topic: 'accessibility-testing',
        polarity: 'strength',
        summary: axe.length ? `Automated accessibility checks (${axe.join(', ')}).` : 'Tests query by accessible role.',
        evidence: roleQueries.length ? roleQueries : [{ kind: 'dependency', ref: 'package.json', note: axe.join(', ') }],
      });
    }
  }

  // Regression testing
  if (source.length > 0) {
    const fixes = snapshot.commits.filter((c) => /\b(fix|bug|regression|hotfix)\b/i.test(c.subject));
    const fixesWithTests = fixes.filter((c) => c.files.some((f) => isTestFile(f.path)));
    if (tests.length === 0) {
      signals.push({
        topic: 'regression-testing',
        polarity: 'gap',
        summary: `No test files found for ${plural(source.length, 'source file')}.`,
        evidence: [{ kind: 'scan', note: `${plural(source.length, 'source file')}, 0 test files` }],
      });
    } else if (fixes.length >= 3) {
      const ratio = fixesWithTests.length / fixes.length;
      if (ratio >= 0.5) {
        signals.push({
          topic: 'regression-testing',
          polarity: 'strength',
          summary: `Bug fixes usually ship with tests (${fixesWithTests.length}/${fixes.length} recent fix commits).`,
          evidence: fixesWithTests.slice(0, MAX_EVIDENCE).map((c) => ({ kind: 'commit', ref: c.hash.slice(0, 8), note: c.subject })),
        });
      } else if (ratio < 0.25) {
        const without = fixes.filter((c) => !fixesWithTests.includes(c));
        signals.push({
          topic: 'regression-testing',
          polarity: 'gap',
          summary: `Most bug fixes ship without a regression test (${fixesWithTests.length}/${fixes.length} recent fix commits touch tests).`,
          evidence: without.slice(0, MAX_EVIDENCE).map((c) => ({ kind: 'commit', ref: c.hash.slice(0, 8), note: c.subject })),
        });
      }
    }
  }

  // Error handling
  const emptyCatches = findAll(source, /catch\s*(?:\([^)]*\))?\s*\{\s*\}|\.catch\(\s*\(\s*\w*\s*\)\s*=>\s*(?:\{\s*\}|undefined|null)\s*\)/);
  const catches = findAll(source, /\bcatch\s*[({]|\.catch\(/);
  if (emptyCatches.length > 0) {
    signals.push({
      topic: 'error-handling',
      polarity: 'gap',
      summary: `${plural(emptyCatches.length, 'catch site swallows', 'catch sites swallow')} errors silently.`,
      evidence: emptyCatches.slice(0, MAX_EVIDENCE),
    });
  } else if (catches.length >= 3) {
    signals.push({
      topic: 'error-handling',
      polarity: 'strength',
      summary: `Explicit error handling — ${catches.length} catch sites, none empty.`,
      evidence: catches.slice(0, 3),
    });
  }

  // Change size, from git history
  if (snapshot.commits.length >= 5) {
    const sizes = snapshot.commits.map((c) => c.files.reduce((n, f) => n + f.added + f.deleted, 0)).sort((a, b) => a - b);
    const median = sizes[Math.floor(sizes.length / 2)] ?? 0;
    if (median <= 200) {
      signals.push({
        topic: 'small-changes',
        polarity: 'strength',
        summary: `Small, focused changes — median ${median} lines per commit over ${sizes.length} commits.`,
        evidence: [{ kind: 'git', note: `median ${median} lines/commit` }],
      });
    } else if (median >= 600) {
      const largest = [...snapshot.commits]
        .sort((a, b) => b.files.reduce((n, f) => n + f.added + f.deleted, 0) - a.files.reduce((n, f) => n + f.added + f.deleted, 0))
        .slice(0, 3);
      signals.push({
        topic: 'small-changes',
        polarity: 'gap',
        summary: `Large changes — median ${median} lines per commit, which makes review and rollback harder.`,
        evidence: largest.map((c) => ({ kind: 'commit', ref: c.hash.slice(0, 8), note: c.subject })),
      });
    }
  }

  // React list keys
  if (usesReact) {
    const indexKeys = findAll(componentFiles, /key=\{\s*(?:index|idx|i)\s*\}/);
    if (indexKeys.length > 0) {
      signals.push({
        topic: 'react-list-keys',
        polarity: 'gap',
        summary: `${plural(indexKeys.length, 'list uses', 'lists use')} the array index as a React key, which breaks state when items reorder.`,
        evidence: indexKeys.slice(0, MAX_EVIDENCE),
      });
    }
  }

  return signals;
}
