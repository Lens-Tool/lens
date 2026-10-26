// Shared symbol extractor. The tree-sitter node API is the same for the native and WASM builds,
// so the same code runs on both: only the loading code differs (see run-native / run-wasm).

const DECLARATIONS = {
  python: { function_definition: 'function', class_definition: 'class' },
  javascript: { function_declaration: 'function', class_declaration: 'class' },
  typescript: {
    function_declaration: 'function',
    class_declaration: 'class',
    interface_declaration: 'interface',
    type_alias_declaration: 'type',
  },
};
const IMPORTS = new Set(['import_statement', 'import_from_statement']);

export function extractSymbols(root, language, source) {
  const out = [];
  const visit = (node, exported) => {
    // unwrap decorators / export wrappers
    if (node.type === 'decorated_definition') return visit(node.childForFieldName('definition'), exported);
    if (node.type === 'export_statement') {
      const inner = node.childForFieldName('declaration');
      return inner ? visit(inner, true) : undefined;
    }
    if (IMPORTS.has(node.type)) {
      out.push(describe(node, 'import', node.text, source, language));
      return;
    }
    const kind = DECLARATIONS[language][node.type];
    if (kind) out.push(describe(node, kind, node.childForFieldName('name')?.text ?? '?', source, language, exported));
    else if (['lexical_declaration', 'variable_declaration'].includes(node.type)) {
      for (const d of node.namedChildren.filter((c) => c.type === 'variable_declarator')) {
        out.push(describe(d, 'variable', d.childForFieldName('name')?.text ?? '?', source, language, exported));
      }
    }
    // methods
    if (kind === 'class') {
      const body = node.childForFieldName('body');
      for (const m of body?.namedChildren ?? []) {
        if (['function_definition', 'method_definition'].includes(m.type)) {
          out.push(describe(m, 'method', `${node.childForFieldName('name')?.text}.${m.childForFieldName('name')?.text}`, source, language));
        }
      }
    }
  };
  for (const child of root.namedChildren) visit(child, false);
  return out;
}

function describe(node, kind, name, source, language, exported = false) {
  const body = node.childForFieldName('body');
  // signature = source text from the start of the node to the start of its body
  // Python: end the header at the return type / parameters / superclasses, so a comment after ':' is not included.
  const pyHeaderEnd =
    language === 'python'
      ? (node.childForFieldName('return_type') ?? node.childForFieldName('parameters') ?? node.childForFieldName('superclasses') ?? node.childForFieldName('name'))?.endIndex
      : undefined;
  const signature = (pyHeaderEnd ? source.slice(node.startIndex, pyHeaderEnd) : body ? source.slice(node.startIndex, body.startIndex) : node.text)
    .replace(/\s+/g, ' ')
    .replace(/[:{]\s*$/, '')
    .trim();
  return {
    name,
    kind,
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    signature,
    docstring: language === 'python' ? pythonDocstring(body) : undefined,
    exported,
  };
}

function pythonDocstring(body) {
  const first = body?.namedChildren[0];
  if (first?.type === 'expression_statement' && first.namedChildren[0]?.type === 'string') {
    return first.namedChildren[0].text.replace(/^("""|'''|"|')|("""|'''|"|')$/g, '').trim();
  }
  return undefined;
}

export function printSymbols(title, symbols) {
  console.log(`\n== ${title} ==`);
  for (const s of symbols) {
    console.log(`${String(s.startLine).padStart(3)}-${String(s.endLine).padEnd(3)} ${s.kind.padEnd(9)} ${s.name}${s.exported ? '  [export]' : ''}`);
    console.log(`        sig: ${s.signature}${s.docstring ? `\n        doc: ${s.docstring}` : ''}`);
  }
}
