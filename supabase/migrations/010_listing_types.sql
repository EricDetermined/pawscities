-- ============================================
-- Listing Types for Online & Mobile Businesses
-- Allows businesses without physical storefronts
-- to list on Paw Cities per city
-- ============================================

-- Add listing_type column (storefront is default for all existing)
ALTER TABLE establishments
  ADD COLUMN IF NOT EXISTS listing_type VARCHAR(20) NOT NULL DEFAULT 'storefront'
  CHECK (listing_type IN ('storefront', 'mobile', 'online'));

-- Add service_area for mobile/online businesses
ALTER TABLE establishments
  ADD COLUMN IF NOT EXISTS service_area TEXT;

-- Make address optional (was NOT NULL) for mobile/online listings
ALTER TABLE establishments
  ALTER COLUMN address DROP NOT NULL;

-- Index for filtering by listing type
CREATE INDEX IF NOT EXISTS idx_establishments_listing_type ON establishments(listing_type);

COMMENT ON COLUMN establishments.listing_type IS 'storefront = physical location, mobile = serves an area, online = digital/delivery business';
COMMENT ON COLUMN establishments.service_area IS 'Human-readable service area, e.g. "Serves all of NYC" or "Ships to Los Angeles"';
