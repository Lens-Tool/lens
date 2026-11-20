import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
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

describe('signatures fallback keeps code visible and stdout clean', () => {
  const marker = /^\s*\.\.\. # L\d+-\d+$/m;
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'lens-s2-08-'));
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const validFunction = [
    'def greet(name):',
    '    message = "hello " + name',
    '    print(message)',
    '    result = message.upper()',
    '    print(result)',
    '    return result',
    '',
  ].join('\n');

  // A valid, collapsible function followed by a broken one.
  const brokenSource = `${validFunction}\n\ndef broken(:\n    pass\n`;

  const write = (name: string, text: string): string => {
    const path = join(dir, name);
    writeFileSync(path, text, 'utf8');
    return path;
  };

  function spyOnOutput() {
    return {
      stdout: vi.spyOn(process.stdout, 'write').mockImplementation(() => true),
      log: vi.spyOn(console, 'log').mockImplementation(() => undefined),
      info: vi.spyOn(console, 'info').mockImplementation(() => undefined),
      error: vi.spyOn(console, 'error').mockImplementation(() => undefined),
    };
  }

  function expectWarningOnStderrOnly(spies: ReturnType<typeof spyOnOutput>, secret: string) {
    // stdout is reserved for the MCP protocol: nothing may be written there.
    expect(spies.stdout).not.toHaveBeenCalled();
    expect(spies.log).not.toHaveBeenCalled();
    expect(spies.info).not.toHaveBeenCalled();
    // The warning goes to stderr, and it contains no path or user name.
    expect(spies.error).toHaveBeenCalledTimes(1);
    const warning = String(spies.error.mock.calls[0]?.[0]);
    expect(warning).toMatch(/\[lens\]/);
    expect(warning).not.toContain(dir);
    expect(warning).not.toContain(secret);
  }

  it('the valid function alone is collapsed (so the next test is meaningful)', async () => {
    const path = write('valid.py', validFunction);
    const result = await readFileCompressed(path, deps, 'signatures');
    expect(result.content).toMatch(marker);
  });

  it('returns a file with a valid function and a syntax error unchanged', async () => {
    const path = write('half_broken.py', brokenSource);
    const spies = spyOnOutput();
    const result = await readFileCompressed(path, deps, 'signatures');
    expect(result.content).toBe(brokenSource);
    expect(result.content).not.toMatch(marker);
    expect(result.tokensAfter).toBe(result.tokensBefore);
    expectWarningOnStderrOnly(spies, 'half_broken');
  });

  it('writes the parser-failure warning to stderr only, without path or user name', async () => {
    const path = write('crash.py', validFunction);
    const broken = {
      parse: () => {
        throw new Error('parser crashed in /home/someone/lens');
      },
    };
    const spies = spyOnOutput();
    const result = await readFileCompressed(path, { ...deps, parser: broken }, 'signatures');
    expect(result.content).toBe(validFunction);
    expectWarningOnStderrOnly(spies, 'someone');
  });
});
