import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { ConfigError, configProblems } from './config-validation.js';
import { toPosix } from './files.js';
import { messageOf } from './json.js';
import type { ModelsConfig } from './models/types.js';

/** `.MulliganMem` lives at the project root, intentionally visible (spec §33). */
export const MEMORY_FILE = '.MulliganMem';
export const WORKSPACE_DIR = '.mulligan';

export const WORKSPACE_SUBDIRS = [
  'cookbook',
  'golden-pr',
  'golden-pr/examples',
  'verification',
  'architecture',
  'audit',
  'memory',
  'sessions',
] as const;

/**
 * Paths that stay local to the developer's machine.
 *
 * `.MulliganMem` is deliberately left out of version control: it is the
 * developer's own engineering memory for this project. Portability comes from
 * export/import instead. The verification rubric is private so that
 * implementations cannot be tuned to it. Memory history, sessions and audit
 * logs are machine-local. Cookbook, golden PRs, architecture and config are
 * team standards and are meant to be committed.
 */
export const LOCAL_ONLY_PATHS = [
  MEMORY_FILE,
  `${WORKSPACE_DIR}/verification/`,
  `${WORKSPACE_DIR}/memory/`,
  `${WORKSPACE_DIR}/sessions/`,
  `${WORKSPACE_DIR}/audit/`,
] as const;

const GITIGNORE_MARKER = '# Mulligan — local-only engineering memory and private verification';

export interface WorkspacePaths {
  root: string;
  memoryFile: string;
  workspace: string;
  config: string;
  cookbook: string;
  goldenPr: string;
  goldenExamples: string;
  verification: string;
  architecture: string;
  audit: string;
  memoryMeta: string;
  memoryHistory: string;
  sessions: string;
}

export function workspacePaths(root: string): WorkspacePaths {
  const ws = path.join(root, WORKSPACE_DIR);
  return {
    root,
    memoryFile: path.join(root, MEMORY_FILE),
    workspace: ws,
    config: path.join(ws, 'config.yaml'),
    cookbook: path.join(ws, 'cookbook'),
    goldenPr: path.join(ws, 'golden-pr'),
    goldenExamples: path.join(ws, 'golden-pr', 'examples'),
    verification: path.join(ws, 'verification'),
    architecture: path.join(ws, 'architecture'),
    audit: path.join(ws, 'audit'),
    memoryMeta: path.join(ws, 'memory'),
    memoryHistory: path.join(ws, 'memory', 'history.jsonl'),
    sessions: path.join(ws, 'sessions'),
  };
}

export type ProjectMode = 'standard' | 'safety';

export interface MulliganConfig {
  version: 1;
  project: { name: string };
  /** `safety` adds the stricter accountability review categories (spec §19). */
  mode: ProjectMode;
  models: ModelsConfig;
  verification: { commands: Record<string, string> };
  permissions: { approved: string[] };
  pr?: { platform: string; repository: string; baseUrl?: string; tokenEnv?: string };
  review: { baseBranch: string };
  loop: LoopConfig;
}

/** How the Mulligan loop fans out to several models (see @mulligan/orchestrator). */
export interface LoopConfig {
  fanout: {
    /** Fan out automatically when a task is at least this difficult. */
    auto: boolean;
    minDifficulty: number;
    /** Candidates per fan-out. */
    count: number;
    /** Apply each candidate in an isolated worktree and run the verification commands. */
    verify: boolean;
    /** Independent judge models scoring each candidate against the private rubric. */
    judges: number;
  };
}

export const DEFAULT_LOOP: LoopConfig = { fanout: { auto: true, minDifficulty: 60, count: 3, verify: true, judges: 1 } };

export function defaultConfig(projectName: string): MulliganConfig {
  return {
    version: 1,
    project: { name: projectName },
    mode: 'standard',
    models: {
      providers: {
        claude: { kind: 'anthropic', model: 'claude-opus-5-5', apiKeyEnv: 'ANTHROPIC_API_KEY' },
      },
      roles: {},
      default: 'claude',
    },
    verification: { commands: {} },
    permissions: { approved: [] },
    review: { baseBranch: 'main' },
    loop: DEFAULT_LOOP,
  };
}

