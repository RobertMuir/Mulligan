import type { Confidence, Derivation, MemorySource, Principle } from './types.js';

/**
 * Relative weight of each source. Mulligan must never present its own
 * inference as equivalent to a human correction (spec §10).
 */
export const SOURCE_WEIGHT: Record<MemorySource, number> = {
  human_correction: 100,
  human_rejected: 90,
  human_accepted: 90,
  architecture_decision: 85,
  coding_cookbook: 85,
  review_feedback: 70,
  golden_pr: 60,
  external_standard: 50,
  mulligan_inference: 10,
};

export const SOURCE_LABELS: Record<MemorySource, string> = {
  human_correction: 'Human correction',
  human_rejected: 'Human rejected an implementation',
  human_accepted: 'Human accepted an implementation',
  architecture_decision: 'Architecture decision',
  coding_cookbook: 'Coding cookbook',
  review_feedback: 'PR review feedback',
  golden_pr: 'Golden PR pattern',
  external_standard: 'External standard',
  mulligan_inference: 'Mulligan inference',
};

const CONFIDENCE_ORDER: Confidence[] = ['candidate', 'low', 'medium', 'high'];

/**
 * The highest confidence a principle may hold before a human confirms it.
 * Unconfirmed lessons are always candidates (spec §6–7); after confirmation,
 * pure model inference still cannot claim high confidence.
 */
export function maxConfidence(source: MemorySource, derivation: Derivation, confirmed: boolean): Confidence {
  if (!confirmed) return 'candidate';
  if (source === 'mulligan_inference') return 'medium';
  if (derivation === 'inferred' && SOURCE_WEIGHT[source] < SOURCE_WEIGHT.human_accepted) return 'medium';
  return 'high';
}

export function capConfidence(requested: Confidence, ceiling: Confidence): Confidence {
  return CONFIDENCE_ORDER.indexOf(requested) <= CONFIDENCE_ORDER.indexOf(ceiling) ? requested : ceiling;
}

export function describeProvenance(principle: Principle): string {
  const parts = [SOURCE_LABELS[principle.source]];
  parts.push(principle.derivation === 'stated' ? 'wording stated by a human' : 'wording generalised by Mulligan');
  parts.push(principle.confirmed ? 'confirmed by developer' : 'NOT confirmed by developer');
  return parts.join(' · ');
}

export interface ProvenanceIssue {
  id: string;
  message: string;
}

/** Flags hand-edits that overstate how much a principle should be trusted. */
export function auditProvenance(principles: Principle[]): ProvenanceIssue[] {
  const issues: ProvenanceIssue[] = [];
  for (const p of principles) {
    const ceiling = maxConfidence(p.source, p.derivation, p.confirmed);
    if (capConfidence(p.confidence, ceiling) !== p.confidence) {
      issues.push({
        id: p.id,
        message: `${p.id} claims "${p.confidence}" confidence but ${SOURCE_LABELS[p.source].toLowerCase()} (${
          p.confirmed ? 'confirmed' : 'unconfirmed'
        }, ${p.derivation}) supports at most "${ceiling}".`,
      });
    }
    if (p.evidence.length === 0) {
      issues.push({ id: p.id, message: `${p.id} has no recorded evidence.` });
    }
  }
  return issues;
}
