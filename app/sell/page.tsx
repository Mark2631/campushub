'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ClipboardList, ImagePlus, UserRound, Video } from 'lucide-react';
import Image from 'next/image';
import AuthPromptModal from '../../components/AuthPromptModal';
import BottomNav from '../../components/BottomNav';
import Header from '../../components/Header';
import useUser from '../../hooks/useUser';
import { createItemRequest, getItemRequestById } from '../../lib/itemRequests';
import { getListingById, insertListing, normalizeCategory, normalizeListingCondition, updateListing, uploadListingMedia } from '../../lib/listings';
import { getProfileById, type ProfileRecord } from '../../lib/profiles';
import { compressImageFile, validateUploadFile } from '../../lib/storage';
import { isValidUuid } from '../../lib/validation';

const categories = ['Electronics', 'Fashion', 'Furniture', 'Books', 'Food', 'Services', 'Business', 'Refurbished', 'Other'];
const conditions = ['new', 'used', 'refurbished', 'service'];
const maxImageSize = 5 * 1024 * 1024;
const maxVideoSize = 15 * 1024 * 1024;
type SellTab = 'sell' | 'requests' | 'guide';

type SelectedMedia = {
  file: File;
  previewUrl: string;
};

function SellPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, institution, pushNotification, profileContext, showToast } = useUser();
  const editListingId = searchParams.get('edit');
  const requestMode = searchParams.get('mode') === 'request';
  const sourceRequestId = searchParams.get('request');
  const [formData, setFormData] = useState({
    title: '',
    category: categories[0],
    price: '',
    negotiable: false,
    condition: conditions[0],
    description: '',
    location: '',
  });
  const [images, setImages] = useState<SelectedMedia[]>([]);
  const [videoPreview, setVideoPreview] = useState<SelectedMedia | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [createdListingId, setCreatedListingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [postWithoutMediaReady, setPostWithoutMediaReady] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [existingMediaUrls, setExistingMediaUrls] = useState<string[]>([]);
  const [existingVideoUrl, setExistingVideoUrl] = useState<string | null>(null);
  const [sellerProfile, setSellerProfile] = useState<ProfileRecord | null>(null);
  const [sellerDetailsLoading, setSellerDetailsLoading] = useState(false);
  const [requestForm, setRequestForm] = useState({
    title: '',
    category: categories[0],
    minPrice: '',
    maxPrice: '',
    location: '',
    description: '',
  });
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestMessage, setRequestMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [requestPrefillMessage, setRequestPrefillMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SellTab>(requestMode ? 'requests' : 'sell');

  const hasPreviewContent = images.length > 0 || Boolean(videoPreview) || Boolean(formData.title.trim());
  const isNewBusinessPost = !editListingId && profileContext.mode === 'business' && Boolean(profileContext.businessId);
  const activeSellerProfile = sellerProfile?.id === user?.id ? sellerProfile : null;
  const invalidSourceRequest = Boolean(sourceRequestId && !isValidUuid(sourceRequestId));
  const visibleRequestPrefillMessage = invalidSourceRequest ? 'That request is unavailable.' : requestPrefillMessage;
  const sellerDisplayName =
    profileContext.mode === 'business'
      ? profileContext.businessName || 'Business profile'
      : activeSellerProfile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Personal profile';
  const sellerLabel = profileContext.mode === 'business' ? 'Business seller' : 'Student seller';
  const sellerBadge =
    activeSellerProfile?.role === 'admin'
      ? 'Admin'
      : activeSellerProfile?.verification_status === 'verified' || activeSellerProfile?.badge_type === 'verified' || activeSellerProfile?.badge_type === 'blue'
        ? 'Verified'
        : 'Unverified';

  const [prevRequestMode, setPrevRequestMode] = useState(requestMode);
  if (requestMode !== prevRequestMode) {
    setPrevRequestMode(requestMode);
    if (requestMode) setActiveTab('requests');
  }

  useEffect(() => {
    const loadEditListing = async () => {
      if (!editListingId || !user) return;
      if (!isValidUuid(editListingId)) {
        setMessage({ type: 'error', text: 'Listing not found.' });
        return;
      }

      setLoadingEdit(true);
      const { listing, error } = await getListingById(editListingId);
      setLoadingEdit(false);

      if (error) {
        console.error('Edit listing load failed:', error);
        setMessage({ type: 'error', text: 'Something went wrong. Try again.' });
        return;
      }

      if (!listing || listing.seller_id !== user.id) {
        setMessage({ type: 'error', text: 'You can only edit your own listings.' });
        return;
      }

      setFormData({
        title: listing.title,
        category: listing.category,
        price: listing.price?.toString() || '',
        negotiable: listing.negotiable,
        condition: normalizeListingCondition(listing.condition, listing.category),
        description: listing.description || '',
        location: listing.location || '',
      });
      setCreatedListingId(listing.id);
      setExistingMediaUrls(listing.media_urls || []);
      setExistingVideoUrl(listing.video_url || null);
    };

    void loadEditListing();
  }, [editListingId, user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    let isMounted = true;

    const loadSellerDetails = async () => {
      setSellerDetailsLoading(true);
      const { profile, error } = await getProfileById(user.id);
      if (!isMounted) return;
      if (error) {
        console.error('Seller details load failed:', error);
      }
      setSellerProfile(profile);
      setSellerDetailsLoading(false);
    };

    void loadSellerDetails();

    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (!sourceRequestId) return;

    if (!isValidUuid(sourceRequestId)) {
      return;
    }

    let isMounted = true;

    const loadSourceRequest = async () => {
      const { request, error } = await getItemRequestById(sourceRequestId);
      if (!isMounted) return;

      if (error) {
        console.error('Request prefill failed:', error);
        setRequestPrefillMessage('Something went wrong. Try again.');
        return;
      }

      if (!request) {
        setRequestPrefillMessage('That request is unavailable.');
        return;
      }

      const nextCategory = normalizeCategory(request.category);
      setFormData((current) => ({
        ...current,
        title: current.title || request.title,
        category: nextCategory,
        condition: normalizeListingCondition(current.condition, nextCategory),
        description: current.description || [request.title, request.description].filter(Boolean).join('\n\n'),
        location: current.location || request.location || '',
      }));
      setRequestPrefillMessage('Request details copied into your listing form.');
    };

    void loadSourceRequest();

    return () => {
      isMounted = false;
    };
  }, [sourceRequestId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]:
        name === 'category'
          ? normalizeCategory(value)
          : name === 'condition'
            ? normalizeListingCondition(value, prev.category)
            : type === 'checkbox'
              ? checked
              : value,
      ...(name === 'category' ? { condition: normalizeListingCondition(prev.condition, normalizeCategory(value)) } : {}),
    }));
  };

  const handleRequestChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setRequestForm((current) => ({
      ...current,
      [name]: name === 'category' ? normalizeCategory(value) : value,
    }));
  };

  const handleRequestSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!user) {
      const text = 'Sign in to request an item.';
      setRequestMessage({ type: 'error', text });
      showToast({ type: 'error', message: text });
      return;
    }

    if (requestSubmitting) return;

    try {
      setRequestSubmitting(true);
      setRequestMessage(null);
      showToast({ type: 'info', message: 'Posting your request...' });
      const { request, error } = await createItemRequest(user.id, requestForm, institution);

      if (error || !request) {
        const text = error || 'Something went wrong. Try again.';
        setRequestMessage({ type: 'error', text });
        showToast({ type: 'error', message: text });
        return;
      }

      setRequestMessage({ type: 'success', text: 'Request posted. Sellers can now reply fast.' });
      showToast({ type: 'success', message: 'Request posted.' });
      await pushNotification({
        type: 'item request',
        title: 'Request posted',
        body: `${request.title} is now visible in Requests.`,
      });
      setRequestForm({
        title: '',
        category: categories[0],
        minPrice: '',
        maxPrice: '',
        location: '',
        description: '',
      });
      window.dispatchEvent(new Event('campustrader:requests-refresh'));
    } catch (error) {
      console.error('Item request submit failed:', error);
      const text = 'Something went wrong. Try again.';
      setRequestMessage({ type: 'error', text });
      showToast({ type: 'error', message: text });
    } finally {
      setRequestSubmitting(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files) {
      const validImages: SelectedMedia[] = [];
      const errors: string[] = [];

      Array.from(files).forEach((file) => {
        const validationError = validateUploadFile(file, 'image');
        if (validationError) {
          errors.push(validationError);
          return;
        }

        if (file.size > maxImageSize) {
          errors.push(`${file.name} must be 5MB or smaller.`);
          return;
        }

        validImages.push({ file, previewUrl: URL.createObjectURL(file) });
      });

      if (errors.length > 0) {
        setMessage({ type: 'error', text: errors.join(' ') });
        showToast({ type: 'error', message: errors.join(' ') });
      }

      setImages((prev) => [...prev, ...validImages].slice(0, 10));
      e.currentTarget.value = '';
    }
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (file) {
      const validationError = validateUploadFile(file, 'video');
      if (validationError) {
        setMessage({ type: 'error', text: validationError });
        showToast({ type: 'error', message: validationError });
        return;
      }

      if (file.size > maxVideoSize) {
        setMessage({ type: 'error', text: 'Video is too large. Use a shorter clip under 15MB.' });
        showToast({ type: 'error', message: 'Video is too large. Use a shorter clip under 15MB.' });
        return;
      }

      if (videoPreview) {
        URL.revokeObjectURL(videoPreview.previewUrl);
      }

      setVideoPreview({ file, previewUrl: URL.createObjectURL(file) });
      e.currentTarget.value = '';
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      const imageToRemove = prev[index];
      if (imageToRemove) URL.revokeObjectURL(imageToRemove.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const removeVideo = () => {
    if (videoPreview) {
      URL.revokeObjectURL(videoPreview.previewUrl);
    }
    setVideoPreview(null);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      category: categories[0],
      price: '',
      negotiable: false,
      condition: conditions[0],
      description: '',
      location: '',
    });
    images.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    if (videoPreview) URL.revokeObjectURL(videoPreview.previewUrl);
    setImages([]);
    setVideoPreview(null);
    setPostWithoutMediaReady(false);
    setExistingMediaUrls([]);
    setExistingVideoUrl(null);
    };

  const validateListingForm = () => {
    if (!user) return 'Sign in to post a listing.';
    if (!formData.title.trim()) return 'Title is required.';
    if (formData.price.trim() && Number.isNaN(Number(formData.price))) return 'Price must be a valid number.';
    return null;
  };

  const createListing = async (options?: { skipMedia?: boolean }) => {
    if (!user) {
      throw new Error('Sign in to post a listing.');
    }

    setUploadStatus('Creating listing...');
    const mediaUrls: string[] = options?.skipMedia ? (editListingId ? [...existingMediaUrls] : []) : [...existingMediaUrls];
    let videoUrl: string | null = options?.skipMedia ? (editListingId ? existingVideoUrl : null) : existingVideoUrl;

    if (!options?.skipMedia) {
      if (images.length > 0) {
        let completedUploads = 0;
        setUploadStatus(`Uploading 1 of ${images.length}...`);
        const slowTimer = window.setTimeout(() => {
          showToast({ type: 'warning', message: 'Upload is taking longer than expected. Keep this page open.' });
        }, 20000);
        const uploads = await Promise.all(
          images.map(async (image) => {
            const compressed = await compressImageFile(image.file, 1600);
            const { publicUrl, error } = await uploadListingMedia('listing-media', user.id, compressed);
            completedUploads += 1;
            setUploadStatus(`Uploading ${Math.min(completedUploads + 1, images.length)} of ${images.length}...`);
            if (error || !publicUrl) {
              throw new Error(`Image upload failed: ${error || 'Unknown error'}`);
            }
            return publicUrl;
          })
        ).finally(() => {
          window.clearTimeout(slowTimer);
        });
        mediaUrls.push(...uploads);
      }

      // Upload video if present
      if (videoPreview) {
        setUploadStatus('Uploading video...');
        const { publicUrl, error } = await uploadListingMedia('listing-media', user.id, videoPreview.file);
        if (error || !publicUrl) {
          throw new Error(`Video upload failed: ${error || 'Unknown error'}`);
        }
        videoUrl = publicUrl;
      }
    }

    setUploadStatus('Creating listing...');
    const listingPayload = {
      title: formData.title,
      category: formData.category,
      price: formData.price,
      negotiable: formData.negotiable,
      condition: normalizeListingCondition(formData.condition, formData.category),
      description: formData.description,
      location: formData.location,
      businessId: profileContext.mode === 'business' ? profileContext.businessId : null,
      mediaUrls,
      videoUrl,
      status: isNewBusinessPost ? 'active' as const : undefined,
      campus: institution,
    };

    if (editListingId) {
      return updateListing(editListingId, user.id, listingPayload);
    }

    return insertListing(user.id, listingPayload);
  };

  const submitListing = async (options?: { skipMedia?: boolean }) => {
    if (isSubmitting) {
      return;
    }

    const validationError = validateListingForm();
    if (validationError) {
      setMessage({ type: 'error', text: validationError });
      showToast({ type: 'error', message: validationError });
      return;
    }

    let slowSubmitTimer: number | undefined;

    try {
      setIsSubmitting(true);
      setMessage(null);
      setCreatedListingId(null);
      setPostWithoutMediaReady(false);
      showToast({ type: 'info', message: editListingId ? 'Saving your listing...' : 'Posting your listing...' });
      slowSubmitTimer = window.setTimeout(() => {
        showToast({ type: 'warning', message: 'Upload is taking longer than expected. Keep this page open.' });
      }, 15000);

      const { listing, error } = await createListing(options);

      if (error) {
        console.error('Listing save failed:', error);
        const text = typeof error === 'string' && error.trim()
          ? error
          : 'We could not save this listing. Check your details and try again.';
        setMessage({ type: 'error', text });
        showToast({ type: 'error', message: text });
        return;
      }

      setCreatedListingId(listing?.id || null);
      const successText = editListingId ? 'Listing updated successfully.' : 'Listing posted successfully.';
      setMessage({ type: 'success', text: successText });
      showToast({ type: 'success', message: successText });
      await pushNotification({
        type: editListingId ? 'listing updated' : isNewBusinessPost ? 'business post review' : 'listing posted',
        title: editListingId ? 'Listing updated' : isNewBusinessPost ? 'Business post in review' : 'Listing posted successfully',
        body: editListingId ? `${listing?.title || 'Your listing'} has been updated.` : `${listing?.title || 'Your listing'} is now live.`,
      });
      resetForm();
      window.dispatchEvent(new CustomEvent('campustrader:listing-created', {
        detail: { listing: listing ?? null, institution },
      }));
      window.dispatchEvent(new Event('campustrader:listings-refresh'));
      router.refresh();
      if (editListingId) {
        router.replace('/profile#my-listings');
      }
    } catch (error) {
      console.error('Listing post failed:', JSON.stringify(error, null, 2));
      const text = error instanceof Error ? error.message : String(error);
      if ((images.length > 0 || videoPreview) && /media upload failed|upload|policy|row-level|timed out|storage/i.test(text)) {
        const userText = 'Media upload failed. You can retry or post without media.';
        setMessage({ type: 'error', text: userText });
        showToast({ type: 'error', message: userText });
        setPostWithoutMediaReady(true);
      } else {
        const userText = 'Something went wrong. Try again.';
        setMessage({ type: 'error', text: userText });
        showToast({ type: 'error', message: userText });
      }
    } finally {
      if (slowSubmitTimer) window.clearTimeout(slowSubmitTimer);
      setIsSubmitting(false);
      setUploadStatus('');
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await submitListing();
  };


  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:bg-gradient-to-br dark:from-black dark:to-zinc-950 text-gray-900 dark:text-white pb-24">
        <Header />
        <main className="max-w-6xl mx-auto px-4 py-8 flex-1 flex items-center justify-center">
          <div className="text-center text-gray-600 dark:text-zinc-400">
            <div className="h-12 w-12 rounded-full border-2 border-gray-300 dark:border-zinc-700 border-t-blue-500 animate-spin mx-auto mb-4" />
            <p>Loading...</p>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:bg-gradient-to-br dark:from-black dark:to-zinc-950 text-gray-900 dark:text-white pb-24">
        <Header />
        <main className="max-w-6xl mx-auto px-4 py-8 flex-1">
          <div className="rounded-2xl border-2 border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center">
            <h2 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white">Ready to sell?</h2>
            <p className="mx-auto max-w-md text-gray-600 dark:text-zinc-400">
              Create a free account to list an item, offer a service, or post a request for sellers.
            </p>
            <div className="mx-auto mt-6 grid max-w-sm grid-cols-2 gap-3">
              <Link href="/signin?next=/sell" className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700">
                Create account
              </Link>
              <Link href="/signin?next=/sell&mode=signin" className="rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:border-blue-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
                Sign in
              </Link>
            </div>
          </div>
          <AuthPromptModal open next="/sell" onClose={() => router.push('/')} />
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:bg-gradient-to-br dark:from-black dark:to-zinc-950 text-gray-900 dark:text-white pb-24">
      <Header />
      <main className="max-w-6xl mx-auto w-full px-4 py-6 sm:py-8">
        <header className="mb-5">
          <h1 className="text-3xl font-bold">{editListingId ? 'Edit listing' : 'Sell'}</h1>
          <p className="text-sm text-gray-600 dark:text-zinc-400 mt-2">Post items, services, or campus requests for MUST students.</p>
        </header>

        <div className="mb-5 grid grid-cols-3 gap-1 rounded-2xl border border-gray-200 bg-white p-1 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {[
            ['sell', 'Sell an item/service'],
            ['requests', 'Requests'],
            ['guide', 'My selling guide'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setActiveTab(value as SellTab)}
              className={`min-h-11 rounded-xl px-2 py-2 text-xs font-bold transition sm:text-sm ${
                activeTab === value
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-50 dark:text-zinc-300 dark:hover:bg-zinc-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loadingEdit ? <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">Loading listing details...</div> : null}
        {visibleRequestPrefillMessage ? (
          <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-200">
            {visibleRequestPrefillMessage}
          </div>
        ) : null}

        {activeTab === 'sell' ? (
          <section className="mb-5 rounded-2xl border border-gray-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white">
                <UserRound className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700 dark:bg-blue-950 dark:text-blue-200">
                    Posting as {profileContext.mode === 'business' ? profileContext.businessName || 'business' : 'personal profile'}
                  </span>
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-semibold uppercase text-gray-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {sellerBadge}
                  </span>
                  {activeSellerProfile?.phone_number ? (
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                      WhatsApp ready
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 truncate text-base font-semibold text-gray-900 dark:text-white">
                  {sellerDetailsLoading ? 'Loading seller...' : sellerDisplayName}
                </p>
                <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">{sellerLabel}</p>
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === 'requests' ? (
          <form id="request-item" onSubmit={handleRequestSubmit} className="mb-6 space-y-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white">
                <ClipboardList className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Post request</h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">Tell campus sellers what you are looking for.</p>
              </div>
            </div>

            {requestMessage ? (
              <div className={`rounded-2xl border p-3 text-sm font-semibold ${requestMessage.type === 'success' ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-900/40 dark:bg-green-950/40 dark:text-green-200' : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200'}`}>
                {requestMessage.text}
              </div>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="font-medium text-gray-900 dark:text-white">What are you looking for?</span>
                <input type="text" name="title" value={requestForm.title} onChange={handleRequestChange} placeholder="e.g., Laptop charger" className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:placeholder-zinc-500" required />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium text-gray-900 dark:text-white">Category</span>
                <select name="category" value={requestForm.category} onChange={handleRequestChange} className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white">
                  {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </label>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <label className="space-y-2 text-sm">
                <span className="font-medium text-gray-900 dark:text-white">Min price</span>
                <input type="number" name="minPrice" value={requestForm.minPrice} onChange={handleRequestChange} placeholder="KSh" className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:placeholder-zinc-500" />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium text-gray-900 dark:text-white">Max price</span>
                <input type="number" name="maxPrice" value={requestForm.maxPrice} onChange={handleRequestChange} placeholder="KSh" className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:placeholder-zinc-500" />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium text-gray-900 dark:text-white">Location</span>
                <input type="text" name="location" value={requestForm.location} onChange={handleRequestChange} placeholder="Campus area" className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:placeholder-zinc-500" />
              </label>
            </div>

            <label className="space-y-2 text-sm">
              <span className="font-medium text-gray-900 dark:text-white">Description</span>
              <textarea name="description" value={requestForm.description} onChange={handleRequestChange} rows={3} placeholder="Add size, model, deadline, or service details." className="w-full resize-none rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:placeholder-zinc-500" />
            </label>

            <button type="submit" disabled={requestSubmitting} className="w-full rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
              {requestSubmitting ? 'Posting request...' : 'Post request'}
            </button>
          </form>
        ) : null}

        {activeTab === 'guide' ? (
          <section className="mb-6 space-y-3 rounded-2xl border border-gray-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            {[
              ['Meet safely', 'Meet inside campus or a public nearby place.'],
              ['Inspect first', 'Let buyers check the item before any payment.'],
              ['Keep proof', 'Use clear photos, honest condition, and chat records.'],
              ['Use fair pricing', 'Price services and used items clearly.'],
            ].map(([summary, detail]) => (
              <details key={summary} className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <summary className="cursor-pointer text-sm font-bold text-gray-900 dark:text-white">{summary}</summary>
                <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-zinc-400">{detail}</p>
              </details>
            ))}
          </section>
        ) : null}

        {activeTab === 'sell' && message && (
          <div className={`mb-6 rounded-2xl border p-4 ${message.type === 'success' ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200' : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'}`}>
            <p className="font-medium">{message.text}</p>
            {message.type === 'success' && (
              <div className="mt-2 flex flex-wrap gap-3 text-sm">
                {createdListingId ? (
                  <Link href={`/listing/${createdListingId}`} className="font-semibold underline hover:no-underline">
                    View listing
                  </Link>
                ) : null}
                <Link href="/" className="font-semibold underline hover:no-underline">
                  Go to Home
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setMessage(null);
                    setCreatedListingId(null);
                  }}
                  className="font-semibold underline hover:no-underline"
                >
                  Post another
                </button>
              </div>
            )}
            {message.type === 'error' && postWithoutMediaReady ? (
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => submitListing()}
                  disabled={isSubmitting}
                  className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Retry upload
                </button>
                <button
                  type="button"
                  onClick={() => submitListing({ skipMedia: true })}
                  disabled={isSubmitting}
                  className="rounded-2xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Post without media
                </button>
              </div>
            ) : null}
          </div>
        )}

        {activeTab === 'sell' ? (
        <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-8">
          <div className="flex flex-col items-start gap-3 rounded-2xl bg-gray-50 p-4 sm:flex-row sm:items-center dark:bg-zinc-800">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white font-semibold text-sm">1</div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">Step 1: Media</h2>
              <p className="text-sm text-gray-600 dark:text-zinc-400">Upload up to 10 images and 1 optional video.</p>
            </div>
          </div>

          {/* Multiple Images Upload */}
          <div>
            <label className="relative block rounded-2xl border-2 border-dashed border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-950 p-8 text-center cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition">
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                multiple
                onChange={handleImageUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <ImagePlus className="mx-auto mb-3 h-8 w-8 text-blue-600 dark:text-blue-300 sm:h-10 sm:w-10" aria-hidden="true" />
              <p className="font-medium text-gray-900 dark:text-white">Click to upload images</p>
              <p className="text-sm text-gray-600 dark:text-zinc-400">or drag and drop</p>
              <p className="text-xs text-gray-500 dark:text-zinc-500 mt-2">JPG, JPEG, PNG, or WebP up to 10 images</p>
            </label>

            {/* Image Previews */}
            {images.length > 0 && (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {images.map((image, index) => (
                  <div key={index} className="relative rounded-lg overflow-hidden bg-gray-200 dark:bg-zinc-800">
                    <Image src={image.previewUrl} alt={`Preview ${index + 1}`} width={320} height={80} className="w-full h-20 object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            {images.length > 0 ? (
              <div className="mt-3 rounded-2xl border border-gray-200 bg-white p-3 text-xs text-gray-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                <p className="mb-2 font-semibold text-gray-900 dark:text-white">Selected images</p>
                <ul className="space-y-1">
                  {images.map((image, index) => (
                    <li key={`${image.file.name}-${image.file.size}-${index}`} className="truncate">
                      {image.file.name}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="text-xs text-gray-600 dark:text-zinc-400 mt-2">{images.length}/10 images uploaded</p>
          </div>

          {/* Single Video Upload */}
          <div>
            <label className="block space-y-2 text-sm">
              <span className="font-medium text-gray-900 dark:text-white">Optional: Add a video (max 1)</span>
              <div className="relative block rounded-2xl border-2 border-dashed border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-950 p-6 text-center cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition">
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={handleVideoUpload}
                  disabled={!!videoPreview}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              <Video className="mx-auto mb-2 h-7 w-7 text-blue-600 dark:text-blue-300 sm:h-8 sm:w-8" aria-hidden="true" />
                <p className="text-sm font-medium text-gray-900 dark:text-white">{videoPreview ? videoPreview.file.name : 'Click to upload video'}</p>
                <p className="text-xs text-gray-600 dark:text-zinc-400">MP4, WebM, or MOV up to 15MB</p>
              </div>
            </label>

            {/* Video Preview */}
            {videoPreview && (
              <div className="mt-4 relative rounded-lg overflow-hidden bg-gray-900">
                <video src={videoPreview.previewUrl} controls className="w-full max-h-64 bg-black" />
                <button
                  type="button"
                  onClick={removeVideo}
                  className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Form Fields */}
          <div className="mt-8 flex flex-col items-start gap-3 rounded-2xl bg-gray-50 p-4 sm:flex-row sm:items-center dark:bg-zinc-800">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white font-semibold text-sm">2</div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">Step 2: Details</h2>
              <p className="text-sm text-gray-600 dark:text-zinc-400">Add the basics buyers need to decide fast.</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-gray-900 dark:text-white">Title *</span>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="e.g., iPhone 13 Pro, Textbooks Bundle"
                className="w-full rounded-2xl bg-white dark:bg-zinc-950 border border-gray-300 dark:border-zinc-800 px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                required
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-gray-900 dark:text-white">Category</span>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full rounded-2xl bg-white dark:bg-zinc-950 border border-gray-300 dark:border-zinc-800 px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-gray-900 dark:text-white">Price (KSh, optional)</span>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleChange}
                placeholder="Leave blank to discuss"
                min="0"
                step="1"
                className="w-full rounded-2xl bg-white dark:bg-zinc-950 border border-gray-300 dark:border-zinc-800 px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
              <span className="block text-xs text-gray-500 dark:text-zinc-500">Leave it blank if buyers should contact you for a quote. Enter 0 for a free item.</span>
            </label>
            <label className="flex items-center justify-between rounded-2xl bg-white dark:bg-zinc-950 border border-gray-300 dark:border-zinc-800 px-4 py-3 text-sm cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition">
              <span className="font-medium text-gray-900 dark:text-white">Negotiable</span>
              <input
                type="checkbox"
                name="negotiable"
                checked={formData.negotiable}
                onChange={handleChange}
                className="h-5 w-5 rounded border-gray-300 bg-white text-blue-600 cursor-pointer"
              />
            </label>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-gray-900 dark:text-white">Condition</span>
              <select
                name="condition"
                value={formData.condition}
                onChange={handleChange}
                className="w-full rounded-2xl bg-white dark:bg-zinc-950 border border-gray-300 dark:border-zinc-800 px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              >
                {conditions.map((condition) => (
                  <option key={condition} value={condition}>
                    {condition.charAt(0).toUpperCase() + condition.slice(1)}
                  </option>
                ))}
              </select>
              {formData.category === 'Services' ? (
                <p className="text-xs text-gray-500 dark:text-zinc-500">Services automatically use service condition.</p>
              ) : null}
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-gray-900 dark:text-white">Location</span>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="Campus area or building"
                className="w-full rounded-2xl bg-white dark:bg-zinc-950 border border-gray-300 dark:border-zinc-800 px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </label>
          </div>

          <label className="space-y-2 text-sm">
            <span className="font-medium text-gray-900 dark:text-white">Description</span>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              className="w-full resize-none rounded-2xl bg-white dark:bg-zinc-950 border border-gray-300 dark:border-zinc-800 px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              placeholder="Tell buyers what makes this item special, its condition, and any defects."
            />
          </label>

          <div className="mt-8 flex flex-col items-start gap-3 rounded-2xl bg-gray-50 p-4 sm:flex-row sm:items-center dark:bg-zinc-800">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white font-semibold text-sm">3</div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">Step 3: Review & Post</h2>
              <p className="text-sm text-gray-600 dark:text-zinc-400">Check your listing before posting it.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-zinc-800 dark:bg-zinc-950">
            {hasPreviewContent ? (
              <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
                <div className="space-y-3">
                  <div className="flex h-48 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 text-center text-white">
                    {images[0] ? (
                      <Image src={images[0].previewUrl} alt="Listing preview" width={1200} height={480} className="h-full w-full object-cover" />
                    ) : (
                      <div className="px-6">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em]">{formData.category}</p>
                        <p className="mt-3 text-xl font-bold">{formData.title || 'Your listing preview'}</p>
                      </div>
                    )}
                  </div>
                  {videoPreview ? (
                    <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                      Video ready: {videoPreview.file.name}
                    </div>
                  ) : null}
                </div>
                <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{formData.title || 'Add a title'}</p>
                  <p className="text-sm text-gray-600 dark:text-zinc-400">{formData.location || 'Add a location'}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 dark:bg-zinc-800 dark:text-zinc-300">{formData.category}</span>
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold capitalize text-gray-700 dark:bg-zinc-800 dark:text-zinc-300">{normalizeListingCondition(formData.condition, formData.category)}</span>
                    {formData.negotiable ? <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">Negotiable</span> : null}
                  </div>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formData.price ? `KSh ${Number(formData.price).toLocaleString()}` : 'Add price'}</p>
                  <p className="text-sm leading-6 text-gray-600 dark:text-zinc-400">{formData.description || 'Add a short description so buyers know what you are offering.'}</p>
                  <div className="border-t border-gray-200 pt-3 dark:border-zinc-800">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-500">Seller</p>
                    <p className="mt-1 truncate text-sm font-semibold text-gray-900 dark:text-white">{sellerDisplayName}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-600 dark:text-zinc-400">Your preview will appear here once you add media or details.</p>
            )}
          </div>

  

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 px-5 py-4 text-sm font-semibold text-white transition disabled:cursor-not-allowed"
          >
            {isSubmitting ? uploadStatus || 'Posting...' : isNewBusinessPost ? 'Send for review' : 'Post Listing'}
          </button>
          {isSubmitting && uploadStatus ? (
            <p className="text-center text-sm font-semibold text-blue-600 dark:text-blue-300">{uploadStatus}</p>
          ) : null}
        </form>
        ) : null}
      </main>

      <BottomNav />
    </div>
  );
}

export default function SellPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col bg-gradient-to-br from-gray-50 to-gray-100 pb-24 text-gray-900 dark:bg-gradient-to-br dark:from-black dark:to-zinc-950 dark:text-white">
          <Header />
          <main className="max-w-6xl mx-auto flex w-full flex-1 items-center justify-center px-4 py-8">
            <div className="h-12 w-12 rounded-full border-2 border-gray-300 border-t-blue-500 animate-spin dark:border-zinc-700" />
          </main>
          <BottomNav />
        </div>
      }
    >
      <SellPageContent />
    </Suspense>
  );
}
