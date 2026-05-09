-- Ingest Queue: unified table for content submitted via iOS Share Sheet, email, or manual entry
-- Each item gets classified and routed to the right agent (events, engagement, repost, etc.)

CREATE TABLE IF NOT EXISTS ingest_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Source tracking
  source TEXT NOT NULL CHECK (source IN ('share_sheet', 'email', 'manual', 'agent')),
  submitted_by TEXT,                    -- email address or 'ios_shortcut'

  -- Content
  url TEXT,                             -- Instagram URL, article link, etc.
  raw_text TEXT,                        -- Email body, notes, description
  subject TEXT,                         -- Email subject or user-provided title

  -- Extracted metadata (populated by the API after submission)
  platform TEXT,                        -- 'instagram', 'website', 'email', etc.
  content_type TEXT,                    -- 'post', 'reel', 'story', 'profile', 'article'
  instagram_shortcode TEXT,             -- extracted from Instagram URLs
  instagram_username TEXT,              -- @handle from the post

  -- Classification (populated by processing)
  classification TEXT CHECK (classification IN ('event', 'repost', 'engagement', 'influencer', 'partnership', 'other', NULL)),
  city TEXT,                            -- matched city slug
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  -- Processing status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dismissed')),
  processed_at TIMESTAMPTZ,
  result_action TEXT,                   -- what was done: 'event_created', 'added_to_queue', 'influencer_tracked', etc.
  result_id TEXT,                       -- ID of the created record (event ID, etc.)
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for processing pending items
CREATE INDEX IF NOT EXISTS idx_ingest_queue_status ON ingest_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_ingest_queue_source ON ingest_queue(source);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_ingest_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ingest_queue_updated_at
  BEFORE UPDATE ON ingest_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_ingest_queue_updated_at();
