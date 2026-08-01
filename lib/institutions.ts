import { supabase } from './supabase';
import { GENERIC_ERROR, isValidUuid } from './validation';

export type InstitutionStatus = 'active' | 'coming_soon' | 'disabled';

export type Institution = {
  id: string;
  name: string;
  short_name: string;
  slug: string;
  county: string;
  logo: string | null;
  cover: string | null;
  status: InstitutionStatus;
  launch_date: string | null;
};

export async function getInstitutions() {
  const { data, error } = await supabase
    .from('institutions')
    .select('id, name, short_name, slug, county, logo, cover, status, launch_date')
    .in('status', ['active', 'coming_soon'])
    .order('status', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.error('Institution fetch failed:', error);
    return { institutions: [] as Institution[], error: GENERIC_ERROR };
  }

  return { institutions: (data || []) as Institution[], error: null };
}

export async function getActiveInstitutionById(institutionId: string) {
  if (!isValidUuid(institutionId)) return { institution: null as Institution | null, error: GENERIC_ERROR };

  const { data, error } = await supabase
    .from('institutions')
    .select('id, name, short_name, slug, county, logo, cover, status, launch_date')
    .eq('id', institutionId)
    .eq('status', 'active')
    .maybeSingle();

  if (error) {
    console.error('Institution lookup failed:', error);
    return { institution: null as Institution | null, error: GENERIC_ERROR };
  }

  return { institution: (data || null) as Institution | null, error: null };
}

export async function saveUserInstitution(userId: string, institutionId: string) {
  if (!isValidUuid(userId) || !isValidUuid(institutionId)) {
    return { profile: null, error: GENERIC_ERROR };
  }

  const { institution, error: institutionError } = await getActiveInstitutionById(institutionId);
  if (institutionError || !institution) {
    return { profile: null, error: 'Choose an active institution.' };
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ institution_id: institution.id, campus: institution.short_name })
    .eq('id', userId)
    .select('*')
    .single();

  if (error) {
    console.error('Institution save failed:', error);
    return { profile: null, error: GENERIC_ERROR };
  }

  return { profile: data, error: null };
}
