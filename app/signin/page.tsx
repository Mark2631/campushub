'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from '../../components/Header';
import useUser from '../../hooks/useUser';
import { signInWithMagicLink, signInWithPassword, signOut, signUpWithPassword } from '../../lib/auth';

type AuthMode = 'signin' | 'signup';
type NoticeTone = 'success' | 'error' | 'info';

type Notice = {
  tone: NoticeTone;
  message: string;
};

const rememberedEmailKey = 'campustrader-remembered-email';

function loadRememberedEmail() {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(rememberedEmailKey) ?? '';
}

function NoticeBanner({ notice }: { notice: Notice | null }) {
  if (!notice) return null;

  const toneClasses =
    notice.tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200'
      : notice.tone === 'info'
        ? 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-200'
        : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-200';

  return <div className={`rounded-2xl border px-4 py-3 text-sm ${toneClasses}`}>{notice.message}</div>;
}

function SignInPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, session, loading } = useUser();
  const redirectTo = searchParams.get('next') || '/';
  const callbackError = searchParams.get('error');

  const rememberedEmail = useMemo(() => loadRememberedEmail(), []);
  const [mode, setMode] = useState<AuthMode>('signin');
  const [rememberMe, setRememberMe] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(
    callbackError === 'auth_callback_failed'
      ? { tone: 'error', message: 'Magic link returned, but the session could not be completed. Use password sign-in for now.' }
      : null
  );
  const [googleNotice, setGoogleNotice] = useState<string | null>(null);
  const [signInPending, setSignInPending] = useState(false);
  const [signUpPending, setSignUpPending] = useState(false);
  const [magicLinkPending, setMagicLinkPending] = useState(false);
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showSignUpConfirmPassword, setShowSignUpConfirmPassword] = useState(false);
  const [signInForm, setSignInForm] = useState(() => ({
    email: rememberedEmail,
    password: '',
  }));
  const [signUpForm, setSignUpForm] = useState(() => ({
    fullName: '',
    email: rememberedEmail,
    password: '',
    confirmPassword: '',
  }));
  const [magicLinkEmail, setMagicLinkEmail] = useState(() => rememberedEmail);

  const persistRememberedEmail = (email: string) => {
    if (typeof window === 'undefined') return;

    if (rememberMe && email) {
      window.localStorage.setItem(rememberedEmailKey, email);
      return;
    }

    window.localStorage.removeItem(rememberedEmailKey);
  };

  const resetNotices = () => {
    setNotice(null);
    setGoogleNotice(null);
  };

  const handlePasswordSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (signInPending) return;

    resetNotices();
    setSignInPending(true);

    const email = signInForm.email.trim();
    persistRememberedEmail(email);

    const { error } = await signInWithPassword(email, signInForm.password);
    setSignInPending(false);

    if (error) {
      console.error('Password sign-in error:', error);
      if (error.message.toLowerCase().includes('invalid login credentials')) {
        setNotice({
          tone: 'error',
          message: 'Invalid login credentials. If you just created this account, confirm the email first, then sign in again.',
        });
        return;
      }

      setNotice({ tone: 'error', message: error.message });
      return;
    }

    setNotice({ tone: 'success', message: 'Signed in successfully. Redirecting...' });
    setSignInForm((current) => ({ ...current, password: '' }));
    router.replace(redirectTo);
    router.refresh();
  };

  const handleCreateAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (signUpPending) return;

    resetNotices();

    if (signUpForm.password !== signUpForm.confirmPassword) {
      setNotice({ tone: 'error', message: 'Passwords do not match.' });
      return;
    }

    setSignUpPending(true);
    const email = signUpForm.email.trim();
    persistRememberedEmail(email);

    const { data, error } = await signUpWithPassword(email, signUpForm.password, signUpForm.fullName.trim());
    setSignUpPending(false);

    if (error) {
      console.error('Password sign-up error:', error);
      setNotice({ tone: 'error', message: error.message });
      return;
    }

    if (data.session) {
      setNotice({ tone: 'success', message: 'Account created and signed in. Redirecting...' });
      router.replace('/');
      router.refresh();
      return;
    }

    setNotice({
      tone: 'success',
      message: 'Account created. Check your email if confirmation is required, then sign in.',
    });
    setMode('signin');
    setSignInForm({ email, password: '' });
    setMagicLinkEmail(email);
    setSignUpForm((current) => ({
      ...current,
      password: '',
      confirmPassword: '',
    }));
  };

  const handleMagicLink = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (magicLinkPending) return;

    resetNotices();
    setMagicLinkPending(true);

    const email = magicLinkEmail.trim();
    persistRememberedEmail(email);

    const { error } = await signInWithMagicLink(email);
    setMagicLinkPending(false);

    if (error) {
      console.error('Magic link sign-in error:', error);
      const loweredMessage = error.message.toLowerCase();
      if (loweredMessage.includes('rate limit') || loweredMessage.includes('email rate limit exceeded')) {
        setNotice({
          tone: 'info',
          message: 'Magic link is temporarily rate-limited. Use password sign-in instead.',
        });
        return;
      }

      setNotice({ tone: 'error', message: error.message });
      return;
    }

    setNotice({ tone: 'success', message: 'Magic link sent. Check your email to continue signing in.' });
  };

  const handleSignOut = async () => {
    resetNotices();
    const { error } = await signOut();

    if (error) {
      console.error('Sign out error:', error);
      setNotice({ tone: 'error', message: error.message });
      return;
    }

    router.refresh();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)] pb-24">
        <Header />
        <main className="mx-auto flex w-full max-w-3xl flex-1 items-center px-4 py-8 sm:py-12">
          <div className="w-full rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="h-7 w-44 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
            <div className="mt-4 h-4 w-80 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
          </div>
        </main>
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)] pb-24">
        <Header />
        <main className="mx-auto flex w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">
          <section className="w-full rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200">
              Signed In
            </div>
            <h1 className="mt-5 break-words text-2xl font-black text-slate-950 sm:text-3xl dark:text-white">
              You are already signed in as {session?.user.email ?? user.email ?? user.id}
            </h1>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/"
                className="rounded-2xl bg-gradient-to-r from-blue-600 to-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:from-blue-700 hover:to-emerald-600"
              >
                Go to Home
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-900 transition hover:border-blue-300 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:hover:border-blue-600"
              >
                Sign out
              </button>
            </div>
            <div className="mt-6">
              <NoticeBanner notice={notice} />
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)] pb-24">
      <Header />
      <main className="mx-auto flex w-full max-w-3xl flex-1 px-4 py-8 sm:py-14">
        <section className="w-full rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900">
          <div className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-200">
            Optional Account
          </div>
          <h1 className="mt-5 text-2xl font-black text-slate-950 sm:text-4xl dark:text-white">
            Welcome to CampusTrader
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
            Browse freely. Sign in when you want to post, message, save, verify, or join groups.
          </p>

          <div className="mt-8 grid w-full grid-cols-2 rounded-2xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-950">
            <button
              type="button"
              onClick={() => setMode('signin')}
              className={`rounded-2xl px-3 py-2 text-center text-sm font-semibold transition ${
                mode === 'signin'
                  ? 'bg-white text-slate-950 shadow-sm dark:bg-slate-900 dark:text-white'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={`rounded-2xl px-3 py-2 text-center text-sm font-semibold transition ${
                mode === 'signup'
                  ? 'bg-white text-slate-950 shadow-sm dark:bg-slate-900 dark:text-white'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Create Account
            </button>
          </div>

          <div className="mt-6">
            <NoticeBanner notice={notice} />
          </div>

          {mode === 'signin' ? (
            <form className="mt-6 space-y-4" onSubmit={handlePasswordSignIn}>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Email
                <input
                  type="email"
                  value={signInForm.email}
                  onChange={(event) => setSignInForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="you@example.com"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                  required
                />
              </label>

              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Password
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    type={showSignInPassword ? 'text' : 'password'}
                    value={signInForm.password}
                    onChange={(event) => setSignInForm((current) => ({ ...current, password: event.target.value }))}
                    placeholder="Enter your password"
                    className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignInPassword((current) => !current)}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-300 sm:w-auto dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-600"
                  >
                    {showSignInPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600"
                />
                <span>Remember my email on this device</span>
              </label>

              <button
                type="submit"
                disabled={signInPending}
                className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:from-blue-700 hover:to-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {signInPending ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={handleCreateAccount}>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Full name
                <input
                  type="text"
                  value={signUpForm.fullName}
                  onChange={(event) => setSignUpForm((current) => ({ ...current, fullName: event.target.value }))}
                  placeholder="Your full name"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                  required
                />
              </label>

              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Email
                <input
                  type="email"
                  value={signUpForm.email}
                  onChange={(event) => setSignUpForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="you@example.com"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                  required
                />
              </label>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Password
                    <div className="mt-2 flex flex-col gap-2">
                      <input
                        type={showSignUpPassword ? 'text' : 'password'}
                        value={signUpForm.password}
                        onChange={(event) => setSignUpForm((current) => ({ ...current, password: event.target.value }))}
                        placeholder="Create a password"
                        className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignUpPassword((current) => !current)}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-600"
                      >
                        {showSignUpPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </label>

                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Confirm password
                    <div className="mt-2 flex flex-col gap-2">
                      <input
                        type={showSignUpConfirmPassword ? 'text' : 'password'}
                        value={signUpForm.confirmPassword}
                        onChange={(event) =>
                          setSignUpForm((current) => ({ ...current, confirmPassword: event.target.value }))
                        }
                        placeholder="Confirm password"
                        className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignUpConfirmPassword((current) => !current)}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-600"
                      >
                        {showSignUpConfirmPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </label>
                </div>

              <button
                type="submit"
                disabled={signUpPending}
                className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:from-blue-700 hover:to-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {signUpPending ? 'Creating account...' : 'Create account'}
              </button>
            </form>
          )}

          <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
              Temporarily unavailable / rate-limited
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Magic link may be temporarily limited. Password sign-in is recommended.
            </p>
            <form className="mt-4 space-y-4" onSubmit={handleMagicLink}>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Email for magic link
                <input
                  type="email"
                  value={magicLinkEmail}
                  onChange={(event) => setMagicLinkEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                  required
                />
              </label>

              <button
                type="submit"
                disabled={magicLinkPending}
                className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-semibold text-blue-800 transition hover:border-blue-300 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-200 dark:hover:border-blue-800 dark:hover:bg-blue-950/60"
              >
                {magicLinkPending ? 'Sending magic link...' : 'Send magic link'}
              </button>
            </form>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-6 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setGoogleNotice('Google sign-in will be enabled later.')}
              className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:border-blue-300 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:hover:border-blue-600"
            >
              Continue with Google
            </button>
            {googleNotice ? (
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{googleNotice}</p>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)] pb-24">
          <Header />
          <main className="mx-auto flex w-full max-w-3xl flex-1 items-center px-4 py-12">
            <div className="w-full rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="h-7 w-44 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
              <div className="mt-4 h-4 w-80 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
            </div>
          </main>
        </div>
      }
    >
      <SignInPageContent />
    </Suspense>
  );
}
