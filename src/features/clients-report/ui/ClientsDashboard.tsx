import { useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { parentMap, pathTo } from '@/components/tree-grid/flatten';
import { type ClientsReport, getChildren, getId, indexNodes } from '../model/report';
import { ClientsChartCard } from './ClientsChartCard';
import { ClientsTableCard } from './ClientsTableCard';

/**
 * Owns the two pieces of UI state and how they relate: the table's expanded rows and the
 * chart's scope.
 *
 * - Showing a node in the chart (from the chart itself or from a table row's "Show in
 *   chart") also expands the table down to it, so both views show the same level, and
 *   moves focus to the chart.
 * - Expanding or collapsing table rows leaves the chart alone: exploring the table should
 *   not repaint the chart under the reader's eyes. That is why the row click does not
 *   change the chart and "Show in chart" is a separate, explicit button.
 */
export function ClientsDashboard({ report }: { report: ClientsReport }) {
  const { root, months } = report;
  // One walk of the tree per data change; every lookup below is then O(1).
  const { parents, nodes } = useMemo(
    () => ({ parents: parentMap([root], { getId, getChildren }), nodes: indexNodes(root) }),
    [root]
  );
  // As in the design, the company starts expanded with its branches showing.
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => new Set([root.id]));
  const [scopeId, setScopeId] = useState(root.id);
  const chartRef = useRef<HTMLDivElement | null>(null);

  // A refetch could drop the scoped node; fall back to the root rather than break.
  const scope = nodes.get(scopeId) ?? root;
  const path = pathTo(scope.id, parents).flatMap((id) => nodes.get(id) ?? []);

  const showInChart = (id: string) => {
    // Commit first, so the chart already carries the new scope's name when it gets focus:
    // screen readers announce the name at the focus change and may miss a later rename.
    flushSync(() => {
      setScopeId(id);
      setExpandedIds((current) => new Set([...current, ...pathTo(id, parents)]));
    });
    // Focus also scrolls the chart into view, e.g. from a row far down the table.
    chartRef.current?.focus();
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ClientsChartCard
        scope={scope}
        path={path}
        months={months}
        onScopeChange={showInChart}
        chartRef={chartRef}
      />
      <ClientsTableCard
        root={root}
        months={months}
        expandedIds={expandedIds}
        onExpandedChange={setExpandedIds}
        chartScopeId={scope.id}
        onShowInChart={showInChart}
      />
    </div>
  );
}
