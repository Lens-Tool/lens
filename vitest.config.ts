import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const pkg = (name: string) =>
  fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url));

// Tests run against TypeScript sources directly, so `npm test` works without a prior build.
export default defineConfig({
  resolve: {
    alias: {
      '@lens/shared': pkg('shared'),
      '@lens/compression': pkg('compression'),
      '@lens/task-context': pkg('task-context'),
    },
  },
  test: {
    include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts'],
  },
});
