import { dim, green } from '@mulligan/mascot';
import { coreCommands } from './core.js';
import { engineeringCommands } from './engineering.js';
import { memoryCommand, memoryReviewCommand } from './memory.js';
import { reviewCommand } from './review.js';
import { setupCookbookCommand, setupPrCommand } from './setup.js';
import type { Command } from './types.js';

export { chat } from './engineering.js';
export type { Command } from './types.js';

const helpCommand: Command = {
  name: 'help',
  summary: 'List commands',
  async run(session) {
    for (const c of COMMANDS) {
      session.io.print(`  ${green(`/${c.name}`.padEnd(26))} ${c.summary}${c.aliases?.length ? dim(` (also /${c.aliases.join(', /')})`) : ''}`);
    }
    session.io.print(dim('\nAnything without a leading / goes to the implementer as conversation. /exit to leave.'));
  },
};

export const COMMANDS: Command[] = [
  helpCommand,
  ...coreCommands,
  ...engineeringCommands,
  reviewCommand,
  memoryCommand,
  memoryReviewCommand,
  setupCookbookCommand,
  setupPrCommand,
];

export function findCommand(name: string): Command | undefined {
  const key = name.toLowerCase();
  return COMMANDS.find((c) => c.name === key || c.aliases?.includes(key));
}
