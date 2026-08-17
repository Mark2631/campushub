'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { ensureProfile } from '../lib/profiles';
import { checkIsAdmin, autoVerifyAdminProfile } from '../lib/admins';
import {
  AppNotification,
  clearUserNotifications,
  createNotificationRecord,
  deleteNotificationRecord,
  getUserNotifications,
  markNotificationRead,
} from '../lib/notifications';
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
  deleteNotification: (notificationId: string) => Promise<void>;
  clearNotifications: () => Promise<void>;
  showToast: (toast: { type?: 'success' | 'error' | 'warning' | 'info'; message: string }) => void;
  profileContext: ProfileContext;
  setProfileContext: (context: ProfileContext) => void;
};

type Toast = {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
};

const AppContext = createContext<AppContextValue | null>(null);
const syncedProfileIds = new Set<string>();
const loggedProfileErrors = new Set<string>();
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function withAuthTimeout<T>(promise: PromiseLike<T>, fallback: T, label: string) {
  let timer: number | undefined;

  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<T>((resolve) => {
        timer = window.setTimeout(() => {
          console.error(`${label} timed out.`);
          resolve(fallback);
        }, 3000);
      }),
    ]);
  } finally {
    if (timer) window.clearTimeout(timer);
  }
}

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
  const [toasts, setToasts] = useState<Toast[]>([]);
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
        // Read auth callback tokens from hash fragment (security: hash is never sent to server)
        const hashString = window.location.hash.slice(1); // Remove leading '#'
        const hashParams = new URLSearchParams(hashString);
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const authType = hashParams.get('type');

        if (authType === 'auth_callback' && accessToken && refreshToken) {
          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            console.error('Auth callback session error:', sessionError);
          }

          // Clean the hash from the URL
          const cleanUrl = `${window.location.origin}${window.location.pathname}${window.location.search}`;
          window.history.replaceState({}, '', cleanUrl);

          if (sessionData.session && isMounted) {
            setSession(sessionData.session);
            setLoading(false);
            await Promise.all([syncProfile(sessionData.session.user), syncAdmin(sessionData.session.user), syncNotifications(sessionData.session.user)]);
            return;
          }
        }
      }

      const { data, error } = await withAuthTimeout(
        supabase.auth.getSession(),
        { data: { session: null }, error: null },
        'Auth session check'
      );
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
    const { data, error } = await withAuthTimeout(
      supabase.auth.getSession(),
      { data: { session: null }, error: null },
      'Auth session refresh'
    );
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

  const deleteNotification = useCallback(async (notificationId: string) => {
    setNotifications((current) => current.filter((notification) => notification.id !== notificationId));
    if (uuidPattern.test(notificationId)) {
      await deleteNotificationRecord(notificationId);
    }
  }, []);

  const clearNotifications = useCallback(async () => {
    setNotifications([]);
    if (session?.user?.id) {
      await clearUserNotifications(session.user.id);
    }
  }, [session]);

  const showToast = useCallback((toast: { type?: Toast['type']; message: string }) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((current) => [...current, { id, type: toast.type || 'info', message: toast.message }].slice(-4));
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4500);
  }, []);

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
      deleteNotification,
      clearNotifications,
      showToast,
      profileContext,
      setProfileContext,
    }),
    [adminLoading, clearNotifications, deleteNotification, isAdmin, loading, markAllNotificationsRead, notifications, profileContext, pushNotification, session, showToast, theme]
  );

  return (
    <AppContext.Provider value={value}>
      {children}
      <div className="fixed inset-x-3 bottom-24 z-[80] space-y-2 sm:bottom-auto sm:left-auto sm:right-4 sm:top-4 sm:w-96">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-2xl border px-4 py-3 text-sm font-semibold shadow-2xl ${
              toast.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100'
                : toast.type === 'error'
                  ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-100'
                  : toast.type === 'warning'
                    ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100'
                    : 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used inside AppProvider');
  }
  return context;
}
