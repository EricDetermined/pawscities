-- 020: City-evidence column for engagement queue
-- Records WHY a queued comment is believed city-tied (location tag, city
-- hashtag, handle token, or curated-list membership). Comments now only
-- enter the queue with hard evidence (see agents/engagement-bot.py
-- city_evidence()); this column makes the reason auditable at posting time.

ALTER TABLE engagement_queue
  ADD COLUMN IF NOT EXISTS city_evidence TEXT;
