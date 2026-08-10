'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Heart, ImagePlus, Pin, Send } from 'lucide-react';
import AuthPromptModal from '../../../components/AuthPromptModal';
import BottomNav from '../../../components/BottomNav';
import Header from '../../../components/Header';
import useUser from '../../../hooks/useUser';
import {
  Community,
  CommunityPost,
  addCommunityComment,
  createCommunityPost,
  followCommunity,
  getCommunityById,
  getCommunityPosts,
  reactToCommunityPost,
  updateCommunityPostStatus,
  uploadCommunityMedia,
} from '../../../lib/community';
import { validateUploadFile } from '../../../lib/storage';
import { isValidUuid } from '../../../lib/validation';
import Image from 'next/image';

type Props = {
  params: Promise<{ groupId: string }>;
};

type SelectedMedia = {
  file: File;
  previewUrl: string;
  publicUrl?: string;
};

function profileName(profile?: { full_name: string | null; email: string | null } | null) {
  return profile?.full_name || profile?.email?.split('@')[0] || 'CampusTrader';
}

function Avatar({ name, src }: { name: string; src?: string | null }) {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-600 text-xs font-semibold text-white">
      {src ? <Image src={src} alt="" width={36} height={36} className="h-full w-full object-cover" /> : name.charAt(0).toUpperCase()}
    </div>
  );
}

function PostMedia({ post }: { post: CommunityPost }) {
  if (!post.media_urls?.length) return null;

  if (post.media_type === 'video') {
    return (
      <div className="mt-4 space-y-3">
        {post.media_urls.map((url) => (
          <video key={url} src={url} controls className="max-h-96 w-full rounded-2xl bg-black" />
        ))}
      </div>
    );
  }

  return (
    <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
      {post.media_urls.map((url) => (
        <Image key={url} src={url} alt="" width={1200} height={800} className="max-h-96 w-full rounded-2xl object-cover" />
      ))}
    </div>
  );
}

