-- ============================================
-- Paw Cities - Events System
-- Migration 008: Dog-friendly events calendar
-- ============================================

-- Event status: submitted events go through admin approval
CREATE TYPE event_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- Event source: how the event was discovered/added
-- 'discovery_agent' = scraped by the Apify event discovery agent
-- 'user_submission' = submitted via the public form
-- 'admin'           = manually added by admin
CREATE TYPE event_source AS ENUM ('discovery_agent', 'user_submission', 'admin');

-- ============================================
-- EVENTS TABLE
-- ============================================

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(255) NOT NULL,
  city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,

  -- Core event info
  name VARCHAR(500) NOT NULL,
  description TEXT,
  venue_name VARCHAR(255),
  venue_address TEXT,

  -- Event link (external URL to tickets, registration, or event page)
  external_url TEXT,

  -- Date & time
  -- start_date is required; end_date is optional (single-day events)
  start_date DATE NOT NULL,
  end_date DATE,
  start_time TIME,
  end_time TIME,
  timezone VARCHAR(50),

  -- Location (for map display)
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),

  -- Image
  image_url TEXT,

  -- Categorization
  -- Tags stored as text array for flexible filtering
  -- e.g. ['mlb', 'bark-in-the-park', 'stadium', 'family-friendly']
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Social / discovery metadata
  -- Instagram handle of the event organizer or source account
  source_handle VARCHAR(255),
  -- Instagram post URL where the event was discovered
  source_post_url TEXT,
  -- Relevance score from the discovery agent (0-100)
  discovery_score INTEGER DEFAULT 0,
  -- Mentioned handles (venues, brands, organizers to engage with)
  mentioned_handles TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Status & approval
  status event_status DEFAULT 'PENDING',
  source event_source DEFAULT 'user_submission',

  -- For user submissions: who submitted it
  submitted_by UUID REFERENCES users(id),
  submitter_name VARCHAR(255),
  submitter_email VARCHAR(255),

  -- Admin review
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,

  -- Feature flags
  is_featured BOOLEAN DEFAULT false,
  is_free BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique slug per city
  UNIQUE(city_id, slug)
);

-- ============================================
-- INDEXES
-- ============================================

-- Primary query: upcoming events by city, ordered by date
CREATE INDEX idx_events_city_date ON events(city_id, start_date)
  WHERE status = 'APPROVED';

-- Homepage: upcoming approved events across all cities
CREATE INDEX idx_events_upcoming ON events(start_date, city_id)
  WHERE status = 'APPROVED';

-- Admin: pending events to review
CREATE INDEX idx_events_status ON events(status, created_at DESC);

-- Featured events
CREATE INDEX idx_events_featured ON events(is_featured, start_date)
  WHERE status = 'APPROVED' AND is_featured = true;

-- Source tracking
CREATE INDEX idx_events_source ON events(source);

-- Full-text search on event name
CREATE INDEX idx_events_name_trgm ON events USING gin(name gin_trgm_ops);

-- Tag filtering
CREATE INDEX idx_events_tags ON events USING gin(tags);

-- Date range: find events happening on a specific date (handles multi-day events)
-- An event is "active" on a date if: start_date <= date AND (end_date >= date OR end_date IS NULL AND start_date = date)
CREATE INDEX idx_events_end_date ON events(end_date);

-- Submitter lookup
CREATE INDEX idx_events_submitted_by ON events(submitted_by);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Public: anyone can read approved, non-past events
CREATE POLICY "Public can view approved upcoming events"
  ON events FOR SELECT
  USING (
    status = 'APPROVED'
    AND start_date >= CURRENT_DATE
  );

-- Authenticated users can submit events
CREATE POLICY "Authenticated users can insert events"
  ON events FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Admin: full access
CREATE POLICY "Admins have full access to events"
  ON events FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.supabase_id = auth.uid()
      AND users.role = 'ADMIN'
    )
  );

-- Users can view their own submitted events regardless of status
CREATE POLICY "Users can view their own event submissions"
  ON events FOR SELECT
  USING (
    submitted_by IN (
      SELECT id FROM users WHERE supabase_id = auth.uid()
    )
  );

-- ============================================
-- HELPER FUNCTION: Generate event slug
-- ============================================

CREATE OR REPLACE FUNCTION generate_event_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := lower(regexp_replace(
      regexp_replace(NEW.name, '[^a-zA-Z0-9\s-]', '', 'g'),
      '\s+', '-', 'g'
    )) || '-' || to_char(NEW.start_date, 'YYYY-MM-DD');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_event_slug
  BEFORE INSERT ON events
  FOR EACH ROW
  EXECUTE FUNCTION generate_event_slug();

-- ============================================
-- HELPER FUNCTION: Auto-update updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_events_updated_at();
