import { afterEach, describe, expect, it, vi } from 'vitest';

// Leak scenario 6 (logs): a failed grammar load must not write the original error, which can contain
// an install path with a user name, to stderr. The path below is invented.
vi.mock('node:fs/promises', () => ({
  readFile: () =>
    Promise.reject(new Error("ENOENT: no such file, open '/home/invented-user/lens/python.wasm'")),
}));

import { WasmParser } from './wasm-parser.js';

describe('WasmParser logging', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs a fixed message without paths when a grammar cannot be loaded', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(WasmParser.create(['python'])).rejects.toMatchObject({ code: 'INTERNAL' });

    const logged = JSON.stringify(spy.mock.calls);
    expect(logged).toContain('could not load the python grammar');
    expect(logged).not.toContain('invented-user');
    expect(logged).not.toContain('ENOENT');
  });
});
