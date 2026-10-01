import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadConfig, workspacePaths, type CommandRunner, type ModelProvider } from '@mulligan/core';
import { cookbookDirectives, evaluateCookbook, loadCookbook, type Violation } from '@mulligan/cookbook';
import {
  assessApplicability,
  detectConflicts,
  loadMemory,
  principleToDirective,
  type Principle,
} from '@mulligan/memory';
import { assessPrQuality, goldenDirectives, loadGoldenPrs } from '@mulligan/pr';
import {
  accessibilityFindings,
  blastRadiusFindings,
  dependencyFindings,
  documentationFindings,
  heuristicFindings,
  safetyFindings,
  securityFindings,
  testingFindings,
  verificationFindings,
} from './checks.js';
import { collectReviewInput, type ReviewInput } from './collect.js';
import { karpathyFindings } from './karpathy.js';
import { modelFindings } from './model.js';
import {
  CATEGORY_LABELS,
  KARPATHY_CATEGORIES,
  REVIEW_CATEGORIES,
  SAFETY_CATEGORIES,
  isCategoryKey,
  type CategoryKey,
  type CategoryResult,
  type Finding,
  type Mark,
  type ReviewReport,
  type ReviewStatus,
} from './types.js';

export * from './types.js';
export { formatReport } from './format.js';
export { collectReviewInput, type ReviewInput } from './collect.js';
export { karpathyFindings, KARPATHY_LENS } from './karpathy.js';
export { cookbookGaps, runFullMemoryReview } from './memory-review.js';

export interface ReviewOptions {
  root: string;
  /** Branch to compare against. Defaults to config review.baseBranch. */
  base?: string;
  /** Review the whole codebase rather than the current changes. */
  all?: boolean;
  /** Globs describing the intended scope, for blast-radius checks. */
  scope?: string[];
  /** Task or requirements, used for memory applicability and the model reviewer. */
  task?: string;
  /** Draft PR description, checked against golden PR patterns. */
  description?: string;
  /** Runs verification commands through the permission layer. */
  runner?: CommandRunner;
  /** Independent reviewer model (the "reviewer" role). */
  reviewer?: ModelProvider;
  safetyMode?: boolean;
}

const COOKBOOK_CATEGORY: Record<string, CategoryKey> = {
  typescript: 'typescript',
  javascript: 'javascript',
  react: 'react',
  'react-native': 'react-native',
  testing: 'testing',
  architecture: 'architecture',
  security: 'security',
  documentation: 'documentation',
  'pull-requests': 'pr-quality',
  'error-handling': 'error-handling',
  performance: 'performance',
  accessibility: 'accessibility',
};

function cookbookFindings(violations: Violation[]): Finding[] {
  return violations.map((v) => ({
    category: COOKBOOK_CATEGORY[v.category] ?? 'project-standards',
    mark: v.severity === 'blocking' || v.severity === 'high' ? 'fail' : 'warn',
    blocking: v.severity === 'blocking',
    source: 'cookbook',
    ruleId: v.ruleId,
    message: `${v.ruleId} violated — ${v.title}`,
    ref: `${v.file}:${v.line}`,
    detail: [`Current: ${v.snippet}`, v.expected ? `Expected: ${v.expected}` : '', `Reason: ${v.reason}`].filter(Boolean).join('\n'),
    action: v.expected ? `${v.ruleId}: replace with ${v.expected} (${v.file}:${v.line})` : `${v.ruleId}: fix ${v.file}:${v.line}`,
  }));
}

