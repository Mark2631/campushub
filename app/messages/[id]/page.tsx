'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '../../../components/Header';
import BottomNav from '../../../components/BottomNav';
import ReportButton from '../../../components/ReportButton';
import useUser from '../../../hooks/useUser';
import { getConversationById, Message, sendMessage } from '../../../lib/conversations';

type Props = {
  params: {
    id: string;
  };
};

type ConversationDetails = {
  id: string;
  listingId: string;
  listingTitle: string;
  messages: Message[];
  buyerId: string;
  sellerId: string;
};

const riskyTerms = ['whatsapp', 'deposit', 'send money', 'pay first', 'delivery fee', 'call me', 'outside app'];

export default function ConversationPage({ params }: Props) {
  const { user, loading, pushNotification } = useUser();
  const [conversation, setConversation] = useState<ConversationDetails | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const showWarning = riskyTerms.some((term) => messageText.toLowerCase().includes(term));

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const { conversation, error } = await getConversationById(params.id, user.id);
      if (error || !conversation) {
        setError(error || 'Conversation not found.');
        return;
      }
      setConversation(conversation);
      setMessages(conversation.messages || []);
    };

    load();
  }, [user, params.id]);

  const handleSend = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!messageText.trim() || !user || !conversation) return;
    setSending(true);
    const { error } = await sendMessage(conversation.id, user.id, messageText.trim());

    if (error) {
      setSending(false);
      setError(error);
      return;
    }

    setMessageText('');
    const refreshed = await getConversationById(conversation.id, user.id);
    setSending(false);

    if (refreshed.error || !refreshed.conversation) {
      setError(refreshed.error || 'Message sent, but the conversation could not reload.');
      return;
    }

    setConversation(refreshed.conversation);
    setMessages(refreshed.conversation.messages || []);
    await pushNotification({
      type: 'message',
      title: 'Message sent',
      body: 'Your message was sent successfully.',
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-gradient-to-br from-gray-50 to-gray-100 dark:bg-gradient-to-br dark:from-black dark:to-zinc-950 text-gray-900 dark:text-white pb-24">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4 py-8">
          <div className="h-12 w-12 rounded-full border-2 border-gray-300 dark:border-zinc-700 border-t-blue-500 animate-spin" />
        </main>
        <BottomNav />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col bg-gradient-to-br from-gray-50 to-gray-100 dark:bg-gradient-to-br dark:from-black dark:to-zinc-950 text-gray-900 dark:text-white pb-24">
        <Header />
        <main className="flex-1 px-4 py-8">
          <div className="rounded-2xl border-2 border-gray-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center">
            <h2 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white">Sign in to view messages</h2>
            <p className="text-gray-600 dark:text-zinc-400">You must be signed in to read and send messages.</p>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-gray-50 to-gray-100 dark:bg-gradient-to-br dark:from-black dark:to-zinc-950 text-gray-900 dark:text-white pb-24">
      <Header />

      <main className="flex-1 max-w-5xl mx-auto px-4 py-8 w-full">
        <header className="mb-6">
          <Link href="/messages" className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-semibold mb-4">
            ← Back to Messages
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Chat</h1>
        </header>

        {error ? (
          <div className="rounded-2xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6 text-red-700 dark:text-red-200">
            <p className="font-semibold">{error}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Listing Reference Card */}
            <div className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 p-5">
              <p className="text-sm text-blue-700 dark:text-blue-300 font-semibold">About this listing</p>
              <p className="mt-2 text-lg font-bold text-blue-900 dark:text-blue-100">{conversation?.listingTitle || 'Listing'}</p>
              {conversation?.listingId ? (
                <Link href={`/listing/${conversation.listingId}`} className="mt-2 inline-block text-sm font-semibold text-blue-700 underline dark:text-blue-200">
                  View listing
                </Link>
              ) : <p className="mt-2 text-sm text-blue-700 dark:text-blue-200">Listing reference is unavailable.</p>}
            </div>

            {/* Messages Container */}
            <div className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4 min-h-96 max-h-96 overflow-y-auto">
              {messages.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-zinc-400 py-8">No messages yet. Send the first message to start the conversation.</p>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender_id === user.id ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs rounded-2xl px-4 py-3 ${
                        message.sender_id === user.id
                          ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white'
                          : 'bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-white'
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                      <p className={`mt-2 text-xs ${message.sender_id === user.id ? 'text-blue-100' : 'text-gray-500 dark:text-zinc-500'}`}>
                        {new Date(message.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Message Form */}
            <form onSubmit={handleSend} className="space-y-4">
              <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300">
                Send a message
              </label>
              {showWarning ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                  Be careful. Avoid moving outside the app too early or paying before inspection.
                </div>
              ) : null}
              <div className="flex gap-3">
                <textarea
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  rows={2}
                  className="flex-1 resize-none rounded-2xl bg-white dark:bg-zinc-950 border border-gray-300 dark:border-zinc-700 px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Write your message..."
                />
                <button
                  type="submit"
                  disabled={sending || !messageText.trim()}
                  className="rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 px-6 py-3 text-sm font-semibold text-white transition self-end"
                >
                  {sending ? '⏳' : '📤'}
                </button>
              </div>
              {conversation ? <ReportButton targetType="message" targetId={conversation.id} label="Report conversation" /> : null}
            </form>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
