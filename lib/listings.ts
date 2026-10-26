import { supabase } from './supabase';
import { storageBuckets, uploadPublicFile, withTimeout } from './storage';
import { normalizeCategory as normalizeSharedCategory } from './categories';
import {
  DEFAULT_CAMPUS,
  GENERIC_ERROR,
  UPLOAD_ERROR,
  allowedListingConditions,
  cleanMultilineText,
  cleanText,
  isAllowedValue,
  isMissingColumnError,
  isValidUuid,
  normalizeInstitution,
  parseOptionalNumber,
} from './validation';
import { getInstitutionIdForCode, getInstitutionIdForUser } from './institutions';

export interface Listing {
  id: string;
  user_id: string;
  business_id: string | null;
  seller_id: string;
  title: string;
  description: string | null;
  category: string;
  listing_type?: string | null;
  price: number | null;
  negotiable: boolean;
  condition: string;
  status: string;
  location: string | null;
  media_urls: string[];
  video_url: string | null;
  campus?: string | null;
  created_at: string;
  updated_at: string;
  sellerName?: string;
  sellerType?: 'student' | 'business';
  badgeType?: 'none' | 'blue' | 'gold' | 'admin';
  sellerSince?: string | null;
  sellerAvatarUrl?: string | null;
  sellerPhoneNumber?: string | null;
}

type ListingRow = Omit<Listing, 'sellerName' | 'sellerType' | 'badgeType' | 'sellerSince'>;

type ProfileRow = {
  id: string;
  full_name: string | null;
  email?: string | null;
  badge_type: string | null;
  verification_status: string | null;
  role: string | null;
  avatar_url?: string | null;
  phone_number?: string | null;
  created_at: string | null;
};

type BusinessRow = {
  id: string;
  business_name: string;
  verification_status: string | null;
  badge_type?: string | null;
};


async function fetchPublicProfiles(sellerIds: string[]) {
  if (sellerIds.length === 0) return { data: [] as ProfileRow[], error: null as unknown };

  const publicResponse = await supabase
    .from('marketplace_profiles')
    .select('id, full_name, avatar_url, badge_type, verification_status, phone_number, created_at')
    .in('id', sellerIds);

  if (!publicResponse.error) {
    return { data: (publicResponse.data || []) as ProfileRow[], error: null };
  }

  // Never query the private profiles table from public listing pages.\n  // Missing seller decoration must not make the listing unavailable.\n  return { data: [] as ProfileRow[], error: null };
}

async function fetchPublicBusinesses(businessIds: string[]) {
  if (businessIds.length === 0) return { data: [] as BusinessRow[], error: null as unknown };

  const publicResponse = await supabase
    .from('marketplace_businesses')
    .select('id, business_name, verification_status, badge_type')
    .in('id', businessIds);

  if (!publicResponse.error) {
    return { data: (publicResponse.data || []) as BusinessRow[], error: null };
  }

  // Do not fall back to private business records during public discovery.\n  return { data: [] as BusinessRow[], error: null };
}

function logSupabaseError(label: string, error: unknown, extra?: unknown) {
  const serialized = JSON.stringify(error, Object.getOwnPropertyNames(error || {}), 2);
  console.error(label, serialized || error, extra || '');
}

async function enrichListings(rows: ListingRow[]) {
  if (rows.length === 0) return rows as Listing[];

  const sellerIds = Array.from(new Set(rows.map((row) => row.seller_id).filter(Boolean)));
  const businessIds = Array.from(new Set(rows.map((row) => row.business_id).filter(Boolean))) as string[];

  const [profilesResponse, businessesResponse] = await Promise.all([
    fetchPublicProfiles(sellerIds),
    fetchPublicBusinesses(businessIds),
  ]);

  if (profilesResponse?.error) {
    logSupabaseError('Error enriching listing profiles:', profilesResponse.error);
  }
  if (businessesResponse?.error) {
    logSupabaseError('Error enriching listing businesses:', businessesResponse.error);
  }

  const profilesById = new Map((profilesResponse?.data || []).map((profile) => [profile.id, profile as ProfileRow]));
  const businessesById = new Map((businessesResponse?.data || []).map((business) => [business.id, business as BusinessRow]));

  return rows.map((row) => {
    const profile = profilesById.get(row.seller_id);
    const business = row.business_id ? businessesById.get(row.business_id) : null;
    const emailPrefix = profile?.email?.split('@')[0] || null;
    const badgeType = business?.verification_status === 'verified'
      ? 'gold'
      : profile?.badge_type === 'admin'
        ? 'admin'
        : profile?.verification_status === 'verified' || profile?.badge_type === 'verified' || profile?.badge_type === 'blue'
          ? 'blue'
          : profile
            ? 'none'
            : 'none';

    return {
      ...row,
      sellerName: business?.business_name || profile?.full_name || emailPrefix || 'CampusTrader seller',
      sellerType: (business ? 'business' : 'student') as Listing['sellerType'],
      badgeType: badgeType as Listing['badgeType'],
      sellerSince: profile?.created_at || null,
      sellerAvatarUrl: profile?.avatar_url || null,
      sellerPhoneNumber: profile?.phone_number || null,
    };
  });
}

