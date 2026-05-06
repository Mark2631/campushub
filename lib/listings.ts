import { supabase } from './supabase';
import { getMockListingById, getMockListings } from './mockData';

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
  badgeType?: 'none' | 'blue' | 'gold';
}

function formatUnknownError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function logSupabaseError(label: string, error: unknown, extra?: unknown) {
  const serialized = JSON.stringify(error, Object.getOwnPropertyNames(error || {}), 2);
  console.error(label, serialized || error, extra || '');
}

export async function getListings(limit: number = 20) {
  try {
    const { data, error } = await supabase
      .from('listings')
      .select('id, user_id, business_id, seller_id, title, description, category, price, negotiable, condition, status, location, created_at, updated_at, media_urls, video_url')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logSupabaseError('Error fetching listings:', error);
      return { listings: getMockListings(limit), error: error.message };
    }

    const liveListings = (data || []) as Listing[];
    const mergedListings = liveListings.length > 0 ? [...liveListings, ...getMockListings()].slice(0, limit) : getMockListings(limit);
    return { listings: mergedListings, error: null };
  } catch (err) {
    console.error('Unexpected error fetching listings:', err);
    return { listings: getMockListings(limit), error: formatUnknownError(err) };
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
      return { listings: [], error: error.message };
    }

    return { listings: (data || []) as Listing[], error: null };
  } catch (err) {
    console.error('Unexpected error fetching user listings:', err);
    return { listings: [], error: formatUnknownError(err) };
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
      condition: data.condition,
      status: 'active',
      location: data.location,
      media_urls: data.mediaUrls || [],
      video_url: data.videoUrl || null,
    };

    const { data: newListing, error } = await supabase
      .from('listings')
      .insert(listingToInsert)
      .select();

    if (error) {
      console.error('Listing post failed:', JSON.stringify(error, null, 2));
      logSupabaseError('Error inserting listing:', error, { listingToInsert });
      return { listing: null, error: error.message };
    }

    return { listing: (newListing?.[0] || null) as Listing | null, error: null };
  } catch (err) {
    console.error('Unexpected error inserting listing:', err);
    return { listing: null, error: formatUnknownError(err) };
  }
}

export async function getListingById(id: string) {
  const mockListing = getMockListingById(id);
  if (mockListing) {
    return { listing: mockListing, error: null };
  }

  try {
    const { data, error } = await supabase
      .from('listings')
      .select('id, user_id, business_id, seller_id, title, description, category, price, negotiable, condition, status, location, created_at, updated_at, media_urls, video_url')
      .eq('id', id)
      .single();

    if (error) {
      logSupabaseError('Error fetching listing by id:', error);
      return { listing: null, error: error.message };
    }

    return { listing: data as Listing, error: null };
  } catch (err) {
    console.error('Unexpected error fetching listing by id:', err);
    return { listing: null, error: formatUnknownError(err) };
  }
}
