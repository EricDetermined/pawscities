-- City Suggestions / Vote system
-- Allows logged-in users to suggest and vote for cities to launch next

CREATE TABLE IF NOT EXISTS city_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  city_name TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT '',
  state_region TEXT DEFAULT '',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  vote_count INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'launched', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Separate votes table to enforce one vote per user per city
CREATE TABLE IF NOT EXISTS city_suggestion_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  suggestion_id UUID NOT NULL REFERENCES city_suggestions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(suggestion_id, user_id)
);

-- Indexes
CREATE INDEX idx_city_suggestions_status ON city_suggestions(status);
CREATE INDEX idx_city_suggestions_vote_count ON city_suggestions(vote_count DESC);
CREATE INDEX idx_city_suggestion_votes_user ON city_suggestion_votes(user_id);
CREATE INDEX idx_city_suggestion_votes_suggestion ON city_suggestion_votes(suggestion_id);

-- RLS
ALTER TABLE city_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE city_suggestion_votes ENABLE ROW LEVEL SECURITY;

-- Anyone can read active suggestions (public leaderboard)
CREATE POLICY "Public can view active suggestions"
  ON city_suggestions FOR SELECT
  USING (status = 'active' OR status = 'launched');

-- Authenticated users can insert suggestions
CREATE POLICY "Authenticated users can suggest cities"
  ON city_suggestions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

-- Only admins can update (change status, etc.)
CREATE POLICY "Admins can update suggestions"
  ON city_suggestions FOR UPDATE
  USING (auth.uid() IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin'));

-- Votes: users can read all votes (for checking if they already voted)
CREATE POLICY "Public can view votes"
  ON city_suggestion_votes FOR SELECT
  USING (true);

-- Authenticated users can insert their own vote
CREATE POLICY "Authenticated users can vote"
  ON city_suggestion_votes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Users can delete their own vote (unvote)
CREATE POLICY "Users can remove own vote"
  ON city_suggestion_votes FOR DELETE
  USING (auth.uid() = user_id);