export function normalizeListingCondition(condition: string, category?: string) {
  const normalizedCategory = normalizeCategory(category || '').toLowerCase();
  const normalizedCondition = condition.trim().toLowerCase().replace(/\s+/g, '_');

  if (normalizedCategory === 'services') return 'service';
  if (normalizedCategory === 'refurbished') return 'refurbished';
  if (normalizedCondition === 'new') return 'new';
  if (normalizedCondition === 'refurbished') return 'refurbished';
  if (normalizedCondition === 'service') return 'service';
  return 'used';
}

export function normalizeCategory(value: string) {
  return normalizeSharedCategory(value);
}

function normalizeListingRow(row: Partial<ListingRow>): ListingRow {
  const category = normalizeCategory(row.category || 'Other');
  return {
    id: row.id || '',
    user_id: row.user_id || row.seller_id || '',
    business_id: row.business_id || null,
    seller_id: row.seller_id || row.user_id || '',
    title: row.title || '',
    description: row.description ?? null,
    category,
    listing_type: row.listing_type ?? null,
    price: row.price ?? null,
    negotiable: Boolean(row.negotiable),
    condition: normalizeListingCondition(row.condition || 'used', category),
    status: row.status || 'active',
    location: row.location ?? null,
    media_urls: (() => {
    const rawMediaUrls = row.media_urls as unknown;
    if (Array.isArray(rawMediaUrls)) {
      return rawMediaUrls.filter((url): url is string => typeof url === 'string' && url.trim().length > 0);
    }
    if (typeof rawMediaUrls === 'string') {
      try {
        const parsed = JSON.parse(rawMediaUrls);
        return Array.isArray(parsed) ? parsed.filter((url): url is string => typeof url === 'string' && url.trim().length > 0) : [];
      } catch {
        return rawMediaUrls.startsWith('http') ? [rawMediaUrls] : [];
      }
    }
    return [];
  })(),
    video_url: row.video_url ?? null,
    campus: row.campus || DEFAULT_CAMPUS,
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || row.created_at || new Date().toISOString(),
  };
}

async function enrichListingsWithDeadline(rows: ListingRow[]): Promise<Listing[]> {
  if (!rows.length) return [];
  // Listing cards must not disappear when seller profile enrichment is slow.
  return Promise.race([
    enrichListings(rows),
    new Promise<Listing[]>((resolve) => setTimeout(() => resolve(rows as Listing[]), 2500)),
  ]);
}

export async function getListings(limit = 20, offset = 0, institution: string = DEFAULT_CAMPUS) {
  try {
    const query = supabase
      .from('listings')
      .select('id, user_id, title, description, price, category, listing_type, negotiable, condition, location, media_urls, status, created_at, seller_id, business_id')
      .eq('status', 'active');
    if (institution) {
      const normalizedInstitution = normalizeInstitution(institution);
      const institutionId = await getInstitutionIdForCode(normalizedInstitution);
      // Fail closed when an institution cannot be mapped.
      query.eq('institution_id', institutionId || '00000000-0000-0000-0000-000000000000');
    }

    const { data, error } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1).limit(limit);

    if (error) {
      logSupabaseError('Error fetching listings:', error);
      return { listings: [] as Listing[], error: GENERIC_ERROR };
    }

    const liveListings = ((data || []) as Partial<ListingRow>[]).map(normalizeListingRow);
    // The feed uses description, negotiable, and sellerType in its filters.
    // Enrich seller metadata as well so verified/business badges are accurate;
    // the deadline fallback keeps listing cards visible on a slow profile query.
    return { listings: await enrichListingsWithDeadline(liveListings), error: null };
  } catch (err) {
    console.error('Unexpected error fetching listings:', err);
    return { listings: [] as Listing[], error: GENERIC_ERROR };
  }
}

