export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

/** POSTs JSON and returns the parsed body — still untyped: callers must narrow it. */
export async function postJson(url: string, headers: Record<string, string>, body: unknown, fetchImpl: typeof fetch = fetch): Promise<unknown> {
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new ProviderError(`${url} responded ${response.status}: ${text.slice(0, 500)}`, response.status);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ProviderError(`${url} returned non-JSON response: ${text.slice(0, 200)}`);
  }
}

export function requireApiKey(envName: string | undefined, providerName: string): string {
  if (!envName) {
    throw new ProviderError(`Provider "${providerName}" has no apiKeyEnv configured.`);
  }
  const key = process.env[envName];
  if (!key) {
    throw new ProviderError(`Provider "${providerName}" needs the ${envName} environment variable.`);
  }
  return key;
}
