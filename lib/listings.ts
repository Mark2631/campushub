import { supabase } from './supabase';
import { storageBuckets, uploadPublicFile, withTimeout } from './storage';

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
  created_at: string;
  updated_at: string;
  sellerName?: string;
  sellerType?: 'student' | 'business';
  badgeType?: 'none' | 'blue' | 'gold' | 'admin';
  sellerSince?: string | null;
}

type ListingRow = Omit<Listing, 'sellerName' | 'sellerType' | 'badgeType' | 'sellerSince'>;

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  badge_type: string | null;
  verification_status: string | null;
  role: string | null;
  created_at: string | null;
};

type BusinessRow = {
  id: string;
  business_name: string;
  verification_status: string | null;
  badge_type?: string | null;
};

function formatUnknownError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
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
    sellerIds.length
      ? supabase
          .from('profiles')
          .select('id, full_name, email, badge_type, verification_status, role, created_at')
          .in('id', sellerIds)
      : Promise.resolve({ data: [], error: null }),
    businessIds.length
      ? supabase
          .from('businesses')
          .select('id, business_name, verification_status, badge_type')
          .in('id', businessIds)
      : Promise.resolve({ data: [], error: null }),
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
    };
  });
}

export function normalizeListingCondition(condition: string, category?: string) {
  const normalizedCategory = category?.trim().toLowerCase();
  const normalizedCondition = condition.trim().toLowerCase().replace(/\s+/g, '_');

  if (normalizedCategory === 'services') return 'service';
  if (normalizedCategory === 'refurbished') return 'refurbished';
  if (normalizedCondition === 'new') return 'new';
  if (normalizedCondition === 'refurbished') return 'refurbished';
  if (normalizedCondition === 'service') return 'service';
  return 'used';
}

export async function getListings(limit = 20) {
  try {
    const { data, error } = await supabase
      .from('listings')
      .select('id, user_id, business_id, seller_id, title, description, category, price, negotiable, condition, status, location, created_at, updated_at, media_urls, video_url')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logSupabaseError('Error fetching listings:', error);
      return { listings: [] as Listing[], error: error.message };
    }

    const liveListings = await enrichListings((data || []) as ListingRow[]);
    return { listings: liveListings, error: null };
  } catch (err) {
    console.error('Unexpected error fetching listings:', err);
    return { listings: [] as Listing[], error: formatUnknownError(err) };
  }
}

export async function getListingsByUser(userId: string) {
  try {
    const { data, error } = await supabase
      .from('listings')
      .select('id, user_id, business_id, seller_id, title, description, category, price, negotiable, condition, status, location, created_at, updated_at, media_urls, video_url')
      .eq('seller_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      logSupabaseError('Error fetching user listings:', error);
      return { listings: [] as Listing[], error: error.message };
    }

    return { listings: await enrichListings((data || []) as ListingRow[]), error: null };
  } catch (err) {
    console.error('Unexpected error fetching user listings:', err);
    return { listings: [] as Listing[], error: formatUnknownError(err) };
  }
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
  }
) {
  try {
    const price =
      typeof data.price === 'string'
        ? data.price.trim() === ''
          ? null
          : Number(data.price)
        : data.price;

    if (typeof price === 'number' && Number.isNaN(price)) {
      return { listing: null, error: 'Price must be a valid number.' };
    }

    const listingToInsert = {
      user_id: userId,
      seller_id: userId,
      business_id: data.businessId || null,
      title: data.title,
      description: data.description,
      category: data.category,
      price: price == null ? null : Number(price),
      negotiable: Boolean(data.negotiable),
      condition: normalizeListingCondition(data.condition, data.category),
      status: 'active',
      location: data.location,
      media_urls: data.mediaUrls || [],
      video_url: data.videoUrl || null,
    };

    const { data: newListing, error } = await withTimeout(
      supabase
        .from('listings')
        .insert(listingToInsert)
        .select('id, user_id, business_id, seller_id, title, description, category, price, negotiable, condition, status, location, created_at, updated_at, media_urls, video_url')
        .single(),
      15000,
      'Creating listing timed out. Please try again.'
    );

    if (error) {
      console.error('Listing post failed:', JSON.stringify(error, null, 2));
      logSupabaseError('Error inserting listing:', error, { listingToInsert });
      return { listing: null, error: error.message };
    }

    const [listing] = await enrichListings([newListing as ListingRow]);
    return { listing: listing || null, error: null };
  } catch (err) {
    console.error('Unexpected error inserting listing:', err);
    return { listing: null, error: formatUnknownError(err) };
  }
}

export async function getListingById(id: string) {
  try {
    const { data, error } = await supabase
      .from('listings')
      .select('id, user_id, business_id, seller_id, title, description, category, price, negotiable, condition, status, location, created_at, updated_at, media_urls, video_url')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      logSupabaseError('Error fetching listing by id:', error);
      return { listing: null, error: error.message };
    }

    if (!data) {
      return { listing: null, error: null };
    }

    const [listing] = await enrichListings([data as ListingRow]);
    return { listing: listing || null, error: null };
  } catch (err) {
    console.error('Unexpected error fetching listing by id:', err);
    return { listing: null, error: formatUnknownError(err) };
  }
}

export async function updateListingLifecycleStatus(
  listingId: string,
  sellerId: string,
  status: 'sold' | 'hidden' | 'active'
) {
  const { error } = await supabase
    .from('listings')
    .update({ status })
    .eq('id', listingId)
    .eq('seller_id', sellerId);

  if (error) {
    logSupabaseError('Error updating listing lifecycle status:', error, { listingId, sellerId, status });
    return { error: error.message };
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
  }
) {
  const price =
    typeof data.price === 'string'
      ? data.price.trim() === ''
        ? null
        : Number(data.price)
      : data.price;

  const payload = {
    title: data.title,
    description: data.description,
    category: data.category,
    price: price == null ? null : Number(price),
    negotiable: Boolean(data.negotiable),
    condition: normalizeListingCondition(data.condition, data.category),
    location: data.location,
    business_id: data.businessId || null,
    media_urls: data.mediaUrls || [],
    video_url: data.videoUrl || null,
    updated_at: new Date().toISOString(),
  };

  const { data: updated, error } = await withTimeout(
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

  if (error) {
    logSupabaseError('Error updating listing:', error, payload);
    return { listing: null, error: error.message };
  }

  const [listing] = await enrichListings([updated as ListingRow]);
  return { listing: listing || null, error: null };
}

export async function uploadListingMedia(bucket: string, userId: string, file: File) {
  void bucket;
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
