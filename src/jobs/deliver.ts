/**
 * Delivery job (SPEC.md Section 9) — Phase 5.
 *
 * Runs daily at 06:00 local on GitHub Actions (guarded on local hour, SPEC 10.2).
 * Composes the digest from scored clusters in the window, applies hold-and-rescore
 * (SPEC 9.4), renders static HTML, sends it to the single reader, and persists it
 * to the digest archive. Attribution and the 25-word excerpt cap are enforced in
 * the renderer, not here (SPEC 9.3). Idempotent via digest's UNIQUE(edition_date,
 * kind): a second run on the same day is a no-op.
 */

import { writeFileSync } from "node:fs";

import { SCORE_PROMPT_HASH, scoreCluster, synthesizeOverview } from "../lib/analysis.js";
import { closeSql, getSql, type Sql } from "../lib/db.js";
import {
  composeSections,
  digestClusterIds,
  HOLD_THRESHOLD,
  renderDigestHtml,
  type ScoredCluster,
} from "../lib/digest.js";
import { divergence, type Divergence, type NumericClaim } from "../lib/divergence.js";
import { optionalEnv } from "../lib/env.js";
import { sendDigest } from "../lib/mail.js";
import { scoreBoth, type Score } from "../lib/scoring.js";
import { withinHourWindow } from "../lib/time.js";

const WINDOW = "72 hours";
const RUN_WINDOW_HOURS = 5; // accept a scheduled run anytime 06:00–11:00 local

type CandidateRow = {
  id: string;
  state: string;
  held_until: Date | null;
  corroboration: string;
  originator_count: string;
  salience: string;
  structural: number;
  contribution: number;
  rationale: string;
  single_source: boolean;
  headline: string;
  url: string;
  standfirst: string | null;
  published_at: Date;
  outlet: string;
  tier: number;
};

type ItemRow = {
  id: string;
  headline: string;
  standfirst: string | null;
  published_at: Date;
  outlet: string;
  country: string;
};

