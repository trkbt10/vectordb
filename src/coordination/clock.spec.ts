/** @file Coordination: clock injection specs */
import { systemClock, fixedClock, offsetClock } from "./clock";

describe("coordination/clock", () => {
  it("systemClock returns increasing timestamps", () => {
    const a = systemClock.now();
    const b = systemClock.now();
    expect(b).toBeGreaterThanOrEqual(a);
  });
  it("fixedClock always returns the same timestamp", () => {
    const c = fixedClock(123456);
    expect(c.now()).toBe(123456);
    expect(c.now()).toBe(123456);
  });
  it("offsetClock returns Date.now() + offset", () => {
    const off = offsetClock(50);
    expect(off.now()).toBeGreaterThanOrEqual(Date.now() + 49);
  });
});
