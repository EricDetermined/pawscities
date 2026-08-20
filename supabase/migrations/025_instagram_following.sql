-- 025_instagram_following.sql
--
-- WHY
-- ---
-- The nightly brief reported "54 warm leads, 21 businesses" as accounts to go
-- follow. Checking them against Instagram showed we ALREADY follow several of
-- them — barkcelonastore, atlpetstop and dogsonlysocialclub among the first
-- handful looked at. The number was inflated and the work list was wrong.
--
-- The cause is a confusion of direction. engagement_queue.followed_back records
-- whether THEY follow US. The warm-leads query treated the absence of that flag
-- as "we have not followed them", which is a different fact entirely and one we
-- were not storing anywhere.
--
-- WHY NOT A COLUMN ON engagement_queue
-- ------------------------------------
-- Follow state belongs to an ACCOUNT, not to a comment. The same username
-- appears across many rows, so a denormalised boolean would need updating in
-- every one of them and would drift the moment a single update was missed.
-- One row per account, joined at read time.
--
-- WHY NOT data/instagram-following.json
-- -------------------------------------
-- That file exists and is what the earlier work leaned on, but it was captured
-- 2026-05-03 and records 371 accounts while today's snapshot says 253 — roughly
-- 138 out of date. It produced false negatives on two accounts confirmed
-- followed minutes earlier. A stale file that looks authoritative is worse than
-- no file, so this table carries captured_at and the brief can refuse to trust
-- an old capture.

CREATE TABLE IF NOT EXISTS instagram_following (
  username     VARCHAR(128) PRIMARY KEY,
  full_name    TEXT,
  is_verified  BOOLEAN,
  is_private   BOOLEAN,
  -- When this account was last SEEN in our following list. Rows are not deleted
  -- on unfollow; captured_at going stale relative to the newest capture is what
  -- identifies someone we have since unfollowed.
  captured_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_seen   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_instagram_following_captured
  ON instagram_following(captured_at DESC);

ALTER TABLE instagram_following ENABLE ROW LEVEL SECURITY;
-- Service-role only, like the rest of the engagement tables.

-- Accounts that replied to us and that we do NOT already follow.
--
-- This is the list the brief should have been showing. It requires the follow
-- capture to have run; if instagram_following is empty the view returns
-- everything, which is the old wrong behaviour — so the brief checks
-- freshness before trusting it rather than assuming.
CREATE OR REPLACE VIEW warm_leads AS
SELECT DISTINCT ON (eq.target_username)
  eq.target_username,
  eq.city,
  eq.post_url,
  eq.posted_at,
  eq.replies,
  -- They replied but do not follow us back: still worth following.
  COALESCE(eq.followed_back, false) AS they_follow_us
FROM engagement_queue eq
LEFT JOIN instagram_following f
  ON lower(f.username) = lower(eq.target_username)
WHERE eq.replied IS TRUE
  AND eq.target_username IS NOT NULL
  AND f.username IS NULL          -- we do not already follow them
ORDER BY eq.target_username, eq.posted_at DESC;

COMMENT ON TABLE instagram_following IS
  'Accounts @thepawcities follows. Populated by agents/capture-following.py. '
  'Exists because followed_back records whether THEY follow US, which is a '
  'different fact from whether we follow them — conflating the two inflated '
  'the brief''s warm-lead count with accounts we had already followed.';

COMMENT ON VIEW warm_leads IS
  'Accounts that replied to our comments and that we do not yet follow. '
  'Only meaningful once instagram_following has a recent capture; an empty '
  'or stale following table makes this over-report.';
