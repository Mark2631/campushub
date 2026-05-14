import { supabase } from './supabase';
import { ComplaintRecord, getComplaints, updateComplaintStatus } from './complaints';

export interface AdminVerificationRequest {
  id: string;
  user_id: string;
  business_id?: string | null;
  request_type: string;
  type?: string | null;
  document_name: string | null;
  document_urls?: string[] | null;
  admin_note?: string | null;
  status: string;
  created_at?: string;
}

export interface AdminBusiness {
  id: string;
  user_id: string;
  owner_id?: string | null;
  business_name: string;
  category: string;
  location: string;
  description: string | null;
  verification_status: string;
  created_at?: string;
}

export interface AdminListing {
  id: string;
  seller_id: string;
  title: string;
  price: number | null;
  status: string;
  location: string | null;
  created_at?: string;
}

export interface AdminReport {
  id: string;
  reporter_id?: string | null;
  target_type?: string | null;
  target_id?: string | null;
  reason?: string | null;
  details?: string | null;
  status: string;
  created_at?: string;
}

export interface AdminUser {
  id: string;
  email: string | null;
  full_name: string | null;
  verification_status: string | null;
  role: string | null;
  created_at?: string;
}

export interface PlatformStats {
  users: number;
  listings: number;
  businesses: number;
  reports: number;
  complaints: number;
  pendingVerifications: number;
  activeListings: number;
  reportedListings: number;
  pendingBusinesses: number;
}

export interface AdminDashboardData {
  verifications: AdminVerificationRequest[];
  businesses: AdminBusiness[];
  listings: AdminListing[];
  users: AdminUser[];
  reports: AdminReport[];
  complaints: ComplaintRecord[];
  stats: PlatformStats;
  errors: string[];
}

async function safeSection<T>(
  label: string,
  fallback: T,
  query: () => PromiseLike<{ data: T | null; error: { message: string } | null }>
) {
  try {
    const { data, error } = await query();
    if (error) {
      console.error(`${label} error:`, error);
      return { data: fallback, error: `Could not load ${label}: ${error.message}` };
    }

    return { data: data ?? fallback, error: null };
  } catch (error) {
    console.error(`${label} error:`, error);
    return { data: fallback, error: `Could not load ${label}: ${String(error)}` };
  }
}

async function safeCount(label: string, query: () => PromiseLike<{ count: number | null; error: { message: string } | null }>) {
  try {
    const { count, error } = await query();
    if (error) {
      console.error(`${label} count error:`, error);
      return { count: 0, error: `Could not load ${label}.` };
    }

    return { count: count || 0, error: null };
  } catch (error) {
    console.error(`${label} count error:`, error);
    return { count: 0, error: `Could not load ${label}.` };
  }
}

