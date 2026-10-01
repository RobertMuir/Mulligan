import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { ModelProvider } from '@mulligan/core';
import { describe, expect, it } from 'vitest';
import {
  MemoryStore,
  assessApplicability,
  auditProvenance,
  detectConflicts,
  detectSignals,
  emptyMemory,
  exportMemory,
  extractLessons,
  extractLessonsWithModel,
  formatConflict,
  importIntoStore,
  parseMemory,
  reviewMemory,
  serializeMemory,
  snapshotProject,
  type NewLesson,
} from '../src/index.js';

const lesson = (rule: string, extra: Partial<NewLesson> = {}): NewLesson => ({
  category: 'react',
  rule,
  preference: 'strong',
  source: 'human_correction',
  derivation: 'stated',
  evidence: [{ kind: 'human_correction' }],
  scope: 'project',
  ...extra,
});

describe('.MulliganMem parser', () => {
  it('reads the spec §8 format and round-trips', () => {
    const text = `
version: 1
project:
  name: example-project
principles:
  - id: MM-001
    category: typescript
    rule: "Avoid any unless explicitly justified."
    preference: strong
    confidence: high
    source: accepted_change_is_not_a_source
`;
    expect(() => parseMemory(text)).toThrow(/source must be one of/);

    const valid = text.replace('accepted_change_is_not_a_source', 'human_accepted');
    const memory = parseMemory(valid);
    expect(memory.principles[0]).toMatchObject({ id: 'MM-001', category: 'typescript', confidence: 'high', source: 'human_accepted' });
    expect(parseMemory(serializeMemory(memory))).toEqual(memory);
  });

  it('accepts the nested spec §2 lesson form', () => {
    const memory = parseMemory(`
principles:
  - lesson:
      id: MM-00031
      source:
        type: human_correction
      context:
        area: react
        pattern: state-management
      principle: "Prefer local state when state does not cross meaningful component boundaries."
      confidence: high
      evidence: [accepted_change, human_review]
      scope:
        project: true
      created: 2026-10-01
`);
    expect(memory.principles[0]).toMatchObject({
      id: 'MM-00031',
      category: 'react',
      source: 'human_correction',
      rule: 'Prefer local state when state does not cross meaningful component boundaries.',
      evidence: [{ kind: 'accepted_change' }, { kind: 'human_review' }],
      created: '2026-10-01',
    });
  });

  it('rejects duplicate ids', () => {
    expect(() => parseMemory('principles:\n  - {id: MM-1, rule: a}\n  - {id: MM-1, rule: b}\n')).toThrow(/Duplicate/);
  });
});

describe('provenance', () => {
  it('never lets Mulligan inference claim high confidence', () => {
    const store = new MemoryStore(emptyMemory('p'));
    const p = store.addConfirmed(lesson('Inferred thing', { source: 'mulligan_inference', derivation: 'inferred', confidence: 'high' }));
    expect(p.confidence).toBe('medium');
  });

  it('flags hand-edited overclaims', () => {
    const memory = parseMemory('principles:\n  - {id: MM-001, rule: x, source: mulligan_inference, confidence: high, confirmed: false}\n');
    expect(auditProvenance(memory.principles).map((i) => i.message).join()).toMatch(/supports at most "candidate"/);
  });
});

