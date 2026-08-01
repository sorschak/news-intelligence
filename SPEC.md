# Corroboration-Weighted News Intelligence System

Technical Specification, Version 1.2. Internal working document, 1 August 2026.

> This file is authoritative. Read it before making design decisions. Where the
> code and this document disagree, this document wins unless the discrepancy is
> recorded in `DECISIONS.md` with a rationale.

**Revision history**

| Version | Change |
|---|---|
| 1.0 | Initial specification. Python services, self-hosted Postgres, self-hosted embeddings, single VPS |
| 1.1 | Added the `contribution` scoring dimension with basis-dependent corroboration, and the fortnightly counter-bias edition with suppression rate |
| 1.2 | Stack revised to TypeScript, Neon, Vercel and GitHub Actions. Self-hosted embeddings replaced by a hosted multilingual API. Compute split from interface. Docker removed |

---

## 1. Purpose, Scope, and Design Premise

### 1.1 Purpose

This document specifies a system that ingests the daily output of a defined set of international news publications, groups reports of the same underlying event across outlets, measures the degree to which each event is independently corroborated, scores each event for durable significance rather than prominence, and delivers a structured analytical digest to a single reader.

The system is explicitly not a news summariser. The distinction is material to every design decision that follows. A summariser compresses what outlets published. This system measures the relationship between what outlets published and what can be independently established, and ranks by criteria that are indifferent to editorial prominence. The intended output is a shorter reading list with better reasons attached, not a substitute for reading.

### 1.2 Design premise

Four premises are load-bearing and should be revisited if the system underperforms.

The first premise is that headline, standfirst, timestamp, section, and outlet identity are sufficient inputs for clustering, corroboration measurement, and salience ranking, and that full article text is required only for deep synthesis of an individual story, which the system does not attempt. This premise is what makes the system legally and economically viable.

The second premise is that the count of independent originating newsrooms carrying a story is a better proxy for factual reliability than the total count of outlets carrying it, because syndication inflates the latter without adding evidentiary weight. Distinguishing originators from reprints is therefore the central technical problem of the system rather than an incidental preprocessing step.

The third premise is that significance and prominence are weakly correlated, and that a system optimising for the former must actively penalise signals that proxy for the latter. Recency, volume, and emotional intensity are treated as negative or neutral evidence in the ranking function, not as positive evidence.

The fourth premise, added in version 1.2, is that a system serving one reader should own as little infrastructure as possible. Every self-hosted component is a maintenance obligation that competes with the reader's actual purpose. Managed services are preferred wherever they do not compromise the three premises above.

### 1.3 Out of scope

The following are explicitly excluded. Full-text retrieval of paywalled articles. Social media ingestion. Sentiment or tone scoring as a ranking input. Multi-user access, authentication, or role management beyond a single shared secret. Mobile applications. Real-time alerting. Portfolio or trading integration. Automated action of any kind on the basis of system output.

---

## 2. Requirements

### 2.1 Functional requirements

| ID | Requirement | Priority | Verification |
|---|---|---|---|
| FR-01 | Poll a registry of RSS and Atom feeds on a configurable schedule and persist normalised item records | Must | Item count per feed per day |
| FR-02 | Detect and discard duplicate items from the same feed across polls | Must | Zero duplicate source_guid rows |
| FR-03 | Group items describing the same underlying event into clusters across outlets and languages | Must | Manual review of 50 clusters |
| FR-04 | Classify each item as originating newsroom reporting or syndicated reprint | Must | Precision against 200 labelled items |
| FR-05 | Compute a corroboration index per cluster from distinct originators and wire presence | Must | Deterministic recomputation test |
| FR-06 | Retrieve GDELT volume and language-spread metrics for each cluster | Should | Non-null coverage rate above 60 percent |
| FR-07 | Score each cluster for structural consequence and irreversibility using a language model | Must | Inter-run variance below 1.0 on 5-point scale |
| FR-08 | Extract numeric claims per cluster and flag divergence across outlets | Must | Recall on 20 seeded divergence cases |
| FR-09 | Rank clusters by composite salience and emit a bounded digest | Must | Digest length within configured bounds |
| FR-10 | Emit a separate low-corroboration channel for single-originator items | Must | Channel populated daily |
| FR-11 | Withhold high-scoring clusters for a configurable interval and rescore before release | Should | Held items rescored at T plus 7 days |
| FR-12 | Deliver the digest as HTML by electronic mail and persist it to an archive | Must | Delivery receipt logged |
| FR-13 | Expose a searchable archive of clusters, scores, and digests | Should | Query returns within 2 seconds |
| FR-14 | Record provenance for every assertion in the digest as outlet, timestamp, and URL | Must | No unattributed assertions |
| FR-15 | Score each cluster for durable contribution to knowledge, capability, or culture | Must | Manual review of 30 science and culture clusters |
| FR-16 | Compute corroboration from publication venue rather than outlet count where a cluster is anchored to a primary publication | Must | Correct basis assigned on 40 labelled clusters |
| FR-17 | Generate a fortnightly counter-bias edition with the domain relevance weight set to zero, excluding items already delivered | Must | Edition delivered on schedule with non-empty content |
| FR-18 | Compute and report a suppression rate per counter-bias edition | Must | Rate recomputable from stored scores |
| FR-19 | Execute all scheduled work in the reader's local timezone irrespective of the scheduler's UTC-only constraint | Must | No schedule drift across a DST boundary |

### 2.2 Non-functional requirements

| ID | Attribute | Target |
|---|---|---|
| NFR-01 | Ingestion latency | Item persisted within 45 minutes of feed publication |
| NFR-02 | Digest generation window | Complete within 30 minutes of scheduled start |
| NFR-03 | Availability | Best effort. A missed digest is acceptable; a wrong digest is not |
| NFR-04 | Cost ceiling | Under 100 USD per month inclusive of all services |
| NFR-05 | Storage growth | Under 6 GB per year at 250 feeds |
| NFR-06 | Reproducibility | Any digest regenerable from stored inputs with identical scores except model-derived fields |
| NFR-07 | Copyright compliance | No stored or emitted excerpt exceeds 25 words from a single source |
| NFR-08 | Operability | Full recovery from total loss within 60 minutes given the repository and four service credentials |
| NFR-09 | Maintenance burden | Under 2 hours per month in steady state |
| NFR-10 | Infrastructure ownership | No self-managed servers, containers, or runtimes |

---

## 3. System Architecture

### 3.1 Compute and interface are separated

Version 1.0 assumed a single virtual server running five scheduled processes. Version 1.2 replaces this with a split that follows from a constraint of the serverless platform rather than from architectural preference.

