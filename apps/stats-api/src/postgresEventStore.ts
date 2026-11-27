import pg from 'pg';
import { Kysely, PostgresDialect, type Generated } from 'kysely';
import type { UsageEvent } from '@lens/shared';
import { BASELINE_TOOLS, DELIVERED_TOOLS, type EventStore, type StatsSummary } from './app.js';
import { requireDatabaseUrl } from './config.js';

/** Mirrors migrations/001_init.sql. Only UsageEvent fields are stored: keep it that way. */
export interface Database {
  projects: { id: string; created_at: Generated<Date> };
  sessions: { id: string; project_id: string; started_at: Generated<Date> };
  usage_events: {
    id: Generated<string>;
    project_id: string;
    session_id: string;
    tool: string;
    tokens_before: number;
    tokens_after: number;
    duration_ms: number;
    occurred_at: Date;
    received_at: Generated<Date>;
  };
}

export function createDb(connectionString: string = requireDatabaseUrl()): Kysely<Database> {
  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString }) }),
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

      await trx
        .insertInto('sessions')
        .values({ id: event.sessionId, project_id: event.projectId })
        .onConflict((oc) => oc.column('id').doNothing())
        .execute();

      await trx
        .insertInto('usage_events')
        .values({
          project_id: event.projectId,
          session_id: event.sessionId,
          tool: event.tool,
          tokens_before: event.tokensBefore,
          tokens_after: event.tokensAfter,
          duration_ms: event.durationMs,
          occurred_at: new Date(event.occurredAt),
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

  /** Same definition as `summarize()` in app.ts: net of expand_symbol, see StatsSummary. */
  async summary(): Promise<StatsSummary> {
    const row = await this.db
      .selectFrom('usage_events')
      .select((eb) => [
        eb.fn.countAll<string>().as('events'),
        eb.fn
          .sum<string | null>('tokens_before')
          .filterWhere('tool', 'in', [...BASELINE_TOOLS])
          .as('before'),
        eb.fn
          .sum<string | null>('tokens_after')
          .filterWhere('tool', 'in', [...DELIVERED_TOOLS])
          .as('delivered'),
      ])
      .executeTakeFirstOrThrow();

    const tokensBefore = Number(row.before ?? 0);
    const tokensDelivered = Number(row.delivered ?? 0);
    return {
      events: Number(row.events),
      tokensBefore,
      tokensDelivered,
      tokensSaved: tokensBefore - tokensDelivered,
    };
  }

  async close(): Promise<void> {
    await this.db.destroy();
  }
}
