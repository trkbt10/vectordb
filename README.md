# VectorDB

![CI](https://github.com/trkbt10/vectordb/actions/workflows/test.yml/badge.svg)
![Coverage](https://codecov.io/gh/trkbt10/vectordb/graph/badge.svg)

Minimal, dependency‑free vector database with pluggable ANN strategies (bruteforce, HNSW, IVF), attribute filtering, and a clean persistence model (index/data split with CRUSH placement). Runs in Node.js, browsers (OPFS), Electron, and Tauri.

## Features

- Pluggable ANN: bruteforce, HNSW, IVF (with retraining)
- Attribute filtering: callback or expression based
- Persistence: index/data separation, CRUSH placement, manifest + catalog
- Storage backends: Node FS, Memory, OPFS, S3
- Single, knex‑like `connect()` API to open or create
- Tiny CLI for quick inspection, search, edit, rebuild

## Install

```bash
npm install vectordb
# or
pnpm add vectordb
# or
yarn add vectordb
```

CLI (via npx or global install):

```bash
npx vectordb          # run once without installing
# or
npm install -g vectordb
vectordb              # launch the interactive CLI
```

## Quick Start (API)

```ts
import { connect } from "vectordb";
import { createNodeFileIO } from "vectordb/storage/node";

// Open existing by name ("db"); if missing, create then save
const client = await connect<{ tag?: string }>({
  storage: {
    index: createNodeFileIO("./.vectordb"),
    data: createNodeFileIO("./.vectordb/data"),
  },
  database: { dim: 3, metric: "cosine", strategy: "bruteforce" },
  index: { name: "db", shards: 1, segmented: true },
});

client.set(1, { vector: new Float32Array([1, 0, 0]), meta: { tag: "a" } });
client.set(2, { vector: new Float32Array([0, 1, 0]), meta: { tag: "b" } });

const hits = client.findMany(new Float32Array([1, 0, 0]), { k: 2 });
console.log(hits);

// Persist snapshot
await client.index.saveState(client.state, { baseName: "db" });
```

## Persistence Adapters

Import per environment:

- Node.js: `import { createNodeFileIO } from "vectordb/storage/node"`
- Memory: `import { createMemoryFileIO } from "vectordb/storage/memory"`
- OPFS (browser): `import { saveToOPFS, loadFromOPFS } from "vectordb/storage/opfs"`
- S3: `import { createS3FileIO } from "vectordb/storage/s3"`

All adapters implement the same `FileIO` interface:

```ts
import type { FileIO } from "vectordb/storage/types";
```

## Concepts

- Vector store state is in‑memory; the client is a thin facade around it
- `connect()` prefers opening an existing snapshot; only creates when absent
- Persistence uses separate index and data stores; CRUSH decides data placement
- ANN artifacts can be rebuilt from data if index files are missing
