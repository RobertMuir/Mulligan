import { git, isDocFile, isSourceFile, isTestFile, matchesAny, type CommandRunner, type SourceFile } from '@mulligan/core';
import { runBuiltin, type BuiltinCheckName, type CookbookRule } from '@mulligan/cookbook';
import { areaOf } from '@mulligan/pr';
import { changedCode, primaryArea } from './areas.js';
import type { ReviewInput, ScopedLine } from './collect.js';
import type { CategoryKey, Finding } from './types.js';

// ── Framework best-practice heuristics ─────────────────────────────────────
// Used only where the project cookbook has no equivalent rule. They sit at
// level 7 of the standards hierarchy and are labelled as such.

const HEURISTIC_BUILTINS: { name: BuiltinCheckName; category: CategoryKey; message: string; action: string }[] = [
  { name: 'no-explicit-any', category: 'typescript', message: 'Explicit `any` added', action: 'Replace `any` with `unknown` plus narrowing, or an explicit type.' },
  { name: 'no-empty-catch', category: 'error-handling', message: 'Empty catch block swallows errors', action: 'Handle, report or rethrow the error.' },
  { name: 'no-index-key', category: 'react', message: 'Array index used as React key', action: 'Use a stable id from the data as the key.' },
  { name: 'no-ts-ignore', category: 'typescript', message: '@ts-ignore suppresses type checking', action: 'Fix the type error or use @ts-expect-error with a reason.' },
];

export function heuristicFindings(input: ReviewInput, cookbookRules: CookbookRule[]): Finding[] {
  const covered = new Set(cookbookRules.flatMap((r) => (r.check?.type === 'builtin' ? [r.check.name] : [])));
  const findings: Finding[] = [];
  for (const h of HEURISTIC_BUILTINS) {
    if (covered.has(h.name)) continue;
    for (const file of input.files) {
      for (const hit of runBuiltin(h.name, file)) {
        if (input.scopeLines && !input.scopeLines.get(file.path)?.has(hit.line)) continue;
        findings.push({
          category: h.category,
          mark: 'warn',
          source: 'heuristic',
          message: `${h.message} [framework best practice — not a project rule]`,
          ref: `${file.path}:${hit.line}`,
          action: h.action,
        });
      }
    }
  }
  return findings;
}

// ── Security ──────────────────────────────────────────────────────────────

const SECRET_PATTERNS: [RegExp, string][] = [
  [/AKIA[0-9A-Z]{16}/, 'AWS access key'],
  [/-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/, 'private key'],
  [/\bgh[pousr]_[A-Za-z0-9]{36,}\b/, 'GitHub token'],
  [/\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}/, 'API secret key'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}/, 'Slack token'],
  [/\b(?:api[_-]?key|secret|password|passwd|access[_-]?token)\s*[:=]\s*['"][^'"\s]{8,}['"]/i, 'hard-coded credential'],
];

interface RiskyPattern {
  pattern: RegExp;
  label: string;
  action: string;
  /** Only report in files that actually use the capability (e.g. a shell). */
  onlyIfFile?: RegExp;
}

