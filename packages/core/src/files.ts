import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import picomatch from 'picomatch';
import { isRecord } from './json.js';

export const DEFAULT_IGNORES = [
  '**/node_modules/**',
  '**/.git/**',
  '**/.mulligan/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/.next/**',
  '**/.expo/**',
  '**/ios/Pods/**',
  '**/android/build/**',
];

export const SOURCE_GLOBS = ['**/*.{ts,tsx,js,jsx,mjs,cjs}'];

const IGNORED_DIR_NAMES = new Set(['node_modules', '.git', '.mulligan', 'dist', 'build', 'coverage', '.next', '.expo']);

export interface WalkOptions {
  include?: string[];
  ignore?: string[];
  maxFiles?: number;
}

/** Lists project files as posix-style paths relative to `root`. */
export async function walkProject(root: string, options: WalkOptions = {}): Promise<string[]> {
  const include = picomatch(options.include ?? ['**/*'], { dot: true });
  const ignore = picomatch([...DEFAULT_IGNORES, ...(options.ignore ?? [])], { dot: true });
  const maxFiles = options.maxFiles ?? 20_000;
  const results: string[] = [];

  async function visit(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (results.length >= maxFiles) return;
      const absolute = path.join(dir, entry.name);
      const relative = toPosix(path.relative(root, absolute));
      if (entry.isDirectory()) {
        if (!IGNORED_DIR_NAMES.has(entry.name)) await visit(absolute);
      } else if (entry.isFile() && include(relative) && !ignore(relative)) {
        results.push(relative);
      }
    }
  }

  await visit(root);
  return results.sort();
}

export interface SourceFile {
  path: string;
  content: string;
}

export async function readSourceFiles(root: string, files: string[]): Promise<SourceFile[]> {
  const out: SourceFile[] = [];
  for (const file of files) {
    try {
      out.push({ path: file, content: await readFile(path.join(root, file), 'utf8') });
    } catch {
      // Deleted or unreadable files are skipped.
    }
  }
  return out;
}

export function toPosix(p: string): string {
  return p.split(path.sep).join('/');
}

export function matchesAny(file: string, globs: string[]): boolean {
  return picomatch(globs, { dot: true })(file);
}

export const isTestFile = (file: string): boolean =>
  /(^|\/)(__tests__|tests?)\/|\.(test|spec)\.[cm]?[jt]sx?$/.test(file);

export const isSourceFile = (file: string): boolean => /\.[cm]?[jt]sx?$/.test(file) && !file.endsWith('.d.ts');

export const isDocFile = (file: string): boolean => /\.(md|mdx|rst|adoc)$/i.test(file) || /(^|\/)docs?\//.test(file);

export function lineOf(content: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < content.length; i++) {
    if (content.charCodeAt(i) === 10) line++;
  }
  return line;
}

export interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

/** String-to-string maps only; anything else in the manifest is ignored. */
function stringMap(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) return undefined;
  return Object.fromEntries(Object.entries(value).filter((e): e is [string, string] => typeof e[1] === 'string'));
}

export async function readPackageJson(root: string): Promise<PackageJson | undefined> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  } catch {
    return undefined;
  }
  if (!isRecord(raw)) return undefined;
  return {
    ...(typeof raw.name === 'string' ? { name: raw.name } : {}),
    dependencies: stringMap(raw.dependencies),
    devDependencies: stringMap(raw.devDependencies),
    scripts: stringMap(raw.scripts),
  };
}

export function allDependencies(pkg: PackageJson | undefined): Record<string, string> {
  return { ...pkg?.dependencies, ...pkg?.devDependencies };
}
