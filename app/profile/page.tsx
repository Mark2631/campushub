'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import BottomNav from '../../components/BottomNav';
import Header from '../../components/Header';
import Logo from '../../components/Logo';
import ReportButton from '../../components/ReportButton';
import { signOut } from '../../lib/auth';
import useUser from '../../hooks/useUser';
import useTheme from '../../hooks/useTheme';
import {
  BusinessRecord,
  ProfileRecord,
  createBusinessProfile,
  getBusinessProfiles,
  saveProfileAvatar,
  saveProfilePhone,
  submitVerificationRequest,
  uploadVerificationDocument,
  upsertProfile,
} from '../../lib/profiles';
import { getListingsByUser, Listing, updateListingLifecycleStatus } from '../../lib/listings';
import { createComplaint } from '../../lib/complaints';
import { compressImageFile, validateUploadFile } from '../../lib/storage';

const verificationTypes = [
  { value: 'student', label: 'Student ID' },
  { value: 'national_id', label: 'National ID' },
  { value: 'business', label: 'Business verification' },
];

const businessCategories = ['Campus Services', 'Food', 'Electronics', 'Fashion', 'Books', 'Repairs', 'Other'];

const statusStyles: Record<string, string> = {
  verified: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200',
  pending: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200',
  unverified: 'border-gray-200 bg-gray-50 text-gray-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300',
};

