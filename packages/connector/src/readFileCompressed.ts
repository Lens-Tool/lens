import { readFile } from 'node:fs/promises';
import { compressLight, detectLanguage } from '@lens/compression';
import {
  ApproxTokenCounter,
  LensError,
  type Language,
  type TokenCounter,
  type UsageEvent,
} from '@lens/shared';

export interface ReadFileCompressedDeps {
  projectId: string;
  sessionId: string;
  counter?: TokenCounter;
  now?: () => Date;
}

export interface ReadFileCompressedResult {
  content: string;
  language: Language;
  tokensBefore: number;
  tokensAfter: number;
  /** Anonymous statistics only: contains no path, code or prompt text. */
  event: UsageEvent;
}

export async function readFileCompressed(
  path: string,
  deps: ReadFileCompressedDeps,
): Promise<ReadFileCompressedResult> {
  const counter = deps.counter ?? new ApproxTokenCounter();
  const now = deps.now ?? (() => new Date());
  const started = performance.now();

  const language = detectLanguage(path);

  let source: string;
  try {
    source = await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new LensError('FILE_NOT_FOUND', 'The requested file does not exist.');
    }
    throw new LensError('INTERNAL', 'The file could not be read.');
  }

  const { content } = compressLight(source, language);
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
