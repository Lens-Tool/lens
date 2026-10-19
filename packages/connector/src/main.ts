#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

// stdout is reserved for the MCP protocol: log to stderr only.
const debug = process.env.LENS_DEBUG === 'true';

const server = createServer({
  projectId: process.env.LENS_PROJECT_ID || `proj_${randomUUID()}`,
  sessionId: `sess_${randomUUID()}`,
  onEvent: (event) => {
    if (debug) console.error('[lens] event', JSON.stringify(event));
  },
});

await server.connect(new StdioServerTransport());
console.error('[lens] connector running on stdio');
