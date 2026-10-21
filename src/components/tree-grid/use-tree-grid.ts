import {
  type FocusEvent,
  type KeyboardEvent,
  type RefCallback,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { flattenVisible, parentMap, type TreeAccessors, type TreeGridRowModel } from './flatten';

/** Where keyboard focus sits: a whole row (`col` = -1) or one of its cells. */
interface FocusPosition {
  rowId: string;
  col: number;
}

const ROW = -1;

export interface UseTreeGridOptions<T> extends TreeAccessors<T> {
  /** Root items of the tree. */
  items: readonly T[];
  /** Cells per row, the row header included. */
  columnCount: number;
  /** Controlled expanded row ids. Leave undefined to let the grid own the state. */
  expandedIds?: ReadonlySet<string>;
  defaultExpandedIds?: Iterable<string>;
  onExpandedChange?: (expandedIds: ReadonlySet<string>) => void;
}

/**
 * Headless state and behaviour for a WAI-ARIA treegrid
 * (https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/): which rows are visible,
 * expand/collapse, roving tabindex over rows and cells, and the APG keyboard model.
 * Rendering is left to the caller, or to the components in TreeGrid.tsx.
 */
export function useTreeGrid<T>({
  items,
  getId,
  getChildren,
  columnCount,
  expandedIds: controlledIds,
  defaultExpandedIds,
  onExpandedChange,
}: UseTreeGridOptions<T>) {
  const [uncontrolledIds, setUncontrolledIds] = useState<ReadonlySet<string>>(
    () => new Set(defaultExpandedIds)
  );
  const expandedIds = controlledIds ?? uncontrolledIds;

  const setExpandedIds = useCallback(
    (next: ReadonlySet<string>) => {
      if (controlledIds === undefined) setUncontrolledIds(next);
      onExpandedChange?.(next);
    },
    [controlledIds, onExpandedChange]
  );

  const setRowExpanded = useCallback(
    (id: string, expanded: boolean) => {
      if (expandedIds.has(id) === expanded) return;
      const next = new Set(expandedIds);
      if (expanded) next.add(id);
      else next.delete(id);
      setExpandedIds(next);
    },
    [expandedIds, setExpandedIds]
  );

  const toggle = useCallback(
    (id: string) => setRowExpanded(id, !expandedIds.has(id)),
    [expandedIds, setRowExpanded]
  );

  const rows = useMemo(
    () => flattenVisible(items, { getId, getChildren }, expandedIds),
    [items, getId, getChildren, expandedIds]
  );
  const parents = useMemo(
    () => parentMap(items, { getId, getChildren }),
    [items, getId, getChildren]
  );
  const rowIndex = useMemo(() => new Map(rows.map((row, index) => [row.id, index])), [rows]);

  /*
   * Roving focus. Where the user last was lives in a small store outside React state, so
   * moving focus re-renders only the element losing the tab stop and the one gaining it
   * (see useTabIndex), not every row: rows are layout-animated, so each re-render would
   * also cost a layout measurement.
   */
  const [focusStore] = useState(createFocusStore);
  const gridRef = useRef<HTMLElement | null>(null);
  const elements = useRef(new Map<string, HTMLElement>());

  /** A visible position for `focus`: a collapsed-away row resolves to its nearest
   * visible ancestor, no focus yet to the first row. */
  const resolve = useCallback(
    (focus: FocusPosition | null): FocusPosition | null => {
      let rowId = focus?.rowId;
      while (rowId != null && !rowIndex.has(rowId)) rowId = parents.get(rowId) ?? undefined;
      if (rowId != null && focus) return { rowId, col: rowId === focus.rowId ? focus.col : ROW };
      const first = rows[0];
      return first ? { rowId: first.id, col: ROW } : null;
    },
    [rowIndex, parents, rows]
  );

  const isCurrent = useCallback(
    (rowId: string, col: number) => {
      const current = resolve(focusStore.get());
      return current?.rowId === rowId && current.col === col;
    },
    [resolve, focusStore]
  );

  // When the focused row is collapsed away (by a parent changing `expandedIds`, say), move
  // focus to its nearest visible ancestor, unless the user has already moved elsewhere.
  useEffect(() => {
    const focus = focusStore.get();
    const resolved = resolve(focus);
    if (!focus || !resolved || keyOf(focus) === keyOf(resolved)) return;
    focusStore.set(resolved);
    const active = document.activeElement;
    if (active === document.body || gridRef.current?.contains(active)) {
      elements.current.get(keyOf(resolved))?.focus();
    }
  }, [resolve, focusStore]);

  // Elements can take focus with tabIndex -1, so a move focuses the target directly; the
  // store update then hands it the tab stop.
  const moveFocus = (next: FocusPosition) => {
    focusStore.set(next);
    elements.current.get(keyOf(next))?.focus();
  };

  const register =
    (key: string): RefCallback<HTMLElement> =>
    (element) => {
      if (element) elements.current.set(key, element);
      else elements.current.delete(key);
    };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const current = resolve(focusStore.get());
    if (!current) return;
    const index = rowIndex.get(current.rowId);
    const row = index === undefined ? undefined : rows[index];
    if (!row || index === undefined) return;

    const handled = handleKey(event, {
      row,
      col: current.col,
      above: rows[index - 1],
      below: rows[index + 1],
      first: rows[0] as TreeGridRowModel<T>,
      last: rows[rows.length - 1] as TreeGridRowModel<T>,
      lastCol: columnCount - 1,
      moveFocus,
      setRowExpanded,
      toggle,
    });
    if (handled) event.preventDefault();
  };

  const getGridProps = () => ({
    role: 'treegrid' as const,
    'aria-colcount': columnCount,
    ref: (element: HTMLElement | null) => {
      gridRef.current = element;
    },
    onKeyDown,
  });

  // Prop getters leave out tabIndex: it comes from useTabIndex, so that focus moves do
  // not re-render whoever spreads these props.
  const getRowProps = (row: TreeGridRowModel<T>) => ({
    role: 'row' as const,
    'aria-level': row.level,
    'aria-posinset': row.posInSet,
    'aria-setsize': row.setSize,
    'aria-expanded': row.hasChildren ? row.isExpanded : undefined,
    ref: register(keyOf({ rowId: row.id, col: ROW })),
    onFocus: (event: FocusEvent<HTMLElement>) => {
      if (event.target === event.currentTarget) focusStore.set({ rowId: row.id, col: ROW });
    },
    onClick: row.hasChildren ? () => toggle(row.id) : undefined,
  });

  const getCellProps = (row: TreeGridRowModel<T>, col: number) => ({
    role: col === 0 ? ('rowheader' as const) : ('gridcell' as const),
    'aria-colindex': col + 1,
    ref: register(keyOf({ rowId: row.id, col })),
    onFocus: (event: FocusEvent<HTMLElement>) => {
      if (event.target === event.currentTarget) focusStore.set({ rowId: row.id, col });
    },
  });

  return {
    rows,
    expandedIds,
    setExpandedIds,
    toggle,
    expand: (id: string) => setRowExpanded(id, true),
    collapse: (id: string) => setRowExpanded(id, false),
    getGridProps,
    getRowProps,
    getCellProps,
    subscribeFocus: focusStore.subscribe,
    isCurrent,
  };
}

