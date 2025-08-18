/**
 * @file Shared components and helpers for OpenAI embeddings debug scenario.
 */

import React, { useEffect, useMemo, useState } from "react";
import { render, Box, Text } from "ink";
import path from "node:path";
import { mkdir } from "node:fs/promises";

import { createVectorLite } from "../../../src/vectorlite/create";
import { add, size, search } from "../../../src/vectorlite/ops/core";
import { serialize, deserializeVectorLite } from "../../../src/vectorlite/serialize";
import { searchWithExpr } from "../../../src/search/with_expr";
import { loadFromFileNode, saveAtomicToFileNode } from "../../../src/persist/node";
import { createAttrIndex, setAttrs } from "../../../src/attr/index";
import type { VectorLiteState } from "../../../src/vectorlite/state";
import type { AttrIndex } from "../../../src/attr/index";
import { cachedFetchJSON } from "../../utils/cached-fetch";
import type { FilterExpr } from "../../../src/filter/expr";
import { DOCS } from "./DOCS";

type Meta = { title: string; category: string; tags: string[]; author: string; year: number };
export type Doc = Meta & { id: number; content: string };
type Hit = { id: number; title: string; score: number };

type EvalItem = {
  q: string
  recall: string
  recallNum: number
  ivfRecall: string
  ivfRecallNum: number
  bfIds: number[]
  hnswIds: number[]
  ivfIds: number[]
  missing: number[]
  extra: number[]
}

/**
 *
 */
export function Section({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color="cyan">◆ {title}</Text>
      <Box marginLeft={2} flexDirection="column">
        {children}
      </Box>
    </Box>
  );
}

/**
 *
 */
export function Row({ label, value, ok }: { label: string; value?: string; ok?: boolean }) {
  return (
    <Box>
      <Text color={ok ? "green" : "yellow"}>{ok ? "✔" : "…"} </Text>
      <Text>{label}</Text>
      {value ? <Text> — {value}</Text> : null}
    </Box>
  );
}

async function embedOpenAI(texts: string[], apiKey: string): Promise<number[][]> {
  const url = "https://api.openai.com/v1/embeddings";
  const payload = { model: "text-embedding-3-small", input: texts };
  const json = await cachedFetchJSON<{ data: { embedding: number[] }[] }>(
    "openai-embeddings",
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    },
    `model=${payload.model}|n=${texts.length}|${texts.join("\n").slice(0, 512)}`
  );
  return json.data.map((d) => d.embedding);
}

// Unified search runner with early returns (no nested branching)
function runSearch<TMeta>(
  vl: VectorLiteState<TMeta>,
  idx: AttrIndex | null,
  strategy: "bruteforce" | "hnsw",
  q: Float32Array,
  expr?: FilterExpr,
  opts?: { hnswFilterMode?: 'soft'|'hard'; hnswSeeds?: 'auto'|number; hnswBridge?: number },
) {
  if (!expr) return search(vl, q, { k: 5 })
  if (strategy === 'hnsw') return searchWithExpr(vl, q, expr, { k: 5, index: idx, hnsw: { mode: opts?.hnswFilterMode ?? 'soft', bridgeBudget: opts?.hnswBridge ?? 32, seeds: opts?.hnswSeeds ?? 'auto', seedStrategy: 'random' } })
  return searchWithExpr(vl, q, expr, { k: 5, index: idx })
}

/**
 *
 */
