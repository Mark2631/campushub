import { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { storageBuckets, uploadPublicFile } from './storage';

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
  owner_id?: string;
  user_id?: string;
  business_name: string;
  category: string;
  location: string;
  description: string;
  verification_status: string;
  badge_type?: string | null;
  created_at?: string;
}

function serializeError(error: unknown) {
  return JSON.stringify(error, Object.getOwnPropertyNames(error || {}), 2);
}

function extractMissingColumn(message: string, table: string) {
  const match = message.match(new RegExp(`column\\s+${table}\\.([a-zA-Z0-9_]+)\\s+does not exist`, 'i'));
  return match?.[1] || null;
}

async function safeUpsert(table: string, payload: Record<string, unknown>, onConflict = 'id') {
  const workingPayload = { ...payload };

  while (true) {
    const { data, error } = await supabase.from(table).upsert(workingPayload, { onConflict }).select('*').single();

    if (!error) {
      return { data, error: null };
    }

    const missingColumn = extractMissingColumn(error.message, table);
    console.error(`${table} upsert error:`, serializeError(error), { workingPayload });

    if (!missingColumn || !(missingColumn in workingPayload) || Object.keys(workingPayload).length <= 1) {
      return { data: null, error: error.message };
    }

    delete workingPayload[missingColumn];
  }
}

export async function ensureProfile(user: User) {
  const fullName =
    user.user_metadata?.full_name || user.user_metadata?.fullName || user.user_metadata?.name || '';
  const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.avatar || null;

  const { data, error } = await safeUpsert('profiles', {
    id: user.id,
    email: user.email || null,
    full_name: fullName,
    avatar_url: avatarUrl,
    verification_status: 'unverified',
    badge_type: 'none',
    role: 'user',
  });

  return { profile: (data || null) as ProfileRecord | null, error };
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

export async function saveProfileAvatar(userId: string, file: File) {
  const { publicUrl, error: uploadError } = await uploadPublicFile(storageBuckets.profileMedia, userId, file, {
    timeoutMs: 25000,
    upsert: true,
  });

  if (uploadError || !publicUrl) {
    return {
      avatarUrl: null,
      error: uploadError || 'Unable to upload profile picture. Check storage policies for profile-media.',
    };
  }

  const { data, error } = await safeUpsert('profiles', {
    id: userId,
    avatar_url: publicUrl,
  });

  if (error) {
    return { avatarUrl: null, error };
  }

  return { avatarUrl: (data as ProfileRecord | null)?.avatar_url || publicUrl, error: null };
}

export async function uploadVerificationDocument(userId: string, file: File) {
  const { publicUrl, error } = await uploadPublicFile(storageBuckets.verificationMedia, userId, file, {
    timeoutMs: 25000,
    upsert: false,
  });

  if (error || !publicUrl) {
    return { publicUrl: null, error: error || 'Unable to upload verification document.' };
  }

  return { publicUrl, error: null };
}

export async function createBusinessProfile(userId: string, business: {
  business_name: string;
  category: string;
  location: string;
  description: string;
}) {
  const modernPayload = {
    owner_id: userId,
    business_name: business.business_name,
    category: business.category,
    location: business.location,
    description: business.description,
    verification_status: 'unverified',
    badge_type: 'none',
  };

  let { data, error } = await supabase
    .from('businesses')
    .insert(modernPayload)
    .select('*')
    .single();

  if (error) {
    console.error('Error creating business profile with owner_id:', serializeError(error), modernPayload);
    const legacyPayload = {
      user_id: userId,
      business_name: business.business_name,
      category: business.category,
      location: business.location,
      description: business.description,
      verification_status: 'unverified',
      badge_type: 'none',
    };

    const legacyResponse = await supabase
      .from('businesses')
      .insert(legacyPayload)
      .select('*')
      .single();

    data = legacyResponse.data;
    error = legacyResponse.error;

    if (error) {
      console.error('Error creating legacy business profile:', serializeError(error), legacyPayload);
      return { business: null, error: error.message };
    }
  }

  return { business: data as BusinessRecord, error: null };
}

export async function getBusinessProfiles(userId: string) {
  let { data, error } = await supabase
    .from('businesses')
    .select('id, owner_id, user_id, business_name, category, location, description, verification_status, badge_type, created_at')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching businesses by owner_id:', serializeError(error));
    const legacyResponse = await supabase
      .from('businesses')
      .select('id, owner_id, user_id, business_name, category, location, description, verification_status, badge_type, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    data = legacyResponse.data;
    error = legacyResponse.error;
  }

  if (error) {
    console.error('Error fetching business profiles:', serializeError(error));
    return { businesses: [] as BusinessRecord[], error: error.message };
  }

  return { businesses: (data || []) as BusinessRecord[], error: null };
}

export async function submitVerificationRequest(args: {
  userId: string;
  requestType: string;
  documentName: string | null;
  documentUrls?: string[];
  businessId?: string | null;
}) {
  const payload = {
    user_id: args.userId,
    business_id: args.businessId || null,
    request_type: args.requestType,
    type: args.requestType,
    document_urls: args.documentUrls || [],
    document_name: args.documentName,
    status: 'pending',
  };

  let { data, error } = await supabase
    .from('verification_requests')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    console.error('Error submitting verification request:', serializeError(error), payload);
    const fallbackPayload = {
      user_id: args.userId,
      business_id: args.businessId || null,
      request_type: args.requestType,
      type: args.requestType,
      document_urls: args.documentUrls || [],
      status: 'pending',
    };

    const fallbackResponse = await supabase
      .from('verification_requests')
      .insert(fallbackPayload)
      .select('*')
      .single();

    data = fallbackResponse.data;
    error = fallbackResponse.error;

    if (error) {
      console.error('Fallback verification request failed:', serializeError(error), fallbackPayload);
      return { request: null, error: error.message };
    }
  }

  return { request: data, error: null };
}
