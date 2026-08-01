# Decisions log

Per CLAUDE.md: any disagreement with SPEC.md, or any deviation from it, is
recorded here with a rationale. SPEC.md (v1.2) remains authoritative unless a
decision below explicitly overrides it. The entries here are minor
implementation choices within the latitude the spec leaves open; none contradict
it.

---

## D-001 — `postgres` client uses `prepare: false`

**Status:** accepted · **Phase:** infrastructure

Neon's pooled endpoint runs PgBouncer in transaction mode, which does not support
prepared statements. `src/lib/db.ts` sets `prepare: false`; without it the
serverless surfaces hit intermittent "prepared statement does not exist" errors.
Not a deviation — an implementation requirement of the stack SPEC 3.2 selected.

## D-002 — Feed-link extraction uses a regex parser

**Status:** accepted · **Phase:** 0

Node has no DOM. `parseAlternateLinks` (SPEC 5.1) extracts `<link rel="alternate">`
advertisements with a small regex rather than adding an HTML-parsing dependency,
which is proportionate for reading `<head>` metadata.

## D-003 — Outlet seed carries `homepage` and `country`

**Status:** accepted · **Phase:** 0

SPEC Section 11 lists outlets by name, tier, region, language, and specialist
flag, but not homepage or country. Discovery (5.1) needs a homepage to fetch, and
`outlet.country` is `NOT NULL`, so `src/lib/registry.ts` supplies both. Homepages,
unlike feed URLs, are stable and safe to hardcode.

## D-004 — Schema table order reordered for valid DDL

**Status:** accepted · **Phase:** infrastructure

SPEC Section 4 lists `item` before `cluster`, but `item.cluster_id` references
`cluster(id)`. The migration creates `cluster` first so it runs as a single
forward script. All columns, types, constraints, and indexes are unchanged.
`cluster.lineage_of` self-references `cluster(id)` within the same statement.

## D-005 — `localHour` normalises with `% 24`

**Status:** accepted · **Phase:** infrastructure

The `Intl` call in SPEC 10.2 can format midnight as "24" under `en-CA` with
`hour12: false`. `src/lib/time.ts` applies `% 24` so midnight reads as 0, and
adds an injectable `now` parameter for deterministic tests. Behaviour is
otherwise identical to the spec listing.

## D-007 — Language uses declared/outlet value; text detection deferred

**Status:** accepted · **Phase:** 1

SPEC 5.3 specifies feed-declared language, else text-based detection on
headline+standfirst. `resolveLanguage` uses the feed declaration, else the
outlet's primary language, and defers text detection to a later refinement rather
than add a detection dependency now. Clustering is language-agnostic (multilingual
embeddings), so a wrong `language` tag affects display, not cluster assignment;
the field can be back-filled when detection is added.

## D-008 — URL cleaning strips tracking params; redirect-hop resolution deferred

**Status:** accepted · **Phase:** 1

SPEC 5.3 lists two `url` rules: strip tracking parameters, and resolve one
redirect hop. `cleanUrl` implements the first (a superset — utm_*, fbclid, ref,
plus gclid/mc_cid/mc_eid). Redirect-hop resolution is deferred: it costs one
network round-trip per item and is not needed for storage or attribution, which
use the publisher's own link. It can be added in the ingest path later.

## D-009 — Embedding provider is configurable; defaults to Voyage

**Status:** accepted · **Phase:** 2

SPEC 3.3 requires a hosted multilingual embedding API but names none.
`src/lib/embeddings.ts` supports `voyage` (default), `openai`, and `cohere`,
selected by `EMBEDDING_PROVIDER`, so the account/key decision is deferred to
config. Voyage is the default (multilingual, low cost, native 1024-dim, Anthropic
-recommended). Returned dimensionality is validated against `EMBEDDING_DIMS`.

## D-010 — Pure clustering helpers live in `lib/clustering.ts`

**Status:** accepted · **Phase:** 2

CLAUDE.md's layout lists clustering under `jobs/cluster.ts`, but that file runs
`main()` on import and cannot be imported by tests. The side-effect-free helpers
(cosine, assignment decision, vector serialisation) are therefore in a new
`lib/clustering.ts`; the job orchestrates DB + pgvector around them. Not a spec
disagreement — an organisational split for testability.

