import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { ChartSeries } from './layout';

interface ChartLegendProps {
  series: readonly ChartSeries[];
  /** Makes an entry a button, e.g. to drill into that series. */
  onActivate?: (seriesId: string) => void;
  isActivatable?: (seriesId: string) => boolean;
  /** Screen-reader suffix for activatable entries, e.g. "show breakdown". */
  activateHint?: string;
  className?: string;
}

/**
 * Series key. Always shown for two or more series, so identity never relies on colour
 * matching alone. Entries that can be activated are real buttons: the keyboard path
 * to everything a click on a chart segment does.
 */
export function ChartLegend({
  series,
  onActivate,
  isActivatable = () => false,
  activateHint = 'show breakdown',
  className,
}: ChartLegendProps) {
  return (
    <ul
      className={cn(
        'flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-footnote text-content-secondary',
        className
      )}
    >
      {series.map((s) => {
        const swatch = (
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-[2px] forced-color-adjust-none"
            style={{ backgroundColor: s.color }}
          />
        );
        return (
          <li key={s.id}>
            {onActivate && isActivatable(s.id) ? (
              <button
                type="button"
                onClick={() => onActivate(s.id)}
                className="inline-flex min-h-6 items-center gap-1 rounded-sm underline-offset-4 transition-colors duration-300 ease-figma hover:text-content hover:underline motion-reduce:transition-none"
              >
                {swatch}
                {s.label}
                <span className="sr-only">, {activateHint}</span>
                <ChevronRight aria-hidden="true" strokeWidth={1.5} className="size-3" />
              </button>
            ) : (
              <span className="inline-flex min-h-6 items-center gap-1">
                {swatch}
                {s.label}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
