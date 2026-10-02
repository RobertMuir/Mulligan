import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConfigError, configProblems, defaultConfig, loadConfig } from '../src/index.js';

async function projectWith(yaml: string): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mulligan-config-'));
  await mkdir(path.join(root, '.mulligan'));
  await writeFile(path.join(root, '.mulligan', 'config.yaml'), yaml);
  return root;
}

describe('config validation at the boundary', () => {
  it('accepts the default configuration', () => {
    expect(configProblems(defaultConfig('demo'))).toEqual([]);
  });

  it('reports every problem at once, with the path to fix', async () => {
    const root = await projectWith(
      [
        'models:',
        '  providers:',
        '    local: { kind: llama, model: llama3 }',
        '    big: { kind: anthropic, model: claude-opus-5-5, capability: 9 }',
        '  roles: { reviewer: gpt, designer: big }',
        '  default: big',
        '  routing: { mode: automatic }',
        'loop:',
        '  fanout: { count: 20 }',
      ].join('\n'),
    );
    const error = await loadConfig(root).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConfigError);
    expect((error as ConfigError).problems).toEqual([
      expect.stringMatching(/^models\.providers\.local\.kind must be one of anthropic, .* \(got "llama"\)$/),
      'models.providers.big.capability must be a number from 1 to 5',
      'models.roles.reviewer refers to "gpt", which is not defined under models.providers',
      expect.stringMatching(/^models\.roles\.designer is not a role/),
      'models.routing.mode must be "manual" or "auto"',
      'loop.fanout.count must be a whole number from 1 to 8',
    ]);
  });

  it('turns invalid YAML into a ConfigError', async () => {
    const root = await projectWith('models: [unclosed');
    await expect(loadConfig(root)).rejects.toThrow(/not valid YAML/);
  });

  it('merges a partial file over the defaults', async () => {
    const root = await projectWith('mode: safety\nloop:\n  fanout: { count: 5 }\n');
    const config = await loadConfig(root);
    expect(config.mode).toBe('safety');
    expect(config.loop.fanout).toEqual({ auto: true, minDifficulty: 60, count: 5, verify: true, judges: 1 });
    expect(config.loop.delegation).toEqual({ mode: 'auto', maxWorkers: 4, workerModel: 'sonnet' });
  });

  it('merges and checks loop.delegation', async () => {
    const asked = await loadConfig(await projectWith('loop:\n  delegation: { mode: ask, workerModel: fast }\n'));
    expect(asked.loop.delegation).toEqual({ mode: 'ask', maxWorkers: 4, workerModel: 'fast' });

    const error = await loadConfig(await projectWith('loop:\n  delegation: { mode: always, maxWorkers: 0, workerModel: "" }\n')).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConfigError);
    expect((error as ConfigError).problems).toEqual([
      'loop.delegation.mode must be "auto", "ask" or "off" (got "always")',
      'loop.delegation.maxWorkers must be a whole number from 1 to 8',
      'loop.delegation.workerModel must be a model name',
    ]);
  });
});
