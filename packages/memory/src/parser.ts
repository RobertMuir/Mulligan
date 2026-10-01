import { STANCES, isRecord, messageOf, today } from '@mulligan/core';
import YAML from 'yaml';
import {
  CONFIDENCE_LEVELS,
  MEMORY_SOURCES,
  PREFERENCE_LEVELS,
  type Confidence,
  type Evidence,
  type MemorySource,
  type MulliganMemory,
  type Preference,
  type Principle,
  type RejectedLesson,
} from './types.js';

export class MemoryParseError extends Error {
  override name = 'MemoryParseError';
}


export const MEMORY_FILE_HEADER = `# .MulliganMem — "What have we learned?"
#
# Human-readable engineering memory for this project. It is yours: read it,
# edit it, delete entries. It is local to this machine (git-ignored); use
# \`/memory export\` to share or move it.
#
# These are learned preferences, not absolute truth. Mulligan checks each
# principle against the current task before applying it.
#
#   principles  confirmed lessons that guide future work
#   candidates  proposed lessons awaiting your decision (/memory accept|reject|modify)
#   rejected    lessons you declined, kept so they are not proposed again
#
# Note: comments other than this header are not preserved when Mulligan saves.
`;

type Raw = Record<string, unknown>;

function scalarText(value: unknown, where: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  throw new MemoryParseError(`${where} must be text.`);
}

function requiredText(value: unknown, where: string): string {
  const text = scalarText(value, where);
  if (text === undefined) throw new MemoryParseError(`${where} is required.`);
  return text;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], where: string, fallback: T): T {
  if (value === undefined || value === null) return fallback;
  const match = allowed.find((a) => a === value);
  if (match === undefined) throw new MemoryParseError(`${where} must be one of: ${allowed.join(', ')} (got "${String(value)}").`);
  return match;
}

function stringList(value: unknown, where: string): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) throw new MemoryParseError(`${where} must be a list.`);
  return value.map((v, i) => requiredText(v, `${where}[${i}]`));
}

function mapping(value: unknown, where: string): Raw {
  if (!isRecord(value)) throw new MemoryParseError(`${where} must be a mapping.`);
  return value;
}

const optionalMapping = (value: unknown, where: string): Raw | undefined => (value === undefined || value === null ? undefined : mapping(value, where));

function parseEvidence(value: unknown, where: string): Evidence[] {
  if (!Array.isArray(value)) return [];
  return value.map((e, i) => {
    if (typeof e === 'string') return { kind: e };
    const r = mapping(e, `${where}[${i}]`);
    return {
      kind: requiredText(r.kind, `${where}[${i}].kind`),
      ref: scalarText(r.ref, `${where}[${i}].ref`),
      note: scalarText(r.note, `${where}[${i}].note`),
      date: scalarText(r.date, `${where}[${i}].date`),
    };
  });
}

function parsePrinciple(raw: unknown, where: string): Principle {
  const outer = mapping(raw, where);
  // Accept the spec's nested `lesson:` form as well as flat entries.
  const r = 'lesson' in outer ? mapping(outer.lesson, `${where}.lesson`) : outer;
  const id = requiredText(r.id, `${where}.id`);
  const at = `${where} (${id})`;
  const source = isRecord(r.source) ? r.source.type : r.source;
  const context = optionalMapping(r.context, `${at}.context`);
  const decision = optionalMapping(r.decision, `${at}.decision`);
  // `scope: { project: true }` (spec §2) or `scope: project`.
  const scope = isRecord(r.scope) ? (r.scope.project === false ? 'personal' : 'project') : r.scope;

  return {
    id,
    category: scalarText(r.category ?? context?.area, `${at}.category`) ?? 'general',
    rule: requiredText(r.rule ?? r.principle, `${at}.rule`),
    reasoning: scalarText(r.reasoning, `${at}.reasoning`),
    context: context && { area: scalarText(context.area, `${at}.context.area`), pattern: scalarText(context.pattern, `${at}.context.pattern`) },
    decision: decision && {
      rejected: scalarText(decision.rejected, `${at}.decision.rejected`),
      accepted: scalarText(decision.accepted, `${at}.decision.accepted`),
    },
    subject: scalarText(r.subject, `${at}.subject`),
    stance: r.stance === undefined ? undefined : oneOf(r.stance, STANCES, `${at}.stance`, 'prefer'),
    preference: oneOf<Preference>(r.preference, PREFERENCE_LEVELS, `${at}.preference`, 'moderate'),
    confidence: oneOf<Confidence>(r.confidence, CONFIDENCE_LEVELS, `${at}.confidence`, 'candidate'),
    source: oneOf<MemorySource>(source, MEMORY_SOURCES, `${at}.source`, 'mulligan_inference'),
    derivation: oneOf(r.derivation, ['stated', 'inferred'] as const, `${at}.derivation`, 'inferred'),
    confirmed: r.confirmed === true,
    evidence: parseEvidence(r.evidence, `${at}.evidence`),
    scope: oneOf(scope, ['project', 'personal'] as const, `${at}.scope`, 'project'),
    exceptions: stringList(r.exceptions, `${at}.exceptions`),
    created: scalarText(r.created, `${at}.created`) ?? today(),
    updated: scalarText(r.updated, `${at}.updated`),
  };
}

function parseRejected(raw: unknown, where: string): RejectedLesson {
  const r = mapping(raw, where);
  return {
    id: requiredText(r.id, `${where}.id`),
    rule: requiredText(r.rule, `${where}.rule`),
    rejected_on: scalarText(r.rejected_on, `${where}.rejected_on`) ?? today(),
    reason: scalarText(r.reason, `${where}.reason`),
  };
}

export function parseMemory(text: string, fallbackProjectName = 'project'): MulliganMemory {
  let data: unknown;
  try {
    data = YAML.parse(text);
  } catch (error) {
    throw new MemoryParseError(`.MulliganMem is not valid YAML: ${messageOf(error)}`);
  }
  const r = mapping(data ?? {}, '.MulliganMem');
  if (r.version !== undefined && r.version !== 1) {
    throw new MemoryParseError(`Unsupported .MulliganMem version ${String(r.version)}.`);
  }
  const list = (key: string): unknown[] => {
    const value = r[key];
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) throw new MemoryParseError(`"${key}" must be a list.`);
    return value;
  };
  const project = optionalMapping(r.project, 'project');
  const memory: MulliganMemory = {
    version: 1,
    project: { name: scalarText(project?.name, 'project.name') ?? fallbackProjectName },
    principles: list('principles').map((p, i) => parsePrinciple(p, `principles[${i}]`)),
    candidates: list('candidates').map((p, i) => parsePrinciple(p, `candidates[${i}]`)),
    rejected: list('rejected').map((p, i) => parseRejected(p, `rejected[${i}]`)),
  };
  const ids = new Set<string>();
  for (const p of [...memory.principles, ...memory.candidates]) {
    if (ids.has(p.id)) throw new MemoryParseError(`Duplicate memory id ${p.id}.`);
    ids.add(p.id);
  }
  return memory;
}

/** Undefined fields are omitted from the YAML, so the file stays clean. */
export function serializeMemory(memory: MulliganMemory): string {
  const doc = new YAML.Document(memory);
  return MEMORY_FILE_HEADER + '\n' + doc.toString({ lineWidth: 88 });
}