function localDate(tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function toScored(row: CandidateRow, divergences: Map<string, Divergence[]>): ScoredCluster {
  const divs = divergences.get(row.id);
  return {
    id: row.id,
    salience: Number(row.salience),
    structural: row.structural,
    contribution: row.contribution,
    corroboration: Number(row.corroboration),
    originatorCount: Number(row.originator_count),
    rationale: row.rationale,
    singleSource: row.single_source,
    hasDivergence: (divs?.length ?? 0) > 0,
    divergences: divs,
    headline: row.headline,
    outlet: row.outlet,
    outletTier: row.tier,
    publishedAt: row.published_at,
    url: row.url,
    standfirst: row.standfirst,
  };
}

function dominantDimension(c: ScoredCluster): string {
  const ranked: Array<[string, number]> = [
    ["structural", c.structural],
    ["contribution", c.contribution],
    ["corroboration", c.corroboration * 5],
  ];
  ranked.sort((a, b) => b[1] - a[1]);
  return ranked[0]?.[0] ?? "structural";
}

/** Re-score a held cluster against accumulated reporting (SPEC 9.4). Returns new salience. */
async function rescoreHeld(sql: Sql, clusterId: string, corroboration: number): Promise<number> {
  const items = await sql<ItemRow[]>`
    SELECT i.id, i.headline, i.standfirst, i.published_at, o.name AS outlet, o.country
    FROM item i JOIN outlet o ON o.id = i.outlet_id
    WHERE i.cluster_id = ${clusterId}
    ORDER BY i.published_at ASC
  `;
  const raw = await scoreCluster(
    items.map((it, index) => ({
      index,
      outlet: it.outlet,
      country: it.country,
      publishedAt: it.published_at,
      headline: it.headline,
      standfirst: it.standfirst,
    })),
  );
  const score: Score = {
    structural: raw.structural,
    irreversibility: raw.irreversibility,
    corroboration,
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
      ${clusterId}, ${SCORE_PROMPT_HASH}, ${raw.structural}, ${raw.irreversibility},
      ${raw.domain_relevance}, ${raw.contribution}, ${raw.ephemerality},
      ${salience}, ${undomained}, ${raw.rationale}, ${raw.single_source}
    )
    ON CONFLICT (cluster_id, prompt_hash) DO UPDATE SET
      structural = EXCLUDED.structural, irreversibility = EXCLUDED.irreversibility,
      domain_relevance = EXCLUDED.domain_relevance, contribution = EXCLUDED.contribution,
      ephemerality = EXCLUDED.ephemerality, salience = EXCLUDED.salience,
      salience_undomained = EXCLUDED.salience_undomained, rationale = EXCLUDED.rationale,
      single_source = EXCLUDED.single_source, scored_at = now()
  `;
  return salience;
}

async function operationsLine(sql: Sql): Promise<string> {
  const poll = await sql<{ last: Date | null }[]>`
    SELECT max(last_polled_at) AS last FROM feed WHERE active = true
  `;
  const last = poll[0]?.last ? new Date(poll[0].last) : null;
  const stale = !last || Date.now() - last.getTime() > 2 * 3600 * 1000;
  const deact = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM feed WHERE active = false`;
  const deactivated = deact[0]?.n ?? 0;
  return `${stale ? "WARN: no ingestion in the last 2h. " : ""}${deactivated} feed(s) deactivated.`;
}

async function main(): Promise<void> {
  // Preview mode (DELIVER_PREVIEW=1): render the digest HTML to a file only — no
  // hold/rescore mutations, no mail, no archive write. Forced runs skip the guard.
  const preview = optionalEnv("DELIVER_PREVIEW", "") === "1";
  const event = optionalEnv("GITHUB_EVENT_NAME", "");
  const forced =
    preview ||
    optionalEnv("FORCE_RUN", "") === "1" ||
    event === "workflow_dispatch" ||
    // Chained right after a successful analyse — deliver immediately, whatever
    // the clock says; the existence check below still makes it idempotent.
    event === "workflow_run";
  const tz = optionalEnv("TZ", "America/Toronto");
  const targetHour = Number(optionalEnv("TARGET_LOCAL_HOUR", "6"));
  // Window rather than a strict hour (GitHub delays top-of-hour runs); the
  // UNIQUE(edition_date, kind) existence check keeps repeat runs a no-op.
  if (!forced && !withinHourWindow(targetHour, RUN_WINDOW_HOURS, tz)) {
    console.log(
      `deliver: outside the ${targetHour}:00–${targetHour + RUN_WINDOW_HOURS}:00 ${tz} window; exiting.`,
    );
    return;
  }

  const sql = getSql();
  const editionDate = localDate(tz);

  if (!preview) {
    const existing = await sql<{ id: string }[]>`
      SELECT id FROM digest WHERE edition_date = ${editionDate} AND kind = 'daily'
    `;
    if (existing.length > 0) {
      console.log(`deliver: digest for ${editionDate} already exists; nothing to do.`);
      await closeSql();
      return;
    }
  }

  const rows = await sql<CandidateRow[]>`
    WITH latest AS (
      SELECT DISTINCT ON (cluster_id)
        cluster_id, salience, structural, contribution, rationale, single_source
      FROM cluster_score ORDER BY cluster_id, scored_at DESC
    ),
    lead AS (
      SELECT DISTINCT ON (i.cluster_id)
        i.cluster_id, i.headline, i.url, i.standfirst, i.published_at,
        o.name AS outlet, o.tier
      FROM item i JOIN outlet o ON o.id = i.outlet_id
      WHERE i.cluster_id IS NOT NULL
      ORDER BY i.cluster_id, o.tier ASC, i.published_at ASC
    )
    SELECT c.id, c.state, c.held_until, c.corroboration::text AS corroboration,
           c.originator_count::text AS originator_count,
           l.salience::text AS salience, l.structural, l.contribution,
           l.rationale, l.single_source,
           d.headline, d.url, d.standfirst, d.published_at, d.outlet, d.tier
    FROM cluster c
    JOIN latest l ON l.cluster_id = c.id
    JOIN lead d ON d.cluster_id = c.id
    WHERE c.last_seen_at > now() - ${WINDOW}::interval
       OR (c.state = 'held' AND c.held_until <= now())
  `;

  // Divergence sequences from stored numeric claims (SPEC 8.3).
  const ids = rows.map((r) => r.id);
  const divergences = new Map<string, Divergence[]>();
  if (ids.length > 0) {
    const claims = await sql<
      { cluster_id: string; claim_key: string; value: string; outlet: string; as_of: Date }[]
    >`
      SELECT nc.cluster_id, nc.claim_key, nc.value::text AS value, o.name AS outlet, nc.as_of
      FROM numeric_claim nc
      JOIN item i ON i.id = nc.item_id
      JOIN outlet o ON o.id = i.outlet_id
      WHERE nc.cluster_id = ANY(${ids})
    `;
    const byCluster = new Map<string, NumericClaim[]>();
    for (const c of claims) {
      const bucket = byCluster.get(c.cluster_id) ?? [];
      bucket.push({
        claimKey: c.claim_key,
        value: Number(c.value),
        outlet: c.outlet,
        asOf: new Date(c.as_of),
      });
      byCluster.set(c.cluster_id, bucket);
    }
    for (const [clusterId, list] of byCluster) {
      const divs = divergence(list);
      if (divs.length > 0) divergences.set(clusterId, divs);
    }
  }

  // Hold-and-rescore state machine (SPEC 9.4).
  const pool: ScoredCluster[] = [];
  const released: ScoredCluster[] = [];
  for (const row of rows) {
    const scored = toScored(row, divergences);

    if (preview) {
      // No state changes in preview: include everything not currently held.
      if (row.state !== "held") pool.push(scored);
      continue;
    }

    const heldElapsed = row.held_until ? new Date(row.held_until).getTime() <= Date.now() : false;

    if (row.state === "held" && heldElapsed) {
      const newSalience = await rescoreHeld(sql, row.id, scored.corroboration);
      if (newSalience >= HOLD_THRESHOLD) {
        await sql`UPDATE cluster SET state = 'released' WHERE id = ${row.id}`;
        released.push({ ...scored, salience: newSalience });
      } else {
        await sql`UPDATE cluster SET state = 'open', held_until = NULL WHERE id = ${row.id}`;
      }
      continue;
    }
    if (row.state === "held") continue; // still within the hold window

    if (row.state === "open" && scored.salience >= HOLD_THRESHOLD) {
      await sql`
        UPDATE cluster SET state = 'held', held_until = now() + interval '7 days'
        WHERE id = ${row.id}
      `;
      continue; // withheld from today
    }
    pool.push(scored);
  }

  const sections = composeSections(pool);
  sections.heldReleased = released.slice(0, 3);

  const overviewPool = [...pool]
    .sort((a, b) => b.salience - a.salience)
    .slice(0, 12)
    .map((c) => ({ rationale: c.rationale, dominant: dominantDimension(c) }));
  const overview = await synthesizeOverview(overviewPool);
  const operations = await operationsLine(sql);

  const html = renderDigestHtml({ editionDate, overview, operations, sections });
  const clusterIds = digestClusterIds(sections);

  if (preview) {
    const path = optionalEnv("DELIVER_PREVIEW_PATH", "digest-preview.html");
    writeFileSync(path, html, "utf8");
    console.log(
      `deliver(preview): wrote ${clusterIds.length}-cluster digest to ${path} (no mail, no archive).`,
    );
    await closeSql();
    return;
  }

  const send = await sendDigest(`News Intelligence — ${editionDate}`, html);
  if (!send.ok) {
    throw new Error(`mail send failed (${send.status}): ${send.detail}`);
  }

  const modelVersion =
    `${optionalEnv("ANALYSIS_MODEL", "claude-sonnet-5")}+` +
    `${optionalEnv("SYNTHESIS_MODEL", "claude-opus-5")}+${SCORE_PROMPT_HASH.slice(0, 8)}`;
  const clusterIdArray = `{${clusterIds.join(",")}}`;

  await sql`
    INSERT INTO digest (generated_at, edition_date, kind, cluster_ids, html, overview, model_version)
    VALUES (now(), ${editionDate}, 'daily', ${clusterIdArray}::bigint[], ${html}, ${overview}, ${modelVersion})
    ON CONFLICT (edition_date, kind) DO NOTHING
  `;

  console.log(
    `deliver: ${editionDate} sent (${clusterIds.length} clusters, ` +
      `${released.length} released from hold). Receipt: ${send.status}.`,
  );
  await closeSql();
}

main().catch(async (err: unknown) => {
  console.error("deliver failed:", err);
  await closeSql();
  process.exit(1);
});
