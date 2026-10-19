import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { LensError, type UsageEvent } from '@lens/shared';
import { z } from 'zod';
import { readFileCompressed } from './readFileCompressed.js';

export interface ServerOptions {
  projectId: string;
  sessionId: string;
  /** Called with each anonymous event. Sprint 1 default: no-op (T21 adds the opt-in HTTP sender). */
  onEvent?: (event: UsageEvent) => void;
}

export function createServer(options: ServerOptions): McpServer {
  const server = new McpServer({ name: 'lens', version: '0.0.0' });

  server.tool(
    'read_file_compressed',
    'Read a Python, JavaScript or TypeScript file with blank lines and comments removed.',
    { path: z.string().describe('Absolute path of the file to read.') },
    async ({ path }) => {
      try {
        const result = await readFileCompressed(path, options);
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
