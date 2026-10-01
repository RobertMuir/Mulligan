import { git, messageOf, saveConfig } from '@mulligan/core';
import {
  COOKBOOK_CATEGORIES,
  INTERVIEW_QUESTIONS,
  STARTER_RULES,
  answersToCookbook,
  globalAnswersToCookbook,
  loadCookbook,
  mergeCookbookFiles,
  saveCookbookFile,
  type Cookbook,
  type CookbookCategory,
  type InterviewAnswers,
} from '@mulligan/cookbook';
import { loadMemory } from '@mulligan/memory';
import { dim, green } from '@mulligan/mascot';
import {
  DEFAULT_TOKEN_ENV,
  createPullRequestProvider,
  extractFeatures,
  extractGoldenProfile,
  goldenToLessons,
  lessonsFromReviews,
  parsePullRequestUrl,
  resolveToken,
  saveGoldenPrs,
  type GoldenExample,
  type PrPlatform,
  type PullRequestProvider,
} from '@mulligan/pr';
import { heading } from '../io.js';
import { proposeAndConfirm } from './memory.js';
import type { Command } from './types.js';

const LANGUAGE_CATEGORIES = COOKBOOK_CATEGORIES.filter((c) => !['pull-requests', 'documentation', 'ai-guardrails'].includes(c));

export const setupCookbookCommand: Command = {
  name: 'setup-mulligan-cookbook',
  summary: 'Create your team\'s Coding Standards Cookbook through a short interview',
  async run(session) {
    const { io, root } = session;
    if (!io.interactive) return io.print('/setup-mulligan-cookbook is an interview — run it in an interactive terminal.');
    io.print(heading('CODING STANDARDS COOKBOOK'));
    io.print('This answers one question: "How does OUR team want software written?"');
    io.print(dim('Your answers become project rules — distinct from generic best practice, and above it in the hierarchy.'));
    io.print();
    io.print(`Categories: ${LANGUAGE_CATEGORIES.join(', ')}`);
    const picked = (await io.ask('Which categories should we cover? (comma separated)', 'typescript, react, testing'))
      .split(',')
      .map((c) => c.trim())
      .filter((c): c is CookbookCategory => (LANGUAGE_CATEGORIES as readonly string[]).includes(c));

    const existing = await loadCookbook(root).catch((): Cookbook => ({ files: [], rules: [] }));
    const files = new Map(existing.files.map((f) => [f.category, f]));
    const allRules = () => [...files.values()].flatMap((f) => f.rules);

    for (const category of picked) {
      io.print();
      io.print(heading(category.toUpperCase()));
      const starters = (STARTER_RULES[category] ?? []).filter((r) => !allRules().some((x) => x.id === r.id));
      for (const rule of starters) {
        io.print(`  Suggested ${green(rule.id)} [${rule.severity}] ${rule.rule}`);
        if (await io.confirm('  Adopt this rule?', true)) {
          files.set(category, mergeCookbookFiles(files.get(category), { category, rules: [rule] }));
        }
      }
      const answers: InterviewAnswers = {};
      for (const q of INTERVIEW_QUESTIONS.filter((q) => !q.global)) {
        answers[q.key] = await io.ask(`${q.prompt.replace('{topic}', category)} ${dim(q.hint)}`);
      }
      files.set(category, mergeCookbookFiles(files.get(category), answersToCookbook(category, answers, allRules())));
    }

    io.print();
    io.print(heading('ACROSS THE PROJECT'));
    const global: InterviewAnswers = {};
    for (const q of INTERVIEW_QUESTIONS.filter((q) => q.global)) global[q.key] = await io.ask(`${q.prompt} ${dim(q.hint)}`);
    for (const file of globalAnswersToCookbook(global, allRules())) files.set(file.category, mergeCookbookFiles(files.get(file.category), file));

    const written: string[] = [];
    for (const file of files.values()) {
      if (file.rules.length === 0 && !file.philosophy) continue;
      written.push(await saveCookbookFile(root, file));
    }
    const total = allRules().length;
    io.print();
    io.print(`${green('✓')} Cookbook saved: ${total} rule(s) in ${written.length} file(s) under .mulligan/cookbook/.`);
    io.print(dim('Rules without a `check:` need human or model judgement. Add a builtin or pattern check to enforce one automatically.'));
  },
};

function remoteToRepository(remote: string): { platform?: PrPlatform; repository?: string } {
  const m = /(?:github\.com|gitlab\.com|bitbucket\.org)[:/](.+?)(?:\.git)?$/.exec(remote.trim());
  if (!m) return {};
  const platform: PrPlatform = remote.includes('gitlab') ? 'gitlab' : remote.includes('bitbucket') ? 'bitbucket' : 'github';
  return { platform, repository: m[1] };
}

async function fetchExample(provider: PullRequestProvider, id: string): Promise<GoldenExample> {
  const [pr, files, comments] = await Promise.all([provider.getPullRequest(id), provider.getChangedFiles(id), provider.getReviewComments(id)]);
  return { pr, files, comments };
}

