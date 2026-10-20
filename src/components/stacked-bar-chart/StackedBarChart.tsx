import { useReducedMotion } from 'motion/react';
import * as m from 'motion/react-m';
import { type FocusEvent, type KeyboardEvent, useId, useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { figmaTransition } from '@/lib/motion';
import { type ChartLayout, type ChartSeries, type ColumnLayout, computeLayout } from './layout';
import { useElementWidth } from './use-element-width';

export interface ChartCategory {
  key: string;
  /** "Feb 2024": axis and tooltip. */
  label: string;
  /** "Feb": axis when columns get narrow. */
  shortLabel: string;
  /** "February 2024": read out to assistive technology. */
  longLabel: string;
}

interface StackedBarChartProps {
  categories: readonly ChartCategory[];
  series: readonly ChartSeries[];
  /** Names the chart for assistive technology, e.g. "Clients per month by branch". */
  'aria-label': string;
  formatValue?: (value: number) => string;
  /** Plot height in px; the design uses 320. */
  plotHeight?: number;
  /** Fixed width, mainly for tests; by default the chart fills its container. */
  width?: number;
  /** Clicking a segment of an activatable series calls this (used to drill down). */
  onSeriesActivate?: (seriesId: string) => void;
  isSeriesActivatable?: (seriesId: string) => boolean;
  className?: string;
}

// Geometry from the design: 26px value labels + 12px gap, 10px above the plot so the
// top tick label is not clipped, 12px + 16px for the month labels below.
const PLOT_LEFT = 38;
const AXIS_LABEL_RIGHT = 26;
const PLOT_TOP = 10;
const MONTH_LABEL_OFFSET = 12 + 8;
const TOP_RADIUS = 4;

type Active = { index: number; via: 'pointer' | 'keyboard' };

/**
 * Stacked columns, one per category. The SVG is decorative for assistive technology:
 * keyboard and screen reader users step through the categories with the arrow keys and
 * hear each one through a live region, and the same numbers are in the table view.
 */
export function StackedBarChart({
  categories,
  series,
  formatValue = String,
  plotHeight = 320,
  width: fixedWidth,
  onSeriesActivate,
  isSeriesActivatable = () => false,
  className,
  'aria-label': ariaLabel,
}: StackedBarChartProps) {
  const [containerRef, measuredWidth] = useElementWidth<HTMLDivElement>();
  const width = fixedWidth ?? measuredWidth;
  const plotWidth = Math.max(0, width - PLOT_LEFT);
  const layout = useMemo(
    () =>
      computeLayout({
        categoryCount: categories.length,
        series,
        width: plotWidth,
        height: plotHeight,
      }),
    [categories.length, series, plotWidth, plotHeight]
  );
  const [active, setActive] = useState<Active | null>(null);
  const instructionsId = useId();

  const activeColumn = active ? layout.columns[active.index] : undefined;
  const activeCategory = active ? categories[active.index] : undefined;
  const last = categories.length - 1;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = active?.index ?? -1;
    const next = {
      ArrowRight: Math.min(current + 1, last),
      ArrowLeft: Math.max(current - 1, 0),
      Home: 0,
      End: last,
    }[event.key];
    if (event.key === 'Escape') return setActive(null);
    if (next === undefined) return;
    event.preventDefault();
    setActive({ index: next, via: 'keyboard' });
  };

  const onFocus = (event: FocusEvent<HTMLDivElement>) => {
    // Only keyboard focus starts the walk-through; a click should not open a tooltip.
    if (event.target === event.currentTarget && isFocusVisible(event.currentTarget)) {
      setActive((previous) => previous ?? { index: 0, via: 'keyboard' });
    }
  };

  return (
    // A single tab stop that reacts to arrow keys is the established pattern for
    // keyboard-explorable charts (as in Highcharts or Recharts' accessibility layer).
    // biome-ignore lint/a11y/useSemanticElements: no native element fits a chart region
    <div
      ref={containerRef}
      role="group"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: the group handles arrow keys itself
      tabIndex={0}
      aria-label={ariaLabel}
      aria-describedby={instructionsId}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={() => setActive(null)}
      onPointerLeave={() => setActive((a) => (a?.via === 'pointer' ? null : a))}
      className={cn('relative w-full rounded-card outline-offset-4', className)}
    >
      <p id={instructionsId} hidden>
        Use the left and right arrow keys to read each month.
      </p>
      {width > 0 && (
        <svg
          aria-hidden="true"
          width={width}
          height={PLOT_TOP + plotHeight + MONTH_LABEL_OFFSET + 8}
          className="block overflow-visible forced-color-adjust-none"
        >
          <ValueAxis layout={layout} plotWidth={plotWidth} formatValue={formatValue} />
          <g transform={`translate(${PLOT_LEFT} ${PLOT_TOP})`}>
            <Columns
              layout={layout}
              series={series}
              plotHeight={plotHeight}
              activeIndex={active?.index}
              onHover={(index) => setActive({ index, via: 'pointer' })}
              onSeriesActivate={onSeriesActivate}
              isSeriesActivatable={isSeriesActivatable}
            />
          </g>
          <CategoryAxis
            layout={layout}
            categories={categories}
            y={PLOT_TOP + plotHeight + MONTH_LABEL_OFFSET}
          />
        </svg>
      )}
      {activeColumn && activeCategory && (
        <ChartTooltip
          column={activeColumn}
          category={activeCategory}
          series={series}
          formatValue={formatValue}
          containerWidth={width}
        />
      )}
      <p className="sr-only" aria-live="polite">
        {active?.via === 'keyboard' && activeColumn && activeCategory
          ? describeColumn(activeCategory, activeColumn, series, formatValue)
          : ''}
      </p>
    </div>
  );
}