function memoryFindings(input: ReviewInput, principles: Principle[], task?: string): { findings: Finding[]; humanReview: string[] } {
  const findings: Finding[] = [];
  const humanReview: string[] = [];

  // Avoid/prohibit principles whose subject appears in new code.
  for (const p of principles) {
    if (!p.subject || (p.stance !== 'avoid' && p.stance !== 'prohibit')) continue;
    const words = p.subject.split('-').filter((w) => w.length > 2);
    if (words.length === 0) continue;
    const hit = input.lines.find((l) => words.every((w) => l.text.toLowerCase().includes(w)));
    if (hit) {
      findings.push({
        category: 'memory-alignment',
        mark: 'warn',
        source: 'memory',
        ruleId: p.id,
        message: `Existing preference (${p.id}) suggests avoiding this: "${p.rule}"`,
        ref: `${hit.file}:${hit.line}`,
        action: `Confirm ${p.id} does not apply here, or follow it.`,
      });
    }
  }

  const description = task ?? [...input.commitSubjects, ...input.changed.map((c) => c.path)].join('. ');
  for (const a of assessApplicability(principles, { description, files: input.changed.map((c) => c.path) })) {
    if (a.verdict === 'possible-exception') {
      findings.push({ category: 'memory-alignment', mark: 'warn', source: 'memory', ruleId: a.principle.id, message: a.message });
    } else if (a.verdict === 'applies' && humanReview.length < 5) {
      humanReview.push(`${a.principle.id}: ${a.principle.rule}`);
    }
  }
  if (findings.length === 0) {
    findings.push({ category: 'memory-alignment', mark: 'pass', source: 'memory', message: `No conflicts with ${principles.length} memory principle(s) detected` });
  }
  return { findings, humanReview };
}

function markFor(findings: Finding[]): Mark {
  if (findings.length === 0) return 'not-assessed';
  if (findings.some((f) => f.mark === 'fail')) return 'fail';
  if (findings.some((f) => f.mark === 'warn')) return 'warn';
  return 'pass';
}

function statusFor(findings: Finding[]): ReviewStatus {
  if (findings.some((f) => f.blocking)) return 'BLOCKING ISSUES';
  if (findings.some((f) => f.mark !== 'pass')) return 'CHANGES REQUIRE ATTENTION';
  return 'NO BLOCKING ISSUES IDENTIFIED';
}

/**
 * Mulligan Review (spec §18–19, §25, §39). Produces actionable findings with
 * evidence, an explicit list of what was NOT verified, and never a score.
 */
