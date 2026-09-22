-- 035_ambassador_requests.sql
--
-- WHY
-- ---
-- The FAQ says "the program is invite-only — you can apply at /ambassadors",
-- but /ambassadors is a pure invite-CODE gate: someone without a code hits a
-- dead end ("follow us for future opportunities"). This table gives interested
-- people a real front door — a "Request an invite" form — while keeping the
-- program invite-only. Requests land in the admin review queue; Eric approves
-- and sends an invite code (reusing the existing ambassador_invites flow).
-- (2026-09-22, per Eric — going public, need a way for strangers to raise a hand.)

CREATE TABLE IF NOT EXISTS ambassador_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT,                                  -- city slug or free text
  instagram_handle TEXT,                      -- lowercase, no @ (best effort)
  email TEXT NOT NULL,
  reason TEXT,                                -- "why you'd be a great ambassador"
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'dismissed')),
  invite_code TEXT,                           -- set when approved (links to ambassador_invites.code)
  source TEXT DEFAULT 'ambassadors-gate',
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ambassador_requests_status_created
  ON ambassador_requests (status, created_at DESC);

-- Server-only: the public form POSTs through /api/ambassadors/request using the
-- service role; admin reads/writes use the service role too. RLS on, no public
-- policies -> anon/authenticated clients are blocked from reading the table.
ALTER TABLE ambassador_requests ENABLE ROW LEVEL SECURITY;