export async function getServiceListings(limit = 12, institution: string = DEFAULT_CAMPUS) {
  try {
    const query = supabase
      .from('listings')
      .select('id, title, price, category, listing_type, condition, location, media_urls, status, created_at, seller_id, business_id')
      .eq('status', 'active')
      .or('condition.eq.service,category.eq.Services,category.eq.services,category.eq.Service');
  if (institution) {
    const instId = await getInstitutionIdForCode(normalizeInstitution(institution));
    query.eq('institution_id', instId || '00000000-0000-0000-0000-000000000000');
  }

    const { data, error } = await query.order('created_at', { ascending: false }).limit(limit);

    if (error) {
      logSupabaseError('Error fetching service listings:', error);
      return { listings: [] as Listing[], error: null };
    }

    return { listings: ((data || []) as Partial<ListingRow>[]).map(normalizeListingRow) as Listing[], error: null };
  } catch (err) {
    console.error('Unexpected error fetching service listings:', err);
    return { listings: [] as Listing[], error: null };
  }
}

export async function getListingsByUser(userId: string) {
  if (!isValidUuid(userId)) {
    return { listings: [] as Listing[], error: null };
  }

  try {
    const { data, error } = await supabase
      .from('listings')
      .select('id, user_id, business_id, seller_id, title, description, category, listing_type, price, negotiable, condition, status, location, created_at, updated_at, media_urls, video_url')
      .eq('seller_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      logSupabaseError('Error fetching user listings:', error);
      return { listings: [] as Listing[], error: GENERIC_ERROR };
    }

    return { listings: await enrichListings(((data || []) as Partial<ListingRow>[]).map(normalizeListingRow)), error: null };
  } catch (err) {
    console.error('Unexpected error fetching user listings:', err);
    return { listings: [] as Listing[], error: GENERIC_ERROR };
  }
}

function validateListingInput(data: {
  title: string;
  category: string;
  price: string | number | null;
  condition: string;
  description: string;
  location: string;
}) {
  const title = cleanText(data.title, 120);
  const category = normalizeCategory(data.category);
  const condition = normalizeListingCondition(data.condition, category);
  const parsedPrice = parseOptionalNumber(data.price);
  // Zero means "not provided" in this marketplace, never a free item.
  const price = parsedPrice === 0 ? null : parsedPrice;

  if (!title) return { error: 'Title is required.' as const };
  if (!isAllowedValue(condition, allowedListingConditions)) return { error: GENERIC_ERROR };
  if (Number.isNaN(parsedPrice) || (parsedPrice != null && parsedPrice < 0)) return { error: 'Price must be a valid number.' as const };

  return {
    error: null,
    value: {
      title,
      category,
      condition,
      price,
      description: cleanMultilineText(data.description, 1400),
      location: cleanText(data.location, 120),
    },
  };
}

