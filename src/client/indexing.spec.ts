/**
 * @file Tests for client indexing helpers (createIndexOps)
 */
import { createIndexOps } from "./indexing";
import type { FileIO } from "../storage/types";

function makeIO(overrides: Partial<FileIO> = {}): FileIO {
  return {
    async read(p: string) {
      void p;
      throw new Error("not implemented");
    },
    async write(p: string, d: Uint8Array | ArrayBuffer) {
      void p;
      void d; /* noop */
    },
    async append(p: string, d: Uint8Array | ArrayBuffer) {
      void p;
      void d; /* noop */
    },
    async atomicWrite(p: string, d: Uint8Array | ArrayBuffer) {
      void p;
      void d; /* noop */
    },
    ...overrides,
  };
}

describe("client/indexing", () => {
  it("checkPlacement returns ok=false with plan when manifest mismatches crush", async () => {
    const manifest = { segments: [{ name: "seg.pg1.0", targetKey: "x" }] };
    const indexIO = makeIO({
      read: async (p) => {
        void p;
        return new TextEncoder().encode(JSON.stringify(manifest));
      },
    });
    const ops = createIndexOps<{ t?: string }>({ index: indexIO, data: indexIO }, { shards: 1 });
    const { ok, plan } = await ops.checkPlacement("seg");
    expect(ok).toBe(false);
    expect((plan ?? []).length).toBeGreaterThan(0);
  });

  it("checkPlacement returns ok=true when manifest missing or read fails", async () => {
    const indexIO = makeIO({
      read: async (_p: string) => {
        void _p;
        throw new Error("no file");
      },
    });
    const ops = createIndexOps<{ t?: string }>({ index: indexIO, data: indexIO }, {});
    const { ok } = await ops.checkPlacement("any");
    expect(ok).toBe(true);
  });

  it("ensurePlacement warns and returns ok=false without auto/strict; throws with strict", async () => {
    const manifest = { segments: [{ name: "seg.pg1.0", targetKey: "x" }] };
    const indexIO = makeIO({
      read: async (p) => {
        void p;
        return new TextEncoder().encode(JSON.stringify(manifest));
      },
    });
    const ops = createIndexOps<{ t?: string }>({ index: indexIO, data: indexIO }, { shards: 1 });
    const res = await ops.ensurePlacement("seg", { auto: false, strict: false });
    expect(res.ok).toBe(false);
    await expect(ops.ensurePlacement("seg", { strict: true })).rejects.toThrow(/Placement mismatch/);
  });
});
