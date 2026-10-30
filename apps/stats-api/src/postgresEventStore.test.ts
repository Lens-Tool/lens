import path from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { UsageEvent } from '@lens/shared';
import { MIGRATIONS_DIR, runMigrations } from './migrate.js';
import { createDb, PostgresEventStore } from './postgresEventStore.js';

// These tests need a real, EMPTY PostgreSQL database. Without TEST_DATABASE_URL they are skipped,
// so `npm run check` still works for everyone. The database name must contain "test" because the
// tests drop the LENS tables first.
const url = process.env.TEST_DATABASE_URL;
const safe = url ? path.basename(new URL(url).pathname).includes('test') : false;

const event: UsageEvent = {
  schemaVersion: 1,
  projectId: 'proj_abc12345',
  sessionId: 'sess_abc12345',
  tool: 'read_file_compressed',
  tokensBefore: 900,
  tokensAfter: 300,
  durationMs: 7,
  occurredAt: '2026-10-20T10:00:00.000Z',
};

describe.skipIf(!url)('PostgresEventStore (real PostgreSQL)', () => {
  let store: PostgresEventStore;

  beforeAll(async () => {
    if (!url || !safe)
      throw new Error('TEST_DATABASE_URL must point to a database whose name contains "test".');
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    await client.query(
      'DROP TABLE IF EXISTS usage_events, sessions, projects, schema_migrations CASCADE',
    );
    await runMigrations(client, MIGRATIONS_DIR);
    await client.end();
    store = new PostgresEventStore(createDb(url));
  });

  afterAll(async () => {
    await store.close();
  });

  it('stores events and reads totals back', async () => {
    await store.add(event);
    await store.add({ ...event, tokensBefore: 100, tokensAfter: 40 });
    expect(await store.count()).toBe(2);
    expect(await store.summary()).toEqual({ events: 2, tokensBefore: 1000, tokensAfter: 340 });
  });

  it('keeps one project and one session row for repeated events', async () => {
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    const projects = await client.query('SELECT count(*)::int AS n FROM projects');
    const sessions = await client.query('SELECT count(*)::int AS n FROM sessions');
    await client.end();
    expect(projects.rows[0].n).toBe(1);
    expect(sessions.rows[0].n).toBe(1);
  });

  it('stores only allow-listed columns (privacy guard)', async () => {
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    const res = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'usage_events' ORDER BY column_name",
    );
    await client.end();
    expect(res.rows.map((r) => r.column_name)).toEqual([
      'duration_ms',
      'id',
      'occurred_at',
      'project_id',
      'received_at',
      'session_id',
      'tokens_after',
      'tokens_before',
      'tool',
    ]);
  });

  it('does not re-apply migrations that already ran', async () => {
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    const applied = await runMigrations(client, MIGRATIONS_DIR);
    await client.end();
    expect(applied).toEqual([]);
  });
});
