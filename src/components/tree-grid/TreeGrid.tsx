import { ChevronRight } from 'lucide-react';
import { AnimatePresence, useIsPresent, useReducedMotion } from 'motion/react';
import * as m from 'motion/react-m';
import {
  type ComponentProps,
  type CSSProperties,
  createContext,
  type ReactNode,
  use,
  useId,
  useSyncExternalStore,
} from 'react';
import { cn } from '@/lib/cn';
import { figmaTransition } from '@/lib/motion';
import type { TreeGridRowModel } from './flatten';
import { ROW_FOCUS, type TreeGridApi, useTabIndex } from './use-tree-grid';

/*
 * Presentational treegrid built on useTreeGrid. Markup is div-based with ARIA roles
 * rather than <table>: rows open and close by animating their height, which table rows
 * cannot do (a <tr> ignores a height below its content and cannot clip it). Every row
 * lays out its cells with the same `columns` template, so columns line up without a
 * shared table layout.
 *
 * Needs a motion LazyMotion provider above it.
 */

// biome-ignore lint/suspicious/noExplicitAny: the context is shared by grids of any item type
const GridContext = createContext<TreeGridApi<any> | null>(null);
const RowContext = createContext<TreeGridRowModel<unknown> | null>(null);

function useGrid() {
  const grid = use(GridContext);
  if (!grid) throw new Error('TreeGrid parts must be rendered inside <TreeGrid>');
  return grid;
}

function useRow() {
  const row = use(RowContext);
  if (!row) throw new Error('This TreeGrid part must be rendered inside <TreeGridRow>');
  return row;
}

/** Figma's row height: 56px at the default font size. Body rows animate to it. */
const ROW_HEIGHT = '3.5rem';
const rowLayout = 'grid grid-cols-(--tree-grid-columns) items-center gap-x-4 pr-6';
const rowHeaderLayout = 'sticky left-0 z-10 flex h-full items-center gap-2 bg-inherit pl-4';

type LabelProps = { 'aria-label': string } | { 'aria-labelledby': string };

type TreeGridProps<T> = Omit<ComponentProps<'div'>, 'role'> &
  LabelProps & {
    grid: TreeGridApi<T>;
    /** CSS `grid-template-columns` shared by every row, e.g. `14rem repeat(12, 5rem)`. */
    columns: string;
    /** Indentation per level of depth. */
    indent?: string;
    /** Keyboard help read by screen readers when the grid gets focus. */
    instructions?: string;
  };

export function TreeGrid<T>({
  grid,
  columns,
  indent = '1.75rem',
  instructions = 'Use the arrow keys to move between rows and cells. Right arrow expands a row, left arrow collapses it.',
  className,
  style,
  children,
  ...props
}: TreeGridProps<T>) {
  const instructionsId = useId();
  const gridStyle = {
    ...style,
    '--tree-grid-columns': columns,
    '--tree-grid-indent': indent,
  } as CSSProperties;

  return (
    <GridContext value={grid}>
      <p id={instructionsId} hidden>
        {instructions}
      </p>
      <div
        {...grid.getGridProps()}
        aria-describedby={instructionsId}
        // At least the sum of the columns' minimums, never the widest visible row: with
        // max-content, opening a row with longer content widened the columns and shifted
        // every cell. Below this width the container scrolls sideways.
        className={cn('w-full min-w-min', className)}
        style={gridStyle}
        {...props}
      >
        {children}
      </div>
    </GridContext>
  );
}

/*
 * Biome asks for native table elements below. They are avoided on purpose (see the top
 * of the file), and the header row stays out of the focus order: screen readers announce
 * column headers when moving between cells, so focusing them adds stops without adding
 * information.
 */

export function TreeGridHeader({ className, children, ...props }: ComponentProps<'div'>) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: div rows are needed for row animations
    <div role="rowgroup" {...props}>
      {/* biome-ignore lint/a11y/useSemanticElements: div rows are needed for row animations */}
      {/* biome-ignore lint/a11y/useFocusableInteractive: header row is not a focus stop */}
      <div
        role="row"
        className={cn(rowLayout, 'border-b border-line bg-surface', className)}
        style={{ height: ROW_HEIGHT }}
      >
        {children}
      </div>
    </div>
  );
}

export function TreeGridColumnHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: div rows are needed for row animations
    // biome-ignore lint/a11y/useFocusableInteractive: column headers are not focus stops
    <div role="columnheader" className={cn('text-content-secondary', className)} {...props} />
  );
}

/** The first column header; sticks to the left edge like the row headers below it. */
export function TreeGridCornerHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: div rows are needed for row animations
    // biome-ignore lint/a11y/useFocusableInteractive: column headers are not focus stops
    <div
      role="columnheader"
      className={cn(rowHeaderLayout, 'text-content-secondary', className)}
      {...props}
    />
  );
}

export function TreeGridBody({ className, children, ...props }: ComponentProps<'div'>) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: div rows are needed for row animations
    <div role="rowgroup" className={className} {...props}>
      <AnimatePresence initial={false}>{children}</AnimatePresence>
    </div>
  );
}

type TreeGridRowProps<T> = {
  row: TreeGridRowModel<T>;
  className?: string;
  children: ReactNode;
};

