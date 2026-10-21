import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { ChartLegend } from './ChartLegend';
import type { ChartSeries } from './layout';
import { type ChartCategory, StackedBarChart } from './StackedBarChart';

const categories: ChartCategory[] = [
  { key: '2024-02', label: 'Feb 2024', shortLabel: 'Feb', longLabel: 'February 2024' },
  { key: '2024-03', label: 'Mar 2024', shortLabel: 'Mar', longLabel: 'March 2024' },
  { key: '2024-04', label: 'Apr 2024', shortLabel: 'Apr', longLabel: 'April 2024' },
];

const series: ChartSeries[] = [
  { id: 'b1', label: 'Branch 1', values: [147, 157, 166], color: 'var(--color-chart-1)' },
  { id: 'b2', label: 'Branch 2', values: [76, 80, 84], color: 'var(--color-chart-2)' },
  { id: 'b3', label: 'Branch 3', values: [0, 30, 34], color: 'var(--color-chart-3)' },
];

function renderChart(props: Partial<Parameters<typeof StackedBarChart>[0]> = {}) {
  return renderWithProviders(
    <StackedBarChart
      aria-label="Clients per month by branch"
      categories={categories}
      series={series}
      width={1000}
      {...props}
    />
  );
}

const columns = (container: HTMLElement) => [...container.querySelectorAll('[data-column]')];
const group = () => screen.getByRole('group', { name: 'Clients per month by branch' });

/** Page x of a column's centre. jsdom has no layout, so the chart's left edge is 0. */
function columnCentre(container: HTMLElement, index: number) {
  const bar = container.querySelector(`[data-column="${index}"] [data-series]`);
  const x = Number(bar?.getAttribute('x'));
  const width = Number(bar?.getAttribute('width'));
  return 38 + x + width / 2; // 38px: the value axis left of the plot
}

const queryTooltip = () =>
  screen.queryByText(/^\w{3} 2024$/, { selector: 'p' })?.parentElement ?? null;
const tooltipFor = (month: string) => screen.getByText(month, { selector: 'p' }).parentElement;
const segments = (column: Element) =>
  [...column.querySelectorAll('[data-series]')].map((s) => [
    s.getAttribute('data-series'),
    Number(s.getAttribute('data-value')),
  ]);

describe('StackedBarChart: data to marks', () => {
  it('draws one column per category with one segment per non-zero value, bottom to top', () => {
    const { container } = renderChart();

    expect(columns(container)).toHaveLength(3);
    expect(columns(container).map(segments)).toEqual([
      [
        ['b1', 147],
        ['b2', 76],
      ],
      [
        ['b1', 157],
        ['b2', 80],
        ['b3', 30],
      ],
      [
        ['b1', 166],
        ['b2', 84],
        ['b3', 34],
      ],
    ]);
  });

  it('colours each segment with its series colour', () => {
    const { container } = renderChart();
    const first = container.querySelector('[data-column="0"] [data-series="b2"]');
    expect(first).toHaveAttribute('fill', 'var(--color-chart-2)');
  });

  it('labels the value axis with clean ticks and the category axis with months', () => {
    const { container } = renderChart();
    const text = [...container.querySelectorAll('text')].map((t) => t.textContent);

    expect(text).toEqual(
      expect.arrayContaining(['0', '100', '200', '300', 'Feb 2024', 'Mar 2024', 'Apr 2024'])
    );
  });

  it('switches to short month labels when columns get narrow', () => {
    const { container } = renderChart({ width: 160 });
    const text = [...container.querySelectorAll('text')].map((t) => t.textContent);

    expect(text).toEqual(expect.arrayContaining(['Feb', 'Mar', 'Apr']));
    expect(text).not.toContain('Feb 2024');
  });
});

