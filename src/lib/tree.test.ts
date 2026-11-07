import { indexById, parentMap, pathTo } from './tree';

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

describe('indexById', () => {
  it('finds every node by id, at any depth', () => {
    const nodes = indexById(tree, accessors);

    expect(nodes.size).toBe(7);
    expect(nodes.get('ch2')).toEqual({ id: 'ch2' });
    expect(nodes.get('missing')).toBeUndefined();
  });
});

describe('parentMap / pathTo', () => {
  const parents = parentMap(tree, accessors);

  it('maps every node to its parent', () => {
    expect(parents.get('company')).toBeNull();
    expect(parents.get('ch2')).toBe('e1');
  });

  it('returns the path from the root', () => {
    expect(pathTo('ch2', parents)).toEqual(['company', 'b1', 'e1', 'ch2']);
    expect(pathTo('unknown', parents)).toEqual([]);
  });
});
