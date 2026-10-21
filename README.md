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

## API

| Endpoint | Response |
|---|---|
| `GET /api/clients` | `{ data: <client tree>, meta: { periodStart: "2024-02" } }` |
| `GET /api/health` | `{ status: "ok" }` |

- **Contract:** `shared/clients.schema.ts` (zod/mini) is the single source of truth. The server validates its data at startup and refuses to start on a mismatch; the client validates every response, so a broken payload surfaces as an error state instead of a broken UI.
- **Period:** the brief's payload carries 12 values per node but no dates ("Feb 2024 to Jan 2025 in the design"). The API makes the period explicit in `meta.periodStart` rather than leaving month labels hard-coded in the UI.
- **Errors:** RFC 9457 problem details (`application/problem+json`) for every non-2xx response.
- **Caching:** `ETag` with `304 Not Modified`, `Cache-Control: public, max-age=60, stale-while-revalidate=600`.
- **Demo switches** to see the loading and error states against the real API: `?delay=<ms>` (up to 5000) and `?fail=<4xx|5xx>`. Both responses are `no-store`.

## Decisions

Each entry records what was chosen, what else was considered and why.

| Area | Choice | Alternatives considered | Why |
|---|---|---|---|
| Architecture | Feature folder + generic components, one package | Feature-Sliced Design, npm workspaces | One feature does not justify FSD layers or a monorepo; the boundaries above give the same isolation |
| API | Hono on Node 22, running TypeScript natively (type stripping) | Express, Fastify | Web-standard handler: the same `app` runs as a Node server locally and as a Netlify Function in production, with no adapter |
| Charts | Own SVG; only `nice()`/`ticks()` from `d3-array` (~2 KB) | Recharts (+119 KB gzip), visx 4 (+26 KB), `d3-scale` (+10 KB) | The chart is simple: stacked columns, a value axis, a legend. Owning it gives pixel-level control over the design and accessibility, and a pure layout function that is easy to test |
| Tree table | Own treegrid following the WAI-ARIA APG pattern | React Aria Table with expandable rows (+63 KB), shadcn/TanStack Table | No library ships treegrid semantics with the row animations in the design; owning the DOM keeps both |
| UI primitives | Own, in the shadcn style (`cva` + `cn` + CSS variables) | shadcn/ui | With the table and chart custom, only a few trivial primitives remain; headless primitives come in when overlays do |
| Animation | motion (`layout` + `AnimatePresence`), lazy-loaded features | View Transitions API, hand-written FLIP, CSS height transitions | Matches Figma's Smart Animate (rows below slide while new rows fade), animates only transform/opacity, interruptible, honours reduced motion |
| Server state | TanStack Query | Plain `fetch` + effects | Loading, error, retry and request cancellation without hand-rolled state machines |
| Design tokens | Two layers: semantic CSS variables named after the Figma variables (`--background-primary`, `--content-secondary`, …), mapped to Tailwind with `@theme inline` | Hard-coded Tailwind palette, shadcn token names | Design and code share one vocabulary; a theme is one block of variables. Only the light theme exists in the design, so only that ships |
| Fonts | Fontsource (self-hosted Inter 400) + `fontaine` (metric-matched fallback) + a 20-line Vite plugin that preloads the latin file | Google Fonts, `unplugin-fonts`, the variable font | Vite's equivalent of `next/font`: no third-party request, one preloaded 24 KB file, no layout shift on swap. The title's Inter Display cut is approximated with Inter's own tracking for 35px instead of a second file (the variable font with optical sizes is 73 KB) |
| Focus | 2px `outline` in the ink colour | Tailwind `ring` (box-shadow) | Outlines survive Windows High Contrast; box-shadows are removed there |
| Virtualization | Not yet | TanStack Virtual | The row model is already a flat list, so it can be added once real data volumes are known |
| Code splitting | The dashboard (tree grid, chart, animation runtime) is a lazy chunk whose download starts when the app loads, in parallel with the data request; motion's animation features load asynchronously | One bundle | Initial JS is 107 KB gzip (React + React DOM alone are ~74 KB); the 13 KB dashboard chunk and 32 KB of animation features are off the critical path without adding a request waterfall |

