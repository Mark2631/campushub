# CampusTrader

CampusTrader is a MUST-focused campus marketplace for Meru University of Science and Technology students and nearby businesses. It helps students discover local deals, list items and services, post requests, message safely, and follow official campus communities.

The current launch scope is intentionally narrow: CampusTrader is for MUST first. Multi-campus expansion and payments are planned for later, but they are not active in this build.

## Product Focus

- Default campus: `MUST`
- Audience: MUST students, student sellers, nearby businesses, and marketplace admins
- Core promise: find campus deals you can inspect before paying
- Safety stance: meet in public, inspect first, avoid advance payments, and keep early conversation in-app

## Main Features

- Home discovery with search, category filters, safety messaging, and a clear account CTA for guests.
- Sell tab with three focused sections: sell an item/service, post a request, and a short selling guide.
- Requests inside the Sell tab so buyers can post what they are looking for without cluttering Home.
- Profile as a clean identity and marketplace summary page, with settings moved into a focused modal.
- Persistent profile photos through the public `profile-media` bucket and `profiles.avatar_url`.
- Messages with the other user's identity, listing context, unread counts, and clean guest prompts.
- MUST Communities with official groups, useful links, group posting modes, comments, reactions, and admin moderation.
- Admin dashboard for verification, reports, listing moderation, business review, business post payment review, complaints, admin invites, and community management.
- Manual business post review: businesses pay KSh 60 to Till `6362615` (`Newton Mwangi`), then admins approve the post before it goes live.
- PWA metadata, app icons, favicon, Apple touch icon, and Open Graph preview assets.

## Communities

Communities are official MUST groups. Admins create and manage the groups, but each group has a posting mode:

- `everyone`: signed-in users can create group posts, comment, and react.
- `admin_only`: admins create official posts; signed-in users can still comment and react.

Default communities:

- MUST Marketplace Updates
- Campus Deals
- Lost & Found
- Services Around Campus
- School Updates & Useful Links

Admins can create communities, choose posting mode, publish and pin posts, upload media, archive communities, hide posts, and moderate comments. Guests can view active communities and posts. Guests are prompted to create a free account before following, posting, commenting, or reacting.

## Useful MUST Links

The Community tab includes quick links for:

- MUST official website
- MUST student portal
- MUST service center
- MUST library
- MUST LMS / eLearning
- Okoa Sem
- Studocu
- Nation
- Tuko

External links open in a new tab with `rel="noopener noreferrer"`.

## Security Model

Client code never assumes user input is safe. Form fields, UUIDs, enum-like values, and uploads are validated before Supabase calls. User-facing errors stay clean, while technical details are logged with `console.error`.

Important rules:

- Service role keys must never be exposed in the client.
- Normal users cannot perform admin actions.
- Admin actions check the `admins` table.
- Users can only update their own profile, listings, messages, and membership actions.
- Listings are hidden or marked sold instead of hard-deleted from client flows.
- Uploads validate file type and size before storage writes.
- Raw Supabase errors should not be rendered to users.

## Supabase Setup

Required environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Required public storage buckets:

- `listing-media`
- `profile-media`
- `verification-media`
- `community-media`

Run the SQL in Supabase after the core policy scripts:

```text
supabase/final-required-policies.sql
supabase/must-community-launch.sql
supabase/final-launch-polish.sql
```

`supabase/must-community-launch.sql` creates or aligns the community tables, seeds official MUST communities, adds campus defaults where safe, creates the `community-media` bucket, and adds RLS policies for guests, authenticated users, and admins.

`supabase/final-launch-polish.sql` adds the final launch columns and policies for email trust status, business post payment review, conversation hiding, public marketplace seller views, community posting mode enforcement, admin invites, and community media uploads.

Auth note: if Supabase Auth email confirmation is enabled, users must confirm through the email link before password sign-in succeeds. If you want users to access the app before email confirmation, disable "Confirm email" in Supabase Auth settings; the app will still record `profiles.email_verified` when Supabase marks the email as confirmed.

## Local Development

Install dependencies:

```bash
npm install
```

Start the app:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Build Checks

Before launch, run:

```bash
npm run build
npx tsc --noEmit
```

Manual smoke checks:

- Home loads and shows listings or a polished empty state.
- Services category works.
- Sell opens directly to the listing form.
- Requests are inside Sell.
- Profile is clean and Settings holds secondary actions.
- Verified users do not see repeated verification forms.
- Profile photo persists after upload and refresh.
- Messages show the other user's avatar/name and listing context.
- Community groups load, open cleanly, and respect posting mode.
- Signed-in users can post in open communities; admins can remove posts.
- Admin can create communities, upload cover images, and moderate posts.
- Business posts stay pending until payment review is approved.
- Guests can view communities but must sign in to participate.
- PWA icons and Open Graph image use the current logo.

## Deployment Notes

- Add the Supabase environment variables to the deployment platform.
- Add the deployed URL to Supabase Auth redirect URLs.
- Confirm storage buckets and policies exist.
- Confirm the `admins` table contains the approved admin email addresses.
- Confirm the Open Graph image and app icons are reachable from production URLs.

## Not Active Yet

Full checkout, escrow, protected payments, and M-Pesa STK Push are not active yet. This build only includes manual business-post payment review for KSh 60 posts. Future monetization work may include business verification fees, boosted listings, featured business cards, vendor subscriptions, urgent request boosts, sponsored category/community placements, protected payments, escrow, M-Pesa STK Push, and premium seller badges.

Multi-university expansion is also not active yet. The code and schema are prepared around the `campus` default, but users do not choose campuses in the current MUST launch.
