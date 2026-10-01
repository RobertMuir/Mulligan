import { spawn } from 'node:child_process';
import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { workspacePaths, type CommandOutcome, type CommandRunner } from '@mulligan/core';
import { evaluateCommand, type CommandPolicy, type PolicyContext } from './policy.js';

export type ApprovalPrompt = (policy: CommandPolicy, purpose?: string) => Promise<boolean>;

const MAX_OUTPUT = 2 * 1024 * 1024;

/** Runs commands only after the policy (and, where required, the human) allows it. Every decision is audited. */
export class PermissionedRunner implements CommandRunner {
  constructor(
    private readonly context: PolicyContext,
    private readonly approve: ApprovalPrompt,
  ) {}

  async run(command: string, options: { purpose?: string; timeoutMs?: number } = {}): Promise<CommandOutcome> {
    const policy = evaluateCommand(command, this.context);
    if (!policy.allowed) {
      await this.audit({ command, decision: 'denied', reason: policy.reason, purpose: options.purpose });
      return { status: 'denied', reason: policy.reason ?? 'Refused by policy.' };
    }
    if (policy.requiresApproval) {
      const approved = await this.approve(policy, options.purpose);
      await this.audit({ command, decision: approved ? 'approved-by-human' : 'declined-by-human', reason: policy.reason, purpose: options.purpose });
      if (!approved) return { status: 'declined', reason: policy.reason ?? 'Not approved.' };
    } else {
      await this.audit({ command, decision: 'allowed-by-policy', reason: policy.reason, purpose: options.purpose });
    }
    const outcome = await execute(command, this.context.root, options.timeoutMs ?? 10 * 60_000);
    await this.audit({ command, decision: 'completed', exitCode: outcome.exitCode, durationMs: outcome.durationMs });
    return outcome;
  }

  private async audit(entry: Record<string, unknown>): Promise<void> {
    const dir = workspacePaths(this.context.root).audit;
    try {
      await mkdir(dir, { recursive: true });
      await appendFile(path.join(dir, 'commands.jsonl'), JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n', 'utf8');
    } catch {
      // Auditing must never prevent the user from seeing a result.
    }
  }
}

function execute(command: string, cwd: string, timeoutMs: number): Promise<Extract<CommandOutcome, { status: 'completed' }>> {
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn(command, { cwd, shell: true, env: process.env, windowsHide: true });
    let stdout = '';
    let stderr = '';
    const cap = (s: string, chunk: Buffer): string => (s.length > MAX_OUTPUT ? s : s + chunk.toString('utf8'));
    child.stdout.on('data', (c: Buffer) => (stdout = cap(stdout, c)));
    child.stderr.on('data', (c: Buffer) => (stderr = cap(stderr, c)));
    const timer = setTimeout(() => {
      stderr += `\n[mulligan] Timed out after ${Math.round(timeoutMs / 1000)}s.`;
      child.kill();
    }, timeoutMs);
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ status: 'completed', exitCode: 127, stdout, stderr: `${stderr}${error.message}`, durationMs: Date.now() - started });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ status: 'completed', exitCode: code ?? 1, stdout, stderr, durationMs: Date.now() - started });
    });
  });
}
