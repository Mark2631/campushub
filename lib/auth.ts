import { supabase } from './supabase';
import { normalizeKenyanPhone } from './phoneValidation';

export async function signInWithPassword(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

function getSafeRedirectPath(value?: string | null) {
  if (!value) return undefined;
  const path = String(value);
  if (path.startsWith('/') && !path.startsWith('//')) return path;
  return undefined;
}

export async function signUpWithPassword(email: string, password: string, fullName: string, phone?: string, next?: string) {
  const safeNext = getSafeRedirectPath(next);
  // Always use the origin the user is currently visiting. A stale development
  // redirect URL can make Supabase reject an otherwise valid signup in production.
  const redirectOrigin = typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || '';
  const redirectTo = redirectOrigin
    ? `${redirectOrigin}/auth/callback?mode=signin${safeNext ? `&next=${encodeURIComponent(safeNext)}` : ''}`
    : undefined;

  const normalizedPhone = phone?.trim() ? normalizeKenyanPhone(phone) : null;

  return supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        ...(normalizedPhone ? { phone_number: normalizedPhone } : {}),
      },
      emailRedirectTo: redirectTo,
    },
  });
}

export async function signInWithGoogle(next?: string) {
  if (typeof window === 'undefined') {
    return { data: null, error: new Error('Google sign-in is only available in the browser.') };
  }

  const callbackUrl = new URL(`${window.location.origin}/auth/callback`);
  const safeNext = getSafeRedirectPath(next);
  if (safeNext) {
    callbackUrl.searchParams.set('next', safeNext);
  }

  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callbackUrl.toString(),
    },
  });
}

export async function sendPasswordResetEmail(email: string) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined,
  });
}

export async function updatePassword(password: string) {
  return supabase.auth.updateUser({ password });
}

export async function getCurrentUser() {
  return supabase.auth.getUser();
}

export async function signOut() {
  return supabase.auth.signOut();
}
