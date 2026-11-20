import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import Parser from 'web-tree-sitter';
import { LensError, type Language } from '@lens/shared';
import { GRAMMARS_DIR, GRAMMAR_FILES } from './grammars.js';
import type { CodeParser, ParsedFile, SyntaxNode } from './types.js';

// Error messages go back to the agent, so they must never contain file paths (they can include the
// user name). The original error is written to stderr only; stderr stays on this machine.
let runtimeReady: Promise<void> | undefined;
function initRuntime(): Promise<void> {
  runtimeReady ??= Parser.init().catch((cause: unknown) => {
    runtimeReady = undefined;
    console.error('[lens] web-tree-sitter initialisation failed:', cause);
    throw new LensError('INTERNAL', 'Could not initialise web-tree-sitter.');
  });
  return runtimeReady;
}

class WasmParsedFile implements ParsedFile {
  private tree: Parser.Tree | undefined;

  constructor(
    readonly language: Language,
    tree: Parser.Tree,
    readonly hasSyntaxError: boolean,
  ) {
    this.tree = tree;
  }

  get root(): SyntaxNode {
    if (!this.tree) throw new LensError('INTERNAL', 'ParsedFile was used after dispose().');
    return this.tree.rootNode;
  }

  dispose(): void {
    this.tree?.delete();
    this.tree = undefined;
  }
}

export class WasmParser implements CodeParser {
  private readonly pending = new Map<Language, Promise<Parser.Language>>();
  private readonly loaded = new Map<Language, Parser.Language>();
  private disposed = false;

  private constructor(private readonly parser: Parser) {}

  static async create(languages: readonly Language[] = []): Promise<WasmParser> {
    await initRuntime();
    const instance = new WasmParser(new Parser());
    try {
      await Promise.all(languages.map((language) => instance.load(language)));
      return instance;
    } catch (error) {
      instance.dispose();
      throw error;
    }
  }

  async load(language: Language): Promise<void> {
    if (this.disposed) {
      throw new LensError('INTERNAL', 'WasmParser was used after dispose().');
    }

    if (this.loaded.has(language)) return;

    let loading = this.pending.get(language);
    if (!loading) {
      loading = this.readGrammar(language);
      this.pending.set(language, loading);
    }

    try {
      const grammar = await loading;

      if (this.disposed) {
        throw new LensError('INTERNAL', 'WasmParser was used after dispose().');
      }

      this.loaded.set(language, grammar);
    } finally {
      this.pending.delete(language);
    }
  }

  parse(source: string, language: Language): ParsedFile {
    if (this.disposed) {
      throw new LensError('INTERNAL', 'WasmParser was used after dispose().');
    }

    const grammar = this.loaded.get(language);
    if (!grammar) {
      throw new LensError(
        'INTERNAL',
        `The ${language} grammar is not loaded. Call WasmParser.create(['${language}']) or await parser.load('${language}') first.`,
      );
    }

    this.parser.setLanguage(grammar);
    const tree = this.parser.parse(source);
    return new WasmParsedFile(language, tree, tree.rootNode.hasError);
  }

  dispose(): void {
    if (this.disposed) return;

    this.disposed = true;
    this.loaded.clear();
    this.pending.clear();
    this.parser.delete();
  }

  private async readGrammar(language: Language): Promise<Parser.Language> {
    const file = GRAMMAR_FILES[language];
    if (!file) {
      throw new LensError('UNSUPPORTED_LANGUAGE', `No ${language} grammar is bundled yet.`);
    }

    try {
      const bytes = await readFile(join(GRAMMARS_DIR, file));
      return await Parser.Language.load(new Uint8Array(bytes));
    } catch (cause: unknown) {
      console.error(`[lens] could not load the ${language} grammar:`, cause);
      throw new LensError('INTERNAL', `Could not load the ${language} grammar.`);
    }
  }
}
