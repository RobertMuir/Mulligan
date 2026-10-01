import { SOURCE_GLOBS, readSourceFiles, walkProject } from '@mulligan/core';
import { evaluateCookbook, loadCookbook } from '@mulligan/cookbook';
import { loadMemory, runMemoryReview, type CookbookGapInput, type MemReviewResult } from '@mulligan/memory';

/** Cookbook rules the codebase currently breaks, grouped per rule with up to five examples. */
export async function cookbookGaps(root: string): Promise<CookbookGapInput[]> {
  const cookbook = await loadCookbook(root).catch(() => undefined);
  if (!cookbook?.rules.length) return [];
  const ruleText = new Map(cookbook.rules.map((r) => [r.id, r.rule]));
  const files = await readSourceFiles(root, await walkProject(root, { include: SOURCE_GLOBS }));
  const byRule = new Map<string, CookbookGapInput>();
  for (const v of evaluateCookbook(cookbook.rules, files).violations) {
    const entry = byRule.get(v.ruleId) ?? { ruleId: v.ruleId, title: v.title, rule: ruleText.get(v.ruleId) ?? v.title, count: 0, evidence: [] };
    entry.count++;
    if (entry.evidence.length < 5) entry.evidence.push({ kind: 'code', ref: `${v.file}:${v.line}`, note: v.snippet });
    byRule.set(v.ruleId, entry);
  }
  return [...byRule.values()];
}

/** MulliganMem Review with the cookbook included — the one entry point the CLI and the MCP server share. */
export async function runFullMemoryReview(root: string): Promise<MemReviewResult> {
  const store = await loadMemory(root);
  return runMemoryReview(root, store.memory, await cookbookGaps(root));
}
