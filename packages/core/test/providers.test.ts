import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createProvider } from '../src/index.js';

interface Seen {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

function fakeFetch(response: unknown, seen: Seen[]): typeof fetch {
  return (async (url: string, init: RequestInit) => {
    seen.push({ url, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) as Record<string, unknown> });
    return new Response(JSON.stringify(response));
  }) as typeof fetch;
}

beforeEach(() => {
  process.env.MULLIGAN_TEST_PROVIDER_KEY = 'secret';
});
afterEach(() => {
  delete process.env.MULLIGAN_TEST_PROVIDER_KEY;
});

const request = { system: 'Be brief.', messages: [{ role: 'user' as const, content: 'hi' }], maxTokens: 50 };

describe('model protocols', () => {
  it('speaks the Anthropic Messages API and keeps only text blocks', async () => {
    const seen: Seen[] = [];
    const provider = createProvider(
      'claude',
      { kind: 'anthropic', model: 'claude-opus-5-5', apiKeyEnv: 'MULLIGAN_TEST_PROVIDER_KEY' },
      fakeFetch({ content: [{ type: 'thinking', thinking: 'x' }, { type: 'text', text: 'Hello' }, { type: 'text', text: ' there' }], usage: { input_tokens: 7, output_tokens: 2 } }, seen),
    );
    expect(await provider.complete(request)).toEqual({ text: 'Hello there', usage: { inputTokens: 7, outputTokens: 2 }, provider: 'anthropic', model: 'claude-opus-5-5' });
    expect(seen[0]).toMatchObject({
      url: 'https://api.anthropic.com/v1/messages',
      headers: { 'x-api-key': 'secret', 'anthropic-version': '2023-06-01' },
      body: { model: 'claude-opus-5-5', max_tokens: 50, system: 'Be brief.' },
    });
  });

  it('speaks Gemini generateContent with model-role mapping', async () => {
    const seen: Seen[] = [];
    const provider = createProvider(
      'gem',
      { kind: 'gemini', model: 'gemini-x', apiKeyEnv: 'MULLIGAN_TEST_PROVIDER_KEY' },
      fakeFetch({ candidates: [{ content: { parts: [{ text: 'Hi' }, { text: '!' }] } }] }, seen),
    );
    const result = await provider.complete({ messages: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }] });
    expect(result.text).toBe('Hi!');
    expect(seen[0]?.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-x:generateContent');
    expect(seen[0]?.body.contents).toEqual([
      { role: 'user', parts: [{ text: 'a' }] },
      { role: 'model', parts: [{ text: 'b' }] },
    ]);
  });

  it('degrades to empty text on an unexpected response shape instead of crashing', async () => {
    const provider = createProvider('gpt', { kind: 'openai', model: 'm', apiKeyEnv: 'MULLIGAN_TEST_PROVIDER_KEY' }, fakeFetch({ error: 'nope' }, []));
    expect(await provider.complete(request)).toMatchObject({ text: '', usage: { inputTokens: undefined, outputTokens: undefined } });
  });

  it('refuses to call a hosted provider without its key', async () => {
    const provider = createProvider('gpt', { kind: 'openai', model: 'm', apiKeyEnv: 'MULLIGAN_ABSENT_KEY' }, fakeFetch({}, []));
    await expect(provider.complete(request)).rejects.toThrow(/needs the MULLIGAN_ABSENT_KEY environment variable/);
  });
});
