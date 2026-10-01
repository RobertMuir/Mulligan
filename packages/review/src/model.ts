import { extractJson, messageOf, numberField, stringField, type ModelProvider } from '@mulligan/core';
import type { CookbookRule } from '@mulligan/cookbook';
import type { Principle } from '@mulligan/memory';
import type { GoldenPrinciple } from '@mulligan/pr';
import type { ReviewInput } from './collect.js';
import { KARPATHY_LENS } from './karpathy.js';
import { CATEGORY_LABELS, isCategoryKey, type Finding } from './types.js';

const MAX_DIFF_CHARS = 80_000;

function renderChanges(input: ReviewInput): string {
  const out: string[] = [];
  let size = 0;
  for (const file of input.files) {
    const set = input.scopeLines?.get(file.path);
    const body = file.content
      .split('\n')
      .map((text, i) => `${set?.has(i + 1) ? '+' : ' '}${String(i + 1).padStart(5)} ${text}`)
      .join('\n');
    const block = `=== ${file.path} ===\n${body}\n`;
    if (size + block.length > MAX_DIFF_CHARS) {
      out.push(`… ${input.files.length - out.length} more file(s) omitted for length`);
      break;
    }
    out.push(block);
    size += block.length;
  }
  return out.join('\n');
}

/**
 * An independent model reads the change against the project's standards.
 * Its findings are opinion at the bottom of the standards hierarchy: they can
 * raise attention but never block on their own.
 */
export async function modelFindings(
  model: ModelProvider,
  input: ReviewInput,
  context: { task?: string; rules: CookbookRule[]; principles: Principle[]; golden: GoldenPrinciple[] },
): Promise<{ findings: Finding[]; error?: string }> {
  const system = [
    [
      'You are the reviewer in a human-in-the-loop engineering process. Review the change (lines marked + are new)',
      'against the project standards given. Report concrete, actionable issues only; do not restate what is fine.',
    ].join(' '),
    KARPATHY_LENS,
    [
      'Never give a score. Respond with JSON only: an array of',
      '{"category": one of ' + JSON.stringify(Object.keys(CATEGORY_LABELS)) + ',',
      '"severity": "high"|"medium"|"low", "message": string, "file"?: string, "line"?: number, "action"?: string}.',
    ].join(' '),
  ].join('\n\n');
  const user = [
    context.task ? `TASK / REQUIREMENTS:\n${context.task}\n` : '',
    `PROJECT COOKBOOK RULES:\n${context.rules.map((r) => `- ${r.id} [${r.severity}] ${r.rule}`).join('\n') || '(none)'}\n`,
    `MULLIGAN MEMORY (learned preferences, not laws):\n${context.principles.map((p) => `- ${p.id} ${p.rule}`).join('\n') || '(none)'}\n`,
    `GOLDEN PR PATTERNS:\n${context.golden.map((g) => `- ${g.id} ${g.statement}`).join('\n') || '(none)'}\n`,
    `CHANGE:\n${renderChanges(input)}`,
  ].join('\n');
  try {
    const result = await model.complete({ system, messages: [{ role: 'user', content: user }], maxTokens: 4000 });
    const raw = extractJson(result.text);
    if (!Array.isArray(raw)) return { findings: [], error: 'reviewer model returned no parseable findings' };
    const label = `${model.name} (${model.model})`;
    return {
      findings: raw.flatMap((f): Finding[] => {
        const message = stringField(f, 'message')?.trim();
        if (!message) return [];
        const category = stringField(f, 'category');
        const file = stringField(f, 'file');
        const line = numberField(f, 'line');
        const action = stringField(f, 'action');
        return [
          {
            category: category && isCategoryKey(category) ? category : 'correctness',
            mark: 'warn',
            source: 'model',
            message: `${message} [model opinion: ${label}, ${stringField(f, 'severity') ?? 'unrated'}]`,
            ...(file ? { ref: line ? `${file}:${line}` : file } : {}),
            ...(action ? { action } : {}),
          },
        ];
      }),
    };
  } catch (error) {
    return { findings: [], error: messageOf(error) };
  }
}
