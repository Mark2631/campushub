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
import { getItemRequests, type ItemRequest } from '../lib/itemRequests';
import { sendMessage } from '../lib/conversations';
import { supabase } from '../lib/supabase';
import { STANDARD_CATEGORIES, listingBelongsToCategory, logCategoryStats, normalizeCategory } from '../lib/categories';

const categories = STANDARD_CATEGORIES;
const listingsPageSize = 24;
const browseTabs = ['All', 'Products', 'Requests', 'Room share', 'Rentals', 'Services', 'Businesses'] as const;
type BrowseTab = typeof browseTabs[number];

function readMarketplaceUrlState() {
  if (typeof window === 'undefined') {
    return { query: '', category: 'All', browseTab: 'All' as BrowseTab };
  }

  const params = new URLSearchParams(window.location.search);
  const rawBrowseTab = params.get('tab') || 'All';
  const browseTab = browseTabs.includes(rawBrowseTab as BrowseTab) ? rawBrowseTab as BrowseTab : 'All';
  const rawCategory = params.get('category') || 'All';
  const category = browseTab !== 'All'
    ? 'All'
    : rawCategory === 'All' || categories.some((category) => category === rawCategory)
      ? rawCategory
      : 'All';

  return { query: params.get('q') || '', category, browseTab };
}

