import { normaliseSubject, type Directive } from '@mulligan/core';
import type { CookbookRule } from './types.js';

/**
 * Cookbook rules as hierarchy directives, for conflict detection against
 * memory and golden PRs. Each preferred/prohibited item becomes a subject.
 */
export function cookbookDirectives(rules: CookbookRule[]): Directive[] {
  const directives: Directive[] = [];
  for (const rule of rules) {
    for (const p of rule.preferred ?? []) {
      directives.push({ level: 'project_cookbook', id: rule.id, subject: normaliseSubject(p), stance: 'prefer', statement: rule.rule });
    }
    for (const p of rule.prohibited ?? []) {
      directives.push({ level: 'project_cookbook', id: rule.id, subject: normaliseSubject(p), stance: 'prohibit', statement: rule.rule });
    }
  }
  return directives;
}
