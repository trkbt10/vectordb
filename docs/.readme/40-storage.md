## Storage Adapters

Import per environment:

- Node.js: `import { createNodeFileIO } from "{{NAME}}/storage/node"`
- Memory: `import { createMemoryFileIO } from "{{NAME}}/storage/memory"`
- OPFS (browser): `import { saveToOPFS, loadFromOPFS } from "{{NAME}}/storage/opfs"`
- S3: implement a `FileIO` using the AWS SDK (see example below)

All adapters implement the same `FileIO` interface:

```ts
import type { FileIO } from "{{NAME}}/storage/types";
```