async function insertOptionalNotification(userId: string, type: string, title: string, body: string) {
  const { error } = await supabase
    .from('notifications')
    .insert({ user_id: userId, type, title, body, read: false });

  if (error) {
    console.error('Optional notification insert failed:', error);
  }
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const errors: string[] = [];

  const [
    verificationsResponse,
    businessesResponse,
    listingsResponse,
    usersResponse,
    reportsResponse,
    usersCount,
    listingsCount,
    businessesCount,
    reportsCount,
    complaintsCount,
    activeListingsCount,
    reportedListingsCount,
    complaintsResponse,
  ] = await Promise.all([
    safeSection('verification requests', [] as AdminVerificationRequest[], async () => {
      const response = await supabase
        .from('verification_requests')
        .select('id, user_id, business_id, type, request_type, document_name, document_urls, admin_note, status, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      return { data: (response.data || []) as AdminVerificationRequest[], error: response.error };
    }),
    safeSection('businesses', [] as AdminBusiness[], async () => {
      const response = await supabase
        .from('businesses')
        .select('id, owner_id, user_id, business_name, category, location, description, verification_status, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      return { data: (response.data || []) as AdminBusiness[], error: response.error };
    }),
    safeSection('listings', [] as AdminListing[], async () => {
      const response = await supabase
        .from('listings')
        .select('id, seller_id, title, price, status, location, created_at')
        .order('created_at', { ascending: false })
        .limit(80);
      return { data: (response.data || []) as AdminListing[], error: response.error };
    }),
    safeSection('users', [] as AdminUser[], async () => {
      const response = await supabase
        .from('profiles')
        .select('id, email, full_name, verification_status, role, created_at')
        .order('created_at', { ascending: false })
        .limit(80);
      return { data: (response.data || []) as AdminUser[], error: response.error };
    }),
    safeSection('reports', [] as AdminReport[], async () => {
      const response = await supabase
        .from('reports')
        .select('id, reporter_id, target_type, target_id, reason, details, status, created_at')
        .order('created_at', { ascending: false });
      return { data: (response.data || []) as AdminReport[], error: response.error };
    }),
    safeCount('users', () => supabase.from('profiles').select('id', { count: 'exact', head: true })),
    safeCount('listings', () => supabase.from('listings').select('id', { count: 'exact', head: true })),
    safeCount('businesses', () => supabase.from('businesses').select('id', { count: 'exact', head: true })),
    safeCount('reports', () => supabase.from('reports').select('id', { count: 'exact', head: true })),
    safeCount('complaints', () => supabase.from('complaints').select('id', { count: 'exact', head: true })),
    safeCount('active listings', () => supabase.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'active')),
    safeCount('reported listings', () => supabase.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'reported')),
    getComplaints().catch((error) => {
      console.error('Complaints error:', error);
      return { complaints: [] as ComplaintRecord[], error: 'Could not load complaints.' };
    }),
  ]);

  [
    verificationsResponse.error,
    businessesResponse.error,
    listingsResponse.error,
    usersResponse.error,
    reportsResponse.error,
    usersCount.error,
    listingsCount.error,
    businessesCount.error,
    reportsCount.error,
    complaintsCount.error,
    activeListingsCount.error,
    reportedListingsCount.error,
    complaintsResponse.error ? 'Could not load complaints.' : null,
  ].forEach((message) => {
    if (message) errors.push(message);
  });

  return {
    verifications: verificationsResponse.data,
    businesses: businessesResponse.data,
    listings: listingsResponse.data,
    users: usersResponse.data,
    reports: reportsResponse.data,
    complaints: complaintsResponse.complaints,
    stats: {
      users: usersCount.count,
      listings: listingsCount.count,
      businesses: businessesCount.count,
      reports: reportsCount.count,
      complaints: complaintsCount.count,
      pendingVerifications: verificationsResponse.data.length,
      activeListings: activeListingsCount.count,
      reportedListings: reportedListingsCount.count,
      pendingBusinesses: businessesResponse.data.filter((business) => ['unverified', 'pending'].includes(business.verification_status)).length,
    },
    errors,
  };
}

export async function setUserVerificationStatus(request: AdminVerificationRequest, status: 'verified' | 'rejected') {
  const requestStatus = status === 'verified' ? 'verified' : 'rejected';

  const [{ error: profileError }, { error: requestError }] = await Promise.all([
    supabase
      .from('profiles')
      .update(status === 'verified' ? { verification_status: status, badge_type: 'blue' } : { verification_status: status })
      .eq('id', request.user_id),
    supabase
      .from('verification_requests')
      .update({ status: requestStatus })
      .eq('id', request.id),
  ]);

  if (profileError || requestError) {
    console.error('Error updating user verification:', { profileError, requestError, request });
    return { error: profileError?.message || requestError?.message || 'Unable to update verification.' };
  }

  return { error: null };
}

export async function setBusinessVerificationStatus(businessId: string, status: 'verified' | 'rejected') {
  const { error } = await supabase
    .from('businesses')
    .update(status === 'verified' ? { verification_status: status, badge_type: 'gold' } : { verification_status: status })
    .eq('id', businessId);

  if (error) console.error('Error updating business verification:', error);
  return { error: error?.message || null };
}

