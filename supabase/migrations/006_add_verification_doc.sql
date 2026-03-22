-- Migration: Add verification_doc column to business_claims table
-- Run this in Supabase SQL Editor to support document upload verification

-- Add verification_doc column for storing uploaded verification document URLs
ALTER TABLE business_claims
ADD COLUMN IF NOT EXISTS verification_doc TEXT DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN business_claims.verification_doc IS 'URL to uploaded verification document (business license, utility bill, etc.)';

-- Optional: Create a storage bucket for verification documents if not exists
-- Run this separately in Supabase Storage settings or via SQL:
INSERT INTO storage.buckets (id, name, public)
VALUES ('verification-docs', 'verification-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policy: only authenticated users can upload to their own folder
CREATE POLICY IF NOT EXISTS "Users can upload verification docs" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'verification-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow users to read their own verification docs
CREATE POLICY IF NOT EXISTS "Users can view own verification docs" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'verification-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow admins (service role) to read all verification docs
-- This is handled automatically by the service role key
