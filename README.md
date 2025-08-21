# vector-db (WIP)

![CI](https://github.com/trkbt10/vector-db/actions/workflows/test.yml/badge.svg?branch=main)
![Coverage](https://codecov.io/gh/trkbt10/vector-db/graph/badge.svg?branch=main)

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
npm install vcdb
# or
pnpm add vcdb
# or
yarn add vcdb
```

CLI (via npx or global install):

```bash
npx vcdb          # run once without installing
# or
npm install -g vcdb
vcdb              # launch the interactive CLI
```

## Quick Start (API)

```ts
import { connect } from "vcdb";
import { createNodeFileIO } from "vcdb/storage/node";

// Open existing by name ("db"); if missing, create then save
const client = await connect<{ tag?: string }>({
  storage: {
    index: createNodeFileIO("./.vcdb"),
    data: createNodeFileIO("./.vcdb/data"),
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

- Node.js: `import { createNodeFileIO } from "vcdb/storage/node"`
- Memory: `import { createMemoryFileIO } from "vcdb/storage/memory"`
- OPFS (browser): `import { saveToOPFS, loadFromOPFS } from "vcdb/storage/opfs"`
- S3: implement a `FileIO` using the AWS SDK (see example below)

All adapters implement the same `FileIO` interface:

```ts
import type { FileIO } from "vcdb/storage/types";
```

### Example: CRUSH + S3 (AWS SDK) + Lambda frontend

This example shows how to split data segments across S3 using CRUSH (shards/replicas), while serving index and data I/O through simple Lambda endpoints that return presigned URLs.

Client (Node.js or server):

```ts
import { connect } from "vcdb";
import type { FileIO } from "vcdb/storage/types";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({ region: process.env.AWS_REGION });

// Minimal FileIO backed by AWS SDK
function s3FileIOFor(prefix: string): FileIO {
  function parse(key: string) {
    // Supports either raw keys or s3://bucket/prefix form
    if (prefix.startsWith("s3://")) {
      const u = new URL(prefix);
      return { Bucket: u.hostname, Key: `${u.pathname.replace(/^\//, "")}${key}` };
    }
    return { Bucket: process.env.S3_BUCKET!, Key: `${prefix}${key}` };
  }
  return {
    async read(key: string) {
      const { Bucket, Key } = parse(key);
      const res = await s3.send(new GetObjectCommand({ Bucket, Key }));
      const buf = await res.Body!.transformToByteArray();
      return new Uint8Array(buf);
    },
    async write(key: string, data: Uint8Array | ArrayBuffer) {
      const { Bucket, Key } = parse(key);
      const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
      await s3.send(new PutObjectCommand({ Bucket, Key, Body: bytes }));
    },
    async append(key: string, data: Uint8Array | ArrayBuffer) {
      // Emulate append with read+concat+write
      const prev = await this.read(key).catch(() => new Uint8Array());
      const next = data instanceof Uint8Array ? data : new Uint8Array(data);
      const merged = new Uint8Array(prev.length + next.length);
      merged.set(prev, 0);
      merged.set(next, prev.length);
      await this.write(key, merged);
    },
    async atomicWrite(key: string, data: Uint8Array | ArrayBuffer) {
      await this.write(key, data);
    },
    async del(key: string) {
      const { Bucket, Key } = parse(key);
      await s3.send(new DeleteObjectCommand({ Bucket, Key }));
    },
  };
}

// Map CRUSH targetKey → S3 prefix. For example, across 3 buckets/prefixes.
const DATA_PREFIXES: Record<string, string> = {
  "0": "s3://bucket-a/data/",
  "1": "s3://bucket-b/data/",
  "2": "s3://bucket-c/data/",
};

const client = await connect<{ tag?: string }>({
  storage: {
    // Index artifacts (catalog/manifests/index file)
    index: s3FileIOFor("s3://bucket-index/index/"),
    // Data segments: CRUSH assigns a targetKey; return a FileIO for that location
    data: (targetKey: string) => s3FileIOFor(DATA_PREFIXES[targetKey] ?? DATA_PREFIXES["0"]),
  },
  database: { dim: 128, metric: "cosine", strategy: "hnsw", hnsw: { M: 16, efSearch: 50 } },
  index: {
    name: "products",
    shards: 3, // number of CRUSH targets
    replicas: 2, // write replicas per segment
    pgs: 64, // placement groups (higher → smoother distribution)
    segmented: true, // write segment files
    includeAnn: true, // persist ANN when saving
  },
});

// Upsert data as usual; CRUSH determines where segments go on save
client.upsert(
  { id: 1, vector: new Float32Array(128), meta: { tag: "a" } },
  { id: 2, vector: new Float32Array(128), meta: { tag: "b" } },
);

// Save snapshot (writes index + data segments to S3 via the API)
await client.index.saveState(client.state, { baseName: "products" });
```

Alternative: If you prefer presigned URLs, front your S3 with Lambda/API Gateway that returns signed GET/PUT/DELETE URLs, then implement a FileIO that fetches those URLs.

Notes:

- CRUSH uses `shards`, `replicas`, and `pgs` to place segments across `storage.data(targetKey)` destinations.
- Index files typically live in a single place (one FileIO) while data segments fan out.
- For read paths, `index.openState({ baseName })` resolves segment locations via manifest, falling back to CRUSH if needed.
