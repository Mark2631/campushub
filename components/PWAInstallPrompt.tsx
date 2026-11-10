'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const INSTALL_DISMISS_KEY = 'campustrader_install_dismissed';
const INSTALL_DISMISS_TTL = 1000 * 60 * 60 * 24 * 7;

function readDismissedRecently() {
  try {
    const stored = window.localStorage.getItem(INSTALL_DISMISS_KEY);
    if (!stored) return false;
    const timestamp = Number(stored);
    return Number.isFinite(timestamp) && Date.now() - timestamp < INSTALL_DISMISS_TTL;
  } catch {
    return false;
  }
}

function recordDismissed() {
  try {
    window.localStorage.setItem(INSTALL_DISMISS_KEY, Date.now().toString());
  } catch {
    // Installation remains available even when storage is blocked.
  }
}

function isStandalone() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

function isIosDevice() {
  if (typeof navigator === 'undefined') return false;
  const userAgent = navigator.userAgent || '';
  const iPadOS = /Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/i.test(userAgent) || iPadOS;
}

export default function PWAInstallPrompt() {
  const [ready, setReady] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(readDismissedRecently);
  const [installed, setInstalled] = useState(isStandalone);
  const [manualOpen, setManualOpen] = useState(false);
  const [ios] = useState(isIosDevice);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.error('Service worker registration failed:', error);
      });
    }

    const readyFrame = window.requestAnimationFrame(() => setReady(true));

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
      setManualOpen(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.cancelAnimationFrame(readyFrame);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installEvent) {
      setManualOpen((current) => !current);
      return;
    }

    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === 'accepted') {
        setInstalled(true);
        setManualOpen(false);
      }
      setInstallEvent(null);
    } catch (error) {
      console.error('PWA install prompt failed:', error);
      setManualOpen(true);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    setManualOpen(false);
    recordDismissed();
  };

  if (!ready || installed || dismissed) return null;

  return (
    <aside className="fixed inset-x-3 bottom-24 z-[55] mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-slate-800 dark:bg-slate-950" aria-label="Install CampusTrader">
      <div className="flex items-center gap-3">
        <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
          <Download className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-950 dark:text-white">Install CampusTrader</p>
          <p className="text-xs text-slate-600 dark:text-slate-400">Keep the marketplace one tap away.</p>
        </div>
        <button type="button" onClick={handleInstall} className="min-h-10 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-700">
          {installEvent ? 'Install' : 'How to install'}
        </button>
        <button type="button" onClick={handleDismiss} aria-label="Dismiss install prompt" className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {manualOpen ? (
        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700 dark:bg-slate-900 dark:text-slate-300">
          <p className="font-semibold text-slate-900 dark:text-white">Add CampusTrader to your home screen</p>
          {ios ? (
            <p className="mt-1">Open this page in Safari, tap Share, then choose <strong>Add to Home Screen</strong>.</p>
          ) : (
            <p className="mt-1">Open your browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>. On desktop, use the install control in the address bar when it appears.</p>
          )}
        </div>
      ) : null}
    </aside>
  );
}