export const setupPrCommand: Command = {
  name: 'setup-mulligan-pr',
  summary: 'Connect your PR platform and teach Mulligan what an excellent PR looks like',
  async run(session) {
    const { io, root } = session;
    if (!io.interactive) return io.print('/setup-mulligan-pr is interactive — run it in an interactive terminal.');
    io.print(heading('PR PLATFORM'));
    const remote = await git(root, ['remote', 'get-url', 'origin']).catch(() => '');
    const guess = remoteToRepository(remote);
    const platform = await io.choose(
      'Which PR platform do you use?',
      [
        { key: '1', label: 'GitHub', value: 'github' as const },
        { key: '2', label: 'GitLab', value: 'gitlab' as const },
        { key: '3', label: 'Bitbucket', value: 'bitbucket' as const },
        { key: '4', label: 'Azure DevOps', value: 'azure-devops' as const },
      ],
      guess.platform ?? 'github',
    );
    const repository = await io.ask(`Repository ${dim('(owner/name or group/project)')}`, guess.repository ?? '');
    if (!repository) return io.print('A repository is needed.');
    const tokenEnv = DEFAULT_TOKEN_ENV[platform];
    const settings = { platform, repository, tokenEnv };

    if (!(await resolveToken(settings))) {
      io.print();
      io.print(`Mulligan needs read access. Set the ${green(tokenEnv)} environment variable to an access token with read access to pull requests`);
      if (platform === 'github') io.print('(or sign in with the GitHub CLI: `gh auth login`).');
      io.print(dim('Tokens are read from the environment and never stored in Mulligan files. Do not paste tokens into this chat.'));
      if (!(await io.confirm('Continue without a token (public repositories only)?'))) return;
    }

    let provider: PullRequestProvider;
    try {
      provider = await createPullRequestProvider(settings);
      await provider.connect();
    } catch (error) {
      return io.print(`Could not connect: ${messageOf(error)}`);
    }
    io.print(`${green('✓')} Connected to ${platform}:${repository}`);
    session.config.pr = { platform, repository, tokenEnv };
    await saveConfig(root, session.config);

    io.print();
    io.print(heading('GOLDEN PR EXAMPLES'));
    io.print("I'd like to learn what an excellent PR looks like for your team.");
    io.print('Please provide 3–10 PRs that represent your highest standard of engineering.');
    io.print(dim('They become your Golden PR examples — your team\'s standard, not a universal "perfect PR".'));
    let entries = await io.askMany('Paste PR URLs or numbers, one per line — or type "list" to pick from recent merged PRs:');
    if (entries.length === 1 && entries[0]?.toLowerCase() === 'list') {
      const merged = (await provider.getMergedPullRequests()).slice(0, 20);
      merged.forEach((pr, i) => io.print(`  ${String(i + 1).padStart(2)}. #${pr.id} ${pr.title} ${dim(`(+${pr.additions}/-${pr.deletions})`)}`));
      const picks = await io.ask('Pick by number (comma separated):');
      entries = picks
        .split(',')
        .map((n) => merged[Number(n.trim()) - 1]?.id)
        .filter((id): id is string => Boolean(id));
    }
    const ids = entries.map((e) => parsePullRequestUrl(e)?.id ?? e.replace(/^#/, '')).filter((id) => /^\d+$/.test(id));
    if (ids.length < 3) io.print(dim(`Only ${ids.length} example(s) — patterns will be weaker than with 3–10.`));
    if (ids.length === 0) return;

    const examples: GoldenExample[] = [];
    for (const id of ids.slice(0, 10)) {
      try {
        const example = await fetchExample(provider, id);
        const reason = await io.ask(`Why is #${id} "${example.pr.title}" a golden PR? ${dim('(optional)')}`);
        examples.push(reason ? { ...example, reason } : example);
      } catch (error) {
        io.print(`Skipped #${id}: ${messageOf(error)}`);
      }
    }
    const profile = extractGoldenProfile(examples.map((e) => extractFeatures(e.pr, e.files, e.comments)));
    await saveGoldenPrs(root, examples, profile);

    io.print();
    io.print(heading('GOLDEN PR PRINCIPLES (observed)'));
    if (profile.principles.length === 0) io.print('  No pattern appeared in enough examples to call it a team standard.');
    for (const p of profile.principles) io.print(`  ${green(p.id)} ${p.statement} ${dim(`(${p.support.count}/${p.support.total})`)}`);
    io.print(dim('Saved to .mulligan/golden-pr/. These are observations of your examples, not universal rules.'));

    const store = await loadMemory(root);
    if (profile.principles.length && (await io.confirm('Offer these as candidate lessons for Mulligan Memory?', true))) {
      await proposeAndConfirm(session, store, goldenToLessons(profile.principles));
    }

    if (await io.confirm('Learn from review comments on recent merged PRs too?', true)) {
      const merged = (await provider.getMergedPullRequests()).slice(0, 10);
      const items = [];
      for (const pr of merged) items.push({ pr, comments: await provider.getReviewComments(pr.id).catch(() => []) });
      const lessons = lessonsFromReviews(items).slice(0, 15);
      io.print(`Found ${lessons.length} directive review comment(s) on ${merged.length} merged PRs.`);
      if (lessons.length) await proposeAndConfirm(session, store, lessons);
    }
  },
};
