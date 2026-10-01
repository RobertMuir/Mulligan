import { isDocFile, isTestFile } from '@mulligan/core';
import { areaOf, type ChangedFile } from '@mulligan/pr';

/** Changed files that are code — not tests, not docs. */
export function changedCode(changed: ChangedFile[]): ChangedFile[] {
  return changed.filter((c) => !isTestFile(c.path) && !isDocFile(c.path));
}

/** The area of the codebase where most of the change happened, weighted by lines changed. */
export function primaryArea(code: ChangedFile[]): string | undefined {
  const weight = new Map<string, number>();
  for (const c of code) weight.set(areaOf(c.path), (weight.get(areaOf(c.path)) ?? 0) + c.additions + c.deletions + 1);
  return [...weight].sort((a, b) => b[1] - a[1])[0]?.[0];
}
