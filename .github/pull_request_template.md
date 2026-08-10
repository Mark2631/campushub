## Summary

Short summary of changes and purpose.

## Changes
- Add multi-institution support: `institutions` table, `institution_id` columns, backfill SQL, RLS policies
- Google OAuth docs and setup
- Security headers and image optimizations

## Checklist (required before merge)
- [ ] CI passes (Lint, Type-check, Build)
- [ ] Staging DB: run `supabase/2026-08-08-add-institutions.sql`
- [ ] Staging DB: run `supabase/2026-08-08-backfill-institutions-and-rls.sql`
- [ ] Run verification queries in backfill SQL and confirm zero unexpected rows
- [ ] Test sign-in flow (Google) in staging
- [ ] Create backup before applying to production
- [ ] Schedule maintenance window for production migration

## Deployment Notes
- Set Vercel env vars per `.env.example`
- Ensure Supabase Google provider has Web OAuth client ID & secret configured

## Rollback Plan
- Restore DB from backup if backfill or RLS causes issues
- Revert the PR to restore previous application code

## Additional Notes
Add any migration timing, notices, or post-deploy verification steps here.
