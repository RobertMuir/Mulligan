/**
 * The golden standards hierarchy (spec §24).
 *
 * When two principles conflict, the higher-level rule wins. This prevents a
 * model's generic preference from overriding an explicit project requirement.
 * Order matters: index 0 is the highest authority.
 */
export const STANDARDS_HIERARCHY = [
  'human_instruction',
  'regulatory',
  'project_cookbook',
  'project_architecture',
  'mulligan_memory',
  'golden_pr',
  'framework_best_practice',
  'general_best_practice',
  'model_preference',
] as const;

export type StandardLevel = (typeof STANDARDS_HIERARCHY)[number];

export const STANDARD_LEVEL_LABELS: Record<StandardLevel, string> = {
  human_instruction: 'Human explicit instruction',
  regulatory: 'Regulatory/safety requirement',
  project_cookbook: 'Project coding cookbook',
  project_architecture: 'Project architecture',
  mulligan_memory: 'Mulligan Memory',
  golden_pr: 'Golden PR patterns',
  framework_best_practice: 'Framework best practice',
  general_best_practice: 'General engineering best practice',
  model_preference: 'Model preference',
};

/** 1-based rank; a lower number is a higher authority. */
export function rankOf(level: StandardLevel): number {
  return STANDARDS_HIERARCHY.indexOf(level) + 1;
}

/** Positive stances endorse a subject; negative stances discourage it. */
export const STANCES = ['prefer', 'require', 'avoid', 'prohibit'] as const;
export type Stance = (typeof STANCES)[number];
export const isStance = (value: unknown): value is Stance => STANCES.some((s) => s === value);

export function isPositiveStance(stance: Stance): boolean {
  return stance === 'prefer' || stance === 'require';
}

/**
 * A normalised statement from any source in the hierarchy, used to detect
 * conflicts between memory, cookbook, golden PRs and architecture.
 */
export interface Directive {
  level: StandardLevel;
  /** Source identifier, e.g. MM-003, TS-001, GP-002. */
  id: string;
  /** Normalised topic key, e.g. "global-state-store". */
  subject: string;
  stance: Stance;
  statement: string;
}

export function normaliseSubject(subject: string): string {
  return subject
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
