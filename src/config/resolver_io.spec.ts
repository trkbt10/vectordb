/**
 * @file Specs: IO resolver utilities and registry
 */
import { builtinRegistry, createStorageFromRaw, mergeRegistry, toURL } from "./resolver_io";

describe("config/resolver_io", () => {
  it("toURL infers file: scheme for bare paths and preserves explicit schemes", () => {
    const a = toURL("/tmp/foo");
    expect(a.protocol).toBe("file:");
    const b = toURL("mem:");
    expect(b.protocol).toBe("mem:");
    const c = toURL("file:/var/db");
    expect(c.protocol).toBe("file:");
  });

  it("mergeRegistry overlays providers by key without losing members", () => {
    const r1 = { a: { indexFactory: () => ({ read: async () => new Uint8Array(), write: async () => {}, append: async () => {}, atomicWrite: async () => {} }) } };
    const r2 = { a: { dataFactory: () => ({ read: async () => new Uint8Array(), write: async () => {}, append: async () => {}, atomicWrite: async () => {} }) }, b: {} };
    const merged = mergeRegistry(r1, r2);
    expect(Object.keys(merged).sort()).toEqual(["a", "b"]);
    expect(typeof merged.a.indexFactory).toBe("function");
    expect(typeof merged.a.dataFactory).toBe("function");
  });

  it("createStorageFromRaw resolves index and data using builtin registry and supports {ns} templates", () => {
    const cfg = { index: "mem:", data: "mem:{ns}" };
    const storage = createStorageFromRaw(cfg, builtinRegistry);
    const io1 = storage.data("alpha");
    const io2 = storage.data("beta");
    expect(io1).not.toBe(io2);
  });

  it("createStorageFromRaw resolves mapped data URIs and caches per key", () => {
    const cfg = { index: "mem:", data: { a: "mem:", b: "mem:" } } as const;
    const storage = createStorageFromRaw(cfg, builtinRegistry);
    const a1 = storage.data("a");
    const a2 = storage.data("a");
    expect(a1).toBe(a2);
    expect(() => storage.data("c")).toThrow(/No data URI configured/);
  });

  it("throws when no provider for scheme exists", () => {
    const bad = { index: "unknown:", data: "unknown:" };
    expect(() => createStorageFromRaw(bad as never, builtinRegistry)).toThrow(/No index resolver/);
  });
});

