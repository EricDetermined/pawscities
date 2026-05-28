-- Update ingest_queue constraints to support event discovery pipeline
-- The original constraints were too restrictive for the new automated discovery sources

-- 1. Add 'event_discovery' and 'google_events' as valid sources
ALTER TABLE ingest_queue DROP CONSTRAINT IF EXISTS ingest_queue_source_check;
ALTER TABLE ingest_queue ADD CONSTRAINT ingest_queue_source_check
  CHECK (source IN ('share_sheet', 'email', 'manual', 'agent', 'event_discovery', 'google_events', 'curated_scrape'));

-- 2. Add 'business_event' as valid classification
ALTER TABLE ingest_queue DROP CONSTRAINT IF EXISTS ingest_queue_classification_check;
ALTER TABLE ingest_queue ADD CONSTRAINT ingest_queue_classification_check
  CHECK (classification IN ('event', 'business_event', 'repost', 'engagement', 'influencer', 'partnership', 'other', NULL));

-- 3. Add 'needs_review', 'processed', 'error' as valid statuses
ALTER TABLE ingest_queue DROP CONSTRAINT IF EXISTS ingest_queue_status_check;
ALTER TABLE ingest_queue ADD CONSTRAINT ingest_queue_status_check
  CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dismissed', 'needs_review', 'processed', 'error'));
