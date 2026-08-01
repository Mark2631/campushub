# CampusTrader Production Readiness Requirements

This project can only be made fully production-ready when the implementation work and the verification environment are both complete. The items below are the concrete requirements needed to finish the full multi-institution, Network, marketplace, security, and performance rollout with reliable green builds.

## 1. Required access and environment

- Working npm registry access that can install packages and read audit advisories without `403 Forbidden` responses.
- A regenerated `package-lock.json` produced by `npm install` or `npm install --package-lock-only` after dependency upgrades.
- Installed dependencies in the workspace before validation commands run.
- A Supabase project with SQL editor access for applying migrations and validating Row Level Security policies.
- Supabase environment variables for local and deployment environments:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - `NEXT_PUBLIC_APP_URL`
- A staging deployment separate from production for testing migrations, onboarding, institution filtering, image optimization, messaging, uploads, and PWA behavior.

## 2. Required product decisions

- Confirm the launch institution behavior:
  - MUST active at launch.
  - Other Meru institutions seeded but hidden, disabled, or marked `coming_soon` until approved.
- Confirm the institution-change policy:
  - Whether users can change institution freely.
  - Whether institution changes require admin approval.
  - Whether changing institutions should hide old listings or migrate them.
- Confirm whether search may show `All Institutions` immediately or only for admins/testing.
- Confirm final support channels:
  - WhatsApp and call number: `0745706087`.
  - Support email address.
  - Bug report destination.
- Confirm naming:
  - Bottom tab label: `Network` or `Communities`.
  - Internal route: keep `/community` for now or migrate to `/network` with redirects.

## 3. Required dependency and security work

- Upgrade Next.js and `eslint-config-next` to a patched version verified against the current npm advisory data.
- Upgrade related packages only when compatible with the installed Next.js version.
- Run `npm audit fix` only after reviewing lockfile changes.
- Resolve any remaining high or critical audit findings manually.
- Keep `package.json` and `package-lock.json` synchronized in the same commit.
- Validate the configured CSP against real Supabase auth, storage, realtime, image, and deployment URLs.

## 4. Required code implementation work

- Replace every raw `<img>` with `next/image` or document an explicit exception when Next optimization is not appropriate.
- Add first-login institution selection that blocks app usage until a profile has an institution.
- Add profile institution management under `Profile → Manage → Institution`.
- Filter listings, requests, communities, businesses, and default search by the current institution.
- Add indexes around every new `institution_id` filter path.
- Convert the current communities surface into a true Network experience:
  - followed traders,
  - wishlist,
  - order-ready structure,
  - followed communities,
  - trusted/pinned traders,
  - announcements,
  - events,
  - student clubs,
  - lost and found,
  - marketplace updates.
- Keep the profile page short and move long account controls into collapsible Manage groups.
- Expand marketplace category validation so listings cannot cross category boundaries.
- Add pagination, caching, and lazy loading for feeds, search, messaging, profiles, and business data.

## 5. Required database work

- Apply the institutions migration in staging first.
- Verify that all existing rows backfill to the correct default institution.
- Add RLS policies that prevent cross-institution writes and unintended cross-institution reads.
- Confirm how admin users bypass or manage institution scoping.
- Add migration rollback notes or a recovery plan before production migration.
- Verify indexes with realistic query plans for home feed, search, requests, businesses, communities, and profile pages.

## 6. Required validation checklist

The final production-ready branch should not be considered complete until all of these pass in a fully provisioned environment:

```bash
npm install
npm audit --audit-level=high
npm run lint
npm run type-check
npm run test
npm run build
```

Additional checks required before production:

- Manual sign-up and first-login institution picker test.
- Institution-scoped home feed test.
- Institution-scoped requests test.
- Institution-scoped communities/Network test.
- Institution-scoped businesses test.
- Search default institution test.
- Optional all-institutions search test if enabled.
- Listing image rendering test with Supabase-hosted images.
- Avatar rendering test.
- Upload preview rendering test.
- Messaging performance test.
- PWA install/offline behavior test.
- Mobile, tablet, and desktop responsive review.
- Accessibility keyboard and screen-reader smoke test.
- No dead links or placeholder production content.

## 7. Why the previous attempt could not be fully verified

The previous implementation could not prove a clean build because the execution environment had no installed project dependencies and npm registry/audit access returned `403 Forbidden`. A production-ready verification requires a normal dependency install plus audit access so the lockfile, vulnerability status, lint, type-check, tests, and build all run against the same dependency graph that will be deployed.
