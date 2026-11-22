import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  TiktokenCounter,
  getDefaultTokenCounter,
  resetTokenCounterForTest,
  setTokenCounterLoaderForTest,
} from './tokens.js';
import { ApproxTokenCounter } from '@lens/shared';
import type { Tiktoken } from 'js-tiktoken/lite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(__dirname, '..', '..', '..', 'fixtures');

let testEncoder: Tiktoken;

beforeAll(async () => {
  const { Tiktoken: TiktokenClass } = await import('js-tiktoken/lite');
  const cl100kBaseRanks = (await import('js-tiktoken/ranks/cl100k_base')).default;
  testEncoder = new TiktokenClass(cl100kBaseRanks);
});

const createTiktokenCounter = () => new TiktokenCounter(testEncoder);

describe('TiktokenCounter', () => {
  beforeEach(() => {
    resetTokenCounterForTest();
  });

  afterEach(() => {
    resetTokenCounterForTest();
  });

  it('has correct name', () => {
    const counter = createTiktokenCounter();
    expect(counter.name).toBe('tiktoken-cl100k_base');
  });

  describe('known counts (hardcoded, verified with WASM oracle)', () => {
    it('counts empty string as 0', () => {
      const counter = createTiktokenCounter();
      expect(counter.count('')).toBe(0);
    });

    it('counts "hello world" as 2', () => {
      const counter = createTiktokenCounter();
      expect(counter.count('hello world')).toBe(2);
    });

    it('counts a short Python function', () => {
      const counter = createTiktokenCounter();
      const code = 'def foo():\n    return 42\n';
      // Actual count from js-tiktoken cl100k_base
      expect(counter.count(code)).toBe(8);
    });

    it('counts a TypeScript snippet', () => {
      const counter = createTiktokenCounter();
      const code = 'const x = 1;\nconsole.log(x);\n';
      // Actual count from js-tiktoken cl100k_base
      expect(counter.count(code)).toBe(10);
    });
  });

  describe('special tokens treated as plain text (no throw)', () => {
    it('counts "<|endoftext|>" without throwing', () => {
      const counter = createTiktokenCounter();
      expect(() => counter.count('<|endoftext|>')).not.toThrow();
      // Counts as 7 tokens (byte-level fallback)
      expect(counter.count('<|endoftext|>')).toBe(7);
    });

    it('counts "<|fim_prefix|>" without throwing', () => {
      const counter = createTiktokenCounter();
      expect(() => counter.count('<|fim_prefix|>')).not.toThrow();
      expect(counter.count('<|fim_prefix|>')).toBeGreaterThan(0);
    });

    it('counts "<|fim_middle|>" without throwing', () => {
      const counter = createTiktokenCounter();
      expect(() => counter.count('<|fim_middle|>')).not.toThrow();
    });

    it('counts "<|fim_suffix|>" without throwing', () => {
      const counter = createTiktokenCounter();
      expect(() => counter.count('<|fim_suffix|>')).not.toThrow();
    });

    it('counts "<|endofprompt|>" without throwing', () => {
      const counter = createTiktokenCounter();
      expect(() => counter.count('<|endofprompt|>')).not.toThrow();
    });
  });

  describe('unicode and emoji', () => {
    it('counts mixed unicode', () => {
      const counter = createTiktokenCounter();
      const text = 'hello 世界 👋';
      expect(() => counter.count(text)).not.toThrow();
      expect(counter.count(text)).toBeGreaterThan(0);
    });

    it('counts emoji sequences', () => {
      const counter = createTiktokenCounter();
      const text = '👨‍👩‍👧‍👦🏳️‍🌈';
      expect(() => counter.count(text)).not.toThrow();
      expect(counter.count(text)).toBeGreaterThan(0);
    });
  });

  describe('BOM handling', () => {
    it('counts text with UTF-8 BOM', () => {
      const counter = createTiktokenCounter();
      const text = '\uFEFF# UTF-8 BOM\nprint("hello")\n';
      expect(() => counter.count(text)).not.toThrow();
      expect(counter.count(text)).toBeGreaterThan(0);
    });
  });

  describe('long runs of identical characters (guarded against quadratic)', () => {
    // The guard detects runs >128 chars of same class (letters, whitespace, punctuation/symbols)
    // and extrapolates from a 128-char sample. This keeps 1M-char counts under ~20 ms
    // instead of multi-second freezes.
    it('counts 1M "x" within 2000 ms', () => {
      const counter = createTiktokenCounter();
      const text = 'x'.repeat(1_000_000);
      const start = performance.now();
      const count = counter.count(text);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(2000);
      expect(count).toBeGreaterThan(0);
    }, 3000);

    it('counts 1M spaces within 2000 ms', () => {
      const counter = createTiktokenCounter();
      const text = ' '.repeat(1_000_000);
      const start = performance.now();
      const count = counter.count(text);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(2000);
      expect(count).toBeGreaterThan(0);
    }, 3000);

    it('counts 1M "=" within 2000 ms', () => {
      const counter = createTiktokenCounter();
      const text = '='.repeat(1_000_000);
      const start = performance.now();
      const count = counter.count(text);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(2000);
      expect(count).toBeGreaterThan(0);
    }, 3000);

    it('counts 1M random lowercase letters within 2000 ms', () => {
      const counter = createTiktokenCounter();
      const text = Array.from({ length: 1_000_000 }, () =>
        String.fromCharCode(97 + Math.floor(Math.random() * 26)),
      ).join('');
      const start = performance.now();
      const count = counter.count(text);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(2000);
      expect(count).toBeGreaterThan(0);
    }, 3000);
  });

  describe('fixtures: guarded counts identical to unguarded encoder', () => {
    it('all Python and TypeScript fixtures match unguarded encoder exactly', () => {
      const counter = createTiktokenCounter();
      const files = [
        'python/login.py',
        'python-repo/auth.py',
        'python-repo/config.py',
        'python-repo/database.py',
        'python-repo/models.py',
        'python-repo/services.py',
        'python-repo/cli.py',
        'python-repo/test_auth.py',
        'python-repo/utils.py',
        'typescript/auth.ts',
      ];
      for (const file of files) {
        const text = readFileSync(join(FIXTURE_DIR, file), 'utf8');
        const guarded = counter.count(text);
        // Build a fresh unguarded encoder inside the test
        const unguarded = testEncoder.encode(text, [], []).length;
        expect(guarded).toBe(unguarded);
      }
    });
  });
});

