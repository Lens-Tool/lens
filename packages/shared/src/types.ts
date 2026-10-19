/** Languages in scope per the proposal. */
export type Language = 'python' | 'javascript' | 'typescript';

/** The five agent-facing MCP tools from the proposal (Deliverable 1). */
export const TOOL_NAMES = [
  'prepare_task',
  'read_file_compressed',
  'search_code',
  'get_summary',
  'expand_symbol',
] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

/**
 * Compression levels. Sprint 1 implements only `light` (comment/blank-line stripping).
 * `signatures` (AST) arrives in the parser sprints; `raw` is the fallback level.
 */
export type CompressionLevel = 'raw' | 'light' | 'signatures';

export interface CompressResult {
  content: string;
  language: Language;
  level: CompressionLevel;
}

export interface TokenCounter {
  readonly name: string;
  count(text: string): number;
}

/**
 * The ONLY shape that may be sent to the cloud statistics backend.
 * It contains no code, prompt text or file paths (proposal, section 3A).
 */
export interface UsageEvent {
  schemaVersion: 1;
  /** Random identifier. Must NOT be derived from a path, repo name or user name. */
  projectId: string;
  sessionId: string;
  tool: ToolName;
  tokensBefore: number;
  tokensAfter: number;
  durationMs: number;
  /** ISO-8601 timestamp. */
  occurredAt: string;
}
