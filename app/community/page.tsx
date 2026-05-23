'use client';

import { useState } from 'react';
import BottomNav from '../../components/BottomNav';
import Header from '../../components/Header';
import Logo from '../../components/Logo';
import { defaultCommunityGroups } from '../../lib/community';
import { communityLinks } from '../../lib/communityLinks';

export default function CommunityPage() {
  const [openingSoon, setOpeningSoon] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:text-white">
      <Header />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-24 sm:py-8">
        <header className="mb-8">
          <Logo />
          <h1 className="mt-4 text-2xl font-bold sm:mt-5 sm:text-3xl">Community</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Open campus groups and useful links.</p>
        </header>

        <section className="mb-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Working Groups</h2>
            <span className="text-sm text-slate-500 dark:text-slate-400">2 active</span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {defaultCommunityGroups.map((group) => (
              <div
                key={group.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950"
              >
                <div>
                  <h3 className="font-bold text-slate-950 dark:text-white">{group.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{group.description}</p>
                </div>
                {group.available ? (
                  <button
                    type="button"
                    onClick={() => setOpeningSoon(true)}
                    className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 dark:hover:bg-blue-500 sm:w-auto"
                  >
                    Open group
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 sm:w-auto"
                  >
                    Coming soon
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-bold">Useful Campus Links</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {communityLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-300 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-blue-700"
              >
                <p className="font-semibold text-slate-900 dark:text-white">{link.label}</p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Open link</p>
              </a>
            ))}
          </div>
        </section>
      </main>

      {openingSoon ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-950">
            <h2 className="text-lg font-bold text-slate-950 dark:text-white">Group chat is opening soon.</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">Use marketplace messages for now.</p>
            <button
              type="button"
              onClick={() => setOpeningSoon(false)}
              className="mt-5 w-full rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Got it
            </button>
          </div>
        </div>
      ) : null}

      <BottomNav />
    </div>
  );
}
