import { supabase } from './supabase';

const idCache = new Map<string, string | null>();

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
  if (idCache.has(normalized)) return idCache.get(normalized) || null;

  try {
    // Use the same canonical resolver as the auth-user trigger so aliases and
    // institution codes resolve consistently during sign-up and marketplace writes.
    const { data: resolvedId, error: resolveError } = await supabase.rpc('resolve_institution_code', {
      p_code: normalized,
    });

    if (!resolveError && typeof resolvedId === 'string' && resolvedId.length > 0) {
      idCache.set(normalized, resolvedId);
      return resolvedId;
    }

    // Keep a direct lookup as a compatibility fallback for environments where
    // the resolver RPC has not yet been installed.
    const { data, error } = await supabase
      .from('institutions')
      .select('id')
      .ilike('code', normalized)
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
}
