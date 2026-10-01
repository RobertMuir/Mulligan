import { SOURCE_GLOBS, lineOf, matchesAny, type SourceFile } from '@mulligan/core';
import { runBuiltin, type Hit } from './builtins.js';
import type { CookbookRule, RuleCheck, Severity } from './types.js';

export interface Violation {
  ruleId: string;
  title: string;
  category: string;
  severity: Severity;
  file: string;
  line: number;
  column: number;
  snippet: string;
  expected?: string;
  reason: string;
  /** Present when the line carries a `mulligan-allow` comment. */
  suppression?: { documented: boolean; reason?: string };
}

export interface EvaluationResult {
  /** Violations on lines in scope (e.g. lines added in the current diff). */
  violations: Violation[];
  /** Violations in existing code outside the scope — reported, not blamed on the change. */
  preexisting: Violation[];
  /** Violations explicitly allowed with a documented reason. */
  allowed: Violation[];
  /** Rules with no machine check: they need human or model judgement. */
  unenforced: CookbookRule[];
  filesChecked: number;
}

export interface EvaluateOptions {
  /**
   * When given, only these lines count as in scope; everything else is
   * reported as pre-existing. Files missing from the map are entirely pre-existing.
   */
  scopeLines?: Map<string, Set<number>>;
}

const SUPPRESSION = /mulligan-allow\s+([A-Z]+-\d+(?:\s*,\s*[A-Z]+-\d+)*)(?:\s*[:—-]+\s*(\S.*?))?\s*(?:\*\/)?$/;

function suppressionFor(lines: string[], line: number, ruleId: string): Violation['suppression'] {
  for (const candidate of [lines[line - 1], lines[line - 2]]) {
    const m = candidate ? SUPPRESSION.exec(candidate) : null;
    if (m?.[1]?.split(/\s*,\s*/).includes(ruleId)) {
      return m[2] ? { documented: true, reason: m[2] } : { documented: false };
    }
  }
  return undefined;
}

function patternHits(check: Extract<RuleCheck, { type: 'pattern' }>, file: SourceFile): Hit[] {
  const flags = check.flags?.includes('g') ? check.flags : `${check.flags ?? ''}g`;
  const regex = new RegExp(check.pattern, flags);
  const hits: Hit[] = [];
  for (const match of file.content.matchAll(regex)) {
    const index = match.index ?? 0;
    const line = lineOf(file.content, index);
    const lineStart = file.content.lastIndexOf('\n', index - 1) + 1;
    hits.push({ line, column: index - lineStart + 1, message: check.message });
    if (match[0].length === 0) break;
  }
  return hits;
}

export function evaluateCookbook(rules: CookbookRule[], files: SourceFile[], options: EvaluateOptions = {}): EvaluationResult {
  const result: EvaluationResult = { violations: [], preexisting: [], allowed: [], unenforced: [], filesChecked: files.length };
  for (const rule of rules) {
    if (!rule.check) {
      result.unenforced.push(rule);
      continue;
    }
    const globs = rule.check.files ?? SOURCE_GLOBS;
    for (const file of files) {
      if (!matchesAny(file.path, globs)) continue;
      const hits =
        rule.check.type === 'builtin'
          ? runBuiltin(rule.check.name, file, rule.check.options)
          : patternHits(rule.check, file);
      if (hits.length === 0) continue;
      const lines = file.content.split('\n');
      for (const hit of hits) {
        const violation: Violation = {
          ruleId: rule.id,
          title: rule.title,
          category: rule.category,
          severity: rule.severity,
          file: file.path,
          line: hit.line,
          column: hit.column,
          snippet: (lines[hit.line - 1] ?? '').trim().slice(0, 140),
          ...(rule.preferred?.length ? { expected: rule.preferred.join(' / ') } : {}),
          reason: [
            hit.message,
            `Your project's ${rule.category} cookbook classifies this as ${rule.severity} severity.`,
            rule.rationale,
          ]
            .filter(Boolean)
            .join(' '),
        };
        const suppression = suppressionFor(lines, hit.line, rule.id);
        if (suppression) violation.suppression = suppression;

        if (suppression?.documented) result.allowed.push(violation);
        else if (options.scopeLines && !options.scopeLines.get(file.path)?.has(hit.line)) result.preexisting.push(violation);
        else result.violations.push(violation);
      }
    }
  }
  return result;
}

const SEVERITY_ORDER: Severity[] = ['blocking', 'high', 'medium', 'low'];

export function sortViolations(violations: Violation[]): Violation[] {
  return [...violations].sort(
    (a, b) =>
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) ||
      a.file.localeCompare(b.file) ||
      a.line - b.line,
  );
}

/** The spec §23 violation block. */
export function formatViolation(v: Violation): string {
  const lines = ['COOKBOOK VIOLATION', '', `${v.ruleId} — ${v.title}`, '', `${v.file}:${v.line}`, '', 'Current:', `  ${v.snippet}`];
  if (v.expected) lines.push('', 'Expected:', `  ${v.expected}`);
  lines.push('', 'Reason:', `  ${v.reason}`);
  if (v.suppression && !v.suppression.documented) {
    lines.push('', `Note: a mulligan-allow comment is present but gives no reason. Add one: // mulligan-allow ${v.ruleId}: <why>`);
  }
  return lines.join('\n');
}
