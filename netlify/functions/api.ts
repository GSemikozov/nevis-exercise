import { createApp } from '../../server/app.ts';

/*
 * The same Hono app as the local Node server, deployed as a Netlify Function (Node.js
 * runtime). Netlify Functions take a web-standard Request and return a Response, which is
 * exactly Hono's `fetch` signature, so no adapter is needed.
 */
const app = createApp();

export default (request: Request) => app.fetch(request);

export const config = { path: '/api/*' };