export function App({ strategy }: { strategy: "bruteforce" | "hnsw" }) {
  const [status, setStatus] = useState<
    "init" | "embedding" | "indexing" | "querying" | "saving" | "reloading" | "done" | "error"
  >("init");
  const [message, setMessage] = useState<string>("");
  const [hits, setHits] = useState<{ q: string; results: Hit[] }[]>([]);
  const [dim, setDim] = useState<number>(0);
  const [evals, setEvals] = useState<EvalItem[]>([])
  const [recs, setRecs] = useState<string[]>([])

  const key = useMemo(() => process.env.OPENAI_API_KEY_FOR_EMBEDDING ?? process.env.OPENAI_API_KEY ?? "", []);
  const metric = useMemo(() => {
    const m = (process.env.VECTORLITE_METRIC ?? "cosine").toLowerCase();
    return m === "cosine" || m === "l2" || m === "dot" ? (m as "cosine" | "l2" | "dot") : "cosine";
  }, []);
  const attrStrategy = useMemo(() => {
    const a = (process.env.VECTORLITE_ATTR_INDEX ?? "bitmap").toLowerCase();
    return a === "basic" || a === "bitmap" ? (a as "basic" | "bitmap") : "bitmap";
  }, []);
  const hnswParams = useMemo(() => {
    const ef = Number(process.env.VECTORLITE_HNSW_EF_SEARCH ?? "");
    const m = Number(process.env.VECTORLITE_HNSW_M ?? "");
    const obj: { efSearch?: number; M?: number } = {};
    if (Number.isFinite(ef) && ef > 0) obj.efSearch = Math.floor(ef);
    if (Number.isFinite(m) && m > 0) obj.M = Math.floor(m);
    return obj;
  }, []);
  const ivfParams = useMemo(() => {
    const nl = Number(process.env.VECTORLITE_IVF_NLIST ?? "");
    const np = Number(process.env.VECTORLITE_IVF_NPROBE ?? "");
    const obj: { nlist?: number; nprobe?: number } = {};
    if (Number.isFinite(nl) && nl > 0) obj.nlist = Math.floor(nl);
    if (Number.isFinite(np) && np > 0) obj.nprobe = Math.floor(np);
    return obj;
  }, []);
  const hnswFilterMode = useMemo(() => {
    const v = (process.env.VECTORLITE_HNSW_FILTER_MODE ?? 'soft').toLowerCase();
    return (v === 'soft' || v === 'hard') ? (v as 'soft'|'hard') : 'soft';
  }, []);
  const hnswSeeds = useMemo(() => {
    const v = (process.env.VECTORLITE_HNSW_SEEDS ?? 'auto').toLowerCase();
    if (v === 'auto') return 'auto' as const;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 'auto';
  }, []);
  const hnswBridge = useMemo(() => {
    const v = Number(process.env.VECTORLITE_HNSW_BRIDGE ?? '32');
    return Number.isFinite(v) && v >= 0 ? Math.floor(v) : 32;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        if (!key) {
          setStatus("error");
          setMessage("OPENAI_API_KEY is not set");
          return;
        }
        setStatus("embedding");
        setMessage("Requesting document embeddings (with cache)");
        const inputs = DOCS.map((d) => `${d.title}\n${d.content}`);
        const embs = await embedOpenAI(inputs, key);
        const d0 = embs[0]?.length || 0;
        setDim(d0);

        setStatus("indexing");
        setMessage("Indexing documents and attributes");
        // Build both strategies for evaluation; use selected strategy for main Results
        const db = createVectorLite<Meta>({ dim: d0, metric, strategy, hnsw: hnswParams, ivf: ivfParams });
        const dbBF = createVectorLite<Meta>({ dim: d0, metric, strategy: 'bruteforce' });
        const dbHNSW = createVectorLite<Meta>({ dim: d0, metric, strategy: 'hnsw', hnsw: hnswParams });
        const dbIVF = createVectorLite<Meta>({ dim: d0, metric, strategy: 'ivf', ivf: ivfParams });
        const idx = createAttrIndex(attrStrategy);
        for (let i = 0; i < DOCS.length; i++) {
          const d = DOCS[i];
          add(db, d.id, new Float32Array(embs[i]), {
            title: d.title,
            category: d.category,
            tags: d.tags,
            author: d.author,
            year: d.year,
          });
          add(dbBF, d.id, new Float32Array(embs[i]), {
            title: d.title,
            category: d.category,
            tags: d.tags,
            author: d.author,
            year: d.year,
          });
          add(dbHNSW, d.id, new Float32Array(embs[i]), {
            title: d.title,
            category: d.category,
            tags: d.tags,
            author: d.author,
            year: d.year,
          });
          add(dbIVF, d.id, new Float32Array(embs[i]), {
            title: d.title,
            category: d.category,
            tags: d.tags,
            author: d.author,
            year: d.year,
          });
          setAttrs(idx, d.id, { category: d.category, tags: d.tags, author: d.author, year: d.year });
        }

        setStatus("querying");
        setMessage("Running vector and filtered searches");
        const queries: { q: string; desc: string; expr?: FilterExpr }[] = [
          { q: "生成AIの実務活用と埋め込み検索", desc: "近傍(制約なし)" },
          // DOCS.tsx に food/cooking タグがないため、クエリのみで近傍検索
          { q: "手早く作れるパスタレシピ", desc: "近傍(制約なし)" },
          {
            q: "最新のベクトル検索の実装",
            desc: "year>=2023",
            expr: { must: [{ key: "year", range: { gte: 2023 } }] },
          },
          {
            q: "フォークランド紛争の話",
            desc: "tags contains uk/war/ww1/royal (OR)",
            expr: { should: [{ key: "tags", match: "uk" }, { key: "tags", match: "war" }, { key: "tags", match: "ww1" }, { key: "tags", match: "royal" }], should_min: 1 },
          },
          {
            q: "ペンギンの話",
            desc: "tags contains antarctica/arctic/animal (OR)",
            expr: { should: [{ key: "tags", match: "antarctica" }, { key: "tags", match: "arctic" }, { key: "category", match: "animal" }], should_min: 1 },
          },
          {
            q: "アルゼンチンの話",
            desc: "tags contains peru/amazon/inca (OR)",
            expr: { should: [{ key: "tags", match: "peru" }, { key: "tags", match: "amazon" }, { key: "tags", match: "inca" }], should_min: 1 },
          },
          { q: "イギリスの話", desc: "tags contains uk", expr: { must: [{ key: "tags", match: "uk" }] } },
        ];
        const results: { q: string; results: Hit[] }[] = [];
        for (const { q, expr } of queries) {
          const [qv] = await embedOpenAI([q], key)
          const base = new Float32Array(qv)
          const hs = runSearch(db, idx, strategy, base, expr, { hnswFilterMode, hnswBridge, hnswSeeds })
          results.push({ q, results: hs.map((h) => ({ id: h.id, title: h.meta?.title ?? '', score: h.score })) })
        }
        setHits(results);

        // Evaluation: BF vs HNSW on pure vector queries (no filter), Recall@K
        const evalQueries = [
          '生成AIの実務活用と埋め込み検索',
          '手早く作れるパスタレシピ',
          '最新のベクトル検索の実装',
          'フォークランド紛争の話',
          'ペンギンの話',
          'アルゼンチンの話',
          'イギリスの話',
        ]
        const evalOut: EvalItem[] = []
        for (const q of evalQueries) {
          const [qv] = await embedOpenAI([q], key)
          const base = new Float32Array(qv)
          const k = 5
          const bf = search(dbBF, base, { k })
          const hs = search(dbHNSW, base, { k })
          const iv = search(dbIVF, base, { k })
          const bfIds = bf.map(x => x.id)
          const hnswIds = hs.map(x => x.id)
          const ivfIds = iv.map(x => x.id)
          const bfSet = new Set(bfIds)
          const hsSet = new Set(hnswIds)
          const ivfSet = new Set(ivfIds)
          const inter = bfIds.filter(id => hsSet.has(id))
          const missing = bfIds.filter(id => !hsSet.has(id))
          const extra = hnswIds.filter(id => !bfSet.has(id))
          const rNum = inter.length / k
          const recall = `${inter.length}/${k} (${rNum.toFixed(2)})`
          const interI = bfIds.filter(id => ivfSet.has(id))
          const rINum = interI.length / k
          const ivfRecall = `${interI.length}/${k} (${rINum.toFixed(2)})`
          evalOut.push({ q, recall, recallNum: rNum, ivfRecall, ivfRecallNum: rINum, bfIds, hnswIds, ivfIds, missing, extra })
        }
        setEvals(evalOut)

        // Recommendations (suggestions only; never auto-switch)
        const suggestions: string[] = []
        const N = DOCS.length
        if (strategy === 'bruteforce') {
          if (N >= 10000) {
            suggestions.push('Index size is large; consider HNSW (switchStrategy) for latency reduction.')
          }
        } else if (strategy === 'hnsw') {
          const avgRecall = evalOut.length ? evalOut.reduce((s, e) => s + e.recallNum, 0) / evalOut.length : 1
          const zeroRecall = evalOut.filter(e => e.recallNum === 0).length
          if (N < 1000) suggestions.push('Small dataset detected; bruteforce often provides higher quality (consider BF).')
          if (avgRecall < 0.6) {
            suggestions.push('HNSW recall is low; try higher efSearch (e.g., 200–400).')
            suggestions.push('Consider increasing seeds/bridgeBudget or using hard mode when filters apply.')
          }
          if (zeroRecall > 0) {
            suggestions.push('Some queries have zero recall; consider rebuilding with higher M/efConstruction or shuffling insert order.')
          }
        }
        setRecs(suggestions)

        setStatus("saving");
        setMessage("Saving snapshot and reloading");
        const outPath = path.join(process.cwd(), "debug", "emb-openai-out", `db.${strategy}.vlite`);
        await mkdir(path.dirname(outPath), { recursive: true });
        await saveAtomicToFileNode(serialize(db), outPath);
        const buf = await loadFromFileNode(outPath);
        const db2 = deserializeVectorLite<Meta>(buf);
        const [qv1] = await embedOpenAI(["生成AIの実務活用と埋め込み検索"], key);
        const h2 = search(db2, new Float32Array(qv1), { k: 3 });
        results.push({
          q: "Reload sanity",
          results: h2.map((h) => ({ id: h.id, title: h.meta?.title ?? "", score: h.score })),
        });
        setHits(results);

        setStatus("done");
        setMessage("Completed");
      } catch (e: any) {
        setStatus("error");
        setMessage(String(e?.message ?? e));
      }
    })();
  }, [key, metric, strategy, attrStrategy]);

  return (
    <Box flexDirection="column">
      <Text color="magentaBright">VectorLite × OpenAI Embeddings Demo</Text>
      <Text color="gray">Cached fetch + friendly Ink UI</Text>

      <Section title="Environment">
        <Row label={`Embedding dim`} value={dim ? String(dim) : "—"} ok={!!dim} />
        <Row label={`Metric`} value={metric} ok />
        <Row label={`Strategy`} value={strategy} ok />
        <Row label={`Attr Index`} value={attrStrategy} ok />
      </Section>

      <Section title="Progress">
        <Row label="Request embeddings" ok={["indexing", "querying", "saving", "reloading", "done"].includes(status)} />
        <Row label="Index documents" ok={["querying", "saving", "reloading", "done"].includes(status)} />
        <Row label="Run queries" ok={["saving", "reloading", "done"].includes(status)} />
        <Row label="Save + Reload" ok={["done"].includes(status)} />
        <Box marginTop={1}>
          <Text color={status === "error" ? "red" : "yellow"}>
            {status.toUpperCase()} — {message}
          </Text>
        </Box>
      </Section>

      {hits.length > 0 && (
        <Section title="Results">
          {hits.map((h, i) => (
            <Box key={i} flexDirection="column" marginBottom={1}>
              <Text color="cyan">• {h.q}</Text>
              {h.results.map((r) => (
                <Box key={r.id}>
                  <Text>  - ID: [{r.id}] [{r.title}] </Text>
                  <Text color={r.score >= 0.5 ? 'green' : r.score >= 0.3 ? 'yellow' : 'gray'}>[{r.score.toFixed(3)}]</Text>
                </Box>
              ))}
            </Box>
          ))}
        </Section>
      )}

      {evals.length > 0 && (
        <Section title="Evaluation (BF vs HNSW, no filter)">
          {evals.map((e, i) => (
            <Box key={i} flexDirection="column" marginBottom={1}>
              <Text color="cyan">• {e.q} — Recall@5 HNSW: {e.recall} | IVF: {e.ivfRecall}</Text>
              <Text>  BF  : [{e.bfIds.join(', ')}]</Text>
              <Text>  HNSW: [{e.hnswIds.join(', ')}]</Text>
              <Text>  IVF : [{e.ivfIds.join(', ')}]</Text>
              {e.missing.length > 0 && <Text color="yellow">  Missing (BF-only): [{e.missing.join(', ')}]</Text>}
              {e.extra.length > 0 && <Text color="yellow">  Extra (HNSW-only): [{e.extra.join(', ')}]</Text>}
            </Box>
          ))}
        </Section>
      )}

      {recs.length > 0 && (
        <Section title="Recommendations">
          {recs.map((m, i) => (
            <Text key={i}>- {m}</Text>
          ))}
        </Section>
      )}
    </Box>
  );
}

/**
 *
 */
export function runBruteforce() {
  render(<App strategy="bruteforce" />);
}
/**
 *
 */
export function runHNSW() {
  render(<App strategy="hnsw" />);
}
