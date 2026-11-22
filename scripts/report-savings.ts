import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  WasmParser,
  compressLight,
  extractPythonSymbolsFromSource,
  getDefaultTokenCounter,
  renderSignatures,
} from '@lens/compression';
import { type SymbolNode } from '@lens/shared';

// Token savings of each compression level on the Python sample repo (task S2-11).
//
// The "signatures" level uses the real renderer (`renderSignatures`, task S2-06), once with the
// long marker and once with the short one. Uses the real tiktoken counter (S2-10).
//
// Usage:  npm run report:savings          print the tables
//         npm run report:savings:write    also regenerate docs/research/python-savings.md

type Row = {
  file: string;
  raw: number;
  light: number;
  long: number;
  short: number;
  symbols: number;
  omitted: number;
};

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const root = join(repoRoot, 'fixtures', 'python-repo');
const docPath = join(repoRoot, 'docs', 'research', 'python-savings.md');
const shouldWrite = process.argv.includes('--write');
const skipDirs = new Set(['__pycache__', '.git', 'node_modules', '.venv']);
const counter = getDefaultTokenCounter();
console.log(`Counter: ${counter.name}`);

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

/** Number of bodies the renderer replaced: one marker line each. */
function countMarkers(rendered: string): number {
  return (rendered.match(/^\s*\.\.\. # lens: lines /gm) ?? []).length;
}

function saved(part: number, whole: number): string {
  if (whole === 0) return '0.0%';
  return `${((1 - part / whole) * 100).toFixed(1)}%`;
}

function line(row: Row): string {
  return `| ${row.file} | ${row.raw} | ${row.light} | ${saved(row.light, row.raw)} | ${saved(row.short, row.raw)} | ${saved(row.long, row.raw)} | ${row.symbols} | ${row.omitted} |`;
}

const parser = await WasmParser.create(['python']);
const rows: Row[] = [];

for (const path of walk(root)) {
  const source = readFileSync(path, 'utf8');
  const symbols = extractPythonSymbolsFromSource(parser, source);
  const long = renderSignatures(source, symbols, { marker: 'long' });
  rows.push({
    file: relative(root, path).split('\\').join('/'),
    raw: counter.count(source),
    light: counter.count(compressLight(source, 'python').content),
    long: counter.count(long),
    short: counter.count(renderSignatures(source, symbols, { marker: 'short' })),
    symbols: countSymbols(symbols),
    omitted: countMarkers(long),
  });
}

const total = rows.reduce<Row>(
  (acc, row) => ({
    file: 'TOTAL',
    raw: acc.raw + row.raw,
    light: acc.light + row.light,
    long: acc.long + row.long,
    short: acc.short + row.short,
    symbols: acc.symbols + row.symbols,
    omitted: acc.omitted + row.omitted,
  }),
  { file: 'TOTAL', raw: 0, light: 0, long: 0, short: 0, symbols: 0, omitted: 0 },
);

const perFile = [
  '| File | Raw tokens | Light | Light saved | Signatures, short marker | Signatures, long marker | Symbols | Bodies omitted |',
  '|---|---:|---:|---:|---:|---:|---:|---:|',
  ...rows.map(line),
  line(total),
].join('\n');

const summary = [
  '| Level | Tokens | Saved |',
  '|---|---:|---:|',
  `| Raw (original source) | ${total.raw} | - |`,
  `| Light (comments and blank lines removed) | ${total.light} | ${saved(total.light, total.raw)} |`,
  `| Signatures, short marker \`... # L8-11\` | ${total.short} | ${saved(total.short, total.raw)} |`,
  `| Signatures, long marker \`... # lens: lines 8-11 omitted (expand_symbol name)\` | ${total.long} | ${saved(total.long, total.raw)} |`,
].join('\n');

const extraPerBody =
  total.omitted > 0 ? ((total.long - total.short) / total.omitted).toFixed(1) : '0';

function counterDescription(name: string): string {
  switch (name) {
    case 'tiktoken-cl100k_base':
      return "BPE tokenizer for OpenAI's cl100k_base encoding; an estimate for Claude and other models, which tokenize differently";
    case 'approx-chars-div-4':
      return 'rough estimate, about 4 characters per token; not a real tokenizer';
    default:
      return name;
  }
}

const findings = [
  `- The light level saves only ${saved(total.light, total.raw)}: comments and blank lines are a very small part of the tokens.`,
  `- Almost all the savings come from replacing function and method bodies, which is also the level that risks answer quality (not measured yet).`,
  `- The marker that replaces each body decides how much is saved: the signatures level saves ${saved(total.short, total.raw)} with the short marker and ${saved(total.long, total.raw)} with the long one. The long marker costs about ${extraPerBody} more tokens per replaced body, and it repeats the function name that is already on the line above it.`,
  `- ${total.omitted} bodies were replaced out of ${total.symbols} symbols (the rest are imports, variables, classes, and bodies too small to be worth replacing: the renderer keeps a body when its marker would not be shorter).`,
  '- The fixture is synthetic, so these percentages describe the fixture and not real projects. Real functions are usually longer, which would increase the savings, but that is not measured.',
].join('\n');

console.log(`Counter: ${counter.name}`);
console.log(`Files: ${rows.length}`);
console.log('');
console.log(perFile);
console.log('');
console.log(summary);

if (shouldWrite) {
  const date = new Date().toISOString().slice(0, 10);

  const doc = [
    '# Python fixture token savings',
    '',
    `Date: ${date}`,
    `Token counter: ${counter.name} (${counterDescription(counter.name)})`,
    `Fixture: fixtures/python-repo (${rows.length} files)`,
    '',
    'Levels compared: raw (original source), light (`compressLight`: comments and blank lines removed), and signatures (`renderSignatures`: function and method bodies replaced by one marker line each; imports, variables, class and function headers, and docstrings kept). Percentages are tokens saved relative to raw. The signatures level is shown with both marker styles the renderer supports.',
    '',
    '## Summary',
    '',
    summary,
    '',
    '## Findings',
    '',
    findings,
    '',
    '## Per file',
    '',
    'Columns with "%" values show the tokens saved relative to raw.',
    '',
    perFile,
    '',
    '## What we do not know yet',
    '',
    '- These numbers measure size only, and they use an approximate counter, so absolute values will change once the real tokenizer (S2-10) is integrated. Re-run `npm run report:savings:write` then.',
    '- Every `expand_symbol` call the agent makes adds tokens back, so the net saving per task is lower than the saving per file. That needs the evaluation.',
    '- We have not yet measured how each level affects answer quality: whether an agent given light or signatures-only context answers questions about the code as accurately as with the raw source, and which kinds of questions break first when bodies are omitted.',
    '- The team has not yet chosen the final marker format. The renderer defaults to the long one; the short one saves more tokens but the agent must be told what it means.',
    '',
  ].join('\n');
  mkdirSync(dirname(docPath), { recursive: true });
  writeFileSync(docPath, doc, 'utf8');
  console.log('');
  console.log(`Wrote ${relative(process.cwd(), docPath)}`);
}
