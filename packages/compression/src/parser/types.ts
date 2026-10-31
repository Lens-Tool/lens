import type Parser from 'web-tree-sitter';
import type { Language } from '@lens/shared';

/**
 * The node type of the tree. It comes from web-tree-sitter; the native bindings expose the same
 * node API (checked in spike S1-08), so extractors written against it work with either loader.
 */
export type SyntaxNode = Parser.SyntaxNode;

export interface ParsedFile {
  readonly language: Language;
  readonly root: SyntaxNode;
  readonly hasSyntaxError: boolean;
  /**
   * Frees the WASM memory held by the tree. Callers MUST call it when they are done with the file:
   * WASM trees are not garbage collected. Safe to call more than once; `root` throws afterwards.
   */
  dispose(): void;
}

export interface CodeParser {
  parse(source: string, language: Language): ParsedFile;
}
