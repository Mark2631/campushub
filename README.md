# CampusTrader

CampusTrader is a campus commerce marketplace for trust-first C2C trading between students and nearby registered businesses.

## Vision

CampusTrader helps students buy, sell, discover services, and coordinate safe trades inside a campus-first marketplace. The platform is designed around inspection before payment, in-app messaging, manual verification, and community groups instead of anonymous public feeds.

## Problem Solved

Campus buyers and sellers often rely on scattered chats, status updates, and unverified accounts. That makes discovery messy and trust difficult. CampusTrader centralizes listings, seller messaging, safety reporting, verification workflows, and community groups in one campus commerce hub.

## Target Users

- Students selling or buying used items, food, services, books, electronics, fashion, furniture, and refurbished goods.
- Nearby registered businesses that serve campus communities.
- Campus admins and moderators who need simple tools for verification and safety review.

## Current MVP

- Home discovery with search, category chips, and Supabase-powered listing sections.
- Sell flow with Supabase Auth guard, image/video upload to the public `listing-media` bucket, and Kenyan Shilling pricing.
- Listing details with media gallery, seller messaging, reporting, and safety notice.
- In-app messaging with conversation creation, message sending, and safety warning terms.
- Profile page with account info, verification request UI, active listings count, and business profile creation.
- Community tab modeled after WhatsApp Communities with controlled groups and responsive prepared-state modals.
- Admin dashboard for manual verification, business approval, listing moderation, reports, complaints, and user visibility.

## Core Categories

Electronics, Fashion, Furniture, Books, Food, Services, Refurbished, Other.

## Safety Model

CampusTrader encourages users to:

- Meet in public.
- Inspect before paying.
- Avoid advance payments.
- Keep conversations in-app early in the transaction.
- Report scams, fake listings, harassment, unsafe meetup requests, wrong categories, and other issues.

## Payment Placeholder

Payments are not active in this MVP. A future-ready fallback contact is reserved for manual M-Pesa coordination: `0745706087`.

Future payment support may include:

- M-Pesa Paybill.
- Buy Goods/Till.
- STK Push.
- Escrow or protected payments.

## Future Roadmap

- Stronger verification flows for students, national ID, and businesses.
- Business subscriptions.
- Boosted listings.
- M-Pesa Paybill and Buy Goods/Till support.
- Optional escrow or protected payments.
- AI moderation for listings, reports, and risky chat behavior.
- Campus expansion and multi-campus discovery.
- Predictive marketplace insights.
- Persistent community groups, memberships, and admin notices.

## Setup

```bash
npm install
cp .env.local.example .env.local
```

Add these environment variables to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

## Development

```bash
npm run dev
```

Open `http://localhost:3000`.

## Environment

The app expects Supabase environment variables in `.env.local` and uses the client in `lib/supabase.ts`.

Required variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Required storage buckets:

- `listing-media`, public.
- `profile-media`, public.
- `verification-media`, public.

## Deployment Notes

Before deployment:

1. Run the SQL in [supabase/final-required-policies.sql](supabase/final-required-policies.sql) in the Supabase SQL Editor.
2. Add these environment variables in Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
3. Add your deployed Vercel URL to the Supabase Auth redirect URLs.
4. Confirm the public storage buckets exist:
   - `listing-media`
   - `profile-media`
   - `verification-media`
