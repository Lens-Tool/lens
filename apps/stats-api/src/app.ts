import express, { type ErrorRequestHandler, type Express } from 'express';
import { LensError, parseUsageEvent, type UsageEvent } from '@lens/shared';

/**
 * Net savings, not per-file savings (S2-19). An `expand_symbol` event has tokensBefore = the whole
 * file and tokensAfter = the symbol it returned, so adding it to a plain before/after sum would
 * count tokens ADDED to the agent's context as savings. Instead:
 * - tokensBefore: raw size of the files the agent asked to read (read_file_compressed events only);
 * - tokensDelivered: everything the agent received (read_file_compressed + expand_symbol tokensAfter);
 * - tokensSaved: tokensBefore - tokensDelivered. It can be negative.
 * Assumes each expanded symbol belongs to a file that was also read through read_file_compressed.
 * Counts are tokenizer estimates (cl100k_base by default), not billing figures.
 */
export interface StatsSummary {
  events: number;
  tokensBefore: number;
  tokensDelivered: number;
  tokensSaved: number;
}

export const BASELINE_TOOLS = ['read_file_compressed'] as const;
export const DELIVERED_TOOLS = ['read_file_compressed', 'expand_symbol'] as const;

export function summarize(events: readonly UsageEvent[]): StatsSummary {
  const tokensBefore = events
    .filter((e) => (BASELINE_TOOLS as readonly string[]).includes(e.tool))
    .reduce((sum, e) => sum + e.tokensBefore, 0);
  const tokensDelivered = events
    .filter((e) => (DELIVERED_TOOLS as readonly string[]).includes(e.tool))
    .reduce((sum, e) => sum + e.tokensAfter, 0);
  return {
    events: events.length,
    tokensBefore,
    tokensDelivered,
    tokensSaved: tokensBefore - tokensDelivered,
  };
}

/** Storage boundary: InMemoryEventStore for tests, PostgresEventStore for real runs. */
export interface EventStore {
  add(event: UsageEvent): Promise<void>;
  count(): Promise<number>;
  summary(): Promise<StatsSummary>;
}

export class InMemoryEventStore implements EventStore {
  private readonly events: UsageEvent[] = [];
  add(event: UsageEvent): Promise<void> {
    this.events.push(event);
    return Promise.resolve();
  }
  count(): Promise<number> {
    return Promise.resolve(this.events.length);
  }
  summary(): Promise<StatsSummary> {
    return Promise.resolve(summarize(this.events));
  }
}

export function createApp(store: EventStore = new InMemoryEventStore()): Express {
  const app = express();
  app.use(express.json({ limit: '4kb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/v1/events', async (req, res, next) => {
    try {
      await store.add(parseUsageEvent(req.body));
      res.status(202).json({ accepted: true });
    } catch (error) {
      next(error);
    }
  });

  app.get('/v1/stats/summary', async (_req, res, next) => {
    try {
      res.json(await store.summary());
    } catch (error) {
      next(error);
    }
  });

  const onError: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof LensError) {
      res.status(400).json({ error: error.toJSON() });
      return;
    }
    // Malformed JSON or an oversized body is the client's mistake (4xx from body-parser). Fixed
    // message only: the parser's own message can quote part of the body.
    const status = (error as { status?: unknown }).status;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      res.status(status === 413 ? 413 : 400).json({
        error: { code: 'INVALID_INPUT', message: 'The request body is not valid.' },
      });
      return;
    }
    res.status(500).json({ error: { code: 'INTERNAL', message: 'Unexpected error.' } });
  };
  app.use(onError);

  return app;
}
