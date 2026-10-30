import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pg from 'pg';
import { loadEnv, requireDatabaseUrl } from './config.js';

/** The part of a pg Client that the runner needs (makes it easy to test). */
export interface Queryable {
  query(text: string, params?: unknown[]): Promise<{ rows: { name: string }[] }>;
}

/**
 * Applies every migrations/*.sql file that is not yet recorded in schema_migrations, in file-name
 * order, each inside a transaction. Safe to run repeatedly. Returns the names applied this time.
 */
export async function runMigrations(client: Queryable, dir: string): Promise<string[]> {
  await client.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())',
  );
  const done = new Set(
    (await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name),
  );
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();

  const applied: string[] = [];
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = await readFile(path.join(dir, file), 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      applied.push(file);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
  return applied;
}

export const MIGRATIONS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../migrations',
);

async function main(): Promise<void> {
  loadEnv();
  const client = new pg.Client({ connectionString: requireDatabaseUrl() });
  await client.connect();
  try {
    const applied = await runMigrations(client, MIGRATIONS_DIR);
    console.log(
      applied.length > 0
        ? `[lens] applied: ${applied.join(', ')}`
        : '[lens] database is up to date',
    );
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error('[lens] migration failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
