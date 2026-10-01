import { extractJson, isStance, normaliseSubject, stringField, today, type ModelProvider } from '@mulligan/core';
import type { NewLesson } from './store.js';
import type { Evidence, MemorySource } from './types.js';

/** A human decision on an implementation attempt (spec §5–6). */
export interface DecisionRecord {
  outcome: 'accepted' | 'rejected' | 'modified';
  task: string;
  /** Summary of what was implemented. */
  approach?: string;
  alternativesRejected?: string[];
  /** The human's own words on why. This is the most valuable signal. */
  humanReason?: string;
  /** For `modified`: what the human changed. */
  correction?: string;
  category?: string;
  ref?: string;
}

const OUTCOME_SOURCE: Record<DecisionRecord['outcome'], MemorySource> = {
  accepted: 'human_accepted',
  rejected: 'human_rejected',
  modified: 'human_correction',
};

function decisionEvidence(decision: DecisionRecord): Evidence[] {
  const evidence: Evidence[] = [
    { kind: OUTCOME_SOURCE[decision.outcome], date: today(), note: decision.task, ...(decision.ref ? { ref: decision.ref } : {}) },
  ];
  if (decision.humanReason) evidence.push({ kind: 'human_reason', note: decision.humanReason });
  if (decision.correction) evidence.push({ kind: 'human_correction', note: decision.correction });
  return evidence;
}

/**
 * Deterministic extraction: keeps the human's own words as the lesson.
 * Used when no model is available, and as a fallback when a model fails.
 */
export function extractLessons(decision: DecisionRecord): NewLesson[] {
  const statement = decision.correction ?? decision.humanReason;
  if (!statement) return [];
  const rule =
    decision.outcome === 'rejected' && decision.approach
      ? `Reconsider "${decision.approach}": ${statement}`
      : statement;
  return [
    {
      category: decision.category ?? 'general',
      rule,
      reasoning: decision.humanReason,
      decision:
        decision.outcome === 'rejected'
          ? { rejected: decision.approach }
          : { accepted: decision.approach, rejected: decision.alternativesRejected?.join('; ') },
      preference: 'moderate',
      source: OUTCOME_SOURCE[decision.outcome],
      derivation: 'stated',
      evidence: decisionEvidence(decision),
      scope: 'project',
    },
  ];
}

export function buildExtractionPrompt(decision: DecisionRecord): { system: string; user: string } {
  return {
    system: [
      'You extract engineering principles from a developer\'s decision on an AI implementation.',
      'Derive the underlying principle, not a copy of the code. Do not overgeneralise from one decision:',
      'include the condition under which the principle applies ("Prefer X when Y").',
      'If the decision does not reveal a reusable principle, return an empty array.',
      'Respond with JSON only: an array of at most 3 objects with keys',
      'category, rule, reasoning, subject (short kebab-case topic), stance (prefer|avoid|require|prohibit),',
      'generality (general|project-specific).',
    ].join(' '),
    user: JSON.stringify(decision, null, 2),
  };
}

/**
 * Model-assisted extraction. The resulting wording is Mulligan's, so lessons
 * are marked `inferred` and remain candidates until a human confirms them.
 */
export async function extractLessonsWithModel(decision: DecisionRecord, model: ModelProvider): Promise<NewLesson[]> {
  const prompt = buildExtractionPrompt(decision);
  let parsed: unknown;
  try {
    const result = await model.complete({ system: prompt.system, messages: [{ role: 'user', content: prompt.user }], maxTokens: 1200 });
    parsed = extractJson(result.text);
  } catch {
    parsed = undefined;
  }
  if (!Array.isArray(parsed)) return extractLessons(decision);
  return parsed.flatMap((item): NewLesson[] => {
    const rule = stringField(item, 'rule')?.trim();
    if (!rule) return [];
    const subject = stringField(item, 'subject');
    const stance = stringField(item, 'stance');
    return [
      {
        category: stringField(item, 'category') ?? decision.category ?? 'general',
        rule,
        reasoning: stringField(item, 'reasoning') ?? decision.humanReason,
        decision: decision.outcome === 'rejected' ? { rejected: decision.approach } : { accepted: decision.approach },
        ...(subject ? { subject: normaliseSubject(subject) } : {}),
        // Model output is untrusted: an unknown stance is dropped rather than written to memory.
        ...(isStance(stance) ? { stance } : {}),
        preference: 'moderate',
        source: OUTCOME_SOURCE[decision.outcome],
        derivation: 'inferred',
        evidence: [
          ...decisionEvidence(decision),
          { kind: 'model_generalisation', note: `${model.name} (${model.model}); ${stringField(item, 'generality') ?? 'general'}` },
        ],
        scope: 'project',
      },
    ];
  });
}
