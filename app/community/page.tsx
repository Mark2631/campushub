'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Megaphone, ShieldCheck, UsersRound } from 'lucide-react';
import AuthPromptModal from '../../components/AuthPromptModal';
import BottomNav from '../../components/BottomNav';
import Header from '../../components/Header';
import Logo from '../../components/Logo';
import useUser from '../../hooks/useUser';
import { Community, followCommunity, getCommunities } from '../../lib/community';
import { communityLinks } from '../../lib/communityLinks';

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
}

export default function CommunityPage() {
  const { user, isAdmin, showToast } = useUser();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      const { communities } = await getCommunities(user?.id);
      if (!mounted) return;
      setCommunities(communities);
      setLoading(false);
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [user?.id]);

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

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
      <Header />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-28 sm:py-8">
        <header className="mb-6">
          <Logo />
          <p className="mt-5 text-xs font-black uppercase tracking-wide text-blue-600 dark:text-blue-300">Meru University of Science and Technology</p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">MUST Communities</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Official groups for marketplace updates, deals, services, lost items, and useful campus links.
          </p>
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
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-emerald-500 text-sm font-black text-white">
                      {initials(community.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-bold text-slate-950 dark:text-white">{community.name}</h3>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {community.category}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-black uppercase text-blue-700 dark:bg-blue-950 dark:text-blue-200">
                          <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                          Official
                        </span>
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
                          {community.posting_mode === 'admin_only' ? 'Admin posts' : 'Everyone posts'}
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

        <section>
          <div className="mb-3 flex items-center gap-2">
            <ExternalLink className="h-4 w-4 text-blue-600 dark:text-blue-300" aria-hidden="true" />
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Useful MUST links</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {communityLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-800 transition hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              >
                <span className="block">{link.label}</span>
                <span className="mt-2 block text-xs font-medium text-slate-500 dark:text-slate-400">{link.href.replace(/^https?:\/\//, '')}</span>
              </a>
            ))}
          </div>
        </section>
      </main>

      <AuthPromptModal open={authOpen} next="/community" onClose={() => setAuthOpen(false)} />
      <BottomNav />
    </div>
  );
}
