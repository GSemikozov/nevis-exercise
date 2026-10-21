import { expect, test } from '@playwright/test';

// HTTP behaviour of the deployed site (or of `npm start`, which mirrors it).

test('serves the security headers with the page', async ({ request }) => {
  const res = await request.get('/');

  expect(res.status()).toBe(200);
  expect(res.headers()['content-security-policy']).toContain("script-src 'self'");
  expect(res.headers()['x-frame-options']).toBe('DENY');
  expect(res.headers()['x-content-type-options']).toBe('nosniff');
});

test('answers a missing asset with 404, not the app shell, and does not cache it', async ({
  request,
}) => {
  const res = await request.get('/assets/does-not-exist-0000.js');

  // (A 404 page may well be HTML, e.g. Netlify's; what matters is that it is not a 200.)
  expect(res.status()).toBe(404);
  expect(res.headers()['cache-control'] ?? '').not.toContain('immutable');
});
