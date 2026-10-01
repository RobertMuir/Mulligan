import { isRecord } from '../../json.js';
import { isLocal, keyEnvFor, presetFor, type Protocol } from '../catalog.js';
import type { CompletionRequest, CompletionResult, ModelProvider, ProviderConfig, ProviderKind } from '../types.js';
import { ProviderError, postJson, requireApiKey } from './http.js';

export { ProviderError } from './http.js';

const DEFAULT_MAX_TOKENS = 4096;

// ── Narrowing helpers for untrusted response bodies ─────────────────────────

const at = (value: unknown, key: string): unknown => (isRecord(value) ? value[key] : undefined);
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const text = (value: unknown): string => (typeof value === 'string' ? value : '');
const count = (value: unknown): number | undefined => (typeof value === 'number' ? value : undefined);

interface Call {
  path: string;
  headers: Record<string, string>;
  body: unknown;
}

interface Parsed {
  text: string;
  usage: CompletionResult['usage'];
}

interface ProtocolSpec {
  /** Builds the HTTP call. `key` is undefined only for keyless local servers. */
  call(model: string, kind: ProviderKind, request: CompletionRequest, key: string | undefined): Call;
  parse(body: unknown): Parsed;
}

const optional = <T extends object>(condition: unknown, value: T): T | Record<string, never> => (condition ? value : {});

/** How each wire protocol asks for a completion and where the answer lives in the response. */
const PROTOCOLS: Record<Protocol, ProtocolSpec> = {
  anthropic: {
    call: (model, _kind, request, key) => ({
      path: '/messages',
      headers: { ...optional(key, { 'x-api-key': key ?? '' }), 'anthropic-version': '2023-06-01' },
      body: {
        model,
        max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
        ...optional(request.system, { system: request.system }),
        ...optional(request.temperature !== undefined, { temperature: request.temperature }),
        messages: request.messages,
      },
    }),
    parse: (body) => ({
      text: list(at(body, 'content'))
        .filter((block) => at(block, 'type') === 'text')
        .map((block) => text(at(block, 'text')))
        .join(''),
      usage: { inputTokens: count(at(at(body, 'usage'), 'input_tokens')), outputTokens: count(at(at(body, 'usage'), 'output_tokens')) },
    }),
  },
  openai: {
    call: (model, kind, request, key) => ({
      path: '/chat/completions',
      headers: optional(key, { authorization: `Bearer ${key ?? ''}` }),
      body: {
        model,
        messages: [...(request.system ? [{ role: 'system', content: request.system }] : []), ...request.messages],
        // OpenAI's newer models take max_completion_tokens; compatible servers take max_tokens.
        [kind === 'openai' ? 'max_completion_tokens' : 'max_tokens']: request.maxTokens ?? DEFAULT_MAX_TOKENS,
        ...optional(request.temperature !== undefined, { temperature: request.temperature }),
      },
    }),
    parse: (body) => ({
      text: text(at(at(list(at(body, 'choices'))[0], 'message'), 'content')),
      usage: { inputTokens: count(at(at(body, 'usage'), 'prompt_tokens')), outputTokens: count(at(at(body, 'usage'), 'completion_tokens')) },
    }),
  },
  gemini: {
    call: (model, _kind, request, key) => ({
      path: `/models/${encodeURIComponent(model)}:generateContent`,
      headers: optional(key, { 'x-goog-api-key': key ?? '' }),
      body: {
        ...optional(request.system, { systemInstruction: { parts: [{ text: request.system }] } }),
        contents: request.messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        generationConfig: {
          maxOutputTokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
          ...optional(request.temperature !== undefined, { temperature: request.temperature }),
        },
      },
    }),
    parse: (body) => ({
      text: list(at(at(list(at(body, 'candidates'))[0], 'content'), 'parts'))
        .map((part) => text(at(part, 'text')))
        .join(''),
      usage: {
        inputTokens: count(at(at(body, 'usageMetadata'), 'promptTokenCount')),
        outputTokens: count(at(at(body, 'usageMetadata'), 'candidatesTokenCount')),
      },
    }),
  },
};

class HttpModelProvider implements ModelProvider {
  readonly kind: ProviderKind;
  readonly model: string;

  constructor(
    readonly name: string,
    private readonly config: ProviderConfig,
    private readonly fetchImpl: typeof fetch,
  ) {
    this.kind = config.kind;
    this.model = config.model;
  }

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    const preset = presetFor(this.config);
    const base = (this.config.baseUrl ?? preset.baseUrl)?.replace(/\/+$/, '');
    if (!base) throw new ProviderError(`Provider "${this.name}" (${this.kind}) needs a baseUrl.`);
    // Local servers usually need no key; send one only when configured.
    const keyless = isLocal(this.config) && !this.config.apiKeyEnv;
    const key = keyless ? undefined : requireApiKey(keyEnvFor(this.config), this.name);
    const protocol = PROTOCOLS[preset.protocol];
    const call = protocol.call(this.model, this.kind, request, key);
    const parsed = protocol.parse(await postJson(`${base}${call.path}`, call.headers, call.body, this.fetchImpl));
    return { ...parsed, provider: this.kind, model: this.model };
  }
}

export type ProviderFactory = (name: string, config: ProviderConfig) => ModelProvider;

export function createProvider(name: string, config: ProviderConfig, fetchImpl: typeof fetch = fetch): ModelProvider {
  if (!config.model) {
    throw new ProviderError(`Provider "${name}" has no model set. Add "model:" under models.providers.${name} in .mulligan/config.yaml.`);
  }
  return new HttpModelProvider(name, config, fetchImpl);
}

/** Whether a provider's credentials are present, without making a network call. */
export function isProviderReady(config: ProviderConfig): boolean {
  if (!config.model) return false;
  if (isLocal(config) && !config.apiKeyEnv) return true;
  const env = keyEnvFor(config);
  return Boolean(env && process.env[env]);
}
