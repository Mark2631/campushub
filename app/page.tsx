'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight, ArrowUpDown, BookOpen, BriefcaseBusiness, Cable, ChefHat,
  ChevronRight, MapPin, MessageCircle, PackageOpen, Search, ShieldCheck,
  SlidersHorizontal, Sofa, Store, Tag, Users, Wrench, X, Shirt, Recycle, Sparkles
} from 'lucide-react';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import ListingCard from '../components/ListingCard';
import GettingStartedChecklist from '../components/GettingStartedChecklist';
import SafetyBanner from '../components/SafetyBanner';
import useUser from '../hooks/useUser';
import { getListings, type Listing } from '../lib/listings';
import { getItemRequests, deleteItemRequest, type ItemRequest } from '../lib/itemRequests';
import { sendMessage } from '../lib/conversations';
import { supabase } from '../lib/supabase';
import { STANDARD_CATEGORIES, listingBelongsToCategory } from '../lib/categories';

const PAGE_SIZE = 24;

const categoryMeta = [
  { name: 'Electronics', description: 'Phones, laptops and accessories', Icon: Cable },
  { name: 'Books', description: 'Textbooks and revision guides', Icon: BookOpen },
  { name: 'Fashion', description: 'Clothing, shoes and bags', Icon: Shirt },
  { name: 'Furniture', description: 'Room and study essentials', Icon: Sofa },
  { name: 'Food', description: 'Meals, snacks and treats', Icon: ChefHat },
  { name: 'Services', description: 'Repairs, design and skills', Icon: Wrench },
  { name: 'Refurbished', description: 'Pre-owned value finds', Icon: Recycle },
  { name: 'Business', description: 'Shops and campus businesses', Icon: BriefcaseBusiness },
] as const;

type BrowseMode = 'All' | 'Products' | 'Services' | 'Businesses';
type SortMode = 'newest' | 'price-low' | 'price-high';

async function getListingsWithDeadline(campus: string, offset = 0) {
  let timer: number | undefined;
  try {
    return await Promise.race([
      getListings(PAGE_SIZE, offset, campus),
      new Promise<Awaited<ReturnType<typeof getListings>>>((resolve) => {
        timer = window.setTimeout(() => resolve({ listings: [], error: 'Listings are taking longer than expected. Please retry.' }), 10000);
      }),
    ]);
  } finally {
    if (timer) window.clearTimeout(timer);
  }
}

const formatListingPrice = (listing: Listing) =>
  typeof listing.price === 'number' && listing.price > 0
    ? 'KSh ' + listing.price.toLocaleString('en-KE')
    : 'Ask seller for price';

function ListingSkeletons() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 10 }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-[18px] border border-[var(--border)] bg-[var(--surface)]">
          <div className="aspect-square animate-pulse bg-[var(--surface-muted)]" />
          <div className="space-y-2.5 p-3.5">
            <div className="h-3 w-5/6 animate-pulse rounded bg-[var(--surface-muted)]" />
            <div className="h-4 w-2/5 animate-pulse rounded bg-[var(--surface-muted)]" />
            <div className="h-3 w-3/5 animate-pulse rounded bg-[var(--surface-muted)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ title, description, onClear }: { title: string; description: string; onClear?: () => void }) {
  return (
    <div className="rounded-[22px] border border-dashed border-[var(--border)] bg-[var(--surface)] px-5 py-12 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)]">
        <PackageOpen className="h-6 w-6" strokeWidth={1.6} />
      </span>
      <h3 className="mt-4 text-base font-bold text-[var(--foreground)]">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-[var(--muted)]">{description}</p>
      {onClear ? <button type="button" onClick={onClear} className="mt-4 rounded-full bg-[var(--brand)] px-4 py-2.5 text-xs font-bold text-white hover:bg-[var(--brand-strong)]">Clear search and filters</button> : null}
    </div>
  );
}

