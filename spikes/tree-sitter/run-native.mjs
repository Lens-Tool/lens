import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extractSymbols, printSymbols } from './symbols.mjs';

const require = createRequire(import.meta.url);
const Parser = require('tree-sitter');
const grammars = {
  python: require('tree-sitter-python'),
  javascript: require('tree-sitter-javascript'),
  typescript: require('tree-sitter-typescript').typescript,
};
const files = [
  ['python', '../../fixtures/python/login.py'],
  ['typescript', '../../fixtures/typescript/auth.ts'],
  ['javascript', 'sample.js'],
];

console.log('NATIVE tree-sitter | node', process.version, process.platform, process.arch);
const parser = new Parser();
for (const [language, file] of files) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  parser.setLanguage(grammars[language]);
  const t0 = performance.now();
  const tree = parser.parse(source);
  const ms = (performance.now() - t0).toFixed(1);
  printSymbols(`${language} ${file} (parse ${ms} ms, syntax errors: ${tree.rootNode.hasError})`, extractSymbols(tree.rootNode, language, source));
}
