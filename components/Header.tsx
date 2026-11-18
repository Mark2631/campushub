"use client";

import { useState } from 'react';
import Link from 'next/link';
import { Bell, Settings, Users, X, MapPin, ChevronDown } from 'lucide-react';
import useUser from '../hooks/useUser';
import Logo from './Logo';
import SettingsPanel from './SettingsPanel';
import { institutionLabel, normalizeInstitution, SUPPORTED_INSTITUTIONS } from '../lib/validation';

export default function Header() {
  const { user, loading, isAdmin, notifications, unreadNotifications, markAllNotificationsRead, deleteNotification, clearNotifications, institution, setInstitution } = useUser();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const userLabel = user?.email || 'Your account';
  const avatar = user?.email ? user.email.charAt(0).toUpperCase() : 'U';

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[66px] max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <div className="shrink-0"><Logo compact /></div>

          <div className="hidden min-w-0 flex-1 items-center justify-center gap-7 lg:flex">
            <Link href="/categories" className="text-[13px] font-semibold text-[var(--foreground)] transition hover:text-[var(--brand)]">Shop</Link>
            <Link href="/community" className="text-[13px] font-semibold text-[var(--muted)] transition hover:text-[var(--brand)]">Community</Link>
            <Link href="/help" className="text-[13px] font-semibold text-[var(--muted)] transition hover:text-[var(--brand)]">How it works</Link>
            <Link href="/sell" className="text-[13px] font-bold text-[var(--brand)] transition hover:text-[var(--brand-strong)]">Sell</Link>
            {user ? <Link href="/messages" className="text-[13px] font-semibold text-[var(--muted)] transition hover:text-[var(--brand)]">Inbox</Link> : null}
          </div>

          <div className="hidden shrink-0 md:flex">
            <label htmlFor="institution-select" className="sr-only">Choose your campus</label>
            <div className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--background)] px-3 py-2">
              <MapPin className="h-3.5 w-3.5 text-[var(--brand)]" aria-hidden="true" />
              <select id="institution-select" value={institution} onChange={(event) => setInstitution(normalizeInstitution(event.target.value))} className="max-w-[170px] bg-transparent text-xs font-semibold text-[var(--foreground)] outline-none">
                {SUPPORTED_INSTITUTIONS.map((option) => <option key={option} value={option}>{institutionLabel(option)}</option>)}
              </select>
              <ChevronDown className="h-3 w-3 text-[var(--muted)]" aria-hidden="true" />
            </div>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Link href="/community" aria-label="Campus community" title="Community" className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--brand)] lg:hidden">
              <Users className="h-[18px] w-[18px]" aria-hidden="true" />
            </Link>
            {user ? (
              <div className="relative">
                <button aria-label="Notifications" aria-expanded={notificationsOpen} onClick={() => { setNotificationsOpen((current) => !current); if (!notificationsOpen && unreadNotifications > 0) void markAllNotificationsRead(); }} className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--brand)]">
                  <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
                  {unreadNotifications > 0 ? <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#D97735] ring-2 ring-[var(--surface)]" /> : null}
                </button>
                {notificationsOpen ? (
                  <div className="absolute right-0 top-12 z-[80] w-[min(360px,calc(100vw-24px))] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[0_18px_60px_rgba(13,30,20,.16)]">
                    <div className="mb-2 flex items-center justify-between gap-3 px-1">
                      <p className="text-sm font-bold text-[var(--foreground)]">Notifications</p>
                      <div className="flex items-center gap-1">
                        {notifications.length > 0 ? <button type="button" onClick={() => void clearNotifications()} className="rounded-lg px-2 py-1 text-xs font-semibold text-[var(--brand)] hover:bg-[var(--brand-soft)]">Clear all</button> : null}
                        <button aria-label="Close notifications" onClick={() => setNotificationsOpen(false)} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-muted)]"><X className="h-4 w-4" /></button>
                      </div>
                    </div>
                    <div className="max-h-80 space-y-2 overflow-y-auto">
                      {notifications.length ? notifications.map((notification) => (
                        <div key={notification.id} className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-3">
                          <div className="flex items-start gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--brand)]">{notification.type}</p>
                              <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{notification.title}</p>
                              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{notification.body}</p>
                            </div>
                            <button type="button" aria-label="Delete notification" onClick={() => void deleteNotification(notification.id)} className="rounded-lg p-1 text-[var(--muted)] hover:bg-[var(--surface-muted)]"><X className="h-3.5 w-3.5" /></button>
                          </div>
                        </div>
                      )) : <p className="rounded-xl bg-[var(--background)] p-4 text-center text-sm text-[var(--muted)]">You are all caught up.</p>}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            <button aria-label="Settings" title="Settings" onClick={() => setSettingsOpen(true)} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--brand)]"><Settings className="h-[18px] w-[18px]" aria-hidden="true" /></button>
            {loading ? <span className="h-9 w-9 animate-pulse rounded-full bg-[var(--surface-muted)]" /> : user ? (
              <Link href="/profile" title={userLabel} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--brand-soft)] text-xs font-bold text-[var(--brand)] transition hover:border-[var(--brand)] sm:h-10 sm:w-10">
                {avatar}<span className="sr-only">{userLabel}{isAdmin ? ', admin' : ''}</span>
              </Link>
            ) : <Link href="/signin?mode=signin" className="rounded-full bg-[var(--brand)] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[var(--brand-strong)] sm:px-5 sm:text-sm">Sign in</Link>}
          </div>
        </div>
      </header>
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
