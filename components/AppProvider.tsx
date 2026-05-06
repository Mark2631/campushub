'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { ensureProfile } from '../lib/profiles';
import { checkIsAdmin } from '../lib/admins';

type Theme = 'dark' | 'light';

type AppContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  adminLoading: boolean;
  theme: Theme;
  toggleTheme: () => void;
  refreshSession: () => Promise<Session | null>;
};

const AppContext = createContext<AppContextValue | null>(null);
const syncedProfileIds = new Set<string>();
const loggedProfileErrors = new Set<string>();

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark';
    return window.localStorage.getItem('campustrader-theme') === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    let isMounted = true;

    const syncProfile = async (userToSync: User | null) => {
      if (!userToSync || syncedProfileIds.has(userToSync.id)) return;
      syncedProfileIds.add(userToSync.id);
      const { error } = await ensureProfile(userToSync);
      if (error && !loggedProfileErrors.has(error)) {
        loggedProfileErrors.add(error);
        console.error('Profile sync error:', error);
      }
    };

    const syncAdmin = async (userToSync: User | null) => {
      if (!userToSync?.email) {
        setIsAdmin(false);
        setAdminLoading(false);
        return;
      }

      setAdminLoading(true);
      const { isAdmin: nextIsAdmin, error } = await checkIsAdmin(userToSync.email);
      if (error) {
        console.error('Admin sync error:', error);
      }
      if (isMounted) {
        setIsAdmin(nextIsAdmin);
        setAdminLoading(false);
      }
    };

    const initAuth = async () => {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const authCallback = params.get('auth_callback');

        if (authCallback === 'success' && accessToken && refreshToken) {
          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            console.error('Auth callback session error:', sessionError);
          }

          const cleanUrl = `${window.location.origin}${window.location.pathname}`;
          window.history.replaceState({}, '', cleanUrl);

          if (sessionData.session && isMounted) {
            setSession(sessionData.session);
            setLoading(false);
            await Promise.all([
              syncProfile(sessionData.session.user),
              syncAdmin(sessionData.session.user),
            ]);
            return;
          }
        }
      }

      const { data, error } = await supabase.auth.getSession();
      if (!isMounted) return;

      if (error) {
        console.error('Auth session error:', error);
      }

      setSession(data.session ?? null);
      setLoading(false);
      await Promise.all([syncProfile(data.session?.user ?? null), syncAdmin(data.session?.user ?? null)]);
    };

    initAuth();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
      void syncProfile(nextSession?.user ?? null);
      void syncAdmin(nextSession?.user ?? null);
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const refreshSession = async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Auth session refresh error:', error);
    }

    const nextSession = data.session ?? null;
    setSession(nextSession);
    setLoading(false);
    return nextSession;
  };

  const toggleTheme = () => {
    setTheme((current) => {
      const nextTheme = current === 'dark' ? 'light' : 'dark';
      window.localStorage.setItem('campustrader-theme', nextTheme);
      document.documentElement.classList.toggle('dark', nextTheme === 'dark');
      return nextTheme;
    });
  };

  const value = useMemo<AppContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      isAdmin,
      adminLoading,
      theme,
      toggleTheme,
      refreshSession,
    }),
    [adminLoading, isAdmin, loading, session, theme]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used inside AppProvider');
  }
  return context;
}
