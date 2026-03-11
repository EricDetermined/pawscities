-- Migration: Create PascalCase Subscription table for Stripe integration
-- Run this in Supabase SQL Editor
-- This table stores subscription records linked to establishments

-- 1. Create the Subscription table (PascalCase to match Prisma schema)
CREATE TABLE IF NOT EXISTS "Subscription" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  "establishmentId" TEXT NOT NULL UNIQUE,
  "stripeSubscriptionId" TEXT UNIQUE,
  "stripeCustomerId" TEXT,
  "plan" TEXT NOT NULL DEFAULT 'monthly',
  "tier" TEXT NOT NULL DEFAULT 'PREMIUM',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "currentPeriodStart" TIMESTAMPTZ,
  "currentPeriodEnd" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_subscription_establishment
    FOREIGN KEY ("establishmentId") REFERENCES "Establishment"("id") ON DELETE CASCADE
);

COMMENT ON TABLE "Subscription" IS 'Stripe subscription records for premium business listings';

-- 2. Enable RLS
ALTER TABLE "Subscription" ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- Authenticated users can view their own subscriptions (via User table email match)
CREATE POLICY "Users can view own subscriptions" ON "Subscription"
FOR SELECT TO authenticated
USING (
  "userId" IN (
    SELECT "id" FROM "User"
    WHERE "email" = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);

-- Service role handles all inserts/updates from webhook (bypasses RLS)

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_subscription_establishment ON "Subscription"("establishmentId");
CREATE INDEX IF NOT EXISTS idx_subscription_stripe_sub ON "Subscription"("stripeSubscriptionId");
CREATE INDEX IF NOT EXISTS idx_subscription_user ON "Subscription"("userId");
CREATE INDEX IF NOT EXISTS idx_subscription_status ON "Subscription"("status");

-- 5. Ensure Establishment table has a tier column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Establishment' AND column_name = 'tier'
  ) THEN
    ALTER TABLE "Establishment" ADD COLUMN "tier" TEXT DEFAULT 'FREE';
  END IF;
END $$;

-- 6. Grant access
GRANT SELECT ON "Subscription" TO authenticated;
