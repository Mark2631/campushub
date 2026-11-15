'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDownWideNarrow, PackageSearch, Search, SlidersHorizontal, X } from 'lucide-react';
import BottomNav from '../components/BottomNav';
import Header from '../components/Header';
import ListingCard from '../components/ListingCard';
import useUser from '../hooks/useUser';
import { getListings, Listing } from '../lib/listings';
import { STANDARD_CATEGORIES, listingBelongsToCategory } from '../lib/categories';

const pageSize = 24;
const productCategories = ['All', ...STANDARD_CATEGORIES.filter((category) => category !== 'Services' && category !== 'Business')];

type SortOrder = 'newest' | 'price-low' | 'price-high';

function isProductListing(listing: Listing) {
  const type = String(listing.listing_type || '').toUpperCase();
  return type === 'PHYSICAL_PRODUCT' || (!type && String(listing.condition).toLowerCase() !== 'service');
}

function ListingSkeletons() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="aspect-square animate-pulse bg-slate-100 dark:bg-slate-800" />
          <div className="space-y-2 p-3">
            <div className="h-3 w-4/5 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
            <div className="h-4 w-2/5 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
            <div className="h-3 w-full animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const { user, institution } = useUser();
  const isSignedIn = Boolean(user?.id);
  const [listings, setListings] = useState<Listing[]>([]);
  const [feedInstitution, setFeedInstitution] = useState('MUST');
  const [browseScope, setBrowseScope] = useState<'campus' | 'all'>('campus');
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [condition, setCondition] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadFirstPage = async () => {
      setLoading(true);
      setError(null);
      const primaryInstitution = browseScope === 'all' ? '' : isSignedIn ? institution : 'MUST';
      const result = await Promise.race([
        getListings(pageSize, 0, primaryInstitution),
        new Promise<Awaited<ReturnType<typeof getListings>>>((resolve) => {
          window.setTimeout(() => resolve({ listings: [], error: 'The catalogue took too long to respond. Please retry.' }), 10000);
        }),
      ]);

      let finalResult = result;
      let effectiveInstitution = browseScope === 'all' ? 'ALL' : primaryInstitution;
      if (!result.error && result.listings.length === 0 && primaryInstitution && primaryInstitution !== 'MUST') {
        finalResult = await Promise.race([
          getListings(pageSize, 0, 'MUST'),
          new Promise<Awaited<ReturnType<typeof getListings>>>((resolve) => {
            window.setTimeout(() => resolve({ listings: [], error: 'The catalogue took too long to respond. Please retry.' }), 10000);
          }),
        ]);
        effectiveInstitution = 'MUST';
      }

      if (!active) return;
      setFeedInstitution(effectiveInstitution);
      setListings(finalResult.listings);
      setOffset(finalResult.listings.length);
      setHasMore(finalResult.listings.length === pageSize);
      setError(finalResult.error);
      setLoading(false);
    };

    void loadFirstPage();
    window.addEventListener('campustrader:listings-refresh', loadFirstPage);
    return () => {
      active = false;
      window.removeEventListener('campustrader:listings-refresh', loadFirstPage);
    };
  }, [browseScope, institution, isSignedIn]);

  const availableProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const min = minPrice.trim() ? Number(minPrice) : null;
    const max = maxPrice.trim() ? Number(maxPrice) : null;

    const filtered = listings.filter((listing) => {
      if (String(listing.status || 'active').toLowerCase() !== 'active' || !isProductListing(listing)) return false;

      const categoryMatch = activeCategory === 'All' || listingBelongsToCategory(listing, activeCategory);
      const text = [
        listing.title,
        listing.description || '',
        listing.category,
        listing.location || '',
        listing.campus || '',
        listing.sellerName || '',
      ].join(' ').toLowerCase();
      const searchMatch = !normalizedQuery || text.includes(normalizedQuery);
      const price = typeof listing.price === 'number' && listing.price > 0 ? listing.price : null;
      const minMatch = min == null || (price != null && price >= min);
      const maxMatch = max == null || (price != null && price <= max);
      const conditionMatch = condition === 'all' || String(listing.condition).toLowerCase() === condition;

      return categoryMatch && searchMatch && minMatch && maxMatch && conditionMatch;
    });

    return filtered.sort((a, b) => {
      if (sortOrder === 'price-low') {
        return (a.price && a.price > 0 ? a.price : Number.POSITIVE_INFINITY)
          - (b.price && b.price > 0 ? b.price : Number.POSITIVE_INFINITY);
      }
      if (sortOrder === 'price-high') {
        return (b.price && b.price > 0 ? b.price : -1)
          - (a.price && a.price > 0 ? a.price : -1);
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [activeCategory, condition, listings, maxPrice, minPrice, query, sortOrder]);

  const activeFilterCount = Number(Boolean(query.trim())) + Number(activeCategory !== 'All') + Number(Boolean(minPrice.trim())) + Number(Boolean(maxPrice.trim())) + Number(condition !== 'all');

  const campusBusinessProducts = useMemo(() => availableProducts.filter((listing) => listing.sellerType === 'business').slice(0, 4), [availableProducts]);
  const categoryShelves = useMemo(() => productCategories.slice(1).map((category) => ({
    category,
    listings: availableProducts
      .filter((listing) => !campusBusinessProducts.some((businessListing) => businessListing.id === listing.id))
      .filter((listing) => listingBelongsToCategory(listing, category))
      .slice(0, 4),
  })).filter((section) => section.listings.length > 0), [availableProducts, campusBusinessProducts]);
  const showCategoryShelves = activeFilterCount === 0;

  const clearFilters = () => {
    setMinPrice('');
    setMaxPrice('');
    setCondition('all');
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const result = await getListings(pageSize, offset, feedInstitution === 'ALL' ? '' : feedInstitution);
      if (result.error) {
        setError(result.error);
        return;
      }
      setListings((current) => {
        const next = [...current];
        result.listings.forEach((listing) => {
          if (!next.some((existing) => existing.id === listing.id)) next.push(listing);
        });
        return next;
      });
      setOffset((current) => current + result.listings.length);
      setHasMore(result.listings.length === pageSize);
    } catch (loadError) {
      console.error('Could not load more CampusTrader products:', loadError);
      setError('More products could not be loaded. Please try again.');
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-32 pt-5 sm:px-6 sm:pt-7">
        <section className="mb-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-300">CampusTrader marketplace</p>
          <h1 className="mt-2 max-w-3xl text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl dark:text-white">
            Good finds, closer to campus.
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base dark:text-slate-300">
            Find products from students and campus businesses across participating campuses.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">Browse</span>
            <button
              type="button"
              aria-pressed={browseScope === 'campus'}
              onClick={() => setBrowseScope('campus')}
              className={browseScope === 'campus'
                ? 'min-h-9 rounded-lg border border-blue-600 bg-blue-50 px-3 text-xs font-semibold text-blue-800 dark:bg-blue-950/40 dark:text-blue-200'
                : 'min-h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'}
            >
              {isSignedIn ? 'My campus' : 'MUST'}
            </button>
            <button
              type="button"
              aria-pressed={browseScope === 'all'}
              onClick={() => setBrowseScope('all')}
              className={browseScope === 'all'
                ? 'min-h-9 rounded-lg border border-blue-600 bg-blue-50 px-3 text-xs font-semibold text-blue-800 dark:bg-blue-950/40 dark:text-blue-200'
                : 'min-h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'}
            >
              All campuses
            </button>
            {browseScope === 'all' ? (
              <span className="text-[10px] text-slate-500 dark:text-slate-400">Items show their campus on each card</span>
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Browse products</span>
            <span aria-hidden="true">/</span>
            <span>Ask a question</span>
            <span aria-hidden="true">/</span>
            <span>Arrange the handover</span>
          </div>
        </section>

        <section id="marketplace-search" className="scroll-mt-24">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-sm transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10 dark:border-slate-800 dark:bg-slate-900">
            <Search className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search products, brands or campus essentials"
              aria-label="Search products"
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500"
            />
            {query ? (
              <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-4 w-4" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-700 hover:border-blue-300 dark:border-slate-700 dark:text-slate-200"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filter
              {activeFilterCount > 0 ? <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] text-white">{activeFilterCount}</span> : null}
            </button>
          </div>
        </section>

        <nav aria-label="Shop by category" className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {productCategories.slice(1).map((category) => {
            const details: Record<string, string> = {
              Electronics: 'Phones, laptops, gadgets',
              Fashion: 'Clothes and accessories',
              Furniture: 'Room and home essentials',
              Books: 'Textbooks and study material',
              Food: 'Meals and snacks',
              Refurbished: 'Restored and renewed',
              Services: 'Repairs and campus help',
              Business: 'Products from local shops',
              Other: 'More campus finds',
            };
            return (
              <button
                key={category}
                type="button"
                aria-pressed={activeCategory === category}
                onClick={() => setActiveCategory(category)}
                className={activeCategory === category
                  ? 'min-h-[76px] rounded-xl border border-blue-600 bg-blue-50 px-3 py-3 text-left dark:bg-blue-950/30'
                  : 'min-h-[76px] rounded-xl border border-slate-200 bg-white px-3 py-3 text-left transition hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900'}
              >
                <span className="block text-xs font-bold text-slate-900 dark:text-white">{category}</span>
                <span className="mt-1 block text-[10px] leading-4 text-slate-500 dark:text-slate-400">{details[category] || 'Explore products'}</span>
              </button>
            );
          })}
        </nav>

        {(query.trim() || activeCategory !== 'All' || minPrice.trim() || maxPrice.trim() || condition !== 'all') ? (
          <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Applied filters">
            {query.trim() ? (
              <button type="button" onClick={() => setQuery('')} aria-label="Remove search filter" className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-700 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                Search: {query.trim()} <X className="h-3 w-3" aria-hidden="true" />
              </button>
            ) : null}
            {activeCategory !== 'All' ? (
              <button type="button" onClick={() => setActiveCategory('All')} aria-label="Remove category filter" className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-700 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                {activeCategory} <X className="h-3 w-3" aria-hidden="true" />
              </button>
            ) : null}
            {minPrice.trim() ? (
              <button type="button" onClick={() => setMinPrice('')} aria-label="Remove minimum price filter" className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-700 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                From KSh {minPrice.trim()} <X className="h-3 w-3" aria-hidden="true" />
              </button>
            ) : null}
            {maxPrice.trim() ? (
              <button type="button" onClick={() => setMaxPrice('')} aria-label="Remove maximum price filter" className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-700 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                Up to KSh {maxPrice.trim()} <X className="h-3 w-3" aria-hidden="true" />
              </button>
            ) : null}
            {condition !== 'all' ? (
              <button type="button" onClick={() => setCondition('all')} aria-label="Remove condition filter" className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium capitalize text-slate-700 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                {condition} <X className="h-3 w-3" aria-hidden="true" />
              </button>
            ) : null}
            <button type="button" onClick={() => { setQuery(''); setActiveCategory('All'); clearFilters(); }} className="min-h-8 px-2 py-1 text-[11px] font-semibold text-blue-700 underline underline-offset-2 dark:text-blue-300">
              Clear all
            </button>
          </div>
        ) : null}

        <section className="mt-7">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-950 dark:text-white">
                {activeCategory === 'All' ? 'Explore products' : activeCategory}
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {loading ? 'Finding available products…' : availableProducts.length + ' products in the current results'}
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <ArrowDownWideNarrow className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Sort products</span>
              <select
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value as SortOrder)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 outline-none hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
              >
                <option value="newest">Newest first</option>
                <option value="price-low">Price: low to high</option>
                <option value="price-high">Price: high to low</option>
              </select>
            </label>
          </div>

          {error ? (
            <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              <span>{error}</span>
              <button type="button" onClick={() => window.dispatchEvent(new Event('campustrader:listings-refresh'))} className="font-semibold underline underline-offset-2">Retry</button>
            </div>
          ) : null}

          {loading ? (
            <ListingSkeletons />
          ) : availableProducts.length > 0 ? (
            showCategoryShelves ? (
              <div className="space-y-8">
                {campusBusinessProducts.length > 0 ? (
                  <section>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-bold text-slate-950 dark:text-white">Campus businesses</h3>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Products from local campus shops</p>
                      </div>
                      <Link href="/profile?setup=business" className="shrink-0 text-xs font-semibold text-blue-700 underline underline-offset-2 dark:text-blue-300">Promote a business</Link>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                      {campusBusinessProducts.map((listing) => <ListingCard key={listing.id} listing={listing} showCampus={browseScope === 'all'} />)}
                    </div>
                  </section>
                ) : null}
                {categoryShelves.map(({ category, listings: sectionListings }) => (
                  <section key={category}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-bold text-slate-950 dark:text-white">{category}</h3>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Recent products in this department</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveCategory(category)}
                        className="shrink-0 text-xs font-semibold text-blue-700 underline underline-offset-2 dark:text-blue-300"
                      >
                        View all
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                      {sectionListings.map((listing) => <ListingCard key={listing.id} listing={listing} showCampus={browseScope === 'all'} />)}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                {availableProducts.map((listing) => <ListingCard key={listing.id} listing={listing} showCampus={browseScope === 'all'} />)}
              </div>
            )
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center dark:border-slate-700 dark:bg-slate-900">
              <PackageSearch className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
              <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">
                {listings.length === 0 ? 'The catalogue is just getting started.' : 'No matching products found.'}
              </h3>
              <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
                {listings.length === 0
                  ? 'Products appear here after CampusTrader management reviews the details and sets the public price.'
                  : "Try another search or category. Can't find it? Send a product request and management can check with campus sellers."}
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {activeFilterCount > 0 || query || activeCategory !== 'All' ? (
                  <button type="button" onClick={() => { setQuery(''); setActiveCategory('All'); clearFilters(); }} className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
                    Clear search and filters
                  </button>
                ) : null}
                <Link href="/sell?mode=request" className="rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white">
                  Request a product
                </Link>
              </div>
            </div>
          )}

          {!loading && hasMore ? (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="min-h-11 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 transition hover:border-blue-300 disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
              >
                {loadingMore ? 'Loading products…' : 'Load more products'}
              </button>
            </div>
          ) : null}
        </section>

        <section className="mt-10 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Advertise your campus business</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Send us your item details. Management checks the listing and sets the public price before it goes live.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/profile?setup=business" className="inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white">
              Business profile
            </Link>
            <Link href="/sell" className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
              Submit an item
            </Link>
            <Link href="/help" className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
              How it works
            </Link>
          </div>
        </section>
      </main>

      {filtersOpen ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/50 p-3 sm:items-center" onClick={() => setFiltersOpen(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-filters-title"
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-950"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 id="product-filters-title" className="text-base font-bold text-slate-900 dark:text-white">Filter products</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Narrow down what you see.</p>
              </div>
              <button type="button" onClick={() => setFiltersOpen(false)} aria-label="Close filters" className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Minimum price
                <input inputMode="numeric" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} placeholder="KSh 0" className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-normal text-slate-900 outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white" />
              </label>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Maximum price
                <input inputMode="numeric" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder="Any" className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-normal text-slate-900 outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white" />
              </label>
            </div>
            <label className="mt-4 block text-xs font-semibold text-slate-600 dark:text-slate-300">
              Condition
              <select value={condition} onChange={(event) => setCondition(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-normal text-slate-900 outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white">
                <option value="all">Any condition</option>
                <option value="new">New</option>
                <option value="used">Used</option>
                <option value="refurbished">Refurbished</option>
              </select>
            </label>
            <div className="mt-6 flex gap-2">
              <button type="button" onClick={clearFilters} className="min-h-11 flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
                Clear
              </button>
              <button type="button" onClick={() => setFiltersOpen(false)} className="min-h-11 flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white">
                Show products
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <BottomNav />
    </div>
  );
}
