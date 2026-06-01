import { supabase } from './supabase';
import { withTimeout } from './storage';
import { GENERIC_ERROR, PERMISSION_ERROR, cleanMultilineText, isValidUuid } from './validation';

export interface Message {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  conversation_id?: string;
  status?: 'sending' | 'sent' | 'failed';
}

export interface ConversationUser {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  phone_number?: string | null;
}

type RawMessageRow = {
  id: string;
  conversation_id?: string;
  sender_id?: string;
  content?: string | null;
  created_at?: string;
};

type ConversationRow = {
  id: string;
  listing_id: string | null;
  buyer_id: string;
  seller_id: string;
  hidden_for?: string[] | null;
};

type ListingTitleRow = {
  id: string;
  title: string;
};

type ProfileRow = ConversationUser;

function serializeError(error: unknown) {
  return JSON.stringify(error, Object.getOwnPropertyNames(error || {}), 2);
}

export async function findOrCreateConversation(
  listingId: string,
  buyerId: string,
  sellerId: string
) {
  if (!isValidUuid(listingId) || !isValidUuid(buyerId) || !isValidUuid(sellerId)) {
    return { conversation: null, error: 'Unable to open conversation. Please try again.' };
  }

  const { data: existing, error: fetchError } = await supabase
    .from('conversations')
    .select('id, hidden_for')
    .eq('listing_id', listingId)
    .eq('buyer_id', buyerId)
    .eq('seller_id', sellerId)
    .maybeSingle();

  if (fetchError) {
    console.error('Error fetching conversation:', serializeError(fetchError));
    return { conversation: null, error: GENERIC_ERROR };
  }

  if (existing) {
    const hiddenFor = ((existing as { hidden_for?: string[] | null }).hidden_for || []).filter((id) => id !== buyerId);
    if (hiddenFor.length !== ((existing as { hidden_for?: string[] | null }).hidden_for || []).length) {
      const { error: unhideError } = await supabase
        .from('conversations')
        .update({ hidden_for: hiddenFor })
        .eq('id', existing.id);
      if (unhideError) console.error('Conversation unhide failed:', serializeError(unhideError));
    }
    return { conversation: existing, error: null };
  }

  const { data: inserted, error: insertError } = await supabase
    .from('conversations')
    .insert({ listing_id: listingId, buyer_id: buyerId, seller_id: sellerId })
    .select('id')
    .single();

  if (insertError) {
    console.error('Error creating conversation:', serializeError(insertError));
    return { conversation: null, error: GENERIC_ERROR };
  }

  return { conversation: inserted, error: null };
}

async function fetchConversationMessages(conversationIds: string[]) {
  const validConversationIds = conversationIds.filter(isValidUuid);
  if (validConversationIds.length === 0) return { messagesByConversation: {} as Record<string, Message[]>, error: null };

  const { data, error } = await supabase
    .from('messages')
    .select('id, conversation_id, sender_id, content, created_at')
    .in('conversation_id', validConversationIds)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching conversation messages:', serializeError(error));
    return { messagesByConversation: {} as Record<string, Message[]>, error: GENERIC_ERROR };
  }

  const messagesByConversation = (data || []).reduce<Record<string, Message[]>>((acc, row) => {
    const rawRow = row as RawMessageRow;
    const conversationId = rawRow.conversation_id as string;
    if (!acc[conversationId]) acc[conversationId] = [];

    const message: Message = {
      id: rawRow.id,
      conversation_id: rawRow.conversation_id,
      sender_id: rawRow.sender_id || '',
      content: rawRow.content ?? '',
      created_at: rawRow.created_at || new Date().toISOString(),
      status: 'sent',
    };

    acc[conversationId].push(message);
    return acc;
  }, {});

  return { messagesByConversation, error: null };
}

async function fetchProfiles(userIds: string[]) {
  const validUserIds = userIds.filter(isValidUuid);
  if (validUserIds.length === 0) return { profiles: {} as Record<string, ConversationUser>, error: null };

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, avatar_url, phone_number')
    .in('id', validUserIds);

  if (error) {
    console.error('Error fetching conversation profiles:', serializeError(error));
    return { profiles: {} as Record<string, ConversationUser>, error: GENERIC_ERROR };
  }

  const profiles = (data || []).reduce<Record<string, ConversationUser>>((acc, row) => {
    const profile = row as ProfileRow;
    acc[profile.id] = profile;
    return acc;
  }, {});

  return { profiles, error: null };
}

async function fetchListingTitles(listingIds: string[]) {
  const validListingIds = listingIds.filter(isValidUuid);
  if (validListingIds.length === 0) return { titles: {} as Record<string, string>, error: null };

  const { data, error } = await supabase
    .from('listings')
    .select('id, title')
    .in('id', validListingIds);

  if (error) {
    console.error('Error fetching listing titles:', serializeError(error));
    return { titles: {} as Record<string, string>, error: GENERIC_ERROR };
  }

  const titles = (data || []).reduce<Record<string, string>>((acc, row) => {
    const listing = row as ListingTitleRow;
    acc[listing.id] = listing.title;
    return acc;
  }, {});

  return { titles, error: null };
}

