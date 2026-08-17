'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, HelpCircle, Settings, ShieldCheck, UserRound, X } from 'lucide-react';
import BottomNav from '../../components/BottomNav';
import Header from '../../components/Header';
import Logo from '../../components/Logo';
import ReportButton from '../../components/ReportButton';
import HelpCenterModal from '../../components/HelpCenterModal';
import ManagePanel from '../../components/ManagePanel';
import useTheme from '../../hooks/useTheme';
import useUser from '../../hooks/useUser';
import { signOut } from '../../lib/auth';
import { createComplaint } from '../../lib/complaints';
import { getListingsByUser, Listing, updateListingLifecycleStatus } from '../../lib/listings';
import {
  BusinessRecord,
  ProfileRecord,
  VerificationRequestRecord,
  createBusinessProfile,
  getBusinessProfiles,
  getLatestVerificationRequest,
  getProfileById,
  saveProfileAvatar,
  saveProfilePhone,
  submitVerificationRequest,
  uploadVerificationDocument,
  upsertProfile,
} from '../../lib/profiles';
import { compressImageFile, validateUploadFile } from '../../lib/storage';

const verificationTypes = [
  { value: 'student', label: 'Student ID' },
  { value: 'national_id', label: 'National ID' },
  { value: 'business', label: 'Business verification' },
] as const;

const businessCategories = ['Campus Services', 'Food', 'Electronics', 'Fashion', 'Books', 'Repairs', 'Other'];

