import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { UsageEvent } from '@lens/shared';
import { createServer } from './server.js';

const fixture = (name: string) =>
  fileURLToPath(new URL(`../../../fixtures/${name}`, import.meta.url));

// Calls the tool through the real MCP protocol (in memory), like an agent would.
describe('read_file_compressed tool (MCP protocol)', () => {
  let client: Client;
  let events: UsageEvent[];

  beforeEach(async () => {
    events = [];
    const server = createServer({
      projectId: 'proj_test0001',
      sessionId: 'sess_test0001',
      onEvent: (event) => events.push(event),
    });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'test', version: '0.0.0' });
    await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  });

  afterEach(async () => {
    await client.close();
  });

  const text = (result: Awaited<ReturnType<Client['callTool']>>): string =>
    (result.content as { type: string; text: string }[]).map((c) => c.text).join('\n');

  it('describes the three levels to the agent', async () => {
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'read_file_compressed');
    expect(tool?.description).toMatch(/light/);
    expect(tool?.description).toMatch(/signatures/);
    expect(tool?.description).toMatch(/raw/);
    const level = (tool?.inputSchema.properties as Record<string, { enum?: string[] }>).level;
    expect(level?.enum).toEqual(['raw', 'light', 'signatures']);
    expect(tool?.inputSchema.required).toEqual(['path']); // level is optional
  });

  it('uses light when no level is given', async () => {
    const path = fixture('python-repo/services.py');
    const defaulted = await client.callTool({ name: 'read_file_compressed', arguments: { path } });
    const light = await client.callTool({
      name: 'read_file_compressed',
      arguments: { path, level: 'light' },
    });
    expect(text(defaulted)).toBe(text(light));
    expect(events).toHaveLength(2);
  });

  it('returns signatures for a Python file', async () => {
    const result = await client.callTool({
      name: 'read_file_compressed',
      arguments: { path: fixture('python-repo/services.py'), level: 'signatures' },
    });
    expect(result.isError).toBeFalsy();
    expect(text(result)).toMatch(/\.\.\. # L\d+-\d+/);
  });

  it('returns a clear error for signatures on TypeScript', async () => {
    const result = await client.callTool({
      name: 'read_file_compressed',
      arguments: { path: fixture('typescript/auth.ts'), level: 'signatures' },
    });
    expect(result.isError).toBe(true);
    expect(text(result)).toMatch(/^NOT_IMPLEMENTED: /);
    expect(events).toHaveLength(0);
  });

  it('rejects a level that does not exist', async () => {
    const result = await client.callTool({
      name: 'read_file_compressed',
      arguments: { path: fixture('python-repo/services.py'), level: 'banana' },
    });
    expect(result.isError).toBe(true);
    expect(events).toHaveLength(0);
  });
});
