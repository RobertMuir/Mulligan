import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  AGENT_ROLES,
  ConfiguredModelRouter,
  SOURCE_GLOBS,
  assessDifficulty,
  discoverLocalModels,
  findProjectRoot,
  formatDifficulty,
  gatherCodeContext,
  loadConfig,
  messageOf,
  readSourceFiles,
  renderCodeContext,
  walkProject,
  type CommandRunner,
} from '@mulligan/core';
import { PermissionedRunner, buildEngineeringContext } from '@mulligan/bot';
import { evaluateCookbook, formatViolation, loadCookbook, sortViolations } from '@mulligan/cookbook';
import { MEMORY_SOURCES, describeProvenance, formatMemReview, loadMemory, saveMemory } from '@mulligan/memory';
import { fanOut, formatFanOut, loadRubric } from '@mulligan/orchestrator';
import { formatReport, runFullMemoryReview, runMulliganReview } from '@mulligan/review';
import { z } from 'zod';

export const SERVER_INSTRUCTIONS = [
  'Mulligan: a human-in-the-loop engineering engine for this project.',
  'The developer is the senior engineer and final decision-maker.',
  'Never call memory_decide unless the developer has just told you, in this conversation, to accept, reject or reword that specific lesson.',
  'Present fan-out rankings and reviews as input to the developer\'s decision, not as decisions.',
].join(' ');

const text = (t: string) => ({ content: [{ type: 'text' as const, text: t }] });

/**
 * Over MCP there is no terminal to ask in, so a command that would need
 * approval is declined. Only commands the developer pre-approved in
 * .mulligan/config.yaml (or read-only ones) ever run.
 */
function nonInteractiveRunner(cwd: string, approved: string[]): CommandRunner {
  return new PermissionedRunner({ root: cwd, approved }, async () => false);
}

export function resolveRoot(explicit?: string): string {
  return findProjectRoot(explicit ?? process.env.MULLIGAN_PROJECT_ROOT ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd());
}

