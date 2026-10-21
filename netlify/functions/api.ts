import { createApp } from '../../server/app.ts';

/*
 * The same Hono app as the local Node server, deployed as a Netlify Function (Node.js
 * runtime). Netlify Functions take a web-standard Request and return a Response, which is
 * exactly Hono's `fetch` signature, so no adapter is needed.
 */
const app = createApp();

export default async (request: Request) => {
  const response = await app.fetch(request);
  // Netlify's CDN leaves query strings out of its cache key, so `?fail=503` hit the cached
  // `/api/clients` and, the origin having answered 503, was served that stale 200. The
  // demo switches change the response, so they belong in the key.
  response.headers.set('Netlify-Vary', 'query=delay|fail');
  return response;
};

export const config = { path: '/api/*' };
