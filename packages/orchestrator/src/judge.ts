import { extractJson, isRecord, numberField, stringField, type ModelProvider } from '@mulligan/core';
import type { ProposedChange } from './change.js';
import type { Rubric } from './rubric.js';

export interface JudgeScore {
  criterion: string;
  score: number;
  reason: string;
}

export interface JudgeEvidence {
  applied: boolean;
  verification: string;
  linesAdded: number;
  filesTouched: number;
  testsTouched: boolean;
  cookbookViolations: number;
}

const MAX_DIFF = 40_000;

/**
 * A blind judge: it sees the rubric, the task, the candidate and the hard
 * evidence — never which model wrote the candidate.
 */
export async function judgeCandidate(
  judge: ModelProvider,
  rubric: Rubric,
  task: string,
  label: string,
  change: ProposedChange,
  diff: string,
  evidence: JudgeEvidence,
): Promise<JudgeScore[] | undefined> {
  const system = [
    'You are an impartial judge in a human-in-the-loop engineering process. Score ONE candidate solution against the rubric.',
    'Score each criterion from 1 (poor) to 5 (excellent) and give a one-sentence reason citing the code.',
    'Weigh the evidence: a change that does not apply or fails verification cannot score well on correctness.',
    'Do not reward length or confidence. Prefer the smaller change when two are otherwise equal.',
    'Respond with JSON only: {"scores":[{"criterion": string, "score": number, "reason": string}]}.',
  ].join(' ');
  const user = [
    `TASK:\n${task}`,
    `RUBRIC:\n${rubric.criteria.map((c) => `- ${c.id}: ${c.description}`).join('\n')}`,
    `CANDIDATE ${label}`,
    `Approach: ${change.approach || '(not stated)'}`,
    `Assumptions: ${change.assumptions || '(none stated)'}`,
    `Success criteria: ${change.successCriteria || '(none stated)'}`,
    `Not verified (self-reported): ${change.notVerified || '(nothing stated)'}`,
    `EVIDENCE: applies=${evidence.applied}; verification=${evidence.verification}; +${evidence.linesAdded} lines across ${evidence.filesTouched} files; tests touched=${evidence.testsTouched}; cookbook violations in new lines=${evidence.cookbookViolations}`,
    `DIFF:\n${diff ? (diff.length > MAX_DIFF ? `${diff.slice(0, MAX_DIFF)}\n… (truncated)` : diff) : '(no applicable diff)'}`,
  ].join('\n\n');
  try {
    const result = await judge.complete({ system, messages: [{ role: 'user', content: user }], maxTokens: 1500, temperature: 0 });
    const parsed = extractJson(result.text);
    const raw = isRecord(parsed) && Array.isArray(parsed.scores) ? parsed.scores : [];
    // Keep only scores for real criteria, inside the 1–5 scale.
    const scores = raw.flatMap((s): JudgeScore[] => {
      const criterion = stringField(s, 'criterion');
      const score = numberField(s, 'score');
      if (!criterion || score === undefined || score < 1 || score > 5 || !rubric.criteria.some((c) => c.id === criterion)) return [];
      return [{ criterion, score, reason: stringField(s, 'reason') ?? '' }];
    });
    return scores.length ? scores : undefined;
  } catch {
    return undefined;
  }
}