function ValueAxis({
  layout,
  plotWidth,
  formatValue,
}: {
  layout: ChartLayout;
  plotWidth: number;
  formatValue: (value: number) => string;
}) {
  return (
    <g>
      {layout.ticks.map((tick) => (
        <g key={tick.value} transform={`translate(0 ${PLOT_TOP + tick.y})`}>
          <text
            x={AXIS_LABEL_RIGHT}
            textAnchor="end"
            dominantBaseline="middle"
            className="fill-content-secondary text-footnote tabular-nums"
          >
            {formatValue(tick.value)}
          </text>
          <line
            x1={PLOT_LEFT}
            x2={PLOT_LEFT + plotWidth}
            y1={0.5}
            y2={0.5}
            stroke="var(--color-line-dotted)"
            strokeDasharray="1 6"
          />
        </g>
      ))}
    </g>
  );
}

function Columns({
  layout,
  series,
  plotHeight,
  activeIndex,
  onHover,
  onSeriesActivate,
  isSeriesActivatable,
}: {
  layout: ChartLayout;
  series: readonly ChartSeries[];
  plotHeight: number;
  activeIndex: number | undefined;
  onHover: (index: number) => void;
  onSeriesActivate?: (seriesId: string) => void;
  isSeriesActivatable: (seriesId: string) => boolean;
}) {
  const clipId = useId();
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion ? { duration: 0 } : figmaTransition;
  const colorOf = new Map(series.map((s) => [s.id, s.color]));

  return layout.columns.map((column) => {
    const clip = `${clipId}-${column.index}`;
    return (
      <g key={column.index} onPointerMove={() => onHover(column.index)} data-column={column.index}>
        {/* Hover target: the whole band, taller than the bar, so it is easy to hit. */}
        <rect
          x={column.x - (column.step - column.width) / 2}
          width={column.step}
          height={plotHeight}
          fill="transparent"
        />
        {activeIndex === column.index && (
          <rect
            x={column.x - 4}
            width={column.width + 8}
            height={plotHeight}
            rx={4}
            fill="var(--color-hover)"
          />
        )}
        {/* Rounds the top of the whole stack; the bottom radius hides below the baseline. */}
        <clipPath id={clip}>
          <m.rect
            x={column.x}
            width={column.width}
            rx={TOP_RADIUS}
            initial={{ y: plotHeight, height: 0 }}
            animate={{ y: column.top, height: plotHeight - column.top + TOP_RADIUS }}
            transition={transition}
          />
        </clipPath>
        <g clipPath={`url(#${clip})`}>
          {column.segments.map((segment) => {
            const activatable = Boolean(onSeriesActivate) && isSeriesActivatable(segment.seriesId);
            return (
              <m.rect
                key={segment.seriesId}
                data-series={segment.seriesId}
                data-value={segment.value}
                x={column.x}
                width={column.width}
                fill={colorOf.get(segment.seriesId)}
                initial={{ y: plotHeight, height: 0 }}
                animate={{ y: segment.y, height: segment.height }}
                transition={transition}
                className={cn(activatable && 'cursor-pointer')}
                onClick={activatable ? () => onSeriesActivate?.(segment.seriesId) : undefined}
              />
            );
          })}
        </g>
      </g>
    );
  });
}

