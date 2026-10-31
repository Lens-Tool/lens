import { fileURLToPath } from 'node:url';
import type { Language } from '@lens/shared';

export const GRAMMAR_FILES: Partial<Record<Language, string>> = {
  python: 'tree-sitter-python.wasm',
};

export const GRAMMARS_DIR = fileURLToPath(new URL('../../grammars/', import.meta.url));
