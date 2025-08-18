# VectorLite

極小のベクトルストア。WASM安全・拡張なしでブラウザ/Node/Electron/Tauriを横断。npm 配布前提。

## Install
```
npm i vectorlite
```

## Usage
```ts
import { VectorLite } from 'vectorlite'

const db = new VectorLite({ dim: 384, metric: 'cosine' })

db.add(1, Float32Array.from({ length: 384 }, (_, i) => (i === 0 ? 1 : 0)), { lang: 'ja' })
db.add(2, Float32Array.from({ length: 384 }, (_, i) => (i === 0 ? 0.9 : 0)), { lang: 'en' })

const q = Float32Array.from({ length: 384 }, (_, i) => (i === 0 ? 0.95 : 0))
const hits = db.search(q, { k: 5, filter: (_id, meta) => meta?.lang !== 'fr' })
console.log(hits)
```

### Persist (Node)
```ts
import { saveToFileNode, loadFromFileNode } from 'vectorlite'
const buf = db.serialize(); await saveToFileNode(buf, 'db.vlite')
const buf2 = await loadFromFileNode('db.vlite')
const db2 = VectorLite.deserialize(buf2)
```

### Persist (Browser / OPFS)
```ts
import { saveToOPFS, loadFromOPFS } from 'vectorlite'
await saveToOPFS(db.serialize(), 'db.vlite')
const db2 = VectorLite.deserialize(await loadFromOPFS('db.vlite'))
```

## Notes
- ブルートフォースは正確で小〜中規模（数万件）に適しています。規模が増えたら ANN を別パッケージとして差し替え可能（インターフェースは `search()` に準拠）。
- Cosine は内部で単位化。L2 は負距離を score として返し、スコアが大きいほど近い規約に統一。
- `remove()` は最後の要素を詰め替える O(1) compaction を採用し、`id→index` マップを維持。

