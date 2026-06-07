-- Migration: Add carousel_urls column to creative_queue for weekly roundup carousels
-- Run this in the Supabase SQL Editor
-- This stores the ordered array of image URLs for carousel posts

-- Add carousel format to the format check constraint if not already present
ALTER TABLE creative_queue DROP CONSTRAINT IF EXISTS creative_queue_format_check;
ALTER TABLE creative_queue ADD CONSTRAINT creative_queue_format_check
  CHECK (format IN ('city_card', 'event_post', 'animated_reel', 'carousel_post', 'intro', 'mascot', 'photo', 'text_card', 'carousel'));

-- Add carousel_urls column (JSONB array of image URLs)
ALTER TABLE creative_queue ADD COLUMN IF NOT EXISTS carousel_urls JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN creative_queue.carousel_urls IS 'Ordered array of image URLs for carousel posts (cover + events + CTA slides)';
