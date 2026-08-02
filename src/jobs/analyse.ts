/**
 * Analysis job (SPEC.md Section 8) — Phase 4.
 *
 * Runs daily, pre-digest, on GitHub Actions. For each eligible cluster in the
 * window (≥2 items, corroboration > 0.15, not yet scored with the current prompt
 * hash): score the five dimensions with Claude Sonnet, compute both salience
 * values (SPEC 8.2) and persist them, extract numeric claims for later divergence
 * detection (SPEC 8.3), and record any primary_ref for the corroboration basis.
 *
 * Guarded on local hour (SPEC 10.2). Idempotent via cluster_score's
 * UNIQUE(cluster_id, prompt_hash): a re-run skips clusters already scored with
 * this prompt version.
 */

import { extractClaims, SCORE_PROMPT_HASH, scoreCluster } from "../lib/analysis.js";
import { closeSql, getSql, type Sql } from "../lib/db.js";
import { optionalEnv } from "../lib/env.js";
import { scoreBoth, type Score } from "../lib/scoring.js";
import { shouldRunNow } from "../lib/time.js";

const WINDOW = "72 hours";

type ClusterRow = { id: string; corroboration: string };
type ItemRow = {
  id: string;
  headline: string;
  standfirst: string | null;
  published_at: Date;
  outlet: string;
  country: string;
};

async function analyseCluster(sql: Sql, cluster: ClusterRow): Promise<void> {
  const items = await sql<ItemRow[]>`
    SELECT i.id, i.headline, i.standfirst, i.published_at, o.name AS outlet, o.country
    FROM item i
    JOIN outlet o ON o.id = i.outlet_id
    WHERE i.cluster_id = ${cluster.id}
    ORDER BY i.published_at ASC
  `;
  if (items.length < 2) return;

  const inputs = items.map((it, index) => ({
    index,
    outlet: it.outlet,
    country: it.country,
    publishedAt: it.published_at,
    headline: it.headline,
    standfirst: it.standfirst,
  }));

  const raw = await scoreCluster(inputs);
  const score: Score = {
    structural: raw.structural,
    irreversibility: raw.irreversibility,
    corroboration: Number(cluster.corroboration),
    contribution: raw.contribution,
    domainRelevance: raw.domain_relevance,
    ephemerality: raw.ephemerality,
  };
  const { salience, undomained } = scoreBoth(score);

  await sql`
    INSERT INTO cluster_score (
      cluster_id, prompt_hash, structural, irreversibility, domain_relevance,
      contribution, ephemerality, salience, salience_undomained, rationale, single_source
    ) VALUES (
      ${cluster.id}, ${SCORE_PROMPT_HASH}, ${raw.structural}, ${raw.irreversibility},
      ${raw.domain_relevance}, ${raw.contribution}, ${raw.ephemerality},
      ${salience}, ${undomained}, ${raw.rationale}, ${raw.single_source}
    )
    ON CONFLICT (cluster_id, prompt_hash) DO NOTHING
  `;

  if (raw.primary_ref) {
    await sql`UPDATE cluster SET primary_ref = ${raw.primary_ref} WHERE id = ${cluster.id}`;
  }

  const claims = await extractClaims(inputs);
  for (const claim of claims) {
    const item = items[claim.item_index];
    if (!item) continue; // model referenced an out-of-range index
    await sql`
      INSERT INTO numeric_claim (cluster_id, item_id, claim_key, value, unit, qualifier, as_of)
      VALUES (${cluster.id}, ${item.id}, ${claim.claim_key}, ${claim.value},
              ${claim.unit}, ${claim.qualifier}, ${item.published_at})
    `;
  }
}

async function main(): Promise<void> {
  // Manual/forced runs (workflow_dispatch or FORCE_RUN=1) skip the daily-hour guard.
  const forced =
    optionalEnv("FORCE_RUN", "") === "1" ||
    optionalEnv("GITHUB_EVENT_NAME", "") === "workflow_dispatch";
  const targetHour = Number(optionalEnv("ANALYSIS_LOCAL_HOUR", "5"));
  const tz = optionalEnv("TZ", "America/Toronto");
  if (!forced && !shouldRunNow(targetHour, tz)) {
    console.log(`analyse: not ${targetHour}:00 ${tz}; exiting.`);
    return;
  }

  // Optional per-run cap (ANALYSE_MAX_CLUSTERS); most-corroborated first.
  const maxClusters = Number(optionalEnv("ANALYSE_MAX_CLUSTERS", "0"));
  const sql = getSql();
  const clusters = await sql<ClusterRow[]>`
    SELECT c.id, c.corroboration::text AS corroboration
    FROM cluster c
    WHERE c.item_count >= 2
      AND c.corroboration IS NOT NULL
      AND c.corroboration > 0.15
      AND c.last_seen_at > now() - ${WINDOW}::interval
      AND NOT EXISTS (
        SELECT 1 FROM cluster_score s
        WHERE s.cluster_id = c.id AND s.prompt_hash = ${SCORE_PROMPT_HASH}
      )
    ORDER BY c.corroboration DESC
    ${maxClusters > 0 ? sql`LIMIT ${maxClusters}` : sql``}
  `;

  let scored = 0;
  let failed = 0;
  for (const cluster of clusters) {
    try {
      await analyseCluster(sql, cluster);
      scored++;
    } catch (err) {
      failed++;
      console.error(`analyse: cluster ${cluster.id} failed:`, err);
    }
  }

  console.log(`analyse: ${clusters.length} eligible — ${scored} scored, ${failed} failed.`);
  await closeSql();
}

main().catch(async (err: unknown) => {
  console.error("analyse failed:", err);
  await closeSql();
  process.exit(1);
});
