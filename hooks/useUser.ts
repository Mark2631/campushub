'use client';

import { useAppContext } from '../components/AppProvider';

export default function useUser() {
  const { user, session, loading, isAdmin, adminLoading, refreshSession } = useAppContext();
  return { user, session, loading, isAdmin, adminLoading, refreshSession };
}
