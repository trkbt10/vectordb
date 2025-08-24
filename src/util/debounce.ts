/**
 * @file Small dependency-free debounce with optional maxWait
 */

export type Debounced = {
  schedule(): void;
  cancel(): void;
  flush(): Promise<void>;
};

/**
 * Create a trailing debounce wrapper with optional maxWait cap.
 * - schedule(): start or reset the idle timer
 * - flush(): clear timers and invoke fn immediately
 * - cancel(): clear timers without invoking fn
 */
export function createDebounced(fn: () => void | Promise<void>, waitMs: number, maxWaitMs?: number): Debounced {
  const timers: { idle: ReturnType<typeof setTimeout> | null; max: ReturnType<typeof setTimeout> | null } = {
    idle: null,
    max: null,
  };

  const clearIdle = (): void => {
    const t = timers.idle;
    if (t) {
      clearTimeout(t);
      timers.idle = null;
    }
  };
  const clearMax = (): void => {
    const t = timers.max;
    if (t) {
      clearTimeout(t);
      timers.max = null;
    }
  };

  const schedule = (): void => {
    if (waitMs > 0) {
      clearIdle();
      timers.idle = setTimeout(() => {
        void flush();
      }, waitMs);
    }
    if ((maxWaitMs ?? 0) > 0 && !timers.max) {
      timers.max = setTimeout(() => {
        void flush();
      }, maxWaitMs);
    }
  };

  const cancel = (): void => {
    clearIdle();
    clearMax();
  };

  const flush = async (): Promise<void> => {
    clearIdle();
    clearMax();
    await fn();
  };

  return { schedule, cancel, flush };
}

