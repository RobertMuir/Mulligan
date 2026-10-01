import { describe, expect, it } from 'vitest';
import {
  GitHubProvider,
  assessPrQuality,
  detectSections,
  extractFeatures,
  extractGoldenProfile,
  goldenToLessons,
  lessonsFromReviews,
  parsePullRequestUrl,
  type ChangedFile,
  type PullRequest,
} from '../src/index.js';

const pr = (id: string, body: string, extra: Partial<PullRequest> = {}): PullRequest => ({
  id,
  platform: 'github',
  repository: 'acme/app',
  url: `https://github.com/acme/app/pull/${id}`,
  title: `PR ${id}`,
  body,
  author: 'dev',
  state: 'merged',
  createdAt: '2026-09-01',
  baseBranch: 'main',
  headBranch: 'feature',
  additions: 0,
  deletions: 0,
  changedFiles: 0,
  labels: [],
  ...extra,
});

const files = (...paths: [string, number][]): ChangedFile[] => paths.map(([path, n]) => ({ path, status: 'modified', additions: n, deletions: 0 }));

const GOOD_BODY = '## Problem\nUsers lose drafts.\n\n## Testing\nAdded unit tests.\n\n## Risks\nLow.';

describe('PR URLs', () => {
  it('parses every supported platform', () => {
    expect(parsePullRequestUrl('https://github.com/acme/app/pull/42')).toMatchObject({ platform: 'github', repository: 'acme/app', id: '42' });
    expect(parsePullRequestUrl('https://gitlab.com/group/sub/proj/-/merge_requests/7')).toMatchObject({ platform: 'gitlab', repository: 'group/sub/proj', id: '7' });
    expect(parsePullRequestUrl('https://bitbucket.org/ws/repo/pull-requests/3')).toMatchObject({ platform: 'bitbucket', id: '3' });
    expect(parsePullRequestUrl('https://dev.azure.com/org/proj/_git/repo/pullrequest/9')).toMatchObject({ platform: 'azure-devops', repository: 'org/proj/repo', id: '9' });
    expect(parsePullRequestUrl('not a url')).toBeUndefined();
  });
});

describe('golden PR extraction', () => {
  it('derives observed team patterns with support counts', () => {
    const examples = [
      extractFeatures(pr('1', GOOD_BODY), files(['src/drafts/save.ts', 40], ['src/drafts/save.test.ts', 30]), []),
      extractFeatures(pr('2', GOOD_BODY), files(['src/auth/login.ts', 60], ['src/auth/login.test.ts', 20]), []),
      extractFeatures(pr('3', '## Problem\nSlow.\n\n## Testing\nBenchmarks.'), files(['src/list/List.ts', 80], ['src/list/List.test.ts', 10]), []),
      extractFeatures(pr('4', 'quick fix'), files(['src/x.ts', 5]), []),
    ];
    const profile = extractGoldenProfile(examples);
    const statements = profile.principles.map((p) => p.statement);
    expect(statements).toContain('Include an explicit testing section describing how the change was verified.');
    expect(statements).toContain('Ship tests alongside code changes.');
    expect(statements).not.toContain('Document risks and impact.'); // 2/4 is below the threshold
    const testing = profile.principles.find((p) => p.subject === 'pr-testing-section')!;
    expect(testing.support).toMatchObject({ count: 3, total: 4 });
    expect(testing.kind).toBe('observed');

    const lessons = goldenToLessons(profile.principles);
    expect(lessons.every((l) => l.source === 'golden_pr' && l.derivation === 'inferred')).toBe(true);
  });

  it('detects description sections and embedded screenshots', () => {
    const s = detectSections('**Why:**\nbecause\n\n### How to test\nrun it\n\n![after](https://x/y.png)');
    expect(s).toMatchObject({ problem: true, testing: true, screenshots: true, rollback: false });
  });
});

describe('PR quality against golden patterns', () => {
  it('frames findings relative to the team examples', () => {
    const profile = extractGoldenProfile([
      extractFeatures(pr('1', GOOD_BODY), files(['src/a/a.ts', 40], ['src/a/a.test.ts', 30]), []),
      extractFeatures(pr('2', GOOD_BODY), files(['src/b/b.ts', 50], ['src/b/b.test.ts', 30]), []),
      extractFeatures(pr('3', GOOD_BODY), files(['src/c/c.ts', 60], ['src/c/c.test.ts', 30]), []),
    ]);
    const { findings, unverified } = assessPrQuality(
      { files: files(['src/a/x.ts', 500], ['src/b/y.ts', 400], ['src/c/z.ts', 300], ['lib/w.ts', 200]), description: '## Problem\nX' },
      profile.principles,
      profile.stats,
    );
    const warnings = findings.filter((f) => f.mark === 'warn').map((f) => f.message);
    expect(warnings.some((w) => /golden PRs top out at/.test(w))).toBe(true);
    expect(warnings.some((w) => /No test changes/.test(w))).toBe(true);
    expect(warnings.some((w) => /no testing section/.test(w))).toBe(true);
    expect(unverified).toEqual([]);
  });
});

describe('learning from merged PR reviews (spec §37)', () => {
  it('turns directive reviewer comments into candidate lessons', () => {
    const lessons = lessonsFromReviews([
      {
        pr: pr('9', ''),
        comments: [
          { id: '1', author: 'lead', body: "Don't create this abstraction; the component is only used once.", kind: 'inline', path: 'src/a.tsx', line: 3, createdAt: '' },
          { id: '2', author: 'lead', body: 'LGTM', kind: 'review', verdict: 'approved', createdAt: '' },
          { id: '3', author: 'dev', body: "I don't think we should change this", kind: 'conversation', createdAt: '' },
        ],
      },
      { pr: pr('10', '', { state: 'closed' }), comments: [{ id: '4', author: 'lead', body: 'Avoid this pattern please, it leaks.', kind: 'inline', createdAt: '' }] },
    ]);
    expect(lessons).toHaveLength(1);
    expect(lessons[0]).toMatchObject({ source: 'review_feedback', derivation: 'stated', rule: "Don't create this abstraction; the component is only used once." });
  });
});

describe('GitHubProvider', () => {
  it('maps the REST API to the provider abstraction', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string) => {
      calls.push(url);
      const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200 });
      if (url.endsWith('/pulls/5')) {
        return json({
          number: 5, html_url: 'u', title: 'T', body: null, user: { login: 'a' }, state: 'closed', merged_at: '2026-09-02',
          created_at: '2026-09-01', base: { ref: 'main' }, head: { ref: 'f' }, additions: 3, deletions: 1, changed_files: 1, labels: [],
        });
      }
      if (url.includes('/pulls/5/reviews')) return json([{ id: 1, user: { login: 'r' }, body: '', state: 'CHANGES_REQUESTED', submitted_at: '', html_url: '' }]);
      return json([]);
    }) as typeof fetch;
    const gh = new GitHubProvider({ repository: 'acme/app', token: 't', fetchImpl });
    expect(await gh.getPullRequest('5')).toMatchObject({ id: '5', state: 'merged', body: '', additions: 3 });
    const comments = await gh.getReviewComments('5');
    expect(comments).toEqual([expect.objectContaining({ kind: 'review', verdict: 'changes_requested' })]);
    expect(calls.some((c) => c.includes('/issues/5/comments'))).toBe(true);
  });
});
