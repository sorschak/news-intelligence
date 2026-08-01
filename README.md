# News Intelligence System

A corroboration-weighted news intelligence system. It ingests RSS/Atom feeds from
a defined set of international publications, clusters reports of the same event
across outlets and languages, measures how independently corroborated each event
is, scores events for durable significance (not prominence), and delivers a
structured daily digest to a single reader — plus a fortnightly counter-bias
edition that measures what the personalisation suppressed.

**This is not a news summariser.** [SPEC.md](SPEC.md) (v1.2) is authoritative;
read [CLAUDE.md](CLAUDE.md) for the working agreement and the non-negotiable
compliance constraints (RSS/Atom only, never fetch article bodies, 300-char
`standfirst` truncation, 25-word excerpt ceiling, conditional request headers).

## Stack

TypeScript on Node 22. **Neon** Postgres 17 + pgvector (managed, no Docker). The
pipeline runs on **GitHub Actions** (no duration ceiling); the archive UI and
counter-edition feedback endpoints run on **Vercel** (Next.js). Both connect to
Neon over its **pooled** endpoint. See SPEC 3.1 for why compute and interface are
split.

## Status

**Phase 0 — repository, Neon project, feed discovery and registry confirmation.**
Exit criterion (SPEC 13): 140+ feeds returning valid items for 72 hours. Later
phases are docstring-only stubs and are built strictly in order (SPEC 13).

## Prerequisites

No local installs beyond Node (already present). You need accounts for:

- **Neon** (free tier) — create a project, copy the **pooled** connection string
- **Anthropic** — API key (Phases 4–5)
- A **hosted multilingual embedding** provider (Phase 2) and **transactional
  mail** (Phase 5)

## Setup

```bash
npm install
```
```bash
cp .env.example .env.local   # then fill in DATABASE_URL (pooled) + FEED_CONTACT_EMAIL
```
```bash
npm run migrate      # apply the schema to Neon
npm run seed         # insert the outlet registry (SPEC Section 11)
npm run discover     # find candidate feeds per outlet (stored INACTIVE)
npm run status       # counts + Phase 0 exit gate
```

Then confirm feeds manually (the Phase 0 human step): review the discovered
candidates in the Neon console (or any SQL client) and set `feed.active = true`
on the ones to poll. Phase 1's ingest job reads only active feeds.

Use a **Neon branch** for local/test data so the main branch stays clean; Phase 2
threshold calibration uses one branch per setting (SPEC 6.2).

## Development

```bash
npm run typecheck    # tsc --noEmit
```
```bash
npm run test         # vitest
```
```bash
npm run lint         # eslint
```

## Layout

```
migrations/            numbered SQL, applied by node-pg-migrate
src/
  lib/
    db.ts              postgres client (Neon pooled, prepare:false)
    env.ts             env loading + compliant User-Agent
    feeds.ts           RSS/Atom discovery (SPEC 5.1)            [Phase 0]
    registry.ts        outlet registry seed (SPEC Section 11)   [Phase 0]
    time.ts            UTC-cron / local-hour guard (SPEC 10.2)
    embeddings.ts      hosted multilingual embeddings           [Phase 2]
    scoring.ts         composite salience (SPEC 8.2)            [Phase 4]
    divergence.ts      numeric claim divergence (SPEC 8.3)      [Phase 4]
  scripts/             migrate · seed · discover · status
  jobs/                ingest · cluster · enrich · analyse · deliver · counter
  prompts/             score · claims · overview (hashed)       [Phase 4]
app/                   Next.js: archive UI + /api/feedback      [Phase 5]
.github/workflows/     keepalive now; pipeline jobs per phase
tests/                 vitest suite
```
