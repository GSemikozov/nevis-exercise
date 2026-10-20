# Nevis Exercise

Single-page React app used as a sandbox for a live-coding task: build a complex UI component.

## Stack

React 19 · TypeScript (strict) · Vite · Tailwind v4 · Vitest + Testing Library · Biome · lucide-react

Installed but not wired up yet: `@tanstack/react-query` (no `QueryClientProvider` in `main.tsx` — add one before using hooks) and `@tanstack/react-virtual` for long lists.

## Commands

Node 22 (`nvm use`).

- `npm run dev` — dev server on http://localhost:3000
- `npm test` — Vitest watch mode; `npm run test:run` — single run
- `npm run lint` / `npm run lint:fix` — Biome lint + format
- `npm run typecheck`
- `npm run build`

## Layout

- `src/App.tsx` — the single entry page; mount the component under development here
- `src/components/<name>/` — component, its sub-parts, hooks, and `*.test.tsx` co-located
- `src/lib/cn.ts` — `cn()` = clsx + tailwind-merge for conditional classes
- `src/index.css` — Tailwind theme tokens (`bg-card`, `text-muted-foreground`, `border-border`, `ring-ring`, …)
- `src/test/setup.ts` — jest-dom matchers; jsdom stubs for ResizeObserver, scrollIntoView, element size (for react-virtual) and `<dialog>` showModal/close

Import via the `@/` alias (`@/lib/cn`).

## Conventions

- Named exports, function components, no default exports.
- Style with Tailwind utilities and theme tokens; no hard-coded hex values in components.
- Accessibility first: semantic elements, labelled controls, full keyboard support, visible focus.
- Keep state as local as possible; derive instead of syncing; extract a hook once logic is non-trivial.
- Test behavior through the user's perspective (`getByRole`, `userEvent`), not implementation details.
- Run `npm run lint:fix && npm run typecheck && npm run test:run` before calling a change done.
