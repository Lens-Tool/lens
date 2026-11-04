/**
 * Python symbol extraction: SyntaxNode (tree-sitter) -> SymbolNode[].
 *
 * Returns the top-level symbols of a file, in source order:
 *  - `import` and `from ... import` statements (kind `import`): one symbol per statement. `name` is
 *    the module (`os`, `typing`, `.models`; for `import a, b as c` it is `a, b`), `signature` is the
 *    whole statement.
 *  - module-level assignments (kind `variable`): one symbol per statement. `name` is the assigned
 *    name(s) (`A, B` for `A, B = ...`; `a, b` for `a = b = 1`), `signature` is the whole statement,
 *    because renderers keep variables whole. `__all__` is skipped.
 *  - classes and functions (kinds `class`, `function`). Methods and nested classes go in `children`.
 * Lines are 1-based and inclusive (same as SymbolRef). Written against `SyntaxNode`, so it works
 * with any loader (ADR 0009).
 *
 * `body` is the droppable part of a function. For a CLASS it spans all the lines of its members, so a
 * renderer must not drop a class `body` as a whole: it has to use `children` and drop each method body.
 *
 * Ignored on purpose: class-level assignments, attribute and subscript assignments (`a.b = 1`,
 * `d["k"] = 2`), augmented assignments (`x += 1`), and every other statement (calls, `pass`, ...).
 *
 * KNOWN GAPS
 *  - Functions nested inside functions are not extracted (only the outer function is).
 *  - Lambdas are not extracted.
 *  - Defs, classes, imports and assignments inside module-level `if` / `try` / `with` blocks (for
 *    example `if TYPE_CHECKING:`) are not extracted.
 *  - Siblings with the same name (property getter/setter, @overload) are all returned. `id` stays
 *    unique by adding `#2`, `#3` to the later ones; `qualifiedName` is the same for all of them.
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
  const seen = new Map<string, number>();
  for (const child of container.namedChildren) {
    const symbol = toSymbol(child, source, scope, inClass);
    if (!symbol) continue;
    // Same-name siblings (property getter/setter, @overload) must not share an id.
    const count = (seen.get(symbol.id) ?? 0) + 1;
    seen.set(symbol.id, count);
    if (count > 1) symbol.id = `${symbol.id}#${count}`;
    out.push(symbol);
  }
  return out;
}

function toSymbol(
  outer: SyntaxNode,
  source: string,
  scope: readonly string[],
  inClass: boolean,
): SymbolNode | undefined {
  if (!inClass) {
    const simple = toImportOrVariable(outer, source);
    if (simple) return simple;
  }

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

/** `import ...`, `from ... import ...` and module-level assignments. */
function toImportOrVariable(node: SyntaxNode, source: string): SymbolNode | undefined {
  if (
    node.type === 'import_statement' ||
    node.type === 'import_from_statement' ||
    node.type === 'future_import_statement'
  ) {
    const name = importedModules(node);
    return name ? simpleSymbol(node, source, 'import', name, false) : undefined;
  }
  if (node.type === 'expression_statement') {
    const assignment = node.namedChildren[0];
    if (assignment?.type !== 'assignment') return undefined;
    const names = assignedNames(assignment);
    if (!names || names.length === 0 || names.includes('__all__')) return undefined;
    return simpleSymbol(node, source, 'variable', names.join(', '), names.some(isExported));
  }
  return undefined;
}

function simpleSymbol(
  node: SyntaxNode,
  source: string,
  kind: 'import' | 'variable',
  name: string,
  exported: boolean,
): SymbolNode {
  return {
    id: `${name}:${kind}`,
    name,
    qualifiedName: name,
    kind,
    language: 'python',
    startLine: node.startPosition.row + 1,
    endLine: lastRow(node) + 1,
    signature: dedent(source.slice(node.startIndex, node.endIndex), node.startPosition.column),
    exported,
  };
}

/** `from x.y import z` -> "x.y" (relative: ".", "..utils"); `import a.b as c, d` -> "a.b, d". */
function importedModules(node: SyntaxNode): string | undefined {
  if (node.type === 'future_import_statement') return '__future__';
  if (node.type === 'import_from_statement') return node.childForFieldName('module_name')?.text;
  const modules = node.namedChildren
    .filter((child) => child.type === 'dotted_name' || child.type === 'aliased_import')
    .map((child) =>
      child.type === 'aliased_import' ? child.childForFieldName('name')?.text : child.text,
    )
    .filter((text): text is string => Boolean(text));
  return modules.length > 0 ? modules.join(', ') : undefined;
}

/**
 * Names bound by an assignment, following chains (`a = b = 1`). Returns undefined if any target is
 * not a plain name (attribute, subscript, ...): that is not a new variable.
 */
function assignedNames(assignment: SyntaxNode): string[] | undefined {
  const names: string[] = [];
  let current: SyntaxNode | null = assignment;
  while (current && current.type === 'assignment') {
    const left = current.childForFieldName('left');
    const found = left ? targetNames(left) : undefined;
    if (!found) return undefined;
    names.push(...found);
    current = current.childForFieldName('right');
  }
  return names;
}

function targetNames(node: SyntaxNode): string[] | undefined {
  switch (node.type) {
    case 'identifier':
      return [node.text];
    case 'comment':
      return [];
    case 'list_splat_pattern': {
      const inner = node.namedChildren[0];
      return inner ? targetNames(inner) : undefined;
    }
    case 'pattern_list':
    case 'tuple_pattern':
    case 'list_pattern': {
      const names: string[] = [];
      for (const child of node.namedChildren) {
        const found = targetNames(child);
        if (!found) return undefined;
        names.push(...found);
      }
      return names;
    }
    default:
      return undefined;
  }
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