export function createMulliganerver(defaultRoot?: string): McpServer {
  const server = new McpServer({ name: 'Mulligan', version: '0.1.0' }, { instructions: SERVER_INSTRUCTIONS });
  const rootOf = (r?: string) => resolveRoot(r ?? defaultRoot);
  const rootArg = z.string().optional().describe('Project root. Defaults to the current project.');

  server.registerTool(
    'mulligan_review',
    {
      title: 'Mulligan Review',
      description:
        'Review the current changes (or the whole codebase) against the Karpathy principles, the project cookbook, Mulligan Memory, golden PR patterns, security, blast radius and verification. Returns evidence-backed findings and what was not verified. Never a score.',
      inputSchema: {
        root: rootArg,
        task: z.string().optional().describe('What the change is meant to do (enables Think Before Coding and goal checks).'),
        description: z.string().optional().describe('Draft PR description.'),
        base: z.string().optional().describe('Base branch (default from config).'),
        all: z.boolean().optional().describe('Review the whole codebase instead of the current changes.'),
        scope: z.array(z.string()).optional().describe('Globs for the intended scope.'),
        verbose: z.boolean().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      const root = rootOf(args.root);
      const config = await loadConfig(root);
      const report = await runMulliganReview({
        root,
        ...(args.task ? { task: args.task } : {}),
        ...(args.description ? { description: args.description } : {}),
        ...(args.base ? { base: args.base } : {}),
        all: args.all ?? false,
        ...(args.scope ? { scope: args.scope } : {}),
        runner: nonInteractiveRunner(root, config.permissions.approved),
      });
      return text(formatReport(report, { verbose: args.verbose ?? false }));
    },
  );

  server.registerTool(
    'mulligan_mem_review',
    {
      title: 'MulliganMem Review',
      description: 'Compare Mulligan Memory with what the codebase actually shows: strengths, gaps with file:line evidence, and a step-by-step upskilling plan.',
      inputSchema: { root: rootArg },
      annotations: { readOnlyHint: true },
    },
    async (args) => text(formatMemReview(await runFullMemoryReview(rootOf(args.root)))),
  );

  server.registerTool(
    'memory_list',
    {
      title: 'List Mulligan Memory',
      description: 'List the learned engineering principles in .MulliganMem, with provenance. These are learned preferences, not absolute rules.',
      inputSchema: { root: rootArg, include_candidates: z.boolean().optional() },
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      const store = await loadMemory(rootOf(args.root));
      const lines = store.principles.map((p) => `${p.id} [${p.category}] ${p.rule}\n  ${p.confidence} confidence · ${describeProvenance(p)}`);
      if (args.include_candidates) {
        lines.push('', 'CANDIDATES (awaiting the developer):', ...store.candidates.map((c) => `${c.id} ${c.rule}\n  ${describeProvenance(c)}`));
      }
      return text(lines.join('\n') || 'Mulligan Memory is empty.');
    },
  );

  server.registerTool(
    'memory_propose',
    {
      title: 'Propose a lesson',
      description:
        'Propose a lesson for Mulligan Memory from a decision the developer made. It is stored as a candidate only; the developer must confirm it. Use the developer\'s own words when they gave a reason.',
      inputSchema: {
        root: rootArg,
        category: z.string(),
        rule: z.string(),
        reasoning: z.string().optional(),
        source: z.enum(MEMORY_SOURCES),
        stated_by_human: z.boolean().describe('True if the wording is the developer\'s own; false if you generalised it.'),
      },
    },
    async (args) => {
      const root = rootOf(args.root);
      const store = await loadMemory(root);
      const result = store.propose({
        category: args.category,
        rule: args.rule,
        ...(args.reasoning ? { reasoning: args.reasoning } : {}),
        preference: 'moderate',
        source: args.source,
        derivation: args.stated_by_human ? 'stated' : 'inferred',
        evidence: [{ kind: 'agent_proposal', date: new Date().toISOString().slice(0, 10) }],
        scope: 'project',
      });
      await saveMemory(root, store);
      return text(
        result.status === 'proposed'
          ? `Proposed ${result.candidate.id} as a candidate. Ask the developer: accept, reject, or reword it?`
          : `Not proposed: ${result.reason}`,
      );
    },
  );

  server.registerTool(
    'memory_decide',
    {
      title: 'Record the developer\'s decision on a lesson',
      description:
        'Record the developer\'s explicit decision on a candidate lesson. Only call this after the developer has told you their decision in this conversation. Never decide on their behalf.',
      inputSchema: {
        root: rootArg,
        id: z.string(),
        decision: z.enum(['accept', 'reject', 'modify']),
        rule: z.string().optional().describe('For modify: the developer\'s wording.'),
        reason: z.string().optional(),
        confirmed_by_human: z.literal(true).describe('Must be true: the developer made this decision.'),
      },
    },
    async (args) => {
      const root = rootOf(args.root);
      const store = await loadMemory(root);
      if (args.decision === 'reject') store.reject(args.id, args.reason);
      else store.accept(args.id, args.decision === 'modify' && args.rule ? { rule: args.rule } : {});
      await saveMemory(root, store);
      return text(`${args.id}: ${args.decision === 'reject' ? 'declined' : 'added to Mulligan Memory'}.`);
    },
  );

  server.registerTool(
    'cookbook_check',
    {
      title: 'Check the coding standards cookbook',
      description: 'Evaluate files (default: the whole codebase) against the project\'s Coding Standards Cookbook rules that have machine checks.',
      inputSchema: { root: rootArg, paths: z.array(z.string()).optional() },
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      const root = rootOf(args.root);
      const cookbook = await loadCookbook(root);
      if (cookbook.rules.length === 0) return text('No cookbook yet. Run the setup-mulligan-cookbook skill.');
      const files = await readSourceFiles(root, args.paths ?? (await walkProject(root, { include: SOURCE_GLOBS })));
      const result = evaluateCookbook(cookbook.rules, files);
      const body = sortViolations(result.violations).slice(0, 30).map(formatViolation).join('\n\n');
      const unenforced = result.unenforced.length ? `\n\nRules needing judgement (no machine check): ${result.unenforced.map((r) => r.id).join(', ')}` : '';
      return text(`${result.violations.length} violation(s) in ${result.filesChecked} file(s).\n\n${body}${unenforced}`);
    },
  );

  server.registerTool(
    'route_task',
    {
      title: 'Route a task',
      description: 'Assess a task\'s difficulty and show which configured model each role would get (automatic or manual routing).',
      inputSchema: { root: rootArg, task: z.string(), attempts: z.number().int().min(0).optional().describe('Mulligan already taken on this task.') },
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      const config = await loadConfig(rootOf(args.root));
      const router = new ConfiguredModelRouter(config.models);
      const ctx = { description: args.task, attempts: args.attempts ?? 0, safetyMode: config.mode === 'safety' };
      const lines = [formatDifficulty(assessDifficulty(ctx, 'implementer', config.models.routing?.weights))];
      for (const role of AGENT_ROLES) {
        try {
          lines.push(`${role}: ${router.decide(role, ctx).reason}`);
        } catch (error) {
          lines.push(`${role}: ${messageOf(error)}`);
        }
      }
      return text(lines.join('\n'));
    },
  );

  server.registerTool(
    'mulligan_fanout',
    {
      title: 'Fan out to several models',
      description:
        'Send a task to N configured models from different angles, apply each candidate in an isolated git worktree, run the pre-approved verification commands there, judge each blind against the private rubric, and return a ranking with evidence. Nothing is applied to the working tree.',
      inputSchema: {
        root: rootArg,
        task: z.string(),
        count: z.number().int().min(1).max(8).optional(),
        verify: z.boolean().optional(),
      },
    },
    async (args) => {
      const root = rootOf(args.root);
      const config = await loadConfig(root);
      const [rubric, cookbook, code] = await Promise.all([loadRubric(root), loadCookbook(root).catch(() => ({ files: [], rules: [] })), gatherCodeContext(root, args.task)]);
      const verify = (args.verify ?? config.loop.fanout.verify) && Object.keys(config.verification.commands).length > 0;
      const result = await fanOut({
        root,
        task: args.task,
        count: args.count ?? config.loop.fanout.count,
        router: new ConfiguredModelRouter(config.models),
        rubric,
        contextFor: (t) => buildEngineeringContext(root, 'implementer', t, { includeCode: false }),
        codeContext: renderCodeContext(code),
        ...(verify ? { verify: { commands: config.verification.commands, runnerFor: (cwd: string) => nonInteractiveRunner(cwd, config.permissions.approved) } } : {}),
        judges: config.loop.fanout.judges,
        cookbookRules: cookbook.rules,
        routingWeights: config.models.routing?.weights,
      });
      return text(formatFanOut(result).replace('/pick <letter> makes a candidate the current attempt, then /apply.', 'Ask the developer which candidate to use; each diff is saved in the fan-out report.'));
    },
  );

  server.registerTool(
    'models_discover',
    {
      title: 'Discover local models',
      description: 'Find models served locally by Ollama, llama.cpp, LM Studio or vLLM on their default ports.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const found = await discoverLocalModels();
      return text(
        found.length
          ? found.map((m) => `${m.kind}: ${m.model}${m.size ? ` (${m.size})` : ''} at ${m.baseUrl}`).join('\n')
          : 'No local model servers found on the default ports.',
      );
    },
  );

  return server;
}
