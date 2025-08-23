/**
 * @file Tests for data segmenter (writeSegments)
 */

import { writeSegments } from "./segmenter";
import { createState } from "../../attr/state/create";
import type { CrushMap } from "../types";
import { createMemoryFileIO } from "../../storage/memory";

describe("indexing/segmenter", () => {
  it("writes segments and returns pointers/manifest", async () => {
    const vl = createState<{ tag?: string }>({ dim: 2, metric: "cosine", strategy: "bruteforce" });
    for (let i = 0; i < 5; i++) {
      vl.store.ids[i] = i + 1;
      vl.store.data.set(new Float32Array([i, i + 1]), i * 2);
      vl.store.metas[i] = null;
      vl.store.pos.set(i + 1, i);
      vl.store._count = i + 1;
    }
    const crush: CrushMap = { pgs: 8, replicas: 1, targets: [{ key: "X" }, { key: "Y" }] };
    const stores: Record<string, ReturnType<typeof createMemoryFileIO>> = {
      X: createMemoryFileIO(),
      Y: createMemoryFileIO(),
    };
    const res = await writeSegments(vl, {
      baseName: "db",
      crush,
      resolveDataIO: (k) => stores[k],
      segmented: true,
      segmentBytes: 1 << 14,
    });
    expect(res.entries.length).toBe(5);
    // Ensure at least one segment file exists on the designated target according to manifest
    // eslint-disable-next-line no-restricted-syntax -- Test: tracking if any segment exists
    let any = false;
    for (const seg of res.manifest.segments) {
      const io = stores[seg.targetKey];
      try {
        await io.read(`${seg.name}.data`);
        any = true;
        break;
      } catch {
        /* ignore */
      }
    }
    expect(any).toBeTruthy();
  });

  it("rotates to new part when segmented size exceeds limit", async () => {
    const vl = createState<{ tag?: string }>({ dim: 2, metric: "cosine", strategy: "bruteforce" });
    // Prepare enough rows to exceed a very small segmentBytes threshold
    for (let i = 0; i < 3; i++) {
      vl.store.ids[i] = i + 1;
      vl.store.data.set(new Float32Array([i, i + 1]), i * 2);
      vl.store.metas[i] = null;
      vl.store.pos.set(i + 1, i);
      vl.store._count = i + 1;
    }
    const crush: CrushMap = { pgs: 1, replicas: 1, targets: [{ key: "Z" }] };
    const store = createMemoryFileIO();
    const { entries, manifest } = await writeSegments(vl, {
      baseName: "rot",
      crush,
      resolveDataIO: () => store,
      segmented: true,
      segmentBytes: 64, // tiny threshold to force rotation
    });
    const segNames = new Set(entries.map((e) => e.ptr.segment));
    expect(Array.from(segNames).some((n) => n.endsWith("part0"))).toBe(true);
    expect(Array.from(segNames).some((n) => n.endsWith("part1"))).toBe(true);
    // Manifest reflects only current writer per PG; ensure it exists
    expect(manifest.segments.length).toBeGreaterThan(0);
  });
});
