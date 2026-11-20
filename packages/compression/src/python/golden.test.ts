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
);

describe('Python symbol extraction golden-file tests', () => {
  let parser: CodeParser;

  beforeAll(async () => {
    parser = await WasmParser.create(['python']);
  });

  it.each(cases)('matches golden file for $label', ({ fixturePath, goldenPath }) => {
    expect(existsSync(goldenPath)).toBe(true);

    const source = readFileSync(fixturePath, 'utf8');
    const expected = JSON.parse(readFileSync(goldenPath, 'utf8')) as {
      fixture: string;
      symbols: unknown;
    };

    const actualSymbols = extractPythonSymbolsFromSource(parser, source);
    expect(actualSymbols).toEqual(expected.symbols);
  });

  it('still returns symbols parsed from a file with syntax errors', () => {
    const syntaxErrorFile = join(FIXTURES_DIR, 'python-edge', 'syntax_error.py');
    const source = readFileSync(syntaxErrorFile, 'utf8');
    const symbols = extractPythonSymbolsFromSource(parser, source);

    expect(Array.isArray(symbols)).toBe(true);
    expect(symbols.length).toBeGreaterThan(0);
  });
});
