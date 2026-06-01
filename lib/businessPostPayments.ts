import { supabase } from './supabase';
import { createNotificationRecord } from './notifications';
import { GENERIC_ERROR, PERMISSION_ERROR, cleanMultilineText, cleanText, isAllowedValue, isValidUuid } from './validation';

export const BUSINESS_POST_FEE_KSH = 60;
export const BUSINESS_POST_TILL = '6362615';
export const BUSINESS_POST_TILL_NAME = 'Newton Mwangi';

export type BusinessPostPaymentStatus = 'pending' | 'verified' | 'rejected';

export interface BusinessPostPayment {
  id: string;
  listing_id: string;
  business_id: string;
  user_id: string;
  amount_ksh: number;
  till_number: string;
  account_name: string;
  reference: string | null;
  status: BusinessPostPaymentStatus;
  admin_note: string | null;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
  listingTitle?: string | null;
  businessName?: string | null;
  ownerEmail?: string | null;
}

type ListingPaymentRow = {
  id: string;
  seller_id: string;
  business_id: string | null;
  title: string | null;
  status: string | null;
};

type BusinessPaymentRow = {
  id: string;
  business_name: string | null;
};

type ProfilePaymentRow = {
  id: string;
  email: string | null;
};

function serializeError(error: unknown) {
  return JSON.stringify(error, Object.getOwnPropertyNames(error || {}), 2);
}

async function assertAdmin(adminId: string, adminEmail?: string | null) {
  if (!isValidUuid(adminId) || !adminEmail) return false;

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || authData.user?.id !== adminId || authData.user.email?.toLowerCase() !== adminEmail.toLowerCase()) {
    if (authError) console.error('Business payment admin auth check failed:', serializeError(authError));
    return false;
  }

  const { data, error } = await supabase
    .from('admins')
    .select('id')
    .eq('email', adminEmail.toLowerCase())
    .maybeSingle();

  if (error) {
    console.error('Business payment admin table check failed:', serializeError(error));
    return false;
  }

  return Boolean(data);
}

async function fetchPayment(paymentId: string) {
  if (!isValidUuid(paymentId)) return { payment: null as BusinessPostPayment | null, error: GENERIC_ERROR };

  const { data, error } = await supabase
    .from('business_post_payments')
    .select('id, listing_id, business_id, user_id, amount_ksh, till_number, account_name, reference, status, admin_note, verified_by, verified_at, created_at, updated_at')
    .eq('id', paymentId)
    .maybeSingle();

  if (error) {
    console.error('Business payment fetch failed:', serializeError(error));
    return { payment: null as BusinessPostPayment | null, error: GENERIC_ERROR };
  }

  return { payment: (data || null) as BusinessPostPayment | null, error: null };
}

export async function createBusinessPostPayment(args: {
  listingId: string;
  userId: string;
  businessId: string;
  reference?: string;
}) {
  if (!isValidUuid(args.listingId) || !isValidUuid(args.userId) || !isValidUuid(args.businessId)) {
    return { payment: null as BusinessPostPayment | null, error: GENERIC_ERROR };
  }

  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .select('id, seller_id, business_id, title, status')
    .eq('id', args.listingId)
    .maybeSingle();

  if (listingError || !listing) {
    if (listingError) console.error('Business payment listing check failed:', serializeError(listingError));
    return { payment: null as BusinessPostPayment | null, error: GENERIC_ERROR };
  }

  const listingRow = listing as ListingPaymentRow;
  if (listingRow.seller_id !== args.userId || listingRow.business_id !== args.businessId) {
    return { payment: null as BusinessPostPayment | null, error: PERMISSION_ERROR };
  }

  const payload = {
    listing_id: args.listingId,
    business_id: args.businessId,
    user_id: args.userId,
    amount_ksh: BUSINESS_POST_FEE_KSH,
    till_number: BUSINESS_POST_TILL,
    account_name: BUSINESS_POST_TILL_NAME,
    reference: cleanText(args.reference || '', 100) || null,
    status: 'pending',
  };

  const { data, error } = await supabase
    .from('business_post_payments')
    .upsert(payload, { onConflict: 'listing_id' })
    .select('id, listing_id, business_id, user_id, amount_ksh, till_number, account_name, reference, status, admin_note, verified_by, verified_at, created_at, updated_at')
    .single();

  if (error) {
    console.error('Business payment create failed:', serializeError(error), payload);
    return { payment: null as BusinessPostPayment | null, error: GENERIC_ERROR };
  }

  return { payment: data as BusinessPostPayment, error: null };
}

