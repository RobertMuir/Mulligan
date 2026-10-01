import { existsSync } from 'node:fs';
import {
  AGENT_ROLES,
  LOCAL_ONLY_PATHS,
  PROVIDER_KINDS,
  discoverLocalModels,
  estimateCapability,
  estimateCost,
  initWorkspace,
  isAgentRole,
  isLocal,
  isProviderKind,
  isProviderReady,
  saveConfig,
  workspacePaths,
} from '@mulligan/core';
import { loadCookbook } from '@mulligan/cookbook';
import { loadMemory, saveMemory } from '@mulligan/memory';
import { dim, green } from '@mulligan/mascot';
import { ensureRubric, rubricPath } from '@mulligan/orchestrator';
import { loadGoldenPrs } from '@mulligan/pr';
import { evaluateCommand } from '../../permissions/policy.js';
import { heading } from '../io.js';
import type { Session } from '../session.js';
import type { Command } from './types.js';

export const initCommand: Command = {
  name: 'setup-mulligan',
  aliases: ['init'],
  summary: 'Create the .mulligan/ workspace and .MulliganMem for this project',
  async run(session) {
    const result = await initWorkspace(session.root, session.config.project.name);
    const paths = workspacePaths(session.root);
    if (!existsSync(paths.memoryFile)) {
      await saveMemory(session.root, await loadMemory(session.root));
      result.created.push('.MulliganMem');
    }
    const rubric = rubricPath(session.root);
    if (!existsSync(rubric)) {
      await ensureRubric(session.root);
      result.created.push('.mulligan/verification/rubric.yaml (private)');
    }
    session.io.print(result.created.length ? `Created: ${result.created.join(', ')}` : 'Workspace already set up.');
    if (result.gitignoreUpdated) {
      session.io.print(`Added to .gitignore (kept local): ${LOCAL_ONLY_PATHS.join(', ')}`);
    }
    session.io.print(dim('Next: /models to connect models, /setup-mulligan-cookbook, /setup-mulligan-pr.'));
    await session.load();
  },
};

export const statusCommand: Command = {
  name: 'status',
  summary: 'Project, models, memory, cookbook and golden PR status',
  async run(session) {
    const { io, root, config } = session;
    const [memory, cookbook, golden] = await Promise.all([
      loadMemory(root),
      loadCookbook(root).catch((e: Error) => ({ files: [], rules: [], error: e.message })),
      loadGoldenPrs(root),
    ]);
    io.print(heading('STATUS'));
    io.print(`Project:   ${config.project.name}${config.mode === 'safety' ? ' (Safety mode)' : ''}`);
    io.print(`Branch:    ${session.branch ?? '(no git branch)'}`);
    io.print(`Memory:    ${memory.principles.length} principle(s), ${memory.candidates.length} candidate(s) awaiting you`);
    io.print(`Cookbook:  ${cookbook.rules.length} rule(s)${'error' in cookbook ? ` — ${cookbook.error}` : ''}`);
    io.print(`Golden PR: ${golden.metadata ? `${golden.metadata.examples.length} example(s), ${golden.principles.length} pattern(s)` : 'not set up'}`);
    io.print(`PR:        ${config.pr ? `${config.pr.platform}:${config.pr.repository}` : 'not connected'}`);
    io.print();
    await modelsCommand.run(session, '');
  },
};

const MODELS_USAGE = [
  '/models                                         list models, roles and routing',
  '/models add <name> <kind> <model> [apiKeyEnv] [baseUrl]',
  `      kinds: ${PROVIDER_KINDS.join(', ')}`,
  '/models discover                                find local models (Ollama, llama.cpp, LM Studio, vLLM)',
  '/models assign <role> <name>                    manual role assignment',
  '/models default <name>',
  '/models routing auto|manual [--prefer-local]    auto = pick a model per task by difficulty',
  '/models capability <name> <1-5>                 override how capable auto routing thinks a model is',
].join('\n');

async function discover(session: Session): Promise<boolean> {
  const { io, config } = session;
  io.print(dim('Looking for local model servers…'));
  const found = await discoverLocalModels();
  if (found.length === 0) {
    io.print('No local model servers found. Start Ollama (`ollama serve`), llama.cpp (`llama-server`), LM Studio or vLLM, then try again.');
    return false;
  }
  let changed = false;
  for (const m of found) {
    const name = `${m.kind}-${m.model}`.toLowerCase().replace(/[^a-z0-9.-]+/g, '-').replace(/-+$/, '');
    const known = Object.values(config.models.providers).some((p) => p.kind === m.kind && p.model === m.model);
    const capability = estimateCapability({ kind: m.kind, model: `${m.model} ${m.size ?? ''}` });
    io.print(`  ${known ? green('✓') : '+'} ${m.kind.padEnd(9)} ${m.model}${m.size ? ` (${m.size})` : ''} · estimated capability ${capability}`);
    if (!known && (await io.confirm(`    Add as "${name}"?`, true))) {
      config.models.providers[name] = { kind: m.kind, model: m.model, ...(m.size ? { capability } : {}) };
      config.models.default ??= name;
      changed = true;
    }
  }
  return changed;
}

