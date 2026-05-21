-- 012: Creative Queue for Buster & Marley mascot content pipeline
-- Run this in the Supabase SQL Editor: https://supabase.com/dashboard/project/tnqctocershbclhbjnwg/sql

CREATE TABLE IF NOT EXISTS creative_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Content reference
  content_type text NOT NULL CHECK (content_type IN ('content_bank', 'event', 'custom')),
  content_index integer,          -- index into CONTENT_BANK (for content_bank type)
  event_id uuid,                  -- FK to events table (for event type)

  -- Narrator & city
  narrator text NOT NULL CHECK (narrator IN ('buster', 'marley', 'both')),
  city text NOT NULL,

  -- Creative content
  headline text NOT NULL,
  caption text NOT NULL,
  image_url text,                 -- URL after upload to Supabase Storage
  image_prompt text,              -- DALL-E prompt used to generate the image

  -- Format
  format text NOT NULL DEFAULT 'city_card' CHECK (format IN ('city_card', 'event_post', 'animated_reel', 'carousel', 'intro')),

  -- Workflow status
  status text NOT NULL DEFAULT 'pending_review' CHECK (status IN (
    'generating',       -- AI is generating the creative
    'pending_review',   -- Ready for human review
    'approved',         -- Approved, ready to post
    'rejected',         -- Rejected by reviewer
    'posted',           -- Successfully posted to Instagram
    'failed'            -- Posting failed
  )),

  -- Scheduling
  scheduled_for date,             -- Which date this should post
  posted_at timestamptz,          -- When it was actually posted
  social_post_id uuid,            -- FK to social_posts after posting

  -- Metadata
  rejection_reason text,
  error_message text,
  generation_model text,          -- 'dall-e-3', 'next-og', etc.
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_creative_queue_status ON creative_queue(status);
CREATE INDEX IF NOT EXISTS idx_creative_queue_scheduled ON creative_queue(scheduled_for) WHERE status = 'approved';
CREATE INDEX IF NOT EXISTS idx_creative_queue_city ON creative_queue(city);
CREATE INDEX IF NOT EXISTS idx_creative_queue_narrator ON creative_queue(narrator);

-- RLS
ALTER TABLE creative_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can manage creative queue" ON creative_queue FOR ALL USING (true) WITH CHECK (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_creative_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER creative_queue_updated_at
  BEFORE UPDATE ON creative_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_creative_queue_updated_at();
