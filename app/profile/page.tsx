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
  submitVerificationRequest,
  upsertProfile,
} from '../../lib/profiles';
import { getListingsByUser } from '../../lib/listings';
import { createComplaint } from '../../lib/complaints';

const verificationTypes = [
  { value: 'student', label: 'Student verification' },
  { value: 'national_id', label: 'National ID verification' },
  { value: 'business', label: 'Business verification' },
];

const businessCategories = ['Campus Services', 'Food', 'Electronics', 'Fashion', 'Books', 'Repairs', 'Other'];

const statusStyles: Record<string, string> = {
  verified: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200',
  pending: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200',
  unverified: 'border-gray-200 bg-gray-50 text-gray-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300',
};

function formatStatus(status?: string | null) {
  if (!status) return 'Unverified';
  return status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function ProfilePage() {
  const { user, loading, isAdmin } = useUser();
  const { theme, toggleTheme } = useTheme();
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [businesses, setBusinesses] = useState<BusinessRecord[]>([]);
  const [activeListingsCount, setActiveListingsCount] = useState(0);
  const [profileLoading, setProfileLoading] = useState(false);
  const [verificationType, setVerificationType] = useState(verificationTypes[0].value);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentPreview, setDocumentPreview] = useState<string | null>(null);
  const [verificationSubmitting, setVerificationSubmitting] = useState(false);
  const [businessSubmitting, setBusinessSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [complaintSubmitting, setComplaintSubmitting] = useState(false);
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
      setBusinesses(userBusinesses);
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
      if (documentPreview) {
        URL.revokeObjectURL(documentPreview);
      }
    };
  }, [documentPreview]);

  const handleSignOut = async () => {
    await signOut();
  };

  const handleDocumentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0] ?? null;
    if (documentPreview) {
      URL.revokeObjectURL(documentPreview);
    }
    setDocumentFile(file);
    setDocumentPreview(file ? URL.createObjectURL(file) : null);
  };

  const clearDocumentFile = () => {
    if (documentPreview) {
      URL.revokeObjectURL(documentPreview);
    }
    setDocumentFile(null);
    setDocumentPreview(null);
  };

  const handleVerificationSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user) return;
    if (!documentFile) {
      setMessage({ type: 'error', text: 'Choose a document before submitting your verification request.' });
      return;
    }

    setVerificationSubmitting(true);
    setMessage(null);

    // TODO: Upload verification documents to a private verification-documents bucket when available.
    const { error } = await submitVerificationRequest(user.id, verificationType, documentFile.name);
    setVerificationSubmitting(false);

    if (error) {
      setMessage({ type: 'error', text: error });
      return;
    }

    setMessage({ type: 'success', text: 'Verification submitted. Admin will review your documents.' });
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
    setMessage({ type: 'success', text: 'Business profile created. Verification is reviewed manually by admin.' });
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
      return;
    }

    setComplaintForm({ subject: '', message: '' });
    setMessage({ type: 'success', text: 'Complaint submitted. Admin will review it.' });
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
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
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
                ['0', 'Sold items'],
                ['0', 'Reviews'],
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
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Verify account</h2>
                <p className="text-sm text-gray-600 dark:text-zinc-400">Verification is reviewed manually by admin.</p>
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
                      accept="image/*,.pdf"
                      onChange={handleDocumentChange}
                      className="absolute inset-0 cursor-pointer opacity-0"
                    />
                    <p className="font-semibold text-gray-900 dark:text-white">Choose verification document</p>
                    <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">Images or PDF. Preview stays local for now.</p>
                  </label>

                  {documentFile && documentPreview && (
                    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{documentFile.name}</p>
                          <p className="text-xs text-gray-500 dark:text-zinc-500">{Math.ceil(documentFile.size / 1024)} KB</p>
                        </div>
                        <button
                          type="button"
                          onClick={clearDocumentFile}
                          className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        >
                          Remove
                        </button>
                      </div>
                      {documentFile.type.startsWith('image/') ? (
                        <img src={documentPreview} alt="Selected verification document preview" className="max-h-72 w-full rounded-xl object-contain bg-gray-100 dark:bg-zinc-950" />
                      ) : documentFile.type === 'application/pdf' ? (
                        <iframe src={documentPreview} title="Selected verification document preview" className="h-72 w-full rounded-xl bg-gray-100 dark:bg-zinc-950" />
                      ) : (
                        <div className="rounded-xl bg-gray-100 p-6 text-center text-sm text-gray-600 dark:bg-zinc-950 dark:text-zinc-400">Preview unavailable for this file type.</div>
                      )}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={verificationSubmitting}
                    className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 px-5 py-3 text-sm font-semibold text-white transition hover:from-blue-700 hover:to-cyan-700 disabled:cursor-not-allowed disabled:from-gray-400 disabled:to-gray-500"
                  >
                    {verificationSubmitting ? 'Submitting...' : 'Submit for review'}
                  </button>
                </div>
              </form>
            </section>

            <section id="help-settings" className="mb-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Help & Settings</h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">Change theme, sign out, or report an issue if something is not working.</p>
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
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">My Listings</h2>
                <p className="mt-2 text-sm text-gray-600 dark:text-zinc-400">See what you have posted and add a new listing when you are ready.</p>
                <div className="mt-4 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center dark:border-zinc-700 dark:bg-zinc-950">
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{activeListingsCount} active listings</p>
                  <p className="mx-auto mt-2 max-w-md text-sm text-gray-600 dark:text-zinc-400">Your active listings count is live. More listing management tools can be added later.</p>
                  <Link href="/sell" className="mt-5 inline-block rounded-2xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700">
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
            <h2 className="mb-3 text-2xl font-bold text-gray-900 dark:text-white">Welcome to CampusTrader</h2>
            <p className="mx-auto mb-6 max-w-md text-gray-600 dark:text-zinc-400">
              Browse freely. Sign in to post, message sellers, save items, verify your account, or join groups.
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
