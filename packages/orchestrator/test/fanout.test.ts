import { execFileSync, execSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ConfiguredModelRouter, type CommandRunner, type ModelProvider, type ProviderConfig } from '@mulligan/core';
import { STARTER_RULES } from '@mulligan/cookbook';
import { beforeAll, describe, expect, it } from 'vitest';
import { fanOut, formatFanOut, parseChange } from '../src/index.js';

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=Test', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...args], { cwd, stdio: 'pipe' }).toString();

const ANSWERS: Record<string, string> = {
  alpha: [
    'APPROACH: Fix the operator in add.',
    'ASSUMPTIONS: add only ever receives numbers.',
    'SUCCESS CRITERIA: add(2, 3) returns 5; node check.mjs exits 0.',
    '```file:src/math.js',
    'export const add = (a, b) => a + b;',
    '```',
    'TRADE-OFFS: none.',
    'NOT VERIFIED: nothing beyond check.mjs.',
  ].join('\n'),
  beta: [
    'APPROACH: Introduce a validation layer and fix add.',
    'ASSUMPTIONS: inputs may be strings.',
    'SUCCESS CRITERIA: add(2, 3) returns 5.',
    '```file:src/math.js',
    "import { toNumber } from './validate.js';",
    'export const add = (a, b) => toNumber(a) + toNumber(b);',
    '```',
    '```file:src/validate.js',
    ...Array.from({ length: 12 }, (_, i) => `// validation rule ${i}`),
    'export function toNumber(x) {',
    "  if (typeof x === 'string') return Number(x);",
    '  return x;',
    '}',
    '```',
  ].join('\n'),
  gamma: ['APPROACH: Multiply instead.', '```file:src/math.js', 'export const add = (a, b) => a * b;', '```'].join('\n'),
};

const prompts: { provider: string; system?: string; prompt: string }[] = [];

function fakeProvider(name: string, config: ProviderConfig): ModelProvider {
  return {
    name,
    kind: config.kind,
    model: config.model,
    async complete(request) {
      const prompt = request.messages.at(-1)!.content;
      prompts.push({ provider: name, system: request.system, prompt });
      if (request.system?.includes('impartial judge')) {
        const criteria = ['correctness', 'think-before-coding', 'simplicity-first', 'surgical-changes', 'goal-driven', 'standards'];
        return { text: JSON.stringify({ scores: criteria.map((c) => ({ criterion: c, score: 4, reason: 'fine' })) }), provider: config.kind, model: config.model };
      }
      return { text: ANSWERS[name]!, provider: config.kind, model: config.model };
    },
  };
}

const runnerFor = (cwd: string): CommandRunner => ({
  async run(command) {
    try {
      const stdout = execSync(command, { cwd, stdio: 'pipe' }).toString();
      return { status: 'completed', exitCode: 0, stdout, stderr: '', durationMs: 1 };
    } catch (error) {
      return { status: 'completed', exitCode: (error as { status?: number }).status ?? 1, stdout: '', stderr: String(error), durationMs: 1 };
    }
  },
});

let root: string;

beforeAll(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'mulligan-fanout-'));
  git(root, 'init', '-q', '-b', 'main');
  await writeFile(path.join(root, 'package.json'), '{ "type": "module" }\n');
  await execSync('mkdir src', { cwd: root });
  await writeFile(path.join(root, 'src', 'math.js'), 'export const add = (a, b) => a - b;\n');
  await writeFile(
    path.join(root, 'check.mjs'),
    "import { add } from './src/math.js';\nif (add(2, 3) !== 5) { console.error('add is wrong'); process.exit(1); }\n",
  );
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'initial');
});