describe('StackedBarChart: reading values', () => {
  it('hides the drawing from assistive technology and names the interactive region', () => {
    const { container } = renderChart();

    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(
      screen.getByRole('group', { name: 'Clients per month by branch' })
    ).toHaveAccessibleDescription(/arrow keys/);
  });

  it('lets keyboard users step through months and hear each one', async () => {
    const { user } = renderChart();
    await user.tab();
    expect(screen.getByRole('group', { name: /clients per month/i })).toHaveFocus();
    // Keyboard focus starts on the first month.
    expect(screen.getByText(/^February 2024: 223 in total\./)).toHaveTextContent(
      'February 2024: 223 in total. Branch 1 147, Branch 2 76, Branch 3 0.'
    );

    await user.keyboard('{ArrowRight}');
    expect(screen.getByText(/^March 2024: 267 in total\./)).toBeInTheDocument();

    await user.keyboard('{End}');
    expect(screen.getByText(/^April 2024: 284 in total\./)).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByText(/in total\./)).not.toBeInTheDocument();
  });

  it('shows a tooltip with every series and the total on hover', () => {
    const { container } = renderChart();

    fireEvent.pointerMove(group(), { pointerType: 'mouse', clientX: columnCentre(container, 1) });
    const tooltip = tooltipFor('Mar 2024');
    expect(tooltip).toHaveTextContent('Branch 3' + '30');
    expect(tooltip).toHaveTextContent('Total' + '267');

    fireEvent.pointerLeave(group(), { pointerType: 'mouse' });
    expect(queryTooltip()).not.toBeInTheDocument();
  });
});

describe('StackedBarChart on touch screens', () => {
  it('reads a month on tap instead of drilling, and keeps it after the finger lifts', () => {
    const onSeriesActivate = vi.fn();
    const { container } = renderChart({ onSeriesActivate, isSeriesActivatable: () => true });
    const segment = container.querySelector('[data-column="0"] [data-series="b1"]');
    if (!segment) throw new Error('segment not rendered');

    fireEvent.pointerDown(group(), { pointerType: 'touch', clientX: columnCentre(container, 0) });
    fireEvent.pointerLeave(group(), { pointerType: 'touch' });
    fireEvent.click(segment);

    expect(tooltipFor('Feb 2024')).toBeInTheDocument();
    expect(onSeriesActivate).not.toHaveBeenCalled();
  });

  it('follows a finger dragged across months', () => {
    const { container } = renderChart();

    fireEvent.pointerDown(group(), { pointerType: 'touch', clientX: columnCentre(container, 0) });
    fireEvent.pointerMove(group(), {
      pointerType: 'touch',
      buttons: 1,
      clientX: columnCentre(container, 2),
    });

    expect(tooltipFor('Apr 2024')).toBeInTheDocument();
  });

  it('closes when the user touches outside the chart', () => {
    const { container } = renderChart();
    fireEvent.pointerDown(group(), { pointerType: 'touch', clientX: columnCentre(container, 1) });
    expect(tooltipFor('Mar 2024')).toBeInTheDocument();

    fireEvent.pointerDown(document.body, { pointerType: 'touch' });
    expect(queryTooltip()).not.toBeInTheDocument();
  });
});

describe('Drill-down', () => {
  it('activates a series from a click on its segment', () => {
    const onSeriesActivate = vi.fn();
    const { container } = renderChart({
      onSeriesActivate,
      isSeriesActivatable: (id) => id === 'b1',
    });

    const b1 = container.querySelector('[data-column="0"] [data-series="b1"]');
    const b2 = container.querySelector('[data-column="0"] [data-series="b2"]');
    if (!b1 || !b2) throw new Error('segments not rendered');
    fireEvent.click(b2);
    fireEvent.click(b1);

    expect(onSeriesActivate).toHaveBeenCalledTimes(1);
    expect(onSeriesActivate).toHaveBeenCalledWith('b1');
  });

  it('offers the same action as a legend button, and plain text for the rest', async () => {
    const onActivate = vi.fn();
    const { user } = renderWithProviders(
      <ChartLegend series={series} onActivate={onActivate} isActivatable={(id) => id === 'b1'} />
    );

    await user.click(screen.getByRole('button', { name: 'Branch 1, show breakdown' }));
    expect(onActivate).toHaveBeenCalledWith('b1');
    expect(screen.queryByRole('button', { name: /Branch 2/ })).not.toBeInTheDocument();
    expect(screen.getByText('Branch 2')).toBeInTheDocument();
  });
});
