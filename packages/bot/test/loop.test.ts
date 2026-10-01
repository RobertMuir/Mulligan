import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { initWorkspace, loadConfig, saveConfig } from '@mulligan/core';
import { loadMemory } from '@mulligan/memory';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Session, findCommand } from '../src/index.js';
import type { Io } from '../src/terminal/io.js';

/** A stand-in for the Anthropic Messages API that records what it was asked. */
let server: Server;
const requests: { system: string; prompt: string }[] = [];

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const data = JSON.parse(body) as { system?: string; messages: { content: string }[] };
      const system = data.system ?? '';
      const prompt = data.messages.at(-1)?.content ?? '';
      requests.push({ system, prompt });
      const text = system.includes('extract engineering principles')
        ? '[{"category":"architecture","rule":"Avoid introducing abstraction layers unless they provide a demonstrated architectural benefit.","subject":"abstraction-layers","stance":"avoid"}]'
        : system.includes('impartial judge')
          ? JSON.stringify({ scores: [{ criterion: 'correctness', score: 4, reason: 'fixes it' }] })
          : prompt.includes('YOUR ANGLE')
            ? 'APPROACH: Return the greeting.\nASSUMPTIONS: none.\nSUCCESS CRITERIA: greet() returns "hi".\n```file:src/greet.js\nexport const greet = () => "hi";\n```'
            : prompt.includes('FUNDAMENTALLY different')
          ? 'Approach B: inline the logic directly.\n```diff\n--- a/x\n+++ b/x\n```'
          : 'Approach A: a generic plugin framework.\n```diff\n--- a/x\n+++ b/x\n```';
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ content: [{ type: 'text', text }], usage: { input_tokens: 1, output_tokens: 1 } }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
});

afterAll(() => server.close());

function scriptedIo(answers: string[]): Io & { output: string[] } {
  const output: string[] = [];
  const next = (fallback = '') => answers.shift() ?? fallback;
  return {
    interactive: true,
    output,
    print: (text = '') => void output.push(text),
    ask: async (_q, fallback) => next(fallback),
    confirm: async () => next('n') === 'y',
    choose: async (_q, options, fallback) => {
      const answer = next();
      return options.find((o) => o.key === answer)?.value ?? fallback;
    },
    askMany: async () => [],
    close: () => {},
  };
}

describe('the Mulligan loop', () => {
  it('implement → take a Mulligan → learn → try a different approach', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mulligan-loop-'));
    await initWorkspace(root, 'loop');
    const config = await loadConfig(root);
    const { port } = server.address() as AddressInfo;
    config.models.providers.claude = { kind: 'anthropic', model: 'claude-opus-5-5', apiKeyEnv: 'MULLIGAN_TEST_KEY', baseUrl: `http://127.0.0.1:${port}` };
    await saveConfig(root, config);
    process.env.MULLIGAN_TEST_KEY = 'test';

    // Answers: the Mulligan reason, then [m]odify the proposed lesson, the wording, and no exceptions.
    const io = scriptedIo([
      'Too much abstraction.',
      'm',
      'Prefer direct implementations over abstraction layers unless reuse or architectural boundaries justify them.',
      '',
    ]);
    const session = await new Session(root, io).load();

    await findCommand('implement')!.run(session, 'Add a settings screen');
    expect(session.attempts).toHaveLength(1);
    expect(requests[0]!.system).toContain('When standards conflict, the higher level wins');
    expect(requests[0]!.system).not.toContain('MULLIGAN MEMORY'); // nothing learned yet

    await findCommand('take-a-mulligan')!.run(session, '');
    expect(io.output.join('\n')).toContain('I identified a potential engineering preference');

    const memory = await loadMemory(root);
    expect(memory.principles).toHaveLength(1);
    expect(memory.principles[0]).toMatchObject({
      source: 'human_rejected',
      derivation: 'stated',
      confirmed: true,
      rule: 'Prefer direct implementations over abstraction layers unless reuse or architectural boundaries justify them.',
    });

    // The retry is a different approach and carries the new lesson.
    expect(session.attempts).toHaveLength(2);
    expect(session.attempts[1]!.response).toContain('Approach B');
    const retry = requests.at(-1)!;
    expect(retry.prompt).toContain('Reason: Too much abstraction.');
    expect(retry.system).toContain('Prefer direct implementations over abstraction layers');

    const history = await readFile(path.join(root, '.mulligan', 'memory', 'history.jsonl'), 'utf8');
    expect(history.trim().split('\n').map((l) => JSON.parse(l).action)).toEqual(['propose', 'accept']);
  });
});

describe('automatic fan-out in the loop', () => {
  it('fans a hard task out, ranks the candidates, and applies the one the developer picks', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mulligan-autofan-'));
    const git = (...args: string[]) =>
      execFileSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=Test', '-c', 'commit.gpgsign=false', ...args], { cwd: root, stdio: 'pipe' });
    git('init', '-q', '-b', 'main');
    await mkdir(path.join(root, 'src'));
    await writeFile(path.join(root, 'src', 'greet.js'), 'export const greet = () => "bye";\n');
    await initWorkspace(root, 'fan');
    git('add', '-A');
    git('commit', '-q', '-m', 'init');

    const config = await loadConfig(root);
    const { port } = server.address() as AddressInfo;
    const base = { kind: 'anthropic' as const, apiKeyEnv: 'MULLIGAN_TEST_KEY', baseUrl: `http://127.0.0.1:${port}` };
    config.models.providers = { opus: { ...base, model: 'claude-opus-5-5' }, sonnet: { ...base, model: 'claude-sonnet-5-5' } };
    config.models.default = 'opus';
    config.loop.fanout = { auto: true, minDifficulty: 30, count: 2, verify: true, judges: 1 };
    config.verification.commands = { test: 'node -e "import(\'./src/greet.js\').then(m => process.exit(m.greet() === \'hi\' ? 0 : 1))"' };
    config.permissions.approved = ['node'];
    await saveConfig(root, config);
    process.env.MULLIGAN_TEST_KEY = 'test';

    // Answers: confirm writing the files on /apply.
    const io = scriptedIo(['y']);
    const session = await new Session(root, io).load();
    await findCommand('implement')!.run(session, 'Make greet return "hi" across the session token refresh path');
    const out = io.output.join('\n');
    expect(out).toMatch(/Fanning out: difficulty \d+\/100/);
    expect(out).toContain('MULLIGAN FAN-OUT');
    expect(session.lastFanOut?.candidates).toHaveLength(2);
    expect(session.lastFanOut?.candidates.every((c) => c.verification.status === 'passed')).toBe(true);

    await findCommand('pick')!.run(session, '');
    expect(session.attempts.at(-1)?.diff).toContain('+export const greet = () => "hi";');
    await findCommand('apply')!.run(session, '');
    // git may convert line endings per the machine's core.autocrlf setting.
    expect((await readFile(path.join(root, 'src', 'greet.js'), 'utf8')).replace(/\r\n/g, '\n')).toBe('export const greet = () => "hi";\n');
  });
});