export async function updateListingStatus(listingId: string, status: 'hidden' | 'reported') {
  const { error } = await supabase
    .from('listings')
    .update({ status })
    .eq('id', listingId);

  if (error) console.error('Error updating listing status:', error);
  return { error: error?.message || null };
}

export async function deleteListing(listingId: string) {
  const { error } = await supabase
    .from('listings')
    .delete()
    .eq('id', listingId);

  if (error) console.error('Error deleting listing:', error);
  return { error: error?.message || null };
}

export async function updateReportStatus(reportId: string, status: 'pending' | 'reviewed' | 'resolved') {
  const { error } = await supabase
    .from('reports')
    .update({ status })
    .eq('id', reportId);

  if (error) console.error('Error updating report status:', error);
  return { error: error?.message || null };
}

// ============================================================================
// USER MANAGEMENT
// ============================================================================

export interface AdminUserDetail extends AdminUser {
  account_status?: string | null;
  admin_warnings_count?: number | null;
  last_admin_warning?: string | null;
}

export async function getUserDetails(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, verification_status, badge_type, role, account_status, admin_warnings_count, last_admin_warning, created_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching user details:', error);
    return { user: null, error: error.message };
  }

  return { user: (data || null) as AdminUserDetail | null, error: null };
}

export async function suspendUser(userId: string, adminId: string, reason: string) {
  const [{ error: profileError }, { error: auditError }] = await Promise.all([
    supabase.from('profiles').update({ account_status: 'suspended' }).eq('id', userId),
    supabase.from('admin_actions').insert({
      admin_id: adminId,
      action_type: 'user_suspend',
      target_type: 'user',
      target_id: userId,
      reason,
    }),
  ]);

  if (profileError || auditError) {
    console.error('Error suspending user:', { profileError, auditError });
    return { error: profileError?.message || auditError?.message || 'Failed to suspend user' };
  }

  return { error: null };
}

export async function unblockUser(userId: string, adminId: string, reason: string) {
  const [{ error: profileError }, { error: auditError }] = await Promise.all([
    supabase.from('profiles').update({ account_status: 'active' }).eq('id', userId),
    supabase.from('admin_actions').insert({
      admin_id: adminId,
      action_type: 'user_unblock',
      target_type: 'user',
      target_id: userId,
      reason,
    }),
  ]);

  if (profileError || auditError) {
    console.error('Error unblocking user:', { profileError, auditError });
    return { error: profileError?.message || auditError?.message || 'Failed to unblock user' };
  }

  return { error: null };
}

export async function banUser(userId: string, adminId: string, reason: string) {
  const [{ error: profileError }, { error: auditError }] = await Promise.all([
    supabase.from('profiles').update({ account_status: 'banned' }).eq('id', userId),
    supabase.from('admin_actions').insert({
      admin_id: adminId,
      action_type: 'user_ban',
      target_type: 'user',
      target_id: userId,
      reason,
    }),
  ]);

  if (profileError || auditError) {
    console.error('Error banning user:', { profileError, auditError });
    return { error: profileError?.message || auditError?.message || 'Failed to ban user' };
  }

  return { error: null };
}

export async function warnUser(userId: string, adminId: string, title: string, message: string) {
  const now = new Date().toISOString();
  const [{ error: profileError }, { error: noticeError }] = await Promise.all([
    supabase
      .from('profiles')
      .update({
        admin_warnings_count: supabase.rpc('increment_warning_count', { user_id: userId }),
        last_admin_warning: now,
      })
      .eq('id', userId),
    supabase.from('admin_notices').insert({
      user_id: userId,
      admin_id: adminId,
      notice_type: 'warning',
      title,
      message,
    }),
  ]);

  if (profileError || noticeError) {
    console.error('Error warning user:', { profileError, noticeError });
    return { error: profileError?.message || noticeError?.message || 'Failed to warn user' };
  }

  return { error: null };
}

// ============================================================================
// BUSINESS MANAGEMENT
// ============================================================================

export interface AdminBusinessDetail extends AdminBusiness {
  status?: string | null;
}

