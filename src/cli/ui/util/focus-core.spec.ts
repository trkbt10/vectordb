/**
 * @file Specs for FocusTree: selection/activation/movement + nested behavior
 */
// use globals from the test runner (describe/it/expect)
import { FocusTree } from "./focus-core";

describe("FocusTree", () => {
  it("cycles focus among siblings with Tab-like next/prev", () => {
    const ft = new FocusTree("search");
    const cleanup = [
      ft.register("search"),
      ft.register("table"),
      ft.register("pagination"),
      ft.register("footer"),
    ];
    expect(ft.isFocused("search")).toBe(true);
    ft.nextSibling();
    expect(ft.isFocused("table")).toBe(true);
    ft.nextSibling();
    expect(ft.isFocused("pagination")).toBe(true);
    ft.prevSibling();
    expect(ft.isFocused("table")).toBe(true);
    cleanup.forEach((fn) => fn());
  });

  it("activates on selection and deactivates to parent with Esc", () => {
    const ft = new FocusTree("search");
    const cleanup = [
      ft.register("search"),
      ft.register("table"),
      ft.register("pagination"),
      ft.register("footer"),
    ];
    ft.activate();
    expect(ft.isActive("search")).toBe(true);
    ft.deactivate();
    // root-level has no parent: becomes inactive
    expect(ft.isActive("search")).toBe(false);
    // move to table and activate
    ft.setFocus("table");
    ft.activate();
    expect(ft.isActive("table")).toBe(true);
    ft.deactivate();
    expect(ft.isActive("table")).toBe(false);
    cleanup.forEach((fn) => fn());
  });

  it("handles nested activation without conflicts", () => {
    const ft = new FocusTree("search");
    const cleanup = [
      ft.register("search"),
      ft.register("table"),
      ft.register("pagination"),
      ft.register("footer"),
      ft.register("table.rows", "table"),
      ft.register("table.actions", "table"),
      ft.register("table.actions.confirm", "table.actions"),
    ];
    ft.setFocus("table");
    ft.activate();
    expect(ft.isWithin("table")).toBe(true);
    // activate nested child
    ft.setFocus("table.rows");
    ft.activate();
    expect(ft.isActive("table.rows")).toBe(true);
    expect(ft.isWithin("table")).toBe(true);
    // deeper child
    ft.setFocus("table.actions");
    ft.activate();
    ft.setFocus("table.actions.confirm");
    ft.activate();
    expect(ft.isWithin("table.actions")).toBe(true);
    // Esc bubbles to parent
    ft.deactivate();
    expect(ft.isActive("table.actions")).toBe(true);
    // Esc again to table
    ft.deactivate();
    expect(ft.isActive("table")).toBe(true);
    // Esc again: inactive
    ft.deactivate();
    expect(ft.isActive("table")).toBe(false);
    cleanup.forEach((fn) => fn());
  });
});
