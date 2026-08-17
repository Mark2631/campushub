-- CampusTrader Production Fixes Migration (010_production_fixes.sql)
-- Fixes RLS policies for listing status updates ("mark as sold" bug)
-- Creates marketplace views if they don't exist
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/hnhhednibexcfwfizawy/sql

-- ============================================================
-- 1. FIX: Listing UPDATE RLS policy (mark as sold / hide / restore)
-- The existing policy may only check user_id but listings use seller_id.
-- This policy allows the owner to update their own listings via either column.
-- ============================================================

-- Drop old restrictive policies if they exist (safe — won't error if missing)
DO $$
BEGIN
  -- Try to drop common policy names that may be blocking updates
  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "Users can update own listings" ON public.listings';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "Sellers can update own listings" ON public.listings';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "Enable update for users based on user_id" ON public.listings';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- Create a permissive UPDATE policy matching BOTH seller_id and user_id
CREATE POLICY "Owners can update their listings"
  ON public.listings FOR UPDATE
  USING (
    auth.uid() = seller_id
    OR auth.uid() = user_id
  )
  WITH CHECK (
    auth.uid() = seller_id
    OR auth.uid() = user_id
  );

-- Ensure SELECT policy exists (listings should be publicly readable)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'listings' AND policyname = 'Listings are viewable by everyone'
  ) THEN
    EXECUTE 'CREATE POLICY "Listings are viewable by everyone" ON public.listings FOR SELECT USING (true)';
  END IF;
END $$;

-- Ensure INSERT policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'listings' AND policyname = 'Authenticated users can insert listings'
  ) THEN
    EXECUTE 'CREATE POLICY "Authenticated users can insert listings" ON public.listings FOR INSERT WITH CHECK (auth.uid() = seller_id OR auth.uid() = user_id)';
  END IF;
END $$;

-- Ensure DELETE policy exists (owners only)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'listings' AND policyname = 'Owners can delete their listings'
  ) THEN
    EXECUTE 'CREATE POLICY "Owners can delete their listings" ON public.listings FOR DELETE USING (auth.uid() = seller_id OR auth.uid() = user_id)';
  END IF;
END $$;

-- Make sure RLS is enabled on listings
ALTER TABLE IF EXISTS public.listings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Marketplace views (safe read-only views for public profile/business data)
-- These are used by listings.ts for enriching listing cards
-- ============================================================

CREATE OR REPLACE VIEW public.marketplace_profiles AS
SELECT
  id,
  full_name,
  avatar_url,
  phone_number,
  badge_type,
  verification_status,
  role,
  email_verified,
  created_at
FROM public.profiles;

CREATE OR REPLACE VIEW public.marketplace_businesses AS
SELECT
  id,
  business_name,
  verification_status,
  badge_type,
  category,
  location,
  description,
  created_at
FROM public.businesses;

-- ============================================================
-- 3. Ensure profiles UPDATE policy allows users to update their own profile
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'Users can update own profile'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id)';
  END IF;
END $$;

-- ============================================================
-- 4. Fix institution statuses — only MUST should be active for launch
-- ============================================================

UPDATE public.institutions
SET status = 'coming_soon'
WHERE slug != 'must' AND status = 'active';

-- Ensure MUST is active
UPDATE public.institutions
SET status = 'active'
WHERE slug = 'must';

-- ============================================================
-- DONE. Run this SQL in your Supabase Dashboard SQL Editor.
-- After running, test marking a listing as "sold" from the profile page.
-- ============================================================
