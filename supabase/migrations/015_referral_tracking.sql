-- Add referral tracking to business claims and establishments
-- Links ambassador referral codes to businesses they bring to the platform

ALTER TABLE business_claims
ADD COLUMN IF NOT EXISTS referred_by TEXT DEFAULT NULL;

ALTER TABLE establishments
ADD COLUMN IF NOT EXISTS referred_by TEXT DEFAULT NULL;

-- Index for looking up businesses referred by a specific ambassador
CREATE INDEX IF NOT EXISTS idx_business_claims_referred_by ON business_claims (referred_by) WHERE referred_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_establishments_referred_by ON establishments (referred_by) WHERE referred_by IS NOT NULL;

COMMENT ON COLUMN business_claims.referred_by IS 'Ambassador referral code that brought this business to the platform';
COMMENT ON COLUMN establishments.referred_by IS 'Ambassador referral code that brought this business to the platform';
