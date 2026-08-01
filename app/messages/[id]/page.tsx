'use client';

import { use, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Send, Trash2 } from 'lucide-react';
import Header from '../../../components/Header';
import BottomNav from '../../../components/BottomNav';
import ReportButton from '../../../components/ReportButton';
import WhatsAppButton from '../../../components/WhatsAppButton';
import useUser from '../../../hooks/useUser';
import { getConversationById, Message, hideConversationForUser, sendMessage } from '../../../lib/conversations';
import { createNotificationRecord } from '../../../lib/notifications';
import { isValidUuid } from '../../../lib/validation';

type Props = {
  params: Promise<{
    id: string;
  }>;
};

type ConversationDetails = {
  id: string;
  listingId: string;
  listingTitle: string;
  messages: Message[];
  buyerId: string;
  sellerId: string;
  otherUser: {
    id: string;
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
    phone_number?: string | null;
  };
};

const riskyTerms = ['whatsapp', 'deposit', 'send money', 'pay first', 'delivery fee', 'call me', 'outside app'];

export default function ConversationPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const { user, loading, showToast } = useUser();
  const [conversation, setConversation] = useState<ConversationDetails | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const showWarning = riskyTerms.some((term) => messageText.toLowerCase().includes(term));

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      if (!isValidUuid(id)) {
        setError('Conversation not found.');
        return;
      }

      const { conversation, error } = await getConversationById(id, user.id);
      if (error || !conversation) {
        if (error) console.error('Conversation load failed:', error);
        setError('Conversation not found.');
        return;
      }
      setConversation(conversation);
      setMessages(conversation.messages || []);
    };

    load();
  }, [user, id]);

  const otherName = conversation?.otherUser.full_name || conversation?.otherUser.email?.split('@')[0] || 'CampusTrader user';

  const retryMessage = async (failedMessage: Message) => {
    if (!user || !conversation) return;
    setMessages((current) => current.map((message) => message.id === failedMessage.id ? { ...message, status: 'sending' } : message));
    const slowTimer = window.setTimeout(() => {
      showToast({ type: 'warning', message: 'Message is taking longer than expected. Keep this page open.' });
    }, 15000);
    const { message, error } = await sendMessage(conversation.id, user.id, failedMessage.content);
    window.clearTimeout(slowTimer);
    if (error || !message) {
      setMessages((current) => current.map((item) => item.id === failedMessage.id ? { ...item, status: 'failed' } : item));
      if (error) console.error('Message retry failed:', error);
      setError('Message failed to send.');
      showToast({ type: 'error', message: 'Message failed to send.' });
      return;
    }
    setMessages((current) => current.map((item) => item.id === failedMessage.id ? message : item));
  };

  const handleSend = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!messageText.trim() || !user || !conversation) return;
    const content = messageText.trim();
    const optimisticId = `local-${Date.now()}`;
    const optimisticMessage: Message = {
      id: optimisticId,
      conversation_id: conversation.id,
      sender_id: user.id,
      content,
      created_at: new Date().toISOString(),
      status: 'sending',
    };
    setMessages((current) => [...current, optimisticMessage]);
    setMessageText('');
    setSending(true);
    const slowTimer = window.setTimeout(() => {
      showToast({ type: 'warning', message: 'Message is taking longer than expected. Keep this page open.' });
    }, 15000);
    const { message, error } = await sendMessage(conversation.id, user.id, content);
    window.clearTimeout(slowTimer);
    setSending(false);

    if (error || !message) {
      setMessages((current) => current.map((item) => item.id === optimisticId ? { ...item, status: 'failed' } : item));
      if (error) console.error('Message send failed:', error);
      setError('Message failed to send.');
      showToast({ type: 'error', message: 'Message failed to send.' });
      return;
    }

    setMessages((current) => current.map((item) => item.id === optimisticId ? message : item));
    const recipientId = conversation.buyerId === user.id ? conversation.sellerId : conversation.buyerId;
    await createNotificationRecord({
      userId: recipientId,
      type: 'new message',
      title: 'New message',
      body: `New message about ${conversation.listingTitle || 'a listing'}.`,
    });
  };

  const handleDeleteConversation = async () => {
    if (!user || !conversation || deleting) return;

    setDeleting(true);
    const { error } = await hideConversationForUser(conversation.id, user.id);
    setDeleting(false);

    if (error) {
      console.error('Conversation delete failed:', error);
      showToast({ type: 'error', message: error });
      return;
    }

    showToast({ type: 'success', message: 'Conversation removed.' });
    router.replace('/messages');
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
            <h2 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white">Sign in to continue.</h2>
            <p className="mx-auto max-w-md text-gray-600 dark:text-zinc-400">
              Browsing is free. Create an account only when you want to post, message, save, verify, or join groups.
            </p>
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
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-600 text-sm font-bold text-white">
                {conversation?.otherUser.avatar_url ? <Image src={conversation.otherUser.avatar_url} alt="" width={40} height={40} className="h-full w-full object-cover" /> : otherName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-bold text-gray-900 dark:text-white">{otherName}</h1>
                <p className="truncate text-sm text-gray-600 dark:text-zinc-400">{conversation?.listingTitle || 'Listing conversation'}</p>
              </div>
            </div>
            {conversation ? (
              <button
                type="button"
                aria-label="Remove conversation"
                onClick={handleDeleteConversation}
                disabled={deleting}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition hover:border-red-300 hover:text-red-600 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-red-900 dark:hover:text-red-300"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </header>

        {error ? (
          <div className="rounded-2xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6 text-red-700 dark:text-red-200">
            <p className="font-semibold">Unable to load this conversation.</p>
            <p className="text-sm mt-1">The conversation might not exist or you do not have access.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Listing Reference Card */}
            <div className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-blue-50 p-4 dark:bg-blue-900/20">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">Meet in public. Do not pay before inspection.</p>
              {conversation?.listingId ? (
                <Link href={`/listing/${conversation.listingId}`} className="mt-2 inline-block text-sm font-semibold text-blue-700 underline dark:text-blue-200">
                  View listing
                </Link>
              ) : <p className="mt-2 text-sm text-blue-700 dark:text-blue-200">Listing reference is unavailable.</p>}
              {conversation?.otherUser.id ? (
                <div className="mt-3">
                  <WhatsAppButton userId={conversation.otherUser.id} phoneNumber={conversation.otherUser.phone_number} />
                  <p className="mt-2 text-xs leading-5 text-blue-700 dark:text-blue-200">Use WhatsApp only when you are comfortable. Avoid advance payments before inspection.</p>
                </div>
              ) : null}
            </div>

            {/* Messages Container */}
            <div className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4 min-h-96 max-h-96 overflow-y-auto">
              {messages.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-zinc-400 py-8">No messages yet.</p>
              ) : (
                messages.map((message, index) => {
                  const previous = messages[index - 1];
                  const startsGroup = !previous || previous.sender_id !== message.sender_id;
                  const isOwn = message.sender_id === user.id;
                  return (
                  <div
                    key={message.id}
                    className={`flex gap-2 ${isOwn ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isOwn && startsGroup ? (
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-600 text-[10px] font-bold text-white">
                        {conversation?.otherUser.avatar_url ? <Image src={conversation.otherUser.avatar_url} alt="" width={40} height={40} className="h-full w-full object-cover" /> : otherName.charAt(0).toUpperCase()}
                      </div>
                    ) : !isOwn ? <div className="w-7" /> : null}
                    <div
                      className={`max-w-xs rounded-2xl px-4 py-3 ${
                        isOwn
                          ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white'
                          : 'bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-white'
                      }`}
                    >
                      {!isOwn && startsGroup ? <p className="mb-1 text-[11px] font-semibold text-gray-500 dark:text-zinc-400">{otherName}</p> : null}
                      <p className="text-sm">{message.content}</p>
                      <p className={`mt-2 text-xs ${isOwn ? 'text-blue-100' : 'text-gray-500 dark:text-zinc-500'}`}>
                        {new Date(message.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        {message.status === 'sending' ? ' · sending' : message.status === 'failed' ? ' · failed' : ''}
                      </p>
                      {message.status === 'failed' ? (
                        <button type="button" onClick={() => retryMessage(message)} className="mt-2 text-xs font-bold underline">
                          Retry
                        </button>
                      ) : null}
                    </div>
                  </div>
                );})
              )}
            </div>

            {/* Message Form */}
            <form onSubmit={handleSend} className="space-y-3">
              {showWarning ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                  Be careful. Avoid moving outside the app too early or paying before inspection.
                </div>
              ) : null}
              <div className="flex items-end gap-2 rounded-3xl border border-gray-200 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <textarea
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  rows={1}
                  className="min-h-11 flex-1 resize-none rounded-2xl border-0 bg-transparent px-3 py-3 text-sm text-gray-900 outline-none placeholder-gray-500 dark:text-white dark:placeholder-zinc-500"
                  placeholder="Write your message..."
                />
                <button
                  type="submit"
                  disabled={sending || !messageText.trim()}
                  aria-label="Send message"
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition hover:bg-blue-700 disabled:bg-gray-400"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
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
