-- 022_engagement_replies.sql
--
-- WHY
-- ---
-- The reply outcome of every comment we have ever posted lives in exactly one
-- place: data/engagement/reply-tracker.json, on one laptop, with no backup.
-- That file holds 682 records including the 72 replies behind our 23.5% reply
-- rate — the single sharpest targeting signal we have, and the thing that
-- tells us Barcelona converts at 42.9% while Tokyo converts at 0%.
--
-- Losing that disk loses the ability to target. This migration gives the data
-- a durable home and lets the nightly brief run in the cloud instead of
-- depending on the laptop being awake at 6am.
--
-- WHY engagement_queue AND NOT A NEW TABLE
-- ----------------------------------------
-- DUAL-SYSTEM-FINDING-2026-08-20.md documented two parallel engagement systems
-- that drifted because nothing reconciled them. Adding a third store would
-- repeat that mistake. The cloud discovery workflow was retired on 2026-08-20
-- (its last run was 12:00 UTC that day), so engagement_queue is no longer
-- written by anything and its schema already matches comment-queue.json field
-- for field. It becomes the single mirror of all posted comments; `source`
-- distinguishes cloud-discovery rows from browser-posted ones.
--
-- IMPORTANT — NOT ALL ZEROS MEAN "NO REPLY"
-- -----------------------------------------
-- Reply detection before 2026-08-20 filtered on comment_pk, which
-- browser-posted comments never had. In August that matched 0 of 285 comments,
-- so ~375 records carry a reply_count of 0 that is a FALSE NEGATIVE, not a
-- measurement. That bug is why the reply rate was believed to be 0% when it was
-- actually 23.5%.
--
-- reply_checker records which detector produced the row. Only 'browser_v2'
-- results are trustworthy. Any query computing a reply RATE must filter on it —
-- see the engagement_reply_rates view below, which is the safe way to ask.

ALTER TABLE engagement_queue
  ADD COLUMN IF NOT EXISTS reply_count      INTEGER,
  ADD COLUMN IF NOT EXISTS replied          BOOLEAN,
  ADD COLUMN IF NOT EXISTS reply_checked_at TIMESTAMPTZ,
  -- Which detector wrote this row. 'browser_v2' = trustworthy.
  -- NULL or legacy values = unverified; treat 0 as "unknown", not "no reply".
  ADD COLUMN IF NOT EXISTS reply_checker    VARCHAR(30),
  -- Full reply payload (author, text, timestamp) so we can mine it later for
  -- who to follow, what copy earned a response, and which accounts are warm.
  ADD COLUMN IF NOT EXISTS replies          JSONB,
  ADD COLUMN IF NOT EXISTS followed_back    BOOLEAN;

-- The brief's hot path: reply rate per city among verified rows only.
CREATE INDEX IF NOT EXISTS idx_engagement_queue_reply_checker
  ON engagement_queue(reply_checker, city)
  WHERE reply_checker IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_engagement_queue_replied
  ON engagement_queue(replied)
  WHERE replied IS TRUE;

-- The ONLY safe way to ask "what is our reply rate?".
-- Filtering on reply_checker is not optional: without it the ~375 legacy false
-- zeros drag a real 23.5% down toward 0% and the number silently lies.
CREATE OR REPLACE VIEW engagement_reply_rates AS
SELECT
  city,
  COUNT(*)                                             AS checked,
  COUNT(*) FILTER (WHERE replied)                      AS replied,
  ROUND(100.0 * COUNT(*) FILTER (WHERE replied)
        / NULLIF(COUNT(*), 0), 1)                      AS reply_rate_pct,
  MAX(reply_checked_at)                                AS last_checked
FROM engagement_queue
WHERE reply_checker = 'browser_v2'
  AND city IS NOT NULL
GROUP BY city
ORDER BY reply_rate_pct DESC NULLS LAST;

COMMENT ON COLUMN engagement_queue.reply_checker IS
  'Detector that produced reply_count. Only browser_v2 is trustworthy; earlier '
  'detection filtered on comment_pk which browser-posted comments never had, '
  'making its zeros false negatives. Always filter on this before computing a rate.';

COMMENT ON VIEW engagement_reply_rates IS
  'Per-city reply rates from verified (browser_v2) rows only. Use this rather '
  'than aggregating engagement_queue directly.';