export default function CommunityGroupPage({ params }: Props) {
  const { groupId } = use(params);
  const { user, isAdmin, loading, institution, showToast } = useUser();
  const [community, setCommunity] = useState<Community | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [authOpen, setAuthOpen] = useState(false);
  const [fetching, setFetching] = useState(() => isValidUuid(groupId));
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [postContent, setPostContent] = useState('');
  const [postPinned, setPostPinned] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');

  const pinnedPost = useMemo(() => posts.find((post) => post.is_pinned) || null, [posts]);
  const feedPosts = useMemo(() => posts.filter((post) => post.id !== pinnedPost?.id), [pinnedPost?.id, posts]);

  useEffect(() => {
    if (!isValidUuid(groupId)) return;

    let mounted = true;
    const load = async () => {
      setFetching(true);
      const [{ community }, { posts, error }] = await Promise.all([
        getCommunityById(groupId, user?.id, institution),
        getCommunityPosts(groupId, user?.id),
      ]);

      if (!mounted) return;
      setCommunity(community);
      setPosts(posts);
      if (error) setMessage({ type: 'error', text: 'Something went wrong. Try again.' });
      setFetching(false);
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [groupId, user?.id, institution]);

  useEffect(() => {
    return () => {
      selectedMedia.forEach((media) => URL.revokeObjectURL(media.previewUrl));
    };
  }, [selectedMedia]);

  const requireAuth = () => {
    if (!user) {
      setAuthOpen(true);
      return false;
    }

    return true;
  };

  const handleFollow = async () => {
    if (!community || !requireAuth() || !user) return;
    const { error } = await followCommunity(community.id, user.id);
    if (error) {
      console.error('Community follow failed:', error);
      showToast({ type: 'error', message: 'Something went wrong. Try again.' });
      return;
    }
    setCommunity((current) => current ? { ...current, isFollowed: true, memberCount: (current.memberCount || 0) + 1 } : current);
    showToast({ type: 'success', message: 'Community followed.' });
  };

  const handleReact = async (postId: string) => {
    if (!requireAuth() || !user) return;

    setPosts((current) =>
      current.map((post) =>
        post.id === postId
          ? { ...post, viewerReacted: true, reactionCount: (post.reactionCount || 0) + (post.viewerReacted ? 0 : 1) }
          : post
      )
    );

    const { error } = await reactToCommunityPost(postId, user.id);
    if (error) {
      console.error('Community reaction failed:', error);
      showToast({ type: 'error', message: 'Something went wrong. Try again.' });
    }
  };

  const handleComment = async (postId: string) => {
    if (!requireAuth() || !user) return;
    const content = commentInputs[postId]?.trim();
    if (!content) return;

    const localComment = {
      id: `local-${Date.now()}`,
      post_id: postId,
      user_id: user.id,
      content,
      parent_id: null,
      status: 'active',
      created_at: new Date().toISOString(),
      user: {
        id: user.id,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
        email: user.email || null,
        avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.avatar || null,
      },
    };

    setPosts((current) => current.map((post) => post.id === postId ? { ...post, comments: [...(post.comments || []), localComment] } : post));
    setCommentInputs((current) => ({ ...current, [postId]: '' }));

    const { comment, error } = await addCommunityComment(postId, user.id, content);
    if (error || !comment) {
      console.error('Community comment failed:', error);
      setPosts((current) => current.map((post) => post.id === postId ? { ...post, comments: (post.comments || []).filter((item) => item.id !== localComment.id) } : post));
      showToast({ type: 'error', message: 'Something went wrong. Try again.' });
      return;
    }

    setPosts((current) =>
      current.map((post) =>
        post.id === postId
          ? { ...post, comments: (post.comments || []).map((item) => item.id === localComment.id ? comment : item) }
          : post
      )
    );
  };

  const handleMediaChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files || []);
    event.currentTarget.value = '';
    const next: SelectedMedia[] = [];
    const errors: string[] = [];

    files.slice(0, 4).forEach((file) => {
      const kind: 'video' | 'image' = file.type.startsWith('video/') ? 'video' : 'image';
      const validationError = validateUploadFile(file, kind, kind === 'video' ? 20 * 1024 * 1024 : 5 * 1024 * 1024);
      if (validationError) {
        errors.push(validationError);
        return;
      }
      next.push({ file, previewUrl: URL.createObjectURL(file) });
    });

    if (errors.length > 0) {
      setMessage({ type: 'error', text: errors.join(' ') });
    }
    setSelectedMedia((current) => [...current, ...next].slice(0, 4));
  };

  const clearComposer = () => {
    selectedMedia.forEach((media) => URL.revokeObjectURL(media.previewUrl));
    setSelectedMedia([]);
    setPostContent('');
    setPostPinned(false);
    setUploadStatus('');
  };

  const handlePublish = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!community || !user || publishing) return;
    if (!isAdmin && community.posting_mode !== 'everyone') {
      setMessage({ type: 'error', text: 'You do not have permission to do that.' });
      return;
    }

    setPublishing(true);
    setMessage(null);
    const mediaUrls: string[] = [];

    for (const [index, media] of selectedMedia.entries()) {
      setUploadStatus(`Uploading ${index + 1} of ${selectedMedia.length}...`);
      const { publicUrl, error } = await uploadCommunityMedia(community.id, user.id, media.file);
      if (error || !publicUrl) {
        if (error) console.error('Community media upload failed:', error);
        setPublishing(false);
        setUploadStatus('');
        setMessage({ type: 'error', text: 'Upload failed. Please retry.' });
        return;
      }
      mediaUrls.push(publicUrl);
    }

    setUploadStatus('Publishing...');
    const { post, error } = await createCommunityPost({
      communityId: community.id,
      authorId: user.id,
      authorEmail: user.email,
      content: postContent,
      mediaUrls,
      isPinned: isAdmin ? postPinned : false,
    });
    setPublishing(false);

    if (error || !post) {
      console.error('Community post publish failed:', error);
      setMessage({ type: 'error', text: error || 'Something went wrong. Try again.' });
      setUploadStatus('');
      return;
    }

    setPosts((current) => [{ ...post, author: { id: user.id, full_name: user.user_metadata?.full_name || user.user_metadata?.name || null, email: user.email || null, avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.avatar || null }, comments: [], reactionCount: 0, viewerReacted: false }, ...current]);
    setMessage({ type: 'success', text: 'Post published.' });
    clearComposer();
  };

  const handleHidePost = async (postId: string) => {
    if (!user || !isAdmin) return;
    const { error } = await updateCommunityPostStatus(postId, user.id, user.email, 'hidden');
    if (error) {
      console.error('Community post hide failed:', error);
      showToast({ type: 'error', message: error });
      return;
    }
    setPosts((current) => current.filter((post) => post.id !== postId));
    showToast({ type: 'success', message: 'Post removed.' });
  };

  const renderPost = (post: CommunityPost) => {
    const name = profileName(post.author);
    return (
      <article key={post.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex gap-3">
          <Avatar name={name} src={post.author?.avatar_url} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-bold text-slate-950 dark:text-white">{name}</p>
              {post.is_pinned ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700 dark:bg-amber-950 dark:text-amber-200">
                  <Pin className="h-3 w-3" aria-hidden="true" />
                  Pinned
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {new Date(post.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>

        {isAdmin ? (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => handleHidePost(post.id)}
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
            >
              Remove post
            </button>
          </div>
        ) : null}

        {post.content ? <p className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-700 dark:text-slate-200">{post.content}</p> : null}
        <PostMedia post={post} />

        <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <button
            type="button"
            onClick={() => handleReact(post.id)}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition ${
              post.viewerReacted
                ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-200'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Heart className="h-4 w-4" aria-hidden="true" />
            {post.reactionCount || 0}
          </button>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{post.comments?.length || 0} comments</span>
        </div>

        <div className="mt-4 space-y-3">
          {(post.comments || []).slice(-3).map((comment) => {
            const commentName = profileName(comment.user);
            return (
              <div key={comment.id} className="flex gap-2">
                <Avatar name={commentName} src={comment.user?.avatar_url} />
                <div className="min-w-0 rounded-2xl bg-slate-100 px-3 py-2 dark:bg-slate-800">
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{commentName}</p>
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{comment.content}</p>
                </div>
              </div>
            );
          })}

          <div className="flex gap-2">
            <input
              value={commentInputs[post.id] || ''}
              onChange={(event) => setCommentInputs((current) => ({ ...current, [post.id]: event.target.value }))}
              onFocus={() => {
                if (!user) setAuthOpen(true);
              }}
              placeholder={user ? 'Write a reply...' : 'Sign in to reply'}
              className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
            />
            <button
              type="button"
              aria-label="Send reply"
              onClick={() => handleComment(post.id)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white transition hover:bg-blue-700"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </article>
    );
  };

  if (fetching || loading) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
        <Header />
        <main className="mx-auto flex w-full max-w-4xl flex-1 items-center justify-center px-4 py-10">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600 dark:border-slate-800" />
        </main>
        <BottomNav />
      </div>
    );
  }

  if (!community) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
        <Header />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
          <p className="text-lg font-bold">Group not found.</p>
          <Link href="/community" className="mt-4 inline-block text-sm font-semibold text-blue-600 underline dark:text-blue-300">Back to Community</Link>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
      <Header />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-5 pb-28">
        <Link href="/community" className="mb-4 inline-flex text-sm font-semibold text-blue-600 dark:text-blue-300">Back to Community</Link>

        <header className="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="h-28 bg-gradient-to-br from-slate-700 to-slate-900">
            {community.cover_url ? <Image src={community.cover_url} alt="" width={1200} height={300} className="h-full w-full object-cover" /> : null}
          </div>
          <div className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold">{community.name}</h1>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase text-blue-700 dark:bg-blue-950 dark:text-blue-200">Official</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{community.description}</p>
                <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {community.memberCount || 0} followers · {community.postCount || posts.length} posts · MUST
                </p>
              </div>
              <button
                type="button"
                onClick={handleFollow}
                disabled={community.isFollowed}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-300 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              >
                {community.isFollowed ? 'Following' : 'Follow'}
              </button>
            </div>
          </div>
        </header>

        {message ? (
          <div className={`mb-4 rounded-2xl border p-3 text-sm font-semibold ${message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200' : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200'}`}>
            {message.text}
          </div>
        ) : null}

        {user && (isAdmin || community.posting_mode === 'everyone') ? (
          <form onSubmit={handlePublish} className="mb-5 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-bold text-slate-900 dark:text-white">New group post</p>
              {isAdmin ? (
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  <input type="checkbox" checked={postPinned} onChange={(event) => setPostPinned(event.target.checked)} />
                  Pin post
                </label>
              ) : null}
            </div>
            <textarea
              value={postContent}
              onChange={(event) => setPostContent(event.target.value)}
              rows={3}
              placeholder="Write something for the group..."
              className="w-full resize-none rounded-2xl border-0 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 dark:bg-slate-950"
            />
            {selectedMedia.length > 0 ? (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {selectedMedia.map((media, index) => (
                  <div key={`${media.file.name}-${index}`} className="relative overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                    {media.file.type.startsWith('video/') ? (
                      <video src={media.previewUrl} className="h-24 w-full object-cover" />
                    ) : (
                      <Image src={media.previewUrl} alt="" width={320} height={96} className="h-24 w-full object-cover" />
                    )}
                  </div>
                ))}
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                <ImagePlus className="h-4 w-4" aria-hidden="true" />
                <span>Media</span>
                <input type="file" multiple accept="image/jpeg,image/jpg,image/png,image/webp,video/mp4,video/webm,video/quicktime" onChange={handleMediaChange} className="hidden" />
              </label>
              <button type="button" onClick={clearComposer} className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
                Clear
              </button>
              <button type="submit" disabled={publishing} className="ml-auto inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60">
                <Send className="h-4 w-4" aria-hidden="true" />
                {publishing ? uploadStatus || 'Publishing...' : 'Publish'}
              </button>
            </div>
          </form>
        ) : !user ? (
          <button
            type="button"
            onClick={() => setAuthOpen(true)}
            className="mb-5 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-800 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
          >
            Create a free account to join the conversation.
          </button>
        ) : null}

        {pinnedPost ? (
          <section className="mb-5">
            <h2 className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">Pinned post</h2>
            {renderPost(pinnedPost)}
          </section>
        ) : null}

        <section className="space-y-4">
          {feedPosts.length > 0 ? (
            feedPosts.map(renderPost)
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
              No posts yet.
            </div>
          )}
        </section>
      </main>
      <AuthPromptModal open={authOpen} next={`/community/${groupId}`} onClose={() => setAuthOpen(false)} />
      <BottomNav />
    </div>
  );
}
