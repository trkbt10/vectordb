/**
 * @file Key-to-focus navigation utilities (headless)
 */
import { FocusTree } from "./focus-core";

export type NavKey =
  | "Tab"
  | "Shift-Tab"
  | "ArrowLeft"
  | "ArrowRight"
  | "ArrowUp"
  | "ArrowDown"
  | "h"
  | "j"
  | "k"
  | "l"
  | "Enter"
  | "Escape";

/** Apply a navigation key to the focus tree using unified semantics. */
export function applyNavKey(ft: FocusTree, key: NavKey): void {
  const anyActive = ft.hasActive();

  if (key === "Enter") {
    ft.activate();
    return;
  }
  if (key === "Escape") {
    ft.deactivate();
    return;
  }
  // Global navigation only when not active (no section locked)
  if (!anyActive) {
    if (key === "Tab") {
      ft.nextSibling();
      return;
    }
    if (key === "Shift-Tab") {
      ft.prevSibling();
      return;
    }
    if (key === "ArrowRight" || key === "ArrowDown" || key === "l" || key === "j") {
      ft.nextSibling();
      return;
    }
    if (key === "ArrowLeft" || key === "ArrowUp" || key === "h" || key === "k") {
      ft.prevSibling();
      return;
    }
  }
  // When active: keep focus pinned to active node for movement keys
  if (anyActive) {
    if (
      key === "ArrowRight" ||
      key === "ArrowDown" ||
      key === "l" ||
      key === "j" ||
      key === "ArrowLeft" ||
      key === "ArrowUp" ||
      key === "h" ||
      key === "k" ||
      key === "Tab" ||
      key === "Shift-Tab"
    ) {
      const a = ft.getActive();
      if (a) {
        ft.setFocus(a);
      }
      return;
    }
  }
}
