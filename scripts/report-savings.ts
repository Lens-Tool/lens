import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WasmParser, compressLight, extractPythonSymbolsFromSource } from '@lens/compression';
import { ApproxTokenCounter, type SymbolNode } from '@lens/shared';

// Token savings of each compression level on the Python sample repo (task S2-11).
//
// The "signatures" level here is an APPROXIMATION built from the extracted symbol ranges, because
// the real renderer (S2-06) is not used yet. Switch to it, and to the tiktoken counter (S2-10), when
// they are merged, then regenerate the document.
//
// Usage:  npm run report:savings          print the tables
//         npm run report:savings:write    also regenerate docs/research/python-savings.md

/** What replaces an omitted body: nothing (impossible in real output), a short or a long marker. */
type Marker = 'none' | 'short' | 'long';

type Row = {
  file: string;
  raw: number;
  light: number;
  none: number;
  short: number;
  long: number;
  symbols: number;
  omitted: number;
};

type Body = { start: number; end: number; name: string };

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const root = join(repoRoot, 'fixtures', 'python-repo');
const docPath = join(repoRoot, 'docs', 'research', 'python-savings.md');
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

/** Bodies that can be dropped. A class body spans its members, so classes are skipped and their methods are used. */
function collectBodies(symbols: SymbolNode[], out: Body[]): void {
  for (const symbol of symbols) {
    if (symbol.kind === 'class') {
      collectBodies(symbol.children ?? [], out);
    } else if (symbol.body) {
      out.push({
        start: symbol.body.startLine,
        end: symbol.body.endLine,
        name: symbol.qualifiedName,
      });
    }
  }
}

function markerText(marker: Marker, body: Body): string | undefined {
  if (marker === 'short') return `...  # L${body.start}-${body.end}`;
  if (marker === 'long') {
    return `...  # lens: lines ${body.start}-${body.end} omitted (expand_symbol ${body.name})`;
  }
  return undefined;
}

function renderSignatures(source: string, symbols: SymbolNode[], marker: Marker): string {
  const bodies: Body[] = [];
  collectBodies(symbols, bodies);
  const byStart = new Map<number, Body>();
  const dropped = new Set<number>();
  for (const body of bodies) {
    byStart.set(body.start, body);
    for (let lineNumber = body.start; lineNumber <= body.end; lineNumber += 1)
      dropped.add(lineNumber);
  }

  const kept: string[] = [];
  source.split(/\r?\n/).forEach((text, index) => {
    const lineNumber = index + 1;
    const body = byStart.get(lineNumber);
    const placeholder = body ? markerText(marker, body) : undefined;
    if (placeholder) kept.push(`${/^\s*/.exec(text)?.[0] ?? ''}${placeholder}`);
    if (dropped.has(lineNumber) || text.trim() === '') return;
    kept.push(text);
  });
  return kept.join('\n') + (kept.length > 0 ? '\n' : '');
}

function saved(part: number, whole: number): string {
  if (whole === 0) return '0.0%';
  return `${((1 - part / whole) * 100).toFixed(1)}%`;
}

function line(row: Row): string {
  return `| ${row.file} | ${row.raw} | ${row.light} | ${saved(row.light, row.raw)} | ${saved(row.none, row.raw)} | ${saved(row.short, row.raw)} | ${saved(row.long, row.raw)} | ${row.symbols} | ${row.omitted} |`;
}

const parser = await WasmParser.create(['python']);
const rows: Row[] = [];

for (const path of walk(root)) {
  const source = readFileSync(path, 'utf8');
  const symbols = extractPythonSymbolsFromSource(parser, source);
  const bodies: Body[] = [];
  collectBodies(symbols, bodies);
  rows.push({
    file: relative(root, path).split('\\').join('/'),
    raw: counter.count(source),
    light: counter.count(compressLight(source, 'python').content),
    none: counter.count(renderSignatures(source, symbols, 'none')),
    short: counter.count(renderSignatures(source, symbols, 'short')),
    long: counter.count(renderSignatures(source, symbols, 'long')),
    symbols: countSymbols(symbols),
    omitted: bodies.length,
  });
}

