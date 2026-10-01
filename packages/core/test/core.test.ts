import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ConfiguredModelRouter,
  addedLinesByFile,
  extractJson,
  initWorkspace,
  loadConfig,
  rankOf,
  type ModelProvider,
  type ProviderConfig,
} from '../src/index.js';

describe('standards hierarchy', () => {
  it('ranks human instruction highest and model preference lowest', () => {
    expect(rankOf('human_instruction')).toBe(1);
    expect(rankOf('model_preference')).toBe(9);
    expect(rankOf('project_cookbook')).toBeLessThan(rankOf('mulligan_memory'));
    expect(rankOf('golden_pr')).toBeGreaterThan(rankOf('mulligan_memory'));
  });
});

describe('ConfiguredModelRouter', () => {
  const fake = (name: string, config: ProviderConfig): ModelProvider => ({
    name,
    kind: config.kind,
    model: config.model,
    complete: async () => ({ text: name, provider: config.kind, model: config.model }),
  });

  it('routes roles to their assigned provider and falls back to default', async () => {
    const router = new ConfiguredModelRouter(
      {
        providers: { claude: { kind: 'anthropic', model: 'claude-opus-5-5' }, gpt: { kind: 'openai', model: 'some-gpt' } },
        roles: { reviewer: 'gpt' },
        default: 'claude',
      },
      fake,
    );
    expect((await router.selectModel('reviewer', { description: '' })).name).toBe('gpt');
    expect((await router.selectModel('implementer', { description: '' })).name).toBe('claude');
    expect(router.isSingleModel()).toBe(false);
  });

  it('supports single-model mode', () => {
    const router = new ConfiguredModelRouter({ providers: { local: { kind: 'ollama', model: 'qwen' } }, default: 'local' }, fake);
    expect(router.isSingleModel()).toBe(true);
  });

  it('explains a missing assignment', async () => {
    const router = new ConfiguredModelRouter({ providers: {} }, fake);
    await expect(router.selectModel('architect', { description: '' })).rejects.toThrow(/No model is assigned/);
  });
});

describe('workspace', () => {
  it('creates .mulligan/ and keeps .MulliganMem and the private rubric out of git', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mulligan-ws-'));
    await writeFile(path.join(root, '.gitignore'), 'node_modules\n');
    const result = await initWorkspace(root, 'demo');
    expect(result.created).toContain('.mulligan/cookbook');
    const gitignore = await readFile(path.join(root, '.gitignore'), 'utf8');
    expect(gitignore).toContain('node_modules\n');
    expect(gitignore).toContain('.MulliganMem\n');
    expect(gitignore).toContain('.mulligan/verification/\n');
    expect(gitignore).not.toMatch(/^\.mulligan\/cookbook/m);

    const again = await initWorkspace(root, 'demo');
    expect(again.created).toEqual([]);
    expect(again.gitignoreUpdated).toBe(false);
    expect((await loadConfig(root)).project.name).toBe('demo');
  });
});

describe('addedLinesByFile', () => {
  it('maps added lines from a unified diff', () => {
    const diff = [
      'diff --git a/src/a.ts b/src/a.ts',
      '--- a/src/a.ts',
      '+++ b/src/a.ts',
      '@@ -3,0 +4,2 @@',
      '+const a = 1;',
      '+const b = 2;',
      '@@ -10 +12 @@',
      '-old',
      '+new',
      'diff --git a/gone.ts b/gone.ts',
      '--- a/gone.ts',
      '+++ /dev/null',
      '@@ -1 +0,0 @@',
      '-bye',
    ].join('\n');
    const map = addedLinesByFile(diff);
    expect([...map.get('src/a.ts')!]).toEqual([4, 5, 12]);
    expect(map.has('gone.ts')).toBe(false);
  });
});

describe('extractJson', () => {
  it('reads JSON from fenced or chatty model output', () => {
    expect(extractJson('Sure!\n```json\n[{"a":1}]\n```')).toEqual([{ a: 1 }]);
    expect(extractJson('Here: {"ok": true} hope that helps')).toEqual({ ok: true });
    expect(extractJson('nothing here')).toBeUndefined();
  });
});
