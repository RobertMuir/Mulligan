import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isRecord, messageOf, workspacePaths } from '@mulligan/core';
import YAML from 'yaml';
import { BUILTIN_CHECKS, type BuiltinCheckName, type Cookbook, type CookbookFile, type CookbookRule, type RuleCheck, type Severity } from './types.js';

export class CookbookParseError extends Error {
  override name = 'CookbookParseError';
}

const SEVERITIES: Severity[] = ['blocking', 'high', 'medium', 'low'];

const isSeverity = (v: unknown): v is Severity => SEVERITIES.some((s) => s === v);
const isBuiltinCheck = (v: unknown): v is BuiltinCheckName => BUILTIN_CHECKS.some((c) => c === v);
const optionalText = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

function text(value: unknown, where: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new CookbookParseError(`${where} must be non-empty text.`);
  return value.replace(/\s+/g, ' ').trim();
}

function optionalList(value: unknown, where: string): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) throw new CookbookParseError(`${where} must be a list.`);
  return value.map((v) => String(v));
}

function parseCheck(raw: unknown, where: string): RuleCheck | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!isRecord(raw)) throw new CookbookParseError(`${where} must be a mapping.`);
  const r = raw;
  const files = optionalList(r.files, `${where}.files`);
  if (r.type === 'builtin') {
    if (!isBuiltinCheck(r.name)) throw new CookbookParseError(`${where}.name must be one of: ${BUILTIN_CHECKS.join(', ')}.`);
    if (r.options !== undefined && !isRecord(r.options)) throw new CookbookParseError(`${where}.options must be a mapping.`);
    return { type: 'builtin', name: r.name, options: r.options, files };
  }
  if (r.type === 'pattern') {
    const pattern = text(r.pattern, `${where}.pattern`);
    try {
      new RegExp(pattern, typeof r.flags === 'string' ? r.flags : undefined);
    } catch (error) {
      throw new CookbookParseError(`${where}.pattern is not a valid regular expression: ${messageOf(error)}`);
    }
    return { type: 'pattern', pattern, flags: optionalText(r.flags), files, message: optionalText(r.message) };
  }
  throw new CookbookParseError(`${where}.type must be "builtin" or "pattern".`);
}

function parseRule(raw: unknown, where: string, fileCategory: string): CookbookRule {
  if (!isRecord(raw)) throw new CookbookParseError(`${where} must be a mapping.`);
  const r = raw;
  const id = text(r.id, `${where}.id`);
  const at = `${where} (${id})`;
  const severity = r.severity ?? 'medium';
  if (!isSeverity(severity)) throw new CookbookParseError(`${at}.severity must be one of: ${SEVERITIES.join(', ')}.`);
  const rule: CookbookRule = {
    id,
    title: typeof r.title === 'string' ? r.title.trim() : id,
    category: typeof r.category === 'string' ? r.category : fileCategory,
    severity,
    rule: text(r.rule, `${at}.rule`),
  };
  const preferred = optionalList(r.preferred, `${at}.preferred`);
  const prohibited = optionalList(r.prohibited, `${at}.prohibited`);
  const exceptions = optionalList(r.exceptions, `${at}.exceptions`);
  const check = parseCheck(r.check, `${at}.check`);
  if (preferred) rule.preferred = preferred;
  if (prohibited) rule.prohibited = prohibited;
  if (exceptions) rule.exceptions = exceptions;
  if (typeof r.rationale === 'string') rule.rationale = r.rationale.replace(/\s+/g, ' ').trim();
  if (check) rule.check = check;
  if (r.ai_must_ask === true) rule.ai_must_ask = true;
  if (r.origin === 'team' || r.origin === 'starter') rule.origin = r.origin;
  return rule;
}

/** Accepts `rules: [...]` files and the single-rule `rule: {...}` form (spec §21). */
export function parseCookbookFile(source: string, fallbackCategory: string): CookbookFile {
  let data: unknown;
  try {
    data = YAML.parse(source);
  } catch (error) {
    throw new CookbookParseError(`Invalid YAML: ${messageOf(error)}`);
  }
  const r = data ?? {};
  if (!isRecord(r)) throw new CookbookParseError('A cookbook file must be a YAML mapping.');
  const category = typeof r.category === 'string' ? r.category : fallbackCategory;
  let rawRules: unknown[];
  if (Array.isArray(r.rules)) rawRules = r.rules;
  else if (r.rule && typeof r.rule === 'object') rawRules = [r.rule];
  else if (r.rules === undefined && r.rule === undefined) rawRules = [];
  else throw new CookbookParseError('"rules" must be a list.');
  const file: CookbookFile = { category, rules: rawRules.map((rule, i) => parseRule(rule, `rules[${i}]`, category)) };
  if (typeof r.philosophy === 'string') file.philosophy = r.philosophy.trim();
  return file;
}

export function serializeCookbookFile(file: CookbookFile): string {
  const header = `# Mulligan Coding Standards Cookbook — ${file.category}\n# "How does OUR team want software written?" Edit freely; Mulligan Review enforces these.\n`;
  return header + YAML.stringify(file, { lineWidth: 0 }); // one line per rule, so a grep shows each rule whole
}

export async function loadCookbook(root: string): Promise<Cookbook> {
  const dir = workspacePaths(root).cookbook;
  if (!existsSync(dir)) return { files: [], rules: [] };
  const names = (await readdir(dir)).filter((n) => /\.ya?ml$/.test(n)).sort();
  const files: CookbookFile[] = [];
  const seen = new Map<string, string>();
  for (const name of names) {
    const category = name.replace(/\.ya?ml$/, '');
    let file: CookbookFile;
    try {
      file = parseCookbookFile(await readFile(path.join(dir, name), 'utf8'), category);
    } catch (error) {
      throw new CookbookParseError(`${name}: ${messageOf(error)}`);
    }
    for (const rule of file.rules) {
      const previous = seen.get(rule.id);
      if (previous) throw new CookbookParseError(`Rule id ${rule.id} appears in both ${previous} and ${name}.`);
      seen.set(rule.id, name);
    }
    files.push(file);
  }
  return { files, rules: files.flatMap((f) => f.rules) };
}

export async function saveCookbookFile(root: string, file: CookbookFile): Promise<string> {
  const dir = workspacePaths(root).cookbook;
  await mkdir(dir, { recursive: true });
  const target = path.join(dir, `${file.category}.yaml`);
  await writeFile(target, serializeCookbookFile(file), 'utf8');
  return target;
}
