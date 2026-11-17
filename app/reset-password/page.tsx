'use client';

import { useState } from 'react';
import Link from 'next/link';
import Header from '../../components/Header';
import { updatePassword } from '../../lib/auth';

type Notice = {
  type: 'success' | 'error';
  text: string;
};

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;

    setNotice(null);

    if (password.length < 6) {
      setNotice({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }

    if (password !== confirmPassword) {
      setNotice({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    setPending(true);
    const { error } = await updatePassword(password);
    setPending(false);

    if (error) {
      console.error('Password update failed:', error);
      setNotice({ type: 'error', text: 'Something went wrong. Try again.' });
      return;
    }

    setPassword('');
    setConfirmPassword('');
    setNotice({ type: 'success', text: 'Password updated successfully. You can sign in with your new password.' });
  };

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)] pb-24 text-[var(--foreground)]">
      <Header />
      <main className="mx-auto flex w-full max-w-2xl flex-1 items-center px-4 py-8 sm:py-12">
        <section className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm sm:p-8 dark:border-[var(--border)] dark:bg-[var(--surface)]">
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand)] dark:text-[var(--brand)]">Account recovery</p>
          <h1 className="mt-3 text-2xl font-semibold text-[var(--foreground)] sm:text-3xl dark:text-[var(--foreground)]">Reset your password</h1>
          <p className="mt-2 text-sm text-[var(--muted)] dark:text-[var(--muted)]">Enter a new password for your CampusTrader account.</p>

          {notice ? (
            <div
              className={`mt-6 rounded-2xl border p-4 text-sm ${
                notice.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200'
                  : 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200'
              }`}
            >
              {notice.text}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block text-sm font-medium text-[var(--foreground)] dark:text-[var(--muted)]">
              New password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--foreground)] outline-none focus:border-[var(--brand)] dark:border-[var(--border)] dark:bg-[var(--background)] dark:text-[var(--foreground)]"
                required
              />
            </label>
            <label className="block text-sm font-medium text-[var(--foreground)] dark:text-[var(--muted)]">
              Confirm password
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--foreground)] outline-none focus:border-[var(--brand)] dark:border-[var(--border)] dark:bg-[var(--background)] dark:text-[var(--foreground)]"
                required
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-2xl bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? 'Updating password...' : 'Update password'}
            </button>
          </form>

          <Link href="/signin" className="mt-5 inline-block text-sm font-semibold text-[var(--brand)] hover:text-[var(--brand)] dark:text-[var(--brand)] dark:hover:text-[var(--brand)]">
            Back to sign in
          </Link>
        </section>
      </main>
    </div>
  );
}
