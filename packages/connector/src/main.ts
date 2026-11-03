#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { isAnonymousId } from '@lens/shared';
import { getOrCreateProjectId } from './projectId.js';
import { createServer } from './server.js';

// stdout is reserved for the MCP protocol: log to stderr only.
const debug = process.env.LENS_DEBUG === 'true';

// Project id (ADR 0003): LENS_PROJECT_ID if set and valid, otherwise a random id stored in
// <project folder>/.lens/project-id.json. The project folder is LENS_PROJECT_ROOT, or the
// working directory of the process when it is not set.
function resolveProjectId(): string {
  const fromEnv = process.env.LENS_PROJECT_ID;
  if (fromEnv) {
    if (isAnonymousId(fromEnv)) return fromEnv;
    console.error(
      '[lens] LENS_PROJECT_ID is not a valid anonymous id (8-64 letters, digits, _ or -). Ignoring it.',
    );
  }
  return getOrCreateProjectId({ rootDir: process.env.LENS_PROJECT_ROOT || process.cwd() }).id;
}

const server = createServer({
  projectId: resolveProjectId(),
  sessionId: `sess_${randomUUID()}`,
  onEvent: (event) => {
    if (debug) console.error('[lens] event', JSON.stringify(event));
  },
});

await server.connect(new StdioServerTransport());
console.error('[lens] connector running on stdio');
