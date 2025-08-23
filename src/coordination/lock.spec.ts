/** @file Coordination: memory lock specs */
import { createMemoryLock } from "./lock";

describe("coordination/memory-lock", () => {
  it("acquire → renew → release; second acquire fails until expired", () => {
    const clock = { now: () => Date.now() };
    const lock = createMemoryLock(clock);
    const a = lock.acquire("db", 50, "c1");
    expect(a.ok).toBe(true);
    if (!a.ok) {
      return;
    }
    const bad = lock.acquire("db", 50, "c2");
    expect(bad.ok).toBe(false);
    const rn = lock.renew("db", a.epoch, 50, "c1");
    expect(rn.ok).toBe(true);
    const rl = lock.release("db", a.epoch, "c1");
    expect(rl.ok).toBe(true);
    const a2 = lock.acquire("db", 50, "c2");
    expect(a2.ok).toBe(true);
    if (a2.ok) {
      expect(a2.epoch).toBe(a.epoch + 1);
    }
  });
});
