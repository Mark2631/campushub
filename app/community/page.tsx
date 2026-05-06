'use client';

import BottomNav from '../../components/BottomNav';
import Header from '../../components/Header';
import Logo from '../../components/Logo';

type CommunityGroup = {
  id: string;
  name: string;
  description: string;
  members: number;
  action: 'Open' | 'Join';
};

const usefulLinks = [
  { label: 'Student Portal', note: 'Preview' },
  { label: 'E-learning', note: 'Preview' },
  { label: 'Library Resources', note: 'Preview' },
  { label: 'School Website', note: 'Preview' },
  { label: 'Support / Help', note: 'Preview' },
];

const groups: CommunityGroup[] = [
  { id: 'deals-discounts', name: 'Deals & Discounts', description: 'Quick price drops, bundles, and useful student offers.', members: 842, action: 'Open' },
  { id: 'services-network', name: 'Services Network', description: 'Repairs, typing, laundry, tutoring, and trusted referrals.', members: 604, action: 'Join' },
  { id: 'lost-found', name: 'Lost & Found', description: 'Find missing items and arrange safe returns around campus.', members: 391, action: 'Open' },
  { id: 'course-groups', name: 'Course Groups', description: 'Study help, revision links, and class support.', members: 390, action: 'Join' },
  { id: 'school-updates', name: 'School Updates', description: 'Venue changes, notices, and campus announcements.', members: 722, action: 'Open' },
  { id: 'events', name: 'Events', description: 'Club events, student meetups, and useful activities.', members: 468, action: 'Join' },
  { id: 'business-offers', name: 'Business Offers', description: 'Nearby sellers and repeat campus businesses in one place.', members: 254, action: 'Join' },
  { id: 'useful-links', name: 'Useful Links', description: 'Fast access to portals, school pages, and study tools.', members: 188, action: 'Open' },
];

export default function CommunityPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:text-white">
      <Header />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-24 sm:py-8">
        <header className="mb-8">
          <Logo />
          <h1 className="mt-4 text-2xl font-bold sm:mt-5 sm:text-3xl">Community</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Useful campus spaces without turning this into a noisy social feed.</p>
        </header>

        <section className="mb-8 rounded-[2rem] border border-amber-200 bg-amber-50 p-5 sm:p-6 dark:border-amber-900/50 dark:bg-amber-900/15">
          <h2 className="text-lg font-bold text-amber-900 dark:text-amber-100">Official Notices</h2>
          <div className="mt-4 rounded-2xl border border-amber-200 bg-white p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-slate-950 dark:text-amber-100">
            CampusTrader notices and safety updates will appear here.
          </div>
        </section>

        <section className="mb-8 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-bold">Useful Campus Links</h2>
            <span className="text-sm text-slate-500 dark:text-slate-400">Easy to expand later</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {usefulLinks.map((link) => (
              <div key={link.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <p className="font-semibold text-slate-900 dark:text-white">{link.label}</p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{link.note}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-bold">Essential Groups</h2>
            <span className="text-sm text-slate-500 dark:text-slate-400">{groups.length} groups</span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {groups.map((group) => (
              <article key={group.id} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-950 dark:text-white">{group.name}</h3>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{group.description}</p>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-500">
                      {group.members.toLocaleString()} members
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:items-end">
                    <button className="w-full rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white sm:w-auto">
                      {group.action}
                    </button>
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Preview</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
