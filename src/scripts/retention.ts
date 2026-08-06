/**
 * Data retention (operations hardening).
 *
 *   npm run retention
 *
 * The archive (`digest`) and reader feedback (`counter_feedback`) are kept
 * forever — they are the product. What grows are the 1024-dim vectors: the
 * embedding on every `item` (~4 KB), the `embedding_cache`, and the centroid on
 * every `cluster`. All are only needed inside the 72h clustering window, so on a
 * 512 MB tier they must be reclaimed aggressively. RETENTION_DAYS (default 4, a
 * one-day margin over the 72h window) governs the horizon.
 *
 * This job:
 *   1. nulls embeddings on items past the window (keyed on ingested_at; a
 *      NOT EXISTS guard never nulls an embedding an active cluster's centroid
 *      still needs, so a later avg() recompute can't collapse to NULL);
 *   2. deletes stale clusters past the window that carry no reader feedback,
 *      re-pointing/clearing their dependents first for the foreign keys, to
 *      reclaim centroid vectors;
 *   3. prunes the (rebuildable) embedding cache past the window.
 *
 * Idempotent and safe to run often. Freed space is reused by autovacuum for new
 * rows — a bounded steady-state footprint — so no VACUUM FULL (its exclusive
 * lock, and the free space it needs to rewrite, are both unsafe on a full tier).
 */

import { closeSql, getSql } from "../lib/db.js";
import { optionalEnv } from "../lib/env.js";

const raw = optionalEnv("RETENTION_DAYS", "4");
const days = Number(raw);
if (!Number.isInteger(days) || days < 4) {
  // Must stay clear of the 72h clustering window.
  throw new Error(`RETENTION_DAYS must be an integer >= 4, got "${raw}"`);
}

const sql = getSql();

const [before] = await sql<{ s: string }[]>`
  SELECT pg_size_pretty(pg_database_size(current_database())) AS s
`;

// 1. Embeddings on items past the window (only needed <72h for clustering).
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

// 2. Stale clusters past the window with no reader feedback — reclaim centroids.
const clusters = await sql<{ n: number }[]>`
  WITH old_c AS (
    SELECT id FROM cluster
    WHERE last_seen_at < now() - ${days} * interval '1 day'
      AND id NOT IN (SELECT cluster_id FROM counter_feedback)
  ),
  d0 AS (UPDATE item SET cluster_id = NULL WHERE cluster_id IN (SELECT id FROM old_c) RETURNING 1),
  d1 AS (UPDATE cluster SET lineage_of = NULL WHERE lineage_of IN (SELECT id FROM old_c) RETURNING 1),
  d2 AS (DELETE FROM numeric_claim WHERE cluster_id IN (SELECT id FROM old_c) RETURNING 1),
  d3 AS (DELETE FROM cluster_score WHERE cluster_id IN (SELECT id FROM old_c) RETURNING 1),
  d4 AS (DELETE FROM cluster WHERE id IN (SELECT id FROM old_c) RETURNING 1)
  SELECT (SELECT count(*) FROM d4)::int AS n
`;

// 3. Embedding cache past the window (pure optimisation, rebuildable).
const cache = await sql`
  DELETE FROM embedding_cache WHERE created_at < now() - ${days} * interval '1 day'
`;

const [after] = await sql<{ s: string }[]>`
  SELECT pg_size_pretty(pg_database_size(current_database())) AS s
`;

console.log(
  `retention(${days}d): nulled ${emb.count} embedding(s), deleted ${clusters[0]?.n ?? 0} stale cluster(s), ` +
    `purged ${cache.count} cache row(s). db ${before?.s ?? "?"} -> ${after?.s ?? "?"} ` +
    `(freed space is reused by autovacuum).`,
);
await closeSql();