describe('MemoryStore — the human confirmation loop', () => {
  it('proposes candidates, never principles', () => {
    const store = new MemoryStore(emptyMemory('p'));
    const result = store.propose(lesson('Avoid introducing abstraction layers without demonstrated benefit.', { source: 'human_rejected' }));
    expect(result.status).toBe('proposed');
    expect(store.principles).toHaveLength(0);
    expect(store.candidates[0]).toMatchObject({ confidence: 'candidate', confirmed: false });
  });

  it('accepts, rewording makes it the human\'s own', () => {
    const store = new MemoryStore(emptyMemory('p'));
    const r = store.propose(lesson('Too much abstraction.', { source: 'human_rejected', derivation: 'inferred' }));
    if (r.status !== 'proposed') throw new Error();
    const accepted = store.accept(r.candidate.id, { rule: 'Prefer direct implementations over abstraction layers unless reuse justifies them.' });
    expect(accepted).toMatchObject({ confirmed: true, derivation: 'stated', confidence: 'high' });
    expect(accepted.evidence.at(-1)?.kind).toBe('human_confirmation');
    expect(store.journal.map((j) => j.action)).toEqual(['propose', 'accept']);
  });

  it('does not re-propose a declined lesson', () => {
    const store = new MemoryStore(emptyMemory('p'));
    const r = store.propose(lesson('Always use Redux for state management.'));
    if (r.status !== 'proposed') throw new Error();
    store.reject(r.candidate.id, 'No.');
    const again = store.propose(lesson('Always use Redux for state management!'));
    expect(again).toMatchObject({ status: 'duplicate', reason: expect.stringMatching(/previously declined/) });
  });

  it('allocates sequential ids', () => {
    const store = new MemoryStore(emptyMemory('p'));
    store.addConfirmed(lesson('One rule about things'));
    store.addConfirmed(lesson('Another completely different statement'));
    expect(store.principles.map((p) => p.id)).toEqual(['MM-001', 'MM-002']);
  });
});

describe('extraction', () => {
  it('keeps the human\'s words without a model', () => {
    const [l] = extractLessons({ outcome: 'rejected', task: 'Add settings screen', approach: 'Generic form framework', humanReason: 'Too much abstraction.' });
    expect(l).toMatchObject({ source: 'human_rejected', derivation: 'stated' });
    expect(l!.rule).toContain('Too much abstraction.');
  });

  it('marks model generalisations as inferred and falls back on bad output', async () => {
    const model = (text: string): ModelProvider => ({ name: 'fake', kind: 'anthropic', model: 'm', complete: async () => ({ text, provider: 'anthropic', model: 'm' }) });
    const decision = { outcome: 'rejected' as const, task: 't', humanReason: 'Too much abstraction.' };
    const [l] = await extractLessonsWithModel(
      decision,
      model('```json\n[{"category":"architecture","rule":"Avoid abstraction layers without demonstrated value.","subject":"Abstraction Layers","stance":"avoid"}]\n```'),
    );
    expect(l).toMatchObject({ derivation: 'inferred', subject: 'abstraction-layers', stance: 'avoid', source: 'human_rejected' });
    const fallback = await extractLessonsWithModel(decision, model('I cannot help'));
    expect(fallback[0]?.derivation).toBe('stated');
  });

  it('never writes an invalid model-supplied stance into memory', async () => {
    const model: ModelProvider = {
      name: 'fake',
      kind: 'anthropic',
      model: 'm',
      complete: async () => ({ text: '[{"rule":"Keep handlers thin.","stance":"discourage"},{"stance":"avoid"}]', provider: 'anthropic', model: 'm' }),
    };
    const lessons = await extractLessonsWithModel({ outcome: 'accepted', task: 't' }, model);
    expect(lessons).toHaveLength(1);
    expect(lessons[0]).toMatchObject({ rule: 'Keep handlers thin.' });
    expect(lessons[0]).not.toHaveProperty('stance');

    // The lesson survives a save-and-reload round trip.
    const store = new MemoryStore(emptyMemory('p'));
    store.propose(lessons[0]!);
    expect(() => parseMemory(serializeMemory(store.memory))).not.toThrow();
  });
});