function formatStatus(status?: string | null) {
  if (!status || status === 'unverified') return 'Not verified yet';
  return status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function ProfilePage() {
  const { user, loading, isAdmin, pushNotification, profileContext, setProfileContext, showToast } = useUser();
  const { theme, toggleTheme } = useTheme();
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [businesses, setBusinesses] = useState<BusinessRecord[]>([]);
  const [userListings, setUserListings] = useState<Listing[]>([]);
  const [activeListingsCount, setActiveListingsCount] = useState(0);
  const [profileLoading, setProfileLoading] = useState(false);
  const [verificationType, setVerificationType] = useState(verificationTypes[0].value);
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);
  const [documentPreviews, setDocumentPreviews] = useState<string[]>([]);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [verificationSubmitting, setVerificationSubmitting] = useState(false);
  const [verificationUploadStatus, setVerificationUploadStatus] = useState('');
  const [businessSubmitting, setBusinessSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [complaintSubmitting, setComplaintSubmitting] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [listingActionId, setListingActionId] = useState<string | null>(null);
  const [listingFilter, setListingFilter] = useState<'active' | 'sold' | 'hidden'>('active');
  const [complaintForm, setComplaintForm] = useState({
    subject: '',
    message: '',
  });
  const [businessForm, setBusinessForm] = useState({
    business_name: '',
    category: businessCategories[0],
    location: '',
    description: '',
  });

  const displayName = useMemo(() => {
    return (
      profile?.full_name ||
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      user?.email?.split('@')[0] ||
      'CampusTrader user'
    );
  }, [profile, user]);

  const verificationStatus = profile?.verification_status || 'unverified';
  const statusClass = statusStyles[verificationStatus] || statusStyles.unverified;
  const soldListingsCount = userListings.filter((listing) => listing.status === 'sold').length;
  const hiddenListingsCount = userListings.filter((listing) => listing.status === 'hidden').length;
  const filteredUserListings = userListings.filter((listing) => listing.status === listingFilter);

  useEffect(() => {
    if (!user) return;

    let isMounted = true;

    const loadProfile = async () => {
      setProfileLoading(true);
      const [{ profile: syncedProfile }, { businesses: userBusinesses }, { listings: userListings }] = await Promise.all([
        upsertProfile(user),
        getBusinessProfiles(user.id),
        getListingsByUser(user.id),
      ]);

      if (!isMounted) return;
      setProfile(syncedProfile);
      setPhoneInput(syncedProfile?.phone_number || '');
      setBusinesses(userBusinesses);
      setUserListings(userListings);
      setActiveListingsCount(userListings.filter((listing) => listing.status === 'active').length);
      setProfileLoading(false);
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    return () => {
      documentPreviews.forEach((previewUrl) => URL.revokeObjectURL(previewUrl));
    };
  }, [documentPreviews]);

  useEffect(() => {
    return () => {
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  const handleSignOut = async () => {
    await signOut();
  };

  const handleDocumentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.currentTarget.files || []);
    documentPreviews.forEach((previewUrl) => URL.revokeObjectURL(previewUrl));

    const maxFiles = verificationType === 'business' ? 2 : 1;
    const nextFiles = selectedFiles.slice(0, maxFiles);
    const validationErrors = nextFiles.map((file) => validateUploadFile(file, 'verification-document')).filter(Boolean);

    if (validationErrors.length > 0) {
      setMessage({ type: 'error', text: validationErrors.join(' ') });
      setDocumentFiles([]);
      setDocumentPreviews([]);
      event.currentTarget.value = '';
      return;
    }

    setMessage(null);
    setDocumentFiles(nextFiles);
    setDocumentPreviews(nextFiles.map((file) => URL.createObjectURL(file)));
    event.currentTarget.value = '';
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (!file || !user) return;

    const validationError = validateUploadFile(file, 'image');
    if (validationError) {
      setMessage({ type: 'error', text: validationError });
      event.currentTarget.value = '';
      return;
    }

    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
    }
    setAvatarPreview(URL.createObjectURL(file));

    setAvatarUploading(true);
    setMessage(null);
    const compressed = await compressImageFile(file, 1600);
    const { avatarUrl, error } = await saveProfileAvatar(user.id, compressed);
    setAvatarUploading(false);
    event.currentTarget.value = '';

    if (error) {
      setMessage({ type: 'error', text: error });
      showToast({ type: 'error', message: error });
      return;
    }

    setAvatarPreview(null);
    setProfile((current) => (current ? { ...current, avatar_url: avatarUrl } : current));
    await pushNotification({
      type: 'profile updated',
      title: 'Profile picture updated',
      body: 'Your account photo has been updated.',
    });
    setMessage({ type: 'success', text: 'Profile picture updated.' });
    showToast({ type: 'success', message: 'Profile photo uploaded.' });
  };

  const handlePhoneSave = async () => {
    if (!user) return;
    const { phoneNumber, error } = await saveProfilePhone(user.id, phoneInput);
    if (error) {
      setMessage({ type: 'error', text: error });
      showToast({ type: 'error', message: error });
      return;
    }
    setPhoneInput(phoneNumber || '');
    setProfile((current) => (current ? { ...current, phone_number: phoneNumber } : current));
    showToast({ type: 'success', message: 'WhatsApp number saved.' });
  };

  const clearDocumentFile = () => {
    documentPreviews.forEach((previewUrl) => URL.revokeObjectURL(previewUrl));
    setDocumentFiles([]);
    setDocumentPreviews([]);
  };

  const handleVerificationSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user) return;
    if (documentFiles.length === 0) {
      setMessage({ type: 'error', text: 'Choose a document before submitting your verification request.' });
      return;
    }

    setVerificationSubmitting(true);
    setVerificationUploadStatus('Uploading verification document...');
    setMessage(null);

    const uploadedUrls: string[] = [];

    for (const [index, file] of documentFiles.entries()) {
      setVerificationUploadStatus(`Uploading verification file ${index + 1} of ${documentFiles.length}...`);
      const uploadFile = file.type.startsWith('image/') ? await compressImageFile(file, 1600) : file;
      const { publicUrl, error } = await uploadVerificationDocument(user.id, uploadFile);
      if (error || !publicUrl) {
        setVerificationSubmitting(false);
        setVerificationUploadStatus('');
        setMessage({ type: 'error', text: `Verification upload failed. ${error || 'Please try again.'}` });
        showToast({ type: 'error', message: `Verification upload failed. ${error || 'Please try again.'}` });
        return;
      }
      uploadedUrls.push(publicUrl);
    }

    setVerificationUploadStatus('Submitting verification request...');
    const { error } = await submitVerificationRequest({
      userId: user.id,
      requestType: verificationType,
      documentName: documentFiles.map((file) => file.name).join(', '),
      documentUrls: uploadedUrls,
      businessId: profileContext.mode === 'business' ? profileContext.businessId : null,
    });
    setVerificationSubmitting(false);
    setVerificationUploadStatus('');

    if (error) {
      setMessage({ type: 'error', text: error });
      showToast({ type: 'error', message: error });
      return;
    }

    await pushNotification({
      type: 'verification submitted',
      title: 'Verification submitted',
      body: 'Verification submitted. Admin will review your document.',
    });
    setMessage({ type: 'success', text: 'Verification submitted. Admin will review your document.' });
    showToast({ type: 'success', message: 'Verification submitted. Admin will review your document.' });
    clearDocumentFile();
    setVerificationType(verificationTypes[0].value);
  };

  const handleBusinessChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setBusinessForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleBusinessSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user) return;
    if (!businessForm.business_name.trim() || !businessForm.location.trim()) {
      setMessage({ type: 'error', text: 'Business name and location are required.' });
      return;
    }

    setBusinessSubmitting(true);
    setMessage(null);

    const { business, error } = await createBusinessProfile(user.id, businessForm);
    setBusinessSubmitting(false);

    if (error) {
      setMessage({ type: 'error', text: error });
      return;
    }

    if (business) {
      setBusinesses((prev) => [business, ...prev]);
    }

    setBusinessForm({
      business_name: '',
      category: businessCategories[0],
      location: '',
      description: '',
    });
    await pushNotification({
      type: 'business created',
      title: 'Business profile created',
      body: 'Your business profile is ready and waiting for verification.',
    });
    setMessage({ type: 'success', text: 'Business profile created.' });
    showToast({ type: 'success', message: 'Business created.' });
  };

  const handleComplaintSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!complaintForm.subject.trim() || !complaintForm.message.trim()) {
      setMessage({ type: 'error', text: 'Complaint subject and message are required.' });
      return;
    }

    setComplaintSubmitting(true);
    setMessage(null);

    const { error } = await createComplaint({
      userId: user?.id || null,
      email: user?.email || '',
      subject: complaintForm.subject,
      message: complaintForm.message,
    });

    setComplaintSubmitting(false);

    if (error) {
      setMessage({ type: 'error', text: error });
      showToast({ type: 'error', message: error });
      return;
    }

    setComplaintForm({ subject: '', message: '' });
    await pushNotification({
      type: 'complaint submitted',
      title: 'Issue reported',
      body: 'Your issue has been submitted for review.',
    });
    setMessage({ type: 'success', text: 'Complaint submitted. Admin will review it.' });
    showToast({ type: 'success', message: 'Report submitted.' });
  };

  const handleListingStatus = async (listingId: string, status: 'sold' | 'hidden' | 'active') => {
    if (!user) return;
    setListingActionId(listingId);
    setMessage(null);
    const { error } = await updateListingLifecycleStatus(listingId, user.id, status);
    setListingActionId(null);

    if (error) {
      setMessage({ type: 'error', text: error });
      showToast({ type: 'error', message: error });
      return;
    }

    setUserListings((current) => {
      const nextListings = current.map((listing) => (listing.id === listingId ? { ...listing, status } : listing));
      setActiveListingsCount(nextListings.filter((listing) => listing.status === 'active').length);
      return nextListings;
    });
    await pushNotification({
      type: status === 'sold' ? 'listing sold' : status === 'hidden' ? 'listing hidden' : 'listing restored',
      title: status === 'sold' ? 'Listing marked as sold' : status === 'hidden' ? 'Listing hidden' : 'Listing restored',
      body: status === 'sold' ? 'Listing marked as sold.' : status === 'hidden' ? 'Listing removed from the active feed.' : 'Listing restored to the active feed.',
    });
    setMessage({ type: 'success', text: status === 'sold' ? 'Listing marked as sold.' : status === 'hidden' ? 'Listing hidden.' : 'Listing restored.' });
    showToast({ type: 'success', message: status === 'sold' ? 'Listing marked as sold.' : status === 'hidden' ? 'Listing hidden.' : 'Listing restored.' });
    window.dispatchEvent(new Event('campustrader:listings-refresh'));
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-gray-50 to-gray-100 pb-24 text-gray-900 dark:bg-gradient-to-br dark:from-black dark:to-zinc-950 dark:text-white">
      <Header />
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-8">
        <header className="mb-8">
          <div className="mb-4">
            <Logo />
          </div>
          <h1 className="text-2xl font-bold sm:text-3xl">Profile</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-zinc-400">Manage your campus marketplace account.</p>
        </header>

        {loading || profileLoading ? (
          <div className="space-y-6">
            <div className="h-44 rounded-2xl bg-gray-200 dark:bg-zinc-800 animate-pulse" />
            <div className="h-64 rounded-2xl bg-gray-200 dark:bg-zinc-800 animate-pulse" />
          </div>
        ) : user ? (
          <>
            {message && (
              <div
                className={`mb-6 rounded-2xl border p-4 ${
                  message.type === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200'
                    : 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200'
                }`}
              >
                <p className="font-medium">{message.text}</p>
              </div>
            )}

            <section id="my-account" className="mb-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4 sm:gap-5">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-3xl font-bold text-white">
                    {avatarPreview || profile?.avatar_url ? (
                      <img src={avatarPreview || profile?.avatar_url || ''} alt="" className="h-full w-full object-cover" />
                    ) : (
                      displayName.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-500 dark:text-zinc-500">My Account</p>
                    <h2 className="mt-1 truncate text-xl font-bold text-gray-900 sm:text-2xl dark:text-white">{displayName}</h2>
                    <p className="mt-2 truncate text-sm text-gray-600 dark:text-zinc-400">{profile?.email || user.email}</p>
                    <div className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusClass}`}>
                      {formatStatus(verificationStatus)}
                    </div>
                    {isAdmin ? (
                      <div className="ml-2 mt-3 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200">
                        Admin badge
                      </div>
                    ) : null}
                    <label className="mt-4 inline-flex cursor-pointer rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
                      {avatarUploading ? 'Uploading...' : 'Upload profile photo'}
                      <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handleAvatarChange} className="hidden" />
                    </label>
                    <div className="mt-4 flex max-w-sm flex-col gap-2 sm:flex-row">
                      <input
                        value={phoneInput}
                        onChange={(event) => setPhoneInput(event.target.value)}
                        placeholder="WhatsApp: 07XXXXXXXX"
                        className="min-w-0 flex-1 rounded-2xl border border-gray-200 bg-white px-4 py-2 text-xs text-gray-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={handlePhoneSave}
                        className="rounded-2xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
                      >
                        Save WhatsApp
                      </button>
                    </div>
                    <p className="mt-2 max-w-sm text-xs text-gray-500 dark:text-zinc-500">Use WhatsApp only when you are comfortable. Avoid advance payments before inspection.</p>
                  </div>
                </div>
                <div className="grid w-full grid-cols-1 gap-3 sm:w-auto sm:grid-cols-2 xl:flex">
                  <Link
                    href="#my-listings"
                    className="rounded-2xl border border-gray-200 bg-gray-50 px-5 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                  >
                    My Listings
                  </Link>
                  <Link
                    href="#verification"
                    className="rounded-2xl border border-gray-200 bg-gray-50 px-5 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                  >
                    Apply for Verification
                  </Link>
                  <Link
                    href="#business-profiles"
                    className="rounded-2xl border border-gray-200 bg-gray-50 px-5 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                  >
                    Create Business Profile
                  </Link>
                  <Link
                    href="#help-settings"
                    className="rounded-2xl border border-gray-200 bg-gray-50 px-5 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                  >
                    Help / Report Issue
                  </Link>
                  {isAdmin ? (
                    <Link
                      href="/admin"
                      className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200 dark:hover:bg-emerald-900/30"
                    >
                      Admin Panel
                    </Link>
                  ) : null}
                  <button
                    onClick={toggleTheme}
                    className="rounded-2xl border border-gray-200 bg-gray-50 px-5 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                  >
                    {theme === 'dark' ? 'Use light mode' : 'Use dark mode'}
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-950"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </section>

            <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
              {[
                [String(activeListingsCount), 'Active listings'],
                [String(soldListingsCount), 'Sold listings'],
                [String(hiddenListingsCount), 'Hidden listings'],
                [formatStatus(verificationStatus), 'Verification status'],
              ].map(([value, label]) => (
                <div key={label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
                  <p className="mt-2 text-sm text-gray-600 dark:text-zinc-400">{label}</p>
                </div>
              ))}
            </section>

            <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
              {[
                profile?.avatar_url ? null : 'Add photo',
                profile?.full_name ? null : 'Add name',
                verificationStatus === 'verified' ? null : 'Apply for verification',
              ]
                .filter(Boolean)
                .map((prompt) => (
                  <div key={prompt} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100">
                    <p className="font-semibold">{prompt}</p>
                    <p className="mt-1">Complete this to build buyer trust.</p>
                  </div>
              ))}
            </section>

            <section id="verification" className="mb-8 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:p-6 dark:border-blue-950/80 dark:bg-zinc-900">
              <div className="mb-5 flex flex-col gap-2">
                <p className="text-sm font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">Verification</p>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Not verified yet</h2>
                <p className="text-sm text-gray-600 dark:text-zinc-400">Verification helps buyers and sellers trust you. It is not required to use CampusTrader.</p>
                <p className="text-xs text-gray-500 dark:text-zinc-500">
                  {verificationType === 'student'
                    ? 'Student verification: upload school ID or admission/student card.'
                    : verificationType === 'national_id'
                      ? 'National ID verification: upload the front side of your national ID. Optional back side later.'
                      : 'Business verification: upload owner ID plus business proof if available.'}
                </p>
              </div>

              <form onSubmit={handleVerificationSubmit} className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
                <div className="space-y-3">
                  {verificationTypes.map((type) => (
                    <label
                      key={type.value}
                      className={`flex cursor-pointer items-center justify-between rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                        verificationType === type.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200'
                          : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-blue-300 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300'
                      }`}
                    >
                      <span>{type.label}</span>
                      <input
                        type="radio"
                        name="verification_type"
                        value={type.value}
                        checked={verificationType === type.value}
                        onChange={(event) => setVerificationType(event.target.value)}
                        className="h-4 w-4 accent-blue-600"
                      />
                    </label>
                  ))}
                </div>

                <div className="space-y-4">
                  <label className="relative block cursor-pointer rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 p-6 text-center transition hover:border-blue-400 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:border-blue-500">
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                      multiple={verificationType === 'business'}
                      onChange={handleDocumentChange}
                      className="absolute inset-0 cursor-pointer opacity-0"
                    />
                    <p className="font-semibold text-gray-900 dark:text-white">Choose verification document</p>
                    <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">
                      {verificationType === 'business' ? 'Owner ID required. Optional proof can be added as a second file.' : 'Upload the required ID image or PDF.'}
                    </p>
                  </label>

                  {documentFiles.length > 0 && (
                    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">Selected files</p>
                        <button
                          type="button"
                          onClick={clearDocumentFile}
                          className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="space-y-4">
                        {documentFiles.map((file, index) => (
                          <div key={`${file.name}-${file.size}-${index}`} className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
                            <div className="mb-3 min-w-0">
                              <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{file.name}</p>
                              <p className="text-xs text-gray-500 dark:text-zinc-500">{Math.ceil(file.size / 1024)} KB</p>
                            </div>
                            {file.type.startsWith('image/') ? (
                              <img src={documentPreviews[index]} alt="Selected verification document preview" className="max-h-72 w-full rounded-xl object-contain bg-gray-100 dark:bg-zinc-900" />
                            ) : file.type === 'application/pdf' ? (
                              <iframe src={documentPreviews[index]} title="Selected verification document preview" className="h-72 w-full rounded-xl bg-gray-100 dark:bg-zinc-900" />
                            ) : (
                              <div className="rounded-xl bg-gray-100 p-6 text-center text-sm text-gray-600 dark:bg-zinc-900 dark:text-zinc-400">Preview unavailable for this file type.</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={verificationSubmitting}
                    className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 px-5 py-3 text-sm font-semibold text-white transition hover:from-blue-700 hover:to-cyan-700 disabled:cursor-not-allowed disabled:from-gray-400 disabled:to-gray-500"
                  >
                    {verificationSubmitting ? verificationUploadStatus || 'Submitting...' : 'Submit for review'}
                  </button>
                </div>
              </form>
            </section>

            <section id="help-settings" className="mb-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Help & Settings</h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">Change theme, sign out, or report an issue if something is not working.</p>
              </div>
              <div className="mb-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-zinc-700 dark:bg-zinc-950">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Current profile</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => setProfileContext({ mode: 'personal', businessId: null, businessName: null })}
                    className={`rounded-2xl px-4 py-2 text-sm font-semibold ${profileContext.mode === 'personal' ? 'bg-blue-600 text-white' : 'border border-gray-200 bg-white text-gray-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200'}`}
                  >
                    Personal
                  </button>
                  {businesses.map((business) => (
                    <button
                      key={business.id}
                      onClick={() => setProfileContext({ mode: 'business', businessId: business.id, businessName: business.business_name })}
                      className={`rounded-2xl px-4 py-2 text-sm font-semibold ${profileContext.mode === 'business' && profileContext.businessId === business.id ? 'bg-blue-600 text-white' : 'border border-gray-200 bg-white text-gray-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200'}`}
                    >
                      {business.business_name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-4 flex flex-wrap gap-3">
                <button
                  onClick={toggleTheme}
                  className="rounded-2xl border border-gray-200 bg-gray-50 px-5 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                >
                  {theme === 'dark' ? 'Use light mode' : 'Use dark mode'}
                </button>
                {isAdmin ? (
                  <Link
                    href="/admin"
                    className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200 dark:hover:bg-emerald-900/30"
                  >
                    Admin Panel
                  </Link>
                ) : null}
              </div>
              <form onSubmit={handleComplaintSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1.4fr_auto]">
                <input
                  value={complaintForm.subject}
                  onChange={(event) => setComplaintForm((prev) => ({ ...prev, subject: event.target.value }))}
                  placeholder="Subject"
                  className="rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                />
                <input
                  value={complaintForm.message}
                  onChange={(event) => setComplaintForm((prev) => ({ ...prev, message: event.target.value }))}
                  placeholder="What happened?"
                  className="rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                />
                <button
                  disabled={complaintSubmitting}
                  className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:bg-gray-500"
                >
                  {complaintSubmitting ? 'Sending...' : 'Submit'}
                </button>
              </form>
            </section>

            <div className="space-y-4">
              <section id="my-listings" className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">My Listings</h2>
                    <p className="mt-2 text-sm text-gray-600 dark:text-zinc-400">Manage active, sold, and hidden listings.</p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{activeListingsCount} active</p>
                    <p className="text-xs text-gray-500 dark:text-zinc-500">{soldListingsCount} sold, {hiddenListingsCount} hidden</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-gray-200 bg-gray-50 p-1 dark:border-zinc-800 dark:bg-zinc-950">
                  {(['active', 'sold', 'hidden'] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setListingFilter(status)}
                      className={`rounded-xl px-3 py-2 text-sm font-semibold capitalize transition ${
                        listingFilter === status
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-700 hover:bg-white dark:text-zinc-300 dark:hover:bg-zinc-900'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
                <div className="mt-4 space-y-4">
                  {filteredUserListings.length > 0 ? (
                    filteredUserListings.map((listing) => (
                      <article key={listing.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-zinc-700 dark:bg-zinc-950">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">{listing.title}</p>
                            <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">
                              {listing.price ? `KSh ${listing.price.toLocaleString()}` : 'No price'} · {listing.location || 'No location'} · {formatStatus(listing.status)}
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                            <Link href={`/listing/${listing.id}`} className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-center text-sm font-semibold text-gray-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                              View
                            </Link>
                            <Link href={`/sell?edit=${listing.id}`} className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-center text-sm font-semibold text-gray-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                              Edit
                            </Link>
                            <button
                              disabled={listing.status === 'sold' || listingActionId === listing.id}
                              onClick={() => handleListingStatus(listing.id, 'sold')}
                              className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-400"
                            >
                              Mark Sold
                            </button>
                            <button
                              disabled={listingActionId === listing.id}
                              onClick={() => handleListingStatus(listing.id, 'hidden')}
                              className="rounded-2xl bg-gray-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-400"
                            >
                              Hide
                            </button>
                            {listing.status !== 'active' ? (
                              <button
                                disabled={listingActionId === listing.id}
                                onClick={() => handleListingStatus(listing.id, 'active')}
                                className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-400"
                              >
                                Restore
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center dark:border-zinc-700 dark:bg-zinc-950">
                      <p className="text-lg font-bold text-gray-900 dark:text-white">No {listingFilter} listings</p>
                      <p className="mx-auto mt-2 max-w-md text-sm text-gray-600 dark:text-zinc-400">Listings in this state will appear here.</p>
                    </div>
                  )}
                  <Link href="/sell" className="inline-block rounded-2xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700">
                    Post Listing
                  </Link>
                </div>
              </section>

              <section id="business-profiles" className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
                  <form onSubmit={handleBusinessSubmit} className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">Business Profiles</h3>
                      <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">Verification is reviewed manually by admin.</p>
                    </div>
                    <label className="space-y-2 text-sm">
                      <span className="font-medium text-gray-900 dark:text-white">Business name</span>
                      <input
                        name="business_name"
                        value={businessForm.business_name}
                        onChange={handleBusinessChange}
                        className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:placeholder-zinc-500"
                        placeholder="e.g., MUST Tech Repairs"
                        required
                      />
                    </label>
                    <label className="space-y-2 text-sm">
                      <span className="font-medium text-gray-900 dark:text-white">Category</span>
                      <select
                        name="category"
                        value={businessForm.category}
                        onChange={handleBusinessChange}
                        className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                      >
                        {businessCategories.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-2 text-sm">
                      <span className="font-medium text-gray-900 dark:text-white">Location</span>
                      <input
                        name="location"
                        value={businessForm.location}
                        onChange={handleBusinessChange}
                        className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:placeholder-zinc-500"
                        placeholder="Campus area or building"
                        required
                      />
                    </label>
                    <label className="space-y-2 text-sm">
                      <span className="font-medium text-gray-900 dark:text-white">Description</span>
                      <textarea
                        name="description"
                        value={businessForm.description}
                        onChange={handleBusinessChange}
                        rows={4}
                        className="w-full resize-none rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:placeholder-zinc-500"
                        placeholder="Tell buyers what the business offers on campus."
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={businessSubmitting}
                      className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 px-5 py-3 text-sm font-semibold text-white transition hover:from-blue-700 hover:to-cyan-700 disabled:cursor-not-allowed disabled:from-gray-400 disabled:to-gray-500"
                    >
                      {businessSubmitting ? 'Creating...' : 'Create Business Profile'}
                    </button>
                  </form>

                  <div className="space-y-4">
                    {businesses.length > 0 ? (
                      businesses.map((business) => {
                        const businessStatusClass =
                          business.verification_status === 'verified'
                            ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200'
                            : statusStyles[business.verification_status] || statusStyles.unverified;

                        return (
                          <article key={business.id} className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{business.business_name}</h3>
                                <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">{business.category} in {business.location}</p>
                              </div>
                              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${businessStatusClass}`}>
                                {business.verification_status === 'verified' ? 'Gold tick business' : formatStatus(business.verification_status)}
                              </span>
                            </div>
                            {business.description && (
                              <p className="mt-4 text-sm leading-6 text-gray-600 dark:text-zinc-400">{business.description}</p>
                            )}
                            <div className="mt-4 max-w-xs">
                              <ReportButton targetType="business" targetId={business.id} label="Report business" />
                            </div>
                          </article>
                        );
                      })
                    ) : (
                      <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white p-10 text-center dark:border-zinc-700 dark:bg-zinc-900">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">No business profiles yet</h3>
                        <p className="mx-auto mt-2 max-w-md text-sm text-gray-600 dark:text-zinc-400">Create one for campus services, shops, or repeat selling.</p>
                      </div>
                    )}
                  </div>
                </section>
              </div>
          </>
        ) : (
          <div className="rounded-2xl border-2 border-gray-300 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-3 text-2xl font-bold text-gray-900 dark:text-white">Sign in to continue.</h2>
            <p className="mx-auto mb-6 max-w-md text-gray-600 dark:text-zinc-400">
              Browsing is free. Create an account only when you want to post, message, save, verify, or join groups.
            </p>
            <Link
              href="/signin"
              className="inline-block rounded-2xl bg-blue-600 px-8 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Sign In to Your Account
            </Link>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
