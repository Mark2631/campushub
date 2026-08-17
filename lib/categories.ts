type ListingCategoryInput = {
  category?: string | null;
  condition?: string | null;
  status?: string | null;
};

export const CATEGORY_GROUPS = {
  Marketplace: ['Electronics', 'Books', 'Fashion', 'Furniture', 'Food', 'Refurbished', 'Free Stuff'],
  Housing: ['Hostels', 'Bedsitters', 'Roommates'],
  Services: ['Printing', 'Laundry', 'Repairs', 'Photography', 'Tutoring', 'Salon', 'Barber', 'Transport'],
  Jobs: ['Part-time', 'Attachments', 'Campus Ambassador'],
  Events: ['Tickets', 'Events'],
  Businesses: ['Business Offers', 'Verified Businesses'],
  Other: ['Other']
} as const;

export function normalizeCategory(value?: string | null): string {
  const raw = String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

  if (['electronics', 'electronic', 'gadget', 'gadgets', 'phone', 'laptop'].includes(raw)) return 'Electronics';
  if (['book', 'books', 'notes', 'study', 'calculator', 'drawing equipment'].includes(raw)) return 'Books';
  if (['fashion', 'clothes', 'clothing', 'shoes'].includes(raw)) return 'Fashion';
  if (['furniture', 'room items', 'bed', 'desk'].includes(raw)) return 'Furniture';
  if (['hostel', 'hostels', 'bedsitter', 'bedsitters', 'roommate', 'roommates', 'housing'].includes(raw)) return 'Housing';
  if (['service', 'services', 'printing', 'photocopying', 'laundry', 'repairs', 'repair', 'tutoring', 'tutor', 'salon', 'barber', 'transport'].includes(raw)) return 'Services';
  if (['job', 'jobs', 'part-time', 'gigs', 'attachment', 'attachments', 'ambassador'].includes(raw)) return 'Jobs';
  if (['event', 'events', 'ticket', 'tickets'].includes(raw)) return 'Events';
  if (['free', 'free stuff', 'giveaway'].includes(raw)) return 'Free Stuff';
  if (['food', 'meals', 'snacks'].includes(raw)) return 'Food';
  if (['refurbished', 'refurb'].includes(raw)) return 'Refurbished';
  if (['business', 'business offers'].includes(raw)) return 'Businesses';

  return 'Other';
}

export function listingBelongsToCategory(listing: ListingCategoryInput, category: string): boolean {
  const normalizedCategory = normalizeCategory(listing.category);
  const condition = String(listing.condition ?? '').trim().toLowerCase();

  if (category === 'Services') {
    return normalizedCategory === 'Services' || condition === 'service';
  }

  if (category === 'Refurbished') {
    return normalizedCategory === 'Refurbished' || condition === 'refurbished';
  }

  return normalizedCategory === category;
}

export const STANDARD_CATEGORIES = [
  'Electronics',
  'Books',
  'Fashion',
  'Furniture',
  'Housing',
  'Services',
  'Jobs',
  'Events',
  'Free Stuff',
  'Food',
  'Refurbished',
  'Businesses',
  'Other',
] as const;

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
