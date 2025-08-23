# vcdb (WIP)

[![CI](https://github.com/trkbt10/vectordb/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/trkbt10/vectordb/actions/workflows/test.yml)
![Coverage](https://codecov.io/gh/trkbt10/vcdb/graph/badge.svg?branch=main)

Minimal, dependency‑free vector database with pluggable ANN strategies (bruteforce, HNSW, IVF), attribute filtering, and a clean persistence model (index/data split with CRUSH placement). Runs in Node.js, browsers (OPFS), Electron, and Tauri.

## Features

- ANN strategies: bruteforce, HNSW, IVF
- Attribute filtering: callback or expression
- Persistence: index/data split, CRUSH placement, manifest + catalog
- Storage backends: Node FS, Memory, OPFS, S3
- `connect()` API: open existing or create
- CLI: inspect, search, edit, rebuild

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
EOF < /dev/null

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

# Configuration

The project loads a top‑level config named `vectordb.config[mjs/mts/ts/cjs/js]` from the current directory (or a given base path).

- Patterns: `vectordb.config[.mjs/.mts/.ts/.cjs/.js]`
- Locations: `./vectordb.config.*` or `./<dir>/vectordb.config.*`

## Storage Options

The `storage` field accepts FileIOs, URI strings, or a mix. Built‑in registries support `file:` and `mem:` schemes.

- `index`: `string | FileIO`
- `data`: `string | Record<string,string> | FileIO | (ns: string) => FileIO`

Examples:

```ts
// URI-based, portable config
export default defineConfig({
  name: "db",
  storage: {
    index: ".vectordb/index",     // resolved as file:.vectordb/index
    data: ".vectordb/data/{ns}",  // {ns} expands to top-level name
  },
  database: { dim: 3, metric: "cosine", strategy: "bruteforce" },
  index: { segmented: true },
});
```

```ts
// Mixed: explicit FileIO for index, template for data
export default defineConfig({
  name: "db",
  storage: {
    index: createNodeFileIO(".vectordb/index"),
    data: "mem:{ns}",
  },
  database: { dim: 2 },
});
```

```ts
// Fully explicit FileIOs (including a function for data)
export default defineConfig({
  name: "db",
  storage: {
    index: createMemoryFileIO(),
    data: (ns) => createMemoryFileIO(),
  },
  database: { dim: 2 },
});
```

Notes:

- When using TypeScript configs directly, a TS loader may be required in some environments. Alternatively, use `.mjs/.js`.

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

## Storage Adapters

Import per environment:

- Node.js: `import { createNodeFileIO } from "vcdb/storage/node"`
- Memory: `import { createMemoryFileIO } from "vcdb/storage/memory"`
- OPFS (browser): `import { saveToOPFS, loadFromOPFS } from "vcdb/storage/opfs"`
- S3: implement a `FileIO` using the AWS SDK (see example below)

All adapters implement the same `FileIO` interface:

```ts
import type { FileIO } from "vcdb/storage/types";
```

## CLI

The `vcdb` CLI supports an interactive TUI and a server mode.

- Default: run the interactive UI.
- `serve`: start the HTTP server from an executable config.

Usage:

```
vcdb [command] [options]

Commands:
  serve                 Start HTTP server using config (required)

Options:
  --config, -c <path>   Path to executable config (vectordb.config.*)
  --port, -p <number>   Override server.port from config
  --host, -H <host>     Override server.host from config
  --help, -h            Show CLI help
```

Examples:

```
# Launch interactive UI
vcdb

# Start server using the executable config (looks for vectordb.config.*)
vcdb serve

# Explicit config path
vcdb serve -c ./vectordb.config.mjs

# Override host/port (falls back to config when not provided)
vcdb serve -p 8787 -H 0.0.0.0
```

Notes:

- `serve` requires a valid executable config. If no config is found, the CLI exits with an error.
- When both CLI flags and config provide `server.port`/`server.host`, CLI flags take precedence.

## HTTP Server (Hono)

- REST server using `hono` + `@hono/node-server`。
- CLI の `serve` で起動し、`vectordb.config.*`（実行可能な JS/TS）で設定します。

### Start

```bash
# Start via CLI (uses vectordb.config.*)
vcdb serve

# With an explicit config path
vcdb serve --config ./vectordb.config.mjs

# Override port/host (CLI flags take precedence over config)
vcdb serve -p 8787 -H 0.0.0.0
```

### Config: server options

Author an executable config with a `server` block (mjs, mts, ts, js, cjs supported; JSON is not supported):

```js
// vectordb.config.* (mjs, mts, ts, js, cjs)
import { defineConfig } from "vcdb/config";

export default defineConfig({
  name: "db",
  storage: {
    index: "file:.vectordb/index", // index artifacts
    data: "file:.vectordb/data", // data segments (can be URI or key→URI map)
  },
  database: { dim: 3, metric: "cosine", strategy: "bruteforce" },
  index: { name: "db", segmented: true },
  server: {
    host: "0.0.0.0",
    port: 8787,
    cors: true,
    // Enable time-based result consistency (bounded-staleness read via HEAD); default: true
    resultConsistency: true,
    embeddings: {
      provider: "openai",
      model: "text-embedding-3-small",
      openAICompatRoute: true,
    },
  },
});
```

#### Result consistency (bounded staleness)

- `server.resultConsistency` (default `true`)
  - `true`: readers prefer `.head.json` when its `commitTs` is readable at `clock.now() - epsilonMs`.
  - `false`: readers ignore `.head.json` and open the default manifest `${name}.manifest.json` directly.
- Related knobs (optional): `server.clock`, `server.epsilonMs`.

Invalid configs print errors to stderr. Check server startup logs when troubleshooting.

Storage URIs are scheme-based:

- Built‑in: `file:` (Node FS), `mem:` (in‑memory)
- Others (e.g., s3, gs, r2, dynamodb) can be provided by the server when starting (driver registry).
- `storage.data` supports either a single URI or a key→URI map per CRUSH target. Templates with `{ns}` are supported, for example: `"data": "s3://bucket/prefix/{ns}"`.

WAL: The server binds WAL to the index storage as `<name>.wal` (no separate config required).

Notes:

- `server.cors`: `true` to allow all, or an object matching Hono's CORS options.
- `server.embeddings.provider: "openai"` exposes POST `/embeddings` and `/v1/embeddings` (OpenAI-compatible). API key is read from `OPENAI_API_KEY` or `server.embeddings.apiKey`.
- CLI flags `--port/-p` と `--host/-H` は config の値より優先されます。
- Config formats supported by loader: mjs, mts, ts, js, cjs（JSON は未対応）。

### REST endpoints

- `GET /health` → `{ ok: true }`
- `GET /stats` → `{ size, dim, metric, strategy }`
- `GET /config` → server config (secrets redacted)
- `GET /vectors/:id` → `{ id, vector, meta }`
- `DELETE /vectors/:id` → `{ ok }`
- `POST /vectors` → Insert-only. Single `{ id, vector:number[], meta? }` or bulk `{ rows:[{ id, vector, meta? }] }`
- `PUT /vectors` → Bulk upsert. Body `{ rows:[{ id, vector, meta? }] }`
- `PUT /vectors/:id` → Single upsert. Body `{ vector:number[], meta? }`
- `POST /vectors/search` → Body `{ vector:number[], k?, expr? }` returns `{ hits }`
- `POST /vectors/find` → Body `{ vector:number[], expr? }` returns `{ hit }`
- `POST /save` → Persist current state via index ops (single-writer enforced)
- Embeddings (if enabled):
  - `POST /embeddings` or `/v1/embeddings` → forwards to OpenAI embeddings with configured model/key

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
    return { Bucket: process.env.S3_BUCKET\!, Key: `${prefix}${key}` };
  }
  return {
    async read(key: string) {
      const { Bucket, Key } = parse(key);
      const res = await s3.send(new GetObjectCommand({ Bucket, Key }));
      const buf = await res.Body\!.transformToByteArray();
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
