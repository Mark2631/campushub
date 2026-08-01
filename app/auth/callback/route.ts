import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const providerError = requestUrl.searchParams.get('error_description') || requestUrl.searchParams.get('error');
  const next = requestUrl.searchParams.get('next') || '/';
  const redirectUrl = new URL('/signin', request.url);

  if (providerError) {
    redirectUrl.searchParams.set('error', providerError);
    return NextResponse.redirect(redirectUrl);
  }

  if (!code) {
    redirectUrl.searchParams.set('error', 'Authentication callback did not include a session code.');
    return NextResponse.redirect(redirectUrl);
  }

  redirectUrl.searchParams.set('code', code);
  redirectUrl.searchParams.set('oauth_callback', '1');
  redirectUrl.searchParams.set('next', next);

  return NextResponse.redirect(redirectUrl);
}
