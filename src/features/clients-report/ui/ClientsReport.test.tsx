import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { apiServer, setupMockApi } from '@/test/api-mock';
import { renderWithProviders } from '@/test/render';
import { ClientsReport } from './ClientsReport';

setupMockApi();

beforeEach(() => {
  // jsdom has no layout; give the chart the width it has at 1440px.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 1376,
    height: 358,
    top: 0,
    left: 0,
    right: 1376,
    bottom: 358,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
});

afterEach(() => vi.restoreAllMocks());

const row = (name: string) => screen.getByRole('row', { name: new RegExp(`^${name} `) });
const queryRow = (name: string) => screen.queryByRole('row', { name: new RegExp(`^${name} `) });
const chart = () => screen.getByRole('group', { name: /^Clients per month for/ });

async function renderLoaded() {
  const result = renderWithProviders(<ClientsReport />);
  await screen.findByRole('treegrid');
  return result;
}

describe('ClientsReport', () => {
  it('shows a loading state, then the company with its branches', async () => {
    renderWithProviders(<ClientsReport />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading client data');

    expect(await screen.findByRole('treegrid')).toBeInTheDocument();
    expect(row('Company')).toHaveAttribute('aria-expanded', 'true');
    expect(row('Branch 1')).toHaveAttribute('aria-expanded', 'false');
    // Branch 2 and 3 have no employees, so they cannot be expanded.
    expect(row('Branch 2')).not.toHaveAttribute('aria-expanded');
    expect(chart()).toHaveAccessibleName(
      'Clients per month for Company, by branch, Feb 2024 to Jan 2025'
    );
  });

  it('maps each branch into the chart as a stacked series', async () => {
    const { container } = await renderLoaded();
    const firstMonth = container.querySelector('[data-column="0"]');
    if (!firstMonth) throw new Error('chart not drawn');

    const segments = [...firstMonth.querySelectorAll('[data-series]')].map((s) =>
      Number(s.getAttribute('data-value'))
    );
    expect(segments).toEqual([147, 76, 27]);
    expect(container.querySelectorAll('[data-column]')).toHaveLength(12);
  });

  it('expands and collapses rows to reveal the level beneath, down to the channels', async () => {
    const { user } = await renderLoaded();

    await user.click(row('Branch 1'));
    expect(row('Anna Blackwood')).toHaveAttribute('aria-level', '3');
    expect(row('James Walker')).not.toHaveAttribute('aria-expanded');

    await user.click(row('Anna Blackwood'));
    expect(row('New paid')).toHaveAttribute('aria-level', '4');

    await user.click(row('Branch 1'));
    await waitFor(() => expect(queryRow('Anna Blackwood')).not.toBeInTheDocument());
    expect(queryRow('New paid')).not.toBeInTheDocument();
  });

  it('expands and collapses from the keyboard', async () => {
    const { user } = await renderLoaded();
    row('Branch 1').focus();

    await user.keyboard('{ArrowRight}');
    expect(row('Branch 1')).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(row('Anna Blackwood')).toHaveAttribute('aria-expanded', 'true');
    expect(row('Existing clients')).toBeInTheDocument();

    await user.keyboard('{ArrowLeft}');
    expect(row('Anna Blackwood')).toHaveAttribute('aria-expanded', 'false');
  });

  it('drills the chart from the legend, keeps the table in step, and comes back', async () => {
    const { user } = await renderLoaded();

    await user.click(screen.getByRole('button', { name: 'Branch 1, show breakdown' }));
    expect(chart()).toHaveAccessibleName(
      'Clients per month for Branch 1, by advisor, Feb 2024 to Jan 2025'
    );
    expect(chart()).toHaveFocus();
    const scope = screen.getByRole('navigation', { name: 'Chart scope' });
    expect(within(scope).getByText('Branch 1')).toHaveAttribute('aria-current', 'location');
    // The table expanded to the same level.
    expect(row('Branch 1')).toHaveAttribute('aria-expanded', 'true');
    expect(row('Anna Blackwood')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Anna Blackwood, show breakdown' }));
    expect(chart()).toHaveAccessibleName(
      'Clients per month for Anna Blackwood, by acquisition channel, Feb 2024 to Jan 2025'
    );
    expect(screen.getByText('New organic', { selector: 'li span' })).toBeInTheDocument();

    await user.click(within(scope).getByRole('button', { name: 'Company' }));
    expect(chart()).toHaveAccessibleName(
      'Clients per month for Company, by branch, Feb 2024 to Jan 2025'
    );
  });

  it('explains a failed request and recovers on retry', async () => {
    apiServer.use(
      http.get('*/api/clients', () =>
        HttpResponse.json({ title: 'Not Found', status: 404 }, { status: 404 })
      )
    );
    const { user } = renderWithProviders(<ClientsReport />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('We couldn’t load the client data');
    expect(alert).toHaveTextContent('404: Not Found');

    apiServer.resetHandlers();
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('treegrid')).toBeInTheDocument();
  });

  it('treats a response that breaks the contract as an error', async () => {
    apiServer.use(http.get('*/api/clients', () => HttpResponse.json({ data: { id: 'x' } })));
    renderWithProviders(<ClientsReport />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The server sent data in a format this page does not understand.'
    );
  });
});
