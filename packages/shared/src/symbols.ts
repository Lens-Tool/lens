/**
 * Symbol model shared by the parser, the extractors, the compressor and the task layer.
 * A `SymbolNode` is a `SymbolRef` (tools.ts) plus the extra detail the compressor needs.
 */
import type { SymbolKind } from './tools.js';
import type { Language } from './types.js';

export interface SymbolReference {
  name: string;
  line: number;
  kind: 'call' | 'read' | 'import' | 'type';
}

export interface SymbolNode {
  id: string;
  name: string;
  qualifiedName: string;
  kind: SymbolKind;
  language: Language;
  startLine: number;
  endLine: number;
  signature: string;
  docstring?: string;
  exported: boolean;
  body?: { startLine: number; endLine: number };
  children?: SymbolNode[];
  references?: SymbolReference[];
}
