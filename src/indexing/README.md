# Indexing Module Layout

Goal: separate concerns between index/data formats and the runtime that interprets them.

- format
  - `formats/` (VLDT data segments, VLIX index files)
  - `catalog.ts` (dim/metric/strategy)
  - `index_builder.ts` (build VLIX and placement manifest)

- placement
  - `placement/crush.ts` (deterministic mapping id -> pg -> targets)
  - `placement/segmenter.ts` (write VLDT segments according to CRUSH)
  - `placement/rebalance.ts` (copy-first rebalancing + manifest update)

- runtime
  - `runtime/manager.ts` (open/save/rebuild orchestration; interpret index → data)

Public imports are kept stable via re-export stubs in the legacy locations (e.g.,
`src/indexing/manager.ts` re-exports from `runtime/manager`). This keeps existing
code working while making the structure explicit and cohesive.
