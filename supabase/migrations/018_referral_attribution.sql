-- 018: Consumer referral attribution
-- Ambassadors already get credit for business claims (015). This extends
-- attribution to individual signups and newsletter subscribers, captured
-- from ?ref= links via a site-wide cookie.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS referred_by VARCHAR(50) DEFAULT NULL;

ALTER TABLE subscribers
  ADD COLUMN IF NOT EXISTS referred_by VARCHAR(50) DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_users_referred_by
  ON users (referred_by) WHERE referred_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscribers_referred_by
  ON subscribers (referred_by) WHERE referred_by IS NOT NULL;

COMMENT ON COLUMN users.referred_by IS 'Ambassador referral code that brought this user to the platform';
COMMENT ON COLUMN subscribers.referred_by IS 'Ambassador referral code that brought this subscriber to the platform';