## D-011 — §6.3 quality mitigations deferred; calibration is manual

**Status:** accepted · **Phase:** 2

Phase 2 implements the core incremental algorithm (assign / create / consolidate)
over the 72h window with `lineage_of` for continuing stories. The remaining §6.3
mitigations — excluding round-up/live-blog boilerplate from centroids, and
down-weighting high-frequency entities — are deferred until calibration shows
they are needed. Threshold calibration itself (SPEC 6.2: sweep 0.74–0.90, label
100 assignments per setting on Neon branches, verify cross-lingually) is an
inherently manual procedure done once real data exists; the thresholds are
exposed as constants in `lib/clustering.ts` for that sweep.

## D-012 — Cascade rule 4 uses the stored item embedding as the "headline cosine"

**Status:** accepted · **Phase:** 3

SPEC 7.2 rule 4 (temporal precedence) tests "headline cosine above 0.95". The
enrich job reuses the stored `item.embedding` (of headline + standfirst) rather
than embedding headlines separately, avoiding a second embedding pass. Including
the standfirst can only *lower* similarity, so the 0.95 gate stays conservative
(fewer false reprints). Revisit if calibration shows missed syndication.

## D-013 — GDELT query approximates entities with frequent headline terms

**Status:** accepted · **Phase:** 3

SPEC 7.4 queries GDELT with the cluster's three highest-weight entities. Without
an entity extractor, `topKeywords` uses the most frequent salient headline terms.
GDELT is FR-06 ("Should"), stored as context and excluded from salience, and the
call is best-effort (any failure yields null), so the approximation is low-risk.

## D-014 — Curated peer-reviewed venue set is a seed; DOI→venue deferred

**Status:** accepted · **Phase:** 3

`PEER_REVIEWED_VENUES` in `lib/corroboration.ts` is a conservative ~20-entry seed
of the ~200 the spec envisages (SPEC 7.3.1) — under-inclusion is safe (falls to
the 0.50 "identifiable but unclassified" base), over-inclusion is not. Mapping a
DOI to its venue needs an external lookup (e.g. Crossref) and is deferred; a
bare DOI currently takes the 0.50 base. `hasIndependentExpertComment` and
`mentionsReplication` are set by analysis (Phase 4); false until then.

## D-015 — Model IDs default to Sonnet 5 (scoring) and Opus 5 (synthesis)

**Status:** accepted · **Phase:** 4

SPEC 3.2 names "Claude Sonnet" for per-cluster scoring and "Claude Opus" for the
daily synthesis without pinning IDs. `ANALYSIS_MODEL` defaults to
`claude-sonnet-5` and `SYNTHESIS_MODEL` (Phase 5) to `claude-opus-5` — the
current Sonnet/Opus IDs — both overridable via env. This keeps the cost profile
the spec intends (cheap high-volume scoring, one premium synthesis call/day).

## D-016 — Scoring runs thinking-disabled with JSON-parsed output

**Status:** accepted · **Phase:** 4

Sonnet 5 enables adaptive thinking by default. For ~250 scoring calls/day the
analysis client sets `thinking: {type: "disabled"}` to control cost; the detailed
versioned prompt carries the judgment. Output is parsed as JSON (the prompt
mandates JSON-only), with code-fence stripping as a tolerance. Structured-output
enforcement (`output_config.format`) is a straightforward future hardening if the
inter-run variance exit criterion (SPEC 8.1 / FR-07) needs it.

## D-017 — numeric_claim.item_id via model-supplied item index

**Status:** accepted · **Phase:** 4

`numeric_claim.item_id` is NOT NULL, but claims are extracted from the combined
cluster text. The claims prompt returns an `item_index` per claim; the analysis
job maps it back to the originating item's id and `published_at` (its `as_of`).
Out-of-range indices are skipped rather than misattributed.

## D-006 — Local development on Node 24

**Status:** accepted · **Phase:** infrastructure

SPEC 3.2 targets Node 22, which the GitHub Actions workflows pin
(`actions/setup-node` with `node-version: 22`). The current development machine
runs Node 24; nothing used here is version-specific, and CI remains the source of
truth for the runtime.
