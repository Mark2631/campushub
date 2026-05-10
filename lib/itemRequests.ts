import { supabase } from './supabase';

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
      return { requests: [] as ItemRequest[], error: error.message };
    }

    return { requests: (data || []) as ItemRequest[], error: null };
  } catch (err) {
    console.error('Unexpected error fetching item requests:', err);
    return { requests: [] as ItemRequest[], error: String(err) };
  }
}
