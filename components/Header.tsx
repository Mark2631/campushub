"use client";

import { useState } from 'react';
import Link from 'next/link';
import { Bell, Settings, X } from 'lucide-react';
import useUser from '../hooks/useUser';
import Logo from './Logo';
import SettingsPanel from './SettingsPanel';
import { institutionLabel, normalizeInstitution, SUPPORTED_INSTITUTIONS } from '../lib/validation';

export default function Header() {
  const {
    user,
    loading,
    isAdmin,
    notifications,
    unreadNotifications,
    markAllNotificationsRead,
    deleteNotification,
    clearNotifications,
    institution,
    setInstitution,
  } = useUser();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const userLabel = user?.email ? user.email : 'Signed in';
  const avatar = user?.email ? user.email.charAt(0).toUpperCase() : 'U';

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0 flex-1 sm:flex-none">
            <div className="sm:hidden">
              <Logo compact />
            </div>
            <div className="hidden sm:block">
              <Logo />
            </div>
          </div>

          <div className="hidden items-center gap-2 sm:flex">
            <label htmlFor="institution-select" className="sr-only">
              Choose institution
            </label>
            <select
              id="institution-select"
              value={institution}
              onChange={(event) => setInstitution(normalizeInstitution(event.target.value))}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition hover:border-blue-300 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
            >
              {SUPPORTED_INSTITUTIONS.map((option) => (
                <option key={option} value={option}>
                  {institutionLabel(option)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {user ? (
              <div className="relative">
                <button
                  aria-label="Notifications"
                  onClick={() => {
                    setNotificationsOpen((current) => !current);
                    if (!notificationsOpen && unreadNotifications > 0) {
                      void markAllNotificationsRead();
                    }
                  }}
                  className="relative inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-600"
                >
                  <Bell className="h-5 w-5" aria-hidden="true" />
                  {unreadNotifications > 0 ? (
                    <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {unreadNotifications}
                    </span>
                  ) : null}
                </button>

                {notificationsOpen ? (
                  <div className="fixed right-3 top-16 z-[60] w-[calc(100vw-1.5rem)] max-w-sm rounded-2xl border border-slate-200 bg-white p-3 shadow-xl sm:absolute sm:right-0 sm:top-14 sm:w-80 dark:border-slate-800 dark:bg-slate-950">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">Notifications</p>
                      <div className="flex items-center gap-1">
                        {notifications.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => void clearNotifications()}
                            className="rounded-xl px-2 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/40"
                          >
                            Clear all
                          </button>
                        ) : null}
                        <button
                          aria-label="Close notifications"
                          onClick={() => setNotificationsOpen(false)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900"
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    <div className="max-h-72 space-y-2 overflow-y-auto">
                      {notifications.length > 0 ? (
                        notifications.map((notification) => (
                          <div key={notification.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex items-start gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">{notification.type}</p>
                                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{notification.title}</p>
                                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{notification.body}</p>
                              </div>
                              <button
                                type="button"
                                aria-label="Delete notification"
                                onClick={() => void deleteNotification(notification.id)}
                                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-200 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                              >
                                <X className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                          No notifications yet.
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            <button
              aria-label="Settings"
              onClick={() => setSettingsOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-600"
            >
              <Settings className="h-5 w-5" aria-hidden="true" />
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
                  <span className="hidden rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700 sm:inline dark:bg-emerald-900/40 dark:text-emerald-200">
                    ADMIN
                  </span>
                ) : null}
              </Link>
            ) : (
              <Link
                href="/signin?mode=signin"
                className="rounded-2xl bg-gradient-to-r from-slate-600 to-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:from-blue-700 hover:to-emerald-600 sm:px-6"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>
      <div aria-hidden="true" className="h-[65px] sm:h-[73px]" />

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
