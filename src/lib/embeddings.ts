/**
 * Hosted multilingual embeddings (SPEC.md 3.3, 6.1) — Phase 2.
 *
 * Provider-configurable via env (default Voyage; OpenAI and Cohere also
 * supported) — DECISIONS.md D-009. Calls are batched, and results are cached in
 * `embedding_cache` keyed by content hash so a provider outage degrades new
 * ingestion without re-embedding or invalidating existing clusters (SPEC 3.3).
 *
 * The provider MUST be multilingual; cross-lingual clustering is verified at
 * Phase 2 calibration, not assumed.
 */

import { getSql } from "./db.js";
import { embeddingDims, optionalEnv, requireEnv } from "./env.js";
import { parseVectorLiteral, toVectorLiteral } from "./clustering.js";

export const EMBED_BATCH = 96;

export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; text: () => Promise<string>; json: () => Promise<unknown> }>;

const defaultFetch = fetch as unknown as FetchLike;

type ProviderCall = (
  batch: string[],
  dims: number,
  model: string,
  apiKey: string,
  fetchImpl: FetchLike,
) => Promise<number[][]>;

function orderByIndex(
  data: Array<{ embedding: number[]; index: number }>,
): number[][] {
  return [...data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

const voyage: ProviderCall = async (batch, dims, model, apiKey, fetchImpl) => {
  const res = await fetchImpl("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      input: batch,
      input_type: "document",
      output_dimension: dims,
    }),
  });
  if (!res.ok) throw new Error(`voyage ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data: Array<{ embedding: number[]; index: number }> };
  return orderByIndex(json.data);
};

const openai: ProviderCall = async (batch, dims, model, apiKey, fetchImpl) => {
  const res = await fetchImpl("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ model, input: batch, dimensions: dims }),
  });
  if (!res.ok) throw new Error(`openai ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data: Array<{ embedding: number[]; index: number }> };
  return orderByIndex(json.data);
};

const cohere: ProviderCall = async (batch, _dims, model, apiKey, fetchImpl) => {
  const res = await fetchImpl("https://api.cohere.com/v2/embed", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      texts: batch,
      input_type: "search_document",
      embedding_types: ["float"],
    }),
  });
  if (!res.ok) throw new Error(`cohere ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { embeddings: { float: number[][] } };
  return json.embeddings.float;
};

const PROVIDERS: Record<string, ProviderCall> = { voyage, openai, cohere };

/** Embed texts in batches, preserving input order. `fetchImpl`/`batchSize` are injectable for tests. */
export async function embedTexts(
  texts: string[],
  fetchImpl: FetchLike = defaultFetch,
  batchSize: number = EMBED_BATCH,
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const dims = embeddingDims();
  const providerName = optionalEnv("EMBEDDING_PROVIDER", "voyage").toLowerCase();
  const provider = PROVIDERS[providerName];
  if (!provider) {
    throw new Error(
      `Unknown EMBEDDING_PROVIDER "${providerName}" (expected voyage | openai | cohere)`,
    );
  }
  const model = requireEnv("EMBEDDING_MODEL");
  const apiKey = requireEnv("EMBEDDING_API_KEY");

  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const vectors = await provider(batch, dims, model, apiKey, fetchImpl);
    if (vectors.length !== batch.length) {
      throw new Error(
        `provider returned ${vectors.length} vectors for ${batch.length} inputs`,
      );
    }
    for (const v of vectors) {
      if (v.length !== dims) {
        throw new Error(`provider returned ${v.length} dims, expected ${dims}`);
      }
      out.push(v);
    }
  }
  return out;
}

/**
 * Resolve embeddings for `{ contentHash, text }` entries, reading from and
 * writing through `embedding_cache`. Returns a map keyed by content hash.
 */
export async function embedWithCache(
  entries: Array<{ contentHash: string; text: string }>,
): Promise<Map<string, number[]>> {
  const sql = getSql();
  const model = requireEnv("EMBEDDING_MODEL");
  const result = new Map<string, number[]>();
  if (entries.length === 0) return result;

  const hashes = [...new Set(entries.map((e) => e.contentHash))];
  const cached = await sql<{ content_hash: string; embedding: string }[]>`
    SELECT content_hash, embedding::text AS embedding
    FROM embedding_cache
    WHERE model = ${model} AND content_hash = ANY(${hashes})
  `;
  for (const row of cached) {
    result.set(row.content_hash, parseVectorLiteral(row.embedding));
  }

  // Unique misses only — identical content across feeds is embedded once.
  const misses = new Map<string, string>();
  for (const e of entries) {
    if (!result.has(e.contentHash)) misses.set(e.contentHash, e.text);
  }
  if (misses.size === 0) return result;

  const missEntries = [...misses.entries()];
  const vectors = await embedTexts(missEntries.map(([, text]) => text));

  for (let i = 0; i < missEntries.length; i++) {
    const hash = missEntries[i]?.[0];
    const vector = vectors[i];
    if (!hash || !vector) continue;
    result.set(hash, vector);
    await sql`
      INSERT INTO embedding_cache (content_hash, model, embedding)
      VALUES (${hash}, ${model}, ${toVectorLiteral(vector)}::vector)
      ON CONFLICT (content_hash, model) DO NOTHING
    `;
  }
  return result;
}
