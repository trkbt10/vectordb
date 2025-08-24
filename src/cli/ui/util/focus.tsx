/**
 * @file Hierarchical focus manager for CLI UI
 * Provides a unified, nested focus model: focus moves among siblings; active locks input to a subtree.
 */
import React from "react";

type FocusId = string;
type MaybeId = FocusId | undefined;

type Node = { id: FocusId; parentId?: FocusId };

type FocusCtx = {
  focusId: MaybeId;
  activeId: MaybeId;
  setFocus: (id: FocusId) => void;
  activate: (id?: FocusId) => void;
  deactivate: () => void;
  register: (id: FocusId, parentId?: FocusId) => () => void;
  nextSibling: () => void;
  prevSibling: () => void;
  isFocused: (id: FocusId) => boolean;
  isActive: (id: FocusId) => boolean;
  isWithin: (id: FocusId) => boolean;
};

const Ctx = React.createContext<FocusCtx | null>(null);

/** FocusProvider: create a focus tree and expose helpers */
export function FocusProvider({ children, initialFocus }: { children: React.ReactNode; initialFocus?: FocusId }) {
  const [focusId, setFocusId] = React.useState<MaybeId>(initialFocus);
  const [activeId, setActiveId] = React.useState<MaybeId>(undefined);
  const nodesRef = React.useRef<Map<FocusId, Node>>(new Map());
  const kidsRef = React.useRef<Map<MaybeId, FocusId[]>>(new Map());

  const ensureChild = (parent: MaybeId, id: FocusId) => {
    const list = kidsRef.current.get(parent) ?? [];
    if (!list.includes(id)) {
      kidsRef.current.set(parent, [...list, id]);
    }
  };

  const removeChild = (parent: MaybeId, id: FocusId) => {
    const list = kidsRef.current.get(parent) ?? [];
    kidsRef.current.set(
      parent,
      list.filter((x) => x !== id),
    );
  };

  const register = (id: FocusId, parentId?: FocusId) => {
    nodesRef.current.set(id, { id, parentId });
    ensureChild(parentId, id);
    return () => {
      const p = nodesRef.current.get(id)?.parentId;
      nodesRef.current.delete(id);
      removeChild(p, id);
      if (focusId === id) {
        setFocusId(p);
      }
      if (activeId === id) {
        setActiveId(p);
      }
    };
  };

  const nextSibling = () => {
    const cur = focusId;
    const parent = cur ? nodesRef.current.get(cur)?.parentId : undefined;
    const sibs = kidsRef.current.get(parent) ?? [];
    if (sibs.length === 0) {
      return;
    }
    const idx = Math.max(0, sibs.indexOf(cur as FocusId));
    const next = sibs[(idx + 1) % sibs.length];
    setFocusId(next);
  };

  const prevSibling = () => {
    const cur = focusId;
    const parent = cur ? nodesRef.current.get(cur)?.parentId : undefined;
    const sibs = kidsRef.current.get(parent) ?? [];
    if (sibs.length === 0) {
      return;
    }
    const idx = Math.max(0, sibs.indexOf(cur as FocusId));
    const prev = sibs[(idx - 1 + sibs.length) % sibs.length];
    setFocusId(prev);
  };

  const setFocus = (id: FocusId) => {
    setFocusId(id);
  };

  const activate = (id?: FocusId) => {
    const target = id ?? focusId ?? initialFocus;
    if (target) {
      setActiveId(target);
      setFocusId(target);
    }
  };

  const deactivate = () => {
    const cur = activeId;
    if (!cur) {
      return;
    }
    const parent = nodesRef.current.get(cur)?.parentId;
    const grand = parent ? nodesRef.current.get(parent)?.parentId : undefined;
    if (grand) {
      setActiveId(parent);
      setFocusId(parent);
      return;
    }
    // Leaving root-level: clear active and keep focus on the child we left
    setActiveId(undefined);
    setFocusId(cur);
  };

  const isFocused = (id: FocusId) => focusId === id;
  const isActive = (id: FocusId) => activeId === id;
  const isWithin = (id: FocusId) => {
    if (activeId === id) {
      return true;
    }
    const walkUp = (start: MaybeId): boolean => {
      if (!start) {
        return false;
      }
      const p = nodesRef.current.get(start)?.parentId;
      if (!p) {
        return false;
      }
      if (p === id) {
        return true;
      }
      return walkUp(p);
    };
    return walkUp(activeId);
  };

  const value: FocusCtx = {
    focusId,
    activeId,
    setFocus,
    activate,
    deactivate,
    register,
    nextSibling,
    prevSibling,
    isFocused,
    isActive,
    isWithin,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Access the current focus context */
export function useFocus(): FocusCtx {
  const ctx = React.useContext(Ctx);
  if (!ctx) {
    throw new Error("Focus context missing");
  }
  return ctx;
}

/** Register a focusable node and expose helpers */
export function useFocusable(id: FocusId, parentId?: FocusId) {
  const ctx = useFocus();
  React.useEffect(() => ctx.register(id, parentId), [id, parentId]);
  return {
    isFocused: ctx.isFocused(id),
    isActive: ctx.isActive(id),
    isWithin: ctx.isWithin(id),
    focus: () => ctx.setFocus(id),
    activate: () => ctx.activate(id),
    deactivate: () => ctx.deactivate(),
  };
}
