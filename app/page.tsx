'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import BottomNav from '../components/BottomNav';
import Header from '../components/Header';
import ListingCard from '../components/ListingCard';
import SafetyBanner from '../components/SafetyBanner';
import useUser from '../hooks/useUser';
import { getListings, Listing } from '../lib/listings';
import { getItemRequests, ItemRequest } from '../lib/itemRequests';
import { getProfileById } from '../lib/profiles';

const categories = ['Electronics', 'Fashion', 'Furniture', 'Books', 'Food', 'Services', 'Refurbished', 'Other'];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function ListingSection({ title, listings }: { title: string; listings: Listing[] }) {
  return (
    <section className="mb-8 sm:mb-10">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-gray-900 sm:text-xl dark:text-white">{title}</h2>
      </div>
      {listings.length > 0 ? (
        <div className="-mx-3 overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0">
          <div className="grid auto-cols-[minmax(140px,48vw)] grid-flow-col gap-2.5 pb-2 sm:auto-cols-[180px] lg:grid-flow-row lg:grid-cols-5 xl:grid-cols-6">
            {listings.map((listing) => (
              <ListingCard key={`${title}-${listing.id}`} listing={listing} />
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white p-10 text-center text-gray-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          <p className="font-semibold text-gray-900 dark:text-white">No listings yet in {title}.</p>
          <p className="mt-1 text-sm">Post the first {title.toLowerCase().replace('recently posted', 'listing')}.</p>
        </div>
      )}
    </section>
  );
}

function ListingSkeletons() {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: 10 }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="aspect-square animate-pulse bg-gray-200 dark:bg-zinc-800" />
          <div className="space-y-2 p-3">
            <div className="h-3 w-5/6 animate-pulse rounded bg-gray-200 dark:bg-zinc-800" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200 dark:bg-zinc-800" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-gray-200 dark:bg-zinc-800" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const { user } = useUser();
  const [listings, setListings] = useState<Listing[]>([]);
  const [requests, setRequests] = useState<ItemRequest[]>([]);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [error, setError] = useState<string | null>(null);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [loadingListings, setLoadingListings] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreListings, setHasMoreListings] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [filters, setFilters] = useState({
    minPrice: '',
    maxPrice: '',
    condition: 'all',
    location: '',
    sellerType: 'all',
    negotiableOnly: false,
  });

  useEffect(() => {
    let isMounted = true;

    const loadListings = async () => {
      if (isMounted) setLoadingListings(true);
      const { listings: rows, error } = await getListings(20);
      if (!isMounted) return;
      setListings(rows as Listing[]);
      window.sessionStorage.setItem('campustrader-home-listings', JSON.stringify(rows));
      setHasMoreListings(rows.length === 20);
      setError(error);
      setLoadingListings(false);
    };

    const cached = window.sessionStorage.getItem('campustrader-home-listings');
    if (cached) {
      try {
        const cachedListings = JSON.parse(cached) as Listing[];
        if (cachedListings.length) {
          setListings(cachedListings);
          setLoadingListings(false);
        }
      } catch {
        window.sessionStorage.removeItem('campustrader-home-listings');
      }
    }

    loadListings();
    const refreshListings = () => {
      void loadListings();
    };
    window.addEventListener('campustrader:listings-refresh', refreshListings);

    return () => {
      isMounted = false;
      window.removeEventListener('campustrader:listings-refresh', refreshListings);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setShowWelcome(new URLSearchParams(window.location.search).get('welcome') === '1');
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadRequests = async () => {
      if (isMounted) setLoadingRequests(true);
      const { requests: rows, error } = await getItemRequests(6);
      if (!isMounted) return;
      setRequests(rows);
      setRequestsError(error);
      setLoadingRequests(false);
    };

    loadRequests();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    let isMounted = true;

    const loadProfile = async () => {
      const { profile } = await getProfileById(user.id);
      if (isMounted) {
        setProfileName(profile?.full_name || null);
      }
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const filteredListings = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return listings.filter((listing) => {
      const matchesCategory = activeCategory === 'All' || listing.category === activeCategory;
      const matchesQuery =
        !normalizedQuery ||
        listing.title.toLowerCase().includes(normalizedQuery) ||
        listing.category.toLowerCase().includes(normalizedQuery) ||
        listing.description?.toLowerCase().includes(normalizedQuery) ||
        listing.location?.toLowerCase().includes(normalizedQuery);
      const numericPrice = typeof listing.price === 'number' ? listing.price : null;
      const matchesMinPrice = !filters.minPrice || (numericPrice != null && numericPrice >= Number(filters.minPrice));
      const matchesMaxPrice = !filters.maxPrice || (numericPrice != null && numericPrice <= Number(filters.maxPrice));
      const matchesCondition = filters.condition === 'all' || listing.condition.toLowerCase() === filters.condition.toLowerCase();
      const matchesLocation = !filters.location || (listing.location || '').toLowerCase().includes(filters.location.toLowerCase());
      const matchesSellerType = filters.sellerType === 'all' || listing.sellerType === filters.sellerType;
      const matchesNegotiable = !filters.negotiableOnly || listing.negotiable;

      return (
        matchesCategory &&
        matchesQuery &&
        matchesMinPrice &&
        matchesMaxPrice &&
        matchesCondition &&
        matchesLocation &&
        matchesSellerType &&
        matchesNegotiable
      );
    });
  }, [activeCategory, filters, listings, query]);

  const sectionBuckets = useMemo(() => {
    const usedIds = new Set<string>();
    const recent = [...filteredListings].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 12);
    recent.forEach((listing) => usedIds.add(listing.id));

    const services = filteredListings
      .filter((listing) =>
        listing.condition === 'service' ||
        listing.category === 'Services' ||
        listing.category === 'Food'
      )
      .filter((listing) => !usedIds.has(listing.id))
      .slice(0, 6);
    services.forEach((listing) => usedIds.add(listing.id));

    const refurbished = filteredListings
      .filter((listing) => listing.category === 'Refurbished' || listing.condition === 'refurbished')
      .filter((listing) => !usedIds.has(listing.id))
      .slice(0, 6);
    refurbished.forEach((listing) => usedIds.add(listing.id));

    const studentEssentials = filteredListings
      .filter((listing) => ['Books', 'Furniture', 'Fashion', 'Other'].includes(listing.category))
      .filter((listing) => !usedIds.has(listing.id))
      .slice(0, 6);
    studentEssentials.forEach((listing) => usedIds.add(listing.id));

    const verifiedBusiness = filteredListings
      .filter((listing) => listing.business_id || listing.badgeType === 'gold')
      .filter((listing) => !usedIds.has(listing.id))
      .slice(0, 6);

    return { recent, services, refurbished, studentEssentials, verifiedBusiness };
  }, [filteredListings]);

  const greetingName = profileName || user?.email?.split('@')[0];
  const greeting = `${getGreeting()}${greetingName ? `, ${greetingName}` : ''}`;
  const showRequestsSection = loadingRequests || (!requestsError && requests.length > 0);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-gray-50 to-gray-100 text-gray-900 dark:bg-gradient-to-br dark:from-black dark:to-zinc-950 dark:text-white">
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-4 pb-32 sm:px-4 sm:py-6">
        <header className="mb-4 sm:mb-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">{greeting}</p>
          <h1 className="mt-1 text-xl font-bold text-gray-900 sm:text-3xl dark:text-white">Find campus deals you can inspect before paying.</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-zinc-400">Students and nearby registered businesses trading across trusted campus communities.</p>
        </header>

        {showWelcome ? (
          <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200">
            Welcome to CampusTrader.
          </div>
        ) : null}

        <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { href: '/sell', label: 'Sell' },
            { href: '/requests', label: 'Requests / Looking For' },
            { href: '/messages', label: 'Messages' },
            { href: '/profile', label: 'Verify later / Earn badge' },
          ].map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="rounded-2xl border border-gray-200 bg-white px-3 py-3 text-center text-sm font-bold text-gray-900 shadow-sm transition hover:border-blue-300 hover:text-blue-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:hover:border-blue-600"
            >
              {action.label}
            </Link>
          ))}
        </div>

        {showRequestsSection ? (
          <section className="mb-6 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Looking for something?</p>
              <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">
                Open item requests from other students appear here when available.
              </p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {loadingRequests ? (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                  Loading requests...
                </div>
              ) : (
                requests.map((request) => (
                  <article key={request.id} className="rounded-2xl border border-gray-200 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{request.title}</p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">{request.category} · {request.location || 'Any location'}</p>
                      </div>
                      <span className="rounded-full bg-blue-100 px-2 py-1 text-[10px] font-black uppercase text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
                        {request.interested_count ?? 0} interested
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-gray-600 dark:text-zinc-400 line-clamp-3">{request.description || 'No description provided.'}</p>
                  </article>
                ))
              )}
            </div>
          </section>
        ) : null}

        <div className="mb-4">
          <div className="flex items-center gap-2 rounded-2xl border border-gray-300 bg-white px-3 py-3 shadow-sm transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 sm:gap-3 sm:px-4 dark:border-zinc-700 dark:bg-zinc-900">
            <span className="text-lg text-gray-400 dark:text-zinc-500">⌕</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search items, services, businesses..."
              className="min-w-0 flex-1 bg-transparent text-gray-900 placeholder-gray-500 outline-none dark:text-white dark:placeholder-zinc-500"
            />
            <button
              onClick={() => setFiltersOpen(true)}
              className="shrink-0 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700 transition hover:border-blue-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:border-blue-600"
            >
              Filter
            </button>
          </div>
        </div>

        <div className="mb-5">
          <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-w-max gap-3 pb-1">
            {['All', ...categories].map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition sm:px-5 ${
                  activeCategory === category
                    ? 'border-blue-500 bg-blue-600 text-white'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-blue-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                }`}
              >
                {category}
              </button>
            ))}
            </div>
          </div>
        </div>

        <div className="mb-6">
          <SafetyBanner />
        </div>

        {loadingListings ? (
          <ListingSkeletons />
        ) : (
          <>
            {error ? (
              <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                <p className="font-semibold">Live listings are having trouble right now</p>
                <p className="mt-1 text-sm">{error}</p>
              </div>
            ) : null}
            {filteredListings.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white p-10 text-center text-gray-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
                <p className="font-semibold text-gray-900 dark:text-white">
                  {listings.length === 0 ? 'No listings yet. Be the first to post.' : 'No matching listings found.'}
                </p>
                <div className="mt-4 flex justify-center">
                  <Link href="/sell" className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700">
                    Post listing
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <ListingSection title="Recently Posted" listings={sectionBuckets.recent} />
                <ListingSection title="Electronics" listings={filteredListings.filter((listing) => listing.category === 'Electronics').slice(0, 8)} />
                <ListingSection title="Services" listings={sectionBuckets.services} />
                <ListingSection title="Fashion" listings={filteredListings.filter((listing) => listing.category === 'Fashion').slice(0, 8)} />
                <ListingSection title="Books" listings={filteredListings.filter((listing) => listing.category === 'Books').slice(0, 8)} />
                <ListingSection title="Refurbished Deals" listings={sectionBuckets.refurbished} />
                <ListingSection title="Food" listings={filteredListings.filter((listing) => listing.category === 'Food').slice(0, 8)} />
                <ListingSection title="Business" listings={filteredListings.filter((listing) => listing.category === 'Business').slice(0, 8)} />
                {hasMoreListings ? (
                  <div className="mb-10 flex justify-center">
                    <button
                      type="button"
                      disabled={loadingMore}
                      onClick={async () => {
                        setLoadingMore(true);
                        const { listings: rows, error } = await getListings(20, listings.length);
                        setLoadingMore(false);
                        setError(error);
                        setHasMoreListings(rows.length === 20);
                        setListings((current) => {
                          const nextListings = [...current, ...(rows as Listing[])];
                          window.sessionStorage.setItem('campustrader-home-listings', JSON.stringify(nextListings));
                          return nextListings;
                        });
                      }}
                      className="rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-800 transition hover:border-blue-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-blue-600"
                    >
                      {loadingMore ? 'Loading...' : 'Load more'}
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </>
        )}
      </main>

      {filtersOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 py-4 sm:items-center">
          <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Filters</h2>
              <button onClick={() => setFiltersOpen(false)} className="text-sm font-semibold text-gray-500 dark:text-zinc-400">Close</button>
            </div>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-3">
                <input value={filters.minPrice} onChange={(event) => setFilters((current) => ({ ...current, minPrice: event.target.value }))} placeholder="Min KSh" className="rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" />
                <input value={filters.maxPrice} onChange={(event) => setFilters((current) => ({ ...current, maxPrice: event.target.value }))} placeholder="Max KSh" className="rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" />
              </div>
              <select value={filters.condition} onChange={(event) => setFilters((current) => ({ ...current, condition: event.target.value }))} className="rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white">
                <option value="all">All conditions</option>
                <option value="new">New</option>
                <option value="used">Used</option>
                <option value="refurbished">Refurbished</option>
                <option value="service">Service</option>
              </select>
              <input value={filters.location} onChange={(event) => setFilters((current) => ({ ...current, location: event.target.value }))} placeholder="Location" className="rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" />
              <select value={filters.sellerType} onChange={(event) => setFilters((current) => ({ ...current, sellerType: event.target.value }))} className="rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white">
                <option value="all">All sellers</option>
                <option value="student">Students</option>
                <option value="business">Businesses</option>
              </select>
              <label className="flex items-center justify-between rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white">
                <span>Negotiable only</span>
                <input type="checkbox" checked={filters.negotiableOnly} onChange={(event) => setFilters((current) => ({ ...current, negotiableOnly: event.target.checked }))} />
              </label>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setFilters({ minPrice: '', maxPrice: '', condition: 'all', location: '', sellerType: 'all', negotiableOnly: false });
                  setFiltersOpen(false);
                }}
                className="rounded-2xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 dark:border-zinc-700 dark:text-zinc-200"
              >
                Clear filters
              </button>
              <button onClick={() => setFiltersOpen(false)} className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white">
                Apply filters
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <Link href="/sell" className="fixed bottom-24 right-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-2xl text-white shadow-lg transition hover:scale-110 hover:from-blue-600 hover:to-blue-700 sm:right-6">
        +
      </Link>
      <BottomNav />
    </div>
  );
}
