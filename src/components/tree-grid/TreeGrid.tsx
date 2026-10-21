import { ChevronRight } from 'lucide-react';
import { AnimatePresence, useIsPresent } from 'motion/react';
import * as m from 'motion/react-m';
import {
  type ComponentProps,
  type CSSProperties,
  createContext,
  type ReactNode,
  type Ref,
  use,
  useId,
} from 'react';
import { cn } from '@/lib/cn';
import { figmaTransition } from '@/lib/motion';
import type { TreeGridRowModel } from './flatten';
import { ROW_FOCUS, type TreeGridApi, useTabIndex } from './use-tree-grid';

/*
 * Presentational treegrid built on useTreeGrid. Markup is div-based with ARIA roles
 * rather than <table>: rows animate in and out (motion's popLayout takes a leaving row
 * out of flow), which table rows cannot do. Every row lays out its cells with the same
 * `columns` template, so columns line up without a shared table layout.
 *
 * Needs a motion LazyMotion provider with `domMax` (layout animations) above it.
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

const rowLayout = 'grid grid-cols-(--tree-grid-columns) items-center gap-x-4 h-14 pr-6';
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
        className={cn('w-full min-w-max', className)}
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
      <div role="row" className={cn(rowLayout, 'border-b border-line bg-surface', className)}>
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
    // `relative`: popLayout positions leaving rows absolutely against this element.
    // biome-ignore lint/a11y/useSemanticElements: div rows are needed for row animations
    <div role="rowgroup" className={cn('relative', className)} {...props}>
      <AnimatePresence mode="popLayout" initial={false}>
        {children}
      </AnimatePresence>
    </div>
  );
}

type TreeGridRowProps<T> = {
  row: TreeGridRowModel<T>;
  className?: string;
  children: ReactNode;
  /** Forwarded by AnimatePresence's popLayout to measure the row as it leaves. */
  ref?: Ref<HTMLDivElement>;
};

/**
 * A body row. Rows with children toggle on click (Figma: "On click → Change to Opened").
 * Hover and the expand animation use the Figma timing: 300ms, ease-out.
 */
export function TreeGridRow<T>({ row, className, children, ref }: TreeGridRowProps<T>) {
  const grid = useGrid();
  const isPresent = useIsPresent();
  const tabIndex = useTabIndex(grid, row.id, ROW_FOCUS);
  const { ref: registerRef, ...rowProps } = grid.getRowProps(row);

  return (
    <RowContext value={row as TreeGridRowModel<unknown>}>
      <m.div
        {...rowProps}
        tabIndex={tabIndex}
        ref={(element: HTMLDivElement | null) => {
          registerRef(element);
          if (typeof ref === 'function') ref(element);
          else if (ref) ref.current = element;
        }}
        // A leaving row stays in the DOM while it fades; keep it away from AT and focus.
        aria-hidden={isPresent ? undefined : true}
        inert={!isPresent}
        layout="position"
        // Measure layout only when the set of rows changes, not on every re-render (a
        // focus move re-renders a row without moving anything).
        layoutDependency={grid.rows}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={figmaTransition}
        data-level={row.level}
        data-expanded={row.hasChildren ? row.isExpanded : undefined}
        className={cn(
          rowLayout,
          'group border-b border-line bg-surface outline-offset-[-2px]',
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
