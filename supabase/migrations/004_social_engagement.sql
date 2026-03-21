-- Add engagement metrics to social_posts
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS likes integer DEFAULT 0;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS comments_count integer DEFAULT 0;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS reach integer DEFAULT 0;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS impressions integer DEFAULT 0;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS saves integer DEFAULT 0;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS engagement_score numeric DEFAULT 0;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS insights_updated_at timestamptz;

-- Social comments for community monitoring
CREATE TABLE IF NOT EXISTS social_comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id text UNIQUE NOT NULL,
  post_id text NOT NULL,
  username text NOT NULL,
  text text NOT NULL,
  commented_at timestamptz NOT NULL,
  replied boolean DEFAULT false,
  reply_text text,
  replied_at timestamptz,
  sentiment text, -- positive, neutral, negative, question
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_comments_post ON social_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_social_comments_unreplied ON social_comments(replied) WHERE replied = false;

-- Enable RLS
ALTER TABLE social_comments ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role can manage social comments"
  ON social_comments FOR ALL
  USING (true) WITH CHECK (true);
