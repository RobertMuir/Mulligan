import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { toPosix } from '@mulligan/core';
import { formatReport, runMulliganReview, saveReport } from '@mulligan/review';
import { dim } from '@mulligan/mascot';
import type { Session } from '../session.js';
import { parseFlags, type Command } from './types.js';

export const reviewCommand: Command = {
  name: 'mulligan-review',
  aliases: ['review'],
  summary: 'Comprehensive review of current changes against your standards',
  usage: '/mulligan-review [--base main] [--all] [--scope "src/feature/**"] [--task "…"] [--description-file PR.md] [--no-verify] [--no-model] [--verbose]',
  async run(session: Session, args: string) {
    const { flags, multi } = parseFlags(args, { values: ['base', 'scope', 'task', 'description-file'] });
    const description = typeof flags['description-file'] === 'string' ? await readFile(path.resolve(session.root, flags['description-file']), 'utf8') : undefined;
    const reviewer = flags['no-model'] ? undefined : await session.optionalModel('reviewer');
    session.io.print(dim(`Reviewing${reviewer ? ` (independent reviewer: ${reviewer.name})` : ''}…`));
    const report = await runMulliganReview({
      root: session.root,
      ...(typeof flags.base === 'string' ? { base: flags.base } : {}),
      all: flags.all === true,
      ...(multi.scope ? { scope: multi.scope } : {}),
      ...(typeof flags.task === 'string' ? { task: flags.task } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(flags['no-verify'] ? {} : { runner: session.runner }),
      ...(reviewer ? { reviewer } : {}),
    });
    const text = formatReport(report, { verbose: flags.verbose === true });
    session.io.print();
    session.io.print(text);
    const saved = await saveReport(session.root, text, report.generatedAt);
    session.io.print();
    session.io.print(dim(`Saved to ${toPosix(path.relative(session.root, saved))}`));
  },
};
