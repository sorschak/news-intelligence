import Link from "next/link";

import { getSql } from "../../lib/db";

// Reads live from Neon per request; a story cluster's full source list + scores.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EXCERPT_MAX_WORDS = 25; // NFR-07: never emit more than 25 words from one source

function capWords(text: string, max: number = EXCERPT_MAX_WORDS): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= max) return words.join(" ");
  return words.slice(0, max).join(" ") + "…";
}

function fmtTime(d: Date | string): string {
  return new Date(d).toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

type ClusterRow = {
  corroboration: string | null;
  originator_count: string;
  corroboration_basis: string;
  primary_ref: string | null;
  item_count: number;
  first_seen_at: Date;
  last_seen_at: Date;
};
type ScoreRow = {
  salience: string;
  structural: number;
  irreversibility: number;
  domain_relevance: number;
  contribution: number;
  ephemerality: number;
  rationale: string;
  single_source: boolean;
};
type ItemRow = {
  headline: string;
  url: string;
  standfirst: string | null;
  published_at: Date;
  origin_class: string | null;
  language: string;
  outlet: string;
  region: string;
  tier: number;
};
type ClaimRow = { claim_key: string; value: string; unit: string | null; as_of: Date; outlet: string };

const muted = { color: "#777", fontSize: "0.85rem" } as const;
const card = { border: "1px solid #eee", borderRadius: "6px", padding: "0.6rem 0.8rem", margin: "0.5rem 0" } as const;

function OriginTag({ kind }: { kind: string | null }) {
  if (!kind || kind === "unknown") return null;
  const isOrig = kind === "originator";
  return (
    <span
      style={{
        fontSize: "0.7rem",
        textTransform: "uppercase",
        letterSpacing: "0.03em",
        color: isOrig ? "#1a7f37" : "#8a6d00",
        border: `1px solid ${isOrig ? "#1a7f37" : "#8a6d00"}`,
        borderRadius: "3px",
        padding: "0 0.25rem",
        marginLeft: "0.4rem",
        verticalAlign: "middle",
      }}
    >
      {isOrig ? "originator" : "reprint"}
    </span>
  );
}

export default async function ClusterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const back = (
    <p style={{ marginTop: "2rem" }}>
      <Link href="/">← Back to archive</Link>
    </p>
  );

  if (!/^\d+$/.test(id)) {
    return (
      <main>
        <p>Invalid story id.</p>
        {back}
      </main>
    );
  }

  const sql = getSql();
  const [cluster] = await sql<ClusterRow[]>`
    SELECT corroboration::text, originator_count::text, corroboration_basis,
           primary_ref, item_count, first_seen_at, last_seen_at
    FROM cluster WHERE id = ${id}
  `;
  if (!cluster) {
    return (
      <main>
        <p>Story not found (it may have aged out of the window).</p>
        {back}
      </main>
    );
  }

  const [score] = await sql<ScoreRow[]>`
    SELECT salience::text, structural, irreversibility, domain_relevance, contribution,
           ephemerality, rationale, single_source
    FROM cluster_score WHERE cluster_id = ${id} ORDER BY scored_at DESC LIMIT 1
  `;
  // Dedupe by URL: the same article is often ingested via several of an outlet's
  // section feeds, producing duplicate item rows. Keep one per URL (lowest tier,
  // then earliest), then order the distinct sources.
  const items = await sql<ItemRow[]>`
    WITH ranked AS (
      SELECT i.headline, i.url, i.standfirst, i.published_at, i.origin_class, i.language,
             o.name AS outlet, o.region, o.tier,
             row_number() OVER (PARTITION BY i.url ORDER BY o.tier ASC, i.published_at ASC) AS rn
      FROM item i JOIN outlet o ON o.id = i.outlet_id
      WHERE i.cluster_id = ${id}
    )
    SELECT headline, url, standfirst, published_at, origin_class, language, outlet, region, tier
    FROM ranked WHERE rn = 1
    ORDER BY tier ASC, published_at ASC
  `;
  const claims = await sql<ClaimRow[]>`
    SELECT nc.claim_key, nc.value::text, nc.unit, nc.as_of, o.name AS outlet
    FROM numeric_claim nc
    JOIN item i ON i.id = nc.item_id
    JOIN outlet o ON o.id = i.outlet_id
    WHERE nc.cluster_id = ${id}
    ORDER BY nc.claim_key, nc.as_of ASC
  `;

  const lead = items[0];
  const headline = lead?.headline ?? "Story";

  // Group numeric claims into "how the figure moved" timelines (≥2 sources).
  const byKey = new Map<string, ClaimRow[]>();
  for (const c of claims) {
    const b = byKey.get(c.claim_key) ?? [];
    b.push(c);
    byKey.set(c.claim_key, b);
  }
  const timelines = [...byKey.entries()].filter(([, list]) => list.length >= 2);

  const regions = [...new Set(items.map((i) => i.region))];
  const languages = [...new Set(items.map((i) => i.language))];

  return (
    <main>
      <p style={muted}>
        <Link href="/">← Archive</Link>
      </p>
      <h1 style={{ fontSize: "1.4rem" }}>{headline}</h1>

      <div style={muted}>
        {score && (
          <>
            salience <strong>{Number(score.salience).toFixed(3)}</strong> ·{" "}
          </>
        )}
        corroboration {cluster.corroboration ? Number(cluster.corroboration).toFixed(2) : "—"} ·{" "}
        {Number(cluster.originator_count)} originators · {items.length} reports ·{" "}
        {regions.length} region{regions.length === 1 ? "" : "s"} · {languages.length} language
        {languages.length === 1 ? "" : "s"}
        <br />
        basis: {cluster.corroboration_basis}
        {cluster.primary_ref ? ` (${cluster.primary_ref})` : ""} · first seen{" "}
        {fmtTime(cluster.first_seen_at)}
      </div>

      {score?.rationale && (
        <p style={{ marginTop: "0.8rem", fontStyle: "italic" }}>{score.rationale}</p>
      )}

      {score && (
        <div style={{ ...muted, marginTop: "0.4rem" }}>
          Dimensions (0–5): structural {score.structural} · irreversibility {score.irreversibility} ·
          contribution {score.contribution} · domain {score.domain_relevance} · ephemerality{" "}
          {score.ephemerality}
        </div>
      )}

      {timelines.length > 0 && (
        <section>
          <h2 style={{ fontSize: "1.1rem", borderBottom: "1px solid #ccc", paddingBottom: "0.2rem" }}>
            How the figures moved
          </h2>
          {timelines.map(([key, list]) => (
            <div key={key} style={{ margin: "0.4rem 0", fontSize: "0.9rem" }}>
              <strong>{key.replace("|", " · ")}</strong>:{" "}
              {list
                .map((c) => `${c.outlet} ${c.value}${c.unit ? " " + c.unit : ""} (${fmtTime(c.as_of)})`)
                .join(" → ")}
            </div>
          ))}
        </section>
      )}

      <section>
        <h2 style={{ fontSize: "1.1rem", borderBottom: "1px solid #ccc", paddingBottom: "0.2rem" }}>
          All sources ({items.length})
        </h2>
        {items.map((it, i) => (
          <div key={i} style={card}>
            <a href={it.url}>{it.headline}</a>
            <OriginTag kind={it.origin_class} />
            <div style={muted}>
              {it.outlet} · {it.region} · {fmtTime(it.published_at)}
            </div>
            {it.standfirst && (
              <div style={{ color: "#333", fontSize: "0.9rem", marginTop: "0.2rem" }}>
                {capWords(it.standfirst)}
              </div>
            )}
          </div>
        ))}
      </section>

      {back}
    </main>
  );
}
