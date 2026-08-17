import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSafeRedirectPath(value: string | null) {
  if (!value) return '/';

  try {
    const decoded = decodeURIComponent(value);
    if (!decoded.startsWith('/') || decoded.startsWith('//')) return '/';
    return decoded;
  } catch {
    return '/';
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const mode = requestUrl.searchParams.get('mode');
  const providerError = requestUrl.searchParams.get('error_description') || requestUrl.searchParams.get('error');
  const nextPath = getSafeRedirectPath(requestUrl.searchParams.get('next'));

  if (!code) {
    const redirectUrl = new URL('/signin', request.url);
    redirectUrl.searchParams.set('error', providerError || 'Auth callback did not include a session code.');
    return NextResponse.redirect(redirectUrl);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    console.error('Auth callback exchange error:', error);
    const redirectUrl = new URL('/signin', request.url);
    redirectUrl.searchParams.set('error', error?.message || 'Auth callback did not return a session.');
    return NextResponse.redirect(redirectUrl);
  }

  // Pass tokens via URL hash fragment — NOT query params.
  // Hash fragments are never sent to the server in HTTP requests,
  // so they won't appear in server logs, analytics, or referrer headers.
  const destination = mode === 'signin' ? nextPath : `${nextPath}${nextPath.includes('?') ? '&' : '?'}welcome=1`;
  const redirectUrl = new URL(destination, request.url);
  const hashParams = new URLSearchParams({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    type: 'auth_callback',
  });

  return NextResponse.redirect(`${redirectUrl.toString()}#${hashParams.toString()}`);
}
