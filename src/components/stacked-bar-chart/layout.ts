import { nice, ticks } from 'd3-array';

export interface ChartSeries {
  id: string;
  label: string;
  /** One value per category, in category order. */
  values: readonly number[];
  /** Any CSS colour, typically a token such as `var(--color-chart-1)`. */
  color: string;
}

export interface SegmentLayout {
  seriesId: string;
  value: number;
  /** Top edge, in plot coordinates (0 = top of the plot). */
  y: number;
  height: number;
}

export interface ColumnLayout {
  index: number;
  x: number;
  width: number;
  /** Band step: column plus the gap after it. The hover target spans the whole step. */
  step: number;
  total: number;
  /** Y of the top of the stack. */
  top: number;
  /** Bottom to top, in series order; zero values are skipped. */
  segments: SegmentLayout[];
}

export interface ChartLayout {
  columns: ColumnLayout[];
  ticks: { value: number; y: number }[];
  max: number;
}

interface LayoutInput {
  categoryCount: number;
  series: readonly ChartSeries[];
  /** Plot width and height in px, axes excluded. */
  width: number;
  height: number;
  /** Space between stacked segments, so neighbouring colours never touch. */
  segmentGap?: number;
}

/*
 * Proportions from the design: 87.5px columns with 24px gaps and 12px edge padding on a
 * 1338px plot, i.e. a 111.5px step. Kept as ratios so the chart scales down to 375px.
 */
const DESIGN_STEP = 111.5;
const PADDING_INNER = 24 / DESIGN_STEP;
const PADDING_OUTER = 12 / DESIGN_STEP;

/**
 * Pure mapping from data to geometry: where every column, segment and tick goes.
 * Everything the chart draws comes from here, which is what the tests pin down.
 */
export function computeLayout({
  categoryCount,
  series,
  width,
  height,
  segmentGap = 2,
}: LayoutInput): ChartLayout {
  const indices = Array.from({ length: categoryCount }, (_, i) => i);
  const totals = indices.map((i) => series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0));

  // Round the top up to a clean tick, the way d3's linear scale does: 350 → 400 in steps
  // of 100, as in the design. Only nice() and ticks() come from d3 (d3-array, ~2 KB).
  const [, max = 1] = nice(0, Math.max(1, ...totals), 4);
  const y = (value: number) => height - (value / max) * height;

  // A band layout (as d3's scaleBand): outer padding at both ends, inner between columns.
  const step = width / Math.max(1, categoryCount - PADDING_INNER + 2 * PADDING_OUTER);
  const bandwidth = step * (1 - PADDING_INNER);
  const x = (index: number) => step * PADDING_OUTER + index * step;

  const columns = indices.map((index): ColumnLayout => {
    const total = totals[index] ?? 0;
    const stacked = series.filter((s) => (s.values[index] ?? 0) > 0);
    let base = 0;
    const segments = stacked.map((s, k): SegmentLayout => {
      const value = s.values[index] ?? 0;
      const bottom = y(base);
      const top = y(base + value);
      base += value;
      // The gap sits under every segment but the first, so the stack keeps its height.
      const gap = k === 0 ? 0 : segmentGap;
      return { seriesId: s.id, value, y: top, height: Math.max(0, bottom - top - gap) };
    });
    return { index, x: x(index), width: bandwidth, step, total, top: y(total), segments };
  });

  return {
    columns,
    ticks: ticks(0, max, 4).map((value) => ({ value, y: y(value) })),
    max,
  };
}

/**
 * The column under a horizontal plot position, or null outside every column. Each column
 * owns its whole band step (the bar plus half the gap on either side), so the pointer
 * never falls between two months.
 */
export function columnAt(layout: ChartLayout, x: number): number | null {
  const first = layout.columns[0];
  if (!first) return null;
  const start = first.x - (first.step - first.width) / 2;
  const index = Math.floor((x - start) / first.step);
  return index >= 0 && index < layout.columns.length ? index : null;
}

interface TooltipPlacementInput {
  /** The selected column's left and right edges and stack top, in container pixels. */
  columnLeft: number;
  columnRight: number;
  stackTop: number;
  /** The area the tooltip must stay inside, in container pixels. */
  bounds: { top: number; bottom: number; width: number };
  /** The tooltip's measured size. */
  width: number;
  height: number;
  gap?: number;
}

/**
 * Where the tooltip goes: beside the selected column, on whichever side has room (right
 * first), so it never covers the column it describes; level with the top of the stack,
 * kept inside the chart. If neither side fits (very narrow screens), it is clamped into
 * the chart horizontally.
 */
export function placeTooltip({
  columnLeft,
  columnRight,
  stackTop,
  bounds,
  width,
  height,
  gap = 8,
}: TooltipPlacementInput): { left: number; top: number } {
  const top = Math.max(bounds.top, Math.min(stackTop, bounds.bottom - height));
  if (columnRight + gap + width <= bounds.width) return { left: columnRight + gap, top };
  if (columnLeft - gap - width >= 0) return { left: columnLeft - gap - width, top };
  const centred = (columnLeft + columnRight) / 2 - width / 2;
  return { left: Math.max(0, Math.min(centred, bounds.width - width)), top };
}
