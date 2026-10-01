import { isRecord } from '../json.js';
import { PROVIDER_PRESETS } from './catalog.js';
import type { ProviderKind } from './types.js';

const listOf = (value: unknown, key: string): unknown[] => {
  const v = isRecord(value) ? value[key] : undefined;
  return Array.isArray(v) ? v : [];
};
const stringAt = (value: unknown, key: string): string | undefined => {
  const v = isRecord(value) ? value[key] : undefined;
  return typeof v === 'string' ? v : undefined;
};

export interface DiscoveredModel {
  kind: ProviderKind;
  model: string;
  baseUrl: string;
  /** e.g. "8B", when the server reports it. */
  size?: string;
}

const LOCAL_SERVERS: ProviderKind[] = ['ollama', 'lmstudio', 'llamacpp', 'vllm'];

async function getJson(url: string, fetchImpl: typeof fetch, timeoutMs: number): Promise<unknown> {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`${url} → ${response.status}`);
  return response.json();
}

/**
 * Finds models served on this machine: Ollama, LM Studio, llama.cpp and vLLM
 * on their default ports. Servers that are not running are skipped quietly.
 */
export async function discoverLocalModels(options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {}): Promise<DiscoveredModel[]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 800;
  const results = await Promise.all(
    LOCAL_SERVERS.map(async (kind): Promise<DiscoveredModel[]> => {
      const baseUrl = PROVIDER_PRESETS[kind].baseUrl;
      if (!baseUrl) return [];
      try {
        if (kind === 'ollama') {
          // Ollama's native listing includes parameter sizes.
          const data = await getJson(baseUrl.replace(/\/v1$/, '/api/tags'), fetchImpl, timeoutMs);
          return listOf(data, 'models').flatMap((m) => {
            const model = stringAt(m, 'name');
            const size = isRecord(m) ? stringAt(m.details, 'parameter_size') : undefined;
            return model ? [{ kind, model, baseUrl, ...(size ? { size } : {}) }] : [];
          });
        }
        const data = await getJson(`${baseUrl}/models`, fetchImpl, timeoutMs);
        return listOf(data, 'data').flatMap((m) => {
          const model = stringAt(m, 'id');
          return model ? [{ kind, model, baseUrl }] : [];
        });
      } catch {
        return [];
      }
    }),
  );
  return results.flat();
}
