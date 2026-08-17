Final validation report — CampusTrader (2026-08-08)

Overview

This report lists remaining manual verification steps, blockers, and code locations requiring attention before a safe production rollout of multi-institution support and OAuth branding.

Critical manual actions (you must do)

- Google Cloud OAuth branding and client setup:
  - Create a Web OAuth client in Google Cloud Console with App name "CampusTrader" and authorized JavaScript origins / redirect URIs.
  - Add the Web OAuth Client ID & Secret into Supabase Auth provider settings (do NOT expose secret in frontend).
  - Verify the OAuth consent screens show "CampusTrader" branding.

- Run CI / local validation (required):
  ```bash
  npm install
  npm audit --audit-level=high
  npm run lint
  npm run type-check
  npm run test
  npm run build
  ```
  - Fix any errors reported before deploying to production.

- Database migration / staging apply:
  - In staging: run `supabase/2026-08-08-add-institutions.sql` then `supabase/2026-08-08-backfill-institutions-and-rls.sql`.
  - Run verification queries in `2026-08-08-backfill-institutions-and-rls.sql` and ensure zero unexpected rows remain.
  - Test app behaviors thoroughly with staging DB and supabase project.

Non-critical but recommended

- Add FK constraints and NOT NULL to `institution_id` fields after at least one day of staging validation.
- Remove legacy `campus` usage after full migration; keep compatibility layer (the code currently falls back to `campus` when `institution_id` is not found).
- Review Content Security Policy in `next.config.ts` after you confirm all external origins used in production.

Files to review and/or refactor (summary)

- Code paths still using `campus` as string fields or in selects (review and migrate to `institution_id` where appropriate):
  - `lib/profiles.ts` — `campus` field in inserts/upserts
  - `lib/listings.ts` — type includes `campus`; insertion/update still sets `campus` for compatibility
  - `lib/itemRequests.ts` — payload includes `campus` (insert)
  - `lib/community.ts` — seeds and references `campus`; query fallback remains
  - `app/sell/page.tsx` — form uses `campus: institution` on request
  - Supabase SQL files: `supabase/*` — many migrations and seeds include `campus` defaults and must be reconciled with `institution_id` approach

- Files updated to prefer `institution_id` (already done):
  - `lib/listings.ts` (prefers institution_id, falls back to campus)
  - `lib/community.ts` (prefers institution_id, falls back to campus)
  - `lib/itemRequests.ts` (inserts institution_id if resolvable)
  - `lib/institutions.ts` (new helper)

Testing checklist (manual)

- Auth flows:
  - Sign in with Google in staging; ensure Supabase and Google show CampusTrader branding.
  - Verify sessions are created via `/auth/callback` server route and `AppProvider` reads session.

- Data flows:
  - Create listings, item requests, and community posts in staging and verify `institution_id` is set when available.
  - Test cross-institution access attempts (should be blocked by RLS unless admin).

- UI / assets:
  - Verify images load correctly from Supabase storage and external hosts; run through pages that display avatars and listing media.
  - Confirm `next.config.ts` remotePatterns are sufficient for all hosts in production.

Deployment notes

- Deploy the app with env vars set (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_APP_URL`).
- Keep a short maintenance window when applying backfill to production and monitor error logs and metrics.

If you'd like, I will now:
- Attempt to run lint/type-check/build locally (note: this environment may block terminal commands); or
- Prepare PR-ready changes to fully migrate a chosen subset of files from `campus` to `institution_id` (I can do this gradually to avoid breakage).

Pick one and I'll proceed automatically.
