import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extractSymbols, printSymbols } from './symbols.mjs';

const require = createRequire(import.meta.url);
const Parser = require('web-tree-sitter'); // must be 0.22.x to match tree-sitter-wasms 0.1.13
const wasmPath = (name) => require.resolve(`tree-sitter-wasms/out/tree-sitter-${name}.wasm`);
const files = [
  ['python', '../../fixtures/python/login.py'],
  ['typescript', '../../fixtures/typescript/auth.ts'],
  ['javascript', 'sample.js'],
];

console.log('WASM web-tree-sitter | node', process.version, process.platform, process.arch);
await Parser.init();
const parser = new Parser();
for (const [language, file] of files) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  parser.setLanguage(await Parser.Language.load(wasmPath(language)));
  const t0 = performance.now();
  const tree = parser.parse(source);
  const ms = (performance.now() - t0).toFixed(1);
  printSymbols(`${language} ${file} (parse ${ms} ms, syntax errors: ${tree.rootNode.hasError})`, extractSymbols(tree.rootNode, language, source));
}
