import { scaleBand, scaleLinear } from 'd3-scale';

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

  // nice(4) rounds the top to a clean tick: 350 → 400 in steps of 100, as in the design.
  const y = scaleLinear()
    .domain([0, Math.max(1, ...totals)])
    .range([height, 0])
    .nice(4);
  const x = scaleBand<number>()
    .domain(indices)
    .range([0, width])
    .paddingInner(PADDING_INNER)
    .paddingOuter(PADDING_OUTER);

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
    return {
      index,
      x: x(index) ?? 0,
      width: x.bandwidth(),
      step: x.step(),
      total,
      top: y(total),
      segments,
    };
  });

  return {
    columns,
    ticks: y.ticks(4).map((value) => ({ value, y: y(value) })),
    max: y.domain()[1] ?? 0,
  };
}
