'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import BottomNav from '../components/BottomNav';
import Header from '../components/Header';
import ListingCard from '../components/ListingCard';
import SafetyBanner from '../components/SafetyBanner';
import useUser from '../hooks/useUser';
import { getListings, getServiceListings, Listing } from '../lib/listings';
import { getProfileById } from '../lib/profiles';
import { STANDARD_CATEGORIES, listingBelongsToCategory, logCategoryStats, normalizeCategory } from '../lib/categories';

const categories = STANDARD_CATEGORIES;
const listingsPageSize = 60;
const categorySections = [
  { title: 'Electronics', category: 'Electronics' },
  { title: 'Services', category: 'Services' },
  { title: 'Fashion', category: 'Fashion' },
  { title: 'Books', category: 'Books' },
  { title: 'Refurbished Deals', category: 'Refurbished' },
  { title: 'Food', category: 'Food' },
  { title: 'Business', category: 'Business' },
  { title: 'Other', category: 'Other' },
] as const;

function readCachedHomeListings() {
  if (typeof window === 'undefined') return [] as Listing[];

  try {
    const cached = window.sessionStorage.getItem('campustrader-home-listings');
    if (!cached) return [] as Listing[];
    return JSON.parse(cached) as Listing[];
  } catch {
    window.sessionStorage.removeItem('campustrader-home-listings');
    return [] as Listing[];
  }
}

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
  const { user, institution } = useUser();
  const [cachedListings] = useState(readCachedHomeListings);
  const [listings, setListings] = useState<Listing[]>(cachedListings);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [error, setError] = useState<string | null>(null);
  const [loadingListings, setLoadingListings] = useState(cachedListings.length === 0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreListings, setHasMoreListings] = useState(true);
  const [listingOffset, setListingOffset] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showWelcome] = useState(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('welcome') === '1';
  });
  const [currentTime] = useState(() => Date.now());
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
      const [{ listings: rows, error }, { listings: serviceRows }] = await Promise.all([
        getListings(listingsPageSize, 0, institution),
        getServiceListings(12, institution),
      ]);
      if (!isMounted) return;
      const mergedRows = [...(rows as Listing[])];
      serviceRows.forEach((listing) => {
        if (!mergedRows.some((item) => item.id === listing.id)) {
          mergedRows.push(listing);
        }
      });
      setListings(mergedRows);
      window.sessionStorage.setItem('campustrader-home-listings', JSON.stringify(mergedRows));
      setListingOffset(rows.length);
      setHasMoreListings(rows.length === listingsPageSize);
      setError(error);
      setLoadingListings(false);
    };

    loadListings();
    const refreshListings = () => {
      void loadListings();
    };
    window.addEventListener('campustrader:listings-refresh', refreshListings);

    return () => {
      isMounted = false;
      window.removeEventListener('campustrader:listings-refresh', refreshListings);
    };
  }, [institution]);

  useEffect(() => {
    logCategoryStats(listings);
  }, [listings]);

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
    const activeListings = listings.filter((listing) => String(listing.status ?? 'active').toLowerCase() === 'active');

    return activeListings.filter((listing) => {
      const normalizedCategory = normalizeCategory(listing.category);
      const matchesCategory = activeCategory === 'All' || listingBelongsToCategory(listing, activeCategory);
      const matchesQuery =
        !normalizedQuery ||
        listing.title.toLowerCase().includes(normalizedQuery) ||
        normalizedCategory.toLowerCase().includes(normalizedQuery) ||
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
    const twoDaysAgo = currentTime - 2 * 24 * 60 * 60 * 1000;

    const recent = [...filteredListings]
      .filter((listing) => {
        const createdAt = new Date(listing.created_at).getTime();
        return Number.isFinite(createdAt) && createdAt >= twoDaysAgo;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 12);

    const services = filteredListings
      .filter((listing) => listingBelongsToCategory(listing, 'Services'))
      .slice(0, 8);

    const refurbished = filteredListings
      .filter((listing) => listingBelongsToCategory(listing, 'Refurbished'))
      .slice(0, 8);

    return { recent, services, refurbished };
  }, [currentTime, filteredListings]);

  const greetingName = profileName || user?.email?.split('@')[0];
  const greeting = `${getGreeting()}${greetingName ? `, ${greetingName}` : ''}`;
  const visibleCategorySections = activeCategory === 'All'
    ? categorySections
    : categorySections.filter((section) => section.category === activeCategory);

  const listingsForCategorySection = (category: string) => {
    if (category === 'Services') return sectionBuckets.services;
    if (category === 'Refurbished') return sectionBuckets.refurbished;
    return filteredListings.filter((listing) => listingBelongsToCategory(listing, category)).slice(0, 8);
  };

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

        {!user ? (
          <section className="mb-5 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm dark:border-blue-950 dark:bg-zinc-900">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">Trade faster with a free account.</p>
                <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">Post listings, send messages, follow MUST groups, and manage your profile.</p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <Link href="/signin?mode=signup" className="rounded-2xl bg-blue-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-blue-700">
                  Create account
                </Link>
                <Link href="/signin?mode=signin" className="rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-center text-sm font-semibold text-gray-700 transition hover:border-blue-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
                  Sign in
                </Link>
              </div>
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
                <p className="font-semibold">Something went wrong loading listings.</p>
                <p className="mt-1 text-sm">Try refreshing the page.</p>
              </div>
            ) : null}
            {filteredListings.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white p-10 text-center text-gray-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-2xl font-black text-blue-600 dark:bg-blue-950 dark:text-blue-200">
                  +
                </div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {listings.length === 0 ? 'No listings yet. Be the first to post.' : 'No matching listings found.'}
                </p>
                <p className="mx-auto mt-2 max-w-md text-sm">
                  {listings.length === 0
                    ? 'Start with an item, service, or campus deal that MUST students can inspect before paying.'
                    : 'Try a different category, clear filters, or post what you need from the Sell tab.'}
                </p>
                <div className="mt-4 flex justify-center">
                  <Link href="/sell" className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700">
                    Post listing
                  </Link>
                </div>
              </div>
            ) : (
              <>
                {sectionBuckets.recent.length > 0 ? (
                  <ListingSection title="Recently Posted" listings={sectionBuckets.recent} />
                ) : (
                  <section className="mb-8 sm:mb-10">
                    <h2 className="mb-3 text-lg font-bold text-gray-900 sm:text-xl dark:text-white">Recently Posted</h2>
                    <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white p-10 text-center text-gray-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
                      <p className="font-semibold text-gray-900 dark:text-white">No fresh listings from the last 2 days.</p>
                    </div>
                  </section>
                )}
                {visibleCategorySections.map((section) => (
                  <ListingSection
                    key={section.category}
                    title={section.title}
                    listings={listingsForCategorySection(section.category)}
                  />
                ))}
                {hasMoreListings ? (
                  <div className="mb-10 flex justify-center">
                    <button
                      type="button"
                      disabled={loadingMore}
                      onClick={async () => {
                        setLoadingMore(true);
                        const { listings: rows, error } = await getListings(listingsPageSize, listingOffset, institution);
                        setLoadingMore(false);
                        setError(error);
                        setListingOffset((current) => current + rows.length);
                        setHasMoreListings(rows.length === listingsPageSize);
                        setListings((current) => {
                          const nextListings = [...current];
                          (rows as Listing[]).forEach((listing) => {
                            if (!nextListings.some((item) => item.id === listing.id)) {
                              nextListings.push(listing);
                            }
                          });
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
