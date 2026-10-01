export const PR_PLATFORMS = ['github', 'gitlab', 'bitbucket', 'azure-devops'] as const;
export type PrPlatform = (typeof PR_PLATFORMS)[number];

export interface PullRequest {
  id: string;
  platform: PrPlatform;
  repository: string;
  url: string;
  title: string;
  body: string;
  author: string;
  state: 'open' | 'merged' | 'closed';
  createdAt: string;
  mergedAt?: string;
  baseBranch: string;
  headBranch: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  commits?: number;
  labels: string[];
}

export interface ReviewComment {
  id: string;
  author: string;
  body: string;
  kind: 'inline' | 'review' | 'conversation';
  /** For `review` kind: the reviewer's verdict. */
  verdict?: 'approved' | 'changes_requested' | 'commented';
  path?: string;
  line?: number;
  createdAt: string;
  url?: string;
}

export interface ChangedFile {
  path: string;
  status: 'added' | 'modified' | 'removed' | 'renamed';
  additions: number;
  deletions: number;
}

/** Spec §14. Mulligan never assumes GitHub. */
export interface PullRequestProvider {
  readonly platform: PrPlatform;
  readonly repository: string;
  connect(): Promise<void>;
  listPullRequests(repository: string): Promise<PullRequest[]>;
  getPullRequest(id: string): Promise<PullRequest>;
  getReviewComments(id: string): Promise<ReviewComment[]>;
  getChangedFiles(id: string): Promise<ChangedFile[]>;
  getMergedPullRequests(): Promise<PullRequest[]>;
}

export class PrProviderError extends Error {
  override name = 'PrProviderError';
}

export interface PullRequestRef {
  platform: PrPlatform;
  repository: string;
  id: string;
  host: string;
}

/** How each platform shapes a pull request URL. `repository` and `id` are named groups. */
const PR_URL_FORMATS: { platform: PrPlatform; host?: RegExp; path: RegExp }[] = [
  { platform: 'github', host: /github/, path: /^\/(?<repository>[^/]+\/[^/]+)\/pull\/(?<id>\d+)/ },
  { platform: 'gitlab', path: /^\/(?<repository>.+?)\/-\/merge_requests\/(?<id>\d+)/ },
  { platform: 'bitbucket', host: /bitbucket/, path: /^\/(?<repository>[^/]+\/[^/]+)\/pull-requests\/(?<id>\d+)/ },
  { platform: 'azure-devops', path: /^\/(?<repository>[^/]+\/[^/]+\/_git\/[^/]+)\/pullrequest\/(?<id>\d+)/ },
];

/** Parses a PR/MR URL from any supported platform. */
export function parsePullRequestUrl(input: string): PullRequestRef | undefined {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return undefined;
  }
  const pathname = url.pathname.replace(/\/+$/, '');
  for (const format of PR_URL_FORMATS) {
    if (format.host && !format.host.test(url.host)) continue;
    const { repository, id } = format.path.exec(pathname)?.groups ?? {};
    if (repository && id) {
      // Azure DevOps addresses a repository as org/project/repo.
      return { platform: format.platform, repository: repository.replace('/_git/', '/'), id, host: url.host };
    }
  }
  return undefined;
}
