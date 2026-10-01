import { normaliseSubject, type Directive, type Stance } from '@mulligan/core';
import type { NewLesson } from '@mulligan/memory';
import { DESCRIPTION_SECTIONS, type DescriptionSection, type PrFeatures } from './features.js';

/** A pattern observed across the team's golden PRs — never a universal truth (spec §16, §38). */
export interface GoldenPrinciple {
  id: string;
  statement: string;
  subject: string;
  stance: Stance;
  support: { count: number; total: number; examples: string[] };
  kind: 'observed';
}

export interface GoldenStats {
  examples: number;
  medianLines: number;
  maxLines: number;
  medianFiles: number;
  maxFiles: number;
  maxAreas: number;
}

export interface GoldenProfile {
  principles: GoldenPrinciple[];
  stats: GoldenStats;
  features: PrFeatures[];
}

/** Share of examples that must show a pattern before it counts as a team pattern. */
export const SUPPORT_THRESHOLD = 0.6;

const SECTION_STATEMENTS: Record<DescriptionSection, string> = {
  problem: 'State the problem or motivation clearly in the PR description.',
  summary: 'Summarise what changed in the PR description.',
  testing: 'Include an explicit testing section describing how the change was verified.',
  risks: 'Document risks and impact.',
  rollback: 'Describe a rollback strategy.',
  migration: 'Provide migration instructions when applicable.',
  screenshots: 'Include screenshots for UI changes.',
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

export function extractGoldenProfile(features: PrFeatures[]): GoldenProfile {
  const total = features.length;
  const principles: GoldenPrinciple[] = [];
  let n = 1;
  const add = (statement: string, subject: string, stance: Stance, matching: PrFeatures[], denominator: PrFeatures[]): void => {
    if (denominator.length === 0) return;
    if (matching.length / denominator.length < SUPPORT_THRESHOLD) return;
    principles.push({
      id: `GP-${String(n++).padStart(3, '0')}`,
      statement,
      subject: normaliseSubject(subject),
      stance,
      support: { count: matching.length, total: denominator.length, examples: matching.map((f) => f.id) },
      kind: 'observed',
    });
  };

  const stats: GoldenStats = {
    examples: total,
    medianLines: median(features.map((f) => f.linesChanged)),
    maxLines: Math.max(0, ...features.map((f) => f.linesChanged)),
    medianFiles: median(features.map((f) => f.filesChanged)),
    maxFiles: Math.max(0, ...features.map((f) => f.filesChanged)),
    maxAreas: Math.max(0, ...features.map((f) => f.areas.length)),
  };

  if (total === 0) return { principles, stats, features };

  add(
    `Small, focused changes: golden PRs change a median of ${stats.medianLines} lines across ${stats.medianFiles} files.`,
    'small-focused-prs',
    'prefer',
    features.filter((f) => f.linesChanged <= Math.max(stats.medianLines * 2, 400)),
    features,
  );
  add(
    'No unrelated refactors: each PR stays within one or two areas of the codebase.',
    'unrelated-refactors',
    'avoid',
    features.filter((f) => f.areas.length <= 2),
    features,
  );

  const sectionDenominator: Record<DescriptionSection, PrFeatures[]> = {
    problem: features,
    summary: features,
    testing: features,
    risks: features,
    rollback: features,
    migration: features.filter((f) => f.migrationChanged),
    screenshots: features.filter((f) => f.uiChanged),
  };
  for (const section of DESCRIPTION_SECTIONS) {
    const denominator = sectionDenominator[section];
    add(SECTION_STATEMENTS[section], `pr-${section}-section`, 'require', denominator.filter((f) => f.sections[section]), denominator);
  }

  const codeChanging = features.filter((f) => f.areas.length > 0);
  add('Ship tests alongside code changes.', 'tests-with-changes', 'require', codeChanging.filter((f) => f.testsChanged), codeChanging);
  add('Update documentation alongside behaviour changes.', 'docs-with-changes', 'prefer', codeChanging.filter((f) => f.docsChanged), codeChanging);

  return { principles, stats, features };
}

export function goldenDirectives(principles: GoldenPrinciple[]): Directive[] {
  return principles.map((p) => ({ level: 'golden_pr' as const, id: p.id, subject: p.subject, stance: p.stance, statement: p.statement }));
}

/** Golden principles feed Mulligan Memory as candidates, never as confirmed rules (spec §17). */
export function goldenToLessons(principles: GoldenPrinciple[]): NewLesson[] {
  return principles.map((p) => ({
    category: 'pull-requests',
    rule: p.statement,
    subject: p.subject,
    stance: p.stance,
    preference: 'moderate',
    source: 'golden_pr',
    derivation: 'inferred',
    evidence: [{ kind: 'golden_pr', ref: p.id, note: `Observed in ${p.support.count}/${p.support.total} golden PRs (${p.support.examples.join(', ')})` }],
    scope: 'project',
  }));
}