function writeMarketplaceUrlState(
  query: string,
  category: string,
  browseTab: BrowseTab,
  mode: 'push' | 'replace' = 'replace',
) {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams(window.location.search);
  const normalizedQuery = query.trim();
  if (normalizedQuery) params.set('q', normalizedQuery);
  else params.delete('q');

  if (category !== 'All' && browseTab === 'All') params.set('category', category);
  else params.delete('category');

  if (browseTab !== 'All') params.set('tab', browseTab);
  else params.delete('tab');

  const search = params.toString();
  const nextUrl = `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`;
  if (mode === 'push') window.history.pushState({}, '', nextUrl);
  else window.history.replaceState({}, '', nextUrl);
}
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
  const [showingMeruFallback, setShowingMeruFallback] = useState(false);
  const [listings, setListings] = useState<Listing[]>([]);
  const [studentRequests, setStudentRequests] = useState<ItemRequest[]>([]);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<ItemRequest | null>(null);
  const [messagingRequest, setMessagingRequest] = useState(false);
  const [requestMessageError, setRequestMessageError] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [query, setQuery] = useState(() => readMarketplaceUrlState().query);
  const [debouncedQuery, setDebouncedQuery] = useState(() => readMarketplaceUrlState().query.trim());
  const [activeCategory, setActiveCategory] = useState(() => readMarketplaceUrlState().category);
  const [activeBrowseTab, setActiveBrowseTab] = useState<BrowseTab>(() => readMarketplaceUrlState().browseTab);
  const [error, setError] = useState<string | null>(null);
  const [loadingListings, setLoadingListings] = useState(true);
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
    const timeoutId = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timeoutId);
  }, [query]);

  useEffect(() => {
    const restoreFromUrl = () => {
      const state = readMarketplaceUrlState();
      setQuery(state.query);
      setDebouncedQuery(state.query.trim());
      setActiveCategory(state.category);
      setActiveBrowseTab(state.browseTab);
    };
    window.addEventListener('popstate', restoreFromUrl);
    return () => window.removeEventListener('popstate', restoreFromUrl);
  }, []);

  useEffect(() => {
    writeMarketplaceUrlState(debouncedQuery, activeCategory, activeBrowseTab, 'replace');
  }, [debouncedQuery, activeCategory, activeBrowseTab]);

  useEffect(() => {
    let isMounted = true;

    const loadListings = async (options?: { initial?: boolean }) => {
      if (isMounted && options?.initial) setLoadingListings(true);
      const primaryInstitution = user ? institution : 'MUST';
      // Never leave pilot users staring at skeletons indefinitely on a stalled network.
      const result = await Promise.race([
        getListings(listingsPageSize, 0, primaryInstitution),
        new Promise<Awaited<ReturnType<typeof getListings>>>((resolve) =>
          setTimeout(() => resolve({ listings: [], error: 'Listing request timed out. Please retry.' }), 10000)
        ),
      ]);
      const shouldFallback = !result.error && result.listings.length === 0 && primaryInstitution !== 'MUST';
      const fallback = shouldFallback ? await Promise.race([
        getListings(listingsPageSize, 0, 'MUST'),
        new Promise<Awaited<ReturnType<typeof getListings>>>((resolve) =>
          setTimeout(() => resolve({ listings: [], error: 'Listing request timed out. Please retry.' }), 10000)
        ),
      ]) : null;
      const rows = fallback?.listings || result.listings;
      const error = fallback?.error || result.error;
      if (!isMounted) return;
      setShowingMeruFallback(Boolean(shouldFallback && fallback?.listings.length));
      setListings(rows);
      setListingOffset(rows.length);
      setHasMoreListings(rows.length === listingsPageSize);
      setError(error);
      setLoadingListings(false);
    };

    void loadListings({ initial: true });
    const refreshListings = () => {
      void loadListings();
    };
    window.addEventListener('campustrader:listings-refresh', refreshListings);

    return () => {
      isMounted = false;
      window.removeEventListener('campustrader:listings-refresh', refreshListings);
    };
  }, [institution, user?.id]);

  useEffect(() => {
    let mounted = true;
    const refreshRequests = async () => {
      if (mounted) setLoadingRequests(true);
      const { requests, error } = await getItemRequests(30, institution);
      if (!mounted) return;
      setStudentRequests(requests.slice(0, 6));
      setRequestError(error);
      setLoadingRequests(false);
    };
    void refreshRequests();
    window.addEventListener('campustrader:requests-refresh', refreshRequests);
    return () => {
      mounted = false;
      window.removeEventListener('campustrader:requests-refresh', refreshRequests);
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
    const normalizedQuery = debouncedQuery.toLowerCase();
    const activeListings = listings.filter((listing) => String(listing.status ?? 'active').toLowerCase() === 'active');
    const browseText = (listing: Listing) => `${listing.category} ${listing.title} ${listing.description || ''}`.toLowerCase();
    const browseMatches = (listing: Listing) => {
      const text = browseText(listing);
      if (activeBrowseTab === 'All') return true;
      if (activeBrowseTab === 'Products') return String(listing.listing_type || '').toUpperCase() === 'PHYSICAL_PRODUCT';
      if (activeBrowseTab === 'Requests') return /wanted|request|looking for|need /.test(text);
      if (activeBrowseTab === 'Room share') return /roommate|room share|bedsitter|shared room/.test(text);
      if (activeBrowseTab === 'Rentals') return /rent|rental|hostel|apartment|house/.test(text);
      if (activeBrowseTab === 'Businesses') return listingBelongsToCategory(listing, 'Business') || /shop|restaurant|printing|repair/.test(text);
      return listingBelongsToCategory(listing, activeBrowseTab);
    };

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
        browseMatches(listing) &&
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
  }, [activeBrowseTab, activeCategory, debouncedQuery, filters, listings]);

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
  const hasActiveBrowseFilter = activeBrowseTab !== 'All' || activeCategory !== 'All' || Boolean(debouncedQuery) || Boolean(filters.minPrice || filters.maxPrice || filters.location || filters.negotiableOnly || filters.condition !== 'all' || filters.sellerType !== 'all');
  const visibleCategorySections = activeCategory === 'All'
    ? categorySections
    : categorySections.filter((section) => section.category === activeCategory);

  const messageRequestOwner = async () => {
    if (!user || !selectedRequest || messagingRequest || user.id === selectedRequest.user_id) return;
    setMessagingRequest(true);
    setRequestMessageError(null);
    try {
      const { data: existing, error: lookupError } = await supabase.from('conversations')
        .select('id').is('listing_id', null)
        .or(`and(buyer_id.eq.${user.id},seller_id.eq.${selectedRequest.user_id}),and(buyer_id.eq.${selectedRequest.user_id},seller_id.eq.${user.id})`)
        .limit(1).maybeSingle();
      if (lookupError) throw lookupError;
      if (existing) { window.location.assign(`/messages/${existing.id}`); return; }
      const { data: conversation, error: createError } = await supabase.from('conversations')
        .insert({ listing_id: null, buyer_id: user.id, seller_id: selectedRequest.user_id })
        .select('id').single();
      if (createError || !conversation) throw createError || new Error('Conversation could not be created');
      const { error: sendError } = await sendMessage(conversation.id, user.id, `Hi, I’m interested in your request: ${selectedRequest.title}. Is this still needed?`);
      if (sendError) console.warn('Request conversation created, but initial message failed:', sendError);
      window.location.assign(`/messages/${conversation.id}`);
    } catch (err) {
      console.error('Could not start request conversation:', err);
      setRequestMessageError('Could not start a conversation. Please try again.');
    } finally { setMessagingRequest(false); }
  };

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
  <section className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-950 dark:bg-blue-950/30">
    <p className="text-sm font-bold text-blue-900 dark:text-blue-100">Welcome to CampusTrader</p>
    <div className="mt-3 grid gap-2 text-xs text-blue-900/80 sm:grid-cols-3 dark:text-blue-100/80">
      <p><strong>1.</strong> Choose a section below to browse.</p>
      <p><strong>2.</strong> Tap any card once to view details.</p>
      <p><strong>3.</strong> Use Orders for your buying and selling activity.</p>
    </div>
  </section>
  ) : null}

        {!user ? (
          <section className="mb-5 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm dark:border-blue-950 dark:bg-zinc-900">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">Trade faster with a free account.</p>
                <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">Post listings, send messages, explore campus communities, and manage your profile.</p>
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

        <div className="mb-5 -mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max gap-2 pb-1" role="tablist" aria-label="Marketplace sections">
            {['All', 'Products', 'Room share', 'Rentals', 'Services', 'Businesses', ...categories.filter((category) => !['Services', 'Business'].includes(category))].map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={(['All', 'Products', 'Requests', 'Room share', 'Rentals', 'Services', 'Businesses'].includes(tab) ? activeBrowseTab === tab : activeCategory === tab)}
                onClick={() => {
                  if (browseTabs.includes(tab as BrowseTab)) {
                    const nextBrowseTab = tab as BrowseTab;
                    setActiveBrowseTab(nextBrowseTab);
                    setActiveCategory('All');
                    writeMarketplaceUrlState(query, 'All', nextBrowseTab, 'push');
                  } else {
                    setActiveBrowseTab('All');
                    setActiveCategory(tab);
                    writeMarketplaceUrlState(query, tab, 'All', 'push');
                  }
                }}
                className={`shrink-0 rounded-full border px-3.5 py-2 text-sm font-semibold transition ${
                  (['All', 'Products', 'Requests', 'Room share', 'Rentals', 'Services', 'Businesses'].includes(tab) ? activeBrowseTab === tab && activeCategory === 'All' : activeCategory === tab)
                    ? 'border-blue-500 bg-blue-600 text-white'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-blue-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                }`}
              >
                {tab}
              </button>
            ))}
            <button type="button" onClick={() => setFiltersOpen(true)} className="shrink-0 rounded-full border border-gray-300 bg-gray-50 px-3.5 py-2 text-sm font-semibold text-gray-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              More filters
            </button>
          </div>
        </div>

        <div className="mb-6">
          <SafetyBanner />
        </div>

        {showingMeruFallback && !loadingListings ? (
          <p className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">No listings at your institution yet. Showing available listings from Meru University so you can explore CampusTrader.</p>
        ) : null}

        {loadingListings ? (
          <ListingSkeletons />
        ) : (
          <>
            {error ? (
              <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                <p className="font-semibold">Listings are taking longer than expected.</p>
                <p className="mt-1 text-sm">You can retry without losing your search or browse section.</p>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setLoadingListings(true);
                    window.dispatchEvent(new Event('campustrader:listings-refresh'));
                  }}
                  className="mt-3 rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-900 transition hover:border-amber-500 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100"
                >
                  Retry listings
                </button>
              </div>
            ) : null}
            {filteredListings.length === 0 ? (activeBrowseTab === 'Requests' ? null : (
              <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white p-10 text-center text-gray-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-2xl font-semibold text-blue-600 dark:bg-blue-950 dark:text-blue-200">
                  +
                </div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {listings.length === 0
                    ? 'No listings yet. Be the first to post.'
                    : activeBrowseTab === 'All'
                      ? 'No matching listings found.'
                      : `No ${activeBrowseTab.toLowerCase()} found yet.`}
                </p>
                <p className="mx-auto mt-2 max-w-md text-sm">
                  {listings.length === 0
                    ? 'Start with an item, service, or campus deal that students can inspect before paying.'
                    : 'Try another section, clear filters, or post what you need from the Sell tab.'}
                </p>
                <div className="mt-4 flex justify-center">
                    <Link href="/sell" className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700">
                      Post listing
                    </Link>
                </div>
              </div>
            )) : (
              <>
                {!hasActiveBrowseFilter && (sectionBuckets.recent.length > 0 ? (
                  <ListingSection title="Recently Posted" listings={sectionBuckets.recent} />
                ) : (
                  <section className="mb-8 sm:mb-10">
                    <h2 className="mb-3 text-lg font-bold text-gray-900 sm:text-xl dark:text-white">Recently Posted</h2>
                    <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white p-10 text-center text-gray-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
                      <p className="font-semibold text-gray-900 dark:text-white">No fresh listings from the last 2 days.</p>
                    </div>
                  </section>
                ))}
                {hasActiveBrowseFilter ? (
                  <ListingSection title={activeBrowseTab !== 'All' ? activeBrowseTab : activeCategory} listings={filteredListings} />
                ) : (
                  visibleCategorySections.map((section) => (
                    <ListingSection
                      key={section.category}
                      title={section.title}
                      listings={listingsForCategorySection(section.category)}
                    />
                  ))
                )}
                {hasMoreListings ? (
                  <div className="mb-10 flex justify-center">
                    <button
                      type="button"
                      disabled={loadingMore}
                      onClick={async () => {
                        if (loadingMore) return;
                        setLoadingMore(true);
                        try {
                          // Continue from the same institution used by the first page, including the MUST fallback.
                          const loadInstitution = showingMeruFallback ? 'MUST' : institution;
                          const { listings: rows, error: loadError } = await getListings(
                            listingsPageSize,
                            listingOffset,
                            loadInstitution,
                          );

                          if (loadError) {
                            setError(loadError);
                            return;
                          }

                          setError(null);
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
                        } catch (loadError) {
                          console.error('Could not load more listings:', loadError);
                          setError('Could not load more listings. Please try again.');
                        } finally {
                          setLoadingMore(false);
                        }
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
        <section id="campus-requests" className="mt-10 mb-8 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm dark:border-blue-950 dark:bg-zinc-900 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold sm:text-xl">What students are looking for</h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">Open requests from your campus. Have it? Reach out to the requester.</p>
            </div>
            <Link href="/sell?mode=request" className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Post a request</Link>
          </div>
          {loadingRequests ? <p role="status" className="text-sm text-gray-500">Loading requests…</p> : requestError ? (
            <div role="alert" className="rounded-xl border border-amber-200 p-4 text-sm text-amber-800 dark:text-amber-200">
              Requests could not be loaded. <button type="button" className="font-semibold underline" onClick={() => window.dispatchEvent(new Event('campustrader:requests-refresh'))}>Retry</button>
            </div>
          ) : studentRequests.length ? (
            <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-3 [scrollbar-width:thin]">
              {studentRequests.map((request) => (
                <button key={request.id} type="button" onClick={() => { setSelectedRequest(request); setRequestMessageError(null); }} className="w-[78vw] max-w-[290px] shrink-0 snap-start rounded-xl border border-gray-200 bg-white p-4 text-left transition hover:border-blue-400 hover:shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
                  <p className="font-semibold">{request.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-zinc-400">{request.description || 'A student is looking for this item.'}</p>
                  <p className="mt-2 text-xs text-gray-500">{request.location || institution}{request.max_price != null ? ` · Budget up to KSh ${Number(request.max_price).toLocaleString('en-KE')}` : ''}</p>
                  <span className="mt-3 inline-block text-xs font-semibold text-blue-600 dark:text-blue-300">View request & message →</span>
                </button>
              ))}
            </div>
          ) : <p className="rounded-xl border border-dashed border-gray-300 p-5 text-sm text-gray-600 dark:border-zinc-700 dark:text-zinc-400">No open requests are visible for this campus yet. Post the first request.</p>}
        </section>
      </main>

      {selectedRequest ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setSelectedRequest(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="request-detail-title" className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-gray-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-950 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-wide text-blue-600">Campus request · {selectedRequest.category}</p><h2 id="request-detail-title" className="mt-2 text-xl font-bold">{selectedRequest.title}</h2></div>
              <button type="button" onClick={() => setSelectedRequest(null)} aria-label="Close request details" className="rounded-full border border-gray-200 px-3 py-1 text-sm dark:border-zinc-700">Close</button>
            </div>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-gray-600 dark:text-zinc-300">{selectedRequest.description || 'No extra details were provided.'}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-gray-50 p-3 dark:bg-zinc-900"><p className="text-xs text-gray-500">Budget</p><p className="mt-1 font-semibold">{selectedRequest.min_price != null || selectedRequest.max_price != null ? `KSh ${selectedRequest.min_price != null ? Number(selectedRequest.min_price).toLocaleString('en-KE') : '0'} – ${selectedRequest.max_price != null ? Number(selectedRequest.max_price).toLocaleString('en-KE') : 'Open'}` : 'Not specified'}</p></div>
              <div className="rounded-xl bg-gray-50 p-3 dark:bg-zinc-900"><p className="text-xs text-gray-500">Location</p><p className="mt-1 font-semibold">{selectedRequest.location || institution || 'Campus'}</p></div>
            </div>
            {user?.id === selectedRequest.user_id ? <p className="mt-5 rounded-xl bg-gray-50 p-3 text-sm text-gray-600 dark:bg-zinc-900 dark:text-zinc-300">This is your request. Other students can message you about it.</p> : !user ? (
              <Link href="/signin?mode=signin" className="mt-5 block rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white">Sign in to message requester</Link>
            ) : (
              <button type="button" disabled={messagingRequest} onClick={messageRequestOwner} className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50">{messagingRequest ? 'Opening conversation…' : 'Message requester'}</button>
            )}
            {requestMessageError ? <p role="alert" className="mt-3 text-sm text-red-600">{requestMessageError}</p> : null}
          </section>
        </div>
      ) : null}

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