export async function runMulliganReview(options: ReviewOptions): Promise<ReviewReport> {
  const { root } = options;
  const config = await loadConfig(root);
  const safetyMode = options.safetyMode ?? config.mode === 'safety';
  const [input, cookbook, memory, golden] = await Promise.all([
    collectReviewInput(root, { base: options.base ?? config.review.baseBranch, all: options.all }),
    loadCookbook(root),
    loadMemory(root),
    loadGoldenPrs(root),
  ]);
  const principles = [...memory.principles];
  const findings: Finding[] = [];
  const unverified: string[] = [];
  const humanReviewAreas: string[] = [];

  // Cookbook
  const evaluation = evaluateCookbook(cookbook.rules, input.files, input.scopeLines ? { scopeLines: input.scopeLines } : {});
  findings.push(...cookbookFindings(evaluation.violations));
  if (cookbook.rules.length === 0) unverified.push('Project coding standards (no cookbook yet — run /setup-mulligan-cookbook)');
  const judgement = evaluation.unenforced.filter((r) => !r.ai_must_ask);
  if (judgement.length > 0) {
    unverified.push(`Cookbook rules needing human/model judgement: ${judgement.map((r) => r.id).join(', ')}`);
  }
  for (const r of evaluation.unenforced.filter((r) => r.ai_must_ask)) humanReviewAreas.push(`${r.id}: ${r.rule}`);

  // Framework heuristics, security, accessibility, testing, docs, dependencies
  findings.push(
    ...heuristicFindings(input, cookbook.rules),
    ...securityFindings(input.lines, input.files),
    ...accessibilityFindings(input.lines),
    ...testingFindings(input),
    ...documentationFindings(input),
    ...(await dependencyFindings(root, input)),
  );
  if (!findings.some((f) => f.category === 'security')) {
    findings.push({ category: 'security', mark: 'pass', source: 'heuristic', message: 'No obvious security regression identified by pattern checks' });
  }

  // Blast radius
  const blast = blastRadiusFindings(input, options.scope);
  findings.push(...blast.findings);
  humanReviewAreas.push(...blast.humanReview);

  // Mulligan Memory and the standards hierarchy
  if (principles.length > 0) {
    const mem = memoryFindings(input, principles, options.task);
    findings.push(...mem.findings);
    humanReviewAreas.push(...mem.humanReview);
  } else {
    unverified.push('Mulligan Memory alignment (no confirmed principles yet)');
  }
  const conflicts = detectConflicts([
    ...principles.flatMap((p) => principleToDirective(p) ?? []),
    ...cookbookDirectives(cookbook.rules),
    ...goldenDirectives(golden.principles),
  ]);
  for (const c of conflicts) {
    findings.push({
      category: 'memory-alignment',
      mark: 'warn',
      source: 'hierarchy',
      message: `Conflicting standards on "${c.subject}": ${c.recommendation}`,
      action: c.memoryToRevisit.length ? `Decide whether to update Mulligan Memory (${c.memoryToRevisit.join(', ')}).` : undefined,
    });
  }

  // Golden PR alignment
  if (input.mode === 'diff') {
    const quality = assessPrQuality({ files: input.changed, description: options.description }, golden.principles, golden.metadata?.stats);
    findings.push(...quality.findings.map((f) => ({ category: 'pr-quality' as const, source: 'golden-pr' as const, ruleId: f.principleId, mark: f.mark, message: f.message, action: f.action })));
    unverified.push(...quality.unverified);
  }

  // Verification
  const verification = await verificationFindings(config.verification.commands, options.runner);
  findings.push(...verification.findings);
  unverified.push(...verification.unverified);

  // The four Karpathy principles
  const karpathy = karpathyFindings(input, {
    task: options.task,
    description: options.description,
    scope: options.scope,
    verification: verification.findings,
  });
  findings.push(...karpathy.findings);
  unverified.push(...karpathy.unverified);

  // Independent reviewer model
  if (options.reviewer) {
    const model = await modelFindings(options.reviewer, input, { task: options.task, rules: cookbook.rules, principles, golden: golden.principles });
    findings.push(...model.findings);
    if (model.error) unverified.push(`Model review (${model.error})`);
  } else {
    unverified.push('Independent model review (no reviewer model assigned)');
  }

  // Safety mode
  if (safetyMode) {
    const safety = safetyFindings(input, options.description);
    findings.push(...safety.findings);
    humanReviewAreas.push(...safety.humanReview);
  }

  // Correctness: only evidence can speak to it.
  if (!findings.some((f) => f.category === 'correctness')) {
    unverified.push('Requirement satisfaction (needs human confirmation or a reviewer model with the task)');
  }
  unverified.push('Production runtime behaviour (real devices, networks and data)');

  const keys = [
    ...Object.keys(KARPATHY_CATEGORIES),
    ...Object.keys(REVIEW_CATEGORIES),
    ...(safetyMode ? Object.keys(SAFETY_CATEGORIES) : []),
  ].filter(isCategoryKey);
  const categories: CategoryResult[] = keys.map((key) => {
    const own = findings.filter((f) => f.category === key);
    return { key, label: CATEGORY_LABELS[key], mark: markFor(own), findings: own };
  });

  // Blocking first, then failures, then warnings.
  const order = (f: Finding): number => (f.blocking ? 0 : f.mark === 'fail' ? 1 : 2);
  const actions = [
    ...new Set(
      findings
        .flatMap((f) => (f.mark !== 'pass' && f.action ? [{ action: f.action, order: order(f) }] : []))
        .sort((a, b) => a.order - b.order)
        .map((a) => a.action),
    ),
  ];

  return {
    status: statusFor(findings),
    scope: { mode: input.mode, ...(input.against ? { against: input.against } : {}), files: input.changed.length },
    categories,
    notAssessed: categories.filter((c) => c.mark === 'not-assessed').map((c) => c.key),
    unverified: [...new Set(unverified)],
    humanReviewAreas: [...new Set(humanReviewAreas)],
    actions,
    conflicts,
    preexistingViolations: evaluation.preexisting.length,
    allowedViolations: evaluation.allowed.length,
    generatedAt: new Date().toISOString(),
  };
}

/** Saves the report to `.mulligan/audit/reviews/` and returns the path. */
export async function saveReport(root: string, text: string, generatedAt: string): Promise<string> {
  const dir = path.join(workspacePaths(root).audit, 'reviews');
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${generatedAt.replace(/[:.]/g, '-')}.md`);
  await writeFile(file, `# Mulligan Review — ${generatedAt}\n\n\`\`\`text\n${text}\n\`\`\`\n`, 'utf8');
  return file;
}