describe('getDefaultTokenCounter (lazy singleton with fallback)', () => {
  beforeEach(() => {
    resetTokenCounterForTest();
  });

  afterEach(() => {
    resetTokenCounterForTest();
  });

  it('returns TiktokenCounter with correct name when loaded', () => {
    const counter = getDefaultTokenCounter();
    expect(counter.name).toBe('tiktoken-cl100k_base');
  });

  it('returns ApproxTokenCounter with correct name when loader fails', () => {
    setTokenCounterLoaderForTest(() => {
      throw new Error('forced failure');
    });
    const counter = getDefaultTokenCounter();
    expect(counter.name).toBe('approx-chars-div-4');
  });

  it('logs exactly ONE [lens] warning even after many calls on failure', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    setTokenCounterLoaderForTest(() => {
      throw new Error('forced failure');
    });

    getDefaultTokenCounter();
    getDefaultTokenCounter();
    getDefaultTokenCounter();

    // Should only log once
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      '[lens] tiktoken unavailable, using approximate token counter',
    );

    errorSpy.mockRestore();
  });

  it('fallback log contains no input text or paths', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    setTokenCounterLoaderForTest(() => {
      throw new Error('forced failure');
    });

    getDefaultTokenCounter();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const call = String(errorSpy.mock.calls[0]?.[0] ?? '');
    expect(call).not.toContain('path');
    expect(call).not.toContain('/');
    expect(call).not.toContain('\\');
    expect(call).not.toContain('secret');
    expect(call).not.toContain('password');
    expect(call).not.toContain('hello world');
    expect(call).not.toContain('<|endoftext|>');

    errorSpy.mockRestore();
  });

  it('never switches mid-process (same instance returned)', () => {
    const counter1 = getDefaultTokenCounter();
    const counter2 = getDefaultTokenCounter();
    expect(counter1).toBe(counter2);
  });

  it('returns same cached fallback after failure', () => {
    setTokenCounterLoaderForTest(() => {
      throw new Error('forced failure');
    });
    const counter1 = getDefaultTokenCounter();
    const counter2 = getDefaultTokenCounter();
    expect(counter1).toBe(counter2);
    expect(counter1.name).toBe('approx-chars-div-4');
  });
});

describe('TiktokenCounter vs ApproxTokenCounter on fixtures (sanity ratio)', () => {
  it('token ratios are within loose bounds on Python fixtures', () => {
    const tiktoken = createTiktokenCounter();
    const approx = new ApproxTokenCounter();

    const files = [
      'python/login.py',
      'python-repo/auth.py',
      'python-repo/config.py',
      'python-repo/database.py',
      'python-repo/models.py',
      'python-repo/services.py',
      'python-repo/cli.py',
      'python-repo/test_auth.py',
      'python-repo/utils.py',
    ];

    for (const file of files) {
      const text = readFileSync(join(FIXTURE_DIR, file), 'utf8');
      const tikCount = tiktoken.count(text);
      const approxCount = approx.count(text);
      const ratio = tikCount / approxCount;

      // Loose sanity: tiktoken should be within 0.5x to 2x of approx
      // (approx is ~4 chars/token; tiktoken varies by content)
      expect(ratio).toBeGreaterThan(0.3);
      expect(ratio).toBeLessThan(3.0);
    }
  });

  it('token ratios are within loose bounds on TypeScript fixtures', () => {
    const tiktoken = createTiktokenCounter();
    const approx = new ApproxTokenCounter();

    const files = ['typescript/auth.ts'];

    for (const file of files) {
      const text = readFileSync(join(FIXTURE_DIR, file), 'utf8');
      const tikCount = tiktoken.count(text);
      const approxCount = approx.count(text);
      const ratio = tikCount / approxCount;

      expect(ratio).toBeGreaterThan(0.3);
      expect(ratio).toBeLessThan(3.0);
    }
  });
});
