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

const categories = ['Electronics', 'Fashion', 'Furniture', 'Books', 'Food', 'Services', 'Accommodation', 'Roommates', 'Business', 'Refurbished', 'Other'];
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
  const [editDataLoadedId, setEditDataLoadedId] = useState<string | null>(null);
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
  const requiresListingPhoto = !['Services', 'Roommates'].includes(formData.category);
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

      setEditDataLoadedId(null);
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
        category: listing.listing_type === 'PROPERTY_RENTAL' ? 'Accommodation' : listing.listing_type === 'ROOMMATE' ? 'Roommates' : listing.category,
        price: listing.price != null && listing.price > 0 ? listing.price.toString() : '',
        negotiable: listing.negotiable,
        condition: normalizeListingCondition(listing.condition, listing.category),
        description: listing.description || '',
        location: listing.location || '',
      });
      setCreatedListingId(listing.id);
      setExistingMediaUrls(listing.media_urls || []);
      setExistingVideoUrl(listing.video_url || null);
      setEditDataLoadedId(listing.id);
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
      void Promise.resolve(pushNotification({
        type: 'item request',
        title: 'Request posted',
        body: `${request.title} is now visible in Requests.`,
      })).catch((notificationError) => {
        console.warn('Request notification delivery failed:', notificationError);
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

      const availableSlots = Math.max(0, 10 - existingMediaUrls.length - images.length);
      const acceptedImages = validImages.slice(0, availableSlots);
      validImages.slice(availableSlots).forEach((image) => URL.revokeObjectURL(image.previewUrl));
      if (acceptedImages.length < validImages.length) {
        const text = 'A listing can include up to 10 photos, including photos already attached.';
        setMessage({ type: 'error', text });
        showToast({ type: 'error', message: text });
      }
      setImages((prev) => [...prev, ...acceptedImages]);
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

  const removeExistingImage = (index: number) => {
    setExistingMediaUrls((current) => current.filter((_, currentIndex) => currentIndex !== index));
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
    if (requiresListingPhoto && images.length + existingMediaUrls.length === 0) return 'Add at least one clear photo of the actual item or room.';
    if (requiresListingPhoto && formData.description.trim().length < 30) return 'Add a short description covering the model, what is included, and any wear or defects.';
    if (formData.price.trim() && Number.isNaN(Number(formData.price))) return 'Price must be a valid number.';
    if (formData.price.trim() && Number(formData.price) < 0) return 'Price cannot be negative.';
    if (formData.price.trim() && Number(formData.price) === 0) return 'Leave the price blank if buyers should contact you to agree on a price.';
    if (formData.category === 'Accommodation' && !formData.price.trim()) return 'Add the monthly rent so students can compare places.';
    if (['Accommodation', 'Roommates'].includes(formData.category) && !formData.location.trim()) return 'Add the neighbourhood or campus area.';
    if (['Accommodation', 'Roommates'].includes(formData.category) && formData.description.trim().length < 30) return 'Add a few details about the space, costs and move-in arrangements.';
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
    if (editListingId && (loadingEdit || editDataLoadedId !== editListingId)) {
      const text = 'Listing details are still loading. Wait a moment, then try again.';
      setMessage({ type: 'error', text });
      showToast({ type: 'error', message: text });
      return;
    }

    const validationError = validateListingForm();
    if (validationError) {
      setMessage({ type: 'error', text: validationError });
      showToast({ type: 'error', message: validationError });
      return;
    }
    if (options?.skipMedia && requiresListingPhoto && existingMediaUrls.length === 0) {
      const text = 'This listing needs at least one stored photo. Retry the upload before posting.';
      setMessage({ type: 'error', text });
      showToast({ type: 'error', message: text });
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
      void Promise.resolve(pushNotification({
        type: editListingId ? 'listing updated' : 'listing posted',
        title: editListingId ? 'Listing updated' : 'Listing posted successfully',
        body: editListingId ? `${listing?.title || 'Your listing'} has been updated.` : `${listing?.title || 'Your listing'} is now live.`,
      })).catch((notificationError) => {
        console.warn('Listing notification delivery failed:', notificationError);
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
      <div className="flex flex-col min-h-screen bg-[var(--background)] text-[var(--foreground)] pb-24">
        <Header />
        <main className="max-w-6xl mx-auto px-4 py-8 flex-1 flex items-center justify-center">
          <div className="text-center text-[var(--muted)] dark:text-[var(--muted)]">
            <div className="h-12 w-12 rounded-full border-2 border-[var(--border)] dark:border-[var(--border)] border-t-[var(--brand)] animate-spin mx-auto mb-4" />
            <p>Loading...</p>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col min-h-screen bg-[var(--background)] text-[var(--foreground)] pb-24">
        <Header />
        <main className="max-w-6xl mx-auto px-4 py-8 flex-1">
          <div className="rounded-2xl border-2 border-[var(--border)] dark:border-[var(--border)] bg-[var(--surface)] dark:bg-[var(--surface)] p-8 text-center">
            <h2 className="text-2xl font-bold mb-3 text-[var(--foreground)] dark:text-[var(--foreground)]">Ready to sell?</h2>
            <p className="mx-auto max-w-md text-[var(--muted)] dark:text-[var(--muted)]">
              Create a free account to list an item, offer a service, or post a request for sellers.
            </p>
            <div className="mx-auto mt-6 grid max-w-sm grid-cols-2 gap-3">
              <Link href="/signin?next=/sell" className="rounded-2xl bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-strong)]">
                Create account
              </Link>
              <Link href="/signin?next=/sell&mode=signin" className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--brand)] dark:border-[var(--border)] dark:bg-[var(--background)] dark:text-[var(--foreground)]">
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
    <div className="flex flex-col min-h-screen bg-[var(--background)] text-[var(--foreground)] pb-24">
      <Header />
      <main className="max-w-6xl mx-auto w-full px-4 py-6 sm:py-8">
        <header className="mb-5">
          <h1 className="text-3xl font-bold">{editListingId ? 'Edit listing' : 'Sell'}</h1>
          <p className="text-sm text-[var(--muted)] dark:text-[var(--muted)] mt-2">Post products, rentals, roommate openings or services for students at your campus.</p>
        </header>

        <div className="mb-5 grid grid-cols-3 gap-1 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1 shadow-sm dark:border-[var(--border)] dark:bg-[var(--surface)]">
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
                  ? 'bg-[var(--brand)] text-white'
                  : 'text-[var(--muted)] hover:bg-[var(--background)] dark:text-[var(--foreground)] dark:hover:bg-[var(--surface-muted)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loadingEdit ? <div className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)] dark:border-[var(--border)] dark:bg-[var(--surface)] dark:text-[var(--foreground)]">Loading listing details...</div> : null}
        {visibleRequestPrefillMessage ? (
          <div className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--brand-soft)] p-4 text-sm font-semibold text-[var(--brand)] dark:border-[var(--border)] dark:bg-[var(--brand-soft)] dark:text-[var(--brand)]">
            {visibleRequestPrefillMessage}
          </div>
        ) : null}

        {activeTab === 'sell' ? (
          <section className="mb-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 dark:border-[var(--border)] dark:bg-[var(--surface)]">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--brand)] text-white">
                <UserRound className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-[var(--brand-soft)] px-3 py-1 text-[var(--brand)] dark:bg-[var(--brand-soft)] dark:text-[var(--brand)]">
                    Posting as {profileContext.mode === 'business' ? profileContext.businessName || 'business' : 'personal profile'}
                  </span>
                  <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-[10px] font-semibold uppercase text-[var(--foreground)] dark:bg-[var(--surface-muted)] dark:text-[var(--foreground)]">
                    {sellerBadge}
                  </span>
                  {activeSellerProfile?.phone_number ? (
                    <span className="rounded-full bg-[var(--brand-soft)] px-3 py-1 text-[var(--brand)]">
                      WhatsApp ready
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 truncate text-base font-semibold text-[var(--foreground)] dark:text-[var(--foreground)]">
                  {sellerDetailsLoading ? 'Loading seller...' : sellerDisplayName}
                </p>
                <p className="mt-1 text-sm text-[var(--muted)] dark:text-[var(--muted)]">{sellerLabel}</p>
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === 'requests' ? (
          <form id="request-item" onSubmit={handleRequestSubmit} className="mb-6 space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 dark:border-[var(--border)] dark:bg-[var(--surface)]">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--brand)] text-white">
                <ClipboardList className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[var(--foreground)] dark:text-[var(--foreground)]">Post request</h2>
                <p className="mt-1 text-sm text-[var(--muted)] dark:text-[var(--muted)]">Tell campus sellers what you are looking for.</p>
              </div>
            </div>

            {requestMessage ? (
              <div className={`rounded-2xl border p-3 text-sm font-semibold ${requestMessage.type === 'success' ? 'border-[var(--border)] bg-[var(--brand-soft)] text-[var(--brand)]' : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200'}`}>
                {requestMessage.text}
              </div>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="font-medium text-[var(--foreground)] dark:text-[var(--foreground)]">What are you looking for?</span>
                <input type="text" name="title" value={requestForm.title} onChange={handleRequestChange} placeholder="e.g., Laptop charger" className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--foreground)] placeholder-[var(--muted)] focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 dark:border-[var(--border)] dark:bg-[var(--background)] dark:text-[var(--foreground)] dark:placeholder-[var(--muted)]" required />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium text-[var(--foreground)] dark:text-[var(--foreground)]">Category</span>
                <select name="category" value={requestForm.category} onChange={handleRequestChange} className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--foreground)] focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 dark:border-[var(--border)] dark:bg-[var(--background)] dark:text-[var(--foreground)]">
                  {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </label>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <label className="space-y-2 text-sm">
                <span className="font-medium text-[var(--foreground)] dark:text-[var(--foreground)]">Min price</span>
                <input type="number" name="minPrice" value={requestForm.minPrice} onChange={handleRequestChange} placeholder="KSh" className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--foreground)] placeholder-[var(--muted)] focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 dark:border-[var(--border)] dark:bg-[var(--background)] dark:text-[var(--foreground)] dark:placeholder-[var(--muted)]" />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium text-[var(--foreground)] dark:text-[var(--foreground)]">Max price</span>
                <input type="number" name="maxPrice" value={requestForm.maxPrice} onChange={handleRequestChange} placeholder="KSh" className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--foreground)] placeholder-[var(--muted)] focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 dark:border-[var(--border)] dark:bg-[var(--background)] dark:text-[var(--foreground)] dark:placeholder-[var(--muted)]" />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium text-[var(--foreground)] dark:text-[var(--foreground)]">Location</span>
                <input type="text" name="location" value={requestForm.location} onChange={handleRequestChange} placeholder="Campus area" className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--foreground)] placeholder-[var(--muted)] focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 dark:border-[var(--border)] dark:bg-[var(--background)] dark:text-[var(--foreground)] dark:placeholder-[var(--muted)]" />
              </label>
            </div>

            <label className="space-y-2 text-sm">
              <span className="font-medium text-[var(--foreground)] dark:text-[var(--foreground)]">Description</span>
              <textarea name="description" value={requestForm.description} onChange={handleRequestChange} rows={3} placeholder="Add size, model, deadline, or service details." className="w-full resize-none rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--foreground)] placeholder-[var(--muted)] focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 dark:border-[var(--border)] dark:bg-[var(--background)] dark:text-[var(--foreground)] dark:placeholder-[var(--muted)]" />
            </label>

            <button type="submit" disabled={requestSubmitting} className="w-full rounded-2xl bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
              {requestSubmitting ? 'Posting request...' : 'Post request'}
            </button>
          </form>
        ) : null}

        {activeTab === 'guide' ? (
          <section className="mb-6 space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 dark:border-[var(--border)] dark:bg-[var(--surface)]">
            {[
              ['Meet safely', 'Meet inside campus or a public nearby place.'],
              ['Inspect first', 'Let buyers check the item before any payment.'],
              ['Keep proof', 'Use clear photos, honest condition, and chat records.'],
              ['Use fair pricing', 'Price services and used items clearly.'],
            ].map(([summary, detail]) => (
              <details key={summary} className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4 dark:border-[var(--border)] dark:bg-[var(--background)]">
                <summary className="cursor-pointer text-sm font-bold text-[var(--foreground)] dark:text-[var(--foreground)]">{summary}</summary>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)] dark:text-[var(--muted)]">{detail}</p>
              </details>
            ))}
          </section>
        ) : null}

        {activeTab === 'sell' && message && (
          <div className={`mb-6 rounded-2xl border p-4 ${message.type === 'success' ? 'border-[var(--border)] bg-[var(--brand-soft)] text-[var(--brand)]' : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'}`}>
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
            {message.type === 'error' && postWithoutMediaReady && (!requiresListingPhoto || existingMediaUrls.length > 0) ? (
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => submitListing()}
                  disabled={isSubmitting}
                  className="rounded-2xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-60"
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
        <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-[var(--border)] dark:border-[var(--border)] bg-[var(--surface)] dark:bg-[var(--surface)] p-5 sm:p-8">
          <div className="flex flex-col items-start gap-3 rounded-2xl bg-[var(--background)] p-4 sm:flex-row sm:items-center dark:bg-[var(--surface-muted)]">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand)] text-white font-semibold text-sm">1</div>
            <div>
              <h2 className="font-semibold text-[var(--foreground)] dark:text-[var(--foreground)]">Step 1: Media</h2>
              <p className="text-sm text-[var(--muted)] dark:text-[var(--muted)]">Products and rentals need at least one clear photo of the actual item or room. Add extra angles to show condition and details.</p>
            </div>
          </div>

          {/* Multiple Images Upload */}
          <div>
            <label className="relative block rounded-2xl border-2 border-dashed border-[var(--border)] dark:border-[var(--border)] bg-[var(--background)] dark:bg-[var(--background)] p-8 text-center cursor-pointer hover:border-[var(--brand)] dark:hover:border-[var(--brand)] transition">
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                multiple
                onChange={handleImageUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <ImagePlus className="mx-auto mb-3 h-8 w-8 text-[var(--brand)] dark:text-[var(--brand)] sm:h-10 sm:w-10" aria-hidden="true" />
              <p className="font-medium text-[var(--foreground)] dark:text-[var(--foreground)]">Add actual item or room photos</p>
              <p className="text-sm text-[var(--muted)] dark:text-[var(--muted)]">or drag and drop</p>
              <p className="text-xs text-[var(--muted)] dark:text-[var(--muted)] mt-2">Use your own photos, not catalogue images. JPG, PNG or WebP · up to 10 images</p>
            </label>

            {existingMediaUrls.length > 0 ? (
              <div className="mt-4">
                <p className="mb-2 text-sm font-semibold text-[var(--foreground)] dark:text-[var(--foreground)]">Photos already on this listing</p>
                <p className="mb-3 text-xs text-[var(--muted)] dark:text-[var(--muted)]">These photos stay attached when you save. Remove any you no longer want.</p>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
                  {existingMediaUrls.map((url, index) => (
                    <div key={url + '-' + index} className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] dark:border-[var(--border)] dark:bg-[var(--surface-muted)]">
                      <Image src={url} alt={'Existing listing photo ' + (index + 1)} width={320} height={160} unoptimized className="h-28 w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeExistingImage(index)}
                        aria-label={'Remove existing photo ' + (index + 1)}
                        className="absolute right-1 top-1 rounded-full bg-red-600 px-2.5 py-1 text-xs font-semibold text-white shadow"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : editListingId && loadingEdit ? (
              <p className="mt-3 text-xs text-[var(--muted)] dark:text-[var(--muted)]">Loading existing photos…</p>
            ) : null}

            {/* Image Previews */}
            {images.length > 0 && (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {images.map((image, index) => (
                  <div key={index} className="relative rounded-lg overflow-hidden bg-gray-200 dark:bg-[var(--surface-muted)]">
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
              <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 text-xs text-[var(--muted)] dark:border-[var(--border)] dark:bg-[var(--background)] dark:text-[var(--foreground)]">
                <p className="mb-2 font-semibold text-[var(--foreground)] dark:text-[var(--foreground)]">Selected images</p>
                <ul className="space-y-1">
                  {images.map((image, index) => (
                    <li key={`${image.file.name}-${image.file.size}-${index}`} className="truncate">
                      {image.file.name}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="text-xs text-[var(--muted)] dark:text-[var(--muted)] mt-2">{existingMediaUrls.length + images.length}/10 photos attached</p>
          </div>

          {/* Single Video Upload */}
          <div>
            <label className="block space-y-2 text-sm">
              <span className="font-medium text-[var(--foreground)] dark:text-[var(--foreground)]">Optional: Add a video (max 1)</span>
              <div className="relative block rounded-2xl border-2 border-dashed border-[var(--border)] dark:border-[var(--border)] bg-[var(--background)] dark:bg-[var(--background)] p-6 text-center cursor-pointer hover:border-[var(--brand)] dark:hover:border-[var(--brand)] transition">
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={handleVideoUpload}
                  disabled={!!videoPreview}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              <Video className="mx-auto mb-2 h-7 w-7 text-[var(--brand)] dark:text-[var(--brand)] sm:h-8 sm:w-8" aria-hidden="true" />
                <p className="text-sm font-medium text-[var(--foreground)] dark:text-[var(--foreground)]">{videoPreview ? videoPreview.file.name : 'Click to upload video'}</p>
                <p className="text-xs text-[var(--muted)] dark:text-[var(--muted)]">MP4, WebM, or MOV up to 15MB</p>
              </div>
            </label>

            {existingVideoUrl && !videoPreview ? (
              <div className="relative mt-4 overflow-hidden rounded-xl border border-[var(--border)] bg-black dark:border-[var(--border)]">
                <video src={existingVideoUrl} controls className="max-h-64 w-full bg-black" />
                <button
                  type="button"
                  onClick={() => setExistingVideoUrl(null)}
                  className="absolute right-2 top-2 rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow"
                >
                  Remove existing video
                </button>
              </div>
            ) : null}

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
          <div className="mt-8 flex flex-col items-start gap-3 rounded-2xl bg-[var(--background)] p-4 sm:flex-row sm:items-center dark:bg-[var(--surface-muted)]">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand)] text-white font-semibold text-sm">2</div>
            <div>
              <h2 className="font-semibold text-[var(--foreground)] dark:text-[var(--foreground)]">Step 2: Details</h2>
              <p className="text-sm text-[var(--muted)] dark:text-[var(--muted)]">Add the basics buyers need to decide fast.</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-[var(--foreground)] dark:text-[var(--foreground)]">Title *</span>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="e.g., iPhone 13 Pro, Textbooks Bundle"
                className="w-full rounded-2xl bg-[var(--surface)] dark:bg-[var(--background)] border border-[var(--border)] dark:border-[var(--border)] px-4 py-3 text-[var(--foreground)] dark:text-[var(--foreground)] placeholder-[var(--muted)] dark:placeholder-[var(--muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
                required
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-[var(--foreground)] dark:text-[var(--foreground)]">Category</span>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full rounded-2xl bg-[var(--surface)] dark:bg-[var(--background)] border border-[var(--border)] dark:border-[var(--border)] px-4 py-3 text-[var(--foreground)] dark:text-[var(--foreground)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
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
              <span className="font-medium text-[var(--foreground)] dark:text-[var(--foreground)]">{formData.category === 'Accommodation' ? 'Monthly rent (KSh)' : formData.category === 'Roommates' ? 'Monthly share per person (KSh, optional)' : 'Price (KSh, optional)'}</span>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleChange}
                placeholder={formData.category === 'Accommodation' ? 'e.g. 8500 per month' : formData.category === 'Roommates' ? 'e.g. 6000 monthly share' : 'Leave blank to ask seller'}
                min="1"
                step="1"
                className="w-full rounded-2xl bg-[var(--surface)] dark:bg-[var(--background)] border border-[var(--border)] dark:border-[var(--border)] px-4 py-3 text-[var(--foreground)] dark:text-[var(--foreground)] placeholder-[var(--muted)] dark:placeholder-[var(--muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
              />
              <span className="block text-xs text-[var(--muted)] dark:text-[var(--muted)]">{formData.category === 'Accommodation' ? 'Enter monthly rent. Add deposit and other charges in the description.' : formData.category === 'Roommates' ? 'Use the expected monthly share if known. Explain how bills are split in the description.' : 'Leave blank if buyers should contact you to agree on a price. Enter a price above KSh 0 when you have a fixed price.'}</span>
            </label>
            <label className="flex items-center justify-between rounded-2xl bg-[var(--surface)] dark:bg-[var(--background)] border border-[var(--border)] dark:border-[var(--border)] px-4 py-3 text-sm cursor-pointer hover:border-[var(--brand)] dark:hover:border-[var(--brand)] transition">
              <span className="font-medium text-[var(--foreground)] dark:text-[var(--foreground)]">Negotiable</span>
              <input
                type="checkbox"
                name="negotiable"
                checked={formData.negotiable}
                onChange={handleChange}
                className="h-5 w-5 rounded border-[var(--border)] bg-[var(--surface)] text-[var(--brand)] cursor-pointer"
              />
            </label>
          </div>

          {formData.category !== 'Accommodation' && formData.category !== 'Roommates' ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-[var(--foreground)] dark:text-[var(--foreground)]">Seller-reported condition</span>
              <select
                name="condition"
                value={formData.condition}
                onChange={handleChange}
                className="w-full rounded-2xl bg-[var(--surface)] dark:bg-[var(--background)] border border-[var(--border)] dark:border-[var(--border)] px-4 py-3 text-[var(--foreground)] dark:text-[var(--foreground)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
              >
                {conditions.map((condition) => (
                  <option key={condition} value={condition}>
                    {condition.charAt(0).toUpperCase() + condition.slice(1)}
                  </option>
                ))}
              </select>
              {formData.category === 'Services' ? (
                <p className="text-xs text-[var(--muted)] dark:text-[var(--muted)]">Services automatically use service condition.</p>
              ) : null}
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-[var(--foreground)] dark:text-[var(--foreground)]">Location</span>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder={formData.category === 'Accommodation' || formData.category === 'Roommates' ? 'Neighbourhood, estate or campus area' : 'Campus area or building'}
                className="w-full rounded-2xl bg-[var(--surface)] dark:bg-[var(--background)] border border-[var(--border)] dark:border-[var(--border)] px-4 py-3 text-[var(--foreground)] dark:text-[var(--foreground)] placeholder-[var(--muted)] dark:placeholder-[var(--muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
              />
            </label>
          </div>
          ) : null}

          {formData.category === 'Accommodation' || formData.category === 'Roommates' ? (
            <>
              <label className="block space-y-2 text-sm">
                <span className="font-medium text-[var(--foreground)]">Neighbourhood or campus area *</span>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="e.g. Gachanka, Makutano, near the main gate"
                  required
                  className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--foreground)] placeholder-[var(--muted)] focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20"
                />
              </label>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm leading-6 text-[var(--muted)]">
                <p className="font-semibold text-[var(--foreground)]">{formData.category === 'Accommodation' ? 'Help students assess the place' : 'Make it easier to find a compatible roommate'}</p>
                <p className="mt-1">{formData.category === 'Accommodation' ? 'Include deposit, utilities, amenities, exact area, move-in date and when a viewing can be arranged.' : 'Say whether you have a room or are looking for one. Include expected share, house rules, area and move-in date.'}</p>
              </div>
            </>
          ) : null}

          <label className="space-y-2 text-sm">
            <span className="font-medium text-[var(--foreground)] dark:text-[var(--foreground)]">Description</span>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={formData.category === 'Accommodation' || formData.category === 'Roommates' ? 5 : 4}
              className="w-full resize-none rounded-2xl bg-[var(--surface)] dark:bg-[var(--background)] border border-[var(--border)] dark:border-[var(--border)] px-4 py-3 text-[var(--foreground)] dark:text-[var(--foreground)] placeholder-[var(--muted)] dark:placeholder-[var(--muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
              placeholder={formData.category === 'Accommodation' ? 'Describe the room, utilities, amenities, deposit and viewing arrangements.' : formData.category === 'Roommates' ? 'Do you have a room or need one? Describe the space, sharing costs, house rules and move-in date.' : formData.category === 'Services' ? 'Describe the service, what is included, your experience and the expected result.' : 'Describe the brand/model, what is included, and any wear, defects or missing parts. Use your own photos.'}
            />
            <p className="text-xs leading-5 text-[var(--muted)]">
              {formData.category === 'Electronics' ? 'Include the exact brand and model, storage, battery health if known, repairs, accessories and every known defect.' :
                formData.category === 'Books' ? 'Include the title, author, edition, course or unit, and whether there are highlights, notes or missing pages.' :
                formData.category === 'Fashion' ? 'Include the size, measurements, material, fit and any stains, tears or signs of wear.' :
                formData.category === 'Furniture' ? 'Include dimensions, material, condition, collection point and whether transport is available.' :
                formData.category === 'Food' ? 'Include portion size, ingredients, allergens, preparation or collection times and how orders are handled.' :
                formData.category === 'Refurbished' ? 'Include what was repaired or replaced, who did the work if known, when it was serviced and what is still worn.' :
                formData.category === 'Accommodation' ? 'Include deposit, utility costs, room type, amenities, move-in date and when a viewing can be arranged.' :
                formData.category === 'Roommates' ? 'Say whether you have a room or need one. Include the monthly share, bills, house rules, area and move-in date.' :
                formData.category === 'Services' ? 'Explain what is included, your experience, expected turnaround, any materials needed and the final result.' :
                'Include useful specifications, what is included, the condition and anything a student should confirm before agreeing.'}
            </p>
          </label>

          <div className="mt-8 flex flex-col items-start gap-3 rounded-2xl bg-[var(--background)] p-4 sm:flex-row sm:items-center dark:bg-[var(--surface-muted)]">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand)] text-white font-semibold text-sm">3</div>
            <div>
              <h2 className="font-semibold text-[var(--foreground)] dark:text-[var(--foreground)]">Step 3: Review & Post</h2>
              <p className="text-sm text-[var(--muted)] dark:text-[var(--muted)]">Check your listing before posting it.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-5 dark:border-[var(--border)] dark:bg-[var(--background)]">
            {hasPreviewContent ? (
              <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
                <div className="space-y-3">
                  <div className="flex h-48 items-center justify-center overflow-hidden rounded-2xl bg-[var(--brand-soft)] text-center text-white">
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
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--foreground)] dark:border-[var(--border)] dark:bg-[var(--surface)] dark:text-[var(--foreground)]">
                      Video ready: {videoPreview.file.name}
                    </div>
                  ) : null}
                </div>
                <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 dark:border-[var(--border)] dark:bg-[var(--surface)]">
                  <p className="text-lg font-bold text-[var(--foreground)] dark:text-[var(--foreground)]">{formData.title || 'Add a title'}</p>
                  <p className="text-sm text-[var(--muted)] dark:text-[var(--muted)]">{formData.location || 'Add a location'}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--foreground)] dark:bg-[var(--surface-muted)] dark:text-[var(--foreground)]">{formData.category}</span>
                    <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs font-semibold capitalize text-[var(--foreground)] dark:bg-[var(--surface-muted)] dark:text-[var(--foreground)]">{normalizeListingCondition(formData.condition, formData.category)}</span>
                    {formData.negotiable ? <span className="rounded-full bg-[var(--brand-soft)] px-3 py-1 text-xs font-semibold text-[var(--brand)] dark:bg-[var(--brand-soft)] dark:text-[var(--brand)]">Negotiable</span> : null}
                  </div>
                  <p className="text-2xl font-bold text-[var(--brand)] dark:text-[var(--brand)]">{formData.price.trim() && Number(formData.price) > 0 ? `KSh ${Number(formData.price).toLocaleString()}` : 'Ask seller for price'}</p>
                  <p className="text-sm leading-6 text-[var(--muted)] dark:text-[var(--muted)]">{formData.description || 'Add a short description so buyers know what you are offering.'}</p>
                  <div className="border-t border-[var(--border)] pt-3 dark:border-[var(--border)]">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)] dark:text-[var(--muted)]">Seller</p>
                    <p className="mt-1 truncate text-sm font-semibold text-[var(--foreground)] dark:text-[var(--foreground)]">{sellerDisplayName}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)] dark:text-[var(--muted)]">Your preview will appear here once you add media or details.</p>
            )}
          </div>

  

          <button
            type="submit"
            disabled={isSubmitting || loadingEdit || (Boolean(editListingId) && editDataLoadedId !== editListingId)}
            className="w-full rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-strong)] disabled:bg-[var(--surface-muted)] disabled:text-[var(--muted)] px-5 py-4 text-sm font-semibold text-white transition disabled:cursor-not-allowed"
          >
            {loadingEdit ? 'Loading listing…' : isSubmitting ? uploadStatus || 'Posting...' : editListingId ? 'Save changes' : 'Post listing'}
          </button>
          {isSubmitting && uploadStatus ? (
            <p className="text-center text-sm font-semibold text-[var(--brand)] dark:text-[var(--brand)]">{uploadStatus}</p>
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
        <div className="flex min-h-screen flex-col bg-[var(--background)] pb-24 text-[var(--foreground)]">
          <Header />
          <main className="max-w-6xl mx-auto flex w-full flex-1 items-center justify-center px-4 py-8">
            <div className="h-12 w-12 rounded-full border-2 border-[var(--border)] border-t-[var(--brand)] animate-spin dark:border-[var(--border)]" />
          </main>
          <BottomNav />
        </div>
      }
    >
      <SellPageContent />
    </Suspense>
  );
}
