'use client';

import Link from 'next/link';
import { X } from 'lucide-react';

type Props = {
  open: boolean;
  next: string;
  onClose: () => void;
};

export default function AuthPromptModal({ open, next, onClose }: Props) {
  if (!open) return null;

  const nextParam = encodeURIComponent(next);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Create a free account to join the conversation.</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
              Browsing is free. Create an account only when you want to post, message, save, verify, or join groups.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Link
            href={`/signin?next=${nextParam}`}
            className="rounded-2xl bg-blue-600 px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-blue-700"
          >
            Create account
          </Link>
          <Link
            href={`/signin?next=${nextParam}&mode=signin`}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-bold text-slate-900 transition hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:hover:border-blue-600"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
