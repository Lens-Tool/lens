import { readFile } from 'node:fs/promises';
import {
  compressLight,
  detectLanguage,
  extractPythonSymbols,
  renderSignatures,
  WasmParser,
  withParsedFile,
  type CodeParser,
} from '@lens/compression';
import {
  ApproxTokenCounter,
  LensError,
  type CompressionLevel,
  type Language,
  type TokenCounter,
  type UsageEvent,
} from '@lens/shared';

/**
 * Marker that replaces an omitted body at the `signatures` level:
 * - `short`: `... # L8-11` (the original line range; about 4 times cheaper in tokens)
 * - `long`: `... # lens: lines 8-11 omitted (expand_symbol name)` (names a tool that does not exist yet)
 * Keep `short` until expand_symbol (S2-09) is merged and the team has chosen the final format.
 */
export const SIGNATURES_MARKER: 'short' | 'long' = 'short';

export interface ReadFileCompressedDeps {
  projectId: string;
  sessionId: string;
  counter?: TokenCounter;
  now?: () => Date;
  /** Parser for the signatures level. Tests can pass their own; by default one is created once. */
  parser?: CodeParser;
}

export interface ReadFileCompressedResult {
  content: string;
  language: Language;
  tokensBefore: number;
  tokensAfter: number;
  /** Anonymous statistics only: contains no path, code, prompt text or level. */
  event: UsageEvent;
}

let sharedParser: Promise<WasmParser> | undefined;

/** One parser for the whole process: creating it loads the grammar file. */
function getParser(): Promise<WasmParser> {
  sharedParser ??= WasmParser.create(['python']).catch((error: unknown) => {
    sharedParser = undefined; // allow a retry on the next call
    throw error;
  });
  return sharedParser;
}

/** Signatures-only text, or undefined when the file has a syntax error. */
function toSignatures(source: string, parser: CodeParser): string | undefined {
  return withParsedFile(parser, source, 'python', (file) =>
    file.hasSyntaxError
      ? undefined
      : renderSignatures(source, extractPythonSymbols(file.root, source), {
          marker: SIGNATURES_MARKER,
        }),
  );
}

async function applyLevel(
  source: string,
  language: Language,
  level: CompressionLevel,
  deps: ReadFileCompressedDeps,
): Promise<string> {
  switch (level) {
    case 'raw':
      return source;
    case 'light':
      return compressLight(source, language).content;
    case 'signatures': {
      // If signatures cannot be produced, return the file unchanged: a parser problem must never
      // hide code from the agent. Warnings go to stderr (stdout is reserved for the MCP protocol).
      try {
        const parser = deps.parser ?? (await getParser());
        const rendered = toSignatures(source, parser);
        if (rendered !== undefined) return rendered;
        console.error('[lens] The file has a syntax error: returning it unchanged.');
      } catch {
        console.error('[lens] Signatures could not be produced: returning the file unchanged.');
      }
      return source;
    }
    default: {
      const unreachable: never = level; // compile error if a level is added and not handled
      throw new LensError('INVALID_INPUT', `Unknown level: ${String(unreachable)}`);
    }
  }
}

export async function readFileCompressed(
  path: string,
  deps: ReadFileCompressedDeps,
  level: CompressionLevel = 'light',
): Promise<ReadFileCompressedResult> {
  const counter = deps.counter ?? new ApproxTokenCounter();
  const now = deps.now ?? (() => new Date());
  const started = performance.now();

  const language = detectLanguage(path);
  if (level === 'signatures' && language !== 'python') {
    throw new LensError(
      'NOT_IMPLEMENTED',
      'Level "signatures" works for Python files only for now. Use level "light" or "raw".',
    );
  }

  let source: string;
  try {
    source = await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new LensError('FILE_NOT_FOUND', 'The requested file does not exist.');
    }
    throw new LensError('INTERNAL', 'The file could not be read.');
  }

  const content = await applyLevel(source, language, level, deps);
  const tokensBefore = counter.count(source);
  const tokensAfter = counter.count(content);

  return {
    content,
    language,
    tokensBefore,
    tokensAfter,
    event: {
      schemaVersion: 1,
      projectId: deps.projectId,
      sessionId: deps.sessionId,
      tool: 'read_file_compressed',
      tokensBefore,
      tokensAfter,
      durationMs: Math.round(performance.now() - started),
      occurredAt: now().toISOString(),
    },
  };
}
