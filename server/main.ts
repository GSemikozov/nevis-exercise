import { parseArgs } from 'node:util';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { secureHeaders } from 'hono/secure-headers';
import { createApp } from './app.ts';

/*
 * Node entry point.
 *   npm run dev:api  → API only on :3001 (Vite proxies /api to it)
 *   npm start        → API plus the built client from dist/ on :3000
 */
const { values: args } = parseArgs({
  options: { 'serve-static': { type: 'boolean', default: false } },
});
const serveClient = args['serve-static'];
const port = Number(process.env.PORT ?? (serveClient ? 3000 : 3001));

const app = createApp({ logRequests: true });

if (serveClient) {
  // The same security headers as netlify.toml (keep the two in sync), so the e2e run
  // against this server proves the page works under the production CSP. Styles allow
  // 'unsafe-inline' because motion's popLayout injects a <style> element at runtime.
  app.use(
    '*',
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        baseUri: ["'self'"],
        formAction: ["'none'"],
        frameAncestors: ["'none'"],
      },
      referrerPolicy: 'strict-origin-when-cross-origin',
      xFrameOptions: 'DENY',
    })
  );
  // Vite fingerprints everything under /assets, so a file that exists can be cached
  // forever. A 404 must not be: it would stick at that URL.
  app.use('/assets/*', async (c, next) => {
    await next();
    if (c.res.ok) c.header('Cache-Control', 'public, max-age=31536000, immutable');
  });
  // The app has one page (served for `/`), so there is no history-API fallback: an
  // unknown path, a stale chunk in particular, is a plain 404, as on Netlify.
  app.use('/*', serveStatic({ root: './dist' }));
}

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`${serveClient ? 'App' : 'API'} listening on http://localhost:${info.port}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
