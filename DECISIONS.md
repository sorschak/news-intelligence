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

## D-006 — Local development on Node 24

**Status:** accepted · **Phase:** infrastructure

SPEC 3.2 targets Node 22, which the GitHub Actions workflows pin
(`actions/setup-node` with `node-version: 22`). The current development machine
runs Node 24; nothing used here is version-specific, and CI remains the source of
truth for the runtime.
