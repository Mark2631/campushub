import { supabase } from './supabase';
import { normalizeCategory } from './categories';
import { withTimeout } from './storage';
import {
  DEFAULT_CAMPUS,
  GENERIC_ERROR,
  cleanMultilineText,
  cleanText,
  isMissingColumnError,
  isValidUuid,
  normalizeInstitution,
  parseOptionalNumber,
} from './validation';
import { getInstitutionIdForCode } from './institutions';

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
  campus?: string | null;
  created_at: string;
  updated_at: string;
}

function serializeError(error: unknown) {
  return JSON.stringify(error, Object.getOwnPropertyNames(error || {}), 2);
}

function parseOptionalPrice(value?: string | number | null) {
  return parseOptionalNumber(value);
}

export async function getItemRequests(limit = 10, institution?: string) {
  try {
    const institutionId = institution ? await getInstitutionIdForCode(normalizeInstitution(institution)) : null;
    const query = supabase
      .from('item_requests')
      .select('id, user_id, title, description, category, min_price, max_price, location, interested_count, status, created_at, updated_at')
      .eq('status', 'open');
    const { data, error } = await (institutionId ? query.eq('institution_id', institutionId) : institution ? query.eq('campus', normalizeInstitution(institution)) : query)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching item requests:', serializeError(error));
      return { requests: [] as ItemRequest[], error: GENERIC_ERROR };
    }

    return { requests: (data || []) as ItemRequest[], error: null };
  } catch (err) {
    console.error('Unexpected error fetching item requests:', err);
    return { requests: [] as ItemRequest[], error: GENERIC_ERROR };
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
      return { request: null as ItemRequest | null, error: GENERIC_ERROR };
    }

    return { request: (data || null) as ItemRequest | null, error: null };
  } catch (err) {
    console.error('Unexpected error fetching item request:', err);
    return { request: null as ItemRequest | null, error: GENERIC_ERROR };
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
  },
  institution: string = DEFAULT_CAMPUS
) {
  if (!isValidUuid(userId)) {
    return { request: null as ItemRequest | null, error: 'Sign in to request an item.' };
  }

  const title = cleanText(data.title, 120);
  if (!title) {
    return { request: null as ItemRequest | null, error: 'Tell sellers what you are looking for.' };
  }

  const minPrice = parseOptionalPrice(data.minPrice);
  const maxPrice = parseOptionalPrice(data.maxPrice);

  if (Number.isNaN(minPrice) || Number.isNaN(maxPrice)) {
    return { request: null as ItemRequest | null, error: 'Budget must be a valid number.' };
  }

  if (minPrice != null && maxPrice != null && minPrice > maxPrice) {
    return { request: null as ItemRequest | null, error: 'Minimum budget cannot be higher than maximum budget.' };
  }

  const payload: Record<string, unknown> = {
    user_id: userId,
    title,
    description: cleanMultilineText(data.description || '', 1000) || null,
    category: normalizeCategory(data.category),
    min_price: minPrice,
    max_price: maxPrice,
    location: cleanText(data.location, 120) || null,
    interested_count: 0,
    status: 'open',
    campus: normalizeInstitution(institution),
    ...(await (async () => {
      try {
        const id = await getInstitutionIdForCode(normalizeInstitution(institution));
        return id ? { institution_id: id } : {};
      } catch {
        return {};
      }
    })()),
  };

  try {
    let { data: request, error } = await withTimeout(
      supabase
        .from('item_requests')
        .insert(payload)
        .select('id, user_id, title, description, category, min_price, max_price, location, interested_count, status, created_at, updated_at')
        .single(),
      12000,
      'Request creation timed out. Please try again.'
    );

    if (error && isMissingColumnError(error, 'item_requests', 'campus')) {
      const { campus, ...legacyPayload } = payload;
      void campus;
      ({ data: request, error } = await withTimeout(
        supabase
          .from('item_requests')
          .insert(legacyPayload)
          .select('id, user_id, title, description, category, min_price, max_price, location, interested_count, status, created_at, updated_at')
          .single(),
        12000,
        'Request creation timed out. Please try again.'
      ));
    }

    if (error) {
      console.error('Error creating item request:', serializeError(error), payload);
      return { request: null as ItemRequest | null, error: GENERIC_ERROR };
    }

    return { request: request as ItemRequest, error: null };
  } catch (err) {
    console.error('Unexpected error creating item request:', err);
    return { request: null as ItemRequest | null, error: GENERIC_ERROR };
  }
}
