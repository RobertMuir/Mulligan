import { getJson } from '../provider/http.js';
import type { ChangedFile, PullRequest, PullRequestProvider, ReviewComment } from '../provider/types.js';

interface GhUser {
  login: string;
}

interface GhPull {
  number: number;
  html_url: string;
  title: string;
  body: string | null;
  user: GhUser | null;
  state: 'open' | 'closed';
  merged_at: string | null;
  created_at: string;
  base: { ref: string };
  head: { ref: string };
  additions?: number;
  deletions?: number;
  changed_files?: number;
  commits?: number;
  labels: { name: string }[];
}

export interface GitHubOptions {
  repository: string;
  token?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export class GitHubProvider implements PullRequestProvider {
  readonly platform = 'github' as const;
  readonly repository: string;
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly fetchImpl: typeof fetch;

  constructor(options: GitHubOptions) {
    this.repository = options.repository;
    this.baseUrl = options.baseUrl ?? 'https://api.github.com';
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.headers = {
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    };
  }

  private get<T>(path: string): Promise<T> {
    return getJson<T>(`${this.baseUrl}${path}`, this.headers, this.fetchImpl);
  }

  private async paginate<T>(path: string, maxPages = 10): Promise<T[]> {
    const out: T[] = [];
    const sep = path.includes('?') ? '&' : '?';
    for (let page = 1; page <= maxPages; page++) {
      const batch = await this.get<T[]>(`${path}${sep}per_page=100&page=${page}`);
      out.push(...batch);
      if (batch.length < 100) break;
    }
    return out;
  }

  private toPullRequest(p: GhPull): PullRequest {
    return {
      id: String(p.number),
      platform: 'github',
      repository: this.repository,
      url: p.html_url,
      title: p.title,
      body: p.body ?? '',
      author: p.user?.login ?? 'unknown',
      state: p.merged_at ? 'merged' : p.state,
      createdAt: p.created_at,
      ...(p.merged_at ? { mergedAt: p.merged_at } : {}),
      baseBranch: p.base.ref,
      headBranch: p.head.ref,
      additions: p.additions ?? 0,
      deletions: p.deletions ?? 0,
      changedFiles: p.changed_files ?? 0,
      ...(p.commits !== undefined ? { commits: p.commits } : {}),
      labels: p.labels.map((l) => l.name),
    };
  }

  async connect(): Promise<void> {
    await this.get(`/repos/${this.repository}`);
  }

  async listPullRequests(repository: string = this.repository): Promise<PullRequest[]> {
    const pulls = await this.get<GhPull[]>(`/repos/${repository}/pulls?state=all&per_page=50&sort=updated&direction=desc`);
    return pulls.map((p) => this.toPullRequest(p));
  }

  async getPullRequest(id: string): Promise<PullRequest> {
    return this.toPullRequest(await this.get<GhPull>(`/repos/${this.repository}/pulls/${id}`));
  }

  async getReviewComments(id: string): Promise<ReviewComment[]> {
    const base = `/repos/${this.repository}`;
    const [inline, reviews, conversation] = await Promise.all([
      this.paginate<{ id: number; user: GhUser | null; body: string; path: string; line: number | null; created_at: string; html_url: string }>(
        `${base}/pulls/${id}/comments`,
      ),
      this.paginate<{ id: number; user: GhUser | null; body: string | null; state: string; submitted_at: string; html_url: string }>(
        `${base}/pulls/${id}/reviews`,
      ),
      this.paginate<{ id: number; user: GhUser | null; body: string; created_at: string; html_url: string }>(
        `${base}/issues/${id}/comments`,
      ),
    ]);
    const verdict = (state: string): ReviewComment['verdict'] =>
      state === 'APPROVED' ? 'approved' : state === 'CHANGES_REQUESTED' ? 'changes_requested' : 'commented';
    return [
      ...inline.map((c) => ({
        id: String(c.id),
        author: c.user?.login ?? 'unknown',
        body: c.body,
        kind: 'inline' as const,
        path: c.path,
        ...(c.line != null ? { line: c.line } : {}),
        createdAt: c.created_at,
        url: c.html_url,
      })),
      ...reviews
        .filter((r) => (r.body ?? '').trim() !== '' || r.state === 'CHANGES_REQUESTED')
        .map((r) => ({
          id: String(r.id),
          author: r.user?.login ?? 'unknown',
          body: r.body ?? '',
          kind: 'review' as const,
          verdict: verdict(r.state),
          createdAt: r.submitted_at,
          url: r.html_url,
        })),
      ...conversation.map((c) => ({
        id: String(c.id),
        author: c.user?.login ?? 'unknown',
        body: c.body,
        kind: 'conversation' as const,
        createdAt: c.created_at,
        url: c.html_url,
      })),
    ];
  }

  async getChangedFiles(id: string): Promise<ChangedFile[]> {
    const files = await this.paginate<{ filename: string; status: string; additions: number; deletions: number }>(
      `/repos/${this.repository}/pulls/${id}/files`,
      30,
    );
    return files.map((f) => ({
      path: f.filename,
      status: f.status === 'added' ? 'added' : f.status === 'removed' ? 'removed' : f.status === 'renamed' ? 'renamed' : 'modified',
      additions: f.additions,
      deletions: f.deletions,
    }));
  }

  async getMergedPullRequests(): Promise<PullRequest[]> {
    const pulls = await this.get<GhPull[]>(`/repos/${this.repository}/pulls?state=closed&per_page=100&sort=updated&direction=desc`);
    return pulls.filter((p) => p.merged_at).map((p) => this.toPullRequest(p));
  }
}
