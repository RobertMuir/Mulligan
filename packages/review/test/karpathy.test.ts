import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { initWorkspace } from '@mulligan/core';
import { describe, expect, it } from 'vitest';
import { formatReport, runMulliganReview } from '../src/index.js';

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=Test', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...args], {
    cwd,
    stdio: 'pipe',
  });

async function repo(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mulligan-karpathy-'));
  git(root, 'init', '-q', '-b', 'main');
  await mkdir(path.join(root, 'src', 'cart'), { recursive: true });
  await mkdir(path.join(root, 'src', 'auth'), { recursive: true });
  await writeFile(
    path.join(root, 'src', 'cart', 'total.ts'),
    ['// Prices are in pence to avoid float drift.', 'export function total(items: number[]) {', '  return items.reduce((a, b) => a + b, 0);', '}', ''].join('\n'),
  );
  await writeFile(path.join(root, 'src', 'auth', 'session.ts'), ['export function isExpired(at: number) {', '  return at < Date.now();', '}', ''].join('\n'));
  await initWorkspace(root, 'k');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'initial');
  return root;
}

describe('Karpathy principles in Mulligan Review', () => {
  it('flags speculation, drive-by edits and missing success criteria', async () => {
    const root = await repo();
    // The task: apply a discount. The change also adds a speculative strategy layer,
    // deletes an existing comment, reformats an unrelated file, and adds no tests.
    await writeFile(
      path.join(root, 'src', 'cart', 'total.ts'),
      [
        'export class DiscountStrategyFactory {',
        '  create() { return (n: number) => n * 0.9; }',
        '}',
        'export function unusedHelper() { return 1; }',
        'export function total(items: number[], discount = new DiscountStrategyFactory().create()) {',
        '  return discount(items.reduce((a, b) => a + b, 0));',
        '}',
        '',
      ].join('\n'),
    );
    await writeFile(path.join(root, 'src', 'auth', 'session.ts'), ['export function isExpired(at: number) {', '    return at < Date.now();', '}', ''].join('\n'));

    const report = await runMulliganReview({ root, task: 'Apply a 10% discount to the cart total.' });
    const cat = (key: string) => report.categories.find((c) => c.key === key)!;

    expect(cat('think-before-coding').findings[0]).toMatchObject({ mark: 'warn', message: expect.stringMatching(/No assumptions/) });

    const simplicity = cat('simplicity-first').findings.map((f) => f.message).join('\n');
    expect(simplicity).toMatch(/`unusedHelper` is not used anywhere/);
    expect(simplicity).toMatch(/`DiscountStrategyFactory` has a single use/);

    const surgical = cat('surgical-changes').findings;
    expect(surgical.some((f) => f.ref === 'src/auth/session.ts' && /whitespace/.test(f.message))).toBe(true);
    expect(surgical.some((f) => /existing comment line was removed/.test(f.message))).toBe(true);

    const goal = cat('goal-driven').findings.map((f) => f.message).join('\n');
    expect(goal).toMatch(/Nothing in this change proves it works/);
    expect(goal).toMatch(/No success criteria/);

    const text = formatReport(report);
    expect(text).toMatch(/KARPATHY PRINCIPLES\n⚠ THINK BEFORE CODING[\s\S]*⚠ SIMPLICITY FIRST[\s\S]*⚠ SURGICAL CHANGES[\s\S]*⚠ GOAL-DRIVEN EXECUTION/);
  });

  it('passes a surgical, test-backed change with stated assumptions and criteria', async () => {
    const root = await repo();
    await writeFile(
      path.join(root, 'src', 'cart', 'total.ts'),
      [
        '// Prices are in pence to avoid float drift.',
        'export function total(items: number[], discountPercent = 0) {',
        '  const sum = items.reduce((a, b) => a + b, 0);',
        '  return Math.round(sum * (1 - discountPercent / 100));',
        '}',
        '',
      ].join('\n'),
    );
    await writeFile(path.join(root, 'src', 'cart', 'total.test.ts'), "import { total } from './total';\nexpect(total([1000], 10)).toBe(900);\n");
    const report = await runMulliganReview({
      root,
      task: 'Apply a percentage discount to the cart total.',
      description: '## Assumptions\nDiscount is a whole percentage.\n\n## Success criteria\ntotal([1000], 10) returns 900.',
    });
    for (const key of ['think-before-coding', 'simplicity-first', 'surgical-changes', 'goal-driven']) {
      expect(report.categories.find((c) => c.key === key)!.mark, key).toBe('pass');
    }
  });

  it('marks Think Before Coding as unverified when there is nothing to read', async () => {
    const root = await repo();
    await writeFile(path.join(root, 'src', 'cart', 'total.ts'), 'export const x = 1;\n');
    const report = await runMulliganReview({ root });
    expect(report.categories.find((c) => c.key === 'think-before-coding')!.mark).toBe('not-assessed');
    expect(report.unverified.join('\n')).toMatch(/Think Before Coding/);
    expect(formatReport(report)).toContain('– THINK BEFORE CODING — not assessed');
  });
});
