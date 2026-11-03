import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import type { SymbolNode } from '@lens/shared';
import { WasmParser, type CodeParser } from '../parser/index.js';
import { extractPythonSymbolsFromSource } from './extract.js';

// Python snippets are written inline. `py` removes the first newline so line 1 is the first line.
const py = (code: string): string => code.replace(/^\n/, '');

describe('extractPythonSymbols', () => {
  let parser: CodeParser;
  beforeAll(async () => {
    parser = await WasmParser.create(['python']);
  });
  const extract = (code: string): SymbolNode[] => extractPythonSymbolsFromSource(parser, py(code));
  const first = (code: string): SymbolNode => {
    const symbol = extract(code)[0];
    if (!symbol) throw new Error('expected at least one symbol');
    return symbol;
  };

  it('plain function: signature, docstring, lines and body', () => {
    expect(
      first(`
def add(a, b):
    """Add two numbers."""
    return a + b
`),
    ).toEqual({
      id: 'add:function',
      name: 'add',
      qualifiedName: 'add',
      kind: 'function',
      language: 'python',
      startLine: 1,
      endLine: 3,
      signature: 'def add(a, b)',
      docstring: 'Add two numbers.',
      exported: true,
      body: { startLine: 3, endLine: 3 },
    });
  });

  it('function without a docstring: body starts right after the header', () => {
    const f = first(`
def f(x):
    y = x
    return y
`);
    expect(f.docstring).toBeUndefined();
    expect(f.body).toEqual({ startLine: 2, endLine: 3 });
  });

  it('docstring-only function has nothing to drop', () => {
    const f = first(`
def f():
    """Only the docstring."""
`);
    expect(f.docstring).toBe('Only the docstring.');
    expect(f.body).toBeUndefined();
  });

  it('one-line body has no body range', () => {
    expect(first('def f(): return 1\n').body).toBeUndefined();
  });

  it('async def', () => {
    const f = first(`
async def fetch(url: str):
    return url
`);
    expect(f.signature).toBe('async def fetch(url: str)');
    expect(f.kind).toBe('function');
  });

  it('return type is part of the signature, the colon is not', () => {
    expect(
      first(`
def f(a: int) -> dict[str, int]:
    return {}
`).signature,
    ).toBe('def f(a: int) -> dict[str, int]');
  });

  it('a comment after the colon is not part of the signature', () => {
    expect(
      first(`
def f(a):  # note
    return a
`).signature,
    ).toBe('def f(a)');
  });

  it('multi-line parameters', () => {
    const f = first(`
def f(
    a,
    b,
) -> int:
    return 1
`);
    expect(f.signature).toBe('def f(\n    a,\n    b,\n) -> int');
    expect(f.body).toEqual({ startLine: 5, endLine: 5 });
  });

  it('decorated function keeps every decorator line in signature and range', () => {
    const f = first(`
@app.route("/x", methods=["GET"])
@cache
def handler(req):
    return 1
`);
    expect(f.signature).toBe('@app.route("/x", methods=["GET"])\n@cache\ndef handler(req)');
    expect([f.startLine, f.endLine]).toEqual([1, 4]);
    expect(f.body).toEqual({ startLine: 4, endLine: 4 });
  });

  it('decorated async function', () => {
    const f = first(`
@retry(times=3)
async def job():
    pass
`);
    expect(f.signature).toBe('@retry(times=3)\nasync def job()');
  });

  it('class: signature, docstring, methods as children with qualified names', () => {
    const c = first(`
class Repo(Base, metaclass=Meta):
    """A repository."""

    default = None

    def get(self, id):
        """Get by id."""
        return id

    async def save(self):
        pass

    @property
    def name(self):
        return "repo"
`);
    expect(c).toMatchObject({
      kind: 'class',
      signature: 'class Repo(Base, metaclass=Meta)',
      docstring: 'A repository.',
      startLine: 1,
      endLine: 15,
      body: { startLine: 3, endLine: 15 },
    });
    expect(c.children?.map((m) => [m.qualifiedName, m.kind, m.id])).toEqual([
      ['Repo.get', 'method', 'Repo.get:method'],
      ['Repo.save', 'method', 'Repo.save:method'],
      ['Repo.name', 'method', 'Repo.name:method'],
    ]);
    expect(c.children?.[0]?.docstring).toBe('Get by id.');
    // Indentation of a method's own decorators is removed.
    expect(c.children?.[2]?.signature).toBe('@property\ndef name(self)');
  });

  it('class without a base list', () => {
    expect(
      first(`
class Plain:
    x = 1
`).signature,
    ).toBe('class Plain');
  });

  it('nested classes', () => {
    const outer = first(`
class A:
    class B:
        class C:
            def deep(self):
                pass
`);
    const b = outer.children?.[0];
    const c = b?.children?.[0];
    expect(b).toMatchObject({ qualifiedName: 'A.B', kind: 'class' });
    expect(c).toMatchObject({ qualifiedName: 'A.B.C', kind: 'class' });
    expect(c?.children?.[0]).toMatchObject({ qualifiedName: 'A.B.C.deep', kind: 'method' });
  });

  it('ignores imports, from-imports and module-level assignments', () => {
    const symbols = extract(`
import os
from typing import Optional
MAX = 5
timeout: int = 30
def f():
    pass
`);
    expect(symbols.map((s) => s.name)).toEqual(['f']);
  });

  it('multi-line docstring is dedented and trimmed', () => {
    const f = first(`
def f():
    """Summary.

    Details here.
    """
    return 1
`);
    expect(f.docstring).toBe('Summary.\n\nDetails here.');
    expect(f.body).toEqual({ startLine: 6, endLine: 6 });
  });

  it('docstring with a prefix and single quotes; non-docstring strings are ignored', () => {
    expect(first("def f():\n    r'''raw \\d'''\n    pass\n").docstring).toBe('raw \\d');
    expect(first('def f():\n    f"not {a} doc"\n    pass\n').docstring).toBeUndefined();
    expect(first('def f():\n    x = "not doc"\n').docstring).toBeUndefined();
  });

  it('non-ASCII text keeps correct signatures and docstrings', () => {
    const f = first(`
def مرحبا(اسم: str = "عمرو") -> str:
    """تحية بسيطة."""
    return اسم
`);
    expect(f.signature).toBe('def مرحبا(اسم: str = "عمرو") -> str');
    expect(f.docstring).toBe('تحية بسيطة.');
  });

  it('CRLF files: no carriage returns in signature or docstring, same line numbers', () => {
    const code = '@d\r\ndef f(\r\n    a,\r\n):\r\n    """Doc\r\n    more."""\r\n    return a\r\n';
    const f = extractPythonSymbolsFromSource(parser, code)[0];
    expect(f?.signature).toBe('@d\ndef f(\n    a,\n)');
    expect(f?.docstring).toBe('Doc\nmore.');
    expect([f?.startLine, f?.endLine, f?.body?.startLine, f?.body?.endLine]).toEqual([1, 7, 7, 7]);
  });

  it('exported follows the underscore convention; dunders are public', () => {
    const c = first(`
class _Hidden:
    def __init__(self):
        pass
    def _helper(self):
        pass
    def run(self):
        pass
`);
    expect(c.exported).toBe(false);
    expect(c.children?.map((m) => [m.name, m.exported])).toEqual([
      ['__init__', true],
      ['_helper', false],
      ['run', true],
    ]);
  });

  it('known gaps: nested functions and lambdas are not extracted', () => {
    const f = first(`
def outer():
    def inner():
        pass
    g = lambda x: x
    return inner
`);
    expect(f.children).toBeUndefined();
    expect(extract('g = lambda x: x\n')).toEqual([]);
  });

  it('empty file and comments-only file give no symbols', () => {
    expect(extractPythonSymbolsFromSource(parser, '')).toEqual([]);
    expect(extract('# just a comment\n')).toEqual([]);
  });

  it('syntax errors do not throw; valid definitions are still found', () => {
    const symbols = extract(`
def good():
    return 1

def broken(
    x = 
`);
    expect(symbols.some((s) => s.name === 'good')).toBe(true);
  });
});

