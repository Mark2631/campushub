import { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { safeFileName, storageBuckets, uploadPublicFile, validateUploadFile } from './storage';
import { DEFAULT_CAMPUS, GENERIC_ERROR, UPLOAD_ERROR, cleanMultilineText, cleanText, isAllowedValue, isValidUuid, normalizeInstitution } from './validation';
import { getInstitutionIdForCode } from './institutions';

export interface ProfileRecord {
  id: string;
  email?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  verification_status?: string | null;
  badge_type?: string | null;
  role?: string | null;
  account_status?: string | null;
  phone_number?: string | null;
  email_verified?: boolean | null;
  campus?: string | null;
  institution_id?: string | null;
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

export interface VerificationRequestRecord {
  id: string;
  user_id: string;
  business_id?: string | null;
  request_type?: string | null;
  type?: string | null;
  document_name: string | null;
  document_urls?: string[] | null;
  admin_note?: string | null;
  status: string;
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
      return { data: null, error: GENERIC_ERROR };
    }

    delete workingPayload[missingColumn];
  }
}

export async function ensureProfile(user: User) {
  const fullName =
    user.user_metadata?.full_name || user.user_metadata?.fullName || user.user_metadata?.name || '';
  const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.avatar || null;
  const emailVerified = Boolean(user.email_confirmed_at);
  const existing = await getProfileById(user.id);
  const current = existing.profile;
  const isAdmin = user.email?.toLowerCase() === 'mwanginewton107@gmail.com' || current?.role === 'admin' || current?.badge_type === 'admin';
  const accountStatus = current?.account_status && ['suspended', 'banned'].includes(current.account_status)
    ? current.account_status
    : current?.account_status || 'active';

  const { data, error } = await safeUpsert('profiles', {
    id: user.id,
    email: user.email || null,
    full_name: current?.full_name || fullName,
    avatar_url: current?.avatar_url || avatarUrl,
    verification_status: isAdmin ? 'verified' : current?.verification_status || 'unverified',
    badge_type: isAdmin ? 'admin' : current?.badge_type || null,
    account_status: accountStatus,
    role: isAdmin ? 'admin' : current?.role || 'user',
    phone_number: current?.phone_number || user.user_metadata?.phone_number || null,
    email_verified: current?.email_verified || emailVerified,
    campus: normalizeInstitution(user.user_metadata?.institution || current?.campus || DEFAULT_CAMPUS),
    ...(await (async () => {
      try {
        const id = await getInstitutionIdForCode(normalizeInstitution(user.user_metadata?.institution || current?.campus || DEFAULT_CAMPUS));
        return id ? { institution_id: id } : {};
      } catch {
        return {};
      }
    })()),
  });

  return { profile: (data || null) as ProfileRecord | null, error };
}

export async function upsertProfile(user: User) {
  return ensureProfile(user);
}

export async function getProfileById(userId: string) {
  if (!isValidUuid(userId)) {
    return { profile: null, error: null };
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching profile:', serializeError(error));
    const fallback = await supabase
      .from('marketplace_profiles')
      .select('id, full_name, avatar_url, phone_number, badge_type, verification_status, created_at')
      .eq('id', userId)
      .maybeSingle();

    if (fallback.error) {
      console.error('Error fetching public profile:', serializeError(fallback.error));
      return { profile: null, error: GENERIC_ERROR };
    }

    return { profile: (fallback.data || null) as ProfileRecord | null, error: null };
  }

  return { profile: (data || null) as ProfileRecord | null, error: null };
}

export async function saveProfileAvatar(userId: string, file: File) {
  if (!isValidUuid(userId)) {
    return { avatarUrl: null, error: GENERIC_ERROR };
  }

  const validationError = validateUploadFile(file, 'image', 5 * 1024 * 1024);
  if (validationError) {
    return { avatarUrl: null, error: validationError };
  }

  const path = `${userId}/avatar-${Date.now()}-${safeFileName(file.name)}`;
  const { publicUrl, error: uploadError } = await uploadPublicFile(storageBuckets.profileMedia, userId, file, {
    timeoutMs: 25000,
    upsert: true,
    path,
  });

  if (uploadError || !publicUrl) {
    return {
      avatarUrl: null,
      error: UPLOAD_ERROR,
    };
  }

  const { data, error } = await safeUpsert('profiles', {
    id: userId,
    avatar_url: publicUrl,
  });

  if (error) {
    console.error('Profile avatar save failed:', error);
    return { avatarUrl: null, error: GENERIC_ERROR };
  }

  const confirmed = await getProfileById(userId);
  const confirmedUrl = confirmed.profile?.avatar_url;

  if (confirmed.error || confirmedUrl !== publicUrl) {
    return {
      avatarUrl: publicUrl,
      error: GENERIC_ERROR,
    };
  }

  return { avatarUrl: confirmedUrl || (data as ProfileRecord | null)?.avatar_url || publicUrl, error: null };
}

