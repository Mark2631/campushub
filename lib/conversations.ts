import { supabase } from './supabase';

export interface Message {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  conversation_id?: string;
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
};

type ListingTitleRow = {
  id: string;
  title: string;
};

function serializeError(error: unknown) {
  return JSON.stringify(error, Object.getOwnPropertyNames(error || {}), 2);
}

export async function findOrCreateConversation(
  listingId: string,
  buyerId: string,
  sellerId: string
) {
  const { data: existing, error: fetchError } = await supabase
    .from('conversations')
    .select('id')
    .eq('listing_id', listingId)
    .eq('buyer_id', buyerId)
    .eq('seller_id', sellerId)
    .maybeSingle();

  if (fetchError) {
    console.error('Error fetching conversation:', serializeError(fetchError));
    return { conversation: null, error: fetchError.message };
  }

  if (existing) {
    return { conversation: existing, error: null };
  }

  const { data: inserted, error: insertError } = await supabase
    .from('conversations')
    .insert({ listing_id: listingId, buyer_id: buyerId, seller_id: sellerId })
    .select('id')
    .single();

  if (insertError) {
    console.error('Error creating conversation:', serializeError(insertError));
    return { conversation: null, error: insertError.message };
  }

  return { conversation: inserted, error: null };
}

async function fetchConversationMessages(conversationIds: string[]) {
  if (conversationIds.length === 0) return { messagesByConversation: {} as Record<string, Message[]>, error: null };

  const { data, error } = await supabase
    .from('messages')
    .select('id, conversation_id, sender_id, content, created_at')
    .in('conversation_id', conversationIds)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching conversation messages:', serializeError(error));
    return { messagesByConversation: {} as Record<string, Message[]>, error: error.message };
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
    };

    acc[conversationId].push(message);
    return acc;
  }, {});

  return { messagesByConversation, error: null };
}

async function fetchListingTitles(listingIds: string[]) {
  if (listingIds.length === 0) return { titles: {} as Record<string, string>, error: null };

  const { data, error } = await supabase
    .from('listings')
    .select('id, title')
    .in('id', listingIds);

  if (error) {
    console.error('Error fetching listing titles:', serializeError(error));
    return { titles: {} as Record<string, string>, error: error.message };
  }

  const titles = (data || []).reduce<Record<string, string>>((acc, row) => {
    const listing = row as ListingTitleRow;
    acc[listing.id] = listing.title;
    return acc;
  }, {});

  return { titles, error: null };
}

export async function getUserConversations(userId: string) {
  const { data, error } = await supabase
    .from('conversations')
    .select('id, listing_id, buyer_id, seller_id')
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching conversations:', serializeError(error));
    return { conversations: [], error: error.message };
  }

  const rows = (data || []) as ConversationRow[];
  if (rows.length === 0) {
    return { conversations: [], error: null };
  }

  const conversationIds = rows.map((row) => row.id);
  const listingIds = rows.map((row) => row.listing_id).filter(Boolean) as string[];

  const [{ messagesByConversation, error: messagesError }, { titles, error: titlesError }] = await Promise.all([
    fetchConversationMessages(conversationIds),
    fetchListingTitles(Array.from(new Set(listingIds))),
  ]);

  const derivedError = messagesError || titlesError;

  const conversations = rows.map((conversation) => {
    const messages = messagesByConversation[conversation.id] || [];
    const lastMessage = messages[messages.length - 1] || null;

    return {
      id: conversation.id,
      listingTitle: conversation.listing_id ? titles[conversation.listing_id] || 'Listing unavailable' : 'General conversation',
      lastMessage,
      listingId: conversation.listing_id || '',
    };
  });

  return { conversations, error: derivedError };
}

export async function getConversationById(conversationId: string, userId: string) {
  const { data, error } = await supabase
    .from('conversations')
    .select('id, listing_id, buyer_id, seller_id')
    .eq('id', conversationId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching conversation by id:', serializeError(error));
    return { conversation: null, error: error.message };
  }

  if (!data) {
    return { conversation: null, error: 'Conversation not found.' };
  }

  if (data.buyer_id !== userId && data.seller_id !== userId) {
    return { conversation: null, error: 'Not authorized.' };
  }

  const [{ messagesByConversation, error: messagesError }, { titles, error: titlesError }] = await Promise.all([
    fetchConversationMessages([data.id]),
    fetchListingTitles(data.listing_id ? [data.listing_id] : []),
  ]);

  const derivedError = messagesError || titlesError;

  return {
    conversation: {
      id: data.id,
      listingId: data.listing_id || '',
      listingTitle: data.listing_id ? titles[data.listing_id] || 'Listing unavailable' : 'General conversation',
      messages: messagesByConversation[data.id] || [],
      buyerId: data.buyer_id,
      sellerId: data.seller_id,
    },
    error: derivedError,
  };
}

export async function sendMessage(conversationId: string, senderId: string, content: string) {
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, content })
    .select('id, conversation_id, sender_id, content, created_at')
    .single();

  if (error) {
    console.error('Error sending message:', serializeError(error));
    return { message: null, error: error.message };
  }

  return { message: data as Message, error: null };
}
