/**
 * @file Debug scenario for write-ahead log (WAL) behavior.
 */

/**
 * VectorLite WAL Demo (console-based)
 * - Appends WAL (upsert/setMeta/remove)
 * - Applies WAL to in-memory DB
 * - Atomic snapshot checkpoint
 * - Crash simulation and recovery from snapshot + WAL
 */
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import { createVectorLiteState as createVectorLite } from "../../../src/vectorlite/create";
import { size, getMeta, search } from "../../../src/vectorlite/ops/core";
import { serialize, deserializeVectorLite } from "../../../src/vectorlite/serialize";
import { encodeWal, applyWal } from "../../../src/wal";
import { appendToFileNode, saveAtomicToFileNode, loadFromFileNode } from "../../../src/persist/node";
import type { WalRecord } from "../../../src/wal";
import type { VectorLiteState } from "../../../src/types";

type Meta = { tag?: string };

const ts = () => new Date().toISOString().split("T")[1].replace("Z", "");
const log = (m: string) => console.log(`[${ts()}] ${m}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const SNAPSHOT = path.join(process.cwd(), "debug", "wal-out", "db.vlite");
const WAL = path.join(process.cwd(), "debug", "wal-out", "db.vlite.wal");

async function main() {
  console.log("VectorLite WAL Demo — console mode");
  console.log(`Snapshot: ${SNAPSHOT}`);
  console.log(`WAL     : ${WAL}`);
  const outDir = path.dirname(SNAPSHOT);
  await mkdir(outDir, { recursive: true });

  // Init empty DB, snapshot, and WAL
  let db: VectorLiteState<Meta> = createVectorLite<Meta>({ dim: 3, metric: "cosine" });
  await saveAtomicToFileNode(serialize(db), SNAPSHOT);
  await writeFile(WAL, new Uint8Array());
  log("Initialized empty snapshot and WAL");

  // WAL 1: upsert 1
  {
    const recs: WalRecord[] = [{ type: "upsert", id: 1, vector: new Float32Array([1, 0, 0]), meta: { tag: "alpha" } }];
    const wal = encodeWal(recs);
    await appendToFileNode(wal, WAL);
    applyWal(db, wal);
    const walSize = (await readFile(WAL)).byteLength;
    log(`Upsert id=1, tag=alpha (WAL+apply). size=${size(db)}, wal=${walSize}B`);
    await sleep(200);
  }

  // WAL 2: upsert 2 & setMeta 1
  {
    const recs: WalRecord[] = [
      { type: "upsert", id: 2, vector: new Float32Array([0.9, 0, 0]), meta: { tag: "beta" } },
      { type: "setMeta", id: 1, meta: { tag: "alpha2" } },
    ];
    const wal = encodeWal(recs);
    await appendToFileNode(wal, WAL);
    applyWal(db, wal);
    const walSize = (await readFile(WAL)).byteLength;
    log(`Upsert id=2, tag=beta; setMeta id=1->alpha2. size=${size(db)}, wal=${walSize}B`);
    await sleep(200);
  }

  // WAL 3: upsert 3 & remove 2
  {
    const recs: WalRecord[] = [
      { type: "upsert", id: 3, vector: new Float32Array([0, 1, 0]), meta: { tag: "gamma" } },
      { type: "remove", id: 2 },
    ];
    const wal = encodeWal(recs);
    await appendToFileNode(wal, WAL);
    applyWal(db, wal);
    const walSize = (await readFile(WAL)).byteLength;
    log(`Upsert id=3, tag=gamma; remove id=2. size=${size(db)}, wal=${walSize}B`);
    await sleep(200);
  }

  // Query view
  {
    const hits = search(db, new Float32Array([1, 0, 0]), { k: 3 });
    log(`Search([1,0,0]) => [${hits.map((h) => `${h.id}:${h.meta?.tag ?? ""}`).join(", ")}]`);
    log(`Meta(1)=${JSON.stringify(getMeta(db, 1))}`);
    await sleep(150);
  }

  // Checkpoint
  await saveAtomicToFileNode(serialize(db), SNAPSHOT);
  log("Checkpoint saved (atomic)");
  await sleep(150);

  // Simulate crash
  log("Simulating crash: dropping in-memory DB (reloading fresh instance next)");
  await sleep(150);

  // Recovery from snapshot + WAL
  {
    const snapBuf = await loadFromFileNode(SNAPSHOT);
    const db2 = deserializeVectorLite<Meta>(snapBuf);
    const walBytes = new Uint8Array(await readFile(WAL));
    applyWal(db2, walBytes);
    db = db2;
    log(`Recovered: size=${size(db)}, wal=${walBytes.byteLength}B`);
    const hits = search(db, new Float32Array([1, 0, 0]), { k: 3 });
    log(`Post-recovery Search([1,0,0]) => [${hits.map((h) => `${h.id}:${h.meta?.tag ?? ""}`).join(", ")}]`);
    await sleep(150);
  }

  // Final checkpoint & rotate WAL
  await saveAtomicToFileNode(serialize(db), SNAPSHOT);
  await writeFile(WAL, new Uint8Array());
  log("Final checkpoint saved; WAL rotated (cleared)");
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
