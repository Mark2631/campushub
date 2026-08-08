-- Migration: Add institutions table and institution_id columns (draft)
-- DO NOT RUN WITHOUT REVIEW. This migration is a draft and must be applied via your DB migration tooling.

-- 1) Create institutions table
CREATE TABLE IF NOT EXISTS institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  short_name text NOT NULL,
  slug text NOT NULL UNIQUE,
  county text,
  logo text,
  cover text,
  status text NOT NULL DEFAULT 'coming_soon',
  launch_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Add institution_id to profiles, listings, item_requests, communities, businesses (nullable)
ALTER TABLE IF EXISTS profiles
  ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES institutions(id);

ALTER TABLE IF EXISTS listings
  ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES institutions(id);

ALTER TABLE IF EXISTS item_requests
  ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES institutions(id);

ALTER TABLE IF EXISTS communities
  ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES institutions(id);

ALTER TABLE IF EXISTS businesses
  ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES institutions(id);

-- 3) Indexes
CREATE INDEX IF NOT EXISTS idx_listings_institution_id ON listings(institution_id);
CREATE INDEX IF NOT EXISTS idx_profiles_institution_id ON profiles(institution_id);
CREATE INDEX IF NOT EXISTS idx_item_requests_institution_id ON item_requests(institution_id);
CREATE INDEX IF NOT EXISTS idx_communities_institution_id ON communities(institution_id);
CREATE INDEX IF NOT EXISTS idx_businesses_institution_id ON businesses(institution_id);

-- NOTES:
-- - This migration avoids destructive operations. It does not backfill existing rows to any institution.
-- - After review, a controlled backfill script can be added to associate MUST-era rows with the MUST institution.
-- - Make sure RLS policies are reviewed and updated to use institution scoping where appropriate.
