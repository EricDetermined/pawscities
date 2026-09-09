-- Watch Handles: registry of Instagram accounts (venues, event organizers,
-- community accounts) that the handle-discovery cron checks daily via the
-- Instagram Graph API "business discovery" endpoint (free, no Apify).
--
-- Each run picks the ~40 active handles with the oldest last_checked_at
-- (nulls first), pulls their recent media, prefilters for event-likeness,
-- and feeds candidates into ingest_queue → process-ingest like every other
-- discovery channel.

CREATE TABLE IF NOT EXISTS watch_handles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Instagram username, lowercase, no @
  handle TEXT UNIQUE NOT NULL,

  -- City slug (atlanta, losangeles, newyork, london, paris, barcelona,
  -- tokyo, sydney, geneva) or NULL when unknown
  city TEXT,

  -- venue | organizer | community | brand | unknown
  handle_type TEXT DEFAULT 'unknown',

  -- Whether the cron should still check this handle
  active BOOLEAN DEFAULT TRUE,

  -- Business discovery only works for business/creator accounts.
  -- NULL = not yet checked; FALSE = personal account (deactivated)
  is_business BOOLEAN,

  -- Cron bookkeeping
  last_checked_at TIMESTAMPTZ,
  last_post_timestamp TIMESTAMPTZ,
  consecutive_failures INT DEFAULT 0,
  events_found INT DEFAULT 0,

  -- Where this handle came from (venue-leads, events-source-handle,
  -- events-mentioned, target-handles, manual, ...)
  source TEXT,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cron selects: active handles ordered by last_checked_at (nulls first)
CREATE INDEX IF NOT EXISTS idx_watch_handles_active_checked
  ON watch_handles (active, last_checked_at NULLS FIRST);

-- Server-only table (crons use the service role, which bypasses RLS).
-- RLS with no policies blocks anon/authenticated clients entirely.
ALTER TABLE watch_handles ENABLE ROW LEVEL SECURITY;

-- Allow the new discovery channel in ingest_queue.source
ALTER TABLE ingest_queue DROP CONSTRAINT IF EXISTS ingest_queue_source_check;
ALTER TABLE ingest_queue ADD CONSTRAINT ingest_queue_source_check
  CHECK (source IN ('share_sheet', 'email', 'manual', 'agent', 'event_discovery', 'google_events', 'curated_scrape', 'handle_discovery'));
