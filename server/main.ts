import { parseArgs } from 'node:util';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
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
  // Vite fingerprints everything under /assets, so it can be cached forever.
  app.use('/assets/*', async (c, next) => {
    await next();
    c.header('Cache-Control', 'public, max-age=31536000, immutable');
  });
  app.use('/*', serveStatic({ root: './dist' }));
  // Single-page app: unknown non-API paths fall back to the shell.
  app.get('*', serveStatic({ path: './dist/index.html' }));
}

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`${serveClient ? 'App' : 'API'} listening on http://localhost:${info.port}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
