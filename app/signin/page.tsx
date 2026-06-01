'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from '../../components/Header';
import useUser from '../../hooks/useUser';
import { sendPasswordResetEmail, signInWithGoogle, signInWithPassword, signUpWithPassword } from '../../lib/auth';
import { ensureProfile } from '../../lib/profiles';

type AuthMode = 'signup' | 'signin';
type Notice = { tone: 'success' | 'error' | 'info'; message: string };

const rememberedEmailKey = 'campustrader-remembered-email';

function rememberedEmail() {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(rememberedEmailKey) ?? '';
}

function NoticeBanner({ notice }: { notice: Notice | null }) {
  if (!notice) return null;

  const classes =
    notice.tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200'
      : notice.tone === 'info'
        ? 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-200'
        : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-200';

  return <div className={`rounded-2xl border px-4 py-3 text-sm break-words ${classes}`}>{notice.message}</div>;
}

function appendWelcome(path: string) {
  if (path !== '/') return path;
  return '/?welcome=1';
}

function friendlyAuthMessage(fallback: string) {
  return fallback;
}

function SignInPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, refreshSession, showToast } = useUser();
  const next = searchParams.get('next') || '/';
  const callbackError = searchParams.get('error');
  const requestedMode = searchParams.get('mode');
  const initialEmail = useMemo(() => rememberedEmail(), []);
  const [mode, setMode] = useState<AuthMode>(requestedMode === 'signin' ? 'signin' : 'signup');
  const [notice, setNotice] = useState<Notice | null>(
    callbackError
      ? { tone: 'error', message: 'Something went wrong. Try again.' }
      : null
  );
  const [signupPending, setSignupPending] = useState(false);
  const [signinPending, setSigninPending] = useState(false);
  const [resetPending, setResetPending] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [signupForm, setSignupForm] = useState({
    fullName: '',
    email: initialEmail,
    password: '',
    confirmPassword: '',
  });
  const [signinForm, setSigninForm] = useState({
    email: initialEmail,
    password: '',
  });
  const [resetEmail, setResetEmail] = useState(initialEmail);

  useEffect(() => {
    if (!loading && user) {
      router.replace('/');
    }
  }, [loading, router, user]);

  const persistEmail = (email: string) => {
    if (typeof window !== 'undefined' && email) {
      window.localStorage.setItem(rememberedEmailKey, email);
    }
  };

  const completeAuth = async (message: string, destination = next) => {
    await refreshSession();
    setNotice({ tone: 'success', message });
    router.replace(message === 'Welcome to CampusTrader.' ? appendWelcome(destination) : destination);
    router.refresh();
  };

  const handleCreateAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (signupPending) return;

    setNotice(null);
    const email = signupForm.email.trim();
    const fullName = signupForm.fullName.trim();

    if (signupForm.password !== signupForm.confirmPassword) {
      showToast({ type: 'error', message: 'Passwords do not match.' });
      setNotice({ tone: 'error', message: 'Passwords do not match.' });
      return;
    }

    setSignupPending(true);
    persistEmail(email);

    const signup = await signUpWithPassword(email, signupForm.password, fullName);

    if (signup.error) {
      setSignupPending(false);
      console.error('Signup failed:', signup.error);
      const message = friendlyAuthMessage('Unable to create account. Check your details and try again.');
      showToast({ type: 'error', message });
      setNotice({ tone: 'error', message });
      return;
    }

    if (signup.data.session) {
      await ensureProfile(signup.data.session.user);
      setSignupPending(false);
      showToast({ type: 'success', message: 'Welcome to CampusTrader.' });
      await completeAuth('Welcome to CampusTrader.');
      return;
    }

    const signin = await signInWithPassword(email, signupForm.password);
    setSignupPending(false);

    if (signin.error || !signin.data.session) {
      if (signin.error) console.error('Post-signup sign-in failed:', signin.error);
      const message = friendlyAuthMessage('Account created, but sign-in did not complete. Try signing in with your password.');
      showToast({ type: 'error', message });
      setNotice({
        tone: 'error',
        message,
      });
      setMode('signin');
      setSigninForm({ email, password: '' });
      return;
    }

    await ensureProfile(signin.data.session.user);
    showToast({ type: 'success', message: 'Welcome to CampusTrader.' });
    await completeAuth('Welcome to CampusTrader.');
  };

  const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (signinPending) return;

    setNotice(null);
    setSigninPending(true);
    const email = signinForm.email.trim();
    persistEmail(email);

    const { data, error } = await signInWithPassword(email, signinForm.password);
    setSigninPending(false);

    if (error || !data.session) {
      if (error) console.error('Sign-in failed:', error);
      const message = friendlyAuthMessage('Unable to sign in. Review your email and password.');
      showToast({ type: 'error', message });
      setNotice({ tone: 'error', message });
      return;
    }

    await ensureProfile(data.session.user);
    showToast({ type: 'success', message: 'Signed in successfully.' });
    await completeAuth('Signed in successfully.', next);
  };

  const handleGoogle = async () => {
    setNotice(null);
    const { error } = await signInWithGoogle();
    if (error) {
      console.error('Google sign-in failed:', error);
      const message = 'Something went wrong. Try again.';
      showToast({ type: 'error', message });
      setNotice({ tone: 'error', message });
    }
  };

  const handleReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (resetPending) return;

    setNotice(null);
    setResetPending(true);
    const email = resetEmail.trim();
    persistEmail(email);
    const { error } = await sendPasswordResetEmail(email);
    setResetPending(false);

    if (error) {
      console.error('Password reset failed:', error);
      const message = friendlyAuthMessage('Something went wrong. Try again.');
      showToast({ type: 'error', message });
      setNotice({ tone: 'error', message });
      return;
    }

    setNotice({ tone: 'success', message: 'Password reset email sent.' });
    showToast({ type: 'success', message: 'Password reset email sent.' });
  };

  if (user) {
    return (
      <div className="flex min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)]">
        <Header />
        <main className="mx-auto flex w-full max-w-3xl flex-1 items-center px-4 py-10">
          <div className="w-full rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="h-7 w-44 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
            <div className="mt-4 h-4 w-72 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)]">
      <Header />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center overflow-x-hidden px-4 py-8 sm:py-12">
        <section className="w-full min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-black text-slate-950 sm:text-3xl dark:text-white">
                {mode === 'signup' ? 'Join CampusTrader' : 'Sign in'}
              </h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {mode === 'signup'
                  ? 'Buy, sell, and message students around campus.'
                  : 'Welcome back.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'signup' ? 'signin' : 'signup');
                setNotice(null);
              }}
              className="shrink-0 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-blue-600 transition hover:border-blue-300 dark:border-slate-800 dark:bg-slate-950 dark:text-blue-300"
            >
              {mode === 'signup' ? 'Sign in' : 'Create account'}
            </button>
          </div>

          <NoticeBanner notice={notice} />

          <button
            type="button"
            onClick={handleGoogle}
            className="mt-6 flex w-full flex-wrap items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-black text-slate-950 dark:bg-slate-950 dark:text-white">G</span>
            <span>Continue with Google</span>
          </button>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">or use email</span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
          </div>

          {mode === 'signup' ? (
            <form className="space-y-4" onSubmit={handleCreateAccount}>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Full name
                <input
                  type="text"
                  value={signupForm.fullName}
                  onChange={(event) => setSignupForm((current) => ({ ...current, fullName: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-blue-500 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                  required
                />
              </label>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Email
                <input
                  type="email"
                  value={signupForm.email}
                  onChange={(event) => setSignupForm((current) => ({ ...current, email: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-blue-500 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                  required
                />
              </label>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Password
                <input
                  type="password"
                  value={signupForm.password}
                  onChange={(event) => setSignupForm((current) => ({ ...current, password: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-blue-500 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                  required
                />
              </label>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Confirm password
                <input
                  type="password"
                  value={signupForm.confirmPassword}
                  onChange={(event) => setSignupForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-blue-500 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                  required
                />
              </label>
              <button
                type="submit"
                disabled={signupPending}
                className="w-full rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {signupPending ? 'Creating account...' : 'Create account'}
              </button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={handleSignIn}>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Email
                <input
                  type="email"
                  value={signinForm.email}
                  onChange={(event) => setSigninForm((current) => ({ ...current, email: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-blue-500 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                  required
                />
              </label>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Password
                <input
                  type="password"
                  value={signinForm.password}
                  onChange={(event) => setSigninForm((current) => ({ ...current, password: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-blue-500 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                  required
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  setResetOpen((current) => !current);
                  setResetEmail(signinForm.email);
                  setNotice(null);
                }}
                className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-slate-700"
              >
                Forgot password?
              </button>
              <button
                type="submit"
                disabled={signinPending}
                className="w-full rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {signinPending ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
          )}

          {resetOpen ? (
            <form className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950" onSubmit={handleReset}>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Reset password</p>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Email
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(event) => setResetEmail(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                  required
                />
              </label>
              <button
                type="submit"
                disabled={resetPending}
                className="w-full rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              >
                {resetPending ? 'Sending reset email...' : 'Send reset email'}
              </button>
            </form>
          ) : null}
        </section>
      </main>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--background)]" />}>
      <SignInPageContent />
    </Suspense>
  );
}
