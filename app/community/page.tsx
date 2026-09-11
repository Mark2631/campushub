'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Megaphone, ShieldCheck, UsersRound } from 'lucide-react';
import AuthPromptModal from '../../components/AuthPromptModal';
import BottomNav from '../../components/BottomNav';
import Header from '../../components/Header';
import Logo from '../../components/Logo';
import useUser from '../../hooks/useUser';
import { Community, createCommunityRequest, followCommunity, getCommunities } from '../../lib/community';
import { institutionLabel } from '../../lib/validation';

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
}

export default function CommunityPage() {
  const { user, isAdmin, institution, showToast } = useUser();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestForm, setRequestForm] = useState({ name: '', description: '', category: 'General' });
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      const { communities } = await getCommunities(user?.id, institution);
      if (!mounted) return;
      setCommunities(communities);
      setLoading(false);
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [user?.id, institution]);

  const handleFollow = async (communityId: string) => {
    if (!user) {
      setAuthOpen(true);
      return;
    }

    setWorkingId(communityId);
    const { error } = await followCommunity(communityId, user.id);
    setWorkingId(null);

    if (error) {
      console.error('Community follow failed:', error);
      showToast({ type: 'error', message: 'Something went wrong. Try again.' });
      return;
    }

    setCommunities((current) =>
      current.map((community) =>
        community.id === communityId
          ? { ...community, isFollowed: true, memberCount: (community.memberCount || 0) + 1 }
          : community
      )
    );
    showToast({ type: 'success', message: 'Community followed.' });
  };

  const followedCommunities = communities.filter((community) => community.isFollowed);

  const submitRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) { setAuthOpen(true); return; }
    setRequesting(true);
    const result = await createCommunityRequest({ ...requestForm, userId: user.id, campus: institution });
    setRequesting(false);
    if (result.error) { showToast({ type: 'error', message: result.error }); return; }
    setRequestForm({ name: '', description: '', category: 'General' });
    setRequestOpen(false);
    showToast({ type: 'success', message: 'Community request submitted for admin approval.' });
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
      <Header />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-28 sm:py-8">
        <header className="mb-6">
          <Logo />
          <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">{institutionLabel(institution)} communities</p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{institutionLabel(institution)} Communities</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Follow trusted campus channels for marketplace updates, deals, services, lost items, and announcements.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => { if (!user) setAuthOpen(true); else setRequestOpen((open) => !open); }}
              className="rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Request a community
            </button>
            {isAdmin ? <Link href="/admin" className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">Create as admin</Link> : null}
          </div>
          {requestOpen ? (
            <form onSubmit={submitRequest} className="mt-4 grid gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
              <input required value={requestForm.name} onChange={(event) => setRequestForm((form) => ({ ...form, name: event.target.value }))} placeholder="Community name" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900" />
              <input value={requestForm.category} onChange={(event) => setRequestForm((form) => ({ ...form, category: event.target.value }))} placeholder="Category" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900" />
              <textarea required value={requestForm.description} onChange={(event) => setRequestForm((form) => ({ ...form, description: event.target.value }))} placeholder="What is this community for?" rows={3} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900" />
              <button disabled={requesting} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{requesting ? 'Submitting...' : 'Submit for approval'}</button>
            </form>
          ) : null}
        </header>

        {followedCommunities.length > 0 ? (
          <section className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <UsersRound className="h-4 w-4 text-blue-600 dark:text-blue-300" aria-hidden="true" />
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Followed</h2>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {followedCommunities.map((community) => (
                <Link
                  key={community.id}
                  href={`/community/${community.id}`}
                  className="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-200"
                >
                  {community.name}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-blue-600 dark:text-blue-300" aria-hidden="true" />
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Official groups</h2>
            </div>
            {isAdmin ? (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                Admin controls
              </span>
            ) : null}
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {communities.map((community) => (
                <article
                  key={community.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-600 to-slate-800 text-sm font-semibold text-white">
                      {initials(community.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-bold text-slate-950 dark:text-white">{community.name}</h3>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {community.category}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-blue-700 dark:bg-blue-950 dark:text-blue-200">
                          <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                          Official
                        </span>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">{community.description}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        <span>{community.memberCount || 0} followers</span>
                        <span>{community.postCount || 0} posts</span>
                      </div>
                      {community.latestPostPreview ? (
                        <p className="mt-2 line-clamp-1 text-sm text-slate-500 dark:text-slate-400">{community.latestPostPreview}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                    <button
                      type="button"
                      disabled={workingId === community.id || community.isFollowed}
                      onClick={() => handleFollow(community.id)}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-300 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                    >
                      {community.isFollowed ? 'Following' : workingId === community.id ? 'Joining...' : 'Follow'}
                    </button>
                    <Link
                      href={`/community/${community.id}`}
                      className="rounded-2xl bg-blue-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-blue-700"
                    >
                      Open group
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

      </main>

      <AuthPromptModal open={authOpen} next="/community" onClose={() => setAuthOpen(false)} />
      <BottomNav />
    </div>
  );
}
