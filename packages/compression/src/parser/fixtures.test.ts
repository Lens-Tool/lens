import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import type { CodeParser } from './index.js';
import { WasmParser } from './index.js';

// Parses every Python fixture (S2-04) with the real parser. Valid files must parse without syntax
// errors; the file(s) named like "syntax_error" must be reported as broken. This catches fixtures
// that use syntax our pinned grammar cannot read, before the extractor is built on top of them.
const FIXTURES = fileURLToPath(new URL('../../../../fixtures/', import.meta.url));

function pythonFiles(folder: string): string[] {
  const root = join(FIXTURES, folder);
  if (!existsSync(root)) return [];
  return (readdirSync(root, { recursive: true }) as string[])
    .filter((name) => name.endsWith('.py') && !name.includes('__pycache__'))
    .map((name) => join(root, name));
}

const isIntentionalError = (file: string): boolean => /syntax[-_]?error/i.test(basename(file));
const files = [...pythonFiles('python-repo'), ...pythonFiles('python-edge')];
const cases = files.map((file) => [relative(FIXTURES, file).replaceAll('\\', '/'), file] as const);

describe('python fixtures', () => {
  let parser: CodeParser;
  beforeAll(async () => {
    parser = await WasmParser.create(['python']);
  });

  it('exist: a sample repo and edge cases', () => {
    expect(pythonFiles('python-repo').length).toBeGreaterThanOrEqual(6);
    expect(pythonFiles('python-edge').length).toBeGreaterThanOrEqual(8);
  });

  it('include at least one intentional syntax error and one CRLF file', () => {
    expect(files.some(isIntentionalError)).toBe(true);
    const crlf = files.filter((f) => /crlf/i.test(basename(f)));
    expect(crlf.length).toBeGreaterThan(0);
    for (const file of crlf) expect(readFileSync(file, 'utf8')).toContain('\r\n');
  });

  it('follow the file rules: no empty first line, a final newline (except two files)', () => {
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      const name = basename(file);
      if (name === 'empty_file.py') {
        expect(text, name).toBe('');
        continue;
      }
      expect(
        text.startsWith('\n') || text.startsWith('\r\n'),
        `${name} starts with an empty line`,
      ).toBe(false);
      expect(text.endsWith('\n'), `${name} final newline`).toBe(name !== 'no_final_newline.py');
    }
  });

  it.each(cases)('%s parses as intended', (_name, file) => {
    const parsed = parser.parse(readFileSync(file, 'utf8'), 'python');
    try {
      expect(parsed.hasSyntaxError).toBe(isIntentionalError(file));
    } finally {
      parsed.dispose();
    }
  });
});
