import { existsSync } from 'node:fs';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { today, workspacePaths } from '@mulligan/core';
import { parseMemory, serializeMemory } from './parser.js';
import { capConfidence, maxConfidence } from './provenance.js';
import { emptyMemory, type Confidence, type MulliganMemory, type Principle } from './types.js';

export type Actor = 'human' | 'mulligan';

export interface HistoryEntry {
  at: string;
  actor: Actor;
  action: 'propose' | 'accept' | 'reject' | 'modify' | 'retire' | 'add' | 'import';
  id: string;
  before?: Partial<Principle>;
  after?: Partial<Principle>;
  note?: string;
}

export type NewLesson = Omit<Principle, 'id' | 'created' | 'confidence' | 'confirmed'> & {
  confidence?: Confidence;
};

export type ProposeResult =
  | { status: 'proposed'; candidate: Principle }
  | { status: 'duplicate'; existingId: string; reason: string };

export class MemoryError extends Error {
  override name = 'MemoryError';
}

/**
 * In-memory operations on a MulliganMemory. Every mutation is journalled;
 * nothing becomes a principle without a human action (spec §7, §36).
 */
export class MemoryStore {
  readonly journal: HistoryEntry[] = [];

  constructor(readonly memory: MulliganMemory) {}

  get principles(): readonly Principle[] {
    return this.memory.principles;
  }

  get candidates(): readonly Principle[] {
    return this.memory.candidates;
  }

  find(id: string): Principle | undefined {
    return [...this.memory.principles, ...this.memory.candidates].find((p) => p.id === id);
  }

  nextId(): string {
    const ids = [
      ...this.memory.principles.map((p) => p.id),
      ...this.memory.candidates.map((p) => p.id),
      ...this.memory.rejected.map((p) => p.id),
    ];
    const max = ids.reduce((acc, id) => Math.max(acc, Number(/^MM-(\d+)$/.exec(id)?.[1] ?? 0)), 0);
    return `MM-${String(max + 1).padStart(3, '0')}`;
  }

  /** Mulligan proposes a lesson. It always lands as a candidate. */
  propose(lesson: NewLesson, actor: Actor = 'mulligan'): ProposeResult {
    const duplicate = this.findSimilar(lesson.rule);
    if (duplicate) return { status: 'duplicate', ...duplicate };
    const candidate: Principle = {
      ...lesson,
      id: this.nextId(),
      confidence: 'candidate',
      confirmed: false,
      created: today(),
    };
    this.memory.candidates.push(candidate);
    this.record({ actor, action: 'propose', id: candidate.id, after: candidate });
    return { status: 'proposed', candidate };
  }

  /** A human states a principle directly — it is confirmed immediately. */
  addConfirmed(lesson: NewLesson): Principle {
    const principle: Principle = {
      ...lesson,
      id: this.nextId(),
      confirmed: true,
      confidence: capConfidence(lesson.confidence ?? 'high', maxConfidence(lesson.source, lesson.derivation, true)),
      created: today(),
    };
    this.memory.principles.push(principle);
    this.record({ actor: 'human', action: 'add', id: principle.id, after: principle });
    return principle;
  }

  accept(id: string, changes: Partial<Pick<Principle, 'rule' | 'reasoning' | 'confidence' | 'preference' | 'category' | 'exceptions' | 'scope'>> = {}): Principle {
    const index = this.memory.candidates.findIndex((p) => p.id === id);
    const candidate = this.memory.candidates[index];
    if (!candidate) throw new MemoryError(`No candidate lesson ${id}.`);
    // A human rewording makes the wording the human's own.
    const reworded = changes.rule !== undefined && changes.rule !== candidate.rule;
    const derivation = reworded ? 'stated' : candidate.derivation;
    const ceiling = maxConfidence(candidate.source, derivation, true);
    const accepted: Principle = {
      ...candidate,
      ...changes,
      derivation,
      confirmed: true,
      confidence: capConfidence(changes.confidence ?? defaultConfirmedConfidence({ ...candidate, derivation }), ceiling),
      evidence: [...candidate.evidence, { kind: 'human_confirmation', date: today() }],
      updated: today(),
    };
    this.memory.candidates.splice(index, 1);
    this.memory.principles.push(accepted);
    this.record({ actor: 'human', action: 'accept', id, before: candidate, after: accepted });
    return accepted;
  }

