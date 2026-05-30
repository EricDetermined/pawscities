-- 016: Handle Enrichment Support
-- Adds Instagram handle tracking to establishments and events,
-- plus a cache table to avoid re-scraping the same venues.

-- 1. Add instagram_handle to establishments
ALTER TABLE establishments
  ADD COLUMN IF NOT EXISTS instagram_handle VARCHAR(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS instagram_handle_source VARCHAR(50) DEFAULT NULL;

-- 2. Add enrichment tracking to events
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS enrichment_status VARCHAR(20) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS enrichment_attempted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS establishment_id UUID REFERENCES establishments(id) DEFAULT NULL;

-- Mark all existing approved/rejected events as 'skipped' so the cron only processes new ones
UPDATE events SET enrichment_status = 'skipped' WHERE status IN ('APPROVED', 'REJECTED');

-- 3. Create Instagram handle cache table
CREATE TABLE IF NOT EXISTS instagram_handle_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venue_name VARCHAR(255) NOT NULL,
  city VARCHAR(100),
  instagram_handle VARCHAR(100),
  website_url TEXT,
  google_place_id VARCHAR(255),
  source VARCHAR(50) NOT NULL,
  confidence INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_events_enrichment_status ON events (enrichment_status) WHERE enrichment_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_events_establishment_id ON events (establishment_id) WHERE establishment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_establishments_instagram ON establishments (instagram_handle) WHERE instagram_handle IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_handle_cache_venue ON instagram_handle_cache (venue_name, city);
CREATE INDEX IF NOT EXISTS idx_handle_cache_place_id ON instagram_handle_cache (google_place_id) WHERE google_place_id IS NOT NULL;
