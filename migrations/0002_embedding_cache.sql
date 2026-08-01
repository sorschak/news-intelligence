-- 0002_embedding_cache
-- Persisted embedding cache (SPEC.md 3.3) — Phase 2.
--
-- Keyed by content hash + model so a provider outage degrades new ingestion
-- without re-embedding identical content or invalidating existing clusters.
-- The vector dimensionality matches EMBEDDING_DIMS (default 1024); changing the
-- model's dimensionality requires a new migration altering these columns and a
-- re-embedding of the active window (SPEC 3.3).

-- Up Migration

CREATE TABLE embedding_cache (
  content_hash  TEXT NOT NULL,
  model         TEXT NOT NULL,
  embedding     vector(1024) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (content_hash, model)
);

-- Down Migration

DROP TABLE IF EXISTS embedding_cache;
