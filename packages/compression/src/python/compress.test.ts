import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WasmParser, type CodeParser } from '../parser/index.js';
import { compressPython, SYNTAX_ERROR_RAW_WARNING } from './compress.js';

const edge = (name: string): Buffer =>
  readFileSync(fileURLToPath(new URL(`../../../../fixtures/python-edge/${name}`, import.meta.url)));

describe('compressPython (S2-07 robustness)', () => {
  let parser: CodeParser;

  beforeAll(async () => {
    parser = await WasmParser.create(['python']);
  });

  afterAll(() => {
    parser.dispose?.();
  });

  it('returns unchanged raw content with a warning when hasSyntaxError', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../../../../fixtures/python-edge/syntax_error.py', import.meta.url)),
      'utf8',
    );
    const result = compressPython(parser, source);
    expect(result.level).toBe('raw');
    expect(result.content).toBe(source);
    expect(result.warning).toBe(SYNTAX_ERROR_RAW_WARNING);
  });

  it('compresses a valid file to signatures without a warning', () => {
    // Bodies must be longer than the omission marker or renderSignatures keeps them.
    const source = [
      'def add(a, b):',
      '    total = a + b',
      '    doubled = total * 2',
      '    return doubled',
      '',
      'def unused():',
      '    x = 1',
      '    y = x + 2',
      '    z = y * 3',
      '    return z',
      '',
    ].join('\n');
    const result = compressPython(parser, source);
    expect(result.level).toBe('signatures');
    expect(result.warning).toBeUndefined();
    expect(result.content).toContain('def add');
    expect(result.content).toContain('omitted');
    expect(result.content.length).toBeLessThan(source.length);
  });

  it('does not crash on CRLF, tabs, BOM, non-ASCII, or a very long line', () => {
    const fixtures = ['crlf.py', 'tabs.py', 'bom.py', 'non_ascii.py', 'long_line.py'] as const;
    for (const name of fixtures) {
      const bytes = edge(name);
      // BOM fixture is UTF-8 with a leading EF BB BF; decode as utf8 so the BOM becomes U+FEFF.
      const source = bytes.toString('utf8');
      expect(() => compressPython(parser, source), `fixture ${name}`).not.toThrow();
      const result = compressPython(parser, source);
      expect(result.language).toBe('python');
      expect(['raw', 'signatures']).toContain(result.level);
      if (result.level === 'raw') {
        expect(result.content).toBe(source);
        expect(result.warning).toBe(SYNTAX_ERROR_RAW_WARNING);
      }
    }
  });

  it('parses replacement characters from invalid UTF-8 without crashing', () => {
    // Invalid continuation byte → U+FFFD when decoded as UTF-8.
    const source = Buffer.from([
      0x64, 0x65, 0x66, 0x20, 0x66, 0x28, 0x29, 0x3a, 0x0a, 0x20, 0x20, 0x20, 0x20, 0x22, 0x80,
      0x22, 0x0a, 0x20, 0x20, 0x20, 0x20, 0x70, 0x61, 0x73, 0x73, 0x0a,
    ]).toString('utf8');
    expect(source).toContain('\uFFFD');
    expect(() => compressPython(parser, source)).not.toThrow();
  });

  it('handles a synthetic 5,000-line file and records parse + render timings', () => {
    const lines: string[] = ['# synthetic robustness fixture', ''];
    // ~5 lines per function → 1000 functions ≈ 5000+ lines; bodies long enough to omit.
    for (let i = 0; i < 1000; i++) {
      lines.push(`def fn_${i}(x):`);
      lines.push(`    """Docstring for function ${i} with enough text to stay."""`);
      lines.push(`    value = x + ${i}`);
      lines.push(`    doubled = value * 2`);
      lines.push(`    return doubled`);
      lines.push('');
    }
    const source = lines.join('\n');
    const lineCount = source.split('\n').length;
    expect(lineCount).toBeGreaterThanOrEqual(5000);

    const parseStarted = performance.now();
    const parsed = parser.parse(source, 'python');
    const parseMs = performance.now() - parseStarted;
    expect(parsed.hasSyntaxError).toBe(false);
    parsed.dispose();

    const renderStarted = performance.now();
    const result = compressPython(parser, source);
    const renderMs = performance.now() - renderStarted;

    expect(result.level).toBe('signatures');
    expect(result.warning).toBeUndefined();
    expect(result.content.length).toBeLessThan(source.length);

    // Printed so the PR can copy the timing table from CI / local evidence.
    console.log(
      JSON.stringify({
        case: 'synthetic-5000-line-python',
        lines: lineCount,
        bytes: Buffer.byteLength(source, 'utf8'),
        parseMs: Number(parseMs.toFixed(2)),
        compressMs: Number(renderMs.toFixed(2)),
      }),
    );

    // Soft ceiling: large but should stay interactive on a developer machine.
    expect(parseMs).toBeLessThan(30_000);
    expect(renderMs).toBeLessThan(30_000);
  });

  it('releases tree memory via dispose across 500 parse cycles', () => {
    const source = 'def f(n):\n    return n * 2\n';
    for (let i = 0; i < 500; i++) {
      const file = parser.parse(source, 'python');
      expect(file.hasSyntaxError).toBe(false);
      expect(file.root.type).toBe('module');
      file.dispose();
      expect(() => file.root).toThrowError(expect.objectContaining({ code: 'INTERNAL' }));
    }

    // One more compress after the loop: shared parser must still work.
    const result = compressPython(parser, source);
    expect(result.level).toBe('signatures');
  });
});
