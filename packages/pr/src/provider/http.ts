import { PrProviderError } from './types.js';

export async function getJson<T>(url: string, headers: Record<string, string>, fetchImpl: typeof fetch): Promise<T> {
  const response = await fetchImpl(url, { headers: { accept: 'application/json', ...headers } });
  if (!response.ok) {
    const body = await response.text();
    const hint =
      response.status === 401 || response.status === 403
        ? ' Check the access token and its scopes.'
        : response.status === 404
          ? ' Check the repository name and that the token can see it.'
          : '';
    throw new PrProviderError(`GET ${url} → ${response.status}.${hint} ${body.slice(0, 200)}`);
  }
  return (await response.json()) as T;
}
