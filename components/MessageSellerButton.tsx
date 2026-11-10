'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import useUser from '../hooks/useUser';
import { findOrCreateConversation } from '../lib/conversations';
import { isValidUuid } from '../lib/validation';
import AuthPromptModal from './AuthPromptModal';

type Props = {
  listingId: string;
  sellerId: string;
};

export default function MessageSellerButton({ listingId, sellerId }: Props) {
  const router = useRouter();
  const { user, loading } = useUser();
  const [status, setStatus] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const handleClick = async () => {
    if (busyRef.current) return;
    if (!isValidUuid(listingId) || !isValidUuid(sellerId)) {
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

    busyRef.current = true;
    setBusy(true);
    try {
      const { conversation, error } = await findOrCreateConversation(listingId, user.id, sellerId);

      if (error || !conversation) {
      if (error) console.error('Conversation open failed:', error);
        setStatus('Unable to open conversation. Please try again.');
        return;
      }

      router.push(`/messages/${conversation.id}`);
    } catch (error) {
      console.error('Unexpected conversation navigation failure:', error);
      setStatus('Unable to open conversation. Please try again.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
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
        <AuthPromptModal open={needsSignIn} next={`/listing/${listingId}`} onClose={() => setNeedsSignIn(false)} />
      ) : null}
      {status ? <p className="text-sm text-red-400">{status}</p> : null}
    </div>
  );
}
