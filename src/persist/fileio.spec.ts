/**
 * @file Spec to prevent regression of FileIO path handling spilling files into project root.
 */
import path from "node:path";
import { mkdir, rm, stat, readdir } from "node:fs/promises";

import { createVectorLite, vlite } from "../index";
import { createNodeFileIO } from "./node";

async function fileExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

describe("persist/FileIO path isolation", () => {
  it("saves index/data under the given base directory and not CWD", async () => {
    const cwd = process.cwd();
    const outRoot = path.join(cwd, ".tmp", `spec-fileio-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
    const dataRoot = path.join(outRoot, "data");
    await mkdir(outRoot, { recursive: true });

    // create small DB
    const db = createVectorLite<{ tag?: string }>({ dim: 2, metric: "cosine", strategy: "bruteforce" });
    db.add(1, new Float32Array([1, 0]), { tag: "a" });
    db.add(2, new Float32Array([0, 1]), { tag: "b" });
    db.add(3, new Float32Array([0.5, 0.5]), null);

    // bind env with prefixed IO, shards>1 to fan out data dirs
    const { index, db: dbEnv } = vlite<{ tag?: string }>(
      {
        index: createNodeFileIO(outRoot),
        data: (key: string) => createNodeFileIO(path.join(dataRoot, key)),
      },
      { shards: 2, segmented: true, segmentBytes: 1 << 14, includeAnn: false },
    );

    try {
      // save snapshot
      await index.save(db, { baseName: "db" });

      // expect index files under outRoot
      expect(await fileExists(path.join(outRoot, "db.index"))).toBe(true);
      expect(await fileExists(path.join(outRoot, "db.catalog.json"))).toBe(true);
      expect(await fileExists(path.join(outRoot, "db.manifest.json"))).toBe(true);

      // expect at least one .data file under dataRoot/*/
      const shardDirs = (await fileExists(dataRoot)) ? await readdir(dataRoot) : [];
      const dataFiles: string[] = [];
      for (const d of shardDirs) {
        const full = path.join(dataRoot, d);
        try {
          const files = await readdir(full);
          for (const f of files) if (f.endsWith(".data")) dataFiles.push(path.join(full, f));
        } catch {}
      }
      expect(dataFiles.length).toBeGreaterThan(0);

      // ensure nothing leaked to CWD root (previous regression)
      expect(await fileExists(path.join(cwd, "db.index"))).toBe(false);
      expect(await fileExists(path.join(cwd, "db.catalog.json"))).toBe(false);
      expect(await fileExists(path.join(cwd, "db.manifest.json"))).toBe(false);

      // roundtrip open from saved index to ensure env paths are valid
      const state = await index.openState({ baseName: "db" });
      const db2 = dbEnv.from(state);
      const hits = db2.search(new Float32Array([1, 0]), { k: 1 });
      expect(hits.length).toBe(1);
      expect([1, 2, 3]).toContain(hits[0].id);
    } finally {
      // cleanup
      await rm(outRoot, { recursive: true, force: true });
      // and ensure root files are absent (cleanup if created by bug)
      await rm(path.join(cwd, "db.index"), { force: true });
      await rm(path.join(cwd, "db.catalog.json"), { force: true });
      await rm(path.join(cwd, "db.manifest.json"), { force: true });
    }
  });
});

