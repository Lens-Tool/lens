import { describe, expect, it } from 'vitest';
import { getOrCreateProjectId } from './projectId';

describe('Project ID Generation & Stability', () => {
  it('should generate a valid UUID and not contain path fragments', () => {
    const id = getOrCreateProjectId();
    expect(id).not.toContain('/');
    expect(id).not.toContain('\\');
    expect(id).not.toContain(process.cwd());
  });

  it('should remain stable across multiple calls', () => {
    const id1 = getOrCreateProjectId();
    const id2 = getOrCreateProjectId();
    expect(id1).toBe(id2);
  });
});