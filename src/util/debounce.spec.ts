/**
 * @file Tests for createDebounced utility
 */
import { createDebounced } from "./debounce";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

describe("util/createDebounced", () => {
  it("calls once after idle period (trailing)", async () => {
    const events: number[] = [];
    const d = createDebounced(() => {
      events.push(1);
    }, 20);

    d.schedule();
    d.schedule();
    await sleep(35);

    expect(events.length).toBe(1);
  });

  it("flush executes immediately and clears timers", async () => {
    const events: number[] = [];
    const d = createDebounced(() => {
      events.push(1);
    }, 50);

    d.schedule();
    await d.flush();
    expect(events.length).toBe(1);

    // further wait should not call again unless scheduled
    await sleep(60);
    expect(events.length).toBe(1);
  });

  it("maxWait triggers even with continuous schedule", async () => {
    const events: number[] = [];
    const d = createDebounced(
      () => {
        events.push(1);
      },
      50,
      80,
    );

    // Keep scheduling frequently so idle never elapses
    const start = Date.now();
    const runUntil = async (deadline: number): Promise<void> => {
      if (Date.now() >= deadline) {
        return;
      }
      d.schedule();
      await sleep(10);
      await runUntil(deadline);
    };
    await runUntil(start + 70);

    // Should fire due to maxWait within ~80ms window
    await sleep(40);
    expect(events.length).toBe(1);
  });

  it("cancel prevents pending execution", async () => {
    const events: number[] = [];
    const d = createDebounced(() => {
      events.push(1);
    }, 20);
    d.schedule();
    d.cancel();
    await sleep(30);
    expect(events.length).toBe(0);
  });
});