export async function getUserConversations(userId: string) {
  if (!isValidUuid(userId)) {
    return { conversations: [], error: null };
  }

  const { data, error } = await supabase
    .from('conversations')
    .select('id, listing_id, buyer_id, seller_id, hidden_for')
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching conversations:', serializeError(error));
    return { conversations: [], error: GENERIC_ERROR };
  }

  const rows = ((data || []) as ConversationRow[]).filter((row) => !(row.hidden_for || []).includes(userId));
  if (rows.length === 0) {
    return { conversations: [], error: null };
  }

  const conversationIds = rows.map((row) => row.id);
  const listingIds = rows.map((row) => row.listing_id).filter(Boolean) as string[];
  const otherUserIds = rows.map((row) => (row.buyer_id === userId ? row.seller_id : row.buyer_id)).filter(Boolean);

  const [{ messagesByConversation, error: messagesError }, { titles, error: titlesError }, { profiles, error: profilesError }] = await Promise.all([
    fetchConversationMessages(conversationIds),
    fetchListingTitles(Array.from(new Set(listingIds))),
    fetchProfiles(Array.from(new Set(otherUserIds))),
  ]);

  const derivedError = messagesError || titlesError || profilesError;

  const conversations = rows.map((conversation) => {
    const messages = messagesByConversation[conversation.id] || [];
    const lastMessage = messages[messages.length - 1] || null;
    const otherUserId = conversation.buyer_id === userId ? conversation.seller_id : conversation.buyer_id;
    const otherUser = profiles[otherUserId] || {
      id: otherUserId,
      full_name: null,
      email: null,
      avatar_url: null,
    };

    return {
      id: conversation.id,
      listingTitle: conversation.listing_id ? titles[conversation.listing_id] || 'Listing unavailable' : 'General conversation',
      lastMessage,
      listingId: conversation.listing_id || '',
      otherUser,
      unreadCount: lastMessage && lastMessage.sender_id !== userId ? 1 : 0,
    };
  });

  return { conversations, error: derivedError };
}

export async function getConversationById(conversationId: string, userId: string) {
  if (!isValidUuid(conversationId) || !isValidUuid(userId)) {
    return { conversation: null, error: 'Conversation not found.' };
  }

  const { data, error } = await supabase
    .from('conversations')
    .select('id, listing_id, buyer_id, seller_id, hidden_for')
    .eq('id', conversationId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching conversation by id:', serializeError(error));
    return { conversation: null, error: GENERIC_ERROR };
  }

  if (!data) {
    return { conversation: null, error: 'Conversation not found.' };
  }

  if (data.buyer_id !== userId && data.seller_id !== userId) {
    return { conversation: null, error: PERMISSION_ERROR };
  }

  if (((data as ConversationRow).hidden_for || []).includes(userId)) {
    return { conversation: null, error: 'Conversation not found.' };
  }

  const otherUserId = data.buyer_id === userId ? data.seller_id : data.buyer_id;
  const [{ messagesByConversation, error: messagesError }, { titles, error: titlesError }, { profiles, error: profilesError }] = await Promise.all([
    fetchConversationMessages([data.id]),
    fetchListingTitles(data.listing_id ? [data.listing_id] : []),
    fetchProfiles([otherUserId]),
  ]);

  const derivedError = messagesError || titlesError || profilesError;

  return {
    conversation: {
      id: data.id,
      listingId: data.listing_id || '',
      listingTitle: data.listing_id ? titles[data.listing_id] || 'Listing unavailable' : 'General conversation',
      messages: messagesByConversation[data.id] || [],
      buyerId: data.buyer_id,
      sellerId: data.seller_id,
      otherUser: profiles[otherUserId] || {
        id: otherUserId,
        full_name: null,
        email: null,
        avatar_url: null,
      },
    },
    error: derivedError,
  };
}

export async function hideConversationForUser(conversationId: string, userId: string) {
  if (!isValidUuid(conversationId) || !isValidUuid(userId)) {
    return { error: GENERIC_ERROR };
  }

  const { data, error } = await supabase
    .from('conversations')
    .select('id, buyer_id, seller_id, hidden_for')
    .eq('id', conversationId)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error('Conversation hide fetch failed:', serializeError(error));
    return { error: GENERIC_ERROR };
  }

  const row = data as ConversationRow;
  if (row.buyer_id !== userId && row.seller_id !== userId) {
    return { error: PERMISSION_ERROR };
  }

  const hiddenFor = Array.from(new Set([...(row.hidden_for || []), userId]));
  const { error: updateError } = await supabase
    .from('conversations')
    .update({ hidden_for: hiddenFor })
    .eq('id', conversationId);

  if (updateError) {
    console.error('Conversation hide failed:', serializeError(updateError));
    return { error: GENERIC_ERROR };
  }

  return { error: null };
}

export async function sendMessage(conversationId: string, senderId: string, content: string) {
  if (!isValidUuid(conversationId) || !isValidUuid(senderId)) {
    return { message: null, error: 'Message failed to send.' };
  }

  const cleanContent = cleanMultilineText(content, 1200);
  if (!cleanContent) {
    return { message: null, error: 'Message failed to send.' };
  }

  try {
    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .select('id, buyer_id, seller_id')
      .eq('id', conversationId)
      .maybeSingle();

    if (conversationError || !conversation) {
      if (conversationError) console.error('Message conversation check failed:', serializeError(conversationError));
      return { message: null, error: 'Message failed to send.' };
    }

    if (conversation.buyer_id !== senderId && conversation.seller_id !== senderId) {
      return { message: null, error: PERMISSION_ERROR };
    }

    const { data, error } = await withTimeout(
      supabase
        .from('messages')
        .insert({ conversation_id: conversationId, sender_id: senderId, content: cleanContent })
        .select('id, conversation_id, sender_id, content, created_at')
        .single(),
      15000,
      'Message send timed out.'
    );

    if (error) {
      console.error('Error sending message:', serializeError(error));
      return { message: null, error: 'Message failed to send.' };
    }

    return { message: data as Message, error: null };
  } catch (error) {
    console.error('Error sending message:', error);
    return { message: null, error: 'Message failed to send.' };
  }
}
