'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import BottomNav from '../../components/BottomNav';
import Header from '../../components/Header';
import Logo from '../../components/Logo';
import useUser from '../../hooks/useUser';
import {
  AdminBusiness,
  AdminDashboardData,
  AdminListing,
  AdminReport,
  AdminVerificationRequest,
  deleteListing,
  getAdminDashboardData,
  setBusinessVerificationStatus,
  setUserVerificationStatus,
  updateListingStatus,
  updateComplaintStatus,
  updateReportStatus,
} from '../../lib/admin';

const emptyDashboard: AdminDashboardData = {
  verifications: [],
  businesses: [],
  listings: [],
  users: [],
  reports: [],
  stats: {
    users: 0,
    listings: 0,
    businesses: 0,
    reports: 0,
    complaints: 0,
    pendingVerifications: 0,
    activeListings: 0,
    reportedListings: 0,
    pendingBusinesses: 0,
  },
  complaints: [],
  errors: [],
};

const reportStatuses = ['pending', 'reviewed', 'resolved'] as const;

function formatStatus(status?: string | null) {
  if (!status) return 'Unknown';
  return status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(date?: string) {
  if (!date) return 'No date';
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/70 p-6 text-center text-sm text-zinc-500">
      {text}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const color =
    status === 'verified' || status === 'approved' || status === 'resolved'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
      : status === 'rejected' || status === 'hidden'
        ? 'border-red-500/30 bg-red-500/10 text-red-200'
        : status === 'reviewed' || status === 'reported'
          ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
          : 'border-zinc-700 bg-zinc-900 text-zinc-300';

  return <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${color}`}>{formatStatus(status)}</span>;
}

export default function AdminPage() {
  const { loading: userLoading, isAdmin, adminLoading } = useUser();
  const [dashboard, setDashboard] = useState<AdminDashboardData>(emptyDashboard);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const reportedUserAndMessageReports = useMemo(() => {
    return dashboard.reports.filter((report) => {
      const targetType = report.target_type?.toLowerCase();
      return targetType === 'user' || targetType === 'message';
    });
  }, [dashboard.reports]);

  const listingReports = useMemo(() => {
    return dashboard.reports.filter((report) => report.target_type?.toLowerCase() === 'listing');
  }, [dashboard.reports]);

  const reportedListings = useMemo(() => {
    return dashboard.listings.filter((listing) => ['reported', 'hidden'].includes(listing.status));
  }, [dashboard.listings]);

  const pendingBusinesses = useMemo(() => {
    return dashboard.businesses.filter((business) => ['unverified', 'pending'].includes(business.verification_status));
  }, [dashboard.businesses]);

  const usersById = useMemo(() => {
    return new Map(dashboard.users.map((user) => [user.id, user]));
  }, [dashboard.users]);

  const loadDashboard = useCallback(async () => {
    if (!isAdmin) return;

    setLoadingDashboard(true);
    const data = await getAdminDashboardData();
    setDashboard(data);
    setLoadingDashboard(false);
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;

    let isMounted = true;

    const loadInitialDashboard = async () => {
      const data = await getAdminDashboardData();
      if (isMounted) {
        setDashboard(data);
      }
    };

    loadInitialDashboard();

    return () => {
      isMounted = false;
    };
  }, [isAdmin]);

  const runAction = async (id: string, action: () => Promise<{ error: string | null }>, successText: string) => {
    setWorkingId(id);
    setMessage(null);
    const { error } = await action();
    setWorkingId(null);

    if (error) {
      setMessage({ type: 'error', text: error });
      return;
    }

    setMessage({ type: 'success', text: successText });
    await loadDashboard();
  };

  const handleUserVerification = (request: AdminVerificationRequest, status: 'verified' | 'rejected') => {
    runAction(
      request.id,
      () => setUserVerificationStatus(request, status),
      `User verification ${status === 'verified' ? 'approved' : 'rejected'}.`
    );
  };

  const handleBusinessVerification = (business: AdminBusiness, status: 'verified' | 'rejected') => {
    runAction(
      business.id,
      () => setBusinessVerificationStatus(business.id, status),
      `Business verification ${status === 'verified' ? 'approved' : 'rejected'}.`
    );
  };

  const handleListingStatus = (listing: AdminListing, status: 'hidden' | 'reported') => {
    runAction(listing.id, () => updateListingStatus(listing.id, status), `Listing marked as ${status}.`);
  };

  const handleDeleteListing = (listing: AdminListing) => {
    runAction(listing.id, () => deleteListing(listing.id), 'Listing deleted.');
  };

  const handleReportStatus = (report: AdminReport, status: 'pending' | 'reviewed' | 'resolved') => {
    runAction(report.id, () => updateReportStatus(report.id, status), `Report marked as ${status}.`);
  };

  const handleComplaintStatus = (complaintId: string, status: 'open' | 'reviewed' | 'resolved') => {
    runAction(complaintId, () => updateComplaintStatus(complaintId, status), `Complaint marked as ${status}.`);
  };

  return (
    <div className="flex min-h-screen flex-col bg-black pb-24 text-white">
      <Header />
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:py-8">
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-4">
              <Logo />
            </div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-300">CampusTrader Admin</p>
            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Moderation dashboard</h1>
            <p className="mt-2 text-sm text-zinc-400">Review verifications, reports, listings, businesses, and platform health.</p>
          </div>
          {isAdmin && (
            <button
              onClick={loadDashboard}
              disabled={loadingDashboard}
              className="rounded-2xl border border-zinc-700 bg-zinc-900 px-5 py-3 text-sm font-semibold text-zinc-100 transition hover:border-blue-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingDashboard ? 'Refreshing...' : 'Refresh'}
            </button>
          )}
        </header>

        {userLoading || adminLoading ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8 text-center text-zinc-400">Checking access...</div>
        ) : !isAdmin ? (
          <div className="rounded-2xl border border-red-900/70 bg-red-950/30 p-8 text-center">
            <h2 className="text-2xl font-bold text-red-100">Access denied.</h2>
            <p className="mt-2 text-sm text-red-200/80">This area is restricted to the CampusTrader admin account.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {message && (
              <div
                className={`rounded-2xl border p-4 ${
                  message.type === 'success'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                    : 'border-red-500/30 bg-red-500/10 text-red-100'
                }`}
              >
                <p className="font-medium">{message.text}</p>
              </div>
            )}

            {dashboard.errors.length > 0 && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                <p className="font-semibold">Some admin data could not load.</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {dashboard.errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold">Platform stats</h2>
              </div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8">
                {[
                  ['Users', dashboard.stats.users],
                  ['Listings', dashboard.stats.listings],
                  ['Pending verification', dashboard.stats.pendingVerifications],
                  ['Reports', dashboard.stats.reports],
                  ['Complaints', dashboard.stats.complaints],
                  ['Active listings', dashboard.stats.activeListings],
                  ['Reported listings', dashboard.stats.reportedListings],
                  ['Businesses', dashboard.stats.businesses],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
                    <p className="text-2xl font-bold text-white">{value}</p>
                    <p className="mt-2 text-sm text-zinc-500">{label}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-bold">Users</h2>
                  <StatusPill status={`${dashboard.users.length} shown`} />
                </div>
                <div className="space-y-3">
                  {dashboard.users.length > 0 ? (
                    dashboard.users.slice(0, 8).map((profile) => (
                      <article key={profile.id} className="rounded-2xl border border-zinc-800 bg-black p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-white">{profile.full_name || profile.email || profile.id}</p>
                            <p className="mt-1 truncate text-sm text-zinc-500">{profile.email || 'No email'}</p>
                          </div>
                          <StatusPill status={profile.verification_status || 'unverified'} />
                        </div>
                      </article>
                    ))
                  ) : (
                    <EmptyState text="No users found." />
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-bold">Listings</h2>
                  <StatusPill status={`${dashboard.listings.length} shown`} />
                </div>
                <div className="space-y-3">
                  {dashboard.listings.length > 0 ? (
                    dashboard.listings.slice(0, 8).map((listing) => (
                      <article key={listing.id} className="rounded-2xl border border-zinc-800 bg-black p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-white">{listing.title}</p>
                              <StatusPill status={listing.status} />
                            </div>
                            <p className="mt-1 text-sm text-zinc-500">
                              {listing.price ? `KSh ${listing.price}` : 'No price'} · Seller: {listing.seller_id}
                            </p>
                          </div>
                          <button
                            onClick={() => handleListingStatus(listing, listing.status === 'hidden' ? 'reported' : 'hidden')}
                            disabled={workingId === listing.id}
                            className="rounded-xl bg-zinc-800 px-3 py-2 text-xs font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-60"
                          >
                            {listing.status === 'hidden' ? 'Mark reported' : 'Hide'}
                          </button>
                        </div>
                      </article>
                    ))
                  ) : (
                    <EmptyState text="No listings found." />
                  )}
                </div>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-bold">Pending verifications</h2>
                  <StatusPill status={`${dashboard.verifications.length} pending`} />
                </div>
                <div className="space-y-3">
                  {dashboard.verifications.length > 0 ? (
                    dashboard.verifications.map((request) => {
                      const requester = usersById.get(request.user_id);

                      return (
                      <article key={request.id} className="rounded-2xl border border-zinc-800 bg-black p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <p className="font-semibold text-white">{formatStatus(request.type || request.request_type)}</p>
                            <p className="mt-1 truncate text-sm text-zinc-400">
                              Requester: {requester?.full_name || requester?.email || request.user_id}
                            </p>
                            <p className="mt-1 text-sm text-zinc-500">Document: {request.document_name || 'No document name'}</p>
                            {request.document_urls?.length ? (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {request.document_urls.map((url) => (
                                  <a key={url} href={url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-blue-300 underline">
                                    View document
                                  </a>
                                ))}
                              </div>
                            ) : null}
                            {request.admin_note ? <p className="mt-1 text-xs text-amber-300">Note: {request.admin_note}</p> : null}
                            <p className="mt-1 text-xs text-zinc-600">{formatDate(request.created_at)}</p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleUserVerification(request, 'verified')}
                              disabled={workingId === request.id}
                              className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleUserVerification(request, 'rejected')}
                              disabled={workingId === request.id}
                              className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                    })
                  ) : (
                    <EmptyState text="No pending user verification requests." />
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-bold">Businesses awaiting approval</h2>
                  <StatusPill status={`${pendingBusinesses.length} pending`} />
                </div>
                <div className="space-y-3">
                  {pendingBusinesses.length > 0 ? (
                    pendingBusinesses.map((business) => (
                      <article key={business.id} className="rounded-2xl border border-zinc-800 bg-black p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-white">{business.business_name}</p>
                              <StatusPill status={business.verification_status} />
                            </div>
                            <p className="mt-1 text-sm text-zinc-400">{business.category} in {business.location}</p>
                            <p className="mt-1 text-sm text-zinc-500">{business.description || 'No description provided.'}</p>
                            <p className="mt-1 text-xs text-zinc-600">Owner: {business.owner_id || business.user_id}</p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleBusinessVerification(business, 'verified')}
                              disabled={workingId === business.id}
                              className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleBusinessVerification(business, 'rejected')}
                              disabled={workingId === business.id}
                              className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      </article>
                    ))
                  ) : (
                    <EmptyState text="No business profiles are waiting for approval." />
                  )}
                </div>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-bold">Reported listings</h2>
                  <StatusPill status={`${reportedListings.length + listingReports.length} items`} />
                </div>
                <div className="space-y-3">
                  {reportedListings.length > 0 ? (
                    reportedListings.map((listing) => (
                      <article key={listing.id} className="rounded-2xl border border-zinc-800 bg-black p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-white">{listing.title}</p>
                              <StatusPill status={listing.status} />
                            </div>
                            <p className="mt-1 text-sm text-zinc-400">{listing.price ? `KSh ${listing.price}` : 'No price'} · {listing.location || 'No location'}</p>
                            <p className="mt-1 text-xs text-zinc-600">Seller: {listing.seller_id}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => handleListingStatus(listing, 'hidden')}
                              disabled={workingId === listing.id}
                              className="rounded-xl bg-zinc-800 px-3 py-2 text-xs font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-60"
                            >
                              Hide
                            </button>
                            <button
                              onClick={() => handleListingStatus(listing, 'reported')}
                              disabled={workingId === listing.id}
                              className="rounded-xl bg-amber-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:opacity-60"
                            >
                              Mark reported
                            </button>
                            <button
                              onClick={() => handleDeleteListing(listing)}
                              disabled={workingId === listing.id}
                              className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </article>
                    ))
                  ) : (
                    <EmptyState text="No listings are currently marked reported or hidden." />
                  )}

                  {listingReports.length > 0 && (
                    <div className="rounded-2xl border border-zinc-800 bg-black p-4">
                      <p className="mb-3 text-sm font-semibold text-zinc-300">Listing reports</p>
                      <div className="space-y-2">
                        {listingReports.map((report) => (
                          <p key={report.id} className="text-sm text-zinc-500">
                            {report.reason || 'Report'} for listing {report.target_id || 'unknown'} · {formatStatus(report.status)}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-bold">Reported users/messages</h2>
                  <StatusPill status={`${reportedUserAndMessageReports.length} reports`} />
                </div>
                <div className="space-y-3">
                  {reportedUserAndMessageReports.length > 0 ? (
                    reportedUserAndMessageReports.map((report) => (
                      <article key={report.id} className="rounded-2xl border border-zinc-800 bg-black p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-white">{formatStatus(report.target_type)} report</p>
                              <StatusPill status={report.status} />
                            </div>
                            <p className="mt-1 text-sm text-zinc-400">{report.reason || report.details || 'No reason provided.'}</p>
                            <p className="mt-1 text-xs text-zinc-600">Target: {report.target_id || 'Unknown'} · Reporter: {report.reporter_id || 'Unknown'}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {(['reviewed', 'resolved'] as const).map((status) => (
                              <button
                                key={status}
                                onClick={() => handleReportStatus(report, status)}
                                disabled={workingId === report.id}
                                className="rounded-xl bg-zinc-800 px-3 py-2 text-xs font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-60"
                              >
                                Mark {status}
                              </button>
                            ))}
                          </div>
                        </div>
                      </article>
                    ))
                  ) : (
                    <EmptyState text="No user or message reports yet." />
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold">Reports</h2>
                <StatusPill status={`${dashboard.reports.length} total`} />
              </div>
              <div className="overflow-hidden rounded-2xl border border-zinc-800">
                {dashboard.reports.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead className="bg-zinc-900 text-xs uppercase tracking-wide text-zinc-500">
                        <tr>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3">Reason</th>
                          <th className="px-4 py-3">Target</th>
                          <th className="px-4 py-3">Reporter</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Updated status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800 bg-black">
                        {dashboard.reports.map((report) => (
                          <tr key={report.id}>
                            <td className="px-4 py-3 text-zinc-200">{formatStatus(report.target_type)}</td>
                            <td className="px-4 py-3 text-zinc-400">{report.reason || report.details || 'No reason'}</td>
                            <td className="px-4 py-3 text-zinc-500">{report.target_id || 'Unknown'}</td>
                            <td className="px-4 py-3 text-zinc-500">{report.reporter_id || 'Unknown'}</td>
                            <td className="px-4 py-3">
                              <StatusPill status={report.status} />
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={report.status}
                                onChange={(event) => handleReportStatus(report, event.target.value as 'pending' | 'reviewed' | 'resolved')}
                                disabled={workingId === report.id}
                                className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500 disabled:opacity-60"
                              >
                                {reportStatuses.map((status) => (
                                  <option key={status} value={status}>
                                    {formatStatus(status)}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState text="No reports found in the reports table." />
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold">User experience complaints</h2>
                <StatusPill status={`${dashboard.complaints.length} total`} />
              </div>
              <div className="space-y-3">
                {dashboard.complaints.length > 0 ? (
                  dashboard.complaints.map((complaint) => (
                    <article key={complaint.id} className="rounded-2xl border border-zinc-800 bg-black p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-white">{complaint.subject}</p>
                            <StatusPill status={complaint.status} />
                          </div>
                          <p className="mt-1 text-sm text-zinc-400">{complaint.message}</p>
                          <p className="mt-1 text-xs text-zinc-600">
                            {complaint.email || 'No email'} · {formatDate(complaint.created_at)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(['reviewed', 'resolved'] as const).map((status) => (
                            <button
                              key={status}
                              onClick={() => handleComplaintStatus(complaint.id, status)}
                              disabled={workingId === complaint.id}
                              className="rounded-xl bg-zinc-800 px-3 py-2 text-xs font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-60"
                            >
                              Mark {status}
                            </button>
                          ))}
                        </div>
                      </div>
                    </article>
                  ))
                ) : (
                  <EmptyState text="No complaints submitted yet." />
                )}
              </div>
            </section>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
