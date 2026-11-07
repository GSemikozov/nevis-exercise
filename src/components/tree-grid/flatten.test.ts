import { flattenVisible } from './flatten';

interface Node {
  id: string;
  children?: Node[];
}

const accessors = { getId: (n: Node) => n.id, getChildren: (n: Node) => n.children ?? [] };

// Non-uniform on purpose: b1 has grandchildren, b2 has no children.
const tree: Node[] = [
  {
    id: 'company',
    children: [
      {
        id: 'b1',
        children: [{ id: 'e1', children: [{ id: 'ch1' }, { id: 'ch2' }] }, { id: 'e2' }],
      },
      { id: 'b2' },
    ],
  },
];

describe('flattenVisible', () => {
  it('shows only roots when nothing is expanded', () => {
    const rows = flattenVisible(tree, accessors, new Set());

    expect(rows.map((r) => r.id)).toEqual(['company']);
    expect(rows[0]).toMatchObject({
      level: 1,
      posInSet: 1,
      setSize: 1,
      hasChildren: true,
      isExpanded: false,
    });
  });

  it('lists expanded descendants depth-first with level, position and set size', () => {
    const rows = flattenVisible(tree, accessors, new Set(['company', 'b1', 'e1']));

    expect(rows.map((r) => [r.id, r.level, r.posInSet, r.setSize])).toEqual([
      ['company', 1, 1, 1],
      ['b1', 2, 1, 2],
      ['e1', 3, 1, 2],
      ['ch1', 4, 1, 2],
      ['ch2', 4, 2, 2],
      ['e2', 3, 2, 2],
      ['b2', 2, 2, 2],
    ]);
  });

  it('hides descendants of a collapsed row even if they are marked expanded', () => {
    const rows = flattenVisible(tree, accessors, new Set(['b1', 'e1']));
    expect(rows.map((r) => r.id)).toEqual(['company']);
  });

  it('never reports a leaf as expanded', () => {
    const rows = flattenVisible(tree, accessors, new Set(['company', 'b2']));
    expect(rows.find((r) => r.id === 'b2')).toMatchObject({
      hasChildren: false,
      isExpanded: false,
    });
  });
});
