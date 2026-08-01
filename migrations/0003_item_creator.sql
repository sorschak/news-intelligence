-- 0003_item_creator
-- Add item.creator (dc:creator / byline) — Phase 3.
--
-- Needed by originator cascade rule 5 (SPEC 7.2): a feed-supplied creator naming
-- a person rather than an organisation marks an originator. Captured at ingestion
-- (normaliseItem already extracts it) and read by the enrich job.

-- Up Migration

ALTER TABLE item ADD COLUMN creator TEXT;

-- Down Migration

ALTER TABLE item DROP COLUMN creator;
