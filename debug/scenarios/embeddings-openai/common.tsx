/**
 * @file Main App component for OpenAI embeddings scenario
 */

import { Box, Text } from "ink";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import React, { useEffect, useState } from "react";

import { createAttrIndex } from "../../../src/attr/index";
import { create, createCluster } from "../../../src/index";
import { createNodeFileIO } from "../../../src/persist/node";
import { DOCS } from "../../../spec/__mocks__/DOCS";

import { Row, Section } from "./components";
import {
  getApiKey,
  getAttrStrategy,
  getHnswBridge,
  getHnswFilterMode,
  getHnswParams,
  getHnswSeeds,
  getIvfParams,
  getMetric,
} from "./config";
import { embedOpenAI } from "./openai-service";
import { EVAL_QUERIES, SEARCH_QUERIES } from "./queries";
import { evaluateRecall, generateRecommendations, runSearch } from "./search-utils";
import type { AppStatus, AppStrategy, EvalItem, Hit, Meta } from "./types";

export function App({ strategy }: { strategy: AppStrategy }) {
  const [status, setStatus] = useState<AppStatus>("init");
  const [message, setMessage] = useState<string>("");
  const [hits, setHits] = useState<{ q: string; results: Hit[] }[]>([]);
  const [dim, setDim] = useState<number>(0);
  const [evals, setEvals] = useState<EvalItem[]>([]);
  const [recs, setRecs] = useState<string[]>([]);

  const key = getApiKey();
  const metric = getMetric();
  const attrStrategy = getAttrStrategy();
  const hnswParams = getHnswParams();
  const ivfParams = getIvfParams();
  const hnswFilterMode = getHnswFilterMode();
  const hnswSeeds = getHnswSeeds();
  const hnswBridge = getHnswBridge();

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
        const db = create<Meta>({ dim: d0, metric, strategy, hnsw: hnswParams, ivf: ivfParams });
        const dbBF = create<Meta>({ dim: d0, metric, strategy: "bruteforce" });
        const dbHNSW = create<Meta>({ dim: d0, metric, strategy: "hnsw", hnsw: hnswParams });
        const dbIVF = create<Meta>({ dim: d0, metric, strategy: "ivf", ivf: ivfParams });
        const idx = createAttrIndex(attrStrategy);

        for (let i = 0; i < DOCS.length; i++) {
          const d = DOCS[i];
          const embedding = new Float32Array(embs[i]);
          const meta: Meta = {
            title: d.title,
            category: d.category,
            tags: d.tags,
            author: d.author,
            year: d.year,
          };

          db.set(d.id, embedding, meta);
          dbBF.set(d.id, embedding, meta);
          dbHNSW.set(d.id, embedding, meta);
          dbIVF.set(d.id, embedding, meta);
          idx.setAttrs(d.id, { category: d.category, tags: d.tags, author: d.author, year: d.year });
        }

        setStatus("querying");
        setMessage("Running vector and filtered searches");
        const results: { q: string; results: Hit[] }[] = [];

        for (const { q, expr } of SEARCH_QUERIES) {
          const [qv] = await embedOpenAI([q], key);
          const base = new Float32Array(qv);
          const hs = runSearch(db, idx, strategy, base, expr, { hnswFilterMode, hnswBridge, hnswSeeds });
          results.push({ q, results: hs.map((h) => ({ id: h.id, title: h.meta?.title ?? "", score: h.score })) });
        }
        setHits(results);

        const evalQueryEmbeddings = await Promise.all(
          EVAL_QUERIES.map(async (q) => {
            const [qv] = await embedOpenAI([q], key);
            return new Float32Array(qv);
          }),
        );
        const evalOut = evaluateRecall(dbBF, dbHNSW, dbIVF, EVAL_QUERIES, evalQueryEmbeddings);
        setEvals(evalOut);

        const suggestions = generateRecommendations(strategy, evalOut, DOCS.length);
        setRecs(suggestions);

        setStatus("saving");
        setMessage("Saving snapshot and reloading");
        const outPath = path.join(process.cwd(), ".tmp", "emb-openai-out", strategy);
        await mkdir(outPath, { recursive: true });

        // Create cluster environment with file persistence
        const indexRoot = outPath;
        const dataRoot = path.join(outPath, "data");
        const { index } = createCluster<Meta>(
          {
            index: createNodeFileIO(indexRoot),
            data: (key: string) => createNodeFileIO(path.join(dataRoot, key)),
          },
          {
            shards: 1,
            segmented: true,
            segmentBytes: 1 << 15,
            includeAnn: false,
          },
        );

        // Save the database
        await index.save(db, { baseName: "db" });

        // Reload from disk
        const db2State = await index.openState({ baseName: "db" });
        const { db: dbFactory } = createCluster<Meta>({
          index: createNodeFileIO(indexRoot),
          data: (key: string) => createNodeFileIO(path.join(dataRoot, key)),
        });
        const db2 = dbFactory.from(db2State);

        const [qv1] = await embedOpenAI(["生成AIの実務活用と埋め込み検索"], key);
        const h2 = db2.search(new Float32Array(qv1), { k: 3 });
        results.push({
          q: "Reload sanity",
          results: h2.map((h) => ({ id: h.id, title: h.meta?.title ?? "", score: h.score })),
        });
        setHits(results);

        setStatus("done");
        setMessage("Completed");
      } catch (e) {
        setStatus("error");
        setMessage(String((e as Error)?.message ?? e));
      }
    })();
  }, [key, metric, strategy, attrStrategy, hnswParams, ivfParams, hnswFilterMode, hnswSeeds, hnswBridge]);

  return (
    <Box flexDirection="column">
      <Text color="magentaBright">VectorDB × OpenAI Embeddings Demo</Text>
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
                  <Text>
                    {" "}
                    - ID: [{r.id}] [{r.title}]{" "}
                  </Text>
                  <Text color={r.score >= 0.5 ? "green" : r.score >= 0.3 ? "yellow" : "gray"}>
                    [{r.score.toFixed(3)}]
                  </Text>
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
              <Text color="cyan">
                • {e.q} — Recall@5 HNSW: {e.recall} | IVF: {e.ivfRecall}
              </Text>
              <Text> BF : [{e.bfIds.join(", ")}]</Text>
              <Text> HNSW: [{e.hnswIds.join(", ")}]</Text>
              <Text> IVF : [{e.ivfIds.join(", ")}]</Text>
              {e.missing.length > 0 && <Text color="yellow"> Missing (BF-only): [{e.missing.join(", ")}]</Text>}
              {e.extra.length > 0 && <Text color="yellow"> Extra (HNSW-only): [{e.extra.join(", ")}]</Text>}
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
