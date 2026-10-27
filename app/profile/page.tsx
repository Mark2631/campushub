'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ShieldCheck, UserRound, X } from 'lucide-react';
import BottomNav from '../../components/BottomNav';
import Header from '../../components/Header';
import Logo from '../../components/Logo';
import Image from 'next/image';
import ReportButton from '../../components/ReportButton';
import useTheme from '../../hooks/useTheme';
import useUser from '../../hooks/useUser';
import { signOut } from '../../lib/auth';
import { createComplaint } from '../../lib/complaints';
import { transactionHelpTopics } from '../../lib/transactionHelp';
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
  saveProfileName,
  saveProfilePhone,
  submitVerificationRequest,
  uploadVerificationDocument,
  upsertProfile,
} from '../../lib/profiles';
import { compressImageFile, validateUploadFile } from '../../lib/storage';
import { institutionLabel, normalizeInstitution } from '../../lib/validation';

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

function ProfilePageContent({ helpRequested }: { helpRequested: boolean }) {
  const { user, loading, isAdmin, profileContext, setProfileContext, showToast } = useUser();
  const { theme, toggleTheme } = useTheme();
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [businesses, setBusinesses] = useState<BusinessRecord[]>([]);
  const [verificationRequest, setVerificationRequest] = useState<VerificationRequestRecord | null>(null);
  const [userListings, setUserListings] = useState<Listing[]>([]);
  const [profileLoading, setProfileLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(helpRequested);
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [verificationFormOpen, setVerificationFormOpen] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [listingFilter, setListingFilter] = useState<ListingFilter>('active');
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
    delivery_available: false,
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
  const authNextPath = helpRequested ? '/profile?manage=help#manage-help' : '/profile';
  const createAccountHref = `/signin?next=${encodeURIComponent(authNextPath)}`;
  const signInHref = `/signin?mode=signin&next=${encodeURIComponent(authNextPath)}`;

  const loadProfile = useCallback(async () => {
    if (!user) return;
    setProfileLoading(true);
    const [{ profile: syncedProfile }, { businesses: userBusinesses }, { listings }, { request }] = await Promise.all([
      upsertProfile(user),
      getBusinessProfiles(user.id),
      getListingsByUser(user.id),
      getLatestVerificationRequest(user.id),
    ]);

    setProfile(syncedProfile);
    setNameInput(syncedProfile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || '');
    setPhoneInput(syncedProfile?.phone_number || '');
    setBusinesses(userBusinesses);
    setUserListings(listings);
    setVerificationRequest(request);
    setProfileLoading(false);
  }, [user]);

  useEffect(() => {
    void Promise.resolve().then(loadProfile);
  }, [loadProfile]);

  useEffect(() => {
    if (!settingsOpen || !helpRequested || !user) return;
    document.getElementById('manage-help')?.scrollIntoView({ block: 'nearest' });
  }, [helpRequested, settingsOpen, user]);

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

  const handleNameSave = async () => {
    if (!user || nameSaving) return;
    setNameSaving(true);
    try {
      const { fullName, error } = await saveProfileName(user.id, nameInput);
      if (error || !fullName) {
        setCleanError(error || 'Profile name could not be saved. Please retry.');
        return;
      }
      setNameInput(fullName);
      setProfile((current) => current ? { ...current, full_name: fullName } : current);
      setMessage({ type: 'success', text: 'Name updated.' });
      showToast({ type: 'success', message: 'Name updated.' });
    } catch (error) {
      console.error('Profile name save failed:', error);
      setCleanError('Profile name could not be saved. Please retry.');
    } finally {
      setNameSaving(false);
    }
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
    if (!user || listingActionId) return;

    setListingActionId(listingId);
    setMessage(null);

    try {
      const { error } = await updateListingLifecycleStatus(listingId, user.id, status);
      if (error) {
        console.error('Listing status update failed:', error);
        setCleanError(error);
        return;
      }

      // Keep all lifecycle states in profile memory so Sold/Hidden tabs and
      // summary counts stay correct; the active tab naturally stops showing it.
      setUserListings((current) => current.map((listing) => (
        listing.id === listingId
          ? { ...listing, status, updated_at: new Date().toISOString() }
          : listing
      )));

      // The marketplace re-fetches active listings, so sold/hidden items stop
      // appearing to buyers after the database confirms the status change.
      window.dispatchEvent(new Event('campustrader:listings-refresh'));
      showToast({
        type: 'success',
        message: status === 'sold'
          ? 'Marked as sold and removed from the marketplace.'
          : status === 'hidden'
            ? 'Listing hidden from the marketplace.'
            : 'Listing restored to the marketplace.',
      });
    } catch (err) {
      console.error('Unexpected listing status update failure:', err);
      setCleanError('We could not update this listing. Check your connection and try again.');
    } finally {
      setListingActionId(null);
    }
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
    setBusinessForm({ business_name: '', category: businessCategories[0], location: '', description: '', delivery_available: false });
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
        <header className="mb-6">
          <Logo />
          <h1 className="mt-5 text-2xl font-bold sm:text-3xl">Profile</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Your identity and marketplace summary.</p>
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
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-slate-600 to-slate-800 text-2xl font-semibold text-white ring-4 ring-slate-100 dark:ring-slate-800">
                    {avatarPreview || profile?.avatar_url ? (
                      <Image src={avatarPreview || profile?.avatar_url || ''} alt="" width={80} height={80} className="h-full w-full object-cover" />
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
                    <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">{institutionLabel(normalizeInstitution(profile?.campus || user.user_metadata?.institution))}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <button type="button" onClick={() => { setProfileEditOpen(true); setVerificationFormOpen(false); }} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                    <UserRound className="h-4 w-4" aria-hidden="true" />
                    Edit profile
                  </button>
                  <button type="button" onClick={() => setSettingsOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700">
                    <UserRound className="h-4 w-4" aria-hidden="true" />
                    Manage
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
                    <p className="text-xl font-semibold">{value}</p>
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
                    <button type="button" onClick={() => { setProfileEditOpen(true); setVerificationFormOpen(true); }} className="text-sm font-bold text-blue-600 dark:text-blue-300">View verification</button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Verify to earn a trusted badge</p>
                    <button type="button" onClick={() => { setProfileEditOpen(true); setVerificationFormOpen(true); }} className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Apply in Settings</button>
                  </div>
                )}
              </div>
            </section>

            <section className="mb-5 rounded-2xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900/60 dark:bg-blue-950/20">
              <div className="flex items-center justify-between gap-4">
                <div><p className="text-sm font-bold text-blue-950 dark:text-blue-100">Orders & sales</p><p className="mt-1 text-xs text-blue-800 dark:text-blue-200/80">Review purchase and sales activity in one place.</p></div>
                <Link href="/orders" className="shrink-0 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white">View orders</Link>
              </div>
            </section>

            <section id="my-listings" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold">My Listings</h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Manage active, pending, sold, and hidden listings.</p>
                </div>
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
                            <button disabled={listingActionId !== null} onClick={() => handleListingStatus(listing.id, 'sold')} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                              {listingActionId === listing.id ? 'Saving…' : 'Sold'}
                            </button>
                          ) : null}
                          {listing.status !== 'hidden' ? (
                            <button disabled={listingActionId !== null} onClick={() => handleListingStatus(listing.id, 'hidden')} className="rounded-xl bg-slate-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                              {listingActionId === listing.id ? 'Saving…' : 'Hide'}
                            </button>
                          ) : (
                            <button disabled={listingActionId !== null} onClick={() => handleListingStatus(listing.id, 'active')} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                              {listingActionId === listing.id ? 'Saving…' : 'Restore'}
                            </button>
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
            </section>
          </>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-2xl font-bold">{helpRequested ? 'Sign in to contact support.' : 'Sign in to continue.'}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">
              {helpRequested ? 'Sign in or create an account to use the existing report issue form in Manage → Help.' : 'Create an account to post, message, verify, and manage listings.'}
            </p>
            <div className="mx-auto mt-5 grid max-w-sm grid-cols-2 gap-3">
              <Link href={createAccountHref} className="rounded-2xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white">Create account</Link>
              <Link href={signInHref} className="rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">Sign in</Link>
            </div>
          </div>
        )}
      </main>

{profileEditOpen && user ? (
        <div className="fixed inset-0 z-[60] bg-slate-950/60 px-3 py-4 backdrop-blur-sm sm:px-4 sm:py-8" onClick={() => setProfileEditOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="edit-profile-title" className="mx-auto max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-950" onClick={(event) => event.stopPropagation()}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="edit-profile-title" className="text-xl font-bold">Edit profile</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Your name, contact details, institution and verification.</p>
              </div>
              <button type="button" aria-label="Close Edit Profile" onClick={() => setProfileEditOpen(false)} className="inline-flex h-10 w-10 items-center justify-center rounded-2xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-4">
              <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <h3 className="font-bold">Profile photo</h3>
                <div className="mt-3 flex items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-800 text-xl font-bold text-white">
                    {avatarPreview || profile?.avatar_url ? (
                      <Image src={avatarPreview || profile?.avatar_url || ''} alt="Profile photo preview" width={64} height={64} className="h-full w-full object-cover" />
                    ) : displayName.charAt(0).toUpperCase()}
                  </div>
                  <label className="inline-flex cursor-pointer rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                    {avatarUploading ? 'Uploading…' : 'Change photo'}
                    <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handleAvatarChange} className="hidden" />
                  </label>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <h3 className="font-bold">Personal details</h3>
                <label className="mt-3 block space-y-2 text-sm">
                  <span className="font-medium">Name</span>
                  <input value={nameInput} onChange={(event) => setNameInput(event.target.value)} autoComplete="name" maxLength={80} placeholder="Your name" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900" />
                </label>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Email: {profile?.email || user.email || 'Not available'}</p>
                <button type="button" onClick={() => void handleNameSave()} disabled={nameSaving || nameInput.trim().length < 2} className="mt-3 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
                  {nameSaving ? 'Saving name…' : 'Save name'}
                </button>
              </section>

              <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <h3 className="font-bold">WhatsApp number</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Buyers use this number to contact you about listings.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input value={phoneInput} onChange={(event) => setPhoneInput(event.target.value)} placeholder="07XXXXXXXX" aria-label="WhatsApp number" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900" />
                  <button type="button" onClick={handlePhoneSave} className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white">Save number</button>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <h3 className="font-bold">Institution</h3>
                <p className="mt-2 font-semibold text-slate-900 dark:text-white">{institutionLabel(normalizeInstitution(profile?.campus || user.user_metadata?.institution))}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Institution identity is linked to your account and existing listings. To correct a mistake, contact support so it can be reviewed safely.</p>
                <Link href="/profile?manage=help#manage-help" onClick={() => setProfileEditOpen(false)} className="mt-2 inline-flex text-sm font-semibold text-blue-600 underline dark:text-blue-300">Request an institution correction</Link>
              </section>

              <section id="edit-profile-verification" className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
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
            </div>
          </div>
        </div>
      ) : null}

            {settingsOpen && user ? (
        <div id="settings" className="fixed inset-0 z-50 bg-slate-950/60 px-3 py-4 backdrop-blur-sm sm:px-4 sm:py-8" onClick={() => setSettingsOpen(false)}>
          <div className="mx-auto max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-950" onClick={(event) => event.stopPropagation()}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">Manage</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Orders, selling profile, preferences, and support.</p>
              </div>
              <button type="button" aria-label="Close settings" onClick={() => setSettingsOpen(false)} className="inline-flex h-10 w-10 items-center justify-center rounded-2xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-5">
              <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <h3 className="font-bold">Preferences</h3>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button type="button" onClick={toggleTheme} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                    {theme === 'dark' ? 'Use light mode' : 'Use dark mode'}
                  </button>
                  {isAdmin ? <Link href="/admin" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">Admin panel</Link> : null}
                </div>
              </section>

              <section aria-label="Manage areas" className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <h3 className="font-bold">Manage areas</h3>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Link href="/orders" onClick={() => setSettingsOpen(false)} className="rounded-xl bg-blue-600 px-3 py-3 text-center text-sm font-semibold text-white">Orders</Link>
                  <a href="#manage-business-profile" className="rounded-xl border border-slate-200 px-3 py-3 text-center text-sm font-semibold dark:border-slate-700">Selling profile</a>
                  <a href="#manage-help" className="rounded-xl border border-slate-200 px-3 py-3 text-center text-sm font-semibold dark:border-slate-700">Help &amp; support</a>
                </div>
              </section>

              <section id="manage-business-profile" className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
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
                  <fieldset className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                    <legend className="px-1 text-sm font-semibold">Delivery</legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm ${!businessForm.delivery_available ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-slate-200 dark:border-slate-700'}`}>
                        <input type="radio" name="delivery_available" checked={!businessForm.delivery_available} onChange={() => setBusinessForm((current) => ({ ...current, delivery_available: false }))} className="mt-1" />
                        <span><span className="block font-semibold">Pickup only</span><span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">Customers collect from the business.</span></span>
                      </label>
                      <label className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm ${businessForm.delivery_available ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-slate-200 dark:border-slate-700'}`}>
                        <input type="radio" name="delivery_available" checked={businessForm.delivery_available} onChange={() => setBusinessForm((current) => ({ ...current, delivery_available: true }))} className="mt-1" />
                        <span><span className="block font-semibold">Delivery can be arranged</span><span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">CampusTrader will confirm a rider, fee and timing separately.</span></span>
                      </label>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">Selecting delivery does not book a rider or take payment.</p>
                  </fieldset>

                  <button type="submit" disabled={businessSubmitting} className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{businessSubmitting ? 'Creating...' : 'Create business profile'}</button>
                </form>
              </section>

              <section id="manage-help" className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <h3 className="font-bold">Help &amp; support</h3>
                <div className="mt-3 space-y-2">
                  {transactionHelpTopics.map((topic) => (
                    <details key={topic.title} className="rounded-xl border border-slate-200 px-3 py-3 dark:border-slate-800">
                      <summary className="cursor-pointer text-sm font-semibold text-slate-800 dark:text-slate-200">{topic.title}</summary>
                      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{topic.content}</p>
                    </details>
                  ))}
                </div>
                <form onSubmit={handleComplaintSubmit} className="mt-4 grid gap-3">
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
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{business.category} · {business.location} · {statusLabel(business.verification_status)} · {business.delivery_available ? 'Delivery can be arranged' : 'Pickup only'}</p>
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

      <BottomNav />
    </div>
  );
}

function ProfileRoute() {
  const searchParams = useSearchParams();
  const helpRequested = searchParams.get('manage') === 'help';

  return <ProfilePageContent key={helpRequested ? 'manage-help' : 'profile'} helpRequested={helpRequested} />;
}

function ProfileLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 pb-28">
        <p role="status" className="text-sm text-slate-500 dark:text-slate-400">Loading profile…</p>
      </main>
      <BottomNav />
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileLoading />}>
      <ProfileRoute />
    </Suspense>
  );
}