/**
 * A body row. Rows with children toggle on click (Figma: "On click → Change to Opened").
 *
 * Rows open and close by height, in normal flow, with the Figma timing (300ms, ease-out):
 * the rows below, the table and the page all resize together, frame by frame. Sliding
 * rows with transforms alone (FLIP) leaves the table's and the page's height to change in
 * one frame, and collapsing near the bottom of the page then clamps the scroll position
 * and jolts everything above the table. Animating height costs a layout per frame, which
 * a table of this size affords; a large table would want virtualization anyway.
 */
export function TreeGridRow<T>({ row, className, children }: TreeGridRowProps<T>) {
  const grid = useGrid();
  const isPresent = useIsPresent();
  const reduceMotion = useReducedMotion();
  const tabIndex = useTabIndex(grid, row.id, ROW_FOCUS);
  const { ref, ...rowProps } = grid.getRowProps(row);

  return (
    <RowContext value={row as TreeGridRowModel<unknown>}>
      <m.div
        {...rowProps}
        tabIndex={tabIndex}
        ref={ref}
        // A leaving row stays in the DOM while it closes; keep it away from AT and focus.
        aria-hidden={isPresent ? undefined : true}
        inert={!isPresent}
        // Reduced motion: rows take or give up their place at once, so nothing slides; a
        // new row only fades in.
        initial={{ height: reduceMotion ? ROW_HEIGHT : 0, opacity: 0 }}
        animate={{ height: ROW_HEIGHT, opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={
          reduceMotion ? { ...figmaTransition, height: { duration: 0 } } : figmaTransition
        }
        data-level={row.level}
        data-expanded={row.hasChildren ? row.isExpanded : undefined}
        className={cn(
          rowLayout,
          // `clip`, not `hidden`: it cuts the content of a half-open row without making the
          // row a scroll container, which would break the sticky name column.
          'group overflow-y-clip border-b border-line bg-surface outline-offset-[-2px]',
          'transition-colors duration-300 ease-figma hover:bg-hover-opaque motion-reduce:transition-none',
          row.hasChildren && 'cursor-pointer',
          className
        )}
      >
        {children}
      </m.div>
    </RowContext>
  );
}

/** First cell of a row: indented by depth, sticky while the grid scrolls sideways. */
export function TreeGridRowHeader({ className, style, children, ...props }: ComponentProps<'div'>) {
  const grid = useGrid();
  const row = useRow();
  const tabIndex = useTabIndex(grid, row.id, 0);
  const { ref, ...cellProps } = grid.getCellProps(row, 0);

  return (
    <div
      {...cellProps}
      tabIndex={tabIndex}
      ref={ref}
      className={cn(rowHeaderLayout, 'min-w-0 outline-offset-[-2px]', className)}
      style={{
        ...style,
        paddingInlineStart: `calc(1rem + ${row.level - 1} * var(--tree-grid-indent))`,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

type TreeGridCellProps = ComponentProps<'div'> & {
  /** Position in the row; the row header is 0, so data cells start at 1. */
  colIndex: number;
};

export function TreeGridCell({ colIndex, className, ...props }: TreeGridCellProps) {
  const grid = useGrid();
  const row = useRow();
  const tabIndex = useTabIndex(grid, row.id, colIndex);
  const { ref, ...cellProps } = grid.getCellProps(row, colIndex);

  return (
    <div
      {...cellProps}
      tabIndex={tabIndex}
      ref={ref}
      className={cn('rounded-sm outline-offset-2', className)}
      {...props}
    />
  );
}

/**
 * A button inside a row, following the APG treegrid: it is reachable with Tab only while
 * focus is on its row (or one of the row's cells), so the grid stays a single tab stop.
 * Activating it neither toggles the row nor triggers the grid's keyboard handling.
 *
 * Rows and cells are named from their content, which includes this button's label; give
 * the cell holding it an `aria-label` with its visible text to keep the label out.
 */
export function TreeGridRowAction({
  className,
  onClick,
  onKeyDown,
  type = 'button',
  ...props
}: ComponentProps<'button'>) {
  const grid = useGrid();
  const row = useRow();
  const inCurrentRow = useSyncExternalStore(grid.subscribeFocus, () => grid.isCurrentRow(row.id));

  return (
    <button
      type={type}
      tabIndex={inCurrentRow ? 0 : -1}
      onClick={(event) => {
        event.stopPropagation(); // the row's own click toggles it
        onClick?.(event);
      }}
      onKeyDown={(event) => {
        // Enter and Space belong to the button, not to the row it sits in.
        if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
        onKeyDown?.(event);
      }}
      className={cn('shrink-0 rounded-sm', className)}
      {...props}
    />
  );
}

/**
 * Chevron that turns when the row expands. Rows without children get an empty slot of
 * the same size, so names line up across levels.
 */
export function TreeGridExpandIcon({ className }: { className?: string }) {
  const row = useRow();
  if (!row.hasChildren) return <span aria-hidden="true" className="size-4 shrink-0" />;
  return (
    <ChevronRight
      aria-hidden="true"
      strokeWidth={1.5}
      className={cn(
        'size-4 shrink-0 transition-transform duration-300 ease-figma motion-reduce:transition-none',
        row.isExpanded && 'rotate-90',
        className
      )}
    />
  );
}