export async function getBusinessDetails(businessId: string) {
  const { data, error } = await supabase
    .from('businesses')
    .select('id, owner_id, user_id, business_name, category, location, description, verification_status, badge_type, status, created_at')
    .eq('id', businessId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching business details:', error);
    return { business: null, error: error.message };
  }

  return { business: (data || null) as AdminBusinessDetail | null, error: null };
}

export async function approveBusiness(businessId: string, adminId: string) {
  const [{ error: bizError }, { error: auditError }] = await Promise.all([
    supabase
      .from('businesses')
      .update({ verification_status: 'verified', badge_type: 'gold', status: 'active' })
      .eq('id', businessId),
    supabase.from('admin_actions').insert({
      admin_id: adminId,
      action_type: 'business_approve',
      target_type: 'business',
      target_id: businessId,
    }),
  ]);

  if (bizError || auditError) {
    console.error('Error approving business:', { bizError, auditError });
    return { error: bizError?.message || auditError?.message || 'Failed to approve business' };
  }

  return { error: null };
}

export async function rejectBusiness(businessId: string, adminId: string, reason: string) {
  const business = await getBusinessDetails(businessId);

  const [{ error: bizError }, { error: noticeError }, { error: auditError }] = await Promise.all([
    supabase
      .from('businesses')
      .update({ verification_status: 'rejected', status: 'active' })
      .eq('id', businessId),
    business.business?.owner_id
      ? supabase.from('admin_notices').insert({
          user_id: business.business.owner_id,
          admin_id: adminId,
          notice_type: 'business_rejected',
          title: 'Business Verification Rejected',
          message: `Your business "${business.business.business_name}" verification was rejected. Reason: ${reason}`,
          related_id: businessId,
        })
      : Promise.resolve({ error: null }),
    supabase.from('admin_actions').insert({
      admin_id: adminId,
      action_type: 'business_reject',
      target_type: 'business',
      target_id: businessId,
      reason,
    }),
  ]);

  if (bizError || noticeError || auditError) {
    console.error('Error rejecting business:', { bizError, noticeError, auditError });
    return { error: bizError?.message || noticeError?.message || auditError?.message || 'Failed to reject business' };
  }

  return { error: null };
}

export async function revokeBusiness(businessId: string, adminId: string, reason: string) {
  const [{ error: bizError }, { error: auditError }] = await Promise.all([
    supabase
      .from('businesses')
      .update({ verification_status: 'unverified', badge_type: 'none' })
      .eq('id', businessId),
    supabase.from('admin_actions').insert({
      admin_id: adminId,
      action_type: 'business_revoke',
      target_type: 'business',
      target_id: businessId,
      reason,
    }),
  ]);

  if (bizError || auditError) {
    console.error('Error revoking business:', { bizError, auditError });
    return { error: bizError?.message || auditError?.message || 'Failed to revoke business' };
  }

  return { error: null };
}

export async function suspendBusiness(businessId: string, adminId: string, reason: string) {
  const [{ error: bizError }, { error: auditError }] = await Promise.all([
    supabase.from('businesses').update({ status: 'suspended' }).eq('id', businessId),
    supabase.from('admin_actions').insert({
      admin_id: adminId,
      action_type: 'business_suspend',
      target_type: 'business',
      target_id: businessId,
      reason,
    }),
  ]);

  if (bizError || auditError) {
    console.error('Error suspending business:', { bizError, auditError });
    return { error: bizError?.message || auditError?.message || 'Failed to suspend business' };
  }

  return { error: null };
}

export async function terminateBusiness(businessId: string, adminId: string, reason: string) {
  const [{ error: bizError }, { error: auditError }] = await Promise.all([
    supabase.from('businesses').update({ status: 'terminated' }).eq('id', businessId),
    supabase.from('admin_actions').insert({
      admin_id: adminId,
      action_type: 'business_terminate',
      target_type: 'business',
      target_id: businessId,
      reason,
    }),
  ]);

  if (bizError || auditError) {
    console.error('Error terminating business:', { bizError, auditError });
    return { error: bizError?.message || auditError?.message || 'Failed to terminate business' };
  }

  return { error: null };
}

