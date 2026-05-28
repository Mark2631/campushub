import { STANDARD_CATEGORIES, normalizeCategory } from './categories';

export const DEFAULT_CAMPUS = 'MUST';
export const GENERIC_ERROR = 'Something went wrong. Try again.';
export const UPLOAD_ERROR = 'Upload failed. Please retry.';
export const PERMISSION_ERROR = 'You do not have permission to do that.';

export const allowedListingStatuses = ['active', 'sold', 'hidden', 'reported'] as const;
export const allowedListingConditions = ['new', 'used', 'refurbished', 'service'] as const;
export const allowedVerificationStatuses = ['unverified', 'pending', 'verified', 'rejected'] as const;
export const allowedRequestStatuses = ['open', 'closed', 'hidden'] as const;
export const allowedBusinessStatuses = ['active', 'suspended', 'terminated'] as const;
export const allowedCommunityStatuses = ['active', 'archived', 'hidden'] as const;
export const allowedCommunityMediaTypes = ['none', 'image', 'video', 'mixed'] as const;

type EnumValues<T extends readonly string[]> = T[number];

export function isValidUuid(value: unknown): boolean {
  if (typeof value !== 'string') return false;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value.trim());
}

export function cleanText(value: unknown, maxLength = 500) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

export function cleanMultilineText(value: unknown, maxLength = 1600) {
  return String(value ?? '').trim().replace(/\r\n/g, '\n').replace(/\n{4,}/g, '\n\n\n').slice(0, maxLength);
}

export function parseOptionalNumber(value: unknown) {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;

  const trimmed = String(value).trim();
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function isAllowedValue<T extends readonly string[]>(value: unknown, allowed: T): value is EnumValues<T> {
  return typeof value === 'string' && allowed.includes(value as EnumValues<T>);
}

export function normalizeAllowedCategory(value: unknown) {
  const normalized = normalizeCategory(String(value ?? ''));
  return STANDARD_CATEGORIES.includes(normalized as (typeof STANDARD_CATEGORIES)[number]) ? normalized : 'Other';
}

export function cleanErrorForUser(error?: unknown, fallback = GENERIC_ERROR) {
  if (!error) return fallback;
  if (typeof error === 'string' && [GENERIC_ERROR, UPLOAD_ERROR, PERMISSION_ERROR].includes(error)) return error;
  return fallback;
}

export function isMissingColumnError(error: unknown, table: string, column: string) {
  if (!error || typeof error !== 'object' || !('message' in error)) return false;
  const message = String((error as { message?: unknown }).message || '');
  return new RegExp(`column\\s+${table}\\.${column}\\s+does not exist`, 'i').test(message);
}

/**
 * Validate before querying Supabase by ID
 * Returns { valid: boolean, error?: string }
 */
export function validateQueryId(id: unknown, context?: string): { valid: boolean; error?: string } {
  if (!id) {
    return {
      valid: false,
      error: `Missing ID${context ? ` (${context})` : ''}`,
    };
  }

  if (typeof id !== 'string') {
    return {
      valid: false,
      error: `Invalid ID type${context ? ` (${context})` : ''}`,
    };
  }

  if (!isValidUuid(id)) {
    return {
      valid: false,
      error: `Invalid ID format${context ? ` (${context})` : ''}`,
    };
  }

  return { valid: true };
}

/**
 * Development logging for validation errors
 */
export function logValidationError(context: string, id: unknown) {
  if (typeof window === 'undefined' || process.env.NODE_ENV !== 'development') return;
  console.warn(`[CampusTrader] Validation error in ${context}:`, id);
}
