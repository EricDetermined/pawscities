-- 034_widen_engagement_source.sql
--
-- WHY
-- ---
-- engagement_queue.source was VARCHAR(30) (from 019_engagement_queue.sql),
-- sized for short labels like 'cloud-discovery'. But the discovery pipeline
-- now writes descriptive, dated source tags that exceed 30 chars, e.g.
--   nightly-deep-discovery-20260901-curated   (39)
--   nightly-deep-discovery-20260901-feed      (36)
--   feed-and-curated-20260902-nightly         (33)
--   curated-profile-nightly-discovery         (33)
--
-- Found while syncing the local queue to cloud (2026-09-21): the upsert failed
-- with 22001 "value too long for type character varying(30)" on the batch
-- holding those rows, so ~114 rows silently never mirrored to Supabase.
-- Same class of bug as 024 (post_shortcode) — a column sized for the short,
-- classic case that a later, richer value outgrew. Widen with headroom.

ALTER TABLE engagement_queue
  ALTER COLUMN source TYPE VARCHAR(64);

COMMENT ON COLUMN engagement_queue.source IS
  'Where this target came from (e.g. cloud-discovery, nightly-deep-discovery-'
  '<date>-<feed|curated>). Sized to 64 for descriptive dated tags — never let '
  'it overflow again, or rows silently fail to sync.';
