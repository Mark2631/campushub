import { supabase } from './supabase';

export const storageBuckets = {
  listingMedia: 'listing-media',
  profileMedia: 'profile-media',
  verificationMedia: 'verification-media',
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

export function validateUploadFile(file: File, kind: FileKind) {
  const allowed = allowedForKind(kind);
  const extension = fileExtension(file);
  const hasAllowedExtension = allowed.extensions.includes(extension);
  const hasAllowedMimeType = file.type ? allowed.mimeTypes.includes(file.type) : hasAllowedExtension;

  if (!hasAllowedExtension || !hasAllowedMimeType) {
    return `${file.name} must be ${allowed.label}.`;
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

function formatStorageError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    return String((error as { message?: unknown }).message || 'Upload failed.');
  }
  return String(error || 'Upload failed.');
}

export async function uploadPublicFile(bucket: StorageBucket, userId: string, file: File, options: UploadOptions = {}) {
  const path = getStoragePath(userId, file);

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
      return { publicUrl: null, path, error: uploadResponse.error.message };
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return { publicUrl: data.publicUrl, path, error: null };
  } catch (error) {
    console.error('Storage upload failed:', error, { bucket, path, fileName: file.name });
    return { publicUrl: null, path, error: formatStorageError(error) };
  }
}
