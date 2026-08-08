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
  const normalized = (code || '').toString();
  if (!normalized) return null;
  if (idCache.has(normalized)) return idCache.get(normalized) || null;

  try {
    const { data, error } = await supabase.from('institutions').select('id').eq('code', normalized).maybeSingle();
    if (error) {
      idCache.set(normalized, null);
      return null;
    }
    const id = data?.id ?? null;
    idCache.set(normalized, id);
    return id;
  } catch (err) {
    idCache.set(normalized, null);
    return null;
  }
}
