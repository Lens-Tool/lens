import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, writeFile, rm, symlink } from 'node:fs/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseUsageEvent, type UsageEvent } from '@lens/shared';
import { createServer } from './server.js';

const fixture = (name: string) =>
  fileURLToPath(new URL(`../../../fixtures/${name}`, import.meta.url));

// Fixture directory (parent of fixtures) for repoRoot so normal tests don't hit path check
const fixtureDir = fileURLToPath(new URL(`../../../fixtures`, import.meta.url));

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

// Calls the tool through the real MCP protocol (in memory), like an agent would.
describe('expand_symbol tool (MCP protocol)', () => {
  let client: Client;
  let events: UsageEvent[];

  beforeEach(async () => {
    events = [];
    const server = createServer({
      projectId: 'proj_test0001',
      sessionId: 'sess_test0001',
      repoRoot: fixtureDir,
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

  it('describes the tool to the agent', async () => {
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'expand_symbol');
    expect(tool).toBeDefined();
    expect(tool?.description).toMatch(/expand/);
    expect(tool?.inputSchema.required).toEqual(['path', 'symbol']);
  });

  it('returns a method by qualified name', async () => {
    const result = await client.callTool({
      name: 'expand_symbol',
      arguments: { path: fixture('python-repo/services.py'), symbol: 'UserService.create_account' },
    });
    expect(result.isError).toBeFalsy();
    const output = text(result);
    expect(output).toContain('UserService.create_account');
    expect(output).toContain('def create_account');
    expect(output).toContain('self.authentication.register');
  });

  it('returns a decorated function by simple name', async () => {
    const result = await client.callTool({
      name: 'expand_symbol',
      arguments: { path: fixture('python-edge/decorators.py'), symbol: 'greet' },
    });
    expect(result.isError).toBeFalsy();
    const output = text(result);
    expect(output).toContain('greet');
    // Decorator should be included in the returned source (after the header)
    const content = output.split('\n').slice(1).join('\n'); // Skip header line
    expect(content.trimStart()).toMatch(/^@repeat/);
  });

  it('returns a decorated module-level function by its name', async () => {
    const result = await client.callTool({
      name: 'expand_symbol',
      arguments: { path: fixture('python-edge/decorators.py'), symbol: 'calculate_total' },
    });
    expect(result.isError).toBeFalsy();
    const output = text(result);
    expect(output).toContain('calculate_total');
    // Decorator should be included in the returned source (after the header)
    const content = output.split('\n').slice(1).join('\n'); // Skip header line
    expect(content.trimStart()).toMatch(/^@log_call/);
  });

  it('returns NOT_FOUND for non-existent symbol', async () => {
    const result = await client.callTool({
      name: 'expand_symbol',
      arguments: { path: fixture('python-repo/services.py'), symbol: 'NonExistent' },
    });
    expect(result.isError).toBe(true);
    const output = text(result);
    // TODO(NOT_FOUND): expect 'NOT_FOUND' here once the code exists in shared (PR #27).
    expect(output).toMatch(/^INVALID_INPUT: /);
    expect(output).toContain('Symbol not found: NonExistent');
    expect(events).toHaveLength(0);
  });

  it('returns all matches for a name that appears multiple times', async () => {
    const result = await client.callTool({
      name: 'expand_symbol',
      arguments: { path: fixture('python-edge/nested_classes.py'), symbol: '__init__' },
    });
    expect(result.isError).toBeFalsy();
    const output = text(result);
    // Should find 5 __init__ methods: University, Department, Student, Contact, Database
    const matches = output.split('\n\n---\n\n');
    expect(matches).toHaveLength(5);
    // Each match should contain __init__
    for (const match of matches) {
      expect(match).toContain('__init__');
    }
  });

  it('returns exact qualified match only (single match for qualified name)', async () => {
    const result = await client.callTool({
      name: 'expand_symbol',
      arguments: { path: fixture('python-edge/nested_classes.py'), symbol: 'University.Student' },
    });
    expect(result.isError).toBeFalsy();
    const output = text(result);
    // Should return exactly one match for the qualified name
    const matches = output.split('\n\n---\n\n');
    expect(matches).toHaveLength(1);
    expect(output).toContain('University.Student');
    expect(output).toContain('class Student');
    // The match is for University.Student (not Contact or other nested classes)
    // Note: The class source range includes nested children, but only one match is returned
  });

  it('rejects path traversal attempts', async () => {
    const result = await client.callTool({
      name: 'expand_symbol',
      arguments: { path: '../outside.py', symbol: 'anything' },
    });
    expect(result.isError).toBe(true);
    const output = text(result);
    expect(output).toMatch(/^INVALID_INPUT: /);
    expect(output).toContain('Path must be inside the repository root');
    expect(events).toHaveLength(0);
  });

  it('returns UNSUPPORTED_LANGUAGE for non-Python files', async () => {
    const result = await client.callTool({
      name: 'expand_symbol',
      arguments: { path: fixture('typescript/auth.ts'), symbol: 'anything' },
    });
    expect(result.isError).toBe(true);
    const output = text(result);
    expect(output).toMatch(/^UNSUPPORTED_LANGUAGE: /);
    expect(events).toHaveLength(0);
  });

  it('returns FILE_NOT_FOUND for non-existent file inside repo root', async () => {
    const result = await client.callTool({
      name: 'expand_symbol',
      arguments: { path: fixture('python-repo/does_not_exist.py'), symbol: 'anything' },
    });
    expect(result.isError).toBe(true);
    const output = text(result);
    expect(output).toMatch(/^FILE_NOT_FOUND: /);
    expect(output).toContain('The requested file does not exist');
    expect(events).toHaveLength(0);
  });

  it('rejects absolute path traversal to file outside repo root', async () => {
    // Create a temp file outside the repo
    const tmpDir = await mkdtemp(tmpdir() + '/lens-test-');
    const outsideFile = `${tmpDir}/outside.py`;
    await writeFile(outsideFile, 'def foo(): pass\n', 'utf8');
    try {
      const result = await client.callTool({
        name: 'expand_symbol',
        arguments: { path: outsideFile, symbol: 'foo' },
      });
      expect(result.isError).toBe(true);
      const output = text(result);
      expect(output).toMatch(/^INVALID_INPUT: /);
      expect(output).toContain('Path must be inside the repository root');
      expect(events).toHaveLength(0);
    } finally {
      await rm(outsideFile, { force: true });
      await rm(tmpDir, { force: true, recursive: true });
    }
  });

  it('returns decorated function with startLine at decorator and content starting with "@"', async () => {
    const result = await client.callTool({
      name: 'expand_symbol',
      arguments: { path: fixture('python-edge/decorators.py'), symbol: 'greet' },
    });
    expect(result.isError).toBeFalsy();
    const output = text(result);
    // Parse the header line to get startLine
    const headerMatch = output.match(/^greet \(function\) L(\d+)-(\d+):/);
    // greet starts at line 21 in decorators.py (the @repeat line)
    expect(headerMatch?.[1]).toBe('21');
    // Content should start with the decorator
    const content = output.split('\n').slice(1).join('\n');
    expect(content.trimStart()).toMatch(/^@repeat/);
  });

  it('returns the exact source and line range of a method', async () => {
    const result = await client.callTool({
      name: 'expand_symbol',
      arguments: { path: fixture('python-repo/services.py'), symbol: 'UserService.create_account' },
    });
    expect(result.isError).toBeFalsy();
    expect(text(result)).toBe(
      [
        'UserService.create_account (method) L20-24:',
        '    def create_account(self, username: str, email: str, password: str) -> User:',
        '        user = self.authentication.register(username, email, password)',
        '        self.profiles[user.user_id] = UserProfile(user_id=user.user_id)',
        '        self._record_event("account_created", user.user_id)',
        '        return user',
      ].join('\n'),
    );
  });

  it('returns the exact source of a decorated function, decorator line included', async () => {
    const result = await client.callTool({
      name: 'expand_symbol',
      arguments: { path: fixture('python-edge/decorators.py'), symbol: 'greet' },
    });
    expect(result.isError).toBeFalsy();
    expect(text(result)).toBe(
      [
        'greet (function) L21-23:',
        '@repeat(times=3)',
        'def greet(name: str) -> str:',
        '    return f"Hello, {name}"',
      ].join('\n'),
    );
  });

  it('gives every ambiguous match its own line range, in file order', async () => {
    const result = await client.callTool({
      name: 'expand_symbol',
      arguments: { path: fixture('python-edge/nested_classes.py'), symbol: '__init__' },
    });
    const headers = text(result)
      .split('\n\n---\n\n')
      .map((match) => /^([\w.]+) \(method\) L(\d+)-(\d+):\n/.exec(match));
    expect(headers).toHaveLength(5);
    const starts = headers.map((h) => Number(h?.[2]));
    expect(new Set(starts).size).toBe(5);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    for (const h of headers) expect(Number(h?.[3])).toBeGreaterThanOrEqual(Number(h?.[2]));
  });

  it('emits exactly one valid usage event on success, with no path or code in it', async () => {
    const path = fixture('python-edge/decorators.py');
    const result = await client.callTool({
      name: 'expand_symbol',
      arguments: { path, symbol: 'greet' },
    });
    expect(result.isError).toBeFalsy();
    expect(events).toHaveLength(1);
    const [event] = events;
    expect(event?.tool).toBe('expand_symbol');
    expect(event?.tokensAfter).toBeGreaterThan(0);
    expect(event?.tokensAfter).toBeLessThan(event?.tokensBefore ?? 0);
    // parseUsageEvent is the allow-list: it throws on any extra field.
    expect(() => parseUsageEvent(event)).not.toThrow();
    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain('decorators');
    expect(serialized).not.toContain('greet');
  });

  it.todo('applies secrets redaction to expanded symbol content');
});

// These tests need files that do not exist in fixtures/, so they build a temporary project folder.
describe('expand_symbol tool (temporary project folders)', () => {
  let client: Client;
  let root: string;
  let outside: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'lens-expand-root-'));
    outside = await mkdtemp(join(tmpdir(), 'lens-expand-outside-'));
    const server = createServer({
      projectId: 'proj_test0001',
      sessionId: 'sess_test0001',
      repoRoot: root,
    });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'test', version: '0.0.0' });
    await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  });

  afterEach(async () => {
    await client.close();
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  });

  const text = (result: Awaited<ReturnType<Client['callTool']>>): string =>
    (result.content as { type: string; text: string }[]).map((c) => c.text).join('\n');

  it('keeps CRLF line endings between lines and adds no stray \\r at the end', async () => {
    const file = join(root, 'win.py');
    await writeFile(file, 'def f():\r\n    return 1\r\n\r\ndef g():\r\n    return 2\r\n', 'utf8');
    const result = await client.callTool({
      name: 'expand_symbol',
      arguments: { path: file, symbol: 'f' },
    });
    expect(result.isError).toBeFalsy();
    expect(text(result)).toBe('f (function) L1-2:\ndef f():\r\n    return 1');
  });

  it('rejects a symlink inside the project that points outside it', async (ctx) => {
    const target = join(outside, 'secret.py');
    await writeFile(target, 'def leak():\n    return "TOP SECRET"\n', 'utf8');
    try {
      await symlink(target, join(root, 'link.py'));
    } catch {
      ctx.skip(); // for example Windows without the right to create symlinks
    }
    const result = await client.callTool({
      name: 'expand_symbol',
      arguments: { path: join(root, 'link.py'), symbol: 'leak' },
    });
    expect(result.isError).toBe(true);
    expect(text(result)).toMatch(/^INVALID_INPUT: /);
    expect(text(result)).not.toContain('TOP SECRET');
  });

  it('does not put the file path or the project folder in any error message', async () => {
    const file = join(root, 'a.py');
    await writeFile(file, 'def f():\n    pass\n', 'utf8');
    const missingSymbol = await client.callTool({
      name: 'expand_symbol',
      arguments: { path: file, symbol: 'nope' },
    });
    const missingFile = await client.callTool({
      name: 'expand_symbol',
      arguments: { path: join(root, 'missing.py'), symbol: 'f' },
    });
    for (const result of [missingSymbol, missingFile]) {
      expect(result.isError).toBe(true);
      expect(text(result)).not.toContain(root);
      expect(text(result)).not.toContain('a.py');
    }
  });
});
