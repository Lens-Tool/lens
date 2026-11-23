import { createRequire } from 'node:module';
import type { TokenCounter } from '@lens/shared';
import { ApproxTokenCounter } from '@lens/shared';
import type { Tiktoken, TiktokenBPE } from 'js-tiktoken/lite';

// js-tiktoken is loaded with a synchronous require inside the loader (not with a top-level
// `import`) so that a missing or broken install is caught by the fallback below. A static
// import would crash the whole package (and the MCP server) before the fallback could run.
const nodeRequire = createRequire(import.meta.url);

// Runs of one character class longer than RUN_T make js-tiktoken quadratic
// (measured: 5,000 'x' ~2-4 s, 5,000 random letters ~11 s). They are counted from
// a RUN_T-char sample, extrapolated. Text without such runs is counted exactly.
const RUN_T = 128;
const LONG_RUN = /\p{L}{129,}|\s{129,}|[^\s\p{L}\p{N}]{129,}/gu;

export class TiktokenCounter implements TokenCounter {
  readonly name = 'tiktoken-cl100k_base';

  private readonly encoder: Tiktoken;

  constructor(encoder: Tiktoken) {
    this.encoder = encoder;
  }

  count(text: string): number {
    let total = 0;
    let last = 0;
    for (const m of text.matchAll(LONG_RUN)) {
      const start = m.index ?? last;
      if (start > last) {
        total += this.encoder.encode(text.slice(last, start), [], []).length;
      }
      const run = m[0];
      const sample = this.encoder.encode(run.slice(0, RUN_T), [], []).length;
      total += Math.ceil((sample * run.length) / RUN_T);
      last = start + run.length;
    }
    if (last < text.length) {
      total += this.encoder.encode(text.slice(last), [], []).length;
    }
    return total;
  }
}

/** Loads js-tiktoken and builds the cl100k_base encoder. Throws if the library is unavailable. */
export function loadCl100kEncoder(): Tiktoken {
  const lite = nodeRequire('js-tiktoken/lite') as { Tiktoken: typeof Tiktoken };
  const ranks = nodeRequire('js-tiktoken/ranks/cl100k_base') as TiktokenBPE;
  return new lite.Tiktoken(ranks);
}

/**
 * Builds a TiktokenCounter. On ANY failure (library missing, ranks not loadable, encoder broken)
 * it logs ONE fixed [lens] line to stderr and returns ApproxTokenCounter instead.
 * The log never contains the error message, paths or input text (stdout is reserved for MCP).
 * Fallback covers loading and construction only: once the counter exists, count() is not guarded.
 */
export function createTokenCounter(load: () => Tiktoken = loadCl100kEncoder): TokenCounter {
  try {
    const encoder = load();
    // Smoke test: fail now, not on the first real call.
    encoder.encode('hello world', [], []);
    return new TiktokenCounter(encoder);
  } catch {
    console.error('[lens] tiktoken unavailable, using approximate token counter');
    return new ApproxTokenCounter();
  }
}

/**
 * Returns a function that creates the counter on first use and then always returns the same
 * instance (so the decision is made once per process and the counter's `name` stays truthful).
 * Takes the loader as a parameter so tests need no hooks in production code.
 */
export function createCounterProvider(
  load: () => Tiktoken = loadCl100kEncoder,
): () => TokenCounter {
  let cached: TokenCounter | null = null;
  return () => {
    cached ??= createTokenCounter(load);
    return cached;
  };
}

/** Process-wide default counter (lazy singleton). */
export const getDefaultTokenCounter: () => TokenCounter = createCounterProvider();
