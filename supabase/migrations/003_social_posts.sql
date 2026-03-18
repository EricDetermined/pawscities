-- ============================================
-- Social Media Posts Tracking
-- Tracks auto-published Instagram posts
-- ============================================

CREATE TABLE IF NOT EXISTS social_posts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  platform VARCHAR(20) NOT NULL DEFAULT 'instagram',
  post_id VARCHAR(100),                    -- Instagram post ID
  container_id VARCHAR(100),               -- Instagram container ID
  headline VARCHAR(255) NOT NULL,          -- Content bank headline used
  city VARCHAR(50) NOT NULL,               -- City the post is about
  caption TEXT,                            -- Full caption text
  image_url TEXT,                          -- Image URL used
  status VARCHAR(20) NOT NULL DEFAULT 'published',  -- published, failed, draft
  error_message TEXT,                      -- Error details if failed
  posted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for checking what's been posted (avoid duplicates)
CREATE INDEX IF NOT EXISTS idx_social_posts_headline ON social_posts(headline);
CREATE INDEX IF NOT EXISTS idx_social_posts_city ON social_posts(city);
CREATE INDEX IF NOT EXISTS idx_social_posts_posted_at ON social_posts(posted_at DESC);

-- RLS: Only admins can read/write social posts
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage social posts"
  ON social_posts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.supabase_id = auth.uid()
      AND users.role = 'ADMIN'
    )
  );
