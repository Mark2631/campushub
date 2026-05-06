import { supabase } from './supabase';
import { ComplaintRecord, getComplaints, updateComplaintStatus } from './complaints';

export interface AdminVerificationRequest {
  id: string;
  user_id: string;
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

export interface PlatformStats {
  profiles: number;
  listings: number;
  businesses: number;
  reports: number;
  pendingVerifications: number;
  activeListings: number;
  reportedListings: number;
  pendingBusinesses: number;
}

export interface AdminDashboardData {
  verifications: AdminVerificationRequest[];
  businesses: AdminBusiness[];
  listings: AdminListing[];
  reports: AdminReport[];
  complaints: ComplaintRecord[];
  stats: PlatformStats;
  errors: string[];
}

function errorMessage(scope: string, error: { message: string } | null) {
  if (error) {
    console.error(`${scope} error:`, error);
  }
  return error ? `${scope}: ${error.message}` : null;
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const errors: string[] = [];

  const [
    verificationsResponse,
    businessesResponse,
    listingsResponse,
    reportsResponse,
    profilesCount,
    listingsCount,
    businessesCount,
    reportsCount,
    activeListingsCount,
    reportedListingsCount,
    complaintsResponse,
  ] = await Promise.all([
    supabase
      .from('verification_requests')
      .select('id, user_id, business_id, type, request_type, document_name, document_urls, admin_note, status, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
    supabase
      .from('businesses')
      .select('id, user_id, business_name, category, location, description, verification_status, created_at')
      .in('verification_status', ['unverified', 'pending'])
      .order('created_at', { ascending: false }),
    supabase
      .from('listings')
      .select('id, seller_id, title, price, status, location, created_at')
      .in('status', ['reported', 'hidden'])
      .order('created_at', { ascending: false }),
    supabase
      .from('reports')
      .select('id, reporter_id, target_type, target_id, reason, details, status, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('listings').select('id', { count: 'exact', head: true }),
    supabase.from('businesses').select('id', { count: 'exact', head: true }),
    supabase.from('reports').select('id', { count: 'exact', head: true }),
    supabase.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'reported'),
    getComplaints(),
  ]);

  [
    errorMessage('Pending verifications', verificationsResponse.error),
    errorMessage('Businesses awaiting approval', businessesResponse.error),
    errorMessage('Reported listings', listingsResponse.error),
    errorMessage('Reports', reportsResponse.error),
    errorMessage('Profile stats', profilesCount.error),
    errorMessage('Listing stats', listingsCount.error),
    errorMessage('Business stats', businessesCount.error),
    errorMessage('Report stats', reportsCount.error),
    errorMessage('Active listing stats', activeListingsCount.error),
    errorMessage('Reported listing stats', reportedListingsCount.error),
    complaintsResponse.error ? `Complaints: ${complaintsResponse.error}` : null,
  ].forEach((message) => {
    if (message) errors.push(message);
  });

  return {
    verifications: (verificationsResponse.data || []) as AdminVerificationRequest[],
    businesses: (businessesResponse.data || []) as AdminBusiness[],
    listings: (listingsResponse.data || []) as AdminListing[],
    reports: (reportsResponse.data || []) as AdminReport[],
    complaints: complaintsResponse.complaints,
    stats: {
      profiles: profilesCount.count || 0,
      listings: listingsCount.count || 0,
      businesses: businessesCount.count || 0,
      reports: reportsCount.count || 0,
      pendingVerifications: verificationsResponse.data?.length || 0,
      activeListings: activeListingsCount.count || 0,
      reportedListings: reportedListingsCount.count || 0,
      pendingBusinesses: businessesResponse.data?.length || 0,
    },
    errors,
  };
}

export async function setUserVerificationStatus(request: AdminVerificationRequest, status: 'verified' | 'rejected') {
  const requestStatus = status === 'verified' ? 'approved' : 'rejected';

  const [{ error: profileError }, { error: requestError }] = await Promise.all([
    supabase
      .from('profiles')
      .update({ verification_status: status })
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
    .update({ verification_status: status })
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

export { updateComplaintStatus };