export async function insertListing(
  userId: string,
  data: {
    title: string;
    category: string;
    price: string | number | null;
    negotiable: boolean;
    condition: string;
    description: string;
    location: string;
    businessId?: string | null;
    mediaUrls?: string[];
    videoUrl?: string | null;
    status?: 'active' | 'pending_payment';
    campus?: string;
  }
) {
  if (!isValidUuid(userId)) {
    return { listing: null, error: 'Sign in to post a listing.' };
  }

  try {
    const validated = validateListingInput(data);
    if (validated.error || !validated.value) {
      return { listing: null, error: validated.error || GENERIC_ERROR };
    }

    const institutionId = await getInstitutionIdForUser(userId);
    if (!institutionId) {
      return {
        listing: null,
        error: "Your account isn't linked to an active institution. Refresh your profile or sign in again, then retry.",
      };
    }

    const listingToInsert: Record<string, unknown> = {
      user_id: userId,
      seller_id: userId,
      business_id: data.businessId && isValidUuid(data.businessId) ? data.businessId : null,
      title: validated.value.title,
      description: validated.value.description,
      category: validated.value.category,
      // The database requires a listing_type. The current sell form supports
      // products and services; keep checkout limited to priced physical goods.
      listing_type: validated.value.condition === 'service'
        ? 'SERVICE_ENQUIRY'
        : 'PHYSICAL_PRODUCT',
      price: validated.value.price == null ? null : Number(validated.value.price),
      negotiable: Boolean(data.negotiable),
      condition: validated.value.condition,
      status: data.status || 'active',
      location: validated.value.location,
      media_urls: data.mediaUrls || [],
      video_url: data.videoUrl || null,
      campus: normalizeInstitution(data.campus ?? DEFAULT_CAMPUS),
      // Use the authenticated profile's tenant ID; the database trigger
      // normalizes the display campus from this authoritative identifier.
      institution_id: institutionId,
    };

    const insertQuery = supabase
        .from('listings')
        .insert(listingToInsert)
        .select('id, user_id, business_id, seller_id, title, description, category, listing_type, price, negotiable, condition, status, location, created_at, updated_at, media_urls, video_url')
        .single();

    let { data: newListing, error } = await withTimeout(
      insertQuery,
      15000,
      'Creating listing timed out. Please try again.'
    );

    if (error && isMissingColumnError(error, 'listings', 'campus')) {
      const { campus, ...legacyPayload } = listingToInsert;
      void campus;
      ({ data: newListing, error } = await withTimeout(
        supabase
          .from('listings')
          .insert(legacyPayload)
          .select('id, user_id, business_id, seller_id, title, description, category, listing_type, price, negotiable, condition, status, location, created_at, updated_at, media_urls, video_url')
          .single(),
        15000,
        'Creating listing timed out. Please try again.'
      ));
    }

    if (error) {
      console.error('Listing post failed:', JSON.stringify(error, null, 2));
      logSupabaseError('Error inserting listing:', error, { listingToInsert });
      if (error.code === '42501') {
        return {
          listing: null,
          error: "We couldn't publish this listing because your account's institution could not be verified. Refresh your profile and try again.",
        };
      }
      if (error.code === '23502') {
        return {
          listing: null,
          error: 'A required listing detail is missing. Check the title, category, and price, then try again.',
        };
      }
      return { listing: null, error: 'We could not publish this listing. Check your details and connection, then try again.' };
    }

    const [listing] = await enrichListingsWithDeadline([newListing as ListingRow]);
    return { listing: listing || null, error: null };
  } catch (err) {
    console.error('Unexpected error inserting listing:', err);
    return { listing: null, error: GENERIC_ERROR };
  }
}

export async function getListingById(id: string) {
  if (!isValidUuid(id)) {
    return { listing: null, error: null };
  }

  try {
    const { data, error } = await supabase
      .from('listings')
      .select('id, user_id, business_id, seller_id, title, description, category, listing_type, price, negotiable, condition, status, location, campus, created_at, updated_at, media_urls, video_url')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      logSupabaseError('Error fetching listing by id:', error);
      return { listing: null, error: GENERIC_ERROR };
    }

    if (!data) {
      return { listing: null, error: null };
    }

    const [listing] = await enrichListingsWithDeadline([normalizeListingRow(data as ListingRow)]);
    return { listing: listing || null, error: null };
  } catch (err) {
    console.error('Unexpected error fetching listing by id:', err);
    return { listing: null, error: GENERIC_ERROR };
  }
}

export async function updateListingLifecycleStatus(
  listingId: string,
  sellerId: string,
  status: 'sold' | 'hidden' | 'active'
) {
  if (!isValidUuid(listingId) || !isValidUuid(sellerId)) {
    return { error: 'Listing not found.' };
  }

  if (!isAllowedValue(status, ['sold', 'hidden', 'active'] as const)) {
    return { error: GENERIC_ERROR };
  }

  try {
    const { data, error } = await supabase
      .from('listings')
      .update({ status })
      .eq('id', listingId)
      .eq('user_id', sellerId)
      .eq('seller_id', sellerId)
      .select('id, status')
      .maybeSingle();

    if (error) {
      logSupabaseError('Error updating listing lifecycle status:', error, { listingId, sellerId, status });
      if (error.code === '42501') {
        return { error: 'We could not update this listing. Refresh your profile and try again.' };
      }
      return { error: GENERIC_ERROR };
    }

    // PostgREST can return no error when row-level security silently matches
    // zero rows. Do not report success until the seller-owned row is returned.
    if (!data || data.id !== listingId || data.status !== status) {
      return { error: 'This listing was not updated. Refresh your profile and try again.' };
    }

    return { error: null };
  } catch (err) {
    console.error('Unexpected error updating listing lifecycle status:', err);
    return { error: GENERIC_ERROR };
  }
}

