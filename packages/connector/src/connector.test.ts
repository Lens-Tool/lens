import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseUsageEvent } from '@lens/shared';
import { readFileCompressed } from './readFileCompressed.js';

const fixture = (name: string) =>
  fileURLToPath(new URL(`../../../fixtures/${name}`, import.meta.url));
const deps = { projectId: 'proj_test0001', sessionId: 'sess_test0001' };

describe('readFileCompressed (Sprint 1 vertical slice)', () => {
  it('compresses a Python fixture and reports fewer tokens', async () => {
    const result = await readFileCompressed(fixture('python/login.py'), deps);
    expect(result.language).toBe('python');
    expect(result.tokensAfter).toBeLessThan(result.tokensBefore);
    expect(result.content).not.toMatch(/^\s*#/m);
  });

  it('produces an event that passes the privacy gate and contains no path', async () => {
    const result = await readFileCompressed(fixture('typescript/auth.ts'), deps);
    expect(() => parseUsageEvent(result.event)).not.toThrow();
    expect(JSON.stringify(result.event)).not.toContain('auth.ts');
  });

  it('fails cleanly for missing and unsupported files', async () => {
    await expect(readFileCompressed(fixture('python/nope.py'), deps)).rejects.toMatchObject({
      code: 'FILE_NOT_FOUND',
    });
    await expect(
      readFileCompressed(fixture('python/login.py') + '.go', deps),
    ).rejects.toMatchObject({
      code: 'UNSUPPORTED_LANGUAGE',
    });
  });
});
