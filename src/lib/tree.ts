/*
 * Helpers for trees of any shape. Callers describe their nodes with two accessors, so the
 * same code serves the generic tree grid and the dashboard's own lookups.
 */

/** How to read a tree: a node's id and its children (empty for a leaf). */
export interface TreeAccessors<T> {
  getId: (item: T) => string;
  getChildren: (item: T) => readonly T[];
}

/** Every node in the tree by id, visible or not. */
export function indexById<T>(
  roots: readonly T[],
  { getId, getChildren }: TreeAccessors<T>
): Map<string, T> {
  const nodes = new Map<string, T>();
  const visit = (items: readonly T[]) => {
    for (const item of items) {
      nodes.set(getId(item), item);
      visit(getChildren(item));
    }
  };
  visit(roots);
  return nodes;
}

/** Parent of every node in the tree, visible or not; roots map to `null`. */
export function parentMap<T>(
  roots: readonly T[],
  { getId, getChildren }: TreeAccessors<T>
): Map<string, string | null> {
  const parents = new Map<string, string | null>();
  const visit = (items: readonly T[], parentId: string | null) => {
    for (const item of items) {
      const id = getId(item);
      parents.set(id, parentId);
      visit(getChildren(item), id);
    }
  };
  visit(roots, null);
  return parents;
}

/** Ids of `id` and its ancestors, root first. */
export function pathTo(id: string, parents: ReadonlyMap<string, string | null>): string[] {
  const path: string[] = [];
  let current: string | null | undefined = id;
  while (current != null && parents.has(current)) {
    path.unshift(current);
    current = parents.get(current);
  }
  return path;
}
