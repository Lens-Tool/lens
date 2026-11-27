import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { LensError, type ExpandSymbolInput, type UsageEvent } from '@lens/shared';
import { z } from 'zod';
import { readFileCompressed } from './readFileCompressed.js';
import { expandSymbol } from './expandSymbol.js';

export interface ServerOptions {
  projectId: string;
  sessionId: string;
  repoRoot?: string;
  onEvent?: (event: UsageEvent) => void;
}

const TOOL_DESCRIPTION = [
  'Read a Python, JavaScript or TypeScript file, compressed to save tokens.',
  'Choose a level:',
  '"light" (default) removes blank lines and comments;',
  '"signatures" (Python files only) keeps imports, variables, class and function headers and docstrings,',
  'and replaces long function and method bodies with a marker line such as "... # L8-11" (the original line range);',
  '"raw" returns the file unchanged.',
  'To see a body that a marker replaced, use expand_symbol(path, symbol).',
  'A file that cannot be parsed is returned unchanged, with a "[lens warning]" line before it.',
].join(' ');

const LEVEL_DESCRIPTION =
  'raw: the file unchanged. light (default): comments and blank lines removed. signatures: Python only, bodies replaced by markers.';

export function createServer(options: ServerOptions): McpServer {
  const server = new McpServer({ name: 'lens', version: '0.0.0' });
  const repoRoot = options.repoRoot ?? process.cwd();

  server.tool(
    'read_file_compressed',
    TOOL_DESCRIPTION,
    {
      path: z.string().describe('Absolute path of the file to read.'),
      level: z.enum(['raw', 'light', 'signatures']).default('light').describe(LEVEL_DESCRIPTION),
    },
    async ({ path, level }) => {
      try {
        const result = await readFileCompressed(path, { ...options, repoRoot }, level);
        options.onEvent?.(result.event);
        // The warning is a separate first block so the agent cannot mistake it for file content.
        const warning = result.warning
          ? [{ type: 'text' as const, text: `[lens warning] ${result.warning}` }]
          : [];
        return { content: [...warning, { type: 'text' as const, text: result.content }] };
      } catch (error) {
        const lens =
          error instanceof LensError ? error : new LensError('INTERNAL', 'Unexpected error.');
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `${lens.code}: ${lens.message}` }],
        };
      }
    },
  );

  const EXPAND_SYMBOL_DESCRIPTION = [
    'Return the full source of a symbol (function, method, class) by name or qualified name.',
    'Use to expand the "... # L8-11" markers from read_file_compressed signatures level.',
    'Top-level functions, classes and their methods are indexed; a nested function is part of the source of its parent.',
    'Python files only for now.',
  ].join(' ');

  server.tool(
    'expand_symbol',
    EXPAND_SYMBOL_DESCRIPTION,
    {
      path: z.string().describe('Absolute path of the file containing the symbol.'),
      symbol: z
        .string()
        .describe(
          'Symbol name (e.g., "greet") or qualified name (e.g., "UserService.create_account").',
        ),
    },
    async ({ path, symbol }) => {
      try {
        const input: ExpandSymbolInput = { path, symbol };
        const result = await expandSymbol(input.path, { ...options, repoRoot }, input.symbol);
        options.onEvent?.(result.event);
        const text = result.matches
          .map(
            (m) =>
              `${m.qualifiedName} (${m.symbol.kind}) L${m.symbol.startLine}-${m.symbol.endLine}:\n${m.content}`,
          )
          .join('\n\n---\n\n');
        return { content: [{ type: 'text' as const, text }] };
      } catch (error) {
        const lens =
          error instanceof LensError ? error : new LensError('INTERNAL', 'Unexpected error.');
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `${lens.code}: ${lens.message}` }],
        };
      }
    },
  );

  return server;
}