// ============================================================================
// LISTING MODERATION
// ============================================================================

export async function hideListing(listingId: string, adminId: string, reason: string) {
  const { error } = await Promise.all([
    supabase
      .from('listings')
      .update({
        status: 'hidden',
        hidden_by: adminId,
        hidden_at: new Date().toISOString(),
      })
      .eq('id', listingId),
    supabase.from('admin_actions').insert({
      admin_id: adminId,
      action_type: 'listing_hide',
      target_type: 'listing',
      target_id: listingId,
      reason,
    }),
  ]).then((results) => {
    const errors = results.map((r) => r.error).filter(Boolean);
    return errors.length > 0 ? { error: errors[0] } : { error: null };
  });

  if (error) {
    console.error('Error hiding listing:', error);
    return { error: error.message || 'Failed to hide listing' };
  }

  return { error: null };
}

export async function restoreListing(listingId: string, adminId: string) {
  const { error } = await Promise.all([
    supabase
      .from('listings')
      .update({
        status: 'active',
        hidden_by: null,
        hidden_at: null,
        deleted_by: null,
        deleted_at: null,
      })
      .eq('id', listingId),
    supabase.from('admin_actions').insert({
      admin_id: adminId,
      action_type: 'listing_restore',
      target_type: 'listing',
      target_id: listingId,
    }),
  ]).then((results) => {
    const errors = results.map((r) => r.error).filter(Boolean);
    return errors.length > 0 ? { error: errors[0] } : { error: null };
  });

  if (error) {
    console.error('Error restoring listing:', error);
    return { error: error.message || 'Failed to restore listing' };
  }

  return { error: null };
}

export async function deleteListingAsAdmin(listingId: string, adminId: string, reason: string) {
  const { error } = await Promise.all([
    supabase
      .from('listings')
      .update({
        status: 'hidden',
        deleted_by: adminId,
        deleted_at: new Date().toISOString(),
      })
      .eq('id', listingId),
    supabase.from('admin_actions').insert({
      admin_id: adminId,
      action_type: 'listing_delete',
      target_type: 'listing',
      target_id: listingId,
      reason,
    }),
  ]).then((results) => {
    const errors = results.map((r) => r.error).filter(Boolean);
    return errors.length > 0 ? { error: errors[0] } : { error: null };
  });

  if (error) {
    console.error('Error deleting listing:', error);
    return { error: error.message || 'Failed to delete listing' };
  }

  return { error: null };
}

// ============================================================================
// VERIFICATION MODERATION
// ============================================================================

