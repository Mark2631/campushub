'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import useUser from '../hooks/useUser';
import { findOrCreateConversation } from '../lib/conversations';

type Props = {
  listingId: string;
  sellerId: string;
};

export default function MessageSellerButton({ listingId, sellerId }: Props) {
  const router = useRouter();
  const { user, loading, pushNotification } = useUser();
  const [status, setStatus] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (!listingId || !sellerId) {
      setStatus('This listing is unavailable for messaging.');
      return;
    }

    if (!user) {
      setNeedsSignIn(true);
      setStatus(null);
      return;
    }

    if (user.id === sellerId) {
      setStatus('You are the seller for this listing.');
      return;
    }

    setBusy(true);
    const { conversation, error } = await findOrCreateConversation(listingId, user.id, sellerId);
    setBusy(false);

    if (error || !conversation) {
      setStatus(error || 'Unable to open conversation. Please try again.');
      return;
    }

    await pushNotification({
      type: 'message',
      title: 'Conversation ready',
      body: 'Your conversation with the seller is open.',
    });
    router.push(`/messages/${conversation.id}`);
  };

  if (loading) {
    return (
      <button className="w-full rounded-2xl bg-blue-600 px-5 py-4 text-sm font-semibold text-white transition opacity-70 cursor-not-allowed">
        Loading...
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleClick}
        className="w-full rounded-2xl bg-blue-600 px-5 py-4 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
        disabled={busy}
      >
        {busy ? 'Opening...' : 'Message Seller'}
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
      {status ? <p className="text-sm text-red-400">{status}</p> : null}
    </div>
  );
}
