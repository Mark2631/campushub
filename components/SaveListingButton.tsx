'use client';

import Link from 'next/link';
import { useState } from 'react';
import useUser from '../hooks/useUser';

export default function SaveListingButton({ listingId }: { listingId: string }) {
  const { user, loading } = useUser();
  const [message, setMessage] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);

  const handleSave = async () => {
    if (!user) {
      setNeedsSignIn(true);
      setMessage(null);
      return;
    }

    setNeedsSignIn(false);
    setMessage('Saved items are being prepared. This listing is still available from your browser history.');
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={loading}
        onClick={handleSave}
        className="w-full rounded-2xl border border-gray-300 bg-white px-5 py-4 text-sm font-semibold text-gray-900 transition hover:bg-gray-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
      >
        Save
      </button>
      {needsSignIn ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
          <p className="font-bold">Sign in to continue.</p>
          <p className="mt-1 text-blue-800 dark:text-blue-200">
            Browsing is free. Create an account only when you want to post, message, save, verify, or join groups.
          </p>
          <Link
            href={`/signin?next=${encodeURIComponent(`/listing/${listingId}`)}`}
            className="mt-3 inline-block rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-blue-700"
          >
            Sign In
          </Link>
        </div>
      ) : null}
      {message ? <p className="text-sm text-gray-600 dark:text-zinc-400">{message}</p> : null}
    </div>
  );
}
