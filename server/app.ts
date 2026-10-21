import { createHash } from 'node:crypto';
import { type Context, Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { logger } from 'hono/logger';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import * as z from 'zod/mini';
import { type ClientsResponse, clientsResponseSchema } from '../shared/clients.schema.ts';
import company from './data/clients.json' with { type: 'json' };

/** The mock covers Feb 2024 – Jan 2025, the period shown in the design. */
const PERIOD_START = '2024-02';

const MAX_DEMO_DELAY_MS = 3000;

/*
 * Demo switches so reviewers can see the loading and error states against the real API:
 * `?delay=1500` holds the response, `?fail=503` answers with that status. A held response
 * keeps a serverless function busy, so they can be turned off with API_DEMO_SWITCHES=off;
 * the public demo keeps them on on purpose, a real production deployment would not.
 */
const demoParamsSchema = z.object({
  delay: z.optional(
    z.coerce.number().check(z.refine(Number.isInteger), z.minimum(0), z.maximum(MAX_DEMO_DELAY_MS))
  ),
  fail: z.optional(
    z.coerce.number().check(z.refine(Number.isInteger), z.minimum(400), z.maximum(599))
  ),
});

interface AppOptions {
  clients?: ClientsResponse;
  logRequests?: boolean;
  /** Honour ?delay and ?fail. Defaults to on unless API_DEMO_SWITCHES=off. */
  demoSwitches?: boolean;
}

export function createApp({
  clients = defaultClients(),
  logRequests = false,
  demoSwitches = process.env.API_DEMO_SWITCHES !== 'off',
}: AppOptions = {}) {
  // Fail fast: refuse to start rather than serve data that breaks the contract.
  const payload = clientsResponseSchema.parse(clients);
  // The payload never changes while the process runs: serialise and fingerprint it once,
  // instead of re-hashing the body on every request.
  const body = JSON.stringify(payload);
  const etag = `"${createHash('sha1').update(body).digest('base64url')}"`;

  const app = new Hono();
  if (logRequests) app.use(logger());

  const api = new Hono();

  api.get('/health', (c) => c.json({ status: 'ok' }));

  api.get('/clients', async (c) => {
    const { delay, fail } = demoSwitches ? parseDemoParams(c.req.query()) : {};
    if (delay) await sleep(delay);
    if (fail) throw problem(fail as ContentfulStatusCode, 'Simulated failure', `?fail=${fail}`);

    if (delay !== undefined) {
      c.header('Cache-Control', 'no-store');
    } else {
      c.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=600');
      c.header('ETag', etag);
      if (matchesEtag(c.req.header('If-None-Match'), etag)) return c.body(null, 304);
    }
    return c.body(body, 200, { 'Content-Type': 'application/json' });
  });

  api.all('*', (c) => {
    throw problem(404, 'Not Found', `No API route for ${c.req.method} ${c.req.path}`);
  });

  app.route('/api', api);

  app.onError((error, c) => {
    if (error instanceof HTTPException) return error.getResponse();
    console.error(error);
    return problemResponse(c, 500, 'Internal Server Error');
  });

  return app;
}

function defaultClients(): ClientsResponse {
  return { data: company, meta: { periodStart: PERIOD_START } };
}

function parseDemoParams(query: Record<string, string>) {
  const parsed = demoParamsSchema.safeParse(query);
  if (!parsed.success) {
    throw problem(400, 'Invalid query parameters', z.prettifyError(parsed.error));
  }
  return parsed.data;
}

/** If-None-Match may list several tags, and may mark them weak (W/"…"). */
function matchesEtag(header: string | undefined, etag: string) {
  if (!header) return false;
  return header
    .split(',')
    .map((tag) => tag.trim().replace(/^W\//, ''))
    .some((tag) => tag === etag || tag === '*');
}

/** Errors use RFC 9457 problem details, so clients get one predictable shape. */
function problem(status: ContentfulStatusCode, title: string, detail?: string) {
  const body = JSON.stringify({ type: 'about:blank', title, status, detail });
  return new HTTPException(status, {
    res: new Response(body, {
      status,
      headers: { 'Content-Type': 'application/problem+json', 'Cache-Control': 'no-store' },
    }),
  });
}

function problemResponse(c: Context, status: ContentfulStatusCode, title: string) {
  c.header('Cache-Control', 'no-store');
  return c.body(JSON.stringify({ type: 'about:blank', title, status }), status, {
    'Content-Type': 'application/problem+json',
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
