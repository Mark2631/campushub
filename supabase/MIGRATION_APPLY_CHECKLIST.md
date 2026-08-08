Migration apply checklist — Institutions backfill and RLS

1) PREP: Create a full database dump and snapshot of production.
   - Use Supabase backups or `pg_dump`.
   - Do NOT proceed without a verified backup.

2) STAGING: Run all SQL in `supabase/2026-08-08-add-institutions.sql` and `supabase/2026-08-08-backfill-institutions-and-rls.sql` in a staging environment first.
   - Verify that `institutions` rows were created for expected `campus` values.
   - Run verification queries in the backfill script to ensure counts of `campus IS NOT NULL AND institution_id IS NULL` are zero or acceptable.

3) VERIFY APP COMPATIBILITY IN STAGING:
   - Deploy the app pointing at staging DB and staging Supabase project.
   - Test all flows: sign-in, create listing, update listing, create item request, create community post, browse communities, messages, profile updates.
   - Ensure RLS policies permit normal user actions. If a policy blocks legitimate behavior, fix the policy and re-test.

4) ROLLING PRODUCTION PLAN:
   - Apply the backfill SQL in a short maintenance window.
   - Monitor application errors and slow queries.
   - If issues arise, run the rollback steps.

5) OPTIONAL: Add FK constraints and NOT NULL constraints
   - After at least one full day of monitoring and zero issues, consider adding foreign keys and `institution_id` NOT NULL where appropriate.
   - Execute with `ALTER TABLE ... ADD CONSTRAINT ...` and run again in staging first.

Rollback plan

- If a critical issue appears immediately after applying migrations:
  1. Restore the DB from the snapshot taken in step 1.
  2. Revert any schema changes applied via migration history (if you use migration tooling) or re-run the reverse SQL if available.
  3. Re-deploy previous app version that matches the restored schema.

Notes and warnings

- RLS changes are disruptive. Always test in staging.
- Keep `campus` queries present in the application for a while (backward compatibility) until you fully migrate client code to use `institution_id`.
- Coordinate with your ops team for DNS/hosting updates if hostnames change.
- Add CI checks that run the verification queries against a scrubbed copy of production data before proceeding to FK/NOT NULL.
