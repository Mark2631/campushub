import { supabase } from './supabase';

function appOrigin() {
  if (typeof window !== 'undefined') return window.location.origin;
  return process.env.NEXT_PUBLIC_APP_URL || 'https://campus-trader.vercel.app';
}

function authRedirect(path: string) {
  return `${appOrigin()}${path}`;
}

export async function signInWithPassword(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithPassword(email: string, password: string, fullName: string) {
  return supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
      emailRedirectTo: authRedirect('/auth/callback?mode=signin'),
    },
  });
}

export async function signInWithGoogle(next = '/') {
  if (typeof window === 'undefined') {
    return { data: null, error: new Error('Google sign-in is only available in the browser.') };
  }

  const redirectTo = authRedirect(`/auth/callback?next=${encodeURIComponent(next || '/')}`);

  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account',
      },
    },
  });
}

export async function exchangeOAuthCodeForSession(code: string) {
  return supabase.auth.exchangeCodeForSession(code);
}

export async function sendPasswordResetEmail(email: string) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: authRedirect('/reset-password'),
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
