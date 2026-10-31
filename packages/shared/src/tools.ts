/**
 * DRAFT local-only contracts for the MCP tools.
 * These stay on the developer's machine. They must NEVER be sent to the statistics backend:
 * only `UsageEvent` (types.ts) may leave the machine.
 * Module owners review these in task S1-07; SymbolRef is aligned with the SymbolNode design from S1-08.
 */
import type { Language } from './types.js';

export type SymbolKind =
  'function' | 'class' | 'method' | 'interface' | 'type' | 'variable' | 'import';

export interface SymbolRef {
  name: string;
  kind: SymbolKind;
  /** 1-based, inclusive. */
  startLine: number;
  endLine: number;
  /** Signature text only, never the body. */
  signature: string;
}

export interface ExpandSymbolInput {
  path: string;
  symbol: string;
}
export interface ExpandSymbolResult {
  symbol: SymbolRef;
  language: Language;
  /** Full source of the symbol, after secrets redaction. */
  content: string;
}

export interface SearchCodeInput {
  query: string;
  maxResults?: number;
}
export interface SearchCodeMatch {
  path: string;
  line: number;
  symbol?: string;
  snippet: string;
}
export interface SearchCodeResult {
  matches: SearchCodeMatch[];
}

/** Open question: the proposal does not say whether get_summary covers a file, the project or the session. Drafted as a file summary. */
export interface GetSummaryInput {
  path: string;
}
export interface GetSummaryResult {
  language: Language;
  symbols: SymbolRef[];
  tokensBefore: number;
  tokensAfter: number;
}