describe('extractPythonSymbols on the fixtures', () => {
  const FIXTURES = fileURLToPath(new URL('../../../../fixtures/', import.meta.url));
  const files = ['python', 'python-repo', 'python-edge'].flatMap((folder) =>
    (readdirSync(join(FIXTURES, folder)) as string[])
      .filter((name) => name.endsWith('.py'))
      .map((name) => join(FIXTURES, folder, name)),
  );
  let parser: CodeParser;
  beforeAll(async () => {
    parser = await WasmParser.create(['python']);
  });

  const check = (s: SymbolNode, lineCount: number, parent?: SymbolNode): void => {
    expect(s.startLine).toBeGreaterThanOrEqual(1);
    expect(s.endLine).toBeGreaterThanOrEqual(s.startLine);
    expect(s.endLine).toBeLessThanOrEqual(lineCount);
    if (parent) {
      expect(s.startLine).toBeGreaterThan(parent.startLine);
      expect(s.endLine).toBeLessThanOrEqual(parent.endLine);
    }
    if (s.body) {
      expect(s.body.startLine).toBeGreaterThan(s.startLine);
      expect(s.body.endLine).toBe(s.endLine);
    }
    for (const child of s.children ?? []) check(child, lineCount, s);
  };

  it.each(files.map((f) => [f.slice(FIXTURES.length), f] as const))(
    '%s: symbols are consistent',
    (_name, file) => {
      const source = readFileSync(file, 'utf8');
      const lineCount = source.split(/\r?\n/).length;
      for (const s of extractPythonSymbolsFromSource(parser, source)) check(s, lineCount);
    },
  );

  it('nested_classes.py: deep qualified names', () => {
    const source = readFileSync(join(FIXTURES, 'python-edge', 'nested_classes.py'), 'utf8');
    const names: string[] = [];
    const walk = (s: SymbolNode): void => {
      names.push(s.qualifiedName);
      s.children?.forEach(walk);
    };
    extractPythonSymbolsFromSource(parser, source).forEach(walk);
    expect(names).toContain('University.Student.Contact.get_email');
  });
});
