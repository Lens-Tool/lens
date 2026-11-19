import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { LensError, type UsageEvent } from '@lens/shared';
import { z } from 'zod';
import { readFileCompressed } from './readFileCompressed.js';

export interface ServerOptions {
  projectId: string;
  sessionId: string;
  onEvent?: (event: UsageEvent) => void;
}

const TOOL_DESCRIPTION = [
  'Read a Python, JavaScript or TypeScript file, compressed to save tokens.',
  'Choose a level:',
  '"light" (default) removes blank lines and comments;',
  '"signatures" (Python files only) keeps imports, variables, class and function headers and docstrings,',
  'and replaces long function and method bodies with a marker line such as "... # L8-11" (the original line range);',
  '"raw" returns the file unchanged.',
  'To see a body that a marker replaced, read the file again with level "raw".',
  'A file that cannot be parsed is returned unchanged.',
].join(' ');

const LEVEL_DESCRIPTION =
  'raw: the file unchanged. light (default): comments and blank lines removed. signatures: Python only, bodies replaced by markers.';

export function createServer(options: ServerOptions): McpServer {
  const server = new McpServer({ name: 'lens', version: '0.0.0' });

  server.tool(
    'read_file_compressed',
    TOOL_DESCRIPTION,
    {
      path: z.string().describe('Absolute path of the file to read.'),
      level: z.enum(['raw', 'light', 'signatures']).default('light').describe(LEVEL_DESCRIPTION),
    },
    async ({ path, level }) => {
      try {
        const result = await readFileCompressed(path, options, level);
        options.onEvent?.(result.event);
        return { content: [{ type: 'text' as const, text: result.content }] };
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
