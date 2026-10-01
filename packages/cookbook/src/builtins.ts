import type { SourceFile } from '@mulligan/core';
import ts from 'typescript';
import type { BuiltinCheckName } from './types.js';

export interface Hit {
  line: number;
  column: number;
  message?: string;
}

const TS_ONLY = new Set<BuiltinCheckName>(['no-explicit-any', 'no-non-null-assertion']);
const INDEX_KEY_NAMES = new Set(['index', 'idx', 'i']);

function scriptKind(file: string): ts.ScriptKind | undefined {
  if (/\.tsx$/.test(file)) return ts.ScriptKind.TSX;
  if (/\.[cm]?ts$/.test(file)) return ts.ScriptKind.TS;
  if (/\.jsx$/.test(file)) return ts.ScriptKind.JSX;
  if (/\.[cm]?js$/.test(file)) return ts.ScriptKind.JS;
  return undefined;
}

export function builtinApplies(name: BuiltinCheckName, file: string): boolean {
  if (name === 'max-file-lines') return true;
  const kind = scriptKind(file);
  if (kind === undefined || file.endsWith('.d.ts')) return false;
  return !TS_ONLY.has(name) || kind === ts.ScriptKind.TS || kind === ts.ScriptKind.TSX;
}

export function runBuiltin(name: BuiltinCheckName, file: SourceFile, options: Record<string, unknown> = {}): Hit[] {
  if (!builtinApplies(name, file.path)) return [];

  if (name === 'max-file-lines') {
    const max = typeof options.max === 'number' ? options.max : 400;
    const lines = file.content.split('\n').length;
    return lines > max ? [{ line: max + 1, column: 1, message: `File has ${lines} lines (limit ${max}).` }] : [];
  }

  if (name === 'no-ts-ignore') {
    const hits: Hit[] = [];
    file.content.split('\n').forEach((text, i) => {
      const m = /(?:\/\/|\/\*)\s*@ts-(ignore|nocheck)\b/.exec(text);
      if (m) hits.push({ line: i + 1, column: m.index + 1, message: `@ts-${m[1]} suppresses type checking.` });
    });
    return hits;
  }

  const source = ts.createSourceFile(file.path, file.content, ts.ScriptTarget.Latest, true, scriptKind(file.path));
  const hits: Hit[] = [];
  const at = (node: ts.Node, message?: string): void => {
    const { line, character } = source.getLineAndCharacterOfPosition(node.getStart(source));
    hits.push({ line: line + 1, column: character + 1, message });
  };

  const visit = (node: ts.Node): void => {
    switch (name) {
      case 'no-explicit-any':
        if (node.kind === ts.SyntaxKind.AnyKeyword) at(node);
        break;
      case 'no-non-null-assertion':
        if (ts.isNonNullExpression(node)) at(node);
        break;
      case 'no-empty-catch':
        if (ts.isCatchClause(node) && node.block.statements.length === 0 && !/\/[/*]/.test(node.block.getText(source))) {
          at(node, 'Empty catch block silently swallows the error.');
        }
        break;
      case 'no-console':
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          ts.isIdentifier(node.expression.expression) &&
          node.expression.expression.text === 'console'
        ) {
          at(node);
        }
        break;
      case 'no-default-export':
        if (ts.isExportAssignment(node) && !node.isExportEquals) at(node);
        else if (
          ts.canHaveModifiers(node) &&
          ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword) &&
          ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
        ) {
          at(node);
        }
        break;
      case 'no-index-key':
        if (
          ts.isJsxAttribute(node) &&
          node.name.getText(source) === 'key' &&
          node.initializer &&
          ts.isJsxExpression(node.initializer) &&
          node.initializer.expression &&
          ts.isIdentifier(node.initializer.expression) &&
          INDEX_KEY_NAMES.has(node.initializer.expression.text)
        ) {
          at(node, 'Array index used as a React key.');
        }
        break;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return hits;
}
