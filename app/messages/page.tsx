'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import Image from 'next/image';
import Header from '../../components/Header';
import BottomNav from '../../components/BottomNav';
import SafetyBanner from '../../components/SafetyBanner';
import useUser from '../../hooks/useUser';
import { getUserConversations, hideConversationForUser } from '../../lib/conversations';

type ConversationSummary = {
  id: string;
  listingTitle: string;
  listingId: string;
  otherUser: {
    id: string;
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
  };
  unreadCount: number;
  lastMessage: {
    id: string;
    content: string;
    created_at: string;
    sender_id: string;
  } | null;
};

function profileName(profile: ConversationSummary['otherUser']) {
  return profile.full_name || profile.email?.split('@')[0] || 'CampusTrader user';
}

function Avatar({ profile }: { profile: ConversationSummary['otherUser'] }) {
  const name = profileName(profile);
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--brand)] text-sm font-bold text-white">
      {profile.avatar_url ? (
        <Image src={profile.avatar_url} alt="" width={48} height={48} className="h-full w-full object-cover" />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </div>
  );
}

export default function MessagesPage() {
  const { user, loading, showToast } = useUser();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const loadConversations = async () => {
      setFetching(true);
      const { conversations, error } = await getUserConversations(user.id);
      setFetching(false);

      if (error) {
        setError(error);
        return;
      }

      setConversations(conversations);
    };

    loadConversations();
  }, [user]);

  const handleDeleteConversation = async (conversationId: string) => {
    if (!user || deletingId) return;

    setDeletingId(conversationId);
    const { error } = await hideConversationForUser(conversationId, user.id);
    setDeletingId(null);

    if (error) {
      console.error('Conversation delete failed:', error);
      showToast({ type: 'error', message: error });
      return;
    }

    setConversations((current) => current.filter((conversation) => conversation.id !== conversationId));
    showToast({ type: 'success', message: 'Conversation removed.' });
  };

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)] pb-24 dark:bg-[var(--background)] dark:text-[var(--foreground)]">
      <Header />
      <div className="sticky top-[65px] z-30 bg-[var(--brand)] text-white shadow-sm sm:top-[73px]">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:py-3">
          <span className="text-base sm:text-lg">🛡️</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Safety First</p>
            <p className="text-xs text-white/75 truncate">Meet in public. Do not pay before inspection. Verify seller profile.</p>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-6xl mx-auto px-4 py-8 w-full">
        <header className="mb-8 mt-2">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand)] dark:text-[var(--brand)]">Your inbox</p>
          <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
          <p className="mt-2 text-sm text-[var(--muted)] dark:text-[var(--muted)]">Keep buying and selling conversations in one place.</p>
        </header>

        <div className="mb-6">
          <SafetyBanner compact />
        </div>

        {loading || fetching ? (
          <div className="rounded-2xl border border-[var(--border)] dark:border-[var(--border)] bg-[var(--surface)] dark:bg-[var(--surface)] p-12 text-center text-[var(--muted)] dark:text-[var(--muted)]">
            <div className="h-12 w-12 rounded-full border-2 border-[var(--border)] dark:border-[var(--border)] border-t-[var(--brand)] animate-spin mx-auto mb-4" />
            <p>Loading conversations...</p>
          </div>
        ) : !user ? (
          <div className="rounded-2xl border-2 border-[var(--border)] dark:border-[var(--border)] bg-[var(--surface)] dark:bg-[var(--surface)] p-12 text-center text-[var(--muted)] dark:text-[var(--muted)]">
            <p className="mb-3 text-2xl font-bold text-[var(--foreground)] dark:text-[var(--foreground)]">Sign in to continue.</p>
            <p className="mx-auto mb-6 max-w-md text-[var(--muted)] dark:text-[var(--muted)]">
              Browsing is free. Create an account only when you want to post, message, save, verify, or join groups.
            </p>
            <div className="mx-auto grid max-w-sm grid-cols-2 gap-3">
              <Link href="/signin?next=/messages" className="rounded-2xl bg-[var(--brand)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-strong)]">
                Create account
              </Link>
              <Link href="/signin?next=/messages&mode=signin" className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-6 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--brand)] dark:border-[var(--border)] dark:bg-[var(--background)] dark:text-[var(--foreground)]">
                Sign in
              </Link>
            </div>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-8 text-red-700 dark:text-red-200">
            <p className="font-semibold">Unable to load conversations.</p>
            <p className="text-sm mt-1">Try refreshing the page.</p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-[var(--border)] dark:border-[var(--border)] bg-[var(--surface)] dark:bg-[var(--surface)] p-12 text-center text-[var(--muted)] dark:text-[var(--muted)]">
            <p className="mb-2 text-lg font-semibold text-[var(--foreground)] dark:text-[var(--foreground)]">No messages yet.</p>
            <p className="mb-2">Your buyer and seller conversations will appear here.</p>
            <p className="mb-6 text-sm">Start a chat from any listing when you are ready to negotiate or ask questions.</p>
            <Link href="/" className="inline-block rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-strong)] px-6 py-3 text-sm font-semibold text-white transition">
              Browse Listings
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <article className="rounded-3xl border border-[var(--border)]/80 bg-[var(--surface)] p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-lg sm:p-5 dark:border-[var(--border)] dark:bg-[var(--surface)] dark:hover:border-[var(--brand)]">
                  <div className="flex items-center justify-between gap-4">
                    <Link href={`/messages/${conversation.id}`} className="flex min-w-0 flex-1 items-center gap-4">
                      <Avatar profile={conversation.otherUser} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-semibold text-[var(--foreground)] dark:text-[var(--foreground)]">{profileName(conversation.otherUser)}</p>
                          <span className="text-xs text-gray-400">•</span>
                          <p className="truncate text-xs text-[var(--muted)] dark:text-[var(--muted)]">{conversation.listingTitle}</p>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)] dark:text-[var(--muted)]">
                          {conversation.lastMessage?.content || 'No messages yet'}
                        </p>
                      </div>
                    </Link>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-xs text-[var(--muted)] dark:text-[var(--muted)] whitespace-nowrap">
                        {conversation.lastMessage ? new Date(conversation.lastMessage.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                      {conversation.unreadCount > 0 ? (
                        <div className="min-w-6 rounded-full bg-[var(--brand)] px-2 py-1 text-center text-xs font-semibold text-white">
                          {conversation.unreadCount}
                        </div>
                      ) : null}
                      <button
                        type="button"
                        aria-label="Remove conversation"
                        onClick={() => handleDeleteConversation(conversation.id)}
                        disabled={deletingId === conversation.id}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted)] transition hover:border-red-300 hover:text-red-600 disabled:opacity-60 dark:border-[var(--border)] dark:text-[var(--muted)] dark:hover:border-red-900 dark:hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
