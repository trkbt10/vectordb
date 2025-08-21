/**
 * @file Tests for index persistence wrappers (persist/open/rebuild)
 */
import { createState } from "../state/create";
import { add } from "./core";
import { persistIndex, openFromIndex, rebuildFromData } from "./index_persist";
import { createMemoryFileIO } from "../../storage/memory";
import type { CrushMap } from "../../indexing/types";

test("persistIndex / openFromIndex / rebuildFromData wrappers work", async () => {
  const dim = 3;
  const db = createState<{ t?: string }>({ dim, strategy: "hnsw", hnsw: { M: 4, efConstruction: 16, efSearch: 8 } });
  add(db, 1, new Float32Array([1, 0, 0]), { t: "a" });
  add(db, 2, new Float32Array([0, 1, 0]), { t: "b" });
  const dataStores: Record<string, ReturnType<typeof createMemoryFileIO>> = { a: createMemoryFileIO(), b: createMemoryFileIO() };
  const indexStore = createMemoryFileIO();
  const crush: CrushMap = { pgs: 4, replicas: 1, targets: [{ key: "a" }, { key: "b" }] };
  const resolveDataIO = (k: string) => dataStores[k];
  const resolveIndexIO = () => indexStore;
  await persistIndex(db, { baseName: "wrap", crush, resolveDataIO, resolveIndexIO, segmented: true, segmentBytes: 1 << 20, includeAnn: false });
  const opened = await openFromIndex<{ t?: string }>({ baseName: "wrap", crush, resolveDataIO, resolveIndexIO });
  expect(opened.dim).toBe(dim);
  const rebuilt = await rebuildFromData<{ t?: string }>({ baseName: "wrap", crush, resolveDataIO, resolveIndexIO });
  expect(rebuilt.dim).toBe(dim);
});

