import type { AgentRole, TaskContext } from './types.js';

export interface DifficultyFactor {
  name: string;
  points: number;
  detail: string;
}

export interface DifficultyAssessment {
  /** 0–100. */
  score: number;
  /** 1–5: the minimum model capability this task should get. */
  tier: 1 | 2 | 3 | 4 | 5;
  factors: DifficultyFactor[];
}

/**
 * Points each factor contributes. Every weight can be overridden in
 * `.mulligan/config.yaml` under models.routing.weights, so a team can tune
 * routing to its own experience instead of trusting these defaults.
 */
export const DEFAULT_DIFFICULTY_WEIGHTS = {
  base: 20,
  architecture: 15,
  concurrency: 15,
  security: 15,
  dataIntegrity: 10,
  performance: 10,
  ambiguity: 5,
  trivial: -15,
  filesFew: 5,
  filesSeveral: 12,
  filesMany: 20,
  largeChange: 10,
  safetyMode: 15,
  perAttempt: 10,
  maxAttempts: 30,
  roleArchitect: 10,
  roleReviewer: 5,
  roleTeacher: -5,
  roleWriter: -10,
} as const;

export type DifficultyWeights = Record<keyof typeof DEFAULT_DIFFICULTY_WEIGHTS, number>;

const SIGNALS: { key: keyof DifficultyWeights; label: string; pattern: RegExp }[] = [
  { key: 'architecture', label: 'architecture or cross-cutting design', pattern: /\b(architect\w*|redesign|cross-cutting|module boundar\w*|public api|plugin system|framework|re-?structure)\b/i },
  { key: 'concurrency', label: 'concurrency', pattern: /\b(race|concurren\w*|deadlock|lock(ing)?|thread\w*|parallel|async(hronous)? (queue|job)|retr(y|ies)|idempoten\w*)\b/i },
  { key: 'security', label: 'security-sensitive', pattern: /\b(auth\w*|security|crypto\w*|encrypt\w*|permission\w*|token|secret|injection|xss|csrf|sanitiz\w*)\b/i },
  { key: 'dataIntegrity', label: 'data integrity', pattern: /\b(migrat\w*|schema|transaction\w*|database|consisten\w*|sync(hroni[sz]\w*)?|offline)\b/i },
  { key: 'performance', label: 'performance', pattern: /\b(perf(ormance)?|latency|throughput|optimi[sz]\w*|memory leak|slow)\b/i },
  { key: 'ambiguity', label: 'open-ended or investigative', pattern: /\b(not sure|figure out|investigate|why does|unclear|somehow|explore)\b/i },
  { key: 'trivial', label: 'mechanical or trivial', pattern: /\b(typo|rename|bump|readme|copy ?change|format(ting)?|comment|lint fix|spelling)\b/i },
];

const ROLE_FACTOR: Partial<Record<AgentRole, keyof DifficultyWeights>> = {
  architect: 'roleArchitect',
  reviewer: 'roleReviewer',
  teacher: 'roleTeacher',
  'technical-writer': 'roleWriter',
};

/**
 * Transparent, rule-based difficulty weighting. Every point is attributed to
 * a named factor so the routing decision can always be explained.
 */
export function assessDifficulty(task: TaskContext, role?: AgentRole, overrides: Partial<Record<string, number>> = {}): DifficultyAssessment {
  // Overrides come from config: a known key replaces its default, anything else is ignored.
  const w = (key: keyof DifficultyWeights): number => overrides[key] ?? DEFAULT_DIFFICULTY_WEIGHTS[key];
  const factors: DifficultyFactor[] = [{ name: 'base', points: w('base'), detail: 'starting point' }];
  const text = task.description;

  for (const s of SIGNALS) {
    const m = s.pattern.exec(text);
    if (m) factors.push({ name: s.key, points: w(s.key), detail: `${s.label} ("${m[0]}")` });
  }

  const files = task.files?.length ?? 0;
  if (files >= 16) factors.push({ name: 'filesMany', points: w('filesMany'), detail: `${files} files` });
  else if (files >= 6) factors.push({ name: 'filesSeveral', points: w('filesSeveral'), detail: `${files} files` });
  else if (files >= 2) factors.push({ name: 'filesFew', points: w('filesFew'), detail: `${files} files` });

  if ((task.linesChanged ?? 0) > 500) factors.push({ name: 'largeChange', points: w('largeChange'), detail: `~${task.linesChanged} lines` });
  if (task.safetyMode) factors.push({ name: 'safetyMode', points: w('safetyMode'), detail: 'Safety mode' });
  if (task.attempts && task.attempts > 0) {
    factors.push({
      name: 'attempts',
      points: Math.min(w('maxAttempts'), task.attempts * w('perAttempt')),
      detail: `${task.attempts} Mulligan${task.attempts === 1 ? '' : 's'} already taken`,
    });
  }
  const roleKey = role ? ROLE_FACTOR[role] : undefined;
  if (roleKey) factors.push({ name: roleKey, points: w(roleKey), detail: `${role} role` });

  const score = Math.max(0, Math.min(100, factors.reduce((sum, f) => sum + f.points, 0)));
  return { score, tier: tierFor(score), factors };
}

function tierFor(score: number): DifficultyAssessment['tier'] {
  if (score < 20) return 1;
  if (score < 40) return 2;
  if (score < 60) return 3;
  if (score < 80) return 4;
  return 5;
}

export function formatDifficulty(a: DifficultyAssessment): string {
  const parts = a.factors.filter((f) => f.name !== 'base').map((f) => `${f.points >= 0 ? '+' : ''}${f.points} ${f.detail}`);
  return `difficulty ${a.score}/100 → tier ${a.tier}${parts.length ? ` (${parts.join(', ')})` : ''}`;
}
