import type { SymbolRef } from './tools.js';
import type { Language } from './types.js';

export interface SymbolReference {
  name: string;
  line: number;
  kind: 'call' | 'read' | 'import' | 'type';
}

export interface SymbolNode extends SymbolRef {
  id: string;
  qualifiedName: string;
  language: Language;
  docstring?: string;
  exported: boolean;
  body?: { startLine: number; endLine: number };
  children?: SymbolNode[];
  references?: SymbolReference[];
}
