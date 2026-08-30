-- 028: Ambassador announcement + handle options (2026-08-30, per Eric)
-- Ambassadors can be announced under their own name (default) or their dog's
-- name + photo, and can register either their personal Instagram or a
-- dedicated dog account as their official handle.
ALTER TABLE ambassador_applications ADD COLUMN IF NOT EXISTS dog_name TEXT, ADD COLUMN IF NOT EXISTS dog_photo_url TEXT, ADD COLUMN IF NOT EXISTS announcement_preference TEXT DEFAULT 'own_name' CHECK (announcement_preference IN ('own_name', 'dog_name')), ADD COLUMN IF NOT EXISTS handle_type TEXT DEFAULT 'personal' CHECK (handle_type IN ('personal', 'dog_account'));
