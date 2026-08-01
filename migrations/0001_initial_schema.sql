-- 0001_initial_schema
-- Initial schema, transcribed from SPEC.md Section 4 (v1.2).
--
-- node-pg-migrate SQL format: statements between the two markers below are the
-- up and down migrations. Tables are created in dependency order (cluster before
-- item, which references it) — DECISIONS.md D-004.

-- Up Migration

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
  corroboration_basis TEXT NOT NULL DEFAULT 'outlets',  -- outlets | primary_publication
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

-- Down Migration

DROP TABLE IF EXISTS counter_feedback;
DROP TABLE IF EXISTS digest;
DROP TABLE IF EXISTS numeric_claim;
DROP TABLE IF EXISTS cluster_score;
DROP TABLE IF EXISTS item;
DROP TABLE IF EXISTS cluster;
DROP TABLE IF EXISTS feed;
DROP TABLE IF EXISTS outlet;
