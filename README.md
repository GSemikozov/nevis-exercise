# Nevis Clients Dashboard

A dashboard over the client book of business: a stacked bar chart of clients per month and a table that drills from the whole company down to a branch, an advisor and an acquisition channel. The data is served by a small Node.js REST API.

## Quick start

Requires Node 22 (`nvm use` picks it up from `.nvmrc`).

```bash
npm install
npm run dev        # API on :3001, app on http://localhost:3000
```

| Command | What it does |
|---|---|
| `npm run dev` | API (Node, watch mode) and Vite dev server; Vite proxies `/api` to the API |
| `npm run build` | Type-checks every project and builds the client into `dist/` |
| `npm start` | Production-like run: one Node process serves `dist/` and the API |
| `npm test` / `npm run test:run` | Unit and component tests (Vitest), watch / single run |
| `npm run test:e2e` | End-to-end and accessibility tests in real browsers (Playwright + axe) |
| `npm run lint` / `npm run typecheck` | Biome lint + format check / TypeScript |

## Architecture

```
server/        Hono REST API (Node entry + Netlify Function entry share one app)
shared/        API contract: zod/mini schema and the TypeScript types inferred from it
src/
  app/         entry, providers, page shell
  features/    clients-report: data fetching, pure model transforms, feature UI
  components/  generic, domain-agnostic building blocks: tree grid, stacked bar chart, UI primitives
  lib/         formatting, motion tokens, utilities
  styles/      design tokens and global CSS
```

The dependency rule is one-directional: `app → features → components → lib`. Generic components know nothing about clients, branches or advisors; the feature composes them with domain data. This is a lighter take on Feature-Sliced Design, which would be overkill for a single feature.

## Decisions

Each entry records what was chosen, what else was considered and why.

| Area | Choice | Alternatives considered | Why |
|---|---|---|---|
| Architecture | Feature folder + generic components, one package | Feature-Sliced Design, npm workspaces | One feature does not justify FSD layers or a monorepo; the boundaries above give the same isolation |
| API | Hono on Node 22, running TypeScript natively (type stripping) | Express, Fastify | Web-standard handler: the same `app` runs as a Node server locally and as a Netlify Function in production, with no adapter |
| Charts | Own SVG on `d3-scale` + `d3-shape` | Recharts (+119 KB gzip), visx 4 (+26 KB) | The chart is simple; +10 KB, pixel-level control over the design and accessibility, and a pure layout function that is easy to test |
| Tree table | Own treegrid following the WAI-ARIA APG pattern | React Aria Table with expandable rows (+63 KB), shadcn/TanStack Table | No library ships treegrid semantics with the row animations in the design; owning the DOM keeps both |
| UI primitives | Own, in the shadcn style (`cva` + `cn` + CSS variables) | shadcn/ui | With the table and chart custom, only a few trivial primitives remain; headless primitives come in when overlays do |
| Animation | motion (`layout` + `AnimatePresence`), lazy-loaded features | View Transitions API, hand-written FLIP, CSS height transitions | Matches Figma's Smart Animate (rows below slide while new rows fade), animates only transform/opacity, interruptible, honours reduced motion |
| Server state | TanStack Query | Plain `fetch` + effects | Loading, error, retry and request cancellation without hand-rolled state machines |
| Virtualization | Not yet | TanStack Virtual | The row model is already a flat list, so it can be added once real data volumes are known |

Bundle sizes above are gzip deltas over React + React DOM, measured with Vite production builds of minimal usage of each library.

## Assumptions and open questions

_In progress — filled in as decisions are made._

## What I would do next

_In progress._
