/**
 * @file FocusTree: headless hierarchical focus manager (no React).
 */

export type FocusId = string;
type MaybeId = FocusId | undefined;

type Node = { id: FocusId; parentId?: FocusId };

export class FocusTree {
  private focusId: MaybeId;
  private activeId: MaybeId;
  private nodes = new Map<FocusId, Node>();
  private kids = new Map<MaybeId, FocusId[]>();

  constructor(initialFocus?: FocusId) {
    this.focusId = initialFocus;
    this.activeId = undefined;
  }

  register(id: FocusId, parentId?: FocusId): () => void {
    this.nodes.set(id, { id, parentId });
    const key = parentId as MaybeId;
    const list = this.kids.get(key) ?? [];
    if (!list.includes(id)) {
      this.kids.set(key, [...list, id]);
    }
    return () => this.unregister(id);
  }

  private unregister(id: FocusId): void {
    const parentId = this.nodes.get(id)?.parentId as MaybeId;
    this.nodes.delete(id);
    const list = this.kids.get(parentId) ?? [];
    this.kids.set(parentId, list.filter((x) => x !== id));
    if (this.focusId === id) {
      this.focusId = parentId;
    }
    if (this.activeId === id) {
      this.activeId = parentId;
    }
  }

  setFocus(id?: FocusId): void {
    this.focusId = id ?? this.focusId;
  }

  activate(id?: FocusId): void {
    const target = id ?? this.focusId;
    if (target) {
      this.activeId = target;
      this.focusId = target;
    }
  }

  deactivate(): void {
    const cur = this.activeId;
    if (!cur) {
      return;
    }
    const parent = this.nodes.get(cur)?.parentId;
    const grand = parent ? this.nodes.get(parent)?.parentId : undefined;
    // Bubble to parent only if it has its own parent (avoid activating root-level)
    if (grand) {
      this.activeId = parent;
      this.focusId = parent;
      return;
    }
    // Leaving root-level: clear active and keep focus on the child we left
    this.activeId = undefined;
    this.focusId = cur;
  }

  nextSibling(): void {
    const cur = this.focusId;
    const parent = cur ? this.nodes.get(cur)?.parentId : undefined;
    const sibs = this.kids.get(parent) ?? [];
    if (sibs.length === 0) {
      return;
    }
    const idx = Math.max(0, sibs.indexOf(cur as FocusId));
    const next = sibs[(idx + 1) % sibs.length];
    this.focusId = next;
  }

  prevSibling(): void {
    const cur = this.focusId;
    const parent = cur ? this.nodes.get(cur)?.parentId : undefined;
    const sibs = this.kids.get(parent) ?? [];
    if (sibs.length === 0) {
      return;
    }
    const idx = Math.max(0, sibs.indexOf(cur as FocusId));
    const prev = sibs[(idx - 1 + sibs.length) % sibs.length];
    this.focusId = prev;
  }

  isFocused(id: FocusId): boolean {
    return this.focusId === id;
  }

  isActive(id: FocusId): boolean {
    return this.activeId === id;
  }

  /** True if active node is this id or a descendant of it. */
  isWithin(id: FocusId): boolean {
    if (this.activeId === id) {
      return true;
    }
    let cur = this.activeId;
    while (cur) {
      const p = this.nodes.get(cur)?.parentId;
      if (p === id) {
        return true;
      }
      cur = p;
    }
    return false;
  }

  /** True if any node is currently active (locked). */
  hasActive(): boolean {
    return !!this.activeId;
  }

  getActive(): MaybeId {
    return this.activeId;
  }
}
