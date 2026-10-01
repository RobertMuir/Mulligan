import type { Stance } from '@mulligan/core';

/** Where a memory entry came from (spec §10). */
export const MEMORY_SOURCES = [
  'human_accepted',
  'human_rejected',
  'human_correction',
  'golden_pr',
  'coding_cookbook',
  'architecture_decision',
  'review_feedback',
  'external_standard',
  'mulligan_inference',
] as const;

export type MemorySource = (typeof MEMORY_SOURCES)[number];

export const CONFIDENCE_LEVELS = ['high', 'medium', 'low', 'candidate'] as const;
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

export const PREFERENCE_LEVELS = ['strong', 'moderate', 'weak'] as const;
export type Preference = (typeof PREFERENCE_LEVELS)[number];

/**
 * - `stated`: the wording came from a human (a review comment, a correction).
 * - `inferred`: Mulligan generalised the wording from a decision.
 */
export type Derivation = 'stated' | 'inferred';

export type MemoryScope = 'project' | 'personal';

export interface Evidence {
  kind: string;
  ref?: string;
  note?: string;
  date?: string;
}

/**
 * An engineering principle — learned preference, not absolute truth (spec §4).
 */
export interface Principle {
  id: string;
  category: string;
  rule: string;
  reasoning?: string;
  context?: { area?: string; pattern?: string };
  decision?: { rejected?: string; accepted?: string };
  /** Optional structured form, used for conflict detection across the hierarchy. */
  subject?: string;
  stance?: Stance;
  preference: Preference;
  confidence: Confidence;
  source: MemorySource;
  derivation: Derivation;
  /** True once a human has explicitly confirmed this principle. */
  confirmed: boolean;
  evidence: Evidence[];
  scope: MemoryScope;
  /** Situations in which the principle is known not to apply. */
  exceptions?: string[];
  created: string;
  updated?: string;
}

export interface RejectedLesson {
  id: string;
  rule: string;
  rejected_on: string;
  reason?: string;
}

export interface MulliganMemory {
  version: 1;
  project: { name: string };
  /** Confirmed principles that guide future work. */
  principles: Principle[];
  /** Proposed lessons awaiting a human decision. */
  candidates: Principle[];
  /** Lessons a human declined — kept so they are not proposed again. */
  rejected: RejectedLesson[];
}

export function emptyMemory(projectName: string): MulliganMemory {
  return { version: 1, project: { name: projectName }, principles: [], candidates: [], rejected: [] };
}
