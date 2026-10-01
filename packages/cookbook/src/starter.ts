import type { CookbookCategory, CookbookRule } from './types.js';

/**
 * Optional starting points offered during /setup-mulligan-cookbook. They are
 * only adopted if the developer chooses them, and are marked `starter`.
 */
export const STARTER_RULES: Partial<Record<CookbookCategory, CookbookRule[]>> = {
  typescript: [
    {
      id: 'TS-001',
      title: 'Avoid any',
      category: 'typescript',
      severity: 'high',
      rule: 'Do not use `any` unless there is a documented reason.',
      preferred: ['unknown', 'explicit interface', 'discriminated union'],
      exceptions: ['third-party library boundary'],
      rationale: 'Preserve type safety and make runtime uncertainty explicit.',
      check: { type: 'builtin', name: 'no-explicit-any' },
      origin: 'starter',
    },
    {
      id: 'TS-002',
      title: 'No type-check suppression',
      category: 'typescript',
      severity: 'high',
      rule: 'Do not use @ts-ignore or @ts-nocheck; use @ts-expect-error with a reason if unavoidable.',
      preferred: ['fix the type', '@ts-expect-error with explanation'],
      rationale: '@ts-ignore keeps silencing errors after the underlying problem changes.',
      check: { type: 'builtin', name: 'no-ts-ignore' },
      origin: 'starter',
    },
    {
      id: 'TS-003',
      title: 'Avoid non-null assertions',
      category: 'typescript',
      severity: 'medium',
      rule: 'Avoid the `!` non-null assertion; narrow explicitly instead.',
      preferred: ['explicit null check', 'early return', 'optional chaining with a handled fallback'],
      rationale: 'Assertions move a runtime crash out of sight of the type checker.',
      check: { type: 'builtin', name: 'no-non-null-assertion' },
      origin: 'starter',
    },
  ],
  javascript: [
    {
      id: 'JS-001',
      title: 'Never swallow errors',
      category: 'javascript',
      severity: 'high',
      rule: 'Catch blocks must handle, report or rethrow the error.',
      preferred: ['rethrow with context', 'log and surface to the user', 'typed error result'],
      rationale: 'Silent failures hide bugs and can corrupt data.',
      check: { type: 'builtin', name: 'no-empty-catch' },
      origin: 'starter',
    },
  ],
  react: [
    {
      id: 'RE-001',
      title: 'Stable list keys',
      category: 'react',
      severity: 'medium',
      rule: 'Do not use the array index as a key for lists that can reorder, insert or filter.',
      preferred: ['stable id from the data'],
      exceptions: ['static lists that never change'],
      rationale: 'Index keys attach component state to the wrong item after reordering.',
      check: { type: 'builtin', name: 'no-index-key', files: ['**/*.{tsx,jsx}'] },
      origin: 'starter',
    },
  ],
  security: [
    {
      id: 'SEC-001',
      title: 'No dangerouslySetInnerHTML without sanitisation',
      category: 'security',
      severity: 'blocking',
      rule: 'dangerouslySetInnerHTML requires sanitised input and a documented reason.',
      preferred: ['render as text', 'sanitise with a vetted library'],
      rationale: 'Unsanitised HTML is a cross-site scripting vector.',
      check: { type: 'pattern', pattern: 'dangerouslySetInnerHTML', files: ['**/*.{tsx,jsx}'] },
      origin: 'starter',
    },
  ],
};
