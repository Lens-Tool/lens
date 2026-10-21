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

  // Leak scenario 1: private data hidden under another field name
  it('does not echo rejected field names (they can contain paths)', () => {
    try {
      parseUsageEvent({ ...valid, '/home/me/secret.py': 1 });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(LensError);
      expect((error as LensError).code).toBe('PRIVACY_VIOLATION');
      expect((error as LensError).message).not.toContain('secret.py');
    }
  });

  // Leak scenario 2: a path disguised as an identifier
  it.each(['C:\\Users\\me\\repo', '/home/me/repo', '../secret', 'my project name', 'a'.repeat(65)])(
    'rejects path-like or oversized id %j',
    (id) => {
      expect(() => parseUsageEvent({ ...valid, projectId: id })).toThrow(LensError);
      expect(() => parseUsageEvent({ ...valid, sessionId: id })).toThrow(LensError);
    },
  );

  // Leak scenario 3: free text smuggled inside the timestamp
  it('rejects timestamps that carry extra text', () => {
    const smuggled = 'Tue Oct 20 2026 (C:\\Users\\me\\secret.py)';
    expect(Number.isNaN(Date.parse(smuggled))).toBe(false); // why Date.parse alone is not enough
    expect(() => parseUsageEvent({ ...valid, occurredAt: smuggled })).toThrowError(
      expect.objectContaining({ code: 'INVALID_INPUT' }),
    );
  });
});
