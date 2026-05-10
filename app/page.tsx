'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import BottomNav from '../components/BottomNav';
import Header from '../components/Header';
import ListingCard from '../components/ListingCard';
import SafetyBanner from '../components/SafetyBanner';
import useUser from '../hooks/useUser';
import { getListings, Listing } from '../lib/listings';
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
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5 xl:grid-cols-6">
          {listings.map((listing) => (
            <ListingCard key={`${title}-${listing.id}`} listing={listing} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white p-10 text-center text-gray-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          <p className="font-semibold text-gray-900 dark:text-white">No listings here yet</p>
          <p className="mt-1 text-sm">Check back soon or post the first item in this category.</p>
        </div>
      )}
    </section>
  );
}

export default function Home() {
  const { user } = useUser();
  const [listings, setListings] = useState<Listing[]>([]);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [error, setError] = useState<string | null>(null);
  const [loadingListings, setLoadingListings] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
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
      if (isMounted) {
        setLoadingListings(true);
      }
      const { listings: rows, error } = await getListings(60);
      if (!isMounted) return;
      setListings(rows as Listing[]);
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

      return matchesCategory && matchesQuery && matchesMinPrice && matchesMaxPrice && matchesCondition && matchesLocation && matchesSellerType && matchesNegotiable;
    });
  }, [activeCategory, filters, listings, query]);

  const sectionListings = (category: string) => {
    const exact = filteredListings.filter((listing) => listing.category === category);
    return (exact.length >= 6 ? exact : [...exact, ...filteredListings.filter((listing) => listing.category !== category)]).slice(0, 6);
  };

  const verifiedBusinessListings = filteredListings.filter((listing) => listing.business_id || listing.badgeType === 'gold').slice(0, 6);
  const studentEssentialsListings = filteredListings
    .filter((listing) => ['Electronics', 'Books', 'Furniture', 'Other'].includes(listing.category))
    .slice(0, 12);

  const greetingName = profileName || user?.email?.split('@')[0];
  const greeting = `${getGreeting()}${greetingName ? `, ${greetingName}` : ''}`;

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-gray-50 to-gray-100 text-gray-900 dark:bg-gradient-to-br dark:from-black dark:to-zinc-950 dark:text-white">
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-4 pb-32 sm:px-4 sm:py-6">
        <header className="mb-4 sm:mb-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">{greeting}</p>
          <h1 className="mt-1 text-xl font-bold text-gray-900 sm:text-3xl dark:text-white">Find campus deals you can inspect before paying.</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-zinc-400">Students and nearby registered businesses trading across trusted campus communities.</p>
        </header>

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
          <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center text-gray-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            Loading listings...
          </div>
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
                <ListingSection title="Recently Posted" listings={filteredListings.slice(0, 12)} />
                <ListingSection title="Services Around Campus" listings={sectionListings('Services')} />
                <ListingSection title="Refurbished Deals" listings={sectionListings('Refurbished')} />
                <ListingSection title="Student Essentials" listings={studentEssentialsListings} />
                <ListingSection title="Verified Businesses" listings={verifiedBusinessListings} />
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
