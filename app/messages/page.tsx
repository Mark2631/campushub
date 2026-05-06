'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '../../components/Header';
import BottomNav from '../../components/BottomNav';
import SafetyBanner from '../../components/SafetyBanner';
import useUser from '../../hooks/useUser';
import { getUserConversations } from '../../lib/conversations';

type ConversationSummary = {
  id: string;
  listingTitle: string;
  listingId: string;
  lastMessage: {
    id: string;
    content: string;
    created_at: string;
    sender_id: string;
  } | null;
};

export default function MessagesPage() {
  const { user, loading } = useUser();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

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

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:bg-gradient-to-br dark:from-black dark:to-zinc-950 text-gray-900 dark:text-white pb-24">
      {/* Fixed Safety Banner */}
      <div className="sticky top-[57px] z-30 bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg dark:from-blue-700 dark:to-blue-800 sm:top-[65px]">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:py-3">
          <span className="text-base sm:text-lg">🛡️</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Safety First</p>
            <p className="text-xs text-blue-100 truncate">Meet in public. Do not pay before inspection. Verify seller profile.</p>
          </div>
        </div>
      </div>

      <Header />
      <main className="flex-1 max-w-6xl mx-auto px-4 py-8 w-full">
        <header className="mb-8 mt-2">
          <h1 className="text-3xl font-bold">Messages</h1>
          <p className="text-sm text-gray-600 dark:text-zinc-400 mt-2">Keep your conversations organized and secure.</p>
        </header>

        <div className="mb-6">
          <SafetyBanner compact />
        </div>

        {loading || fetching ? (
          <div className="rounded-2xl border border-gray-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-12 text-center text-gray-600 dark:text-zinc-400">
            <div className="h-12 w-12 rounded-full border-2 border-gray-300 dark:border-zinc-700 border-t-blue-500 animate-spin mx-auto mb-4" />
            <p>Loading conversations...</p>
          </div>
        ) : !user ? (
          <div className="rounded-2xl border-2 border-gray-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-12 text-center text-gray-600 dark:text-zinc-400">
            <p className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Sign in to view your messages</p>
            <Link href="/signin" className="inline-block rounded-2xl bg-blue-600 hover:bg-blue-700 px-6 py-3 text-sm font-semibold text-white transition">
              Sign In
            </Link>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-8 text-red-700 dark:text-red-200">
            <p className="font-semibold">Error loading conversations</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-12 text-center text-gray-600 dark:text-zinc-400">
            <p className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">No conversations yet</p>
            <p className="mb-2">Your buyer and seller conversations will appear here.</p>
            <p className="mb-6 text-sm">Start a chat from any listing when you are ready to negotiate or ask questions.</p>
            <Link href="/" className="inline-block rounded-2xl bg-blue-600 hover:bg-blue-700 px-6 py-3 text-sm font-semibold text-white transition">
              Browse Listings
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <Link
                  href={`/messages/${conversation.id}`}
                  className="block rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 transition hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-lg dark:hover:shadow-blue-500/10"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">{conversation.listingTitle}</p>
                      <p className="text-sm text-gray-600 dark:text-zinc-400 mt-1 line-clamp-2">
                        {conversation.lastMessage?.content || 'No messages yet'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-xs text-gray-500 dark:text-zinc-500 whitespace-nowrap">
                        {conversation.lastMessage ? new Date(conversation.lastMessage.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                      <div className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-xs font-semibold text-blue-700 dark:text-blue-300">
                        {conversation.lastMessage ? '1 unread' : 'New'}
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
