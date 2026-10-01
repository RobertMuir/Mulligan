import type { ChangedFile, PullRequest } from '../provider/types.js';
import { extractFeatures, isDescriptionSection } from '../golden/features.js';
import type { GoldenPrinciple, GoldenStats } from '../golden/extract.js';

export interface PrQualityFinding {
  mark: 'pass' | 'warn' | 'fail';
  message: string;
  principleId?: string;
  action?: string;
}

export interface PrQualityInput {
  files: ChangedFile[];
  /** Draft PR description, if the developer has one. */
  description?: string;
}

/**
 * Compares the current change with the team's golden PR patterns. Findings
 * are framed as "your team usually…", never as an objective standard.
 */
export function assessPrQuality(input: PrQualityInput, golden: GoldenPrinciple[], stats?: GoldenStats): { findings: PrQualityFinding[]; unverified: string[] } {
  const pr: PullRequest = {
    id: 'current',
    platform: 'github',
    repository: '',
    url: '',
    title: '',
    body: input.description ?? '',
    author: '',
    state: 'open',
    createdAt: '',
    baseBranch: '',
    headBranch: '',
    additions: 0,
    deletions: 0,
    changedFiles: input.files.length,
    labels: [],
  };
  const features = extractFeatures(pr, input.files, []);
  const findings: PrQualityFinding[] = [];
  const unverified: string[] = [];

  if (golden.length === 0) {
    unverified.push('PR quality against team examples (no golden PRs yet — run /setup-mulligan-pr)');
    return { findings, unverified };
  }

  for (const principle of golden) {
    const support = `${principle.support.count}/${principle.support.total} golden PRs`;
    const named = /^pr-(\w+)-section$/.exec(principle.subject)?.[1];
    const section = isDescriptionSection(named) ? named : undefined;

    if (principle.subject === 'small-focused-prs' && stats) {
      const limit = Math.max(stats.maxLines, stats.medianLines * 2);
      findings.push(
        features.linesChanged > limit
          ? {
              mark: 'warn',
              principleId: principle.id,
              message: `This change is ${features.linesChanged} lines; your golden PRs top out at ${stats.maxLines} (median ${stats.medianLines}).`,
              action: 'Consider splitting this change.',
            }
          : { mark: 'pass', principleId: principle.id, message: `Size (${features.linesChanged} lines) is in line with your golden PRs.` },
      );
    } else if (principle.subject === 'unrelated-refactors') {
      findings.push(
        features.areas.length > Math.max(2, stats?.maxAreas ?? 2)
          ? {
              mark: 'warn',
              principleId: principle.id,
              message: `Touches ${features.areas.length} areas (${features.areas.join(', ')}); golden PRs stay within one or two.`,
              action: 'Move unrelated changes into a separate PR.',
            }
          : { mark: 'pass', principleId: principle.id, message: 'Scope stays focused, like your golden PRs.' },
      );
    } else if (principle.subject === 'tests-with-changes' && features.areas.length > 0) {
      findings.push(
        features.testsChanged
          ? { mark: 'pass', principleId: principle.id, message: 'Tests are included, as in your golden PRs.' }
          : { mark: 'warn', principleId: principle.id, message: `No test changes; ${support} include tests.`, action: 'Add tests for the change.' },
      );
    } else if (section) {
      if (section === 'screenshots' && !features.uiChanged) continue;
      if (section === 'migration' && !features.migrationChanged) continue;
      if (input.description === undefined) {
        unverified.push(`PR description sections (no draft description supplied — pass one to check "${section}")`);
        continue;
      }
      findings.push(
        features.sections[section]
          ? { mark: 'pass', principleId: principle.id, message: `Description has a ${section} section.` }
          : {
              mark: 'warn',
              principleId: principle.id,
              message: `Description has no ${section} section; ${support} include one.`,
              action: `Add a ${section} section to the PR description.`,
            },
      );
    }
  }
  return { findings, unverified: [...new Set(unverified)] };
}
