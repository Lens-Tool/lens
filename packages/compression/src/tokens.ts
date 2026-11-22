import type { TokenCounter } from '@lens/shared';
import { ApproxTokenCounter } from '@lens/shared';
import { Tiktoken } from 'js-tiktoken/lite';
import cl100kBaseRanks from 'js-tiktoken/ranks/cl100k_base';

/**
 * Real Tiktoken-based token counter using the cl100k_base encoding.
 * Uses the lite entry point to avoid bundling all encodings.
 * Always calls encode(text, [], []) so special tokens like "<|endoftext|>"
 * are counted as plain text rather than throwing.
 *
 * Why cl100k_base: stable OpenAI encoding used by GPT-4/3.5-turbo; widely available
 * in pure-JS form; close estimates for non-OpenAI models (Claude, etc. tokenize differently).
 * No dispose/free needed: pure JS implementation, encoder is stateless after construction.
 */

// Runs of one character class longer than RUN_T make js-tiktoken quadratic
// (measured: 5,000 'x' ~4 s, 5,000 random letters ~11 s). They are counted from
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

// Lazy singleton state
let defaultTokenCounter: TokenCounter | null = null;
let tokenCounterLoader: (() => TiktokenCounter) | null = null;

/**
 * Returns a process-wide singleton token counter.
 * First call: tries to load Tiktoken; on success returns TiktokenCounter.
 * On ANY failure: logs ONE fixed [lens] warning to stderr and returns ApproxTokenCounter.
 * Subsequent calls: return the cached instance (never switches mid-process).
 *
 * Fallback only covers the initial construction — once TiktokenCounter is created,
 * its encode() calls are assumed to succeed. If encode() ever throws at runtime,
 * the exception propagates (consistent with TokenCounter interface being sync/no-throw).
 */
export function getDefaultTokenCounter(): TokenCounter {
  if (defaultTokenCounter !== null) {
    return defaultTokenCounter;
  }

  try {
    // Test-only hook: allow injecting a custom loader that can throw
    if (tokenCounterLoader !== null) {
      defaultTokenCounter = tokenCounterLoader();
    } else {
      const encoder = new Tiktoken(cl100kBaseRanks);
      // Smoke test: ensure the encoder works for basic input
      encoder.encode('hello world', [], []);
      defaultTokenCounter = new TiktokenCounter(encoder);
    }
  } catch {
    console.error('[lens] tiktoken unavailable, using approximate token counter');
    defaultTokenCounter = new ApproxTokenCounter();
  }

  return defaultTokenCounter;
}

/**
 * TEST-ONLY: Reset the singleton so the next call re-initializes.
 * Not part of the public API.
 */
export function resetTokenCounterForTest(): void {
  defaultTokenCounter = null;
  tokenCounterLoader = null;
}

/**
 * TEST-ONLY: Inject a custom loader that can throw to test the fallback path.
 * Not part of the public API.
 */
export function setTokenCounterLoaderForTest(loader: () => TiktokenCounter): void {
  tokenCounterLoader = loader;
}
