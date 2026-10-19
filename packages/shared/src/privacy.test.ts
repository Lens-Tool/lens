import { describe, expect, it } from 'vitest';
import { LensError, parseUsageEvent } from './index.js';

const valid = {
  schemaVersion: 1,
  projectId: 'proj_abc12345',
  sessionId: 'sess_abc12345',
  tool: 'read_file_compressed',
  tokensBefore: 1000,
  tokensAfter: 400,
  durationMs: 12,
  occurredAt: '2026-10-20T10:00:00.000Z',
};

describe('parseUsageEvent (privacy gate)', () => {
  it('accepts a valid anonymous event', () => {
    expect(parseUsageEvent(valid)).toEqual(valid);
  });

  it('rejects a file path field as a privacy violation', () => {
    expect(() => parseUsageEvent({ ...valid, filePath: '/home/me/secret.py' })).toThrowError(
      expect.objectContaining({ code: 'PRIVACY_VIOLATION' }),
    );
  });

  it('rejects prompt text and code fields', () => {
    for (const field of ['prompt', 'code', 'content']) {
      expect(() => parseUsageEvent({ ...valid, [field]: 'x' })).toThrow(LensError);
    }
  });

  it('rejects path-like identifiers', () => {
    expect(() => parseUsageEvent({ ...valid, projectId: '/home/me/repo' })).toThrowError(
      expect.objectContaining({ code: 'INVALID_INPUT' }),
    );
  });

  it('rejects negative or fractional token counts', () => {
    expect(() => parseUsageEvent({ ...valid, tokensAfter: -1 })).toThrow(LensError);
    expect(() => parseUsageEvent({ ...valid, tokensBefore: 1.5 })).toThrow(LensError);
  });
});
