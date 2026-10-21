import { expect, test } from '@playwright/test';

// HTTP behaviour of the deployed site (or of `npm start`, which mirrors it).

test('serves the security headers with the page', async ({ request }) => {
  const res = await request.get('/');

  expect(res.status()).toBe(200);
  expect(res.headers()['content-security-policy']).toContain("script-src 'self'");
  expect(res.headers()['x-frame-options']).toBe('DENY');
  expect(res.headers()['x-content-type-options']).toBe('nosniff');
});

test('answers a missing asset with 404, not the app shell', async ({ request }) => {
  const res = await request.get('/assets/does-not-exist-0000.js');

  // Whether that 404 may be cached is checked against the Node server in
  // server/static.test.ts; Netlify sets headers per path, not per status (see netlify.toml).
  expect(res.status()).toBe(404);
});

test('keeps client data out of shared caches', async ({ request }) => {
  const res = await request.get('/api/v1/clients');

  // Netlify normalises the header to "private,max-age=60"; compare without whitespace.
  expect(res.headers()['cache-control']?.replace(/\s/g, '')).toBe('private,max-age=60');
  expect(res.headers()['cache-status'] ?? '').not.toMatch(/\bhit\b|stored/);
});

test('serves a simulated failure from the demo endpoint, never a cached copy', async ({
  request,
}) => {
  // Netlify's CDN answers an origin 5xx with any stale copy it holds for the path, whatever
  // the query; the demo endpoint has never had a cacheable response, so there is none.
  await request.get('/api/v1/clients');
  for (let i = 0; i < 5; i += 1) {
    expect((await request.get('/api/v1/demo/clients?fail=503')).status()).toBe(503);
  }
});
