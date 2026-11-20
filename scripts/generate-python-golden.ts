import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WasmParser } from '../packages/compression/src/parser/index.js';
import { extractPythonSymbolsFromSource } from '../packages/compression/src/python/extract.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const FIXTURES_DIR = join(ROOT, 'fixtures');
const GOLDEN_DIR = join(ROOT, 'packages', 'compression', 'src', 'python', 'golden');
const SUITES = ['python', 'python-edge', 'python-repo'] as const;

async function main(): Promise<void> {
  const parser = await WasmParser.create(['python']);

  for (const suite of SUITES) {
    const suiteDir = join(FIXTURES_DIR, suite);
    const outSuiteDir = join(GOLDEN_DIR, suite);
    mkdirSync(outSuiteDir, { recursive: true });

    const pyFiles = readdirSync(suiteDir)
      .filter((name) => name.endsWith('.py'))
      .sort();

    for (const fileName of pyFiles) {
      const fullPath = join(suiteDir, fileName);
      const source = readFileSync(fullPath, 'utf8');
      const symbols = extractPythonSymbolsFromSource(parser, source);

      const relFixture = relative(ROOT, fullPath).replaceAll('\\', '/');
      const payload = {
        fixture: relFixture,
        symbols,
      };

      const outName = fileName.replace(/\.py$/, '.symbols.json');
      const outPath = join(outSuiteDir, outName);
      writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
