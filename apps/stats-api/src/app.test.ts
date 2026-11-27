import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp, InMemoryEventStore } from './app.js';

const event = {
  schemaVersion: 1,
  projectId: 'proj_abc12345',
  sessionId: 'sess_abc12345',
  tool: 'read_file_compressed',
  tokensBefore: 900,
  tokensAfter: 300,
  durationMs: 5,
  occurredAt: '2026-10-20T10:00:00.000Z',
};

const emptySummary = { events: 0, tokensBefore: 0, tokensDelivered: 0, tokensSaved: 0 };

describe('stats-api', () => {
  it('reports health', async () => {
    const res = await request(createApp()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('accepts an anonymous event', async () => {
    const store = new InMemoryEventStore();
    const res = await request(createApp(store)).post('/v1/events').send(event);
    expect(res.status).toBe(202);
    expect(await store.count()).toBe(1);
  });

  it('rejects events containing a file path and stores nothing', async () => {
    const store = new InMemoryEventStore();
    const res = await request(createApp(store))
      .post('/v1/events')
      .send({ ...event, filePath: '/home/me/app.py' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PRIVACY_VIOLATION');
    expect(await store.count()).toBe(0);
  });

  // Leak scenario 5a: unexpected server errors must not echo internal details or paths
  it('returns a generic 500 without internal details', async () => {
    const failing = {
      add: () => Promise.reject(new Error('ENOENT: /home/me/secret.py')),
      count: () => Promise.resolve(0),
      summary: () => Promise.resolve(emptySummary),
    };
    const res = await request(createApp(failing)).post('/v1/events').send(event);
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('secret.py');
    expect(JSON.stringify(res.body)).not.toContain('stack');
  });

  it('returns 400 for malformed JSON without echoing the body', async () => {
    const res = await request(createApp())
      .post('/v1/events')
      .set('Content-Type', 'application/json')
      .send('{"filePath": "/home/me/invented.py",');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_INPUT');
    expect(JSON.stringify(res.body)).not.toContain('invented');
  });

  it('returns 413 for a body over the 4 kb limit', async () => {
    const res = await request(createApp())
      .post('/v1/events')
      .send({ ...event, padding: 'x'.repeat(5000) });
    expect(res.status).toBe(413);
  });

  // Leak scenario 5b: data in the URL query string is never stored
  it('stores only allow-listed fields and ignores query-string data', async () => {
    const stored: unknown[] = [];
    const capturing = {
      add: (e: unknown) => {
        stored.push(e);
        return Promise.resolve();
      },
      count: () => Promise.resolve(stored.length),
      summary: () => Promise.resolve(emptySummary),
    };
    await request(createApp(capturing))
      .post('/v1/events?path=/home/me/secret.py')
      .send(event)
      .expect(202);
    expect(Object.keys(stored[0] as object).sort()).toEqual(Object.keys(event).sort());
    expect(JSON.stringify(stored)).not.toContain('secret.py');
  });

  it('returns totals from the summary endpoint', async () => {
    const app = createApp(new InMemoryEventStore());
    await request(app).post('/v1/events').send(event).expect(202);
    await request(app).post('/v1/events').send(event).expect(202);

    const res = await request(app).get('/v1/stats/summary');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      events: 2,
      tokensBefore: 1800,
      tokensDelivered: 600,
      tokensSaved: 1200,
    });
  });

  // S2-19: an expand_symbol call adds tokens to the agent's context. It must reduce the net saving,
  // never increase it. Numbers are from a real probe on a synthetic fixture (read then expand).
  it('counts expand_symbol as tokens delivered, so the net saving can be negative', async () => {
    const app = createApp(new InMemoryEventStore());
    await request(app)
      .post('/v1/events')
      .send({ ...event, tool: 'read_file_compressed', tokensBefore: 930, tokensAfter: 498 })
      .expect(202);
    await request(app)
      .post('/v1/events')
      .send({ ...event, tool: 'expand_symbol', tokensBefore: 930, tokensAfter: 648 })
      .expect(202);

    const res = await request(app).get('/v1/stats/summary');
    expect(res.body).toEqual({
      events: 2,
      tokensBefore: 930,
      tokensDelivered: 1146,
      tokensSaved: -216,
    });
  });
});
