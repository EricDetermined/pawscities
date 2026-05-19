-- ============================================
-- Paw Cities - Newsletter Subscribers
-- Migration 012: Email subscriber list for
-- community engagement and retention
-- ============================================

CREATE TABLE subscribers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  -- Which city they're most interested in (optional)
  city_slug VARCHAR(50),
  -- Subscription preferences
  weekly_digest BOOLEAN DEFAULT true,
  event_alerts BOOLEAN DEFAULT true,
  -- Status management
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed', 'bounced')),
  -- UTM/source tracking for growth attribution
  source VARCHAR(50) DEFAULT 'website',  -- website, instagram, referral, email_footer
  referrer_url TEXT,
  -- Unsubscribe token for one-click unsubscribe (CAN-SPAM compliance)
  unsubscribe_token UUID DEFAULT uuid_generate_v4(),
  -- Timestamps
  confirmed_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint on email (case-insensitive)
CREATE UNIQUE INDEX idx_subscribers_email ON subscribers (LOWER(email));
-- Fast lookup by unsubscribe token
CREATE INDEX idx_subscribers_unsub_token ON subscribers (unsubscribe_token);
-- Query active subscribers by city for targeted digests
CREATE INDEX idx_subscribers_active_city ON subscribers (status, city_slug) WHERE status = 'active';

-- RLS: Only service role can read/write subscribers
ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to subscribers"
  ON subscribers FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
