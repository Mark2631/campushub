type ListingCategoryInput = {
  category?: string | null;
  condition?: string | null;
  status?: string | null;
};

export const STANDARD_CATEGORIES = [
  'Electronics',
  'Books',
  'Fashion',
  'Housing',
  'Services',
  'Jobs',
  'Events',
  'Free Items',
  'Requests',
] as const;

export const SERVICE_SUBCATEGORIES = [
  'Printing',
  'Laundry',
  'Repairs',
  'Photography',
  'Tutoring',
  'Salon',
  'Barber',
  'Transport',
] as const;

const categoryAliases: Record<string, (typeof STANDARD_CATEGORIES)[number]> = {
  electronic: 'Electronics',
  electronics: 'Electronics',
  gadget: 'Electronics',
  gadgets: 'Electronics',
  book: 'Books',
  books: 'Books',
  notes: 'Books',
  study: 'Books',
  fashion: 'Fashion',
  clothes: 'Fashion',
  clothing: 'Fashion',
  'cloth designs': 'Fashion',
  housing: 'Housing',
  hostel: 'Housing',
  hostels: 'Housing',
  bedsitter: 'Housing',
  bedsitters: 'Housing',
  roommate: 'Housing',
  roommates: 'Housing',
  service: 'Services',
  services: 'Services',
  'campus services': 'Services',
  skill: 'Services',
  skills: 'Services',
  printing: 'Services',
  laundry: 'Services',
  repairs: 'Services',
  photography: 'Services',
  tutoring: 'Services',
  salon: 'Services',
  barber: 'Services',
  transport: 'Services',
  job: 'Jobs',
  jobs: 'Jobs',
  gig: 'Jobs',
  gigs: 'Jobs',
  attachment: 'Jobs',
  attachments: 'Jobs',
  event: 'Events',
  events: 'Events',
  ticket: 'Events',
  tickets: 'Events',
  free: 'Free Items',
  'free item': 'Free Items',
  'free items': 'Free Items',
  request: 'Requests',
  requests: 'Requests',
  furniture: 'Housing',
  'room items': 'Housing',
  food: 'Services',
  meals: 'Services',
  snacks: 'Services',
  business: 'Services',
  'business offers': 'Services',
  refurbished: 'Electronics',
  refurb: 'Electronics',
  other: 'Services',
  others: 'Services',
};

export function normalizeCategory(value?: string | null) {
  const raw = String(value ?? '').trim().toLowerCase().replace(/[\s_-]+/g, ' ');
  return categoryAliases[raw] || 'Services';
}

export function isStandardCategory(value?: string | null): value is (typeof STANDARD_CATEGORIES)[number] {
  return STANDARD_CATEGORIES.includes(normalizeCategory(value) as (typeof STANDARD_CATEGORIES)[number]);
}

export function listingBelongsToCategory(listing: ListingCategoryInput, category: string): boolean {
  const normalizedListingCategory = normalizeCategory(listing.category);
  const normalizedFilterCategory = normalizeCategory(category);
  const condition = String(listing.condition ?? '').trim().toLowerCase();

  if (normalizedFilterCategory === 'Services') {
    return normalizedListingCategory === 'Services' || condition === 'service';
  }

  return normalizedListingCategory === normalizedFilterCategory;
}

export function logCategoryStats(listings: ListingCategoryInput[]) {
  if (typeof window === 'undefined' || process.env.NODE_ENV !== 'development') return;

  const activeListings = listings.filter((listing) => String(listing.status ?? 'active').toLowerCase() === 'active');
  const byNormalizedCategory: Record<string, number> = {};

  activeListings.forEach((listing) => {
    const norm = normalizeCategory(listing.category);
    byNormalizedCategory[norm] = (byNormalizedCategory[norm] ?? 0) + 1;
  });

  console.debug('[CampusTrader] Category stats:', {
    activeListings: activeListings.length,
    byNormalizedCategory,
  });
}
