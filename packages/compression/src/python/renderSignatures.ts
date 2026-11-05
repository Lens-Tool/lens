import type { SymbolNode } from '@lens/shared';

export interface RenderOptions {
  keepBodies?: ReadonlySet<string>;
}

interface Edit {
  from: number; // 0-based, inclusive
  to: number;
  lines: string[];
}

const DEF_LINE = /^\s*(async\s+)?def\s/;
const DOC_OPEN = /^(\s*)([rRuUbB]*)("""|''')(.*)$/;

function marker(from: number, to: number, name: string): string {
  return `... # lens: lines ${from}-${to} omitted (expand_symbol ${name})`;
}

function bodyEdit(lines: string[], symbol: SymbolNode): Edit | null {
  const body = symbol.body;
  if (!body) return null; // one-line body, nothing to cut

  const start = body.startLine - 1;
  const end = body.endLine - 1;
  const first = lines[start];
  if (first === undefined || DEF_LINE.test(first)) return null;

  const indent = /^\s*/.exec(first)?.[0] ?? '';
  const kept: string[] = [];
  let next = start; // first line to omit (0-based)

  const doc = DOC_OPEN.exec(first);
  if (doc) {
    const [, , prefix = '', quote = '"""', rest = ''] = doc;
    if (rest.includes(quote)) {
      kept.push(first); // one-line docstring, keep as is
      next = start + 1;
    } else {
      // multi-line docstring: keep the first line and close it, so the output stays valid
      let close = start + 1;
      while (close <= end && !(lines[close] ?? '').includes(quote)) close++;
      const text = (rest.trim() || (lines[start + 1] ?? '').trim()).replace(/["']+$/, '');
      kept.push(`${indent}${prefix}${quote}${text}${quote}`);
      next = close + 1;
    }
  }

  if (next > end) return { from: start, to: end, lines: kept };
  kept.push(`${indent}${marker(next + 1, end + 1, symbol.qualifiedName)}`);
  return { from: start, to: end, lines: kept };
}

export function renderSignatures(
  source: string,
  symbols: readonly SymbolNode[],
  { keepBodies = new Set<string>() }: RenderOptions = {},
): string {
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  const lines = source.split(/\r?\n/);
  const edits: Edit[] = [];

  const collect = (list: readonly SymbolNode[]): void => {
    for (const symbol of list) {
      if (symbol.kind === 'class') {
        // a class body is all its members: go into children, never drop it whole
        collect(symbol.children ?? []);
      } else if (symbol.kind === 'function' && !keepBodies.has(symbol.id)) {
        const edit = bodyEdit(lines, symbol);
        if (edit) edits.push(edit);
      }
    }
  };
  collect(symbols);
  edits.sort((a, b) => a.from - b.from);

  const out: string[] = [];
  let i = 0;
  for (const edit of edits) {
    while (i < edit.from) out.push(lines[i++] ?? '');
    out.push(...edit.lines);
    i = edit.to + 1;
  }
  while (i < lines.length) out.push(lines[i++] ?? '');
  return out.join(eol);
}
