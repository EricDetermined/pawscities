-- 036 i18n content columns (2026-09-24)
-- Machine-translated description columns for multilingual content (Phase 2).
-- Names are NOT translated (proper nouns) — only descriptions.
-- description_fr already exists on establishments; add es/ja/ca there, and all
-- four on events. Nullable; rendering falls back to English when null.

ALTER TABLE establishments
  ADD COLUMN IF NOT EXISTS description_es text,
  ADD COLUMN IF NOT EXISTS description_ja text,
  ADD COLUMN IF NOT EXISTS description_ca text;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS description_fr text,
  ADD COLUMN IF NOT EXISTS description_es text,
  ADD COLUMN IF NOT EXISTS description_ja text,
  ADD COLUMN IF NOT EXISTS description_ca text;
