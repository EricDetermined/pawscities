-- 024_widen_post_shortcode.sql
--
-- WHY
-- ---
-- engagement_queue.post_shortcode was VARCHAR(32), sized for the classic
-- 11-character Instagram shortcode with room to spare. Instagram now also
-- issues extended codes — 39 characters on collab and some reshared posts,
-- e.g. /p/DX4UYdqkavs4FRcSVcVmaovLbTocaBg3DA_9AI0/ — and the cap is too small
-- for them.
--
-- Found while syncing the local queue: the insert failed with 22001
-- "value too long for type character varying(32)" on 3 rows, two of them
-- successfully-posted comments we did not want to drop.
--
-- THE PART THAT MATTERS MORE
-- --------------------------
-- Checking the existing table turned up 2 rows ALREADY stored with a truncated
-- shortcode — cut at exactly 32 characters. Postgres raises an error rather
-- than silently truncating, so those arrived through a path that cast the
-- value down before insert. They have been sitting there as identifiers that
-- match no real post: any lookup by shortcode would miss them, and any dedup
-- check would treat the post as never seen and could comment on it twice.
--
-- post_url kept the full code, so the damage is repairable rather than a loss.

ALTER TABLE engagement_queue
  ALTER COLUMN post_shortcode TYPE VARCHAR(64);

-- Repair the truncated rows from post_url, which holds the authoritative code.
--
-- The WHERE clause is deliberately narrow. It only rewrites a row when the
-- stored value is a strict PREFIX of the code in the URL, which is the
-- signature of truncation. That way a row whose shortcode genuinely differs
-- from its URL (a mismatch, a bad import) is left alone for inspection rather
-- than being quietly overwritten by this migration.
UPDATE engagement_queue
SET post_shortcode = substring(post_url from '/p/([^/?]+)')
WHERE post_url IS NOT NULL
  AND substring(post_url from '/p/([^/?]+)') IS NOT NULL
  AND post_shortcode IS DISTINCT FROM substring(post_url from '/p/([^/?]+)')
  AND substring(post_url from '/p/([^/?]+)') LIKE post_shortcode || '%';

COMMENT ON COLUMN engagement_queue.post_shortcode IS
  'Instagram shortcode from the post URL. Classic codes are 11 chars, but '
  'collab and reshared posts use extended codes up to 39 — sized to 64 to '
  'leave headroom. Never truncate this: a shortened code silently matches no '
  'post, which breaks both lookup and the duplicate-comment guard.';