function SectionHeading({ title, subtitle, href, action = 'View all' }: { title: string; subtitle?: string; href?: string; action?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-[18px] font-extrabold tracking-[-0.04em] text-[var(--foreground)] sm:text-[20px]">{title}</h2>
        {subtitle ? <p className="mt-1 text-xs text-[var(--muted)] sm:text-sm">{subtitle}</p> : null}
      </div>
      {href ? <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[var(--brand)] transition hover:gap-2">{action}<ArrowRight className="h-3.5 w-3.5" /></Link> : null}
    </div>
  );
}

function formatRequestBudget(request: ItemRequest) {
  if (request.min_price == null && request.max_price == null) return 'Budget not specified';
  if (request.min_price != null && request.max_price != null) return 'KSh ' + Number(request.min_price).toLocaleString('en-KE') + ' – ' + Number(request.max_price).toLocaleString('en-KE');
  if (request.max_price != null) return 'Up to KSh ' + Number(request.max_price).toLocaleString('en-KE');
  return 'From KSh ' + Number(request.min_price).toLocaleString('en-KE');
}

export default function Home() {
  const router = useRouter();
  const { user, institution, isAdmin } = useUser();
  const [listings, setListings] = useState<Listing[]>([]);
  const [requests, setRequests] = useState<ItemRequest[]>([]);
  const [loadingListings, setLoadingListings] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listingError, setListingError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [showingMeruFallback, setShowingMeruFallback] = useState(false);
  const [listingCampus, setListingCampus] = useState('MUST');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [mode, setMode] = useState<BrowseMode>(() => {
    if (typeof window === 'undefined') return 'All';
    const value = new URLSearchParams(window.location.search).get('mode');
    return value === 'Products' || value === 'Services' || value === 'Businesses' ? value : 'All';
  });
  const [category, setCategory] = useState(() => {
    if (typeof window === 'undefined') return 'All';
    const value = new URLSearchParams(window.location.search).get('category');
    return value && STANDARD_CATEGORIES.includes(value as typeof STANDARD_CATEGORIES[number]) ? value : 'All';
  });
  const [sort, setSort] = useState<SortMode>('newest');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({
    minPrice: '',
    maxPrice: '',
    condition: 'all',
    location: '',
    seller: 'all',
    negotiableOnly: false,
  });
  const [deletingRequest, setDeletingRequest] = useState<string | null>(null);
  const [messagingRequest, setMessagingRequest] = useState<string | null>(null);
  const [requestActionError, setRequestActionError] = useState<string | null>(null);


  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoadingListings(true);
      setListingError(null);
      const campus = user ? institution : 'MUST';
      const primary = await getListingsWithDeadline(campus);
      let rows = primary.listings || [];
      let error = primary.error || null;
      let fellBack = false;
      let resolvedCampus = campus;

      if (!error && rows.length === 0 && campus !== 'MUST') {
        const fallback = await getListingsWithDeadline('MUST');
        if (fallback.listings?.length) {
          rows = fallback.listings;
          error = null;
          fellBack = true;
          resolvedCampus = 'MUST';
        } else if (fallback.error) {
          error = fallback.error;
        }
      }

      if (!active) return;
      setListings(rows);
      setListingCampus(resolvedCampus);
      setOffset(rows.length);
      setHasMore(rows.length === PAGE_SIZE);
      setListingError(error);
      setShowingMeruFallback(fellBack);
      setLoadingListings(false);
    };

    void load();
    const refresh = () => void load();
    window.addEventListener('campustrader:listings-refresh', refresh);
    return () => {
      active = false;
      window.removeEventListener('campustrader:listings-refresh', refresh);
    };
  }, [institution, user?.id]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoadingRequests(true);
      const result = await getItemRequests(isAdmin ? 100 : 30, institution, isAdmin);
      if (!active) return;
      setRequests(result.requests || []);
      setRequestError(result.error || null);
      setLoadingRequests(false);
    };
    void load();
    const refresh = () => void load();
    window.addEventListener('campustrader:requests-refresh', refresh);
    return () => {
      active = false;
      window.removeEventListener('campustrader:requests-refresh', refresh);
    };
  }, [institution, isAdmin, user?.id]);

  const filteredListings = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const results = listings.filter((listing) => {
      if (String(listing.status || 'active').toLowerCase() !== 'active') return false;
      const text = [listing.title, listing.description || '', listing.category, listing.location || '', listing.sellerName || ''].join(' ').toLowerCase();
      const matchesQuery = !normalizedQuery || text.includes(normalizedQuery);
      const matchesCategory = category === 'All' || listingBelongsToCategory(listing, category);
      const listingType = String(listing.listing_type || '').toUpperCase();
      const matchesMode = mode === 'All'
        || (mode === 'Products' && !['SERVICE', 'SERVICES'].includes(listingType) && !listingBelongsToCategory(listing, 'Services'))
        || (mode === 'Services' && listingBelongsToCategory(listing, 'Services'))
        || (mode === 'Businesses' && (listing.sellerType === 'business' || Boolean(listing.business_id)));
      const price = typeof listing.price === 'number' && listing.price > 0 ? listing.price : null;
      const min = filters.minPrice.trim() ? Number(filters.minPrice) : null;
      const max = filters.maxPrice.trim() ? Number(filters.maxPrice) : null;
      const matchesMin = min == null || (price != null && price >= min);
      const matchesMax = max == null || (price != null && price <= max);
      const matchesCondition = filters.condition === 'all' || String(listing.condition).toLowerCase() === filters.condition;
      const matchesLocation = !filters.location.trim() || (listing.location || '').toLowerCase().includes(filters.location.trim().toLowerCase());
      const matchesSeller = filters.seller === 'all' || listing.sellerType === filters.seller;
      const matchesNegotiable = !filters.negotiableOnly || listing.negotiable;
      return matchesQuery && matchesCategory && matchesMode && matchesMin && matchesMax && matchesCondition && matchesLocation && matchesSeller && matchesNegotiable;
    });

    return results.sort((a, b) => {
      if (sort === 'price-low') return (a.price ?? Number.MAX_SAFE_INTEGER) - (b.price ?? Number.MAX_SAFE_INTEGER);
      if (sort === 'price-high') return (b.price ?? -1) - (a.price ?? -1);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [category, filters, listings, mode, query, sort]);

  const suggestions = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (value.length < 2) return [];
    const titles = listings
      .filter((item) => String(item.status || 'active').toLowerCase() === 'active' && item.title.toLowerCase().includes(value))
      .slice(0, 4)
      .map((item) => item.title);
    return Array.from(new Set(titles)).slice(0, 4);
  }, [listings, query]);

  const hasActiveFilters = Boolean(
    query.trim() || category !== 'All' || mode !== 'All' || filters.minPrice || filters.maxPrice ||
    filters.location || filters.negotiableOnly || filters.condition !== 'all' || filters.seller !== 'all'
  );

  const categoryListings = (name: string) => filteredListings.filter((listing) => listingBelongsToCategory(listing, name)).slice(0, 6);
  const heroListing = listings.find((listing) => Array.isArray(listing.media_urls) && listing.media_urls.length > 0);
  const campusLabel = institution === 'MUST' ? 'Meru University' : institution;

  const clearAll = () => {
    setQuery('');
    setCategory('All');
    setMode('All');
    setSort('newest');
    setFilters({ minPrice: '', maxPrice: '', condition: 'all', location: '', seller: 'all', negotiableOnly: false });
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const result = await getListingsWithDeadline(listingCampus, offset);
    setLoadingMore(false);
    if (result.error) {
      setListingError(result.error);
      return;
    }
    const next = result.listings || [];
    setOffset((current) => current + next.length);
    setHasMore(next.length === PAGE_SIZE);
    setListings((current) => {
      const merged = [...current];
      next.forEach((item) => {
        if (!merged.some((existing) => existing.id === item.id)) merged.push(item);
      });
      return merged;
    });
  };

  const messageRequestOwner = async (request: ItemRequest) => {
    if (!user) {
      router.push('/signin?mode=signin');
      return;
    }
    if (user.id === request.user_id || messagingRequest) return;
    setMessagingRequest(request.id);
    setRequestActionError(null);
    try {
      const { data: existing, error: lookupError } = await supabase.from('conversations')
        .select('id').is('listing_id', null)
        .or('and(buyer_id.eq.' + user.id + ',seller_id.eq.' + request.user_id + '),and(buyer_id.eq.' + request.user_id + ',seller_id.eq.' + user.id + ')')
        .limit(1).maybeSingle();
      if (lookupError) throw lookupError;
      let conversationId = existing?.id as string | undefined;
      if (!conversationId) {
        const { data: created, error: createError } = await supabase.from('conversations')
          .insert({ listing_id: null, buyer_id: user.id, seller_id: request.user_id })
          .select('id').single();
        if (createError || !created) throw createError || new Error('Conversation could not be created');
        conversationId = created.id;
        const { error: sendError } = await sendMessage(conversationId, user.id, 'Hi, I can help with your request: ' + request.title + '. Is this still needed?');
        if (sendError) console.warn('Conversation created, but the opening message could not be sent:', sendError);
      }
      router.push('/messages/' + conversationId);
    } catch (error) {
      console.error('Could not start request conversation:', error);
      setRequestActionError('Could not open a conversation. Please try again.');
    } finally {
      setMessagingRequest(null);
    }
  };

  const removeRequest = async (request: ItemRequest) => {
    if (!user || deletingRequest || !(isAdmin || user.id === request.user_id)) return;
    if (!window.confirm('Remove this campus request? This cannot be undone.')) return;
    setDeletingRequest(request.id);
    setRequestActionError(null);
    const result = await deleteItemRequest(request.id);
    setDeletingRequest(null);
    if (result.error) {
      setRequestActionError(result.error);
      return;
    }
    setRequests((current) => current.filter((item) => item.id !== request.id));
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearchFocused(false);
  };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <Header />
      <GettingStartedChecklist />

      <main className="mx-auto w-full max-w-[1440px] px-4 pb-32 pt-5 sm:px-6 sm:pt-8 lg:px-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-[11px] text-[var(--muted)]">
          <div className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-[var(--brand)]" />
            <span>Shopping near</span>
            <strong className="font-bold text-[var(--foreground)]">{campusLabel}</strong>
          </div>
          <Link href="/community" className="inline-flex items-center gap-1.5 font-semibold text-[var(--brand)] hover:underline">
            <Users className="h-3.5 w-3.5" /> Campus community
          </Link>
        </div>

        <section className="mb-7 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] lg:items-stretch">
          <div className="flex flex-col justify-center rounded-[26px] bg-[var(--brand)] px-5 py-7 text-white sm:px-8 sm:py-9">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/65">The campus marketplace</p>
            <h1 className="mt-3 max-w-2xl text-[30px] font-extrabold leading-[1.06] tracking-[-0.055em] sm:text-[42px]">Good finds.<br className="hidden sm:block" /> Closer to you.</h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-white/75 sm:text-[15px]">Discover useful things from students and businesses around campus. Browse first, compare your options, then connect directly.</p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <Link href="/categories" className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-xs font-bold text-[var(--brand)] transition hover:bg-[#f1f4ed]">Explore categories <ArrowRight className="h-3.5 w-3.5" /></Link>
              <Link href="/sell" className="inline-flex items-center gap-2 rounded-full border border-white/35 px-5 py-3 text-xs font-bold text-white transition hover:bg-white/10">Start selling</Link>
            </div>
          </div>

          {heroListing ? (
            <Link href={'/listing/' + heroListing.id} className="group relative hidden min-h-[230px] overflow-hidden rounded-[26px] bg-[var(--surface-muted)] lg:block">
              <Image src={heroListing.media_urls[0]} alt={heroListing.title} fill sizes="(min-width: 1024px) 380px, 0px" className="object-cover transition duration-700 group-hover:scale-[1.04]" unoptimized />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] backdrop-blur"><Sparkles className="h-3 w-3" /> On campus now</span>
                <p className="mt-2 line-clamp-2 text-base font-bold">{heroListing.title}</p>
                <p className="mt-1 text-sm font-semibold">{formatListingPrice(heroListing)}</p>
              </div>
            </Link>
          ) : (
            <div className="hidden min-h-[230px] flex-col justify-between rounded-[26px] border border-[var(--border)] bg-[var(--surface)] p-6 lg:flex">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)]"><Store className="h-6 w-6" /></div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--brand)]">Buy and sell locally</p>
                <p className="mt-1 text-xl font-extrabold tracking-[-0.04em]">Your next find starts here.</p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">A focused marketplace for campus life.</p>
              </div>
            </div>
          )}
        </section>

        <section className="relative z-20 mb-8">
          <form onSubmit={submitSearch} className="flex items-center gap-2 rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-2 shadow-[0_8px_28px_rgba(18,45,30,.05)] transition focus-within:border-[var(--brand)]/60 focus-within:shadow-[0_8px_30px_rgba(18,91,71,.10)]">
            <Search className="ml-2 h-5 w-5 shrink-0 text-[var(--muted)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => window.setTimeout(() => setSearchFocused(false), 140)}
              onKeyDown={(event) => { if (event.key === 'Escape') setSearchFocused(false); }}
              type="search"
              aria-label="Search marketplace"
              placeholder="Search phones, textbooks, fashion, services..."
              className="h-11 min-w-0 flex-1 bg-transparent px-1 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] sm:text-[15px]"
            />
            {query ? <button type="button" aria-label="Clear search" onClick={() => setQuery('')} className="rounded-full p-2 text-[var(--muted)] hover:bg-[var(--surface-muted)]"><X className="h-4 w-4" /></button> : null}
            <button type="button" onClick={() => setFiltersOpen(true)} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 text-xs font-bold text-[var(--foreground)] transition hover:border-[var(--brand)]/50">
              <SlidersHorizontal className="h-4 w-4 text-[var(--brand)]" /><span className="hidden sm:inline">Filters</span>
            </button>
            <button type="submit" className="hidden h-10 shrink-0 rounded-xl bg-[var(--brand)] px-5 text-xs font-bold text-white transition hover:bg-[var(--brand-strong)] sm:block">Search</button>
          </form>

          {searchFocused && suggestions.length > 0 ? (
            <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 mx-2 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-[0_18px_45px_rgba(13,30,20,.15)]">
              <p className="px-3 py-2 text-[9px] font-bold uppercase tracking-[0.15em] text-[var(--muted)]">Matching listings</p>
              {suggestions.map((suggestion) => (
                <button key={suggestion} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setQuery(suggestion); setSearchFocused(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--foreground)] hover:bg-[var(--surface-muted)]">
                  <Search className="h-4 w-4 text-[var(--muted)]" />{suggestion}<ArrowRight className="ml-auto h-3.5 w-3.5 text-[var(--muted)]" />
                </button>
              ))}
            </div>
          ) : null}
        </section>

        {!user ? (
          <section className="mb-8 flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-[var(--foreground)]">Browsing is open. Join to trade.</p>
              <p className="mt-0.5 text-xs leading-5 text-[var(--muted)]">Create an account to save finds, message sellers and manage your listings.</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Link href="/signin?mode=signup" className="rounded-full bg-[var(--brand)] px-4 py-2.5 text-xs font-bold text-white hover:bg-[var(--brand-strong)]">Create account</Link>
              <Link href="/signin?mode=signin" className="rounded-full border border-[var(--border)] px-4 py-2.5 text-xs font-bold text-[var(--foreground)] hover:bg-[var(--surface-muted)]">Sign in</Link>
            </div>
          </section>
        ) : null}

        <section className="mb-9">
          <SectionHeading title="Shop by category" subtitle="Start with a department or explore everything." href="/categories" action="All categories" />
          <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-4 sm:gap-3 lg:grid-cols-8">
            {categoryMeta.map(({ name, description, Icon }) => (
              <button key={name} type="button" onClick={() => { setCategory(name); setMode('All'); setQuery(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="group flex min-w-0 flex-col items-center rounded-[17px] border border-[var(--border)] bg-[var(--surface)] px-1.5 py-3 text-center transition hover:-translate-y-0.5 hover:border-[var(--brand)]/45 hover:shadow-sm sm:px-2 sm:py-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[var(--brand-soft)] text-[var(--brand)] transition group-hover:bg-[var(--brand)] group-hover:text-white sm:h-12 sm:w-12">
                  <Icon className="h-5 w-5 sm:h-[22px] sm:w-[22px]" strokeWidth={1.8} aria-hidden="true" />
                </span>
                <span className="mt-2.5 line-clamp-1 text-[10px] font-bold text-[var(--foreground)] sm:text-xs">{name}</span>
                <span className="mt-0.5 hidden text-[9px] text-[var(--muted)] lg:block">{description}</span>
              </button>
            ))}
          </div>
        </section>

        <div className="mb-7 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
          <div className="flex min-w-0 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {([
              ['All', 'For you'],
              ['Products', 'Products'],
              ['Services', 'Services'],
              ['Businesses', 'Businesses'],
            ] as const).map(([value, label]) => (
              <button key={value} type="button" onClick={() => { setMode(value); setCategory('All'); }} className={'shrink-0 rounded-full px-3.5 py-2 text-xs font-bold transition ' + (mode === value && category === 'All' ? 'bg-[var(--brand)] text-white' : 'text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]')}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <label htmlFor="sort-listings" className="sr-only">Sort listings</label>
            <span className="hidden text-[10px] font-semibold text-[var(--muted)] sm:inline">Sort by</span>
            <div className="relative">
              <select id="sort-listings" value={sort} onChange={(event) => setSort(event.target.value as SortMode)} className="appearance-none rounded-full border border-[var(--border)] bg-[var(--surface)] py-2 pl-3 pr-8 text-[10px] font-bold text-[var(--foreground)] outline-none hover:border-[var(--brand)]/50">
                <option value="newest">Recently added</option>
                <option value="price-low">Price: low to high</option>
                <option value="price-high">Price: high to low</option>
              </select>
              <ArrowUpDown className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--muted)]" />
            </div>
          </div>
        </div>

        {showingMeruFallback ? <p className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-xs text-[var(--muted)]">There are no listings at your selected institution yet. Showing the wider Meru University marketplace.</p> : null}

        {hasActiveFilters ? (
          <section className="mb-10">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--brand)]">Marketplace results</p>
                <h2 className="mt-1 text-lg font-extrabold tracking-[-0.04em]">{filteredListings.length} {filteredListings.length === 1 ? 'listing' : 'listings'} found</h2>
              </div>
              <button type="button" onClick={clearAll} className="text-xs font-bold text-[var(--brand)] hover:underline">Clear all</button>
            </div>
            {loadingListings ? <ListingSkeletons /> : filteredListings.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {filteredListings.map((listing) => <ListingCard key={listing.id} listing={listing} />)}
              </div>
            ) : (
              <EmptyState title="No matching listings yet" description="Try a broader search, remove a filter or browse another category." onClear={clearAll} />
            )}
          </section>
        ) : (
          <>
            <section className="mb-10">
              <SectionHeading title="Recently added" subtitle="Fresh listings from your campus marketplace." href="/categories" />
              {loadingListings ? <ListingSkeletons /> : filteredListings.length ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {filteredListings.slice(0, 10).map((listing) => <ListingCard key={listing.id} listing={listing} />)}
                </div>
              ) : listingError ? (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                  <p className="text-sm font-bold">Listings could not be loaded.</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{listingError}</p>
                  <button type="button" onClick={() => window.dispatchEvent(new Event('campustrader:listings-refresh'))} className="mt-3 rounded-full bg-[var(--brand)] px-4 py-2 text-xs font-bold text-white">Try again</button>
                </div>
              ) : (
                <EmptyState title="The first listings are on their way" description="Browse categories or share the marketplace with a seller on your campus." />
              )}
            </section>

            {(['Electronics', 'Books', 'Fashion', 'Services'] as const).map((name) => {
              const items = categoryListings(name);
              if (!items.length) return null;
              return (
                <section key={name} className="mb-10">
                  <SectionHeading title={name === 'Services' ? 'Services around campus' : name + ' worth a look'} subtitle={'Explore more in ' + name.toLowerCase() + '.'} href={'/?category=' + encodeURIComponent(name)} />
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {items.slice(0, 5).map((listing) => <ListingCard key={name + '-' + listing.id} listing={listing} />)}
                  </div>
                </section>
              );
            })}
          </>
        )}

        {hasMore && !hasActiveFilters ? (
          <div className="mb-10 flex justify-center">
            <button type="button" disabled={loadingMore} onClick={loadMore} className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-6 py-3 text-xs font-bold text-[var(--foreground)] transition hover:border-[var(--brand)]/60 disabled:opacity-60">
              {loadingMore ? 'Loading listings…' : 'Load more listings'}
            </button>
          </div>
        ) : null}

        <section className="mb-10">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--brand)]">Student-to-student</p>
              <h2 className="mt-1 text-[19px] font-extrabold tracking-[-0.04em]">Requests from your campus</h2>
              <p className="mt-1 text-xs text-[var(--muted)]">See what other students need. Have it? Start a conversation.</p>
            </div>
            <Link href="/sell?mode=request" className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-xs font-bold text-[var(--brand)] transition hover:border-[var(--brand)]/50">
              Post a request <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {loadingRequests ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((item) => <div key={item} className="h-36 animate-pulse rounded-[18px] border border-[var(--border)] bg-[var(--surface)]" />)}
            </div>
          ) : requestError ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-xs text-[var(--muted)]">Campus requests could not be loaded. <button type="button" onClick={() => window.dispatchEvent(new Event('campustrader:requests-refresh'))} className="font-bold text-[var(--brand)] underline">Retry</button></div>
          ) : requests.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {requests.slice(0, 6).map((request) => (
                <article key={request.id} className="flex min-w-0 flex-col rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--brand)]/45">
                  <div className="flex items-start justify-between gap-3">
                    <span className="rounded-full bg-[var(--brand-soft)] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--brand)]">{request.category || 'Campus request'}</span>
                    {(isAdmin || user?.id === request.user_id) ? <button type="button" disabled={deletingRequest === request.id} onClick={() => void removeRequest(request)} className="text-[10px] font-semibold text-[var(--muted)] hover:text-red-600">{deletingRequest === request.id ? 'Removing…' : 'Remove'}</button> : null}
                  </div>
                  <h3 className="mt-3 line-clamp-2 text-sm font-bold text-[var(--foreground)]">{request.title}</h3>
                  <p className="mt-1 line-clamp-2 min-h-9 text-xs leading-5 text-[var(--muted)]">{request.description || 'A student is looking for this item or service.'}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[var(--muted)]">
                    <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{request.location || campusLabel}</span>
                    <span className="inline-flex items-center gap-1"><Tag className="h-3 w-3" />{formatRequestBudget(request)}</span>
                  </div>
                  {user?.id === request.user_id ? (
                    <p className="mt-4 rounded-xl bg-[var(--background)] px-3 py-2 text-[10px] font-semibold text-[var(--muted)]">Your request · students can message you</p>
                  ) : (
                    <button type="button" disabled={messagingRequest === request.id} onClick={() => void messageRequestOwner(request)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-3 py-2.5 text-xs font-bold text-white transition hover:bg-[var(--brand-strong)] disabled:opacity-60">
                      <MessageCircle className="h-3.5 w-3.5" />{messagingRequest === request.id ? 'Opening chat…' : 'I can help with this'}
                    </button>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center rounded-[20px] border border-dashed border-[var(--border)] bg-[var(--surface)] px-5 py-8 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)]"><Users className="h-5 w-5" /></span>
              <p className="mt-3 text-sm font-bold">No open requests at the moment</p>
              <p className="mt-1 max-w-sm text-xs leading-5 text-[var(--muted)]">Post what you need and let students around campus know what they can help you find.</p>
              <Link href="/sell?mode=request" className="mt-4 rounded-full bg-[var(--brand)] px-4 py-2.5 text-xs font-bold text-white">Post a request</Link>
            </div>
          )}
          {requestActionError ? <p role="alert" className="mt-3 text-xs text-red-600">{requestActionError}</p> : null}
        </section>

        <section className="mb-7 grid gap-3 md:grid-cols-[1.15fr_.85fr]">
          <Link href="/community" className="group flex items-center justify-between gap-4 rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:border-[var(--brand)]/50">
            <span className="min-w-0">
              <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--brand)]">Beyond buying and selling</span>
              <span className="mt-1 block text-lg font-extrabold tracking-[-0.035em]">Your campus, connected.</span>
              <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">Find communities, discuss campus life and connect with other students.</span>
            </span>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)]"><Users className="h-5 w-5" /></span>
          </Link>
          <div className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex items-center gap-2 text-[var(--brand)]"><ShieldCheck className="h-4 w-4" /><span className="text-[10px] font-bold uppercase tracking-[0.14em]">Shop with care</span></div>
            <p className="mt-2 text-sm font-bold text-[var(--foreground)]">Inspect before you pay.</p>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Meet in a public place, check the item and keep payment discussions clear.</p>
            <Link href="/help" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[var(--brand)]">Marketplace safety <ChevronRight className="h-3.5 w-3.5" /></Link>
          </div>
        </section>

        <section className="border-t border-[var(--border)] pt-5">
          <h2 className="text-xs font-bold text-[var(--foreground)]">CampusTrader: buy and sell on campus in Kenya</h2>
          <p className="mt-2 max-w-4xl text-[11px] leading-5 text-[var(--muted)]">CampusTrader is a student marketplace for second-hand electronics, books, fashion, furniture, food, and services. Browse listings from students and nearby businesses, compare options and connect directly.</p>
          <div className="mt-4"><SafetyBanner compact /></div>
          <Link href="/help" className="mt-3 inline-flex text-xs font-bold text-[var(--brand)] hover:underline">How CampusTrader works</Link>
        </section>
      </main>

      {filtersOpen ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setFiltersOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="filter-title" className="max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-[26px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl sm:rounded-[26px] sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--brand)]">Refine results</p><h2 id="filter-title" className="mt-1 text-xl font-extrabold tracking-[-0.04em]">Filters</h2></div>
              <button type="button" onClick={() => setFiltersOpen(false)} aria-label="Close filters" className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--muted)]"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-4">
              <div>
                <label className="mb-2 block text-xs font-bold text-[var(--foreground)]">Price range (KSh)</label>
                <div className="grid grid-cols-2 gap-2">
                  <input inputMode="numeric" value={filters.minPrice} onChange={(event) => setFilters((current) => ({ ...current, minPrice: event.target.value }))} placeholder="Minimum" className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--brand)]" />
                  <input inputMode="numeric" value={filters.maxPrice} onChange={(event) => setFilters((current) => ({ ...current, maxPrice: event.target.value }))} placeholder="Maximum" className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--brand)]" />
                </div>
              </div>
              <div className="grid gap-1.5">
                <label htmlFor="filter-condition" className="text-xs font-bold">Condition</label>
                <select id="filter-condition" value={filters.condition} onChange={(event) => setFilters((current) => ({ ...current, condition: event.target.value }))} className="h-11 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--brand)]">
                  <option value="all">Any condition</option><option value="new">New</option><option value="used">Used</option><option value="refurbished">Refurbished</option><option value="service">Service</option>
                </select>
              </div>
              <div className="grid gap-1.5">
                <label htmlFor="filter-location" className="text-xs font-bold">Location</label>
                <input id="filter-location" value={filters.location} onChange={(event) => setFilters((current) => ({ ...current, location: event.target.value }))} placeholder="e.g. main campus, town" className="h-11 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--brand)]" />
              </div>
              <div className="grid gap-1.5">
                <label htmlFor="filter-seller" className="text-xs font-bold">Seller type</label>
                <select id="filter-seller" value={filters.seller} onChange={(event) => setFilters((current) => ({ ...current, seller: event.target.value }))} className="h-11 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--brand)]">
                  <option value="all">All sellers</option><option value="student">Students</option><option value="business">Businesses</option>
                </select>
              </div>
              <label className="flex min-h-12 items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 text-sm">
                <span className="font-semibold">Negotiable prices only</span>
                <input type="checkbox" checked={filters.negotiableOnly} onChange={(event) => setFilters((current) => ({ ...current, negotiableOnly: event.target.checked }))} className="h-4 w-4 accent-[var(--brand)]" />
              </label>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setFilters({ minPrice: '', maxPrice: '', condition: 'all', location: '', seller: 'all', negotiableOnly: false })} className="h-11 rounded-full border border-[var(--border)] text-xs font-bold text-[var(--foreground)] hover:bg-[var(--surface-muted)]">Reset filters</button>
              <button type="button" onClick={() => setFiltersOpen(false)} className="h-11 rounded-full bg-[var(--brand)] text-xs font-bold text-white hover:bg-[var(--brand-strong)]">Show results</button>
            </div>
          </section>
        </div>
      ) : null}

      <BottomNav />
    </div>
  );
}
