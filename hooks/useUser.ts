'use client';

import { useAppContext } from '../components/AppProvider';

export default function useUser() {
  const {
    user,
    session,
    loading,
    isAdmin,
    adminLoading,
    refreshSession,
    notifications,
    unreadNotifications,
    pushNotification,
    markAllNotificationsRead,
    profileContext,
    setProfileContext,
  } = useAppContext();

  return {
    user,
    session,
    loading,
    isAdmin,
    adminLoading,
    refreshSession,
    notifications,
    unreadNotifications,
    pushNotification,
    markAllNotificationsRead,
    profileContext,
    setProfileContext,
  };
}
