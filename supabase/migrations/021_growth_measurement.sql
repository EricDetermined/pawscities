-- 021_growth_measurement.sql
--
-- Phase 1 of the growth plan: make outcomes measurable.
--
-- Context (2026-08-19 audit): 404 posts and 2,063 engagement comments had
-- produced 81 followers, and none of it was measured. Reach was never collected
-- (Meta app is missing instagram_manage_insights), reply tracking went blind in
-- July when posting moved to the browser, and there was no follower time series
-- at all — so no growth claim could be checked.
--
-- These two tables are the minimum needed to answer: "is any of this working?"
--
-- Apply: Supabase Dashboard → SQL Editor → paste → Run.

-- ─── Daily account snapshot ──────────────────────────────────────────────────
-- One row per day. followers_count/follows_count/media_count come from the
-- Graph API account fields, which work under instagram_basic (verified) and do
-- NOT require the blocked insights permission.

CREATE TABLE IF NOT EXISTS account_snapshots (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  captured_on      date NOT NULL,
  platform         text NOT NULL DEFAULT 'instagram',
  username         text,
  followers_count  integer,
  follows_count    integer,
  media_count      integer,
  -- deltas vs the previous snapshot, computed at write time for easy charting
  followers_delta  integer,
  follows_delta    integer,
  media_delta      integer,
  source           text DEFAULT 'graph_api',
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (captured_on, platform)
);

CREATE INDEX IF NOT EXISTS account_snapshots_captured_idx
  ON account_snapshots (captured_on DESC);

COMMENT ON TABLE account_snapshots IS
  'Daily follower/following/post counts. Without this there is no checkable growth trend.';

-- ─── Follower events + engagement attribution ────────────────────────────────
-- Populated by diffing the follower list day over day. `attributed_*` records
-- whether we had engaged that account shortly before they followed — this is
-- the number that says whether commenting actually converts.

CREATE TABLE IF NOT EXISTS follower_events (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username               text NOT NULL,
  event_type             text NOT NULL CHECK (event_type IN ('gained', 'lost')),
  detected_on            date NOT NULL,
  -- attribution: did we comment on / follow this account before they followed us?
  attributed_to          text CHECK (attributed_to IN ('comment', 'follow', 'both', 'none', 'unknown')),
  attributed_city        text,
  days_since_engagement  integer,
  last_comment_shortcode text,
  -- rough audience classification so we can track "businesses and established
  -- owners" specifically, rather than follower count in aggregate
  account_type           text,
  follower_count         integer,
  is_business            boolean,
  created_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (username, event_type, detected_on)
);

CREATE INDEX IF NOT EXISTS follower_events_detected_idx
  ON follower_events (detected_on DESC);
CREATE INDEX IF NOT EXISTS follower_events_attributed_idx
  ON follower_events (attributed_to);

COMMENT ON TABLE follower_events IS
  'Per-follower gain/loss with engagement attribution. Answers whether 2k+ comments convert.';
