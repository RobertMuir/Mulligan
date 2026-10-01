import { tokens } from '../store.js';
import type { Evidence, MulliganMemory, Principle } from '../types.js';
import { detectSignals, snapshotProject, type Signal, type TopicKey } from './signals.js';
import { TOPICS, isTopicKey } from './topics.js';

export { detectSignals, snapshotProject, type ProjectSnapshot, type Signal, type TopicKey } from './signals.js';
export { TOPICS, type TopicInfo } from './topics.js';

export type MemoryRelation =
  /** Memory records the principle and the codebase shows it applied. */
  | 'stated-and-applied'
  /** Memory records the principle but the codebase does not yet follow it. */
  | 'stated-not-applied'
  | 'not-in-memory';

export interface ReviewItem {
  topic: string;
  title: string;
  summary: string;
  evidence: Evidence[];
  relation: MemoryRelation;
  principleIds: string[];
}

export interface UpskillingStep {
  title: string;
  detail?: string;
}

export interface UpskillingPlanEntry {
  gap: ReviewItem;
  steps: UpskillingStep[];
}

/** A cookbook rule that the codebase violates, passed in by the caller. */
export interface CookbookGapInput {
  ruleId: string;
  title: string;
  rule: string;
  count: number;
  evidence: Evidence[];
}

export interface MemReviewResult {
  strengths: ReviewItem[];
  gaps: ReviewItem[];
  /** Consistent practice not yet in memory — offered, never added automatically. */
  suggestedPrinciples: { topic: string; rule: string; evidence: Evidence[] }[];
  pendingCandidates: number;
  unconfirmedInference: Principle[];
  plan: UpskillingPlanEntry[];
}

function relatedPrinciples(memory: MulliganMemory, keywords: string[]): Principle[] {
  const wanted = new Set(keywords);
  return memory.principles.filter((p) => {
    const t = tokens(`${p.category} ${p.subject ?? ''} ${p.rule}`);
    let hits = 0;
    for (const k of wanted) if (t.has(k)) hits++;
    return hits >= 2 || (p.subject !== undefined && wanted.has(p.subject));
  });
}

function toItem(signal: Signal, memory: MulliganMemory): ReviewItem {
  const info = TOPICS[signal.topic];
  const principles = relatedPrinciples(memory, info.keywords);
  const relation: MemoryRelation =
    principles.length === 0 ? 'not-in-memory' : signal.polarity === 'strength' ? 'stated-and-applied' : 'stated-not-applied';
  return {
    topic: signal.topic,
    title: info.title,
    summary: signal.summary,
    evidence: signal.evidence,
    relation,
    principleIds: principles.map((p) => p.id),
  };
}

function planFor(gap: ReviewItem, info?: (typeof TOPICS)[TopicKey]): UpskillingStep[] {
  const target = (gap.evidence.find((e) => e.kind === 'code' && e.ref) ?? gap.evidence.find((e) => e.ref))?.ref;
  const learn = info?.learn ?? [
    `Re-read ${gap.title} and its rationale in .mulligan/cookbook/.`,
    'Find one example in the codebase that already follows the rule and compare.',
  ];
  return [
    ...learn.map((title) => ({ title })),
    { title: `${info?.apply ?? 'Fix one violation'}${target ? ` — start with ${target}` : ''}.` },
    { title: info?.test ?? 'Add a test that would fail if the violation came back.' },
    { title: 'Review the resulting implementation with Mulligan (/mulligan-review).' },
    {
      title: 'Add the resulting principle to Mulligan Memory if you accept it.',
      detail: info ? `Suggested wording: "${info.principle}"` : undefined,
    },
  ];
}

/**
 * Compares what Mulligan has learned against what the codebase contains
 * (spec §11–13). Educational, evidence-backed, and never a grade.
 */
