import type { ProviderConfig, ProviderKind } from './types.js';

export type Protocol = 'anthropic' | 'openai' | 'gemini';

export interface ProviderPreset {
  label: string;
  protocol: Protocol;
  baseUrl?: string;
  keyEnv?: string;
  /** Runs on this machine: no key, no per-token cost, data stays local. */
  local: boolean;
}

/**
 * Every provider Mulligan Bot speaks to out of the box. Anything else that
 * exposes an OpenAI-compatible endpoint works through `openai-compatible`
 * with a `baseUrl` (LiteLLM, Azure OpenAI proxies, self-hosted gateways…).
 */
export const PROVIDER_PRESETS: Record<ProviderKind, ProviderPreset> = {
  anthropic: { label: 'Anthropic (Claude)', protocol: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', keyEnv: 'ANTHROPIC_API_KEY', local: false },
  openai: { label: 'OpenAI (GPT)', protocol: 'openai', baseUrl: 'https://api.openai.com/v1', keyEnv: 'OPENAI_API_KEY', local: false },
  gemini: { label: 'Google Gemini', protocol: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', keyEnv: 'GEMINI_API_KEY', local: false },
  openrouter: { label: 'OpenRouter (hundreds of models)', protocol: 'openai', baseUrl: 'https://openrouter.ai/api/v1', keyEnv: 'OPENROUTER_API_KEY', local: false },
  mistral: { label: 'Mistral', protocol: 'openai', baseUrl: 'https://api.mistral.ai/v1', keyEnv: 'MISTRAL_API_KEY', local: false },
  groq: { label: 'Groq', protocol: 'openai', baseUrl: 'https://api.groq.com/openai/v1', keyEnv: 'GROQ_API_KEY', local: false },
  together: { label: 'Together AI', protocol: 'openai', baseUrl: 'https://api.together.xyz/v1', keyEnv: 'TOGETHER_API_KEY', local: false },
  deepseek: { label: 'DeepSeek', protocol: 'openai', baseUrl: 'https://api.deepseek.com/v1', keyEnv: 'DEEPSEEK_API_KEY', local: false },
  xai: { label: 'xAI (Grok)', protocol: 'openai', baseUrl: 'https://api.x.ai/v1', keyEnv: 'XAI_API_KEY', local: false },
  fireworks: { label: 'Fireworks AI', protocol: 'openai', baseUrl: 'https://api.fireworks.ai/inference/v1', keyEnv: 'FIREWORKS_API_KEY', local: false },
  ollama: { label: 'Ollama (local: Llama, Qwen, Mistral, …)', protocol: 'openai', baseUrl: 'http://localhost:11434/v1', local: true },
  llamacpp: { label: 'llama.cpp server (local)', protocol: 'openai', baseUrl: 'http://localhost:8080/v1', local: true },
  lmstudio: { label: 'LM Studio (local)', protocol: 'openai', baseUrl: 'http://localhost:1234/v1', local: true },
  vllm: { label: 'vLLM (local or self-hosted)', protocol: 'openai', baseUrl: 'http://localhost:8000/v1', local: true },
  'openai-compatible': { label: 'Any OpenAI-compatible endpoint', protocol: 'openai', local: false },
};

export function presetFor(config: ProviderConfig): ProviderPreset {
  return PROVIDER_PRESETS[config.kind];
}

export function keyEnvFor(config: ProviderConfig): string | undefined {
  return config.apiKeyEnv ?? presetFor(config).keyEnv;
}

export function isLocal(config: ProviderConfig): boolean {
  return config.local ?? presetFor(config).local;
}

/**
 * Rough capability on a 1–5 scale, used by automatic routing. A `capability`
 * set in config always wins — this table only provides sensible defaults and
 * can never know every model, so unknown models land in the middle.
 */
export function estimateCapability(config: ProviderConfig): number {
  if (config.capability !== undefined) return clamp(config.capability, 1, 5);
  const m = config.model.toLowerCase();
  const named: [RegExp, number][] = [
    [/opus/, 5],
    [/sonnet/, 4],
    [/haiku/, 2],
    [/(^|[^a-z])o[134](-|$)|gpt-5(?!.*(mini|nano))/, 5],
    [/(mini|nano|flash-lite|lite)/, 2],
    [/gemini.*pro|grok-[4-9]|deepseek-(r1|reasoner)|mistral-large|codestral|qwen3?-coder/, 4],
    [/gpt-4o|gpt-4\.1|gemini.*flash|grok|deepseek|llama-?3\.[13]-?405/, 3],
  ];
  for (const [pattern, score] of named) if (pattern.test(m)) return score;
  const size = /(\d+(?:\.\d+)?)\s*b\b/.exec(m.replace(/[-_:]/g, ' '));
  if (size?.[1]) {
    const b = Number(size[1]);
    return b >= 200 ? 4 : b >= 60 ? 3 : b >= 20 ? 2 : 1;
  }
  return isLocal(config) ? 2 : 3;
}

/** Relative cost on a 0–5 scale. Local models are free to run. */
export function estimateCost(config: ProviderConfig): number {
  if (config.cost !== undefined) return clamp(config.cost, 0, 5);
  return isLocal(config) ? 0 : estimateCapability(config);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
