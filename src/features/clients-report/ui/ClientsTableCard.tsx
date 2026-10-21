import { ChartColumnStacked } from 'lucide-react';
import { useId, useMemo } from 'react';
import {
  TreeGrid,
  TreeGridBody,
  TreeGridCell,
  TreeGridColumnHeader,
  TreeGridCornerHeader,
  TreeGridExpandIcon,
  TreeGridHeader,
  TreeGridRow,
  TreeGridRowAction,
  TreeGridRowHeader,
} from '@/components/tree-grid/TreeGrid';
import { useTreeGrid } from '@/components/tree-grid/use-tree-grid';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/cn';
import { formatCount } from '@/lib/format';
import { getChildren, getId, type Month, type ReportNode } from '../model/report';

/*
 * Design: a 264px name column and 76px month columns at 1440px. The name column takes the
 * leftover space and the months shrink to 56px before the card scrolls sideways (with the
 * name column pinned).
 */
const COLUMNS = 'minmax(15rem, 1fr) repeat(12, minmax(3.5rem, 4.75rem))';

interface ClientsTableCardProps {
  root: ReportNode;
  months: readonly Month[];
  expandedIds: ReadonlySet<string>;
  onExpandedChange: (expandedIds: ReadonlySet<string>) => void;
  /** The node the chart currently shows; its row's button is marked as pressed. */
  chartScopeId: string;
  onShowInChart: (id: string) => void;
}

export function ClientsTableCard({
  root,
  months,
  expandedIds,
  onExpandedChange,
  chartScopeId,
  onShowInChart,
}: ClientsTableCardProps) {
  const headingId = useId();
  const items = useMemo(() => [root], [root]);
  const grid = useTreeGrid({
    items,
    getId,
    getChildren,
    columnCount: months.length + 1,
    expandedIds,
    onExpandedChange,
  });

  return (
    <section
      aria-labelledby={headingId}
      // scroll-padding keeps a focused cell clear of the pinned name column.
      className="min-w-0 overflow-x-auto rounded-card bg-surface scroll-pl-60"
    >
      <h2 id={headingId} className="sr-only">
        Clients per month by branch, advisor and acquisition channel
      </h2>
      <TreeGrid grid={grid} columns={COLUMNS} aria-labelledby={headingId}>
        <TreeGridHeader>
          <TreeGridCornerHeader>
            <span className="sr-only">Name</span>
          </TreeGridCornerHeader>
          {months.map((month) => (
            <TreeGridColumnHeader key={month.key} className="text-right">
              {month.label}
            </TreeGridColumnHeader>
          ))}
        </TreeGridHeader>
        <TreeGridBody>
          {grid.rows.map((row) => (
            <TreeGridRow key={row.id} row={row}>
              {/* Named after the visible name only, so the button's label stays out of the
                  row's and the cell's names ("Branch 1 147 …", not "Branch 1 Show …"). */}
              <TreeGridRowHeader aria-label={row.item.name}>
                <TreeGridExpandIcon />
                {row.item.kind === 'employee' && <Avatar name={row.item.name} />}
                <span className="truncate">{row.item.name}</span>
                {row.hasChildren && (
                  <ShowInChartButton
                    name={row.item.name}
                    isShown={row.id === chartScopeId}
                    onShow={() => onShowInChart(row.id)}
                  />
                )}
              </TreeGridRowHeader>
              {row.item.values.map((value, index) => (
                <TreeGridCell
                  key={months[index]?.key ?? index}
                  colIndex={index + 1}
                  className="text-right tabular-nums"
                >
                  {formatCount(value)}
                </TreeGridCell>
              ))}
            </TreeGridRow>
          ))}
        </TreeGridBody>
      </TreeGrid>
    </section>
  );
}

/**
 * Opens a row's breakdown in the chart. Only rows with a level beneath have one (as in
 * the chart's own drill-down). It appears on hover and focus so it does not clutter the
 * table, and is always visible on touch screens (no hover) and on the row the chart
 * currently shows, marked as pressed.
 */
function ShowInChartButton({
  name,
  isShown,
  onShow,
}: {
  name: string;
  isShown: boolean;
  onShow: () => void;
}) {
  const label = `Show ${name} in chart`;
  return (
    <TreeGridRowAction
      aria-label={label}
      aria-pressed={isShown}
      title={label}
      onClick={onShow}
      className={cn(
        'ml-auto grid size-6 place-items-center text-content-secondary hover:bg-hover hover:text-content',
        'transition-opacity duration-300 ease-figma motion-reduce:transition-none',
        isShown
          ? 'text-content opacity-100'
          : 'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100'
      )}
    >
      <ChartColumnStacked aria-hidden="true" strokeWidth={1.5} className="size-4" />
    </TreeGridRowAction>
  );
}
