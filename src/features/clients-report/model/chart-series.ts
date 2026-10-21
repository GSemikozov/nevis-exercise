import type { ChartSeries } from '@/components/stacked-bar-chart/layout';
import type { ReportNode } from './report';

/*
 * Series colours in fixed order, assigned by a child's position in the data (never by
 * its rank or size), so a branch keeps its colour however the numbers move.
 */
const SLOT_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
];
const OTHER_COLOR = 'var(--color-chart-other)';

export interface ScopeSeries {
  series: ChartSeries[];
  /** Series that have a level beneath them, so the chart can drill into them. */
  drillableIds: ReadonlySet<string>;
}

/**
 * What the chart shows for a scope: one series per child, stacked, so the bars add up
 * to the scope's own totals.
 *
 * - A node without children is shown as a single series of its own values.
 * - More children than colours: the first four keep their colour, the rest fold into
 *   "Other" (a sixth generated hue would be indistinguishable).
 * - If the children add up to less than the node (clients not assigned further down),
 *   the gap is shown as "Other" too, so the bar height always matches the table.
 */
export function chartSeriesFor(scope: ReportNode): ScopeSeries {
  const [defaultColor] = SLOT_COLORS as [string];
  if (scope.children.length === 0) {
    return {
      series: [{ id: scope.id, label: scope.name, values: scope.values, color: defaultColor }],
      drillableIds: new Set(),
    };
  }

  const fits = scope.children.length <= SLOT_COLORS.length;
  const shown = fits ? scope.children : scope.children.slice(0, SLOT_COLORS.length - 1);
  const series: ChartSeries[] = shown.map((child, index) => ({
    id: child.id,
    label: child.name,
    values: child.values,
    color: SLOT_COLORS[index] ?? OTHER_COLOR,
  }));

  const other = scope.values.map((total, month) => {
    const accounted = shown.reduce((sum, child) => sum + (child.values[month] ?? 0), 0);
    return Math.max(0, total - accounted);
  });
  if (other.some((value) => value > 0)) {
    series.push({ id: `${scope.id}:other`, label: 'Other', values: other, color: OTHER_COLOR });
  }

  return {
    series,
    drillableIds: new Set(shown.filter((child) => child.children.length > 0).map((c) => c.id)),
  };
}