function CategoryAxis({
  layout,
  categories,
  y,
}: {
  layout: ChartLayout;
  categories: readonly ChartCategory[];
  y: number;
}) {
  const step = layout.columns[0]?.step ?? 0;
  // "Feb 2024" needs ~64px; "Feb" ~30px; below that, label every other month.
  const mode = step >= 64 ? 'full' : step >= 30 ? 'short' : 'sparse';

  return (
    <g>
      {layout.columns.map((column) => {
        const category = categories[column.index];
        if (!category || (mode === 'sparse' && column.index % 2 === 1)) return null;
        return (
          <text
            key={category.key}
            x={PLOT_LEFT + column.x + column.width / 2}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-content-secondary text-footnote"
          >
            {mode === 'full' ? category.label : category.shortLabel}
          </text>
        );
      })}
    </g>
  );
}

function ChartTooltip({
  column,
  category,
  series,
  formatValue,
  containerWidth,
}: {
  column: ColumnLayout;
  category: ChartCategory;
  series: readonly ChartSeries[];
  formatValue: (value: number) => string;
  containerWidth: number;
}) {
  const center = PLOT_LEFT + column.x + column.width / 2;
  // Keep the tooltip inside the chart near either edge.
  const align = center < 120 ? 'start' : center > containerWidth - 120 ? 'end' : 'center';
  const translateX = { start: '-1.5rem', center: '-50%', end: 'calc(-100% + 1.5rem)' }[align];

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute z-20 min-w-44 rounded-card border border-line bg-surface px-3 py-2 text-footnote shadow-[0_4px_16px_rgb(20_20_19/0.08)]"
      style={{
        left: center,
        top: PLOT_TOP + column.top,
        transform: `translate(${translateX}, calc(-100% - 0.5rem))`,
      }}
    >
      <p className="text-content-secondary">{category.label}</p>
      <ul className="mt-1 flex flex-col gap-1">
        {/* Top of the stack first, so the list reads in the order the eye sees it. */}
        {[...series].reverse().map((s) => (
          <li key={s.id} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-0.5 w-3 rounded-full forced-color-adjust-none"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-content-secondary">{s.label}</span>
            <span className="ml-auto pl-3 text-content tabular-nums">
              {formatValue(s.values[column.index] ?? 0)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1 flex justify-between border-t border-line pt-1">
        <span className="text-content-secondary">Total</span>
        <span className="text-content tabular-nums">{formatValue(column.total)}</span>
      </p>
    </div>
  );
}

export function describeColumn(
  category: ChartCategory,
  column: ColumnLayout,
  series: readonly ChartSeries[],
  formatValue: (value: number) => string
): string {
  const parts = series.map((s) => `${s.label} ${formatValue(s.values[column.index] ?? 0)}`);
  return `${category.longLabel}: ${formatValue(column.total)} in total. ${parts.join(', ')}.`;
}

function isFocusVisible(element: Element) {
  try {
    return element.matches(':focus-visible');
  } catch {
    return true; // Environments without :focus-visible support.
  }
}