export type TreeGridApi<T> = ReturnType<typeof useTreeGrid<T>>;

/** Column index meaning "the row itself" rather than one of its cells. */
export const ROW_FOCUS = ROW;

/**
 * Roving tabindex for one row (`col` = ROW_FOCUS) or cell: 0 for the single tab stop,
 * -1 otherwise. The caller re-renders only when this element gains or loses the stop.
 */
export function useTabIndex(
  grid: Pick<TreeGridApi<unknown>, 'subscribeFocus' | 'isCurrent'>,
  rowId: string,
  col: number
): 0 | -1 {
  const isCurrent = useSyncExternalStore(grid.subscribeFocus, () => grid.isCurrent(rowId, col));
  return isCurrent ? 0 : -1;
}

function keyOf({ rowId, col }: FocusPosition) {
  return `${rowId}:${col}`;
}

function createFocusStore() {
  let position: FocusPosition | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => position,
    set(next: FocusPosition) {
      if (position && keyOf(position) === keyOf(next)) return;
      position = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

interface KeyContext<T> {
  row: TreeGridRowModel<T>;
  col: number;
  above: TreeGridRowModel<T> | undefined;
  below: TreeGridRowModel<T> | undefined;
  first: TreeGridRowModel<T>;
  last: TreeGridRowModel<T>;
  lastCol: number;
  moveFocus: (next: FocusPosition) => void;
  setRowExpanded: (id: string, expanded: boolean) => void;
  toggle: (id: string) => void;
}

type KeyHandler = <T>(ctx: KeyContext<T>, modifier: boolean) => boolean;

/** Toggles a parent row from the row itself or its header cell. */
const toggleRow: KeyHandler = ({ row, col, toggle }) => {
  if (!row.hasChildren || col > 0) return false;
  toggle(row.id);
  return true;
};

/*
 * The APG treegrid keyboard model, with focus on rows (col = ROW) and on cells. Each
 * handler returns whether it handled the key, so the caller can prevent the default.
 */
const keyHandlers: Record<string, KeyHandler> = {
  ArrowDown: ({ below, col, moveFocus }) => {
    if (below) moveFocus({ rowId: below.id, col });
    return true;
  },
  ArrowUp: ({ above, col, moveFocus }) => {
    if (above) moveFocus({ rowId: above.id, col });
    return true;
  },
  // Row: expand, or step into the cells if already open. Cell: next cell.
  ArrowRight: ({ row, col, lastCol, moveFocus, setRowExpanded }) => {
    if (col !== ROW) {
      if (col < lastCol) moveFocus({ rowId: row.id, col: col + 1 });
    } else if (row.hasChildren && !row.isExpanded) {
      setRowExpanded(row.id, true);
    } else {
      moveFocus({ rowId: row.id, col: 0 });
    }
    return true;
  },
  // Cell: previous cell, then the row. Row: collapse, or go up to the parent.
  ArrowLeft: ({ row, col, moveFocus, setRowExpanded }) => {
    if (col !== ROW) moveFocus({ rowId: row.id, col: col - 1 });
    else if (row.isExpanded) setRowExpanded(row.id, false);
    else if (row.parentId) moveFocus({ rowId: row.parentId, col: ROW });
    return true;
  },
  // Row: first row. Cell: first cell in the row, or of the grid with Ctrl/Cmd.
  Home: ({ row, col, first, moveFocus }, modifier) => {
    if (col === ROW) moveFocus({ rowId: first.id, col: ROW });
    else moveFocus({ rowId: modifier ? first.id : row.id, col: 0 });
    return true;
  },
  End: ({ row, col, last, lastCol, moveFocus }, modifier) => {
    if (col === ROW) moveFocus({ rowId: last.id, col: ROW });
    else moveFocus({ rowId: modifier ? last.id : row.id, col: lastCol });
    return true;
  },
  Enter: toggleRow,
  ' ': toggleRow,
};

function handleKey<T>(event: KeyboardEvent, ctx: KeyContext<T>): boolean {
  const handler = keyHandlers[event.key];
  return handler ? handler(ctx, event.ctrlKey || event.metaKey) : false;
}
