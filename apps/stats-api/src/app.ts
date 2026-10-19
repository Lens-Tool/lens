import express, { type ErrorRequestHandler, type Express } from 'express';
import { LensError, parseUsageEvent, type UsageEvent } from '@lens/shared';

/** Storage boundary. Sprint 1 uses memory; PostgreSQL arrives with the backend sprint. */
export interface EventStore {
  add(event: UsageEvent): Promise<void>;
  count(): Promise<number>;
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

  const onError: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof LensError) {
      res.status(400).json({ error: error.toJSON() });
      return;
    }
    res.status(500).json({ error: { code: 'INTERNAL', message: 'Unexpected error.' } });
  };
  app.use(onError);

  return app;
}
