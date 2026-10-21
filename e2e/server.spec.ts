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

test('keeps the demo switches out of the CDN cache for the plain response', async ({ request }) => {
  // Warm the cache with the plain response, then ask for a failure: it must not come back
  // as the cached 200.
  await request.get('/api/v1/clients');
  const res = await request.get('/api/v1/clients?fail=503');

  expect(res.status()).toBe(503);
});
