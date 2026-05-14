'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import BottomNav from '../../../components/BottomNav';
import Header from '../../../components/Header';
import AuthPromptModal from '../../../components/AuthPromptModal';
import useUser from '../../../hooks/useUser';
import {
  CommunityMessage,
  getCommunityMessages,
  getDefaultCommunityGroup,
  sendCommunityMessage,
  uploadCommunityImage,
} from '../../../lib/community';
import { validateUploadFile } from '../../../lib/storage';

type Props = {
  params: Promise<{ groupId: string }>;
};

function senderName(message: CommunityMessage) {
  return message.sender?.full_name || message.sender?.email?.split('@')[0] || 'CampusTrader user';
}

export default function CommunityGroupPage({ params }: Props) {
  const { groupId } = use(params);
  const group = getDefaultCommunityGroup(groupId);
  const { user, loading } = useUser();
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { messages, error } = await getCommunityMessages(groupId);
      if (!mounted) return;
      setMessages(messages);
      setError(error);
    };
    load();
    return () => {
      mounted = false;
    };
  }, [groupId]);

  useEffect(() => {
    return () => {
      if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    };
  }, [mediaPreview]);

  const handleMediaChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;

    const validationError = validateUploadFile(file, 'image');
    if (validationError) {
      setError(validationError);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(`${file.name} is larger than 5MB.`);
      return;
    }

    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
    setError(null);
  };

  const handleSend = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      setAuthOpen(true);
      return;
    }
    if (!messageText.trim() && !mediaFile) return;

    const localId = `local-${Date.now()}`;
    const localMessage: CommunityMessage = {
      id: localId,
      community_id: groupId,
      sender_id: user.id,
      content: messageText.trim(),
      media_urls: mediaPreview ? [mediaPreview] : [],
      created_at: new Date().toISOString(),
      sender: {
        id: user.id,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
        email: user.email || null,
        avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.avatar || null,
      },
      status: 'sending',
    };

    const content = messageText.trim();
    const file = mediaFile;
    setMessages((current) => [...current, localMessage]);
    setMessageText('');
    setMediaFile(null);
    setMediaPreview(null);
    setSending(true);

    let mediaUrls: string[] = [];
    if (file) {
      const upload = await uploadCommunityImage(groupId, user.id, file);
      if (upload.error || !upload.publicUrl) {
        setSending(false);
        setMessages((current) => current.map((message) => message.id === localId ? { ...message, status: 'failed' } : message));
        setError(upload.error || 'Community image upload failed.');
        return;
      }
      mediaUrls = [upload.publicUrl];
    }

    const result = await sendCommunityMessage(groupId, user.id, content, mediaUrls);
    setSending(false);

    if (result.error || !result.message) {
      setMessages((current) => current.map((message) => message.id === localId ? { ...message, status: 'failed' } : message));
      setError(result.error || 'Community message failed to send.');
      return;
    }

    setMessages((current) => current.map((message) => message.id === localId ? { ...result.message, sender: localMessage.sender } : message));
  };

  if (!group) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
        <Header />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
          <p className="text-lg font-bold">Group not found.</p>
          <Link href="/community" className="mt-4 inline-block text-blue-600 underline">Back to Community</Link>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
      <Header />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-5 pb-28">
        <header className="mb-4 flex items-center gap-3">
          <Link href="/community" className="text-sm font-semibold text-blue-600 dark:text-blue-300">Back</Link>
          <div>
            <h1 className="text-2xl font-bold">{group.name}</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">{group.description}</p>
          </div>
        </header>

        {error ? (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
            {error}
          </div>
        ) : null}

        <section className="min-h-[28rem] flex-1 space-y-3 overflow-y-auto rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          {messages.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">No messages yet. Start the conversation.</p>
          ) : (
            messages.map((message) => {
              const own = message.sender_id === user?.id;
              const name = senderName(message);
              return (
                <div key={message.id} className={`flex gap-2 ${own ? 'justify-end' : 'justify-start'}`}>
                  {!own ? (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-600 text-xs font-bold text-white">
                      {message.sender?.avatar_url ? <img src={message.sender.avatar_url} alt="" className="h-full w-full object-cover" /> : name.charAt(0).toUpperCase()}
                    </div>
                  ) : null}
                  <div className={`max-w-[78%] rounded-2xl px-4 py-3 ${own ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'}`}>
                    {!own ? <p className="mb-1 text-xs font-bold text-slate-500 dark:text-slate-400">{name}</p> : null}
                    {message.media_urls?.map((url) => (
                      <img key={url} src={url} alt="" className="mb-2 max-h-64 rounded-xl object-cover" />
                    ))}
                    {message.content ? <p className="text-sm">{message.content}</p> : null}
                    <p className={`mt-2 text-[11px] ${own ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'}`}>
                      {new Date(message.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      {message.status === 'sending' ? ' · sending' : message.status === 'failed' ? ' · failed' : ''}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </section>

        <form onSubmit={handleSend} className="mt-4 rounded-3xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          {mediaPreview ? (
            <div className="mb-3 flex items-center gap-3">
              <img src={mediaPreview} alt="" className="h-16 w-16 rounded-xl object-cover" />
              <button type="button" onClick={() => { if (mediaPreview) URL.revokeObjectURL(mediaPreview); setMediaPreview(null); setMediaFile(null); }} className="text-sm font-semibold text-red-600">
                Remove image
              </button>
            </div>
          ) : null}
          <div className="flex items-end gap-2">
            <label className="cursor-pointer rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold dark:border-slate-700">
              Image
              <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handleMediaChange} className="hidden" />
            </label>
            <textarea
              value={messageText}
              onChange={(event) => setMessageText(event.target.value)}
              rows={1}
              placeholder={user ? 'Write a message...' : 'Sign in to send'}
              className="min-h-12 flex-1 resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
            />
            <button type="submit" disabled={loading || sending || (!messageText.trim() && !mediaFile)} className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
              Send
            </button>
          </div>
        </form>
      </main>
      <AuthPromptModal open={authOpen} next={`/community/${groupId}`} onClose={() => setAuthOpen(false)} />
      <BottomNav />
    </div>
  );
}
