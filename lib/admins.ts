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
    return { isAdmin: false, error: 'Something went wrong. Try again.' };
  }

  return { isAdmin: Boolean(data), error: null };
}

export async function autoVerifyAdminProfile(userId: string, email: string) {
  const normalizedEmail = email.toLowerCase();
  const { isAdmin } = await checkIsAdmin(normalizedEmail);

  if (!isAdmin) {
    return { error: null };
  }

  // Update profile to set admin status
  const { error } = await supabase
    .from('profiles')
    .update({
      verification_status: 'verified',
      badge_type: 'admin',
      role: 'admin',
      account_status: 'active',
    })
    .eq('id', userId);

  if (error) {
    console.error('Error auto-verifying admin profile:', error);
    return { error: 'Something went wrong. Try again.' };
  }

  return { error: null };
}
