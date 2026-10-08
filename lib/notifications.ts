import { supabase } from './supabase';
import { GENERIC_ERROR, isValidUuid } from './validation';

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

  try {
    const { data: result, error } = await supabase.rpc('create_self_notification', {
      p_type: data.type,
      p_title: data.title,
      p_body: data.body,
    });

    if (error) {
      console.error('Self-notification RPC failed:', serializeError(error));
      return { notification: null, error: GENERIC_ERROR };
    }

    const notification = Array.isArray(result) ? result[0] : result;
    if (!notification || typeof notification !== 'object' || !('id' in notification)) {
      return { notification: null, error: null };
    }

    return { notification: notification as AppNotification, error: null };
  } catch (error) {
    console.error('Self-notification RPC failed:', serializeError(error));
    return { notification: null, error: GENERIC_ERROR };
  }
}

export async function createMessageNotificationRecord(messageId: string) {
  if (!isValidUuid(messageId)) return { error: null };

  try {
    const { error } = await supabase.rpc('notify_conversation_message', {
      p_message_id: messageId,
    });
    if (error) {
      console.error('Message notification RPC failed:', serializeError(error));
      return { error: GENERIC_ERROR };
    }

    return { error: null };
  } catch (error) {
    console.error('Message notification RPC failed:', serializeError(error));
    return { error: GENERIC_ERROR };
  }
}

export async function createAdminNotificationRecord(data: {
  userId: string;
  type: string;
  title: string;
  body: string;
}) {
  if (!isValidUuid(data.userId)) return { error: null };

  try {
    const { error } = await supabase.rpc('admin_create_notification', {
      p_user_id: data.userId,
      p_type: data.type,
      p_title: data.title,
      p_body: data.body,
    });
    if (error) {
      console.error('Admin notification RPC failed:', serializeError(error));
      return { error: GENERIC_ERROR };
    }

    return { error: null };
  } catch (error) {
    console.error('Admin notification RPC failed:', serializeError(error));
    return { error: GENERIC_ERROR };
  }
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
    return { notifications: [] as AppNotification[], error: GENERIC_ERROR };
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
    return { error: GENERIC_ERROR };
  }

  return { error: null };
}

export async function deleteNotificationRecord(notificationId: string) {
  if (!isValidUuid(notificationId)) {
    return { error: null };
  }

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);

  if (error) {
    console.error('Notification archive failed:', serializeError(error));
    return { error: GENERIC_ERROR };
  }

  return { error: null };
}

export async function clearUserNotifications(userId: string) {
  if (!isValidUuid(userId)) {
    return { error: null };
  }

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId);

  if (error) {
    console.error('Clear notifications failed:', serializeError(error));
    return { error: GENERIC_ERROR };
  }

  return { error: null };
}
