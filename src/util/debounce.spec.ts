/**
 * @file Tests for createDebounced utility
 */
import { createDebounced } from "./debounce";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

describe("util/createDebounced", () => {
  it("calls once after idle period (trailing)", async () => {
    let calls = 0;
    const d = createDebounced(() => {
      calls += 1;
    }, 20);

    d.schedule();
    d.schedule();
    await sleep(35);

    expect(calls).toBe(1);
  });

  it("flush executes immediately and clears timers", async () => {
    let calls = 0;
    const d = createDebounced(() => {
      calls += 1;
    }, 50);

    d.schedule();
    await d.flush();
    expect(calls).toBe(1);

    // further wait should not call again unless scheduled
    await sleep(60);
    expect(calls).toBe(1);
  });

  it("maxWait triggers even with continuous schedule", async () => {
    let calls = 0;
    const d = createDebounced(() => {
      calls += 1;
    }, 50, 80);

    // Keep scheduling frequently so idle never elapses
    const start = Date.now();
    for (let i = 0; Date.now() - start < 70; i++) {
      d.schedule();
      /* eslint-disable no-await-in-loop */
      await sleep(10);
      /* eslint-enable no-await-in-loop */
    }

    // Should fire due to maxWait within ~80ms window
    await sleep(40);
    expect(calls).toBe(1);
  });

  it("cancel prevents pending execution", async () => {
    let calls = 0;
    const d = createDebounced(() => {
      calls += 1;
    }, 20);
    d.schedule();
    d.cancel();
    await sleep(30);
    expect(calls).toBe(0);
  });
});

