-- Add coverage for the three foreign-key columns identified by the Supabase performance advisor.
-- These small indexes reduce parent deletes/updates and joins from scanning the child tables.
BEGIN;
CREATE INDEX IF NOT EXISTS institution_code_aliases_institution_id_idx
  ON private.institution_code_aliases (institution_id);
CREATE INDEX IF NOT EXISTS manual_order_releases_admin_id_idx
  ON private.manual_order_releases (admin_id);
CREATE INDEX IF NOT EXISTS payment_attempts_verified_by_idx
  ON public.payment_attempts (verified_by);
COMMIT;
