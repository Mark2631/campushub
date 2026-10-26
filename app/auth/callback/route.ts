import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSafeRedirectPath(value: string | null, origin: string) {
  if (!value) return '/';

  try {
    const decoded = decodeURIComponent(value);
    if (
      !decoded.startsWith('/') ||
      decoded.startsWith('//') ||
      decoded.includes('\\\\') ||
      /[\\u0000-\\u001f]/.test(decoded)
    ) {
      return '/';
    }

    const redirect = new URL(decoded, origin);
    if (redirect.origin !== origin) return '/';
    return `${redirect.pathname}${redirect.search}${redirect.hash}`;
  } catch {
    return '/';
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const providerError = requestUrl.searchParams.get('error_description') || requestUrl.searchParams.get('error');
  const nextPath = getSafeRedirectPath(requestUrl.searchParams.get('next'), requestUrl.origin);

  if (!code) {
    const redirectUrl = new URL('/signin', request.url);
    redirectUrl.searchParams.set('error', providerError || 'Auth callback did not include a session code.');
    return NextResponse.redirect(redirectUrl);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    console.error('Auth callback exchange error:', error);
    const redirectUrl = new URL('/signin', request.url);
    redirectUrl.searchParams.set('error', error?.message || 'Auth callback did not return a session.');
    return NextResponse.redirect(redirectUrl);
  }

  const redirectUrl = new URL(nextPath, request.url);
  redirectUrl.searchParams.set('auth_callback', 'success');

  // Keep bearer credentials out of query strings, request logs, and referrer
  // headers. The browser client consumes the one-time fragment and then strips
  // it from the address bar; legacy query-token handling remains for in-flight
  // redirects created by an older deployment.
  const sessionFragment = new URLSearchParams({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    token_type: 'bearer',
    expires_in: String(data.session.expires_in),
    ...(data.session.expires_at ? { expires_at: String(data.session.expires_at) } : {}),
  });
  redirectUrl.hash = sessionFragment.toString();

  return NextResponse.redirect(redirectUrl);
}
