import { clientsResponseSchema } from './clients.schema.ts';

const leaf = (id: string, values = [1, 2, 3]) => ({ id, name: `Node ${id}`, values });

describe('clientsResponseSchema', () => {
  it('accepts a non-uniform tree: children are optional at every level', () => {
    const response = {
      data: {
        ...leaf('company'),
        branches: [
          { ...leaf('b1'), employees: [{ ...leaf('e1'), channels: [leaf('ch1')] }, leaf('e2')] },
          leaf('b2'),
        ],
      },
      meta: { periodStart: '2024-02' },
    };

    expect(clientsResponseSchema.safeParse(response).success).toBe(true);
  });

  it.each([
    ['negative values', { data: leaf('c', [1, -1, 3]), meta: { periodStart: '2024-02' } }],
    ['fractional values', { data: leaf('c', [1, 1.5, 3]), meta: { periodStart: '2024-02' } }],
    ['a malformed period', { data: leaf('c'), meta: { periodStart: '2024-13' } }],
    [
      'children with a different number of months',
      { data: { ...leaf('c'), branches: [leaf('b', [1])] }, meta: { periodStart: '2024-02' } },
    ],
    [
      'duplicate ids',
      {
        data: { ...leaf('c'), branches: [leaf('b'), leaf('b')] },
        meta: { periodStart: '2024-02' },
      },
    ],
  ])('rejects %s', (_, response) => {
    expect(clientsResponseSchema.safeParse(response).success).toBe(false);
  });
});
