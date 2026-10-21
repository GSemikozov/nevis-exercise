import { createApp } from '../../server/app.ts';

/*
 * The same Hono app as the local Node server, deployed as a Netlify Function (Node.js
 * runtime). Netlify Functions take a web-standard Request and return a Response, which is
 * exactly Hono's `fetch` signature, so no adapter is needed.
 */
const app = createApp();

export default async (request: Request) => {
  const response = await app.fetch(request);
  // Netlify's CDN leaves query strings out of its cache key, so `?fail=503` matched the
  // cached plain response and, the origin having answered 503, was served it stale. The
  // demo switches change the response, so they belong in the key. (Entries cached on the
  // old /api/clients path before this header existed survived a CDN purge, kept for
  // serving on errors; the versioned path started with a clean cache.)
  response.headers.set('Netlify-Vary', 'query=delay|fail');
  return response;
};

export const config = { path: '/api/*' };
