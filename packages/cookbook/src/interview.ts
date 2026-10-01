import { CATEGORY_PREFIX, type CookbookCategory, type CookbookFile, type CookbookRule, type Severity } from './types.js';

export type QuestionKey =
  | 'philosophy'
  | 'prohibited'
  | 'preferred'
  | 'exceptions'
  | 'past-problems'
  | 'pr-rejection'
  | 'always-explain'
  | 'ai-must-ask';

export interface InterviewQuestion {
  key: QuestionKey;
  /** `{topic}` is replaced with the category being discussed. */
  prompt: string;
  hint: string;
  /** Asked once for the whole cookbook rather than per category. */
  global?: boolean;
}

/** Spec §22. Answers become this team's standards, not generic best practice. */
export const INTERVIEW_QUESTIONS: InterviewQuestion[] = [
  { key: 'philosophy', prompt: 'What does excellent {topic} look like to you?', hint: 'A sentence or two in your own words.' },
  { key: 'prohibited', prompt: 'What {topic} patterns do you prohibit?', hint: 'One per line or separated by ";".' },
  { key: 'preferred', prompt: 'What {topic} patterns do you prefer?', hint: 'One per line or separated by ";".' },
  { key: 'exceptions', prompt: 'What exceptions exist to those rules?', hint: 'e.g. "third-party library boundaries".' },
  { key: 'past-problems', prompt: 'What {topic} practices have caused problems previously?', hint: 'These become high-severity rules.' },
  { key: 'pr-rejection', prompt: 'What would make you reject a PR?', hint: 'These become blocking PR rules.', global: true },
  { key: 'always-explain', prompt: 'What should an engineer always explain?', hint: 'e.g. "why a dependency was added".', global: true },
  { key: 'ai-must-ask', prompt: 'What should an AI never change without asking?', hint: 'e.g. "database migrations; auth".', global: true },
];

export type InterviewAnswers = Partial<Record<QuestionKey, string>>;

export function splitAnswer(answer: string | undefined): string[] {
  if (!answer) return [];
  return answer
    .split(/\r?\n|;/)
    .map((s) => s.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter((s) => s.length > 0 && !/^(none|n\/a|no|nothing)$/i.test(s));
}

function titleFrom(text: string): string {
  const clean = text.replace(/[.]+$/, '');
  return clean.length <= 60 ? clean : `${clean.slice(0, 57)}…`;
}

class IdAllocator {
  private readonly next = new Map<string, number>();
  constructor(existing: CookbookRule[]) {
    for (const rule of existing) {
      const m = /^([A-Z]+)-(\d+)$/.exec(rule.id);
      if (m?.[1] && m[2]) this.next.set(m[1], Math.max(this.next.get(m[1]) ?? 1, Number(m[2]) + 1));
    }
  }
  allocate(prefix: string): string {
    const n = this.next.get(prefix) ?? 1;
    this.next.set(prefix, n + 1);
    return `${prefix}-${String(n).padStart(3, '0')}`;
  }
}

function makeRule(ids: IdAllocator, category: CookbookCategory, severity: Severity, rule: string, extra: Partial<CookbookRule> = {}): CookbookRule {
  return { id: ids.allocate(CATEGORY_PREFIX[category]), title: titleFrom(rule), category, severity, rule, origin: 'team', ...extra };
}

/**
 * Deterministic conversion of interview answers into rules. The wording stays
 * the developer's own; rules have no machine check until one is added.
 */
export function answersToCookbook(
  category: CookbookCategory,
  answers: InterviewAnswers,
  existing: CookbookRule[] = [],
): CookbookFile {
  const ids = new IdAllocator(existing);
  const exceptions = splitAnswer(answers.exceptions);
  const withExceptions = exceptions.length ? { exceptions } : {};
  const rules: CookbookRule[] = [
    ...splitAnswer(answers.prohibited).map((p) =>
      makeRule(ids, category, 'high', `Do not use: ${p}`, { prohibited: [p], ...withExceptions }),
    ),
    ...splitAnswer(answers.preferred).map((p) => makeRule(ids, category, 'medium', `Prefer: ${p}`, { preferred: [p], ...withExceptions })),
    ...splitAnswer(answers['past-problems']).map((p) =>
      makeRule(ids, category, 'high', `Avoid: ${p}`, { rationale: 'This has caused problems in this team before.', ...withExceptions }),
    ),
  ];
  const file: CookbookFile = { category, rules };
  if (answers.philosophy?.trim()) file.philosophy = answers.philosophy.trim();
  return file;
}

/** Global answers become pull-request, documentation and AI-guardrail rules. */
export function globalAnswersToCookbook(answers: InterviewAnswers, existing: CookbookRule[] = []): CookbookFile[] {
  const ids = new IdAllocator(existing);
  const files: CookbookFile[] = [];
  const pr = splitAnswer(answers['pr-rejection']).map((p) => makeRule(ids, 'pull-requests', 'blocking', `A PR is rejected if: ${p}`));
  const doc = splitAnswer(answers['always-explain']).map((p) => makeRule(ids, 'documentation', 'medium', `Always explain: ${p}`));
  const ai = splitAnswer(answers['ai-must-ask']).map((p) =>
    makeRule(ids, 'ai-guardrails', 'blocking', `AI must ask before changing: ${p}`, { ai_must_ask: true }),
  );
  if (pr.length) files.push({ category: 'pull-requests', rules: pr });
  if (doc.length) files.push({ category: 'documentation', rules: doc });
  if (ai.length) files.push({ category: 'ai-guardrails', rules: ai });
  return files;
}

export function mergeCookbookFiles(existing: CookbookFile | undefined, incoming: CookbookFile): CookbookFile {
  if (!existing) return incoming;
  const known = new Set(existing.rules.map((r) => r.rule.toLowerCase()));
  return {
    category: existing.category,
    philosophy: incoming.philosophy ?? existing.philosophy,
    rules: [...existing.rules, ...incoming.rules.filter((r) => !known.has(r.rule.toLowerCase()))],
  };
}
