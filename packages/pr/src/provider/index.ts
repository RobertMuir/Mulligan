import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { GitHubProvider } from '../github/index.js';
import { GitLabProvider } from '../gitlab/index.js';
import { PrProviderError, type PrPlatform, type PullRequestProvider } from './types.js';

export * from './types.js';

export interface ProviderSettings {
  platform: PrPlatform;
  repository: string;
  baseUrl?: string;
  /** Environment variable holding the token. Tokens never live in config files. */
  tokenEnv?: string;
}

export const DEFAULT_TOKEN_ENV: Record<PrPlatform, string> = {
  github: 'GITHUB_TOKEN',
  gitlab: 'GITLAB_TOKEN',
  bitbucket: 'BITBUCKET_TOKEN',
  'azure-devops': 'AZURE_DEVOPS_TOKEN',
};

/** Resolves a token from the environment, falling back to an authenticated `gh` CLI for GitHub. */
export async function resolveToken(settings: ProviderSettings): Promise<string | undefined> {
  const env = settings.tokenEnv ?? DEFAULT_TOKEN_ENV[settings.platform];
  const fromEnv = process.env[env] ?? (settings.platform === 'github' ? process.env.GH_TOKEN : undefined);
  if (fromEnv) return fromEnv;
  if (settings.platform === 'github') {
    try {
      const { stdout } = await promisify(execFile)('gh', ['auth', 'token']);
      return stdout.trim() || undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export async function createPullRequestProvider(settings: ProviderSettings, fetchImpl?: typeof fetch): Promise<PullRequestProvider> {
  const token = await resolveToken(settings);
  switch (settings.platform) {
    case 'github':
      return new GitHubProvider({ repository: settings.repository, token, baseUrl: settings.baseUrl, fetchImpl });
    case 'gitlab':
      return new GitLabProvider({ repository: settings.repository, token, baseUrl: settings.baseUrl, fetchImpl });
    case 'bitbucket':
    case 'azure-devops':
      throw new PrProviderError(
        `${settings.platform} is not implemented in this MVP yet. GitHub and GitLab are supported; ` +
          'other platforms plug in by implementing PullRequestProvider.',
      );
  }
}
