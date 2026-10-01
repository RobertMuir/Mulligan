import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { formatDifficulty } from '@mulligan/core';
import type { Candidate, FanOutResult } from './fanout.js';

const STANDING_LABEL: Record<Candidate['standing'], string> = {
  eligible: '',
  'failed-verification': 'FAILED VERIFICATION',
  disqualified: 'DOES NOT APPLY',
  errored: 'ERRORED',
};

function pad(s: string, n: number): string {
  return s.length >= n ? `${s.slice(0, n - 1)}…` : s + ' '.repeat(n - s.length);
}

/** Largest gap between judges on any criterion, for flagging disagreement. */
function disagreement(c: Candidate): { criterion: string; spread: number } | undefined {
  let worst: { criterion: string; spread: number } | undefined;
  for (const [criterion, s] of Object.entries(c.scores)) {
    if (s.judges.length < 2) continue;
    const spread = Math.max(...s.judges) - Math.min(...s.judges);
    if (!worst || spread > worst.spread) worst = { criterion, spread };
  }
  return worst && worst.spread >= 2 ? worst : undefined;
}

export function formatFanOut(result: FanOutResult): string {
  const out: string[] = ['MULLIGAN FAN-OUT', ''];
  out.push(`Task: ${result.task}`);
  out.push(formatDifficulty(result.difficulty));
  out.push('');
  const ids = result.rubric.criteria.map((c) => c.id);
  const short: Record<string, string> = {
    correctness: 'Correct',
    'think-before-coding': 'Think',
    'simplicity-first': 'Simple',
    'surgical-changes': 'Surgic',
    'goal-driven': 'Goal',
    standards: 'Stds',
  };
  out.push(
    [pad('#', 3), pad('Cand', 5), pad('Angle', 26), pad('Model', 18), pad('Verified', 12), ...ids.map((id) => pad(short[id] ?? id.slice(0, 6), 8)), 'Weighted'].join(''),
  );
  result.candidates.forEach((c, i) => {
    const verified = c.error ? 'error' : c.applied === false ? 'no-apply' : c.verification.status;
    out.push(
      [
        pad(String(i + 1), 3),
        pad(c.label, 5),
        pad(c.angle.name, 26),
        pad(c.provider, 18),
        pad(verified, 12),
        ...ids.map((id) => pad(c.scores[id]?.final.toFixed(1) ?? '–', 8)),
        c.error ? '–' : `${c.total}${STANDING_LABEL[c.standing] ? `  ${STANDING_LABEL[c.standing]}` : ''}`,
      ].join(''),
    );
  });
  out.push('');
  out.push('Scores are 1–5 per rubric criterion (judges\' mean plus evidence adjustments); "Weighted" is the rubric-weighted total out of 100.');
  out.push('');

  for (const c of result.candidates) {
    out.push(`${c.label} — ${c.angle.name} (${c.provider}/${c.model})`);
    if (c.error) {
      out.push(`  error: ${c.error}`, '');
      continue;
    }
    out.push(`  Approach: ${c.change.approach || '(not stated)'}`);
    if (c.stats) out.push(`  Change: +${c.stats.added}/-${c.stats.removed} across ${c.stats.files.length} file(s)${c.stats.testsTouched ? ', with tests' : ''}`);
    if (c.applyError) out.push(`  Does not apply: ${c.applyError}`);
    for (const r of c.verification.results) out.push(`  ${r.name}: ${r.outcome}  (\`${r.command}\`)`);
    if (c.verification.note) out.push(`  Verification: ${c.verification.note}`);
    if (c.judgedBy.length) out.push(`  Judged blind by: ${c.judgedBy.join(', ')}`);
    const d = disagreement(c);
    if (d) out.push(`  ⚠ Judges disagree on ${d.criterion} by ${d.spread} points — read this one yourself.`);
    const evidence = Object.entries(c.scores).flatMap(([id, s]) => (s.adjustment ? [`${id} ${s.adjustment > 0 ? '+' : ''}${s.adjustment}`] : []));
    if (evidence.length) out.push(`  Evidence adjustments: ${evidence.join(', ')}`);
    out.push('');
  }

  if (result.recommended) {
    const r = result.recommended;
    out.push(`Recommended: ${r.label} (${r.angle.name}, ${r.provider}) — ${r.total}/100`);
    out.push('  Highest rubric-weighted total among candidates that applied and did not fail verification.');
  }
  for (const n of result.notes) out.push(`Note: ${n}`);
  out.push('');
  out.push('The ranking informs your decision; it does not make it. /pick <letter> makes a candidate the current attempt, then /apply.');
  return out.join('\n');
}

/** Saves every candidate, its diff and the report under the session directory. */
export async function saveFanOut(dir: string, result: FanOutResult, report: string): Promise<string> {
  await mkdir(dir, { recursive: true });
  for (const c of result.candidates) {
    await writeFile(path.join(dir, `candidate-${c.label}.md`), `# Candidate ${c.label} — ${c.angle.name} (${c.provider}/${c.model})\n\n${c.text}\n`, 'utf8');
    if (c.diff) await writeFile(path.join(dir, `candidate-${c.label}.patch`), c.diff, 'utf8');
  }
  const scores = result.candidates.map((c) => ({ label: c.label, provider: c.provider, angle: c.angle.id, standing: c.standing, total: c.total, scores: c.scores }));
  await writeFile(path.join(dir, 'scores.json'), JSON.stringify(scores, null, 2), 'utf8');
  await writeFile(path.join(dir, 'report.md'), `\`\`\`text\n${report}\n\`\`\`\n`, 'utf8');
  return dir;
}
