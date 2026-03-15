-- ============================================
-- Migration: Add Dog Walkers, Trainers, and Daycare/Boarding categories
-- Date: 2026-03-14
-- ============================================

INSERT INTO categories (slug, name, name_fr, icon, color, sort_order) VALUES
  ('walkers', 'Dog Walkers', 'Promeneurs', 'ð¦®', 'teal', 10),
  ('trainers', 'Dog Trainers', 'Ãducateurs canins', 'ð', 'indigo', 11),
  ('daycare', 'Daycare & Boarding', 'Garderie & Pension', 'ð ', 'amber', 12)
ON CONFLICT (slug) DO NOTHING;