export const modelsCommand: Command = {
  name: 'models',
  summary: 'Show, add, discover and route models (cloud and local)',
  usage: MODELS_USAGE,
  async run(session, args) {
    const { io, config } = session;
    const [sub, ...rest] = args.trim().split(/\s+/).filter(Boolean);
    if (sub === 'help') return io.print(MODELS_USAGE);
    if (sub === 'discover') {
      if (!(await discover(session))) return;
    } else if (sub === 'routing') {
      const [mode] = rest;
      if (mode !== 'auto' && mode !== 'manual') return io.print('Usage: /models routing auto|manual [--prefer-local]');
      config.models.routing = { ...config.models.routing, mode, ...(rest.includes('--prefer-local') ? { preferLocal: true } : {}) };
    } else if (sub === 'capability') {
      const [name = '', value] = rest;
      const provider = config.models.providers[name];
      const n = Number(value);
      if (!provider || !(n >= 1 && n <= 5)) return io.print('Usage: /models capability <name> <1-5>');
      provider.capability = n;
    } else if (sub === 'add') {
      const [name, kind, model, apiKeyEnv, baseUrl] = rest;
      if (!name || !model || !isProviderKind(kind)) {
        return io.print(`Usage: /models add <name> <${PROVIDER_KINDS.join('|')}> <model> [apiKeyEnv] [baseUrl]`);
      }
      config.models.providers[name] = { kind, model, ...(apiKeyEnv ? { apiKeyEnv } : {}), ...(baseUrl ? { baseUrl } : {}) };
      config.models.default ??= name;
    } else if (sub === 'assign') {
      const [role, name] = rest;
      if (!name || !isAgentRole(role)) return io.print(`Usage: /models assign <${AGENT_ROLES.join('|')}> <name>`);
      if (!config.models.providers[name]) return io.print(`No model named "${name}". Add it first with /models add.`);
      config.models.roles = { ...config.models.roles, [role]: name };
    } else if (sub === 'default') {
      const [name] = rest;
      if (!name || !config.models.providers[name]) return io.print('Usage: /models default <name>');
      config.models.default = name;
    }
    if (sub) {
      await saveConfig(session.root, config);
      await session.load();
    }

    io.print(heading('MODELS'));
    for (const [name, p] of Object.entries(session.config.models.providers)) {
      const meta = `capability ${estimateCapability(p)} · cost ${estimateCost(p)}${isLocal(p) ? ' · local' : ''}`;
      io.print(
        `  ${isProviderReady(p) ? green('✓') : '✗'} ${name.padEnd(14)} ${p.kind} · ${p.model || '(model not set)'} ${dim(`· ${meta}`)}${p.apiKeyEnv ? dim(` · key from $${p.apiKeyEnv}`) : ''}`,
      );
    }
    const routing = session.config.models.routing;
    io.print(heading(`ROUTING: ${(routing?.mode ?? 'manual').toUpperCase()}`));
    if (routing?.mode === 'auto') {
      io.print('  Each task gets the cheapest ready model capable of its difficulty; Mulligan escalate. /route <task> shows the decision.');
      if (routing.pinned?.length) io.print(`  Pinned roles: ${routing.pinned.join(', ')}`);
      if (routing.preferLocal) io.print('  Local models are preferred whenever they are capable enough.');
    } else {
      const assignments = session.router.assignments();
      for (const role of AGENT_ROLES) io.print(`  ${role.padEnd(17)} → ${assignments[role] ?? dim('(unassigned)')}`);
      io.print(dim(session.router.isSingleModel() ? 'Single-model mode. /models routing auto picks per task.' : 'Multi-model mode.'));
    }
    const f = session.config.loop.fanout;
    io.print(dim(`Fan-out: ${f.auto ? `automatic at difficulty ≥ ${f.minDifficulty}` : 'manual (/fanout)'}, ${f.count} candidates, ${f.judges} judge(s), verify ${f.verify ? 'on' : 'off'}.`));
  },
};

export const permissionsCommand: Command = {
  name: 'permissions',
  summary: 'Show approved commands, approve one, or check how a command would be treated',
  usage: '/permissions · /permissions approve <command> · /permissions check <command>',
  async run(session, args) {
    const { io, config } = session;
    const [, action, command = ''] = /^(approve|check)\s+(.+)$/.exec(args.trim()) ?? [];
    if (action === 'check') {
      const policy = evaluateCommand(command, { root: session.root, approved: config.permissions.approved });
      return io.print(`${policy.allowed ? (policy.requiresApproval ? '⚠ needs approval' : '✓ allowed') : '✗ refused'} — ${policy.reason ?? ''} [${policy.risk}]`);
    }
    if (action === 'approve') {
      const policy = evaluateCommand(command, { root: session.root, approved: [] });
      if (!policy.allowed) return io.print(`Cannot approve: ${policy.reason}`);
      if (policy.risk === 'dangerous') return io.print(`Dangerous commands are approved per use, never permanently (${policy.reason}).`);
      config.permissions.approved = [...new Set([...config.permissions.approved, command.trim()])];
      await saveConfig(session.root, config);
      await session.load();
      io.print(`Approved: ${command}`);
      return;
    }
    io.print(heading('APPROVED COMMANDS'));
    if (config.permissions.approved.length === 0) io.print(dim('  (none beyond the built-in read-only and verification commands)'));
    for (const c of config.permissions.approved) io.print(`  ${c}`);
    io.print(dim('Everything else asks first. Dangerous operations always ask, every time.'));
  },
};

export const coreCommands = [initCommand, statusCommand, modelsCommand, permissionsCommand];
