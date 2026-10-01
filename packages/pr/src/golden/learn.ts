import type { NewLesson } from '@mulligan/memory';
import type { PullRequest, ReviewComment } from '../provider/types.js';

const DIRECTIVE = /\b(don'?t|do not|avoid|prefer|instead|should(?:n'?t)?|please (?:use|move|extract|remove|add|rename)|no need to|unnecessary|why not|we (?:usually|always|never))\b/i;
const NOISE = /^(lgtm|looks good|nice|thanks|thank you|\+1|approved?|ship it)[.!\s]*$/i;

export function isDirectiveComment(comment: ReviewComment): boolean {
  const body = comment.body.trim();
  if (body.length < 15 || NOISE.test(body)) return false;
  return DIRECTIVE.test(body) || comment.verdict === 'changes_requested';
}

function firstSentences(body: string, max = 220): string {
  const clean = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
  return end > 40 ? cut.slice(0, end + 1) : `${cut}…`;
}

/**
 * Review comment → developer correction → merged implementation →
 * candidate lesson (spec §37). Only merged PRs count: the correction was
 * accepted. The reviewer's words are kept verbatim; the developer decides
 * whether each becomes a project principle.
 */
export function lessonsFromReviews(items: { pr: PullRequest; comments: ReviewComment[] }[]): NewLesson[] {
  const lessons: NewLesson[] = [];
  for (const { pr, comments } of items) {
    if (pr.state !== 'merged') continue;
    for (const comment of comments) {
      if (comment.author === pr.author || !isDirectiveComment(comment)) continue;
      lessons.push({
        category: 'review-feedback',
        rule: firstSentences(comment.body),
        preference: 'moderate',
        source: 'review_feedback',
        derivation: 'stated',
        evidence: [
          {
            kind: 'review_comment',
            ref: comment.url ?? `${pr.url}${comment.path ? ` ${comment.path}:${comment.line ?? ''}` : ''}`,
            note: `${comment.author} on "${pr.title}" (merged)`,
          },
        ],
        scope: 'project',
      });
    }
  }
  return lessons;
}
