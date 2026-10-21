import type { ClientsResponse } from '@shared/clients.schema';
import clients from '../../../../server/data/clients.json';
import { chartSeriesFor } from './chart-series';
import { indexNodes, type ReportNode, toReport } from './report';

const response: ClientsResponse = { data: clients, meta: { periodStart: '2024-02' } };
const report = toReport(response);
const node = (name: string) => {
  const found = [...walk(report.root)].find((n) => n.name === name);
  if (!found) throw new Error(`No node named ${name}`);
  return found;
};

function* walk(n: ReportNode): Generator<ReportNode> {
  yield n;
  for (const child of n.children) yield* walk(child);
}

describe('toReport', () => {
  it('turns the period into twelve labelled months', () => {
    expect(report.months).toHaveLength(12);
    expect(report.months[0]).toEqual({
      key: '2024-02',
      label: 'Feb 2024',
      shortLabel: 'Feb',
      longLabel: 'February 2024',
    });
    expect(report.months[11]?.label).toBe('Jan 2025');
  });

  it('normalises the non-uniform tree into one node shape', () => {
    expect(report.root).toMatchObject({ name: 'Company', kind: 'company' });
    expect(report.root.children.map((b) => [b.name, b.kind, b.children.length])).toEqual([
      ['Branch 1', 'branch', 5],
      ['Branch 2', 'branch', 0],
      ['Branch 3', 'branch', 0],
    ]);
    expect(node('Anna Blackwood').children.map((c) => [c.name, c.kind])).toEqual([
      ['Existing clients', 'channel'],
      ['New organic', 'channel'],
      ['New paid', 'channel'],
    ]);
    expect(node('James Walker').children).toEqual([]);
  });

  it('indexes every node by id', () => {
    const nodes = indexNodes(report.root);
    const anna = node('Anna Blackwood');

    expect(nodes.size).toBe(12);
    expect(nodes.get(anna.id)).toBe(anna);
    expect(nodes.get('missing')).toBeUndefined();
  });
});

describe('chartSeriesFor: how the data maps into the chart', () => {
  it('splits the company by branch, in data order and slot colours', () => {
    const { series, drillableIds } = chartSeriesFor(report.root);

    expect(series.map((s) => [s.label, s.color, s.values[0]])).toEqual([
      ['Branch 1', 'var(--color-chart-1)', 147],
      ['Branch 2', 'var(--color-chart-2)', 76],
      ['Branch 3', 'var(--color-chart-3)', 27],
    ]);
    // Only Branch 1 has a level beneath it.
    expect([...drillableIds]).toEqual([node('Branch 1').id]);
  });

  it('stacks to exactly the scope totals every month', () => {
    for (const scope of [report.root, node('Branch 1'), node('Anna Blackwood')]) {
      const { series } = chartSeriesFor(scope);
      const stacked = scope.values.map((_, m) =>
        series.reduce((sum, s) => sum + (s.values[m] ?? 0), 0)
      );
      expect(stacked).toEqual(scope.values);
    }
  });

  it("shows Anna Blackwood's acquisition channels, as the design's legend does", () => {
    const { series, drillableIds } = chartSeriesFor(node('Anna Blackwood'));

    expect(series.map((s) => [s.label, s.color])).toEqual([
      ['Existing clients', 'var(--color-chart-1)'],
      ['New organic', 'var(--color-chart-2)'],
      ['New paid', 'var(--color-chart-3)'],
    ]);
    expect(drillableIds.size).toBe(0);
  });

  it('shows a node without children as a single series of its own values', () => {
    const james = node('James Walker');
    expect(chartSeriesFor(james).series).toEqual([
      { id: james.id, label: 'James Walker', values: james.values, color: 'var(--color-chart-1)' },
    ]);
  });

  it('shows clients not assigned to any child as "Other"', () => {
    const scope: ReportNode = {
      id: 'b',
      name: 'Branch',
      kind: 'branch',
      values: [10, 10],
      children: [{ id: 'e', name: 'Employee', kind: 'employee', values: [6, 10], children: [] }],
    };

    expect(chartSeriesFor(scope).series.at(-1)).toMatchObject({ label: 'Other', values: [4, 0] });
  });

  it('folds children beyond the fifth colour into "Other"', () => {
    const children = Array.from({ length: 7 }, (_, i) => ({
      id: `e${i}`,
      name: `Employee ${i}`,
      kind: 'employee' as const,
      values: [1],
      children: [],
    }));
    const scope: ReportNode = { id: 'b', name: 'Branch', kind: 'branch', values: [7], children };
    const { series } = chartSeriesFor(scope);

    expect(series.map((s) => s.label)).toEqual([
      'Employee 0',
      'Employee 1',
      'Employee 2',
      'Employee 3',
      'Other',
    ]);
    expect(series.at(-1)?.values).toEqual([3]);
  });
});
