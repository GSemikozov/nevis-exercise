import { serveStatic } from '@hono/node-server/serve-static';
import type { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';

/**
 * Serves the built client next to the API, as `npm start` does. Mirrors netlify.toml, so
 * the end-to-end tests run against the production headers.
 */
export function serveClient(app: Hono, root: string) {
  // Keep in sync with netlify.toml. Styles allow 'unsafe-inline' because motion's
  // popLayout injects a <style> element at runtime.
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
  app.use('/*', serveStatic({ root }));
  return app;
}
