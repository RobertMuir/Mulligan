/**
 * Executes shell commands on behalf of Mulligan. Implementations must apply
 * the permission policy; the bot's PermissionedRunner is the reference one.
 */
export interface CommandRunner {
  run(command: string, options?: { purpose?: string; timeoutMs?: number }): Promise<CommandOutcome>;
}

export type CommandOutcome =
  | { status: 'completed'; exitCode: number; stdout: string; stderr: string; durationMs: number }
  | { status: 'denied'; reason: string }
  | { status: 'declined'; reason: string };
