import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { App } from '../src/types';
import { createTestApp } from './helpers';

describe('health and metrics', () => {
  let app: App;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());

  it('reports healthy when the database is reachable', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', db: 'up' });
  });

  it('exposes prometheus metrics including http request metrics', async () => {
    await app.inject({ method: 'GET', url: '/health' });
    const res = await app.inject({ method: 'GET', url: '/metrics' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.body).toContain('process_cpu_user_seconds_total');
    expect(res.body).toMatch(/http_requests_total\{[^}]*route="\/health"[^}]*\} \d+/);
    expect(res.body).toContain('http_request_duration_seconds_bucket');
    expect(res.body).toContain('service="api"');
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/does-not-exist' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: 'NotFound' });
  });

  it('sets security headers', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
