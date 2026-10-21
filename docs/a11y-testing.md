# Accessibility testing

The brief asks for two things explicitly: expanding and collapsing rows must work from the keyboard, and the hierarchy must reach assistive technology. Both are covered by automated tests; this page lists what those tests cover and the manual checks that automation cannot replace.

## Automated

| Layer | Tool | What it covers |
|---|---|---|
| Keyboard model | Vitest + Testing Library (`src/components/tree-grid/TreeGrid.test.tsx`) | The WAI-ARIA APG treegrid keys: arrows across rows and cells, Right/Left to expand, collapse or move to the parent, Enter/Space, Home/End; a single tab stop; focus moving to the nearest visible ancestor when its row is collapsed away |
| Hierarchy for AT | Vitest + Testing Library | `aria-level`, `aria-posinset`, `aria-setsize`, `aria-expanded` (absent on leaves), row and column headers |
| What a screen reader announces | `@guidepup/virtual-screen-reader` (`screen-reader.test.tsx`) | The phrases a screen reader builds from the accessibility tree, e.g. `row, Branch 1 …, not expanded, level 2, position 1, set size 3` |
| WCAG 2.2 AA rules | axe-core in Chromium and WebKit (`e2e/a11y.spec.ts`) | Default, fully expanded and drilled, chart tooltip open from the keyboard, loading, error, and 375px |
| Real keyboard | Playwright (`e2e/dashboard.spec.ts`) | Tab order and keyboard-only expand/collapse in real browsers |
| Motion | Playwright with `reducedMotion: 'reduce'` | Rows appear without sliding |
| Reflow | Playwright at 375px (`e2e/responsive.spec.ts`) | No page overflow when fully expanded; the table scrolls inside its card with names pinned |

Automated rules catch roughly a third of accessibility problems; the virtual screen reader simulates announcements but is not a screen reader. The checks below are the rest.

## Manual checklist

Run against `npm run build && npm start` (http://localhost:3000), or the deployed site.

### Keyboard only (any browser)

- [ ] Tab order: chart → drillable legend entries → table (one stop) → nothing is skipped or trapped. In Safari, buttons are only in the Tab order with Full Keyboard Access on (System Settings → Keyboard).
- [ ] Focus is always visible, including on the chart region and inside the table.
- [ ] Table: every key in the treegrid model works, and a focused cell scrolls into view clear of the pinned name column.
- [ ] Chart: arrow keys step through months and the tooltip follows; Escape closes it.
- [ ] Drilling from a legend entry or a breadcrumb moves focus to the chart.

### VoiceOver + Safari (macOS)

- [ ] The table is announced as a table/tree grid with its name; moving between rows announces level, position ("1 of 3") and expanded or collapsed.
- [ ] Expanding a row announces the new state; the new rows are reachable straight away.
- [ ] The chart is announced as a group with its scope ("Clients per month for Company, by branch, …"); arrow keys read each month through the live region.
- [ ] Drilling announces the new scope; the error alert is announced when it appears.

### NVDA + Firefox or Chrome (Windows)

- [ ] Entering the table switches to focus mode; arrow keys move within the grid, not the virtual buffer.
- [ ] Same announcements as for VoiceOver.

### Visual

- [ ] 200% and 400% zoom (400% of 1280px is 320 CSS px): nothing is clipped; the table scrolls inside its card.
- [ ] Windows High Contrast / `forced-colors: active`: chart colours stay, focus outlines and row borders are visible. (Checked with Playwright's forced-colors emulation in Chromium.)
- [ ] Text spacing (WCAG 1.4.12, e.g. a text-spacing bookmarklet): no text is cut off.
- [ ] OS "reduce motion": rows and bars do not slide.

## Known limitations

- **Chart segments are mouse targets.** Every action they offer (drilling) is also a legend button, and every value is in the table and in the keyboard walk-through.
- **Two of the design's chart colours are below 3:1 on white.** Mitigated by the legend, the gap between segments, the tooltip and the table; see "Colours" in the README.
- **The header row is not a focus stop.** Screen readers announce column headers when moving between cells, so focusing them would add stops without adding information.
