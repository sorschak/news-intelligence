/**
 * Enrichment job (SPEC.md Section 7) — Phase 3.
 *
 * Runs hourly on GitHub Actions. For each cluster active in the 72h window:
 * classify every item as originator / reprint / unknown via the §7.2 cascade
 * (recording origin_evidence), recompute the cluster's originator/wire/region/
 * language counts, derive the corroboration index on the correct basis (SPEC
 * 7.3 / 7.3.1), and attach best-effort GDELT volume (SPEC 7.4).
 *
 * Idempotent (SPEC 3.1): re-running reclassifies and recomputes to the same
 * state. Corroboration is a deterministic function of stored counts (FR-05).
 */

import { closeSql, getSql, type Sql } from "../lib/db.js";
import {
  chooseBasis,
  corroborationByOutlets,
  corroborationByPublication,
} from "../lib/corroboration.js";
import { gdeltVolume, topKeywords } from "../lib/gdelt.js";
import { classify } from "../lib/originator.js";

const WINDOW = "72 hours";
const PRECEDENCE_SIMILARITY = 0.95;

type ClusterRow = { id: string; primary_ref: string | null; gdelt_volume: string | null };

type ItemRow = {
  id: string;
  headline: string;
  standfirst: string | null;
  outlet_id: number;
  published_at: Date;
  creator: string | null;
  embedding: string | null;
  is_wire: boolean;
  tier: number;
};

type CountsRow = {
  originator_count: string;
  wire_count: string;
  region_count: string;
  language_count: string;
  has_specialist_originator: boolean;
};

async function findPrecedent(sql: Sql, item: ItemRow, clusterId: string): Promise<string | null> {
  if (!item.embedding) return null;
  const rows = await sql<{ id: string }[]>`
    SELECT id FROM item
    WHERE cluster_id = ${clusterId}
      AND id <> ${item.id}
      AND outlet_id <> ${item.outlet_id}
      AND embedding IS NOT NULL
      AND published_at < ${item.published_at}
      AND published_at >= ${item.published_at}::timestamptz - interval '90 minutes'
      AND 1 - (embedding <=> ${item.embedding}::vector) > ${PRECEDENCE_SIMILARITY}
    ORDER BY published_at ASC
    LIMIT 1
  `;
  return rows[0]?.id ?? null;
}

async function clusterCounts(sql: Sql, clusterId: string): Promise<CountsRow> {
  const rows = await sql<CountsRow[]>`
    WITH outlet_class AS (
      SELECT o.id AS outlet_id, o.is_wire, o.region, o.language, o.is_specialist,
             CASE
               WHEN bool_or(i.origin_class = 'originator') THEN 'originator'
               WHEN bool_or(i.origin_class = 'unknown')    THEN 'unknown'
               ELSE 'reprint'
             END AS cls
      FROM item i
      JOIN outlet o ON o.id = i.outlet_id
      WHERE i.cluster_id = ${clusterId}
      GROUP BY o.id, o.is_wire, o.region, o.language, o.is_specialist
    )
    SELECT
      COALESCE(SUM(CASE cls WHEN 'originator' THEN 1
                            WHEN 'unknown'    THEN 0.5
                            ELSE 0 END), 0)                             AS originator_count,
      COUNT(*) FILTER (WHERE cls = 'originator' AND is_wire)            AS wire_count,
      COUNT(DISTINCT region)   FILTER (WHERE cls IN ('originator', 'unknown')) AS region_count,
      COUNT(DISTINCT language) FILTER (WHERE cls IN ('originator', 'unknown')) AS language_count,
      COALESCE(bool_or(is_specialist AND cls = 'originator'), false)    AS has_specialist_originator
    FROM outlet_class
  `;
  const row = rows[0];
  if (!row) throw new Error(`no counts for cluster ${clusterId}`);
  return row;
}

async function enrichCluster(sql: Sql, cluster: ClusterRow): Promise<void> {
  const items = await sql<ItemRow[]>`
    SELECT i.id, i.headline, i.standfirst, i.outlet_id, i.published_at, i.creator,
           i.embedding::text AS embedding, o.is_wire, o.tier
    FROM item i
    JOIN outlet o ON o.id = i.outlet_id
    WHERE i.cluster_id = ${cluster.id}
    ORDER BY i.published_at ASC
  `;
  if (items.length === 0) return;

  for (const item of items) {
    const precedentId = await findPrecedent(sql, item, cluster.id);
    const origin = classify({
      headline: item.headline,
      standfirst: item.standfirst,
      outletIsWire: item.is_wire,
      outletTier: item.tier,
      creator: item.creator,
      precedent: precedentId ? { itemId: precedentId } : null,
    });
    await sql`
      UPDATE item SET origin_class = ${origin.class}, origin_evidence = ${origin.evidence}
      WHERE id = ${item.id}
    `;
  }

  const counts = await clusterCounts(sql, cluster.id);
  const parsed = {
    originatorCount: Number(counts.originator_count),
    wireCount: Number(counts.wire_count),
    regionCount: Number(counts.region_count),
    languageCount: Number(counts.language_count),
  };

  const basis = chooseBasis(cluster.primary_ref, counts.has_specialist_originator);
  const corroboration =
    basis === "primary_publication"
      ? corroborationByPublication({
          primaryRef: cluster.primary_ref,
          // These signals are set by analysis (Phase 4); false until then.
          hasIndependentExpertComment: false,
          mentionsReplication: false,
        })
      : corroborationByOutlets(parsed);

  // GDELT context is fetched once per cluster (only when not already stored).
  let gdelt = cluster.gdelt_volume === null ? null : Number(cluster.gdelt_volume);
  if (cluster.gdelt_volume === null) {
    gdelt = await gdeltVolume(topKeywords(items.map((i) => i.headline)));
  }

  await sql`
    UPDATE cluster SET
      originator_count = ${parsed.originatorCount},
      wire_count = ${parsed.wireCount},
      region_count = ${parsed.regionCount},
      language_count = ${parsed.languageCount},
      corroboration = ${corroboration},
      corroboration_basis = ${basis},
      gdelt_volume = ${gdelt}
    WHERE id = ${cluster.id}
  `;
}

async function main(): Promise<void> {
  const sql = getSql();
  const clusters = await sql<ClusterRow[]>`
    SELECT id, primary_ref, gdelt_volume::text AS gdelt_volume
    FROM cluster
    WHERE last_seen_at > now() - ${WINDOW}::interval
    ORDER BY id ASC
  `;

  for (const cluster of clusters) {
    await enrichCluster(sql, cluster);
  }

  console.log(`enrich: processed ${clusters.length} clusters in window.`);
  await closeSql();
}

main().catch(async (err: unknown) => {
  console.error("enrich failed:", err);
  await closeSql();
  process.exit(1);
});
