import { useId, useMemo, useRef } from 'react';
import { ChartLegend } from '@/components/stacked-bar-chart/ChartLegend';
import { StackedBarChart } from '@/components/stacked-bar-chart/StackedBarChart';
import { formatCount } from '@/lib/format';
import { chartSeriesFor } from '../model/chart-series';
import { childLevelLabel, type Month, type ReportNode } from '../model/report';
import { ScopeBreadcrumbs } from './ScopeBreadcrumbs';

interface ClientsChartCardProps {
  scope: ReportNode;
  /** From the root down to `scope`. */
  path: readonly ReportNode[];
  months: readonly Month[];
  onScopeChange: (id: string) => void;
}

/**
 * The chart for the current scope, split by the level beneath it. Drilling happens from
 * a segment, a legend entry or the breadcrumbs, and always ends with focus on the chart,
 * whose label then announces the new scope.
 */
export function ClientsChartCard({ scope, path, months, onScopeChange }: ClientsChartCardProps) {
  const headingId = useId();
  const chartRef = useRef<HTMLDivElement | null>(null);
  const { series, drillableIds } = useMemo(() => chartSeriesFor(scope), [scope]);
  const isDrillable = (id: string) => drillableIds.has(id);

  const splitBy = scope.children.length > 0 ? `by ${childLevelLabel[scope.kind]}` : undefined;
  const period = `${months[0]?.label} to ${months.at(-1)?.label}`;
  const chartLabel = `Clients per month for ${scope.name}${splitBy ? `, ${splitBy}` : ''}, ${period}`;

  const changeScope = (id: string) => {
    onScopeChange(id);
    chartRef.current?.focus();
  };

  return (
    <section
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col gap-4 rounded-card bg-surface px-4 pt-6 pb-4"
    >
      <h2 id={headingId} className="sr-only">
        Clients per month chart
      </h2>
      <div className="flex flex-wrap items-center gap-x-2 text-body">
        <ScopeBreadcrumbs path={path} onSelect={changeScope} />
        {splitBy && <span className="text-content-secondary">· {splitBy}</span>}
      </div>
      <StackedBarChart
        ref={chartRef}
        aria-label={chartLabel}
        categories={months}
        series={series}
        formatValue={formatCount}
        onSeriesActivate={changeScope}
        isSeriesActivatable={isDrillable}
      />
      <ChartLegend series={series} onActivate={changeScope} isActivatable={isDrillable} />
    </section>
  );
}
