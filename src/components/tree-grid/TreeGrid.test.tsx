import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import {
  TreeGrid,
  TreeGridBody,
  TreeGridCell,
  TreeGridColumnHeader,
  TreeGridCornerHeader,
  TreeGridExpandIcon,
  TreeGridHeader,
  TreeGridRow,
  TreeGridRowHeader,
} from './TreeGrid';
import { type UseTreeGridOptions, useTreeGrid } from './use-tree-grid';

interface Node {
  id: string;
  name: string;
  children?: Node[];
}

// Non-uniform like the real data: Branch 2 and James have no children.
const tree: Node[] = [
  {
    id: 'company',
    name: 'Company',
    children: [
      {
        id: 'b1',
        name: 'Branch 1',
        children: [
          { id: 'anna', name: 'Anna', children: [{ id: 'existing', name: 'Existing' }] },
          { id: 'james', name: 'James' },
        ],
      },
      { id: 'b2', name: 'Branch 2' },
    ],
  },
];

const getId = (node: Node) => node.id;
const getChildren = (node: Node) => node.children ?? [];

function Example({
  onRender,
  ...props
}: Partial<UseTreeGridOptions<Node>> & { onRender?: () => void }) {
  const grid = useTreeGrid({ items: tree, getId, getChildren, columnCount: 3, ...props });
  onRender?.();
  return (
    <TreeGrid grid={grid} columns="10rem repeat(2, 4rem)" aria-label="Clients">
      <TreeGridHeader>
        <TreeGridCornerHeader>Name</TreeGridCornerHeader>
        <TreeGridColumnHeader>Jan</TreeGridColumnHeader>
        <TreeGridColumnHeader>Feb</TreeGridColumnHeader>
      </TreeGridHeader>
      <TreeGridBody>
        {grid.rows.map((row) => (
          <TreeGridRow key={row.id} row={row}>
            <TreeGridRowHeader>
              <TreeGridExpandIcon />
              {row.item.name}
            </TreeGridRowHeader>
            <TreeGridCell colIndex={1}>{`${row.item.name} Jan`}</TreeGridCell>
            <TreeGridCell colIndex={2}>{`${row.item.name} Feb`}</TreeGridCell>
          </TreeGridRow>
        ))}
      </TreeGridBody>
    </TreeGrid>
  );
}

const row = (name: string) => screen.getByRole('row', { name: new RegExp(`^${name} `) });
const queryRow = (name: string) => screen.queryByRole('row', { name: new RegExp(`^${name} `) });

describe('TreeGrid structure', () => {
  it('is a labelled treegrid that explains its keyboard model', () => {
    renderWithProviders(<Example />);

    const grid = screen.getByRole('treegrid', { name: 'Clients' });
    expect(grid).toHaveAccessibleDescription(/right arrow expands a row/i);
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Name',
      'Jan',
      'Feb',
    ]);
  });

  it('exposes level, position, set size and expanded state to assistive technology', () => {
    renderWithProviders(<Example defaultExpandedIds={['company', 'b1']} />);

    expect(row('Company')).toHaveAttribute('aria-level', '1');
    expect(row('Company')).toHaveAttribute('aria-expanded', 'true');
    expect(row('Branch 1')).toHaveAttribute('aria-level', '2');
    expect(row('Branch 1')).toHaveAttribute('aria-posinset', '1');
    expect(row('Branch 1')).toHaveAttribute('aria-setsize', '2');
    expect(row('Anna')).toHaveAttribute('aria-expanded', 'false');
    // Leaves are not expandable, so they carry no aria-expanded at all.
    expect(row('James')).not.toHaveAttribute('aria-expanded');
    expect(row('Branch 2')).not.toHaveAttribute('aria-expanded');
    expect(screen.getByRole('rowheader', { name: 'Branch 2' })).toBeInTheDocument();
  });
});

describe('TreeGrid expand and collapse with the mouse', () => {
  it('toggles a row when it is clicked and reveals the level beneath', async () => {
    const { user } = renderWithProviders(<Example />);
    expect(queryRow('Branch 1')).not.toBeInTheDocument();

    await user.click(row('Company'));
    expect(row('Company')).toHaveAttribute('aria-expanded', 'true');
    expect(row('Branch 1')).toBeInTheDocument();
    expect(row('Branch 2')).toBeInTheDocument();

    await user.click(row('Company'));
    expect(row('Company')).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() => expect(queryRow('Branch 1')).not.toBeInTheDocument());
  });

  it('does nothing visible when a leaf row is clicked', async () => {
    const { user } = renderWithProviders(<Example defaultExpandedIds={['company']} />);

    await user.click(row('Branch 2'));
    expect(screen.getAllByRole('row')).toHaveLength(4); // header + 3 body rows
  });
});

