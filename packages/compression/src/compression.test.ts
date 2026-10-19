import { describe, expect, it } from 'vitest';
import { compressLight, detectLanguage } from './index.js';

describe('detectLanguage', () => {
  it('maps extensions to the three supported languages', () => {
    expect(detectLanguage('a/login.py')).toBe('python');
    expect(detectLanguage('x.jsx')).toBe('javascript');
    expect(detectLanguage('auth.ts')).toBe('typescript');
  });

  it('rejects unsupported files', () => {
    expect(() => detectLanguage('main.go')).toThrowError(
      expect.objectContaining({ code: 'UNSUPPORTED_LANGUAGE' }),
    );
  });
});

describe('compressLight', () => {
  it('strips blank lines and comments in Python but keeps docstrings', () => {
    const src = [
      '# top comment',
      'def f():',
      '',
      '    """Doc # not a comment"""',
      '    return 1  ',
      '',
    ].join('\n');
    const result = compressLight(src, 'python');
    expect(result.content).toBe('def f():\n    """Doc # not a comment"""\n    return 1\n');
    expect(result.level).toBe('light');
  });

  it('strips line and block comments in TypeScript', () => {
    const src = [
      '// c',
      '/* block',
      ' * more */',
      'export const a = 1;',
      '',
      '/** one-line */',
      'const b = 2;',
    ].join('\n');
    expect(compressLight(src, 'typescript').content).toBe('export const a = 1;\nconst b = 2;\n');
  });
});
