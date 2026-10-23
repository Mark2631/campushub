import { supabase } from './supabase';
import { UPLOAD_ERROR, isValidUuid } from './validation';

export const storageBuckets = {
  listingMedia: 'listing-media',
  profileMedia: 'profile-media',
  verificationMedia: 'verification-media',
  communityMedia: 'community-media',
} as const;

export type StorageBucket = (typeof storageBuckets)[keyof typeof storageBuckets];

const imageExtensions = ['jpg', 'jpeg', 'png', 'webp'];
const videoExtensions = ['mp4', 'webm', 'mov'];
const documentExtensions = [...imageExtensions, 'pdf'];

const imageMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const videoMimeTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/mov'];
const documentMimeTypes = [...imageMimeTypes, 'application/pdf'];

type FileKind = 'image' | 'video' | 'verification-document';

type UploadOptions = {
  timeoutMs?: number;
  upsert?: boolean;
  path?: string;
};

const maxSizes: Record<FileKind, number> = {
  image: 5 * 1024 * 1024,
  video: 20 * 1024 * 1024,
  'verification-document': 8 * 1024 * 1024,
};

export function safeFileName(fileName: string) {
  const cleaned = fileName.trim().replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-');
  return cleaned || 'upload';
}

export function getStoragePath(userId: string, file: File) {
  return `${userId}/${Date.now()}-${safeFileName(file.name)}`;
}

function fileExtension(file: File) {
  return file.name.split('.').pop()?.toLowerCase() || '';
}

function allowedForKind(kind: FileKind) {
  if (kind === 'image') {
    return { extensions: imageExtensions, mimeTypes: imageMimeTypes, label: 'JPG, JPEG, PNG, or WebP' };
  }

  if (kind === 'video') {
    return { extensions: videoExtensions, mimeTypes: videoMimeTypes, label: 'MP4, WebM, or MOV' };
  }

  return { extensions: documentExtensions, mimeTypes: documentMimeTypes, label: 'JPG, JPEG, PNG, WebP, or PDF' };
}

export function validateUploadFile(file: File, kind: FileKind, maxSize = maxSizes[kind]) {
  const allowed = allowedForKind(kind);
  const extension = fileExtension(file);
  const hasAllowedExtension = allowed.extensions.includes(extension);
  const hasAllowedMimeType = file.type ? allowed.mimeTypes.includes(file.type) : hasAllowedExtension;

  if (!hasAllowedExtension || !hasAllowedMimeType) {
    return `${file.name} must be ${allowed.label}.`;
  }

  if (file.size > maxSize) {
    const sizeMb = Math.floor(maxSize / (1024 * 1024));
    return `${file.name} must be ${sizeMb}MB or smaller.`;
  }

  return null;
}

export function withTimeout<T>(promise: PromiseLike<T>, ms: number, message: string) {
  return Promise.race<T>([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => {
      globalThis.setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

export async function compressImageFile(file: File, maxDimension = 1600) {
  if (typeof window === 'undefined' || !file.type.startsWith('image/')) return file;

  const imageUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not read image for compression.'));
      img.src = imageUrl;
    });

    const largestDimension = Math.max(image.width, image.height);
    const scale = Math.min(1, maxDimension / largestDimension);
    // Small files can still have very large pixel dimensions, so dimension limits
    // are checked before deciding to skip compression.
    if (scale === 1 && file.size < 750 * 1024) return file;

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not prepare the image canvas.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    // Preserve PNG/WebP formats (and possible transparency) rather than silently
    // converting those files to JPEG.
    const outputType = file.type === 'image/png'
      ? 'image/png'
      : file.type === 'image/webp'
        ? 'image/webp'
        : 'image/jpeg';
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, outputType, 0.82));
    if (!blob) throw new Error('Could not compress the image.');
    if (scale === 1 && blob.size >= file.size) return file;

    return new File([blob], file.name, { type: blob.type || file.type, lastModified: Date.now() });
  } catch (error) {
    console.error('Image compression failed:', error);
    // Do not silently upload an unprocessed oversized image if resizing fails.
    throw new Error('This image could not be prepared for upload. Choose another image and try again.');
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function formatStorageError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    return String((error as { message?: unknown }).message || 'Upload failed.');
  }
  return String(error || 'Upload failed.');
}

export async function uploadPublicFile(bucket: StorageBucket, userId: string, file: File, options: UploadOptions = {}) {
  if (!isValidUuid(userId)) {
    return { publicUrl: null, path: '', error: UPLOAD_ERROR };
  }

  const path = options.path || getStoragePath(userId, file);

  try {
    const uploadResponse = await withTimeout(
      supabase.storage.from(bucket).upload(path, file, {
        cacheControl: '3600',
        upsert: options.upsert ?? false,
      }),
      options.timeoutMs ?? 25000,
      'Upload timed out. Please try again.'
    );

    if (uploadResponse.error) {
      console.error('Storage upload failed:', uploadResponse.error, { bucket, path, fileName: file.name });
      return { publicUrl: null, path, error: UPLOAD_ERROR };
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return { publicUrl: data.publicUrl, path, error: null };
  } catch (error) {
    console.error('Storage upload failed:', error, { bucket, path, fileName: file.name });
    void formatStorageError(error);
    return { publicUrl: null, path, error: UPLOAD_ERROR };
  }
}
