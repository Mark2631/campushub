import { supabase } from './supabase';
import { safeFileName, storageBuckets, uploadPublicFile } from './storage';
import { isValidUuid } from './validation';

export type CommunityGroup = {
  id: string;
  name: string;
  description: string;
  available?: boolean;
};

export type CommunityMessage = {
  id: string;
  community_id: string;
  sender_id: string;
  content: string | null;
  media_urls: string[];
  created_at: string;
  sender?: {
    id: string;
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
  status?: 'sending' | 'sent' | 'failed';
};

export const defaultCommunityGroups: CommunityGroup[] = [
  { id: 'campus-deals', name: 'Campus Deals', description: 'Share quick deals, discounts, and useful marketplace finds.', available: true },
  { id: 'lost-found', name: 'Lost & Found', description: 'Post lost items, found items, and arrange safe returns.', available: true },
  { id: 'services-network', name: 'Services Network', description: 'Repairs, tutoring, design, laundry, and student services.', available: false },
];

function serializeError(error: unknown) {
  return JSON.stringify(error, Object.getOwnPropertyNames(error || {}), 2);
}

export function getDefaultCommunityGroup(groupId: string) {
  return defaultCommunityGroups.find((group) => group.id === groupId) || null;
}

export async function getCommunityMessages(communityId: string) {
  if (!isValidUuid(communityId)) {
    return { messages: [] as CommunityMessage[], error: null };
  }

  const { data, error } = await supabase
    .from('community_messages')
    .select('id, community_id, sender_id, content, media_urls, created_at')
    .eq('community_id', communityId)
    .order('created_at', { ascending: true })
    .limit(80);

  if (error) {
    console.error('Community messages fetch failed:', serializeError(error));
    return { messages: [] as CommunityMessage[], error: 'Something went wrong. Try again.' };
  }

  const messages = (data || []) as CommunityMessage[];
  const senderIds = Array.from(new Set(messages.map((message) => message.sender_id).filter(Boolean)));

  const { data: profiles, error: profilesError } = senderIds.length
    ? await supabase.from('profiles').select('id, full_name, email, avatar_url').in('id', senderIds)
    : { data: [], error: null };

  if (profilesError) {
    console.error('Community profile fetch failed:', serializeError(profilesError));
  }

  const profilesById = new Map((profiles || []).map((profile) => [profile.id, profile]));
  return {
    messages: messages.map((message) => ({
      ...message,
      media_urls: Array.isArray(message.media_urls) ? message.media_urls : [],
      sender: profilesById.get(message.sender_id) || null,
      status: 'sent' as const,
    })),
    error: profilesError?.message || null,
  };
}

export async function sendCommunityMessage(communityId: string, senderId: string, content: string, mediaUrls: string[] = []) {
  if (!isValidUuid(communityId) || !isValidUuid(senderId)) {
    return { message: null, error: 'This feature is coming soon.' };
  }

  const { data, error } = await supabase
    .from('community_messages')
    .insert({
      community_id: communityId,
      sender_id: senderId,
      content,
      media_urls: mediaUrls,
    })
    .select('id, community_id, sender_id, content, media_urls, created_at')
    .single();

  if (error) {
    console.error('Community message insert failed:', serializeError(error));
    return { message: null, error: 'Message failed to send.' };
  }

  return { message: { ...(data as CommunityMessage), media_urls: (data as CommunityMessage).media_urls || [], status: 'sent' as const }, error: null };
}

export async function uploadCommunityImage(communityId: string, userId: string, file: File) {
  if (!isValidUuid(communityId) || !isValidUuid(userId)) {
    return { publicUrl: null, error: 'This feature is coming soon.' };
  }

  if (file.size > 5 * 1024 * 1024) {
    return { publicUrl: null, error: `${file.name} is larger than 5MB.` };
  }

  const path = `${communityId}/${userId}/${Date.now()}-${safeFileName(file.name)}`;
  return uploadPublicFile(storageBuckets.communityMedia, userId, file, {
    timeoutMs: 25000,
    upsert: false,
    path,
  });
}
