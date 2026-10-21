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

test('keeps client data out of shared caches, so an error is never masked', async ({ request }) => {
  const plain = await request.get('/api/v1/clients');
  // private: no CDN keeps a copy. (Netlify answered an origin 5xx with any expired copy
  // it held for the path, whatever the query, so ?fail=503 came back as a stale 200.)
  expect(plain.headers()['cache-control']).toBe('private, max-age=60');
  expect(plain.headers()['cache-status'] ?? '').not.toMatch(/\bhit\b|stored/);

  const failure = await request.get('/api/v1/clients?fail=503');
  expect(failure.status()).toBe(503);
});
