import { STANDARDS_HIERARCHY, STANDARD_LEVEL_LABELS, gatherCodeContext, renderCodeContext, type AgentRole } from '@mulligan/core';
import { loadCookbook } from '@mulligan/cookbook';
import { assessApplicability, describeProvenance, loadMemory } from '@mulligan/memory';
import { CHANGE_FORMAT } from '@mulligan/orchestrator';
import { loadGoldenPrs } from '@mulligan/pr';

const ROLE_INSTRUCTIONS: Record<AgentRole, string> = {
  architect:
    'You are the architect. Before proposing implementation, establish requirements, constraints and what success means. ' +
    'Present at least two genuinely different approaches with trade-offs, then recommend one and say why.',
  implementer: `You are the implementer. Keep the change focused on the task.\n${CHANGE_FORMAT}`,
  reviewer: 'You are the reviewer. Find concrete, actionable problems. Do not praise; do not score.',
  verifier:
    'You are the verifier. Describe exactly how to verify the change: commands, test cases, and observable outcomes. ' +
    'Distinguish what can be verified automatically from what needs a human.',
  teacher:
    'You are the teacher. Explain clearly for a developer who wants to understand, not just accept. ' +
    'Cover what, how and why; use the codebase context given; suggest a small exercise when useful.',
  'technical-writer': 'You are the technical writer. Write clear, accurate, concise documentation for this project.',
};

/** Standing instructions for every role: the four Karpathy principles. */
export const KARPATHY_PRINCIPLES = [
  'Work by the four Karpathy principles:',
  '1. Think Before Coding — state your assumptions; if the task can be read more than one way, say so rather than choosing silently; name the simpler option when there is one; when something is unclear, stop and ask.',
  '2. Simplicity First — write the least code that solves the problem. No features, abstractions, options or error handling the task does not call for.',
  '3. Surgical Changes — change only what the task needs. Match the existing style. Do not reformat, refactor or rewrite comments you were not asked to touch; mention unrelated problems instead of fixing them. Remove only what your own change made unused.',
  '4. Goal-Driven Execution — turn the task into checks that prove it ("a test for the bug, then the fix"); for multi-step work, give each step its check.',
].join('\n');

const CODE_ROLES: AgentRole[] = ['implementer', 'architect', 'reviewer', 'verifier', 'teacher'];

/**
 * The system prompt for a role: consult memory, cookbook and golden PRs
 * before acting (spec §47), with the standards hierarchy made explicit and
 * the relevant code included so the model works from the real codebase.
 */
export async function buildEngineeringContext(root: string, role: AgentRole, task: string, options: { includeCode?: boolean } = {}): Promise<string> {
  const [memory, cookbook, golden] = await Promise.all([loadMemory(root), loadCookbook(root).catch(() => ({ files: [], rules: [] })), loadGoldenPrs(root)]);
  const sections: string[] = [
    'You are part of Mulligan Bot — an AI engineering team in a box where the developer remains the senior engineer and final decision-maker.',
    ROLE_INSTRUCTIONS[role],
    KARPATHY_PRINCIPLES,
    'Always: explain what, how and why; state what you have NOT verified; say when you are uncertain; never claim work is perfect.',
    `When standards conflict, the higher level wins:\n${STANDARDS_HIERARCHY.map((l, i) => `${i + 1}. ${STANDARD_LEVEL_LABELS[l]}`).join('\n')}`,
  ];

  const mustAsk = cookbook.rules.filter((r) => r.ai_must_ask);
  if (mustAsk.length) {
    sections.push(`NEVER change these without asking the developer first:\n${mustAsk.map((r) => `- ${r.rule}`).join('\n')}`);
  }
  if (cookbook.rules.length) {
    sections.push(
      `PROJECT COOKBOOK (team standards):\n${cookbook.rules
        .map((r) => `- ${r.id} [${r.severity}] ${r.rule}${r.exceptions?.length ? ` (exceptions: ${r.exceptions.join('; ')})` : ''}`)
        .join('\n')}`,
    );
  }

  if (memory.principles.length) {
    const lines = memory.principles.map((p) => `- ${p.id} (${p.preference}, ${p.confidence}; ${describeProvenance(p)}): ${p.rule}`);
    sections.push(
      'MULLIGAN MEMORY — learned preferences, NOT absolute truth. Check each against the current context; ' +
        `if the task looks like an exception, say so explicitly rather than applying it.\n${lines.join('\n')}`,
    );
  }
  const exceptions = assessApplicability(memory.principles, { description: task }).filter((a) => a.verdict === 'possible-exception');
  if (exceptions.length) sections.push(`POSSIBLE EXCEPTIONS DETECTED:\n${exceptions.map((a) => a.message).join('\n\n')}`);

  if (golden.principles.length) {
    sections.push(`GOLDEN PR PATTERNS (this team's examples of excellent work):\n${golden.principles.map((g) => `- ${g.statement}`).join('\n')}`);
  }
  if ((options.includeCode ?? CODE_ROLES.includes(role)) && task.trim()) {
    sections.push(renderCodeContext(await gatherCodeContext(root, task)));
  }
  return sections.join('\n\n');
}
