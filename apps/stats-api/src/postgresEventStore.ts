import pg from 'pg';
import { Kysely, PostgresDialect, type Generated } from 'kysely';
import type { UsageEvent } from '@lens/shared';
import type { EventStore, StatsSummary } from './app.js';
import { requireDatabaseUrl } from './config.js';

interface Database {
  projects: { id: string; name: string | null; created_at: Generated<Date> };
  sessions: { id: string; project_id: string; started_at: Generated<Date> };
  usage_events: {
    id: Generated<number>;
    project_id: string;
    session_id: string | null;
    tokens_before: number;
    tokens_after: number;
    created_at: Generated<Date>;
  };
}

export function createDb(): Kysely<Database> {
  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new pg.Pool({ connectionString: requireDatabaseUrl() }),
    }),
  });
}

export class PostgresEventStore implements EventStore {
  constructor(private readonly db: Kysely<Database>) {}

  async add(event: UsageEvent): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      await trx
        .insertInto('projects')
        .values({ id: event.projectId })
        .onConflict((oc) => oc.column('id').doNothing())
        .execute();

      if (event.sessionId) {
        await trx
          .insertInto('sessions')
          .values({ id: event.sessionId, project_id: event.projectId })
          .onConflict((oc) => oc.column('id').doNothing())
          .execute();
      }

      await trx
        .insertInto('usage_events')
        .values({
          project_id: event.projectId,
          session_id: event.sessionId ?? null,
          tokens_before: event.tokensBefore,
          tokens_after: event.tokensAfter,
        })
        .execute();
    });
  }

  async count(): Promise<number> {
    const row = await this.db
      .selectFrom('usage_events')
      .select((eb) => eb.fn.countAll<string>().as('total'))
      .executeTakeFirstOrThrow();
    return Number(row.total);
  }

  async summary(): Promise<StatsSummary> {
    const row = await this.db
      .selectFrom('usage_events')
      .select((eb) => [
        eb.fn.countAll<string>().as('events'),
        eb.fn.sum<string | null>('tokens_before').as('before'),
        eb.fn.sum<string | null>('tokens_after').as('after'),
      ])
      .executeTakeFirstOrThrow();

    return {
      events: Number(row.events),
      tokensBefore: Number(row.before ?? 0),
      tokensAfter: Number(row.after ?? 0),
    };
  }
}
