import { childrenOf, companySchema } from '../../shared/clients.schema.ts';
import company from './clients.json' with { type: 'json' };

/*
 * The brief's payload had totals that did not add up (Company in May, Branch 1 in
 * August, Anna Blackwood's channels in May–September). The mock was corrected — see the
 * README — and this test keeps it consistent: every parent equals the sum of its children.
 */
describe('mock client data', () => {
  const root = companySchema.parse(company);

  function* parents(node: typeof root | ReturnType<typeof childrenOf>[number]): Generator<{
    name: string;
    values: number[];
    childSums: number[];
  }> {
    const children = childrenOf(node);
    if (children.length > 0) {
      const childSums = node.values.map((_, month) =>
        children.reduce((sum, child) => sum + (child.values[month] ?? 0), 0)
      );
      yield { name: node.name, values: node.values, childSums };
    }
    for (const child of children) yield* parents(child);
  }

  it.each([...parents(root)].map((p) => [p.name, p] as const))(
    '%s equals the sum of its children in every month',
    (_, parent) => {
      expect(parent.childSums).toEqual(parent.values);
    }
  );
});
