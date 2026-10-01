import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isRecord, isStance, numberField, stringField, today, workspacePaths } from '@mulligan/core';
import YAML from 'yaml';
import type { ChangedFile, PullRequest, ReviewComment } from '../provider/types.js';
import type { GoldenPrinciple, GoldenProfile, GoldenStats } from './extract.js';

export interface GoldenExample {
  pr: PullRequest;
  files: ChangedFile[];
  comments: ReviewComment[];
  /** Why the developer considers this PR excellent, if they said. */
  reason?: string;
}

export interface GoldenMetadata {
  platform: string;
  repository: string;
  updated: string;
  examples: { id: string; url: string; title: string; reason?: string }[];
  stats: GoldenStats;
}

const PRINCIPLES_HEADER = `# Golden PR principles — "What does excellent look like HERE?"
# Patterns observed in this team's chosen golden PRs. They describe this team's
# standard, not a universal "perfect PR". Edit or delete freely.
`;

function exampleFile(dir: string, pr: PullRequest): string {
  return path.join(dir, `${pr.platform}-${pr.id}.json`);
}

/** Writes `.mulligan/golden-pr/{examples/, principles.yaml, metadata.yaml}` (spec §17). */
export async function saveGoldenPrs(root: string, examples: GoldenExample[], profile: GoldenProfile): Promise<void> {
  const paths = workspacePaths(root);
  await mkdir(paths.goldenExamples, { recursive: true });
  for (const example of examples) {
    await writeFile(exampleFile(paths.goldenExamples, example.pr), JSON.stringify(example, null, 2) + '\n', 'utf8');
  }
  const first = examples[0]?.pr;
  const metadata: GoldenMetadata = {
    platform: first?.platform ?? 'unknown',
    repository: first?.repository ?? 'unknown',
    updated: today(),
    examples: examples.map((e) => ({ id: e.pr.id, url: e.pr.url, title: e.pr.title, ...(e.reason ? { reason: e.reason } : {}) })),
    stats: profile.stats,
  };
  await writeFile(path.join(paths.goldenPr, 'metadata.yaml'), YAML.stringify(metadata), 'utf8');
  await writeFile(path.join(paths.goldenPr, 'principles.yaml'), PRINCIPLES_HEADER + YAML.stringify({ principles: profile.principles }), 'utf8');
}

export interface LoadedGolden {
  principles: GoldenPrinciple[];
  metadata?: GoldenMetadata;
}

export async function loadGoldenPrs(root: string): Promise<LoadedGolden> {
  const { goldenPr } = workspacePaths(root);
  const principlesFile = path.join(goldenPr, 'principles.yaml');
  const metadataFile = path.join(goldenPr, 'metadata.yaml');
  const principles = existsSync(principlesFile) ? parseGoldenPrinciples(YAML.parse(await readFile(principlesFile, 'utf8'))) : [];
  const metadata = existsSync(metadataFile) ? parseGoldenMetadata(YAML.parse(await readFile(metadataFile, 'utf8'))) : undefined;
  return { principles, ...(metadata ? { metadata } : {}) };
}

// These files are committed and may be edited by hand: malformed entries are skipped, not trusted.

export function parseGoldenPrinciples(raw: unknown): GoldenPrinciple[] {
  const list = isRecord(raw) && Array.isArray(raw.principles) ? raw.principles : [];
  return list.flatMap((p): GoldenPrinciple[] => {
    const id = stringField(p, 'id');
    const statement = stringField(p, 'statement');
    const subject = stringField(p, 'subject');
    const stance = stringField(p, 'stance');
    if (!id || !statement || !subject || !isStance(stance)) return [];
    const support = isRecord(p) ? p.support : undefined;
    const examples = isRecord(support) && Array.isArray(support.examples) ? support.examples.filter((e): e is string => typeof e === 'string') : [];
    return [
      {
        id,
        statement,
        subject,
        stance,
        support: { count: numberField(support, 'count') ?? 0, total: numberField(support, 'total') ?? 0, examples },
        kind: 'observed',
      },
    ];
  });
}

export function parseGoldenMetadata(raw: unknown): GoldenMetadata | undefined {
  if (!isRecord(raw)) return undefined;
  const stats = raw.stats;
  const examples = Array.isArray(raw.examples) ? raw.examples : [];
  return {
    platform: stringField(raw, 'platform') ?? 'unknown',
    repository: stringField(raw, 'repository') ?? 'unknown',
    updated: stringField(raw, 'updated') ?? '',
    examples: examples.flatMap((e) => {
      const id = stringField(e, 'id');
      const url = stringField(e, 'url');
      const title = stringField(e, 'title');
      const reason = stringField(e, 'reason');
      return id && url && title ? [{ id, url, title, ...(reason ? { reason } : {}) }] : [];
    }),
    stats: {
      examples: numberField(stats, 'examples') ?? examples.length,
      medianLines: numberField(stats, 'medianLines') ?? 0,
      maxLines: numberField(stats, 'maxLines') ?? 0,
      medianFiles: numberField(stats, 'medianFiles') ?? 0,
      maxFiles: numberField(stats, 'maxFiles') ?? 0,
      maxAreas: numberField(stats, 'maxAreas') ?? 0,
    },
  };
}
