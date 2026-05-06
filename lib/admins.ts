import { supabase } from './supabase';

export async function checkIsAdmin(email: string) {
  const normalizedEmail = email.toLowerCase();
  const { data, error } = await supabase
    .from('admins')
    .select('id, email, created_at')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (error) {
    console.error('Error checking admin access:', error);
    return { isAdmin: normalizedEmail === 'mwanginewton107@gmail.com', error: error.message };
  }

  return { isAdmin: Boolean(data) || normalizedEmail === 'mwanginewton107@gmail.com', error: null };
}