describe('fan-out with a rubric', () => {
  it('ranks verified, minimal work first and never touches the working tree', async () => {
    const router = new ConfiguredModelRouter(
      {
        providers: {
          alpha: { kind: 'anthropic', model: 'claude-opus-5-5' },
          beta: { kind: 'openai', model: 'gpt-x', capability: 5 },
          gamma: { kind: 'ollama', model: 'llama3.3:70b', capability: 5 },
        },
        default: 'alpha',
      },
      fakeProvider,
      () => true,
    );
    const result = await fanOut({
      root,
      task: 'Make add() return the sum of its arguments.',
      count: 3,
      router,
      contextFor: async () => 'ENGINEERING CONTEXT',
      angles: [
        { id: 'smallest', name: 'Smallest sufficient change', brief: 'small' },
        { id: 'failure-first', name: 'Failure first', brief: 'robust' },
        { id: 'codebase-native', name: 'Codebase native', brief: 'native' },
      ],
      verify: { commands: { test: 'node check.mjs' }, runnerFor },
      judges: 1,
      cookbookRules: STARTER_RULES.javascript,
    });

    const byProvider = Object.fromEntries(result.candidates.map((c) => [c.provider, c]));
    expect(byProvider.alpha!.verification.status).toBe('passed');
    expect(byProvider.beta!.verification.status).toBe('passed');
    expect(byProvider.gamma!).toMatchObject({ standing: 'failed-verification', verification: { status: 'failed' } });

    // Same judge scores everywhere, so the evidence decides: the smaller, criteria-stating fix wins.
    expect(result.candidates.map((c) => c.provider)).toEqual(['alpha', 'beta', 'gamma']);
    expect(result.recommended?.provider).toBe('alpha');
    expect(byProvider.beta!.scores['simplicity-first']!.notes.join()).toMatch(/× the smallest candidate/);
    expect(byProvider.alpha!.total).toBeGreaterThan(byProvider.beta!.total);

    // Judges are blind and never grade their own candidate; implementers never see the rubric.
    expect(byProvider.alpha!.judgedBy).not.toContain('alpha');
    const implementerPrompts = prompts.filter((p) => !p.system?.includes('impartial judge'));
    expect(implementerPrompts.every((p) => !/rubric|weight/i.test(p.prompt + (p.system ?? '')))).toBe(true);
    expect(prompts.filter((p) => p.system?.includes('impartial judge')).every((p) => !/alpha|beta|gamma/.test(p.prompt))).toBe(true);

    // The diff is generated by git and applies to the real tree; the tree itself is untouched.
    expect(byProvider.alpha!.diff).toMatch(/-export const add = \(a, b\) => a - b;\n\+export const add = \(a, b\) => a \+ b;/);
    expect(await readFile(path.join(root, 'src', 'math.js'), 'utf8')).toBe('export const add = (a, b) => a - b;\n');
    expect(git(root, 'worktree', 'list').trim().split('\n')).toHaveLength(1);

    const text = formatFanOut(result);
    expect(text).toContain(`Recommended: ${byProvider.alpha!.label}`);
    expect(text).toContain('FAILED VERIFICATION');
    expect(text).toContain('/pick <letter>');
  });

  it('carries uncommitted work into each sandbox', async () => {
    await writeFile(path.join(root, 'src', 'extra.js'), 'export const x = 1;\n');
    const router = new ConfiguredModelRouter({ providers: { alpha: { kind: 'anthropic', model: 'claude-opus-5-5' } }, default: 'alpha' }, fakeProvider, () => true);
    const result = await fanOut({
      root,
      task: 'Fix add.',
      count: 1,
      router,
      verify: { commands: { extra: 'node -e "import(\'./src/extra.js\').then(m => process.exit(m.x === 1 ? 0 : 1))"' }, runnerFor },
      judges: 0,
    });
    expect(result.candidates[0]!.verification.status).toBe('passed');
    expect(result.notes.join()).toMatch(/Only one model is ready/);
  });
});

describe('parseChange', () => {
  it('reads labelled sections and complete-file blocks', () => {
    const change = parseChange(ANSWERS.alpha!);
    expect(change.approach).toBe('Fix the operator in add.');
    expect(change.successCriteria).toBe('add(2, 3) returns 5; node check.mjs exits 0.');
    expect(change.files).toEqual([{ path: 'src/math.js', content: 'export const add = (a, b) => a + b;\n' }]);
  });
});
