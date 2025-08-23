/**
 * @file Config discovery + loader helpers for UI/CLI consumers.
 * Suspense-friendly Resource interface with progress subscription.
 */
import path from "node:path";
import { access } from "node:fs/promises";
import { constants as FS } from "node:fs";
import { hasErrorCode } from "../util/is-error";

// Pull primitives from server layer (single source of truth)
import { CONFIG_EXTS, DEFAULT_CONFIG_STEM } from "./resolve";
import { loadConfigModule } from "./loader";
import { normalizeConfig } from "./normalize";

/** Suspense Resource wrapper (read throws while pending). */
export type Resource<T> = { read(): T };
/** Progress state for discovery. */
export type DiscoveryState = { current?: string; tried: string[]; found?: string | null };

const EXTS = CONFIG_EXTS as readonly string[];

/** Build discovery candidates matching server resolution order. */
function candidatesFor(base: string): string[] {
  const abs = path.resolve(base);
  const ext = path.extname(abs);
  if (ext && EXTS.includes(ext)) {
    return [abs];
  }
  const listA = EXTS.map((e) => `${abs}${e}`);
  const listB = EXTS.map((e) => path.join(abs, `${DEFAULT_CONFIG_STEM}${e}`));
  return [...listA, ...listB];
}

/** Wrap a promise as a Suspense resource. */
function createResourceFrom(p: Promise<string | null>): Resource<string | null> {
  const box: { status: "pending" | "resolved" | "rejected"; result: string | null; error: unknown } = {
    status: "pending",
    result: null,
    error: null,
  };
  const prom = p
    .then((v) => {
      box.status = "resolved";
      box.result = v;
    })
    .catch((e) => {
      box.status = "rejected";
      box.error = e;
    });
  return {
    read(): string | null {
      if (box.status === "pending") {
        throw prom;
      }
      if (box.status === "rejected") {
        throw box.error;
      }
      return box.result;
    },
  };
}

/** Create a discovery helper for a base stem or directory. */
export function createConfigDiscovery(base: string): {
  resource: Resource<string | null>;
  subscribe: (f: (s: DiscoveryState) => void) => () => void;
  getState: () => DiscoveryState;
} {
  const state: DiscoveryState = { tried: [] };
  const listeners: ((s: DiscoveryState) => void)[] = [];
  function notify(next: DiscoveryState): void {
    for (const fn of listeners) {
      fn(next);
    }
  }
  async function probe(list: string[]): Promise<string | null> {
    for (const cand of list) {
      const nextState: DiscoveryState = { current: cand, tried: [...state.tried, cand], found: undefined };
      state.current = cand;
      state.tried = nextState.tried;
      notify(nextState);
      try {
        await access(cand, FS.F_OK);
        const done: DiscoveryState = { current: cand, tried: state.tried, found: cand };
        state.found = cand;
        notify(done);
        return cand;
      } catch (e) {
        // Only continue on expected "not found / not a directory" errors.
        if (hasErrorCode(e)) {
          const code = String((e as { code?: unknown }).code);
          if (code === "ENOENT" || code === "ENOTDIR") {
            // continue to next candidate
            continue;
          }
        }
        // Unexpected errors propagate to help diagnosis.
        throw e;
      }
    }
    const done: DiscoveryState = { current: undefined, tried: state.tried, found: null };
    notify(done);
    return null;
  }
  const res = createResourceFrom(Promise.resolve().then(() => probe(candidatesFor(base))));
  return {
    resource: res,
    subscribe(f: (s: DiscoveryState) => void): () => void {
      const arr = [...listeners, f];
      listeners.splice(0, listeners.length, ...arr);
      return () => {
        const left = listeners.filter((x) => x !== f);
        listeners.splice(0, listeners.length, ...left);
      };
    },
    getState(): DiscoveryState {
      return { current: state.current, tried: [...state.tried], found: state.found ?? null };
    },
  };
}

/** Get a new discovery helper using default stem when omitted. */
export function getConfigDiscovery(base = `./${DEFAULT_CONFIG_STEM}`) {
  return createConfigDiscovery(base);
}

/** Convenience Suspense resource for default discovery. */
export function defaultConfigResource(): Resource<string | null> {
  return getConfigDiscovery().resource;
}

// -------------------- load + normalize (suspends on IO) --------------------
/** Progress state for load + normalize phases. */
export type LoadState = DiscoveryState & { phase: "resolving" | "loading" | "normalized"; error?: string };

/** Create a loader that resolves a config and validates it (suspends while pending). */
export function createConfigLoad(base: string): {
  resource: Resource<string | null>;
  subscribe: (f: (s: LoadState) => void) => () => void;
  getState: () => LoadState;
} {
  const disc = createConfigDiscovery(base);
  const state: LoadState = { ...disc.getState(), phase: "resolving" };
  const listeners: ((s: LoadState) => void)[] = [];
  function notify(next: LoadState): void {
    for (const fn of listeners) {
      fn(next);
    }
  }

  const loadCache = new Map<
    string,
    { status: "pending" | "done" | "error"; promise: Promise<void>; error?: unknown }
  >();

  const res: Resource<string | null> = {
    read(): string | null {
      const found = disc.resource.read();
      state.found = found ?? null;
      if (!found) {
        return null;
      }
      const existing = loadCache.get(found);
      if (!existing) {
        state.phase = "loading";
        notify({ ...state });
        const promise = loadConfigModule(found)
          .then((raw) => normalizeConfig(raw))
          .then(() => {
            loadCache.set(found, { status: "done", promise });
            state.phase = "normalized";
            notify({ ...state });
          })
          .catch((e) => {
            loadCache.set(found, { status: "error", promise, error: e });
            state.error = String((e as { message?: unknown })?.message ?? e);
            notify({ ...state });
            throw e;
          });
        loadCache.set(found, { status: "pending", promise });
        throw promise;
      }
      if (existing.status === "pending") {
        throw existing.promise;
      }
      if (existing.status === "error") {
        throw existing.error;
      }
      return found;
    },
  };

  return {
    resource: res,
    subscribe(f: (s: LoadState) => void) {
      const next = [...listeners, f];
      listeners.splice(0, listeners.length, ...next);
      return () => listeners.splice(0, listeners.length, ...listeners.filter((x) => x !== f));
    },
    getState() {
      return { ...state };
    },
  };
}

/** Get a new loader using default stem when omitted. */
export function getConfigLoad(base = `./${DEFAULT_CONFIG_STEM}`) {
  return createConfigLoad(base);
}
