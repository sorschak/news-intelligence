/**
 * Counter-bias edition (SPEC.md 9.5) — Phase 5a.
 *
 * Fortnightly, Sunday 07:00 local. Draws from the trailing 14 days, ranks by the
 * persisted `salience_undomained` (no model calls — SPEC 9.5.2), and EXCLUDES any
 * cluster already delivered in a daily digest within the window — the point is to
 * surface what the personalisation withheld, not to re-rank what the reader saw.
 * Its principal output is the suppression rate, not a reading list. The domain
 * weight is never auto-tuned; this edition only measures and reports.
 *
 * DELIVER_PREVIEW=1 renders to a file with no mail/archive writes.
 */

import { writeFileSync } from "node:fs";

import { closeSql, getSql } from "../lib/db.js";
import {
  type CounterItem,
  renderCounterHtml,
  type ScoredCluster,
} from "../lib/digest.js";
import { optionalEnv } from "../lib/env.js";
import { signToken } from "../lib/feedback.js";
import { sendDigest } from "../lib/mail.js";
import { localHour, shouldRunNow } from "../lib/time.js";

const WINDOW = "14 days";
const COUNTER_SIZE_MAX = 10;

type Row = {
  id: string;
  salience: string;
  salience_undomained: string;
  contribution: number;
  corroboration: string;
  originator_count: string;
  headline: string;
  url: string;
  standfirst: string | null;
  published_at: Date;
  outlet: string;
  region: string;
  tier: number;
};

function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

function toScored(row: Row, salienceValue: number, hasDivergence = false): ScoredCluster {
  return {
    id: row.id,
    salience: salienceValue,
    structural: 0,
    contribution: row.contribution,
    corroboration: Number(row.corroboration),
    originatorCount: Number(row.originator_count),
    rationale: "",
    singleSource: false,
    hasDivergence,
    headline: row.headline,
    outlet: row.outlet,
    outletTier: row.tier,
    publishedAt: row.published_at,
    url: row.url,
    standfirst: row.standfirst,
  };
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? (s[m] ?? 0) : ((s[m - 1] ?? 0) + (s[m] ?? 0)) / 2;
}

