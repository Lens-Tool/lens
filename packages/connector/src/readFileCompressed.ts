import { readFile } from 'node:fs/promises';
import {
  compressLight,
  compressPython,
  detectLanguage,
  getDefaultTokenCounter,
  WasmParser,
  type CodeParser,
} from '@lens/compression';
import {
  LensError,
  type CompressionLevel,
  type Language,
  type TokenCounter,
  type UsageEvent,
} from '@lens/shared';
import { resolveInsideRoot } from './pathGuard.js';

/**
 * Marker that replaces an omitted body at the `signatures` level:
 * - `short`: `... # L8-11` (the original line range; about 4 times cheaper in tokens)
 * - `long`: `... # lens: lines 8-11 omitted (expand_symbol name)` (names the expand_symbol tool)
 * Keep `short` until the team has chosen the final format (ADR open item).
 */
export const SIGNATURES_MARKER: 'short' | 'long' = 'short';

export interface ReadFileCompressedDeps {
  projectId: string;
  sessionId: string;
  /** When set, only files inside this folder can be read (same rule as expand_symbol). */
  repoRoot?: string;
  counter?: TokenCounter;
  now?: () => Date;
  /** Parser for the signatures level. Tests can pass their own; by default one is created once. */
  parser?: CodeParser;
}

export interface ReadFileCompressedResult {
  content: string;
  language: Language;
  /** Set when the file was returned unchanged instead of compressed. Shown to the agent. */
  warning?: string;
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

/** Shown when the parser could not run at all (missing grammar, crash). */
export const SIGNATURES_FAILED_WARNING =
  'Signatures could not be produced; returning the file unchanged at level raw. Code is never omitted because of a parser problem.';

interface Applied {
  content: string;
  warning?: string;
}

async function applyLevel(
  source: string,
  language: Language,
  level: CompressionLevel,
  deps: ReadFileCompressedDeps,
): Promise<Applied> {
  switch (level) {
    case 'raw':
      return { content: source };
    case 'light':
      return { content: compressLight(source, language).content };
    case 'signatures': {
      // If signatures cannot be produced, return the file unchanged and say so: a parser problem
      // must never hide code from the agent (S2-07). The warning goes to the agent in the tool
      // result and a fixed line goes to stderr (stdout is reserved for the MCP protocol).
      try {
        const parser = deps.parser ?? (await getParser());
        const result = compressPython(parser, source, { marker: SIGNATURES_MARKER });
        if (result.warning !== undefined) {
          console.error('[lens] The file has a syntax error: returning it unchanged.');
        }
        return { content: result.content, warning: result.warning };
      } catch {
        console.error('[lens] Signatures could not be produced: returning the file unchanged.');
        return { content: source, warning: SIGNATURES_FAILED_WARNING };
      }
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
  const counter = deps.counter ?? getDefaultTokenCounter();
  const now = deps.now ?? (() => new Date());
  const started = performance.now();

  const language = detectLanguage(path);
  if (level === 'signatures' && language !== 'python') {
    throw new LensError(
      'NOT_IMPLEMENTED',
      'Level "signatures" works for Python files only for now. Use level "light" or "raw".',
    );
  }

  const readPath = deps.repoRoot ? await resolveInsideRoot(deps.repoRoot, path) : path;

  let source: string;
  try {
    source = await readFile(readPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new LensError('FILE_NOT_FOUND', 'The requested file does not exist.');
    }
    throw new LensError('INTERNAL', 'The file could not be read.');
  }

  const { content, warning } = await applyLevel(source, language, level, deps);
  const tokensBefore = counter.count(source);
  const tokensAfter = counter.count(content);

  return {
    content,
    language,
    ...(warning !== undefined ? { warning } : {}),
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
