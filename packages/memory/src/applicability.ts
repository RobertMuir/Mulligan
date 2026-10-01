import type { TaskContext } from '@mulligan/core';
import { describeProvenance } from './provenance.js';
import { tokens } from './store.js';
import type { Principle } from './types.js';

export type ApplicabilityVerdict = 'applies' | 'possible-exception' | 'not-relevant';

export interface ApplicabilityAssessment {
  principle: Principle;
  verdict: ApplicabilityVerdict;
  reasons: string[];
  message: string;
  method: 'heuristic' | 'model';
}

/**
 * Memory is learned preference, not dogma (spec §4):
 * previous decision → observed principle → check current context →
 * determine applicability → present recommendation.
 */
export function assessApplicability(principles: readonly Principle[], task: TaskContext): ApplicabilityAssessment[] {
  const taskTokens = tokens([task.description, ...(task.files ?? [])].join(' '));
  const out: ApplicabilityAssessment[] = [];
  for (const principle of principles) {
    const topic = tokens(
      [principle.category, principle.subject, principle.context?.area, principle.context?.pattern, principle.rule]
        .filter(Boolean)
        .join(' '),
    );
    const overlap = [...topic].filter((t) => taskTokens.has(t));
    if (overlap.length === 0) continue;

    const matchedExceptions = (principle.exceptions ?? []).filter((exception) => {
      const exceptionTokens = [...tokens(exception)];
      const hits = exceptionTokens.filter((t) => taskTokens.has(t)).length;
      return hits >= Math.min(2, exceptionTokens.length);
    });

    if (matchedExceptions.length > 0) {
      out.push({
        principle,
        verdict: 'possible-exception',
        reasons: matchedExceptions.map((e) => `Task resembles a recorded exception: "${e}"`),
        message:
          `Mulligan Memory (${principle.id}) generally says: "${principle.rule}"\n` +
          `but this task appears to be an exception (${matchedExceptions.join('; ')}).\n` +
          'I recommend reconsidering the principle here rather than applying it automatically.',
        method: 'heuristic',
      });
    } else {
      out.push({
        principle,
        verdict: 'applies',
        reasons: [`Shares topic with the task: ${overlap.slice(0, 5).join(', ')}`],
        message: `Consider ${principle.id}: "${principle.rule}" — ${describeProvenance(principle)}. Check it still fits this context.`,
        method: 'heuristic',
      });
    }
  }
  return out;
}
