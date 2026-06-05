-- Migration: Add format column to social_posts for visual style tracking
-- Run this in the Supabase SQL Editor
-- This enables grid diversity tracking (mascot vs photo vs text_card)

ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS format TEXT DEFAULT 'mascot';

-- Backfill existing posts as 'mascot' since they all used mascot style
UPDATE social_posts SET format = 'mascot' WHERE format IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN social_posts.format IS 'Visual style: mascot, photo, or text_card — used for grid diversity tracking';
