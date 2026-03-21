-- Social watchlist: accounts and hashtags to monitor
CREATE TABLE IF NOT EXISTS social_watchlist (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('account', 'hashtag')),
  username text, -- for accounts
  hashtag text, -- for hashtags (without #)
  relationship text DEFAULT 'peer', -- peer, partner, influencer, business, competitor
  notes text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_watchlist_type ON social_watchlist(type);
CREATE INDEX IF NOT EXISTS idx_social_watchlist_active ON social_watchlist(active);

-- Social opportunities: posts found via hashtags or watchlist that we should engage with
CREATE TABLE IF NOT EXISTS social_opportunities (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  media_id text UNIQUE NOT NULL,
  hashtag text,
  source_username text,
  permalink text NOT NULL,
  caption text,
  likes integer DEFAULT 0,
  comments integer DEFAULT 0,
  media_type text,
  category text DEFAULT 'general', -- food, outdoors, travel, rescue, watchlist, general
  suggested_reply text,
  status text DEFAULT 'new' CHECK (status IN ('new', 'engaged', 'skipped', 'expired')),
  engaged_at timestamptz,
  actual_reply text,
  posted_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_opportunities_status ON social_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_social_opportunities_category ON social_opportunities(category);
CREATE INDEX IF NOT EXISTS idx_social_opportunities_posted ON social_opportunities(posted_at DESC);

-- Enable RLS
ALTER TABLE social_watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_opportunities ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role can manage social watchlist"
  ON social_watchlist FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage social opportunities"
  ON social_opportunities FOR ALL USING (true) WITH CHECK (true);

-- Seed initial watchlist with dog-friendly niche accounts
-- (you can add more through the admin dashboard or directly in Supabase)
INSERT INTO social_watchlist (type, username, relationship, notes) VALUES
  ('account', 'dogfriendlylondon', 'peer', 'Dog-friendly London guide'),
  ('account', 'dogfriendlyparis', 'peer', 'Dog-friendly Paris content'),
  ('account', 'bringfido', 'competitor', 'Major pet travel platform'),
  ('account', 'dogvacay', 'competitor', 'Dog travel content'),
  ('account', 'thebarklondon', 'business', 'Dog-friendly venue in London')
ON CONFLICT DO NOTHING;

-- Seed custom hashtags beyond defaults
INSERT INTO social_watchlist (type, hashtag, notes) VALUES
  ('hashtag', 'dogfriendlygeneva', 'Local Geneva content'),
  ('hashtag', 'dogfriendlybarcelona', 'Local Barcelona content'),
  ('hashtag', 'dogfriendlytokyo', 'Local Tokyo content'),
  ('hashtag', 'dogfriendlysydney', 'Local Sydney content'),
  ('hashtag', 'dogfriendlynyc', 'Local NYC content'),
  ('hashtag', 'dogfriendlyla', 'Local LA content'),
  ('hashtag', 'dogsofparis', 'Paris dog community'),
  ('hashtag', 'dogsoftokyo', 'Tokyo dog community')
ON CONFLICT DO NOTHING;
