import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/signin?error=auth_callback_failed', request.url));
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
    return NextResponse.redirect(new URL('/signin?error=auth_callback_failed', request.url));
  }

  const redirectUrl = new URL('/', request.url);
  redirectUrl.searchParams.set('auth_callback', 'success');
  redirectUrl.searchParams.set('access_token', data.session.access_token);
  redirectUrl.searchParams.set('refresh_token', data.session.refresh_token);

  return NextResponse.redirect(redirectUrl);
}
