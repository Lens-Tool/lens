import { LensError, type Language } from '@lens/shared';
import type { CodeParser, ParsedFile } from './types.js';

/**
 * Parses `source`, runs `fn`, and always disposes the tree afterwards, so callers cannot forget.
 * `fn` must be synchronous and must return plain data (such as SymbolNode[]), not tree nodes:
 * everything taken from the tree is invalid after the call.
 */
export function withParsedFile<T>(
  parser: CodeParser,
  source: string,
  language: Language,
  fn: (file: ParsedFile) => T,
): T {
  const file = parser.parse(source, language);
  try {
    const result = fn(file);
    if (result instanceof Promise) {
      throw new LensError(
        'INTERNAL',
        'withParsedFile callbacks must be synchronous: the tree is freed when the callback returns.',
      );
    }
    return result;
  } finally {
    file.dispose();
  }
}
