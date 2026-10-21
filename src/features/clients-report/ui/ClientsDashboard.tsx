import { useMemo, useState } from 'react';
import { parentMap, pathTo } from '@/components/tree-grid/flatten';
import { type ClientsReport, getChildren, getId, indexNodes } from '../model/report';
import { ClientsChartCard } from './ClientsChartCard';
import { ClientsTableCard } from './ClientsTableCard';

/**
 * Owns the two pieces of UI state and how they relate: the table's expanded rows and the
 * chart's scope. Drilling the chart into a node also expands the table down to it, so both
 * views show the same level; expanding table rows leaves the chart alone (exploring the
 * table should not repaint the chart under the reader's eyes).
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

  // A refetch could drop the scoped node; fall back to the root rather than break.
  const scope = nodes.get(scopeId) ?? root;
  const path = pathTo(scope.id, parents).flatMap((id) => nodes.get(id) ?? []);

  const changeScope = (id: string) => {
    setScopeId(id);
    setExpandedIds((current) => new Set([...current, ...pathTo(id, parents)]));
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ClientsChartCard scope={scope} path={path} months={months} onScopeChange={changeScope} />
      <ClientsTableCard
        root={root}
        months={months}
        expandedIds={expandedIds}
        onExpandedChange={setExpandedIds}
      />
    </div>
  );
}