const total = rows.reduce<Row>(
  (acc, row) => ({
    file: 'TOTAL',
    raw: acc.raw + row.raw,
    light: acc.light + row.light,
    none: acc.none + row.none,
    short: acc.short + row.short,
    long: acc.long + row.long,
    symbols: acc.symbols + row.symbols,
    omitted: acc.omitted + row.omitted,
  }),
  { file: 'TOTAL', raw: 0, light: 0, none: 0, short: 0, long: 0, symbols: 0, omitted: 0 },
);

const perFile = [
  '| File | Raw tokens | Light | Light saved | Signatures, no placeholder (upper bound) | Signatures, short marker | Signatures, long marker | Symbols | Bodies omitted |',
  '|---|---:|---:|---:|---:|---:|---:|---:|---:|',
  ...rows.map(line),
  line(total),
].join('\n');

const summary = [
  '| Level | Tokens | Saved |',
  '|---|---:|---:|',
  `| Raw (original source) | ${total.raw} | - |`,
  `| Light (comments and blank lines removed) | ${total.light} | ${saved(total.light, total.raw)} |`,
  `| Signatures, no placeholder (upper bound, cannot be reached) | ${total.none} | ${saved(total.none, total.raw)} |`,
  `| Signatures, short marker \`...  # L8-11\` | ${total.short} | ${saved(total.short, total.raw)} |`,
  `| Signatures, long marker \`...  # lens: lines 8-11 omitted (expand_symbol name)\` | ${total.long} | ${saved(total.long, total.raw)} |`,
].join('\n');

const removedPerBody = total.omitted > 0 ? Math.round((total.raw - total.none) / total.omitted) : 0;
const shortCost = total.omitted > 0 ? ((total.short - total.none) / total.omitted).toFixed(1) : '0';
const longCost = total.omitted > 0 ? ((total.long - total.none) / total.omitted).toFixed(1) : '0';

const findings = [
  `- The light level saves only ${saved(total.light, total.raw)}: comments and blank lines are a very small part of the tokens.`,
  `- Almost all the savings come from omitting function and method bodies, which is also the level that risks answer quality (not measured yet).`,
  `- The no-placeholder figure (${saved(total.none, total.raw)}) is an upper bound that real output cannot reach: every omitted body must leave a marker so the agent knows something is missing.`,
  `- Omitting a body removes about ${removedPerBody} tokens on average, so the size of the marker decides the result. A short marker costs about ${shortCost} tokens per body and a long marker about ${longCost}. The long marker also repeats the function name that is already on the line above it.`,
  `- With the short marker the signatures level saves ${saved(total.short, total.raw)}; with the long marker, ${saved(total.long, total.raw)}.`,
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
    `Token counter: ${counter.name} (rough estimate, about 4 characters per token; not a real tokenizer)`,
    `Fixture: fixtures/python-repo (${rows.length} files)`,
    '',
    'Levels compared: raw (original source), light (`compressLight`: comments and blank lines removed), and signatures (function and method bodies removed using the extracted symbol ranges; imports, variables, class and function headers kept). Percentages are tokens saved relative to raw.',
    '',
    'The signatures level is an **approximation** built by `scripts/report-savings.ts` until the real renderer (S2-06) is merged. It is shown three ways: with no placeholder (an upper bound that real output cannot reach), with a short marker, and with a long marker that names the function.',
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
    '- These numbers measure size only, and they use an approximate counter, so absolute values will change once a real tokenizer is integrated.',
    '- The signatures numbers will change when the real renderer (S2-06) replaces this approximation. Re-run `npm run report:savings:write` then.',
    '- Every `expand_symbol` call the agent makes adds tokens back, so the net saving per task is lower than the saving per file. That needs the evaluation.',
    '- We have not yet measured how each level affects answer quality: whether an agent given light or signatures-only context answers questions about the code as accurately as with the raw source, and which kinds of questions break first when bodies are omitted.',
    '',
  ].join('\n');
  mkdirSync(dirname(docPath), { recursive: true });
  writeFileSync(docPath, doc, 'utf8');
  console.log('');
  console.log(`Wrote ${relative(process.cwd(), docPath)}`);
}
