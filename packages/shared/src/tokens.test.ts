import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApproxTokenCounter, TiktokenCounter } from './tokens.js';

describe('token counters', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock('js-tiktoken');
  });

  it('retains the approximate counter behavior', () => {
    const counter = new ApproxTokenCounter();

    expect(counter.name).toBe('approx-chars-div-4');
    expect(counter.count('')).toBe(0);
    expect(counter.count('hello')).toBe(2);
  });

  it('counts text with the configured tiktoken encoding', () => {
    const counter = new TiktokenCounter('cl100k_base');

    expect(counter.name).toBe('cl100k_base');
    expect(counter.count('')).toBe(0);
    expect(counter.count('hello')).toBe(1);
    expect(counter.count('hello world')).toBe(2);
  });

  it('matches the documented tiktoken example', () => {
    const counter = new TiktokenCounter('cl100k_base');

    expect(counter.count('tiktoken is great!')).toBe(6);
  });

  it('allows source text that contains special-token strings', () => {
    const counter = new TiktokenCounter();

    expect(counter.count('<|endoftext|>')).toBeGreaterThan(0);
  });

  it('falls back to the approximate counter and logs to stderr when loading fails', async () => {
    vi.doMock('js-tiktoken', () => ({
      getEncoding: () => {
        throw new Error('load failed');
      },
    }));
    const write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { TiktokenCounter: FailingCounter } = await import('./tokens.js');
    const counter = new FailingCounter();

    expect(counter.name).toBe('approx-chars-div-4');
    expect(counter.count('hello')).toBe(2);
    expect(write).toHaveBeenCalledTimes(1);
    expect(String(write.mock.calls[0]?.[0])).toContain('load failed');
  });
});
