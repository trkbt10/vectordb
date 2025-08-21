/**
 * @file Tests for Node.js FileIO adapter
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as joinPath } from "node:path";
import { createNodeFileIO } from "./node";

describe("storage/node", () => {
  it("read/write/append/atomicWrite/del work on filesystem", async () => {
    const dir = mkdtempSync(joinPath(tmpdir(), "vcdb-io-"));
    try {
      const io = createNodeFileIO(dir);
      await io.write("a/b.txt", new Uint8Array([1, 2]));
      await io.append("a/b.txt", new Uint8Array([3]));
      const r1 = await io.read("a/b.txt");
      expect(Array.from(r1)).toEqual([1, 2, 3]);
      await io.atomicWrite("a/b.txt", new Uint8Array([9]));
      const r2 = await io.read("a/b.txt");
      expect(Array.from(r2)).toEqual([9]);
      await io.del!("a/b.txt");
      await expect(io.read("a/b.txt")).rejects.toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
