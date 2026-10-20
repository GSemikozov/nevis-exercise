import { type ChartSeries, computeLayout } from './layout';

// Company by branch, as served by the API (first three months).
const series: ChartSeries[] = [
  { id: 'b1', label: 'Branch 1', values: [147, 157, 166], color: 'violet' },
  { id: 'b2', label: 'Branch 2', values: [76, 80, 84], color: 'peach' },
  { id: 'b3', label: 'Branch 3', values: [27, 30, 34], color: 'maroon' },
];

const HEIGHT = 320;

describe('computeLayout', () => {
  const layout = computeLayout({ categoryCount: 3, series, width: 300, height: HEIGHT });

  it('rounds the value axis up to clean ticks, as the design does (0–400 by 100)', () => {
    const big = computeLayout({
      categoryCount: 1,
      series: [{ id: 'c', label: 'Company', values: [350], color: 'x' }],
      width: 100,
      height: HEIGHT,
    });

    expect(big.max).toBe(400);
    expect(big.ticks.map((t) => t.value)).toEqual([0, 100, 200, 300, 400]);
    expect(big.ticks.map((t) => t.y)).toEqual([320, 240, 160, 80, 0]);
  });

  it('gives every column the sum of its series as its total', () => {
    expect(layout.columns.map((c) => c.total)).toEqual([250, 267, 284]);
  });

  it('stacks segments bottom to top in series order, sized by value', () => {
    const scale = HEIGHT / layout.max; // px per client
    const [first, second, third] = layout.columns[0]?.segments ?? [];

    expect([first?.seriesId, second?.seriesId, third?.seriesId]).toEqual(['b1', 'b2', 'b3']);
    // Bottom segment: full height, sitting on the baseline.
    expect(first?.height).toBeCloseTo(147 * scale);
    expect((first?.y ?? 0) + (first?.height ?? 0)).toBeCloseTo(HEIGHT);
    // Segments above leave a 2px gap below themselves.
    expect(second?.height).toBeCloseTo(76 * scale - 2);
    expect(third?.height).toBeCloseTo(27 * scale - 2);
    // The stack ends exactly at the total.
    expect(third?.y).toBeCloseTo(HEIGHT - 250 * scale);
    expect(layout.columns[0]?.top).toBeCloseTo(HEIGHT - 250 * scale);
  });

  it('keeps the design proportions: 87.5px columns, 24px gaps, 12px edges on 1338px', () => {
    const wide = computeLayout({ categoryCount: 12, series: [], width: 1338, height: HEIGHT });

    expect(wide.columns[0]?.x).toBeCloseTo(12);
    expect(wide.columns[0]?.width).toBeCloseTo(87.5);
    expect(wide.columns[0]?.step).toBeCloseTo(111.5);
    expect(wide.columns[11]?.x).toBeCloseTo(1338 - 12 - 87.5);
  });

  it('skips zero values instead of drawing empty segments', () => {
    const sparse = computeLayout({
      categoryCount: 1,
      series: [
        { id: 'existing', label: 'Existing clients', values: [25], color: 'a' },
        { id: 'organic', label: 'New organic', values: [0], color: 'b' },
        { id: 'paid', label: 'New paid', values: [3], color: 'c' },
      ],
      width: 100,
      height: HEIGHT,
    });

    expect(sparse.columns[0]?.segments.map((s) => s.seriesId)).toEqual(['existing', 'paid']);
  });

  it('still draws an axis when every value is zero', () => {
    const empty = computeLayout({
      categoryCount: 2,
      series: [{ id: 'a', label: 'A', values: [0, 0], color: 'a' }],
      width: 100,
      height: HEIGHT,
    });

    expect(empty.max).toBeGreaterThan(0);
    expect(empty.columns.every((c) => c.segments.length === 0)).toBe(true);
  });
});