  reject(id: string, reason?: string): void {
    const index = this.memory.candidates.findIndex((p) => p.id === id);
    const candidate = this.memory.candidates[index];
    if (!candidate) throw new MemoryError(`No candidate lesson ${id}.`);
    this.memory.candidates.splice(index, 1);
    this.memory.rejected.push({ id, rule: candidate.rule, rejected_on: today(), ...(reason ? { reason } : {}) });
    this.record({ actor: 'human', action: 'reject', id, before: candidate, note: reason });
  }

  /** Edits a principle or candidate. Only humans modify memory content. */
  modify(id: string, changes: Partial<Omit<Principle, 'id' | 'created' | 'source'>>): Principle {
    const target = this.find(id);
    if (!target) throw new MemoryError(`No memory entry ${id}.`);
    const before = { ...target };
    Object.assign(target, changes, { updated: today() });
    if (changes.rule !== undefined && changes.rule !== before.rule) target.derivation = 'stated';
    target.confidence = capConfidence(target.confidence, maxConfidence(target.source, target.derivation, target.confirmed));
    this.record({ actor: 'human', action: 'modify', id, before, after: { ...target } });
    return target;
  }

  /** Removes a confirmed principle (e.g. after a conflict review). */
  retire(id: string, reason?: string): void {
    const index = this.memory.principles.findIndex((p) => p.id === id);
    const principle = this.memory.principles[index];
    if (!principle) throw new MemoryError(`No principle ${id}.`);
    this.memory.principles.splice(index, 1);
    this.memory.rejected.push({ id, rule: principle.rule, rejected_on: today(), reason: reason ?? 'retired' });
    this.record({ actor: 'human', action: 'retire', id, before: principle, note: reason });
  }

  private findSimilar(rule: string): { existingId: string; reason: string } | undefined {
    for (const p of [...this.memory.principles, ...this.memory.candidates]) {
      if (similarity(p.rule, rule) >= 0.8) return { existingId: p.id, reason: `Very similar to ${p.id}.` };
    }
    for (const r of this.memory.rejected) {
      if (similarity(r.rule, rule) >= 0.8) {
        return { existingId: r.id, reason: `You previously declined a similar lesson (${r.id}).` };
      }
    }
    return undefined;
  }

  private record(entry: Omit<HistoryEntry, 'at'>): void {
    this.journal.push({ at: new Date().toISOString(), ...entry });
  }
}

function defaultConfirmedConfidence(p: Principle): Confidence {
  // Lessons derived from a single rejection start at medium even once confirmed (spec §6).
  if (p.source === 'human_rejected' && p.derivation === 'inferred') return 'medium';
  return 'high';
}

const STOP_WORDS = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'for', 'when', 'is', 'be', 'it', 'not', 'do', 'on', 'with', 'unless']);

export function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 1 && !STOP_WORDS.has(t)),
  );
}

/** Jaccard similarity of content words. */
export function similarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / (ta.size + tb.size - shared);
}

// ── Persistence ────────────────────────────────────────────────────────────

export async function loadMemory(root: string): Promise<MemoryStore> {
  const { memoryFile } = workspacePaths(root);
  const name = path.basename(root);
  if (!existsSync(memoryFile)) return new MemoryStore(emptyMemory(name));
  return new MemoryStore(parseMemory(await readFile(memoryFile, 'utf8'), name));
}

/** Writes `.MulliganMem` and appends the store's journal to the local history log. */
export async function saveMemory(root: string, store: MemoryStore): Promise<void> {
  const paths = workspacePaths(root);
  await writeFile(paths.memoryFile, serializeMemory(store.memory), 'utf8');
  if (store.journal.length > 0) {
    await mkdir(path.dirname(paths.memoryHistory), { recursive: true });
    await appendFile(paths.memoryHistory, store.journal.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf8');
    store.journal.length = 0;
  }
}
