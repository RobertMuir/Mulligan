export const COOKBOOK_CATEGORIES = [
  'typescript',
  'javascript',
  'react',
  'react-native',
  'testing',
  'architecture',
  'security',
  'documentation',
  'pull-requests',
  'ai-guardrails',
] as const;

export type CookbookCategory = (typeof COOKBOOK_CATEGORIES)[number];

export const CATEGORY_PREFIX: Record<CookbookCategory, string> = {
  typescript: 'TS',
  javascript: 'JS',
  react: 'RE',
  'react-native': 'RN',
  testing: 'TEST',
  architecture: 'ARCH',
  security: 'SEC',
  documentation: 'DOC',
  'pull-requests': 'PR',
  'ai-guardrails': 'AI',
};

/** `blocking` stops a PR; `high` requires attention; `medium`/`low` are advisory. */
export type Severity = 'blocking' | 'high' | 'medium' | 'low';

export const BUILTIN_CHECKS = [
  'no-explicit-any',
  'no-non-null-assertion',
  'no-empty-catch',
  'no-ts-ignore',
  'no-console',
  'no-default-export',
  'no-index-key',
  'max-file-lines',
] as const;

export type BuiltinCheckName = (typeof BUILTIN_CHECKS)[number];

export type RuleCheck =
  | { type: 'builtin'; name: BuiltinCheckName; options?: Record<string, unknown>; files?: string[] }
  | { type: 'pattern'; pattern: string; flags?: string; files?: string[]; message?: string };

export interface CookbookRule {
  id: string;
  title: string;
  category: string;
  severity: Severity;
  rule: string;
  preferred?: string[];
  prohibited?: string[];
  exceptions?: string[];
  rationale?: string;
  /** Machine check. Rules without one need human or model judgement. */
  check?: RuleCheck;
  /** The AI must ask before changing anything this rule covers. */
  ai_must_ask?: boolean;
  /** `starter` rules were adopted from Mulligan's suggestions; `team` rules came from the interview. */
  origin?: 'team' | 'starter';
}

export interface CookbookFile {
  category: string;
  /** Free-text philosophy: "What does excellent X look like to you?" */
  philosophy?: string;
  rules: CookbookRule[];
}

export interface Cookbook {
  files: CookbookFile[];
  rules: CookbookRule[];
}
