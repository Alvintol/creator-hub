import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";
import type {
  ConversationInitiationReasonCode,
  ConversationStatus,
  ConversationType,
} from "../../domain/conversations/conversations";

export type MessagesInboxProfile = {
  user_id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export type MessagesInboxListing = {
  id: string;
  title: string;
  preview_url: string | null;
};

export type MessagesInboxConversation = {
  id: string;
  conversation_type: ConversationType;
  buyer_user_id: string;
  creator_user_id: string;
  listing_id: string | null;
  subject: string | null;
  initiation_reason_code: ConversationInitiationReasonCode | null;
  status: ConversationStatus;
  last_message_at: string | null;
  last_message_sender_user_id: string | null;
  last_message_preview: string | null;
  updated_at: string;
  created_at: string;
};

export type MessagesInboxItem = {
  conversation: MessagesInboxConversation;
  otherParticipant: MessagesInboxProfile | null;
  listing: MessagesInboxListing | null;
  participantLastReadAt: string | null;
  hasUnread: boolean;
};

export type MessagesInboxResult = {
  items: MessagesInboxItem[];
};

const emptyResult: MessagesInboxResult = {
  items: [],
};

const fetchMessagesInbox = async (
  userId: string
): Promise<MessagesInboxResult> => {
  const { data: conversations, error: conversationsError } = await supabase
    .from("conversations")
    .select(`
      id,
      conversation_type,
      buyer_user_id,
      creator_user_id,
      listing_id,
      subject,
      initiation_reason_code,
      status,
      last_message_at,
      last_message_sender_user_id,
      last_message_preview,
      updated_at,
      created_at
    `)
    .in("conversation_type", ["creator_inquiry", "listing_inquiry"])
    .or(`buyer_user_id.eq.${userId},creator_user_id.eq.${userId}`)
    .order("updated_at", { ascending: false });

  if (conversationsError) {
    throw conversationsError;
  }

  const conversationRows = (conversations ?? []) as MessagesInboxConversation[];

  if (conversationRows.length === 0) {
    return emptyResult;
  }

  const conversationIds = conversationRows.map((conversation) => conversation.id);

  const otherUserIds = Array.from(
    new Set(
      conversationRows.map((conversation) =>
        conversation.buyer_user_id === userId
          ? conversation.creator_user_id
          : conversation.buyer_user_id
      )
    )
  );

  const listingIds = Array.from(
    new Set(
      conversationRows
        .map((conversation) => conversation.listing_id)
        .filter((listingId): listingId is string => Boolean(listingId))
    )
  );

  const [
    { data: profiles, error: profilesError },
    { data: listings, error: listingsError },
    { data: participants, error: participantsError },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("user_id, handle, display_name, avatar_url")
      .in("user_id", otherUserIds),
    listingIds.length > 0
      ? supabase
          .from("listings")
          .select("id, title, preview_url")
          .in("id", listingIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("conversation_participants")
      .select("conversation_id, last_read_at")
      .eq("user_id", userId)
      .in("conversation_id", conversationIds),
  ]);

  if (profilesError) {
    throw profilesError;
  }

  if (listingsError) {
    throw listingsError;
  }

  if (participantsError) {
    throw participantsError;
  }

  const profileByUserId = Object.fromEntries(
    ((profiles ?? []) as MessagesInboxProfile[]).map((profile) => [
      profile.user_id,
      profile,
    ])
  ) as Record<string, MessagesInboxProfile>;

  const listingById = Object.fromEntries(
    ((listings ?? []) as MessagesInboxListing[]).map((listing) => [
      listing.id,
      listing,
    ])
  ) as Record<string, MessagesInboxListing>;

  const participantByConversationId = Object.fromEntries(
    ((participants ?? []) as Array<{
      conversation_id: string;
      last_read_at: string | null;
    }>).map((participant) => [
      participant.conversation_id,
      participant,
    ])
  );

  return {
    items: conversationRows.map((conversation) => {
      const otherUserId =
        conversation.buyer_user_id === userId
          ? conversation.creator_user_id
          : conversation.buyer_user_id;

      const participant = participantByConversationId[conversation.id] ?? null;
      const participantLastReadAt = participant?.last_read_at ?? null;

      const hasUnread =
        Boolean(conversation.last_message_at) &&
        conversation.last_message_sender_user_id !== userId &&
        (!participantLastReadAt ||
          conversation.last_message_at! > participantLastReadAt);

      return {
        conversation,
        otherParticipant: profileByUserId[otherUserId] ?? null,
        listing: conversation.listing_id
          ? listingById[conversation.listing_id] ?? null
          : null,
        participantLastReadAt,
        hasUnread,
      };
    }),
  };
};

export const useMessagesInbox = () => {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;

  return useQuery<MessagesInboxResult>({
    queryKey: ["messagesInbox", userId],
    enabled: !loading && Boolean(userId),
    queryFn: () =>
      userId ? fetchMessagesInbox(userId) : Promise.resolve(emptyResult),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
};