export async function approveVerification(verificationId: string, adminId: string, userId: string, businessId?: string | null, addBadge = true) {
  const [{ error: verifyError }, { error: profileError }, businessResult] = await Promise.all([
    supabase
      .from('verification_requests')
      .update({
        status: 'verified',
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', verificationId),
    supabase.from('profiles').update({ verification_status: 'verified', ...(addBadge && { badge_type: 'blue' }) }).eq('id', userId),
    businessId
      ? supabase.from('businesses').update({ verification_status: 'verified', badge_type: 'gold', status: 'active' }).eq('id', businessId)
      : Promise.resolve({ error: null }),
  ]);

  if (verifyError || profileError || businessResult.error) {
    console.error('Error approving verification:', { verifyError, profileError, businessError: businessResult.error });
    return { error: verifyError?.message || profileError?.message || businessResult.error?.message || 'Failed to approve verification' };
  }

  await Promise.all([
    insertOptionalNotification(
      userId,
      'verification approved',
      'Verification approved',
      'Your verification request was approved.'
    ),
    supabase.from('admin_actions').insert({
      admin_id: adminId,
      action_type: 'verification_approve',
      target_type: 'verification',
      target_id: verificationId,
    }).then(({ error }) => {
      if (error) console.error('Optional admin audit insert failed:', error);
    }),
  ]);

  return { error: null };
}

export async function rejectVerification(verificationId: string, adminId: string, userId: string, reason: string) {
  const { error: verifyError } = await supabase
    .from('verification_requests')
    .update({
      status: 'rejected',
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
      admin_note: reason,
    })
    .eq('id', verificationId);

  if (verifyError) {
    console.error('Error rejecting verification:', { verifyError });
    return { error: verifyError.message || 'Failed to reject verification' };
  }

  await Promise.all([
    insertOptionalNotification(
      userId,
      'verification rejected',
      'Verification rejected',
      `Your verification request was rejected. Reason: ${reason}`
    ),
    supabase
      .from('admin_notices')
      .insert({
        user_id: userId,
        admin_id: adminId,
        notice_type: 'verification_rejected',
        title: 'Verification Request Rejected',
        message: `Your verification request was rejected. Reason: ${reason}`,
        related_id: verificationId,
      })
      .then(({ error }) => {
        if (error) console.error('Optional admin notice insert failed:', error);
      }),
    supabase
      .from('admin_actions')
      .insert({
        admin_id: adminId,
        action_type: 'verification_reject',
        target_type: 'verification',
        target_id: verificationId,
        reason,
      })
      .then(({ error }) => {
        if (error) console.error('Optional admin audit insert failed:', error);
      }),
  ]);

  return { error: null };
}

export async function revokeVerification(userId: string, adminId: string, reason: string) {
  const [{ error: profileError }, { error: auditError }] = await Promise.all([
    supabase.from('profiles').update({ verification_status: 'unverified', badge_type: 'none' }).eq('id', userId),
    supabase.from('admin_actions').insert({
      admin_id: adminId,
      action_type: 'verification_revoke',
      target_type: 'user',
      target_id: userId,
      reason,
    }),
  ]);

  if (profileError || auditError) {
    console.error('Error revoking verification:', { profileError, auditError });
    return { error: profileError?.message || auditError?.message || 'Failed to revoke verification' };
  }

  return { error: null };
}

// ============================================================================
// REPORTS HANDLING
// ============================================================================

export async function resolveReport(reportId: string, adminId: string, resolution: string, action?: string) {
  const { error } = await Promise.all([
    supabase
      .from('reports')
      .update({
        status: 'resolved',
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
        resolution,
      })
      .eq('id', reportId),
    supabase.from('admin_actions').insert({
      admin_id: adminId,
      action_type: 'report_resolve',
      target_type: 'report',
      target_id: reportId,
      reason: action,
    }),
  ]).then((results) => {
    const errors = results.map((r) => r.error).filter(Boolean);
    return errors.length > 0 ? { error: errors[0] } : { error: null };
  });

  if (error) {
    console.error('Error resolving report:', error);
    return { error: error.message || 'Failed to resolve report' };
  }

  return { error: null };
}

export async function sendReportResponse(reporterId: string, adminId: string, message: string) {
  const { error } = await supabase.from('admin_notices').insert({
    user_id: reporterId,
    admin_id: adminId,
    notice_type: 'report_response',
    title: 'Report Response',
    message,
  });

  if (error) {
    console.error('Error sending report response:', error);
    return { error: error.message || 'Failed to send response' };
  }

  await insertOptionalNotification(reporterId, 'report response', 'Report response', message);

  return { error: null };
}

// ============================================================================
// ADMIN HELPERS
// ============================================================================

export async function logAdminAction(
  adminId: string,
  actionType: string,
  targetType: string,
  targetId: string,
  reason?: string
) {
  const { error } = await supabase.from('admin_actions').insert({
    admin_id: adminId,
    action_type: actionType,
    target_type: targetType,
    target_id: targetId,
    reason,
  });

  if (error) {
    console.error('Error logging admin action:', error);
  }

  return { error: error?.message || null };
}

export async function getAllAdminActions(adminId?: string, limit = 100) {
  let query = supabase
    .from('admin_actions')
    .select('id, admin_id, action_type, target_type, target_id, reason, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (adminId) {
    query = query.eq('admin_id', adminId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching admin actions:', error);
    return { actions: [], error: error.message };
  }

  return { actions: data || [], error: null };
}

export { updateComplaintStatus };
