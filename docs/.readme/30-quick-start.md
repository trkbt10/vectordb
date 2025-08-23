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

