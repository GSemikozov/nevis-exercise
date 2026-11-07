import type { TreeAccessors } from '@/lib/tree';

/** A visible row of the tree, with everything ARIA needs to describe its place in it. */
export interface TreeGridRowModel<T> {
  id: string;
  item: T;
  /** 1-based depth, as `aria-level` expects. */
  level: number;
  /** 1-based position among siblings (`aria-posinset`). */
  posInSet: number;
  /** Number of siblings including this row (`aria-setsize`). */
  setSize: number;
  parentId: string | null;
  hasChildren: boolean;
  isExpanded: boolean;
}

/**
 * Depth-first list of the rows that are currently visible: roots, plus the children of
 * every expanded row whose ancestors are expanded too. A flat list keeps every row a
 * sibling of the others, which is what row animations and (later) virtualization need.
 */
export function flattenVisible<T>(
  roots: readonly T[],
  { getId, getChildren }: TreeAccessors<T>,
  expandedIds: ReadonlySet<string>
): TreeGridRowModel<T>[] {
  const rows: TreeGridRowModel<T>[] = [];

  const visit = (items: readonly T[], level: number, parentId: string | null) => {
    items.forEach((item, index) => {
      const id = getId(item);
      const children = getChildren(item);
      const isExpanded = children.length > 0 && expandedIds.has(id);
      rows.push({
        id,
        item,
        level,
        posInSet: index + 1,
        setSize: items.length,
        parentId,
        hasChildren: children.length > 0,
        isExpanded,
      });
      if (isExpanded) visit(children, level + 1, id);
    });
  };

  visit(roots, 1, null);
  return rows;
}
