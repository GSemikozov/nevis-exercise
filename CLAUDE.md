# Nevis Clients Dashboard

Take-home for Nevis: a dashboard with a stacked bar chart and an expandable tree table over client data, served by a Node.js REST API. `README.md` is the reviewer-facing doc and doubles as the decision log — update it whenever a decision or assumption changes.

## Stack

React 19 · TypeScript (strict) · Vite · Tailwind v4 · TanStack Query · motion · d3-array (`nice`/`ticks` only; the chart is own SVG) · Hono on Node 22 · zod/mini · Vitest + Testing Library + MSW + virtual screen reader · Playwright + axe · Biome

## Commands

Node 22 (`nvm use`).

- `npm run dev` — API on :3001 and Vite on http://localhost:3000 (proxies `/api`)
- `npm start` — production-like: one Node process serves `dist/` and the API (run `npm run build` first)
- `npm test` / `npm run test:run` — Vitest: `web` project (jsdom) and `node` project (server, shared)
- `npm run test:e2e` — Playwright, Chromium + WebKit, against a production build served on :4173. Locally it reuses a server already on 4173, so stop a stale one first. First run: `npx playwright install chromium webkit`
- `E2E_BASE_URL=https://nevis-exercise.netlify.app npm run test:e2e` — the same suite against a deployment
- `npm run lint` / `npm run lint:fix` — Biome lint + format
- `npm run typecheck`, `npm run build`

## Layout

- `server/` — Hono app (`app.ts`), Node entry (`main.ts`), static client with security headers for `npm start` (`static.ts`), mock data
- `netlify/functions/api.ts` — the same Hono app deployed as a Netlify Function
- `shared/` — API contract (zod/mini schema + inferred types), used by server and client (`@shared/*`)
- `src/app/` — entry, providers, page shell
- `src/features/clients-report/` — the dashboard feature: `api/`, `model/` (pure transforms), `ui/`
- `src/components/` — generic, domain-agnostic components (`tree-grid/`, `stacked-bar-chart/`, `ui/`)
- `src/lib/` — `cn()`, Intl formatters, motion tokens
- `src/styles/` — design tokens (Figma variables → semantic tokens) and global CSS
- `src/test/` — `setup.ts` (jest-dom matchers, jsdom stubs: ResizeObserver, scrollIntoView, `<dialog>`), `api-mock.ts` (MSW: `setupMockApi`, `apiServer`), `render.tsx` (`renderWithProviders`)
- `e2e/` — Playwright specs and `helpers.ts` (`row`, `chart`, `openDashboard`, `tabTo`, `waitForAnimations`); `docs/` — manual accessibility checklist

Import via the `@/` alias (`@/lib/cn`). Server code runs on Node's native type stripping: relative imports need the `.ts` extension, and only erasable TypeScript syntax is allowed (no enums, namespaces or parameter properties).

## Conventions

- Named exports, function components, no default exports (except where a platform requires one, e.g. Netlify Functions).
- Dependencies point one way: `app → features → components → lib`. `src/components` is domain-agnostic and must not import from `src/features`.
- Style with Tailwind utilities and theme tokens; no hard-coded hex values in components.
- Motion: 300ms with `cubic-bezier(0, 0, 0.58, 1)` (Figma "Ease out") from `src/lib/motion.ts`; animate only `transform`/`opacity`; respect reduced motion.
- Accessibility first: semantic elements, labelled controls, full keyboard support, visible focus.
- Keep state as local as possible; derive instead of syncing; extract a hook once logic is non-trivial.
- Test behavior through the user's perspective (`getByRole`, `userEvent`), not implementation details.
- Run `npm run lint:fix && npm run typecheck && npm run test:run` before calling a change done.
- Code, README and commits in English. Commits: imperative subject, body says why.

## Gotchas

- Security headers (CSP and others) are defined twice: `netlify.toml` for production, `server/static.ts` for `npm start` and e2e. Change both.
- `/api/v1/clients` stays `Cache-Control: private`, and debug parameters live only on `/api/v1/demo/clients`: Netlify's CDN serves stale copies on a 5xx whatever the query (README, "API").
- CI runs e2e on Linux, where WebKit puts buttons in the Tab order and macOS WebKit does not. Walk the order with `tabTo` instead of hard-coding it. To reproduce CI, run the suite in `mcr.microsoft.com/playwright:v<@playwright/test version>-noble` after a clean `npm ci`.
- Call `waitForAnimations` before axe checks: mid-fade rows fail colour contrast.
- A push to `main` deploys production on Netlify.
