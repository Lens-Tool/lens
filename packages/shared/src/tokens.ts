import type { TokenCounter } from './types.js';
import { getEncoding, type Tiktoken, type TiktokenEncoding } from 'js-tiktoken';

export class ApproxTokenCounter implements TokenCounter {
  readonly name = 'approx-chars-div-4';

  count(text: string): number {
    return Math.ceil(text.length / 4);
  }
}

export const DEFAULT_ENCODING_GENERIC_GPT4_FAMILY_CL100K_BASE: TiktokenEncoding = 'cl100k_base';

export class TiktokenCounter implements TokenCounter {
  readonly name: string;
  private readonly encoding: Tiktoken | null;
  private readonly fallback = new ApproxTokenCounter();

  constructor(encodingName: TiktokenEncoding = DEFAULT_ENCODING_GENERIC_GPT4_FAMILY_CL100K_BASE) {
    let loaded: Tiktoken | null = null;
    try {
      loaded = getEncoding(encodingName);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      process.stderr.write(
        `TiktokenCounter: failed to load ${encodingName}, using ${this.fallback.name} (${reason})\n`,
      );
    }
    this.encoding = loaded;
    this.name = loaded ? encodingName : this.fallback.name;
  }

  count(text: string): number {
    if (!this.encoding) return this.fallback.count(text);
    return this.encoding.encode(text, 'all').length;
  }
}
