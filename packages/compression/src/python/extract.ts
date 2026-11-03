/**
 * Python symbol extraction: SyntaxNode (tree-sitter) -> SymbolNode[].
 *
 * Returns top-level classes and functions. Methods and nested classes go in `children`.
 * Lines are 1-based and inclusive (same as SymbolRef). Written against `SyntaxNode`, so it works
 * with any loader (ADR 0009).
 *
 * Ignored on purpose: `import` / `from ... import`, module-level and class-level assignments, and
 * every other statement that is not a def or a class.
 *
 * KNOWN GAPS
 *  - Functions nested inside functions are not extracted (only the outer function is).
 *  - Lambdas are not extracted.
 *  - Defs and classes inside module-level `if` / `try` / `with` blocks (for example
 *    `if TYPE_CHECKING:`) are not extracted.
 *  - A docstring made of several adjacent string literals ("a" "b") is not recognised.
 *  - A one-line body (`def f(): return 1`) has no `body` range: dropping that line would also drop
 *    the header.
 *  - Comments between the header and the first statement count as droppable body lines.
 *  - `exported` follows the Python naming convention (no leading underscore, dunder methods
 *    count as public); `__all__` is not read.
 *  - Files with syntax errors: broken definitions are skipped, the rest is still extracted.
 */
import type { SymbolKind, SymbolNode } from '@lens/shared';
import { withParsedFile, type CodeParser, type SyntaxNode } from '../parser/index.js';

/** Convenience wrapper: parses, extracts, and frees the tree. */
export function extractPythonSymbolsFromSource(parser: CodeParser, source: string): SymbolNode[] {
  return withParsedFile(parser, source, 'python', (file) =>
    extractPythonSymbols(file.root, source),
  );
}

/** `root` is the tree's root node; `source` must be the exact text it was parsed from. */
export function extractPythonSymbols(root: SyntaxNode, source: string): SymbolNode[] {
  return collect(root, source, [], false);
}

function collect(
  container: SyntaxNode,
  source: string,
  scope: readonly string[],
  inClass: boolean,
): SymbolNode[] {
  const out: SymbolNode[] = [];
  for (const child of container.namedChildren) {
    const symbol = toSymbol(child, source, scope, inClass);
    if (symbol) out.push(symbol);
  }
  return out;
}

function toSymbol(
  outer: SyntaxNode,
  source: string,
  scope: readonly string[],
  inClass: boolean,
): SymbolNode | undefined {
  // `outer` includes the decorators; `def` is the function or class itself.
  const def = outer.type === 'decorated_definition' ? outer.childForFieldName('definition') : outer;
  if (!def || (def.type !== 'function_definition' && def.type !== 'class_definition')) {
    return undefined;
  }
  const nameNode = def.childForFieldName('name');
  if (!nameNode || nameNode.isMissing) return undefined;

  const isClass = def.type === 'class_definition';
  const kind: SymbolKind = isClass ? 'class' : inClass ? 'method' : 'function';
  const name = nameNode.text;
  const path = [...scope, name];
  const qualifiedName = path.join('.');

  // The header ends at the last of these, so a comment after the ':' is not part of it.
  const headerParts = [
    nameNode,
    def.childForFieldName('type_parameters'),
    def.childForFieldName(isClass ? 'superclasses' : 'parameters'),
    def.childForFieldName('return_type'),
  ].filter((n): n is SyntaxNode => n !== null);
  const headerEnd = Math.max(...headerParts.map((n) => n.endIndex));
  const headerEndRow = Math.max(...headerParts.map((n) => n.endPosition.row));

  const block = def.childForFieldName('body');
  const docNode = block ? findDocstring(block) : undefined;

  let body: SymbolNode['body'];
  if (block && block.startPosition.row > headerEndRow) {
    // Droppable lines start after the docstring, or right after the header if there is none.
    const startRow = docNode ? lastRow(docNode) + 1 : headerEndRow + 1;
    const endRow = lastRow(block);
    if (startRow <= endRow) body = { startLine: startRow + 1, endLine: endRow + 1 };
  }

  const symbol: SymbolNode = {
    id: `${qualifiedName}:${kind}`,
    name,
    qualifiedName,
    kind,
    language: 'python',
    startLine: outer.startPosition.row + 1,
    endLine: lastRow(outer) + 1,
    signature: dedent(source.slice(outer.startIndex, headerEnd), outer.startPosition.column),
    exported: isExported(name),
  };
  if (docNode) symbol.docstring = cleanDocstring(docNode.text);
  if (body) symbol.body = body;
  if (isClass) symbol.children = block ? collect(block, source, path, true) : [];
  return symbol;
}

/** Last row that belongs to the node. A node can end at column 0 of the next row. */
function lastRow(node: SyntaxNode): number {
  const { row, column } = node.endPosition;
  return column === 0 && row > node.startPosition.row ? row - 1 : row;
}

/** The first statement of a body, if it is a plain string literal (not bytes, not an f-string). */
function findDocstring(block: SyntaxNode): SyntaxNode | undefined {
  const first = block.namedChildren[0];
  if (first?.type !== 'expression_statement') return undefined;
  const literal = first.namedChildren[0];
  if (literal?.type !== 'string') return undefined;
  if (/^[bBfF]|^[rRuU][bBfF]/.test(literal.text)) return undefined;
  return first;
}

/** Strips prefix and quotes, normalises line endings, and removes common indentation. */
function cleanDocstring(statementText: string): string {
  const text = statementText.replace(/\r\n?/g, '\n').trim();
  const match = /^[a-zA-Z]*("""|'''|"|')([\s\S]*)\1$/.exec(text);
  const inner = match?.[2] ?? text;
  const lines = inner.split('\n');
  const rest = lines.slice(1).filter((line) => line.trim() !== '');
  const indent = rest.length
    ? Math.min(...rest.map((line) => /^\s*/.exec(line)?.[0].length ?? 0))
    : 0;
  const cleaned = lines.map((line, i) => (i === 0 ? line.trim() : line.slice(indent).trimEnd()));
  return cleaned.join('\n').trim();
}

/** Normalises CRLF and removes the node's own indentation from lines after the first. */
function dedent(text: string, column: number): string {
  const [first = '', ...rest] = text.replace(/\r\n?/g, '\n').split('\n');
  const strip = new RegExp(`^[ \\t]{0,${column}}`);
  return [first, ...rest.map((line) => line.replace(strip, ''))].join('\n');
}

/** Python convention: a leading underscore means private; dunder names (__init__) are public. */
function isExported(name: string): boolean {
  return !name.startsWith('_') || (name.startsWith('__') && name.endsWith('__'));
}
