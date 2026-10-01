import { describe, expect, it } from 'vitest';
import {
  STARTER_RULES,
  answersToCookbook,
  evaluateCookbook,
  formatViolation,
  globalAnswersToCookbook,
  parseCookbookFile,
  serializeCookbookFile,
  splitAnswer,
} from '../src/index.js';

const TS001 = STARTER_RULES.typescript![0]!;

describe('cookbook parser', () => {
  it('reads the spec §21 single-rule form', () => {
    const file = parseCookbookFile(
      `rule:
  id: TS-001
  title: Avoid any
  category: typescript
  severity: high
  rule: >
    Do not use \`any\` unless there is a documented reason.
  preferred: [unknown, explicit interface, discriminated union]
  exceptions: [third-party library boundary]
  rationale: >
    Preserve type safety and make runtime uncertainty explicit.
`,
      'typescript',
    );
    expect(file.rules[0]).toMatchObject({ id: 'TS-001', severity: 'high', preferred: ['unknown', 'explicit interface', 'discriminated union'] });
  });

  it('round-trips and validates checks', () => {
    const file = { category: 'typescript', rules: [TS001] };
    expect(parseCookbookFile(serializeCookbookFile(file), 'typescript')).toEqual(file);
    expect(() => parseCookbookFile('rules:\n  - {id: X-1, rule: r, check: {type: builtin, name: nope}}', 'x')).toThrow(/must be one of/);
    expect(() => parseCookbookFile('rules:\n  - {id: X-1, rule: r, check: {type: pattern, pattern: "("}}', 'x')).toThrow(/regular expression/);
  });
});

describe('cookbook evaluator', () => {
  const file = {
    path: 'src/api/client.ts',
    content: [
      'export async function get(url: string) {',
      '  const response: any = await fetch(url);',
      '  // mulligan-allow TS-001: third-party SDK returns untyped data',
      '  const sdk: any = legacy();',
      '  const other: any = 1; // mulligan-allow TS-001',
      '  return response;',
      '}',
    ].join('\n'),
  };

  it('finds violations with file:line and expected alternatives (spec §23)', () => {
    const result = evaluateCookbook([TS001], [file]);
    expect(result.violations.map((v) => v.line)).toEqual([2, 5]);
    expect(result.allowed.map((v) => v.line)).toEqual([4]);
    const text = formatViolation(result.violations[0]!);
    expect(text).toContain('TS-001 — Avoid any');
    expect(text).toContain('src/api/client.ts:2');
    expect(text).toContain('unknown / explicit interface / discriminated union');
    expect(result.violations[1]!.suppression).toEqual({ documented: false });
  });

  it('separates pre-existing violations from the change under review', () => {
    const result = evaluateCookbook([TS001], [file], { scopeLines: new Map([['src/api/client.ts', new Set([5])]]) });
    expect(result.violations.map((v) => v.line)).toEqual([5]);
    expect(result.preexisting.map((v) => v.line)).toEqual([2]);
  });

  it('ignores `any` in strings and comments (AST, not regex)', () => {
    const result = evaluateCookbook([TS001], [{ path: 'a.ts', content: '// any time now\nconst s = "as any";\n' }]);
    expect(result.violations).toHaveLength(0);
  });

  it('reports rules without checks as needing judgement', () => {
    const result = evaluateCookbook([{ id: 'ARCH-001', title: 't', category: 'architecture', severity: 'medium', rule: 'Keep features modular.' }], [file]);
    expect(result.unenforced.map((r) => r.id)).toEqual(['ARCH-001']);
  });

  it('runs pattern checks', () => {
    const rule = STARTER_RULES.security![0]!;
    const result = evaluateCookbook([rule], [{ path: 'src/View.tsx', content: 'const x = 1;\nreturn <div dangerouslySetInnerHTML={{ __html: h }} />;' }]);
    expect(result.violations[0]).toMatchObject({ ruleId: 'SEC-001', line: 2, severity: 'blocking' });
  });
});

describe('cookbook interview', () => {
  it('turns answers into team rules in the developer\'s words', () => {
    expect(splitAnswer('- barrel files\n- default exports; none')).toEqual(['barrel files', 'default exports']);
    const file = answersToCookbook('typescript', { philosophy: 'Types document intent.', prohibited: 'enums; barrel files', preferred: 'discriminated unions' }, [TS001]);
    expect(file.philosophy).toBe('Types document intent.');
    expect(file.rules.map((r) => [r.id, r.severity, r.rule])).toEqual([
      ['TS-002', 'high', 'Do not use: enums'],
      ['TS-003', 'high', 'Do not use: barrel files'],
      ['TS-004', 'medium', 'Prefer: discriminated unions'],
    ]);
  });

  it('maps project-wide answers to PR, documentation and AI-guardrail rules', () => {
    const files = globalAnswersToCookbook({ 'pr-rejection': 'no tests', 'ai-must-ask': 'database migrations; auth' });
    expect(files.map((f) => f.category)).toEqual(['pull-requests', 'ai-guardrails']);
    expect(files[1]!.rules.every((r) => r.ai_must_ask && r.severity === 'blocking')).toBe(true);
  });
});
