import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Parser from 'web-tree-sitter';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { CodeParser } from './index.js';
import { GRAMMAR_FILES, WasmParser } from './index.js';
import { GRAMMARS_DIR } from './grammars.js';

const loginPy = readFileSync(
  fileURLToPath(new URL('../../../../fixtures/python/login.py', import.meta.url)),
  'utf8',
);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('WasmParser (python)', () => {
  let parser: CodeParser;
  beforeAll(async () => {
    parser = await WasmParser.create(['python']);
  });

  it('parses login.py through the CodeParser interface without syntax errors', () => {
    const file = parser.parse(loginPy, 'python');
    try {
      expect(file.hasSyntaxError).toBe(false);
      expect(file.language).toBe('python');
      expect(file.root.type).toBe('module');
      expect(file.root.namedChildren.some((n) => n.type === 'function_definition')).toBe(true);
    } finally {
      file.dispose();
    }
  });

  it('parses Windows (CRLF) line endings and an empty file', () => {
    const crlf = parser.parse(loginPy.replace(/\n/g, '\r\n'), 'python');
    const empty = parser.parse('', 'python');
    expect(crlf.hasSyntaxError).toBe(false);
    expect(empty.hasSyntaxError).toBe(false);
    crlf.dispose();
    empty.dispose();
  });

  it('flags a deliberate syntax error', () => {
    const file = parser.parse('def broken(:\n  pass\n', 'python');
    expect(file.hasSyntaxError).toBe(true);
    file.dispose();
  });

  it('dispose() can be called twice and invalidates root', () => {
    const file = parser.parse('x = 1\n', 'python');
    file.dispose();
    expect(() => file.dispose()).not.toThrow();
    expect(() => file.root).toThrowError(expect.objectContaining({ code: 'INTERNAL' }));
  });

  it('keeps several parsed files alive at the same time', () => {
    const a = parser.parse('a = 1\n', 'python');
    const b = parser.parse('def f():\n  pass\n', 'python');
    expect(a.root.text).toBe('a = 1\n');
    expect(b.root.firstNamedChild?.type).toBe('function_definition');
    a.dispose();
    b.dispose();
  });
});

describe('grammar loading', () => {
  it('fails clearly when the grammar was not loaded', async () => {
    const fresh = await WasmParser.create();
    expect(() => fresh.parse('x = 1', 'python')).toThrowError(/not loaded/);
  });

  it('rejects a language with no bundled grammar', async () => {
    const fresh = await WasmParser.create();
    await expect(fresh.load('javascript')).rejects.toMatchObject({ code: 'UNSUPPORTED_LANGUAGE' });
  });

  it('loads each grammar only once, even for concurrent calls', async () => {
    const spy = vi.spyOn(Parser.Language, 'load');
    const fresh = await WasmParser.create();
    await Promise.all([fresh.load('python'), fresh.load('python')]);
    await fresh.load('python');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does not put file paths in grammar load errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(Parser.Language, 'load').mockRejectedValueOnce(
      new Error("ENOENT: open 'C:\\Users\\someone\\lens\\grammars\\tree-sitter-python.wasm'"),
    );
    const fresh = await WasmParser.create();
    const error = await fresh.load('python').catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'INTERNAL' });
    expect((error as Error).message).not.toContain('someone');
    expect((error as Error).message).not.toContain('C:');
  });
});

describe('bundled grammars', () => {
  it('contains only grammar files the loader lists, and each one is listed', () => {
    const listed = Object.values(GRAMMAR_FILES);
    const bundled = readdirSync(GRAMMARS_DIR).filter((f) => f.endsWith('.wasm'));
    expect([...bundled].sort()).toEqual([...listed].sort());
    for (const file of bundled) {
      expect(statSync(join(GRAMMARS_DIR, file)).size).toBeLessThan(3 * 1024 * 1024);
    }
  });
});
