import { readFileSync } from 'node:fs';
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

  // Leak scenario 4: error messages must not repeat the file path
  it('does not put the file path in error messages', async () => {
    const missing = fixture('python/secret-project-name.py');
    const error = await readFileCompressed(missing, deps).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).not.toContain('secret-project-name');
  });
});

describe('readFileCompressed levels', () => {
  const services = fixture('python-repo/services.py');
  const marker = /^\s*\.\.\. # L\d+-\d+$/m;

  it('raw returns the file unchanged', async () => {
    const result = await readFileCompressed(services, deps, 'raw');
    expect(result.content).toBe(readFileSync(services, 'utf8'));
    expect(result.tokensAfter).toBe(result.tokensBefore);
  });

  it('light removes comments and blank lines, and is the default', async () => {
    const light = await readFileCompressed(services, deps, 'light');
    const byDefault = await readFileCompressed(services, deps);
    expect(byDefault.content).toBe(light.content);
    expect(light.tokensAfter).toBeLessThan(light.tokensBefore);
    expect(light.content).not.toMatch(marker);
  });

  it('signatures replaces bodies with markers and saves the most tokens', async () => {
    const light = await readFileCompressed(services, deps, 'light');
    const signatures = await readFileCompressed(services, deps, 'signatures');
    expect(signatures.content).toMatch(marker);
    expect(signatures.content).toContain('class UserService');
    expect(signatures.tokensAfter).toBeLessThan(light.tokensAfter);
    expect(signatures.tokensBefore).toBe(light.tokensBefore);
  });

  it('signatures on JavaScript or TypeScript fails clearly, without the path', async () => {
    const path = fixture('typescript/auth.ts');
    const error = await readFileCompressed(path, deps, 'signatures').catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'NOT_IMPLEMENTED' });
    expect((error as Error).message).toMatch(/Python/);
    expect((error as Error).message).not.toContain('auth.ts');
    // The other levels still work for TypeScript
    await expect(readFileCompressed(path, deps, 'light')).resolves.toBeDefined();
    await expect(readFileCompressed(path, deps, 'raw')).resolves.toBeDefined();
  });

  it('falls back to the unchanged file when the Python file has a syntax error', async () => {
    const path = fixture('python-edge/syntax_error.py');
    const result = await readFileCompressed(path, deps, 'signatures');
    expect(result.content).toBe(readFileSync(path, 'utf8'));
    expect(result.tokensAfter).toBe(result.tokensBefore);
  });

  it('falls back to the unchanged file when the parser fails', async () => {
    const broken = {
      parse: () => {
        throw new Error('parser crashed in /home/someone/lens');
      },
    };
    const result = await readFileCompressed(services, { ...deps, parser: broken }, 'signatures');
    expect(result.content).toBe(readFileSync(services, 'utf8'));
    expect(result.content).not.toContain('someone');
  });

  it.each(['raw', 'light', 'signatures'] as const)(
    'the %s event passes the privacy gate and has no level or path',
    async (level) => {
      const { event } = await readFileCompressed(services, deps, level);
      expect(() => parseUsageEvent(event)).not.toThrow();
      expect(Object.keys(event).sort()).toEqual([
        'durationMs',
        'occurredAt',
        'projectId',
        'schemaVersion',
        'sessionId',
        'tokensAfter',
        'tokensBefore',
        'tool',
      ]);
      expect(JSON.stringify(event)).not.toContain('services');
    },
  );
});
