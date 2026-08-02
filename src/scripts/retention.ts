/**
 * Data retention (operations hardening).
 *
 *   npm run retention
 *
 * The archive (`digest`) and reader feedback (`counter_feedback`) are kept
 * forever — they are the product. What grows without bound is the 1024-dim
 * embedding stored on every `item` (~4 KB each, plus its HNSW index entry) and
 * the `embedding_cache`. Embeddings are only ever read inside the 72h clustering
 * window (assignment + centroid recomputation); nothing else touches them. So
 * this nulls embeddings on items ingested more than RETENTION_DAYS ago (default
 * 10 — a wide margin over the 72h need) and purges cache rows past the same
 * horizon. The item rows themselves (headline, standfirst) stay for the archive.
 *
 * The NOT EXISTS guard makes the safety explicit: never null an embedding that
 * belongs to a cluster still active within the window, so a later centroid
 * recompute (avg over non-null embeddings) can never collapse to NULL. Keying on
 * `ingested_at` rather than `published_at` avoids nulling a recently-processed
 * item that happens to carry an old publication date.
 *
 * Idempotent and safe to run daily. Freed space is returned for reuse by
 * autovacuum; we deliberately do not VACUUM FULL (it would take an exclusive
 * lock on `item`).
 */

import { closeSql, getSql } from "../lib/db.js";
import { optionalEnv } from "../lib/env.js";

const raw = optionalEnv("RETENTION_DAYS", "10");
const days = Number(raw);
if (!Number.isInteger(days) || days < 4) {
  // Must stay clear of the 72h clustering window.
  throw new Error(`RETENTION_DAYS must be an integer >= 4, got "${raw}"`);
}

const sql = getSql();

const [before] = await sql<{ s: string }[]>`
  SELECT pg_size_pretty(pg_database_size(current_database())) AS s
`;

const emb = await sql`
  UPDATE item i SET embedding = NULL
  WHERE i.embedding IS NOT NULL
    AND i.ingested_at < now() - ${days} * interval '1 day'
    AND NOT EXISTS (
      SELECT 1 FROM cluster c
      WHERE c.id = i.cluster_id
        AND c.last_seen_at > now() - ${days} * interval '1 day'
    )
`;

const cache = await sql`
  DELETE FROM embedding_cache
  WHERE created_at < now() - ${days} * interval '1 day'
`;

const [after] = await sql<{ s: string }[]>`
  SELECT pg_size_pretty(pg_database_size(current_database())) AS s
`;

console.log(
  `retention(${days}d): nulled ${emb.count} item embedding(s), ` +
    `purged ${cache.count} cache row(s). db size ${before?.s ?? "?"} -> ${after?.s ?? "?"}.`,
);
await closeSql();
