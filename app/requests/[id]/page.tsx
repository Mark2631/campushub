'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Header from '../../../components/Header';
import BottomNav from '../../../components/BottomNav';
import useUser from '../../../hooks/useUser';
import { getItemRequestById, type ItemRequest } from '../../../lib/itemRequests';

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading } = useUser();
  const [request, setRequest] = useState<ItemRequest | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let active = true;
    void getItemRequestById(id).then(({ request, error }) => {
      if (!active) return;
      setRequest(request);
      setError(error);
      setFetching(false);
    });
    return () => { active = false; };
  }, [id]);

  async function messageRequester() {
    if (!request || !user || starting || user.id === request.user_id) return;
    setStarting(true);
    const result = await findOrCreateConversationForRequest(request.id);
    setStarting(false);
    if (result.error || !result.conversation) {
      setError(result.error || 'Unable to start a conversation.');
      return;
    }
    router.push(`/messages/${result.conversation.id}`);
  }

  return <div className="min-h-screen bg-[var(--background)] pb-24 text-[var(--foreground)] dark:bg-[var(--background)] dark:text-[var(--foreground)]">
    <Header />
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/#campus-requests" className="text-sm font-semibold text-[var(--brand)]">← Campus requests</Link>
      {fetching ? <p className="mt-8">Loading request…</p> : !request ? <p className="mt-8">{error || 'This request is unavailable.'}</p> : (
        <article className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 dark:border-[var(--border)] dark:bg-[var(--surface)]">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--brand)]">Student request · {request.category}</p>
          <h1 className="mt-2 text-2xl font-bold">{request.title}</h1>
          <p className="mt-4 whitespace-pre-wrap text-[var(--muted)] dark:text-[var(--foreground)]">{request.description || 'No additional details provided.'}</p>
          <p className="mt-4 text-sm">Location: {request.location || 'Not specified'}</p>
          {request.max_price != null ? <p className="mt-2 text-sm">Maximum budget: KSh {Number(request.max_price).toLocaleString('en-KE')}</p> : null}
          {error ? <p role="alert" className="mt-4 text-sm text-red-600">{error}</p> : null}
          {loading ? <p className="mt-6 text-sm">Checking your session…</p> : !user ? (
            <Link href={`/signin?next=${encodeURIComponent(`/requests/${id}`)}`} className="mt-6 inline-block rounded-xl bg-[var(--brand)] px-5 py-3 font-semibold text-white">Sign in to message</Link>
          ) : user.id === request.user_id ? <p className="mt-6 text-sm text-[var(--muted)]">This is your request.</p> : (
            <button type="button" onClick={messageRequester} disabled={starting} className="mt-6 rounded-xl bg-[var(--brand)] px-5 py-3 font-semibold text-white disabled:opacity-50">{starting ? 'Opening chat…' : 'Message requester'}</button>
          )}
        </article>
      )}
    </main>
    <BottomNav />
  </div>;
}

async function findOrCreateConversationForRequest(requestId: string) {
  // Request conversations are stored without a listing association.
  // Dedicated RPC enforces the request's institution and authenticated sender.
  const { supabase } = await import('../../../lib/supabase');
  const { data, error } = await supabase.rpc('start_request_conversation', { p_request_id: requestId });
  if (error) return { conversation: null, error: 'Unable to open request chat. Please try again.' };
  const conversationId = typeof data === 'string' ? data : data?.conversation_id;
  return conversationId ? { conversation: { id: conversationId }, error: null } : { conversation: null, error: 'Request chat unavailable.' };
}
