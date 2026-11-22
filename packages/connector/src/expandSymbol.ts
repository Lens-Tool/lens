import { readFile, realpath } from 'node:fs/promises';
import * as path from 'node:path';
import { performance } from 'node:perf_hooks';
import {
  detectLanguage,
  extractPythonSymbols,
  WasmParser,
  withParsedFile,
  type CodeParser,
} from '@lens/compression';
import {
  ApproxTokenCounter,
  LensError,
  type ExpandSymbolResult,
  type Language,
  type SymbolNode,
  type SymbolRef,
  type TokenCounter,
  type UsageEvent,
} from '@lens/shared';

export interface ExpandSymbolDeps {
  projectId: string;
  sessionId: string;
  repoRoot: string;
  counter?: TokenCounter;
  now?: () => Date;
  parser?: CodeParser;
}

export interface ExpandSymbolResultInternal {
  matches: ExpandSymbolResultWithQualifiedName[];
  language: Language;
  tokensBefore: number;
  tokensAfter: number;
  event: UsageEvent;
}

// Internal match type that includes qualifiedName for display
export interface ExpandSymbolResultWithQualifiedName extends ExpandSymbolResult {
  qualifiedName: string;
}

// Internal constant for "symbol not found" - maps to INVALID_INPUT for now
// TODO(NOT_FOUND): Switch to 'NOT_FOUND' once added to shared LensErrorCode
export const SYMBOL_NOT_FOUND_CODE = 'INVALID_INPUT' as const;
export const SYMBOL_NOT_FOUND_MSG = (symbol: string) => `Symbol not found: ${symbol}`;

let sharedParser: Promise<WasmParser> | undefined;

function getParser(): Promise<WasmParser> {
  sharedParser ??= WasmParser.create(['python']).catch((error: unknown) => {
    sharedParser = undefined;
    throw error;
  });
  return sharedParser;
}

function findMatchingSymbols(symbols: SymbolNode[], target: string): SymbolNode[] {
  const matches: SymbolNode[] = [];

  function search(symbols: SymbolNode[]) {
    for (const sym of symbols) {
      if (sym.name === target || sym.qualifiedName === target) {
        matches.push(sym);
      }
      if (sym.children) {
        search(sym.children);
      }
    }
  }

  search(symbols);
  return matches;
}

function buildSymbolRef(sym: SymbolNode): SymbolRef {
  return {
    name: sym.name,
    kind: sym.kind,
    startLine: sym.startLine,
    endLine: sym.endLine,
    signature: sym.signature,
  };
}

export async function expandSymbol(
  inputPath: string,
  deps: ExpandSymbolDeps,
  symbol: string,
): Promise<ExpandSymbolResultInternal> {
  const counter = deps.counter ?? new ApproxTokenCounter();
  const now = deps.now ?? (() => new Date());
  const started = performance.now();

  // 1. Validate path is inside repo root (with symlink resolution)
  // First resolve inputPath against repoRoot if it's relative
  const realRoot = await realpath(deps.repoRoot);
  const resolvedInputPath = path.isAbsolute(inputPath)
    ? inputPath
    : path.resolve(realRoot, inputPath);

  // Check path traversal before realpath (which fails on non-existent paths)
  const relative = path.relative(realRoot, resolvedInputPath);
  if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    throw new LensError('INVALID_INPUT', 'Path must be inside the repository root.');
  }

  // Now resolve symlinks and check again
  let realPath: string;
  try {
    realPath = await realpath(resolvedInputPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new LensError('FILE_NOT_FOUND', 'The requested file does not exist.');
    }
    throw new LensError('INTERNAL', 'The file could not be read.');
  }

  const relativeReal = path.relative(realRoot, realPath);
  if (
    relativeReal === '..' ||
    relativeReal.startsWith('..' + path.sep) ||
    path.isAbsolute(relativeReal)
  ) {
    throw new LensError('INVALID_INPUT', 'Path must be inside the repository root.');
  }

  // 2. Detect language first (cheap, no file read)
  const language = detectLanguage(realPath);
  if (language !== 'python') {
    throw new LensError(
      'UNSUPPORTED_LANGUAGE',
      'expand_symbol works for Python files only for now.',
    );
  }

  // 3. Read file
  let source: string;
  try {
    source = await readFile(realPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new LensError('FILE_NOT_FOUND', 'The requested file does not exist.');
    }
    throw new LensError('INTERNAL', 'The file could not be read.');
  }

  // 4. Extract symbols
  const parser = deps.parser ?? (await getParser());
  const symbols: SymbolNode[] = await withParsedFile(parser, source, 'python', (file) =>
    extractPythonSymbols(file.root, source),
  );

  // 5. Find matches (exact match on name or qualifiedName)
  const matches = findMatchingSymbols(symbols, symbol);

  if (matches.length === 0) {
    throw new LensError(SYMBOL_NOT_FOUND_CODE, SYMBOL_NOT_FOUND_MSG(symbol));
  }

  // 6. Build results with source content. Split on \n or \r\n and join with the file's own line
  // ending: a CRLF file gives CRLF between lines and no stray \r at the end of the symbol.
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  const sourceLines = source.split(/\r?\n/);
  const results: ExpandSymbolResultWithQualifiedName[] = [];

  for (const match of matches) {
    // Extract source lines (1-based, inclusive)
    // startLine and endLine already include decorators
    const startIdx = match.startLine - 1;
    const endIdx = match.endLine; // slice is exclusive, so endLine is correct
    const contentLines = sourceLines.slice(startIdx, endIdx);

    // TODO(redaction): Apply secrets redaction before returning content
    const content = contentLines.join(eol);

    results.push({
      symbol: buildSymbolRef(match),
      language,
      content,
      qualifiedName: match.qualifiedName,
    });
  }

  // 7. Compute token counts and build event
  const tokensBefore = counter.count(source);
  const tokensAfter = counter.count(results.map((r) => r.content).join('\n'));

  return {
    matches: results,
    language,
    tokensBefore,
    tokensAfter,
    event: {
      schemaVersion: 1,
      projectId: deps.projectId,
      sessionId: deps.sessionId,
      tool: 'expand_symbol',
      tokensBefore,
      tokensAfter,
      durationMs: Math.round(performance.now() - started),
      occurredAt: now().toISOString(),
    },
  };
}
