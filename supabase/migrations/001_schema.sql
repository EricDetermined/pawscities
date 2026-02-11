-- ============================================
-- Paw Cities - Full Database Schema
-- Supabase PostgreSQL Migration
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For fuzzy text search

-- ============================================
-- ENUM TYPES
-- ============================================

CREATE TYPE user_role AS ENUM ('USER', 'BUSINESS', 'ADMIN');
CREATE TYPE claim_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE establishment_status AS ENUM ('ACTIVE', 'INACTIVE', 'PENDING_REVIEW', 'SUSPENDED');
CREATE TYPE establishment_tier AS ENUM ('free', 'premium');
CREATE TYPE review_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FLAGGED');
CREATE TYPE subscription_status AS ENUM ('ACTIVE', 'CANCELLED', 'PAST_DUE', 'TRIALING');
CREATE TYPE analytics_event_type AS ENUM (
  'page_view', 'search', 'click_phone', 'click_website',
  'click_directions', 'click_share', 'favorite_add', 'favorite_remove',
  'review_submit', 'check_in', 'photo_view'
);

-- ============================================
-- CITIES
-- ============================================

CREATE TABLE cities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  name_fr VARCHAR(100),
  country VARCHAR(100) NOT NULL,
  country_code VARCHAR(5) NOT NULL,
  timezone VARCHAR(50) NOT NULL,
  currency VARCHAR(10) NOT NULL,
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  zoom_level INTEGER DEFAULT 13,
  languages TEXT[] DEFAULT ARRAY['en'],
  description TEXT,
  description_fr TEXT,
  hero_image TEXT,
  is_active BOOLEAN DEFAULT true,
  emergency_vet_search TEXT,
  -- Dog regulations
  leash_required BOOLEAN DEFAULT true,
  off_leash_areas BOOLEAN DEFAULT false,
  public_transport TEXT,
  public_transport_fr TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cities_slug ON cities(slug);
CREATE INDEX idx_cities_active ON cities(is_active);

-- ============================================
-- CATEGORIES
-- ============================================

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  name_fr VARCHAR(100),
  icon VARCHAR(10),
  color VARCHAR(20),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_categories_slug ON categories(slug);

-- ============================================
-- USERS (extends Supabase Auth)
-- ============================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supabase_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  avatar TEXT,
  role user_role DEFAULT 'USER',
  language VARCHAR(5) DEFAULT 'en',
  home_city UUID REFERENCES cities(id),
  is_suspended BOOLEAN DEFAULT false,
  suspended_at TIMESTAMPTZ,
  suspended_reason TEXT,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_supabase_id ON users(supabase_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ============================================
-- ESTABLISHMENTS
-- ============================================

CREATE TABLE establishments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(255) NOT NULL,
  city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id),
  -- Basic info
  name VARCHAR(255) NOT NULL,
  name_fr VARCHAR(255),
  description TEXT,
  description_fr TEXT,
  address TEXT NOT NULL,
  neighborhood VARCHAR(100),
  -- Location
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  -- Contact
  phone VARCHAR(50),
  email VARCHAR(255),
  website TEXT,
  -- Ratings
  rating DECIMAL(3, 2) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  price_level INTEGER DEFAULT 2 CHECK (price_level BETWEEN 1 AND 4),
  -- Images
  primary_image TEXT,
  photo_refs TEXT[],  -- Google Places photo references
  -- Google Places data
  google_place_id VARCHAR(255),
  google_maps_url TEXT,
  opening_hours TEXT[],
  -- Dog features (JSONB for flexibility)
  dog_features JSONB DEFAULT '{}',
  amenities TEXT[],
  -- Status & tier
  status establishment_status DEFAULT 'ACTIVE',
  tier establishment_tier DEFAULT 'free',
  is_verified BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  -- Ownership
  claimed_by UUID REFERENCES users(id),
  claimed_at TIMESTAMPTZ,
  -- Source tracking
  source VARCHAR(50) DEFAULT 'research',  -- research, user_submission, business_claim
  confidence INTEGER DEFAULT 0,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Unique slug per city
  UNIQUE(city_id, slug)
);

