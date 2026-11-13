import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SymbolNode } from '@lens/shared';
import { beforeAll, describe, expect, it } from 'vitest';
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

const LONG_MARKER = /^(\s*)\.\.\. # lens: lines (\d+)-(\d+) omitted \(expand_symbol (.+)\)$/;

describe('renderSignatures', () => {
  let parser: CodeParser;
  beforeAll(async () => {
    parser = await WasmParser.create(['python']);
  });

  const symbolsOf = (source: string): SymbolNode[] =>
    extractPythonSymbolsFromSource(parser, source);
  const render = (source: string, options?: Parameters<typeof renderSignatures>[2]): string =>
    renderSignatures(source, symbolsOf(source), options);

  /** tree-sitter does not flag `def f():` without a body, so check every body explicitly. */
  const problems = (text: string): string[] =>
    withParsedFile(parser, text, 'python', (file) => {
      const found: string[] = [];
      if (file.hasSyntaxError) found.push('syntax error');
      for (const node of file.root.descendantsOfType(['function_definition', 'class_definition'])) {
        if (!node.childForFieldName('body')?.text.trim()) {
          found.push(`empty body: ${node.childForFieldName('name')?.text}`);
        }
      }
      return found;
    });

  /** Puts every omitted body back, the way expand_symbol would. */
  const expand = (rendered: string, original: string): string => {
    const originalLines = original.split(/\r?\n/);
    return rendered
      .split(/\r?\n/)
      .flatMap((line) => {
        const m = LONG_MARKER.exec(line);
        return m ? originalLines.slice(Number(m[2]) - 1, Number(m[3])) : [line];
      })
      .join('\n');
  };
  const normalised = (text: string): string => text.replace(/\r\n/g, '\n');

  describe.each(cases)('%s', (_name, file) => {
    const source = readFileSync(file, 'utf8');

    it('is valid Python with a body in every function and class', () => {
      expect(problems(render(source))).toEqual([]);
      expect(problems(render(source, { marker: 'short' }))).toEqual([]);
    });

    it('can be expanded back to the original text exactly', () => {
      expect(expand(render(source), source)).toBe(normalised(source));
    });
  });

  it('replaces the body of methods, not only of functions', () => {
    const source = `class Cache:
    def get(self, key):
        value = self.items.get(key, self.default_value_for_missing_keys)
        return value

    @property
    def size(self):
        total = len(self.items) + len(self.pending_items_waiting_to_be_saved)
        return total


def helper(x):
    y = x + compute_the_offset_for_this_particular_input(x)
    return y
`;
    const lines = render(source).split('\n');
    expect(lines.filter((l) => LONG_MARKER.test(l))).toEqual([
      '        ... # lens: lines 3-4 omitted (expand_symbol Cache.get)',
      '        ... # lens: lines 8-9 omitted (expand_symbol Cache.size)',
      '    ... # lens: lines 13-14 omitted (expand_symbol helper)',
    ]);
    expect(lines).toContain('    @property');
    expect(lines).toContain('    def size(self):');
    expect(lines).not.toContain('        return value');
  });

  it('replaces every long body of the sample repo and keeps the tiny ones', () => {
    for (const file of pythonFiles('python-repo')) {
      const source = readFileSync(file, 'utf8');
      const lines = source.split('\n');
      const rendered = render(source);
      for (const symbol of flatten(symbolsOf(source))) {
        if (symbol.kind === 'class' || !symbol.body) continue;
        const bodyText = lines
          .slice(symbol.body.startLine - 1, symbol.body.endLine)
          .join('\n')
          .trim();
        const marker = `lines ${symbol.body.startLine}-${symbol.body.endLine} omitted (expand_symbol ${symbol.qualifiedName})`;
        if (bodyText.length > 200)
          expect(rendered, `${basename(file)} ${symbol.qualifiedName}`).toContain(marker);
        if (bodyText.length < 20)
          expect(rendered, `${basename(file)} ${symbol.qualifiedName}`).not.toContain(marker);
      }
    }
  });

  it('keeps tiny bodies as they are, for both marker styles', () => {
    const source = 'def one(x):\n    return x\n';
    expect(render(source)).toBe(source);
    expect(render(source, { marker: 'short' })).toBe(source);
  });

  it('never makes a file larger', () => {
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(render(source).length, basename(file)).toBeLessThanOrEqual(source.length);
      expect(render(source, { marker: 'short' }).length, basename(file)).toBeLessThanOrEqual(
        source.length,
      );
    }
  });

  it('keeps decorators, imports, variables, docstrings and comments outside bodies', () => {
    const source = `import os
LIMIT = 5  # max


# helper
@decorate(times=2)
def work(a, b):
    """Does the work.

    More detail.
    """
    first = a + b + compute_offset_for_this_input(a, b)
    return first
`;
    const output = render(source);
    for (const kept of [
      'import os',
      'LIMIT = 5  # max',
      '# helper',
      '@decorate(times=2)',
      'def work(a, b):',
      '    """Does the work.',
      '    More detail.',
    ]) {
      expect(output).toContain(kept);
    }
    expect(output).toContain('... # lens: lines 12-13 omitted (expand_symbol work)');
    expect(output).not.toContain('first = a + b + compute');
  });

  it('keepBodies keeps the full body of the chosen symbols only', () => {
    const source = `class A:
    def one(self):
        a = compute_first_value_for_this_example(1)
        return a

    def two(self):
        b = compute_second_value_for_this_example(2)
        return b
`;
    const symbols = symbolsOf(source);
    const one = flatten(symbols).find((s) => s.qualifiedName === 'A.one');
    const output = renderSignatures(source, symbols, { keepBodies: new Set([one?.id ?? '']) });
    expect(output).toContain(
      '        a = compute_first_value_for_this_example(1)\n        return a',
    );
    expect(output).toContain('... # lens: lines 7-8 omitted (expand_symbol A.two)');
    expect(output).not.toContain('b = compute_second');
    expect(problems(output)).toEqual([]);
  });

  it('short marker: "... # L<from>-<to>" with the original line numbers', () => {
    const source = 'def f(x):\n    y = x\n    return y\n';
    expect(render(source, { marker: 'short' })).toBe('def f(x):\n    ... # L2-3\n');
  });

  it('keeps Windows line endings', () => {
    const source =
      'def f(x):\r\n    y = x + compute_the_offset_for_this_particular_input(x)\r\n    return y\r\n';
    const output = render(source);
    expect(output).toBe('def f(x):\r\n    ... # lens: lines 2-3 omitted (expand_symbol f)\r\n');
  });

  it('output is smaller than the input for the sample repo', () => {
    let before = 0;
    let after = 0;
    for (const file of pythonFiles('python-repo')) {
      const source = readFileSync(file, 'utf8');
      before += source.length;
      after += render(source).length;
    }
    expect(after).toBeLessThan(before * 0.8);
  });
});
