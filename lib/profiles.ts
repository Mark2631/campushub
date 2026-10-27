import { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { safeFileName, storageBuckets, uploadPublicFile, validateUploadFile } from './storage';
import { DEFAULT_CAMPUS, GENERIC_ERROR, UPLOAD_ERROR, cleanMultilineText, cleanText, isAllowedValue, isValidUuid, normalizeInstitution } from './validation';
import { getInstitutionIdForCode, getInstitutionIdForUser } from './institutions';

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
  institution_id?: string;
  delivery_available?: boolean;
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
  const existing = await getProfileById(user.id);
  const current = existing.profile;

  if (current) {
    // Never upsert institution fields for an existing profile. PostgreSQL runs
    // a BEFORE INSERT trigger for an upsert before resolving its conflict; a
    // stale campus label could otherwise make routine sync fail every time.
    // An UPDATE of only editable fields preserves the original signup campus
    // and cannot accidentally change a user's role or verification state.
    const patch: Record<string, string | null> = {};
    if (user.email && current.email !== user.email) patch.email = user.email;
    if (!current.full_name && fullName) patch.full_name = fullName;
    if (!current.avatar_url && avatarUrl) patch.avatar_url = avatarUrl;

    if (Object.keys(patch).length === 0) {
      return { profile: current as ProfileRecord, error: null };
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', user.id)
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('Existing profile sync failed:', serializeError(error));
      return { profile: current as ProfileRecord, error: GENERIC_ERROR };
    }

    return { profile: (data || current) as ProfileRecord, error: null };
  }

  // Match the database trigger's signup metadata precedence exactly. New
  // non-admin profiles use table defaults for privileged fields.
  const rawInstitution =
    user.user_metadata?.institution_code ||
    user.user_metadata?.institution ||
    DEFAULT_CAMPUS;
  const institutionCode = normalizeInstitution(rawInstitution);

  let institutionId: string | null = null;
  try {
    institutionId = await getInstitutionIdForCode(institutionCode);
  } catch (err) {
    console.error('Profile institution lookup failed:', err);
  }

  if (!institutionId) {
    return {
      profile: null,
      error: 'Choose a supported institution before finishing account setup.',
    };
  }

  const isKnownAdminEmail = user.email?.toLowerCase() === 'mwanginewton107@gmail.com';
  const payload: Record<string, unknown> = {
    id: user.id,
    email: user.email || null,
    full_name: fullName,
    avatar_url: avatarUrl,
    campus: institutionCode,
    institution_id: institutionId,
  };

  // The database remains the source of truth for admin membership. These
  // values are included only for the existing bootstrap admin; trigger-level
  // admin verification rejects equivalent attempts by ordinary users.
  if (isKnownAdminEmail) {
    payload.role = 'admin';
    payload.verification_status = 'verified';
    payload.badge_type = 'admin';
    payload.account_status = 'active';
    payload.email_verified = Boolean(user.email_confirmed_at);
  }

  const { data, error } = await safeUpsert('profiles', payload);
  if (error) {
    console.error('New profile creation failed:', serializeError(error));
    return { profile: null, error };
  }

  return { profile: (data || null) as ProfileRecord | null, error: null };
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

export async function saveProfileName(userId: string, fullName: string) {
  if (!isValidUuid(userId)) {
    return { fullName: null, error: GENERIC_ERROR };
  }

  const normalized = cleanText(fullName, 80);
  if (normalized.length < 2) {
    return { fullName: null, error: 'Enter a name with at least 2 characters.' };
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ full_name: normalized })
    .eq('id', userId)
    .select('id, full_name')
    .maybeSingle();

  if (error) {
    console.error('Profile name save failed:', serializeError(error));
    return { fullName: null, error: GENERIC_ERROR };
  }
  if (!data) {
    return { fullName: null, error: 'Profile could not be updated. Refresh and try again.' };
  }

  try {
    const { error: metadataError } = await supabase.auth.updateUser({ data: { full_name: normalized } });
    if (metadataError) {
      console.warn('Auth display-name metadata could not be refreshed after profile save.');
    }
  } catch {
    // The profiles row is already saved; a transient metadata-sync error should not report a false save failure.
    console.warn('Auth display-name metadata could not be refreshed after profile save.');
  }

  return { fullName: (data as { full_name?: string | null }).full_name || normalized, error: null };
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
  delivery_available?: boolean;
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

  // Institution identity must come from the signed-in account's protected profile,
  // never from client-provided form values. The database RLS policy checks this.
  const institutionId = await getInstitutionIdForUser(userId);
  if (!institutionId) {
    return {
      business: null,
      error: 'Your account is missing an institution link. Please contact CampusTrader support.',
    };
  }

  const payload = {
    owner_id: userId,
    user_id: userId,
    institution_id: institutionId,
    business_name: businessName,
    category,
    location,
    description,
    verification_status: 'unverified',
    badge_type: 'none',
    delivery_available: business.delivery_available === true,
  };

  const { data, error } = await supabase
    .from('businesses')
    .insert(payload)
    .select('*')
    .single();

  if (error || !data) {
    console.error('Error creating business profile:', serializeError(error || new Error('No business row returned')), {
      businessName,
      institutionId,
      code: error?.code,
    });
    if (error?.code === '42501' || error?.code === '23514') {
      return { business: null, error: 'Business profile could not be saved for this account. Refresh your session and try again.' };
    }
    if (error?.code === '23503') {
      return { business: null, error: 'Your institution or account details need attention. Please refresh and try again.' };
    }
    return { business: null, error: GENERIC_ERROR };
  }

  return { business: data as BusinessRecord, error: null };
}

export async function getBusinessProfiles(userId: string) {
  if (!isValidUuid(userId)) {
    return { businesses: [] as BusinessRecord[], error: null };
  }

  let { data, error } = await supabase
    .from('businesses')
    .select('id, owner_id, user_id, institution_id, business_name, category, location, description, verification_status, badge_type, delivery_available, created_at')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching businesses by owner_id:', serializeError(error));
    const legacyResponse = await supabase
      .from('businesses')
      .select('id, owner_id, user_id, institution_id, business_name, category, location, description, verification_status, badge_type, delivery_available, created_at')
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
