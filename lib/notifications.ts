import { supabase } from './supabase';
import { isValidUuid } from './validation';

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  created_at: string;
};

function serializeError(error: unknown) {
  return JSON.stringify(error, Object.getOwnPropertyNames(error || {}), 2);
}

export async function createNotificationRecord(data: {
  userId: string;
  type: string;
  title: string;
  body: string;
}) {
  if (!isValidUuid(data.userId)) {
    return { notification: null, error: null };
  }

  const payload = {
    user_id: data.userId,
    type: data.type,
    title: data.title,
    body: data.body,
    read: false,
  };

  const { data: notification, error } = await supabase
    .from('notifications')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    console.error('Notification insert failed:', serializeError(error), payload);
    return { notification: null, error: error.message };
  }

  return { notification: notification as AppNotification, error: null };
}

export async function getUserNotifications(userId: string) {
  if (!isValidUuid(userId)) {
    return { notifications: [] as AppNotification[], error: null };
  }

  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, title, body, read, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Notification fetch failed:', serializeError(error));
    return { notifications: [] as AppNotification[], error: error.message };
  }

  return { notifications: (data || []) as AppNotification[], error: null };
}

export async function markNotificationRead(notificationId: string) {
  if (!isValidUuid(notificationId)) {
    return { error: null };
  }

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);

  if (error) {
    console.error('Mark notification read failed:', serializeError(error));
    return { error: error.message };
  }

  return { error: null };
}

export async function deleteNotificationRecord(notificationId: string) {
  if (!isValidUuid(notificationId)) {
    return { error: null };
  }

  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId);

  if (error) {
    console.error('Delete notification failed:', serializeError(error));
    return { error: error.message };
  }

  return { error: null };
}

export async function clearUserNotifications(userId: string) {
  if (!isValidUuid(userId)) {
    return { error: null };
  }

  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('user_id', userId);

  if (error) {
    console.error('Clear notifications failed:', serializeError(error));
    return { error: error.message };
  }

  return { error: null };
}
