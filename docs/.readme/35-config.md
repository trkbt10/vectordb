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
