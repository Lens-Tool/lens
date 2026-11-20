import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { WasmParser, type CodeParser } from '../parser/index.js';
import { extractPythonSymbolsFromSource } from './extract.js';

const REPO_ROOT = fileURLToPath(new URL('../../../..', import.meta.url));
const FIXTURES_DIR = join(REPO_ROOT, 'fixtures');
const GOLDEN_DIR = join(REPO_ROOT, 'packages', 'compression', 'src', 'python', 'golden');
const SUITES = ['python', 'python-edge', 'python-repo'] as const;

// Fixtures that must NOT have a golden file: the extractor's output for them is known to be
// wrong, and a snapshot would lock the bug in.
// KNOWN BUG: a broken definition is misparsed (SampleService swallows __init__ in its
// signature and loses the child, calculate_total disappears).
// TODO: add the issue link here once it is opened.
const EXCLUDED = new Set(['python-edge/syntax_error.py']);

interface FixtureCase {
  label: string;
  fixturePath: string;
  goldenPath: string;
}

const cases: FixtureCase[] = SUITES.flatMap((suite) =>
  readdirSync(join(FIXTURES_DIR, suite))
    .filter((name) => name.endsWith('.py'))
    .sort()
    .map((name) => ({
      label: `${suite}/${name}`,
      fixturePath: join(FIXTURES_DIR, suite, name),
      goldenPath: join(GOLDEN_DIR, suite, name.replace(/\.py$/, '.symbols.json')),
    })),
).filter((c) => !EXCLUDED.has(c.label));

describe('Python symbol extraction golden-file tests', () => {
  let parser: CodeParser;

  beforeAll(async () => {
    parser = await WasmParser.create(['python']);
  });

  it.each(cases)('matches golden file for $label', ({ fixturePath, goldenPath }) => {
    expect(existsSync(goldenPath), `Missing golden file: ${goldenPath}`).toBe(true);

    const source = readFileSync(fixturePath, 'utf8');
    const expected = JSON.parse(readFileSync(goldenPath, 'utf8')) as {
      fixture: string;
      symbols: unknown;
    };

    const actualSymbols = extractPythonSymbolsFromSource(parser, source);
    expect(actualSymbols).toEqual(expected.symbols);
  });

  it('still returns a valid function that appears before a function with a syntax error', () => {
    const source = [
      'def good_before(a, b):',
      '    return a + b',
      '',
      'def broken(x)', // missing ':'
      '    pass',
      '',
    ].join('\n');

    const names = extractPythonSymbolsFromSource(parser, source).map((s) => s.name);

    expect(names).toContain('good_before');
  });
});
