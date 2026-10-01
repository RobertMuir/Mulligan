import type { TopicKey } from './signals.js';

export interface TopicInfo {
  title: string;
  /** Words that link a memory principle to this topic. */
  keywords: string[];
  /** Learning steps before applying, reviewing and recording (spec §13). */
  learn: string[];
  apply: string;
  test: string;
  principle: string;
}

export const isTopicKey = (value: string): value is TopicKey => value in TOPICS;

export const TOPICS: Record<TopicKey, TopicInfo> = {
  'type-safety': {
    title: 'Type safety at boundaries',
    keywords: ['typescript', 'any', 'strict', 'type', 'types'],
    learn: [
      'Learn why `unknown` is safer than `any` and how narrowing works (typeof, in, discriminated unions).',
      'Review how strict mode flags (strictNullChecks, noImplicitAny) change what the compiler can prove.',
    ],
    apply: 'Replace one `any` with `unknown` plus narrowing, or an explicit interface',
    test: 'Add a type-level test (e.g. expectTypeOf) or a unit test covering the narrowed branches.',
    principle: 'Avoid `any` unless explicitly justified; prefer `unknown` at uncertain boundaries.',
  },
  'runtime-validation': {
    title: 'Runtime validation',
    keywords: ['validation', 'validate', 'schema', 'zod', 'runtime', 'api', 'boundary', 'parse'],
    learn: [
      'Learn the difference between compile-time and runtime validation: TypeScript types are erased and cannot check data from the network.',
      'Review schema validation patterns (e.g. Zod `safeParse`) and where boundaries sit in this codebase.',
    ],
    apply: 'Refactor one API boundary to validate the response before use',
    test: 'Write validation tests for valid, malformed and missing-field responses.',
    principle: 'Validate external data at runtime at the boundary where it enters the system.',
  },
  'error-boundaries': {
    title: 'Error boundary strategy',
    keywords: ['error', 'boundary', 'boundaries', 'crash', 'render', 'react'],
    learn: [
      'Learn what React error boundaries catch (render/lifecycle errors) and what they do not (event handlers, async code).',
      'Decide on boundary placement: app shell, per route/screen, and around risky widgets.',
    ],
    apply: 'Add one error boundary around a screen or route with a recoverable fallback',
    test: 'Write a test that renders a throwing child and asserts the fallback appears.',
    principle: 'Every screen sits under an error boundary with a recoverable fallback.',
  },
  'accessibility-testing': {
    title: 'Accessibility testing',
    keywords: ['accessibility', 'a11y', 'axe', 'aria', 'role', 'screen', 'reader'],
    learn: [
      'Learn how role-based queries (getByRole) test what assistive technology sees.',
      'Review automated checks (axe) and their limits — they find roughly a third of issues; manual checks remain necessary.',
    ],
    apply: 'Convert one component test to role-based queries and add an axe check',
    test: 'Assert the component has no axe violations and is operable by keyboard.',
    principle: 'Component tests query by accessible role and include an automated accessibility check.',
  },
  'regression-testing': {
    title: 'Regression testing',
    keywords: ['test', 'tests', 'testing', 'regression', 'fix', 'bug'],
    learn: [
      'Learn the "failing test first" bug-fix workflow: reproduce the bug in a test before changing code.',
      'Review which layers (unit, integration, end-to-end) catch which classes of regression.',
    ],
    apply: 'Take the most recent bug fix and write the regression test that would have caught it',
    test: 'Confirm the test fails against the pre-fix code and passes against the fix.',
    principle: 'Every bug fix ships with a regression test that fails without the fix.',
  },
  'error-handling': {
    title: 'Explicit error handling',
    keywords: ['error', 'errors', 'catch', 'exception', 'handling', 'swallow'],
    learn: [
      'Learn why swallowed errors are worse than crashes: failures become invisible and data can silently corrupt.',
      'Review patterns: rethrow with context, convert to a typed result, or log and surface to the user.',
    ],
    apply: 'Replace one empty catch with handling that logs, surfaces or rethrows with context',
    test: 'Write a test that forces the failure path and asserts the observable outcome.',
    principle: 'Never swallow errors silently; every catch handles, reports or rethrows with context.',
  },
  'small-changes': {
    title: 'Small, focused changes',
    keywords: ['small', 'focused', 'pr', 'prs', 'commit', 'commits', 'size', 'scope'],
    learn: [
      'Learn how change size affects review quality and rollback risk.',
      'Review techniques for splitting work: preparatory refactors, feature flags, stacked PRs.',
    ],
    apply: 'Split your next feature into a preparatory refactor and a behaviour change',
    test: 'Check each piece passes verification on its own.',
    principle: 'Keep changes small and focused; separate refactors from behaviour changes.',
  },
  'react-list-keys': {
    title: 'React rendering and list keys',
    keywords: ['react', 'key', 'keys', 'list', 'render', 'rendering', 'performance'],
    learn: [
      'Learn how React reconciliation uses keys to match elements between renders.',
      'Review why index keys break component state and animations when lists reorder or filter.',
    ],
    apply: 'Replace one index key with a stable identifier from the data',
    test: 'Write a test that reorders the list and asserts per-item state is preserved.',
    principle: 'List items use stable, data-derived keys — never the array index for dynamic lists.',
  },
};
