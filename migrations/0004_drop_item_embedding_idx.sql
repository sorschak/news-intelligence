-- 0004_drop_item_embedding_idx
-- The HNSW index on item.embedding (created in 0001) was never used: every
-- similarity search runs on cluster.centroid, not item.embedding (see
-- src/jobs/cluster.ts and enrich.ts). On the 512 MB Neon tier it had grown to
-- ~144 MB and was the single largest object, contributing to a storage-full
-- outage. Dropped live during recovery; recorded here so a rebuilt database
-- never recreates it. Clustering assigns to the nearest cluster centroid (a seq
-- scan over a few thousand centroids), which does not need this index.

-- Up Migration

DROP INDEX IF EXISTS item_embedding_idx;

-- Down Migration

CREATE INDEX item_embedding_idx ON item USING hnsw (embedding vector_cosine_ops);
