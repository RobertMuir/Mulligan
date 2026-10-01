import type { CookbookCategory, CookbookFile, CookbookRule } from './types.js';

/**
 * Mulligan's baseline standards. /setup-mulligan writes them into an empty
 * cookbook so review has something to enforce from day one; the
 * /setup-mulligan-cookbook interview offers them again and adds the team's own.
 * Every rule is marked `starter` so the team can tell them from its own rules.
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
    {
      id: 'TS-004',
      title: 'Parse untrusted data, never cast it',
      category: 'typescript',
      severity: 'high',
      rule: 'Data from requests, files, storage or other services is parsed with a schema at the boundary, not asserted with `as`.',
      preferred: ['schema parse (zod or the project validator)', 'type guard'],
      rationale: 'A cast tells the compiler a guess is a fact; the first malformed input proves it wrong at runtime.',
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
    {
      id: 'SEC-002',
      title: 'Check access to every record',
      category: 'security',
      severity: 'blocking',
      rule: 'Every read, list, search and write checks that the caller may access each record it touches (OWASP API1).',
      preferred: ['the access check lives in the layer every entry point calls', 'reuse the existing permission helpers'],
      rationale: 'Changing an id or a search term is the commonest way to reach other people’s data.',
      origin: 'starter',
    },
    {
      id: 'SEC-003',
      title: 'Expose and accept only allowed fields',
      category: 'security',
      severity: 'blocking',
      rule: 'Responses include only the fields the caller may see; writes accept only an explicit allowlist of client-controllable fields (OWASP API3).',
      prohibited: ['spreading or merging a request body into a stored record', 'returning the stored record unfiltered'],
      rationale: 'Mass assignment and over-exposure both come from treating the stored shape as the API shape.',
      origin: 'starter',
    },
    {
      id: 'SEC-004',
      title: 'Limit operations by role',
      category: 'security',
      severity: 'high',
      rule: 'Each operation is allowed only for the roles that need it (OWASP API5).',
      origin: 'starter',
    },
    {
      id: 'SEC-005',
      title: 'Validate input where it enters',
      category: 'security',
      severity: 'high',
      rule: 'Untrusted input is validated for type, size and format at the boundary, and never reaches a query, regular expression, file path, shell, object key or recursive merge without escaping or an allowlist.',
      rationale: 'Injection needs only one unvalidated path.',
      origin: 'starter',
    },
    {
      id: 'SEC-006',
      title: 'Errors reveal nothing internal',
      category: 'security',
      severity: 'high',
      rule: 'Error responses carry a safe message and status; stack traces and internal messages go to the server log only. A record the caller may not see is reported the same way as one that does not exist (OWASP API8).',
      origin: 'starter',
    },
    {
      id: 'SEC-007',
      title: 'Bound resource use',
      category: 'security',
      severity: 'medium',
      rule: 'Input sizes, page lengths and other caller-controlled costs have limits (OWASP API4).',
      origin: 'starter',
    },
  ],
  testing: [
    {
      id: 'TEST-001',
      title: 'Tests that can fail',
      category: 'testing',
      severity: 'high',
      rule: 'Tests drive the public entry points callers use and assert fixed expected values. A test that would still pass with the implementation stubbed out is strengthened or removed.',
      origin: 'starter',
    },
    {
      id: 'TEST-002',
      title: 'Every fix lands with a failing-first test',
      category: 'testing',
      severity: 'high',
      rule: 'A bug or vulnerability fix comes with a test that fails on the old code and passes on the new.',
      origin: 'starter',
    },
    {
      id: 'TEST-003',
      title: 'Never weaken existing tests to pass',
      category: 'testing',
      severity: 'blocking',
      rule: 'Existing tests are not deleted, skipped or loosened to make a change pass; changing an existing assertion needs a stated reason.',
      origin: 'starter',
    },
  ],
  architecture: [
    {
      id: 'ARCH-001',
      title: 'Follow the codebase’s own patterns',
      category: 'architecture',
      severity: 'medium',
      rule: 'A change follows the pattern the codebase already uses for that kind of change; a new pattern needs a stated reason.',
      origin: 'starter',
    },
  ],
  'ai-guardrails': [
    {
      id: 'AI-001',
      title: 'Stay inside the task',
      category: 'ai-guardrails',
      severity: 'high',
      rule: 'Change only the files the task needs. Any other file changed is listed in the hand-back with its reason; unrelated problems are reported, not fixed.',
      origin: 'starter',
    },
    {
      id: 'AI-002',
      title: 'Ask before adding dependencies',
      category: 'ai-guardrails',
      severity: 'high',
      rule: 'Adding, removing or upgrading a dependency needs the developer’s approval.',
      ai_must_ask: true,
      origin: 'starter',
    },
  ],
};

/** The baseline rules grouped into one cookbook file per category, ready to save. */
export function baselineCookbook(): CookbookFile[] {
  return Object.entries(STARTER_RULES).map(([category, rules]) => ({ category, rules: rules ?? [] }));
}
