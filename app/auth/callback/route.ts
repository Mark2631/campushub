import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const providerError = requestUrl.searchParams.get('error_description') || requestUrl.searchParams.get('error');

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

  const redirectUrl = new URL('/', request.url);
  redirectUrl.searchParams.set('auth_callback', 'success');
  redirectUrl.searchParams.set('access_token', data.session.access_token);
  redirectUrl.searchParams.set('refresh_token', data.session.refresh_token);

  return NextResponse.redirect(redirectUrl);
}
