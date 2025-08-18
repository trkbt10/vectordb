/**
 * @file Debug utilities for persisting runtime state during local scenarios.
 */

import { saveToFileNode, loadFromFileNode } from "../src/persist/node.ts";
import { createVectorLiteState } from "../src/vectorlite/create.ts";
import { add, search } from "../src/vectorlite/ops/core.ts";
import { deserializeVectorLite, serialize } from "../src/vectorlite/serialize.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(String(msg));
}

async function runBruteforce() {
  const db = createVectorLiteState<{ tag: string }>({ dim: 3, metric: "cosine", strategy: "bruteforce" });
  add(db, 1, new Float32Array([1, 0, 0]), { tag: "A" });
  add(db, 2, new Float32Array([0.9, 0, 0]), { tag: "B" });
  add(db, 3, new Float32Array([0, 1, 0]), { tag: "C" });

  const q = new Float32Array([0.95, 0, 0]);
  const before = search(db, q, { k: 2 });

  const buf = serialize(db);
  await saveToFileNode(buf, "debug/vlite.brute.bin");

  const buf2 = await loadFromFileNode("debug/vlite.brute.bin");
  const db2 = deserializeVectorLite<{ tag: string }>(buf2);
  const after = search(db2, q, { k: 2 });

  assert(before.length === after.length, "bruteforce length mismatch");
  assert(before[0].id === after[0].id && before[1].id === after[1].id, "bruteforce ids mismatch");
}

async function runHNSW() {
  const dim = 4;
  const db = createVectorLiteState<{ tag: string }>({
    dim,
    strategy: "hnsw",
    hnsw: { M: 8, efConstruction: 32, efSearch: 16, seed: 123 },
  });
  add(db, 1, new Float32Array([1, 0, 0, 0]), { tag: "A" });
  add(db, 2, new Float32Array([0.9, 0, 0, 0]), { tag: "B" });
  add(db, 3, new Float32Array([0, 1, 0, 0]), { tag: "C" });
  add(db, 4, new Float32Array([0, 0.9, 0, 0]), { tag: "D" });

  const q = new Float32Array([0.95, 0, 0, 0]);
  const before = search(db, q, { k: 2 });

  const buf = serialize(db);
  await saveToFileNode(buf, "debug/vlite.hnsw.bin");

  const buf2 = await loadFromFileNode("debug/vlite.hnsw.bin");
  const db2 = deserializeVectorLite<{ tag: string }>(buf2);
  const after = search(db2, q, { k: 2 });

  assert(after.length === 2 && before.length === 2, "hnsw length mismatch");
  // 順序は同一ヒットであることを軽くチェック
  const idsA = before.map((h) => h.id).sort();
  const idsB = after.map((h) => h.id).sort();
  assert(idsA[0] === idsB[0] && idsA[1] === idsB[1], "hnsw ids mismatch");
}

async function main() {
  await runBruteforce();
  await runHNSW();
  console.log("Persist/Restore: PASS (bruteforce + hnsw)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
