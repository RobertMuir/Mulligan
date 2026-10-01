import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AGENT_ROLES, assessDifficulty, formatDifficulty, gatherCodeContext, isGitRepo, messageOf, renderCodeContext, type AgentRole, type ModelProvider } from '@mulligan/core';
import { loadCookbook } from '@mulligan/cookbook';
import { extractLessons, extractLessonsWithModel, loadMemory, type DecisionRecord } from '@mulligan/memory';
import { PHRASES, dim, green } from '@mulligan/mascot';
import { fanOut, formatFanOut, loadRubric, parseChange, safeRelativePath, saveFanOut } from '@mulligan/orchestrator';
import { buildEngineeringContext } from '../context.js';
import type { Attempt, Session } from '../session.js';
import { proposeAndConfirm } from './memory.js';
import { parseFlags, type Command } from './types.js';

const HISTORY_WINDOW = 12;

async function converse(
  session: Session,
  role: AgentRole,
  prompt: string,
  options: { model?: ModelProvider; record?: boolean; task?: string } = {},
): Promise<string | undefined> {
  const task = options.task ?? prompt;
  const model = options.model ?? (await session.model(role, task));
  if (!model) return undefined;
  const system = await buildEngineeringContext(session.root, role, task);
  session.io.print(dim(`${role} · ${model.name} (${model.model}) is thinking…`));
  const messages = [...session.history.slice(-HISTORY_WINDOW), { role: 'user' as const, content: prompt }];
  let text: string;
  try {
    text = (await model.complete({ system, messages, maxTokens: 16_000 })).text;
  } catch (error) {
    session.io.print(`The ${role} model failed: ${messageOf(error)}`);
    return undefined;
  }
  session.history.push({ role: 'user', content: prompt }, { role: 'assistant', content: text });
  session.io.print();
  session.io.print(text);
  await session.log({ role, model: `${model.name}/${model.model}`, prompt, response: text });
  if (options.record) await recordAttempt(session, { task, role, model: `${model.name}/${model.model}`, response: text, change: parseChange(text) });
  return text;
}

async function recordAttempt(session: Session, attempt: Omit<Attempt, 'n' | 'file'>): Promise<Attempt> {
  const n = session.attempts.length + 1;
  await mkdir(session.sessionDir, { recursive: true });
  const file = path.join(session.sessionDir, `attempt-${n}.md`);
  await writeFile(file, `# Attempt ${n}\n\nRole: ${attempt.role} · ${attempt.model}\n\n## Task\n\n${attempt.task}\n\n## Response\n\n${attempt.response}\n`, 'utf8');
  const full: Attempt = { ...attempt, n, file };
  session.attempts.push(full);
  session.io.print();
  session.io.print(dim(`Attempt ${n} saved. ${PHRASES.handover} /apply to apply it · /accept to approve · /take-a-mulligan for a different approach`));
  return full;
}

function shouldFanOut(session: Session, task: string): { yes: boolean; reason: string } {
  const f = session.config.loop.fanout;
  const d = assessDifficulty(session.taskContext(task), 'implementer', session.config.models.routing?.weights);
  if (!f.auto) return { yes: false, reason: 'automatic fan-out is off' };
  return d.score >= f.minDifficulty
    ? { yes: true, reason: `${formatDifficulty(d)} ≥ ${f.minDifficulty}` }
    : { yes: false, reason: `${formatDifficulty(d)} < ${f.minDifficulty}` };
}

/**
 * Fan the task out to several models from different angles, verify each in
 * isolation, judge blind against the private rubric, and present a ranking.
 */
