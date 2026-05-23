'use client';

import { useState } from 'react';
import useUser from '../hooks/useUser';
import AuthPromptModal from './AuthPromptModal';

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
    setMessage('Saved items are coming soon. You can revisit this listing from your browser history.');
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
        <AuthPromptModal open={needsSignIn} next={`/listing/${listingId}`} onClose={() => setNeedsSignIn(false)} />
      ) : null}
      {message ? <p className="text-sm text-gray-600 dark:text-zinc-400">{message}</p> : null}
    </div>
  );
}
