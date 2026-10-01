import { describe, expect, it } from 'vitest';
import { securityFindings } from '../src/checks.js';
import { karpathyFindings } from '../src/karpathy.js';
import type { ReviewInput } from '../src/collect.js';

const lines = (file: string, ...texts: string[]) => texts.map((text, i) => ({ file, line: i + 1, text }));

describe('security heuristics', () => {
  it('ignores pattern names inside strings and regexes, and XML namespaces', () => {
    const findings = securityFindings(
      lines(
        'src/rules.ts',
        "const rule = 'dangerouslySetInnerHTML requires sanitised input';",
        'const svg = `<svg xmlns="http://www.w3.org/2000/svg">`;',
        'const m = /^(\\w+)$/.exec(`${id} ${rest}`);',
      ),
      [{ path: 'src/rules.ts', content: 'no shell here' }],
    );
    expect(findings).toEqual([]);
  });

  it('still reports real injection points', () => {
    const findings = securityFindings(
      [
        ...lines('src/View.tsx', 'return <div dangerouslySetInnerHTML={{ __html: body }} />;'),
        ...lines('src/run.ts', 'execSync(`git log ${branch}`);'),
        ...lines('src/api.ts', "const base = 'http://api.example.com';"),
      ],
      [{ path: 'src/run.ts', content: "import { execSync } from 'node:child_process';" }],
    );
    expect(findings.map((f) => [f.ref, f.message])).toEqual([
      ['src/View.tsx:1', 'Raw HTML injection point'],
      ['src/run.ts:1', 'Shell command built from interpolated input'],
      ['src/api.ts:1', 'Insecure http:// URL'],
    ]);
  });
});

describe('Karpathy heuristics', () => {
  const input = (texts: string[], mode: ReviewInput['mode'] = 'diff'): ReviewInput => ({
    mode,
    files: [{ path: 'src/a.ts', content: texts.join('\n') }],
    changed: [{ path: 'src/a.ts', status: 'modified', additions: texts.length, deletions: 0 }],
    lines: lines('src/a.ts', ...texts),
    removed: [],
    whitespaceOnly: new Map(),
    commitSubjects: [],
  });

  it('flags single-use layer classes but not ordinary camelCase functions', () => {
    const { findings } = karpathyFindings(
      input([
        'export function mergeBase(a: string) { return a; }',
        'export class PaymentStrategyFactory {}',
        'const x = mergeBase(new PaymentStrategyFactory().toString());',
      ]),
      { verification: [] },
    );
    const simplicity = findings.filter((f) => f.category === 'simplicity-first').map((f) => f.message);
    expect(simplicity).toEqual(['New abstraction `PaymentStrategyFactory` has a single use — would direct code be simpler?']);
  });

  it('is honest about what a whole-codebase review cannot judge', () => {
    const { findings, unverified } = karpathyFindings(input(['export const used = 1;', 'used;'], 'all'), { verification: [] });
    expect(findings.some((f) => f.category === 'surgical-changes')).toBe(false);
    expect(unverified).toContain('Surgical Changes: judged per change — review a diff rather than the whole codebase');
  });
});
