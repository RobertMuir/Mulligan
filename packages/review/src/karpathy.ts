import { isSourceFile, isTestFile } from '@mulligan/core';
import { areaOf } from '@mulligan/pr';
import { changedCode, primaryArea } from './areas.js';
import type { ReviewInput } from './collect.js';
import type { Finding } from './types.js';

/**
 * The four Karpathy principles, applied to every review as evidence checks:
 * Think Before Coding, Simplicity First, Surgical Changes, Goal-Driven
 * Execution. What a diff alone cannot show goes to the reviewer model and
 * to the Unverified list — never silently passed.
 */
export interface KarpathyContext {
  task?: string;
  description?: string;
  scope?: string[];
  /** Results from the verification commands run in this review. */
  verification: Finding[];
}

const STATED_THINKING = /\b(assum\w*|open questions?|trade-?offs?|alternatives?|considered|out of scope|not (yet )?handled|risks?|caveats?|unknowns?)\b/i;
const SUCCESS_CRITERIA = /\b(success criteria|acceptance|done when|definition of done|test plan|how (to|was this) (test|verif)\w*|verif\w+|expected (result|behaviou?r))\b/i;
const DECLARATION = /^\s*export\s+(?:default\s+)?(?:async\s+)?(?:abstract\s+)?(function|class|interface|type|const)\s+([A-Za-z_$][\w$]*)/;
// Layer-style class or type names (PascalCase), e.g. DiscountStrategyFactory — not functions like mergeBase.
const LAYER_NAME = /^[A-Z]\w*(Factory|Strategy|Manager|Provider|Adapter|Wrapper|Builder|Registry|Handler|Service|Base)$/;
const COMMENT_LINE = /^\s*(\/\/|\/\*|\*(?!\/)|#(?!!))/;

function occurrences(input: ReviewInput, name: string): number {
  const pattern = new RegExp(`(^|[^\\w$])${name.replace(/\$/g, '\\$')}(?![\\w$])`, 'g');
  return input.files.reduce((n, f) => n + (f.content.match(pattern)?.length ?? 0), 0);
}

function thinkBeforeCoding(ctx: KarpathyContext): { findings: Finding[]; unverified: string[] } {
  const text = [ctx.description, ctx.task].filter(Boolean).join('\n');
  if (!text) {
    return { findings: [], unverified: ['Think Before Coding: no task or PR description to check for stated assumptions (use --task or --description-file)'] };
  }
  const m = STATED_THINKING.exec(text);
  return {
    findings: [
      m
        ? { category: 'think-before-coding', mark: 'pass', source: 'heuristic', message: `Assumptions or trade-offs are stated ("${m[0]}")` }
        : {
            category: 'think-before-coding',
            mark: 'warn',
            source: 'heuristic',
            message: 'No assumptions, alternatives or open questions are stated for this change',
            action: 'State the assumptions you made and the alternatives you rejected, so the reviewer can check them.',
          },
    ],
    unverified: [],
  };
}

function simplicityFirst(input: ReviewInput): Finding[] {
  const findings: Finding[] = [];
  for (const line of input.lines) {
    if (!isSourceFile(line.file) || isTestFile(line.file)) continue;
    const [, kind, name] = DECLARATION.exec(line.text) ?? [];
    if (!kind || !name) continue;
    const uses = occurrences(input, name) - 1;
    if (uses === 0 && kind !== 'type' && kind !== 'interface') {
      findings.push({
        category: 'simplicity-first',
        mark: 'warn',
        source: 'heuristic',
        message: `New export \`${name}\` is not used anywhere in this change — intended public API, or speculative?`,
        ref: `${line.file}:${line.line}`,
        action: `Remove \`${name}\` until something needs it, or show where it is used.`,
      });
    } else if (uses <= 1 && (kind === 'class' || LAYER_NAME.test(name))) {
      findings.push({
        category: 'simplicity-first',
        mark: 'warn',
        source: 'heuristic',
        message: `New abstraction \`${name}\` has a single use — would direct code be simpler?`,
        ref: `${line.file}:${line.line}`,
        action: `Inline \`${name}\` unless a second use or a real boundary justifies it.`,
      });
    }
  }
  if (input.mode === 'diff') {
    const added = input.changed.filter((c) => isSourceFile(c.path) && !isTestFile(c.path)).reduce((n, c) => n + c.additions, 0);
    if (added > 500) {
      findings.push({
        category: 'simplicity-first',
        mark: 'warn',
        source: 'heuristic',
        message: `${added} lines of source added — confirm every one is needed for the request`,
        action: 'Look for the smaller version of this change; if 200 lines would do, rewrite it.',
      });
    }
  }
  if (findings.length === 0) {
    findings.push({ category: 'simplicity-first', mark: 'pass', source: 'heuristic', message: 'No unused or single-use new abstractions detected' });
  }
  return findings;
}

function surgicalChanges(input: ReviewInput, scope?: string[]): Finding[] {
  if (input.mode === 'all') return [];
  const findings: Finding[] = [];
  for (const [file, n] of input.whitespaceOnly) {
    findings.push({
      category: 'surgical-changes',
      mark: 'warn',
      source: 'heuristic',
      message: `${n} changed line${n === 1 ? '' : 's'} differ only in whitespace or formatting`,
      ref: file,
      action: `Revert formatting-only edits in ${file} that the task did not need.`,
    });
  }
  const removedComments = input.removed.filter((r) => COMMENT_LINE.test(r.text) && r.text.trim().length > 3);
  const readded = new Set(input.lines.map((l) => l.text.trim()));
  const lost = removedComments.filter((r) => !readded.has(r.text.trim()));
  if (lost.length > 0) {
    const files = [...new Set(lost.map((r) => r.file))];
    findings.push({
      category: 'surgical-changes',
      mark: 'warn',
      source: 'heuristic',
      message: `${lost.length} existing comment line${lost.length === 1 ? ' was' : 's were'} removed`,
      detail: files.join(', '),
      action: 'Restore comments the change did not make obsolete.',
    });
  }
  if (!scope?.length) {
    const code = changedCode(input.changed);
    const primary = primaryArea(code);
    const outside = code.filter((c) => areaOf(c.path) !== primary && c.additions + c.deletions <= 20);
    if (primary && outside.length > 0) {
      findings.push({
        category: 'surgical-changes',
        mark: 'warn',
        source: 'heuristic',
        message: `${outside.length} small edit${outside.length === 1 ? '' : 's'} outside ${primary} — does every changed line trace to the request?`,
        detail: outside.map((c) => c.path).join(', '),
        action: 'Drop drive-by edits; mention unrelated problems instead of fixing them here.',
      });
    }
  }
  if (findings.length === 0) {
    findings.push({ category: 'surgical-changes', mark: 'pass', source: 'heuristic', message: 'No formatting churn, removed comments or drive-by edits detected' });
  }
  return findings;
}

function goalDriven(input: ReviewInput, ctx: KarpathyContext): Finding[] {
  const findings: Finding[] = [];
  const source = input.changed.filter((c) => isSourceFile(c.path) && !isTestFile(c.path));
  const tests = input.changed.filter((c) => isTestFile(c.path));
  const passed = ctx.verification.filter((f) => f.mark === 'pass');
  const failed = ctx.verification.filter((f) => f.mark === 'fail');
  // Without a diff, "changed" means nothing: report what exists instead.
  const testWord = input.mode === 'diff' ? 'changed' : 'in the codebase';
  if (failed.length > 0) {
    findings.push({ category: 'goal-driven', mark: 'fail', source: 'verification', message: `The success checks do not pass yet (${failed.length} failing)` });
  } else if (input.mode === 'diff' && source.length > 0 && tests.length === 0 && passed.length === 0) {
    findings.push({
      category: 'goal-driven',
      mark: 'warn',
      source: 'heuristic',
      message: 'Nothing in this change proves it works: no tests changed and no verification ran',
      action: 'Turn the request into a check (a failing test first), then make it pass.',
    });
  } else if (tests.length > 0 || passed.length > 0) {
    findings.push({
      category: 'goal-driven',
      mark: 'pass',
      source: 'heuristic',
      message: [tests.length ? `${tests.length} test file(s) ${testWord}` : '', passed.length ? `${passed.length} verification check(s) passed` : ''].filter(Boolean).join('; '),
    });
  }
  const text = [ctx.description, ctx.task].filter(Boolean).join('\n');
  if (text && !SUCCESS_CRITERIA.test(text)) {
    findings.push({
      category: 'goal-driven',
      mark: 'warn',
      source: 'heuristic',
      message: 'No success criteria are stated for this change',
      action: 'Write down what "done" means as checks: "X returns Y", "test Z passes".',
    });
  }
  return findings;
}

export function karpathyFindings(input: ReviewInput, ctx: KarpathyContext): { findings: Finding[]; unverified: string[] } {
  const think = thinkBeforeCoding(ctx);
  const goal = goalDriven(input, ctx);
  const unverified = [...think.unverified];
  if (goal.length === 0) unverified.push('Goal-Driven Execution: no source changes or checks to assess');
  if (input.mode === 'all') unverified.push('Surgical Changes: judged per change — review a diff rather than the whole codebase');
  return {
    findings: [...think.findings, ...simplicityFirst(input), ...surgicalChanges(input, ctx.scope), ...goal],
    unverified,
  };
}

export const KARPATHY_LENS = [
  'Apply the four Karpathy principles to this change:',
  '1. Think Before Coding — were assumptions stated, ambiguity surfaced and trade-offs named, or was an interpretation picked silently?',
  '2. Simplicity First — is this the minimum code that solves the problem? Flag speculative features, single-use abstractions, unrequested configurability, and handling for impossible cases.',
  '3. Surgical Changes — does every changed line trace to the request? Flag drive-by refactors, reformatting, rewritten comments and style changes.',
  '4. Goal-Driven Execution — are success criteria explicit and proven by tests or checks?',
  'Use categories "think-before-coding", "simplicity-first", "surgical-changes" and "goal-driven" for these findings.',
].join('\n');
