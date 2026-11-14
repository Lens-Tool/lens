import type { SymbolNode } from '@lens/shared';

export interface RenderSignaturesOptions {
  /** `id`s of symbols (functions or methods) whose full body must stay in the output. */
  keepBodies?: ReadonlySet<string>;
  /**
   * What replaces an omitted body (the line numbers are those of the ORIGINAL file):
   * - `long` (default, the format agreed in task S2-06): `... # lens: lines 8-11 omitted (expand_symbol create_token)`
   * - `short`: `... # L8-11` (about 4 times cheaper in tokens; the agent must be told what it means)
   */
  marker?: 'short' | 'long';
}

function markerText(style: 'short' | 'long', from: number, to: number, name: string): string {
  return style === 'short'
    ? `... # L${from}-${to}`
    : `... # lens: lines ${from}-${to} omitted (expand_symbol ${name})`;
}

interface Edit {
  from: number; // 0-based, inclusive
  to: number;
  text: string;
}

/**
 * Signatures-only view of a Python file: everything stays (imports, variables, decorators, class and
 * function headers, docstrings, blank lines, comments outside bodies) except the bodies of functions
 * and methods, which are replaced by one marker line each. The result is still valid Python.
 *
 * A body is only replaced when its marker is shorter than the code it replaces, so the output is
 * never larger than the input (tiny bodies such as `return x` stay as they are).
 *
 * A docstring is never part of `SymbolNode.body`, so it is kept whole.
 * A class body is never dropped as a whole: its members are in `children`, and each method body is
 * replaced on its own.
 */
export function renderSignatures(
  source: string,
  symbols: readonly SymbolNode[],
  { keepBodies = new Set<string>(), marker = 'long' }: RenderSignaturesOptions = {},
): string {
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  const lines = source.split(/\r?\n/);
  const edits: Edit[] = [];

  const collect = (list: readonly SymbolNode[]): void => {
    for (const symbol of list) {
      if (symbol.kind === 'class') {
        collect(symbol.children ?? []);
        continue;
      }
      const body = symbol.body; // only functions and methods have one
      if (!body || keepBodies.has(symbol.id)) continue;

      const first = lines[body.startLine - 1];
      if (first === undefined) continue; // the extractor only sets `body` when it starts below the header
      const indent = /^\s*/.exec(first)?.[0] ?? '';
      const text = markerText(marker, body.startLine, body.endLine, symbol.qualifiedName);
      const bodyText = lines
        .slice(body.startLine - 1, body.endLine)
        .join('\n')
        .trim();
      if (text.length >= bodyText.length) continue;
      edits.push({ from: body.startLine - 1, to: body.endLine - 1, text: `${indent}${text}` });
    }
  };
  collect(symbols);
  edits.sort((a, b) => a.from - b.from);

  const out: string[] = [];
  let index = 0;
  for (const edit of edits) {
    if (edit.from < index) continue; // overlapping range: never emit lines twice
    while (index < edit.from) out.push(lines[index++] ?? '');
    out.push(edit.text);
    index = edit.to + 1;
  }
  while (index < lines.length) out.push(lines[index++] ?? '');
  return out.join(eol);
}
