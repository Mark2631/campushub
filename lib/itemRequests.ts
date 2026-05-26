import { supabase } from './supabase';
import { normalizeCategory } from './categories';
import { withTimeout } from './storage';
import { isValidUuid } from './validation';

export interface ItemRequest {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: string;
  min_price: number | null;
  max_price: number | null;
  location: string | null;
  interested_count: number;
  status: string;
  created_at: string;
  updated_at: string;
}

function serializeError(error: unknown) {
  return JSON.stringify(error, Object.getOwnPropertyNames(error || {}), 2);
}

function formatUnknownError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function parseOptionalPrice(value?: string | number | null) {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export async function getItemRequests(limit = 10) {
  try {
    const { data, error } = await supabase
      .from('item_requests')
      .select('id, user_id, title, description, category, min_price, max_price, location, interested_count, status, created_at, updated_at')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching item requests:', serializeError(error));
      return { requests: [] as ItemRequest[], error: 'Something went wrong. Try again.' };
    }

    return { requests: (data || []) as ItemRequest[], error: null };
  } catch (err) {
    console.error('Unexpected error fetching item requests:', err);
    return { requests: [] as ItemRequest[], error: 'Something went wrong. Try again.' };
  }
}

export async function getItemRequestById(id: string) {
  if (!isValidUuid(id)) {
    return { request: null as ItemRequest | null, error: null };
  }

  try {
    const { data, error } = await supabase
      .from('item_requests')
      .select('id, user_id, title, description, category, min_price, max_price, location, interested_count, status, created_at, updated_at')
      .eq('id', id)
      .eq('status', 'open')
      .maybeSingle();

    if (error) {
      console.error('Error fetching item request:', serializeError(error));
      return { request: null as ItemRequest | null, error: 'Something went wrong. Try again.' };
    }

    return { request: (data || null) as ItemRequest | null, error: null };
  } catch (err) {
    console.error('Unexpected error fetching item request:', err);
    return { request: null as ItemRequest | null, error: 'Something went wrong. Try again.' };
  }
}

export async function createItemRequest(
  userId: string,
  data: {
    title: string;
    description?: string;
    category: string;
    minPrice?: string | number | null;
    maxPrice?: string | number | null;
    location?: string;
  }
) {
  if (!isValidUuid(userId)) {
    return { request: null as ItemRequest | null, error: 'Sign in to request an item.' };
  }

  const title = data.title.trim();
  if (!title) {
    return { request: null as ItemRequest | null, error: 'Request title is required.' };
  }

  const minPrice = parseOptionalPrice(data.minPrice);
  const maxPrice = parseOptionalPrice(data.maxPrice);

  if (Number.isNaN(minPrice) || Number.isNaN(maxPrice)) {
    return { request: null as ItemRequest | null, error: 'Budget must be a valid number.' };
  }

  if (minPrice != null && maxPrice != null && minPrice > maxPrice) {
    return { request: null as ItemRequest | null, error: 'Minimum budget cannot be higher than maximum budget.' };
  }

  const payload = {
    user_id: userId,
    title,
    description: data.description?.trim() || null,
    category: normalizeCategory(data.category),
    min_price: minPrice,
    max_price: maxPrice,
    location: data.location?.trim() || null,
    interested_count: 0,
    status: 'open',
  };

  try {
    const { data: request, error } = await withTimeout(
      supabase
        .from('item_requests')
        .insert(payload)
        .select('id, user_id, title, description, category, min_price, max_price, location, interested_count, status, created_at, updated_at')
        .single(),
      12000,
      'Request creation timed out. Please try again.'
    );

    if (error) {
      console.error('Error creating item request:', serializeError(error), payload);
      return { request: null as ItemRequest | null, error: 'Something went wrong. Try again.' };
    }

    return { request: request as ItemRequest, error: null };
  } catch (err) {
    console.error('Unexpected error creating item request:', formatUnknownError(err));
    return { request: null as ItemRequest | null, error: 'Something went wrong. Try again.' };
  }
}