export async function updateListing(
  listingId: string,
  sellerId: string,
  data: {
    title: string;
    description: string;
    category: string;
    price: string | number | null;
    negotiable: boolean;
    condition: string;
    location: string;
    businessId?: string | null;
    mediaUrls?: string[];
    videoUrl?: string | null;
    status?: 'active' | 'pending_payment';
    campus?: string;
  }
) {
  if (!isValidUuid(listingId) || !isValidUuid(sellerId)) {
    return { listing: null, error: 'Listing not found.' };
  }

  const validated = validateListingInput(data);
  if (validated.error || !validated.value) {
    return { listing: null, error: validated.error || GENERIC_ERROR };
  }

  // Preserve current media when an edit caller does not explicitly provide a replacement.
  // The select is scoped to both the listing and authenticated owner via the following update/RLS.
  const { data: currentMedia, error: currentMediaError } = await supabase
    .from('listings')
    .select('media_urls, video_url')
    .eq('id', listingId)
    .eq('seller_id', sellerId)
    .maybeSingle();

  if (currentMediaError || !currentMedia) {
    if (currentMediaError) logSupabaseError('Error loading existing listing media before update:', currentMediaError, { listingId });
    return { listing: null, error: 'Listing could not be loaded for editing. Refresh and try again.' };
  }

  const existingMedia = Array.isArray(currentMedia.media_urls)
    ? currentMedia.media_urls.filter((url: unknown): url is string => typeof url === 'string' && url.trim().length > 0)
    : [];
  const mediaUrls = data.mediaUrls === undefined ? existingMedia : data.mediaUrls;
  const videoUrl = data.videoUrl === undefined ? (currentMedia.video_url as string | null) : data.videoUrl;

  const payload = {
    title: validated.value.title,
    description: validated.value.description,
    category: validated.value.category,
    listing_type: validated.value.condition === 'service'
      ? 'SERVICE_ENQUIRY'
      : 'PHYSICAL_PRODUCT',
    price: validated.value.price == null ? null : Number(validated.value.price),
    negotiable: Boolean(data.negotiable),
    condition: validated.value.condition,
    location: validated.value.location,
    business_id: data.businessId && isValidUuid(data.businessId) ? data.businessId : null,
    media_urls: mediaUrls,
    video_url: videoUrl ?? null,
    ...(data.status ? { status: data.status } : {}),
    // Institution identity is immutable in the database. Never resend campus or institution_id on edit.
    updated_at: new Date().toISOString(),
  };

  const { data: updated, error } = await withTimeout(
    supabase
      .from('listings')
      .update(payload)
      .eq('id', listingId)
      .eq('seller_id', sellerId)
      .select('id, user_id, business_id, seller_id, title, description, category, listing_type, price, negotiable, condition, status, location, created_at, updated_at, media_urls, video_url')
      .single(),
    15000,
    'Saving listing timed out. Please try again.'
  );

  if (error) {
    logSupabaseError('Error updating listing:', error, payload);
    return { listing: null, error: GENERIC_ERROR };
  }

  const [listing] = await enrichListings([updated as ListingRow]);
  return { listing: listing || null, error: null };
}

export async function uploadListingMedia(bucket: string, userId: string, file: File) {
  void bucket;
  const kind = file.type.startsWith('video/') ? 'video' : 'image';
  if (kind === 'image' && file.size > 5 * 1024 * 1024) {
    return { publicUrl: null, error: UPLOAD_ERROR };
  }
  if (kind === 'video' && file.size > 20 * 1024 * 1024) {
    return { publicUrl: null, error: UPLOAD_ERROR };
  }

  const { publicUrl, error } = await uploadPublicFile(storageBuckets.listingMedia, userId, file, {
    timeoutMs: 25000,
    upsert: false,
  });

  if (error) {
    logSupabaseError('Listing media upload failed:', error, { fileName: file.name });
    return { publicUrl: null, error };
  }

  return { publicUrl, error: null };
}