const RISKY_PATTERNS: RiskyPattern[] = [
  { pattern: /\beval\s*\(|\bnew Function\s*\(/, label: 'Dynamic code execution (eval / new Function)', action: 'Remove dynamic evaluation or justify it in review.' },
  // Assignments only: a name mentioned in a string or a regex is not an injection point.
  { pattern: /dangerouslySetInnerHTML\s*=\s*\{|\.innerHTML\s*=(?!=)/, label: 'Raw HTML injection point', action: 'Render as text or sanitise the HTML.' },
  {
    pattern: /\bexec(?:Sync)?\s*\(\s*`[^`]*\$\{/,
    label: 'Shell command built from interpolated input',
    action: 'Use execFile with an argument array.',
    onlyIfFile: /child_process|\bexeca\b|shelljs/,
  },
  // XML namespaces and JSON Schema ids are identifiers, not network calls.
  { pattern: /['"`]http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0|www\.w3\.org\/|json-schema\.org\/)/, label: 'Insecure http:// URL', action: 'Use https://.' },
];

export function securityFindings(lines: ScopedLine[], files: SourceFile[] = []): Finding[] {
  const findings: Finding[] = [];
  const contentOf = new Map(files.map((f) => [f.path, f.content]));
  for (const { file, line, text } of lines) {
    if (isTestFile(file)) continue;
    for (const [pattern, label] of SECRET_PATTERNS) {
      if (pattern.test(text)) {
        findings.push({
          category: 'security',
          mark: 'fail',
          blocking: true,
          source: 'heuristic',
          message: `Possible ${label} committed to source`,
          ref: `${file}:${line}`,
          action: 'Remove the secret, rotate it, and load it from the environment.',
        });
      }
    }
    for (const { pattern, label, action, onlyIfFile } of RISKY_PATTERNS) {
      if (onlyIfFile && !onlyIfFile.test(contentOf.get(file) ?? '')) continue;
      if (pattern.test(text)) findings.push({ category: 'security', mark: 'warn', source: 'heuristic', message: label, ref: `${file}:${line}`, action });
    }
  }
  return findings;
}

// ── Accessibility ─────────────────────────────────────────────────────────

export function accessibilityFindings(lines: ScopedLine[]): Finding[] {
  const findings: Finding[] = [];
  for (const { file, line, text } of lines) {
    if (!/\.[jt]sx$/.test(file)) continue;
    if (/<img\b(?![^>]*\balt=)[^>]*>/.test(text)) {
      findings.push({ category: 'accessibility', mark: 'warn', source: 'heuristic', message: '<img> without alt text', ref: `${file}:${line}`, action: 'Add alt text (alt="" if decorative).' });
    }
    if (/<(div|span)\b[^>]*\bonClick=/.test(text) && !/\brole=/.test(text)) {
      findings.push({
        category: 'accessibility',
        mark: 'warn',
        source: 'heuristic',
        message: 'Click handler on a non-interactive element',
        ref: `${file}:${line}`,
        action: 'Use a <button>, or add role, tabIndex and keyboard handling.',
      });
    }
  }
  return findings;
}

// ── Testing ───────────────────────────────────────────────────────────────

export function testingFindings(input: ReviewInput): Finding[] {
  if (input.mode === 'all') return [];
  const paths = input.changed.map((c) => c.path);
  const source = paths.filter((p) => isSourceFile(p) && !isTestFile(p));
  const tests = paths.filter(isTestFile);
  if (source.length === 0) return [];
  return tests.length > 0
    ? [{ category: 'testing', mark: 'pass', source: 'heuristic', message: `Tests added or updated (${tests.length} file${tests.length === 1 ? '' : 's'})` }]
    : [
        {
          category: 'testing',
          mark: 'warn',
          source: 'heuristic',
          message: `${source.length} source file${source.length === 1 ? '' : 's'} changed with no test changes`,
          action: 'Add or update tests that cover the change.',
        },
      ];
}

// ── Blast radius ──────────────────────────────────────────────────────────

const SENSITIVE: [RegExp, string][] = [
  [/(^|\/)package\.json$/, 'package manifest'],
  [/(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?)$/, 'lockfile'],
  [/(^|\/)tsconfig[^/]*\.json$/, 'TypeScript configuration'],
  [/(^|\/)\.?eslint|(^|\/)\.prettierrc/, 'lint/format configuration'],
  [/(^|\/)\.github\/workflows\/|\.gitlab-ci\.yml$|azure-pipelines\.yml$/, 'CI pipeline'],
  [/(^|\/)Dockerfile|docker-compose/, 'container configuration'],
  [/(^|\/)migrations?\/|\.sql$|schema\.prisma$/, 'database migration/schema'],
  [/(^|\/)\.env(\.|$)/, 'environment file'],
];

export function blastRadiusFindings(input: ReviewInput, scope?: string[]): { findings: Finding[]; humanReview: string[] } {
  const findings: Finding[] = [];
  const humanReview: string[] = [];
  if (input.mode === 'all') return { findings, humanReview };

  const code = changedCode(input.changed);
  const primary = scope?.length ? undefined : primaryArea(code);
  const unrelated = (
    scope?.length
      ? code.filter((c) => !matchesAny(c.path, scope))
      : code.filter((c) => areaOf(c.path) !== primary && !SENSITIVE.some(([p]) => p.test(c.path)))
  ).map((c) => c.path);

  if (unrelated.length > 0) {
    findings.push({
      category: 'blast-radius',
      mark: 'warn',
      source: 'heuristic',
      message: `${unrelated.length} file${unrelated.length === 1 ? '' : 's'} changed outside ${scope?.length ? 'the declared scope' : `the main area (${primary})`}`,
      detail: unrelated.slice(0, 10).join(', '),
      action: 'Confirm these changes are needed, or move unrelated refactors to a separate PR.',
    });
  }
  for (const c of input.changed) {
    const hit = SENSITIVE.find(([p]) => p.test(c.path));
    if (hit) {
      findings.push({ category: 'blast-radius', mark: 'warn', source: 'heuristic', message: `${hit[1]} changed`, ref: c.path });
      humanReview.push(`${hit[1]}: ${c.path}`);
    }
  }
  if (findings.length === 0) {
    findings.push({
      category: 'blast-radius',
      mark: 'pass',
      source: 'heuristic',
      message: `Changes contained to ${primary ?? 'the declared scope'} (${input.changed.length} file${input.changed.length === 1 ? '' : 's'})`,
    });
  }
  return { findings, humanReview };
}

// ── Dependencies ──────────────────────────────────────────────────────────

export async function dependencyFindings(root: string, input: ReviewInput): Promise<Finding[]> {
  if (input.mode === 'all' || !input.against) return [];
  const findings: Finding[] = [];
  for (const c of input.changed.filter((c) => /(^|\/)package\.json$/.test(c.path))) {
    const now = input.files.find((f) => f.path === c.path);
    if (!now) continue;
    let before: Record<string, Record<string, string>> = {};
    try {
      before = JSON.parse(await git(root, ['show', `${input.against}:${c.path}`]));
    } catch {
      // New package.json.
    }
    let after: Record<string, Record<string, string>>;
    try {
      after = JSON.parse(now.content);
    } catch {
      findings.push({ category: 'dependencies', mark: 'fail', blocking: true, source: 'heuristic', message: `${c.path} is not valid JSON`, ref: c.path });
      continue;
    }
    for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
      const old = before[field] ?? {};
      for (const [name, version] of Object.entries(after[field] ?? {})) {
        if (!(name in old)) {
          findings.push({
            category: 'dependencies',
            mark: 'warn',
            source: 'heuristic',
            message: `New ${field === 'dependencies' ? 'runtime ' : ''}dependency ${name}@${version}`,
            ref: c.path,
            action: `Confirm ${name} is necessary, maintained and licence-compatible.`,
          });
        } else if (old[name] !== version) {
          findings.push({ category: 'dependencies', mark: 'warn', source: 'heuristic', message: `${name} changed ${old[name]} → ${version}`, ref: c.path });
        }
      }
    }
  }
  return findings;
}

// ── Documentation ─────────────────────────────────────────────────────────

export function documentationFindings(input: ReviewInput): Finding[] {
  if (input.mode === 'all') return [];
  const paths = input.changed.map((c) => c.path);
  const api = paths.filter((p) => /(^|\/)index\.[cm]?[jt]sx?$/.test(p));
  const docs = paths.filter(isDocFile);
  if (api.length > 0 && docs.length === 0) {
    return [
      {
        category: 'documentation',
        mark: 'warn',
        source: 'heuristic',
        message: `Public entry points changed (${api.join(', ')}) with no documentation update`,
        action: 'Update the README or docs for the changed API.',
      },
    ];
  }
  if (docs.length > 0) return [{ category: 'documentation', mark: 'pass', source: 'heuristic', message: `Documentation updated (${docs.length} file${docs.length === 1 ? '' : 's'})` }];
  return [];
}

// ── Verification ──────────────────────────────────────────────────────────

const COMMAND_CATEGORY: Record<string, CategoryKey> = {
  typecheck: 'typescript',
  types: 'typescript',
  test: 'testing',
  tests: 'testing',
  lint: 'maintainability',
  build: 'correctness',
};

export async function verificationFindings(
  commands: Record<string, string>,
  runner: CommandRunner | undefined,
): Promise<{ findings: Finding[]; unverified: string[] }> {
  const findings: Finding[] = [];
  const unverified: string[] = [];
  const entries = Object.entries(commands);
  if (entries.length === 0) {
    unverified.push('Automated verification (no verification.commands in .mulligan/config.yaml)');
    return { findings, unverified };
  }
  if (!runner) {
    unverified.push(`Automated verification (${entries.map(([n]) => n).join(', ')} not run in this review)`);
    return { findings, unverified };
  }
  for (const [name, command] of entries) {
    const category = COMMAND_CATEGORY[name] ?? 'correctness';
    const outcome = await runner.run(command, { purpose: `Mulligan Review verification: ${name}` });
    if (outcome.status !== 'completed') {
      unverified.push(`${name} (\`${command}\` ${outcome.status}: ${outcome.reason})`);
      continue;
    }
    const tail = `${outcome.stdout}\n${outcome.stderr}`.trim().split('\n').slice(-15).join('\n');
    findings.push(
      outcome.exitCode === 0
        ? { category, mark: 'pass', source: 'verification', message: `\`${command}\` passed` }
        : {
            category,
            mark: 'fail',
            blocking: true,
            source: 'verification',
            message: `\`${command}\` failed (exit ${outcome.exitCode})`,
            detail: tail,
            action: `Fix the ${name} failure.`,
          },
    );
  }
  return { findings, unverified };
}

// ── Safety mode ───────────────────────────────────────────────────────────

export function safetyFindings(input: ReviewInput, description: string | undefined): { findings: Finding[]; humanReview: string[] } {
  const findings: Finding[] = [];
  const reqId = /\b[A-Z][A-Z0-9]+-\d+\b/;
  const traced = [...input.commitSubjects, input.branch ?? ''].some((s) => reqId.test(s));
  findings.push(
    traced
      ? { category: 'traceability', mark: 'pass', source: 'heuristic', message: 'Commits or branch reference a requirement/ticket ID' }
      : { category: 'traceability', mark: 'warn', source: 'heuristic', message: 'No requirement or ticket ID in commits or branch name', action: 'Reference the requirement this change implements.' },
  );
  if (description !== undefined) {
    const hasRisk = /\brisks?\b/i.test(description);
    const hasRollback = /\broll ?back|revert\b/i.test(description);
    findings.push(
      hasRisk && hasRollback
        ? { category: 'change-control', mark: 'pass', source: 'heuristic', message: 'Description documents risks and rollback' }
        : { category: 'change-control', mark: 'warn', source: 'heuristic', message: 'Description lacks risk and/or rollback documentation', action: 'Document risks and the rollback plan.' },
    );
  }
  const lockfileChanged = input.changed.some((c) => /(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/.test(c.path));
  const manifestChanged = input.changed.some((c) => /(^|\/)package\.json$/.test(c.path));
  if (manifestChanged && !lockfileChanged) {
    findings.push({ category: 'reproducibility', mark: 'warn', source: 'heuristic', message: 'package.json changed without a lockfile update', action: 'Commit the updated lockfile.' });
  }
  return {
    findings,
    humanReview: [
      'Data integrity: confirm writes are validated, atomic and recoverable',
      'Failure modes: confirm behaviour under partial failure, timeouts and retries',
      'Auditability: confirm safety-relevant actions are logged',
      'Risk controls: confirm risk-control measures are unaffected or re-verified',
    ],
  };
}