export function normalizeKenyanPhone(value: string) {
  const cleaned = value.trim().replace(/\s+/g, '');
  if (/^07\d{8}$/.test(cleaned) || /^01\d{8}$/.test(cleaned)) return `254${cleaned.slice(1)}`;
  if (/^\+254[71]\d{8}$/.test(cleaned)) return cleaned.slice(1);
  if (/^254[71]\d{8}$/.test(cleaned)) return cleaned;
  return null;
}

export async function saveProfilePhone(userId: string, phoneNumber: string) {
  if (!isValidUuid(userId)) {
    return { phoneNumber: null, error: GENERIC_ERROR };
  }

  const normalized = normalizeKenyanPhone(phoneNumber);
  if (!normalized) {
    return { phoneNumber: null, error: 'Enter a valid Kenyan WhatsApp number: 07XXXXXXXX, 01XXXXXXXX, +2547XXXXXXXX, or +2541XXXXXXXX.' };
  }

  const { data, error } = await safeUpsert('profiles', {
    id: userId,
    phone_number: normalized,
  });

  if (error) {
    console.error('WhatsApp number save failed:', error);
    return { phoneNumber: null, error: GENERIC_ERROR };
  }

  return { phoneNumber: (data as ProfileRecord | null)?.phone_number || normalized, error: null };
}

export async function uploadVerificationDocument(userId: string, file: File) {
  if (!isValidUuid(userId)) {
    return { publicUrl: null, error: GENERIC_ERROR };
  }

  const validationError = validateUploadFile(file, 'verification-document', 8 * 1024 * 1024);
  if (validationError) {
    return { publicUrl: null, error: validationError };
  }

  const { publicUrl, error } = await uploadPublicFile(storageBuckets.verificationMedia, userId, file, {
    timeoutMs: 25000,
    upsert: false,
  });

  if (error || !publicUrl) {
    return { publicUrl: null, error: UPLOAD_ERROR };
  }

  return { publicUrl, error: null };
}

export async function createBusinessProfile(userId: string, business: {
  business_name: string;
  category: string;
  location: string;
  description: string;
}) {
  if (!isValidUuid(userId)) {
    return { business: null, error: GENERIC_ERROR };
  }

  const businessName = cleanText(business.business_name, 120);
  const category = cleanText(business.category, 80);
  const location = cleanText(business.location, 120);
  const description = cleanMultilineText(business.description, 1000);

  if (!businessName || !location) {
    return { business: null, error: 'Business name and location are required.' };
  }

  const modernPayload = {
    owner_id: userId,
    business_name: businessName,
    category,
    location,
    description,
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
      business_name: businessName,
      category,
      location,
      description,
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
      return { business: null, error: GENERIC_ERROR };
    }
  }

  return { business: data as BusinessRecord, error: null };
}

export async function getBusinessProfiles(userId: string) {
  if (!isValidUuid(userId)) {
    return { businesses: [] as BusinessRecord[], error: null };
  }

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
    return { businesses: [] as BusinessRecord[], error: GENERIC_ERROR };
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
  if (!isValidUuid(args.userId) || (args.businessId && !isValidUuid(args.businessId))) {
    return { request: null, error: GENERIC_ERROR };
  }

  if (!isAllowedValue(args.requestType, ['student', 'national_id', 'business'] as const)) {
    return { request: null, error: GENERIC_ERROR };
  }

  if (args.businessId) {
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id, owner_id, user_id')
      .eq('id', args.businessId)
      .maybeSingle();

    if (businessError || !business || (business.owner_id !== args.userId && business.user_id !== args.userId)) {
      if (businessError) console.error('Business ownership check failed:', serializeError(businessError));
      return { request: null, error: GENERIC_ERROR };
    }
  }

  const payload = {
    user_id: args.userId,
    type: args.requestType,
    document_urls: args.documentUrls || [],
    document_name: args.documentName,
    status: 'pending',
    ...(args.businessId ? { business_id: args.businessId } : {}),
  };

  const { data, error } = await supabase
    .from('verification_requests')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    console.error('Error submitting verification request:', serializeError(error), payload);
    return { request: null, error: GENERIC_ERROR };
  }

  await supabase
    .from('profiles')
    .update({ verification_status: 'pending' })
    .eq('id', args.userId)
    .then(({ error }) => {
      if (error) console.error('Verification profile status update failed:', serializeError(error));
    });

  return { request: data, error: null };
}

export async function getLatestVerificationRequest(userId: string) {
  if (!isValidUuid(userId)) {
    return { request: null as VerificationRequestRecord | null, error: null };
  }

  const { data, error } = await supabase
    .from('verification_requests')
    .select('id, user_id, business_id, type, request_type, document_name, document_urls, admin_note, status, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching latest verification request:', serializeError(error));
    return { request: null as VerificationRequestRecord | null, error: GENERIC_ERROR };
  }

  return { request: (data || null) as VerificationRequestRecord | null, error: null };
}
