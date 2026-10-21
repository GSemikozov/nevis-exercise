import type { Branch, ClientsResponse, Company, Employee } from '@shared/clients.schema';
import { formatMonth, formatMonthLong, formatMonthShort, monthsFrom } from '@/lib/format';

export type NodeKind = 'company' | 'branch' | 'employee' | 'channel';

/**
 * One node of the report, whatever its level. The API names children differently per
 * level (branches / employees / channels) and leaves them out when there are none; the
 * UI only ever sees this uniform shape.
 */
export interface ReportNode {
  id: string;
  name: string;
  kind: NodeKind;
  values: readonly number[];
  children: readonly ReportNode[];
}

export interface Month {
  key: string;
  label: string;
  shortLabel: string;
  longLabel: string;
}

export interface ClientsReport {
  root: ReportNode;
  months: Month[];
}

export function toReport({ data, meta }: ClientsResponse): ClientsReport {
  const months = monthsFrom(meta.periodStart, data.values.length).map((date) => ({
    key: date.toISOString().slice(0, 7),
    label: formatMonth(date),
    shortLabel: formatMonthShort(date),
    longLabel: formatMonthLong(date),
  }));
  return { root: fromCompany(data), months };
}

function fromCompany(company: Company): ReportNode {
  return node(company, 'company', (company.branches ?? []).map(fromBranch));
}

function fromBranch(branch: Branch): ReportNode {
  return node(branch, 'branch', (branch.employees ?? []).map(fromEmployee));
}

function fromEmployee(employee: Employee): ReportNode {
  const channels = (employee.channels ?? []).map((channel) => node(channel, 'channel', []));
  return node(employee, 'employee', channels);
}

function node(
  { id, name, values }: { id: string; name: string; values: number[] },
  kind: NodeKind,
  children: ReportNode[]
): ReportNode {
  return { id, name, kind, values, children };
}

/** How the level below a node is called in the UI ("Company by branch"). */
export const childLevelLabel: Record<NodeKind, string> = {
  company: 'branch',
  branch: 'advisor',
  employee: 'acquisition channel',
  channel: 'channel',
};

export const getId = (node: ReportNode) => node.id;
export const getChildren = (node: ReportNode) => node.children;

/** Every node of the tree by id, built in one walk. */
export function indexNodes(root: ReportNode): Map<string, ReportNode> {
  const nodes = new Map<string, ReportNode>();
  const visit = (node: ReportNode) => {
    nodes.set(node.id, node);
    node.children.forEach(visit);
  };
  visit(root);
  return nodes;
}
