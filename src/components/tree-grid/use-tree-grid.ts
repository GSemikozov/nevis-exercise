import {
  type FocusEvent,
  type KeyboardEvent,
  type RefCallback,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
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

  // Roving focus. `focus` is where the user last was; `current` is the visible
  // position it resolves to (a collapsed-away row resolves to its nearest visible
  // ancestor, nothing yet resolves to the first row).
  const [focus, setFocus] = useState<FocusPosition | null>(null);
  const current = useMemo((): FocusPosition | null => {
    let rowId = focus?.rowId;
    while (rowId != null && !rowIndex.has(rowId)) rowId = parents.get(rowId) ?? undefined;
    if (rowId != null && focus) return { rowId, col: rowId === focus.rowId ? focus.col : ROW };
    const first = rows[0];
    return first ? { rowId: first.id, col: ROW } : null;
  }, [focus, rowIndex, parents, rows]);

  const gridRef = useRef<HTMLElement | null>(null);
  const elements = useRef(new Map<string, HTMLElement>());
  const focusRequested = useRef(false);
  const currentKey = current ? keyOf(current) : null;

  // Move DOM focus after a keyboard move, or when the focused row was collapsed away.
  useEffect(() => {
    if (!currentKey) return;
    const active = document.activeElement;
    const lostFocus = active === document.body || gridRef.current?.contains(active);
    if (focusRequested.current || (focus && keyOf(focus) !== currentKey && lostFocus)) {
      focusRequested.current = false;
      elements.current.get(currentKey)?.focus();
    }
  }, [currentKey, focus]);

  const moveFocus = (next: FocusPosition) => {
    focusRequested.current = true;
    setFocus(next);
  };

  const register =
    (key: string): RefCallback<HTMLElement> =>
    (element) => {
      if (element) elements.current.set(key, element);
      else elements.current.delete(key);
    };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
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

  const isCurrent = (rowId: string, col: number) => current?.rowId === rowId && current.col === col;

  const getGridProps = () => ({
    role: 'treegrid' as const,
    'aria-colcount': columnCount,
    ref: (element: HTMLElement | null) => {
      gridRef.current = element;
    },
    onKeyDown,
  });

  const getRowProps = (row: TreeGridRowModel<T>) => ({
    role: 'row' as const,
    'aria-level': row.level,
    'aria-posinset': row.posInSet,
    'aria-setsize': row.setSize,
    'aria-expanded': row.hasChildren ? row.isExpanded : undefined,
    tabIndex: isCurrent(row.id, ROW) ? 0 : -1,
    ref: register(keyOf({ rowId: row.id, col: ROW })),
    onFocus: (event: FocusEvent<HTMLElement>) => {
      if (event.target === event.currentTarget) setFocus({ rowId: row.id, col: ROW });
    },
    onClick: row.hasChildren ? () => toggle(row.id) : undefined,
  });

  const getCellProps = (row: TreeGridRowModel<T>, col: number) => ({
    role: col === 0 ? ('rowheader' as const) : ('gridcell' as const),
    'aria-colindex': col + 1,
    tabIndex: isCurrent(row.id, col) ? 0 : -1,
    ref: register(keyOf({ rowId: row.id, col })),
    onFocus: (event: FocusEvent<HTMLElement>) => {
      if (event.target === event.currentTarget) setFocus({ rowId: row.id, col });
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
  };
}

export type TreeGridApi<T> = ReturnType<typeof useTreeGrid<T>>;

function keyOf({ rowId, col }: FocusPosition) {
  return `${rowId}:${col}`;
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