export function reviewMemory(
  memory: MulliganMemory,
  signals: Signal[],
  cookbookGaps: CookbookGapInput[] = [],
): MemReviewResult {
  const strengths: ReviewItem[] = [];
  const gaps: ReviewItem[] = [];
  const suggestedPrinciples: MemReviewResult['suggestedPrinciples'] = [];

  for (const signal of signals) {
    const item = toItem(signal, memory);
    if (signal.polarity === 'strength') {
      strengths.push(item);
      if (item.relation === 'not-in-memory') {
        suggestedPrinciples.push({ topic: item.title, rule: TOPICS[signal.topic].principle, evidence: item.evidence });
      }
    } else {
      gaps.push(item);
    }
  }

  for (const c of cookbookGaps) {
    gaps.push({
      topic: `cookbook:${c.ruleId}`,
      title: `${c.ruleId} — ${c.title}`,
      summary: `Your cookbook says "${c.rule}", and the codebase has ${c.count} violation${c.count === 1 ? '' : 's'}.`,
      evidence: c.evidence,
      relation: 'stated-not-applied',
      principleIds: [c.ruleId],
    });
  }

  // Gaps where memory already holds the principle come first: you know it, it just isn't applied yet.
  gaps.sort((a, b) => Number(b.relation === 'stated-not-applied') - Number(a.relation === 'stated-not-applied'));

  return {
    strengths,
    gaps,
    suggestedPrinciples,
    pendingCandidates: memory.candidates.length,
    unconfirmedInference: memory.principles.filter((p) => p.source === 'mulligan_inference' && !p.confirmed),
    plan: gaps.map((gap) => ({
      gap,
      steps: planFor(gap, isTopicKey(gap.topic) ? TOPICS[gap.topic] : undefined),
    })),
  };
}

export async function runMemoryReview(
  root: string,
  memory: MulliganMemory,
  cookbookGaps: CookbookGapInput[] = [],
): Promise<MemReviewResult> {
  const snapshot = await snapshotProject(root);
  return reviewMemory(memory, detectSignals(snapshot), cookbookGaps);
}

const RELATION_NOTE: Record<MemoryRelation, string> = {
  'stated-and-applied': 'matches your Mulligan Memory',
  'stated-not-applied': 'you have recorded this principle, but the code does not follow it yet',
  'not-in-memory': 'not yet in your Mulligan Memory',
};

function evidenceLines(evidence: Evidence[]): string[] {
  return evidence.map((e) => `    · ${[e.ref, e.note].filter(Boolean).join(' — ')}`);
}

export function formatMemReview(result: MemReviewResult): string {
  const out: string[] = ['MULLIGANMEM REVIEW', ''];
  out.push('This is a learning aid, not a grade. Every point cites the evidence behind it.', '');

  out.push('KNOWN STRENGTHS');
  if (result.strengths.length === 0) out.push('  (no strengths could be evidenced from the codebase yet)');
  for (const s of result.strengths) {
    out.push(`  ✓ ${s.title} — ${s.summary}`, `    (${RELATION_NOTE[s.relation]}${s.principleIds.length ? `: ${s.principleIds.join(', ')}` : ''})`);
    out.push(...evidenceLines(s.evidence.slice(0, 2)));
  }
  out.push('');

  out.push('POTENTIAL GAPS');
  if (result.gaps.length === 0) out.push('  (no gaps identified by the available checks — this does not mean there are none)');
  result.gaps.forEach((g, i) => {
    out.push(`  ${i + 1}. ${g.title} — ${g.summary}`, `     (${RELATION_NOTE[g.relation]}${g.principleIds.length ? `: ${g.principleIds.join(', ')}` : ''})`);
    out.push(...evidenceLines(g.evidence));
  });
  out.push('');

  if (result.plan.length > 0) {
    out.push('UPSKILLING PLAN');
    result.plan.forEach((entry, i) => {
      out.push('', `Gap ${i + 1} — ${entry.gap.title}`, '', 'Why identified:', `  ${entry.gap.summary}`);
      entry.steps.forEach((step, n) => {
        out.push('', `Step ${n + 1}`, `  ${step.title}`);
        if (step.detail) out.push(`  ${step.detail}`);
      });
    });
    out.push('');
  }

  if (result.suggestedPrinciples.length > 0) {
    out.push('CONSISTENT PRACTICE NOT YET IN MEMORY');
    for (const s of result.suggestedPrinciples) out.push(`  • ${s.topic}: "${s.rule}"`);
    out.push('  Add any of these with /memory add if you agree.', '');
  }
  if (result.pendingCandidates > 0) {
    out.push(`${result.pendingCandidates} candidate lesson(s) await your decision — /memory candidates.`);
  }
  if (result.unconfirmedInference.length > 0) {
    out.push(`Unconfirmed Mulligan inferences in memory: ${result.unconfirmedInference.map((p) => p.id).join(', ')}.`);
  }
  out.push('', 'Not assessed by these checks: design quality, product fit, and anything the scanners cannot see.');
  return out.join('\n');
}
