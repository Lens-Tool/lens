import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { WasmParser, compressLight, extractPythonSymbolsFromSource } from '@lens/compression';
import { ApproxTokenCounter, type SymbolNode } from '@lens/shared';

type Row = {
  file: string;
  raw: number;
  light: number;
  signatures: number;
  symbols: number;
  omitted: number;
};

const root = join(process.cwd(), 'fixtures', 'python-repo');
const docPath = join(process.cwd(), 'docs', 'research', 'python-savings.md');
const shouldWrite = process.argv.includes('--write');
const skipDirs = new Set(['__pycache__', '.git', 'node_modules', '.venv']);
const counter = new ApproxTokenCounter();

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (!skipDirs.has(entry)) out.push(...walk(full));
    } else if (entry.endsWith('.py')) {
      out.push(full);
    }
  }
  return out;
}

function countSymbols(symbols: SymbolNode[]): number {
  let total = 0;
  for (const symbol of symbols) {
    total += 1 + countSymbols(symbol.children ?? []);
  }
  return total;
}

function collectBodies(symbols: SymbolNode[], out: Array<[number, number]>): void {
  for (const symbol of symbols) {
    if (symbol.kind === 'class') {
      collectBodies(symbol.children ?? [], out);
    } else if (symbol.body) {
      out.push([symbol.body.startLine, symbol.body.endLine]);
    }
  }
}

function renderSignatures(source: string, symbols: SymbolNode[]) {
  const bodies: Array<[number, number]> = [];
  collectBodies(symbols, bodies);
  const dropped = new Set<number>();
  for (const [start, end] of bodies) {
    for (let lineNumber = start; lineNumber <= end; lineNumber += 1) dropped.add(lineNumber);
  }
  const kept = source
    .split(/\r?\n/)
    .filter((text, index) => !dropped.has(index + 1) && text.trim() !== '');
  return { text: kept.join('\n') + (kept.length > 0 ? '\n' : ''), omitted: bodies.length };
}

function saved(part: number, whole: number): string {
  if (whole === 0) return '0.0%';
  return `${((1 - part / whole) * 100).toFixed(1)}%`;
}

function line(row: Row): string {
  return `| ${row.file} | ${row.raw} | ${row.light} | ${saved(row.light, row.raw)} | ${row.signatures} | ${saved(row.signatures, row.raw)} | ${row.symbols} | ${row.omitted} |`;
}

const parser = await WasmParser.create(['python']);
const rows: Row[] = [];

for (const path of walk(root)) {
  const source = readFileSync(path, 'utf8');
  const symbols = extractPythonSymbolsFromSource(parser, source);
  const signatures = renderSignatures(source, symbols);
  rows.push({
    file: relative(root, path).split('\\').join('/'),
    raw: counter.count(source),
    light: counter.count(compressLight(source, 'python').content),
    signatures: counter.count(signatures.text),
    symbols: countSymbols(symbols),
    omitted: signatures.omitted,
  });
}

const total = rows.reduce<Row>(
  (acc, row) => ({
    file: 'TOTAL',
    raw: acc.raw + row.raw,
    light: acc.light + row.light,
    signatures: acc.signatures + row.signatures,
    symbols: acc.symbols + row.symbols,
    omitted: acc.omitted + row.omitted,
  }),
  { file: 'TOTAL', raw: 0, light: 0, signatures: 0, symbols: 0, omitted: 0 },
);

const table = [
  '| File | Raw | Light | Light saved | Signatures | Signatures saved | Symbols | Bodies omitted |',
  '|---|---:|---:|---:|---:|---:|---:|---:|',
  ...rows.map(line),
  line(total),
].join('\n');

console.log(`Counter: ${counter.name}`);
console.log(`Files: ${rows.length}`);
console.log('');
console.log(table);

if (shouldWrite) {
  const date = new Date().toISOString().slice(0, 10);
  const doc = [
    '# Python fixture token savings',
    '',
    `Date: ${date}`,
    `Token counter: ${counter.name} (rough estimate, about 4 characters per token; not a real tokenizer)`,
    `Fixture: fixtures/python-repo (${rows.length} files)`,
    '',
    'Levels compared: raw (original source), light (compressLight: comments and blank lines removed), signatures (function and method bodies removed using the extracted symbol ranges; imports, variables, class and function headers kept). Percentages are tokens saved relative to raw.',
    '',
    table,
    '',
    '## What we do not know yet',
    '',
    'These numbers measure size only, and they use an approximate counter, so absolute values will change once a real tokenizer is integrated. We have not yet measured how each level affects answer quality: whether an agent given light or signatures-only context answers questions about the code as accurately as with the raw source, and which kinds of questions break first when bodies are omitted.',
    '',
  ].join('\n');
  mkdirSync(dirname(docPath), { recursive: true });
  writeFileSync(docPath, doc, 'utf8');
  console.log('');
  console.log(`Wrote ${relative(process.cwd(), docPath)}`);
}
