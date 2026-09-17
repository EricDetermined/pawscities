-- 031: review_responses — the business reply-to-review feature has existed in
-- code (src/app/api/business/reviews/route.ts) since the business dashboard
-- shipped, but this table was never created. Its absence 500'd BOTH the
-- public reviews GET (embedded select) and the dashboard reply feature.
-- Found by the 2026-09-17 signed-out user-journey audit.
CREATE TABLE IF NOT EXISTS review_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  establishment_id UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  response TEXT NOT NULL,
  responded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,
  UNIQUE (review_id)
);
CREATE INDEX IF NOT EXISTS idx_review_responses_establishment ON review_responses(establishment_id);
ALTER TABLE review_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY review_responses_public_read ON review_responses FOR SELECT USING (true);
