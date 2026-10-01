import os from 'node:os';
import path from 'node:path';

/** Spec §32. */
export interface CommandPolicy {
  command: string;
  allowed: boolean;
  requiresApproval: boolean;
  reason?: string;
  risk: 'safe' | 'approved' | 'unknown' | 'dangerous' | 'forbidden';
}

export interface PolicyContext {
  root: string;
  /** Commands the developer has explicitly approved in config (exact or prefix match). */
  approved: string[];
}

const FORBIDDEN: [RegExp, string][] = [
  [/\brm\s+(?:-\S+\s+)*(?:\/|\/\*|~|~\/|\$HOME)(?:\s|$)/, 'deletes the root or home directory'],
  [/--no-preserve-root/, 'disables root-deletion protection'],
  [/:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/, 'fork bomb'],
  [/\bmkfs(\.\w+)?\b|\bformat\s+[a-z]:/i, 'formats a filesystem'],
  [/\bdd\b[^|;&]*\bof=\/dev\/(?!null\b)/, 'writes directly to a device'],
  [/>\s*\/dev\/(sd[a-z]|nvme|disk)/, 'writes directly to a disk device'],
];

const DANGEROUS: [RegExp, string][] = [
  // Destructive filesystem operations
  [/\brm\s+(?:[^|;&]*\s)?-[a-zA-Z]*[rRf]/, 'recursive or forced delete'],
  [/\bRemove-Item\b.*-Recurse|\b(?:del|erase)\s+\/[sq]|\brmdir\s+\/s|\brd\s+\/s/i, 'recursive delete'],
  [/\bgit\s+push\b/, 'publishes to a remote'],
  [/\bgit\s+(?:reset\s+--hard|clean\s+-\S*f|checkout\s+--\s|restore\s+\.|branch\s+-D|stash\s+(?:drop|clear)|rebase|filter-branch|update-ref\s+-d)/, 'discards or rewrites git history/work'],
  // Database
  [/\b(?:prisma\s+migrate\s+(?:reset|deploy)|prisma\s+db\s+push|knex\s+migrate:(?:rollback|down)|sequelize\s+db:migrate:undo|typeorm\s+schema:drop|drizzle-kit\s+(?:push|drop))/, 'destructive or production database migration'],
  [/\b(?:drop\s+(?:table|database|schema)|truncate\s+table)\b/i, 'destructive SQL'],
  // Deployment and publishing
  [/\b(?:vercel\b.*--prod|netlify\s+deploy\b.*--prod|fly\s+deploy|firebase\s+deploy|eas\s+(?:submit|update)|kubectl\s+(?:apply|delete|rollout)|helm\s+(?:install|upgrade|uninstall)|terraform\s+(?:apply|destroy)|pulumi\s+(?:up|destroy)|serverless\s+deploy|cdk\s+deploy)/, 'production deployment'],
  [/\b(?:npm|pnpm|yarn)\s+publish\b/, 'publishes a package'],
  // Credentials and secrets
  [/(?:^|[\s/'"])\.env(?:\.[\w.-]+)?(?:$|[\s'"])/, 'reads or writes an environment/secret file'],
  [/\.ssh\b|\bid_(?:rsa|ed25519|ecdsa)\b|\.aws\/credentials|\.npmrc|\.netrc|\.kube\/config/, 'credential access'],
  [/^\s*(?:printenv|env|set|Get-ChildItem\s+env:)\s*$/i, 'dumps environment variables (may include secrets)'],
  [/\b(?:gh\s+auth\s+token|security\s+find-\w+-password|aws\s+configure|gcloud\s+auth\s+print)/, 'credential access'],
  [/\b(?:gh\s+secret\s+set|vercel\s+env\s+(?:add|rm)|kubectl\s+create\s+secret|aws\s+secretsmanager\s+put)/, 'secret modification'],
  // Privilege and remote code
  [/\b(?:sudo|su|doas|runas)\b/, 'privilege escalation'],
  [/\bchmod\s+(?:-R\s+)?[0-7]*7[0-7]{0,2}\b|\bchown\b/, 'permission change'],
  [/\b(?:curl|wget|iwr|Invoke-WebRequest)\b[^|]*\|\s*(?:sh|bash|zsh|node|python\d?|iex|Invoke-Expression)\b/i, 'executes code downloaded from the network'],
  // Dependency changes
  [/\b(?:npm\s+(?:install|i|add)\s+(?!-)\S|pnpm\s+add\b|yarn\s+add\b|bun\s+add\b|npx\s+--yes\b)/, 'installs a new package (supply-chain risk)'],
];

const SAFE: RegExp[] = [
  /^git\s+(?:status|diff|log|show|rev-parse|ls-files|blame|branch(?:\s+--show-current|\s+-a|\s+--list)?|remote\s+-v|merge-base|describe)\b/,
  /^git\s+apply\b(?=.*\s--check\b)/,
  /^(?:ls|dir|pwd|echo|cat|head|tail|wc|grep|rg|find|which|where)\b/,
  /^(?:node|npm|pnpm|yarn|npx|tsc|git)\s+(?:-v|--version)$/,
  /^(?:npx\s+)?tsc\b.*--noEmit\b/,
  /^(?:npx\s+)?(?:vitest\s+run|jest|eslint|prettier\s+--check|biome\s+(?:check|lint))\b/,
  /^(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:test|lint|typecheck|type-check|check|build)(?:\s|$)/,
  /^(?:npm\s+ci|pnpm\s+install\s+--frozen-lockfile|yarn\s+install\s+--frozen-lockfile)$/,
];

/** Splits a compound command into its parts (&&, ||, ;, |). */
export function splitCommand(command: string): string[] {
  return command
    .split(/\s*(?:&&|\|\||;|\|)\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function pathOutsideProject(part: string, root: string): string | undefined {
  const tokens = part.match(/(?:"[^"]*"|'[^']*'|\S)+/g) ?? [];
  for (const raw of tokens.slice(1)) {
    const token = raw.replace(/^['"]|['"]$/g, '').replace(/^--?[\w-]+=/, '');
    if (!token || token.startsWith('-') || /^[a-z]+:\/\//i.test(token) || token === '/dev/null' || token.toLowerCase() === 'nul') continue;
    const looksLikePath = token.startsWith('/') || token.startsWith('~') || /^[A-Za-z]:[\\/]/.test(token) || token.includes('..');
    if (!looksLikePath) continue;
    const expanded = token.startsWith('~') ? path.join(os.homedir(), token.slice(1)) : token;
    const resolved = path.resolve(root, expanded);
    const relative = path.relative(root, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) return token;
  }
  return undefined;
}

function isApproved(command: string, approved: string[]): boolean {
  return approved.some((a) => command === a || command.startsWith(`${a} `));
}

/**
 * Decides whether a command may run. Unknown commands need approval;
 * dangerous ones need approval with a stated reason; a few are never run.
 * Approval is per invocation — the policy never escalates on its own.
 */
export function evaluateCommand(command: string, context: PolicyContext): CommandPolicy {
  const trimmed = command.trim();
  for (const [pattern, reason] of FORBIDDEN) {
    if (pattern.test(trimmed)) return { command, allowed: false, requiresApproval: false, reason: `Refused: ${reason}.`, risk: 'forbidden' };
  }
  const dangers = DANGEROUS.filter(([pattern]) => pattern.test(trimmed)).map(([, reason]) => reason);
  for (const part of splitCommand(trimmed)) {
    const outside = pathOutsideProject(part, context.root);
    if (outside) dangers.push(`touches a path outside the project (${outside})`);
  }
  if (dangers.length > 0) {
    return { command, allowed: true, requiresApproval: true, reason: [...new Set(dangers)].join('; '), risk: 'dangerous' };
  }
  if (isApproved(trimmed, context.approved)) {
    return { command, allowed: true, requiresApproval: false, reason: 'On the project approved list.', risk: 'approved' };
  }
  const parts = splitCommand(trimmed);
  if (parts.length > 0 && parts.every((p) => SAFE.some((s) => s.test(p)) || isApproved(p, context.approved))) {
    return { command, allowed: true, requiresApproval: false, reason: 'Read-only or verification command.', risk: 'safe' };
  }
  return { command, allowed: true, requiresApproval: true, reason: 'Not on the approved list.', risk: 'unknown' };
}
