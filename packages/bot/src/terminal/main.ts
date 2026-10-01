import { findProjectRoot, isWorkspaceInitialised, messageOf } from '@mulligan/core';
import { loadMemory } from '@mulligan/memory';
import { CATCHPHRASE, PHRASES, besideMascot, bold, box, dim, green } from '@mulligan/mascot';
import { chat, findCommand } from './commands/index.js';
import { createIo } from './io.js';
import { Session } from './session.js';

async function banner(session: Session): Promise<string> {
  const memory = await loadMemory(session.root).catch(() => undefined);
  const roles = session.router.assignments();
  const lines = [
    bold(green('Mulligan BOT')),
    '',
    `Project:  ${session.config.project.name}`,
    `Branch:   ${session.branch ?? '—'}`,
    '',
    `Model:    ${roles.implementer ?? '—'}`,
    `Reviewer: ${roles.reviewer ?? '—'}`,
    `Verifier: ${roles.verifier ?? '—'}`,
    '',
    `Mulligan Memory: ${memory ? `${memory.principles.length} principles` : '—'}`,
  ];
  return besideMascot(box(lines));
}

async function dispatch(session: Session, line: string): Promise<boolean> {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (['/exit', '/quit', 'exit', 'quit'].includes(trimmed)) return false;
  if (!trimmed.startsWith('/')) {
    await chat(session, trimmed);
    return true;
  }
  const [, name = '', args = ''] = /^\/(\S+)\s*([\s\S]*)$/.exec(trimmed) ?? [];
  const command = findCommand(name);
  if (!command) {
    session.io.print(`Unknown command /${name}. Try /help.`);
    return true;
  }
  try {
    await command.run(session, args);
  } catch (error) {
    session.io.print(`/${name} failed: ${messageOf(error)}`);
  }
  return true;
}

async function main(argv: string[]): Promise<void> {
  const io = createIo();
  const root = findProjectRoot(process.cwd());
  const session = await new Session(root, io).load();

  // One-shot mode: `Mulligan review --all`, `Mulligan mem-review`, `Mulligan status` …
  if (argv.length > 0) {
    const [name = '', ...rest] = argv;
    const command = findCommand(name.replace(/^\//, ''));
    if (!command) {
      io.print(`Unknown command "${name}". Run \`Mulligan help\`.`);
      process.exitCode = 1;
    } else {
      await command.run(session, rest.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(' '));
    }
    io.close();
    return;
  }

  if (!io.interactive) {
    io.print('Mulligan Bot needs an interactive terminal. For scripts, pass a command: `Mulligan review --all`.');
    return;
  }

  io.print(await banner(session));
  if (!isWorkspaceInitialised(root)) io.print(dim('\nThis project has no Mulligan workspace yet — run /setup-mulligan.'));
  io.print(dim(`\n${CATCHPHRASE} /help for commands.`));
  io.print();
  io.print(bold('What would you like to build?'));

  for (;;) {
    const line = await io.ask('');
    if (!(await dispatch(session, line))) break;
  }
  io.print(green(PHRASES.handover));
  io.close();
}

main(process.argv.slice(2)).catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error && error.stack ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
