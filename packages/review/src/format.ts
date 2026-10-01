import { formatConflict } from '@mulligan/memory';
import { isKarpathyKey, type Mark, type ReviewReport } from './types.js';

const SYMBOL: Record<Mark, string> = { pass: '✓', warn: '⚠', fail: '✗', 'not-assessed': '–' };

/** The spec §25 report. Deliberately no score. */
export function formatReport(report: ReviewReport, options: { verbose?: boolean } = {}): string {
  const out: string[] = ['MULLIGAN REVIEW', ''];
  out.push('Status:', report.status, '');
  out.push(
    report.scope.mode === 'diff'
      ? `Scope: ${report.scope.files} changed file(s) since ${report.scope.against?.slice(0, 10) ?? 'HEAD'}`
      : `Scope: whole codebase (${report.scope.files} source files)`,
    '',
  );

  // The Karpathy principles are always shown, assessed or not.
  out.push('KARPATHY PRINCIPLES');
  for (const category of report.categories.filter((c) => isKarpathyKey(c.key))) {
    out.push(`${SYMBOL[category.mark]} ${category.label}${category.mark === 'not-assessed' ? ' — not assessed (see Unverified)' : ''}`);
    const shown = options.verbose ? category.findings : category.findings.slice(0, 5);
    for (const f of shown) {
      out.push(`    ${SYMBOL[f.mark]} ${f.message}${f.ref ? `  (${f.ref})` : ''}`);
      if (f.detail && options.verbose) out.push(...f.detail.split('\n').map((l) => `        ${l}`));
    }
    if (shown.length < category.findings.length) out.push(`    … ${category.findings.length - shown.length} more (use --verbose)`);
  }
  out.push('');

  for (const category of report.categories) {
    if (category.mark === 'not-assessed' || isKarpathyKey(category.key)) continue;
    out.push(category.label);
    const shown = options.verbose ? category.findings : category.findings.slice(0, 8);
    for (const f of shown) {
      out.push(`${SYMBOL[f.mark]} ${f.message}${f.ref ? `  (${f.ref})` : ''}`);
      if (f.detail && (options.verbose || f.mark === 'fail')) {
        out.push(...f.detail.split('\n').map((l) => `    ${l}`));
      }
    }
    if (shown.length < category.findings.length) out.push(`  … ${category.findings.length - shown.length} more (use --verbose)`);
    out.push('');
  }

  if (report.conflicts.length > 0) {
    for (const c of report.conflicts) out.push(formatConflict(c), '');
  }

  if (report.notAssessed.length > 0) {
    const others = report.notAssessed.filter((k) => !isKarpathyKey(k));
    if (others.length) out.push(`Not assessed: ${others.map((k) => report.categories.find((c) => c.key === k)?.label ?? k).join(', ')}`, '');
  }

  out.push('Unverified');
  for (const u of report.unverified) out.push(`- ${u}`);
  out.push('');

  if (report.humanReviewAreas.length > 0) {
    out.push('Human review areas');
    report.humanReviewAreas.forEach((h, i) => out.push(`${i + 1}. ${h}`));
    out.push('');
  }

  if (report.actions.length > 0) {
    out.push('Recommended actions');
    report.actions.forEach((a, i) => out.push(`${i + 1}. ${a}`));
    out.push('');
  }

  if (report.preexistingViolations > 0 || report.allowedViolations > 0) {
    out.push(
      `Also: ${report.preexistingViolations} cookbook violation(s) in existing code outside this change; ` +
        `${report.allowedViolations} allowed with a documented mulligan-allow reason.`,
      '',
    );
  }

  if (report.status === 'NO BLOCKING ISSUES IDENTIFIED') {
    out.push('"No blocking issues identified" is not the same as "perfect". You decide.');
  } else {
    out.push('You decide what to change. Take a Mulligan if the approach itself is wrong.');
  }
  return out.join('\n');
}
