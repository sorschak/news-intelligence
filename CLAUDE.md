# Project instructions

## What this is

A corroboration-weighted news intelligence system. Full specification in `SPEC.md`
(version 1.2). Read it before making any design decision. It is authoritative.

## Stack

TypeScript on Node 22. Neon Postgres with pgvector. Pipeline runs on GitHub
Actions; the archive UI and feedback endpoints run on Vercel as a Next.js app.
No Docker, no containers, no servers.

The split is not stylistic. Vercel functions terminate at 300 seconds on Pro and
10 on Hobby, and the daily analysis pass makes roughly 250 model calls. The
pipeline cannot live there. See SPEC.md 3.1.

## Working agreement

- Build in the phase order in SPEC.md Section 13. Do not skip ahead. Each phase
  has an exit criterion; do not start phase N+1 until phase N's is met.
- Before starting a phase, restate the exit criterion and how you will verify it.
- If you disagree with something in SPEC.md, say so and record it in
  `DECISIONS.md`. Do not silently deviate.
- Prefer boring solutions. One reader, one digest a day. No ORM heavier than
  `postgres`, no queue, no framework the spec does not name.

## Non-negotiable constraints

Compliance controls, not preferences. Do not relax them for convenience.

1. **Never fetch article bodies.** RSS and Atom only. No scraping, no archive
   services, no cached copies, no paywall circumvention of any kind.
2. **Truncate `standfirst` at 300 characters at ingestion**, before the database
   write. Some feeds publish full article bodies; those must never be persisted.
3. **No emitted excerpt exceeds 25 words from a single source.** Enforce in the
   rendering template, not in a prompt.
4. **Every digest assertion carries outlet, timestamp, and link.** Template-enforced.
5. **Send conditional request headers** (If-None-Match, If-Modified-Since) on
   every poll, with a User-Agent identifying the system and a contact address.

## Five rules that are easy to get wrong

**Corroboration is basis-dependent** (SPEC.md 7.3.1). Do not apply the
outlet-count index to a cluster anchored to a primary publication. The paper is
the source; outlet coverage adds no evidentiary weight. Getting this wrong makes
the `contribution` dimension inert, which is the whole reason it was added.

**Score every cluster twice** (SPEC.md 8.2). Persist both `salience` and
`salience_undomained` at analysis time. The counter-bias edition is then a SQL
query over stored scores, not a rerun. Never make model calls to generate it.

**Never auto-tune the domain weight.** The feedback endpoints record verdicts and
the suppression rate is reported. A human changes the weight. An automated loop
optimising personalisation against expressed preference reproduces exactly the
confirmation dynamic the counter edition exists to detect.

**Use Neon's pooled connection string everywhere**, not the direct endpoint.
Vercel functions are serverless and will exhaust direct connections.

**Guard every scheduled job on local hour** (SPEC.md 10.2). Actions cron is UTC
only. Schedule at both candidate UTC hours and exit unless the Toronto hour
matches, or the digest drifts an hour twice a year and the counter edition's
fourteen-day boundary moves with it.

## Setup

No local database. Create a Neon project, take the **pooled** connection string,
and use a Neon branch for local development so the main branch is never dirtied
by test data. Threshold calibration in Phase 2 uses one branch per setting.

Secrets live in GitHub repository secrets for the pipeline and Vercel environment
variables for the interface. Locally, `.env.local`, never committed. See
`.env.example`.

## Repository layout

```
src/
  jobs/          ingest.ts cluster.ts enrich.ts analyse.ts deliver.ts counter.ts
  lib/           db.ts embeddings.ts feeds.ts scoring.ts divergence.ts time.ts
  prompts/       score.txt claims.txt overview.txt   (hashed, versioned)
app/             Next.js: archive UI and /api/feedback routes
migrations/      numbered SQL, applied by node-pg-migrate
.github/workflows/  ingest.yml cluster.yml enrich.yml analyse.yml deliver.yml
                    counter.yml keepalive.yml
```

## Housekeeping

GitHub disables scheduled workflows after 60 days without repository activity,
which would stop the system silently. `keepalive.yml` makes a monthly no-op
commit. Do not remove it.

Actions minutes are budgeted in SPEC.md 10.3. Ingestion every 30 minutes fits the
free private-repo allowance; every 20 minutes does not.

## Style

- Type hints throughout, `tsc --noEmit` and `eslint` clean.
- SQL in `.sql` migration files. No schema changes in application code.
- Every job idempotent. Re-running over the same window produces identical state
  except model-derived fields, keyed by prompt hash.
- Tests with `vitest`. Every rule in the originator cascade (SPEC.md 7.2) needs a
  test with a real labelled example.

## Current status

Phase 0. Nothing built yet. Spec at version 1.2.
