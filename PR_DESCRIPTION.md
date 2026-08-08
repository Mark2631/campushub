Title: Add multi-institution foundation, Google OAuth finalization, and production readiness

Commit message:
Add multi-institution support: institutions table, institution_id columns, backfill, RLS, Docker + CI improvements

PR body (paste this into GitHub PR):

Summary
- Adds a lightweight institutions foundation and `institution_id` support across core tables.
- Provides safe, non-destructive migration SQL and a backfill script with verification queries and RLS policy examples.
- Improves production readiness: CSP/security headers, `next/image` remotePatterns, GitHub Actions CI trigger, and a Dockerfile for reproducible builds.

Changes
- `supabase/2026-08-08-add-institutions.sql` — migration to add `institutions` and nullable `institution_id` columns + indexes.
- `supabase/2026-08-08-backfill-institutions-and-rls.sql` — backfill from existing `campus` values, verification queries, and example RLS policies.
- `Dockerfile` + `docker/README.md` — reproducible container build for CI or local runs.
- `.github/pull_request_template.md` — PR checklist for migrations and deployment.
- Code changes: prefer `institution_id` where available; preserve `campus` fallback (see `lib/*` and `components/*`).

How to run CI (no local install required)
1. Create a branch and push these changes:

```bash
git checkout -b release/multi-institution
git add .
git commit -m "Add multi-institution foundation, migrations, Docker, CI improvements"
git push --set-upstream origin release/multi-institution
```

2. In GitHub: Repo → Actions → select `CI` workflow → Run workflow (choose this branch) OR open a PR (CI runs automatically).

Database migration order (STAGING first — backup before production!)
1. Run `supabase/2026-08-08-add-institutions.sql` in staging (adds `institutions` and nullable `institution_id` columns + indexes).
2. Run `supabase/2026-08-08-backfill-institutions-and-rls.sql` in staging (inserts institutions from `campus`, backfills `institution_id`, enables RLS policies).
3. Run verification queries included in the backfill script and confirm zero or acceptable counts for rows where `campus IS NOT NULL AND institution_id IS NULL`.
4. If verification is clean, optionally add FK and NOT NULL constraints in a separate migration after monitoring.

Verification queries (run after backfill)
```sql
SELECT 'listings' AS tbl, count(*) FROM public.listings WHERE campus IS NOT NULL AND institution_id IS NULL;
SELECT 'profiles' AS tbl, count(*) FROM public.profiles WHERE campus IS NOT NULL AND institution_id IS NULL;
SELECT 'item_requests' AS tbl, count(*) FROM public.item_requests WHERE campus IS NOT NULL AND institution_id IS NULL;
SELECT 'communities' AS tbl, count(*) FROM public.communities WHERE campus IS NOT NULL AND institution_id IS NULL;
```

Vercel / Env notes
- Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_APP_URL` in Vercel (do not expose service_role keys in public envs).
- Configure Google Web OAuth in Google Cloud Console (App name = CampusTrader) and paste Web Client ID + Secret into Supabase Auth → Providers → Google.

Rollback plan
- Restore DB from backup if backfill or RLS breaks expected behavior.
- Revert this PR to return code to prior state while investigating.

CI & Docker
- This PR adds a `workflow_dispatch` trigger so CI can be manually started from Actions UI.
- Use the provided `Dockerfile` to run builds in a container (no local Node required).

Notes for reviewers
- Run migrations in staging and run the app end-to-end: sign-in with Google, create/edit listing, create request, community post, message flow.
- RLS policies in the backfill file are examples — please review and adjust to your exact `profiles` schema (especially `is_admin`).
