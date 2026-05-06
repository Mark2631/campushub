import { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

export interface ProfileRecord {
  id: string;
  email?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  verification_status?: string | null;
  badge_type?: string | null;
  role?: string | null;
  created_at?: string;
}

export interface BusinessRecord {
  id: string;
  user_id: string;
  business_name: string;
  category: string;
  location: string;
  description: string;
  verification_status: string;
  created_at?: string;
}

function serializeError(error: unknown) {
  return JSON.stringify(error, Object.getOwnPropertyNames(error || {}), 2);
}

function extractMissingColumn(message: string) {
  const match = message.match(/column\s+profiles\.([a-zA-Z0-9_]+)\s+does not exist/i);
  return match?.[1] || null;
}

async function upsertProfilePayload(payload: Record<string, unknown>) {
  return supabase.from('profiles').upsert(payload, { onConflict: 'id' }).select('*').single();
}

export async function ensureProfile(user: User) {
  const fullName =
    user.user_metadata?.full_name || user.user_metadata?.fullName || user.user_metadata?.name || null;
  const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.avatar || null;

  const payload: Record<string, unknown> = {
    id: user.id,
    email: user.email || null,
    full_name: fullName,
    avatar_url: avatarUrl,
    verification_status: 'unverified',
    badge_type: 'none',
    role: 'user',
  };

  const workingPayload = { ...payload };

  while (true) {
    const { data, error } = await upsertProfilePayload(workingPayload);

    if (!error) {
      return { profile: (data || { id: user.id, ...workingPayload }) as ProfileRecord, error: null };
    }

    const missingColumn = extractMissingColumn(error.message);
    console.error('Profile sync error:', serializeError(error), { workingPayload });

    if (!missingColumn || !(missingColumn in workingPayload) || Object.keys(workingPayload).length <= 1) {
      return { profile: null, error: error.message };
    }

    delete workingPayload[missingColumn];
  }
}

export async function upsertProfile(user: User) {
  return ensureProfile(user);
}

export async function getProfileById(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching profile:', serializeError(error));
    return { profile: null, error: error.message };
  }

  return { profile: (data || null) as ProfileRecord | null, error: null };
}

export async function createBusinessProfile(userId: string, business: {
  business_name: string;
  category: string;
  location: string;
  description: string;
}) {
  const { data, error } = await supabase
    .from('businesses')
    .insert({
      user_id: userId,
      business_name: business.business_name,
      category: business.category,
      location: business.location,
      description: business.description,
      verification_status: 'unverified',
    })
    .select('*')
    .single();

  if (error) {
    console.error('Error creating business profile:', serializeError(error));
    return { business: null, error: error.message };
  }

  return { business: data as BusinessRecord, error: null };
}

export async function getBusinessProfiles(userId: string) {
  const { data, error } = await supabase
    .from('businesses')
    .select('id, user_id, business_name, category, location, description, verification_status, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching business profiles:', serializeError(error));
    return { businesses: [], error: error.message };
  }

  return { businesses: (data || []) as BusinessRecord[], error: null };
}

export async function submitVerificationRequest(userId: string, requestType: string, documentName: string | null) {
  const requestToInsert = {
    user_id: userId,
    business_id: null,
    type: requestType,
    request_type: requestType,
    document_urls: documentName ? [documentName] : [],
    document_name: documentName,
    status: 'pending',
  };

  let { data, error } = await supabase
    .from('verification_requests')
    .insert(requestToInsert)
    .select('*')
    .single();

  if (error) {
    console.error('Error submitting verification request:', serializeError(error), { requestToInsert });

    const legacyRequest = {
      user_id: userId,
      request_type: requestType,
      document_name: documentName,
      status: 'pending',
    };

    const legacyResponse = await supabase
      .from('verification_requests')
      .insert(legacyRequest)
      .select('*')
      .single();

    data = legacyResponse.data;
    error = legacyResponse.error;

    if (error) {
      console.error('Error submitting legacy verification request:', serializeError(error), { legacyRequest });
      return { request: null, error: error.message };
    }
  }

  return { request: data, error: null };
}