export async function runFanOut(session: Session, task: string, options: { count?: number; verify?: boolean; rejected?: string[] } = {}): Promise<void> {
  const cfg = session.config.loop.fanout;
  const count = Math.max(1, Math.min(8, options.count ?? cfg.count));
  const commands = session.config.verification.commands;
  const verify = (options.verify ?? cfg.verify) && Object.keys(commands).length > 0;
  if ((options.verify ?? cfg.verify) && !verify) session.io.print(dim('No verification commands configured — candidates will be judged without running checks.'));
  const unapproved = Object.values(commands).filter((c) => !session.config.permissions.approved.some((a) => c === a || c.startsWith(`${a} `)));
  if (verify && unapproved.length) {
    session.io.print(dim(`Each candidate runs your checks; you will be asked before running ${unapproved.join(', ')} (or /permissions approve them).`));
  }
  const [rubric, cookbook, code] = await Promise.all([
    loadRubric(session.root),
    loadCookbook(session.root).catch(() => ({ files: [], rules: [] })),
    gatherCodeContext(session.root, task),
  ]);
  let result;
  try {
    result = await fanOut({
      root: session.root,
      task,
      count,
      router: session.router,
      rubric,
      contextFor: (t) => buildEngineeringContext(session.root, 'implementer', t, { includeCode: false }),
      codeContext: renderCodeContext(code),
      rejectedApproaches: options.rejected,
      attempts: session.Mulligan,
      safetyMode: session.config.mode === 'safety',
      ...(verify ? { verify: { commands, runnerFor: (cwd: string) => session.runnerFor(cwd) } } : {}),
      judges: cfg.judges,
      cookbookRules: cookbook.rules,
      routingWeights: session.config.models.routing?.weights,
      onProgress: (m) => session.io.print(dim(m)),
    });
  } catch (error) {
    session.io.print(`Fan-out failed: ${messageOf(error)}`);
    return;
  }
  session.lastFanOut = result;
  const report = formatFanOut(result);
  session.io.print();
  session.io.print(report);
  const dir = await saveFanOut(path.join(session.sessionDir, `fanout-${Date.now()}`), result, report);
  session.io.print(dim(`Candidates, diffs and scores saved to ${path.relative(session.root, dir).split(path.sep).join('/')}`));
  await session.log({ fanout: task, ranking: result.candidates.map((c) => ({ label: c.label, provider: c.provider, total: c.total, standing: c.standing })) });
}

function roleCommand(name: string, role: AgentRole, summary: string, framing: (args: string) => string, aliases: string[] = []): Command {
  return {
    name,
    aliases,
    summary,
    async run(session, args) {
      const task = args.trim() || (await session.io.ask(`${name}: what about?`));
      if (!task) return;
      await converse(session, role, framing(task), { task });
    },
  };
}

function firstLine(text: string): string {
  return (text.split('\n').find((l) => l.trim() && !l.startsWith('```')) ?? '').replace(/^#+\s*|^APPROACH:\s*/i, '').slice(0, 160);
}

async function learn(session: Session, decision: DecisionRecord): Promise<void> {
  const store = await loadMemory(session.root);
  const model = await session.optionalModel('reviewer', decision.task);
  const lessons = model ? await extractLessonsWithModel(decision, model) : extractLessons(decision);
  await session.log({ decision });
  if (lessons.length === 0) return;
  await proposeAndConfirm(session, store, lessons);
}

async function applyAttempt(session: Session, last: Attempt): Promise<void> {
  const { io, root } = session;
  const diff = last.diff ?? (last.change?.files.length ? undefined : last.change?.diff);
  if (diff) {
    if (!(await isGitRepo(root))) return io.print('Applying a diff needs a git repository.');
    const patch = last.file.replace(/\.md$/, '.patch');
    await writeFile(patch, diff, 'utf8');
    const rel = path.relative(root, patch);
    const check = await session.runner.run(`git apply --check --recount "${rel}"`, { purpose: 'Check the change applies cleanly' });
    if (check.status !== 'completed' || check.exitCode !== 0) {
      return io.print(`The change does not apply cleanly:\n${check.status === 'completed' ? check.stderr : check.reason}`);
    }
    const applied = await session.runner.run(`git apply --recount "${rel}"`, { purpose: `Apply attempt ${last.n} to the working tree` });
    io.print(
      applied.status === 'completed' && applied.exitCode === 0
        ? `Applied attempt ${last.n}. ${PHRASES.verify} Try /verify or /mulligan-review.`
        : `Not applied: ${applied.status === 'completed' ? applied.stderr : applied.reason}`,
    );
    return;
  }
  const files = last.change?.files ?? [];
  if (files.length === 0) return io.print('The last attempt contains no file changes to apply.');
  const refused = files.filter((f) => !safeRelativePath(root, f.path));
  if (refused.length) return io.print(`Refused: paths outside the project (${refused.map((r) => r.path).join(', ')}).`);
  const targets = files.flatMap((f) => {
    const rel = safeRelativePath(root, f.path);
    return rel ? [{ rel, content: f.content }] : [];
  });
  io.print('This writes:');
  for (const t of targets) io.print(`  ${existsSync(path.join(root, t.rel)) ? 'overwrite' : 'create   '} ${t.rel}`);
  if (!(await io.confirm('Write these files?'))) return io.print('Not applied.');
  for (const t of targets) {
    const target = path.join(root, t.rel);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, t.content, 'utf8');
  }
  io.print(`Applied attempt ${last.n} (${targets.length} file${targets.length === 1 ? '' : 's'}). ${PHRASES.verify} Try /verify or /mulligan-review.`);
}