Vercel functions are duration-bounded. On the Hobby tier they terminate at 10 seconds and cron cannot fire more than once per day; on Pro they terminate at 300 seconds. The daily analysis pass makes roughly 250 model calls and will not complete inside either bound, and a failed cron invocation is not retried. The pipeline therefore cannot live on Vercel.

GitHub Actions has no such bound. Jobs run for hours, execute Node natively so the same TypeScript runs unchanged, and provide scheduling and secret storage without additional services. The pipeline runs there.

Vercel retains what it is good at: serving the archive interface and the counter-edition feedback endpoints, both of which are short-lived request handlers and neither of which is on the critical path for digest generation.

Neon is the shared state. Both compute surfaces connect to the same database over its pooled endpoint.

| Component | Runs on | Cadence | Duration |
|---|---|---|---|
| `ingest` | GitHub Actions | Every 30 minutes | 40 to 90 seconds |
| `cluster` | GitHub Actions | Every 30 minutes, after ingest | 60 to 180 seconds |
| `enrich` | GitHub Actions | Hourly | 30 to 120 seconds |
| `analyse` | GitHub Actions | Daily, pre-digest | 8 to 20 minutes |
| `deliver` | GitHub Actions | Daily 06:00 local | 30 to 60 seconds |
| `counter` | GitHub Actions | Fortnightly, Sunday 07:00 local | 20 to 40 seconds |
| Archive UI | Vercel | On request | Under 2 seconds |
| Feedback endpoints | Vercel | On request | Under 500 ms |

All pipeline stages are idempotent. Re-running any stage over the same window must produce identical database state except for model-derived fields, which are keyed by prompt hash. Stages claim work by selecting rows in a pending state and updating them within a transaction, which is sufficient concurrency control at this volume and avoids introducing a queue.

### 3.2 Technology selection

| Layer | Selection | Rationale |
|---|---|---|
| Language | TypeScript 5.x on Node 22 | One language across pipeline and interface; matches existing project conventions |
| Datastore | Neon Postgres 17 with pgvector | Managed, scales to zero, branching supports threshold calibration, no container to operate |
| DB client | `postgres` (porsager) with Neon pooled endpoint | Lightweight, no ORM; SQL stays visible |
| Migrations | `node-pg-migrate`, numbered files | Schema changes are reviewable artefacts |
| Feed parsing | `rss-parser` with `undici` | Handles malformed feeds; `undici` gives conditional request control |
| Embeddings | Hosted multilingual API, 1024 dimensions | See 3.3 |
| Analysis model | Claude Sonnet, per cluster | Cost-appropriate for high call volume |
| Synthesis model | Claude Opus, once daily | Single call; quality justifies cost |
| Pipeline runtime | GitHub Actions | No duration ceiling, native Node, free at this volume |
| Interface | Next.js on Vercel | Archive and feedback routes; deploys from the repository |
| Mail | Transactional mail API | Digest delivery to one recipient |
| Templating | Server-rendered HTML in the deliver job | Digest is a static artefact, persisted to `digest.html` |

### 3.3 The embedding decision, revised

Version 1.0 specified a self-hosted 768-dimension model, justified on the grounds that per-item API cost would become material. That reasoning was based on the specification's ceiling of 20,000 items daily rather than its expected volume. At 140 to 180 feeds the realistic figure is 4,000 to 6,000 items daily, which at approximately 80 tokens per item is under 15 million tokens monthly. On current hosted embedding pricing that is well under one dollar. The cost argument does not survive, and self-hosting cannot in any case run on either compute surface selected above.

The requirement that does survive is cross-lingual alignment. The feed registry spans English, French, German, Spanish, and Portuguese, and a story reported in Le Monde and in the Financial Times must land in the same cluster. The selected model must be explicitly multilingual rather than merely tolerant of non-English input, and this must be verified during Phase 2 calibration rather than assumed.

Embedding dimensionality is a configuration constant, `EMBEDDING_DIMS`, defaulting to 1024. Changing the model requires a migration altering the `vector` column and a full re-embedding of the active window, which is a several-minute operation at this volume and should not be feared.

The one property lost is independence. The system now has an external dependency on its core clustering function. Mitigation is a persisted embedding cache keyed by content hash, so that a provider outage degrades new ingestion without invalidating existing clusters.

---

## 4. Data Model

