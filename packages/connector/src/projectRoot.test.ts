import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveProjectRoot } from './projectRoot.js';

describe('resolveProjectRoot', () => {
  const cwd = resolve('some', 'working', 'dir');

  it('uses the working directory when LENS_PROJECT_ROOT is not set', () => {
    expect(resolveProjectRoot({}, cwd)).toBe(cwd);
  });

  it('treats an empty LENS_PROJECT_ROOT as not set', () => {
    expect(resolveProjectRoot({ LENS_PROJECT_ROOT: '' }, cwd)).toBe(cwd);
  });

  it('uses LENS_PROJECT_ROOT when it is set (host started the connector elsewhere)', () => {
    const project = resolve('another', 'project');
    expect(resolveProjectRoot({ LENS_PROJECT_ROOT: project }, cwd)).toBe(project);
  });

  it('resolves a relative LENS_PROJECT_ROOT against the working directory', () => {
    expect(resolveProjectRoot({ LENS_PROJECT_ROOT: 'repo' }, cwd)).toBe(resolve(cwd, 'repo'));
  });
});
