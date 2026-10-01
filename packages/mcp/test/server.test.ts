import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { initWorkspace } from '@mulligan/core';
import { loadMemory } from '@mulligan/memory';
import { beforeAll, describe, expect, it } from 'vitest';
import { createMulliganerver } from '../src/index.js';

let root: string;
let client: Client;

const call = async (name: string, args: Record<string, unknown> = {}) => {
  const result = (await client.callTool({ name, arguments: { root, ...args } })) as { content: { text: string }[]; isError?: boolean };
  return { text: result.content.map((c) => c.text).join('\n'), isError: Boolean(result.isError) };
};

beforeAll(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'mulligan-mcp-'));
  const git = (...a: string[]) => execFileSync('git', ['-c', 'user.email=t@e.com', '-c', 'user.name=T', '-c', 'commit.gpgsign=false', ...a], { cwd: root, stdio: 'pipe' });
  git('init', '-q', '-b', 'main');
  await mkdir(path.join(root, 'src'));
  await writeFile(path.join(root, 'src', 'a.ts'), 'export const a = 1;\n');
  await initWorkspace(root, 'mcp');
  git('add', '-A');
  git('commit', '-q', '-m', 'init');
  await writeFile(path.join(root, 'src', 'a.ts'), 'export const a: any = 1;\nexport function unused() { return 2; }\n');

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await createMulliganerver(root).connect(serverTransport);
  client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(clientTransport);
});

describe('Mulligan MCP server', () => {
  it('exposes the engine as tools', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(
      ['cookbook_check', 'memory_decide', 'memory_list', 'memory_propose', 'models_discover', 'mulligan_fanout', 'mulligan_mem_review', 'mulligan_review', 'route_task'].sort(),
    );
  });

  it('runs a Mulligan Review with the Karpathy block', async () => {
    const { text } = await call('mulligan_review', { task: 'Type the constant.' });
    expect(text).toMatch(/^MULLIGAN REVIEW/);
    expect(text).toContain('KARPATHY PRINCIPLES');
    expect(text).toMatch(/`unused` is not used anywhere/);
  });

  it('only records memory decisions the developer explicitly made', async () => {
    const proposed = await call('memory_propose', {
      category: 'typescript',
      rule: 'Prefer unknown over any at boundaries.',
      source: 'human_correction',
      stated_by_human: true,
    });
    expect(proposed.text).toMatch(/Proposed MM-001 as a candidate/);
    expect((await loadMemory(root)).principles).toHaveLength(0);

    const refused = await call('memory_decide', { id: 'MM-001', decision: 'accept', confirmed_by_human: false });
    expect(refused.isError).toBe(true);
    expect((await loadMemory(root)).principles).toHaveLength(0);

    await call('memory_decide', { id: 'MM-001', decision: 'accept', confirmed_by_human: true });
    const memory = await loadMemory(root);
    expect(memory.principles[0]).toMatchObject({ id: 'MM-001', confirmed: true });
    expect((await call('memory_list')).text).toContain('Prefer unknown over any at boundaries.');
  });

  it('explains routing decisions', async () => {
    const { text } = await call('route_task', { task: 'Fix a typo in the README' });
    expect(text).toMatch(/difficulty 5\/100 → tier 1/);
    expect(text).toMatch(/implementer: implementer is assigned to claude/);
  });
});
