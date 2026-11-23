import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  TiktokenCounter,
  createCounterProvider,
  createTokenCounter,
  getDefaultTokenCounter,
  loadCl100kEncoder,
} from './tokens.js';
import { ApproxTokenCounter } from '@lens/shared';
import type { Tiktoken } from 'js-tiktoken/lite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(__dirname, '..', '..', '..', 'fixtures');

// The raw (unguarded) encoder is the reference for the guard tests below.
let rawEncoder: Tiktoken;
const rawCount = (text: string) => rawEncoder.encode(text, [], []).length;

beforeAll(() => {
  rawEncoder = loadCl100kEncoder();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const counter = () => new TiktokenCounter(rawEncoder);

function allFixtureFiles(): string[] {
  return (readdirSync(FIXTURE_DIR, { recursive: true }) as string[])
    .map((f) => join(FIXTURE_DIR, f))
    .filter((f) => statSync(f).isFile());
}

describe('TiktokenCounter: known counts', () => {
  it('has the expected name', () => {
    expect(counter().name).toBe('tiktoken-cl100k_base');
  });

  it('matches the documented tiktoken example: "tiktoken is great!" is 6 tokens', () => {
    // OpenAI cookbook, "How to count tokens with tiktoken" (cl100k_base).
    // The ids were also checked against the official WASM `tiktoken` package.
    expect(rawEncoder.encode('tiktoken is great!', [], [])).toEqual([83, 1609, 5963, 374, 2294, 0]);
    expect(counter().count('tiktoken is great!')).toBe(6);
  });

  it.each([
    ['', 0],
    ['hello world', 2],
    ['def foo():\n    return 42\n', 8],
    ['const x = 1;\nconsole.log(x);\n', 10],
  ])('counts %j as %i', (text, expected) => {
    expect(counter().count(text)).toBe(expected);
  });
});

describe('TiktokenCounter: special tokens, unicode, BOM never throw', () => {
  it('counts "<|endoftext|>" as 7 plain-text tokens', () => {
    expect(counter().count('<|endoftext|>')).toBe(7);
  });

  it.each(['<|fim_prefix|>', '<|fim_middle|>', '<|fim_suffix|>', '<|endofprompt|>'])(
    'counts %s as plain text without throwing',
    (text) => {
      expect(() => counter().count(text)).not.toThrow();
      expect(counter().count(text)).toBeGreaterThan(1);
    },
  );

  it.each([
    ['mixed unicode', 'hello 世界 👋'],
    ['emoji sequences', '👨‍👩‍👧‍👦🏳️‍🌈'],
    ['UTF-8 BOM', '\uFEFF# UTF-8 BOM\nprint("hello")\n'],
    ['lone surrogate', 'a\uD800b'],
  ])('%s', (_label, text) => {
    expect(() => counter().count(text)).not.toThrow();
    expect(counter().count(text)).toBeGreaterThan(0);
  });
});

describe('TiktokenCounter: guard for long runs of one character class', () => {
  it('is exact up to the threshold: a 128-char run equals the unguarded encoder', () => {
    for (const ch of ['x', ' ', '=']) {
      const text = ch.repeat(128);
      expect(counter().count(text)).toBe(rawCount(text));
    }
  });

  it('gives a known count for a long run (5,000 x is 625 tokens, same as the official encoder)', () => {
    expect(counter().count('x'.repeat(5000))).toBe(625);
  });

  // Runs of 300-2,000 chars are still cheap for the unguarded encoder, so we can compare.
  // Allowed error: 2 tokens or 2%, whichever is larger (boundary tokens at the run edges).
  it.each(['x', ' ', '=', '-'])('stays close to the unguarded encoder for runs of %j', (ch) => {
    for (const n of [300, 1000, 2000]) {
      const text = ch.repeat(n);
      const expected = rawCount(text);
      const actual = counter().count(text);
      expect(Math.abs(actual - expected)).toBeLessThanOrEqual(Math.max(2, expected * 0.02));
    }
  });

  it('stays close to the unguarded encoder for a long run inside normal code', () => {
    const text =
      'def f():\n    x = "' + 'a'.repeat(400) + '"\n    return x  # ' + '='.repeat(300) + '\n';
    const expected = rawCount(text);
    expect(Math.abs(counter().count(text) - expected)).toBeLessThanOrEqual(
      Math.max(2, expected * 0.02),
    );
  });

  // Documents the known weak spot from ADR 0010: periodic letter runs are over-estimated.
  it('over-estimates periodic letters, but stays within the documented bound (+70%)', () => {
    const text = 'abcdefghijklmnopqrstuvwxyz'.repeat(100);
    const ratio = counter().count(text) / rawCount(text);
    expect(ratio).toBeGreaterThan(1);
    expect(ratio).toBeLessThan(1.7);
  });

  it.each([
    ['x', () => 'x'.repeat(1_000_000)],
    ['space', () => ' '.repeat(1_000_000)],
    ['=', () => '='.repeat(1_000_000)],
    [
      'random letters',
      () =>
        Array.from({ length: 1_000_000 }, () =>
          String.fromCharCode(97 + Math.floor(Math.random() * 26)),
        ).join(''),
    ],
  ])(
    'counts 1M chars of %s within 2 s',
    (_label, make) => {
      const text = make();
      const start = performance.now();
      const count = counter().count(text);
      expect(performance.now() - start).toBeLessThan(2000);
      expect(count).toBeGreaterThan(0);
    },
    10_000,
  );
});

describe('TiktokenCounter on the fixtures', () => {
  it('guarded counts equal the unguarded encoder on every fixture file', () => {
    const files = allFixtureFiles();
    expect(files.length).toBeGreaterThan(20);
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      expect(counter().count(text), file).toBe(rawCount(text));
    }
  });

  it('is on average ~0.85x the approximate counter on the fixtures (0.75 to 0.95)', () => {
    const approx = new ApproxTokenCounter();
    let real = 0;
    let rough = 0;
    for (const file of allFixtureFiles()) {
      const text = readFileSync(file, 'utf8');
      real += counter().count(text);
      rough += approx.count(text);
      // Per-file sanity: measured range is 0.52 to 1.47.
      if (text.length > 0) {
        const ratio = counter().count(text) / approx.count(text);
        expect(ratio, file).toBeGreaterThan(0.4);
        expect(ratio, file).toBeLessThan(1.8);
      }
    }
    expect(real / rough).toBeGreaterThan(0.75);
    expect(real / rough).toBeLessThan(0.95);
  });
});

describe('createTokenCounter / fallback', () => {
  const FALLBACK_LOG = '[lens] tiktoken unavailable, using approximate token counter';

  it('returns the tiktoken counter when loading works, and logs nothing', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = createTokenCounter();
    expect(result.name).toBe('tiktoken-cl100k_base');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('falls back to ApproxTokenCounter and logs one fixed line when the loader throws', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = createTokenCounter(() => {
      throw new Error('forced failure');
    });
    expect(result).toBeInstanceOf(ApproxTokenCounter);
    expect(result.name).toBe('approx-chars-div-4');
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(FALLBACK_LOG);
  });

  it('falls back when the library is really missing (real MODULE_NOT_FOUND), without leaking the error', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const require = createRequire(import.meta.url);
    const result = createTokenCounter(() => require('js-tiktoken-not-installed-for-test'));
    expect(result.name).toBe('approx-chars-div-4');
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0]).toEqual([FALLBACK_LOG]);
  });

  it('falls back when the encoder loads but is broken (smoke test fails)', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken = {
      encode: () => {
        throw new Error('broken');
      },
    } as unknown as Tiktoken;
    expect(createTokenCounter(() => broken).name).toBe('approx-chars-div-4');
  });

  it('writes the log to stderr only, never to stdout (stdout is the MCP protocol)', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    createTokenCounter(() => {
      throw new Error('forced failure');
    });
    expect(logSpy).not.toHaveBeenCalled();
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it('fallback log has no paths, user names or input text', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    createTokenCounter(() => {
      throw new Error('C:\\Users\\someone\\secret\\file.py');
    });
    const logged = String(errorSpy.mock.calls[0]?.[0]);
    expect(logged).toBe(FALLBACK_LOG);
    expect(logged).not.toMatch(/[\\/]/);
  });
});

