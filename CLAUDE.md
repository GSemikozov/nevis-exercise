# Nevis Clients Dashboard

Take-home for Nevis: a dashboard with a stacked bar chart and an expandable tree table over client data, served by a Node.js REST API. `README.md` is the reviewer-facing doc and doubles as the decision log — update it whenever a decision or assumption changes.

## Stack

React 19 · TypeScript (strict) · Vite · Tailwind v4 · TanStack Query · motion · d3-scale / d3-shape · Hono on Node 22 · zod/mini · Vitest + Testing Library + MSW · Playwright + axe · Biome

## Commands

Node 22 (`nvm use`).

- `npm run dev` — API on :3001 and Vite on http://localhost:3000 (proxies `/api`)
- `npm start` — production-like: one Node process serves `dist/` and the API (run `npm run build` first)
- `npm test` / `npm run test:run` — Vitest: `web` project (jsdom) and `node` project (server, shared)
- `npm run test:e2e` — Playwright
- `npm run lint` / `npm run lint:fix` — Biome lint + format
- `npm run typecheck`, `npm run build`

## Layout

- `server/` — Hono app (`app.ts`), Node entry (`main.ts`), mock data
- `netlify/functions/api.ts` — the same Hono app deployed as a Netlify Function
- `shared/` — API contract (zod/mini schema + inferred types), used by server and client (`@shared/*`)
- `src/app/` — entry, providers, page shell
- `src/features/clients-report/` — the dashboard feature: `api/`, `model/` (pure transforms), `ui/`
- `src/components/` — generic, domain-agnostic components (`tree-grid/`, `stacked-bar-chart/`, `ui/`)
- `src/lib/` — `cn()`, Intl formatters, motion tokens
- `src/styles/` — design tokens (Figma variables → semantic tokens) and global CSS
- `src/test/setup.ts` — jest-dom matchers, jsdom stubs (ResizeObserver, scrollIntoView, `<dialog>`)
- `e2e/` — Playwright specs; `docs/` — manual accessibility checklist

Import via the `@/` alias (`@/lib/cn`). Server code runs on Node's native type stripping: relative imports need the `.ts` extension, and only erasable TypeScript syntax is allowed (no enums, namespaces or parameter properties).

## Conventions

- Named exports, function components, no default exports (except where a platform requires one, e.g. Netlify Functions).
- `src/components` is domain-agnostic and must not import from `src/features`.
- Style with Tailwind utilities and theme tokens; no hard-coded hex values in components.
- Motion: 300ms with `cubic-bezier(0, 0, 0.58, 1)` (Figma "Ease out") from `src/lib/motion.ts`; animate only `transform`/`opacity`; respect reduced motion.
- Accessibility first: semantic elements, labelled controls, full keyboard support, visible focus.
- Keep state as local as possible; derive instead of syncing; extract a hook once logic is non-trivial.
- Test behavior through the user's perspective (`getByRole`, `userEvent`), not implementation details.
- Run `npm run lint:fix && npm run typecheck && npm run test:run` before calling a change done.
