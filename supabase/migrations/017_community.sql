-- 017: Community Layer
-- Public dog profiles, follows (one-way), pack links (mutual),
-- plus fixes: dog size CHECK mismatch, multi-photo support,
-- and activities backfill (app was inserting with wrong column names).

-- ============================================
-- 1. DOG PROFILES: fix size constraint + community fields
-- ============================================

-- The app sends 'TINY'/'SMALL'/'MEDIUM'/'LARGE'/'GIANT' but the original
-- CHECK only allowed lowercase 'small'..'extra-large', so every insert failed.
ALTER TABLE dog_profiles DROP CONSTRAINT IF EXISTS dog_profiles_size_check;

-- Normalize any legacy lowercase values before re-adding the constraint
UPDATE dog_profiles SET size = CASE lower(size)
  WHEN 'small' THEN 'SMALL'
  WHEN 'medium' THEN 'MEDIUM'
  WHEN 'large' THEN 'LARGE'
  WHEN 'extra-large' THEN 'XLARGE'
  ELSE upper(size)
END
WHERE size IS NOT NULL;

ALTER TABLE dog_profiles ADD CONSTRAINT dog_profiles_size_check
  CHECK (size IN ('TINY', 'SMALL', 'MEDIUM', 'LARGE', 'XLARGE', 'GIANT'));

-- Community + media fields
ALTER TABLE dog_profiles
  ADD COLUMN IF NOT EXISTS photos TEXT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS slug VARCHAR(140) DEFAULT NULL;

-- Backfill slugs for existing dogs (name + short id suffix, url-safe)
UPDATE dog_profiles
SET slug = lower(regexp_replace(coalesce(nullif(trim(name), ''), 'dog'), '[^a-zA-Z0-9]+', '-', 'g'))
           || '-' || substr(replace(id::text, '-', ''), 1, 6)
WHERE slug IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_dog_profiles_slug
  ON dog_profiles (slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dog_profiles_public
  ON dog_profiles (is_public) WHERE is_public = true;

-- Public dogs are viewable by everyone (opt-in per dog)
DROP POLICY IF EXISTS "Public dogs are viewable" ON dog_profiles;
CREATE POLICY "Public dogs are viewable" ON dog_profiles
  FOR SELECT USING (is_public = true);

-- ============================================
-- 2. FOLLOWS (one-way, no approval)
-- ============================================

CREATE TABLE IF NOT EXISTS follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows (follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows (following_id);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view follows involving them" ON follows;
CREATE POLICY "Users can view follows involving them" ON follows
  FOR SELECT USING (
    follower_id = current_user_id() OR following_id = current_user_id() OR is_admin()
  );

DROP POLICY IF EXISTS "Users can follow others" ON follows;
CREATE POLICY "Users can follow others" ON follows
  FOR INSERT WITH CHECK (follower_id = current_user_id());

DROP POLICY IF EXISTS "Users can unfollow" ON follows;
CREATE POLICY "Users can unfollow" ON follows
  FOR DELETE USING (follower_id = current_user_id());

-- ============================================
-- 3. PACK LINKS (mutual, request + approval)
-- ============================================

CREATE TABLE IF NOT EXISTS pack_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ DEFAULT NULL,
  UNIQUE (requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);

CREATE INDEX IF NOT EXISTS idx_pack_links_requester ON pack_links (requester_id, status);
CREATE INDEX IF NOT EXISTS idx_pack_links_addressee ON pack_links (addressee_id, status);

ALTER TABLE pack_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own pack links" ON pack_links;
CREATE POLICY "Users can view own pack links" ON pack_links
  FOR SELECT USING (
    requester_id = current_user_id() OR addressee_id = current_user_id() OR is_admin()
  );

DROP POLICY IF EXISTS "Users can request pack links" ON pack_links;
CREATE POLICY "Users can request pack links" ON pack_links
  FOR INSERT WITH CHECK (requester_id = current_user_id());

DROP POLICY IF EXISTS "Addressees can respond to pack requests" ON pack_links;
CREATE POLICY "Addressees can respond to pack requests" ON pack_links
  FOR UPDATE USING (addressee_id = current_user_id())
  WITH CHECK (addressee_id = current_user_id());

DROP POLICY IF EXISTS "Users can remove own pack links" ON pack_links;
CREATE POLICY "Users can remove own pack links" ON pack_links
  FOR DELETE USING (
    requester_id = current_user_id() OR addressee_id = current_user_id()
  );

-- ============================================
-- 4. ACTIVITIES: backfill missed events
-- ============================================
-- The app was inserting into activities with non-existent columns
-- (activity_type / entity_id / entity_type), so inserts silently failed.
-- The code is fixed to use the real columns (type / check_in_id / review_id).
-- Backfill activities for existing check-ins and reviews:

INSERT INTO activities (user_id, type, establishment_id, check_in_id, created_at)
SELECT c.user_id, 'check_in', c.establishment_id, c.id, c.created_at
FROM check_ins c
WHERE NOT EXISTS (SELECT 1 FROM activities a WHERE a.check_in_id = c.id);

INSERT INTO activities (user_id, type, establishment_id, review_id, created_at)
SELECT r.user_id, 'review', r.establishment_id, r.id, r.created_at
FROM reviews r
WHERE NOT EXISTS (SELECT 1 FROM activities a WHERE a.review_id = r.id);
