'use client';

import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const INSTALL_DISMISS_KEY = 'campustrader_install_dismissed';
const INSTALL_DISMISS_TTL = 1000 * 60 * 60 * 24 * 7; // 7 days

function isDismissedRecently() {
  if (typeof window === 'undefined') return true;
  const stored = window.localStorage.getItem(INSTALL_DISMISS_KEY);
  if (!stored) return false;
  const timestamp = Number(stored);
  return Number.isFinite(timestamp) && Date.now() - timestamp < INSTALL_DISMISS_TTL;
}

function recordDismissed() {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(INSTALL_DISMISS_KEY, Date.now().toString());
}

export default function PWAInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => isDismissedRecently());
  const promptedThisSession = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('Service worker registration failed:', error);
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      if (isDismissedRecently() || promptedThisSession.current) return;
      setInstallEvent(event as BeforeInstallPromptEvent);
      promptedThisSession.current = true;
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstall = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
    setDismissed(true);
    recordDismissed();
  };

  const handleDismiss = () => {
    setInstallEvent(null);
    setDismissed(true);
    recordDismissed();
  };

  if (!installEvent || dismissed) return null;

  return (
    <div className="fixed inset-x-3 bottom-24 z-50 mx-auto max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-2xl">
      <div className="flex items-center gap-3">
        <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand)] text-white">
          <Download className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-950 dark:text-white">Install CampusTrader</p>
          <p className="text-xs text-slate-600 dark:text-slate-400">Add the marketplace to your home screen.</p>
        </div>
        <button
          type="button"
          onClick={handleInstall}
          className="rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-extrabold text-[var(--foreground)] transition hover:brightness-95"
        >
          Install
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-xl px-3 py-2 text-xs font-semibold text-[var(--muted)] transition hover:bg-[var(--surface-muted)]"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
