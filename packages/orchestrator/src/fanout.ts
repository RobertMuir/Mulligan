import { addedLinesByFile, assessDifficulty, formatDifficulty, isTestFile, messageOf, readSourceFiles, type CandidateModel, type CommandRunner, type ConfiguredModelRouter, type DifficultyAssessment, type ModelProvider } from '@mulligan/core';
import { evaluateCookbook, type CookbookRule } from '@mulligan/cookbook';
import { pickAngles, type Angle } from './angles.js';
import { CHANGE_FORMAT, diffStats, parseChange, type DiffStats, type ProposedChange } from './change.js';
import { judgeCandidate } from './judge.js';
import type { Rubric } from './rubric.js';
import { DEFAULT_RUBRIC } from './rubric.js';
import { applyToSandbox, createSandbox, SandboxUnavailable } from './sandbox.js';

export interface FanOutOptions {
  root: string;
  task: string;
  /** Number of candidates. */
  count: number;
  router: ConfiguredModelRouter;
  rubric?: Rubric;
  /** System prompt for implementers: memory, cookbook, principles. The rubric is never included. */
  contextFor?: (task: string) => Promise<string>;
  /** Relevant code, already rendered. */
  codeContext?: string;
  angles?: Angle[];
  /** Approaches already rejected by the developer (from Mulligan taken). */
  rejectedApproaches?: string[];
  attempts?: number;
  safetyMode?: boolean;
  /** Apply each candidate in a sandbox and run these commands there. */
  verify?: { commands: Record<string, string>; runnerFor: (cwd: string) => CommandRunner };
  /** Independent judges per candidate. 0 disables judging (evidence-only scoring). */
  judges?: number;
  cookbookRules?: CookbookRule[];
  routingWeights?: Partial<Record<string, number>>;
  onProgress?: (message: string) => void;
}

export type Standing = 'eligible' | 'failed-verification' | 'disqualified' | 'errored';

export interface CriterionScore {
  /** Each judge's score. */
  judges: number[];
  /** Evidence adjustment applied on top of the judges' mean. */
  adjustment: number;
  final: number;
  notes: string[];
}

export interface Candidate {
  label: string;
  angle: Angle;
  provider: string;
  model: string;
  text: string;
  change: ProposedChange;
  error?: string;
  applied?: boolean;
  applyError?: string;
  diff: string;
  stats?: DiffStats;
  verification: { status: 'passed' | 'failed' | 'unverified'; results: { name: string; command: string; outcome: string }[]; note?: string };
  cookbook: { violations: number; serious: number };
  scores: Record<string, CriterionScore>;
  judgedBy: string[];
  total: number;
  standing: Standing;
}

export interface FanOutResult {
  task: string;
  difficulty: DifficultyAssessment;
  rubric: Rubric;
  candidates: Candidate[];
  recommended?: Candidate;
  notes: string[];
}

const LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Spreads candidates across distinct models, strongest capable models first. */
export function assignModels(pool: CandidateModel[], count: number, tier: number): CandidateModel[] {
  const capable = pool.filter((c) => c.capability >= tier);
  const ordered = [...(capable.length ? capable : pool)].sort((a, b) => b.capability - a.capability || a.cost - b.cost || a.name.localeCompare(b.name));
  return Array.from({ length: count }, (_, i) => ordered[i % ordered.length] ?? []).flat();
}

/** Judges for a candidate: strongest models that did not write it. */
export function pickJudges(pool: CandidateModel[], author: string, count: number): CandidateModel[] {
  const sorted = [...pool].sort((a, b) => b.capability - a.capability || a.cost - b.cost);
  const others = sorted.filter((c) => c.name !== author);
  return (others.length ? others : sorted).slice(0, count);
}

