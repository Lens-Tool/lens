import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isAnonymousId, parseUsageEvent } from '@lens/shared';
import { getOrCreateProjectId } from './projectId.js';

// Each test gets its own empty folder, so nothing is written into the repository.
let root: string;
let warnings: string[];
const warn = (message: string): void => {
  warnings.push(message);
};
const idFile = (): string => join(root, '.lens', 'project-id.json');

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'lens-secret-project-name-'));
  warnings = [];
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('getOrCreateProjectId', () => {
  it('creates a random id that the privacy gate accepts', () => {
    const { id, source } = getOrCreateProjectId({ rootDir: root, warn });
    expect(source).toBe('created');
    expect(id).toMatch(/^proj_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(isAnonymousId(id)).toBe(true);
    const event = {
      schemaVersion: 1,
      projectId: id,
      sessionId: 'sess_abc12345',
      tool: 'read_file_compressed',
      tokensBefore: 10,
      tokensAfter: 5,
      durationMs: 1,
      occurredAt: '2026-11-01T10:00:00.000Z',
    };
    expect(() => parseUsageEvent(event)).not.toThrow();
    expect(warnings).toEqual([]);
  });

  it('never contains a path fragment, the folder name or the temp directory', () => {
    const { id } = getOrCreateProjectId({ rootDir: root, warn });
    expect(id).not.toMatch(/[\\/:.\s]/);
    expect(id).not.toContain('secret-project-name');
    expect(id).not.toContain(tmpdir());
    expect(id).not.toContain(process.cwd());
  });

  it('stays the same across restarts', () => {
    const first = getOrCreateProjectId({ rootDir: root, warn });
    const second = getOrCreateProjectId({ rootDir: root, warn });
    expect(second).toEqual({ id: first.id, source: 'file' });
    expect(JSON.parse(readFileSync(idFile(), 'utf8'))).toEqual({ projectId: first.id });
  });

  it('gives different projects different ids', () => {
    const other = mkdtempSync(join(tmpdir(), 'lens-other-'));
    try {
      expect(getOrCreateProjectId({ rootDir: root, warn }).id).not.toBe(
        getOrCreateProjectId({ rootDir: other, warn }).id,
      );
    } finally {
      rmSync(other, { recursive: true, force: true });
    }
  });

  it.each([
    ['invalid JSON', '{ not json'],
    ['JSON null', 'null'],
    ['missing field', '{"other": 1}'],
    ['a path as the id', '{"projectId": "/home/someone/my-repo"}'],
    ['a non-string id', '{"projectId": 12345678}'],
  ])('replaces a corrupted file (%s) with a new valid id', (_name, content) => {
    mkdirSync(join(root, '.lens'));
    writeFileSync(idFile(), content);

    const { id, source } = getOrCreateProjectId({ rootDir: root, warn });
    expect(source).toBe('created');
    expect(isAnonymousId(id)).toBe(true);
    expect(id).not.toContain('someone');
    expect(warnings).toHaveLength(1);
    expect(getOrCreateProjectId({ rootDir: root, warn }).id).toBe(id);
  });

  it('falls back to a session-only id and warns when the folder is not writable', () => {
    // A FILE named ".lens" makes the folder impossible to create, on every operating system.
    writeFileSync(join(root, '.lens'), 'not a folder');

    const { id, source } = getOrCreateProjectId({ rootDir: root, warn });
    expect(source).toBe('session-only');
    expect(isAnonymousId(id)).toBe(true);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('keeps file paths out of every warning', () => {
    writeFileSync(join(root, '.lens'), 'not a folder');
    getOrCreateProjectId({ rootDir: root, warn });
    mkdirSync(join(root, 'second'));
    mkdirSync(join(root, 'second', '.lens'));
    writeFileSync(join(root, 'second', '.lens', 'project-id.json'), '{ broken');
    getOrCreateProjectId({ rootDir: join(root, 'second'), warn });

    expect(warnings.length).toBeGreaterThan(1);
    for (const message of warnings) {
      expect(message).not.toContain('secret-project-name');
      expect(message).not.toContain(tmpdir());
    }
  });
});
