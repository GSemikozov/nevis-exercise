import { createHash } from 'node:crypto';
import { STATUS_CODES } from 'node:http';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { logger } from 'hono/logger';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import * as z from 'zod/mini';
import {
  CLIENTS_ENDPOINT,
  type ClientsResponse,
  clientsResponseSchema,
  DEMO_CLIENTS_ENDPOINT,
} from '../shared/clients.schema.ts';
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

/** A problem type of this API's own, beyond what an HTTP status already says. */
interface ProblemType {
  /** A tag URI (RFC 4151): a stable identifier that needs no documentation page behind it. */
  type: string;
  title: string;
}

/** What `?fail` answers with: a failure the reviewer asked for, not a real outage. */
const SIMULATED_FAILURE: ProblemType = {
  type: 'tag:nevis-exercise.netlify.app,2026:simulated-failure',
  title: 'Simulated failure',
};

interface AppOptions {
  clients?: ClientsResponse;
  logRequests?: boolean;
  /** Serve the demo endpoint (?delay, ?fail). Defaults to on unless API_DEMO_SWITCHES=off. */
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

  // The real endpoint takes no debug parameters.
  api.get(routeOf(CLIENTS_ENDPOINT), (c) => {
    // private: client data belongs to the signed-in advisor in a real product, so no
    // shared cache (CDN) may keep it. The browser still reuses it for a minute and then
    // revalidates with the ETag.
    c.header('Cache-Control', 'private, max-age=60');
    c.header('ETag', etag);
    if (matchesEtag(c.req.header('If-None-Match'), etag)) return c.body(null, 304);
    return c.body(body, 200, { 'Content-Type': 'application/json' });
  });

  // The demo switches live on their own path, never shared with real traffic or its
  // caches: Netlify's CDN answers an origin 5xx with any stale copy it holds for a path,
  // whatever the query, so `?fail` on the real endpoint could come back as old data.
  if (demoSwitches) {
    api.get(routeOf(DEMO_CLIENTS_ENDPOINT), async (c) => {
      const { delay, fail } = parseDemoParams(c.req.query());
      if (delay) await sleep(delay);
      if (fail) {
        throw problem(fail as ContentfulStatusCode, {
          type: SIMULATED_FAILURE,
          detail: `Requested with ?fail=${fail}`,
        });
      }
      c.header('Cache-Control', 'no-store');
      return c.body(body, 200, { 'Content-Type': 'application/json' });
    });
  }

  api.all('*', (c) => {
    throw problem(404, { detail: `No API route for ${c.req.method} ${c.req.path}` });
  });

  app.route('/api', api);

  app.onError((error) => {
    if (error instanceof HTTPException) return error.getResponse();
    console.error(error);
    return problem(500).getResponse();
  });

  return app;
}

/** The API sub-app is mounted at /api, so its routes are the shared endpoints minus it. */
function routeOf(endpoint: string) {
  return endpoint.slice('/api'.length);
}

function defaultClients(): ClientsResponse {
  return { data: company, meta: { periodStart: PERIOD_START } };
}

function parseDemoParams(query: Record<string, string>) {
  const parsed = demoParamsSchema.safeParse(query);
  if (!parsed.success) throw problem(400, { detail: z.prettifyError(parsed.error) });
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

/**
 * Errors use RFC 9457 problem details, so clients get one predictable shape. A plain HTTP
 * error has the type "about:blank", whose title the RFC asks to be the status phrase
 * ("Bad Request"); what went wrong this time goes in `detail`. A problem type of our own
 * brings its own type URI and title.
 */
function problem(
  status: ContentfulStatusCode,
  { type, detail }: { type?: ProblemType; detail?: string } = {}
) {
  const body = JSON.stringify({
    type: type?.type ?? 'about:blank',
    title: type?.title ?? STATUS_CODES[status],
    status,
    detail,
  });
  return new HTTPException(status, {
    res: new Response(body, {
      status,
      headers: { 'Content-Type': 'application/problem+json', 'Cache-Control': 'no-store' },
    }),
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
