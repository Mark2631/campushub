'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import BottomNav from '../../components/BottomNav';
import Header from '../../components/Header';
import Logo from '../../components/Logo';
import useUser from '../../hooks/useUser';
import {
  AdminDashboardData,
  getAdminDashboardData,
  updateReportStatus,
  suspendUser,
  unblockUser,
  banUser,
  warnUser,
  approveBusiness,
  rejectBusiness,
  revokeBusiness,
  suspendBusiness,
  terminateBusiness,
  hideListing,
  restoreListing,
  deleteListingAsAdmin,
  approveVerification,
  rejectVerification,
  revokeVerification,
  sendReportResponse,
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
      : status === 'rejected' || status === 'hidden' || status === 'banned' || status === 'suspended'
        ? 'border-red-500/30 bg-red-500/10 text-red-200'
        : status === 'reviewed' || status === 'reported'
          ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
          : status === 'admin'
            ? 'border-blue-500/30 bg-blue-500/10 text-blue-200'
            : 'border-zinc-700 bg-zinc-900 text-zinc-300';

  return <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${color}`}>{formatStatus(status)}</span>;
}

function ModalDialog({
  isOpen,
  title,
  onClose,
  onConfirm,
  children,
  confirmText = 'Confirm',
  isLoading = false,
}: {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  onConfirm: () => void;
  children: React.ReactNode;
  confirmText?: string;
  isLoading?: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 max-w-md w-full shadow-2xl">
        <h2 className="text-xl font-bold text-white">{title}</h2>
        <div className="mt-4 text-zinc-300">{children}</div>
        <div className="mt-6 flex gap-3">
          <button onClick={onClose} disabled={isLoading} className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:border-zinc-600 disabled:opacity-60">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isLoading} className="flex-1 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60">
            {isLoading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ModalState {
  type: 'user_suspend' | 'user_unblock' | 'user_ban' | 'user_warn' | 'business_approve' | 'business_reject' | 'business_revoke' | 'business_suspend' | 'business_terminate' | 'listing_hide' | 'listing_restore' | 'listing_delete' | 'verification_reject' | 'verification_revoke' | 'report_response' | null;
  userId?: string;
  businessId?: string;
  listingId?: string;
  verificationId?: string;
  reportId?: string;
  reporterId?: string;
  notes?: string;
}

export default function AdminPage() {
  const { loading: userLoading, isAdmin, adminLoading, user: authUser } = useUser();
  const [dashboard, setDashboard] = useState<AdminDashboardData>(emptyDashboard);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [tab, setTab] = useState<'overview' | 'users' | 'businesses' | 'listings' | 'verifications' | 'reports' | 'audit'>('overview');
  const [modalState, setModalState] = useState<ModalState>({ type: null });
  const [modalNotes, setModalNotes] = useState('');
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');

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

  const openModal = (
    type: ModalState['type'],
    title: string,
    message: string,
    targetId?: string,
    targetType?: 'user' | 'business' | 'listing' | 'verification' | 'report'
  ) => {
    setModalState({
      type,
      ...(targetType === 'user' && { userId: targetId }),
      ...(targetType === 'business' && { businessId: targetId }),
      ...(targetType === 'listing' && { listingId: targetId }),
      ...(targetType === 'verification' && { verificationId: targetId }),
      ...(targetType === 'report' && { reportId: targetId }),
    });
    setModalTitle(title);
    setModalMessage(message);
    setModalNotes('');
  };

  const confirmAction = async () => {
    if (!authUser?.id) return;

    try {
      let error = null;

      switch (modalState.type) {
        case 'user_suspend':
          if (modalState.userId) {
            const result = await suspendUser(modalState.userId, authUser.id, modalNotes || 'Suspended by admin');
            error = result.error;
          }
          break;
        case 'user_unblock':
          if (modalState.userId) {
            const result = await unblockUser(modalState.userId, authUser.id, modalNotes || 'Unblocked by admin');
            error = result.error;
          }
          break;
        case 'user_ban':
          if (modalState.userId) {
            const result = await banUser(modalState.userId, authUser.id, modalNotes || 'Banned by admin');
            error = result.error;
          }
          break;
        case 'user_warn':
          if (modalState.userId) {
            const result = await warnUser(modalState.userId, authUser.id, 'Admin Warning', modalNotes || 'You have been warned by an admin.');
            error = result.error;
          }
          break;
        case 'business_approve':
          if (modalState.businessId) {
            const result = await approveBusiness(modalState.businessId, authUser.id);
            error = result.error;
          }
          break;
        case 'business_reject':
          if (modalState.businessId) {
            const result = await rejectBusiness(modalState.businessId, authUser.id, modalNotes || 'Does not meet verification requirements');
            error = result.error;
          }
          break;
        case 'business_revoke':
          if (modalState.businessId) {
            const result = await revokeBusiness(modalState.businessId, authUser.id, modalNotes || 'Verification revoked');
            error = result.error;
          }
          break;
        case 'business_suspend':
          if (modalState.businessId) {
            const result = await suspendBusiness(modalState.businessId, authUser.id, modalNotes || 'Suspended by admin');
            error = result.error;
          }
          break;
        case 'business_terminate':
          if (modalState.businessId) {
            const result = await terminateBusiness(modalState.businessId, authUser.id, modalNotes || 'Terminated by admin');
            error = result.error;
          }
          break;
        case 'listing_hide':
          if (modalState.listingId) {
            const result = await hideListing(modalState.listingId, authUser.id, modalNotes || 'Hidden by admin');
            error = result.error;
          }
          break;
        case 'listing_restore':
          if (modalState.listingId) {
            const result = await restoreListing(modalState.listingId, authUser.id);
            error = result.error;
          }
          break;
        case 'listing_delete':
          if (modalState.listingId) {
            const result = await deleteListingAsAdmin(modalState.listingId, authUser.id, modalNotes || 'Deleted by admin');
            error = result.error;
          }
          break;
        case 'verification_reject':
          if (modalState.verificationId && modalState.userId) {
            const result = await rejectVerification(modalState.verificationId, authUser.id, modalState.userId, modalNotes || 'Verification requirements not met');
            error = result.error;
          }
          break;
        case 'verification_revoke':
          if (modalState.userId) {
            const result = await revokeVerification(modalState.userId, authUser.id, modalNotes || 'Verification revoked');
            error = result.error;
          }
          break;
        case 'report_response':
          if (modalState.reporterId) {
            const result = await sendReportResponse(modalState.reporterId, authUser.id, modalNotes || 'Thank you for your report.');
            error = result.error;
          }
          break;
      }

      setModalState({ type: null });

      if (error) {
        setMessage({ type: 'error', text: error });
      } else {
        setMessage({ type: 'success', text: 'Action completed successfully.' });
        await loadDashboard();
      }
    } catch (err) {
      console.error('Error in confirmAction:', err);
      setMessage({ type: 'error', text: 'An unexpected error occurred.' });
    }
  };

  if (userLoading || adminLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-black pb-24 text-white">
        <Header />
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:py-8">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8 text-center text-zinc-400">Checking access...</div>
        </main>
        <BottomNav />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col bg-black pb-24 text-white">
        <Header />
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:py-8">
          <div className="rounded-2xl border border-red-900/70 bg-red-950/30 p-8 text-center">
            <h2 className="text-2xl font-bold text-red-100">Access denied.</h2>
            <p className="mt-2 text-sm text-red-200/80">This area is restricted to the CampusTrader admin account.</p>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

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
            <p className="mt-2 text-sm text-zinc-400">Control users, businesses, listings, verification, and handle reports.</p>
          </div>
          <button
            onClick={loadDashboard}
            disabled={loadingDashboard}
            className="rounded-2xl border border-zinc-700 bg-zinc-900 px-5 py-3 text-sm font-semibold text-zinc-100 transition hover:border-blue-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingDashboard ? 'Refreshing...' : 'Refresh'}
          </button>
        </header>

        {message && (
          <div
            className={`mb-6 rounded-2xl border p-4 ${
              message.type === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                : 'border-red-500/30 bg-red-500/10 text-red-100'
            }`}
          >
            <p className="font-medium">{message.text}</p>
          </div>
        )}

        {dashboard.errors.length > 0 && (
          <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
            <p className="font-semibold">Some admin data could not load.</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {dashboard.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="mb-6 flex gap-2 overflow-x-auto border-b border-zinc-800 pb-0">
          {(['overview', 'users', 'businesses', 'listings', 'verifications', 'reports', 'audit'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-semibold transition ${
                tab === t ? 'border-b-2 border-blue-500 text-blue-300' : 'text-zinc-400 hover:text-zinc-300'
              }`}
            >
              {formatStatus(t)}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {tab === 'overview' && (
          <div className="space-y-8">
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
                <h2 className="mb-4 text-xl font-bold">Latest users</h2>
                <div className="space-y-3">
                  {dashboard.users.length > 0 ? (
                    dashboard.users.slice(0, 5).map((profile) => (
                      <article key={profile.id} className="rounded-2xl border border-zinc-800 bg-black p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-white">{profile.full_name || profile.email || profile.id}</p>
                            <p className="mt-1 truncate text-sm text-zinc-500">{profile.email || 'No email'}</p>
                          </div>
                          <div className="flex gap-2">
                            <StatusPill status={profile.verification_status || 'unverified'} />
                            {profile.role === 'admin' && <StatusPill status="admin" />}
                          </div>
                        </div>
                      </article>
                    ))
                  ) : (
                    <EmptyState text="No users found." />
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5">
                <h2 className="mb-4 text-xl font-bold">Latest reports</h2>
                <div className="space-y-3">
                  {dashboard.reports.length > 0 ? (
                    dashboard.reports.slice(0, 5).map((report) => (
                      <article key={report.id} className="rounded-2xl border border-zinc-800 bg-black p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-white">{report.reason || 'Report'}</p>
                            <p className="mt-1 truncate text-sm text-zinc-5">{formatStatus(report.target_type)}</p>
                          </div>
                          <StatusPill status={report.status} />
                        </div>
                      </article>
                    ))
                  ) : (
                    <EmptyState text="No reports found." />
                  )}
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Users Tab */}
        {tab === 'users' && (
          <section className="space-y-6">
            <h2 className="text-xl font-bold">User management ({dashboard.users.length} users)</h2>
            <div className="space-y-3">
              {dashboard.users.length > 0 ? (
                dashboard.users.map((user) => (
                  <article key={user.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-white">{user.full_name || user.email || user.id}</p>
                          <StatusPill status={user.verification_status || 'unverified'} />
                          {user.role === 'admin' && <StatusPill status="admin" />}
                        </div>
                        <p className="mt-2 text-sm text-zinc-400">{user.email}</p>
                        <p className="mt-1 text-xs text-zinc-600">{formatDate(user.created_at)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => openModal('user_warn', 'Warn User', `Send a warning to ${user.full_name || user.email}?`, user.id, 'user')}
                          className="rounded-xl bg-amber-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-amber-700"
                        >
                          Warn
                        </button>
                        <button
                          onClick={() => openModal('user_suspend', 'Suspend User', `Suspend ${user.full_name || user.email}?`, user.id, 'user')}
                          className="rounded-xl bg-orange-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-orange-700"
                        >
                          Suspend
                        </button>
                        <button
                          onClick={() => openModal('user_unblock', 'Unblock User', `Unblock ${user.full_name || user.email}?`, user.id, 'user')}
                          className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
                        >
                          Unblock
                        </button>
                        <button
                          onClick={() => openModal('user_ban', 'Ban User', `Ban ${user.full_name || user.email} from the platform?`, user.id, 'user')}
                          className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700"
                        >
                          Ban
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <EmptyState text="No users found." />
              )}
            </div>
          </section>
        )}

        {/* Businesses Tab */}
        {tab === 'businesses' && (
          <section className="space-y-6">
            <h2 className="text-xl font-bold">Business management ({dashboard.businesses.length} businesses)</h2>
            <div className="space-y-3">
              {dashboard.businesses.length > 0 ? (
                dashboard.businesses.map((business) => (
                  <article key={business.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-white">{business.business_name}</p>
                          <StatusPill status={business.verification_status} />
                        </div>
                        <p className="mt-2 text-sm text-zinc-400">{business.category} · {business.location}</p>
                        <p className="mt-1 text-sm text-zinc-500">{business.description || 'No description'}</p>
                        <p className="mt-1 text-xs text-zinc-600">{formatDate(business.created_at)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {business.verification_status === 'unverified' && (
                          <>
                            <button
                              onClick={() => openModal('business_approve', 'Approve Business', `Approve "${business.business_name}"?`, business.id, 'business')}
                              className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => openModal('business_reject', 'Reject Business', `Reject "${business.business_name}"?`, business.id, 'business')}
                              className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {business.verification_status === 'verified' && (
                          <>
                            <button
                              onClick={() => openModal('business_revoke', 'Revoke Verification', `Revoke verification for "${business.business_name}"?`, business.id, 'business')}
                              className="rounded-xl bg-amber-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-amber-700"
                            >
                              Revoke
                            </button>
                            <button
                              onClick={() => openModal('business_suspend', 'Suspend Business', `Suspend "${business.business_name}"?`, business.id, 'business')}
                              className="rounded-xl bg-orange-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-orange-700"
                            >
                              Suspend
                            </button>
                            <button
                              onClick={() => openModal('business_terminate', 'Terminate Business', `Terminate "${business.business_name}"?`, business.id, 'business')}
                              className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700"
                            >
                              Terminate
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <EmptyState text="No businesses found." />
              )}
            </div>
          </section>
        )}

        {/* Listings Tab */}
        {tab === 'listings' && (
          <section className="space-y-6">
            <h2 className="text-xl font-bold">Listing moderation ({dashboard.listings.length} listings)</h2>
            <div className="space-y-3">
              {dashboard.listings.length > 0 ? (
                dashboard.listings.map((listing) => (
                  <article key={listing.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-white">{listing.title}</p>
                          <StatusPill status={listing.status} />
                        </div>
                        <p className="mt-2 text-sm text-zinc-400">
                          {listing.price ? `KSh ${listing.price}` : 'No price'} · {listing.location || 'No location'}
                        </p>
                        <p className="mt-1 text-xs text-zinc-600">Seller: {listing.seller_id}</p>
                        <p className="mt-1 text-xs text-zinc-600">{formatDate(listing.created_at)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {listing.status !== 'hidden' && (
                          <button
                            onClick={() => openModal('listing_hide', 'Hide Listing', `Hide "${listing.title}"?`, listing.id, 'listing')}
                            className="rounded-xl bg-amber-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-amber-700"
                          >
                            Hide
                          </button>
                        )}
                        {listing.status === 'hidden' && (
                          <button
                            onClick={() => openModal('listing_restore', 'Restore Listing', `Restore "${listing.title}"?`, listing.id, 'listing')}
                            className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
                          >
                            Restore
                          </button>
                        )}
                        <button
                          onClick={() => openModal('listing_delete', 'Delete Listing', `Permanently delete "${listing.title}"?`, listing.id, 'listing')}
                          className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <EmptyState text="No listings found." />
              )}
            </div>
          </section>
        )}

        {/* Verifications Tab */}
        {tab === 'verifications' && (
          <section className="space-y-6">
            <h2 className="text-xl font-bold">Verification requests ({dashboard.verifications.length} pending)</h2>
            <div className="space-y-3">
              {dashboard.verifications.length > 0 ? (
                dashboard.verifications.map((request) => {
                  const requester = usersById.get(request.user_id);
                  return (
                    <article key={request.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-white">{formatStatus(request.type || request.request_type)}</p>
                            <StatusPill status={request.status} />
                          </div>
                          <p className="mt-2 text-sm text-zinc-400">
                            Requester: {requester?.full_name || requester?.email || request.user_id}
                          </p>
                          <p className="mt-1 text-sm text-zinc-500">Document: {request.document_name || 'No document'}</p>
                          {request.document_urls?.length ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {request.document_urls.map((url) => (
                                <a key={url} href={url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-blue-300 underline">
                                  View
                                </a>
                              ))}
                            </div>
                          ) : null}
                          <p className="mt-1 text-xs text-zinc-600">{formatDate(request.created_at)}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={async () => {
                              setWorkingId(request.id);
                              const result = await approveVerification(request.id, authUser!.id, request.user_id);
                              setWorkingId(null);
                              if (result.error) {
                                setMessage({ type: 'error', text: result.error });
                              } else {
                                setMessage({ type: 'success', text: 'Verification approved.' });
                                await loadDashboard();
                              }
                            }}
                            disabled={workingId === request.id}
                            className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => openModal('verification_reject', 'Reject Verification', `Reject this verification request?`, request.id, 'verification')}
                            className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => openModal('verification_revoke', 'Revoke Verification', `Revoke verification for this user?`, request.user_id, 'verification')}
                            className="rounded-xl bg-amber-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-amber-700"
                          >
                            Revoke
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })
              ) : (
                <EmptyState text="No pending verification requests." />
              )}
            </div>
          </section>
        )}

        {/* Reports Tab */}
        {tab === 'reports' && (
          <section className="space-y-6">
            <h2 className="text-xl font-bold">Reports ({dashboard.reports.length} total)</h2>
            <div className="space-y-3">
              {dashboard.reports.length > 0 ? (
                dashboard.reports.map((report) => (
                  <article key={report.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-white">{formatStatus(report.target_type)} Report</p>
                          <StatusPill status={report.status} />
                        </div>
                        <p className="mt-2 text-sm text-zinc-400">{report.reason || report.details || 'No reason provided'}</p>
                        <p className="mt-1 text-xs text-zinc-600">
                          Target: {report.target_id} · Reporter: {report.reporter_id}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <select
                          value={report.status}
                          onChange={(e) => {
                            const status = e.target.value as 'pending' | 'reviewed' | 'resolved';
                            runAction(
                              report.id,
                              () => updateReportStatus(report.id, status),
                              `Report marked as ${status}.`
                            );
                          }}
                          className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500"
                        >
                          {reportStatuses.map((status) => (
                            <option key={status} value={status}>
                              {formatStatus(status)}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => openModal('report_response', 'Send Response', `Send a response to the reporter?`, report.reporter_id ?? undefined, 'report')}
                          className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
                        >
                          Respond
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <EmptyState text="No reports found." />
              )}
            </div>
          </section>
        )}

        {/* Audit Tab */}
        {tab === 'audit' && (
          <section className="space-y-6">
            <h2 className="text-xl font-bold">Admin action audit log</h2>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
              <p className="text-sm text-zinc-400">Loading audit history...</p>
            </div>
          </section>
        )}
      </main>

      <ModalDialog isOpen={modalState.type !== null} title={modalTitle} onClose={() => setModalState({ type: null })} onConfirm={confirmAction} isLoading={workingId !== null}>
        <div className="space-y-4">
          <p className="text-sm text-zinc-300">{modalMessage}</p>
          {modalState.type && ['user_warn', 'user_suspend', 'business_reject', 'business_revoke', 'business_suspend', 'business_terminate', 'listing_hide', 'listing_delete', 'verification_reject', 'verification_revoke', 'report_response'].includes(modalState.type) && (
            <textarea
              placeholder="Add notes or message (optional)"
              value={modalNotes}
              onChange={(e) => setModalNotes(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-blue-500"
              rows={3}
            />
          )}
        </div>
      </ModalDialog>

      <BottomNav />
    </div>
  );
}
