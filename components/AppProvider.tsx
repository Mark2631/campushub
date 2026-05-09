'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { ensureProfile } from '../lib/profiles';
import { checkIsAdmin, autoVerifyAdminProfile } from '../lib/admins';
import { AppNotification, createNotificationRecord, getUserNotifications, markNotificationRead } from '../lib/notifications';
import { ProfileContext, personalProfileContext, readStoredProfileContext, storeProfileContext } from '../lib/profileContext';

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
  notifications: AppNotification[];
  unreadNotifications: number;
  pushNotification: (notification: { title: string; body: string; type: string }) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  profileContext: ProfileContext;
  setProfileContext: (context: ProfileContext) => void;
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
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [profileContext, setProfileContextState] = useState<ProfileContext>(() => {
    if (typeof window === 'undefined') return personalProfileContext;
    return readStoredProfileContext();
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    storeProfileContext(profileContext);
  }, [profileContext]);

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

      // Auto-verify admin profile on login
      if (nextIsAdmin && userToSync.id) {
        const { error: verifyError } = await autoVerifyAdminProfile(userToSync.id, userToSync.email);
        if (verifyError) {
          console.error('Admin profile auto-verify error:', verifyError);
        }
      }

      if (isMounted) {
        setIsAdmin(nextIsAdmin);
        setAdminLoading(false);
      }
    };

    const syncNotifications = async (userToSync: User | null) => {
      if (!userToSync) {
        setNotifications([]);
        return;
      }

      const { notifications: nextNotifications } = await getUserNotifications(userToSync.id);
      if (isMounted) {
        setNotifications(nextNotifications);
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
            await Promise.all([syncProfile(sessionData.session.user), syncAdmin(sessionData.session.user), syncNotifications(sessionData.session.user)]);
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
      await Promise.all([
        syncProfile(data.session?.user ?? null),
        syncAdmin(data.session?.user ?? null),
        syncNotifications(data.session?.user ?? null),
      ]);
    };

    initAuth();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
      void syncProfile(nextSession?.user ?? null);
      void syncAdmin(nextSession?.user ?? null);
      void syncNotifications(nextSession?.user ?? null);
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

  const pushNotification = useCallback(async (notification: { title: string; body: string; type: string }) => {
    const localNotification: AppNotification = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: notification.title,
      body: notification.body,
      type: notification.type,
      read: false,
      created_at: new Date().toISOString(),
    };

    setNotifications((current) => [localNotification, ...current].slice(0, 20));

    if (!session?.user?.id) return;

    const { notification: created } = await createNotificationRecord({
      userId: session.user.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
    });

    if (created) {
      setNotifications((current) => [created, ...current.filter((item) => item.id !== localNotification.id)].slice(0, 20));
    }
  }, [session]);

  const markAllNotificationsRead = useCallback(async () => {
    const unread = notifications.filter((notification) => !notification.read);
    setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
    await Promise.all(unread.map((notification) => markNotificationRead(notification.id)));
  }, [notifications]);

  const setProfileContext = (context: ProfileContext) => {
    setProfileContextState(context);
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
      notifications,
      unreadNotifications: notifications.filter((notification) => !notification.read).length,
      pushNotification,
      markAllNotificationsRead,
      profileContext,
      setProfileContext,
    }),
    [adminLoading, isAdmin, loading, markAllNotificationsRead, notifications, profileContext, pushNotification, session, theme]
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
