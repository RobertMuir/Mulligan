import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { initWorkspace, loadConfig, saveConfig, type CommandRunner } from '@mulligan/core';
import { STARTER_RULES, saveCookbookFile } from '@mulligan/cookbook';
import { MemoryStore, emptyMemory, saveMemory } from '@mulligan/memory';
import { beforeAll, describe, expect, it } from 'vitest';
import { formatReport, runMulliganReview } from '../src/index.js';

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=Test', '-c', 'commit.gpgsign=false', ...args], { cwd, stdio: 'pipe' });

let root: string;

beforeAll(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'mulligan-review-'));
  git(root, 'init', '-q', '-b', 'main');
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'app', dependencies: { react: '^19.0.0' } }, null, 2));
  await mkdir(path.join(root, 'src', 'api'), { recursive: true });
  await mkdir(path.join(root, 'src', 'legacy'), { recursive: true });
  // Pre-existing violation: must be reported separately, not blamed on the change.
  await writeFile(path.join(root, 'src', 'legacy', 'old.ts'), 'export const old: any = 1;\n');
  await initWorkspace(root, 'app');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'initial');
  git(root, 'checkout', '-q', '-b', 'feature/offline-sync');

  await saveCookbookFile(root, { category: 'typescript', rules: [STARTER_RULES.typescript![0]!] });
  const store = new MemoryStore(emptyMemory('app'));
  store.addConfirmed({
    category: 'react',
    rule: 'Avoid a global Zustand store; prefer local state when state does not cross meaningful boundaries.',
    subject: 'zustand-store',
    stance: 'avoid',
    preference: 'strong',
    source: 'human_correction',
    derivation: 'stated',
    evidence: [{ kind: 'human_correction' }],
    scope: 'project',
  });
  await saveMemory(root, store);
  const config = await loadConfig(root);
  config.verification.commands = { test: 'node -e "process.exit(0)"', typecheck: 'node -e "process.exit(2)"' };
  await saveConfig(root, config);

  await writeFile(
    path.join(root, 'src', 'api', 'client.ts'),
    [
      "import { create } from 'zustand';",
      'export const useZustandStore = create(() => ({}));',
      'export async function get(url: string) {',
      '  const response: any = await fetch(url);',
      '  return response;',
      '}',
      'const key = "sk-ant-abcdefghijklmnopqrstuvwxyz0123";',
    ].join('\n'),
  );
  await writeFile(path.join(root, 'src', 'legacy', 'old.ts'), 'export const old: any = 1;\nexport const extra = 2;\n');
});

describe('Mulligan Review', () => {
  it('reports evidence, never a score, and lists what it did not verify', async () => {
    const ran: string[] = [];
    const runner: CommandRunner = {
      async run(command) {
        ran.push(command);
        const exitCode = command.includes('exit(2)') ? 2 : 0;
        return { status: 'completed', exitCode, stdout: '', stderr: exitCode ? 'type error' : '', durationMs: 1 };
      },
    };
    const report = await runMulliganReview({ root, runner });

    expect(report.status).toBe('BLOCKING ISSUES');
    const find = (key: string) => report.categories.find((c) => c.key === key)!;

    const ts = find('typescript');
    expect(ts.mark).toBe('fail');
    expect(ts.findings.some((f) => f.ruleId === 'TS-001' && f.ref === 'src/api/client.ts:4')).toBe(true);
    expect(report.preexistingViolations).toBe(1);

    expect(find('security').findings.some((f) => f.blocking && f.ref === 'src/api/client.ts:7')).toBe(true);
    expect(find('memory-alignment').findings.some((f) => f.ruleId === 'MM-001' && f.mark === 'warn')).toBe(true);
    expect(find('testing').findings.some((f) => /no test changes/.test(f.message))).toBe(true);
    expect(ran).toHaveLength(2);
    expect(ts.findings.some((f) => f.source === 'verification' && f.mark === 'fail')).toBe(true);

    expect(report.unverified.join('\n')).toMatch(/Independent model review/);
    expect(report.unverified.join('\n')).toMatch(/Production runtime behaviour/);

    const text = formatReport(report);
    expect(text).toMatch(/^MULLIGAN REVIEW/);
    expect(text).toContain('✗ TS-001 violated — Avoid any');
    expect(text).toContain('Recommended actions');
    expect(text).not.toMatch(/\d+\s*\/\s*10/);
  });

  it('declares verification unverified when no runner is available', async () => {
    const report = await runMulliganReview({ root });
    expect(report.unverified.join('\n')).toMatch(/Automated verification/);
  });

  it('adds the extra accountability categories in safety mode', async () => {
    const report = await runMulliganReview({ root, safetyMode: true });
    expect(report.categories.map((c) => c.key)).toEqual(expect.arrayContaining(['traceability', 'change-control', 'reproducibility']));
    expect(report.categories.find((c) => c.key === 'traceability')!.mark).toBe('warn');
    expect(report.humanReviewAreas.some((h) => /Failure modes/.test(h))).toBe(true);
  });

  it('reviews the whole codebase with --all', async () => {
    const report = await runMulliganReview({ root, all: true });
    expect(report.scope.mode).toBe('all');
    expect(report.categories.find((c) => c.key === 'typescript')!.findings.filter((f) => f.ruleId === 'TS-001')).toHaveLength(2);
  });
});
