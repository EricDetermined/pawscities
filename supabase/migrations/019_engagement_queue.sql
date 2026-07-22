-- 019: Cloud engagement queue
-- Moves the Instagram engagement comment queue from the Mac-local JSON file
-- (data/engagement/comment-queue.json) to Supabase so discovery can run
-- laptop-off (GitHub Actions) and posting sessions read/write from the cloud.
--
-- Access model: service-role only. RLS is enabled with NO policies, so anon
-- and authenticated clients cannot read or write; the service key bypasses RLS.

CREATE TABLE IF NOT EXISTS engagement_queue (
  id VARCHAR(64) PRIMARY KEY,
  post_id VARCHAR(64) NOT NULL,
  post_shortcode VARCHAR(32),
  post_url TEXT,
  target_username VARCHAR(128),
  post_likes INTEGER DEFAULT 0,
  city VARCHAR(50),
  comment_text TEXT NOT NULL,
  comment_category VARCHAR(50),
  comment_language VARCHAR(20),
  comment_hash VARCHAR(32),
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  posted_at TIMESTAMPTZ,
  error TEXT,
  source VARCHAR(30) DEFAULT 'cloud-discovery'
);

-- Never queue the same IG post twice (mirrors the bot's local dedupe)
CREATE UNIQUE INDEX IF NOT EXISTS idx_engagement_queue_post
  ON engagement_queue(post_id);

-- Fast batch selection
CREATE INDEX IF NOT EXISTS idx_engagement_queue_status_city
  ON engagement_queue(status, city);

CREATE INDEX IF NOT EXISTS idx_engagement_queue_posted_at
  ON engagement_queue(posted_at);

ALTER TABLE engagement_queue ENABLE ROW LEVEL SECURITY;
-- Intentionally no RLS policies: service-role access only.
