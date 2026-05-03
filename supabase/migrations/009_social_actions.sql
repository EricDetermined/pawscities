-- ============================================
-- Social Action Tracking
-- Tracks which social actions have been completed per event
-- ============================================

CREATE TABLE IF NOT EXISTS social_actions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,          -- 'event_reply', 'event_post', 'outreach_reply', 'invitation_dm'
  entity_id VARCHAR(255) NOT NULL,           -- event UUID or other entity ID
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  notes TEXT,                                -- optional notes (e.g. which reply was used)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entity_type, entity_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_social_actions_entity ON social_actions(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_social_actions_completed ON social_actions(completed) WHERE completed = false;

-- RLS: Only admins can manage
ALTER TABLE social_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage social actions"
  ON social_actions FOR ALL
  USING (true)
  WITH CHECK (true);
