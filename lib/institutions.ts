import { supabase } from './supabase';

const idCache = new Map<string, string>();
const pendingIdLookups = new Map<string, Promise<string | null>>();

export async function getInstitutionByCode(code: string) {
  const normalized = (code || '').toString();
  try {
    const { data, error } = await supabase.from('institutions').select('id, code, name').eq('code', normalized).maybeSingle();
    if (error) return { institution: null, error };
    return { institution: data || null, error: null };
  } catch (err) {
    return { institution: null, error: err };
  }
}

export async function getInstitutionIdForCode(code: string) {
  const normalized = (code || '').trim();
  if (!normalized) return null;

  const cachedId = idCache.get(normalized);
  if (cachedId) return cachedId;

  // Coalesce concurrent feed/profile lookups so one cold page load does not
  // send duplicate resolver RPCs for the same institution.
  const pendingLookup = pendingIdLookups.get(normalized);
  if (pendingLookup) return pendingLookup;

  const lookup = (async (): Promise<string | null> => {
    try {
      // Use the same canonical resolver as the auth-user trigger so aliases and
      // institution codes resolve consistently during sign-up and marketplace writes.
      const { data: resolvedId, error: resolveError } = await supabase
        .rpc('resolve_institution_code', { p_code: normalized })
        .abortSignal(AbortSignal.timeout(2500));

      if (!resolveError && typeof resolvedId === 'string' && resolvedId.length > 0) {
        idCache.set(normalized, resolvedId);
        return resolvedId;
      }

      // Compatibility fallback for environments where the resolver RPC is not installed.
      const { data, error } = await supabase
        .from('institutions')
        .select('id')
        .ilike('code', normalized)
        .abortSignal(AbortSignal.timeout(2500))
        .maybeSingle();

      if (error) {
        console.error('Institution lookup failed:', error);
        return null;
      }

      const id = data?.id ?? null;
      if (id) idCache.set(normalized, id);
      return id;
    } catch (error) {
      console.error('Institution lookup failed:', error);
      return null;
    }
  })();

  pendingIdLookups.set(normalized, lookup);
  try {
    return await lookup;
  } finally {
    pendingIdLookups.delete(normalized);
  }
}

/**
 * Read the current user's tenant ID from their protected profile. This is the
 * authoritative source for writes; UI campus state can be stale on first load
 * or after a user changes devices.
 */
export async function getInstitutionIdForUser(userId: string) {
  if (!userId) return null;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('institution_id')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Could not resolve the account institution:', error);
      return null;
    }

    return typeof data?.institution_id === 'string' && data.institution_id
      ? data.institution_id
      : null;
  } catch (error) {
    console.error('Could not resolve the account institution:', error);
    return null;
  }
}
