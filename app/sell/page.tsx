'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import BottomNav from '../../components/BottomNav';
import Header from '../../components/Header';
import useUser from '../../hooks/useUser';
import { getListingById, insertListing, updateListing, uploadListingMedia } from '../../lib/listings';

const categories = ['Electronics', 'Fashion', 'Furniture', 'Books', 'Food', 'Services', 'Refurbished', 'Other'];
const conditions = ['New', 'Like New', 'Good', 'Fair'];
const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const videoTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
const maxImageSize = 5 * 1024 * 1024;
const maxVideoSize = 30 * 1024 * 1024;

type SelectedMedia = {
  file: File;
  previewUrl: string;
};

function SellPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, pushNotification, profileContext } = useUser();
  const editListingId = searchParams.get('edit');
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

  const hasPreviewContent = images.length > 0 || Boolean(videoPreview) || Boolean(formData.title.trim());

  useEffect(() => {
    const loadEditListing = async () => {
      if (!editListingId || !user) return;
      setLoadingEdit(true);
      const { listing, error } = await getListingById(editListingId);
      setLoadingEdit(false);

      if (error) {
        setMessage({ type: 'error', text: error });
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
        condition: listing.condition,
        description: listing.description || '',
        location: listing.location || '',
      });
      setCreatedListingId(listing.id);
      setExistingMediaUrls(listing.media_urls || []);
      setExistingVideoUrl(listing.video_url || null);
    };

    void loadEditListing();
  }, [editListingId, user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files) {
      const validImages: SelectedMedia[] = [];
      const errors: string[] = [];

      Array.from(files).forEach((file) => {
        if (!imageTypes.includes(file.type)) {
          errors.push(`${file.name} must be JPG, PNG, or WebP.`);
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
      }

      setImages((prev) => [...prev, ...validImages].slice(0, 10));
      e.currentTarget.value = '';
    }
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (file) {
      if (!videoTypes.includes(file.type)) {
        setMessage({ type: 'error', text: `${file.name} must be MP4, WebM, or MOV.` });
        return;
      }

      if (file.size > maxVideoSize) {
        setMessage({ type: 'error', text: `${file.name} must be 30MB or smaller.` });
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

  const createListing = async (options?: { skipMedia?: boolean }) => {
    if (!user) {
      throw new Error('Sign in to post a listing.');
    }

    setUploadStatus(images.length || videoPreview ? 'Uploading media...' : 'Creating listing...');
    const mediaUrls: string[] = options?.skipMedia ? [] : [...existingMediaUrls];
    let videoUrl: string | null = options?.skipMedia ? null : existingVideoUrl;

    if (!options?.skipMedia) {
      for (const image of images) {
        const { publicUrl, error } = await uploadListingMedia('listing-media', user.id, image.file);
        if (error || !publicUrl) {
          throw new Error(error || 'Image upload failed.');
        }
        mediaUrls.push(publicUrl);
      }

      if (videoPreview) {
        const { publicUrl, error } = await uploadListingMedia('listing-media', user.id, videoPreview.file);
        if (error || !publicUrl) {
          throw new Error(error || 'Video upload failed.');
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
      condition: formData.condition,
      description: formData.description,
      location: formData.location,
      businessId: profileContext.mode === 'business' ? profileContext.businessId : null,
      mediaUrls,
      videoUrl,
    };

    if (editListingId) {
      return updateListing(editListingId, user.id, listingPayload);
    }

    return insertListing(user.id, listingPayload);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (isSubmitting) {
      return;
    }

    if (!user) {
      setMessage({ type: 'error', text: 'Please sign in to post a listing.' });
      return;
    }

    if (!formData.title.trim()) {
      setMessage({ type: 'error', text: 'Title is required.' });
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage(null);
      setCreatedListingId(null);
      setPostWithoutMediaReady(false);

      const { listing, error } = await createListing();

      if (error) {
        setMessage({ type: 'error', text: error });
        return;
      }

      setCreatedListingId(listing?.id || null);
      setMessage({ type: 'success', text: editListingId ? 'Listing updated successfully.' : 'Listing posted successfully.' });
      await pushNotification({
        type: 'listing',
        title: editListingId ? 'Listing updated' : 'Listing posted successfully',
        body: editListingId ? `${listing?.title || 'Your listing'} has been updated.` : `${listing?.title || 'Your listing'} is now live.`,
      });
      resetForm();
      window.dispatchEvent(new Event('campustrader:listings-refresh'));
      router.refresh();
      if (editListingId) {
        router.replace('/profile#my-listings');
      }
    } catch (error) {
      console.error('Listing post failed:', JSON.stringify(error, null, 2));
      const text = error instanceof Error ? error.message : String(error);
      setMessage({ type: 'error', text });
      if ((images.length > 0 || videoPreview) && /upload|policy|row-level|timed out|storage/i.test(text)) {
        setPostWithoutMediaReady(true);
      }
    } finally {
      setIsSubmitting(false);
      setUploadStatus('');
    }
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
            <h2 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white">Sign in to post a listing</h2>
            <p className="text-gray-600 dark:text-zinc-400 mb-6">Sign in to post a listing.</p>
            <Link href="/signin" className="inline-block rounded-2xl bg-blue-600 dark:bg-blue-600 hover:bg-blue-700 px-6 py-3 font-semibold text-white transition">
              Sign In
            </Link>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:bg-gradient-to-br dark:from-black dark:to-zinc-950 text-gray-900 dark:text-white pb-24">
      <Header />
      <main className="max-w-6xl mx-auto w-full px-4 py-6 sm:py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold">{editListingId ? 'Edit listing' : 'Sell an item or service'}</h1>
          <p className="text-sm text-gray-600 dark:text-zinc-400 mt-2">Post an item, service, food offer, or refurbished product.</p>
          <p className="mt-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
            Posting as: {profileContext.mode === 'business' ? profileContext.businessName : 'Personal profile'}
          </p>
        </header>
        {loadingEdit ? <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">Loading listing details...</div> : null}

        {message && (
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
              </div>
            )}
            {message.type === 'error' && postWithoutMediaReady ? (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      setIsSubmitting(true);
                      setMessage(null);
                      const { listing, error } = await createListing({ skipMedia: true });
                      if (error) {
                        setMessage({ type: 'error', text: error });
                        return;
                      }
                      setCreatedListingId(listing?.id || null);
                      setMessage({ type: 'success', text: 'Listing posted successfully.' });
                      await pushNotification({
                        type: 'listing',
                        title: 'Listing posted successfully',
                        body: `${listing?.title || 'Your listing'} is now live without media.`,
                      });
                      resetForm();
                      window.dispatchEvent(new Event('campustrader:listings-refresh'));
                      router.refresh();
                    } catch (fallbackError) {
                      setMessage({ type: 'error', text: fallbackError instanceof Error ? fallbackError.message : String(fallbackError) });
                    } finally {
                      setIsSubmitting(false);
                      setUploadStatus('');
                    }
                  }}
                  className="rounded-2xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700"
                >
                  Post without media
                </button>
              </div>
            ) : null}
          </div>
        )}

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
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className="mb-3 text-3xl sm:text-4xl">📷</div>
              <p className="font-medium text-gray-900 dark:text-white">Click to upload images</p>
              <p className="text-sm text-gray-600 dark:text-zinc-400">or drag and drop</p>
              <p className="text-xs text-gray-500 dark:text-zinc-500 mt-2">PNG, JPG,WebP up to 10 images</p>
            </label>

            {/* Image Previews */}
            {images.length > 0 && (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {images.map((image, index) => (
                  <div key={index} className="relative rounded-lg overflow-hidden bg-gray-200 dark:bg-zinc-800">
                    <img src={image.previewUrl} alt={`Preview ${index + 1}`} className="w-full h-20 object-cover" />
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
            <p className="text-xs text-gray-600 dark:text-zinc-400 mt-2">{images.length}/10 images uploaded</p>
          </div>

          {/* Single Video Upload */}
          <div>
            <label className="block space-y-2 text-sm">
              <span className="font-medium text-gray-900 dark:text-white">Optional: Add a video (max 1)</span>
              <div className="relative block rounded-2xl border-2 border-dashed border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-950 p-6 text-center cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition">
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleVideoUpload}
                  disabled={!!videoPreview}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              <div className="mb-2 text-2xl sm:text-3xl">🎥</div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{videoPreview ? videoPreview.file.name : 'Click to upload video'}</p>
                <p className="text-xs text-gray-600 dark:text-zinc-400">MP4, WebM up to 100MB</p>
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
              <span className="font-medium text-gray-900 dark:text-white">Price (KSh)</span>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleChange}
                placeholder="0"
                step="1"
                className="w-full rounded-2xl bg-white dark:bg-zinc-950 border border-gray-300 dark:border-zinc-800 px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
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
                    {condition}
                  </option>
                ))}
              </select>
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
                  <div className="flex h-48 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-sky-500 to-emerald-500 text-center text-white">
                    {images[0] ? (
                      <img src={images[0].previewUrl} alt="Listing preview" className="h-full w-full object-cover" />
                    ) : (
                      <div className="px-6">
                        <p className="text-xs font-black uppercase tracking-[0.24em]">{formData.category}</p>
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
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 dark:bg-zinc-800 dark:text-zinc-300">{formData.condition}</span>
                    {formData.negotiable ? <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">Negotiable</span> : null}
                  </div>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formData.price ? `KSh ${Number(formData.price).toLocaleString()}` : 'Add price'}</p>
                  <p className="text-sm leading-6 text-gray-600 dark:text-zinc-400">{formData.description || 'Add a short description so buyers know what you are offering.'}</p>
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
            {isSubmitting ? uploadStatus || 'Posting...' : 'Post Listing'}
          </button>
        </form>
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
