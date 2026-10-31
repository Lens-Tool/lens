import type Parser from 'web-tree-sitter';
import type { Language } from '@lens/shared';

export type SyntaxNode = Parser.SyntaxNode;

export interface ParsedFile {
  readonly language: Language;
  readonly root: SyntaxNode;
  readonly hasSyntaxError: boolean;
  dispose(): void;
}

export interface CodeParser {
  parse(source: string, language: Language): ParsedFile;
}
