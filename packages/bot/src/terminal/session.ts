import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import {
  ConfiguredModelRouter,
  ModelRoutingError,
  currentBranch,
  isProviderReady,
  loadConfig,
  workspacePaths,
  type AgentRole,
  type ChatMessage,
  type ModelProvider,
  type MulliganConfig,
  type TaskContext,
} from '@mulligan/core';
import { dim } from '@mulligan/mascot';
import type { FanOutResult, ProposedChange } from '@mulligan/orchestrator';
import { PermissionedRunner } from '../permissions/runner.js';
import type { Io } from './io.js';

export interface Attempt {
  n: number;
  task: string;
  role: AgentRole;
  model: string;
  response: string;
  file: string;
  change?: ProposedChange;
  /** A git-generated diff, when the attempt came from a verified fan-out candidate. */
  diff?: string;
}

/** State for one Mulligan Bot session. */
export class Session {
  readonly id = new Date().toISOString().replace(/[:.]/g, '-');
  config!: MulliganConfig;
  router!: ConfiguredModelRouter;
  runner!: PermissionedRunner;
  branch?: string;
  history: ChatMessage[] = [];
  attempts: Attempt[] = [];
  /** Mulligan taken on the current task — drives escalation in auto routing. */
  Mulligan = 0;
  lastFanOut?: FanOutResult;

  constructor(
    readonly root: string,
    readonly io: Io,
  ) {}

  async load(): Promise<this> {
    this.config = await loadConfig(this.root);
    this.router = new ConfiguredModelRouter(this.config.models);
    this.runner = this.runnerFor(this.root);
    this.branch = await currentBranch(this.root);
    return this;
  }

  /** A permission-checked runner rooted at `cwd` (the project, or a candidate sandbox). */
  runnerFor(cwd: string): PermissionedRunner {
    return new PermissionedRunner({ root: cwd, approved: this.config.permissions.approved }, async (policy, purpose) => {
      this.io.print();
      this.io.print(`Mulligan wants to run: ${policy.command}`);
      if (purpose) this.io.print(`Purpose: ${purpose}`);
      this.io.print(`Why approval is needed: ${policy.reason}`);
      return this.io.confirm('Allow this once?');
    });
  }

  get sessionDir(): string {
    return path.join(workspacePaths(this.root).sessions, this.id);
  }

  taskContext(description: string): TaskContext {
    return { description, attempts: this.Mulligan, safetyMode: this.config.mode === 'safety' };
  }

  /** The model for a role and task, or undefined (with an explanation printed) when none is usable. */
  async model(role: AgentRole, task = ''): Promise<ModelProvider | undefined> {
    return this.resolve(role, task, true);
  }

  /** The model for a role if one is ready; silent otherwise. */
  async optionalModel(role: AgentRole, task = ''): Promise<ModelProvider | undefined> {
    return this.resolve(role, task, false);
  }

  private resolve(role: AgentRole, task: string, explain: boolean): ModelProvider | undefined {
    const say = (message: string): undefined => {
      if (explain) this.io.print(message);
      return undefined;
    };
    let decision;
    try {
      decision = this.router.decide(role, this.taskContext(task));
    } catch (error) {
      if (error instanceof ModelRoutingError) return say(error.message);
      throw error;
    }
    const config = this.config.models.providers[decision.provider];
    if (!config || !isProviderReady(config)) {
      return say(`Model "${decision.provider}" is not ready — check its model name and API key environment variable (/models).`);
    }
    if (explain && decision.mode === 'auto') this.io.print(dim(`route: ${decision.reason}`));
    return this.router.provider(decision.provider);
  }

  async log(event: Record<string, unknown>): Promise<void> {
    try {
      await mkdir(this.sessionDir, { recursive: true });
      await appendFile(path.join(this.sessionDir, 'transcript.jsonl'), JSON.stringify({ at: new Date().toISOString(), ...event }) + '\n', 'utf8');
    } catch {
      // Logging is best-effort.
    }
  }
}
