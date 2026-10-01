import { describe, expect, it } from 'vitest';
import {
  ConfiguredModelRouter,
  assessDifficulty,
  createProvider,
  discoverLocalModels,
  estimateCapability,
  estimateCost,
  isProviderReady,
  type ModelProvider,
  type ModelsConfig,
  type ProviderConfig,
} from '../src/index.js';

const fake = (name: string, config: ProviderConfig): ModelProvider => ({
  name,
  kind: config.kind,
  model: config.model,
  complete: async () => ({ text: name, provider: config.kind, model: config.model }),
});

describe('model catalog', () => {
  it('estimates capability from the model id, and lets config override it', () => {
    expect(estimateCapability({ kind: 'anthropic', model: 'claude-opus-5-5' })).toBe(5);
    expect(estimateCapability({ kind: 'anthropic', model: 'claude-haiku-4-5' })).toBe(2);
    expect(estimateCapability({ kind: 'ollama', model: 'llama3.1:8b' })).toBe(1);
    expect(estimateCapability({ kind: 'ollama', model: 'llama3.3:70b' })).toBe(3);
    expect(estimateCapability({ kind: 'ollama', model: 'my-custom-model' })).toBe(2);
    expect(estimateCapability({ kind: 'ollama', model: 'llama3.1:8b', capability: 4 })).toBe(4);
  });

  it('treats local models as free and keyless', () => {
    expect(estimateCost({ kind: 'llamacpp', model: 'anything' })).toBe(0);
    expect(isProviderReady({ kind: 'ollama', model: 'llama3.2' })).toBe(true);
    expect(isProviderReady({ kind: 'lmstudio', model: 'qwen' })).toBe(true);
    expect(isProviderReady({ kind: 'mistral', model: 'mistral-large', apiKeyEnv: 'MULLIGAN_ABSENT_KEY' })).toBe(false);
  });

  it('speaks the OpenAI-compatible protocol to local Llama servers without a key', async () => {
    let seen: { url: string; headers: Record<string, string>; body: { model: string } } | undefined;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      seen = { url, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) };
      return new Response(JSON.stringify({ choices: [{ message: { content: 'hi' } }] }));
    }) as typeof fetch;
    const llama = createProvider('llama', { kind: 'llamacpp', model: 'llama-3.1-8b' }, fetchImpl);
    expect((await llama.complete({ messages: [{ role: 'user', content: 'x' }] })).text).toBe('hi');
    expect(seen!.url).toBe('http://localhost:8080/v1/chat/completions');
    expect(seen!.headers.authorization).toBeUndefined();
    expect(seen!.body.model).toBe('llama-3.1-8b');
  });
});

describe('difficulty weighting', () => {
  it('attributes every point to a named factor', () => {
    const trivial = assessDifficulty({ description: 'Fix a typo in the README' });
    expect(trivial.score).toBe(5);
    expect(trivial.tier).toBe(1);

    const hard = assessDifficulty(
      { description: 'Redesign offline sync so concurrent writes are idempotent across a schema migration', files: Array(8).fill('f'), safetyMode: true },
      'architect',
    );
    expect(hard.factors.map((f) => f.name)).toEqual(
      expect.arrayContaining(['architecture', 'concurrency', 'dataIntegrity', 'filesSeveral', 'safetyMode', 'roleArchitect']),
    );
    expect(hard.score).toBe(97);
    expect(hard.tier).toBe(5);
  });

  it('escalates with each Mulligan taken and honours weight overrides', () => {
    const task = { description: 'Add a settings screen' };
    expect(assessDifficulty({ ...task, attempts: 2 }).score - assessDifficulty(task).score).toBe(20);
    expect(assessDifficulty(task, undefined, { base: 50 }).score).toBe(50);
  });
});

describe('automatic model selection', () => {
  const config: ModelsConfig = {
    providers: {
      llama: { kind: 'ollama', model: 'llama3.1:8b' },
      haiku: { kind: 'anthropic', model: 'claude-haiku-4-5' },
      sonnet: { kind: 'anthropic', model: 'claude-sonnet-5-5' },
      opus: { kind: 'anthropic', model: 'claude-opus-5-5' },
    },
    roles: { reviewer: 'sonnet' },
    default: 'opus',
    routing: { mode: 'auto', pinned: ['reviewer'] },
  };
  const router = new ConfiguredModelRouter(config, fake, () => true);

  it('picks the cheapest model capable of the task', () => {
    expect(router.decide('implementer', { description: 'Fix a typo in the README' }).provider).toBe('llama');
    expect(router.decide('implementer', { description: 'Add a settings screen with two toggles' }).provider).toBe('haiku');
    const hard = router.decide('implementer', {
      description: 'Redesign the auth token refresh to avoid a race between concurrent requests',
      files: Array(7).fill('f'),
    });
    expect(hard.provider).toBe('sonnet');
    expect(hard.reason).toMatch(/difficulty 77\/100 → tier 4/);
    const hardest = router.decide('implementer', {
      description: 'Redesign the auth token refresh to avoid a race',
      files: Array(7).fill('f'),
      safetyMode: true,
    });
    expect(hardest.provider).toBe('opus');
    expect(hardest.reason).toMatch(/tier 5/);
  });

  it('escalates after Mulligan', () => {
    const task = { description: 'Add a settings screen with two toggles' };
    expect(router.decide('implementer', { ...task, attempts: 0 }).provider).toBe('haiku');
    expect(router.decide('implementer', { ...task, attempts: 3 }).provider).toBe('sonnet');
  });

  it('keeps pinned roles and can prefer local models', () => {
    expect(router.decide('reviewer', { description: 'anything' })).toMatchObject({ provider: 'sonnet', mode: 'pinned' });
    const local = new ConfiguredModelRouter(
      { ...config, providers: { ...config.providers, big: { kind: 'ollama', model: 'llama3.1:405b' } }, routing: { mode: 'auto', preferLocal: true } },
      fake,
      () => true,
    );
    expect(local.decide('implementer', { description: 'Add a settings screen with two toggles' }).provider).toBe('big');
  });

  it('only routes to ready models', () => {
    const onlyOpus = new ConfiguredModelRouter(config, fake, (c) => c.model === 'claude-opus-5-5');
    expect(onlyOpus.decide('implementer', { description: 'Fix a typo' }).provider).toBe('opus');
  });
});

describe('local model discovery', () => {
  it('lists models from running local servers and skips the rest', async () => {
    const fetchImpl = (async (url: string) => {
      if (url === 'http://localhost:11434/api/tags') {
        return new Response(JSON.stringify({ models: [{ name: 'llama3.1:8b', details: { parameter_size: '8.0B' } }] }));
      }
      if (url === 'http://localhost:1234/v1/models') return new Response(JSON.stringify({ data: [{ id: 'qwen2.5-coder-32b' }] }));
      throw new Error('connection refused');
    }) as typeof fetch;
    expect(await discoverLocalModels({ fetchImpl })).toEqual([
      { kind: 'ollama', model: 'llama3.1:8b', baseUrl: 'http://localhost:11434/v1', size: '8.0B' },
      { kind: 'lmstudio', model: 'qwen2.5-coder-32b', baseUrl: 'http://localhost:1234/v1' },
    ]);
  });
});
