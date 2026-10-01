import { getJson } from '../provider/http.js';
import type { ChangedFile, PullRequest, PullRequestProvider, ReviewComment } from '../provider/types.js';

interface GlMergeRequest {
  iid: number;
  web_url: string;
  title: string;
  description: string | null;
  author: { username: string } | null;
  state: 'opened' | 'closed' | 'merged' | 'locked';
  created_at: string;
  merged_at: string | null;
  target_branch: string;
  source_branch: string;
  labels: string[];
}

interface GlDiff {
  new_path: string;
  new_file: boolean;
  deleted_file: boolean;
  renamed_file: boolean;
  diff: string;
}

export interface GitLabOptions {
  /** Full project path, e.g. "group/subgroup/project". */
  repository: string;
  token?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

function countDiff(diff: string): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  for (const line of diff.split('\n')) {
    if (line.startsWith('+') && !line.startsWith('+++')) additions++;
    else if (line.startsWith('-') && !line.startsWith('---')) deletions++;
  }
  return { additions, deletions };
}

export class GitLabProvider implements PullRequestProvider {
  readonly platform = 'gitlab' as const;
  readonly repository: string;
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly fetchImpl: typeof fetch;

  constructor(options: GitLabOptions) {
    this.repository = options.repository;
    this.baseUrl = options.baseUrl ?? 'https://gitlab.com/api/v4';
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.headers = options.token ? { 'private-token': options.token } : {};
  }

  private get project(): string {
    return `/projects/${encodeURIComponent(this.repository)}`;
  }

  private get<T>(path: string): Promise<T> {
    return getJson<T>(`${this.baseUrl}${path}`, this.headers, this.fetchImpl);
  }

  private async diffs(iid: string): Promise<GlDiff[]> {
    const out: GlDiff[] = [];
    for (let page = 1; page <= 30; page++) {
      const batch = await this.get<GlDiff[]>(`${this.project}/merge_requests/${iid}/diffs?per_page=100&page=${page}`);
      out.push(...batch);
      if (batch.length < 100) break;
    }
    return out;
  }

  private toPullRequest(mr: GlMergeRequest, stats?: { additions: number; deletions: number; files: number }): PullRequest {
    return {
      id: String(mr.iid),
      platform: 'gitlab',
      repository: this.repository,
      url: mr.web_url,
      title: mr.title,
      body: mr.description ?? '',
      author: mr.author?.username ?? 'unknown',
      state: mr.state === 'merged' ? 'merged' : mr.state === 'opened' ? 'open' : 'closed',
      createdAt: mr.created_at,
      ...(mr.merged_at ? { mergedAt: mr.merged_at } : {}),
      baseBranch: mr.target_branch,
      headBranch: mr.source_branch,
      additions: stats?.additions ?? 0,
      deletions: stats?.deletions ?? 0,
      changedFiles: stats?.files ?? 0,
      labels: mr.labels,
    };
  }

  async connect(): Promise<void> {
    await this.get(this.project);
  }

  async listPullRequests(repository: string = this.repository): Promise<PullRequest[]> {
    const mrs = await this.get<GlMergeRequest[]>(`/projects/${encodeURIComponent(repository)}/merge_requests?state=all&per_page=50`);
    return mrs.map((mr) => this.toPullRequest(mr));
  }

  async getPullRequest(id: string): Promise<PullRequest> {
    const [mr, diffs] = await Promise.all([this.get<GlMergeRequest>(`${this.project}/merge_requests/${id}`), this.diffs(id)]);
    const totals = diffs.map((d) => countDiff(d.diff)).reduce((a, b) => ({ additions: a.additions + b.additions, deletions: a.deletions + b.deletions }), { additions: 0, deletions: 0 });
    return this.toPullRequest(mr, { ...totals, files: diffs.length });
  }

  async getReviewComments(id: string): Promise<ReviewComment[]> {
    const notes = await this.get<
      { id: number; body: string; author: { username: string } | null; system: boolean; created_at: string; position?: { new_path?: string; new_line?: number } }[]
    >(`${this.project}/merge_requests/${id}/notes?per_page=100`);
    return notes
      .filter((n) => !n.system)
      .map((n) => ({
        id: String(n.id),
        author: n.author?.username ?? 'unknown',
        body: n.body,
        kind: n.position ? ('inline' as const) : ('conversation' as const),
        ...(n.position?.new_path ? { path: n.position.new_path } : {}),
        ...(n.position?.new_line ? { line: n.position.new_line } : {}),
        createdAt: n.created_at,
      }));
  }

  async getChangedFiles(id: string): Promise<ChangedFile[]> {
    return (await this.diffs(id)).map((d) => ({
      path: d.new_path,
      status: d.new_file ? 'added' : d.deleted_file ? 'removed' : d.renamed_file ? 'renamed' : 'modified',
      ...countDiff(d.diff),
    }));
  }

  async getMergedPullRequests(): Promise<PullRequest[]> {
    const mrs = await this.get<GlMergeRequest[]>(`${this.project}/merge_requests?state=merged&per_page=100`);
    return mrs.map((mr) => this.toPullRequest(mr));
  }
}
