import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  auditProvenance,
  describeProvenance,
  exportMemory,
  formatMemReview,
  importIntoStore,
  loadMemory,
  parseImport,
  saveMemory,
  type MemoryFormat,
  type MemoryStore,
  type NewLesson,
  type Principle,
} from '@mulligan/memory';
import { green } from '@mulligan/mascot';
import { runFullMemoryReview } from '@mulligan/review';
import { heading } from '../io.js';
import type { Session } from '../session.js';
import type { Command } from './types.js';

const EXPORT_EXTENSIONS: Record<MemoryFormat, string> = { mulliganmem: '.MulliganMem', json: '.json', markdown: '.md' };
const isMemoryFormat = (value: string): value is MemoryFormat => value in EXPORT_EXTENSIONS;

function describe(p: Principle): string {
  return `${green(p.id)} [${p.category}] ${p.rule}\n     ${p.preference} preference · ${p.confidence} confidence · ${describeProvenance(p)}`;
}

/** Asks the developer to accept, reject, reword or defer one candidate (spec §7). */
async function confirmCandidate(session: Session, store: MemoryStore, c: Principle): Promise<void> {
  const { io } = session;
  io.print();
  io.print(heading('MULLIGAN MEMORY'));
  io.print();
  io.print('I identified a potential engineering preference:');
  io.print();
  io.print(`  "${c.rule}"`);
  io.print();
  io.print(`  Source: ${describeProvenance(c)}`);
  const choice = await io.choose(
    'Would you like this added to your Mulligan Memory?',
    [
      { key: 'a', label: 'Accept Lesson', value: 'accept' },
      { key: 'r', label: 'Reject Lesson', value: 'reject' },
      { key: 'm', label: 'Modify Lesson', value: 'modify' },
      { key: 'l', label: 'Decide later', value: 'later' },
    ],
    'later',
  );
  if (choice === 'accept') {
    store.accept(c.id);
    io.print(`Added ${c.id}.`);
  } else if (choice === 'reject') {
    store.reject(c.id, (await io.ask('Why? (optional — helps avoid similar proposals)')) || undefined);
    io.print(`Declined ${c.id}; it will not be proposed again.`);
  } else if (choice === 'modify') {
    const rule = await io.ask('Your wording:', c.rule);
    const exceptions = await io.ask('Known exceptions? (optional, ";" separated)');
    store.accept(c.id, { rule, ...(exceptions ? { exceptions: exceptions.split(';').map((e) => e.trim()).filter(Boolean) } : {}) });
    io.print(`Added ${c.id} in your words.`);
  } else {
    io.print(`${c.id} saved as a candidate — /memory review to decide later.`);
  }
}

/** The human-curated learning loop: Mulligan proposes, the developer decides. */
export async function proposeAndConfirm(session: Session, store: MemoryStore, lessons: NewLesson[]): Promise<void> {
  for (const lesson of lessons) {
    const result = store.propose(lesson);
    if (result.status === 'duplicate') session.io.print(`(Skipped a lesson: ${result.reason})`);
    else await confirmCandidate(session, store, result.candidate);
  }
  await saveMemory(session.root, store);
}

export const memoryReviewCommand: Command = {
  name: 'mulligan-memory-review',
  aliases: ['mem-review'],
  summary: 'Compare what Mulligan has learned with the codebase; get an evidence-backed upskilling plan',
  async run(session) {
    session.io.print('Scanning the codebase, git history and cookbook…');
    session.io.print();
    session.io.print(formatMemReview(await runFullMemoryReview(session.root)));
  },
};

const USAGE = `/memory                       list principles
/memory candidates            list lessons awaiting your decision
/memory review                decide on pending candidates now
/memory accept <id>           confirm a candidate
/memory reject <id> [reason]  decline a candidate
/memory modify <id> <rule>    reword a principle or candidate
/memory add <category>: <rule>  state a principle directly
/memory retire <id> [reason]  remove a principle
/memory audit                 check provenance and confidence
/memory export <mulliganmem|json|markdown> [file]
/memory import <file>         import as candidates (never trusted silently)`;

export const memoryCommand: Command = {
  name: 'memory',
  summary: 'Inspect and curate .MulliganMem',
  usage: USAGE,
  async run(session, args) {
    const { io, root } = session;
    const store = await loadMemory(root);
    const [sub = 'list', id = '', ...restParts] = args.trim().split(/\s+/);
    const rest = restParts.join(' ');

    switch (sub) {
      case 'list':
        io.print(heading(`Mulligan Memory — ${store.principles.length} principle(s)`));
        for (const p of store.principles) io.print(`  ${describe(p)}`);
        if (store.candidates.length) io.print(`\n${store.candidates.length} candidate(s) awaiting your decision — /memory candidates`);
        return;
      case 'candidates':
        io.print(heading(`${store.candidates.length} candidate lesson(s)`));
        for (const c of store.candidates) io.print(`  ${describe(c)}`);
        return;
      case 'review':
        if (store.candidates.length === 0) return io.print('No candidates awaiting a decision.');
        for (const c of [...store.candidates]) await confirmCandidate(session, store, c);
        break;
      case 'accept':
        io.print(`Added ${store.accept(id).id}.`);
        break;
      case 'reject':
        store.reject(id, rest || undefined);
        io.print(`Declined ${id}.`);
        break;
      case 'modify':
        if (!rest) return io.print('Usage: /memory modify <id> <new wording>');
        store.modify(id, { rule: rest });
        io.print(`Updated ${id}.`);
        break;
      case 'add': {
        const [, category, rule] = /^([\w-]+):\s*(.+)$/.exec(`${id} ${rest}`.trim()) ?? [];
        if (!category || !rule) return io.print('Usage: /memory add <category>: <rule>');
        const p = store.addConfirmed({
          category,
          rule,
          preference: 'strong',
          source: 'human_correction',
          derivation: 'stated',
          evidence: [{ kind: 'human_statement', date: new Date().toISOString().slice(0, 10) }],
          scope: 'project',
        });
        io.print(`Added ${p.id}.`);
        break;
      }
      case 'retire':
        store.retire(id, rest || undefined);
        io.print(`Retired ${id}.`);
        break;
      case 'audit': {
        const issues = auditProvenance([...store.principles, ...store.candidates]);
        io.print(issues.length ? issues.map((i) => `  ⚠ ${i.message}`).join('\n') : 'No provenance issues found.');
        return;
      }
      case 'export': {
        const format = id || 'markdown';
        if (!isMemoryFormat(format)) return io.print('Format must be mulliganmem, json or markdown.');
        const ext = EXPORT_EXTENSIONS[format];
        const target = path.resolve(root, rest || `mulligan-memory-export${ext}`);
        await writeFile(target, exportMemory(store.memory, format), 'utf8');
        io.print(`Exported to ${path.relative(root, target)}.`);
        return;
      }
      case 'import': {
        if (!id) return io.print('Usage: /memory import <file>');
        const file = path.resolve(root, id);
        const incoming = parseImport(await readFile(file, 'utf8'), file.endsWith('.json') ? 'json' : 'mulliganmem');
        const results = importIntoStore(store, incoming, path.basename(file));
        const added = results.filter((r) => r.status === 'proposed').length;
        io.print(`Imported ${added} lesson(s) as candidates (${results.length - added} duplicates skipped). Review them with /memory review.`);
        break;
      }
      default:
        io.print(USAGE);
        return;
    }
    await saveMemory(root, store);
  },
};