function implementerPrompt(task: string, angle: Angle, rejected: string[], codeContext?: string): string {
  return [
    `TASK:\n${task}`,
    `YOUR ANGLE — ${angle.name}:\n${angle.brief}`,
    rejected.length ? `The developer already rejected these approaches. Do something fundamentally different:\n${rejected.map((r) => `- ${r}`).join('\n')}` : '',
    codeContext ? `CODEBASE:\n${codeContext}` : '',
    CHANGE_FORMAT,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function clampScore(n: number): number {
  return Math.min(5, Math.max(1, Math.round(n * 10) / 10));
}

/** Hard evidence nudges the judges' view; it never replaces reading the code. */
export function evidenceAdjustments(c: Candidate, all: Candidate[]): Record<string, { delta: number; note: string }[]> {
  const out: Record<string, { delta: number; note: string }[]> = {};
  const add = (criterion: string, delta: number, note: string): void => {
    (out[criterion] ??= []).push({ delta, note });
  };
  const sizes = all.flatMap((x) => (x.applied && x.stats ? [x.stats.added] : []));
  const smallest = sizes.length ? Math.min(...sizes) : 0;
  if (c.stats && smallest > 0) {
    const ratio = c.stats.added / smallest;
    if (ratio >= 3) add('simplicity-first', -1, `${c.stats.added} lines added, ${ratio.toFixed(1)}× the smallest candidate`);
    else if (ratio >= 2) add('simplicity-first', -0.5, `${c.stats.added} lines added, ${ratio.toFixed(1)}× the smallest candidate`);
  }
  if (c.stats) {
    const othersFiles = new Set(all.filter((x) => x !== c).flatMap((x) => x.stats?.files ?? []));
    const unique = c.stats.files.filter((f) => !othersFiles.has(f) && !isTestFile(f));
    if (all.length > 1 && othersFiles.size > 0 && unique.length > 0) add('surgical-changes', -0.5, `touches files no other candidate needed: ${unique.join(', ')}`);
    if (c.stats.testsTouched) add('goal-driven', 0.5, 'includes tests');
  }
  if (c.verification.status === 'passed') {
    add('goal-driven', 1, 'verification passed in the sandbox');
    add('correctness', 0.5, 'verification passed in the sandbox');
  } else if (c.verification.status === 'failed') {
    add('correctness', -2, 'verification failed in the sandbox');
  } else if (!c.stats?.testsTouched) {
    add('goal-driven', -1, 'no tests and no verification');
  }
  if (!c.change.successCriteria) add('goal-driven', -0.5, 'no success criteria stated');
  if (!c.change.assumptions) add('think-before-coding', -0.5, 'no assumptions stated');
  if (c.cookbook.serious > 0) add('standards', -Math.min(2, c.cookbook.serious), `${c.cookbook.serious} high/blocking cookbook violation(s) in new lines`);
  else if (c.cookbook.violations > 0) add('standards', -0.5, `${c.cookbook.violations} cookbook violation(s) in new lines`);
  return out;
}

export function scoreCandidate(c: Candidate, rubric: Rubric, all: Candidate[]): void {
  const adjustments = evidenceAdjustments(c, all);
  const weightTotal = rubric.criteria.reduce((n, k) => n + k.weight, 0);
  let weighted = 0;
  for (const criterion of rubric.criteria) {
    const existing = c.scores[criterion.id] ?? { judges: [], adjustment: 0, final: 3, notes: [] };
    const base = existing.judges.length ? existing.judges.reduce((a, b) => a + b, 0) / existing.judges.length : 3;
    const adj = adjustments[criterion.id] ?? [];
    const delta = adj.reduce((n, a) => n + a.delta, 0);
    const final = clampScore(base + delta);
    c.scores[criterion.id] = { judges: existing.judges, adjustment: delta, final, notes: [...existing.notes, ...adj.map((a) => a.note)] };
    weighted += criterion.weight * ((final - 1) / 4);
  }
  c.total = Math.round((weighted / weightTotal) * 100);
}

function standingRank(s: Standing): number {
  return { eligible: 0, 'failed-verification': 1, disqualified: 2, errored: 3 }[s];
}

/**
 * The Mulligan fan-out: N models attack the task from different angles, each
 * candidate is applied and verified in isolation, blind judges score it
 * against the private rubric, and hard evidence adjusts the scores. The
 * result is a ranking with reasons. The developer picks.
 */
export async function fanOut(options: FanOutOptions): Promise<FanOutResult> {
  const progress = options.onProgress ?? (() => undefined);
  const rubric = options.rubric ?? DEFAULT_RUBRIC;
  const notes: string[] = [];
  const difficulty = assessDifficulty(
    { description: options.task, attempts: options.attempts, safetyMode: options.safetyMode },
    'implementer',
    options.routingWeights,
  );
  const pool = options.router.candidates();
  if (pool.length === 0) throw new Error('No ready models to fan out to. Configure a provider or start a local model (/models discover).');
  if (new Set(pool.map((p) => p.name)).size === 1) notes.push('Only one model is ready: candidates differ by angle only, and the judge is grading its own family.');

  const angles = options.angles ?? pickAngles(options.count);
  // One slot per candidate: a model, an angle and a label.
  const slots = assignModels(pool, options.count, difficulty.tier).flatMap((model, i) => {
    const angle = angles[i % angles.length];
    return angle ? [{ model, angle, label: LABELS.charAt(i) }] : [];
  });
  const system = options.contextFor ? await options.contextFor(options.task) : undefined;
  progress(`${formatDifficulty(difficulty)} — fanning out to ${slots.length}: ${slots.map((s) => `${s.label}=${s.model.name}/${s.angle.id}`).join(', ')}`);

  // 1. Generate candidates in parallel.
  const candidates: Candidate[] = await Promise.all(
    slots.map(async ({ model: m, angle, label }): Promise<Candidate> => {
      const provider: ModelProvider = options.router.provider(m.name);
      const base = {
        label,
        angle,
        provider: m.name,
        model: provider.model,
        diff: '',
        verification: { status: 'unverified' as const, results: [] },
        cookbook: { violations: 0, serious: 0 },
        scores: {},
        judgedBy: [],
        total: 0,
      };
      try {
        const result = await provider.complete({
          ...(system ? { system } : {}),
          messages: [{ role: 'user', content: implementerPrompt(options.task, angle, options.rejectedApproaches ?? [], options.codeContext) }],
          maxTokens: 16_000,
        });
        return { ...base, text: result.text, change: parseChange(result.text), standing: 'eligible' };
      } catch (error) {
        return { ...base, text: '', change: parseChange(''), error: messageOf(error), standing: 'errored' };
      }
    }),
  );
  progress(`${candidates.filter((c) => !c.error).length}/${candidates.length} candidates returned`);

  // 2. Apply and verify each candidate in its own sandbox (one at a time: checks can be heavy).
  for (const c of candidates) {
    if (c.error) continue;
    let sandbox;
    try {
      sandbox = await createSandbox(options.root);
    } catch (error) {
      if (error instanceof SandboxUnavailable) {
        c.verification.note = error.message;
        c.applied = c.change.files.length > 0 || Boolean(c.change.diff);
        c.diff = c.change.diff ?? '';
        if (c.diff) c.stats = diffStats(c.diff);
        continue;
      }
      throw error;
    }
    try {
      const applied = await applyToSandbox(sandbox, c.change);
      c.applied = applied.applied;
      c.diff = applied.diff;
      if (!applied.applied) {
        c.applyError = applied.error;
        if (rubric.gates.mustApply) c.standing = 'disqualified';
        progress(`${c.label}: does not apply (${applied.error})`);
        continue;
      }
      c.stats = diffStats(applied.diff);
      if (options.cookbookRules?.length) {
        const added = addedLinesByFile(applied.diff);
        const files = await readSourceFiles(sandbox.dir, [...added.keys()]);
        const { violations } = evaluateCookbook(options.cookbookRules, files, { scopeLines: added });
        c.cookbook = { violations: violations.length, serious: violations.filter((v) => v.severity === 'blocking' || v.severity === 'high').length };
      }
      if (options.verify && Object.keys(options.verify.commands).length > 0) {
        const runner = options.verify.runnerFor(sandbox.dir);
        let failed = false;
        let ran = 0;
        for (const [name, command] of Object.entries(options.verify.commands)) {
          const outcome = await runner.run(command, { purpose: `Verify candidate ${c.label} (${name}) in an isolated worktree` });
          if (outcome.status === 'completed') {
            ran++;
            if (outcome.exitCode !== 0) failed = true;
            c.verification.results.push({ name, command, outcome: outcome.exitCode === 0 ? 'passed' : `failed (exit ${outcome.exitCode})` });
          } else {
            c.verification.results.push({ name, command, outcome: outcome.status });
          }
        }
        c.verification.status = failed ? 'failed' : ran > 0 ? 'passed' : 'unverified';
        if (failed && rubric.gates.mustPassVerification) c.standing = 'failed-verification';
        progress(`${c.label}: ${c.verification.status}`);
      } else {
        c.verification.note = 'no verification commands configured';
      }
    } finally {
      await sandbox.cleanup();
    }
  }

  // 3. Blind cross-judging.
  const judgeCount = options.judges ?? 1;
  if (judgeCount > 0) {
    await Promise.all(
      candidates
        .filter((c) => !c.error && c.standing !== 'disqualified')
        .map(async (c) => {
          for (const judge of pickJudges(pool, c.provider, judgeCount)) {
            const scores = await judgeCandidate(options.router.provider(judge.name), rubric, options.task, c.label, c.change, c.diff, {
              applied: Boolean(c.applied),
              verification: c.verification.status,
              linesAdded: c.stats?.added ?? 0,
              filesTouched: c.stats?.files.length ?? 0,
              testsTouched: Boolean(c.stats?.testsTouched),
              cookbookViolations: c.cookbook.violations,
            });
            if (!scores) continue;
            c.judgedBy.push(judge.name);
            for (const s of scores) {
              const entry = (c.scores[s.criterion] ??= { judges: [], adjustment: 0, final: 3, notes: [] });
              entry.judges.push(s.score);
              entry.notes.push(`${judge.name}: ${s.reason}`);
            }
          }
        }),
    );
  } else {
    notes.push('Judging disabled: scores come from evidence only.');
  }
  if (candidates.every((c) => c.judgedBy.length === 0) && judgeCount > 0) notes.push('No judge returned usable scores: ranking uses evidence only.');

  // 4. Score and rank.
  for (const c of candidates) if (!c.error) scoreCandidate(c, rubric, candidates);
  candidates.sort((a, b) => standingRank(a.standing) - standingRank(b.standing) || b.total - a.total || a.label.localeCompare(b.label));
  const recommended = candidates.find((c) => c.standing === 'eligible');
  if (!recommended) notes.push('No candidate cleared the gates. Consider reframing the task before another fan-out.');
  const [first, second] = candidates.filter((c) => c.standing === 'eligible');
  if (first && second && first.total - second.total <= 3) {
    notes.push(`${first.label} and ${second.label} are within 3 points: read both before choosing.`);
  }
  return { task: options.task, difficulty, rubric, candidates, ...(recommended ? { recommended } : {}), notes };
}
