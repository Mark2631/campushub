# Google OAuth production configuration

The OAuth consent screen branding is configured in Google Cloud, not in this codebase. If Google shows `hnhhednibexcfwfizawy.supabase.co`, complete these manual steps:

1. Google Cloud Console → Google Auth Platform → Branding
   - App name: `CampusTrader`
   - Support email: the project support email
   - App logo: the CampusTrader logo
2. Google Auth Platform → Audience
   - Configure the intended audience.
   - Add test users if the app is still in testing mode.
3. Google Auth Platform → Clients
   - Use a Web OAuth client only.
   - Authorized JavaScript origin: `https://campus-trader.vercel.app`
   - Authorized redirect URI: `https://hnhhednibexcfwfizawy.supabase.co/auth/v1/callback`
4. Supabase Dashboard → Authentication → Providers → Google
   - Enable Google.
   - Add the Web OAuth client ID.
   - Add the Web OAuth client secret.
5. Supabase Dashboard → Authentication → URL Configuration
   - Site URL: `https://campus-trader.vercel.app`
   - Allowed redirect URLs must include `https://campus-trader.vercel.app/auth/callback`.

Never commit the Google client secret, Supabase service-role key, or private API keys to Git or expose them through `NEXT_PUBLIC_` variables.
