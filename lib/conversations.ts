import { supabase } from './supabase';

export interface Message {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  conversation_id?: string;
}

interface ConversationRecord {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  listing?: { title: string }[];
  messages?: Message[];
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
    console.error('Error fetching conversation:', fetchError);
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
    console.error('Error creating conversation:', insertError);
    return { conversation: null, error: insertError.message };
  }

  return { conversation: inserted, error: null };
}

export async function getUserConversations(userId: string) {
  const { data, error } = await supabase
    .from('conversations')
    .select('id, listing_id, buyer_id, seller_id, listing(title), messages(id, content, created_at, sender_id)')
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`);

  if (error) {
    console.error('Error fetching conversations:', error);
    return { conversations: [], error: error.message };
  }

  const conversations = (data || []).map((conversation: ConversationRecord) => {
    const messages = Array.isArray(conversation.messages) ? conversation.messages : [];
    const lastMessage = messages
      .slice()
      .sort((a: Message, b: Message) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] || null;

    return {
      id: conversation.id,
      listingTitle: conversation.listing?.[0]?.title || 'Listing',
      lastMessage,
      listingId: conversation.listing_id,
    };
  });

  return { conversations, error: null };
}

export async function getConversationById(conversationId: string, userId: string) {
  const { data, error } = await supabase
    .from('conversations')
    .select('id, listing_id, buyer_id, seller_id, listing(title), messages(id, content, created_at, sender_id)')
    .eq('id', conversationId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching conversation by id:', error);
    return { conversation: null, error: error.message };
  }

  if (!data) {
    return { conversation: null, error: 'Conversation not found' };
  }

  if (data.buyer_id !== userId && data.seller_id !== userId) {
    return { conversation: null, error: 'Not authorized' };
  }

  const messages = Array.isArray(data.messages) ? data.messages : [];
  const orderedMessages = messages
    .slice()
    .sort((a: Message, b: Message) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return {
    conversation: {
      id: data.id,
      listingId: data.listing_id,
      listingTitle: data.listing?.[0]?.title || 'Listing',
      messages: orderedMessages,
      buyerId: data.buyer_id,
      sellerId: data.seller_id,
    },
    error: null,
  };
}

export async function sendMessage(conversationId: string, senderId: string, content: string) {
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, content })
    .select('id, conversation_id, sender_id, content, created_at')
    .single();

  if (error) {
    console.error('Error sending message:', error);
    return { message: null, error: error.message };
  }

  return { message: data, error: null };
}