Seven tables carry the system. Anything recomputable is recomputed, except model outputs, which are cached against a prompt version hash.

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE outlet (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  tier            SMALLINT NOT NULL,        -- 1 wire, 2 originator, 3 aggregator
  region          TEXT NOT NULL,
  country         TEXT NOT NULL,
  language        TEXT NOT NULL,            -- ISO 639-1
  orientation     TEXT,                     -- descriptive, not scored
  ownership       TEXT,
  is_wire         BOOLEAN NOT NULL DEFAULT FALSE,
  is_specialist   BOOLEAN NOT NULL DEFAULT FALSE,
  active          BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE feed (
  id              SERIAL PRIMARY KEY,
  outlet_id       INT NOT NULL REFERENCES outlet(id),
  url             TEXT NOT NULL UNIQUE,
  section         TEXT,
  etag            TEXT,
  last_modified   TEXT,
  last_polled_at  TIMESTAMPTZ,
  consecutive_failures SMALLINT NOT NULL DEFAULT 0,
  active          BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE cluster (
  id              BIGSERIAL PRIMARY KEY,
  centroid        vector(1024) NOT NULL,
  first_seen_at   TIMESTAMPTZ NOT NULL,
  last_seen_at    TIMESTAMPTZ NOT NULL,
  item_count      INT NOT NULL DEFAULT 0,
  originator_count NUMERIC NOT NULL DEFAULT 0,   -- unknowns weigh 0.5
  wire_count      SMALLINT NOT NULL DEFAULT 0,
  region_count    SMALLINT NOT NULL DEFAULT 0,
  language_count  SMALLINT NOT NULL DEFAULT 0,
  gdelt_volume    NUMERIC,
  corroboration   NUMERIC,
  corroboration_basis TEXT NOT NULL DEFAULT 'outlets',
                                            -- outlets | primary_publication
  primary_ref     TEXT,                     -- DOI, arXiv id, or venue
  state           TEXT NOT NULL DEFAULT 'open',   -- open | held | released
  held_until      TIMESTAMPTZ,
  lineage_of      BIGINT REFERENCES cluster(id)   -- continuing story pointer
);

CREATE TABLE item (
  id              BIGSERIAL PRIMARY KEY,
  feed_id         INT NOT NULL REFERENCES feed(id),
  outlet_id       INT NOT NULL REFERENCES outlet(id),
  source_guid     TEXT NOT NULL,
  url             TEXT NOT NULL,
  headline        TEXT NOT NULL,
  standfirst      TEXT,                     -- truncated to 300 chars on ingest
  published_at    TIMESTAMPTZ NOT NULL,
  ingested_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  language        TEXT NOT NULL,
  content_hash    TEXT NOT NULL,            -- embedding cache key
  embedding       vector(1024),
  cluster_id      BIGINT REFERENCES cluster(id),
  origin_class    TEXT,                     -- originator | reprint | unknown
  origin_evidence TEXT,                     -- rule that fired
  UNIQUE (feed_id, source_guid)
);

CREATE INDEX item_embedding_idx ON item
  USING hnsw (embedding vector_cosine_ops);
CREATE INDEX item_published_idx ON item (published_at DESC);
CREATE INDEX item_cluster_idx  ON item (cluster_id);

CREATE TABLE cluster_score (
  id              BIGSERIAL PRIMARY KEY,
  cluster_id      BIGINT NOT NULL REFERENCES cluster(id),
  scored_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  prompt_hash     TEXT NOT NULL,
  structural      SMALLINT NOT NULL,        -- 0 to 5
  irreversibility SMALLINT NOT NULL,        -- 0 to 5
  domain_relevance SMALLINT NOT NULL,       -- 0 to 5
  contribution    SMALLINT NOT NULL,        -- 0 to 5
  ephemerality    SMALLINT NOT NULL,        -- 0 to 5, penalised
  salience        NUMERIC NOT NULL,         -- domain weight applied
  salience_undomained NUMERIC NOT NULL,     -- domain weight zeroed
  rationale       TEXT NOT NULL,
  single_source   BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (cluster_id, prompt_hash)
);

CREATE TABLE numeric_claim (
  id              BIGSERIAL PRIMARY KEY,
  cluster_id      BIGINT NOT NULL REFERENCES cluster(id),
  item_id         BIGINT NOT NULL REFERENCES item(id),
  claim_key       TEXT NOT NULL,            -- normalised, e.g. deaths|ceuta
  value           NUMERIC NOT NULL,
  unit            TEXT,
  qualifier       TEXT,                     -- "at least", "up to", "about"
  as_of           TIMESTAMPTZ NOT NULL
);

CREATE TABLE digest (
  id              BIGSERIAL PRIMARY KEY,
  generated_at    TIMESTAMPTZ NOT NULL,
  edition_date    DATE NOT NULL,
  kind            TEXT NOT NULL DEFAULT 'daily',   -- daily | counter
  suppression_rate NUMERIC,                 -- counter editions only
  cluster_ids     BIGINT[] NOT NULL,
  html            TEXT NOT NULL,
  overview        TEXT NOT NULL,
  model_version   TEXT NOT NULL,
  UNIQUE (edition_date, kind)
);

CREATE TABLE counter_feedback (
  id              BIGSERIAL PRIMARY KEY,
  digest_id       BIGINT NOT NULL REFERENCES digest(id),
  cluster_id      BIGINT NOT NULL REFERENCES cluster(id),
  verdict         TEXT NOT NULL,            -- valued | indifferent
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (digest_id, cluster_id)
);
```

Note on connections. GitHub Actions jobs are short-lived and open a connection per run; Vercel functions are serverless and may open many. Both must use Neon's **pooled** connection string, not the direct endpoint. Using the direct endpoint from Vercel will exhaust connections under trivial load.

---

## 5. Ingestion

### 5.1 Feed registry construction

The registry is populated by outlet rather than by URL, because feed paths change while outlets persist. Phase 0 includes an automated discovery routine. For each outlet in the reference source list, the routine fetches the homepage, parses link elements advertising an RSS or Atom alternate, filters to sections of interest, and writes candidate feeds for manual confirmation. This is preferable to hardcoding a list, roughly a quarter of which would be stale within a year.

```typescript
type FeedCandidate = { url: string; title: string | null };

const COMMON_PATHS = [
  "/rss", "/feed", "/rss.xml", "/feeds/all.rss",
  "/arc/outboundfeeds/rss/", "/index.xml",
];

export async function discoverFeeds(homepage: string): Promise<FeedCandidate[]> {
  const out: FeedCandidate[] = [];
  const html = await fetchText(homepage);

  for (const link of parseAlternateLinks(html)) {
    if (link.type === "application/rss+xml" || link.type === "application/atom+xml") {
      out.push({ url: new URL(link.href, homepage).toString(), title: link.title });
    }
  }

  for (const path of COMMON_PATHS) {
    const url = new URL(path, homepage).toString();
    if (await headOk(url)) out.push({ url, title: null });
  }

  return dedupeBy(out, (c) => c.url);
}
```

### 5.2 Polling policy

Polling respects conditional request semantics. Every request sends the stored ETag and Last-Modified values, and a 304 response is recorded without further processing. This reduces bandwidth by roughly an order of magnitude and keeps the system a well-behaved client of publishers whose goodwill it depends on. The user agent identifies the system and provides a contact address.

Feeds are polled with bounded concurrency, not serially and not all at once. Twelve concurrent requests completes 180 feeds in well under a minute without appearing abusive to any single origin.

```typescript
const CONCURRENCY = 12;
const UA = "NewsIntel/1.2 (personal research; contact: <address>)";

export async function pollAll(feeds: Feed[]): Promise<void> {
  await mapWithConcurrency(feeds, CONCURRENCY, async (feed) => {
    const headers: Record<string, string> = { "user-agent": UA };
    if (feed.etag) headers["if-none-match"] = feed.etag;
    if (feed.lastModified) headers["if-modified-since"] = feed.lastModified;

    try {
      const res = await request(feed.url, { headers, maxRedirections: 2 });
      if (res.statusCode === 304) return void markPolled(feed, { changed: false });
      if (res.statusCode >= 400) return void markFailure(feed, res.statusCode);

      const parsed = await parseFeed(await res.body.text());
      await persistItems(feed, parsed.items.map(normalise));
      await markPolled(feed, {
        changed: true,
        etag: res.headers["etag"] as string | undefined,
        lastModified: res.headers["last-modified"] as string | undefined,
      });
    } catch (err) {
      await markFailure(feed, err);
    }
  });
}
```

A feed failing five consecutive polls is deactivated and reported in the next digest under an operations footer. Silent feed death is the most common failure in systems of this kind and the one most likely to go unnoticed, since the digest continues to appear and simply omits a region.

### 5.3 Normalisation

| Field | Rule |
|---|---|
| `headline` | Strip HTML, collapse whitespace, decode entities. Reject if under 15 characters |
| `standfirst` | Strip HTML, truncate at 300 characters on a word boundary. Never store full body content even when the feed supplies it |
| `published_at` | Parse to UTC. If absent or in the future, substitute ingestion time and set a flag |
| `url` | Strip tracking parameters (`utm_*`, `fbclid`, `ref`). Resolve one redirect hop |
| `language` | Feed declaration if present, otherwise detection on headline plus standfirst |
| `source_guid` | Feed-declared GUID if present, otherwise SHA-256 of canonical URL |
| `content_hash` | SHA-256 of headline plus normalised standfirst; the embedding cache key |

The 300-character truncation is a compliance control, not a storage optimisation. Some feeds publish complete article bodies, and retaining them would place the system outside the copyright position established in Section 11.

---

## 6. Clustering

### 6.1 Algorithm

Clustering is incremental over a rolling 72-hour window. Batch clustering is rejected because it produces unstable cluster identity across runs, which breaks the held-and-rescored mechanism in Section 9.4.

```typescript
const WINDOW_HOURS      = 72;
const ASSIGN_THRESHOLD  = 0.82;   // cosine similarity to centroid
const MERGE_THRESHOLD   = 0.88;   // centroid to centroid

export async function assignAll(items: Item[]): Promise<void> {
  const texts = items.map((i) => `${i.headline}. ${i.standfirst ?? ""}`);
  const vectors = await embedBatch(texts);          // cached by content_hash

  for (const [i, item] of items.entries()) {
    await setEmbedding(item.id, vectors[i]);

    const best = await nearestCluster(vectors[i], WINDOW_HOURS);
    if (best && best.similarity >= ASSIGN_THRESHOLD) {
      await attach(item, best.cluster);             // centroid updated in SQL
    } else {
      await createCluster(item, vectors[i]);
    }
  }
  await consolidate();
}

export async function consolidate(): Promise<void> {
  for (const [a, b] of await candidatePairs(WINDOW_HOURS)) {
    if (cosine(a.centroid, b.centroid) >= MERGE_THRESHOLD) {
      await merge({ into: olderOf(a, b), other: newerOf(a, b) });
    }
  }
}
```

Embedding is batched rather than per-item. Hosted providers accept batches of 96 to 128 texts per request, which reduces a 5,000-item day from 5,000 requests to roughly 50.

### 6.2 Threshold calibration

The two thresholds are the only tuning parameters that materially affect output quality, and they must be calibrated empirically rather than adopted from this document. Run ingestion for seven days without clustering, then sweep the assignment threshold from 0.74 to 0.90 in steps of 0.02, manually labelling 100 sampled assignments at each setting. The operating point maximises F-measure with a deliberate bias toward precision, since an over-merged cluster silently conflates two events and inflates the corroboration index, the most damaging failure the system can produce.

Neon's branching makes this practical. Create a branch per threshold setting, run the sweep against each, and discard. This is the principal operational advantage of the managed database over the container it replaced.

### 6.3 Known hazards

| Hazard | Manifestation | Mitigation |
|---|---|---|
| Running story drift | A multi-week conflict collapses into one enormous cluster | Cap cluster age at 72 hours; a continuing story forms a new daily cluster with `lineage_of` set |
| Boilerplate collision | Live-blog and round-up items cluster on format rather than content | Exclude items whose headline matches known round-up patterns from centroid computation |
| Cross-lingual miss | Same event in French and English fails to merge | Verify explicitly at calibration; this is the property the multilingual model was selected for and it must be tested, not assumed |
| Named-entity dominance | All items mentioning one prominent figure merge regardless of subject | Down-weight high-frequency entities in the embedded text |

---

## 7. Enrichment: Originators and Corroboration

### 7.1 Why this is the central problem

Thirty outlets carrying the same Agence France-Presse dispatch constitute one act of reporting, not thirty. A corroboration measure counting outlets rather than originating newsrooms will rank syndicated commodity news above genuinely multiply-sourced news, inverting the system's purpose. Originator classification is the highest-value component in the specification and the one most deserving of engineering attention.

### 7.2 Classification cascade

Rules are ordered. The first to fire determines the class and is recorded in `origin_evidence` for auditability.

| # | Rule | Test | Class assigned |
|---|---|---|---|
| 1 | Explicit wire credit | Headline or standfirst matches a credit pattern such as a trailing agency attribution or a parenthesised agency name | reprint, credited to named wire |
| 2 | Outlet is a wire | `outlet.is_wire` is true | originator, wire |
| 3 | Aggregator tier | `outlet.tier` equals 3 | reprint |
| 4 | Temporal precedence | Headline cosine above 0.95 against an earlier item in the cluster from a different outlet, gap under 90 minutes | reprint of the earlier item |
| 5 | Byline presence | Feed supplies a creator field naming a person rather than an organisation | originator |
| 6 | Default | None of the above | unknown, counted at 0.5 weight |

Rule 4 is the workhorse and the most fragile, because near-simultaneous independent reporting of the same official statement produces near-identical headlines without syndication having occurred. The 90-minute constraint limits the damage, and the `unknown` class exists so that ambiguous cases neither inflate nor deflate the index.

### 7.3 Corroboration index, outlets basis

```typescript
export function corroborationByOutlets(c: Cluster): number {
  const n = c.originatorCount;                       // unknowns weigh 0.5
  const base = Math.min(1, Math.log1p(n) / Math.log1p(6));   // saturates at 6

  let wire = 0;
  if (c.wireCount >= 1) wire += 0.20;
  if (c.wireCount >= 2) wire += 0.10;

  const geo  = 0.10 * Math.min(1, (c.regionCount - 1) / 3);
  const lang = 0.05 * Math.min(1, (c.languageCount - 1) / 2);

  return round2(Math.min(1, 0.65 * base + wire + geo + lang));
}
```

The saturation at six originators is deliberate. The evidentiary difference between six and sixty independent newsrooms is negligible, while the difference between one and three is decisive. A linear count would make the index a proxy for prominence, the failure the system exists to avoid.

### 7.3.1 Basis-dependent corroboration

The index above tests whether an event claim is independently attested. That test is inapplicable to a cluster reporting a primary publication, because the publication is itself the primary source and no quantity of outlet coverage adds evidentiary weight to it. Applying the outlet-count index to a significant paper carried by three specialist desks would score it near zero and cancel whatever the `contribution` dimension awarded, which is the interaction that makes a fifth dimension useless if left unaddressed.

A cluster takes the `primary_publication` basis when the analysis service returns a non-null `primary_ref` and at least one originator has `is_specialist` set. Otherwise it takes the `outlets` basis.

```typescript
const PREPRINT_HOSTS = new Set(["arxiv", "biorxiv", "medrxiv", "ssrn", "chemrxiv"]);
const PEER_REVIEWED_VENUES: Set<string> = loadCuratedVenues();   // ~200 entries

export function corroborationByPublication(c: Cluster): number {
  const ref = (c.primaryRef ?? "").toLowerCase();

  let base: number;
  if ([...PREPRINT_HOSTS].some((h) => ref.includes(h))) base = 0.35;
  else if (PEER_REVIEWED_VENUES.has(venueOf(ref)))      base = 0.75;
  else                                                   base = 0.50;

  const independent = c.hasIndependentExpertComment ? 0.15 : 0;
  const replicated  = c.mentionsReplication        ? 0.10 : 0;

  return round2(Math.min(1, base + independent + replicated));
}
```

The venue set must be curated rather than inferred, and deliberately conservative. A predatory or pay-to-publish venue admitted to the set imports exactly the failure this rule exists to prevent, converting an unreviewed claim into a corroborated one by fiat.

### 7.4 GDELT integration

GDELT supplies the one measure the RSS layer cannot: global publication volume across languages and markets outside the registry. It is queried hourly for clusters formed in the preceding window, using the article search interface with the cluster's three highest-weight entities and a 24-hour date restriction. Volume is stored but deliberately excluded from the salience function. It appears in the digest as context, answering how much attention a story is receiving, which is useful to know and actively misleading to optimise for.

---

## 8. Analysis

### 8.1 Scoring prompt

One call per cluster with at least two items and a corroboration index above 0.15. The prompt is reproduced in full because it, rather than any code in this specification, is where the system's editorial judgment resides. It is versioned by SHA-256 hash; any modification invalidates cached scores.

```
You are scoring a news event cluster for durable significance. You are
not summarising it and not assessing how much attention it received.

INPUT
Headlines and standfirsts from {n} outlets reporting the same event,
with outlet name, country, and timestamp. Nothing else is available.

SCORE FIVE DIMENSIONS, each 0 to 5 integer.

structural: Does this alter a rule, a law, an institutional procedure,
  an incentive structure, a treaty, a market structure, or a technical
  capability? 5 = a binding rule changed. 3 = a rule change was formally
  proposed or a precedent set. 1 = an actor signalled a possible future
  change. 0 = an occurrence with no rule implication.
  A death toll, a battle, a market move, or a statement of intent is 0
  or 1 unless it changes a rule. A quiet procedural amendment is 5.

irreversibility: How costly is reversal? 5 = capacity, institutional
  knowledge, life, or an ecosystem destroyed; reversal impossible.
  3 = reversal requires years or a change of government. 1 = reversal
  is a routine decision. 0 = self-reversing.
  Do not conflate magnitude with irreversibility. A large recoverable
  event scores below a small permanent one.

domain_relevance: Relevance to a reader whose standing interests are
  renewable gas and hydrogen, sustainable aviation fuel, Canadian and
  Quebec policy, Austrian and German politics, Chinese industrial
  policy, monetary policy and fixed income, third-party logistics, and
  the governance of artificial intelligence. 5 = directly bears on one.
  0 = bears on none.

contribution: Does this add to the permanent stock of human knowledge,
  capability, or culture, in a way that will still be referenced in a
  decade? 5 = a result or work that reframes a field, or a capability
  that did not previously exist. 3 = a solid advance likely to be built
  on, or a work of lasting cultural standing. 1 = an incremental result
  reported for its novelty. 0 = no contribution to knowledge or culture.
  Apply the following restraints, which matter more than the scale.
  A single unreplicated study scores at most 1 regardless of how the
  finding is characterised. A preprint scores at most 1. A press release
  from an institution about its own work scores at most 1. Score 3 or
  above only where the input shows independent expert comment, a
  replication, or publication in a venue with substantive peer review.
  A technology product announcement is not a contribution; a
  demonstrated capability that no one previously had may be.

ephemerality: Will this be superseded and forgotten within 14 days?
  5 = certainly. 0 = will still be operative in five years.
  Scheduled results, sport, and single-day market moves score 5.
  Judge the underlying substance, not its news coverage. Coverage of a
  peer-reviewed result is ephemeral; the result is not. If contribution
  is 3 or above, ephemerality must not exceed 2.

RATIONALE
Two sentences maximum. State which dimension dominates and why.
If the cluster rests on a single official assertion with no independent
verification, say so explicitly in the rationale.

CONSTRAINTS
Do not quote more than eight consecutive words from any input headline.
Do not infer facts absent from the input.
If the input is insufficient to score a dimension, return 0 and say so.

OUTPUT
JSON only. No preamble, no markdown fences.
{"structural": int, "irreversibility": int, "domain_relevance": int,
 "contribution": int, "ephemerality": int, "rationale": str,
 "single_source": bool, "primary_ref": str | null}

primary_ref: if the cluster is anchored to an identifiable primary
publication, return its DOI, arXiv identifier, or journal name. Return
null if the cluster reports an event rather than a publication. Do not
guess an identifier that is not present in the input.
```

### 8.2 Salience function

```typescript
// Version 1.1 weights, unchanged in 1.2. Positive weights sum to 0.90.
export const W = {
  structural:      0.26,
  irreversibility: 0.21,
  corroboration:   0.18,
  contribution:    0.13,
  domain:          0.12,
  ephemerality:   -0.18,   // penalty
} as const;

/**
 * Pass domainWeight = 0 for the counter-bias edition. The freed weight is
 * redistributed proportionally across the remaining positive terms so the
 * two editions remain on a comparable scale.
 */
export function salience(s: Score, domainWeight: number = W.domain): number {
  const freed  = W.domain - domainWeight;
  const others = W.structural + W.irreversibility + W.corroboration + W.contribution;
  const k      = 1 + freed / others;

  const v =
      W.structural      * k * (s.structural      / 5)
    + W.irreversibility * k * (s.irreversibility / 5)
    + W.corroboration   * k * s.corroboration
    + W.contribution    * k * (s.contribution    / 5)
    + domainWeight          * (s.domainRelevance / 5)
    + W.ephemerality        * (s.ephemerality    / 5);

  return round4(Math.max(0, v));
}

/**
 * Every cluster is scored twice at analysis time and both values persisted.
 * The counter-bias edition is then a query, not a rerun, which keeps it free
 * of model cost and exactly reproducible.
 */
export function scoreBoth(s: Score): { salience: number; undomained: number } {
  return { salience: salience(s), undomained: salience(s, 0) };
}
```

Note what is absent. There is no recency term, no volume term, and no term derived from GDELT attention. A story published four days ago that changed a regulation outranks a story published this morning that did not. This is intended and will feel wrong for the first fortnight of operation.

### 8.3 Numeric claim extraction and divergence

A second model call per cluster extracts quantitative assertions and normalises them to a comparable key. Divergence is computed arithmetically rather than by the model, which is cheaper and more reliable.

```typescript
export type Divergence = {
  key: string;
  range: [number, number];
  spread: number;
  sources: Array<{ outlet: string; value: number; asOf: Date }>;
};

export function divergence(claims: NumericClaim[]): Divergence[] {
  const out: Divergence[] = [];

  for (const [key, group] of groupBy(claims, (c) => c.claimKey)) {
    if (group.length < 2) continue;

    const values = group.map((c) => c.value);
    const lo = Math.min(...values);
    const hi = Math.max(...values);

    if (lo === 0 || hi / lo >= 1.5) {
      out.push({
        key,
        range: [lo, hi],
        spread: round2(hi / Math.max(lo, 1)),
        sources: group
          .sort((a, b) => +a.asOf - +b.asOf)
          .map((c) => ({ outlet: c.outlet, value: c.value, asOf: c.asOf })),
      });
    }
  }
  return out;
}
```

The output renders as an ordered sequence showing how a figure moved over time and which outlet reported what and when. The Ceuta crossing of 30 and 31 July 2026 is the acceptance test: a reported death toll moving from at least 18 to at least 34 to at least 57 within roughly 24 hours, and a crossing estimate moving from approximately 2,000 to approximately 50,000. A correct implementation surfaces both sequences without averaging, without selecting a single figure, and without characterising any outlet as wrong.

---

## 9. Delivery and Editorial Structure

### 9.1 Daily digest composition

| Section | Bound | Selection rule |
|---|---|---|
| Overview | 200 words | Single Opus call over the top 12 clusters. Prose, no lists |
| Structural | 3 to 5 items | `structural >= 3`, ranked by salience |
| Corroborated events | 8 to 12 items | `corroboration >= 0.55`, ranked by salience |
| Contribution | 0 to 3 items | `contribution >= 3`, ranked by salience |
| Divergence watch | 0 to 4 items | Any cluster with a detected numeric spread |
| Thinly sourced | 0 to 5 items | `originator_count <= 2` and salience above median |
| Held and released | 0 to 3 items | Items released from the 7-day hold whose rescore rose |
| Operations | 1 line | Feed failures, coverage gaps, model errors |

### 9.2 The thinly sourced channel

This section is the deliberate inversion of the system's own logic and exists because low corroboration is ambiguous evidence. A story carried by one credible outlet and nobody else is either a scoop or an error, and the two are indistinguishable on the day. Presenting them under an explicit label preserves the information without lending it the authority of the corroborated section. Items carry no salience ranking and are ordered by outlet tier.

### 9.3 Attribution discipline

Every assertion carries outlet, timestamp, and a link to the original. Assertions resting on a single official statement are prefixed with the attributing body rather than stated as fact, so that a government claim reads as a government claim. This is enforced in the rendering template rather than requested of the model, because a template cannot forget.

### 9.4 Hold and rescore

Any cluster scoring above 0.55 salience enters a held state and is not published for seven days, at which point it is rescored against whatever additional reporting has accumulated and released into the following digest if the score holds. The rationale is that weekly reading outperforms daily reading, and a daily digest is structurally a mechanism for accelerating intake. The hold reintroduces the slower tempo without discarding the daily cadence for corroborated routine events. It also functions as a calibration instrument: a held item whose score collapses on rescore indicates the scoring prompt is responding to prominence rather than consequence.

### 9.5 Counter-bias edition

#### 9.5.1 Rationale

The domain relevance term makes the system useful and simultaneously makes it a confirmation instrument. Weighting for a reader's declared interests guarantees that the system will report, every morning and with an authoritative numeric score attached, that the subjects the reader already tracks are the subjects that matter. For a reader whose work concerns the erosion of institutions and the formation of judgment, a machine that reflects an existing frame back with the appearance of objectivity is a specific and serious hazard.

The counter-bias edition is the structural defence. It is not a reweighted daily digest and it is not a second opinion. It is an instrument for measuring what the personalisation suppressed, and its principal output is a number rather than a reading list.

#### 9.5.2 Specification

The edition runs every 14 days at 07:00 local on a Sunday, on a schedule independent of the daily digest. It draws from the trailing 14 days rather than a single day, because a one-day sample with the domain weight zeroed is too small to be diagnostic.

Selection uses `salience_undomained`, computed and persisted at analysis time. No model calls are made, so the edition is free of marginal cost and exactly reproducible.

The critical selection rule is exclusion. Any cluster already delivered in a daily digest within the window is removed, because the purpose is to surface what the reader did not see, not to re-rank what he did.

```typescript
const COUNTER_INTERVAL_DAYS = 14;
const COUNTER_SIZE_MAX = 10;

export async function counterEdition(asOf: Date) {
  const from = subDays(asOf, COUNTER_INTERVAL_DAYS);
  const scored = await clustersScoredIn(from, asOf);

  const delivered = new Set(
    (await clustersDeliveredIn(from, asOf, "daily")).map((c) => c.id),
  );

  const ranked = [...scored].sort((a, b) => b.salienceUndomained - a.salienceUndomained);
  const withheld = ranked.filter((c) => !delivered.has(c.id));
  const selected = withheld.slice(0, COUNTER_SIZE_MAX);

  // Suppression rate: of the clusters the unpersonalised ranking would have
  // placed in the top decile, what fraction never reached the reader?
  const decile = ranked.slice(0, Math.max(1, Math.floor(ranked.length / 10)));
  const suppressed = decile.filter((c) => !delivered.has(c.id));
  const rate = round3(suppressed.length / decile.length);

  return { clusters: selected, suppressionRate: rate, poolSize: ranked.length,
           window: [from, asOf] as const };
}
```

#### 9.5.3 Suppression rate and its interpretation

| Rate | Reading | Action |
|---|---|---|
| Below 0.20 | The domain weight is doing little work; the two rankings largely agree | Consider raising the domain weight, or accept that personalisation is adding little |
| 0.20 to 0.45 | Expected operating range | None |
| Above 0.45 | The personalisation is filtering out most of what the unweighted ranking considers significant | Investigate before adjusting; may indicate a mis-specified interest list rather than an excessive weight |

A high rate is not by itself an argument for lowering the weight. It is only an argument for looking, since the withheld items may be genuinely irrelevant. The decision requires the reader's own verdicts.

#### 9.5.4 Feedback

Each item carries two links recording a verdict in `counter_feedback`. These are Next.js route handlers on Vercel, reached by GET, protected by a signed token in the URL rather than by authentication, since the system has one reader and the links arrive by email.

```typescript
// app/api/feedback/[verdict]/route.ts
export async function GET(req: Request,
                          { params }: { params: { verdict: string } }) {
  const url = new URL(req.url);
  const token = url.searchParams.get("t");
  const payload = verifySignedToken(token);          // HMAC, 30-day expiry
  if (!payload) return new Response("Invalid link", { status: 403 });
  if (params.verdict !== "valued" && params.verdict !== "indifferent")
    return new Response("Bad verdict", { status: 400 });

  await recordFeedback({
    digestId: payload.digestId,
    clusterId: payload.clusterId,
    verdict: params.verdict,
  });

  return new Response(renderThanks(params.verdict), {
    headers: { "content-type": "text/html" },
  });
}
```

After six editions, approximately twelve weeks, accumulated verdicts support an empirical decision. The relevant statistic is the proportion of counter-edition items marked as valued. Consistently below roughly 0.15 and the personalisation costs little; the weight can stand or rise. Consistently above roughly 0.35 and the domain weight is excluding material the reader wanted; reduce it in increments of 0.03 until the proportion settles.

**The system must not adjust the domain weight automatically.** An autonomous feedback loop optimising a personalisation weight against expressed preference is precisely the mechanism that produces the confirmation dynamic this edition exists to counteract. The statistic is reported; the change is made by hand.

#### 9.5.5 Composition

| Section | Bound | Selection rule |
|---|---|---|
| Suppression report | 3 lines | Rate, pool size, comparison with the preceding six editions |
| Withheld items | 8 to 10 | Top by `salience_undomained`, excluding delivered clusters |
| Contribution | 0 to 4 | `contribution >= 3`, whether or not previously delivered |
| Coverage gaps | 0 to 3 | Regions with no cluster above median salience in the window |

The coverage gaps section is a partial and admitted mitigation of a known limitation. The feed registry is weighted toward the North Atlantic, and a region producing no ranked items may be quiet or may simply be unobserved. Reporting the absence does not resolve the ambiguity but prevents it passing unnoticed.

---

## 10. Scheduling and Timezone

### 10.1 The constraint

GitHub Actions cron, like Vercel cron, accepts UTC expressions only and has no timezone or daylight-saving support. Montreal observes UTC−5 in winter and UTC−4 in summer. A fixed UTC schedule therefore drifts by one hour twice a year, which would silently shift the digest and, more consequentially, move the fourteen-day boundary of the counter edition.

### 10.2 The pattern

Schedule the workflow to fire at every UTC hour that could correspond to the target local hour, and have the job itself exit immediately unless the local hour matches. The guard is three lines and removes the entire class of problem.

```typescript
export function shouldRunNow(targetLocalHour: number, tz = "America/Toronto"): boolean {
  const localHour = Number(
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, hour: "numeric", hour12: false })
      .format(new Date()),
  );
  return localHour === targetLocalHour;
}
```

```yaml
# .github/workflows/deliver.yml
name: deliver
on:
  schedule:
    - cron: "0 10,11 * * *"     # 06:00 America/Toronto, either DST offset
  workflow_dispatch:

