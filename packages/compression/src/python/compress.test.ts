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

  it.each(['crlf.py', 'tabs.py', 'bom.py', 'non_ascii.py', 'long_line.py'])(
    'edge fixture %s is valid and compressed to signatures, never raw',
    (name) => {
      // The BOM fixture starts with EF BB BF; decoding as utf8 turns it into U+FEFF.
      const source = edge(name).toString('utf8');
      const result = compressPython(parser, source);
      expect(result.level).toBe('signatures');
      expect(result.warning).toBeUndefined();
      expect(result.content.length).toBeLessThanOrEqual(source.length);
    },
  );

  // The fixtures above have tiny bodies, which the renderer keeps. These variants have bodies long
  // enough to be replaced, so the line-ending, indentation and encoding handling is really used.
  const longBody = (indent: string, eol: string): string =>
    [1, 2, 3, 4, 5]
      .map((i) => `${indent}value_${i} = compute_something_long_enough_to_omit(argument, ${i})`)
      .join(eol);

  it.each([
    ['tabs', 'def f(argument):\n' + longBody('\t', '\n') + '\n\treturn value_5\n'],
    ['tabs + CRLF', 'def f(argument):\r\n' + longBody('\t', '\r\n') + '\r\n\treturn value_5\r\n'],
    ['BOM', '\uFEFFdef f(argument):\n' + longBody('    ', '\n') + '\n    return value_5\n'],
    [
      'BOM + CRLF',
      '\uFEFFdef f(argument):\r\n' + longBody('    ', '\r\n') + '\r\n    return 5\r\n',
    ],
    [
      'non-ASCII names',
      'def f(argument):\n' +
        longBody('    ', '\n').replaceAll('value', 'قيمة') +
        '\n    return 1\n',
    ],
    [
      'invalid UTF-8 (U+FFFD)',
      'def f(argument):\n' +
        longBody('    ', '\n') +
        '\n    text = "\uFFFD\uFFFD"\n    return text\n',
    ],
    [
      'very long line',
      `def f(argument):\n    data = [${Array.from({ length: 4000 }, (_, i) => i).join(', ')}]\n    return len(data)\n`,
    ],
  ])('replaces a long body correctly with %s', (_name, source) => {
    const result = compressPython(parser, source);
    expect(result.level).toBe('signatures');
    expect(result.content).toMatch(/\.\.\. # lens: lines \d+-\d+ omitted/);
    expect(result.content.length).toBeLessThan(source.length / 2);
    // The result must still parse, and every function must still have a body.
    const reparsed = parser.parse(result.content, 'python');
    try {
      expect(reparsed.hasSyntaxError).toBe(false);
      for (const fn of reparsed.root.descendantsOfType('function_definition')) {
        expect(fn.childForFieldName('body')?.text.trim()).not.toBe('');
      }
    } finally {
      reparsed.dispose();
    }
    // Line endings and a leading BOM are kept as they were.
    expect(result.content.includes('\r\n')).toBe(source.includes('\r\n'));
    expect(result.content.startsWith('\uFEFF')).toBe(source.startsWith('\uFEFF'));
  });

  it('invalid UTF-8 bytes become U+FFFD and the file is still compressed', () => {
    // 0x80 is an invalid UTF-8 byte; decoding as utf8 turns it into U+FFFD. Note that the original
    // bytes are therefore not preserved, not even at level raw: the connector reads files as utf8.
    const source = Buffer.from(
      'def f(argument):\n    first = compute_something_long_enough_to_omit(argument, 1)\n    second = compute_something_long_enough_to_omit(argument, 2)\n    return "\x80"\n',
      'latin1',
    ).toString('utf8');
    expect(source).toContain('\uFFFD');
    const result = compressPython(parser, source);
    expect(result.level).toBe('signatures');
    expect(result.warning).toBeUndefined();
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

    // Measured: about 25 ms parse and 30 ms compress for 6,000 lines. A ceiling about 100 times
    // higher still catches an accidental quadratic algorithm without making CI flaky.
    expect(parseMs).toBeLessThan(3_000);
    expect(renderMs).toBeLessThan(3_000);
  });

  it('releases tree memory via dispose across 500 parse cycles', () => {
    const source = 'def f(n):\n    return n * 2\n';
    for (let i = 0; i < 500; i++) {
      const file = parser.parse(source, 'python');
      expect(file.hasSyntaxError).toBe(false);
      file.dispose();
      expect(() => file.root).toThrowError(expect.objectContaining({ code: 'INTERNAL' }));
    }
    // One more compress after the loop: the shared parser must still work.
    expect(compressPython(parser, source).level).toBe('signatures');
  });

  it('does not grow memory over 500 compressions of an 850-line file', () => {
    // Without dispose() this loop leaks about 300 MB (measured), because WASM trees are not garbage
    // collected. The file must be large enough for a leak to show: tiny files hide it.
    const source = Array.from(
      { length: 280 },
      (_, i) => `def fn_${i}(x):\n    value = x + ${i}\n    return value\n`,
    ).join('\n');
    for (let i = 0; i < 20; i++) compressPython(parser, source); // warm-up
    const before = process.memoryUsage().rss;
    for (let i = 0; i < 500; i++) compressPython(parser, source);
    const growthMb = (process.memoryUsage().rss - before) / 1_048_576;
    expect(growthMb).toBeLessThan(100);
  });
});