describe('createCounterProvider / getDefaultTokenCounter (singleton)', () => {
  it('returns the same instance on every call', () => {
    expect(getDefaultTokenCounter()).toBe(getDefaultTokenCounter());
    expect(getDefaultTokenCounter().name).toBe('tiktoken-cl100k_base');
  });

  it('loads once and logs once, even after many calls, when loading fails', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const load = vi.fn(() => {
      throw new Error('forced failure');
    });
    const get = createCounterProvider(load);
    const first = get();
    get();
    get();
    expect(get()).toBe(first);
    expect(first.name).toBe('approx-chars-div-4');
    expect(load).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('does not load anything until the first call (lazy)', () => {
    const load = vi.fn(() => rawEncoder);
    const get = createCounterProvider(load);
    expect(load).not.toHaveBeenCalled();
    get();
    expect(load).toHaveBeenCalledTimes(1);
  });
});

describe('regression: js-tiktoken must not be a top-level (static) import', () => {
  // A static `import ... from 'js-tiktoken/...'` makes the whole package fail to load when
  // the library is missing, before any fallback can run. Only `import type` is allowed.
  it('tokens.ts imports js-tiktoken as types only', () => {
    const source = readFileSync(join(__dirname, 'tokens.ts'), 'utf8');
    const valueImports = source
      .split('\n')
      .filter((line) => /^import\s/.test(line) && line.includes('js-tiktoken'))
      .filter((line) => !/^import\s+type\s/.test(line));
    expect(valueImports).toEqual([]);
  });
});
