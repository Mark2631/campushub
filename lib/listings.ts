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
import { getInstitutionIdForCode } from './institutions';

export interface Listing {
  id: string;
  user_id: string;
  business_id: string | null;
  seller_id: string;
  title: string;
  description: string | null;
  category: string;
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

const MUST_INSTITUTION_ID = '340a2cab-13d8-4af8-91f1-bb6089fd2f89';

async function fetchPublicProfiles(sellerIds: string[]) {
  if (sellerIds.length === 0) return { data: [] as ProfileRow[], error: null as unknown };

  const publicResponse = await supabase
    .from('marketplace_profiles')
    .select('id, full_name, avatar_url, phone_number, badge_type, verification_status, role, created_at')
    .in('id', sellerIds);

  if (!publicResponse.error) {
    return { data: (publicResponse.data || []) as ProfileRow[], error: null };
  }

  logSupabaseError('Marketplace profile view fetch failed:', publicResponse.error);
  const fallbackResponse = await supabase
    .from('profiles')
    .select('id, full_name, email, avatar_url, phone_number, badge_type, verification_status, role, created_at')
    .in('id', sellerIds);

  return { data: (fallbackResponse.data || []) as ProfileRow[], error: fallbackResponse.error };
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

  logSupabaseError('Marketplace business view fetch failed:', publicResponse.error);
  const fallbackResponse = await supabase
    .from('businesses')
    .select('id, business_name, verification_status, badge_type')
    .in('id', businessIds);

  return { data: (fallbackResponse.data || []) as BusinessRow[], error: fallbackResponse.error };
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

  if (profilesResponse.error) {
    logSupabaseError('Error enriching listing profiles:', profilesResponse.error);
  }
  if (businessesResponse.error) {
    logSupabaseError('Error enriching listing businesses:', businessesResponse.error);
  }

  const profilesById = new Map((profilesResponse.data || []).map((profile) => [profile.id, profile as ProfileRow]));
  const businessesById = new Map((businessesResponse.data || []).map((business) => [business.id, business as BusinessRow]));

  return rows.map((row) => {
    const profile = profilesById.get(row.seller_id);
    const business = row.business_id ? businessesById.get(row.business_id) : null;
    const emailPrefix = profile?.email?.split('@')[0] || null;
    const badgeType = business?.verification_status === 'verified'
      ? 'gold'
      : profile?.role === 'admin'
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
    price: row.price ?? null,
    negotiable: Boolean(row.negotiable),
    condition: normalizeListingCondition(row.condition || 'used', category),
    status: row.status || 'active',
    location: row.location ?? null,
    media_urls: Array.isArray(row.media_urls) ? row.media_urls : [],
    video_url: row.video_url ?? null,
    campus: row.campus || DEFAULT_CAMPUS,
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || row.created_at || new Date().toISOString(),
  };
}

export async function getListings(limit = 20, offset = 0, institution: string = DEFAULT_CAMPUS) {
  try {
    const query = supabase
      .from('listings')
      .select('id, title, price, category, condition, location, media_urls, status, created_at, seller_id, business_id')
      .eq('status', 'active');
    if (institution) {
      const normalizedInstitution = normalizeInstitution(institution);
      const institutionId = normalizedInstitution === 'MUST'
        ? MUST_INSTITUTION_ID
        : await getInstitutionIdForCode(normalizedInstitution);
      if (institutionId) {
        query.eq('institution_id', institutionId);
      } else {
        query.eq('campus', normalizedInstitution);
      }
    }

    const { data, error } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1).limit(limit);

    if (error) {
      logSupabaseError('Error fetching listings:', error);
      return { listings: [] as Listing[], error: GENERIC_ERROR };
    }

    const liveListings = await enrichListings(((data || []) as Partial<ListingRow>[]).map(normalizeListingRow));
    return { listings: liveListings, error: null };
  } catch (err) {
    console.error('Unexpected error fetching listings:', err);
    return { listings: [] as Listing[], error: GENERIC_ERROR };
  }
}

export async function getServiceListings(limit = 12, institution: string = DEFAULT_CAMPUS) {
  try {
    const query = supabase
      .from('listings')
      .select('id, title, price, category, condition, location, media_urls, status, created_at, seller_id, business_id')
      .eq('status', 'active')
      .or('condition.eq.service,category.eq.Services,category.eq.services,category.eq.Service');
    if (institution) {
      const instId = await getInstitutionIdForCode(normalizeInstitution(institution));
      if (instId) {
        query.eq('institution_id', instId);
      } else {
        query.eq('campus', normalizeInstitution(institution));
      }
    }

    const { data, error } = await query.order('created_at', { ascending: false }).limit(limit);

    if (error) {
      logSupabaseError('Error fetching service listings:', error);
      return { listings: [] as Listing[], error: null };
    }

    return { listings: await enrichListings(((data || []) as Partial<ListingRow>[]).map(normalizeListingRow)), error: null };
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
      .select('id, user_id, business_id, seller_id, title, description, category, price, negotiable, condition, status, location, created_at, updated_at, media_urls, video_url')
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
  const price = parseOptionalNumber(data.price);

  if (!title) return { error: 'Title is required.' as const };
  if (!isAllowedValue(condition, allowedListingConditions)) return { error: GENERIC_ERROR };
  if (Number.isNaN(price) || (price != null && price < 0)) return { error: 'Price must be a valid number.' as const };

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

    const listingToInsert = {
      user_id: userId,
      seller_id: userId,
      business_id: data.businessId && isValidUuid(data.businessId) ? data.businessId : null,
      title: validated.value.title,
      description: validated.value.description,
      category: validated.value.category,
      price: validated.value.price == null ? null : Number(validated.value.price),
      negotiable: Boolean(data.negotiable),
      condition: validated.value.condition,
      status: data.status || 'active',
      location: validated.value.location,
      media_urls: data.mediaUrls || [],
      video_url: data.videoUrl || null,
      campus: normalizeInstitution(data.campus ?? DEFAULT_CAMPUS),
      // optionally set institution_id when we can resolve it
      ...(await (async () => {
        try {
          const id = await getInstitutionIdForCode(normalizeInstitution(data.campus ?? DEFAULT_CAMPUS));
          return id ? { institution_id: id } : {};
        } catch {
          return {};
        }
      })()),
    };

    const insertQuery = supabase
        .from('listings')
        .insert(listingToInsert)
        .select('id, user_id, business_id, seller_id, title, description, category, price, negotiable, condition, status, location, created_at, updated_at, media_urls, video_url')
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
          .select('id, user_id, business_id, seller_id, title, description, category, price, negotiable, condition, status, location, created_at, updated_at, media_urls, video_url')
          .single(),
        15000,
        'Creating listing timed out. Please try again.'
      ));
    }

    if (error) {
      console.error('Listing post failed:', JSON.stringify(error, null, 2));
      logSupabaseError('Error inserting listing:', error, { listingToInsert });
      return { listing: null, error: GENERIC_ERROR };
    }

    const [listing] = await enrichListings([newListing as ListingRow]);
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
      .select('id, user_id, business_id, seller_id, title, description, category, price, negotiable, condition, status, location, created_at, updated_at, media_urls, video_url')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      logSupabaseError('Error fetching listing by id:', error);
      return { listing: null, error: GENERIC_ERROR };
    }

    if (!data) {
      return { listing: null, error: null };
    }

    const [listing] = await enrichListings([data as ListingRow]);
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

  const { error } = await supabase
    .from('listings')
    .update({ status })
    .eq('id', listingId)
    .eq('seller_id', sellerId);

  if (error) {
    logSupabaseError('Error updating listing lifecycle status:', error, { listingId, sellerId, status });
    return { error: GENERIC_ERROR };
  }

  return { error: null };
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

  const payload = {
    title: validated.value.title,
    description: validated.value.description,
    category: validated.value.category,
    price: validated.value.price == null ? null : Number(validated.value.price),
    negotiable: Boolean(data.negotiable),
    condition: validated.value.condition,
    location: validated.value.location,
    business_id: data.businessId && isValidUuid(data.businessId) ? data.businessId : null,
    media_urls: data.mediaUrls || [],
    video_url: data.videoUrl || null,
    ...(data.status ? { status: data.status } : {}),
    ...(data.campus ? { campus: normalizeInstitution(data.campus) } : {}),
    ...(await (async () => {
      try {
        const id = data.campus ? await getInstitutionIdForCode(normalizeInstitution(data.campus)) : null;
        return id ? { institution_id: id } : {};
      } catch {
        return {};
      }
    })()),
    updated_at: new Date().toISOString(),
  };

  let { data: updated, error } = await withTimeout(
    supabase
      .from('listings')
      .update(payload)
      .eq('id', listingId)
      .eq('seller_id', sellerId)
      .select('id, user_id, business_id, seller_id, title, description, category, price, negotiable, condition, status, location, created_at, updated_at, media_urls, video_url')
      .single(),
    15000,
    'Saving listing timed out. Please try again.'
  );

  if (error && isMissingColumnError(error, 'listings', 'campus')) {
    const { campus, ...legacyPayload } = payload;
    void campus;
    ({ data: updated, error } = await withTimeout(
      supabase
        .from('listings')
        .update(legacyPayload)
        .eq('id', listingId)
        .eq('seller_id', sellerId)
        .select('id, user_id, business_id, seller_id, title, description, category, price, negotiable, condition, status, location, created_at, updated_at, media_urls, video_url')
        .single(),
      15000,
      'Saving listing timed out. Please try again.'
    ));
  }

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
