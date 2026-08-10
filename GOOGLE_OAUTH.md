Google OAuth configuration (manual steps)

1) Branding
- Open Google Cloud Console → OAuth & APIs → OAuth consent screen (Auth platform).
- App name: CampusTrader
- Support email: use project support email (e.g., team@campustrader.example)
- App logo: upload CampusTrader logo (square, 512x512 recommended)
- Save and publish the consent screen when ready.

2) Create Web OAuth Client
- Go to Credentials → Create Credentials → OAuth client ID → Web application
- Name: CampusTrader (Web)
- Authorized JavaScript origins:
  - https://campus-trader.vercel.app
- Authorized redirect URIs (exact):
  - https://<your-supabase-project>.supabase.co/auth/v1/callback
    (Replace <your-supabase-project> with your Supabase project host — e.g., hnhhednibexcfwfizawy.supabase.co)
- Save and copy Client ID and Client Secret.

3) Supabase provider setup
- In Supabase Dashboard → Authentication → Providers → Google
- Enable Google provider
- Paste the Web OAuth Client ID and Client Secret (do NOT use client secret in frontend)
- Ensure the Site URL / Allowed redirect URLs include the production callback and app URL.
  - Site URL: https://campus-trader.vercel.app
  - Make sure the Supabase project settings have the correct Site URL.

4) Vercel / Environment variables
- In Vercel Project settings → Environment Variables, set:
  - NEXT_PUBLIC_SUPABASE_URL = https://<your-project>.supabase.co
  - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = <your-supabase-public-key>
  - (Optional) NEXT_PUBLIC_SUPABASE_ANON_KEY = <anon-key>
  - Do NOT add GOOGLE_CLIENT_SECRET or SUPABASE_SERVICE_ROLE_KEY to NEXT_PUBLIC_*; add them only as server-only secrets.

5) Testing
- Add test users in Google Auth if the OAuth consent screen is in testing mode.
- Try signing in via the app; Supabase will redirect to the Supabase callback and then back to the app's `/auth/callback` route.

Notes:
- The screenshot where Google shows the Supabase host indicates the OAuth consent branding was not set in Google Cloud; complete Branding steps above.
- The Supabase callback (`/auth/v1/callback`) must be present as the Authorized redirect URI in Google Cloud.
