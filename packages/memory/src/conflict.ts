import {
  STANDARD_LEVEL_LABELS,
  isPositiveStance,
  normaliseSubject,
  rankOf,
  type Directive,
} from '@mulligan/core';
import type { Principle } from './types.js';

export interface Conflict {
  subject: string;
  directives: Directive[];
  /** The highest-authority directive, or undefined when the top two tie. */
  authoritative?: Directive;
  recommendation: string;
  /** Memory principles that lost — the developer may want to revisit them. Never applied automatically. */
  memoryToRevisit: string[];
}

export function principleToDirective(p: Principle): Directive | undefined {
  if (!p.subject || !p.stance) return undefined;
  return { level: 'mulligan_memory', id: p.id, subject: normaliseSubject(p.subject), stance: p.stance, statement: p.rule };
}

/**
 * Finds subjects where directives disagree (one endorses, another
 * discourages) and resolves them with the standards hierarchy (spec §24, §36).
 */
export function detectConflicts(directives: Directive[]): Conflict[] {
  const bySubject = new Map<string, Directive[]>();
  for (const d of directives) {
    const key = normaliseSubject(d.subject);
    bySubject.set(key, [...(bySubject.get(key) ?? []), d]);
  }
  const conflicts: Conflict[] = [];
  for (const [subject, group] of bySubject) {
    const positive = group.some((d) => isPositiveStance(d.stance));
    const negative = group.some((d) => !isPositiveStance(d.stance));
    if (!positive || !negative) continue;

    const sorted = [...group].sort((a, b) => rankOf(a.level) - rankOf(b.level));
    const [top] = sorted;
    if (!top) continue;
    const opposingTie = sorted.find(
      (d) => rankOf(d.level) === rankOf(top.level) && isPositiveStance(d.stance) !== isPositiveStance(top.stance),
    );
    const authoritative = opposingTie ? undefined : top;
    const memoryToRevisit = authoritative
      ? sorted
          .filter((d) => d.level === 'mulligan_memory' && isPositiveStance(d.stance) !== isPositiveStance(authoritative.stance))
          .map((d) => d.id)
      : [];
    const recommendation = authoritative
      ? `Treat ${STANDARD_LEVEL_LABELS[authoritative.level].toLowerCase()} (${authoritative.id}) as authoritative for this task.`
      : `Two sources at the same level (${STANDARD_LEVEL_LABELS[top.level].toLowerCase()}) disagree. This needs your decision.`;
    conflicts.push({ subject, directives: sorted, authoritative, recommendation, memoryToRevisit });
  }
  return conflicts;
}

export function formatConflict(conflict: Conflict): string {
  const lines = ['CONFLICT DETECTED', `Subject: ${conflict.subject}`, ''];
  for (const d of conflict.directives) {
    lines.push(`${STANDARD_LEVEL_LABELS[d.level]} (${d.id}, ${d.stance}):`, `  ${d.statement}`, '');
  }
  lines.push('Recommendation:', `  ${conflict.recommendation}`);
  if (conflict.memoryToRevisit.length > 0) {
    lines.push('', `Would you like to update Mulligan Memory (${conflict.memoryToRevisit.join(', ')})?`);
  }
  return lines.join('\n');
}
