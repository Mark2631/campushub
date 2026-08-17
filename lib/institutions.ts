import { getSupabase } from './supabase';

export interface Institution {
  id: string;
  name: string;
  short_name: string;
  slug: string;
  county: string;
  logo?: string | null;
  cover?: string | null;
  status: 'active' | 'coming_soon' | 'archived';
  launch_date?: string;
}

export const SEEDED_INSTITUTIONS: Institution[] = [
  {
    id: '11111111-1111-4111-a111-111111111111',
    name: 'Meru University of Science and Technology',
    short_name: 'MUST',
    slug: 'must',
    county: 'Meru',
    status: 'active',
  },
  {
    id: '22222222-2222-4222-a222-222222222222',
    name: 'The Meru National Polytechnic',
    short_name: 'Meru Poly',
    slug: 'meru-poly',
    county: 'Meru',
    status: 'coming_soon',
  },
  {
    id: '33333333-3333-4333-a333-333333333333',
    name: 'Mukiria Technical Training Institute',
    short_name: 'Mukiria TTI',
    slug: 'mukiria-tti',
    county: 'Meru',
    status: 'coming_soon',
  },
  {
    id: '44444444-4444-4444-a444-444444444444',
    name: 'Mitunguu Technical Training Institute',
    short_name: 'Mitunguu TTI',
    slug: 'mitunguu-tti',
    county: 'Meru',
    status: 'coming_soon',
  },
  {
    id: '55555555-5555-4555-a555-555555555555',
    name: 'Karumo Technical Training Institute',
    short_name: 'Karumo TTI',
    slug: 'karumo-tti',
    county: 'Meru',
    status: 'coming_soon',
  },
  {
    id: '66666666-6666-4666-a666-666666666666',
    name: 'Mount Kenya University Meru Campus',
    short_name: 'MKU Meru',
    slug: 'mku-meru',
    county: 'Meru',
    status: 'coming_soon',
  },
  {
    id: '77777777-7777-4777-a777-777777777777',
    name: 'Kenya Methodist University Meru Centre',
    short_name: 'KeMU Meru',
    slug: 'kemu-meru',
    county: 'Meru',
    status: 'coming_soon',
  },
];

export async function fetchInstitutions(): Promise<Institution[]> {
  const supabase = getSupabase();
  if (!supabase) return SEEDED_INSTITUTIONS;

  try {
    const { data, error } = await supabase
      .from('institutions')
      .select('*')
      .eq('status', 'active')
      .order('name');

    if (error || !data || data.length === 0) {
      return SEEDED_INSTITUTIONS;
    }

    return data as Institution[];
  } catch (err) {
    console.error('Failed to fetch institutions:', err);
    return SEEDED_INSTITUTIONS;
  }
}

export function getStoredInstitution(): Institution | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('campustrader_selected_institution');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredInstitution(inst: Institution) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('campustrader_selected_institution', JSON.stringify(inst));
}
