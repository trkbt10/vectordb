/**
 * @file OpenAI embeddings service
 */

import { cachedFetchJSON } from "./cached-fetch";

export async function embedOpenAI(texts: string[], apiKey: string): Promise<number[][]> {
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
    `model=${payload.model}|n=${texts.length}|${texts.join("\n").slice(0, 512)}`,
  );
  return json.data.map((d) => d.embedding);
}
