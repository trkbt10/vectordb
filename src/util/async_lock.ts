/**
 * @file Small async lock utility (function-based)
 */
/** Async lock interface: run a function exclusively. */
export type AsyncLock = { runExclusive<T>(fn: () => Promise<T> | T): Promise<T> };

/** Create a simple async lock without using classes or let. */
export function createAsyncLock(): AsyncLock {
  const state: { p: Promise<unknown> } = { p: Promise.resolve() };
  return {
    async runExclusive<T>(fn: () => Promise<T> | T): Promise<T> {
      const prev = state.p;
      const done = prev.then(async () => fn());
      state.p = done.catch(() => void 0);
      return done;
    },
  };
}
