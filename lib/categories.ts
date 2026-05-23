type ListingCategoryInput = {
  category?: string | null;
  condition?: string | null;
  status?: string | null;
};

export function normalizeCategory(value?: string | null) {
  const raw = String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

  if (['service', 'services', 'campus services', 'skill', 'skills'].includes(raw)) return 'Services';
  if (['electronic', 'electronics', 'gadget', 'gadgets'].includes(raw)) return 'Electronics';
  if (['book', 'books', 'notes', 'study'].includes(raw)) return 'Books';
  if (['fashion', 'clothes', 'clothing', 'cloth designs'].includes(raw)) return 'Fashion';
  if (['furniture', 'room items'].includes(raw)) return 'Furniture';
  if (['food', 'meals', 'snacks'].includes(raw)) return 'Food';
  if (['business', 'business offers'].includes(raw)) return 'Business';
  if (['refurbished', 'refurb'].includes(raw)) return 'Refurbished';
  if (['other', 'others'].includes(raw)) return 'Other';

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
  'Fashion',
  'Furniture',
  'Books',
  'Food',
  'Services',
  'Refurbished',
  'Business',
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
