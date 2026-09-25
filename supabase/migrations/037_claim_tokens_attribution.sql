-- 037 claim tokens + conversion attribution (2026-09-24)
--
-- Powers the one-click, email-verified claim flow and channel attribution.
--
-- claim_tokens: a unique link is emailed to a business's own contact address.
-- Clicking it proves control of that email, so the claim can auto-approve with
-- no password step. Tokens are single-use and expire.
--
-- business_claims.source: which channel produced the claim (email-invite, dm,
-- organic, ambassador) so we can measure what actually converts.
--
-- establishments.claim_invite_*: paced-send bookkeeping + opt-out suppression
-- so the invite cron never emails a business twice inappropriately and honors
-- unsubscribes (EU-safe).

CREATE TABLE IF NOT EXISTS claim_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  establishment_id uuid NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  email text NOT NULL,
  business_name text,
  source text DEFAULT 'email-invite',
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_claim_tokens_token ON claim_tokens(token);
CREATE INDEX IF NOT EXISTS idx_claim_tokens_establishment ON claim_tokens(establishment_id);

ALTER TABLE business_claims
  ADD COLUMN IF NOT EXISTS source text;

ALTER TABLE establishments
  ADD COLUMN IF NOT EXISTS claim_invite_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS claim_invite_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS claim_invite_optout boolean DEFAULT false;
