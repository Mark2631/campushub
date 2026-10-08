'use client';

import Link from 'next/link';
import { signOut } from '../lib/auth';
import Logo from './Logo';
import useTheme from '../hooks/useTheme';
import useUser from '../hooks/useUser';

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function SettingsPanel({ open, onClose }: Props) {
  const { user, isAdmin } = useUser();
  const { theme, toggleTheme } = useTheme();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 px-3 py-4 backdrop-blur-sm sm:px-4 sm:py-8" onClick={onClose}>
      <div
        className="mx-auto flex max-h-[calc(100vh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950 sm:max-h-[calc(100vh-4rem)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="overflow-y-auto p-4 sm:p-6">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <Logo compact />
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Manage</h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Account, orders, and help</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            >
              Close
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{user ? 'Signed in as' : 'Account'}</p>
            <p className="mt-2 break-words text-sm font-semibold text-slate-900 dark:text-white">{user?.email || 'Not signed in'}</p>
            {isAdmin ? (
              <p className="mt-2 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                Admin badge
              </p>
            ) : null}
          </div>

          <div className="mt-5 space-y-3">
            <button
              onClick={toggleTheme}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left text-sm font-semibold text-slate-900 transition hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            >
              <span>Theme</span>
              <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{theme === 'dark' ? 'Dark' : 'Light'}</span>
            </button>

            <Link href="/profile" onClick={onClose} className="block rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-900 transition hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900 dark:text-white">
              Profile
            </Link>

            <Link href="/profile" onClick={onClose} className="block rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-900 transition hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900 dark:text-white">
              Manage account
            </Link>

            <Link href="/orders" onClick={onClose} className="block rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4 text-sm font-semibold text-blue-800 transition hover:border-blue-300 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100">
              Orders & transactions
            </Link>

            <Link href="/help" onClick={onClose} className="block rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-900 transition hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900 dark:text-white">
              Help &amp; support
            </Link>

            {isAdmin ? (
              <Link href="/admin" onClick={onClose} className="block rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 dark:border-emerald-900/60 dark:bg-emerald-900/20 dark:text-emerald-200">
                Admin Panel
              </Link>
            ) : null}

            {user ? (
              <button
                onClick={async () => {
                  await signOut();
                  onClose();
                }}
                className="w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-left text-sm font-semibold text-red-700 transition hover:border-red-300 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-200"
              >
                Sign out
              </button>
            ) : (
              <Link href="/signin?mode=signin" onClick={onClose} className="block rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-900 transition hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900 dark:text-white">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
