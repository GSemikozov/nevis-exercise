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
  TreeGridRowHeader,
} from '@/components/tree-grid/TreeGrid';
import { useTreeGrid } from '@/components/tree-grid/use-tree-grid';
import { Avatar } from '@/components/ui/avatar';
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
}

export function ClientsTableCard({
  root,
  months,
  expandedIds,
  onExpandedChange,
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
              <TreeGridRowHeader>
                <TreeGridExpandIcon />
                {row.item.kind === 'employee' && <Avatar name={row.item.name} />}
                <span className="truncate">{row.item.name}</span>
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
