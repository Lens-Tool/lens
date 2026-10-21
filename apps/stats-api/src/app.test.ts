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
    };
    const res = await request(createApp(failing)).post('/v1/events').send(event);
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('secret.py');
    expect(JSON.stringify(res.body)).not.toContain('stack');
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
    };
    await request(createApp(capturing))
      .post('/v1/events?path=/home/me/secret.py')
      .send(event)
      .expect(202);
    expect(Object.keys(stored[0] as object).sort()).toEqual(Object.keys(event).sort());
    expect(JSON.stringify(stored)).not.toContain('secret.py');
  });
});
