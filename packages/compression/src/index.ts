import { LensError, type CompressResult, type Language } from '@lens/shared';

const EXTENSIONS: Record<string, Language> = {
  '.py': 'python',
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
};

export function detectLanguage(filePath: string): Language {
  const dot = filePath.lastIndexOf('.');
  const language = dot === -1 ? undefined : EXTENSIONS[filePath.slice(dot).toLowerCase()];
  if (!language) {
    throw new LensError(
      'UNSUPPORTED_LANGUAGE',
      'Only Python, JavaScript and TypeScript are supported.',
    );
  }
  return language;
}

/**
 * SPRINT 1 BASELINE - NOT the AST compressor.
 * Removes blank lines and whole-line comments with a line scanner so the end-to-end slice has
 * something real to call. Known limits (to be replaced by tree-sitter in the parser sprints):
 * it does not understand comment markers inside strings that span lines, except Python
 * triple-quoted strings, which it leaves untouched.
 */
export function compressLight(source: string, language: Language): CompressResult {
  const out: string[] = [];
  let inBlockComment = false;
  let inTripleQuote = false;

  for (const rawLine of source.split(/\r?\n/)) {
    let line = rawLine.replace(/\s+$/, '');

    if (language === 'python') {
      if (inTripleQuote) {
        if (line.trim() !== '') out.push(line);
        if (countTriple(line) % 2 === 1) inTripleQuote = false;
        continue;
      }
      if (line.trim().startsWith('#') && !line.startsWith('#!')) continue;
      if (countTriple(line) % 2 === 1) inTripleQuote = true;
    } else {
      if (inBlockComment) {
        const end = line.indexOf('*/');
        if (end === -1) continue;
        inBlockComment = false;
        line = line.slice(end + 2).trim();
        if (line === '') continue;
      } else if (line.trim().startsWith('/*')) {
        const end = line.indexOf('*/', line.indexOf('/*') + 2);
        if (end === -1) {
          inBlockComment = true;
          continue;
        }
        line = line.slice(end + 2).trim();
        if (line === '') continue;
      } else if (line.trim().startsWith('//')) {
        continue;
      }
    }

    if (line.trim() === '') continue;
    out.push(line);
  }

  return { content: out.join('\n') + (out.length > 0 ? '\n' : ''), language, level: 'light' };
}

function countTriple(line: string): number {
  return (line.match(/"""|'''/g) ?? []).length;
}
