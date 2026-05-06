'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useUser from '../hooks/useUser';
import { findOrCreateConversation } from '../lib/conversations';

type Props = {
  listingId: string;
  sellerId: string;
};

export default function MessageSellerButton({ listingId, sellerId }: Props) {
  const router = useRouter();
  const { user, loading } = useUser();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (listingId.startsWith('mock-')) {
      setStatus('This is demo marketplace data. Real messaging opens once the listing comes from your live database.');
      return;
    }

    if (!user) {
      router.push(`/signin?next=${encodeURIComponent(`/listing/${listingId}`)}`);
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
      {status ? <p className="text-sm text-red-400">{status}</p> : null}
    </div>
  );
}
