import { parseArgs } from 'node:util';
import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { serveClient } from './static.ts';

/*
 * Node entry point.
 *   npm run dev:api  → API only on :3001 (Vite proxies /api to it)
 *   npm start        → API plus the built client from dist/ on :3000
 */
const { values: args } = parseArgs({
  options: { 'serve-static': { type: 'boolean', default: false } },
});
const withClient = args['serve-static'];
const port = Number(process.env.PORT ?? (withClient ? 3000 : 3001));

const app = createApp({ logRequests: true });
if (withClient) serveClient(app, './dist');

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`${withClient ? 'App' : 'API'} listening on http://localhost:${info.port}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