Bundle sizes above are gzip deltas over React + React DOM, measured with Vite production builds of minimal usage of each library.

## Assumptions and open questions

### The data did not add up, so the mock was corrected

Every parent value should equal the sum of its children, and four places in the brief's payload broke that. Each looked like a typo rather than a deliberate gap (such as unassigned clients), so the mock in `server/data/clients.json` was fixed and `server/data/clients.test.ts` now guards the invariant:

| Where | Brief | Served | Reasoning |
|---|---|---|---|
| Maria Gutierrez, May 2024 | 22 | 44 | 36 → 39 → 41 → **22** → 46 breaks an otherwise steady trend; 44 also makes Company's May total (301) add up |
| Branch 1, May 2024 | 156 | 178 | Follows from the fix above |
| Robert Chen, Aug 2024 | 58 | 56 | The design shows 56, and 56 makes Branch 1's August total (214) add up |
| Anna Blackwood, New paid, May–Sep 2024 | `1, 2, 1, 0, 2` | `2, 1, 0, 2, 1` | Shifted by one month. "Existing clients" in each month equals the previous month's total, so the channel split can be checked month by month, and the shift is the only change that makes all of it add up |

If parents and children can legitimately differ in real data (clients not yet assigned to an advisor, for example), the UI should show the gap explicitly rather than hide it; the chart already handles that case (see below).

### What the chart stacks

The design's legend splits the company's bars into acquisition channels (Existing clients, New organic, New paid), but only one employee in the data has channels; for everyone else that split does not exist, and inventing it would be wrong.

So the chart shows **one scope at a time, stacked by the level beneath it**: the company by branch, a branch by advisor, an advisor by acquisition channel. That gives every scope the same reading (each bar is the scope's total, each segment one child), and at Anna Blackwood it is exactly the design's chart. The brief's "drill from the whole company down to a single branch, advisor or acquisition channel" maps onto it directly:

- **Drill down** by clicking a segment or a legend entry; legend entries are buttons, so it works from the keyboard. Only entries with a level beneath them are drillable, marked with a chevron.
- **Go back** with the breadcrumb above the chart.
- **The table follows**: drilling the chart expands the table down to the same node. The reverse is deliberately not true: expanding rows to look around should not repaint the chart under the reader.
- **Non-uniform nesting:** a scope's children with nothing beneath them (Branch 2 and 3, James Walker) are plain legend entries. If children ever add up to less than their parent, the gap is drawn as an "Other" segment so the bar still matches the table; beyond five children, the rest fold into "Other" too, rather than generating colours nobody can tell apart.

### Smaller calls

- **Avatars:** the design shows photos, but the API has no image URLs, so advisors get initials. They are decorative (`aria-hidden`); the name next to them carries the meaning.
- **Default state:** as in the design, the company starts expanded with its branches showing, and the chart starts at company level.
- **Branch 2 and Branch 3** show chevrons in the design; they have no employees, so here they have no chevron and are not announced as expandable.
- **Chart hover:** the prototype has none. A tooltip with every series and the total was added on hover and on keyboard focus, since a stacked chart is hard to read without exact values.

### Colours: an open question for design

The three chart colours from the design were run through a palette check (OKLCH lightness band, chroma floor, colour-blind separation under protanopia and deuteranopia, contrast on white):

| Colour | Use | Result |
|---|---|---|
| `#B29DF8` violet | first series | Contrast 2.3:1 on white, below the 3:1 for graphics |
| `#F4BEB4` peach | second series | Too light (L 0.85, band 0.43–0.77), nearly grey (chroma 0.06), 1.6:1 on white |
| `#A75E6E` maroon | third series | Chroma 0.096, just under the 0.10 floor; contrast passes |

Neighbouring pairs do separate well for colour-blind readers (ΔE ≥ 16), so the design's colours ship unchanged, backed by the mitigations WCAG 1.4.11 allows: a legend for every series, a 2px gap between stacked segments, exact values in a tooltip, and the full data in the table. Series four and five (`#4A8FC4`, `#B8860B`) were chosen to pass every check next to their neighbours. Worth raising with design: a darker peach and violet would remove the reliance on those mitigations.

## What I would do next

_In progress._
