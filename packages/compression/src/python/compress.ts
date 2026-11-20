import type { CompressResult } from '@lens/shared';
import { withParsedFile, type CodeParser } from '../parser/index.js';
import { extractPythonSymbols } from './extract.js';
import { renderSignatures, type RenderSignaturesOptions } from './renderSignatures.js';
/** Shown when a file cannot be compressed safely because the parser found syntax errors. */
export const SYNTAX_ERROR_RAW_WARNING =
  'Syntax error detected; returning the file unchanged at level raw. Code is never omitted because of a parser problem.';

/**
 * Compress a Python file to the signatures level.
 *
 * Rule (S2-07): if the parse tree reports a syntax error (`hasSyntaxError`), return the original
 * source unchanged with `level: 'raw'` and a warning. Never hide or rewrite code when the parser
 * is unsure — a broken AST must not drop real source.
 */
export function compressPython(
  parser: CodeParser,
  source: string,
  options?: RenderSignaturesOptions,
): CompressResult {
  return withParsedFile(parser, source, 'python', (file) => {
    if (file.hasSyntaxError) {
      return {
        content: source,
        language: 'python',
        level: 'raw',
        warning: SYNTAX_ERROR_RAW_WARNING,
      };
    }

    const symbols = extractPythonSymbols(file.root, source);
    return {
      content: renderSignatures(source, symbols, options),
      language: 'python',
      level: 'signatures',
    };
  });
}
