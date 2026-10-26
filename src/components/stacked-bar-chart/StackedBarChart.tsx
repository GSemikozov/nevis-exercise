import { useReducedMotion } from 'motion/react';
import * as m from 'motion/react-m';
import {
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  type Ref,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { cn } from '@/lib/cn';
import { figmaTransition } from '@/lib/motion';
import {
  type ChartLayout,
  type ChartSeries,
  type ColumnLayout,
  columnAt,
  computeLayout,
  placeTooltip,
} from './layout';
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
  /** The focusable chart region, e.g. to return focus to it after a drill-down. */
  ref?: Ref<HTMLDivElement | null>;
}

// Geometry from the design: 26px value labels + 12px gap, 10px above the plot so the
// top tick label is not clipped, 12px + 16px for the month labels below.
const PLOT_LEFT = 38;
const AXIS_LABEL_RIGHT = 26;
const PLOT_TOP = 10;
const MONTH_LABEL_OFFSET = 12 + 8;
const TOP_RADIUS = 4;

/** The month being read, and how it was chosen: a hovering mouse, a touch, or the keys. */
type Active = { index: number; via: 'mouse' | 'touch' | 'keyboard' };

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
  ref,
}: StackedBarChartProps) {
  const [containerRef, measuredWidth] = useElementWidth<HTMLDivElement>();
  useImperativeHandle<HTMLDivElement | null, HTMLDivElement | null>(
    ref,
    () => containerRef.current,
    [containerRef]
  );
  const width = fixedWidth ?? measuredWidth;
  const plotWidth = Math.max(0, width - PLOT_LEFT);
  const svgHeight = PLOT_TOP + plotHeight + MONTH_LABEL_OFFSET + 8;
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
  // The pointer type of the last press, so a click knows whether it came from a finger.
  const lastPointerType = useRef('mouse');

  const activeColumn = active ? layout.columns[active.index] : undefined;
  const activeCategory = active ? categories[active.index] : undefined;
  const last = categories.length - 1;

  /*
   * Pointer input is handled once for the whole chart, from the pointer's x position:
   * per-column targets break on touch, where the browser keeps sending a finger's events
   * to the element it first touched, so dragging across months would not move on.
   */
  const select = (event: PointerEvent<HTMLDivElement>, via: 'mouse' | 'touch') => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const index = columnAt(layout, event.clientX - bounds.left - PLOT_LEFT);
    setActive((current) => {
      if (index === null) return via === 'mouse' && current?.via === 'mouse' ? null : current;
      // Same month: keep the same object, so moving within it does not re-render.
      return current?.index === index && current.via === via ? current : { index, via };
    });
  };

  // A touch selection stays until the user touches somewhere else.
  useEffect(() => {
    if (active?.via !== 'touch') return;
    const dismiss = (event: globalThis.PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setActive(null);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [active?.via, containerRef]);

  // On touch a tap reads the month; drilling stays with the legend buttons, which say so.
  const activateSeries =
    onSeriesActivate &&
    ((seriesId: string) => {
      if (lastPointerType.current === 'mouse') onSeriesActivate(seriesId);
    });

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
      onPointerDown={(event) => {
        lastPointerType.current = event.pointerType;
        if (event.pointerType !== 'mouse') select(event, 'touch');
      }}
      onPointerMove={(event) => {
        if (event.pointerType === 'mouse') select(event, 'mouse');
        else if (event.buttons > 0) select(event, 'touch'); // a finger dragging across months
      }}
      onPointerLeave={(event) => {
        // A finger "leaves" as it lifts; only a mouse moving away closes the tooltip.
        if (event.pointerType === 'mouse') setActive((a) => (a?.via === 'mouse' ? null : a));
      }}
      // The height is reserved before the width is known, so nothing below the chart
      // shifts once it measures itself (no layout shift, no stray row animations).
      style={{ height: svgHeight }}
      className={cn('relative w-full rounded-card outline-offset-4', className)}
    >
      <p id={instructionsId} hidden>
        Use the left and right arrow keys to read each month.
      </p>
      {width > 0 && (
        <svg
          aria-hidden="true"
          width={width}
          height={svgHeight}
          // pan-y: a vertical swipe still scrolls the page, a horizontal one reads months.
          className="block touch-pan-y overflow-visible forced-color-adjust-none"
        >
          <ValueAxis layout={layout} plotWidth={plotWidth} formatValue={formatValue} />
          <g transform={`translate(${PLOT_LEFT} ${PLOT_TOP})`}>
            <Columns
              layout={layout}
              series={series}
              plotHeight={plotHeight}
              activeIndex={active?.index}
              onSeriesActivate={activateSeries}
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
          plotBottom={PLOT_TOP + plotHeight}
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
  onSeriesActivate,
  isSeriesActivatable,
}: {
  layout: ChartLayout;
  series: readonly ChartSeries[];
  plotHeight: number;
  activeIndex: number | undefined;
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
      <g key={column.index} data-column={column.index}>
        {activeIndex === column.index && (
          <rect
            x={column.x - 4}
            width={column.width + 8}
            height={plotHeight}
            rx={4}
            fill="var(--color-hover)"
          />
        )}
        {/*
          Rounds the top of the whole stack; the bottom radius hides below the baseline.
          Marks render at their final geometry (initial={false}) and only changes animate:
          the animation runtime loads lazily, and a chart must never wait for it to show data.
        */}
        <clipPath id={clip}>
          <m.rect
            x={column.x}
            width={column.width}
            rx={TOP_RADIUS}
            initial={false}
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
                initial={false}
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
  plotBottom,
}: {
  column: ColumnLayout;
  category: ChartCategory;
  series: readonly ChartSeries[];
  formatValue: (value: number) => string;
  containerWidth: number;
  plotBottom: number;
}) {
  // Placement needs the tooltip's own size: measure it before paint, then place it.
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const next = { width: element.offsetWidth, height: element.offsetHeight };
    setSize((current) =>
      current?.width === next.width && current.height === next.height ? current : next
    );
  });
  const position =
    size &&
    placeTooltip({
      columnLeft: PLOT_LEFT + column.x,
      columnRight: PLOT_LEFT + column.x + column.width,
      stackTop: PLOT_TOP + column.top,
      bounds: { top: 0, bottom: plotBottom, width: containerWidth },
      width: size.width,
      height: size.height,
    });

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute z-20 w-max rounded-card border border-line bg-surface px-3 py-2 text-footnote shadow-overlay"
      style={{
        left: position?.left ?? 0,
        top: position?.top ?? 0,
        visibility: position ? 'visible' : 'hidden',
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