jobs:
  deliver:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npx tsx src/jobs/deliver.ts
        env:
          TARGET_LOCAL_HOUR: "6"
          TZ: America/Toronto
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          EMBEDDING_API_KEY: ${{ secrets.EMBEDDING_API_KEY }}
          MAIL_API_KEY: ${{ secrets.MAIL_API_KEY }}
          DIGEST_RECIPIENT: ${{ secrets.DIGEST_RECIPIENT }}
```

### 10.3 Actions minutes budget

GitHub provides 2,000 free Actions minutes per month on private repositories. Ingestion every 20 minutes would consume approximately 2,160, exceeding the allowance. Every 30 minutes consumes approximately 1,440 and leaves headroom for the remaining jobs, which is why NFR-01 specifies 45-minute latency rather than the 30 minutes of version 1.0.

If tighter cadence proves necessary, the options in order of preference are: make the repository public, which removes the limit entirely; reduce the feed count; or move to a paid Actions tier. Do not solve this by upgrading Vercel, which does not address the duration ceiling that put the pipeline on Actions in the first place.

### 10.4 Cron reliability

Scheduled workflows on GitHub Actions may be delayed under load, occasionally by tens of minutes, and are not retried on failure. Both are acceptable for this system under NFR-03: a missed ingestion window is recovered by the next one, since polling is idempotent and conditional requests make a repeat cheap. The daily digest job should nonetheless verify that ingestion has run within the preceding two hours and report in the operations footer if it has not.

---

## 11. Feed Registry

The registry derives from the outlets identified in the companion reference framework. Feed URLs are intentionally omitted, because a hardcoded list would be materially stale within twelve months. Phase 0 populates them by the discovery routine in Section 5.1, followed by manual confirmation. Tier 1 denotes a wire service, tier 2 an originating newsroom, tier 3 an aggregator whose items are excluded from the originator count. The specialist flag governs eligibility for the `primary_publication` corroboration basis.

| Outlet | Tier | Region | Lang | Specialist |
|---|---|---|---|---|
| Reuters | 1 | Global | en | |
| Associated Press | 1 | Global | en | |
| Agence France-Presse | 1 | Global | en, fr | |
| Bloomberg | 1 | Global | en | |
| Financial Times | 2 | UK | en | |
| The Economist | 2 | UK | en | |
| BBC News | 2 | UK | en | |
| The Guardian | 2 | UK | en | |
| The New York Times | 2 | US | en | |
| The Wall Street Journal | 2 | US | en | |
| The Washington Post | 2 | US | en | |
| ProPublica | 2 | US | en | |
| The Globe and Mail | 2 | Canada | en | |
| CBC / Radio-Canada | 2 | Canada | en, fr | |
| Le Devoir | 2 | Canada | fr | |
| La Presse | 2 | Canada | fr | |
| National Post | 2 | Canada | en | |
| The Logic | 2 | Canada | en | yes |
| Le Monde | 2 | France | fr | |
| Les Échos | 2 | France | fr | |
| Frankfurter Allgemeine Zeitung | 2 | Germany | de | |
| Süddeutsche Zeitung | 2 | Germany | de | |
| Handelsblatt | 2 | Germany | de | |
| Neue Zürcher Zeitung | 2 | Switzerland | de | |
| Der Standard | 2 | Austria | de | |
| Die Presse | 2 | Austria | de | |
| El País | 2 | Spain | es | |
| Corriere della Sera | 2 | Italy | it | |
| Politico Europe | 2 | EU | en | |
| Nikkei Asia | 2 | Japan | en | |
| Asahi Shimbun | 2 | Japan | en | |
| Caixin | 2 | China | en | |
| South China Morning Post | 2 | Hong Kong | en | |
| The Hindu | 2 | India | en | |
| The Straits Times | 2 | Singapore | en | |
| Al Jazeera English | 2 | Qatar | en | |
| Haaretz | 2 | Israel | en | |
| Daily Maverick | 2 | South Africa | en | |
| Premium Times | 2 | Nigeria | en | |
| Folha de S.Paulo | 2 | Brazil | pt | |
| Reforma | 2 | Mexico | es | |
| ABC Australia | 2 | Australia | en | |
| Australian Financial Review | 2 | Australia | en | |
| Meduza | 2 | Latvia | en, ru | |
| The Kyiv Independent | 2 | Ukraine | en | |
| Lawfare | 2 | US | en | yes |
| STAT News | 2 | US | en | yes |
| MIT Technology Review | 2 | US | en | yes |
| Nature news | 2 | UK | en | yes |
| Science news | 2 | US | en | yes |
| Bellingcat | 2 | Netherlands | en | yes |

Approximately 51 outlets yielding an estimated 150 to 190 feeds once sections are enumerated. Expansion beyond 250 feeds is not recommended before the clustering thresholds have been calibrated, since additional volume amplifies clustering error rather than improving coverage. Note also the Actions minutes budget in Section 10.3, which the feed count directly affects.

---

## 12. Legal and Ethical Constraints

The system's legal position rests on four commitments, each enforced in code rather than left to operating discipline.

The system retrieves only content that publishers have voluntarily syndicated through RSS and Atom feeds, and it respects conditional request headers and any robots directives applying to those feeds. It does not access, store, or attempt to circumvent paywalled content by any means, including archive services and cached copies. It truncates all retained text at 300 characters, applied at ingestion so that non-compliant content is never persisted. And every digest item links to the original publication, directing attention toward publishers rather than substituting for them.

The last commitment is more than a legal formality. The quality journalism this system depends on is expensive to produce and funded principally by subscription. A tool that extracted the informational value of that journalism while routing around its funding would corrode the input it requires. The design accordingly optimises for pointing rather than replacing, and the deliberate refusal to pursue full-text access is a feature of the specification rather than a limitation of it.

One further constraint applies to output. The system produces no recommendation, no forecast, and no action. It is an instrument for allocating the reader's attention and nothing else, and any downstream integration converting its output into a decision rule would exceed both its design and its evidentiary basis.

A note on platform terms. Vercel's Hobby tier is restricted to non-commercial personal use. If this system is operated in connection with a business, the Pro tier applies regardless of the low traffic the interface will receive.

---

## 13. Implementation Phasing

| Phase | Scope | Exit criterion | Effort |
|---|---|---|---|
| 0 | Repository, Neon project, feed discovery and registry confirmation | 140 or more feeds returning valid items for 72 hours | 1 to 2 days |
| 1 | Ingestion, normalisation, storage, Actions workflow | Seven consecutive days without unhandled failures | 2 to 3 days |
| 2 | Embedding, clustering, threshold calibration on Neon branches | F-measure above 0.85 on 100 labelled assignments, verified cross-lingually | 3 to 5 days |
| 3 | Originator classification and corroboration index, both bases | Precision above 0.90 on 200 labelled items | 2 to 4 days |
| 4 | Analysis, salience, divergence | Inter-run score variance below 1.0 on a fixed 30-cluster set | 3 to 5 days |
| 5 | Delivery, hold and rescore, archive on Vercel | Fourteen consecutive daily digests delivered | 2 to 3 days |
| 5a | Counter-bias edition and feedback endpoints | Two editions delivered with a computed suppression rate | 1 to 2 days |
| 6 | Calibration against reader judgment | Manual agreement above 70 percent on top-5 selection over 20 editions | 4 weeks elapsed |

Phase 6 determines whether the system is worth operating and cannot be compressed. It requires recording, each morning and before reading the digest, which three stories the reader independently judges most consequential, then comparing against the system ranking. Persistent disagreement is diagnostic: if the system consistently surfaces items the reader judges trivial, the weights in Section 8.2 are wrong; if it consistently misses items the reader judges essential, the feed registry has a coverage gap or the scoring prompt is mis-specified.

### 13.1 Operating cost

| Component | Estimate (USD/month) | Basis |
|---|---|---|
| Neon Postgres | 3 to 10 | Usage-based; bursty workload benefits from scale-to-zero. Storage at a few GB |
| GitHub Actions | 0 | Within the free allowance at 30-minute ingestion, or unlimited on a public repository |
| Vercel | 0 to 20 | Hobby if non-commercial; Pro otherwise. Interface traffic is negligible either way |
| Embeddings | Under 1 | Approximately 15M tokens monthly on a hosted multilingual model |
| Cluster scoring calls | 15 to 35 | Approximately 250 clusters daily, Sonnet-class, short prompts |
| Claim extraction calls | 8 to 18 | Approximately 120 clusters daily |
| Daily synthesis call | 6 to 12 | One Opus-class call daily |
| Transactional mail | 0 to 5 | One recipient |
| **Total** | **32 to 101** | |

### 13.2 Failure modes in operation

Four failures should be anticipated.

Silent feed decay is the most likely and is mitigated by the operations footer in Section 9.1.

Scheduled workflow drift or non-execution is specific to this stack. GitHub Actions disables scheduled workflows on repositories with no activity for 60 days, which would stop the system without notice. Any commit resets the counter; a monthly no-op commit from a maintenance workflow is the standard defence.

Scoring drift, in which model output shifts without prompt change, is detected by rescoring a fixed 30-cluster benchmark set weekly and alerting on a mean deviation above 0.5.

The most consequential failure is not technical. It is the system becoming the reading rather than the filter for it. The hold-and-rescore mechanism and the counter-bias edition are partial structural defences, but the honest mitigation is periodic review of whether the reader is still consulting primary documents, which no code can enforce.

---

## References

Braudel, F. (1958). Histoire et sciences sociales: La longue durée. *Annales: Économies, Sociétés, Civilisations, 13*(4), 725–753.

Kovach, B., & Rosenstiel, T. (2021). *The elements of journalism: What newspeople should know and the public should expect* (4th ed.). Crown.

Leetaru, K., & Schrodt, P. A. (2013). GDELT: Global data on events, location and tone. *Proceedings of the International Studies Association Annual Convention*.

Newman, N., Fletcher, R., Robertson, C. T., Ross Arguedas, A., & Nielsen, R. K. (2024). *Reuters Institute digital news report 2024*. Reuters Institute for the Study of Journalism, University of Oxford.

Wang, L., Yang, N., Huang, X., Yang, L., Majumder, R., & Wei, F. (2024). Multilingual E5 text embeddings: A technical report. *arXiv*. https://arxiv.org/abs/2402.05672

Wardle, C., & Derakhshan, H. (2017). *Information disorder: Toward an interdisciplinary framework for research and policy making* (Report DGI(2017)09). Council of Europe.