describe('conflict resolution (spec §36)', () => {
  it('treats the architecture requirement as authoritative and offers — never applies — a memory update', () => {
    const conflicts = detectConflicts([
      { level: 'mulligan_memory', id: 'MM-003', subject: 'abstraction-x', stance: 'avoid', statement: 'Avoid abstraction X.' },
      { level: 'golden_pr', id: 'GP-002', subject: 'Abstraction X', stance: 'prefer', statement: 'Abstraction X is used successfully.' },
      { level: 'project_architecture', id: 'ADR-7', subject: 'abstraction x', stance: 'require', statement: 'Architecture requires X.' },
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.authoritative?.id).toBe('ADR-7');
    expect(conflicts[0]!.memoryToRevisit).toEqual(['MM-003']);
    expect(formatConflict(conflicts[0]!)).toMatch(/CONFLICT DETECTED[\s\S]*Would you like to update Mulligan Memory/);
  });

  it('asks the human when equal authorities disagree', () => {
    const [c] = detectConflicts([
      { level: 'project_cookbook', id: 'TS-1', subject: 'enums', stance: 'prefer', statement: 'Use enums' },
      { level: 'project_cookbook', id: 'TS-2', subject: 'enums', stance: 'avoid', statement: 'Avoid enums' },
    ]);
    expect(c!.authoritative).toBeUndefined();
    expect(c!.recommendation).toMatch(/needs your decision/);
  });
});

describe('applicability (spec §4)', () => {
  it('spots that memory may not apply to an exceptional task', () => {
    const store = new MemoryStore(emptyMemory('p'));
    store.addConfirmed(
      lesson('Prefer local component state when state does not cross meaningful component boundaries.', {
        subject: 'local-state',
        exceptions: ['state shared across many unrelated screens'],
      }),
    );
    const [a] = assessApplicability(store.principles, { description: 'State must be shared between 14 unrelated screens.' });
    expect(a?.verdict).toBe('possible-exception');
    expect(a?.message).toMatch(/appears to be an exception/);

    const [b] = assessApplicability(store.principles, { description: 'Add a toggle state to the header component.' });
    expect(b?.verdict).toBe('applies');
  });
});

describe('portability', () => {
  it('imports as candidates with provenance preserved', () => {
    const source = new MemoryStore(emptyMemory('other'));
    source.addConfirmed(lesson('Validate API responses at runtime.'));
    const target = new MemoryStore(emptyMemory('mine'));
    const results = importIntoStore(target, source.memory, 'other.MulliganMem');
    expect(results[0]?.status).toBe('proposed');
    expect(target.principles).toHaveLength(0);
    expect(target.candidates[0]!.evidence.at(-1)).toMatchObject({ kind: 'imported', ref: 'other.MulliganMem' });
    expect(exportMemory(source.memory, 'markdown')).toContain('Validate API responses at runtime.');
  });
});

describe('MulliganMem review', () => {
  it('cites evidence for gaps and builds a multi-step plan', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mulligan-memrev-'));
    await mkdir(path.join(root, 'src'), { recursive: true });
    await writeFile(path.join(root, 'package.json'), JSON.stringify({ dependencies: { react: '^19.0.0' } }));
    await writeFile(path.join(root, 'tsconfig.json'), '{ "compilerOptions": { "strict": true } }');
    await writeFile(
      path.join(root, 'src', 'api.ts'),
      'export async function load() {\n  const res = await fetch("/api/user");\n  return (await res.json()) as User;\n}\n',
    );
    await writeFile(path.join(root, 'src', 'List.tsx'), 'export const L = ({ xs }) => xs.map((x, index) => <li key={index}>{x}</li>);\n');
    await writeFile(path.join(root, 'src', 'safe.ts'), 'try { run(); } catch (e) {}\n');

    const memory = emptyMemory('p');
    const store = new MemoryStore(memory);
    store.addConfirmed(lesson('Never swallow errors; every catch handles or rethrows with context.', { category: 'error-handling' }));

    const result = reviewMemory(memory, detectSignals(await snapshotProject(root)));
    const topics = result.gaps.map((g) => g.topic);
    expect(topics).toEqual(expect.arrayContaining(['runtime-validation', 'error-boundaries', 'react-list-keys', 'error-handling']));
    expect(result.gaps[0]).toMatchObject({ topic: 'error-handling', relation: 'stated-not-applied' });

    const validation = result.gaps.find((g) => g.topic === 'runtime-validation')!;
    expect(validation.evidence[0]?.ref).toBe('src/api.ts:2');

    const plan = result.plan.find((p) => p.gap.topic === 'runtime-validation')!;
    expect(plan.steps.length).toBeGreaterThanOrEqual(6);
    expect(plan.steps[0]!.title).toMatch(/compile-time and runtime validation/);
    expect(plan.steps.at(-1)!.title).toMatch(/Mulligan Memory/);
  });
});
