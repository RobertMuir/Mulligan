/**
 * Extracts the first JSON value from a model response, tolerating code fences
 * and surrounding prose. Returns undefined when nothing parses. The result is
 * untrusted model output: callers must narrow it.
 */
export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidates = [fenced?.[1], text];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const start = candidate.search(/[[{]/);
    if (start === -1) continue;
    const open = candidate[start];
    const close = open === '[' ? ']' : '}';
    const end = candidate.lastIndexOf(close);
    if (end <= start) continue;
    try {
      return JSON.parse(candidate.slice(start, end + 1)) as unknown;
    } catch {
      // Try the next candidate.
    }
  }
  return undefined;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** The message of anything thrown — which is not guaranteed to be an Error. */
export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** A string field of an untrusted object, if it is one. */
export function stringField(value: unknown, key: string): string | undefined {
  const v = isRecord(value) ? value[key] : undefined;
  return typeof v === 'string' ? v : undefined;
}

/** A number field of an untrusted object, if it is one. */
export function numberField(value: unknown, key: string): number | undefined {
  const v = isRecord(value) ? value[key] : undefined;
  return typeof v === 'number' ? v : undefined;
}
