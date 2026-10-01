import type { Conflict } from '@mulligan/memory';

/** The four Karpathy principles. Always shown first in a review. */
export const KARPATHY_CATEGORIES = {
  'think-before-coding': 'THINK BEFORE CODING',
  'simplicity-first': 'SIMPLICITY FIRST',
  'surgical-changes': 'SURGICAL CHANGES',
  'goal-driven': 'GOAL-DRIVEN EXECUTION',
} as const;

export const REVIEW_CATEGORIES = {
  correctness: 'CORRECTNESS',
  architecture: 'ARCHITECTURE',
  typescript: 'TYPESCRIPT',
  javascript: 'JAVASCRIPT',
  react: 'REACT',
  'react-native': 'REACT NATIVE',
  testing: 'TESTING',
  security: 'SECURITY',
  performance: 'PERFORMANCE',
  accessibility: 'ACCESSIBILITY',
  maintainability: 'MAINTAINABILITY',
  'error-handling': 'ERROR HANDLING',
  observability: 'OBSERVABILITY',
  dependencies: 'DEPENDENCIES',
  documentation: 'DOCUMENTATION',
  'blast-radius': 'BLAST RADIUS',
  'pr-quality': 'PR QUALITY',
  'project-standards': 'PROJECT-SPECIFIC STANDARDS',
  'memory-alignment': 'MULLIGAN MEMORY ALIGNMENT',
} as const;

/** Safety mode additions (spec §19): extra categories for work that needs stricter accountability. */
export const SAFETY_CATEGORIES = {
  traceability: 'TRACEABILITY',
  'data-integrity': 'DATA INTEGRITY',
  'failure-modes': 'FAILURE MODES',
  auditability: 'AUDITABILITY',
  'risk-controls': 'RISK CONTROLS',
  reproducibility: 'REPRODUCIBILITY',
  'change-control': 'CHANGE CONTROL',
} as const;

export type KarpathyKey = keyof typeof KARPATHY_CATEGORIES;
export type CategoryKey = KarpathyKey | keyof typeof REVIEW_CATEGORIES | keyof typeof SAFETY_CATEGORIES;

export const CATEGORY_LABELS: Record<CategoryKey, string> = { ...KARPATHY_CATEGORIES, ...REVIEW_CATEGORIES, ...SAFETY_CATEGORIES };

export const isKarpathyKey = (key: string): key is KarpathyKey => key in KARPATHY_CATEGORIES;
export const isCategoryKey = (key: string): key is CategoryKey => key in CATEGORY_LABELS;

export type Mark = 'pass' | 'warn' | 'fail' | 'not-assessed';

export type FindingSource = 'cookbook' | 'memory' | 'golden-pr' | 'verification' | 'heuristic' | 'model' | 'hierarchy';

export interface Finding {
  category: CategoryKey;
  mark: Exclude<Mark, 'not-assessed'>;
  message: string;
  source: FindingSource;
  ref?: string;
  ruleId?: string;
  action?: string;
  /** Blocking findings stop a PR. Only project rules and evidence may block — never model opinion. */
  blocking?: boolean;
  detail?: string;
}

export interface CategoryResult {
  key: CategoryKey;
  label: string;
  mark: Mark;
  findings: Finding[];
}

export type ReviewStatus = 'BLOCKING ISSUES' | 'CHANGES REQUIRE ATTENTION' | 'NO BLOCKING ISSUES IDENTIFIED';

export interface ReviewReport {
  status: ReviewStatus;
  scope: { mode: 'diff' | 'all'; against?: string; files: number };
  categories: CategoryResult[];
  notAssessed: CategoryKey[];
  unverified: string[];
  humanReviewAreas: string[];
  actions: string[];
  conflicts: Conflict[];
  preexistingViolations: number;
  allowedViolations: number;
  generatedAt: string;
}
