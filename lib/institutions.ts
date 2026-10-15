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
  const normalized = (code || '').trim().toUpperCase();
  if (!normalized) return null;
  if (idCache.has(normalized)) return idCache.get(normalized) || null;

  // The UI uses MUKIRIA while older database rows may use MUKIRIA TTI.
  const lookupCodes = normalized === 'MUKIRIA' ? ['MUKIRIA', 'MUKIRIA TTI'] : [normalized];

  try {
    const { data, error } = await supabase.from('institutions').select('id, code').in('code', lookupCodes).limit(1).maybeSingle();
    if (error) {
      idCache.set(normalized, null);
      return null;
    }
    const id = data?.id ?? null;
    idCache.set(normalized, id);
    return id;
  } catch {
    idCache.set(normalized, null);
    return null;
  }
}
