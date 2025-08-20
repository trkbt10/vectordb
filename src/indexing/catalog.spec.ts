/**
 * @file Tests for catalog read/write
 */

import { writeCatalog, readCatalog } from "./catalog";
import { createMemoryFileIO } from "../storage/memory";

describe("indexing/catalog", () => {
  it("writes and reads catalog.json", async () => {
    const io = createMemoryFileIO();
    const resolveIndexIO = () => io;
    await writeCatalog("dbz", { dim: 5, metricCode: 0, strategyCode: 1 }, { resolveIndexIO });
    const cat = await readCatalog("dbz", { resolveIndexIO });
    expect(cat).not.toBeNull();
    expect(cat!.dim).toBe(5);
    expect(cat!.metricCode).toBe(0);
    expect(cat!.strategyCode).toBe(1);
  });
});