function statusLabel(status?: string | null) {
  if (!status || status === 'unverified') return 'Not verified';
  if (status === 'verified') return 'Verified seller';
  if (status === 'pending') return 'Verification under review';
  if (status === 'rejected') return 'Verification rejected';
  return status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusClass(status?: string | null) {
  if (status === 'verified') return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200';
  if (status === 'pending') return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200';
  if (status === 'rejected') return 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200';
  return 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300';
}

type ListingFilter = 'active' | 'sold' | 'hidden' | 'pending_payment';

function listingEmptyText(filter: ListingFilter) {
  if (filter === 'active') return 'No active listings';
  if (filter === 'sold') return 'No sold listings';
  if (filter === 'pending_payment') return 'No pending listings';
  return 'No hidden listings';
}

export default function ProfilePage() {
  const { user, loading, isAdmin, profileContext, setProfileContext, showToast } = useUser();
  const { theme, toggleTheme } = useTheme();
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [businesses, setBusinesses] = useState<BusinessRecord[]>([]);
  const [verificationRequest, setVerificationRequest] = useState<VerificationRequestRecord | null>(null);
  const [userListings, setUserListings] = useState<Listing[]>([]);
  const [profileLoading, setProfileLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [verificationFormOpen, setVerificationFormOpen] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [listingFilter, setListingFilter] = useState<ListingFilter>('active');
  const [listingsCollapsed, setListingsCollapsed] = useState(false);
  const [listingActionId, setListingActionId] = useState<string | null>(null);
  const [verificationType, setVerificationType] = useState<(typeof verificationTypes)[number]['value']>('student');
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);
  const [documentPreviews, setDocumentPreviews] = useState<string[]>([]);
  const [verificationSubmitting, setVerificationSubmitting] = useState(false);
  const [verificationUploadStatus, setVerificationUploadStatus] = useState('');
  const [businessSubmitting, setBusinessSubmitting] = useState(false);
  const [complaintSubmitting, setComplaintSubmitting] = useState(false);
  const [complaintForm, setComplaintForm] = useState({ subject: '', message: '' });
  const [businessForm, setBusinessForm] = useState({
    business_name: '',
    category: businessCategories[0],
    location: '',
    description: '',
  });

  const displayName = useMemo(() => {
    return profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'CampusTrader user';
  }, [profile, user]);

  const verificationStatus = profile?.verification_status || verificationRequest?.status || 'unverified';
  const activeListingsCount = userListings.filter((listing) => listing.status === 'active').length;
  const soldListingsCount = userListings.filter((listing) => listing.status === 'sold').length;
  const hiddenListingsCount = userListings.filter((listing) => listing.status === 'hidden').length;
  const pendingListingsCount = userListings.filter((listing) => listing.status === 'pending_payment').length;
  const filteredListings = userListings.filter((listing) => listing.status === listingFilter);

  const loadProfile = async () => {
    if (!user) return;
    setProfileLoading(true);
    const [{ profile: syncedProfile }, { businesses: userBusinesses }, { listings }, { request }] = await Promise.all([
      upsertProfile(user),
      getBusinessProfiles(user.id),
      getListingsByUser(user.id),
      getLatestVerificationRequest(user.id),
    ]);

    setProfile(syncedProfile);
    setPhoneInput(syncedProfile?.phone_number || '');
    setBusinesses(userBusinesses);
    setUserListings(listings);
    setVerificationRequest(request);
    setProfileLoading(false);
  };

  useEffect(() => {
    void loadProfile();
  }, [user]);

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  useEffect(() => {
    return () => {
      documentPreviews.forEach((previewUrl) => URL.revokeObjectURL(previewUrl));
    };
  }, [documentPreviews]);

  const setCleanError = (text = 'Something went wrong. Try again.') => {
    setMessage({ type: 'error', text });
    showToast({ type: 'error', message: text });
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file || !user) return;

    const validationError = validateUploadFile(file, 'image', 5 * 1024 * 1024);
    if (validationError) {
      setCleanError(validationError);
      return;
    }

    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(URL.createObjectURL(file));
    setAvatarUploading(true);
    setMessage(null);

    const compressed = await compressImageFile(file, 1600);
    const { avatarUrl, error } = await saveProfileAvatar(user.id, compressed);
    setAvatarUploading(false);

    if (error || !avatarUrl) {
      console.error('Profile avatar update failed:', error);
      setCleanError(error || 'Upload failed. Please retry.');
      return;
    }

    setAvatarPreview(null);
    setProfile((current) => current ? { ...current, avatar_url: avatarUrl } : current);
    const { profile: refreshedProfile } = await getProfileById(user.id);
    if (refreshedProfile) setProfile(refreshedProfile);
    setMessage({ type: 'success', text: 'Profile photo updated.' });
    showToast({ type: 'success', message: 'Profile photo updated.' });
  };

  const handlePhoneSave = async () => {
    if (!user) return;
    const { phoneNumber, error } = await saveProfilePhone(user.id, phoneInput);
    if (error) {
      console.error('WhatsApp save failed:', error);
      setCleanError(error);
      return;
    }
    setPhoneInput(phoneNumber || '');
    setProfile((current) => current ? { ...current, phone_number: phoneNumber } : current);
    setMessage({ type: 'success', text: 'WhatsApp number saved.' });
    showToast({ type: 'success', message: 'WhatsApp number saved.' });
  };

  const handleListingStatus = async (listingId: string, status: 'sold' | 'hidden' | 'active') => {
    if (!user) return;
    setListingActionId(listingId);
    setMessage(null);
    const { error } = await updateListingLifecycleStatus(listingId, user.id, status);
    setListingActionId(null);

    if (error) {
      console.error('Listing status update failed:', error);
      setCleanError(error);
      return;
    }

    setUserListings((current) => current.map((listing) => listing.id === listingId ? { ...listing, status } : listing));
    window.dispatchEvent(new Event('campustrader:listings-refresh'));
    showToast({ type: 'success', message: status === 'sold' ? 'Marked as sold.' : status === 'hidden' ? 'Listing hidden.' : 'Listing restored.' });
  };

  const handleBusinessSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;

    setBusinessSubmitting(true);
    setMessage(null);
    const { business, error } = await createBusinessProfile(user.id, businessForm);
    setBusinessSubmitting(false);

    if (error || !business) {
      console.error('Business profile creation failed:', error);
      setCleanError(error || undefined);
      return;
    }

    setBusinesses((current) => [business, ...current]);
    setBusinessForm({ business_name: '', category: businessCategories[0], location: '', description: '' });
    setMessage({ type: 'success', text: 'Business profile created.' });
    showToast({ type: 'success', message: 'Business profile created.' });
  };

  const handleComplaintSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!complaintForm.subject.trim() || !complaintForm.message.trim()) {
      setCleanError('Subject and message are required.');
      return;
    }

    setComplaintSubmitting(true);
    const { error } = await createComplaint({
      userId: user?.id || null,
      email: user?.email || '',
      subject: complaintForm.subject,
      message: complaintForm.message,
    });
    setComplaintSubmitting(false);

    if (error) {
      console.error('Issue report failed:', error);
      setCleanError();
      return;
    }

    setComplaintForm({ subject: '', message: '' });
    setMessage({ type: 'success', text: 'Issue submitted.' });
    showToast({ type: 'success', message: 'Issue submitted.' });
  };

  const clearDocumentFile = () => {
    documentPreviews.forEach((previewUrl) => URL.revokeObjectURL(previewUrl));
    setDocumentFiles([]);
    setDocumentPreviews([]);
  };

  const handleDocumentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.currentTarget.files || []);
    event.currentTarget.value = '';
    documentPreviews.forEach((previewUrl) => URL.revokeObjectURL(previewUrl));

    const maxFiles = verificationType === 'business' ? 2 : 1;
    const nextFiles = selectedFiles.slice(0, maxFiles);
    const validationErrors = nextFiles.map((file) => validateUploadFile(file, 'verification-document', 8 * 1024 * 1024)).filter(Boolean);

    if (validationErrors.length > 0) {
      setCleanError(validationErrors.join(' '));
      setDocumentFiles([]);
      setDocumentPreviews([]);
      return;
    }

    setDocumentFiles(nextFiles);
    setDocumentPreviews(nextFiles.map((file) => URL.createObjectURL(file)));
  };

  const handleVerificationSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;

    if (documentFiles.length === 0) {
      setCleanError('Choose a document before submitting.');
      return;
    }

    setVerificationSubmitting(true);
    setVerificationUploadStatus('Uploading document...');
    setMessage(null);
    const uploadedUrls: string[] = [];

    for (const [index, file] of documentFiles.entries()) {
      setVerificationUploadStatus(`Uploading ${index + 1} of ${documentFiles.length}...`);
      const uploadFile = file.type.startsWith('image/') ? await compressImageFile(file, 1600) : file;
      const { publicUrl, error } = await uploadVerificationDocument(user.id, uploadFile);
      if (error || !publicUrl) {
        console.error('Verification upload failed:', error);
        setVerificationSubmitting(false);
        setVerificationUploadStatus('');
        setCleanError('Upload failed. Please retry.');
        return;
      }
      uploadedUrls.push(publicUrl);
    }

    setVerificationUploadStatus('Submitting...');
    const { request, error } = await submitVerificationRequest({
      userId: user.id,
      requestType: verificationType,
      documentName: documentFiles.map((file) => file.name).join(', '),
      documentUrls: uploadedUrls,
      businessId: profileContext.mode === 'business' ? profileContext.businessId : null,
    });
    setVerificationSubmitting(false);
    setVerificationUploadStatus('');

    if (error) {
      console.error('Verification request failed:', error);
      setCleanError();
      return;
    }

    setVerificationRequest(request as VerificationRequestRecord);
    setProfile((current) => current ? { ...current, verification_status: 'pending' } : current);
    clearDocumentFile();
    setVerificationFormOpen(false);
    setMessage({ type: 'success', text: 'Verification submitted.' });
    showToast({ type: 'success', message: 'Verification submitted.' });
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 pb-24 text-slate-900 dark:bg-slate-950 dark:text-white">
      <Header />
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-8">
        <header className="mb-6 flex items-start justify-between">
          <div>
            <Logo />
            <h1 className="mt-5 text-2xl font-bold sm:text-3xl">Profile</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Your identity and marketplace summary.</p>
          </div>
          <button
            onClick={() => setHelpOpen(true)}
            className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl flex items-center gap-1.5 font-bold text-xs hover:bg-emerald-500/20 transition-all shadow-sm"
          >
            <HelpCircle className="w-4 h-4" /> Help Center
          </button>
        </header>

        {loading || profileLoading ? (
          <div className="space-y-4">
            <div className="h-40 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-900" />
            <div className="h-64 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-900" />
          </div>
        ) : user ? (
          <>
            {message ? (
              <div className={`mb-5 rounded-2xl border p-4 text-sm font-semibold ${message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200' : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200'}`}>
                {message.text}
              </div>
            ) : null}

            <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-600 to-emerald-500 text-2xl font-black text-white ring-4 ring-slate-100 dark:ring-slate-800">
                    {avatarPreview || profile?.avatar_url ? (
                      <img src={avatarPreview || profile?.avatar_url || ''} alt="" className="h-full w-full object-cover" />
                    ) : (
                      displayName.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-xl font-bold sm:text-2xl">{displayName}</h2>
                      <span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusClass(verificationStatus)}`}>
                        {statusLabel(verificationStatus)}
                      </span>
                      {isAdmin ? (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">Admin</span>
                      ) : null}
                    </div>
                    <p className="mt-2 truncate text-sm text-slate-600 dark:text-slate-400">{profile?.email || user.email}</p>
                    <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">MUST campus</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <button type="button" onClick={() => { setSettingsOpen(true); setVerificationFormOpen(false); }} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                    <UserRound className="h-4 w-4" aria-hidden="true" />
                    Edit profile
                  </button>
                  <button type="button" onClick={() => setSettingsOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700">
                    <Settings className="h-4 w-4" aria-hidden="true" />
                    Settings
                  </button>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ['Active', activeListingsCount],
                  ['Sold', soldListingsCount],
                  ['Pending', pendingListingsCount],
                  ['Hidden', hiddenListingsCount],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl bg-slate-50 p-4 text-center dark:bg-slate-950">
                    <p className="text-xl font-black">{value}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
                Rating and reviews will appear here after more completed trades.
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                {verificationStatus === 'verified' ? (
                  <div className="flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-200">
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    Verified seller
                  </div>
                ) : verificationStatus === 'pending' ? (
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-200">Verification under review</p>
                ) : verificationStatus === 'rejected' ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-semibold text-red-700 dark:text-red-200">Verification rejected</p>
                    <button type="button" onClick={() => { setSettingsOpen(true); setVerificationFormOpen(true); }} className="text-sm font-bold text-blue-600 dark:text-blue-300">View verification</button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Verify to earn a trusted badge</p>
                    <button type="button" onClick={() => { setSettingsOpen(true); setVerificationFormOpen(true); }} className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Apply in Settings</button>
                  </div>
                )}
              </div>
            </section>

            <section id="my-listings" className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setListingsCollapsed((c) => !c)}
                className="flex w-full items-center justify-between gap-3 p-5 text-left"
              >
                <div>
                  <h2 className="text-xl font-bold">My Listings</h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    {activeListingsCount} active · {soldListingsCount} sold · {pendingListingsCount} pending · {hiddenListingsCount} hidden
                  </p>
                </div>
                <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${listingsCollapsed ? '' : 'rotate-180'}`} />
              </button>

              {!listingsCollapsed && (
                <div className="border-t border-slate-200 p-5 pt-4 dark:border-slate-800">
                  <div className="mb-4 flex items-center justify-end">
                    <Link href="/sell" className="rounded-2xl bg-blue-600 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-blue-700">Post listing</Link>
                  </div>

                  <div className="mb-4 grid grid-cols-4 gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950">
                    {(['active', 'pending_payment', 'sold', 'hidden'] as const).map((status) => (
                      <button key={status} type="button" onClick={() => setListingFilter(status)} className={`rounded-xl px-3 py-2 text-sm font-bold capitalize ${listingFilter === status ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                        {status === 'pending_payment' ? 'Pending' : status}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-3">
                    {filteredListings.length > 0 ? (
                      filteredListings.map((listing) => (
                        <article key={listing.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <p className="truncate font-bold">{listing.title}</p>
                              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                                {listing.price ? `KSh ${listing.price.toLocaleString()}` : 'No price'} · {listing.location || 'MUST'} · {statusLabel(listing.status)}
                              </p>
                            </div>
                            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                              <Link href={`/listing/${listing.id}`} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-center text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">View</Link>
                              <Link href={`/sell?edit=${listing.id}`} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-center text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">Edit</Link>
                              {listing.status !== 'sold' ? (
                                <button disabled={listingActionId === listing.id} onClick={() => handleListingStatus(listing.id, 'sold')} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Sold</button>
                              ) : null}
                              {listing.status !== 'hidden' ? (
                                <button disabled={listingActionId === listing.id} onClick={() => handleListingStatus(listing.id, 'hidden')} className="rounded-xl bg-slate-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Hide</button>
                              ) : (
                                <button disabled={listingActionId === listing.id} onClick={() => handleListingStatus(listing.id, 'active')} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Restore</button>
                              )}
                            </div>
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
                        <p className="font-bold">{listingEmptyText(listingFilter)}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>
          </>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-2xl font-bold">Sign in to continue.</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">Create an account to post, message, verify, and manage listings.</p>
            <div className="mx-auto mt-5 grid max-w-sm grid-cols-2 gap-3">
              <Link href="/signin?next=/profile" className="rounded-2xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white">Create account</Link>
              <Link href="/signin?next=/profile&mode=signin" className="rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">Sign in</Link>
            </div>
          </div>
        )}
      </main>

      {settingsOpen && user ? (
        <div id="settings" className="fixed inset-0 z-50 bg-slate-950/60 px-3 py-4 backdrop-blur-sm sm:px-4 sm:py-8" onClick={() => setSettingsOpen(false)}>
          <div className="mx-auto max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-950" onClick={(event) => event.stopPropagation()}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">Settings</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Account, verification, business profile, and support.</p>
              </div>
              <button type="button" aria-label="Close settings" onClick={() => setSettingsOpen(false)} className="inline-flex h-10 w-10 items-center justify-center rounded-2xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-5">
              <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <h3 className="font-bold">Account</h3>
                <div className="mt-4 flex flex-wrap gap-3">
                  <label className="inline-flex cursor-pointer rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                    {avatarUploading ? 'Uploading...' : 'Upload profile photo'}
                    <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handleAvatarChange} className="hidden" />
                  </label>
                  <button type="button" onClick={toggleTheme} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                    {theme === 'dark' ? 'Use light mode' : 'Use dark mode'}
                  </button>
                  {isAdmin ? <Link href="/admin" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">Admin panel</Link> : null}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <h3 className="font-bold">WhatsApp</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input value={phoneInput} onChange={(event) => setPhoneInput(event.target.value)} placeholder="07XXXXXXXX" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900" />
                  <button type="button" onClick={handlePhoneSave} className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white">Save</button>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-bold">Verification</h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{statusLabel(verificationStatus)}</p>
                    {verificationRequest?.admin_note ? <p className="mt-2 text-sm text-red-600 dark:text-red-300">{verificationRequest.admin_note}</p> : null}
                  </div>
                  {verificationStatus !== 'verified' && verificationStatus !== 'pending' ? (
                    <button type="button" onClick={() => setVerificationFormOpen((current) => !current)} className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
                      {verificationFormOpen ? 'Hide form' : 'Apply'}
                    </button>
                  ) : verificationStatus === 'pending' ? (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">Under review</span>
                  ) : null}
                </div>

                {verificationFormOpen && verificationStatus !== 'verified' && verificationStatus !== 'pending' ? (
                  <form onSubmit={handleVerificationSubmit} className="mt-4 space-y-4">
                    <select value={verificationType} onChange={(event) => setVerificationType(event.target.value as (typeof verificationTypes)[number]['value'])} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900">
                      {verificationTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                    </select>
                    <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf" multiple={verificationType === 'business'} onChange={handleDocumentChange} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900" />
                    {documentFiles.length > 0 ? (
                      <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                        {documentFiles.map((file) => <p key={`${file.name}-${file.size}`} className="truncate">{file.name}</p>)}
                      </div>
                    ) : null}
                    <button type="submit" disabled={verificationSubmitting} className="w-full rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
                      {verificationSubmitting ? verificationUploadStatus || 'Submitting...' : 'Submit for review'}
                    </button>
                  </form>
                ) : null}
              </section>

              <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <h3 className="font-bold">Selling Profile</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setProfileContext({ mode: 'personal', businessId: null, businessName: null })} className={`rounded-2xl px-4 py-2 text-sm font-semibold ${profileContext.mode === 'personal' ? 'bg-blue-600 text-white' : 'border border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200'}`}>Personal</button>
                  {businesses.map((business) => (
                    <button key={business.id} type="button" onClick={() => setProfileContext({ mode: 'business', businessId: business.id, businessName: business.business_name })} className={`rounded-2xl px-4 py-2 text-sm font-semibold ${profileContext.businessId === business.id ? 'bg-blue-600 text-white' : 'border border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200'}`}>{business.business_name}</button>
                  ))}
                </div>

                <form onSubmit={handleBusinessSubmit} className="mt-4 grid gap-3">
                  <input name="business_name" value={businessForm.business_name} onChange={(event) => setBusinessForm((current) => ({ ...current, business_name: event.target.value }))} placeholder="Business name" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <select name="category" value={businessForm.category} onChange={(event) => setBusinessForm((current) => ({ ...current, category: event.target.value }))} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900">
                      {businessCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                    </select>
                    <input name="location" value={businessForm.location} onChange={(event) => setBusinessForm((current) => ({ ...current, location: event.target.value }))} placeholder="Location" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900" />
                  </div>
                  <textarea name="description" value={businessForm.description} onChange={(event) => setBusinessForm((current) => ({ ...current, description: event.target.value }))} rows={3} placeholder="Description" className="resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900" />
                  <button type="submit" disabled={businessSubmitting} className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{businessSubmitting ? 'Creating...' : 'Create business profile'}</button>
                </form>
              </section>

              <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <h3 className="font-bold">Help</h3>
                <form onSubmit={handleComplaintSubmit} className="mt-3 grid gap-3">
                  <input value={complaintForm.subject} onChange={(event) => setComplaintForm((current) => ({ ...current, subject: event.target.value }))} placeholder="Subject" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900" />
                  <textarea value={complaintForm.message} onChange={(event) => setComplaintForm((current) => ({ ...current, message: event.target.value }))} rows={3} placeholder="What happened?" className="resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900" />
                  <button type="submit" disabled={complaintSubmitting} className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{complaintSubmitting ? 'Sending...' : 'Report issue'}</button>
                </form>
              </section>

              {businesses.length > 0 ? (
                <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                  <h3 className="font-bold">Business Profiles</h3>
                  <div className="mt-3 space-y-3">
                    {businesses.map((business) => (
                      <article key={business.id} className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="font-bold">{business.business_name}</p>
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{business.category} · {business.location} · {statusLabel(business.verification_status)}</p>
                          </div>
                          <ReportButton targetType="business" targetId={business.id} label="Report" />
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              <button type="button" onClick={async () => { await signOut(); setSettingsOpen(false); }} className="w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-left text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                Sign out
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <HelpCenterModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
      <BottomNav />
    </div>
  );
}
