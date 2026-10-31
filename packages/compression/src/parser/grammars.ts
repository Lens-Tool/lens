import { fileURLToPath } from 'node:url';
import type { Language } from '@lens/shared';

export const GRAMMAR_FILES: Partial<Record<Language, string>> = {
  python: 'tree-sitter-python.wasm',
};

/**
 * SHA-256 of each bundled grammar file, taken from the original tree-sitter-wasms package
 * (see grammars/README.md). A test compares them, so a binary cannot change unnoticed.
 */
export const GRAMMAR_SHA256: Partial<Record<Language, string>> = {
  python: '9056d0fb0c337810d019fae350e8167786119da98f0f282aceae7ab89ee8253b',
};

export const GRAMMARS_DIR = fileURLToPath(new URL('../../grammars/', import.meta.url));
