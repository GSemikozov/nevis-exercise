import { clientsResponseSchema } from '../shared/clients.schema.ts';
import { createApp } from './app.ts';

const app = createApp();

describe('GET /api/v1/clients', () => {
  it('returns the client tree and its period, matching the shared contract', async () => {
    const res = await app.request('/api/v1/clients');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(res.headers.get('cache-control')).toContain('max-age=60');
    const body = clientsResponseSchema.parse(await res.json());
    expect(body.meta.periodStart).toBe('2024-02');
    expect(body.data.name).toBe('Company');
  });

  it('answers a conditional request with 304 Not Modified', async () => {
    const first = await app.request('/api/v1/clients');
    const tag = first.headers.get('etag');
    expect(tag).toBeTruthy();

    const second = await app.request('/api/v1/clients', {
      headers: { 'If-None-Match': tag ?? '' },
    });
    expect(second.status).toBe(304);
    expect(second.headers.get('etag')).toBe(tag);
    expect(second.headers.get('cache-control')).toContain('max-age=60');
  });

  it('matches weak and listed entity tags too', async () => {
    const tag = (await app.request('/api/v1/clients')).headers.get('etag') ?? '';
    const res = await app.request('/api/v1/clients', {
      headers: { 'If-None-Match': `"stale", W/${tag}` },
    });
    expect(res.status).toBe(304);
  });

  it('ignores the demo switches when they are turned off', async () => {
    const production = createApp({ demoSwitches: false });
    const res = await production.request('/api/v1/clients?fail=503&delay=3000');

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('max-age=60');
  });

  it('simulates a failure with ?fail as an uncached problem document', async () => {
    const res = await app.request('/api/v1/clients?fail=503');

    expect(res.status).toBe(503);
    expect(res.headers.get('content-type')).toBe('application/problem+json');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toMatchObject({ status: 503, title: 'Simulated failure' });
  });

  it('holds the response for ?delay milliseconds and does not cache it', async () => {
    const started = performance.now();
    const res = await app.request('/api/v1/clients?delay=50');

    expect(res.status).toBe(200);
    expect(performance.now() - started).toBeGreaterThanOrEqual(45);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it.each([
    ['delay over the 3s cap', '?delay=3001'],
    ['non-numeric fail', '?fail=oops'],
    ['fail outside 4xx/5xx', '?fail=200'],
  ])('rejects %s with 400', async (_, query) => {
    const res = await app.request(`/api/v1/clients${query}`);

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ status: 400, title: 'Invalid query parameters' });
  });
});

describe('API routing', () => {
  it('reports health', async () => {
    const res = await app.request('/api/health');
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('returns a problem document for unknown API routes', async () => {
    const res = await app.request('/api/nope');

    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toBe('application/problem+json');
  });
});

describe('createApp', () => {
  it('refuses to start with data that breaks the contract', () => {
    const broken = {
      data: {
        id: 'c',
        name: 'Company',
        values: [1, 2],
        branches: [{ id: 'b', name: 'B', values: [1] }],
      },
      meta: { periodStart: '2024-02' },
    };
    expect(() => createApp({ clients: broken })).toThrow(/same number of monthly values/);
  });
});