const CONFIG_HEADER = `# Mulligan workspace configuration — "How does Mulligan operate?"
# API keys are read from environment variables (apiKeyEnv); never put keys in this file.
# models.roles assigns a provider to each role: architect, implementer, reviewer,
# verifier, teacher, technical-writer. Unassigned roles use models.default.
# models.routing.mode: auto picks a model per task from its difficulty (see /route).
# Local models: kind ollama | llamacpp | lmstudio | vllm (no key needed). /models discover finds them.
`;

export async function loadConfig(root: string): Promise<MulliganConfig> {
  const { config } = workspacePaths(root);
  const fallback = defaultConfig(path.basename(root));
  if (!existsSync(config)) return fallback;
  let raw: unknown;
  try {
    raw = YAML.parse(await readFile(config, 'utf8')) ?? {};
  } catch (error) {
    throw new ConfigError([`not valid YAML: ${messageOf(error)}`]);
  }
  // Untrusted until checked: the shape is asserted only for the merge, then validated as a whole.
  const parsed = raw as Partial<MulliganConfig>;
  const merged = {
    ...fallback,
    ...parsed,
    project: { ...fallback.project, ...parsed.project },
    models: { ...fallback.models, ...parsed.models },
    verification: { commands: { ...parsed.verification?.commands } },
    permissions: { approved: parsed.permissions?.approved ?? [] },
    review: { ...fallback.review, ...parsed.review },
    loop: { fanout: { ...DEFAULT_LOOP.fanout, ...parsed.loop?.fanout } },
  };
  const problems = configProblems(merged);
  if (problems.length) throw new ConfigError(problems);
  return merged;
}

export async function saveConfig(root: string, config: MulliganConfig): Promise<void> {
  const { config: file } = workspacePaths(root);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, CONFIG_HEADER + YAML.stringify(config), 'utf8');
}

/** Walks up from `start` to the nearest directory that looks like a project root. */
export function findProjectRoot(start: string): string {
  let dir = path.resolve(start);
  for (;;) {
    for (const marker of [WORKSPACE_DIR, MEMORY_FILE, '.git', 'package.json']) {
      if (existsSync(path.join(dir, marker))) return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return path.resolve(start);
    dir = parent;
  }
}

export function isWorkspaceInitialised(root: string): boolean {
  return existsSync(workspacePaths(root).workspace);
}

export interface InitResult {
  created: string[];
  gitignoreUpdated: boolean;
}

/**
 * Creates `.mulligan/` and the `.gitignore` entries. Never overwrites existing
 * files. `.MulliganMem` itself is created by the memory package on first save.
 */
export async function initWorkspace(root: string, projectName = path.basename(root)): Promise<InitResult> {
  const paths = workspacePaths(root);
  const created: string[] = [];
  for (const sub of WORKSPACE_SUBDIRS) {
    const dir = path.join(paths.workspace, sub);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
      created.push(toPosix(path.relative(root, dir)));
    }
  }
  if (!existsSync(paths.config)) {
    await saveConfig(root, defaultConfig(projectName));
    created.push(toPosix(path.relative(root, paths.config)));
  }
  const gitignoreUpdated = await ensureGitignore(root);
  return { created, gitignoreUpdated };
}

export async function ensureGitignore(root: string): Promise<boolean> {
  const file = path.join(root, '.gitignore');
  const current = existsSync(file) ? await readFile(file, 'utf8') : '';
  const existing = new Set(current.split(/\r?\n/).map((l) => l.trim()));
  const missing = LOCAL_ONLY_PATHS.filter((p) => !existing.has(p));
  if (missing.length === 0) return false;
  const prefix = current.length === 0 || current.endsWith('\n') ? '' : '\n';
  const header = existing.has(GITIGNORE_MARKER) ? '' : `\n${GITIGNORE_MARKER}\n`;
  await writeFile(file, `${current}${prefix}${header}${missing.join('\n')}\n`, 'utf8');
  return true;
}
