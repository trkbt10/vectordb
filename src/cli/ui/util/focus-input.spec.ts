/**
 * @file Specs: key navigation for FocusTree (non-active and active states)
 */
// use globals from the test runner (describe/it/expect)
import { FocusTree } from "./focus-core";
import { applyNavKey } from "./focus-input";

function setupFour(): { ft: FocusTree; cleanup: (() => void)[] } {
  const ft = new FocusTree("search");
  const cleanup = [ft.register("search"), ft.register("table"), ft.register("pagination"), ft.register("footer")];
  return { ft, cleanup };
}

describe("focus-input navigation", () => {
  it("non-active: arrows and hjkl move focus among siblings", () => {
    const { ft, cleanup } = setupFour();
    expect(ft.isFocused("search")).toBe(true);
    applyNavKey(ft, "ArrowRight");
    expect(ft.isFocused("table")).toBe(true);
    applyNavKey(ft, "ArrowDown");
    expect(ft.isFocused("pagination")).toBe(true);
    applyNavKey(ft, "l");
    expect(ft.isFocused("footer")).toBe(true);
    applyNavKey(ft, "j");
    expect(ft.isFocused("search")).toBe(true); // wraps
    applyNavKey(ft, "ArrowLeft");
    expect(ft.isFocused("footer")).toBe(true);
    applyNavKey(ft, "ArrowUp");
    expect(ft.isFocused("pagination")).toBe(true);
    applyNavKey(ft, "h");
    expect(ft.isFocused("table")).toBe(true);
    applyNavKey(ft, "k");
    expect(ft.isFocused("search")).toBe(true);
    cleanup.forEach((fn) => fn());
  });

  it("Tab/Shift-Tab cycle without active lock", () => {
    const { ft, cleanup } = setupFour();
    applyNavKey(ft, "Tab");
    expect(ft.isFocused("table")).toBe(true);
    applyNavKey(ft, "Tab");
    expect(ft.isFocused("pagination")).toBe(true);
    applyNavKey(ft, "Shift-Tab");
    expect(ft.isFocused("table")).toBe(true);
    cleanup.forEach((fn) => fn());
  });

  it("active: ignore movement keys; Esc deactivates to parent", () => {
    const { ft, cleanup } = setupFour();
    // activate search
    applyNavKey(ft, "Enter");
    expect(ft.isActive("search")).toBe(true);
    // movement keys do nothing while active (locked)
    applyNavKey(ft, "ArrowRight");
    expect(ft.isFocused("search")).toBe(true);
    // Esc unlocks
    applyNavKey(ft, "Escape");
    expect(ft.isActive("search")).toBe(false);
    // now movement works again
    applyNavKey(ft, "ArrowRight");
    expect(ft.isFocused("table")).toBe(true);
    cleanup.forEach((fn) => fn());
  });

  it("nested: child activation bubbles Esc to parent, no cross-sibling conflicts", () => {
    const ft = new FocusTree("root");
    const cleanup = [
      ft.register("root"),
      ft.register("a", "root"),
      ft.register("b", "root"),
      ft.register("a.1", "a"),
      ft.register("a.2", "a"),
    ];
    ft.setFocus("a");
    applyNavKey(ft, "Enter"); // active a
    ft.setFocus("a.1");
    applyNavKey(ft, "Enter"); // active a.1
    expect(ft.isWithin("a")).toBe(true);
    applyNavKey(ft, "Escape"); // back to a
    expect(ft.isActive("a")).toBe(true);
    // while a is active, sibling nav should not run
    applyNavKey(ft, "ArrowRight");
    expect(ft.isFocused("a")).toBe(true);
    applyNavKey(ft, "Escape"); // deactivate to parent (root)
    // now nav can move to sibling b
    applyNavKey(ft, "ArrowRight");
    expect(ft.isFocused("b")).toBe(true);
    cleanup.forEach((fn) => fn());
  });
});
