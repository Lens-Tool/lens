import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SymbolNode } from '@lens/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WasmParser, withParsedFile, type CodeParser } from '../parser/index.js';
import { extractPythonSymbolsFromSource } from './extract.js';
import { renderSignatures } from './renderSignatures.js';

const FIXTURES = fileURLToPath(new URL('../../../../fixtures/', import.meta.url));

function pythonFiles(folder: string): string[] {
  const root = join(FIXTURES, folder);
  if (!existsSync(root)) return [];
  return (readdirSync(root, { recursive: true }) as string[])
    .filter((name) => name.endsWith('.py') && !name.includes('__pycache__'))
    .map((name) => join(root, name));
}

const isIntentionalError = (file: string): boolean => /syntax[-_]?error/i.test(basename(file));
const files = [
  ...pythonFiles('python'),
  ...pythonFiles('python-repo'),
  ...pythonFiles('python-edge'),
].filter((file) => !isIntentionalError(file));
const cases = files.map((file) => [relative(FIXTURES, file).replaceAll('\\', '/'), file] as const);

const flatten = (symbols: readonly SymbolNode[]): SymbolNode[] =>
  symbols.flatMap((s) => [s, ...flatten(s.children ?? [])]);

describe('renderSignatures', () => {
  let parser: CodeParser;
  const rows: { file: string; before: number; after: number }[] = [];

  beforeAll(async () => {
    parser = await WasmParser.create(['python']);
  });

  afterAll(() => {
    console.table(rows);
  });

  const hasSyntaxError = (text: string): boolean =>
    withParsedFile(parser, text, 'python', (file) => file.hasSyntaxError);

  it.each(cases)('%s still parses after rendering', (name, file) => {
    const source = readFileSync(file, 'utf8');
    const symbols = extractPythonSymbolsFromSource(parser, source);
    const output = renderSignatures(source, symbols);

    expect(hasSyntaxError(output)).toBe(false);
    rows.push({
      file: name,
      before: source.split(/\r?\n/).length,
      after: output.split(/\r?\n/).length,
    });
  });

  it('keeps the full body for chosen symbols', () => {
    const login = files.find((file) => basename(file) === 'login.py');
    expect(login).toBeDefined();
    const source = readFileSync(login as string, 'utf8');
    const symbols = extractPythonSymbolsFromSource(parser, source);
    const target = flatten(symbols).find((s) => s.kind === 'function' && s.body);
    expect(target).toBeDefined();

    const output = renderSignatures(source, symbols, {
      keepBodies: new Set([(target as SymbolNode).id]),
    });
    expect(output).not.toContain(`expand_symbol ${(target as SymbolNode).qualifiedName})`);
    expect(hasSyntaxError(output)).toBe(false);
  });
});
