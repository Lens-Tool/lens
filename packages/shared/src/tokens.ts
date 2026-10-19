import type { TokenCounter } from './types.js';

/**
 * Rough estimate (about 4 characters per token). Placeholder until the tiktoken
 * integration (spike T12) is decided. Never use it for published savings numbers.
 */
export class ApproxTokenCounter implements TokenCounter {
  readonly name = 'approx-chars-div-4';

  count(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