export const engineeringCommands: Command[] = [
  roleCommand('interrogate', 'architect', 'Ask the questions that must be answered before building', (t) =>
    `Interrogate this task before any implementation. List the clarifying questions, hidden assumptions, unknowns and risks. Do not implement.\n\nTask: ${t}`,
  ),
  roleCommand('architect', 'architect', 'Explore genuinely different designs and recommend one', (t) =>
    `Design this. Give at least two fundamentally different approaches with trade-offs, then a recommendation.\n\nTask: ${t}`,
  ),
  roleCommand('plan', 'architect', 'Break a task into small, verifiable steps', (t) =>
    `Produce an implementation plan: small steps, each with how it will be verified. Define success first.\n\nTask: ${t}`,
  ),
  roleCommand('explain', 'teacher', 'Explain what changed, how and why', (t) => `Explain: ${t}`),
  roleCommand('teach', 'teacher', 'Teach the concept behind a piece of work', (t) => `Teach me: ${t}`, ['swing-analysis']),
  roleCommand('why', 'teacher', 'Explain why a decision was made', (t) => `Why: ${t}`, ['reading-the-flight']),
  roleCommand('how', 'teacher', 'Explain how something works', (t) => `How: ${t}`),
  {
    name: 'implement',
    summary: 'Implement a task — fans out to several models automatically when the task is hard',
    usage: '/implement [--fanout [n]] [--single] <task>',
    async run(session, args) {
      const { flags, rest } = parseFlags(args, { numbers: ['fanout'] });
      const task = rest || (await session.io.ask('What should be implemented?'));
      if (!task) return;
      session.Mulligan = 0;
      const decision = flags.single ? { yes: false, reason: 'single attempt requested' } : flags.fanout ? { yes: true, reason: 'fan-out requested' } : shouldFanOut(session, task);
      session.io.print(dim(decision.yes ? `Fanning out: ${decision.reason}.` : `Single attempt: ${decision.reason}.`));
      if (decision.yes) await runFanOut(session, task, { ...(typeof flags.fanout === 'string' ? { count: Number(flags.fanout) } : {}) });
      else await converse(session, 'implementer', `Implement:\n\n${task}`, { record: true, task });
    },
  },
  {
    name: 'fanout',
    aliases: ['attacking-the-pin', 'swarm', 'arena'],
    summary: 'Fan a task out to N models from different angles, verify each, and rank them against the rubric',
    usage: '/fanout [--n 3] [--no-verify] <task>',
    async run(session, args) {
      const { flags, rest } = parseFlags(args, { numbers: ['n'] });
      const task = rest || (await session.io.ask('Task to fan out:'));
      if (!task) return;
      await runFanOut(session, task, {
        ...(typeof flags.n === 'string' ? { count: Number(flags.n) } : {}),
        ...(flags['no-verify'] ? { verify: false } : {}),
      });
    },
  },
  {
    name: 'pick',
    summary: 'Make a fan-out candidate the current attempt',
    usage: '/pick <letter>',
    async run(session, args) {
      const result = session.lastFanOut;
      if (!result) return session.io.print('No fan-out in this session yet — /fanout or /implement first.');
      const label = (args.trim() || result.recommended?.label || '').toUpperCase();
      const c = result.candidates.find((x) => x.label === label);
      if (!c) return session.io.print(`No candidate ${label}. Candidates: ${result.candidates.map((x) => x.label).join(', ')}.`);
      if (c.error) return session.io.print(`Candidate ${label} errored and has nothing to apply.`);
      if (c.standing !== 'eligible') session.io.print(`Note: candidate ${label} is marked ${c.standing}. Picking it anyway because you chose it.`);
      await recordAttempt(session, { task: result.task, role: 'implementer', model: `${c.provider}/${c.model}`, response: c.text, change: c.change, ...(c.diff ? { diff: c.diff } : {}) });
      session.io.print(`Picked ${label}: ${c.change.approach}`);
    },
  },
  {
    name: 'reflect',
    summary: 'What did we learn from the last attempt, and how will it change the next one?',
    async run(session) {
      const last = session.attempts.at(-1);
      if (!last) return session.io.print('No attempts yet in this session.');
      await converse(
        session,
        'teacher',
        `Reflect on attempt ${last.n}. What did we learn from it, what would we do differently, and how should that change the next attempt?\n\nTask: ${last.task}\n\nAttempt:\n${last.response}`,
        { task: last.task },
      );
    },
  },
  {
    name: 'route',
    summary: 'Show how a task would be routed: its difficulty and the model each role gets',
    usage: '/route <task>',
    async run(session, args) {
      const task = args.trim() || (await session.io.ask('Task to route:'));
      if (!task) return;
      session.io.print(formatDifficulty(assessDifficulty(session.taskContext(task), 'implementer', session.config.models.routing?.weights)));
      for (const role of AGENT_ROLES) {
        try {
          session.io.print(`  ${role.padEnd(17)} ${session.router.decide(role, session.taskContext(task)).reason}`);
        } catch (error) {
          session.io.print(`  ${role.padEnd(17)} ${messageOf(error)}`);
        }
      }
      const fan = shouldFanOut(session, task);
      session.io.print(dim(`fan-out: ${fan.yes ? 'yes' : 'no'} (${fan.reason})`));
    },
  },
  {
    name: 'accept',
    summary: 'Approve the last attempt and let Mulligan learn from it',
    async run(session, args) {
      const last = session.attempts.at(-1);
      if (!last) return session.io.print('No attempt to accept yet.');
      const reason = args.trim() || (await session.io.ask('What made this the right approach? (this is what Mulligan learns from)'));
      await learn(session, {
        outcome: 'accepted',
        task: last.task,
        approach: last.change?.approach || firstLine(last.response),
        humanReason: reason || undefined,
        ref: path.basename(last.file),
      });
      session.Mulligan = 0;
      session.io.print(green('Approved. Commit when you are ready — Mulligan does not commit for you.'));
    },
  },
  {
    name: 'take-a-mulligan',
    aliases: ['mulligan'],
    summary: 'Reject the last attempt and get a fundamentally different approach (fans out when warranted)',
    async run(session, args) {
      const last = session.attempts.at(-1);
      if (!last) return session.io.print('Nothing to take a Mulligan on yet — /implement something first.');
      const reason = args.trim() || (await session.io.ask("Why are we taking a Mulligan? What's wrong with this approach?"));
      if (!reason) return session.io.print('A Mulligan needs a reason — it is what makes the next attempt different.');
      await learn(session, { outcome: 'rejected', task: last.task, approach: last.change?.approach || firstLine(last.response), humanReason: reason, ref: path.basename(last.file) });
      session.Mulligan++;
      session.io.print();
      session.io.print(green(`${PHRASES.alternative} Taking a Mulligan.`));
      const rejected = session.attempts
        .filter((a) => a.task === last.task)
        .map((a) => `${a.change?.approach || firstLine(a.response)}${a === last ? ` — rejected because: ${reason}` : ''}`);
      const fan = shouldFanOut(session, last.task);
      if (fan.yes) {
        session.io.print(dim(`Fanning out: ${fan.reason}.`));
        await runFanOut(session, last.task, { rejected });
        return;
      }
      await converse(
        session,
        'implementer',
        `The previous approach was rejected by the developer.\nReason: ${reason}\n\nRejected so far:\n${rejected.map((r) => `- ${r}`).join('\n')}\n\n` +
          'Propose a FUNDAMENTALLY different approach — not a tweak of the rejected one. Start by stating in one paragraph how it differs ' +
          `and why it addresses the reason for rejection.\n\nTask: ${last.task}`,
        { record: true, task: last.task },
      );
    },
  },
  {
    name: 'apply',
    summary: 'Apply the current attempt to your working tree (with your approval)',
    async run(session) {
      const last = session.attempts.at(-1);
      if (!last) return session.io.print('No attempt to apply.');
      await applyAttempt(session, last);
    },
  },
  {
    name: 'verify',
    summary: 'Run the configured verification commands',
    async run(session) {
      const commands = Object.entries(session.config.verification.commands);
      if (commands.length === 0) {
        return session.io.print('No verification commands configured. Add them under verification.commands in .mulligan/config.yaml.');
      }
      for (const [name, command] of commands) {
        const outcome = await session.runner.run(command, { purpose: `Verification: ${name}` });
        if (outcome.status !== 'completed') session.io.print(`– ${name}: ${outcome.status} (${outcome.reason})`);
        else if (outcome.exitCode === 0) session.io.print(`${green('✓')} ${name}: \`${command}\` passed`);
        else {
          session.io.print(`✗ ${name}: \`${command}\` failed (exit ${outcome.exitCode})`);
          session.io.print(dim(`${outcome.stdout}\n${outcome.stderr}`.trim().split('\n').slice(-20).join('\n')));
        }
      }
    },
  },
  {
    name: 'run',
    summary: 'Run a shell command through the permission layer',
    usage: '/run <command>',
    async run(session, args) {
      if (!args.trim()) return session.io.print('Usage: /run <command>');
      const outcome = await session.runner.run(args.trim(), { purpose: 'Requested by you' });
      if (outcome.status !== 'completed') return session.io.print(`${outcome.status}: ${outcome.reason}`);
      session.io.print(`${outcome.stdout}${outcome.stderr}`.trimEnd());
      session.io.print(dim(`exit ${outcome.exitCode} · ${outcome.durationMs}ms`));
    },
  },
];

/** Free text goes to the implementer as conversation. */
export async function chat(session: Session, text: string): Promise<void> {
  await converse(session, 'implementer', text);
}
