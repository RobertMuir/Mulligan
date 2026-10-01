import { today } from '@mulligan/core';
import { parseMemory, serializeMemory } from './parser.js';
import { describeProvenance } from './provenance.js';
import type { MemoryStore, ProposeResult } from './store.js';
import type { MulliganMemory, Principle } from './types.js';

export type MemoryFormat = 'mulliganmem' | 'json' | 'markdown';

/** The developer owns their accumulated engineering knowledge (spec §35). */
export function exportMemory(memory: MulliganMemory, format: MemoryFormat): string {
  switch (format) {
    case 'mulliganmem':
      return serializeMemory(memory);
    case 'json':
      return JSON.stringify(memory, null, 2) + '\n';
    case 'markdown':
      return toMarkdown(memory);
  }
}

function toMarkdown(memory: MulliganMemory): string {
  const lines = [`# Mulligan Memory — ${memory.project.name}`, '', `Exported ${today()}.`, ''];
  const byCategory = new Map<string, Principle[]>();
  for (const p of memory.principles) byCategory.set(p.category, [...(byCategory.get(p.category) ?? []), p]);
  for (const [category, principles] of [...byCategory].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`## ${category}`, '');
    for (const p of principles) {
      lines.push(`- **${p.id}** — ${p.rule}`);
      if (p.reasoning) lines.push(`  - Why: ${p.reasoning}`);
      if (p.exceptions?.length) lines.push(`  - Exceptions: ${p.exceptions.join('; ')}`);
      lines.push(`  - ${p.preference} preference, ${p.confidence} confidence — ${describeProvenance(p)}`);
    }
    lines.push('');
  }
  if (memory.candidates.length > 0) {
    lines.push('## Unconfirmed candidates', '');
    for (const c of memory.candidates) lines.push(`- ${c.id} — ${c.rule} _(${describeProvenance(c)})_`);
    lines.push('');
  }
  return lines.join('\n');
}

export function parseImport(text: string, format: Exclude<MemoryFormat, 'markdown'>): MulliganMemory {
  if (format === 'json') return parseMemory(JSON.stringify(JSON.parse(text)));
  return parseMemory(text);
}

/**
 * Imported principles become candidates in the receiving project — knowledge
 * from elsewhere is not silently trusted. Provenance is preserved.
 */
export function importIntoStore(store: MemoryStore, incoming: MulliganMemory, origin: string): ProposeResult[] {
  return incoming.principles.map((p) =>
    store.propose(
      {
        category: p.category,
        rule: p.rule,
        reasoning: p.reasoning,
        context: p.context,
        decision: p.decision,
        subject: p.subject,
        stance: p.stance,
        preference: p.preference,
        source: p.source,
        derivation: p.derivation,
        evidence: [...p.evidence, { kind: 'imported', ref: origin, note: `was ${p.id}`, date: today() }],
        scope: p.scope,
        exceptions: p.exceptions,
      },
      'human',
    ),
  );
}
