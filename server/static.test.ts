import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from './app.ts';
import { serveClient } from './static.ts';

// A tiny stand-in for dist/: one page and one fingerprinted asset.
const dist = mkdtempSync(path.join(tmpdir(), 'nevis-dist-'));
mkdirSync(path.join(dist, 'assets'));
writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>Clients</title>');
writeFileSync(path.join(dist, 'assets', 'index-abc123.js'), 'export {};');

afterAll(() => rmSync(dist, { recursive: true, force: true }));

const app = serveClient(createApp(), path.relative(process.cwd(), dist));

describe('serveClient', () => {
  it('serves the page with the production security headers', async () => {
    const res = await app.request('/');

    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<title>Clients</title>');
    expect(res.headers.get('content-security-policy')).toContain("script-src 'self'");
    expect(res.headers.get('x-frame-options')).toBe('DENY');
  });

  it('caches fingerprinted assets forever', async () => {
    const res = await app.request('/assets/index-abc123.js');

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
  });

  it('answers a missing asset with an uncached 404, not the app shell', async () => {
    const res = await app.request('/assets/index-gone.js');

    expect(res.status).toBe(404);
    expect(res.headers.get('cache-control') ?? '').not.toContain('immutable');
  });

  it('leaves the API in charge of /api', async () => {
    const res = await app.request('/api/nope');

    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toBe('application/problem+json');
  });
});
