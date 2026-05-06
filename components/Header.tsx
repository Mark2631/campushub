'use client';

import { useState } from 'react';
import Link from 'next/link';
import useUser from '../hooks/useUser';
import Logo from './Logo';
import SettingsPanel from './SettingsPanel';

export default function Header() {
  const { user, loading, isAdmin } = useUser();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const userLabel = user?.email ? user.email : 'Signed in';
  const avatar = user?.email ? user.email.charAt(0).toUpperCase() : 'U';

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0 flex-1 sm:flex-none">
            <div className="sm:hidden">
              <Logo compact />
            </div>
            <div className="hidden sm:block">
              <Logo />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => setSettingsOpen(true)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-black uppercase tracking-wide text-slate-700 transition hover:border-blue-300 sm:px-4 sm:text-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-600"
            >
              Settings
            </button>
            {loading ? (
              <div className="h-10 w-10 animate-pulse rounded-2xl bg-slate-200 sm:w-32 dark:bg-slate-800" />
            ) : user ? (
              <Link
                href="/profile"
                className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-2 py-2 text-sm text-slate-900 transition hover:border-blue-300 sm:gap-3 sm:px-4 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:hover:border-blue-600"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 text-xs font-bold text-white">
                  {avatar}
                </span>
                <span className="hidden max-w-[10rem] truncate font-medium sm:inline md:max-w-[12rem]">{userLabel}</span>
                {isAdmin ? (
                  <span className="hidden rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-700 sm:inline dark:bg-emerald-900/40 dark:text-emerald-200">
                    ADMIN
                  </span>
                ) : null}
              </Link>
            ) : (
              <Link href="/signin" className="rounded-2xl bg-gradient-to-r from-blue-600 to-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:from-blue-700 hover:to-emerald-600 sm:px-6">
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
