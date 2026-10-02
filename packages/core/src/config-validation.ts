import { AGENT_ROLES, PROVIDER_KINDS, isAgentRole, isProviderKind } from './models/types.js';

export class ConfigError extends Error {
  override name = 'ConfigError';
  constructor(readonly problems: string[]) {
    super(`.mulligan/config.yaml has ${problems.length} problem${problems.length === 1 ? '' : 's'}:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  }
}

type Raw = Record<string, unknown>;
const isObject = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const inRange = (v: unknown, lo: number, hi: number): boolean => typeof v === 'number' && v >= lo && v <= hi;

/**
 * Checks a merged configuration once, where it enters the system, so the
 * rest of Mulligan can trust its types. Every problem is reported at once.
 */
export function configProblems(config: unknown): string[] {
  const problems: string[] = [];
  if (!isObject(config)) return ['the file must contain a YAML mapping'];

  if (config.mode !== 'standard' && config.mode !== 'safety') problems.push(`mode must be "standard" or "safety" (got ${JSON.stringify(config.mode)})`);

  const models = config.models;
  if (!isObject(models) || !isObject(models.providers)) {
    problems.push('models.providers must be a mapping of provider names to settings');
    return problems;
  }
  const names = new Set(Object.keys(models.providers));
  for (const [name, p] of Object.entries(models.providers)) {
    const at = `models.providers.${name}`;
    if (!isObject(p)) {
      problems.push(`${at} must be a mapping`);
      continue;
    }
    if (!isProviderKind(p.kind)) problems.push(`${at}.kind must be one of ${PROVIDER_KINDS.join(', ')} (got ${JSON.stringify(p.kind)})`);
    if (typeof p.model !== 'string') problems.push(`${at}.model must be text`);
    if (p.capability !== undefined && !inRange(p.capability, 1, 5)) problems.push(`${at}.capability must be a number from 1 to 5`);
    if (p.cost !== undefined && !inRange(p.cost, 0, 5)) problems.push(`${at}.cost must be a number from 0 to 5`);
    for (const key of ['apiKeyEnv', 'baseUrl'] as const) {
      if (p[key] !== undefined && typeof p[key] !== 'string') problems.push(`${at}.${key} must be text`);
    }
  }
  const mustExist = (name: unknown, at: string): void => {
    if (typeof name !== 'string' || !names.has(name)) problems.push(`${at} refers to "${String(name)}", which is not defined under models.providers`);
  };
  if (models.default !== undefined) mustExist(models.default, 'models.default');
  if (models.roles !== undefined) {
    if (!isObject(models.roles)) problems.push('models.roles must be a mapping');
    else {
      for (const [role, name] of Object.entries(models.roles)) {
        if (!isAgentRole(role)) problems.push(`models.roles.${role} is not a role (roles: ${AGENT_ROLES.join(', ')})`);
        mustExist(name, `models.roles.${role}`);
      }
    }
  }
  const routing = models.routing;
  if (routing !== undefined) {
    if (!isObject(routing)) problems.push('models.routing must be a mapping');
    else {
      if (routing.mode !== 'manual' && routing.mode !== 'auto') problems.push('models.routing.mode must be "manual" or "auto"');
      if (routing.pinned !== undefined && !(Array.isArray(routing.pinned) && routing.pinned.every(isAgentRole))) {
        problems.push(`models.routing.pinned must list roles (${AGENT_ROLES.join(', ')})`);
      }
      if (routing.pool !== undefined) {
        if (!Array.isArray(routing.pool)) problems.push('models.routing.pool must be a list of provider names');
        else routing.pool.forEach((n, i) => mustExist(n, `models.routing.pool[${i}]`));
      }
      if (routing.weights !== undefined && !(isObject(routing.weights) && Object.values(routing.weights).every((v) => typeof v === 'number'))) {
        problems.push('models.routing.weights must map factor names to numbers');
      }
    }
  }

  const commands = isObject(config.verification) ? config.verification.commands : undefined;
  if (!isObject(commands) || !Object.values(commands).every((c) => typeof c === 'string')) {
    problems.push('verification.commands must map names to command strings');
  }
  const approved = isObject(config.permissions) ? config.permissions.approved : undefined;
  if (!Array.isArray(approved) || !approved.every((c) => typeof c === 'string')) problems.push('permissions.approved must be a list of commands');

  const fanout = isObject(config.loop) ? config.loop.fanout : undefined;
  if (!isObject(fanout)) problems.push('loop.fanout must be a mapping');
  else {
    if (typeof fanout.auto !== 'boolean') problems.push('loop.fanout.auto must be true or false');
    if (typeof fanout.verify !== 'boolean') problems.push('loop.fanout.verify must be true or false');
    if (!inRange(fanout.minDifficulty, 0, 100)) problems.push('loop.fanout.minDifficulty must be a number from 0 to 100');
    if (!(Number.isInteger(fanout.count) && inRange(fanout.count, 1, 8))) problems.push('loop.fanout.count must be a whole number from 1 to 8');
    if (!(Number.isInteger(fanout.judges) && inRange(fanout.judges, 0, 5))) problems.push('loop.fanout.judges must be a whole number from 0 to 5');
  }
  const delegation = isObject(config.loop) ? config.loop.delegation : undefined;
  if (!isObject(delegation)) problems.push('loop.delegation must be a mapping');
  else {
    if (delegation.mode !== 'auto' && delegation.mode !== 'ask' && delegation.mode !== 'off') problems.push(`loop.delegation.mode must be "auto", "ask" or "off" (got ${JSON.stringify(delegation.mode)})`);
    if (!(Number.isInteger(delegation.maxWorkers) && inRange(delegation.maxWorkers, 1, 8))) problems.push('loop.delegation.maxWorkers must be a whole number from 1 to 8');
    if (typeof delegation.workerModel !== 'string' || delegation.workerModel.trim() === '') problems.push('loop.delegation.workerModel must be a model name');
  }
  return problems;
}