CREATE INDEX idx_establishments_city ON establishments(city_id);
CREATE INDEX idx_establishments_category ON establishments(category_id);
CREATE INDEX idx_establishments_slug ON establishments(slug);
CREATE INDEX idx_establishments_status ON establishments(status);
CREATE INDEX idx_establishments_tier ON establishments(tier);
CREATE INDEX idx_establishments_featured ON establishments(is_featured);
CREATE INDEX idx_establishments_rating ON establishments(rating DESC);
CREATE INDEX idx_establishments_claimed_by ON establishments(claimed_by);
CREATE INDEX idx_establishments_name_trgm ON establishments USING gin(name gin_trgm_ops);

-- ============================================
-- BUSINESS CLAIMS
-- ============================================

CREATE TABLE business_claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  establishment_id UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  -- Business info
  business_name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255) NOT NULL,
  contact_phone VARCHAR(50),
  -- Verification
  verification_method VARCHAR(50),  -- phone, email, document
  verification_notes TEXT,
  -- Status
  status claim_status DEFAULT 'PENDING',
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_claims_status ON business_claims(status);
CREATE INDEX idx_claims_user ON business_claims(user_id);
CREATE INDEX idx_claims_establishment ON business_claims(establishment_id);

-- ============================================
-- SUBSCRIPTIONS (Premium tier tracking)
-- ============================================

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  establishment_id UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  -- Plan details
  plan VARCHAR(50) NOT NULL DEFAULT 'premium',  -- Only 'premium' for now
  price_cents INTEGER NOT NULL DEFAULT 2900,     -- $29.00
  currency VARCHAR(3) DEFAULT 'USD',
  -- Status
  status subscription_status DEFAULT 'ACTIVE',
  -- Billing (Stripe placeholders)
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  -- Dates
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_establishment ON subscriptions(establishment_id);
CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- ============================================
-- REVIEWS
-- ============================================

CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  establishment_id UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  -- Content
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title VARCHAR(255),
  content TEXT,
  -- Detailed ratings
  dog_friendliness INTEGER CHECK (dog_friendliness BETWEEN 1 AND 5),
  service_rating INTEGER CHECK (service_rating BETWEEN 1 AND 5),
  value_rating INTEGER CHECK (value_rating BETWEEN 1 AND 5),
  -- Dog info
  dog_names TEXT[],
  visit_date DATE,
  -- Photos
  photos TEXT[],
  -- Business response
  response TEXT,
  response_at TIMESTAMPTZ,
  responded_by UUID REFERENCES users(id),
  -- Status
  status review_status DEFAULT 'PENDING',
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reviews_establishment ON reviews(establishment_id);
CREATE INDEX idx_reviews_user ON reviews(user_id);
CREATE INDEX idx_reviews_status ON reviews(status);
CREATE INDEX idx_reviews_rating ON reviews(rating);

-- ============================================
-- DOG PROFILES
-- ============================================

CREATE TABLE dog_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  breed VARCHAR(100),
  birth_date DATE,
  size VARCHAR(20) CHECK (size IN ('small', 'medium', 'large', 'extra-large')),
  personality TEXT,
  photo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dog_profiles_user ON dog_profiles(user_id);

-- ============================================
-- FAVORITES
-- ============================================

CREATE TABLE favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  establishment_id UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, establishment_id)
);

CREATE INDEX idx_favorites_user ON favorites(user_id);
CREATE INDEX idx_favorites_establishment ON favorites(establishment_id);

-- ============================================
-- CHECK-INS
-- ============================================

CREATE TABLE check_ins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  establishment_id UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  dog_id UUID REFERENCES dog_profiles(id),
  note TEXT,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  photo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_check_ins_user ON check_ins(user_id);
CREATE INDEX idx_check_ins_establishment ON check_ins(establishment_id);

-- ============================================
-- ACTIVITIES (Activity feed)
-- ============================================

CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,  -- review, check_in, favorite, claim, etc.
  establishment_id UUID REFERENCES establishments(id),
  review_id UUID REFERENCES reviews(id),
  check_in_id UUID REFERENCES check_ins(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activities_user ON activities(user_id);
CREATE INDEX idx_activities_type ON activities(type);
CREATE INDEX idx_activities_created ON activities(created_at DESC);

-- ============================================
-- ANALYTICS EVENTS
-- ============================================

CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type analytics_event_type NOT NULL,
  establishment_id UUID REFERENCES establishments(id),
  city_id UUID REFERENCES cities(id),
  user_id UUID REFERENCES users(id),
  -- Event data
  page_path TEXT,
  search_query TEXT,
  referrer TEXT,
  user_agent TEXT,
  -- Session
  session_id VARCHAR(100),
  ip_hash VARCHAR(64),  -- Hashed for privacy
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partitioned index for time-series queries
CREATE INDEX idx_analytics_created ON analytics_events(created_at DESC);
CREATE INDEX idx_analytics_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_establishment ON analytics_events(establishment_id);
CREATE INDEX idx_analytics_city ON analytics_events(city_id);
CREATE INDEX idx_analytics_session ON analytics_events(session_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE establishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE dog_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE supabase_id = auth.uid()
    AND role = 'ADMIN'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper function to get current user's internal ID
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS UUID AS $$
  SELECT id FROM users
  WHERE supabase_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- CITIES: Public read, admin write
CREATE POLICY "Cities are viewable by everyone" ON cities FOR SELECT USING (true);
CREATE POLICY "Admins can manage cities" ON cities FOR ALL USING (is_admin());

-- CATEGORIES: Public read, admin write
CREATE POLICY "Categories are viewable by everyone" ON categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage categories" ON categories FOR ALL USING (is_admin());

-- ESTABLISHMENTS: Public read active, admin full access, business owner can edit own
CREATE POLICY "Active establishments are viewable" ON establishments
  FOR SELECT USING (status = 'ACTIVE' OR is_admin() OR claimed_by = current_user_id());
CREATE POLICY "Admins can manage establishments" ON establishments
  FOR ALL USING (is_admin());
CREATE POLICY "Business owners can update own listings" ON establishments
  FOR UPDATE USING (claimed_by = current_user_id())
  WITH CHECK (claimed_by = current_user_id());

-- USERS: Own profile read/write, admin full access
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (supabase_id = auth.uid() OR is_admin());
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (supabase_id = auth.uid())
  WITH CHECK (supabase_id = auth.uid());
CREATE POLICY "Admins can manage users" ON users FOR ALL USING (is_admin());
CREATE POLICY "Users can insert own record" ON users
  FOR INSERT WITH CHECK (supabase_id = auth.uid());

-- BUSINESS CLAIMS: Own read, admin full access
CREATE POLICY "Users can view own claims" ON business_claims
  FOR SELECT USING (user_id = current_user_id() OR is_admin());
CREATE POLICY "Users can create claims" ON business_claims
  FOR INSERT WITH CHECK (user_id = current_user_id());
CREATE POLICY "Admins can manage claims" ON business_claims
  FOR ALL USING (is_admin());

-- SUBSCRIPTIONS: Own read, admin full access
CREATE POLICY "Users can view own subscriptions" ON subscriptions
  FOR SELECT USING (user_id = current_user_id() OR is_admin());
CREATE POLICY "Admins can manage subscriptions" ON subscriptions
  FOR ALL USING (is_admin());

-- REVIEWS: Public read approved, own CRUD, admin full
CREATE POLICY "Approved reviews are viewable" ON reviews
  FOR SELECT USING (status = 'APPROVED' OR user_id = current_user_id() OR is_admin());
CREATE POLICY "Users can create reviews" ON reviews
  FOR INSERT WITH CHECK (user_id = current_user_id());
CREATE POLICY "Users can update own reviews" ON reviews
  FOR UPDATE USING (user_id = current_user_id());
CREATE POLICY "Admins can manage reviews" ON reviews FOR ALL USING (is_admin());

-- DOG PROFILES: Own CRUD, admin read
CREATE POLICY "Users can manage own dogs" ON dog_profiles
  FOR ALL USING (user_id = current_user_id());
CREATE POLICY "Admins can view dogs" ON dog_profiles
  FOR SELECT USING (is_admin());

-- FAVORITES: Own CRUD
CREATE POLICY "Users can manage own favorites" ON favorites
  FOR ALL USING (user_id = current_user_id());

-- CHECK-INS: Own CRUD, admin read
CREATE POLICY "Users can manage own check-ins" ON check_ins
  FOR ALL USING (user_id = current_user_id());
CREATE POLICY "Admins can view check-ins" ON check_ins
  FOR SELECT USING (is_admin());

-- ACTIVITIES: Own read, admin read
CREATE POLICY "Users can view own activities" ON activities
  FOR SELECT USING (user_id = current_user_id() OR is_admin());
CREATE POLICY "System can insert activities" ON activities
  FOR INSERT WITH CHECK (true);

-- ANALYTICS: Insert open (for tracking), admin read
CREATE POLICY "Anyone can log analytics" ON analytics_events
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can view analytics" ON analytics_events
  FOR SELECT USING (is_admin());
CREATE POLICY "Business owners can view own analytics" ON analytics_events
  FOR SELECT USING (
    establishment_id IN (
      SELECT id FROM establishments WHERE claimed_by = current_user_id()
    )
  );

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_cities_updated_at BEFORE UPDATE ON cities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_establishments_updated_at BEFORE UPDATE ON establishments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_business_claims_updated_at BEFORE UPDATE ON business_claims
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_reviews_updated_at BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_dog_profiles_updated_at BEFORE UPDATE ON dog_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- VIEWS (for admin dashboard)
-- ============================================

-- Dashboard stats view
CREATE OR REPLACE VIEW admin_stats AS
SELECT
  (SELECT COUNT(*) FROM cities WHERE is_active = true) AS active_cities,
  (SELECT COUNT(*) FROM establishments WHERE status = 'ACTIVE') AS total_establishments,
  (SELECT COUNT(*) FROM users) AS total_users,
  (SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '7 days') AS new_users_week,
  (SELECT COUNT(*) FROM business_claims WHERE status = 'PENDING') AS pending_claims,
  (SELECT COUNT(*) FROM reviews WHERE status = 'PENDING') AS pending_reviews,
  (SELECT COUNT(*) FROM establishments WHERE tier = 'premium') AS premium_listings,
  (SELECT COUNT(*) FROM analytics_events WHERE created_at > NOW() - INTERVAL '24 hours') AS events_today;

-- City stats view
CREATE OR REPLACE VIEW city_stats AS
SELECT
  c.id,
  c.slug,
  c.name,
  c.country,
  c.is_active,
  COUNT(DISTINCT e.id) AS establishment_count,
  COUNT(DISTINCT CASE WHEN e.tier = 'premium' THEN e.id END) AS premium_count,
  COALESCE(AVG(e.rating), 0) AS avg_rating
FROM cities c
LEFT JOIN establishments e ON e.city_id = c.id AND e.status = 'ACTIVE'
GROUP BY c.id;

-- ============================================
-- SEED: Categories
-- ============================================

INSERT INTO categories (slug, name, name_fr, icon, color, sort_order) VALUES
  ('restaurants', 'Restaurants', 'Restaurants', '🍽️', 'orange', 1),
  ('cafes', 'Cafes', 'Cafés', '☕', 'brown', 2),
  ('hotels', 'Hotels', 'Hôtels', '🏨', 'blue', 3),
  ('parks', 'Dog Parks', 'Parcs', '🌳', 'green', 4),
  ('beaches', 'Beaches', 'Plages', '🏖️', 'cyan', 5),
  ('vets', 'Vets', 'Vétérinaires', '🏥', 'red', 6),
  ('groomers', 'Groomers', 'Toiletteurs', '✂️', 'pink', 7),
  ('shops', 'Pet Shops', 'Animaleries', '🏪', 'purple', 8),
  ('activities', 'Activities', 'Activités', '🎾', 'yellow', 9);

-- ============================================
-- SEED: Cities
-- ============================================

INSERT INTO cities (slug, name, name_fr, country, country_code, timezone, currency, latitude, longitude, zoom_level, languages, description, description_fr, hero_image, is_active, emergency_vet_search, leash_required, off_leash_areas, public_transport, public_transport_fr) VALUES
  ('geneva', 'Geneva', 'Genève', 'Switzerland', 'CH', 'Europe/Zurich', 'CHF', 46.2044, 6.1432, 13, ARRAY['en','fr'], 'Discover dog-friendly parks, restaurants, hotels and more in Geneva. From Lake Geneva shores to the charming Old Town.', 'Découvrez les parcs, restaurants, hôtels et plus accueillant les chiens à Genève.', 'https://images.unsplash.com/photo-1573108037329-37aa135a142e?auto=format&fit=crop&w=1600&q=80', true, 'emergency vet Geneva Switzerland', true, true, 'Small dogs in carriers travel free. Larger dogs need a reduced-fare ticket.', 'Les petits chiens en transporteur voyagent gratuitement. Les grands chiens ont besoin d''un billet à tarif réduit.'),
  ('paris', 'Paris', 'Paris', 'France', 'FR', 'Europe/Paris', 'EUR', 48.8566, 2.3522, 12, ARRAY['en','fr'], 'Explore dog-friendly cafés, parks, and restaurants in the City of Light. Paris loves dogs!', 'Explorez les cafés, parcs et restaurants accueillant les chiens dans la Ville Lumière.', 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1600&q=80', true, 'urgence vétérinaire Paris France', true, true, 'Dogs allowed on metro and buses in carriers or on leash. Large dogs need a ticket.', 'Chiens autorisés dans le métro et les bus en transporteur ou en laisse.'),
  ('london', 'London', 'Londres', 'United Kingdom', 'GB', 'Europe/London', 'GBP', 51.5074, -0.1278, 12, ARRAY['en'], 'Find dog-friendly pubs, parks, and cafés across London. One of the most dog-loving cities in the world.', 'Trouvez les pubs, parcs et cafés accueillant les chiens à Londres.', 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=1600&q=80', true, 'emergency vet London UK', true, true, 'Dogs allowed on most public transport. Must be on leash on buses; carried on escalators.', 'Chiens autorisés dans la plupart des transports en commun.'),
  ('losangeles', 'Los Angeles', 'Los Angeles', 'United States', 'US', 'America/Los_Angeles', 'USD', 34.0522, -118.2437, 11, ARRAY['en'], 'Discover dog-friendly beaches, hikes, and restaurants across LA. Sun, surf, and pups!', 'Découvrez les plages, sentiers et terrasses accueillant les chiens à Los Angeles.', 'https://images.unsplash.com/photo-1534190760961-74e8c1c5c3da?auto=format&fit=crop&w=1600&q=80', true, 'emergency vet Los Angeles California', true, true, 'Dogs allowed on Metro buses and trains. Must be in a carrier that fits on your lap.', 'Chiens autorisés dans les bus et trains Metro en transporteur.'),
  ('newyork', 'New York', 'New York', 'United States', 'US', 'America/New_York', 'USD', 40.7128, -74.0060, 12, ARRAY['en'], 'Find dog-friendly restaurants, parks, and hotels in the Big Apple.', 'Trouvez les restaurants, parcs et hôtels accueillant les chiens à New York.', 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&w=1600&q=80', true, 'emergency vet New York City', true, true, 'Dogs in carriers allowed on subway and buses. Service dogs always welcome.', 'Chiens en transporteur autorisés dans le métro et les bus.'),
  ('barcelona', 'Barcelona', 'Barcelone', 'Spain', 'ES', 'Europe/Madrid', 'EUR', 41.3874, 2.1686, 13, ARRAY['en','es'], 'Explore dog-friendly beaches, tapas bars, and parks in sunny Barcelona.', 'Explorez les plages, bars à tapas et parcs accueillant les chiens à Barcelone.', 'https://images.unsplash.com/photo-1583422409516-2895a77efded?auto=format&fit=crop&w=1600&q=80', true, 'urgencias veterinarias Barcelona España', true, true, 'Small dogs in carriers allowed on metro. Larger dogs allowed during off-peak hours.', 'Petits chiens en transporteur autorisés dans le métro.'),
  ('sydney', 'Sydney', 'Sydney', 'Australia', 'AU', 'Australia/Sydney', 'AUD', -33.8688, 151.2093, 12, ARRAY['en'], 'Find dog-friendly beaches, parks, and cafés in beautiful Sydney.', 'Trouvez les plages, parcs et cafés accueillant les chiens à Sydney.', 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?auto=format&fit=crop&w=1600&q=80', true, 'emergency vet Sydney Australia', true, true, 'Dogs in carriers allowed on trains and buses outside peak hours. Guide dogs always welcome.', 'Chiens en transporteur autorisés dans les trains et bus hors heures de pointe.'),
  ('tokyo', 'Tokyo', 'Tokyo', 'Japan', 'JP', 'Asia/Tokyo', 'JPY', 35.6762, 139.6503, 12, ARRAY['en','ja'], 'Find dog-friendly cafes, parks, and shops across Tokyo.', 'Trouvez les cafés, parcs et boutiques accueillant les chiens à Tokyo.', 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=1600&q=80', true, 'emergency vet Tokyo Japan', true, false, 'Small dogs in carriers allowed on most trains. Some rail lines have size restrictions.', 'Petits chiens en transporteur autorisés dans la plupart des trains.');