async function main(): Promise<void> {
  const preview = optionalEnv("DELIVER_PREVIEW", "") === "1";
  const forced =
    preview ||
    optionalEnv("FORCE_RUN", "") === "1" ||
    optionalEnv("GITHUB_EVENT_NAME", "") === "workflow_dispatch";
  const tz = optionalEnv("TZ", "America/Toronto");
  const targetHour = Number(optionalEnv("COUNTER_LOCAL_HOUR", "7"));
  // Sunday guard in addition to the hour; the 14-day cadence is enforced by cron.
  const isSunday =
    new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(new Date()) ===
    "Sun";
  if (!forced && (!shouldRunNow(targetHour, tz) || !isSunday)) {
    console.log(`counter: not Sunday ${targetHour}:00 ${tz} (hour ${localHour(tz)}); exiting.`);
    return;
  }

  const sql = getSql();
  const editionDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  if (!preview) {
    const existing = await sql<{ id: string }[]>`
      SELECT id FROM digest WHERE edition_date = ${editionDate} AND kind = 'counter'
    `;
    if (existing.length > 0) {
      console.log(`counter: edition for ${editionDate} already exists; nothing to do.`);
      await closeSql();
      return;
    }
  }

  const rows = await sql<Row[]>`
    WITH latest AS (
      SELECT DISTINCT ON (cluster_id)
        cluster_id, salience, salience_undomained, contribution
      FROM cluster_score ORDER BY cluster_id, scored_at DESC
    ),
    lead AS (
      SELECT DISTINCT ON (i.cluster_id)
        i.cluster_id, i.headline, i.url, i.standfirst, i.published_at,
        o.name AS outlet, o.region, o.tier
      FROM item i JOIN outlet o ON o.id = i.outlet_id
      WHERE i.cluster_id IS NOT NULL
      ORDER BY i.cluster_id, o.tier ASC, i.published_at ASC
    )
    SELECT c.id, l.salience::text AS salience,
           l.salience_undomained::text AS salience_undomained, l.contribution,
           c.corroboration::text AS corroboration,
           c.originator_count::text AS originator_count,
           d.headline, d.url, d.standfirst, d.published_at, d.outlet, d.region, d.tier
    FROM cluster c
    JOIN latest l ON l.cluster_id = c.id
    JOIN lead d ON d.cluster_id = c.id
    WHERE c.last_seen_at > now() - ${WINDOW}::interval
  `;

  // Clusters already delivered in daily digests within the window.
  const deliveredRows = await sql<{ cluster_ids: string[] }[]>`
    SELECT cluster_ids FROM digest
    WHERE kind = 'daily' AND generated_at > now() - ${WINDOW}::interval
  `;
  const delivered = new Set<string>();
  for (const d of deliveredRows) for (const id of d.cluster_ids) delivered.add(String(id));

  const rankedByUndom = [...rows].sort(
    (a, b) => Number(b.salience_undomained) - Number(a.salience_undomained),
  );

  // Suppression rate: of the top decile by unpersonalised salience, what fraction
  // never reached the reader? (SPEC 9.5.2)
  const decile = rankedByUndom.slice(0, Math.max(1, Math.floor(rankedByUndom.length / 10)));
  const suppressed = decile.filter((r) => !delivered.has(r.id));
  const suppressionRate = decile.length ? round3(suppressed.length / decile.length) : 0;

  const withheldRows = rankedByUndom.filter((r) => !delivered.has(r.id)).slice(0, COUNTER_SIZE_MAX);

  // Coverage gaps: registry regions with no cluster above median salience.
  const med = median(rows.map((r) => Number(r.salience)));
  const regionsAbove = new Set(rows.filter((r) => Number(r.salience) > med).map((r) => r.region));
  const allRegions = await sql<{ region: string }[]>`SELECT DISTINCT region FROM outlet`;
  const coverageGaps = allRegions.map((r) => r.region).filter((r) => !regionsAbove.has(r));

  const contribution = rows
    .filter((r) => r.contribution >= 3)
    .sort((a, b) => Number(b.salience_undomained) - Number(a.salience_undomained))
    .slice(0, 4)
    .map((r) => toScored(r, Number(r.salience_undomained)));

  const comparison = "Comparison with the preceding six editions will appear once history accumulates.";
  const overview = `Suppression rate ${suppressionRate} over ${rankedByUndom.length} clusters; ${withheldRows.length} withheld items surfaced.`;

  // digestId is needed to sign feedback tokens, so persist first (non-preview).
  const base = optionalEnv("APP_BASE_URL", "");
  let digestId = "preview";
  if (!preview) {
    const inserted = await sql<{ id: string }[]>`
      INSERT INTO digest (generated_at, edition_date, kind, suppression_rate, cluster_ids, html, overview, model_version)
      VALUES (now(), ${editionDate}, 'counter', ${suppressionRate},
              ${`{${withheldRows.map((r) => r.id).join(",")}}`}::bigint[], 'pending', ${overview}, 'counter-v1')
      RETURNING id
    `;
    digestId = inserted[0]?.id ?? "0";
  }

  const withheld: CounterItem[] = withheldRows.map((r) => {
    const token = signToken(digestId, r.id);
    return {
      cluster: toScored(r, Number(r.salience_undomained)),
      valuedUrl: `${base}/api/feedback/valued?t=${token}`,
      indifferentUrl: `${base}/api/feedback/indifferent?t=${token}`,
    };
  });

  const html = renderCounterHtml({
    editionDate,
    suppressionRate,
    poolSize: rankedByUndom.length,
    comparison,
    withheld,
    contribution,
    coverageGaps,
  });

  if (preview) {
    const path = optionalEnv("DELIVER_PREVIEW_PATH", "counter-preview.html");
    writeFileSync(path, html, "utf8");
    console.log(
      `counter(preview): suppression=${suppressionRate}, ${withheld.length} withheld -> ${path}.`,
    );
    await closeSql();
    return;
  }

  await sql`UPDATE digest SET html = ${html} WHERE id = ${digestId}`;
  const send = await sendDigest(`Counter-bias edition — ${editionDate}`, html);
  if (!send.ok) throw new Error(`counter mail failed (${send.status}): ${send.detail}`);

  console.log(
    `counter: ${editionDate} sent — suppression ${suppressionRate}, ${withheld.length} withheld. Receipt ${send.status}.`,
  );
  await closeSql();
}

main().catch(async (err: unknown) => {
  console.error("counter failed:", err);
  await closeSql();
  process.exit(1);
});
