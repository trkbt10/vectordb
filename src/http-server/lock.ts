/**
 * @file Minimal async mutex for write exclusivity
 */
export type AsyncLock = { runExclusive<T>(fn: () => Promise<T> | T): Promise<T> };

/** Create a simple async lock without using `let` or classes. */
export function create_async_lock(): AsyncLock {
  const state: { p: Promise<unknown> } = { p: Promise.resolve() };
  return {
    async runExclusive<T>(fn: () => Promise<T> | T): Promise<T> {
      const prev = state.p;
      const done = prev.then(async () => fn());
      // Keep chain alive even if fn throws
      state.p = done.catch(() => void 0);
      return done;
    },
  };
}
