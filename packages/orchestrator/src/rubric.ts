import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isRecord, numberField, stringField, workspacePaths } from '@mulligan/core';
import YAML from 'yaml';

export interface RubricCriterion {
  id: string;
  name: string;
  weight: number;
  description: string;
}

export interface Rubric {
  version: 1;
  criteria: RubricCriterion[];
  gates: {
    /** A candidate whose change cannot be applied is out. */
    mustApply: boolean;
    /** A candidate that fails verification ranks below every candidate that did not. */
    mustPassVerification: boolean;
  };
}

/**
 * The private verification rubric. Candidates never see it — only the judges
 * do — so implementations cannot be tuned to the scoring. It lives in
 * `.mulligan/verification/`, which is git-ignored.
 */
export const DEFAULT_RUBRIC: Rubric = {
  version: 1,
  criteria: [
    { id: 'correctness', name: 'Correctness', weight: 30, description: 'Does exactly what the task asks, including the edge cases the task implies.' },
    { id: 'think-before-coding', name: 'Think Before Coding', weight: 10, description: 'States its assumptions and surfaces ambiguity and trade-offs instead of choosing silently.' },
    { id: 'simplicity-first', name: 'Simplicity First', weight: 15, description: 'The minimum code that solves the problem: no speculative features, single-use abstractions or unrequested options.' },
    { id: 'surgical-changes', name: 'Surgical Changes', weight: 15, description: 'Touches only what the task needs and matches the existing style; no drive-by refactors or reformatting.' },
    { id: 'goal-driven', name: 'Goal-Driven Execution', weight: 15, description: 'Success criteria are explicit and proven by tests or checks.' },
    { id: 'standards', name: 'Project standards', weight: 15, description: 'Follows the cookbook, Mulligan Memory and the team\'s golden PR patterns.' },
  ],
  gates: { mustApply: true, mustPassVerification: true },
};

export function rubricPath(root: string): string {
  return path.join(workspacePaths(root).verification, 'rubric.yaml');
}

export class RubricError extends Error {
  override name = 'RubricError';
}

/** Parses a rubric the developer may have edited by hand; gates default to on. */
export function validateRubric(raw: unknown): Rubric {
  const list = isRecord(raw) && Array.isArray(raw.criteria) ? raw.criteria : [];
  if (list.length === 0) throw new RubricError('The rubric needs at least one criterion.');
  const criteria = list.map((c): RubricCriterion => {
    const id = stringField(c, 'id');
    const weight = numberField(c, 'weight');
    if (!id || weight === undefined || weight < 0) throw new RubricError(`Criterion "${id ?? '?'}" needs an id and a non-negative weight.`);
    return { id, weight, name: stringField(c, 'name') ?? id, description: stringField(c, 'description') ?? '' };
  });
  if (criteria.reduce((n, c) => n + c.weight, 0) <= 0) throw new RubricError('Rubric weights must not all be zero.');
  const gates = isRecord(raw) && isRecord(raw.gates) ? raw.gates : {};
  return {
    version: 1,
    criteria,
    gates: {
      mustApply: typeof gates.mustApply === 'boolean' ? gates.mustApply : DEFAULT_RUBRIC.gates.mustApply,
      mustPassVerification: typeof gates.mustPassVerification === 'boolean' ? gates.mustPassVerification : DEFAULT_RUBRIC.gates.mustPassVerification,
    },
  };
}

export async function loadRubric(root: string): Promise<Rubric> {
  const file = rubricPath(root);
  if (!existsSync(file)) return DEFAULT_RUBRIC;
  return validateRubric(YAML.parse(await readFile(file, 'utf8')));
}

/** Writes the default rubric if none exists, so the developer can tune it. */
export async function ensureRubric(root: string): Promise<string> {
  const file = rubricPath(root);
  if (!existsSync(file)) {
    await mkdir(path.dirname(file), { recursive: true });
    const header = '# Private verification rubric — never shown to implementing models, only to judges.\n# Weights are relative. Edit freely; this file is git-ignored.\n';
    await writeFile(file, header + YAML.stringify(DEFAULT_RUBRIC), 'utf8');
  }
  return file;
}