describe('TreeGrid keyboard (WAI-ARIA APG treegrid)', () => {
  it('has a single tab stop that lands on the first row', async () => {
    const { user } = renderWithProviders(<Example defaultExpandedIds={['company']} />);

    await user.tab();
    expect(row('Company')).toHaveFocus();
    const tabbable = screen.getByRole('treegrid').querySelectorAll('[tabindex="0"]');
    expect(tabbable).toHaveLength(1);
  });

  it('expands with Right arrow, then moves into the cells', async () => {
    const { user } = renderWithProviders(<Example />);
    await user.tab();

    await user.keyboard('{ArrowRight}');
    expect(row('Company')).toHaveAttribute('aria-expanded', 'true');
    expect(row('Company')).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('rowheader', { name: 'Company' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('gridcell', { name: 'Company Jan' })).toHaveFocus();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(screen.getByRole('gridcell', { name: 'Company Feb' })).toHaveFocus();
  });

  it('moves down and up between rows, keeping the column in cell mode', async () => {
    const { user } = renderWithProviders(<Example defaultExpandedIds={['company']} />);
    await user.tab();

    await user.keyboard('{ArrowDown}');
    expect(row('Branch 1')).toHaveFocus();

    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{ArrowDown}');
    expect(screen.getByRole('gridcell', { name: 'Anna Jan' })).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('gridcell', { name: 'Branch 1 Jan' })).toHaveFocus();
  });

  it('goes to the parent with Left arrow, then collapses it with Left arrow again', async () => {
    const { user } = renderWithProviders(<Example defaultExpandedIds={['company', 'b1']} />);
    await user.tab();
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(row('Anna')).toHaveFocus();

    await user.keyboard('{ArrowLeft}');
    expect(row('Branch 1')).toHaveFocus();
    expect(row('Branch 1')).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard('{ArrowLeft}');
    expect(row('Branch 1')).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() => expect(queryRow('Anna')).not.toBeInTheDocument());
  });

  it('toggles with Enter and Space', async () => {
    const { user } = renderWithProviders(<Example />);
    await user.tab();

    await user.keyboard('{Enter}');
    expect(row('Company')).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard(' ');
    expect(row('Company')).toHaveAttribute('aria-expanded', 'false');
  });

  it('jumps to the first and last row with Home and End', async () => {
    const { user } = renderWithProviders(<Example defaultExpandedIds={['company', 'b1']} />);
    await user.tab();

    await user.keyboard('{End}');
    expect(row('Branch 2')).toHaveFocus();
    await user.keyboard('{Home}');
    expect(row('Company')).toHaveFocus();
  });

  it('moves focus without re-rendering the grid and its rows', async () => {
    const onRender = vi.fn();
    const { user } = renderWithProviders(
      <Example defaultExpandedIds={['company', 'b1']} onRender={onRender} />
    );
    await user.tab();
    const rendersBefore = onRender.mock.calls.length;

    // Branch 1 row → its header cell → its Jan cell → Anna's Jan cell → back up.
    await user.keyboard('{ArrowDown}{ArrowRight}{ArrowRight}{ArrowDown}{ArrowUp}');
    expect(screen.getByRole('gridcell', { name: 'Branch 1 Jan' })).toHaveFocus();
    // Only the elements gaining and losing the tab stop re-render, not the component
    // that renders the rows.
    expect(onRender).toHaveBeenCalledTimes(rendersBefore);
    expect(screen.getByRole('treegrid').querySelectorAll('[tabindex="0"]')).toHaveLength(1);
  });

  it('moves into the cells of a leaf row with Right arrow instead of expanding it', async () => {
    const { user } = renderWithProviders(<Example defaultExpandedIds={['company']} />);
    await user.tab();
    await user.keyboard('{End}{ArrowRight}');

    expect(screen.getByRole('rowheader', { name: 'Branch 2' })).toHaveFocus();
  });
});

describe('TreeGrid controlled state', () => {
  it('reports changes and follows the expanded ids it is given', async () => {
    const onExpandedChange = vi.fn();
    const { user, rerender } = renderWithProviders(
      <Example expandedIds={new Set(['company', 'b1'])} onExpandedChange={onExpandedChange} />
    );

    await user.click(row('Anna'));
    expect(onExpandedChange).toHaveBeenCalledWith(new Set(['company', 'b1', 'anna']));
    // Controlled: nothing changes until the parent passes new ids.
    expect(row('Anna')).toHaveAttribute('aria-expanded', 'false');

    rerender(<Example expandedIds={new Set(['company', 'b1', 'anna'])} />);
    expect(row('Existing')).toBeInTheDocument();
  });

  it('moves focus to the nearest visible ancestor when the focused row is collapsed away', async () => {
    const { user, rerender } = renderWithProviders(
      <Example expandedIds={new Set(['company', 'b1'])} />
    );
    await user.tab();
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(row('Anna')).toHaveFocus();

    rerender(<Example expandedIds={new Set(['company'])} />);
    await waitFor(() => expect(row('Branch 1')).toHaveFocus());
  });
});
