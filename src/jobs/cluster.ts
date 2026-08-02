/**
 * Clustering job (SPEC.md Section 6) — Phase 2.
 *
 * Runs on GitHub Actions every 30 minutes after ingest. Embeds unclustered items
 * in the rolling 72-hour window (cached by content hash), assigns each to the
 * nearest cluster above the assignment threshold or starts a new one, then
 * consolidates clusters that have since converged.
 *
 * Nearest-cluster search and centroid recomputation run in Postgres via pgvector
 * (`<=>` cosine distance; `avg(embedding)` for the exact centroid). Cluster
 * identity is stable across runs, which the held-and-rescored mechanism (SPEC
 * 9.4) depends on — hence incremental, not batch (SPEC 6.1).
 */

import { closeSql, getSql, type Sql } from "../lib/db.js";
import {
  ASSIGN_THRESHOLD,
  decideAssignment,
  MERGE_THRESHOLD,
  toVectorLiteral,
  WINDOW_HOURS,
  type Nearest,
} from "../lib/clustering.js";
import { embedWithCache } from "../lib/embeddings.js";

const WINDOW = `${WINDOW_HOURS} hours`;

type PendingItem = {
  id: string;
  headline: string;
  standfirst: string | null;
  content_hash: string;
};

async function nearestCluster(sql: Sql, vectorLiteral: string): Promise<Nearest | null> {
  const rows = await sql<{ id: number; similarity: number }[]>`
    SELECT id, 1 - (centroid <=> ${vectorLiteral}::vector) AS similarity
    FROM cluster
    WHERE last_seen_at > now() - ${WINDOW}::interval
    ORDER BY centroid <=> ${vectorLiteral}::vector
    LIMIT 1
  `;
  const row = rows[0];
  return row ? { clusterId: row.id, similarity: Number(row.similarity) } : null;
}

async function attach(sql: Sql, itemId: string, clusterId: number): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`UPDATE item SET cluster_id = ${clusterId} WHERE id = ${itemId}`;
    // Exact centroid = mean of member embeddings (pgvector avg()).
    await tx`
      UPDATE cluster c
      SET centroid = sub.centroid, item_count = sub.cnt, last_seen_at = now()
      FROM (
        SELECT avg(embedding) AS centroid, count(*) AS cnt
        FROM item WHERE cluster_id = ${clusterId} AND embedding IS NOT NULL
      ) sub
      WHERE c.id = ${clusterId}
    `;
  });
}

async function createCluster(
  sql: Sql,
  itemId: string,
  vectorLiteral: string,
): Promise<void> {
  await sql.begin(async (tx) => {
    const rows = await tx<{ id: number }[]>`
      INSERT INTO cluster (centroid, first_seen_at, last_seen_at, item_count)
      VALUES (${vectorLiteral}::vector, now(), now(), 1)
      RETURNING id
    `;
    const clusterId = rows[0]?.id;
    if (clusterId === undefined) throw new Error("cluster insert returned no id");
    await tx`UPDATE item SET cluster_id = ${clusterId} WHERE id = ${itemId}`;
  });
}

/** Merge clusters that have converged as more members arrived (SPEC 6.1). */
async function consolidate(sql: Sql): Promise<number> {
  const pairs = await sql<
    {
      a_id: number;
      b_id: number;
      a_first: Date;
      b_first: Date;
      similarity: number;
    }[]
  >`
    SELECT a.id AS a_id, b.id AS b_id,
           a.first_seen_at AS a_first, b.first_seen_at AS b_first,
           1 - (a.centroid <=> b.centroid) AS similarity
    FROM cluster a
    JOIN cluster b ON a.id < b.id
    WHERE a.last_seen_at > now() - ${WINDOW}::interval
      AND b.last_seen_at > now() - ${WINDOW}::interval
      AND 1 - (a.centroid <=> b.centroid) >= ${MERGE_THRESHOLD}
    ORDER BY similarity DESC
  `;

  const merged = new Set<number>();
  let count = 0;

  for (const pair of pairs) {
    if (merged.has(pair.a_id) || merged.has(pair.b_id)) continue;
    const [into, other] =
      pair.a_first <= pair.b_first ? [pair.a_id, pair.b_id] : [pair.b_id, pair.a_id];

    await sql.begin(async (tx) => {
      await tx`UPDATE item SET cluster_id = ${into} WHERE cluster_id = ${other}`;
      await tx`UPDATE cluster SET lineage_of = ${into} WHERE lineage_of = ${other}`;
      // Re-point rows that reference the merged-away cluster. Without this, the
      // DELETE below violates the foreign keys on numeric_claim / counter_feedback
      // / cluster_score (none declare ON DELETE), which would crash every
      // clustering run once a merged cluster had been scored.
      await tx`UPDATE numeric_claim SET cluster_id = ${into} WHERE cluster_id = ${other}`;
      // Move human feedback to the survivor, dropping any that would collide on
      // its UNIQUE(digest_id, cluster_id).
      await tx`
        DELETE FROM counter_feedback cf
        WHERE cf.cluster_id = ${other}
          AND EXISTS (
            SELECT 1 FROM counter_feedback c2
            WHERE c2.cluster_id = ${into} AND c2.digest_id = cf.digest_id
          )
      `;
      await tx`UPDATE counter_feedback SET cluster_id = ${into} WHERE cluster_id = ${other}`;
      // The survivor's centroid and item_count just changed, so the merged-away
      // cluster's scores are stale and are simply dropped; the survivor is
      // re-scored on the next analyse run.
      await tx`DELETE FROM cluster_score WHERE cluster_id = ${other}`;
      await tx`
        UPDATE cluster c
        SET centroid = sub.centroid, item_count = sub.cnt, last_seen_at = now()
        FROM (
          SELECT avg(embedding) AS centroid, count(*) AS cnt
          FROM item WHERE cluster_id = ${into} AND embedding IS NOT NULL
        ) sub
        WHERE c.id = ${into}
      `;
      await tx`DELETE FROM cluster WHERE id = ${other}`;
    });

    merged.add(other);
    count++;
  }
  return count;
}

async function main(): Promise<void> {
  const sql = getSql();

  const pending = await sql<PendingItem[]>`
    SELECT id, headline, standfirst, content_hash
    FROM item
    WHERE cluster_id IS NULL
      AND published_at > now() - ${WINDOW}::interval
    ORDER BY published_at ASC
  `;

  if (pending.length === 0) {
    console.log("cluster: no unclustered items in window.");
    await closeSql();
    return;
  }

  const embeddings = await embedWithCache(
    pending.map((i) => ({
      contentHash: i.content_hash,
      text: `${i.headline}. ${i.standfirst ?? ""}`,
    })),
  );

  let attached = 0;
  let created = 0;

  for (const item of pending) {
    const vector = embeddings.get(item.content_hash);
    if (!vector) continue;
    const literal = toVectorLiteral(vector);

    await sql`UPDATE item SET embedding = ${literal}::vector WHERE id = ${item.id}`;

    const decision = decideAssignment(await nearestCluster(sql, literal), ASSIGN_THRESHOLD);
    if (decision.kind === "attach") {
      await attach(sql, item.id, decision.clusterId);
      attached++;
    } else {
      await createCluster(sql, item.id, literal);
      created++;
    }
  }

  const mergedCount = await consolidate(sql);
  console.log(
    `cluster: ${pending.length} items — ${attached} attached, ` +
      `${created} new clusters, ${mergedCount} merges.`,
  );
  await closeSql();
}

main().catch(async (err: unknown) => {
  console.error("cluster failed:", err);
  await closeSql();
  process.exit(1);
});
