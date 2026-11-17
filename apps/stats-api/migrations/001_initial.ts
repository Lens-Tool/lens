import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('projects')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('name', 'text')
    .addColumn('created_at', 'timestamptz', (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createTable('sessions')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('project_id', 'text', (c) =>
      c.notNull().references('projects.id'),
    )
    .addColumn('started_at', 'timestamptz', (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createTable('usage_events')
    .addColumn('id', 'bigserial', (c) => c.primaryKey())
    .addColumn('project_id', 'text', (c) =>
      c.notNull().references('projects.id'),
    )
    .addColumn('session_id', 'text', (c) => c.references('sessions.id'))
    .addColumn('tokens_before', 'integer', (c) => c.notNull())
    .addColumn('tokens_after', 'integer', (c) => c.notNull())
    .addColumn('created_at', 'timestamptz', (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex('usage_events_project_id_idx')
    .on('usage_events')
    .column('project_id')
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('usage_events').execute();
  await db.schema.dropTable('sessions').execute();
  await db.schema.dropTable('projects').execute();
}