export async function getBusinessPostPayments(status: BusinessPostPaymentStatus | 'all' = 'pending') {
  if (!isAllowedValue(status, ['pending', 'verified', 'rejected', 'all'] as const)) {
    return { payments: [] as BusinessPostPayment[], error: GENERIC_ERROR };
  }

  let query = supabase
    .from('business_post_payments')
    .select('id, listing_id, business_id, user_id, amount_ksh, till_number, account_name, reference, status, admin_note, verified_by, verified_at, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (status !== 'all') query = query.eq('status', status);

  const { data, error } = await query;

  if (error) {
    console.error('Business payments fetch failed:', serializeError(error));
    return { payments: [] as BusinessPostPayment[], error: GENERIC_ERROR };
  }

  const payments = (data || []) as BusinessPostPayment[];
  const listingIds = Array.from(new Set(payments.map((payment) => payment.listing_id).filter(isValidUuid)));
  const businessIds = Array.from(new Set(payments.map((payment) => payment.business_id).filter(isValidUuid)));
  const userIds = Array.from(new Set(payments.map((payment) => payment.user_id).filter(isValidUuid)));

  const [listingResponse, businessResponse, profileResponse] = await Promise.all([
    listingIds.length
      ? supabase.from('listings').select('id, title, seller_id, business_id, status').in('id', listingIds)
      : Promise.resolve({ data: [], error: null }),
    businessIds.length
      ? supabase.from('businesses').select('id, business_name').in('id', businessIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? supabase.from('profiles').select('id, email').in('id', userIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (listingResponse.error) console.error('Business payment listing enrich failed:', serializeError(listingResponse.error));
  if (businessResponse.error) console.error('Business payment business enrich failed:', serializeError(businessResponse.error));
  if (profileResponse.error) console.error('Business payment owner enrich failed:', serializeError(profileResponse.error));

  const listingsById = new Map(((listingResponse.data || []) as ListingPaymentRow[]).map((listing) => [listing.id, listing]));
  const businessesById = new Map(((businessResponse.data || []) as BusinessPaymentRow[]).map((business) => [business.id, business]));
  const profilesById = new Map(((profileResponse.data || []) as ProfilePaymentRow[]).map((profile) => [profile.id, profile]));

  return {
    payments: payments.map((payment) => ({
      ...payment,
      listingTitle: listingsById.get(payment.listing_id)?.title || null,
      businessName: businessesById.get(payment.business_id)?.business_name || null,
      ownerEmail: profilesById.get(payment.user_id)?.email || null,
    })),
    error: null,
  };
}

export async function approveBusinessPostPayment(paymentId: string, adminId: string, adminEmail?: string | null) {
  if (!isValidUuid(paymentId) || !isValidUuid(adminId)) return { error: GENERIC_ERROR };
  if (!(await assertAdmin(adminId, adminEmail))) return { error: PERMISSION_ERROR };

  const { payment, error: paymentError } = await fetchPayment(paymentId);
  if (paymentError || !payment) return { error: GENERIC_ERROR };

  const [{ error: paymentUpdateError }, { error: listingUpdateError }, { error: auditError }] = await Promise.all([
    supabase
      .from('business_post_payments')
      .update({
        status: 'verified',
        verified_by: adminId,
        verified_at: new Date().toISOString(),
        admin_note: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.id),
    supabase
      .from('listings')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', payment.listing_id)
      .eq('business_id', payment.business_id),
    supabase.from('admin_actions').insert({
      admin_id: adminId,
      action_type: 'business_post_payment_approve',
      target_type: 'listing',
      target_id: payment.listing_id,
      reason: 'Business post payment verified',
    }),
  ]);

  if (paymentUpdateError || listingUpdateError) {
    console.error('Business payment approval failed:', { paymentUpdateError, listingUpdateError, auditError });
    return { error: GENERIC_ERROR };
  }

  if (auditError) console.error('Business payment approval audit failed:', serializeError(auditError));

  await createNotificationRecord({
    userId: payment.user_id,
    type: 'business post approved',
    title: 'Business post approved',
    body: 'Your business listing is now live.',
  });

  return { error: null };
}

export async function rejectBusinessPostPayment(paymentId: string, adminId: string, adminEmail: string | null | undefined, note: string) {
  if (!isValidUuid(paymentId) || !isValidUuid(adminId)) return { error: GENERIC_ERROR };
  if (!(await assertAdmin(adminId, adminEmail))) return { error: PERMISSION_ERROR };

  const { payment, error: paymentError } = await fetchPayment(paymentId);
  if (paymentError || !payment) return { error: GENERIC_ERROR };

  const adminNote = cleanMultilineText(note, 500) || 'Payment could not be verified.';

  const [{ error: paymentUpdateError }, { error: auditError }] = await Promise.all([
    supabase
      .from('business_post_payments')
      .update({
        status: 'rejected',
        admin_note: adminNote,
        verified_by: adminId,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.id),
    supabase.from('admin_actions').insert({
      admin_id: adminId,
      action_type: 'business_post_payment_reject',
      target_type: 'listing',
      target_id: payment.listing_id,
      reason: adminNote,
    }),
  ]);

  if (paymentUpdateError) {
    console.error('Business payment rejection failed:', serializeError(paymentUpdateError), { paymentId });
    return { error: GENERIC_ERROR };
  }

  if (auditError) console.error('Business payment rejection audit failed:', serializeError(auditError));

  await createNotificationRecord({
    userId: payment.user_id,
    type: 'business post payment rejected',
    title: 'Business post needs review',
    body: adminNote,
  });

  return { error: null };
}
