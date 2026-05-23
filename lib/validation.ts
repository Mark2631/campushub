export function isValidUuid(value: unknown): boolean {
  if (typeof value !== 'string') return false;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
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
