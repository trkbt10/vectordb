/**
 * @file CommonJS config using explicit FileIO shape
 */
/* eslint-disable no-undef -- Allow CommonJS module.exports in test mock config */
const store = new Map();
const toU8 = (d) => (d instanceof Uint8Array ? d : new Uint8Array(d));
const io = {
  read: async (p) => {
    if (!store.has(p)) {
      throw new Error("file not found: " + p);
    }
    return new Uint8Array(store.get(p));
  },
  write: async (p, d) => {
    store.set(p, toU8(d));
  },
  append: async (p, d) => {
    const prev = store.get(p);
    const next = toU8(d);
    if (!prev) {
      store.set(p, next);
      return;
    }
    const merged = new Uint8Array(prev.length + next.length);
    merged.set(prev, 0);
    merged.set(next, prev.length);
    store.set(p, merged);
  },
  atomicWrite: async (p, d) => {
    store.set(p, toU8(d));
  },
};

module.exports = {
  name: "mock-fileio",
  database: { dim: 2 },
  storage: { index: io, data: io },
};
